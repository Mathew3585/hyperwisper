import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, AlertTriangle, X, ChevronRight, Mic } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { api, type HistoryEntry } from "@/lib/ipc";
import { events } from "@/lib/events";
import { formatRelativeTime } from "@/lib/datetime";
import { useI18n, type Dictionary } from "@/i18n";
import { HotkeyCaps, StatusChip } from "./common";
import { useTauriEvent } from "@/lib/useTauriEvent";

type StatusLevel = "ok" | "warn" | "error";

/**
 * One row as Rust sends it. The backend emits no prose — `kind` is a stable
 * id, `detail` carries the untranslatable data (device name, model name,
 * hotkey combo) that gets interpolated into the localised string.
 */
interface StatusItem {
  level: StatusLevel;
  kind: string;
  detail?: string;
  linkTo?: string;
}

interface SystemStatus {
  whisper: StatusItem;
  microphone: StatusItem;
  hotkey: StatusItem;
  acceleration: StatusItem;
  privacy: StatusItem;
}

/** A row once the dictionary has turned `kind` + `detail` into text. */
interface StatusRowView {
  level: StatusLevel;
  label: string;
  value: string;
  linkTo?: string;
}

interface GeneralPanelProps {
  modelLoaded: boolean;
  onNavigate: (panelId: string) => void;
}

const DAY_MS = 86_400_000;

/** Decorative bar heights either side of the mic button, tallest nearest it. */
const STAGE_BARS = Array.from({ length: 14 }, (_, i) => {
  const v = Math.abs(Math.sin((i + 3) * 0.55) * Math.cos((i + 3) * 0.21)) * 0.85 + 0.12;
  const fade = 1 - i / 18;
  return { h: Math.round(4 + v * fade * 44), o: 0.25 + (1 - i / 14) * 0.7 };
});

