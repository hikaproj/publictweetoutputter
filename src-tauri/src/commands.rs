use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::State;
use serde::{Deserialize, Serialize};

use crate::AppState;
use crate::engine::{self, ScrapeConfig};
use crate::fxtwitter::{self, UserProfile};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchivePayload {
    pub success: bool,
    pub filename: String,
    pub tweets: Vec<serde_json::Value>,
    pub profile: Option<serde_json::Value>,
    pub summary: Option<serde_json::Value>,
    pub media_files: Vec<String>,
    pub message: String,
}

#[tauri::command]
pub(crate) async fn inspect_profile(handle: String) -> Result<UserProfile, String> {
    let client = fxtwitter::FxClient::new();
    client.get_profile(&handle).await
}

#[tauri::command]
pub(crate) async fn start_backup(
    state: State<'_, AppState>,
    config: ScrapeConfig,
) -> Result<String, String> {
    let base_out = PathBuf::from("output");
    let eng = Arc::new(engine::ScrapeEngine::new(config, &base_out, None));
    {
        let mut lock = state.engine.lock().await;
        *lock = Some(Arc::clone(&eng));
    }
    let res = eng.run().await;
    {
        let mut lock = state.engine.lock().await;
        *lock = None;
    }
    let final_path = res?;
    Ok(final_path.to_string_lossy().to_string())
}

#[tauri::command]
pub(crate) async fn stop_backup(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let eng_opt = {
        let lock = state.engine.lock().await;
        lock.clone()
    };
    if let Some(eng) = eng_opt {
        eng.stop().await;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub(crate) async fn open_archive_native(file_path: String) -> Result<ArchivePayload, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid ZIP/.xarchpjzip archive: {}", e))?;

    let filename = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
    let mut tweets = Vec::new();
    let mut profile = None;
    let mut summary = None;
    let mut media_files = Vec::new();

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let entry_name = entry.name().to_string();

        if entry.is_file() {
            if entry_name.ends_with("tweets.json") {
                let mut buf = String::new();
                if entry.read_to_string(&mut buf).is_ok() {
                    if let Ok(v) = serde_json::from_str::<Vec<serde_json::Value>>(&buf) {
                        tweets = v;
                    }
                }
            } else if entry_name.ends_with("profile.json") {
                let mut buf = String::new();
                if entry.read_to_string(&mut buf).is_ok() {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&buf) {
                        profile = Some(v);
                    }
                }
            } else if entry_name.ends_with("summary.json") {
                let mut buf = String::new();
                if entry.read_to_string(&mut buf).is_ok() {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&buf) {
                        summary = Some(v);
                    }
                }
            } else if entry_name.contains("media/") || entry_name.contains("profile_media/") {
                media_files.push(entry_name);
            }
        }
    }

    Ok(ArchivePayload {
        success: true,
        filename,
        tweets,
        profile,
        summary,
        media_files,
        message: "Archive opened successfully via Rust native engine".to_string(),
    })
}
