import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Check, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { events, type RecordingState } from "@/lib/events";
import { sounds } from "@/lib/sounds";
import { api, type OverlayStyle } from "@/lib/ipc";
import { useT } from "@/i18n";

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
  const [fatLevels, setFatLevels] = useState<number[]>(() =>
    Array(FAT_BAR_COUNT).fill(0)
  );
  const [thinLevels, setThinLevels] = useState<number[]>(() =>
    Array(THIN_BAR_COUNT).fill(0)
  );
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);

  // ─── Settings wiring (style follows live changes) ─────────────────────
  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    const fetchStyle = () => {
      api
        .getSettings()
        .then((s) => {
          if (!cancelled) setStyle(s.overlayStyle);
        })
        .catch(() => {});
    };

    fetchStyle();
    events
      .onSettingsChanged(fetchStyle)
      .then((u) => {
        if (cancelled) u();
        else unsub = u;
      });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  // ─── Event wiring ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    events
      .onRecordingState((s) => {
        setState((prev) => {
          if (s === "recording" && prev !== "recording") sounds.start();
          if (prev === "recording" && s === "transcribing") sounds.stop();
          if (s === "done") sounds.done();
          return s;
        });
        if (s === "recording") {
          startedAt.current = Date.now();
          setElapsed(0);
          setFatLevels(Array(FAT_BAR_COUNT).fill(0));
          setThinLevels(Array(THIN_BAR_COUNT).fill(0));
        } else if (s === "idle") {
          startedAt.current = null;
        }
      })
      .then((u) => unsubs.push(u));

    events
      .onRecordingLevel((rms) => {
        const v = Math.min(1, Math.sqrt(rms) * 4.2);
        setFatLevels((prev) => [...prev.slice(1), v]);
        setThinLevels((prev) => [...prev.slice(1), v]);
      })
      .then((u) => unsubs.push(u));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        sounds.cancel();
        api.cancelRecording().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    unsubs.push(() => window.removeEventListener("keydown", onKey));

    return () => unsubs.forEach((u) => u());
  }, []);

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
              levels={fatLevels}
              elapsed={elapsed}
              onMouseDown={onPillMouseDown}
            />
          ) : (
            <ThinPill
              state={state}
              levels={thinLevels}
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
  levels,
  elapsed,
  onMouseDown,
}: {
  state: RecordingState;
  levels: number[];
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
            <FatWaveform levels={levels} />
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

function FatWaveform({ levels }: { levels: number[] }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-14 w-[280px]">
      {levels.map((v, i) => (
        <motion.div
          key={i}
          animate={{
            height: `${Math.max(BAR_HEIGHT_MIN, v * BAR_HEIGHT_MAX)}px`,
            opacity: 0.4 + v * 0.6,
          }}
          transition={{ duration: 0.07, ease: "linear" }}
          className="w-[3px] rounded-full"
          style={{ background: "hsl(30, 65%, 78%)" }}
        />
      ))}
    </div>
  );
}

/* ─── Thin overlay ───────────────────────────────────────────────────── */

function ThinPill({
  state,
  levels,
  onMouseDown,
}: {
  state: RecordingState;
  levels: number[];
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
            <ThinWaveform levels={levels} />
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

function ThinWaveform({ levels }: { levels: number[] }) {
  return (
    <div className="flex items-center justify-center gap-[2px] h-4 w-[110px]">
      {levels.map((v, i) => (
        <motion.div
          key={i}
          animate={{
            height: `${Math.max(THIN_BAR_HEIGHT_MIN, v * THIN_BAR_HEIGHT_MAX)}px`,
            opacity: 0.5 + v * 0.5,
          }}
          transition={{ duration: 0.07, ease: "linear" }}
          className="w-[2px] rounded-full"
          style={{ background: "hsl(30, 65%, 78%)" }}
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
      onClick={() => {
        sounds.cancel();
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
    background: "rgba(28, 24, 21, 0.94)",
    backdropFilter: "blur(24px) saturate(140%)",
    WebkitBackdropFilter: "blur(24px) saturate(140%)",
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
