import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Mic,
  Check,
  Loader2,
  Download,
  Volume2,
  Sparkles,
  Power,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { api, type AppSettings, type Model, type ModelStatus } from "@/lib/ipc";
import { events, type DownloadProgress } from "@/lib/events";
import { HotkeyEditor } from "../panels/ShortcutsPanel";
import { Kbd } from "../panels/common";

type StepId = "welcome" | "mic" | "model" | "hotkey" | "launch" | "done";

const STEPS: StepId[] = ["welcome", "mic", "model", "hotkey", "launch", "done"];
const RECOMMENDED_MODEL: Model = "small-q5_1";
// We match the model by filename rather than enum string because the
// `kebab-case` serde transform on the Rust side is not perfectly predictable
// (e.g. `SmallQ5_1` can render as `small-q5-1` instead of `small-q5_1`).
// The filename is hardcoded in Rust, so it never drifts.
const RECOMMENDED_FILENAME = "ggml-small-q5_1.bin";

interface Props {
  settings: AppSettings;
  onComplete: () => void;
}

export function OnboardingWizard({ settings: initialSettings, onComplete }: Props) {
  const [step, setStep] = useState<StepId>("welcome");
  const [settings, setSettings] = useState<AppSettings>(initialSettings);

  const stepIdx = STEPS.indexOf(step);

  async function saveSettings(next: AppSettings) {
    setSettings(next);
    await api.updateSettings(next);
  }

  function goNext() {
    const next = STEPS[stepIdx + 1];
    if (next) setStep(next);
  }

  function goBack() {
    const prev = STEPS[stepIdx - 1];
    if (prev) setStep(prev);
  }

  async function finish() {
    await api.markOnboardingCompleted();
    onComplete();
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Progress current={stepIdx} total={STEPS.length} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[520px] mx-auto px-10 py-10 min-h-full flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex-1 flex flex-col"
            >
              {step === "welcome" && <WelcomeStep onNext={goNext} />}
              {step === "mic" && (
                <MicStep
                  settings={settings}
                  onChange={saveSettings}
                  onNext={goNext}
                  onBack={goBack}
                />
              )}
              {step === "model" && (
                <ModelStep onNext={goNext} onBack={goBack} />
              )}
              {step === "hotkey" && (
                <HotkeyStep
                  settings={settings}
                  onChange={saveSettings}
                  onNext={goNext}
                  onBack={goBack}
                />
              )}
              {step === "launch" && (
                <LaunchStep
                  settings={settings}
                  onChange={saveSettings}
                  onNext={goNext}
                  onBack={goBack}
                />
              )}
              {step === "done" && (
                <DoneStep hotkey={settings.hotkey} onFinish={finish} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Progress dots ─────────────────────────────────────── */

function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex-shrink-0 pt-4 pb-2 flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-1 rounded-full transition-all duration-300"
          style={{
            width: i === current ? 24 : 6,
            background:
              i <= current ? "hsl(var(--sand))" : "hsl(var(--border))",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Step 1: Welcome ───────────────────────────────────── */

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col justify-center space-y-10">
        <Logo size={72} className="text-sand" />
        <div className="space-y-3">
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-app">
            Bienvenue dans Hyperwisper.
          </h1>
          <p className="text-[15px] leading-relaxed text-soft max-w-[44ch]">
            La dictée vocale instantanée pour Windows. Tu parles, le texte se
            colle là où ton curseur est. Tout reste sur ton PC.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-[12.5px] text-soft">
          <Bullet>100% local — aucun audio ne quitte ta machine</Bullet>
          <Bullet>Gratuit pour toujours, open-source</Bullet>
          <Bullet>Trois minutes pour configurer, c'est parti</Bullet>
        </div>
      </div>
      <NavRow>
        <span />
        <PrimaryButton onClick={onNext}>
          Commencer
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
        </PrimaryButton>
      </NavRow>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <Check className="h-3 w-3 text-moss flex-shrink-0" strokeWidth={3} />
      <span>{children}</span>
    </div>
  );
}

/* ─── Step 2: Mic ───────────────────────────────────────── */

function MicStep({
  settings,
  onChange,
  onNext,
  onBack,
}: {
  settings: AppSettings;
  onChange: (s: AppSettings) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [devices, setDevices] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);
  const [level, setLevel] = useState(0);
  const peakRef = useRef(0);

  useEffect(() => {
    api.listInputDevices().then(setDevices);
  }, []);

  useEffect(() => {
    if (!testing) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    events
      .onRecordingLevel((rms) => {
        const v = Math.min(1, Math.sqrt(rms) * 4.2);
        peakRef.current = Math.max(peakRef.current, v);
        setLevel(v);
      })
      .then((u) => {
        if (cancelled) u();
        else unlisten = u;
      });
    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
  }, [testing]);

  async function runTest() {
    if (testing) return;
    peakRef.current = 0;
    setTesting(true);
    setTested(false);
    try {
      await api.testMicrophone(3000);
    } catch (err) {
      console.error("test_microphone failed:", err);
    } finally {
      setTesting(false);
      setTested(peakRef.current > 0.05);
      setLevel(0);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 space-y-10">
        <StepHeader
          icon={<Mic className="h-3.5 w-3.5" strokeWidth={2.4} />}
          title="Ton microphone"
          description="Choisis le micro qu'Hyperwisper doit écouter, puis fais un test rapide."
        />

        <div className="space-y-3">
          <Label>Microphone</Label>
          <div className="rounded-lg border border-app bg-elevated overflow-hidden">
            <MicRow
              label="Périphérique système par défaut"
              sublabel="Suit ton choix Windows"
              isActive={settings.microphoneName === null}
              onClick={() => onChange({ ...settings, microphoneName: null })}
            />
            {devices.map((d) => (
              <MicRow
                key={d}
                label={d}
                isActive={settings.microphoneName === d}
                onClick={() => onChange({ ...settings, microphoneName: d })}
              />
            ))}
            {devices.length === 0 && (
              <div className="px-4 py-3 text-[12.5px] text-muted border-t border-soft">
                Aucun autre micro détecté.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <Label>Test (3 secondes)</Label>
          <div className="rounded-lg border border-app bg-elevated p-4 space-y-3">
            <div className="flex items-center gap-3">
              <button
                onClick={runTest}
                disabled={testing}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
                style={{
                  background: "hsl(var(--sand-soft))",
                  color: "hsl(var(--sand))",
                  border: "1px solid hsl(var(--sand) / 0.22)",
                }}
              >
                {testing ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Écoute…
                  </>
                ) : (
                  <>
                    <Volume2 className="h-3 w-3" strokeWidth={2.4} />
                    {tested ? "Refaire" : "Tester"}
                  </>
                )}
              </button>
              {tested && (
                <span className="inline-flex items-center gap-1.5 text-[12px] text-moss">
                  <Check className="h-3 w-3" strokeWidth={3} />
                  Son détecté
                </span>
              )}
            </div>
            <LevelBar level={level} active={testing} />
            <p className="text-[11.5px] text-faint leading-relaxed">
              Parle normalement pendant 3 secondes. La barre devrait s'animer.
              Si elle reste plate, change de micro au-dessus.
            </p>
          </div>
        </div>
      </div>

      <NavRow>
        <BackButton onClick={onBack} />
        <PrimaryButton
          onClick={onNext}
          disabled={!tested}
          hint={!tested ? "Fais un test avant de continuer" : undefined}
        >
          Suivant
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
        </PrimaryButton>
      </NavRow>
    </div>
  );
}

function MicRow({
  label,
  sublabel,
  isActive,
  onClick,
}: {
  label: string;
  sublabel?: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={isActive}
      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-hover border-t border-soft first:border-t-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
    >
      <Mic
        className="h-3.5 w-3.5 flex-shrink-0"
        style={{
          color: isActive ? "hsl(var(--sand))" : "hsl(var(--text-faint))",
        }}
        strokeWidth={2.2}
      />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] truncate font-mono text-app">{label}</div>
        {sublabel && (
          <div className="text-[11px] text-muted mt-0.5">{sublabel}</div>
        )}
      </div>
      {isActive && <Check className="h-3.5 w-3.5 text-moss" strokeWidth={2.8} />}
    </button>
  );
}

function LevelBar({ level, active }: { level: number; active: boolean }) {
  return (
    <div className="h-2 rounded-full bg-subtle overflow-hidden">
      <motion.div
        animate={{ width: `${Math.max(2, level * 100)}%` }}
        transition={{ duration: 0.05, ease: "linear" }}
        className="h-full rounded-full"
        style={{
          background: active ? "hsl(var(--sand))" : "hsl(var(--border))",
        }}
      />
    </div>
  );
}

/* ─── Step 3: Model ─────────────────────────────────────── */

function ModelStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [model, setModel] = useState<ModelStatus | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refresh();
    const unsubs: Array<() => void> = [];
    events
      .onModelProgress((p) => {
        if (p.model === RECOMMENDED_FILENAME) setProgress(p);
      })
      .then((u) => unsubs.push(u));
    events.onModelLoaded(() => refresh()).then((u) => unsubs.push(u));
    return () => unsubs.forEach((u) => u());
  }, []);

  async function refresh() {
    setListLoading(true);
    setError(null);
    try {
      const list = await api.listModels();
      // eslint-disable-next-line no-console
      console.log("[onboarding] listModels:", list);
      const target = list.find((m) => m.filename === RECOMMENDED_FILENAME);
      if (target) {
        setModel(target);
      } else {
        setError(
          `Modèle introuvable dans la liste (${list.length} entrées). Tu peux passer cette étape et le télécharger depuis l'onglet Modèles.`,
        );
      }
    } catch (err) {
      console.error("listModels failed:", err);
      setError(`Impossible de récupérer la liste des modèles : ${err}`);
    } finally {
      setListLoading(false);
    }
  }

  // Use the model's enum string when available (correct case from Rust);
  // fall back to the TS-typed RECOMMENDED_MODEL constant for the very first
  // call where we don't have the runtime value yet.
  function modelId(): Model {
    return (model?.model ?? RECOMMENDED_MODEL) as Model;
  }

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    setError(null);
    try {
      await api.downloadModel(modelId());
      await api.loadModel(modelId());
      await refresh();
    } catch (err) {
      console.error("download failed:", err);
      setError(String(err));
    } finally {
      setDownloading(false);
      setProgress(null);
    }
  }

  async function handleLoad() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await api.loadModel(modelId());
      await refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const ready = model?.loaded ?? false;

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 space-y-10">
        <StepHeader
          icon={<Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} />}
          title="Le modèle de transcription"
          description="Whisper Small offre le meilleur compromis qualité / vitesse en français. Tu peux en essayer d'autres plus tard dans Modèles."
        />

        <div className="rounded-xl border border-app bg-elevated p-5 space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <span className="text-[15px] font-semibold tracking-tight text-app">
                  Small
                </span>
                <span className="text-[11px] font-mono text-faint">Q5_1</span>
              </div>
              <div className="text-[12px] text-muted tabular-nums">
                {model
                  ? `${model.sizeMb} MB · environ 1 minute à télécharger`
                  : listLoading
                  ? "Chargement…"
                  : "Indisponible"}
              </div>
            </div>
            <StateBadge model={model} loading={loading || downloading} />
          </div>

          {progress && progress.total > 0 && (
            <div className="space-y-1.5">
              <div className="h-[3px] rounded-full bg-subtle overflow-hidden">
                <motion.div
                  animate={{ width: `${progress.percent}%` }}
                  transition={{ duration: 0.1, ease: "linear" }}
                  className="h-full rounded-full bg-sand"
                />
              </div>
              <div className="text-[10.5px] font-mono text-faint tabular-nums">
                {(progress.bytes / (1024 * 1024)).toFixed(1)} /{" "}
                {(progress.total / (1024 * 1024)).toFixed(1)} MB ·{" "}
                {progress.percent.toFixed(0)}%
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            {model && !model.downloaded && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
                style={{
                  background: "hsl(var(--sand))",
                  color: "hsl(var(--accent-fg))",
                }}
              >
                {downloading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" strokeWidth={2.4} />
                )}
                {downloading ? "Téléchargement" : "Télécharger"}
              </button>
            )}
            {model && model.downloaded && !model.loaded && (
              <button
                onClick={handleLoad}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium border border-app bg-elevated hover:bg-hover transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
              >
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Charger
              </button>
            )}
            {model && model.loaded && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-moss">
                <Check className="h-3 w-3" strokeWidth={3} />
                Prêt à dicter
              </span>
            )}
            {!model && !listLoading && (
              <button
                onClick={refresh}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium border border-app bg-elevated hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
              >
                Réessayer
              </button>
            )}
          </div>

          {error && (
            <div
              className="rounded-md border px-3 py-2 text-[11.5px]"
              style={{
                background: "hsl(var(--ember) / 0.08)",
                borderColor: "hsl(var(--ember) / 0.3)",
                color: "hsl(var(--ember))",
              }}
            >
              {error}
            </div>
          )}
        </div>

        <p className="text-[11.5px] text-faint leading-relaxed">
          Le fichier est stocké dans{" "}
          <span className="font-mono">%APPDATA%\Hyperwisper\models\</span>. Tu
          peux le supprimer à tout moment depuis l'onglet Modèles.
        </p>
      </div>

      <NavRow>
        <BackButton onClick={onBack} />
        <div className="flex items-center gap-4">
          {!ready && (
            <button
              onClick={onNext}
              className="text-[12px] text-muted hover:text-app transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))] rounded px-1"
            >
              Je télécharge plus tard
            </button>
          )}
          <PrimaryButton
            onClick={onNext}
            disabled={!ready}
            hint={!ready ? "Modèle non chargé" : undefined}
          >
            Suivant
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
          </PrimaryButton>
        </div>
      </NavRow>
    </div>
  );
}

