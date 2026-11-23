use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{Manager, State};
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupItem {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub size_formatted: String,
    pub size_mb: String,
    pub created_at: String,
    pub is_archive: bool,
    pub tweets_count: Option<u64>,
}

#[tauri::command]
pub(crate) async fn inspect_profile(handle: String) -> Result<UserProfile, String> {
    let client = fxtwitter::FxClient::new();
    client.get_profile(&handle).await
}

#[tauri::command]
pub(crate) async fn start_backup(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    config: ScrapeConfig,
) -> Result<String, String> {
    let base_out = if let Some(ref custom) = config.output_dir {
        if !custom.trim().is_empty() {
            PathBuf::from(custom.trim())
        } else {
            PathBuf::from("output")
        }
    } else {
        PathBuf::from("output")
    };
    let eng = Arc::new(engine::ScrapeEngine::new(config, &base_out, None).with_app_handle(app));
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
pub(crate) async fn open_viewer_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("viewer") {
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }
    tauri::WebviewWindowBuilder::new(
        &app,
        "viewer",
        tauri::WebviewUrl::App("viewer.html".into())
    )
    .title("FxTwitter Archive Viewer - by Hikaproj")
    .inner_size(1366.0, 860.0)
    .min_inner_size(900.0, 600.0)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub(crate) async fn open_in_viewer(app: tauri::AppHandle, archive_path: String) -> Result<(), String> {
    use tauri::Emitter;
    if let Some(existing) = app.get_webview_window("viewer") {
        let _ = existing.show();
        let _ = existing.set_focus();
        let _ = existing.emit("load-archive-path", &archive_path);
        return Ok(());
    }
    let _win = tauri::WebviewWindowBuilder::new(
        &app,
        "viewer",
        tauri::WebviewUrl::App("viewer.html".into())
    )
    .title("FxTwitter Archive Viewer - by Hikaproj")
    .inner_size(1366.0, 860.0)
    .min_inner_size(900.0, 600.0)
    .resizable(true)
    .build()
    .map_err(|e| e.to_string())?;

    let app_clone = app.clone();
    let path_clone = archive_path.clone();
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(700)).await;
        if let Some(w) = app_clone.get_webview_window("viewer") {
            let _ = w.emit("load-archive-path", &path_clone);
        }
    });

    Ok(())
}

#[tauri::command]
pub(crate) async fn list_backups(output_dir: Option<String>) -> Result<Vec<BackupItem>, String> {
    let dir_path = if let Some(ref d) = output_dir {
        if !d.trim().is_empty() {
            PathBuf::from(d.trim())
        } else {
            PathBuf::from("output")
        }
    } else {
        PathBuf::from("output")
    };

    if !dir_path.exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();
    let entries = fs::read_dir(&dir_path).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        let fname = entry.file_name().to_string_lossy().to_string();
        let meta = entry.metadata().ok();
        let size_bytes = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let mb = size_bytes as f64 / (1024.0 * 1024.0);
        let size_formatted = format!("{:.1} MB", mb);
        let size_mb = format!("{:.1}", mb);
        let created_at = meta.and_then(|m| m.modified().ok())
            .map(|t| chrono::DateTime::<chrono::Local>::from(t).format("%Y/%m/%d %H:%M:%S").to_string())
            .unwrap_or_default();

        if path.is_file() {
            let lower = fname.to_lowercase();
            if lower.ends_with(".zip") || lower.ends_with(".xarchpjzip") || lower.ends_with(".tar.gz") || lower.ends_with(".tar") {
                backups.push(BackupItem {
                    name: fname,
                    path: path.to_string_lossy().to_string(),
                    size_bytes,
                    size_formatted,
                    size_mb,
                    created_at,
                    is_archive: true,
                    tweets_count: None,
                });
            }
        } else if path.is_dir() {
            let tweets_json = path.join("tweets.json");
            if tweets_json.exists() {
                backups.push(BackupItem {
                    name: fname,
                    path: path.to_string_lossy().to_string(),
                    size_bytes,
                    size_formatted: "フォルダ".to_string(),
                    size_mb: "0.0".to_string(),
                    created_at,
                    is_archive: false,
                    tweets_count: None,
                });
            }
        }
    }

    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

#[tauri::command]
pub(crate) async fn read_archive_file(file_path: String) -> Result<Vec<u8>, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }
    fs::read(path).map_err(|e| format!("Failed to read archive: {}", e))
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
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&buf) {
                        if let Some(arr) = v.as_array() {
                            tweets = arr.clone();
                        } else if let Some(arr) = v.get("tweets").and_then(|t| t.as_array()) {
                            tweets = arr.clone();
                        }
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
