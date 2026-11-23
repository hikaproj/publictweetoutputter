use std::env;
use std::path::PathBuf;
use fxtweet_studio_lib::engine::{ScrapeConfig, ScrapeEngine};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    let mut config = ScrapeConfig::default();

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--user" | "-u" => {
                if i + 1 < args.len() { config.screen_name = args[i + 1].clone(); i += 1; }
            }
            "--continuous" | "-c" => {
                config.continuous = true;
            }
            "--no-images" => config.download_images = false,
            "--no-videos" => config.download_videos = false,
            "--direction" => {
                if i + 1 < args.len() { config.direction = args[i + 1].clone(); i += 1; }
            }
            "--format" => {
                if i + 1 < args.len() { config.export_format = args[i + 1].clone(); i += 1; }
            }
            "--max" => {
                if i + 1 < args.len() { config.max_tweets = args[i + 1].parse().unwrap_or(0); i += 1; }
            }
            "--help" | "-h" => {
                println!("FxTwitter Archive Studio CLI (by Hikaproj)");
                println!("Usage: fxtweet-cli --user <handle> [options]");
                println!("Options:");
                println!("  -u, --user <handle>       Twitter/X handle to backup");
                println!("  -c, --continuous          Run continuously in live monitoring mode");
                println!("  --no-images               Skip image downloads");
                println!("  --no-videos               Skip video downloads");
                println!("  --direction <dir>         newest (default) or oldest");
                println!("  --format <fmt>            zip (default), tar.gz, or folder");
                println!("  --max <num>               Maximum tweets to collect");
                return Ok(());
            }
            _ => {}
        }
        i += 1;
    }

    if config.screen_name.is_empty() {
        eprintln!("Error: --user <handle> is required. Run with --help for options.");
        std::process::exit(1);
    }

    println!("FxTwitter Archive Studio CLI (by Hikaproj)");
    println!("Starting extraction for @{}...", config.screen_name);

    let base_out = PathBuf::from("output");
    let engine = ScrapeEngine::new(config, &base_out, None);
    let output_path = engine.run().await?;

    println!("\nBackup successfully created at: {:?}", output_path);
    Ok(())
}
