pub mod fxtwitter;
pub mod engine;
pub mod commands;

use tokio::sync::Mutex;
use std::sync::Arc;
use tauri::Manager;

pub struct AppState {
    pub engine: Arc<Mutex<Option<Arc<engine::ScrapeEngine>>>>,
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
            commands::start_backup,
            commands::stop_backup,
            commands::open_archive_native,
            commands::open_viewer_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn run_viewer() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            engine: Arc::new(Mutex::new(None)),
        })
        .invoke_handler(tauri::generate_handler![
            commands::inspect_profile,
            commands::start_backup,
            commands::stop_backup,
            commands::open_archive_native,
            commands::open_viewer_window
        ])
        .setup(|app| {
            if let Some(main_win) = app.get_webview_window("main") {
                let _ = main_win.set_title("FxTwitter Archive Viewer - by Hikaproj");
                let _ = main_win.eval("window.location.href = 'viewer.html'");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri viewer application");
}
