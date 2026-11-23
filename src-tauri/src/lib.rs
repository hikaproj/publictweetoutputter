pub mod fxtwitter;
pub mod engine;
pub mod commands;

use tokio::sync::Mutex;
use std::sync::Arc;

pub struct AppState {
    pub engine: Arc<Mutex<Option<engine::ScrapeEngine>>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            engine: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            commands::inspect_profile,
            commands::start_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
