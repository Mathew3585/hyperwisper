import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, AlertTriangle, X, ChevronRight, Mic, FileText, Clock } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Logo } from "@/components/Logo";
import { api, type HistoryEntry } from "@/lib/ipc";
import { events } from "@/lib/events";
import { SectionLabel, Kbd } from "./common";

type StatusLevel = "ok" | "warn" | "error";

interface StatusItem {
  level: StatusLevel;
  label: string;
  value: string;
  linkTo?: string;
}

interface SystemStatus {
  whisper: StatusItem;
  microphone: StatusItem;
  hotkey: StatusItem;
  acceleration: StatusItem;
  privacy: StatusItem;
}

interface GeneralPanelProps {
  modelLoaded: boolean;
  onNavigate: (panelId: string) => void;
}

export function GeneralPanel({ modelLoaded, onNavigate }: GeneralPanelProps) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    refresh();
    api.getHistory().then(setHistory);

    const unsubs: Array<() => void> = [];
    events.onHistoryNew(() => api.getHistory().then(setHistory)).then((u) => unsubs.push(u));
    // The model load happens asynchronously after app start — refresh the
    // status panel as soon as Rust signals the model is ready so the GPU
    // acceleration line flips from "loading" to "GPU actif" without a manual
    // tab swap.
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

  const items = status
    ? [status.whisper, status.microphone, status.hotkey, status.acceleration, status.privacy]
    : [];

  const worst = worstLevel(items);
  const hero = heroPhrase(worst, status);

  // Stats this session — last 24h
  const last24h = Date.now() - 86_400_000;
  const recent = history.filter((h) => h.timestamp > last24h);
  const dictationsToday = recent.length;
  const wordsToday = recent.reduce((s, e) => s + e.wordCount, 0);
  const audioToday = recent.reduce((s, e) => s + e.durationMs, 0) / 1000;

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
          <span>Maintiens</span>
          <Kbd>Ctrl</Kbd>
          <span className="text-faint">+</span>
          <Kbd>Space</Kbd>
          <span>n'importe où dans Windows</span>
        </div>
      </motion.section>

      {/* ─── Stats 24h ─────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="space-y-3"
      >
        <SectionLabel>Aujourd'hui</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            icon={<Mic className="h-3 w-3" strokeWidth={2.4} />}
            label="Dictées"
            value={dictationsToday.toString()}
          />
          <StatCard
            icon={<FileText className="h-3 w-3" strokeWidth={2.4} />}
            label="Mots"
            value={wordsToday.toLocaleString("fr-FR")}
          />
          <StatCard
            icon={<Clock className="h-3 w-3" strokeWidth={2.4} />}
            label="Audio"
            value={formatAudio(audioToday)}
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
        <SectionLabel>Système</SectionLabel>

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
            <SectionLabel>Dernières dictées</SectionLabel>
            <button
              onClick={() => onNavigate("history")}
              className="text-[11.5px] text-muted hover:text-app transition-colors inline-flex items-center gap-1"
            >
              Voir tout
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
                  {formatRelativeTime(entry.timestamp)} · {entry.wordCount} mots
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

function StatusRow({ item, onClick }: { item: StatusItem; onClick?: () => void }) {
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

function worstLevel(items: StatusItem[]): StatusLevel {
  if (items.some((i) => i.level === "error")) return "error";
  if (items.some((i) => i.level === "warn")) return "warn";
  return "ok";
}

function heroPhrase(
  worst: StatusLevel,
  status: SystemStatus | null
): { title: string; subtitle: string } {
  if (!status) {
    return {
      title: "Initialisation…",
      subtitle: "Vérification du système en cours.",
    };
  }
  if (worst === "error") {
    if (status.whisper.level === "error") {
      return {
        title: "Un modèle à télécharger.",
        subtitle:
          "Aucun modèle Whisper n'est encore chargé. Va dans Modèles pour en récupérer un.",
      };
    }
    if (status.microphone.level === "error") {
      return {
        title: "Microphone introuvable.",
        subtitle:
          "Aucun périphérique d'entrée audio n'est détecté. Branche un micro ou vérifie tes paramètres Windows.",
      };
    }
    return {
      title: "Setup à finaliser.",
      subtitle: "Quelques vérifications à régler avant de pouvoir dicter.",
    };
  }
  return {
    title: "Tout est prêt.",
    subtitle:
      "Hyperwisper écoute en arrière-plan. Le texte est collé là où ton curseur se trouve, immédiatement.",
  };
}

function formatAudio(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "à l'instant";
  if (diff < 3_600_000) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `il y a ${Math.floor(diff / 3_600_000)}h`;
  return new Date(timestamp).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
