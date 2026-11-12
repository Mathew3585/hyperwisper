import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Check, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { events, type RecordingState } from "@/lib/events";
import { sounds } from "@/lib/sounds";
import { api, type OverlayStyle } from "@/lib/ipc";
import { useT } from "@/i18n";
import { useTauriEvent } from "@/lib/useTauriEvent";

const FAT_BAR_COUNT = 36;
const THIN_BAR_COUNT = 7;
const BAR_HEIGHT_MAX = 56;
const BAR_HEIGHT_MIN = 4;
const THIN_BAR_HEIGHT_MAX = 16;
const THIN_BAR_HEIGHT_MIN = 2;

// Spring used for the pill morphing between recording / transcribing / done.
// Tuned to feel "alive" without overshooting noticeably.
const PILL_SPRING = { type: "spring" as const, stiffness: 280, damping: 28, mass: 0.7 };

export function OverlayApp() {
  const [state, setState] = useState<RecordingState>("idle");
  const [style, setStyle] = useState<OverlayStyle>("fat");
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);
  const prevState = useRef<RecordingState>("idle");

  // ─── Settings wiring (style follows live changes) ─────────────────────
  const fetchStyle = useCallback(() => {
    api
      .getSettings()
      .then((s) => setStyle(s.overlayStyle))
      .catch(() => {});
  }, []);
  useEffect(fetchStyle, [fetchStyle]);
  useTauriEvent(events.onSettingsChanged, fetchStyle);

  // ─── Recording state + feedback sounds ────────────────────────────────
  // Sounds are side effects, so they key off a ref of the previous state
  // rather than running inside a setState updater (which React may call
  // twice). Cancel — X button or the global Esc shortcut, which never
  // reaches this unfocused window as a keydown — shows up here as
  // recording → idle, so that transition is where its sound lives.
  useTauriEvent(events.onRecordingState, (s) => {
    const prev = prevState.current;
    prevState.current = s;
    if (s === prev) return;

    if (s === "recording") sounds.start();
    else if (prev === "recording" && s === "transcribing") sounds.stop();
    else if (prev === "recording" && s === "idle") sounds.cancel();
    else if (s === "done") sounds.done();

    if (s === "recording") {
      startedAt.current = Date.now();
      setElapsed(0);
    } else if (s === "idle") {
      startedAt.current = null;
    }
    setState(s);
  });

  // ─── Persist overlay position when the user drags the pill ─────────────
  useEffect(() => {
    const win = getCurrentWindow();
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let unlisten: (() => void) | null = null;

    win
      .listen<{ x: number; y: number }>("tauri://move", (event) => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          api.saveOverlayPosition(event.payload.x, event.payload.y).catch(() => {});
        }, 250);
      })
      .then((u) => {
        unlisten = u;
      });

    return () => {
      if (saveTimer) clearTimeout(saveTimer);
      if (unlisten) unlisten();
    };
  }, []);

  // ─── Timer (only used by fat overlay) ─────────────────────────────────
  useEffect(() => {
    if (state !== "recording") return;
    const id = window.setInterval(() => {
      if (startedAt.current) {
        setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [state]);

  const onPillMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    getCurrentWindow()
      .startDragging()
      .catch(() => {});
  };

  return (
    <div
      className={`h-screen w-screen flex items-start justify-center select-none ${
        style === "fat" ? "pt-2" : "pt-1"
      }`}
    >
      <AnimatePresence>
        {state !== "idle" &&
          (style === "fat" ? (
            <FatPill
              state={state}
              elapsed={elapsed}
              onMouseDown={onPillMouseDown}
            />
          ) : (
            <ThinPill
              state={state}
              onMouseDown={onPillMouseDown}
            />
          ))}
      </AnimatePresence>
    </div>
  );
}

/* ─── Fat overlay ────────────────────────────────────────────────────── */

function FatPill({
  state,
  elapsed,
  onMouseDown,
}: {
  state: RecordingState;
  elapsed: number;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  const t = useT();
  return (
    <motion.div
      key="pill-fat"
      layout
      onMouseDown={onMouseDown}
      initial={{ opacity: 0, y: -14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.94 }}
      transition={{
        layout: PILL_SPRING,
        opacity: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] },
        y: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] },
        scale: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] },
      }}
      className="cursor-grab active:cursor-grabbing relative flex items-center gap-4 rounded-[28px] px-5 py-3.5"
      style={pillSurface()}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === "recording" && (
          <motion.div
            key="recording"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-4"
          >
            <RecordingDot />
            <FatWaveform />
            <span
              className="font-mono text-[11px] tabular-nums min-w-[34px] text-right tracking-tight"
              style={{ color: "rgba(244, 241, 234, 0.55)" }}
            >
              {formatTime(elapsed)}
            </span>
            <CancelButton />
          </motion.div>
        )}

        {state === "transcribing" && (
          <motion.div
            key="transcribing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-2.5 px-1"
          >
            <Loader2
              className="h-3.5 w-3.5 animate-spin"
              style={{ color: "rgba(244, 241, 234, 0.7)" }}
            />
            <span
              className="text-[12.5px] font-medium tracking-tight"
              style={{ color: "rgba(244, 241, 234, 0.92)" }}
            >
              {t.overlay.transcribing}
            </span>
            <TypingDots />
          </motion.div>
        )}

        {state === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex items-center gap-2 px-1"
          >
            <DoneCheck />
            <span
              className="text-[12.5px] font-medium tracking-tight"
              style={{ color: "rgba(244, 241, 234, 0.92)" }}
            >
              {t.overlay.done}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FatWaveform() {
  return (
    <LiveWaveform
      count={FAT_BAR_COUNT}
      min={BAR_HEIGHT_MIN}
      max={BAR_HEIGHT_MAX}
      baseOpacity={0.4}
      className="gap-[3px] h-14 w-[280px]"
      barClassName="w-[3px]"
    />
  );
}

/* ─── Thin overlay ───────────────────────────────────────────────────── */

function ThinPill({
  state,
  onMouseDown,
}: {
  state: RecordingState;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.div
      key="pill-thin"
      layout
      onMouseDown={onMouseDown}
      initial={{ opacity: 0, y: -8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.94 }}
      transition={{
        layout: PILL_SPRING,
        opacity: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] },
        y: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] },
        scale: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] },
      }}
      className="cursor-grab active:cursor-grabbing relative flex items-center gap-2.5 rounded-full px-3 py-1.5"
      style={pillSurface()}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === "recording" && (
          <motion.div
            key="recording"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-2.5"
          >
            <RecordingDot small />
            <ThinWaveform />
          </motion.div>
        )}

        {state === "transcribing" && (
          <motion.div
            key="transcribing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <Loader2
              className="h-3 w-3 animate-spin"
              style={{ color: "rgba(244, 241, 234, 0.7)" }}
            />
            <TypingDots />
          </motion.div>
        )}

        {state === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-center"
          >
            <DoneCheck small />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ThinWaveform() {
  return (
    <LiveWaveform
      count={THIN_BAR_COUNT}
      min={THIN_BAR_HEIGHT_MIN}
      max={THIN_BAR_HEIGHT_MAX}
      baseOpacity={0.5}
      className="gap-[2px] h-4 w-[110px]"
      barClassName="w-[2px]"
    />
  );
}

/**
 * Scrolling level meter fed by `recording:level` (~30 Hz).
 *
 * Levels never touch React state: each event shifts a ring buffer and
 * writes the bars' height/opacity straight onto their DOM nodes, with a
 * CSS transition doing the smoothing. Routing them through state used to
 * re-render the whole pill 30×/s — re-running framer's `layout`
 * measurement and starting 36 fresh tweens every tick. Mounted only while
 * recording, so level events from the onboarding mic test (or anything
 * else) cost nothing while the overlay is hidden.
 */
function LiveWaveform({
  count,
  min,
  max,
  baseOpacity,
  className,
  barClassName,
}: {
  count: number;
  min: number;
  max: number;
  baseOpacity: number;
  className: string;
  barClassName: string;
}) {
  const bars = useRef<Array<HTMLDivElement | null>>([]);
  const levels = useRef<number[]>(Array(count).fill(0));

  useTauriEvent(events.onRecordingLevel, (rms) => {
    const buf = levels.current;
    buf.shift();
    buf.push(Math.min(1, Math.sqrt(rms) * 4.2));
    for (let i = 0; i < count; i++) {
      const el = bars.current[i];
      if (!el) continue;
      const v = buf[i];
      el.style.height = `${Math.max(min, v * max)}px`;
      el.style.opacity = String(baseOpacity + v * (1 - baseOpacity));
    }
  });

  return (
    <div
      className={`flex items-center justify-center ${className}`}
      // Fixed-size box: bar height changes can't ripple layout outward.
      style={{ contain: "strict" }}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
          className={`rounded-full ${barClassName}`}
          style={{
            height: `${min}px`,
            opacity: baseOpacity,
            background: "hsl(30, 65%, 78%)",
            transition: "height 70ms linear, opacity 70ms linear",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Shared visuals ──────────────────────────────────────────────────── */

function RecordingDot({ small }: { small?: boolean }) {
  const size = small ? "h-1.5 w-1.5" : "h-2 w-2";
  return (
    <span className={`relative flex flex-shrink-0 ${size}`}>
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
        style={{ background: "hsl(6, 70%, 62%)" }}
      />
      <span
        className={`relative inline-flex rounded-full ${size}`}
        style={{ background: "hsl(6, 70%, 62%)" }}
      />
    </span>
  );
}

function CancelButton() {
  const t = useT();
  return (
    <button
      onMouseDown={(e) => e.stopPropagation()}
      // The cancel sound plays from the recording → idle transition, so
      // the X button and the Esc shortcut sound the same and never twice.
      onClick={() => {
        api.cancelRecording().catch(() => {});
      }}
      className="flex items-center justify-center h-[18px] w-[18px] rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
      style={{
        background: "rgba(255, 245, 230, 0.06)",
        color: "rgba(244, 241, 234, 0.55)",
      }}
      title={t.overlay.cancelTitle}
      aria-label={t.overlay.cancelAriaLabel}
    >
      <X className="h-2.5 w-2.5" strokeWidth={3} />
    </button>
  );
}

function TypingDots() {
  return (
    <span className="flex gap-[3px]">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-[3px] w-[3px] rounded-full"
          style={{ background: "rgba(244, 241, 234, 0.45)" }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  );
}

function DoneCheck({ small }: { small?: boolean }) {
  const dim = small ? "h-[14px] w-[14px]" : "h-[18px] w-[18px]";
  const icon = small ? "h-2 w-2" : "h-2.5 w-2.5";
  return (
    <motion.span
      initial={{ scale: 0.6 }}
      animate={{ scale: 1 }}
      transition={{ ...PILL_SPRING, delay: 0.04 }}
      className={`flex items-center justify-center rounded-full ${dim}`}
      style={{ background: "hsla(88, 38%, 60%, 0.20)" }}
    >
      <Check
        className={icon}
        strokeWidth={3.5}
        style={{ color: "hsl(88, 38%, 70%)" }}
      />
    </motion.span>
  );
}

function pillSurface(): React.CSSProperties {
  return {
    // No backdrop-filter: in a transparent WebView2 window it can only
    // sample the webview's own (empty) content, never the desktop behind
    // it, so it cost a filter pass per repaint for no visible effect.
    background: "rgba(28, 24, 21, 0.94)",
    border: "1px solid rgba(255, 245, 230, 0.08)",
    boxShadow:
      "0 10px 40px -10px rgba(0,0,0,0.55), inset 0 1px 0 0 rgba(255,240,220,0.05)",
  };
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
