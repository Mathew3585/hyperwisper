use std::io::Write;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    /// Unix milliseconds.
    pub timestamp: u64,
    pub text: String,
    pub duration_ms: u64,
    pub word_count: u32,
    pub model: String,
}

impl HistoryEntry {
    pub fn new(text: String, duration_ms: u64, model: String) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let word_count = text.split_whitespace().count() as u32;
        Self {
            id: format!("h{}", now),
            timestamp: now,
            text,
            duration_ms,
            word_count,
            model,
        }
    }
}

fn history_path() -> Option<PathBuf> {
    let base = dirs::data_dir()?;
    Some(base.join("Hyperwisper").join("history.jsonl"))
}

/// Append-only JSONL store — one entry per line. Cheap to write, easy to tail.
pub fn append(entry: &HistoryEntry) -> Result<()> {
    let path = history_path()
        .ok_or_else(|| anyhow::anyhow!("could not resolve data dir"))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let line = serde_json::to_string(entry)? + "\n";
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?;
    file.write_all(line.as_bytes())?;
    Ok(())
}

/// Read every entry, newest first (we reverse what's on disk so the UI gets
/// the natural ordering for free).
pub fn read_all() -> Vec<HistoryEntry> {
    let Some(path) = history_path() else { return vec![]; };
    let Ok(content) = std::fs::read_to_string(path) else { return vec![]; };
    let mut entries: Vec<HistoryEntry> = content
        .lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|l| serde_json::from_str::<HistoryEntry>(l).ok())
        .collect();
    entries.reverse();
    entries
}

pub fn delete_entry(id: &str) -> Result<()> {
    let Some(path) = history_path() else { return Ok(()); };
    if !path.exists() {
        return Ok(());
    }
    // We keep the on-disk order (oldest → newest) but `read_all` reverses it,
    // so re-read raw and rewrite excluding the deleted id.
    let content = std::fs::read_to_string(&path)?;
    let kept: Vec<String> = content
        .lines()
        .filter(|l| {
            serde_json::from_str::<HistoryEntry>(l)
                .map(|e| e.id != id)
                .unwrap_or(true)
        })
        .map(String::from)
        .collect();
    let joined = kept.join("\n");
    std::fs::write(&path, if joined.is_empty() { String::new() } else { joined + "\n" })?;
    Ok(())
}

pub fn clear_all() -> Result<()> {
    let Some(path) = history_path() else { return Ok(()); };
    if path.exists() {
        std::fs::write(path, "")?;
    }
    Ok(())
}
