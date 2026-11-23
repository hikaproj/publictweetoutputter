use serde::{Deserialize, Serialize};
use std::time::Duration;
use std::path::Path;
use futures_util::StreamExt;
use tokio::io::AsyncWriteExt;

pub const BASE_URL: &str = "https://api.fxtwitter.com";
pub const USER_AGENT: &str = "FxTwitterArchiveStudio/1.0 (Rust; by Hikaproj)";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub code: Option<u16>,
    pub message: Option<String>,
    #[serde(flatten)]
    pub data: T,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UserProfile {
    pub screen_name: String,
    pub name: Option<String>,
    pub id: Option<String>,
    pub description: Option<String>,
    pub location: Option<String>,
    pub banner_url: Option<String>,
    pub avatar_url: Option<String>,
    pub joined: Option<String>,
    pub birthday: Option<String>,
    pub website: Option<serde_json::Value>,
    #[serde(default)]
    pub r#protected: bool,
    #[serde(default)]
    pub followers: u64,
    #[serde(default)]
    pub following: u64,
    #[serde(default)]
    pub likes: u64,
    #[serde(default)]
    pub media_count: u64,
    #[serde(default)]
    pub statuses: u64,
    pub verification: Option<serde_json::Value>,
    pub pinned_tweet: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileResponse {
    pub user: Option<UserProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusCursor {
    pub top: Option<String>,
    pub bottom: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusesResponse {
    #[serde(default)]
    pub results: Vec<serde_json::Value>,
    pub cursor: Option<StatusCursor>,
}

pub struct FxClient {
    client: reqwest::Client,
}

impl FxClient {
    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(Duration::from_secs(20))
            .pool_idle_timeout(Duration::from_secs(60))
            .pool_max_idle_per_host(10)
            .build()
            .unwrap_or_default();
        Self { client }
    }

    pub async fn get_profile(&self, screen_name: &str) -> Result<UserProfile, String> {
        let clean = screen_name.trim_start_matches('@').trim();
        if clean.is_empty() {
            return Err("Empty username provided".to_string());
        }

        let endpoints = [
            format!("{}/2/profile/{}", BASE_URL, clean),
            format!("{}/{}", BASE_URL, clean),
        ];

        let mut last_err = String::new();

        for url in &endpoints {
            let mut attempts = 0;
            while attempts < 3 {
                attempts += 1;
                match self.client.get(url).header("Accept", "application/json").send().await {
                    Ok(res) => {
                        let status = res.status();
                        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                            tokio::time::sleep(Duration::from_millis(800 * attempts)).await;
                            continue;
                        }

                        let text = res.text().await.unwrap_or_default();

                        if text.trim_start().starts_with("<!DOCTYPE") || text.trim_start().starts_with("<html") {
                            last_err = format!("Endpoint {} returned HTML (service down or rate limited)", url);
                            break;
                        }

                        if !status.is_success() {
                            last_err = format!("HTTP {} from {}", status, url);
                            break;
                        }

                        if let Ok(resp) = serde_json::from_str::<ApiResponse<ProfileResponse>>(&text) {
                            if let Some(user) = resp.data.user {
                                return Ok(user);
                            }
                        }

                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                            if let Some(user_val) = v.get("user") {
                                if let Ok(user) = serde_json::from_value::<UserProfile>(user_val.clone()) {
                                    return Ok(user);
                                }
                            }
                        }

                        last_err = format!("Failed to parse user JSON from {}", url);
                        break;
                    }
                    Err(e) => {
                        last_err = format!("HTTP request error for {}: {}", url, e);
                        tokio::time::sleep(Duration::from_millis(300 * attempts)).await;
                    }
                }
            }
        }

        Err(if last_err.is_empty() {
            format!("User @{} could not be found or API returned an invalid response.", clean)
        } else {
            last_err
        })
    }

    pub async fn get_statuses(&self, screen_name: &str, cursor: Option<&str>) -> Result<StatusesResponse, String> {
        let clean = screen_name.trim_start_matches('@').trim();
        let mut url = format!("{}/2/profile/{}/statuses", BASE_URL, clean);
        if let Some(c) = cursor {
            url.push_str(&format!("?cursor={}", c));
        }

        let mut attempts = 0;
        let mut last_err = String::new();

        while attempts < 3 {
            attempts += 1;
            match self.client.get(&url).header("Accept", "application/json").send().await {
                Ok(res) => {
                    let status = res.status();
                    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                        tokio::time::sleep(Duration::from_millis(1000 * attempts)).await;
                        continue;
                    }

                    if !status.is_success() {
                        last_err = format!("Statuses returned HTTP {}", status);
                        tokio::time::sleep(Duration::from_millis(500 * attempts)).await;
                        continue;
                    }

                    let text = res.text().await.map_err(|e| e.to_string())?;
                    if text.trim_start().starts_with("<!DOCTYPE") || text.trim_start().starts_with("<html") {
                        last_err = "FxTwitter API returned HTML instead of JSON for statuses".to_string();
                        tokio::time::sleep(Duration::from_millis(500 * attempts)).await;
                        continue;
                    }

                    let resp: StatusesResponse = serde_json::from_str(&text)
                        .map_err(|e| format!("JSON decode error: {}", e))?;

                    return Ok(resp);
                }
                Err(e) => {
                    last_err = format!("HTTP request error: {}", e);
                    tokio::time::sleep(Duration::from_millis(500 * attempts)).await;
                }
            }
        }

        Err(if last_err.is_empty() {
            "Failed to retrieve statuses after retries".to_string()
        } else {
            last_err
        })
    }

    /// Stream file directly to disk in bounded chunks to prevent Out-Of-Memory (OOM) during long archiving
    pub async fn download_to_file(&self, url: &str, dest: &Path) -> Result<u64, String> {
        let mut attempts = 0;
        let max_attempts = 3;
        let mut last_error = String::new();

        while attempts < max_attempts {
            attempts += 1;
            match self.client.get(url).send().await {
                Ok(res) => {
                    if res.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                        tokio::time::sleep(Duration::from_millis(600 * (1 << attempts))).await;
                        continue;
                    }
                    if !res.status().is_success() {
                        last_error = format!("HTTP error {}", res.status());
                        tokio::time::sleep(Duration::from_millis(250)).await;
                        continue;
                    }

                    let mut stream = res.bytes_stream();
                    let mut file = match tokio::fs::File::create(dest).await {
                        Ok(f) => f,
                        Err(e) => return Err(format!("File create error: {}", e)),
                    };
                    let mut total_bytes = 0u64;
                    let mut stream_failed = false;

                    while let Some(chunk_res) = stream.next().await {
                        match chunk_res {
                            Ok(chunk) => {
                                total_bytes += chunk.len() as u64;
                                if let Err(e) = file.write_all(&chunk).await {
                                    last_error = format!("Write error: {}", e);
                                    stream_failed = true;
                                    break;
                                }
                            }
                            Err(e) => {
                                last_error = format!("Stream read error: {}", e);
                                stream_failed = true;
                                break;
                            }
                        }
                    }

                    if stream_failed {
                        let _ = tokio::fs::remove_file(dest).await;
                        tokio::time::sleep(Duration::from_millis(300)).await;
                        continue;
                    }

                    if let Err(e) = file.flush().await {
                        return Err(format!("File flush error: {}", e));
                    }
                    return Ok(total_bytes);
                }
                Err(e) => {
                    last_error = format!("Network error: {}", e);
                    tokio::time::sleep(Duration::from_millis(300 * attempts)).await;
                }
            }
        }

        Err(last_error)
    }
}
