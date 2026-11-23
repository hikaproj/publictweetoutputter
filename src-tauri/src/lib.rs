pub mod fxtwitter;
pub mod engine;

use std::path::PathBuf;
use tauri::State;
use tokio::sync::Mutex;
use std::sync::Arc;

pub struct AppState {
    pub engine: Arc<Mutex<Option<engine::ScrapeEngine>>>,
}

#[tauri::command]
pub async fn inspect_profile(handle: String) -> Result<fxtwitter::UserProfile, String> {
    let client = fxtwitter::FxClient::new();
    client.get_profile(&handle).await
}

#[tauri::command]
pub async fn start_backup(
    state: State<'_, AppState>,
    config: engine::ScrapeConfig
) -> Result<String, String> {
    let base_out = PathBuf::from("output");
    let eng = engine::ScrapeEngine::new(config, &base_out, None);
    let final_path = eng.run().await?;
    Ok(final_path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            engine: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            inspect_profile,
            start_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
