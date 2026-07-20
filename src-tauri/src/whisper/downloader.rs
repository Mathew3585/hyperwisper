use std::path::Path;

use anyhow::{anyhow, Result};
use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

use super::Model;

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub model: String,
    pub bytes: u64,
    pub total: u64,
    pub percent: f32,
}

/// Stream the model file from HuggingFace into `dest`, emitting
/// `model:progress` events along the way. The full file is held in `.part`
/// until complete, then atomically renamed.
pub async fn download_model(app: AppHandle, model: Model, dest: &Path) -> Result<()> {
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let url = model.url();
    tracing::info!("Downloading {} from {}", model.display_name(), url);

    let client = reqwest::Client::builder()
        .user_agent("hyperwisper/0.1")
        .build()?;
    let response = client.get(&url).send().await?.error_for_status()?;
    let total = response.content_length().unwrap_or(0);

    let tmp = dest.with_extension("part");
    let mut file = tokio::fs::File::create(&tmp).await?;
    let mut downloaded: u64 = 0;
    let mut last_emit: u64 = 0;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let bytes = chunk?;
        file.write_all(&bytes).await?;
        downloaded += bytes.len() as u64;

        // Throttle to ~1 emit per 256 KB to avoid event spam.
        if downloaded - last_emit > 256 * 1024 || downloaded == total {
            last_emit = downloaded;
            let percent = if total > 0 {
                (downloaded as f32 / total as f32) * 100.0
            } else {
                0.0
            };
            let _ = app.emit(
                "model:progress",
                DownloadProgress {
                    model: model.filename().to_string(),
                    bytes: downloaded,
                    total,
                    percent,
                },
            );
        }
    }
    file.flush().await?;
    drop(file);

    // Atomic-ish rename so a partial file can't be mistaken for a complete one.
    tokio::fs::rename(&tmp, dest)
        .await
        .map_err(|e| anyhow!("rename {} -> {}: {e}", tmp.display(), dest.display()))?;

    tracing::info!("Download complete: {} ({} bytes)", dest.display(), downloaded);
    Ok(())
}
