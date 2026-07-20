//! Self-installing portable: the distributed `.exe` is the same binary the
//! user ends up running long-term — when launched from outside the install
//! directory, the app shows a Tauri/React installer that copies itself to
//! `%LOCALAPPDATA%\Programs\Hyperwisper\`, creates a Start Menu shortcut,
//! registers an uninstall entry, and relaunches from the installed location.
//!
//! No NSIS, no MSI — the UI is part of the app, matching the rest of
//! Hyperwisper's design system pixel-for-pixel.

use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{anyhow, Context, Result};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub const APP_NAME: &str = "Hyperwisper";
pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const APP_PUBLISHER: &str = "Mathew Simon";

const UNINSTALL_REG_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Hyperwisper";

/// Default install root: `%LOCALAPPDATA%\Programs\Hyperwisper`. The user can
/// override this in the installer UI via a folder picker.
pub fn default_install_root() -> Result<PathBuf> {
    dirs::data_local_dir()
        .map(|d| d.join("Programs").join(APP_NAME))
        .ok_or_else(|| anyhow!("Could not resolve LOCALAPPDATA"))
}

pub fn installed_exe_in(dir: &Path) -> PathBuf {
    dir.join(format!("{}.exe", APP_NAME))
}

pub fn current_exe() -> Result<PathBuf> {
    std::env::current_exe().context("current_exe")
}

/// Returns `true` when the currently-running binary IS the installed one.
/// We read the install location from the HKCU Uninstall key (written at
/// install time) so this stays correct even when the user installed to a
/// custom directory.
pub fn is_running_installed() -> bool {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let current = match current_exe() {
        Ok(p) => p,
        Err(_) => return false,
    };
    let current_dir = match current.parent() {
        Some(d) => d.to_path_buf(),
        None => return false,
    };

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey(UNINSTALL_REG_KEY) {
        if let Ok(loc) = key.get_value::<String, _>("InstallLocation") {
            return canon(Path::new(&loc)) == canon(&current_dir);
        }
    }
    false
}

fn canon(p: &Path) -> PathBuf {
    std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf())
}

/// Read `InstallLocation` from the uninstall registry key, if present.
pub fn registered_install_dir() -> Option<PathBuf> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let key = hkcu.open_subkey(UNINSTALL_REG_KEY).ok()?;
    let s: String = key.get_value("InstallLocation").ok()?;
    Some(PathBuf::from(s))
}

/// Whether a previous install exists — checks the registry rather than a
/// hard-coded path so a custom-location install is detected too.
pub fn install_exists() -> bool {
    match registered_install_dir() {
        Some(d) => installed_exe_in(&d).exists(),
        None => false,
    }
}

/// Copy the running binary into the target install directory. The file is
/// always renamed to `Hyperwisper.exe` so registry / shortcut paths stay
/// predictable.
pub fn copy_exe(dst_dir: &Path) -> Result<PathBuf> {
    let src = current_exe()?;
    let dst = installed_exe_in(dst_dir);

    std::fs::create_dir_all(dst_dir)
        .with_context(|| format!("create install dir {}", dst_dir.display()))?;

    // If a previous file is there (e.g. user is reinstalling), overwrite it.
    if dst.exists() {
        std::fs::remove_file(&dst).ok();
    }

    std::fs::copy(&src, &dst)
        .with_context(|| format!("copy {} -> {}", src.display(), dst.display()))?;

    tracing::info!("Installed Hyperwisper.exe at {}", dst.display());
    Ok(dst)
}

/// Create the Start Menu shortcut (.lnk) pointing at the installed exe.
pub fn create_start_menu_shortcut(target: &Path) -> Result<()> {
    let start_menu = dirs::data_dir()
        .ok_or_else(|| anyhow!("Could not resolve APPDATA"))?
        .join("Microsoft")
        .join("Windows")
        .join("Start Menu")
        .join("Programs");
    std::fs::create_dir_all(&start_menu).ok();
    let lnk = start_menu.join(format!("{}.lnk", APP_NAME));
    write_lnk(&lnk, target)
}

/// Optional: create a desktop shortcut.
pub fn create_desktop_shortcut(target: &Path) -> Result<()> {
    let desktop = dirs::desktop_dir()
        .ok_or_else(|| anyhow!("Could not resolve Desktop"))?;
    let lnk = desktop.join(format!("{}.lnk", APP_NAME));
    write_lnk(&lnk, target)
}

/// Write a .lnk via PowerShell's WScript.Shell COM object — avoids pulling
/// in a `mslnk` / IShellLink crate just for this one operation.
fn write_lnk(lnk_path: &Path, target: &Path) -> Result<()> {
    let lnk_str = lnk_path.to_string_lossy().replace('\'', "''");
    let target_str = target.to_string_lossy().replace('\'', "''");
    let working_dir = target
        .parent()
        .map(|p| p.to_string_lossy().replace('\'', "''"))
        .unwrap_or_default();

    let script = format!(
        "$ws = New-Object -ComObject WScript.Shell; \
         $s = $ws.CreateShortcut('{}'); \
         $s.TargetPath = '{}'; \
         $s.WorkingDirectory = '{}'; \
         $s.IconLocation = '{}'; \
         $s.Save()",
        lnk_str, target_str, working_dir, target_str
    );

    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command", &script]);
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    let status = cmd.status().context("spawn powershell")?;
    if !status.success() {
        return Err(anyhow!("PowerShell failed creating shortcut {}", lnk_path.display()));
    }
    Ok(())
}

