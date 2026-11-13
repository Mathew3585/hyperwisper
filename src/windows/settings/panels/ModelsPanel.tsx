import { motion } from "framer-motion";
import { Loader2, Download, AlertTriangle } from "lucide-react";
import { PanelHeader, StatusChip } from "./common";
import type { Model, ModelStatus } from "@/lib/ipc";
import type { DownloadProgress } from "@/lib/events";
import { useI18n, type Dictionary } from "@/i18n";

interface ModelsPanelProps {
  models: ModelStatus[];
  progress: Record<string, DownloadProgress>;
  downloading: Set<Model>;
  onDownload: (m: Model) => void;
  onLoad: (m: Model) => void;
  error?: string | null;
}

const RECOMMENDED: Model = "large-v3-turbo-q5_0";

/**
 * Rough 1–5 ratings shown as meters. Relative, not benchmarks: they only
 * have to rank the models the way the recommendation texts already do.
 */
const RATINGS: Record<Model, { accuracy: number; speed: number }> = {
  "large-v3-turbo-q5_0": { accuracy: 5, speed: 4 },
  "large-v3-turbo-q8_0": { accuracy: 5, speed: 4 },
  "large-v3-q5_0": { accuracy: 5, speed: 2 },
  "medium-q5_0": { accuracy: 4, speed: 3 },
  small: { accuracy: 3, speed: 4 },
  "small-q5_1": { accuracy: 3, speed: 4 },
  "base-q5_1": { accuracy: 2, speed: 5 },
  "tiny-q5_1": { accuracy: 1, speed: 5 },
};

