import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Trash2, Check, Inbox, Pencil, Search, Lock } from "lucide-react";
import { api, type HistoryEntry } from "@/lib/ipc";
import { events } from "@/lib/events";
import { useI18n, useT, type Dictionary } from "@/i18n";
import { GhostButton, PanelHeader } from "./common";
import { useTauriEvent } from "@/lib/useTauriEvent";

export function HistoryPanel() {
  const t = useT();
  const { intlLocale } = useI18n();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  useTauriEvent(events.onHistoryNew, (entry) =>
    setEntries((list) => (list.some((e) => e.id === entry.id) ? list : [entry, ...list]))
  );

  async function refresh() {
    try {
      const list = await api.getHistory();
      setEntries(list);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCopy(entry: HistoryEntry) {
    try {
      await navigator.clipboard.writeText(entry.text);
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(entry: HistoryEntry) {
    try {
      await api.deleteHistoryEntry(entry.id);
      await refresh();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleClear() {
    if (!confirm(t.settings.history.clearConfirm)) return;
    try {
      await api.clearHistory();
      await refresh();
    } catch (err) {
      console.error(err);
    }
  }

  function startEdit(entry: HistoryEntry) {
    setEditingId(entry.id);
    setEditText(entry.text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  function saveEdit(entry: HistoryEntry) {
    // Local-only edit for now — replace text in the visible list.
    // Persisted edit lands in Phase 6 when settings/history get their own
    // mutation commands (right now history.rs is append-only by design).
    setEntries((prev) =>
      prev.map((e) => (e.id === entry.id ? { ...e, text: editText, wordCount: editText.split(/\s+/).filter(Boolean).length } : e))
    );
    setEditingId(null);
    setEditText("");
  }

  const totalWords = entries.reduce((sum, e) => sum + e.wordCount, 0);
  const totalAudio = entries.reduce((sum, e) => sum + e.durationMs, 0) / 1000;

  const q = query.trim().toLocaleLowerCase(intlLocale);
  const visible = q ? entries.filter((e) => e.text.toLocaleLowerCase(intlLocale).includes(q)) : entries;
  const groups = useMemo(() => groupByDay(visible), [visible]);
  const heat = useMemo(() => heatmap(entries), [entries]);
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(intlLocale, { weekday: "narrow" });
    // 2024-01-01 was a Monday.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [intlLocale]);

  const h = t.ui.history;

  return (
    <div className="space-y-4">
      <PanelHeader
        title={t.settings.history.title}
        description={t.settings.history.description}
        actions={
          entries.length > 0 && (
            <>
              <label className="flex items-center gap-2 w-[220px] h-[34px] px-3 rounded-[9px] border border-app bg-elevated focus-within:ring-2 focus-within:ring-[hsl(var(--sand))]">
                <Search className="h-[13px] w-[13px] text-muted flex-shrink-0" strokeWidth={2.2} />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={h.search}
                  aria-label={h.searchAria}
                  className="flex-1 min-w-0 bg-transparent outline-none text-[12.5px] text-app placeholder:text-muted"
                />
              </label>
              <GhostButton onClick={handleClear} danger>
                {t.settings.history.clearAll}
              </GhostButton>
            </>
          )
        }
      />

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="grid grid-cols-5 gap-3.5 items-start">
          {/* ─── Summary ───────────────────────────────────────── */}
          <div className="stage col-span-2 p-[22px] flex flex-col gap-5 sticky top-0">
            <div className="stage-glow -left-16 -bottom-24 w-[320px] h-[300px]" />
            <div className="space-y-1">
              <div className="text-[12px] text-muted">{t.settings.general.totalsLabel}</div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-[44px] leading-none font-bold tracking-[-0.05em] tabular-nums text-app">
                  {totalWords.toLocaleString(intlLocale)}
                </span>
                <span className="text-[13px] text-soft">{h.wordsTranscribed}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[10px] px-3 py-2.5 bg-white/[0.06] border border-white/[0.08]">
                <div className="font-mono text-[16px] tabular-nums text-app">
                  {entries.length.toLocaleString(intlLocale)}
                </div>
                <div className="text-[11px] text-muted">{t.ui.dictations}</div>
              </div>
              <div className="rounded-[10px] px-3 py-2.5 bg-white/[0.06] border border-white/[0.08]">
                <div className="font-mono text-[16px] tabular-nums text-app">{formatDuration(totalAudio)}</div>
                <div className="text-[11px] text-muted">{t.ui.audio}</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-[12px] text-muted">{h.lastWeeks}</div>
              <div className="grid grid-cols-7 gap-1" role="img" aria-label={h.lastWeeks}>
                {heat.map((c) => (
                  <span
                    key={c.start}
                    title={c.future ? undefined : String(c.count)}
                    className="h-[22px] rounded"
                    style={{ background: c.future ? "transparent" : HEAT[c.level] }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] text-muted">
                {weekdays.map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11.5px] text-muted">
              <Lock className="h-3 w-3" strokeWidth={2.2} />
              {h.localOnly}
            </div>
          </div>

          {/* ─── List ──────────────────────────────────────────── */}
          <div className="card col-span-3 py-1">
            {groups.length === 0 && (
              <div className="px-5 py-10 text-center text-[12.5px] text-muted">{h.noResults}</div>
            )}
            {groups.map((g) => (
              <div key={g.day} className="pb-1">
                <div className="px-[18px] pt-3 pb-1.5 flex justify-between gap-3 text-[11.5px]">
                  <span className="font-semibold text-muted">{dayLabel(g.day, t, intlLocale)}</span>
                  <span className="text-muted">
                    {h.daySummary(g.items.length, g.items.reduce((s, e) => s + e.wordCount, 0))}
                  </span>
                </div>
                <AnimatePresence initial={false}>
                  {g.items.map((entry) => (
                    <motion.div
                      key={entry.id}
                      layout
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -10, transition: { duration: 0.15 } }}
                      transition={{ duration: 0.18 }}
                      className="group mx-2 px-2.5 py-2.5 rounded-[10px] border transition-colors"
                      style={{
                        background: editingId === entry.id ? "hsl(var(--sand-soft))" : undefined,
                        borderColor: editingId === entry.id ? "hsl(var(--sand) / 0.4)" : "transparent",
                      }}
                    >
                      {editingId === entry.id ? (
                        <div className="space-y-2.5">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            autoFocus
                            rows={Math.min(6, Math.max(2, editText.split("\n").length))}
                            className="w-full px-3 py-2 rounded-lg border border-app bg-elevated text-[13px] text-app leading-relaxed font-sans focus:outline-none focus:border-sand transition-colors resize-none"
                            style={{ caretColor: "hsl(var(--sand))" }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") cancelEdit();
                              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit(entry);
                            }}
                          />
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-sand">{t.settings.history.editHint}</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="text-[12px] font-medium px-2.5 py-1 rounded-md text-soft hover:bg-hover transition-colors"
                              >
                                {t.common.cancel}
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEdit(entry)}
                                className="text-[12px] font-medium px-3 py-1 rounded-md transition-opacity hover:opacity-90 active:scale-[0.97]"
                                style={{ background: "hsl(var(--text))", color: "hsl(var(--bg))" }}
                              >
                                {t.common.save}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <span className="w-[38px] flex-shrink-0 pt-0.5 font-mono text-[11px] text-muted tabular-nums">
                            {timeOf(entry.timestamp, intlLocale)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] text-app leading-[1.45]">{entry.text}</p>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted tabular-nums">
                              <span>{t.settings.history.entryWords(entry.wordCount)}</span>
                              <span aria-hidden="true">·</span>
                              <span>{t.units.audioSeconds((entry.durationMs / 1000).toFixed(1))}</span>
                              <span aria-hidden="true">·</span>
                              <span className="truncate font-mono">{entry.model}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                            <IconButton
                              onClick={() => handleCopy(entry)}
                              label={t.common.copy}
                              active={copiedId === entry.id}
                            >
                              {copiedId === entry.id ? (
                                <Check className="h-3 w-3 text-moss" strokeWidth={3} />
                              ) : (
                                <Copy className="h-3 w-3" strokeWidth={2.2} />
                              )}
                            </IconButton>
                            <IconButton onClick={() => startEdit(entry)} label={t.common.edit}>
                              <Pencil className="h-3 w-3" strokeWidth={2.2} />
                            </IconButton>
                            <IconButton onClick={() => handleDelete(entry)} label={t.common.delete} danger>
                              <Trash2 className="h-3 w-3" strokeWidth={2.2} />
                            </IconButton>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const DAY_MS = 86_400_000;

const HEAT = [
  "rgba(255,255,255,0.06)",
  "hsl(30 60% 60% / 0.28)",
  "hsl(30 60% 60% / 0.48)",
  "hsl(30 60% 60% / 0.72)",
  "hsl(30 60% 60%)",
];

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Entries arrive newest first; keep that order inside and across days. */
function groupByDay(list: HistoryEntry[]): Array<{ day: number; items: HistoryEntry[] }> {
  const out: Array<{ day: number; items: HistoryEntry[] }> = [];
  for (const e of list) {
    const day = startOfDay(e.timestamp);
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(e);
    else out.push({ day, items: [e] });
  }
  return out;
}

/** Five Monday-first weeks ending with the current one. */
function heatmap(list: HistoryEntry[]) {
  const today = startOfDay(Date.now());
  const dow = (new Date(today).getDay() + 6) % 7; // Monday = 0
  const first = today - (dow + 28) * DAY_MS;
  const counts = new Map<number, number>();
  for (const e of list) {
    const d = startOfDay(e.timestamp);
    if (d >= first) counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const max = Math.max(1, ...counts.values());
  return Array.from({ length: 35 }, (_, i) => {
    // Rebuild from the calendar date so DST shifts never skew the grid.
    const date = new Date(first);
    date.setDate(date.getDate() + i);
    const start = startOfDay(date.getTime());
    const count = counts.get(start) ?? 0;
    return {
      start,
      count,
      future: start > today,
      level: count === 0 ? 0 : Math.max(1, Math.ceil((count / max) * 4)),
    };
  });
}

function dayLabel(day: number, t: Dictionary, locale: string): string {
  const today = startOfDay(Date.now());
  if (day === today) return t.ui.history.today;
  if (day === startOfDay(today - DAY_MS / 2)) return t.ui.history.yesterday;
  const label = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(day)
  );
  return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
}

function timeOf(ts: number, locale: string): string {
  return new Date(ts).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

function IconButton({
  onClick,
  label,
  children,
  active,
  danger,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  active?: boolean;
  danger?: boolean;
}) {
  const hoverClasses = danger
    ? "hover:bg-[hsl(var(--ember)/0.15)] hover:text-ember"
    : active
    ? "hover:bg-hover" // active text-moss stays via base color
    : "hover:bg-hover hover:text-app";
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      type="button"
      className={`flex items-center justify-center h-7 w-7 rounded-[7px] border border-app bg-elevated transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))] ${
        active ? "text-moss" : "text-faint"
      } ${hoverClasses}`}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  const t = useT();
  return (
    <div className="card border-dashed px-6 py-16 text-center space-y-3">
      <div className="flex justify-center">
        <Inbox className="h-8 w-8 text-faint" strokeWidth={1.6} />
      </div>
      <div className="text-[13px] text-soft font-medium">
        {t.settings.history.empty.title}
      </div>
      <div className="text-[12px] text-muted max-w-[40ch] mx-auto leading-relaxed">
        {t.settings.history.empty.descriptionPrefix}{" "}
        <span className="font-mono text-app">Ctrl + Space</span>{" "}
        {t.settings.history.empty.descriptionSuffix}
      </div>
    </div>
  );
}