export function GeneralPanel({ onNavigate }: GeneralPanelProps) {
  const { t, intlLocale } = useI18n();
  const g = t.settings.general;
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [hotkey, setHotkey] = useState<string>("Ctrl+Space");

  useEffect(() => {
    refresh();
    api.getHistory().then(setHistory);
    api.getSettings().then((s) => setHotkey(s.hotkey)).catch(() => {});
  }, []);

  // The event already carries the new entry — prepend it instead of
  // re-reading the whole history file after every dictation.
  useTauriEvent(events.onHistoryNew, (entry) => setHistory((h) => [entry, ...h]));
  // The model load happens asynchronously after app start — refresh the
  // status as soon as Rust signals the model is ready so the GPU line flips
  // from "loading" to the active-GPU string without a manual tab swap.
  useTauriEvent(events.onModelLoaded, () => refresh());
  useTauriEvent(events.onSettingsChanged, () => {
    api.getSettings().then((s) => setHotkey(s.hotkey)).catch(() => {});
    refresh();
  });

  async function refresh() {
    try {
      const s = await invoke<SystemStatus>("get_system_status");
      setStatus(s);
    } catch (err) {
      console.error("get_system_status failed:", err);
    }
  }

  const items = status ? describeStatus(status, t) : [];
  const worst = worstLevel(items);
  const hero = heroPhrase(worst, status, t);

  // Today, from local midnight — "today" on the dashboard means the
  // calendar day, matching the week chart next to it.
  const midnight = startOfDay(Date.now());
  const today = history.filter((h) => h.timestamp >= midnight);
  const wordsToday = today.reduce((s, e) => s + e.wordCount, 0);
  const audioToday = today.reduce((s, e) => s + e.durationMs, 0) / 1000;
  const wpm = audioToday > 0 ? Math.round(wordsToday / (audioToday / 60)) : 0;

  const week = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale, { weekday: "narrow" });
    const days = Array.from({ length: 7 }, (_, i) => {
      const start = midnight - (6 - i) * DAY_MS;
      const words = history
        .filter((h) => h.timestamp >= start && h.timestamp < start + DAY_MS)
        .reduce((s, e) => s + e.wordCount, 0);
      return { start, words, label: fmt.format(new Date(start)), isToday: i === 6 };
    });
    const max = Math.max(1, ...days.map((d) => d.words));
    return days.map((d) => ({ ...d, pct: d.words / max }));
  }, [history, intlLocale, midnight]);

  const model = status?.whisper.kind === "loaded" ? status.whisper.detail : null;
  const engine =
    status?.acceleration.kind === "gpu" ? status.acceleration.detail ?? "GPU" : "CPU";

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-5 gap-3.5">
        {/* ─── Stage ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="stage col-span-3 min-h-[300px] px-6 py-[22px] flex flex-col justify-between gap-5"
        >
          <div className="stage-glow left-1/2 top-[46%] w-[420px] h-[260px] -translate-x-1/2 -translate-y-1/2" />

          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2 min-w-0">
              <StatusChip tone={status ? worst : "neutral"}>{hero.title}</StatusChip>
              {status && worst !== "ok" && (
                <p className="text-[12.5px] text-soft leading-relaxed max-w-[40ch]">
                  {hero.subtitle}
                </p>
              )}
            </div>
            {model && (
              <span className="font-mono text-[11px] text-muted truncate">
                {model} · {engine}
              </span>
            )}
          </div>

          <div className="flex items-center justify-center gap-[22px]">
            <StageBars mirrored />
            <button
              type="button"
              onClick={() => onNavigate("diagnostics")}
              aria-label={t.ui.testMic}
              title={t.ui.testMic}
              className="h-24 w-24 flex-shrink-0 rounded-full flex items-center justify-center text-app transition-transform hover:scale-[1.03] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sand))]"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,230,200,0.25)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 10px hsl(30 60% 60% / 0.10), 0 0 0 22px hsl(30 60% 60% / 0.05)",
              }}
            >
              <Mic className="h-[30px] w-[30px]" strokeWidth={1.9} />
            </button>
            <StageBars />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-[12.5px] text-soft">
            <span>{g.holdHintPrefix}</span>
            <HotkeyCaps combo={hotkey} size="sm" />
            <span>{g.holdHintSuffix}</span>
          </div>
        </motion.div>

        {/* ─── Today ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06 }}
          className="card col-span-2 px-[22px] py-5 flex flex-col gap-3.5"
        >
          <div className="space-y-0.5">
            <div className="text-[12px] text-muted">{g.todayLabel}</div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[44px] leading-none font-bold tracking-[-0.05em] tabular-nums text-app">
                {wordsToday.toLocaleString(intlLocale)}
              </span>
              <span className="text-[13px] text-soft">{t.ui.wordsDictated}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MiniStat value={today.length.toLocaleString(intlLocale)} label={t.ui.dictations} />
            <MiniStat value={formatAudio(audioToday, t)} label={t.ui.audio} />
            <MiniStat value={wpm > 0 ? String(wpm) : "—"} label={t.ui.wordsPerMinute} />
          </div>

          <div className="flex-1 flex flex-col gap-1.5 min-h-[90px]">
            <span className="text-[11.5px] text-muted">{t.ui.thisWeek}</span>
            <div className="flex-1 grid grid-cols-7 gap-1.5 items-end">
              {week.map((d) => (
                <div key={d.start} className="flex flex-col items-center gap-1 h-full justify-end">
                  <span
                    className="w-full rounded"
                    title={`${d.words.toLocaleString(intlLocale)}`}
                    style={{
                      height: `${Math.max(6, d.pct * 100)}%`,
                      minHeight: 4,
                      background: d.isToday
                        ? "hsl(var(--sand))"
                        : d.words === 0
                        ? "hsl(var(--border-soft))"
                        : "hsl(var(--sand) / 0.38)",
                    }}
                  />
                  <span className="text-[10.5px] text-muted">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── Recent dictations ─────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        className="space-y-2.5"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] font-semibold tracking-tight text-app">{g.recentTitle}</h2>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate("history")}
              className="text-[12px] font-medium text-sand hover:opacity-80 inline-flex items-center gap-0.5"
            >
              {t.ui.fullHistory}
              <ChevronRight className="h-3 w-3" strokeWidth={2.4} />
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <div className="card border-dashed px-5 py-8 text-center text-[12.5px] text-muted">
            {t.ui.noDictationYet}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {history.slice(0, 3).map((entry) => (
              <div
                key={entry.id}
                className="card rounded-[14px] min-h-[118px] px-4 py-3.5 flex flex-col justify-between gap-3"
              >
                <p className="text-[13px] leading-[1.45] text-app line-clamp-3">{entry.text}</p>
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span className="font-mono tabular-nums">
                    {formatRelativeTime(entry.timestamp, t, intlLocale)}
                  </span>
                  <span>{g.wordCount(entry.wordCount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* ─── System chips ──────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.18 }}
        aria-label={g.systemLabel}
        className="flex flex-wrap gap-2"
      >
        {items.length === 0
          ? Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="h-[30px] w-28 rounded-full bg-subtle animate-pulse" />
            ))
          : items.map((it) => (
              <StatusPill
                key={it.label}
                item={it}
                onClick={it.linkTo ? () => onNavigate(it.linkTo!) : undefined}
              />
            ))}
      </motion.section>
    </div>
  );
}

/* ─── Sub-components ───────────────────────────────────────────── */

function StageBars({ mirrored }: { mirrored?: boolean }) {
  const bars = mirrored ? [...STAGE_BARS].reverse() : STAGE_BARS;
  return (
    <div className="flex items-center gap-[3px] h-[50px]" aria-hidden="true">
      {bars.map((b, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-sand"
          style={{ height: b.h, opacity: b.o }}
        />
      ))}
    </div>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="tile px-2.5 py-[9px] space-y-0.5 min-w-0">
      <div className="font-mono text-[15px] font-medium tabular-nums text-app truncate">{value}</div>
      <div className="text-[11px] text-muted truncate">{label}</div>
    </div>
  );
}

function StatusPill({ item, onClick }: { item: StatusRowView; onClick?: () => void }) {
  const content = (
    <>
      <StatusIcon level={item.level} />
      <span className="truncate max-w-[260px]">{item.value}</span>
    </>
  );
  const cls =
    "inline-flex items-center gap-[7px] h-[30px] px-3 rounded-full border border-app bg-elevated text-[12px] text-soft";
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      title={item.label}
      className={`${cls} hover:bg-hover hover:text-app transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sand))]`}
    >
      {content}
    </button>
  ) : (
    <span title={item.label} className={cls}>
      {content}
    </span>
  );
}

