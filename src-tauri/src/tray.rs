use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

/// Text shown in the tray menu.
///
/// The backend holds no dictionary of its own — the front-end owns every
/// translation and pushes the already-localised labels down via
/// `set_tray_labels`. That keeps one source of truth for UI text instead of
/// two that can drift apart.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayLabels {
    pub open: String,
    pub status: String,
    pub quit: String,
    pub tooltip: String,
}

impl Default for TrayLabels {
    /// Used for the few hundred milliseconds before the webview mounts and
    /// sends the real ones. English matches the app's default locale.
    fn default() -> Self {
        Self {
            open: "Open Hyperwisper".into(),
            status: "Listening".into(),
            quit: "Quit".into(),
            tooltip: "Hyperwisper — voice to text".into(),
        }
    }
}

fn build_menu(app: &AppHandle, labels: &TrayLabels) -> tauri::Result<Menu<tauri::Wry>> {
    let open_item = MenuItem::with_id(app, "open", &labels.open, true, None::<&str>)?;
    let status_item = MenuItem::with_id(app, "status", &labels.status, false, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", &labels.quit, true, None::<&str>)?;

    Menu::with_items(app, &[&open_item, &status_item, &separator, &quit_item])
}

/// Swap the tray menu for one in the newly selected language. Rebuilding the
/// whole menu is simpler than holding on to each `MenuItem` handle, and it
/// runs once per language change — never in a hot path.
pub fn set_labels(app: &AppHandle, labels: TrayLabels) -> tauri::Result<()> {
    let Some(tray) = app.tray_by_id("hyperwisper-tray") else {
        tracing::warn!("Tray icon not found; labels not updated");
        return Ok(());
    };
    let menu = build_menu(app, &labels)?;
    tray.set_menu(Some(menu))?;
    tray.set_tooltip(Some(&labels.tooltip))?;
    Ok(())
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let labels = TrayLabels::default();
    let menu = build_menu(app, &labels)?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| tauri::Error::AssetNotFound("tray icon".into()))?;

    let _tray = TrayIconBuilder::with_id("hyperwisper-tray")
        .icon(icon)
        .tooltip(&labels.tooltip)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_settings_window(app),
            "quit" => {
                tracing::info!("Quit requested from tray menu");
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_settings_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

pub fn show_settings_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    } else {
        tracing::warn!("Main window not found");
    }
}
