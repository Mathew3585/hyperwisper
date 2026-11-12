import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Check, ClipboardCopy, Loader2, Mic, Trash2 } from "lucide-react";

import {
  api,
  type DeviceTest,
  type DictationMetrics,
  type MicReport,
  type MicVerdict,
  type RuntimeInfo,
} from "@/lib/ipc";
import { events } from "@/lib/events";
import { formatRelativeTime } from "@/lib/datetime";
import { useTauriEvent } from "@/lib/useTauriEvent";
import { useI18n, type Dictionary } from "@/i18n";
import { PanelHeader, SectionLabel } from "./common";

const TEST_SECONDS = 5;
/** Per device in the "test every mic" sweep. */
const SWEEP_SECONDS = 3;
/** Bars span -60 dBFS … 0 dBFS. */
const DB_FLOOR = -60;

/**
 * Everything the backend measures, in one place: a per-channel mic test
 * (what each input of an audio interface really receives), latency stats
 * over the recorded dictations, and a copy-as-JSON export for bug reports.
 * All of it comes from `metrics.jsonl` on this PC; nothing is sent anywhere.
 */
export function DiagnosticsPanel() {
  const { t } = useI18n();
  const d = t.diagnostics;

  const [metrics, setMetrics] = useState<DictationMetrics[]>([]);
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [report, setReport] = useState<MicReport | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getMetrics(500).then(setMetrics).catch(() => {});
    api.getRuntimeInfo().then(setRuntime).catch(() => {});
  }, []);
  useTauriEvent(events.onMetricsNew, (m) => setMetrics((list) => [m, ...list]));
  useTauriEvent(events.onGameMode, () => {
    api.getRuntimeInfo().then(setRuntime).catch(() => {});
  });

  async function copyReport() {
    const payload = {
      generatedAt: new Date().toISOString(),
      runtime,
      micTest: report,
      dictations: metrics,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("copy failed:", err);
    }
  }

  async function clear() {
    await api.clearMetrics().catch(() => {});
    setMetrics([]);
  }

  return (
    <div className="space-y-10">
      <PanelHeader title={d.title} description={d.description} />
      {runtime?.gameModeSuspendedBy != null && (
        <div
          className="rounded-[10px] border px-3.5 py-2.5 text-[12.5px] leading-relaxed"
          style={{
            background: "hsl(var(--sand) / 0.08)",
            borderColor: "hsl(var(--sand) / 0.3)",
          }}
        >
          {d.gameModePaused(runtime.gameModeSuspendedBy)}
        </div>
      )}
      <MicSection report={report} onReport={setReport} />
      <AllMicsSection />
      <PerfSection metrics={metrics} />
      <SystemSection runtime={runtime} />

      <div className="flex flex-wrap gap-2">
        <ActionButton onClick={copyReport}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
          {copied ? d.actions.copied : d.actions.copy}
        </ActionButton>
        <ActionButton onClick={clear} subtle>
          <Trash2 className="h-3.5 w-3.5" />
          {d.actions.clear}
        </ActionButton>
      </div>
    </div>
  );
}

/* ─── Microphone ─────────────────────────────────────────────────────── */

