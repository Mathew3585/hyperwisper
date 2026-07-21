import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, AlertTriangle, X, ChevronRight, Mic, FileText, Clock } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Logo } from "@/components/Logo";
import { api, type HistoryEntry } from "@/lib/ipc";
import { events } from "@/lib/events";
import { formatRelativeTime } from "@/lib/datetime";
import { useI18n, type Dictionary } from "@/i18n";
import { SectionLabel, Kbd } from "./common";

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

export function GeneralPanel({ modelLoaded, onNavigate }: GeneralPanelProps) {
  const { t, intlLocale } = useI18n();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    refresh();
    api.getHistory().then(setHistory);

    const unsubs: Array<() => void> = [];
    events.onHistoryNew(() => api.getHistory().then(setHistory)).then((u) => unsubs.push(u));
    // The model load happens asynchronously after app start — refresh the
    // status panel as soon as Rust signals the model is ready so the GPU
    // acceleration line flips from "loading" to the active-GPU string without
    // a manual tab swap.
    events.onModelLoaded(() => refresh()).then((u) => unsubs.push(u));
    return () => unsubs.forEach((u) => u());
  }, [modelLoaded]);

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

  // Stats this session — last 24h
  const last24h = Date.now() - 86_400_000;
  const recent = history.filter((h) => h.timestamp > last24h);
  const dictationsToday = recent.length;
  const wordsToday = recent.reduce((s, e) => s + e.wordCount, 0);
  const audioToday = recent.reduce((s, e) => s + e.durationMs, 0) / 1000;

  // All-time counters, inherited from the retired Account panel. Same source,
  // same arithmetic — the whole history rather than the last 24 hours.
  const dictationsTotal = history.length;
  const wordsTotal = history.reduce((s, e) => s + e.wordCount, 0);
  const audioTotal = history.reduce((s, e) => s + e.durationMs, 0) / 1000;

  return (
    <div className="space-y-14">
      {/* ─── Hero ─────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="space-y-8"
      >
        <Logo size={64} className="text-sand" />

        <div className="space-y-2.5">
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-app">
            {hero.title}
          </h1>
          <p className="text-[15px] leading-relaxed text-soft max-w-[44ch]">
            {hero.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 text-[12.5px] text-muted">
          <span>{t.settings.general.holdHintPrefix}</span>
          <Kbd>Ctrl</Kbd>
          <span className="text-faint">+</span>
          <Kbd>Space</Kbd>
          <span>{t.settings.general.holdHintSuffix}</span>
        </div>
      </motion.section>

      {/* ─── Stats 24h ─────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="space-y-3"
      >
        <SectionLabel>{t.settings.general.todayLabel}</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            icon={<Mic className="h-3 w-3" strokeWidth={2.4} />}
            label={t.settings.general.stat.dictations}
            value={dictationsToday.toString()}
          />
          <StatCard
            icon={<FileText className="h-3 w-3" strokeWidth={2.4} />}
            label={t.settings.general.stat.words}
            value={wordsToday.toLocaleString(intlLocale)}
          />
          <StatCard
            icon={<Clock className="h-3 w-3" strokeWidth={2.4} />}
            label={t.settings.general.stat.audio}
            value={formatAudio(audioToday, t)}
          />
        </div>
      </motion.section>

      {/* ─── Stats all time ────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.14 }}
        className="space-y-3"
      >
        <SectionLabel>{t.settings.general.totalsLabel}</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            icon={<Mic className="h-3 w-3" strokeWidth={2.4} />}
            label={t.settings.general.totalStat.dictations}
            value={dictationsTotal.toLocaleString(intlLocale)}
          />
          <StatCard
            icon={<FileText className="h-3 w-3" strokeWidth={2.4} />}
            label={t.settings.general.totalStat.words}
            value={wordsTotal.toLocaleString(intlLocale)}
          />
          <StatCard
            icon={<Clock className="h-3 w-3" strokeWidth={2.4} />}
            label={t.settings.general.totalStat.audio}
            value={formatAudio(audioTotal, t)}
          />
        </div>
      </motion.section>

      {/* ─── System checks ─────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18 }}
        className="space-y-3"
      >
        <SectionLabel>{t.settings.general.systemLabel}</SectionLabel>

        <div className="-mx-3">
          {items.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-3 py-2.5 flex items-center gap-3">
                  <div className="h-3.5 w-3.5 rounded-full bg-subtle animate-pulse" />
                  <div className="h-3 w-20 rounded bg-subtle animate-pulse" />
                  <div className="h-3 w-32 rounded bg-subtle animate-pulse ml-auto" />
                </div>
              ))
            : items.map((it, idx) => (
                <StatusRow
                  key={idx}
                  item={it}
                  onClick={it.linkTo ? () => onNavigate(it.linkTo!) : undefined}
                />
              ))}
        </div>
      </motion.section>

      {/* ─── Last dictations preview ────────────────────────────── */}
      {history.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.26 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <SectionLabel>{t.settings.general.recentTitle}</SectionLabel>
            <button
              onClick={() => onNavigate("history")}
              className="text-[11.5px] text-muted hover:text-app transition-colors inline-flex items-center gap-1"
            >
              {t.settings.general.seeAll}
              <ChevronRight className="h-3 w-3" strokeWidth={2.2} />
            </button>
          </div>

          <div className="space-y-1.5">
            {history.slice(0, 3).map((entry) => (
              <div
                key={entry.id}
                className="px-3 py-2 rounded-md hover:bg-hover transition-colors"
              >
                <p className="text-[13px] text-app leading-snug line-clamp-1">
                  {entry.text}
                </p>
                <div className="mt-0.5 text-[10.5px] font-mono text-faint tabular-nums">
                  {formatRelativeTime(entry.timestamp, t, intlLocale)} ·{" "}
                  {t.settings.general.wordCount(entry.wordCount)}
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}

/* ─── Sub-components ───────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-app bg-elevated p-3.5 space-y-1.5">
      <div className="flex items-center gap-1.5 text-faint">
        {icon}
        <span className="text-[10.5px] uppercase tracking-[0.1em] font-medium">{label}</span>
      </div>
      <div className="text-[22px] font-semibold tracking-[-0.025em] tabular-nums text-app leading-none">
        {value}
      </div>
    </div>
  );
}

function StatusRow({ item, onClick }: { item: StatusRowView; onClick?: () => void }) {
  const interactive = !!onClick;
  return (
    <button
      onClick={onClick}
      disabled={!interactive}
      className={`group w-full px-3 py-2 flex items-center gap-3 rounded-md transition-colors ${
        interactive ? "hover:bg-hover cursor-pointer" : "cursor-default"
      }`}
    >
      <StatusIcon level={item.level} />
      <span className="text-[12.5px] font-medium tracking-tight text-soft min-w-[110px] text-left">
        {item.label}
      </span>
      <span className="text-[12.5px] text-app text-left flex-1 truncate font-mono">
        {item.value}
      </span>
      {interactive && (
        <ChevronRight
          className="h-3 w-3 text-faint group-hover:text-soft transition-colors"
          strokeWidth={2.2}
        />
      )}
    </button>
  );
}

function StatusIcon({ level }: { level: StatusLevel }) {
  if (level === "ok")
    return (
      <span className="flex items-center justify-center h-4 w-4 flex-shrink-0">
        <Check className="h-3.5 w-3.5 text-moss" strokeWidth={2.5} />
      </span>
    );
  if (level === "warn")
    return (
      <span className="flex items-center justify-center h-4 w-4 flex-shrink-0">
        <AlertTriangle className="h-3.5 w-3.5 text-sand" strokeWidth={2.3} />
      </span>
    );
  return (
    <span className="flex items-center justify-center h-4 w-4 flex-shrink-0">
      <X className="h-3.5 w-3.5 text-ember" strokeWidth={2.5} />
    </span>
  );
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
