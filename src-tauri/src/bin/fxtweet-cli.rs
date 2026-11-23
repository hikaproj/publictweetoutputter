use std::env;
use std::path::PathBuf;
use fxtweet_studio_lib::engine::{ScrapeConfig, ScrapeEngine};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    let mut config = ScrapeConfig::default();
    let mut base_out = PathBuf::from("output");

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--user" | "-u" => {
                if i + 1 < args.len() { config.screen_name = args[i + 1].clone(); i += 1; }
            }
            "--continuous" | "-c" => {
                config.continuous = true;
            }
            "--interval" => {
                if i + 1 < args.len() { config.continuous_interval = args[i + 1].parse().unwrap_or(30); i += 1; }
            }
            "--concurrency" | "-j" => {
                if i + 1 < args.len() { config.media_concurrency = args[i + 1].parse().unwrap_or(8); i += 1; }
            }
            "--no-images" => config.download_images = false,
            "--no-videos" => config.download_videos = false,
            "--image-quality" => {
                if i + 1 < args.len() { config.image_quality = args[i + 1].clone(); i += 1; }
            }
            "--video-quality" => {
                if i + 1 < args.len() { config.video_quality = args[i + 1].clone(); i += 1; }
            }
            "--direction" => {
                if i + 1 < args.len() { config.direction = args[i + 1].clone(); i += 1; }
            }
            "--format" => {
                if i + 1 < args.len() { config.export_format = args[i + 1].clone(); i += 1; }
            }
            "--max" => {
                if i + 1 < args.len() { config.max_tweets = args[i + 1].parse().unwrap_or(0); i += 1; }
            }
            "--out" | "-o" => {
                if i + 1 < args.len() {
                    base_out = PathBuf::from(&args[i + 1]);
                    config.output_dir = Some(args[i + 1].clone());
                    i += 1;
                }
            }
            "--help" | "-h" => {
                print_help();
                return Ok(());
            }
            _ => {}
        }
        i += 1;
    }

    if config.screen_name.is_empty() {
        eprintln!("Error: Target user handle is required (--user <handle>).");
        eprintln!("Run `fxtweet-cli --help` for full usage documentation.");
        std::process::exit(1);
    }

    println!("========================================================");
    println!("  FxTwitter Archive Studio CLI (by Hikaproj)");
    println!("  Target:       @{}", config.screen_name);
    println!("  Images:       {} (Quality: {})", if config.download_images { "Yes" } else { "No" }, config.image_quality);
    println!("  Videos:       {} (Quality: {})", if config.download_videos { "Yes" } else { "No" }, config.video_quality);
    println!("  Format:       {}", config.export_format);
    println!("  Concurrency:  {}", config.media_concurrency);
    println!("  Continuous:   {}", if config.continuous { format!("Yes (every {}s)", config.continuous_interval) } else { "No".to_string() });
    println!("========================================================");

    let engine = ScrapeEngine::new(config, &base_out, None);
    let output_path = engine.run().await?;

    println!("\nArchive successfully generated at: {:?}", output_path);
    Ok(())
}

fn print_help() {
    println!("FxTwitter Archive Studio CLI - Native Twitter/X Exporter");
    println!("Created by Hikaproj");
    println!();
    println!("Usage:");
    println!("  fxtweet-cli --user <handle> [options]");
    println!();
    println!("Options:");
    println!("  -u, --user <handle>              Twitter/X screen name to archive (e.g. elonmusk)");
    println!("  -c, --continuous                 Enable continuous live monitoring mode");
    println!("      --interval <sec>             Polling interval for continuous mode in seconds (default: 30)");
    println!("  -j, --concurrency <num>          Concurrent media download threads (default: 8)");
    println!("      --no-images                  Skip downloading attached images");
    println!("      --no-videos                  Skip downloading attached mp4 videos");
    println!("      --image-quality <quality>    orig (default), large, medium, small");
    println!("      --video-quality <quality>    highest (default), 1080p, 720p, 480p, lowest");
    println!("      --direction <dir>            newest (default) or oldest");
    println!("      --format <format>            zip (default), xarchpjzip, tar.gz, tar, folder");
    println!("      --max <number>               Maximum number of tweets to collect (0 = all)");
    println!("  -o, --out <directory>            Base directory for output archives (default: ./output)");
    println!("  -h, --help                       Show this help message");
    println!();
    println!("Examples:");
    println!("  fxtweet-cli -u jack");
    println!("  fxtweet-cli -u OpenAI --format xarchpjzip --concurrency 16");
    println!("  fxtweet-cli -u nasa --continuous --interval 60");
}
