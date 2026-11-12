use std::path::Path;

use anyhow::{anyhow, Result};
use futures_util::StreamExt;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncWriteExt, BufWriter};

use super::Model;

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub model: String,
    pub bytes: u64,
    pub total: u64,
    pub percent: f32,
}

/// Stream the model file from HuggingFace into `dest`, emitting
/// `model:progress` events along the way. The file is held in `.part` until
/// it is complete *and* its SHA-256 matches the catalog, then renamed — so a
/// truncated or corrupted download can never be mistaken for a usable model.
pub async fn download_model(app: AppHandle, model: Model, dest: &Path) -> Result<()> {
    if let Some(parent) = dest.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let tmp = dest.with_extension("part");
    let result = download_to(&app, model, &tmp).await;
    if result.is_err() {
        // Don't leave hundreds of MB of dead `.part` behind.
        let _ = tokio::fs::remove_file(&tmp).await;
    }
    result?;

    tokio::fs::rename(&tmp, dest)
        .await
        .map_err(|e| anyhow!("rename {} -> {}: {e}", tmp.display(), dest.display()))?;

    tracing::info!("Download complete: {}", dest.display());
    Ok(())
}

async fn download_to(app: &AppHandle, model: Model, tmp: &Path) -> Result<()> {
    let url = model.url();
    tracing::info!("Downloading {} from {}", model.display_name(), url);

    let client = reqwest::Client::builder()
        .user_agent(concat!("hyperwisper/", env!("CARGO_PKG_VERSION")))
        .build()?;
    let response = client.get(&url).send().await?.error_for_status()?;
    let total = response.content_length().unwrap_or(0);

    // Network chunks are often only a few KB; a 1 MB buffer turns that into
    // a few hundred large writes instead of tens of thousands of small ones.
    let mut file = BufWriter::with_capacity(1 << 20, tokio::fs::File::create(tmp).await?);
    // Hash while streaming rather than re-reading the whole file afterwards.
    let mut hasher = Sha256::new();
    let mut downloaded: u64 = 0;
    let mut last_emit: u64 = 0;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let bytes = chunk?;
        hasher.update(&bytes);
        file.write_all(&bytes).await?;
        downloaded += bytes.len() as u64;

        // Throttle to ~1 emit per 512 KB to avoid event spam.
        if downloaded - last_emit > 512 * 1024 || downloaded == total {
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

    if total > 0 && downloaded != total {
        return Err(anyhow!(
            "download truncated: got {downloaded} of {total} bytes"
        ));
    }

    let digest = hex(&hasher.finalize());
    if digest != model.sha256() {
        return Err(anyhow!(
            "checksum mismatch for {}: expected {}, got {}",
            model.filename(),
            model.sha256(),
            digest
        ));
    }

    Ok(())
}

fn hex(bytes: &[u8]) -> String {
    use std::fmt::Write;
    bytes.iter().fold(String::with_capacity(bytes.len() * 2), |mut s, b| {
        let _ = write!(s, "{b:02x}");
        s
    })
}
