use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{Write, Read};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use chrono::Local;
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, Mutex};
use tokio::time::sleep;
use futures_util::stream::{self, StreamExt};

use crate::fxtwitter::{FxClient, UserProfile};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScrapeConfig {
    pub screen_name: String,
    pub download_images: bool,
    pub image_quality: String, // "orig", "large", "medium", "small"
    pub download_videos: bool,
    pub video_quality: String, // "highest", "1080p", "720p", "480p", "lowest"
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub direction: String, // "newest", "oldest"
    pub include_replies: bool,
    pub include_reposts: bool,
    pub include_quotes: bool,
    pub include_originals: bool,
    pub retry_on_locked: bool,
    pub start_on_locked: bool,
    pub export_format: String, // "zip", "xarchpjzip", "tar.gz", "tar", "folder"
    pub media_concurrency: usize,
    pub max_tweets: usize,
    pub continuous: bool,
    pub continuous_interval: u64,
}

impl Default for ScrapeConfig {
    fn default() -> Self {
        Self {
            screen_name: String::new(),
            download_images: true,
            image_quality: "orig".to_string(),
            download_videos: true,
            video_quality: "highest".to_string(),
            date_from: None,
            date_to: None,
            direction: "newest".to_string(),
            include_replies: true,
            include_reposts: true,
            include_quotes: true,
            include_originals: true,
            retry_on_locked: true,
            start_on_locked: true,
            export_format: "zip".to_string(),
            media_concurrency: 8,
            max_tweets: 0,
            continuous: false,
            continuous_interval: 30,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineMetrics {
    pub tweets_processed: u64,
    pub tweets_matching: u64,
    pub images_found: u64,
    pub videos_found: u64,
    pub media_downloaded: u64,
    pub media_failed: u64,
    pub total_bytes: u64,
    pub profile_updates: u64,
    pub lock_retries: u64,
    pub speed_tweets_per_sec: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskEvent {
    pub level: String,
    pub message: String,
    pub timestamp: String,
}

#[derive(Debug, Clone)]
struct MediaItem {
    url: String,
    dest: PathBuf,
}

pub struct ScrapeEngine {
    config: ScrapeConfig,
    client: Arc<FxClient>,
    output_dir: PathBuf,
    is_stopping: Arc<Mutex<bool>>,
    metrics: Arc<Mutex<EngineMetrics>>,
    event_tx: Option<mpsc::UnboundedSender<TaskEvent>>,
}

impl ScrapeEngine {
    pub fn new(config: ScrapeConfig, base_output: &Path, tx: Option<mpsc::UnboundedSender<TaskEvent>>) -> Self {
        let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
        let clean_name = config.screen_name.trim_start_matches('@').trim();
        let folder_name = format!("{}_{}", clean_name, timestamp);
        let output_dir = base_output.join(folder_name);

        Self {
            config,
            client: Arc::new(FxClient::new()),
            output_dir,
            is_stopping: Arc::new(Mutex::new(false)),
            metrics: Arc::new(Mutex::new(EngineMetrics {
                tweets_processed: 0,
                tweets_matching: 0,
                images_found: 0,
                videos_found: 0,
                media_downloaded: 0,
                media_failed: 0,
                total_bytes: 0,
                profile_updates: 0,
                lock_retries: 0,
                speed_tweets_per_sec: 0.0,
            })),
            event_tx: tx,
        }
    }

    fn log(&self, msg: &str, level: &str) {
        let ts = Local::now().format("%H:%M:%S").to_string();
        println!("[{}] [{}] {}", ts, level, msg);
        if let Some(tx) = &self.event_tx {
            let _ = tx.send(TaskEvent {
                level: level.to_string(),
                message: msg.to_string(),
                timestamp: ts,
            });
        }
    }

    pub async fn stop(&self) {
        let mut lock = self.is_stopping.lock().await;
        *lock = true;
    }

    pub async fn run(&self) -> Result<PathBuf, String> {
        fs::create_dir_all(&self.output_dir).map_err(|e| e.to_string())?;
        fs::create_dir_all(self.output_dir.join("media")).map_err(|e| e.to_string())?;
        fs::create_dir_all(self.output_dir.join("profile_media")).map_err(|e| e.to_string())?;

        self.log(&format!("Starting native backup for @{} (by Hikaproj)", self.config.screen_name), "INFO");

        // 1. Initial Profile
        let profile = match self.client.get_profile(&self.config.screen_name).await {
            Ok(p) => p,
            Err(e) => {
                self.log(&format!("Failed to retrieve profile: {}", e), "ERROR");
                return Err(e);
            }
        };

        if profile.r#protected {
            if !self.config.start_on_locked {
                self.log("Account is private and start_on_locked is disabled.", "WARN");
                return Err("Account is locked".to_string());
            }
            self.log("Account is currently locked. Entering unlock-waiting loop...", "WARN");
            self.wait_for_unlock().await?;
        }

        // Enqueue Profile Media (Avatar & Banner)
        let mut media_queue: Vec<MediaItem> = Vec::new();
        if let Some(avatar) = &profile.avatar_url {
            let ext = extract_extension(avatar, "jpg");
            media_queue.push(MediaItem {
                url: avatar.clone(),
                dest: self.output_dir.join("profile_media").join(format!("avatar.{}", ext)),
            });
        }
        if let Some(banner) = &profile.banner_url {
            let ext = extract_extension(banner, "jpg");
            media_queue.push(MediaItem {
                url: banner.clone(),
                dest: self.output_dir.join("profile_media").join(format!("banner.{}", ext)),
            });
        }

        // 2. Fetch Timeline
        self.log("Collecting timeline posts via FxTwitter API...", "INFO");
        let mut collected_tweets: Vec<serde_json::Value> = Vec::new();
        let mut seen_ids: HashSet<String> = HashSet::new();
        let mut cursor: Option<String> = None;

        loop {
            if *self.is_stopping.lock().await {
                self.log("Stop requested by user.", "WARN");
                break;
            }

            if self.config.max_tweets > 0 && collected_tweets.len() >= self.config.max_tweets {
                self.log(&format!("Reached max tweets limit ({})", self.config.max_tweets), "INFO");
                break;
            }

            let resp = match self.client.get_statuses(&self.config.screen_name, cursor.as_deref()).await {
                Ok(r) => r,
                Err(e) => {
                    self.log(&format!("Statuses request notice: {}", e), "WARN");
                    break;
                }
            };

            let count = resp.results.len();
            if count == 0 {
                self.log("All available timeline posts fetched.", "INFO");
                break;
            }

            for item in resp.results {
                if let Some(id_str) = item.get("id").and_then(|v| v.as_str()).map(|s| s.to_string())
                    .or_else(|| item.get("id").and_then(|v| v.as_i64()).map(|n| n.to_string())) {
                    if seen_ids.insert(id_str.clone()) {
                        // Extract tweet media
                        self.extract_tweet_media(&item, &id_str, &mut media_queue).await;
                        collected_tweets.push(item);

                        let mut m = self.metrics.lock().await;
                        m.tweets_matching += 1;
                        m.tweets_processed += 1;
                    }
                }
            }

            self.log(&format!("Retrieved batch. Total collected: {} tweets", collected_tweets.len()), "INFO");

            if let Some(c) = resp.cursor.and_then(|c| c.bottom) {
                if Some(&c) == cursor.as_ref() {
                    break;
                }
                cursor = Some(c);
            } else {
                break;
            }

            sleep(Duration::from_millis(100)).await;
        }

        // 3. Sorting
        if self.config.direction == "oldest" {
            collected_tweets.sort_by_key(|t| t.get("created_timestamp").and_then(|v| v.as_i64()).unwrap_or(0));
        } else {
            collected_tweets.sort_by_key(|t| -t.get("created_timestamp").and_then(|v| v.as_i64()).unwrap_or(0));
        }

        // 4. Download Enqueued Media Concurrently
        if !media_queue.is_empty() && (self.config.download_images || self.config.download_videos) {
            self.download_media_concurrently(&media_queue).await;
        }

        // 5. Continuous Monitoring Loop (if enabled)
        if self.config.continuous {
            self.log(&format!("Entering continuous live monitoring mode (polling every {}s)...", self.config.continuous_interval), "INFO");
            let check_interval = Duration::from_secs(self.config.continuous_interval.max(5));
            loop {
                if *self.is_stopping.lock().await {
                    self.log("Stopping continuous live monitoring.", "INFO");
                    break;
                }

                sleep(check_interval).await;
                if *self.is_stopping.lock().await { break; }

                match self.client.get_statuses(&self.config.screen_name, None).await {
                    Ok(resp) => {
                        let mut new_items: Vec<MediaItem> = Vec::new();
                        let mut new_count = 0;
                        for item in resp.results {
                            if let Some(id_str) = item.get("id").and_then(|v| v.as_str()).map(|s| s.to_string())
                                .or_else(|| item.get("id").and_then(|v| v.as_i64()).map(|n| n.to_string())) {
                                if seen_ids.insert(id_str.clone()) {
                                    new_count += 1;
                                    self.extract_tweet_media(&item, &id_str, &mut new_items).await;
                                    collected_tweets.insert(0, item);
                                    let mut m = self.metrics.lock().await;
                                    m.tweets_matching += 1;
                                    m.tweets_processed += 1;
                                }
                            }
                        }
                        if new_count > 0 {
                            self.log(&format!("Detected {} new posts in live monitoring!", new_count), "SUCCESS");
                            if !new_items.is_empty() {
                                self.download_media_concurrently(&new_items).await;
                            }
                            // Save intermediate files
                            self.save_metadata_files(&collected_tweets, &profile).await;
                        }
                    }
                    Err(e) => {
                        self.log(&format!("Continuous polling check error: {}", e), "WARN");
                    }
                }
            }
        }

        // 6. Save JSON, CSV, Summary, README
        self.save_metadata_files(&collected_tweets, &profile).await;

        // 7. Compress Archive
        let final_path = if self.config.export_format == "tar.gz" {
            let tar_path = self.output_dir.with_extension("tar.gz");
            self.create_tar_gz(&self.output_dir, &tar_path)?;
            tar_path
        } else if self.config.export_format == "zip" || self.config.export_format == "xarchpjzip" {
            let ext = if self.config.export_format == "xarchpjzip" { "xarchpjzip" } else { "zip" };
            let zip_path = self.output_dir.with_extension(ext);
            self.create_zip(&self.output_dir, &zip_path)?;
            zip_path
        } else if self.config.export_format == "tar" {
            let tar_path = self.output_dir.with_extension("tar");
            self.create_tar(&self.output_dir, &tar_path)?;
            tar_path
        } else {
            self.output_dir.clone()
        };

        self.log(&format!("Archive successfully built: {:?}", final_path), "SUCCESS");
        Ok(final_path)
    }

    async fn extract_tweet_media(&self, item: &serde_json::Value, tweet_id: &str, queue: &mut Vec<MediaItem>) {
        let media_obj = item.get("media");
        
        // Extract photos
        if self.config.download_images {
            if let Some(photos) = media_obj.and_then(|m| m.get("photos")).and_then(|p| p.as_array()) {
                for (idx, photo) in photos.iter().enumerate() {
                    if let Some(raw_url) = photo.get("url").and_then(|u| u.as_str()) {
                        let adjusted_url = select_image_url(raw_url, &self.config.image_quality);
                        let ext = extract_extension(&adjusted_url, "jpg");
                        let dest = self.output_dir.join("media").join(format!("{}_photo_{}.{}", tweet_id, idx + 1, ext));
                        queue.push(MediaItem { url: adjusted_url, dest });
                        let mut m = self.metrics.lock().await;
                        m.images_found += 1;
                    }
                }
            }
        }

        // Extract videos
        if self.config.download_videos {
            if let Some(videos) = media_obj.and_then(|m| m.get("videos")).and_then(|v| v.as_array()) {
                for (idx, video) in videos.iter().enumerate() {
                    let chosen_url = select_video_url(video, &self.config.video_quality);
                    if let Some(url) = chosen_url {
                        let dest = self.output_dir.join("media").join(format!("{}_video_{}.mp4", tweet_id, idx + 1));
                        queue.push(MediaItem { url, dest });
                        let mut m = self.metrics.lock().await;
                        m.videos_found += 1;
                    }
                }
            }
        }
    }

    async fn download_media_concurrently(&self, items: &[MediaItem]) {
        let total = items.len();
        self.log(&format!("Downloading {} media items with concurrency {}...", total, self.config.media_concurrency), "INFO");

        let concurrency = self.config.media_concurrency.clamp(1, 32);
        let client = Arc::clone(&self.client);
        let metrics = Arc::clone(&self.metrics);

        let stream = stream::iter(items.iter().cloned().map(move |item| {
            let client = Arc::clone(&client);
            let metrics = Arc::clone(&metrics);
            async move {
                match client.download_to_file(&item.url, &item.dest).await {
                    Ok(bytes) => {
                        let mut m = metrics.lock().await;
                        m.media_downloaded += 1;
                        m.total_bytes += bytes;
                    }
                    Err(_) => {
                        let mut m = metrics.lock().await;
                        m.media_failed += 1;
                    }
                }
            }
        })).buffer_unordered(concurrency);

        stream.collect::<Vec<()>>().await;

        let m = self.metrics.lock().await;
        self.log(&format!("Media download finished: {} succeeded, {} failed (Total: {} bytes)", m.media_downloaded, m.media_failed, m.total_bytes), "SUCCESS");
    }

    async fn save_metadata_files(&self, tweets: &[serde_json::Value], profile: &UserProfile) {
        let tweets_json_path = self.output_dir.join("tweets.json");
        let profile_json_path = self.output_dir.join("profile.json");
        let summary_json_path = self.output_dir.join("summary.json");
        let readme_path = self.output_dir.join("README.txt");

        fs::write(&tweets_json_path, serde_json::to_string_pretty(tweets).unwrap_or_default()).ok();
        fs::write(&profile_json_path, serde_json::to_string_pretty(profile).unwrap_or_default()).ok();

        let m = self.metrics.lock().await;
        fs::write(&summary_json_path, serde_json::to_string_pretty(&*m).unwrap_or_default()).ok();

        let readme = format!(
"=====================================================
FxTwitter Archive Studio (by Hikaproj)
=====================================================
Target Handle: @{}
Total Tweets:  {}
Media Files:   {} (downloaded)
Total Bytes:   {} bytes
Export Date:   {}

Files Included:
- tweets.json   : Complete structured JSON of collected posts
- profile.json  : Detailed target profile metadata
- summary.json  : Performance metrics & execution stats
- media/        : Downloaded photos, gifs, and mp4 videos
- profile_media/: Profile avatar and header images

Powered by FixTweet / FxTwitter API & Hikaproj
=====================================================",
            self.config.screen_name,
            tweets.len(),
            m.media_downloaded,
            m.total_bytes,
            Local::now().to_rfc3339()
        );
        fs::write(&readme_path, readme).ok();
    }

    async fn wait_for_unlock(&self) -> Result<(), String> {
        let mut retries = 0;
        loop {
            if *self.is_stopping.lock().await {
                return Err("Stopped while waiting for account unlock".to_string());
            }
            sleep(Duration::from_secs(5)).await;
            retries += 1;
            {
                let mut m = self.metrics.lock().await;
                m.lock_retries = retries;
            }
            self.log(&format!("Polling locked account @{} (check #{})", self.config.screen_name, retries), "INFO");

            if let Ok(p) = self.client.get_profile(&self.config.screen_name).await {
                if !p.r#protected {
                    self.log("Account is now PUBLIC! Resuming extraction...", "SUCCESS");
                    return Ok(());
                }
            }
        }
    }

    fn create_zip(&self, src: &Path, dst: &Path) -> Result<(), String> {
        let file = File::create(dst).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        for entry in walkdir(src)? {
            let relative = entry.strip_prefix(src).map_err(|e| e.to_string())?;
            if entry.is_file() {
                let entry_name = relative.to_string_lossy().replace('\\', "/");
                zip.start_file(entry_name, options).map_err(|e| e.to_string())?;
                let mut f = File::open(&entry).map_err(|e| e.to_string())?;
                let mut buf = Vec::new();
                f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
                zip.write_all(&buf).map_err(|e| e.to_string())?;
            }
        }

        zip.finish().map_err(|e| e.to_string())?;
        Ok(())
    }

    fn create_tar_gz(&self, src: &Path, dst: &Path) -> Result<(), String> {
        let file = File::create(dst).map_err(|e| e.to_string())?;
        let enc = flate2::write::GzEncoder::new(file, flate2::Compression::default());
        let mut tar = tar::Builder::new(enc);
        tar.append_dir_all(".", src).map_err(|e| e.to_string())?;
        tar.finish().map_err(|e| e.to_string())?;
        Ok(())
    }

    fn create_tar(&self, src: &Path, dst: &Path) -> Result<(), String> {
        let file = File::create(dst).map_err(|e| e.to_string())?;
        let mut tar = tar::Builder::new(file);
        tar.append_dir_all(".", src).map_err(|e| e.to_string())?;
        tar.finish().map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn select_image_url(raw_url: &str, quality: &str) -> String {
    if raw_url.contains("twimg.com") {
        if let Some(pos) = raw_url.find('?') {
            let base = &raw_url[..pos];
            return format!("{}?name={}", base, quality);
        } else {
            return format!("{}?name={}", raw_url, quality);
        }
    }
    raw_url.to_string()
}

fn select_video_url(video: &serde_json::Value, quality: &str) -> Option<String> {
    if let Some(formats) = video.get("formats").and_then(|f| f.as_array()) {
        let mut mp4s: Vec<&serde_json::Value> = formats.iter()
            .filter(|f| f.get("container").and_then(|c| c.as_str()).map_or(false, |c| c == "mp4") ||
                        f.get("url").and_then(|u| u.as_str()).map_or(false, |u| u.contains(".mp4")))
            .collect();

        if !mp4s.is_empty() {
            mp4s.sort_by_key(|f| f.get("bitrate").and_then(|b| b.as_i64()).unwrap_or(0));
            if quality == "lowest" {
                return mp4s[0].get("url").and_then(|u| u.as_str()).map(|s| s.to_string());
            } else {
                return mp4s.last().and_then(|f| f.get("url").and_then(|u| u.as_str())).map(|s| s.to_string());
            }
        }
    }

    if let Some(direct_url) = video.get("url").and_then(|u| u.as_str()) {
        if !direct_url.contains(".m3u8") {
            return Some(direct_url.to_string());
        }
    }
    None
}

fn extract_extension(url: &str, fallback: &str) -> String {
    let clean = if let Some(pos) = url.find('?') { &url[..pos] } else { url };
    if let Some(dot_pos) = clean.rfind('.') {
        let ext = &clean[dot_pos + 1..];
        if ext.len() <= 4 && ext.chars().all(|c| c.is_alphanumeric()) {
            return ext.to_lowercase();
        }
    }
    fallback.to_string()
}

fn walkdir(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    if dir.is_dir() {
        for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_dir() {
                files.extend(walkdir(&path)?);
            } else {
                files.push(path);
            }
        }
    }
    Ok(files)
}
