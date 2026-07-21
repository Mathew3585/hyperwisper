import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sparkle, Check } from "lucide-react";
import { api, type HistoryEntry, type ModelStatus } from "@/lib/ipc";
import { events } from "@/lib/events";
import { useI18n, useT, type Dictionary } from "@/i18n";
import { PanelHeader, SectionLabel } from "./common";

export function AccountPanel({ models }: { models: ModelStatus[] }) {
  const t = useT();
  const { intlLocale } = useI18n();
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
      <PanelHeader
        title={t.settings.account.title}
        description={t.settings.account.description}
      />

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
            {t.settings.account.heroTitle}
          </div>
          <p className="text-[13px] leading-relaxed text-soft max-w-[52ch]">
            {t.settings.account.heroBody}
          </p>
        </div>
        <div className="pt-2 grid grid-cols-1 gap-1.5">
          {t.settings.account.included.map((f) => (
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
        <SectionLabel>{t.settings.account.totalsLabel}</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label={t.settings.account.stat.dictations}
            value={totalDictations.toLocaleString(intlLocale)}
          />
          <Stat
            label={t.settings.account.stat.words}
            value={totalWords.toLocaleString(intlLocale)}
          />
          <Stat
            label={t.settings.account.stat.audio}
            value={formatAudio(totalAudioSec, t)}
          />
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        className="space-y-3"
      >
        <SectionLabel>{t.settings.account.setupLabel}</SectionLabel>
        <div className="rounded-lg border border-app bg-elevated overflow-hidden">
          <Row
            label={t.settings.account.rowActiveModel}
            value={activeModel?.displayName ?? t.common.none}
            mono
          />
          <Row label={t.settings.account.rowVersion} value="v0.1.0" mono />
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

function formatAudio(seconds: number, t: Dictionary): string {
  if (seconds < 60) return t.units.seconds(Math.round(seconds));
  if (seconds < 3600) return t.units.minutesLong(Math.floor(seconds / 60));
  return t.units.hoursLong(Number((seconds / 3600).toFixed(1)));
}