function StatusIcon({ level }: { level: StatusLevel }) {
  if (level === "ok") return <Check className="h-3 w-3 text-moss flex-shrink-0" strokeWidth={2.8} />;
  if (level === "warn")
    return <AlertTriangle className="h-3 w-3 text-sand flex-shrink-0" strokeWidth={2.4} />;
  return <X className="h-3 w-3 text-ember flex-shrink-0" strokeWidth={2.8} />;
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Turn the raw payload into displayable rows. Every `kind` the backend can
 * emit is handled; anything unexpected degrades to the raw detail rather
 * than blowing up the panel.
 */
function describeStatus(status: SystemStatus, t: Dictionary): StatusRowView[] {
  const s = t.systemStatus;
  const detail = (it: StatusItem) => it.detail ?? "";

  const whisper: StatusRowView = {
    level: status.whisper.level,
    label: s.whisper.label,
    value:
      status.whisper.kind === "loaded"
        ? s.whisper.loaded(detail(status.whisper))
        : s.whisper.missing,
    linkTo: status.whisper.linkTo,
  };

  const microphone: StatusRowView = {
    level: status.microphone.level,
    label: s.microphone.label,
    value:
      status.microphone.kind === "ok"
        ? s.microphone.ok(detail(status.microphone))
        : s.microphone.missing,
    linkTo: status.microphone.linkTo,
  };

  const hotkey: StatusRowView = {
    level: status.hotkey.level,
    label: s.hotkey.label,
    value: s.hotkey.ok(detail(status.hotkey)),
    linkTo: status.hotkey.linkTo,
  };

  const acceleration: StatusRowView = {
    level: status.acceleration.level,
    label: s.acceleration.label,
    value:
      status.acceleration.kind === "gpu"
        ? s.acceleration.gpu(detail(status.acceleration))
        : status.acceleration.kind === "cpuWithGpu"
        ? s.acceleration.cpuWithGpu(detail(status.acceleration))
        : s.acceleration.cpu,
    linkTo: status.acceleration.linkTo,
  };

  const privacy: StatusRowView = {
    level: status.privacy.level,
    label: s.privacy.label,
    value: s.privacy.ok,
    linkTo: status.privacy.linkTo,
  };

  return [whisper, microphone, hotkey, acceleration, privacy];
}

function worstLevel(items: StatusRowView[]): StatusLevel {
  if (items.some((i) => i.level === "error")) return "error";
  if (items.some((i) => i.level === "warn")) return "warn";
  return "ok";
}

function heroPhrase(
  worst: StatusLevel,
  status: SystemStatus | null,
  t: Dictionary
): { title: string; subtitle: string } {
  const hero = t.settings.general.hero;
  if (!status) return hero.loading;
  if (worst === "error") {
    if (status.whisper.level === "error") return hero.noModel;
    if (status.microphone.level === "error") return hero.noMic;
    return hero.setup;
  }
  return hero.ready;
}

function formatAudio(seconds: number, t: Dictionary): string {
  if (seconds < 60) return t.units.seconds(Math.round(seconds));
  if (seconds < 3600)
    return t.units.minutesSeconds(
      Math.floor(seconds / 60),
      Math.round(seconds % 60)
    );
  return t.units.hours(Number((seconds / 3600).toFixed(1)));
}
