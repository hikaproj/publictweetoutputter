use serde::{Deserialize, Serialize};
use std::time::Duration;
use std::fs;
use std::path::Path;

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
            .timeout(Duration::from_secs(15))
            .build()
            .unwrap_or_default();
        Self { client }
    }

    pub async fn get_profile(&self, screen_name: &str) -> Result<UserProfile, String> {
        let clean = screen_name.trim_start_matches('@').trim();
        if clean.is_empty() {
            return Err("Empty username provided".to_string());
        }

        // Try candidate endpoints: 1. v2 profile, 2. direct root user
        let endpoints = [
            format!("{}/2/profile/{}", BASE_URL, clean),
            format!("{}/{}", BASE_URL, clean),
        ];

        let mut last_err = String::new();

        for url in &endpoints {
            match self.client.get(url).header("Accept", "application/json").send().await {
                Ok(res) => {
                    let status = res.status();
                    let text = res.text().await.unwrap_or_default();

                    if text.trim_start().starts_with("<!DOCTYPE") || text.trim_start().starts_with("<html") {
                        last_err = format!("Endpoint {} returned HTML (service down or rate limited)", url);
                        continue;
                    }

                    if !status.is_success() {
                        last_err = format!("HTTP {} from {}", status, url);
                        continue;
                    }

                    // Try parsing as ApiResponse<ProfileResponse>
                    if let Ok(resp) = serde_json::from_str::<ApiResponse<ProfileResponse>>(&text) {
                        if let Some(user) = resp.data.user {
                            return Ok(user);
                        }
                    }

                    // Try direct { user: { ... } } or { code: 200, user: { ... } }
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(user_val) = v.get("user") {
                            if let Ok(user) = serde_json::from_value::<UserProfile>(user_val.clone()) {
                                return Ok(user);
                            }
                        }
                    }

                    last_err = format!("Failed to parse user JSON from {}", url);
                }
                Err(e) => {
                    last_err = format!("HTTP request error for {}: {}", url, e);
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

        let res = self.client.get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| format!("HTTP request error: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("Statuses returned HTTP {}", res.status()));
        }

        let text = res.text().await.map_err(|e| e.to_string())?;
        if text.trim_start().starts_with("<!DOCTYPE") || text.trim_start().starts_with("<html") {
            return Err("FxTwitter API returned HTML instead of JSON for statuses".to_string());
        }

        let resp: StatusesResponse = serde_json::from_str(&text)
            .map_err(|e| format!("JSON decode error: {}", e))?;

        Ok(resp)
    }

    pub async fn download_to_file(&self, url: &str, dest: &Path) -> Result<u64, String> {
        let res = self.client.get(url).send().await.map_err(|e| format!("Network error: {}", e))?;
        if !res.status().is_success() {
            return Err(format!("HTTP error {}", res.status()));
        }
        let bytes = res.bytes().await.map_err(|e| format!("Body read error: {}", e))?;
        let len = bytes.len() as u64;
        fs::write(dest, bytes).map_err(|e| format!("File write error: {}", e))?;
        Ok(len)
    }
}
