import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Cpu,
  Mic2,
  Command,
  History,
  Info,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api, type AppSettings, type Model, type ModelStatus } from "@/lib/ipc";
import { events, type DownloadProgress } from "@/lib/events";
import { applyTheme, getStoredTheme, setStoredTheme, type Theme } from "@/lib/theme";
import { Sidebar, type NavItem } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { GeneralPanel } from "./panels/GeneralPanel";
import { ModelsPanel } from "./panels/ModelsPanel";
import { AudioPanel, ShortcutsPanel } from "./panels/AudioPanel";
import { HistoryPanel } from "./panels/HistoryPanel";
import { AccountPanel } from "./panels/AccountPanel";
import { AboutPanel } from "./panels/AboutPanel";
import { OnboardingWizard } from "./onboarding/OnboardingWizard";

type PanelId =
  | "general"
  | "models"
  | "audio"
  | "shortcuts"
  | "history"
  | "account"
  | "about";

const NAV: NavItem[] = [
  { id: "general", label: "Général", icon: Sparkles },
  { id: "models", label: "Modèles", icon: Cpu },
  { id: "audio", label: "Audio", icon: Mic2 },
  { id: "shortcuts", label: "Raccourcis", icon: Command },
  { id: "history", label: "Historique", icon: History },
  { id: "about", label: "À propos", icon: Info },
];

export function SettingsApp() {
  const [panel, setPanel] = useState<PanelId>("general");
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [progress, setProgress] = useState<Record<string, DownloadProgress>>({});
  const [downloading, setDownloading] = useState<Set<Model>>(new Set());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings);

    const unsubs: Array<() => void> = [];
    events
      .onModelProgress((p) => {
        setProgress((prev) => ({ ...prev, [p.model]: p }));
      })
      .then((u) => unsubs.push(u));
    events
      .onModelLoaded(async () => {
        setModelLoaded(true);
        setLoadError(null);
        await refreshModels();
      })
      .then((u) => unsubs.push(u));
    events.onModelLoadError((err) => setLoadError(err)).then((u) => unsubs.push(u));

    refreshModels();
    api.isModelLoaded().then(setModelLoaded);

    return () => unsubs.forEach((u) => u());
  }, []);

  function changeTheme(next: Theme) {
    setTheme(next);
    setStoredTheme(next);
    applyTheme(next);
  }

  async function refreshModels() {
    try {
      const list = await api.listModels();
      setModels(list);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDownload(model: Model) {
    setDownloading((s) => new Set(s).add(model));
    try {
      await api.downloadModel(model);
      await refreshModels();
      await api.loadModel(model);
    } catch (err) {
      console.error("Download failed:", err);
      setLoadError(String(err));
    } finally {
      setDownloading((s) => {
        const next = new Set(s);
        next.delete(model);
        return next;
      });
    }
  }

  async function handleLoad(model: Model) {
    try {
      await api.loadModel(model);
      await refreshModels();
    } catch (err) {
      console.error("Load failed:", err);
      setLoadError(String(err));
    }
  }

  async function handleOnboardingComplete() {
    // Pull the fresh settings (the wizard mutated them as the user clicked
    // through) and hide the window — the app now lives in the tray until
    // the user clicks the icon.
    try {
      const fresh = await api.getSettings();
      setSettings(fresh);
    } catch {
      // settings already in state, ignore
    }
    try {
      await getCurrentWindow().hide();
    } catch (err) {
      console.error("hide window failed:", err);
    }
  }

  if (!settings) {
    return (
      <div className="h-screen flex flex-col bg-app">
        <Topbar theme={theme} onThemeChange={changeTheme} />
      </div>
    );
  }

  if (!settings.onboardingCompleted) {
    return (
      <div className="h-screen flex flex-col bg-app">
        <Topbar theme={theme} onThemeChange={changeTheme} />
        <OnboardingWizard
          settings={settings}
          onComplete={handleOnboardingComplete}
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-app">
      <Topbar theme={theme} onThemeChange={changeTheme} />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          items={NAV}
          active={panel}
          onSelect={(id) => setPanel(id as PanelId)}
          accountPanelId="account"
        />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[560px] mx-auto px-12 py-14">
            <AnimatePresence mode="wait">
              <motion.div
                key={panel}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {panel === "general" && (
                  <GeneralPanel
                    modelLoaded={modelLoaded}
                    onNavigate={(id) => setPanel(id as PanelId)}
                  />
                )}
                {panel === "models" && (
                  <ModelsPanel
                    models={models}
                    progress={progress}
                    downloading={downloading}
                    onDownload={handleDownload}
                    onLoad={handleLoad}
                    error={loadError}
                  />
                )}
                {panel === "audio" && <AudioPanel />}
                {panel === "shortcuts" && <ShortcutsPanel />}
                {panel === "history" && <HistoryPanel />}
                {panel === "account" && <AccountPanel models={models} />}
                {panel === "about" && <AboutPanel />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
