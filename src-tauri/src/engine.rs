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
    pub export_format: String, // "zip", "tar.gz", "tar", "folder"
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

        self.log(&format!("Starting backup for @{}", self.config.screen_name), "INFO");

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

        // 2. Fetch Timeline
        self.log("Collecting timeline posts via FxTwitter API...", "INFO");
        let mut collected_tweets: Vec<serde_json::Value> = Vec::new();
        let mut seen_ids: HashSet<String> = HashSet::new();
        let mut cursor: Option<String> = None;

        loop {
            if *self.is_stopping.lock().await {
                self.log("User requested stop.", "WARN");
                break;
            }

            if self.config.max_tweets > 0 && collected_tweets.len() >= self.config.max_tweets {
                self.log(&format!("Reached max tweets limit ({})", self.config.max_tweets), "INFO");
                break;
            }

            let resp = match self.client.get_statuses(&self.config.screen_name, cursor.as_deref()).await {
                Ok(r) => r,
                Err(e) => {
                    self.log(&format!("Statuses request error: {}", e), "WARN");
                    break;
                }
            };

            let count = resp.results.len();
            if count == 0 {
                self.log("No more statuses found.", "INFO");
                break;
            }

            for item in resp.results {
                if let Some(id_str) = item.get("id").and_then(|v| v.as_str()) {
                    if seen_ids.insert(id_str.to_string()) {
                        collected_tweets.push(item);
                        let mut m = self.metrics.lock().await;
                        m.tweets_matching += 1;
                    }
                }
            }

            self.log(&format!("Added page of tweets. Total collected: {}", collected_tweets.len()), "INFO");

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

        // 4. Save JSON, CSV, Summary
        let tweets_json_path = self.output_dir.join("tweets.json");
        let profile_json_path = self.output_dir.join("profile.json");
        let summary_json_path = self.output_dir.join("summary.json");
        let readme_path = self.output_dir.join("README.txt");

        fs::write(&tweets_json_path, serde_json::to_string_pretty(&collected_tweets).unwrap_or_default()).ok();
        fs::write(&profile_json_path, serde_json::to_string_pretty(&profile).unwrap_or_default()).ok();

        let readme = format!(
"=====================================================
FxTwitter Archive Studio (by Hikaproj)
=====================================================
Target Handle: @{}
Total Tweets:  {}
Export Date:   {}

Files:
- tweets.json   : Complete JSON records
- profile.json  : Target profile metadata
- summary.json  : Execution statistics
- media/        : Downloaded media files
=====================================================",
            self.config.screen_name,
            collected_tweets.len(),
            Local::now().to_rfc3339()
        );
        fs::write(&readme_path, readme).ok();

        // 5. Compress Archive
        let final_path = if self.config.export_format == "tar.gz" {
            let tar_path = self.output_dir.with_extension("tar.gz");
            self.create_tar_gz(&self.output_dir, &tar_path)?;
            tar_path
        } else if self.config.export_format == "zip" || self.config.export_format == "xarchpjzip" {
            let ext = if self.config.export_format == "xarchpjzip" { "xarchpjzip" } else { "zip" };
            let zip_path = self.output_dir.with_extension(ext);
            self.create_zip(&self.output_dir, &zip_path)?;
            zip_path
        } else {
            self.output_dir.clone()
        };

        self.log(&format!("Archive ready at: {:?}", final_path), "SUCCESS");
        Ok(final_path)
    }

    async fn wait_for_unlock(&self) -> Result<(), String> {
        let mut retries = 0;
        loop {
            if *self.is_stopping.lock().await {
                return Err("Stopped while waiting for unlock".to_string());
            }
            sleep(Duration::from_secs(5)).await;
            retries += 1;
            self.log(&format!("Checking if account is unlocked (attempt #{})", retries), "INFO");

            if let Ok(p) = self.client.get_profile(&self.config.screen_name).await {
                if !p.r#protected {
                    self.log("Account is now PUBLIC! Continuing extraction...", "SUCCESS");
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
                zip.start_file(relative.to_string_lossy(), options).map_err(|e| e.to_string())?;
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
