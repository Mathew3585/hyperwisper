use std::process::Command;

/// Detect the primary discrete GPU on Windows. Uses PowerShell's
/// `Get-CimInstance Win32_VideoController` because `wmic.exe` is deprecated
/// (and gone from clean Windows 11 24H2 installs).
///
/// We filter out virtual / display-redirect adapters (Parsec, Splashtop, etc.)
/// so we report the *real* hardware.
pub fn detect_gpu() -> Option<String> {
    #[cfg(windows)]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name",
            ])
            .creation_flags(0x0800_0000) // CREATE_NO_WINDOW
            .output()
            .ok()?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        return stdout
            .lines()
            .map(str::trim)
            .find(|line| {
                !line.is_empty()
                    && !line.to_ascii_lowercase().contains("parsec")
                    && !line.to_ascii_lowercase().contains("virtual")
                    && !line.to_ascii_lowercase().contains("remote")
            })
            .map(str::to_string);
    }
    #[cfg(not(windows))]
    {
        None
    }
}

/// Whether the running binary was compiled with a GPU acceleration backend
/// for whisper.cpp.
pub fn gpu_acceleration_enabled() -> bool {
    cfg!(any(feature = "gpu-cuda", feature = "gpu-vulkan"))
}

#[cfg(windows)]
use std::os::windows::process::CommandExt;
