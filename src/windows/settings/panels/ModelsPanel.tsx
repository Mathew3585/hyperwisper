import { motion } from "framer-motion";
import { Loader2, Download, Check } from "lucide-react";
import { PanelHeader } from "./common";
import type { Model, ModelStatus } from "@/lib/ipc";
import type { DownloadProgress } from "@/lib/events";

interface ModelsPanelProps {
  models: ModelStatus[];
  progress: Record<string, DownloadProgress>;
  downloading: Set<Model>;
  onDownload: (m: Model) => void;
  onLoad: (m: Model) => void;
  error?: string | null;
}

export function ModelsPanel({
  models,
  progress,
  downloading,
  onDownload,
  onLoad,
  error,
}: ModelsPanelProps) {
  return (
    <div className="space-y-8">
      <PanelHeader
        title="Modèles"
        description="Choisis un modèle Whisper. Tout reste sur ton PC — aucun audio ne quitte la machine."
      />

      {error && (
        <div
          className="rounded-md border px-3 py-2 text-[12.5px]"
          style={{
            background: "hsl(var(--ember) / 0.08)",
            borderColor: "hsl(var(--ember) / 0.25)",
            color: "hsl(var(--ember))",
          }}
        >
          {error}
        </div>
      )}

      <div className="-mx-2">
        {models.map((m, idx) => {
          const p = progress[m.filename];
          const isDownloading = downloading.has(m.model);
          return (
            <motion.div
              key={m.model}
              layout
              className={`px-2 py-3 flex items-center gap-4 transition-colors ${
                idx > 0 ? "border-t border-soft" : ""
              }`}
            >
              <Indicator downloaded={m.downloaded} loaded={m.loaded} />

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13.5px] font-medium tracking-tight text-app">
                    {m.displayName.replace(/\s*\([^)]*\)/, "")}
                  </span>
                  <span className="text-[11px] font-mono text-faint">
                    {m.displayName.match(/\(([^)]+)\)/)?.[1] ?? ""}
                  </span>
                </div>
                <div className="text-[11.5px] text-muted mt-0.5 tabular-nums">
                  {m.sizeMb} MB · {recommendationText(m.model)}
                </div>
                {isDownloading && p && p.total > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="h-[3px] rounded-full bg-subtle overflow-hidden">
                      <motion.div
                        animate={{ width: `${p.percent}%` }}
                        transition={{ duration: 0.1, ease: "linear" }}
                        className="h-full rounded-full bg-sand"
                      />
                    </div>
                    <div className="text-[10.5px] font-mono text-faint tabular-nums">
                      {formatBytes(p.bytes)} / {formatBytes(p.total)} ·{" "}
                      {p.percent.toFixed(0)}%
                    </div>
                  </div>
                )}
              </div>

              <Action
                model={m}
                isDownloading={isDownloading}
                onDownload={() => onDownload(m.model)}
                onLoad={() => onLoad(m.model)}
              />
            </motion.div>
          );
        })}
      </div>

      <div className="text-[11.5px] text-faint leading-relaxed font-mono">
        Stockage · %APPDATA%\Hyperwisper\models\
      </div>
    </div>
  );
}

function Indicator({
  downloaded,
  loaded,
}: {
  downloaded: boolean;
  loaded: boolean;
}) {
  return (
    <div className="h-7 w-7 rounded-md flex-shrink-0 flex items-center justify-center border border-app bg-elevated">
      <div
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: loaded
            ? "hsl(var(--sand))"
            : downloaded
            ? "hsl(var(--text-faint))"
            : "hsl(var(--border))",
        }}
      />
    </div>
  );
}

function Action({
  model,
  isDownloading,
  onDownload,
  onLoad,
}: {
  model: ModelStatus;
  isDownloading: boolean;
  onDownload: () => void;
  onLoad: () => void;
}) {
  if (model.loaded) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] font-medium tracking-tight text-moss">
        <Check className="h-3 w-3" strokeWidth={3} /> Actif
      </span>
    );
  }
  if (model.downloaded) {
    return (
      <button
        onClick={onLoad}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md border border-app bg-elevated hover:bg-hover transition-colors text-soft"
      >
        Charger
      </button>
    );
  }
  return (
    <button
      onClick={onDownload}
      disabled={isDownloading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-all duration-150 disabled:opacity-50 active:scale-[0.97]"
      style={{
        background: "hsl(var(--sand-soft))",
        color: "hsl(var(--sand))",
        border: "1px solid hsl(var(--sand) / 0.22)",
      }}
    >
      {isDownloading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Download className="h-3 w-3" />
      )}
      {isDownloading ? "Téléchargement" : "Télécharger"}
    </button>
  );
}

function recommendationText(model: Model): string {
  switch (model) {
    case "tiny-q5_1":
      return "Test rapide, qualité approximative. À éviter pour le français quotidien.";
    case "base-q5_1":
      return "Léger pour PC modeste. Acceptable pour de courtes phrases simples.";
    case "small-q5_1":
      return "★ Recommandé. Le meilleur compromis qualité/vitesse en français.";
    case "small":
      return "Version non quantisée du Small. Marginalement plus précis, 2,5× plus lourd.";
    case "medium-q5_0":
      return "Pour les longues dictées techniques. Demande un CPU costaud.";
    case "large-v3-q5_0":
      return "Précision maximale. Lent même avec GPU, overkill pour la dictée.";
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