function MicSection({
  report,
  onReport,
}: {
  report: MicReport | null;
  onReport: (r: MicReport) => void;
}) {
  const { t } = useI18n();
  const m = t.diagnostics.mic;
  const [testing, setTesting] = useState(false);
  const [remaining, setRemaining] = useState(TEST_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const meter = useRef<HTMLDivElement>(null);

  // Live meter while the test runs — written straight to the DOM, like the
  // overlay waveform, so 30 events/s don't re-render the panel.
  useTauriEvent(
    events.onRecordingLevel,
    (rms) => {
      if (meter.current) meter.current.style.width = `${dbToPct(toDb(rms))}%`;
    },
    testing
  );

  async function run() {
    setTesting(true);
    setError(null);
    setRemaining(TEST_SECONDS);
    const started = Date.now();
    const tick = window.setInterval(() => {
      setRemaining(Math.max(0, TEST_SECONDS - Math.floor((Date.now() - started) / 1000)));
    }, 250);
    try {
      onReport(await api.testMicrophone(TEST_SECONDS * 1000));
    } catch (err) {
      setError(String(err));
    } finally {
      window.clearInterval(tick);
      setTesting(false);
      if (meter.current) meter.current.style.width = "0%";
    }
  }

  return (
    <section className="space-y-3">
      <SectionLabel>{m.label}</SectionLabel>

      <div className="rounded-[10px] border border-app bg-elevated p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] text-app font-medium truncate">
              {report?.format.device ?? "—"}
            </div>
            {report && (
              <div className="text-[11.5px] text-faint font-mono">
                {m.format(report.format.channels, report.format.sampleRate, report.format.sampleFormat)}
              </div>
            )}
          </div>
          <ActionButton onClick={run} disabled={testing}>
            {testing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
            {testing ? m.testing(remaining) : m.test(TEST_SECONDS)}
          </ActionButton>
        </div>

        {testing && (
          <div className="h-1.5 rounded-full bg-subtle overflow-hidden">
            <div
              ref={meter}
              className="h-full rounded-full"
              style={{ width: "0%", background: "hsl(var(--sand))", transition: "width 70ms linear" }}
            />
          </div>
        )}

        {!report && !testing && <p className="text-[11.5px] text-faint leading-relaxed">{m.hint}</p>}

        {error && (
          <p className="text-[12px]" style={{ color: "hsl(var(--ember))" }}>
            {error}
          </p>
        )}

        {report && !testing && <MicReportView report={report} />}
      </div>
    </section>
  );
}

function MicReportView({ report }: { report: MicReport }) {
  const { t } = useI18n();
  const m = t.diagnostics.mic;

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {report.channels.map((c, i) => {
          const used = report.usedChannels.includes(i);
          return (
            <div key={i} className={used ? "" : "opacity-55"}>
              <div className="flex items-center justify-between text-[11.5px] mb-1">
                <span className="text-soft">
                  {m.channel(i + 1)}{" "}
                  <span className={used ? "text-sand" : "text-faint"}>· {used ? m.used : m.ignored}</span>
                </span>
                <span className="font-mono text-faint tabular-nums">
                  {m.rms} {fmtDb(toDb(c.rms))} · {m.peak} {fmtDb(toDb(c.peak))}
                </span>
              </div>
              <LevelBar rms={c.rms} peak={c.peak} clipped={c.clippedRatio > 0.001} />
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-faint font-mono">
        <span>{m.speech(report.speechMs)}</span>
        {report.snrDb !== null && <span>{m.snr(report.snrDb.toFixed(0))}</span>}
        {report.streamStartMs !== null && (
          <span>
            {m.start} {Math.round(report.streamStartMs)} ms
          </span>
        )}
      </div>

      <ul className="space-y-1.5">
        {report.verdicts.map((v) => {
          const tone = verdictTone(v);
          return (
            <li key={v} className="text-[12.5px] leading-relaxed flex gap-2">
              <span
                className="mt-[7px] h-1.5 w-1.5 rounded-full flex-shrink-0"
                style={{ background: TONE_COLOR[tone] }}
              />
              <span className="text-soft">{m.verdict[v]}</span>
            </li>
          );
        })}
      </ul>

      {report.format.supported.length > 0 && (
        <details className="text-[11.5px]">
          <summary className="text-faint cursor-pointer select-none">{m.supported}</summary>
          <ul className="mt-1.5 font-mono text-faint space-y-0.5">
            {report.format.supported.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function LevelBar({ rms, peak, clipped }: { rms: number; peak: number; clipped: boolean }) {
  return (
    <div className="relative h-2 rounded-full bg-subtle overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${dbToPct(toDb(rms))}%`, background: "hsl(var(--sand))" }}
      />
      <div
        className="absolute inset-y-0 w-[2px]"
        style={{
          left: `calc(${dbToPct(toDb(peak))}% - 2px)`,
          background: clipped ? "hsl(var(--ember))" : "hsl(var(--text-soft))",
        }}
      />
    </div>
  );
}

type Tone = "bad" | "warn" | "good";
const TONE_COLOR: Record<Tone, string> = {
  bad: "hsl(var(--ember))",
  warn: "hsl(var(--sand))",
  good: "hsl(var(--moss))",
};

function verdictTone(v: MicVerdict): Tone {
  if (v === "noSignal" || v === "noVoice" || v === "clipping") return "bad";
  if (v === "lowGain" || v === "bluetooth" || v === "slowStart") return "warn";
  return "good";
}

function worstTone(verdicts: MicVerdict[]): Tone {
  const tones = verdicts.map(verdictTone);
  return tones.includes("bad") ? "bad" : tones.includes("warn") ? "warn" : "good";
}

/* ─── Every microphone ───────────────────────────────────────────────── */

/**
 * Sweep every input device in turn while the user keeps talking, so they
 * can see at a glance which mic gives the cleanest signal — and switch to
 * it in one click.
 */
function AllMicsSection() {
  const { t } = useI18n();
  const m = t.diagnostics.mic;
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [results, setResults] = useState<DeviceTest[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then((s) => setSelected(s.microphoneName)).catch(() => {});
  }, []);
  useTauriEvent(events.onMicTestDevice, setCurrent, running);

  async function run() {
    setRunning(true);
    setResults(null);
    try {
      setResults(await api.testAllMicrophones(SWEEP_SECONDS * 1000));
    } finally {
      setRunning(false);
      setCurrent(null);
    }
  }

  async function use(device: string) {
    const s = await api.getSettings();
    await api.updateSettings({ ...s, microphoneName: device });
    setSelected(device);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11.5px] text-faint leading-relaxed">
          {running && current ? m.testingDevice(current) : m.testAllHint}
        </p>
        <ActionButton onClick={run} disabled={running}>
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mic className="h-3.5 w-3.5" />}
          {m.testAll}
        </ActionButton>
      </div>

      {results && (
        <div className="rounded-[10px] border border-app bg-elevated overflow-hidden">
          {results.map((r, i) => {
            const rep = r.report;
            const tone = rep ? worstTone(rep.verdicts) : "bad";
            const used = rep?.usedChannels ?? [];
            const level = rep ? Math.max(...used.map((c) => rep.channels[c]?.rms ?? 0), 0) : 0;
            const isSelected = selected === r.device;
            return (
              <div key={r.device} className={`px-3.5 py-3 space-y-1.5 ${i > 0 ? "border-t border-soft" : ""}`}>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full flex-shrink-0"
                    style={{ background: TONE_COLOR[tone] }}
                  />
                  <span className="text-[12.5px] text-app truncate flex-1">{r.device}</span>
                  {isSelected ? (
                    <span className="text-[11px] text-sand">{m.inUse}</span>
                  ) : (
                    rep && (
                      <button
                        type="button"
                        onClick={() => use(r.device)}
                        className="text-[11px] text-muted hover:text-app transition-colors"
                      >
                        {m.useThis}
                      </button>
                    )
                  )}
                </div>
                {rep ? (
                  <>
                    <div className="flex flex-wrap gap-x-3 text-[11px] text-faint font-mono">
                      <span>{m.format(rep.format.channels, rep.format.sampleRate, rep.format.sampleFormat)}</span>
                      <span>
                        {m.rms} {fmtDb(toDb(level))}
                      </span>
                      {rep.snrDb !== null && <span>{m.snr(rep.snrDb.toFixed(0))}</span>}
                      {rep.streamStartMs !== null && (
                        <span>
                          {m.start} {Math.round(rep.streamStartMs)} ms
                        </span>
                      )}
                    </div>
                    <ul className="space-y-0.5">
                      {rep.verdicts
                        .filter((v) => v !== "ok" && v !== "channelsIgnored")
                        .map((v) => (
                          <li key={v} className="text-[11.5px] text-soft leading-relaxed">
                            {m.verdict[v]}
                          </li>
                        ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-[11.5px]" style={{ color: "hsl(var(--ember))" }}>
                    {m.openFailed}
                    {r.error ? ` — ${r.error}` : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ─── Performance ────────────────────────────────────────────────────── */

const STAGES = ["stop", "vad", "resample", "wait", "inference", "paste"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_COLORS: Record<Stage, string> = {
  stop: "hsl(var(--text-faint))",
  vad: "hsl(var(--moss) / 0.6)",
  resample: "hsl(var(--moss))",
  wait: "hsl(var(--ember))",
  inference: "hsl(var(--sand))",
  paste: "hsl(var(--sand) / 0.45)",
};

function stageMs(m: DictationMetrics, s: Stage): number {
  switch (s) {
    case "stop":
      return m.stopMs;
    case "vad":
      return m.vadMs;
    case "resample":
      return m.resampleMs;
    case "wait":
      return m.lockWaitMs ?? 0;
    case "inference":
      return Math.max(0, m.inferenceMs - (m.lockWaitMs ?? 0));
    case "paste":
      return m.pasteMs;
  }
}

function PerfSection({ metrics }: { metrics: DictationMetrics[] }) {
  const { t, intlLocale } = useI18n();
  const p = t.diagnostics.perf;

  const stats = useMemo(() => summarize(metrics), [metrics]);

  return (
    <section className="space-y-3">
      <SectionLabel>{p.label}</SectionLabel>

      {!stats ? (
        <div className="rounded-[10px] border border-app bg-elevated p-4 text-[12.5px] text-faint flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" />
          {p.empty}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={p.median} value={fmtMs(stats.medianTotal)} />
            <Stat label={p.p95} value={fmtMs(stats.p95Total)} />
            <Stat label={p.inference} value={fmtMs(stats.medianInference)} />
            <Stat
              label={p.rtf}
              value={stats.medianRtf > 0 ? p.rtfValue((1 / stats.medianRtf).toFixed(1)) : "—"}
            />
            <Stat label={p.success} value={`${Math.round(stats.successRate * 100)} %`} />
            <Stat label={p.count} value={String(metrics.length)} />
          </div>

          <div className="rounded-[10px] border border-app bg-elevated p-4 space-y-2.5">
            <div className="text-[11.5px] text-faint">{p.breakdown}</div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-subtle">
              {STAGES.map((s) => (
                <div
                  key={s}
                  style={{
                    width: `${(stats.avgStage[s] / stats.avgStageTotal) * 100}%`,
                    background: STAGE_COLORS[s],
                  }}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1">
              {STAGES.map((s) => (
                <div key={s} className="flex items-center gap-1.5 text-[11px]">
                  <span className="h-2 w-2 rounded-sm" style={{ background: STAGE_COLORS[s] }} />
                  <span className="text-soft">{p.stage[s]}</span>
                  <span className="text-faint font-mono ml-auto tabular-nums">
                    {fmtMs(stats.avgStage[s])}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[10px] border border-app bg-elevated overflow-hidden">
            <div className="px-4 pt-3 pb-2 text-[11.5px] text-faint">{p.recent}</div>
            <table className="w-full text-[11.5px]">
              <thead>
                <tr className="text-faint text-left">
                  <th className="font-normal px-4 py-1">{p.col.when}</th>
                  <th className="font-normal px-2 py-1 text-right">{p.col.audio}</th>
                  <th className="font-normal px-2 py-1 text-right">{p.col.whisper}</th>
                  <th className="font-normal px-2 py-1 text-right">{p.col.total}</th>
                  <th className="font-normal px-4 py-1 text-right">{p.col.outcome}</th>
                </tr>
              </thead>
              <tbody>
                {metrics.slice(0, 15).map((m) => (
                  <tr key={m.timestamp} className="border-t border-soft" title={rowTitle(m)}>
                    <td className="px-4 py-1.5 text-soft">
                      {formatRelativeTime(m.timestamp, t, intlLocale)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-faint">
                      {(m.recordedMs / 1000).toFixed(1)} s
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-faint">
                      {m.inferenceMs > 0 ? fmtMs(m.inferenceMs) : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono tabular-nums text-soft">
                      {fmtMs(m.totalMs)}
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <OutcomeTag outcome={m.outcome} t={t} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function OutcomeTag({ outcome, t }: { outcome: DictationMetrics["outcome"]; t: Dictionary }) {
  const ok = outcome === "pasted" || outcome === "clipboard";
  return (
    <span
      className="text-[11px]"
      style={{ color: ok ? "hsl(var(--moss))" : outcome === "error" ? "hsl(var(--ember))" : undefined }}
    >
      {t.diagnostics.perf.outcome[outcome] ?? outcome}
    </span>
  );
}

function rowTitle(m: DictationMetrics): string {
  return [
    m.model,
    m.device,
    `${m.channels}ch ${m.sampleRate}Hz, used ${m.usedChannels.map((c) => c + 1).join("+")}`,
    `speech ${m.speechMs}ms, sent ${m.trimmedMs}ms, audio_ctx ${m.audioCtx}`,
    `tokens ${m.nTokens}, no-speech ${m.noSpeechProb.toFixed(2)}`,
    m.repeatedWords ? `loop collapsed: ${m.repeatedWords} words` : "",
    m.streamStartMs != null ? `mic start ${Math.round(m.streamStartMs)}ms` : "",
    m.gainDb ? `gain +${m.gainDb.toFixed(1)} dB` : "",
    m.detectedLanguage ? `lang ${m.detectedLanguage}` : "",
    m.error ?? "",
  ]
    .filter(Boolean)
    .join("\n");
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-app bg-elevated px-3 py-2.5">
      <div className="text-[10.5px] text-faint">{label}</div>
      <div className="text-[15px] text-app font-semibold tabular-nums tracking-tight">{value}</div>
    </div>
  );
}

/* ─── System ─────────────────────────────────────────────────────────── */

function SystemSection({ runtime }: { runtime: RuntimeInfo | null }) {
  const { t } = useI18n();
  const s = t.diagnostics.system;
  if (!runtime) return null;

  const rows: Array<[string, string]> = [
    [s.model, runtime.model ?? s.none],
    [s.gpu, runtime.gpu ?? s.none],
    [s.backend, runtime.gpuBackend],
    [s.flashAttn, runtime.flashAttn === null ? s.none : runtime.flashAttn ? s.yes : s.no],
    [s.threads, `${runtime.whisperThreads} / ${runtime.physicalCores}c ${runtime.logicalCores}t`],
    [s.version, runtime.appVersion],
  ];

  return (
    <section className="space-y-3">
      <SectionLabel>{s.label}</SectionLabel>
      <div className="rounded-[10px] border border-app bg-elevated overflow-hidden">
        {rows.map(([k, v], i) => (
          <div
            key={k}
            className={`flex justify-between gap-3 px-3.5 py-2 text-[12.5px] ${i > 0 ? "border-t border-soft" : ""}`}
          >
            <span className="text-faint">{k}</span>
            <span className="text-soft font-mono text-[11.5px] text-right truncate">{v}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Shared bits ────────────────────────────────────────────────────── */

function ActionButton({
  children,
  onClick,
  disabled,
  subtle,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors flex-shrink-0",
        "disabled:opacity-70 disabled:cursor-default",
        subtle ? "text-muted hover:bg-hover" : "bg-sand-soft text-sand hover:opacity-90",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function toDb(x: number): number {
  return x > 0 ? 20 * Math.log10(x) : -Infinity;
}

function dbToPct(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(0, Math.min(100, ((db - DB_FLOOR) / -DB_FLOOR) * 100));
}

function fmtDb(db: number): string {
  return Number.isFinite(db) ? `${db.toFixed(0)} dB` : "−∞";
}

function fmtMs(ms: number): string {
  if (!Number.isFinite(ms)) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[i];
}

interface Summary {
  medianTotal: number;
  p95Total: number;
  medianInference: number;
  medianRtf: number;
  successRate: number;
  avgStage: Record<Stage, number>;
  avgStageTotal: number;
}

function summarize(metrics: DictationMetrics[]): Summary | null {
  if (metrics.length === 0) return null;
  // Latency stats only make sense over dictations that actually ran Whisper;
  // a "too short" bail-out at 5 ms would drag every percentile down.
  const ran = metrics.filter((m) => m.inferenceMs > 0);
  const sortedBy = (f: (m: DictationMetrics) => number) => ran.map(f).sort((a, b) => a - b);

  const avgStage = Object.fromEntries(
    STAGES.map((s) => [s, ran.length ? ran.reduce((sum, m) => sum + stageMs(m, s), 0) / ran.length : 0])
  ) as Record<Stage, number>;
  const avgStageTotal = Math.max(
    1e-6,
    STAGES.reduce((sum, s) => sum + avgStage[s], 0)
  );

  const succeeded = metrics.filter((m) => m.outcome === "pasted" || m.outcome === "clipboard").length;

  return {
    medianTotal: quantile(sortedBy((m) => m.totalMs), 0.5),
    p95Total: quantile(sortedBy((m) => m.totalMs), 0.95),
    medianInference: quantile(sortedBy((m) => m.inferenceMs), 0.5),
    medianRtf: quantile(sortedBy((m) => m.rtf), 0.5) || 0,
    successRate: succeeded / metrics.length,
    avgStage,
    avgStageTotal,
  };
}
