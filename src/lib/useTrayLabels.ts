import { useEffect } from "react";

import { api } from "./ipc";
import { useT } from "@/i18n";

/**
 * Keep the Windows tray menu in the interface language.
 *
 * The tray is built by Rust, but the backend deliberately holds no
 * dictionary — a second copy of the strings would drift from the first. So
 * the front-end pushes its already-translated labels down instead, on mount
 * and again whenever the language changes.
 *
 * `hotkey` is interpolated into the status line, so rebinding the shortcut
 * refreshes it too.
 */
export function useTrayLabels(hotkey: string | undefined) {
  const t = useT();

  useEffect(() => {
    // Nothing to show until settings have loaded and we know the combo.
    if (!hotkey) return;

    api
      .setTrayLabels({
        open: t.tray.open,
        status: t.tray.status(hotkey.replace(/\+/g, " + ")),
        quit: t.tray.quit,
        tooltip: t.tray.tooltip,
      })
      .catch(() => {
        // The tray doesn't exist in portable/uninstall mode — the command
        // returns an error there and it is safe to ignore.
      });
  }, [t, hotkey]);
}
