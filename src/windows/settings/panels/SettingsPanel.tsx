import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Check, Loader2, AlertTriangle } from "lucide-react";
import {
  api,
  type AppSettings,
  type OverlayStyle,
  type RecordingMode,
} from "@/lib/ipc";
import { CardTitle, PanelHeader } from "./common";
import { Toggle } from "./toggle";
import { LanguageSection } from "./LanguageSection";
import { TranscriptionLanguageSection } from "./TranscriptionLanguageSection";
import { HotkeyEditor, KeyChip } from "./HotkeyEditor";
import { useT } from "@/i18n";

/**
 * Every preference, on one screen, as a grid of cards. The shortcut and the
 * mode it runs in share a card — "which key" and "held or pressed" are the
 * same decision.
 */
export function SettingsPanel() {
  const t = useT();
  const a = t.settings.audio;
  const [devices, setDevices] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);

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

  // The hotkey saves on its own path: a rejected combo (already captured by
  // another app) must surface inline rather than be swallowed like the
  // toggles, so the user knows the change did not take.
  async function saveHotkey(newHotkey: string) {
    if (!settings) return;
    setHotkeyError(null);
    try {
      const next = { ...settings, hotkey: newHotkey };
      await api.updateSettings(next);
      setSettings(next);
    } catch (err) {
      setHotkeyError(String(err));
    }
  }

  if (!settings) {
    return <PanelHeader title={t.settings.panel.title} description={t.common.loading} />;
  }

  return (
    <div className="space-y-4">
      <PanelHeader
        title={t.settings.panel.title}
        description={t.settings.panel.description}
        actions={
          <span className="inline-flex items-center gap-1.5 text-[12px] text-soft" aria-live="polite">
            {saving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> {t.common.saving}
              </>
            ) : (
              <>
                <Check className="h-3 w-3 text-moss" strokeWidth={2.8} /> {t.ui.settings.autosaved}
              </>
            )}
          </span>
        }
      />

      <section className="grid grid-cols-2 gap-3 items-start">
        {/* ─── Microphone ─────────────────────────────────────── */}
        <div className="card p-4 space-y-3">
          <CardTitle>{a.microphoneTitle}</CardTitle>
          <div
            role="radiogroup"
            aria-label={a.microphoneTitle}
            className="rounded-xl border border-app overflow-hidden max-h-[188px] overflow-y-auto"
          >
            <MicRow
              label={a.defaultDevice.label}
              sublabel={a.defaultDevice.sublabel}
              isActive={settings.microphoneName === null}
              onClick={() => updateSetting("microphoneName", null)}
              isSystem
            />
            {devices.length === 0 && (
              <div className="px-3.5 py-4 text-[12.5px] text-muted border-t border-soft">
                {a.noDevices}
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
          <p className="text-[11.5px] text-muted leading-relaxed">{a.fallbackHint}</p>
        </div>

        {/* ─── Shortcut + mode ────────────────────────────────── */}
        <div className="card p-4 space-y-3">
          <CardTitle>{t.settings.shortcuts.mainLabel}</CardTitle>
          <HotkeyEditor current={settings.hotkey} onSave={saveHotkey} />
          {hotkeyError && (
            <div
              className="rounded-lg border px-3 py-2 text-[12px] flex items-start gap-2"
              style={{
                background: "hsl(var(--ember) / 0.08)",
                borderColor: "hsl(var(--ember) / 0.3)",
                color: "hsl(var(--ember))",
              }}
            >
              <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" strokeWidth={2.4} />
              <span>{hotkeyError}</span>
            </div>
          )}
          <div role="radiogroup" aria-label={a.modeTitle} className="grid grid-cols-2 gap-2">
            <ChoiceCard
              label={a.mode.pttLabel}
              description={a.mode.pttDescription}
              active={settings.mode === "pushtotalk"}
              onClick={() => updateSetting("mode", "pushtotalk" as RecordingMode)}
            />
            <ChoiceCard
              label={a.mode.toggleLabel}
              description={a.mode.toggleDescription}
              active={settings.mode === "toggle"}
              onClick={() => updateSetting("mode", "toggle" as RecordingMode)}
            />
          </div>
          <p className="text-[11px] text-muted leading-relaxed">
            {t.settings.shortcuts.imeTip.prefix} <KeyChip>Ctrl + Space</KeyChip>{" "}
            {t.settings.shortcuts.imeTip.middle} <KeyChip>Ctrl + Shift + Space</KeyChip>{" "}
            {t.settings.shortcuts.imeTip.or} <KeyChip>F8</KeyChip> {t.settings.shortcuts.imeTip.suffix}
          </p>
        </div>

        {/* ─── Overlay ────────────────────────────────────────── */}
        <div className="card p-4 space-y-3">
          <CardTitle action={<span className="text-[11.5px] text-muted">{a.overlayHint}</span>}>
            {a.overlayTitle}
          </CardTitle>
          <div role="radiogroup" aria-label={a.overlayTitle} className="grid grid-cols-2 gap-2">
            <OverlayStyleCard
              label={a.overlay.fatLabel}
              description={a.overlay.fatDescription}
              active={settings.overlayStyle === "fat"}
              preview={<FatPreview />}
              onClick={() => updateSetting("overlayStyle", "fat" as OverlayStyle)}
            />
            <OverlayStyleCard
              label={a.overlay.thinLabel}
              description={a.overlay.thinDescription}
              active={settings.overlayStyle === "thin"}
              preview={<ThinPreview />}
              onClick={() => updateSetting("overlayStyle", "thin" as OverlayStyle)}
            />
          </div>
        </div>

        {/* ─── Languages ──────────────────────────────────────── */}
        <div className="card p-4 space-y-3.5">
          <CardTitle>{t.settings.language.title}</CardTitle>
          <LanguageSection />
          <TranscriptionLanguageSection
            value={settings.language}
            onChange={(code) => updateSetting("language", code)}
          />
          <p className="text-[11px] text-muted leading-relaxed">
            {t.settings.language.transcriptionHint}
          </p>
        </div>

        {/* ─── Behaviour toggles ──────────────────────────────── */}
        <div className="card col-span-2 py-1.5 grid grid-cols-2">
          <ToggleRow
            checked={settings.fillerRemoval !== "off"}
            onChange={(v) => updateSetting("fillerRemoval", v ? "light" : "off")}
            label={a.fillerRemoval.label}
            description={a.fillerRemoval.description}
          />
          <ToggleRow
            checked={settings.autoPaste}
            onChange={(v) => updateSetting("autoPaste", v)}
            label={a.autoPaste.label}
            description={a.autoPaste.description}
          />
          <ToggleRow
            checked={settings.preserveClipboard}
            onChange={(v) => updateSetting("preserveClipboard", v)}
            label={a.preserveClipboard.label}
            description={a.preserveClipboard.description}
          />
          <ToggleRow
            checked={settings.gameMode}
            onChange={(v) => updateSetting("gameMode", v)}
            label={a.gameMode.label}
            description={a.gameMode.description}
          />
          <ToggleRow
            checked={settings.autoLaunch}
            onChange={(v) => updateSetting("autoLaunch", v)}
            label={a.autoLaunch.label}
            description={a.autoLaunch.description}
          />
        </div>
      </section>
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
      type="button"
      role="radio"
      aria-checked={isActive}
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-t border-soft first:border-t-0 focus-visible:outline-none focus-visible:bg-hover ${
        isActive ? "bg-sand-soft" : "hover:bg-hover"
      }`}
    >
      <span
        className="h-8 w-8 flex-shrink-0 rounded-[9px] flex items-center justify-center"
        style={{
          background: isActive ? "#1c1714" : "hsl(var(--bg-subtle))",
          color: isActive ? "#d6995c" : "hsl(var(--text-muted))",
        }}
      >
        <Mic className="h-[15px] w-[15px]" strokeWidth={2} />
      </span>
      <span className="flex-1 min-w-0">
        <span
          className={`block text-[13px] truncate text-app ${
            isActive ? "font-semibold" : isSystem ? "font-medium" : ""
          }`}
        >
          {label}
        </span>
        {sublabel && <span className="block text-[11px] text-muted mt-0.5">{sublabel}</span>}
      </span>
      {isActive && <Check className="h-3.5 w-3.5 text-moss flex-shrink-0" strokeWidth={2.8} />}
    </button>
  );
}

function ChoiceCard({
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
      type="button"
      role="radio"
      aria-checked={active}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="rounded-xl p-3 text-left space-y-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sand))]"
      style={{
        background: active ? "hsl(var(--sand-soft))" : "hsl(var(--bg-elevated))",
        border: `1.5px solid ${active ? "hsl(24 56% 49%)" : "hsl(var(--border))"}`,
      }}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold tracking-tight text-app">{label}</span>
        <span
          className="h-3.5 w-3.5 rounded-full flex-shrink-0 box-border"
          style={{
            border: active ? "4px solid hsl(24 56% 49%)" : "1.5px solid hsl(var(--text-faint))",
          }}
        />
      </span>
      <span className="block text-[11.5px] text-muted leading-snug">{description}</span>
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
      type="button"
      role="radio"
      aria-checked={active}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      title={description}
      className="rounded-xl overflow-hidden text-left bg-elevated transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sand))]"
      style={{ border: `1.5px solid ${active ? "hsl(24 56% 49%)" : "hsl(var(--border))"}` }}
    >
      <span className="h-[62px] flex items-center justify-center" style={WALLPAPER}>
        {preview}
      </span>
      <span className="block px-3 py-2.5 space-y-0.5">
        <span className="block text-[12.5px] font-semibold text-app">{label}</span>
        <span className="block text-[11px] text-muted leading-snug line-clamp-2">{description}</span>
      </span>
    </motion.button>
  );
}

/** A slice of warm "desktop" so the glass pill previews read as glass. */
const WALLPAPER: React.CSSProperties = {
  backgroundColor: "#6e3b25",
  backgroundImage:
    "radial-gradient(120px 60px at 25% 40%, rgba(232,168,100,0.95), transparent 70%), radial-gradient(120px 70px at 80% 60%, rgba(45,125,130,0.85), transparent 70%)",
};

const MINI_GLASS: React.CSSProperties = {
  background: "rgba(34, 28, 24, 0.55)",
  border: "1px solid rgba(255,255,255,0.28)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
};

function FatPreview() {
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style={MINI_GLASS}>
      <span className="h-[5px] w-[5px] rounded-full" style={{ background: "#ff7a5c" }} />
      <span className="flex items-center gap-[2px] h-[18px]">
        {[5, 9, 13, 8, 16, 11, 6, 12, 15, 9, 5, 10, 14, 7, 4, 8].map((h, i) => (
          <span key={i} className="w-[2px] rounded-full bg-white" style={{ height: h }} />
        ))}
      </span>
      <span className="text-[8px] font-mono tabular-nums text-white/80">0:07</span>
    </span>
  );
}

function ThinPreview() {
  return (
    <span className="flex items-center gap-1 px-2 py-1 rounded-full" style={MINI_GLASS}>
      <span className="h-1 w-1 rounded-full" style={{ background: "#ff7a5c" }} />
      <span className="flex items-center gap-[2px] h-2">
        {[4, 8, 6, 8, 3].map((h, i) => (
          <span key={i} className="w-[2px] rounded-full bg-white" style={{ height: h }} />
        ))}
      </span>
    </span>
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
    <div className="flex items-center gap-3.5 px-[18px] py-3">
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold text-app">{label}</div>
        <div className="text-[11.5px] text-muted mt-0.5 leading-snug">{description}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
