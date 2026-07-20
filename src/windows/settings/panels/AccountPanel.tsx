import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkle, Check } from "lucide-react";
import { api, type HistoryEntry, type ModelStatus } from "@/lib/ipc";
import { events } from "@/lib/events";
import { PanelHeader, SectionLabel } from "./common";

const INCLUDED = [
  "Dictée illimitée, sans abonnement",
  "Tous les modèles Whisper accessibles",
  "Transcription 100% locale (offline)",
  "Auto-paste là où ton curseur est",
  "Historique complet, recherche, export",
  "Accélération GPU (Vulkan) embarquée",
];

export function AccountPanel({ models }: { models: ModelStatus[] }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    api.getHistory().then(setHistory);
    const unsubs: Array<() => void> = [];
    events.onHistoryNew(() => api.getHistory().then(setHistory)).then((u) => unsubs.push(u));
    return () => unsubs.forEach((u) => u());
  }, []);

  const activeModel = useMemo(() => models.find((m) => m.loaded), [models]);
  const totalDictations = history.length;
  const totalWords = history.reduce((sum, e) => sum + e.wordCount, 0);
  const totalAudioSec = history.reduce((sum, e) => sum + e.durationMs / 1000, 0);

  return (
    <div className="space-y-12">
      <PanelHeader title="Compte" description="Ton activité et ton setup." />

      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl border border-app bg-elevated p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Sparkle className="h-3.5 w-3.5 text-sand" strokeWidth={2.4} />
          <span className="text-[11px] uppercase tracking-[0.12em] font-medium text-sand">
            Hyperwisper
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="text-[22px] font-semibold tracking-[-0.025em] text-app">
            Tout est inclus.
          </div>
          <p className="text-[13px] leading-relaxed text-soft max-w-[52ch]">
            Hyperwisper est gratuit et open-source. Aucune fonctionnalité n'est
            verrouillée, aucun abonnement.
          </p>
        </div>
        <div className="pt-2 grid grid-cols-1 gap-1.5">
          {INCLUDED.map((f) => (
            <div key={f} className="flex items-center gap-2 text-[12.5px] text-soft">
              <Check className="h-3 w-3 text-moss flex-shrink-0" strokeWidth={3} />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.06 }}
        className="space-y-3"
      >
        <SectionLabel>Activité totale</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Dictées" value={totalDictations.toString()} />
          <Stat label="Mots transcrits" value={totalWords.toLocaleString("fr-FR")} />
          <Stat label="Audio capturé" value={formatAudio(totalAudioSec)} />
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        className="space-y-3"
      >
        <SectionLabel>Setup actuel</SectionLabel>
        <div className="rounded-lg border border-app bg-elevated overflow-hidden">
          <Row label="Modèle actif" value={activeModel?.displayName ?? "Aucun"} mono />
          <Row label="Version" value="v0.1.0" mono />
        </div>
      </motion.section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app bg-elevated p-4 space-y-1">
      <div className="text-[10.5px] uppercase tracking-[0.1em] font-medium text-faint">
        {label}
      </div>
      <div className="text-[22px] font-semibold tracking-[-0.025em] tabular-nums text-app">
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="px-4 py-3 flex items-center gap-3 border-b border-soft last:border-b-0">
      <span className="text-[12.5px] text-muted flex-shrink-0 min-w-[110px]">{label}</span>
      <span
        className={`text-[13px] font-medium text-app flex-1 truncate ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function formatAudio(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}
