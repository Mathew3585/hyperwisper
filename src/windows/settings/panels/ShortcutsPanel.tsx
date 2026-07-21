import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Command, AlertTriangle, X, Check } from "lucide-react";
import { api, type AppSettings } from "@/lib/ipc";
import { useT } from "@/i18n";
import { PanelHeader, SectionLabel } from "./common";

export function ShortcutsPanel() {
  const t = useT();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then(setSettings);
  }, []);

  async function saveHotkey(newHotkey: string) {
    if (!settings) return;
    setError(null);
    try {
      const next = { ...settings, hotkey: newHotkey };
      await api.updateSettings(next);
      setSettings(next);
    } catch (err) {
      setError(String(err));
    }
  }

  if (!settings) {
    return (
      <div className="space-y-8">
        <PanelHeader
          title={t.settings.shortcuts.title}
          description={t.common.loading}
        />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PanelHeader
        title={t.settings.shortcuts.title}
        description={t.settings.shortcuts.description}
      />

      <section className="space-y-3">
        <SectionLabel>{t.settings.shortcuts.mainLabel}</SectionLabel>
        <HotkeyEditor
          current={settings.hotkey}
          onSave={saveHotkey}
          mode={settings.mode}
        />
        {error && (
          <div
            className="rounded-md border px-3 py-2 text-[12px] flex items-start gap-2"
            style={{
              background: "hsl(var(--ember) / 0.08)",
              borderColor: "hsl(var(--ember) / 0.3)",
              color: "hsl(var(--ember))",
            }}
          >
            <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" strokeWidth={2.4} />
            <span>{error}</span>
          </div>
        )}
        <p className="text-[11.5px] text-faint leading-relaxed">
          {t.settings.shortcuts.imeTip.prefix}{" "}
          <KeyChip>Ctrl + Space</KeyChip>{" "}
          {t.settings.shortcuts.imeTip.middle}{" "}
          <KeyChip>Ctrl + Shift + Space</KeyChip>{" "}
          {t.settings.shortcuts.imeTip.or} <KeyChip>F8</KeyChip>{" "}
          {t.settings.shortcuts.imeTip.suffix}
        </p>
      </section>

      <section className="space-y-3">
        <SectionLabel>{t.settings.shortcuts.modeLabel}</SectionLabel>
        <div className="rounded-lg border border-app bg-elevated px-4 py-3 text-[13px] text-soft leading-relaxed">
          {settings.mode === "toggle" ? (
            <>
              <span className="font-medium text-app">
                {t.settings.shortcuts.modeToggle.name}
              </span>{" "}
              {t.settings.shortcuts.modeToggle.description}
            </>
          ) : (
            <>
              <span className="font-medium text-app">
                {t.settings.shortcuts.modePtt.name}
              </span>{" "}
              {t.settings.shortcuts.modePtt.description}
            </>
          )}
        </div>
        <p className="text-[11.5px] text-faint">
          {t.settings.shortcuts.changeModeHintPrefix}{" "}
          <span className="text-soft">{t.nav.audio}</span>{" "}
          {t.settings.shortcuts.changeModeHintSuffix}
        </p>
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── */

export function HotkeyEditor({
  current,
  onSave,
  mode,
}: {
  current: string;
  onSave: (s: string) => void;
  mode?: "toggle" | "pushtotalk";
}) {
  const t = useT();
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // While capturing, swallow every keypress globally and build the accelerator.
  // Also pause the OS-level hotkey so pressing the candidate combo doesn't
  // accidentally trigger a recording in the background.
  useEffect(() => {
    if (!capturing) return;

    api.pauseHotkey().catch(() => {});

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Escape") {
        setCapturing(false);
        setCaptured(null);
        return;
      }

      const combo = comboFromEvent(e);
      if (combo) setCaptured(combo);
    };

    window.addEventListener("keydown", handler, { capture: true });
    cancelRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", handler, { capture: true });
      api.resumeHotkey().catch(() => {});
    };
  }, [capturing]);

  function commit() {
    if (!captured) return;
    onSave(captured);
    setCapturing(false);
    setCaptured(null);
  }

  return (
    <div className="rounded-lg border border-app bg-elevated p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Command className="h-3.5 w-3.5 text-faint" strokeWidth={2.2} />
          <AnimatePresence mode="wait">
            {capturing ? (
              <motion.div
                key="capturing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-[13px]"
              >
                <motion.span
                  className="h-2 w-2 rounded-full bg-ember"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                <span className="text-soft">
                  {t.settings.shortcuts.editor.capturing}
                </span>
                {captured && (
                  <span className="ml-2 px-2 py-0.5 rounded font-mono text-[12px] bg-sand-soft text-sand">
                    {captured}
                  </span>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="static"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1"
              >
                {current.split("+").map((part, i, arr) => (
                  <span key={`${part}-${i}`} className="flex items-center gap-1">
                    <KeyChip>{part.trim()}</KeyChip>
                    {i < arr.length - 1 && (
                      <span className="text-faint text-[11px]">+</span>
                    )}
                  </span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!capturing && (
          <button
            onClick={() => setCapturing(true)}
            className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-elevated hover:bg-hover border border-app transition-colors"
          >
            {t.common.edit}
          </button>
        )}
      </div>

      {capturing && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-faint">
            <span className="font-mono">Esc</span>{" "}
            {t.settings.shortcuts.editor.escHintSuffix}
          </span>
          <div className="flex items-center gap-2">
            <button
              ref={cancelRef}
              onClick={() => {
                setCapturing(false);
                setCaptured(null);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] text-muted hover:bg-hover transition-colors"
            >
              <X className="h-3 w-3" strokeWidth={2.4} />
              {t.common.cancel}
            </button>
            <button
              onClick={commit}
              disabled={!captured}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "hsl(var(--sand))",
                color: "hsl(var(--accent-fg))",
              }}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
              {t.common.save}
            </button>
          </div>
        </div>
      )}

      {mode && (
        <div className="text-[11px] text-faint pt-1 border-t border-soft">
          {t.settings.shortcuts.editor.modeHintPrefix}{" "}
          <span className="text-soft font-medium">
            {mode === "toggle"
              ? t.settings.shortcuts.modeToggle.name
              : t.settings.shortcuts.modePtt.name}
          </span>{" "}
          {mode === "toggle"
            ? t.settings.shortcuts.editor.modeHintToggle
            : t.settings.shortcuts.editor.modeHintPtt}
        </div>
      )}
    </div>
  );
}

function KeyChip({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-[22px] px-1.5 text-[11px] font-mono font-medium rounded border border-app bg-subtle text-soft tracking-tight">
      {children}
    </kbd>
  );
}

/**
 * Translate a `KeyboardEvent` into the accelerator string format expected by
 * `tauri-plugin-global-shortcut`. Returns null while the user is just holding
 * modifiers without a final key.
 */
function comboFromEvent(e: KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Ctrl");
  if (e.shiftKey) mods.push("Shift");
  if (e.altKey) mods.push("Alt");
  if (e.metaKey) mods.push("Super");

  // The event for a pure modifier key has e.key === "Control"/"Shift"/...
  if (["Control", "Shift", "Alt", "Meta", "OS"].includes(e.key)) return null;

  const code = e.code;
  let key: string | null = null;
  if (code.startsWith("Key")) key = code.slice(3); // KeyA → A
  else if (code.startsWith("Digit")) key = code.slice(5); // Digit0 → 0
  else if (code === "Space") key = "Space";
  else if (code === "Enter") key = "Enter";
  else if (code === "Tab") key = "Tab";
  else if (code === "Backspace") key = "Backspace";
  else if (/^F\d{1,2}$/.test(code)) key = code;
  else if (code === "Comma") key = "Comma";
  else if (code === "Period") key = "Period";
  else if (code === "Slash") key = "Slash";
  else if (code === "Backslash") key = "Backslash";
  else if (code === "Minus") key = "Minus";
  else if (code === "Equal") key = "Equal";
  else if (code.startsWith("Arrow")) key = code; // ArrowUp etc.

  if (!key) return null;
  return [...mods, key].join("+");
}
