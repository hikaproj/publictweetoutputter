pub mod fxtwitter;
pub mod engine;
pub mod commands;
pub mod live_activity;

use tokio::sync::Mutex;
use std::sync::Arc;
use tauri::Manager;

pub struct AppState {
    pub engine: Arc<Mutex<Option<Arc<engine::ScrapeEngine>>>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppMode {
    Studio,
    Viewer,
}

pub fn run_with_mode(mode: AppMode) {
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
            commands::open_viewer_window,
            commands::open_in_viewer,
            commands::list_backups,
            commands::read_archive_file
        ])
        .setup(move |app| {
            if mode == AppMode::Viewer {
                if let Some(main_win) = app.get_webview_window("main") {
                    let _ = main_win.set_title("FxTwitter Archive Viewer - by Hikaproj");
                    let _ = main_win.eval("window.location.href = 'viewer.html'");
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    run_with_mode(AppMode::Studio);
}

pub fn run_viewer() {
    run_with_mode(AppMode::Viewer);
}