function StateBadge({
  model,
  loading,
}: {
  model: ModelStatus | null;
  loading: boolean;
}) {
  if (!model) return null;
  if (loading) {
    return (
      <span className="text-[10.5px] uppercase tracking-[0.1em] font-medium text-faint">
        …
      </span>
    );
  }
  if (model.loaded) {
    return (
      <span className="inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[0.1em] font-medium text-moss">
        <Check className="h-3 w-3" strokeWidth={3} /> Actif
      </span>
    );
  }
  if (model.downloaded) {
    return (
      <span className="text-[10.5px] uppercase tracking-[0.1em] font-medium text-faint">
        Téléchargé
      </span>
    );
  }
  return (
    <span className="text-[10.5px] uppercase tracking-[0.1em] font-medium text-faint">
      À télécharger
    </span>
  );
}

/* ─── Step 4: Hotkey ────────────────────────────────────── */

function HotkeyStep({
  settings,
  onChange,
  onNext,
  onBack,
}: {
  settings: AppSettings;
  onChange: (s: AppSettings) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function saveHotkey(combo: string) {
    setError(null);
    try {
      await onChange({ ...settings, hotkey: combo });
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 space-y-10">
        <StepHeader
          icon={<Kbd>⌨</Kbd>}
          title="Comment déclencher la dictée ?"
          description="Choisis ton raccourci global et le mode d'enregistrement. Tu pourras tout changer plus tard depuis Settings."
        />

        <div className="space-y-3">
          <Label>Raccourci</Label>
          <HotkeyEditor current={settings.hotkey} onSave={saveHotkey} />
          {error && (
            <div
              className="rounded-md border px-3 py-2 text-[11.5px]"
              style={{
                background: "hsl(var(--ember) / 0.08)",
                borderColor: "hsl(var(--ember) / 0.3)",
                color: "hsl(var(--ember))",
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Label>Mode</Label>
          <div className="grid grid-cols-2 gap-2">
            <ModeCard
              label="Toggle"
              description="Une pression pour démarrer, une autre pour arrêter."
              active={settings.mode === "toggle"}
              onClick={() => onChange({ ...settings, mode: "toggle" })}
            />
            <ModeCard
              label="Push-to-talk"
              description="Maintiens la touche tant que tu parles."
              active={settings.mode === "pushtotalk"}
              onClick={() => onChange({ ...settings, mode: "pushtotalk" })}
            />
          </div>
        </div>
      </div>

      <NavRow>
        <BackButton onClick={onBack} />
        <PrimaryButton onClick={onNext}>
          Suivant
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
        </PrimaryButton>
      </NavRow>
    </div>
  );
}

function ModeCard({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="rounded-lg border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
      style={{
        background: active ? "hsl(var(--sand-soft))" : "hsl(var(--bg-elevated))",
        borderColor: active ? "hsl(var(--sand) / 0.4)" : "hsl(var(--border))",
      }}
    >
      <div
        className="text-[13px] font-medium tracking-tight"
        style={{ color: active ? "hsl(var(--sand))" : "hsl(var(--text))" }}
      >
        {label}
      </div>
      <div className="text-[11.5px] text-muted mt-1 leading-relaxed">
        {description}
      </div>
    </motion.button>
  );
}

/* ─── Step 5: Launch at startup ─────────────────────────── */

function LaunchStep({
  settings,
  onChange,
  onNext,
  onBack,
}: {
  settings: AppSettings;
  onChange: (s: AppSettings) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 space-y-10">
        <StepHeader
          icon={<Power className="h-3.5 w-3.5" strokeWidth={2.4} />}
          title="Lancer au démarrage ?"
          description="Hyperwisper vit dans la barre des tâches. Si tu le lances au démarrage de Windows, ton raccourci est prêt dès que tu ouvres ta session — sans rien à faire."
        />

        <div className="grid grid-cols-2 gap-2">
          <LaunchCard
            label="Au démarrage"
            description="Hyperwisper se lance automatiquement avec Windows. Recommandé."
            active={settings.autoLaunch}
            onClick={() => onChange({ ...settings, autoLaunch: true })}
          />
          <LaunchCard
            label="Manuel"
            description="Tu lances Hyperwisper toi-même quand tu en as besoin."
            active={!settings.autoLaunch}
            onClick={() => onChange({ ...settings, autoLaunch: false })}
          />
        </div>

        <p className="text-[11.5px] text-faint leading-relaxed">
          Hyperwisper démarre discrètement en arrière-plan : pas de fenêtre,
          seulement l'icône dans la barre des tâches. Tu peux changer d'avis à
          tout moment depuis l'onglet Audio.
        </p>
      </div>

      <NavRow>
        <BackButton onClick={onBack} />
        <PrimaryButton onClick={onNext}>
          Suivant
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
        </PrimaryButton>
      </NavRow>
    </div>
  );
}

function LaunchCard({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      aria-pressed={active}
      className="rounded-lg border p-3.5 text-left transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
      style={{
        background: active ? "hsl(var(--sand-soft))" : "hsl(var(--bg-elevated))",
        borderColor: active ? "hsl(var(--sand) / 0.4)" : "hsl(var(--border))",
      }}
    >
      <div
        className="text-[13px] font-medium tracking-tight"
        style={{ color: active ? "hsl(var(--sand))" : "hsl(var(--text))" }}
      >
        {label}
      </div>
      <div className="text-[11.5px] text-muted mt-1 leading-relaxed">
        {description}
      </div>
    </motion.button>
  );
}

/* ─── Step 6: Done ──────────────────────────────────────── */

function DoneStep({
  hotkey,
  onFinish,
}: {
  hotkey: string;
  onFinish: () => void;
}) {
  const parts = useMemo(() => hotkey.split("+").map((p) => p.trim()), [hotkey]);

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col justify-center space-y-10">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.05 }}
          className="flex items-center justify-center h-14 w-14 rounded-full"
          style={{ background: "hsla(88, 38%, 60%, 0.15)" }}
        >
          <Check className="h-7 w-7 text-moss" strokeWidth={2.4} />
        </motion.div>

        <div className="space-y-3">
          <h1 className="text-[36px] leading-[1.05] font-semibold tracking-[-0.035em] text-app">
            Tu es prêt.
          </h1>
          <p className="text-[15px] leading-relaxed text-soft max-w-[44ch]">
            Hyperwisper écoute en arrière-plan. Maintiens ton raccourci dans
            n'importe quelle app pour dicter.
          </p>
        </div>

        <div className="rounded-lg border border-app bg-elevated p-5 space-y-3">
          <div className="text-[11px] uppercase tracking-[0.12em] font-medium text-faint">
            Essaie maintenant
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {parts.map((p, i, arr) => (
              <span key={`${p}-${i}`} className="flex items-center gap-1.5">
                <Kbd>{p}</Kbd>
                {i < arr.length - 1 && (
                  <span className="text-faint text-[11px]">+</span>
                )}
              </span>
            ))}
            <span className="ml-2 text-[12.5px] text-soft">
              n'importe où dans Windows.
            </span>
          </div>
        </div>

        <p className="text-[11.5px] text-faint leading-relaxed max-w-[44ch]">
          Hyperwisper se loge dans la barre de tâches. Clic sur l'icône pour
          rouvrir les paramètres à tout moment.
        </p>
      </div>

      <NavRow>
        <span />
        <PrimaryButton onClick={onFinish}>
          Terminer
          <Check className="h-3.5 w-3.5" strokeWidth={2.8} />
        </PrimaryButton>
      </NavRow>
    </div>
  );
}

/* ─── Shared primitives ─────────────────────────────────── */

function StepHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sand">
        {icon}
        <span className="text-[11px] uppercase tracking-[0.12em] font-medium">
          Étape
        </span>
      </div>
      <h2 className="text-[26px] leading-[1.1] font-semibold tracking-[-0.025em] text-app">
        {title}
      </h2>
      <p className="text-[13.5px] leading-relaxed text-soft max-w-[48ch]">
        {description}
      </p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] uppercase tracking-[0.1em] font-medium text-faint">
      {children}
    </div>
  );
}

function NavRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-shrink-0 pt-8 mt-auto flex items-center justify-between">
      {children}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] text-muted hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
    >
      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
      Retour
    </button>
  );
}

function PrimaryButton({
  onClick,
  children,
  disabled,
  hint,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {hint && (
        <span className="text-[11px] text-faint">{hint}</span>
      )}
      <button
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
        style={{
          background: "hsl(var(--sand))",
          color: "hsl(var(--accent-fg))",
        }}
      >
        {children}
      </button>
    </div>
  );
}