/// Register the app under HKCU's Uninstall key so Windows lists it in
/// Settings → Apps → Installed apps with a working uninstall button.
pub fn write_uninstall_registry(exe: &Path, install_dir: &Path) -> Result<()> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu.create_subkey(UNINSTALL_REG_KEY)?;

    let exe_str = exe.to_string_lossy().to_string();
    let dir_str = install_dir.to_string_lossy().to_string();
    let size_kb = estimated_install_size_kb(install_dir);

    key.set_value("DisplayName", &APP_NAME)?;
    key.set_value("DisplayVersion", &APP_VERSION)?;
    key.set_value("Publisher", &APP_PUBLISHER)?;
    key.set_value("InstallLocation", &dir_str)?;
    key.set_value("UninstallString", &format!("\"{}\" --uninstall", exe_str))?;
    key.set_value("QuietUninstallString", &format!("\"{}\" --uninstall --silent", exe_str))?;
    key.set_value("DisplayIcon", &exe_str)?;
    key.set_value("NoModify", &1u32)?;
    key.set_value("NoRepair", &1u32)?;
    key.set_value("EstimatedSize", &size_kb)?;

    Ok(())
}

fn estimated_install_size_kb(dir: &Path) -> u32 {
    fn walk(p: &Path) -> u64 {
        let mut total = 0u64;
        if let Ok(entries) = std::fs::read_dir(p) {
            for e in entries.flatten() {
                if let Ok(m) = e.metadata() {
                    if m.is_dir() {
                        total += walk(&e.path());
                    } else {
                        total += m.len();
                    }
                }
            }
        }
        total
    }
    ((walk(dir) / 1024) as u32).max(1)
}

/// Launch the installed exe (from the directory recorded in the uninstall
/// registry) and exit the current portable process. Any in-flight Tauri
/// windows close automatically once the runtime exits.
pub fn relaunch_installed_and_exit(app: &tauri::AppHandle) -> Result<()> {
    let install_dir = registered_install_dir()
        .ok_or_else(|| anyhow!("No registered install — was installer_install called?"))?;
    let target = installed_exe_in(&install_dir);
    let mut cmd = Command::new(&target);
    #[cfg(windows)]
    cmd.creation_flags(0x0000_0008); // DETACHED_PROCESS
    cmd.spawn().context("spawn installed exe")?;

    // Give the new process a beat to take over before we exit, otherwise the
    // Tauri runtime can race the spawn and leave nothing visible to the user.
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(150));
        handle.exit(0);
    });
    Ok(())
}

/// Remove everything an install creates EXCEPT the install directory itself
/// (which we can't delete while running from inside it). Caller is expected
/// to follow up with [`schedule_install_dir_delete`] right before quitting.
pub fn uninstall_cleanup() -> Result<()> {
    use winreg::enums::*;
    use winreg::RegKey;

    // 1) Registry entry — best-effort, ignore if already gone.
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Err(e) = hkcu.delete_subkey_all(UNINSTALL_REG_KEY) {
        if e.kind() != std::io::ErrorKind::NotFound {
            tracing::warn!("Failed to remove uninstall registry key: {}", e);
        }
    }

    // 2) Autostart entry — `auto-launch` (used by tauri-plugin-autostart on
    //    Windows) writes under HKCU\…\Run\Hyperwisper.
    let run_key = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    if let Ok(key) = hkcu.open_subkey_with_flags(run_key, KEY_SET_VALUE) {
        let _ = key.delete_value(APP_NAME);
    }

    // 3) Shortcuts.
    if let Some(appdata) = dirs::data_dir() {
        let start_menu_lnk = appdata
            .join("Microsoft")
            .join("Windows")
            .join("Start Menu")
            .join("Programs")
            .join(format!("{}.lnk", APP_NAME));
        let _ = std::fs::remove_file(&start_menu_lnk);
    }
    if let Some(desktop) = dirs::desktop_dir() {
        let _ = std::fs::remove_file(desktop.join(format!("{}.lnk", APP_NAME)));
    }

    // 4) User data dir (settings, history, models, logs).
    if let Some(appdata) = dirs::data_dir() {
        let user_dir = appdata.join(APP_NAME);
        if user_dir.exists() {
            if let Err(e) = std::fs::remove_dir_all(&user_dir) {
                tracing::warn!("Failed to remove user data dir {}: {}", user_dir.display(), e);
            }
        }
    }

    Ok(())
}

/// Resolve the install directory from `current_exe`'s parent, then schedule
/// it for deletion. The cleanup batch waits a couple seconds so our process
/// can exit and release its file handle on Hyperwisper.exe.
pub fn schedule_install_dir_delete_for_current() -> Result<()> {
    let exe = current_exe()?;
    let install_dir = exe
        .parent()
        .ok_or_else(|| anyhow!("current_exe has no parent"))?;
    schedule_self_delete(install_dir)
}

fn schedule_self_delete(dir: &Path) -> Result<()> {
    let temp = std::env::temp_dir();
    let bat_path = temp.join("hyperwisper_uninstall.bat");
    // The /Q on rmdir prevents an interactive prompt; the timeout gives our
    // own process a chance to exit so the exe isn't locked when we try to
    // remove it.
    let content = format!(
        "@echo off\r\n\
         timeout /t 2 /nobreak >nul\r\n\
         rmdir /s /q \"{}\"\r\n\
         del /q \"%~f0\"\r\n",
        dir.to_string_lossy()
    );
    std::fs::write(&bat_path, content)?;

    let mut cmd = Command::new("cmd");
    cmd.args(["/C", &bat_path.to_string_lossy()]);
    #[cfg(windows)]
    cmd.creation_flags(0x0000_0008 | 0x0800_0000); // DETACHED_PROCESS | CREATE_NO_WINDOW
    cmd.spawn().context("spawn cleanup batch")?;
    Ok(())
}
