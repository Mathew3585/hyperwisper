import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Trash2,
  AlertTriangle,
  Minus,
  X,
  HeartHandshake,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/ipc";

type Step = "confirm" | "removing" | "done" | "error";

const VISIBLE_STEPS: Step[] = ["confirm", "removing", "done"];

interface StageState {
  cleanup: "pending" | "running" | "done";
  finalize: "pending" | "running" | "done";
}

const INITIAL_STAGES: StageState = {
  cleanup: "pending",
  finalize: "pending",
};

export function UninstallerApp() {
  const [step, setStep] = useState<Step>("confirm");
  const [stages, setStages] = useState<StageState>(INITIAL_STAGES);
  const [error, setError] = useState<string | null>(null);

  async function startUninstall() {
    setStep("removing");
    setError(null);
    setStages({ ...INITIAL_STAGES, cleanup: "running" });

    try {
      await api.installerUninstallCleanup();
      setStages((s) => ({ ...s, cleanup: "done", finalize: "running" }));

      // Tiny pause so the second stage is legible instead of a flash.
      await new Promise((r) => setTimeout(r, 600));
      setStages((s) => ({ ...s, finalize: "done" }));
      setStep("done");
    } catch (e) {
      console.error("Uninstall failed:", e);
      setError(String(e));
      setStep("error");
    }
  }

  async function finishAndQuit() {
    try {
      await api.installerFinalizeUninstall();
    } catch (e) {
      console.error("Finalize failed:", e);
      // The batch may or may not have started — either way, force quit so
      // the install dir can be removed (or the user can do it manually).
      try {
        await api.quitApp();
      } catch {}
    }
  }

  const stepIdx = VISIBLE_STEPS.indexOf(step);

  return (
    <div className="h-screen flex flex-col bg-app">
      <TitleBar canClose={step !== "removing"} />

      {step !== "error" && (
        <ProgressDots current={stepIdx} total={VISIBLE_STEPS.length} />
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[540px] mx-auto px-10 py-10 min-h-full flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
              className="flex-1 flex flex-col"
            >
              {step === "confirm" && (
                <ConfirmStep
                  onCancel={() => api.quitApp()}
                  onUninstall={startUninstall}
                />
              )}
              {step === "removing" && <RemovingStep stages={stages} />}
              {step === "done" && <DoneStep onClose={finishAndQuit} />}
              {step === "error" && (
                <ErrorStep
                  message={error ?? "Erreur inconnue"}
                  onClose={() => api.quitApp()}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Title bar ──────────────────────────────────────────────────────── */

function TitleBar({ canClose }: { canClose: boolean }) {
  const win = getCurrentWindow();
  return (
    <div
      data-tauri-drag-region
      className="h-10 flex-shrink-0 flex items-center justify-between border-b border-app bg-app select-none"
    >
      <div className="flex items-baseline gap-2 pl-3 pointer-events-none">
        <Logo size={12} className="text-sand self-center" />
        <span className="text-[12px] font-medium tracking-tight text-app">hyperwisper</span>
        <span className="text-faint">·</span>
        <span className="text-[10.5px] font-mono text-faint">désinstallation</span>
      </div>
      <div data-tauri-drag-region="false" className="flex items-center gap-px pr-1">
        <WindowBtn onClick={() => win.minimize()} label="Réduire">
          <Minus className="h-3 w-3" strokeWidth={2.2} />
        </WindowBtn>
        <WindowBtn
          onClick={() => canClose && api.quitApp()}
          label={canClose ? "Fermer" : "Fermer (indisponible pendant la désinstallation)"}
          danger
          disabled={!canClose}
        >
          <X className="h-3 w-3" strokeWidth={2.4} />
        </WindowBtn>
      </div>
    </div>
  );
}

function WindowBtn({
  onClick,
  label,
  children,
  danger,
  disabled,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={`flex items-center justify-center h-7 w-9 rounded-md text-faint transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))] disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? "hover:bg-[hsl(var(--ember)/0.18)] hover:text-ember"
          : "hover:bg-hover hover:text-app"
      }`}
    >
      {children}
    </button>
  );
}

/* ─── Progress dots ──────────────────────────────────────────────────── */

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex-shrink-0 pt-4 pb-1 flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-1 rounded-full transition-all duration-300"
          style={{
            width: i === current ? 24 : 6,
            background: i <= current ? "hsl(var(--ember))" : "hsl(var(--border))",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Step 1: Confirm ────────────────────────────────────────────────── */

function ConfirmStep({
  onCancel,
  onUninstall,
}: {
  onCancel: () => void;
  onUninstall: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col justify-center space-y-10">
        <div
          className="flex items-center justify-center h-14 w-14 rounded-full"
          style={{ background: "hsl(var(--ember) / 0.12)" }}
        >
          <Trash2 className="h-7 w-7" strokeWidth={2.2} style={{ color: "hsl(var(--ember))" }} />
        </div>

        <div className="space-y-3">
          <h1 className="text-[36px] leading-[1.05] font-semibold tracking-[-0.035em] text-app">
            Désinstaller Hyperwisper ?
          </h1>
          <p className="text-[15px] leading-relaxed text-soft max-w-[44ch]">
            Tout va être nettoyé proprement. Cette action est irréversible —
            tes dictées passées ne seront plus récupérables.
          </p>
        </div>

        <div className="rounded-lg border border-app bg-elevated px-4 py-3.5 space-y-2.5">
          <div className="text-[10.5px] uppercase tracking-[0.1em] font-medium text-faint">
            Ce qui sera supprimé
          </div>
          <ul className="space-y-1.5">
            <RemovedItem>Le binaire et le dossier d'installation</RemovedItem>
            <RemovedItem>Le modèle Whisper téléchargé (~290 MB)</RemovedItem>
            <RemovedItem>Tes réglages, ton historique, tes logs</RemovedItem>
            <RemovedItem>Le raccourci menu Démarrer (et bureau s'il existe)</RemovedItem>
            <RemovedItem>Le lancement automatique au démarrage</RemovedItem>
            <RemovedItem>L'entrée "Hyperwisper" dans Applications installées</RemovedItem>
          </ul>
        </div>
      </div>

      <NavRow>
        <BackButton onClick={onCancel} label="Annuler" />
        <DangerButton onClick={onUninstall}>
          Désinstaller
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
        </DangerButton>
      </NavRow>
    </div>
  );
}

function RemovedItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[12.5px] text-soft">
      <span className="mt-1.5 h-1 w-1 rounded-full flex-shrink-0" style={{ background: "hsl(var(--ember) / 0.6)" }} />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

/* ─── Step 2: Removing ───────────────────────────────────────────────── */

function RemovingStep({ stages }: { stages: StageState }) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col justify-center space-y-12">
        <div className="space-y-2.5">
          <div className="text-[11px] uppercase tracking-[0.12em] font-medium" style={{ color: "hsl(var(--ember))" }}>
            Désinstallation en cours
          </div>
          <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-app">
            On nettoie tout.
          </h1>
          <p className="text-[13.5px] leading-relaxed text-soft max-w-[44ch]">
            Ne ferme pas la fenêtre. C'est rapide.
          </p>
        </div>

        <div className="space-y-1">
          <StageRow
            label="Suppression des fichiers et données"
            sublabel="Réglages, historique, modèle, logs, raccourcis"
            state={stages.cleanup}
          />
          <StageRow
            label="Nettoyage du registre Windows"
            sublabel="Entrée Désinstaller · démarrage automatique"
            state={stages.finalize}
          />
        </div>
      </div>
    </div>
  );
}

function StageRow({
  label,
  sublabel,
  state,
}: {
  label: string;
  sublabel: string;
  state: "pending" | "running" | "done";
}) {
  return (
    <div className="px-3.5 py-3 flex items-center gap-3.5">
      <StageIcon state={state} />
      <div className="flex-1 min-w-0">
        <div
          className={`text-[13px] tracking-tight transition-colors ${
            state === "pending" ? "text-faint" : "text-app font-medium"
          }`}
        >
          {label}
        </div>
        <div
          className={`text-[11.5px] mt-0.5 leading-relaxed transition-colors ${
            state === "running" ? "text-soft" : "text-muted"
          }`}
        >
          {sublabel}
        </div>
      </div>
    </div>
  );
}

function StageIcon({ state }: { state: "pending" | "running" | "done" }) {
  if (state === "done") {
    return (
      <motion.span
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 22 }}
        className="flex items-center justify-center h-6 w-6 rounded-full"
        style={{ background: "hsla(88, 38%, 60%, 0.18)" }}
      >
        <Check className="h-3 w-3 text-moss" strokeWidth={3} />
      </motion.span>
    );
  }
  if (state === "running") {
    return (
      <span
        className="flex items-center justify-center h-6 w-6 rounded-full"
        style={{ background: "hsl(var(--ember) / 0.12)" }}
      >
        <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.4} style={{ color: "hsl(var(--ember))" }} />
      </span>
    );
  }
  return (
    <span
      className="flex items-center justify-center h-6 w-6 rounded-full"
      style={{ background: "hsl(var(--bg-subtle))" }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "hsl(var(--text-faint))" }}
      />
    </span>
  );
}

/* ─── Step 3: Done ───────────────────────────────────────────────────── */

function DoneStep({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col justify-center space-y-10">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 22, delay: 0.05 }}
          className="flex items-center justify-center h-16 w-16 rounded-full"
          style={{ background: "hsla(88, 38%, 60%, 0.18)" }}
        >
          <HeartHandshake className="h-8 w-8 text-moss" strokeWidth={2.2} />
        </motion.div>

        <div className="space-y-3">
          <h1 className="text-[36px] leading-[1.05] font-semibold tracking-[-0.035em] text-app">
            Merci d'avoir essayé.
          </h1>
          <p className="text-[15px] leading-relaxed text-soft max-w-[44ch]">
            Hyperwisper est désinstallé. Le dossier sera supprimé dès que la
            fenêtre se ferme. Si tu reviens un jour, on sera là.
          </p>
        </div>
      </div>

      <NavRow>
        <span />
        <PrimaryButton onClick={onClose}>
          Fermer
          <Check className="h-3.5 w-3.5" strokeWidth={2.8} />
        </PrimaryButton>
      </NavRow>
    </div>
  );
}

/* ─── Error ──────────────────────────────────────────────────────────── */

function ErrorStep({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const display = useMemo(() => message.slice(0, 600), [message]);
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col justify-center space-y-8">
        <div
          className="flex items-center justify-center h-14 w-14 rounded-full"
          style={{ background: "hsl(var(--ember) / 0.12)" }}
        >
          <AlertTriangle className="h-7 w-7" strokeWidth={2.2} style={{ color: "hsl(var(--ember))" }} />
        </div>
        <div className="space-y-3">
          <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.025em] text-app">
            Désinstallation incomplète.
          </h1>
          <p className="text-[13.5px] leading-relaxed text-soft max-w-[44ch]">
            Voici ce que le système a rapporté. Tu peux supprimer le dossier
            d'installation manuellement, et nettoyer la clé registre
            <span className="font-mono text-[11px] ml-1">
              HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Hyperwisper
            </span>.
          </p>
        </div>
        <div
          className="rounded-lg border px-4 py-3 text-[11.5px] font-mono leading-relaxed"
          style={{
            background: "hsl(var(--ember) / 0.06)",
            borderColor: "hsl(var(--ember) / 0.25)",
            color: "hsl(var(--ember))",
          }}
        >
          {display}
        </div>
      </div>
      <NavRow>
        <span />
        <PrimaryButton onClick={onClose}>
          Fermer
          <X className="h-3.5 w-3.5" strokeWidth={2.6} />
        </PrimaryButton>
      </NavRow>
    </div>
  );
}

/* ─── Shared primitives ──────────────────────────────────────────────── */

function NavRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-shrink-0 pt-10 mt-auto flex items-center justify-between gap-4">
      {children}
    </div>
  );
}

function BackButton({ onClick, label = "Retour" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] text-muted hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
    >
      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
      {label}
    </button>
  );
}

function PrimaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
      style={{
        background: "hsl(var(--sand))",
        color: "hsl(var(--accent-fg))",
      }}
    >
      {children}
    </button>
  );
}

function DangerButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ember))]"
      style={{
        background: "hsl(var(--ember))",
        color: "white",
      }}
    >
      {children}
    </button>
  );
}