export function ModelsPanel({
  models,
  progress,
  downloading,
  onDownload,
  onLoad,
  error,
}: ModelsPanelProps) {
  const { t, intlLocale } = useI18n();
  const m = t.settings.models;

  const active = models.find((x) => x.loaded) ?? null;
  const others = models.filter((x) => x !== active);
  const usedMb = models.filter((x) => x.downloaded).reduce((s, x) => s + x.sizeMb, 0);
  const totalMb = models.reduce((s, x) => s + x.sizeMb, 0) || 1;
  const activeMb = active?.sizeMb ?? 0;

  return (
    <div className="space-y-4">
      <PanelHeader
        title={m.title}
        description={m.description}
        actions={
          <div className="w-[200px] space-y-1.5">
            <div className="flex justify-between text-[11.5px]">
              <span className="text-muted">{m.storageLabel}</span>
              <span className="font-mono text-app">{formatSize(usedMb, intlLocale, t)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-subtle flex overflow-hidden" aria-hidden="true">
              <span className="bg-sand" style={{ width: `${(activeMb / totalMb) * 100}%` }} />
              <span
                style={{
                  width: `${((usedMb - activeMb) / totalMb) * 100}%`,
                  background: "hsl(var(--sand) / 0.4)",
                }}
              />
            </div>
          </div>
        }
      />

      {error && (
        <div
          className="rounded-xl border px-3.5 py-2.5 text-[12.5px] flex items-start gap-2"
          style={{
            background: "hsl(var(--ember) / 0.08)",
            borderColor: "hsl(var(--ember) / 0.25)",
            color: "hsl(var(--ember))",
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" strokeWidth={2.3} />
          {error}
        </div>
      )}

      <section className="grid grid-cols-5 gap-3.5 items-start">
        {/* ─── Active model ───────────────────────────────────── */}
        <div className="stage col-span-2 p-[22px] flex flex-col gap-[18px] min-h-[420px]">
          <div className="stage-glow -right-20 -top-20 w-[300px] h-[300px]" />
          {active ? (
            <>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <StatusChip tone="ok">{t.ui.models.active}</StatusChip>
                {active.model === RECOMMENDED && (
                  <span
                    className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold"
                    style={{ background: "hsl(var(--sand) / 0.16)", color: "hsl(var(--sand))" }}
                  >
                    ★ {t.ui.models.recommended}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <h2 className="text-[26px] leading-[1.05] font-bold tracking-[-0.04em] text-app">
                  {baseName(active.displayName)}
                </h2>
                <div className="font-mono text-[11.5px] text-muted">
                  {[quant(active.displayName), t.units.megabytes(active.sizeMb)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <p className="pt-1 text-[13px] leading-relaxed text-soft">
                  {/* The badge above already says it; drop the "★ Recommended." lead-in. */}
                  {recommendationText(active.model, t).replace(/^★\s*[^.]*\.\s*/, "")}
                </p>
              </div>
              <div className="space-y-2.5">
                <Meter label={t.ui.models.accuracy} value={RATINGS[active.model].accuracy} wide />
                <Meter label={t.ui.models.speed} value={RATINGS[active.model].speed} wide green />
              </div>
              <div className="mt-auto font-mono text-[10.5px] text-faint break-all">
                %APPDATA%\Hyperwisper\models\{active.filename}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col justify-center gap-3">
              <StatusChip tone="warn">{t.ui.models.none}</StatusChip>
              <p className="text-[13px] leading-relaxed text-soft max-w-[32ch]">
                {t.ui.models.noneHint}
              </p>
            </div>
          )}
        </div>

        {/* ─── Other models ───────────────────────────────────── */}
        <div className="card col-span-3 py-1.5">
          <div className="px-[18px] pt-2.5 pb-2 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold tracking-tight text-app">
              {t.ui.models.others}
            </h2>
            <span className="flex gap-[22px] pr-[122px] text-[11px] text-muted" aria-hidden="true">
              <span>{t.ui.models.accuracy}</span>
              <span>{t.ui.models.speed}</span>
            </span>
          </div>
          {others.map((x) => {
            const p = progress[x.filename];
            const isDownloading = downloading.has(x.model);
            return (
              <motion.div
                key={x.model}
                layout
                className="flex items-center gap-3.5 px-[18px] py-2.5 border-t border-soft"
              >
                <div className="flex-1 min-w-0 space-y-[3px]">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-semibold tracking-tight text-app">
                      {baseName(x.displayName)}
                    </span>
                    <span className="font-mono text-[11px] text-muted">
                      {[quant(x.displayName), t.units.megabytes(x.sizeMb)].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-muted truncate" title={recommendationText(x.model, t)}>
                    {recommendationText(x.model, t)}
                  </div>
                  {isDownloading && p && p.total > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 h-1 rounded-full bg-subtle overflow-hidden">
                        <motion.div
                          animate={{ width: `${p.percent}%` }}
                          transition={{ duration: 0.1, ease: "linear" }}
                          className="h-full rounded-full bg-sand"
                        />
                      </div>
                      <span className="font-mono text-[10.5px] text-muted tabular-nums">
                        {formatBytes(p.bytes, t)} / {formatBytes(p.total, t)}
                      </span>
                    </div>
                  )}
                </div>
                <span className="flex gap-3.5 flex-shrink-0" aria-hidden="true">
                  <Meter value={RATINGS[x.model].accuracy} />
                  <Meter value={RATINGS[x.model].speed} green />
                </span>
                <span className="w-[108px] flex-shrink-0 flex justify-end">
                  <Action
                    model={x}
                    t={t}
                    isDownloading={isDownloading}
                    onDownload={() => onDownload(x.model)}
                    onLoad={() => onLoad(x.model)}
                  />
                </span>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** Five segments; `wide` is the labelled version used on the stage. */
function Meter({
  label,
  value,
  wide,
  green,
}: {
  label?: string;
  value: number;
  wide?: boolean;
  green?: boolean;
}) {
  const on = green ? "hsl(var(--moss))" : "hsl(var(--sand))";
  const segs = Array.from({ length: 5 }, (_, i) => i < value);
  if (wide) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-[12px] text-soft w-[74px] flex-shrink-0">{label}</span>
        <span className="flex-1 grid grid-cols-5 gap-[3px]" role="img" aria-label={`${label} ${value}/5`}>
          {segs.map((v, i) => (
            <span
              key={i}
              className="h-1.5 rounded-sm"
              style={{ background: v ? on : "rgba(255,255,255,0.10)" }}
            />
          ))}
        </span>
      </div>
    );
  }
  return (
    <span className="flex gap-0.5">
      {segs.map((v, i) => (
        <span
          key={i}
          className="w-1.5 h-3 rounded-sm"
          style={{ background: v ? on : "hsl(var(--border-soft))" }}
        />
      ))}
    </span>
  );
}

function Action({
  model,
  t,
  isDownloading,
  onDownload,
  onLoad,
}: {
  model: ModelStatus;
  t: Dictionary;
  isDownloading: boolean;
  onDownload: () => void;
  onLoad: () => void;
}) {
  if (model.downloaded) {
    return (
      <button
        type="button"
        onClick={onLoad}
        className="h-[30px] px-3.5 rounded-lg text-[12px] font-medium transition-opacity hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sand))]"
        style={{ background: "hsl(var(--text))", color: "hsl(var(--bg))" }}
      >
        {t.settings.models.action.load}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onDownload}
      disabled={isDownloading}
      className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-lg border border-app bg-elevated text-[12px] font-medium text-app hover:bg-hover transition-colors disabled:opacity-70 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sand))]"
    >
      {isDownloading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Download className="h-3 w-3" strokeWidth={2.2} />
      )}
      {isDownloading ? t.settings.models.action.downloading : t.settings.models.action.download}
    </button>
  );
}

function baseName(displayName: string): string {
  return displayName.replace(/\s*\([^)]*\)/, "");
}

function quant(displayName: string): string {
  return displayName.match(/\(([^)]+)\)/)?.[1] ?? "";
}

function formatSize(mb: number, locale: string, t: Dictionary): string {
  if (mb >= 1000) {
    return `${(mb / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })} GB`;
  }
  return t.units.megabytes(mb);
}

function recommendationText(model: Model, t: Dictionary): string {
  const reco = t.settings.models.reco;
  switch (model) {
    case "tiny-q5_1":
      return reco.tinyQ5_1;
    case "base-q5_1":
      return reco.baseQ5_1;
    case "small-q5_1":
      return reco.smallQ5_1;
    case "small":
      return reco.small;
    case "medium-q5_0":
      return reco.mediumQ5_0;
    case "large-v3-turbo-q5_0":
      return reco.largeV3TurboQ5_0;
    case "large-v3-turbo-q8_0":
      return reco.largeV3TurboQ8_0;
    case "large-v3-q5_0":
      return reco.largeV3Q5_0;
  }
}

function formatBytes(n: number, t: Dictionary): string {
  if (n < 1024) return t.units.bytes(n);
  if (n < 1024 * 1024) return t.units.kilobytes((n / 1024).toFixed(1));
  return t.units.megabytes((n / (1024 * 1024)).toFixed(1));
}
