import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Check, Loader2 } from "lucide-react";
import {
  api,
  type AppSettings,
  type OverlayStyle,
  type RecordingMode,
} from "@/lib/ipc";
import { PanelHeader, SectionLabel } from "./common";
import { Toggle } from "./toggle";
import { LanguageSection } from "./LanguageSection";
import { useT } from "@/i18n";

export function AudioPanel() {
  const t = useT();
  const [devices, setDevices] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.listInputDevices(), api.getSettings()]).then(([list, s]) => {
      setDevices(list);
      setSettings(s);
    });
  }, []);

  async function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaving(true);
    try {
      await api.updateSettings(next);
    } catch (err) {
      console.error("update_settings failed:", err);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="space-y-8">
        <PanelHeader title={t.settings.audio.title} description={t.common.loading} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PanelHeader
        title={t.settings.audio.title}
        description={t.settings.audio.description}
      />

      {/* Microphone */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>{t.settings.audio.microphoneTitle}</SectionLabel>
          {saving && (
            <span className="text-[10.5px] text-faint inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> {t.common.saving}
            </span>
          )}
        </div>
        <div className="rounded-lg border border-app bg-elevated overflow-hidden">
          <MicRow
            label={t.settings.audio.defaultDevice.label}
            sublabel={t.settings.audio.defaultDevice.sublabel}
            isActive={settings.microphoneName === null}
            onClick={() => updateSetting("microphoneName", null)}
            isSystem
          />
          {devices.length === 0 && (
            <div className="px-4 py-5 text-[12.5px] text-muted border-t border-soft">
              {t.settings.audio.noDevices}
            </div>
          )}
          {devices.map((d) => (
            <MicRow
              key={d}
              label={d}
              isActive={settings.microphoneName === d}
              onClick={() => updateSetting("microphoneName", d)}
            />
          ))}
        </div>
        <p className="text-[11.5px] text-faint">
          {t.settings.audio.fallbackHint}
        </p>
      </section>

      {/* Mode */}
      <section className="space-y-3">
        <SectionLabel>{t.settings.audio.modeTitle}</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            label={t.settings.audio.mode.toggleLabel}
            description={t.settings.audio.mode.toggleDescription}
            active={settings.mode === "toggle"}
            onClick={() => updateSetting("mode", "toggle" as RecordingMode)}
          />
          <ModeCard
            label={t.settings.audio.mode.pttLabel}
            description={t.settings.audio.mode.pttDescription}
            active={settings.mode === "pushtotalk"}
            onClick={() => updateSetting("mode", "pushtotalk" as RecordingMode)}
          />
        </div>
      </section>

      {/* Overlay style */}
      <section className="space-y-3">
        <SectionLabel>{t.settings.audio.overlayTitle}</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <OverlayStyleCard
            label={t.settings.audio.overlay.fatLabel}
            description={t.settings.audio.overlay.fatDescription}
            active={settings.overlayStyle === "fat"}
            preview={<FatPreview />}
            onClick={() =>
              updateSetting("overlayStyle", "fat" as OverlayStyle)
            }
          />
          <OverlayStyleCard
            label={t.settings.audio.overlay.thinLabel}
            description={t.settings.audio.overlay.thinDescription}
            active={settings.overlayStyle === "thin"}
            preview={<ThinPreview />}
            onClick={() =>
              updateSetting("overlayStyle", "thin" as OverlayStyle)
            }
          />
        </div>
        <p className="text-[11.5px] text-faint">
          {t.settings.audio.overlayHint}
        </p>
      </section>

      {/* Paste options */}
      <section className="space-y-3">
        <SectionLabel>{t.settings.audio.pasteTitle}</SectionLabel>
        <div className="space-y-2">
          <ToggleRow
            checked={settings.autoPaste}
            onChange={(v) => updateSetting("autoPaste", v)}
            label={t.settings.audio.autoPaste.label}
            description={t.settings.audio.autoPaste.description}
          />
          <ToggleRow
            checked={settings.preserveClipboard}
            onChange={(v) => updateSetting("preserveClipboard", v)}
            label={t.settings.audio.preserveClipboard.label}
            description={t.settings.audio.preserveClipboard.description}
          />
        </div>
      </section>

      {/* Startup */}
      <section className="space-y-3">
        <SectionLabel>{t.settings.audio.startupTitle}</SectionLabel>
        <div className="space-y-2">
          <ToggleRow
            checked={settings.autoLaunch}
            onChange={(v) => updateSetting("autoLaunch", v)}
            label={t.settings.audio.autoLaunch.label}
            description={t.settings.audio.autoLaunch.description}
          />
        </div>
      </section>

      {/* Interface language. It sits here rather than in its own panel
          because this screen already holds the non-audio preferences
          (Startup above), and one picker doesn't justify a nav entry. */}
      <LanguageSection />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function MicRow({
  label,
  sublabel,
  isActive,
  onClick,
  isSystem,
}: {
  label: string;
  sublabel?: string;
  isActive: boolean;
  onClick: () => void;
  isSystem?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-hover border-t border-soft first:border-t-0"
    >
      <Mic
        className="h-3.5 w-3.5 flex-shrink-0"
        style={{ color: isActive ? "hsl(var(--sand))" : "hsl(var(--text-faint))" }}
        strokeWidth={2.2}
      />
      <div className="flex-1 min-w-0">
        <div
          className={`text-[13px] truncate ${
            isSystem ? "font-medium" : "font-mono"
          } text-app`}
        >
          {label}
        </div>
        {sublabel && (
          <div className="text-[11px] text-muted mt-0.5">{sublabel}</div>
        )}
      </div>
      {isActive && <Check className="h-3.5 w-3.5 text-moss" strokeWidth={2.8} />}
    </button>
  );
}

function ModeCard({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="rounded-lg border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
      style={{
        background: active ? "hsl(var(--sand-soft))" : "hsl(var(--bg-elevated))",
        borderColor: active ? "hsl(var(--sand) / 0.4)" : "hsl(var(--border))",
      }}
    >
      <div
        className="text-[13px] font-medium tracking-tight"
        style={{ color: active ? "hsl(var(--sand))" : "hsl(var(--text))" }}
      >
        {label}
      </div>
      <div className="text-[11.5px] text-muted mt-1 leading-relaxed">{description}</div>
    </motion.button>
  );
}

function OverlayStyleCard({
  label,
  description,
  active,
  preview,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  preview: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      aria-pressed={active}
      className="rounded-lg border p-3.5 text-left transition-all space-y-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
      style={{
        background: active ? "hsl(var(--sand-soft))" : "hsl(var(--bg-elevated))",
        borderColor: active ? "hsl(var(--sand) / 0.4)" : "hsl(var(--border))",
      }}
    >
      <div className="h-[42px] rounded-md flex items-center justify-center"
        style={{ background: "rgba(28, 24, 21, 0.92)" }}>
        {preview}
      </div>
      <div>
        <div
          className="text-[13px] font-medium tracking-tight"
          style={{ color: active ? "hsl(var(--sand))" : "hsl(var(--text))" }}
        >
          {label}
        </div>
        <div className="text-[11.5px] text-muted mt-1 leading-relaxed">
          {description}
        </div>
      </div>
    </motion.button>
  );
}

function FatPreview() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-[12px]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "hsl(6, 70%, 62%)" }} />
      <div className="flex items-center gap-[1.5px] h-3">
        {[3, 7, 5, 9, 6, 4, 8, 5, 3, 6, 4, 7].map((h, i) => (
          <span
            key={i}
            className="w-[1.5px] rounded-full"
            style={{ height: h, background: "hsl(30, 65%, 78%)", opacity: 0.7 }}
          />
        ))}
      </div>
      <span className="text-[8px] font-mono tabular-nums"
            style={{ color: "rgba(244,241,234,0.55)" }}>
        0:08
      </span>
    </div>
  );
}

function ThinPreview() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full">
      <span className="h-1 w-1 rounded-full" style={{ background: "hsl(6, 70%, 62%)" }} />
      <div className="flex items-center gap-[1px] h-2.5">
        {[2, 4, 3, 5, 4, 3, 4].map((h, i) => (
          <span
            key={i}
            className="w-[1px] rounded-full"
            style={{ height: h, background: "hsl(30, 65%, 78%)", opacity: 0.7 }}
          />
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-app bg-elevated p-4">
      <div className="flex-1">
        <div className="text-[13px] font-medium text-app">{label}</div>
        <div className="text-[11.5px] text-muted mt-0.5 leading-relaxed">{description}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export { ShortcutsPanel } from "./ShortcutsPanel";
