use std::process::Command;

/// Detect the primary discrete GPU on Windows. Uses PowerShell's
/// `Get-CimInstance Win32_VideoController` because `wmic.exe` is deprecated
/// (and gone from clean Windows 11 24H2 installs).
///
/// We filter out virtual / display-redirect adapters (Parsec, Splashtop, etc.)
/// so we report the *real* hardware.
///
/// Spawning PowerShell costs a few hundred ms and the answer can't change
/// while the app runs, so it's computed once and cached.
pub fn detect_gpu() -> Option<String> {
    static GPU: std::sync::OnceLock<Option<String>> = std::sync::OnceLock::new();
    GPU.get_or_init(query_gpu).clone()
}

fn query_gpu() -> Option<String> {
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

/// Opt the process out of Windows 11 EcoQoS / power throttling.
///
/// While the user dictates, our window is in the background (focus is in the
/// app they're typing into). On laptops — especially on battery — Windows
/// then moves background processes to efficiency cores at low clocks, which
/// throttles whisper.cpp's CPU threads and the thread feeding the GPU. We're
/// a latency-critical foreground task in disguise, so we say so.
pub fn disable_power_throttling() {
    #[cfg(windows)]
    {
        #[repr(C)]
        struct ProcessPowerThrottlingState {
            version: u32,
            control_mask: u32,
            state_mask: u32,
        }
        #[link(name = "kernel32")]
        extern "system" {
            fn GetCurrentProcess() -> isize;
            fn SetProcessInformation(
                process: isize,
                class: i32,
                info: *const core::ffi::c_void,
                size: u32,
            ) -> i32;
        }
        const PROCESS_POWER_THROTTLING: i32 = 4; // ProcessPowerThrottling
        const EXECUTION_SPEED: u32 = 0x1;
        const IGNORE_TIMER_RESOLUTION: u32 = 0x4;

        let state = ProcessPowerThrottlingState {
            version: 1,
            // Control these bits, and set them to "off" (state_mask = 0).
            control_mask: EXECUTION_SPEED | IGNORE_TIMER_RESOLUTION,
            state_mask: 0,
        };
        // SAFETY: valid pseudo-handle and a correctly sized, live struct.
        let ok = unsafe {
            SetProcessInformation(
                GetCurrentProcess(),
                PROCESS_POWER_THROTTLING,
                &state as *const _ as *const core::ffi::c_void,
                std::mem::size_of::<ProcessPowerThrottlingState>() as u32,
            )
        };
        if ok == 0 {
            tracing::warn!("SetProcessInformation(PowerThrottling) failed");
        } else {
            tracing::info!("Power throttling (EcoQoS) disabled for this process");
        }
    }
}

/// Whether the running binary was compiled with a GPU acceleration backend
/// for whisper.cpp.
pub fn gpu_acceleration_enabled() -> bool {
    cfg!(any(feature = "gpu-cuda", feature = "gpu-vulkan"))
}

#[cfg(windows)]
use std::os::windows::process::CommandExt;
