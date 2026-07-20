import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { SettingsApp } from "@/windows/settings/SettingsApp";
import { InstallerApp } from "@/windows/installer/InstallerApp";
import { UninstallerApp } from "@/windows/installer/UninstallerApp";
import { api, type InstallerStatus } from "@/lib/ipc";
import { applyTheme, getStoredTheme } from "@/lib/theme";
import { wireGlobalToasts } from "@/lib/toasts";
import "@/styles/globals.css";

// Apply persisted theme before first paint to avoid a flash of wrong colors.
applyTheme(getStoredTheme());

// Subscribe to backend error events (paste, hotkey, device) and surface them
// as toasts. Lives at the entry-point level so it's active even when the
// user is on a panel that doesn't care about that event.
wireGlobalToasts();

function Root() {
  const [status, setStatus] = useState<InstallerStatus | null>(null);

  useEffect(() => {
    api.installerStatus().then(setStatus).catch(() => {
      // If the IPC call fails, assume installed mode — the worst case is
      // we show the settings UI on a binary that should be installing.
      setStatus({
        runningInstalled: true,
        uninstallMode: false,
        installExists: true,
        defaultInstallDir: "",
        existingInstallDir: null,
        currentExe: "",
      });
    });
  }, []);

  // Hold a black canvas during the very brief gap before installer_status
  // resolves — avoids a flash of SettingsApp on the portable binary.
  if (!status) return null;

  if (status.uninstallMode) {
    return <UninstallerApp />;
  }

  if (!status.runningInstalled) {
    return <InstallerApp />;
  }

  return <SettingsApp />;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <React.StrictMode>
    <Root />
    <Toaster
      position="bottom-right"
      theme="system"
      richColors
      closeButton
      toastOptions={{ duration: 5000 }}
    />
  </React.StrictMode>
);
