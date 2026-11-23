use serde::{Deserialize, Serialize};
use std::time::Duration;

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
        let url = format!("{}/2/profile/{}", BASE_URL, clean);

        let res = self.client.get(&url)
            .send()
            .await
            .map_err(|e| format!("HTTP request error: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("Profile returned HTTP {}", res.status()));
        }

        let resp: ApiResponse<ProfileResponse> = res.json()
            .await
            .map_err(|e| format!("JSON decode error: {}", e))?;

        resp.data.user.ok_or_else(|| "User object missing in API response".to_string())
    }

    pub async fn get_statuses(&self, screen_name: &str, cursor: Option<&str>) -> Result<StatusesResponse, String> {
        let clean = screen_name.trim_start_matches('@').trim();
        let mut url = format!("{}/2/profile/{}/statuses", BASE_URL, clean);
        if let Some(c) = cursor {
            url.push_str(&format!("?cursor={}", c));
        }

        let res = self.client.get(&url)
            .send()
            .await
            .map_err(|e| format!("HTTP request error: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("Statuses returned HTTP {}", res.status()));
        }

        let resp: StatusesResponse = res.json()
            .await
            .map_err(|e| format!("JSON decode error: {}", e))?;

        Ok(resp)
    }
}
