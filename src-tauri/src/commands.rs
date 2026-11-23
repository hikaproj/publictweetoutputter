use std::path::PathBuf;
use tauri::State;
use crate::AppState;
use crate::engine::{self, ScrapeConfig};
use crate::fxtwitter::{self, UserProfile};

#[tauri::command]
pub(crate) async fn inspect_profile(handle: String) -> Result<UserProfile, String> {
    let client = fxtwitter::FxClient::new();
    client.get_profile(&handle).await
}

#[tauri::command]
pub(crate) async fn start_backup(
    _state: State<'_, AppState>,
    config: ScrapeConfig,
) -> Result<String, String> {
    let base_out = PathBuf::from("output");
    let eng = engine::ScrapeEngine::new(config, &base_out, None);
    let final_path = eng.run().await?;
    Ok(final_path.to_string_lossy().to_string())
}
