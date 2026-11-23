use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveActivityUpdate {
    pub handle: String,
    pub tweets_count: u64,
    pub media_count: u64,
    pub total_bytes: u64,
    pub speed_text: String,
    pub status_text: String,
    pub progress_pct: f64,
    pub is_locked: bool,
}

#[cfg(target_os = "ios")]
extern "C" {
    fn fxtweet_start_live_activity(handle: *const u8, handle_len: usize);
    fn fxtweet_update_live_activity(json_ptr: *const u8, json_len: usize);
    fn fxtweet_end_live_activity(summary_ptr: *const u8, summary_len: usize);
}

pub fn start_activity(handle: &str) {
    #[cfg(target_os = "ios")]
    unsafe {
        fxtweet_start_live_activity(handle.as_ptr(), handle.len());
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = handle;
    }
}

pub fn update_activity(update: &LiveActivityUpdate) {
    #[cfg(target_os = "ios")]
    {
        if let Ok(json) = serde_json::to_string(update) {
            unsafe {
                fxtweet_update_live_activity(json.as_ptr(), json.len());
            }
        }
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = update;
    }
}

pub fn end_activity(summary: &str) {
    #[cfg(target_os = "ios")]
    unsafe {
        fxtweet_end_live_activity(summary.as_ptr(), summary.len());
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = summary;
    }
}
