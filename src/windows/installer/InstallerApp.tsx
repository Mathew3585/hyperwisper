import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  FolderOpen,
  Rocket,
  AlertTriangle,
  Minus,
  X,
  Zap,
  Lock,
  Sparkle,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { api, type InstallerStatus, type Model } from "@/lib/ipc";
import { events, type DownloadProgress } from "@/lib/events";
import { useT } from "@/i18n";

const RECOMMENDED_MODEL: Model = "small-q5_1";
const RECOMMENDED_FILENAME = "ggml-small-q5_1.bin";
/**
 * Approximate on-disk size of the default Whisper model. The installer has no
 * runtime figure to read before the download starts, so the copy quotes this.
 * The uninstaller imports it rather than repeating the number, so the two can
 * never disagree.
 */
export const MODEL_SIZE_MB = 290;

type Step = "pitch" | "configure" | "installing" | "done" | "error";

const VISIBLE_STEPS: Step[] = ["pitch", "configure", "installing", "done"];

interface StageState {
  copy: "pending" | "running" | "done";
  model: "pending" | "running" | "done";
  finalize: "pending" | "running" | "done";
}

const INITIAL_STAGES: StageState = {
  copy: "pending",
  model: "pending",
  finalize: "pending",
};

export function InstallerApp() {
  const t = useT();
  const [step, setStep] = useState<Step>("pitch");
  const [status, setStatus] = useState<InstallerStatus | null>(null);
  const [installDir, setInstallDir] = useState<string>("");
  const [createDesktop, setCreateDesktop] = useState(false);
  const [stages, setStages] = useState<StageState>(INITIAL_STAGES);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.installerStatus().then((s) => {
      setStatus(s);
      // Pre-fill the picker with the existing install dir if we're reinstalling,
      // otherwise with the OS default.
      setInstallDir(s.existingInstallDir ?? s.defaultInstallDir);
    });
    const unsubs: Array<() => void> = [];
    events
      .onModelProgress((p) => {
        if (p.model === RECOMMENDED_FILENAME) setProgress(p);
      })
      .then((u) => unsubs.push(u));
    return () => unsubs.forEach((u) => u());
  }, []);

  async function pickInstallDir() {
    try {
      const result = await openDialog({
        directory: true,
        multiple: false,
        defaultPath: installDir || undefined,
        title: t.installer.dirPickerTitle,
      });
      if (typeof result === "string" && result.length > 0) {
        // Ensure the chosen dir ends in `Hyperwisper` — if the user picked a
        // parent (e.g. C:\Apps), we append the name so we don't litter their
        // chosen folder with our files alongside other apps.
        const trimmed = result.replace(/[\\/]+$/, "");
        const finalDir = /[\\\/]Hyperwisper$/i.test(trimmed)
          ? trimmed
          : `${trimmed}\\Hyperwisper`;
        setInstallDir(finalDir);
      }
    } catch (e) {
      console.error("openDialog failed:", e);
    }
  }

  async function startInstall() {
    setStep("installing");
    setError(null);
    setStages({ ...INITIAL_STAGES, copy: "running" });

    try {
      // 1. Copy the binary, create shortcut, write uninstall registry.
      await api.installerInstall(installDir, createDesktop);
      setStages((s) => ({ ...s, copy: "done", model: "running" }));

      // 2. Download the default Whisper model so the app is usable
      //    immediately after relaunch.
      await api.downloadModel(RECOMMENDED_MODEL);
      setStages((s) => ({ ...s, model: "done", finalize: "running" }));

      // 3. Tiny pause so the last step doesn't flash.
      await new Promise((r) => setTimeout(r, 500));
      setStages((s) => ({ ...s, finalize: "done" }));
      setStep("done");
    } catch (e) {
      console.error("Install failed:", e);
      setError(String(e));
      setStep("error");
    }
  }

  async function launchInstalled() {
    try {
      await api.installerRelaunch();
    } catch (e) {
      console.error("Relaunch failed:", e);
      setError(String(e));
    }
  }

  const stepIdx = VISIBLE_STEPS.indexOf(step);

  return (
    <div className="h-screen flex flex-col bg-app">
      <TitleBar />

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
              {step === "pitch" && (
                <PitchStep onNext={() => setStep("configure")} />
              )}
              {step === "configure" && (
                <ConfigureStep
                  status={status}
                  installDir={installDir}
                  createDesktop={createDesktop}
                  onChangeInstallDir={pickInstallDir}
                  onResetDir={() =>
                    status && setInstallDir(status.defaultInstallDir)
                  }
                  onToggleDesktop={setCreateDesktop}
                  onBack={() => setStep("pitch")}
                  onInstall={startInstall}
                />
              )}
              {step === "installing" && (
                <InstallingStep stages={stages} progress={progress} />
              )}
              {step === "done" && (
                <DoneStep onLaunch={launchInstalled} installDir={installDir} />
              )}
              {step === "error" && (
                <ErrorStep
                  message={error ?? t.installer.error.unknown}
                  onRetry={() => setStep("configure")}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Title bar with window controls ─────────────────────────────────── */

function TitleBar() {
  const t = useT();
  const win = getCurrentWindow();

  async function close() {
    try {
      // Quit the whole process — closing the installer window alone would
      // leave the overlay window running invisibly in the tray-less mode.
      await api.quitApp();
    } catch (e) {
      console.error("quit failed:", e);
    }
  }

  return (
    <div
      data-tauri-drag-region
      className="h-10 flex-shrink-0 flex items-center justify-between border-b border-app bg-app select-none"
    >
      <div className="flex items-baseline gap-2 pl-3 pointer-events-none">
        <Logo size={12} className="text-sand self-center" />
        <span className="text-[12px] font-medium tracking-tight text-app">hyperwisper</span>
        <span className="text-faint">·</span>
        <span className="text-[10.5px] font-mono text-faint">
          {t.installer.titlebarSubtitle}
        </span>
      </div>
      <div data-tauri-drag-region="false" className="flex items-center gap-px pr-1">
        <WindowBtn onClick={() => win.minimize()} label={t.window.minimize}>
          <Minus className="h-3 w-3" strokeWidth={2.2} />
        </WindowBtn>
        <WindowBtn onClick={close} label={t.window.close} danger>
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
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center h-7 w-9 rounded-md text-faint transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))] ${
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
            background:
              i <= current ? "hsl(var(--sand))" : "hsl(var(--border))",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Step 1: Pitch ──────────────────────────────────────────────────── */

function PitchStep({ onNext }: { onNext: () => void }) {
  const t = useT();
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col justify-center space-y-10">
        <Logo size={80} className="text-sand" />

        <div className="space-y-4">
          <h1 className="text-[44px] leading-[1.02] font-semibold tracking-[-0.04em] text-app">
            {t.installer.pitch.titleLine1}
            <br />
            {t.installer.pitch.titleLine2}
          </h1>
          <p className="text-[15px] leading-relaxed text-soft max-w-[44ch]">
            {t.installer.pitch.body}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <PitchStat
            icon={<Zap className="h-3 w-3" strokeWidth={2.4} />}
            value="3×"
            label={t.installer.pitch.statSpeed}
          />
          <PitchStat
            icon={<Lock className="h-3 w-3" strokeWidth={2.4} />}
            value="100%"
            label={t.installer.pitch.statLocal}
          />
          <PitchStat
            icon={<Sparkle className="h-3 w-3" strokeWidth={2.4} />}
            value="0 €"
            label={t.installer.pitch.statFree}
          />
        </div>
      </div>

      <NavRow>
        <span className="text-[11px] text-faint">
          {t.installer.pitch.footnote}
        </span>
        <PrimaryButton onClick={onNext}>
          {t.installer.pitch.cta}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
        </PrimaryButton>
      </NavRow>
    </div>
  );
}

function PitchStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-xl border border-app bg-elevated p-4 space-y-2">
      <span
        className="flex items-center justify-center h-5 w-5 rounded-md"
        style={{ background: "hsl(var(--sand-soft))", color: "hsl(var(--sand))" }}
      >
        {icon}
      </span>
      <div className="text-[26px] font-semibold tracking-[-0.025em] tabular-nums text-app leading-none">
        {value}
      </div>
      <div className="text-[11px] leading-snug text-muted">{label}</div>
    </div>
  );
}

/* ─── Step 2: Configure ──────────────────────────────────────────────── */

function ConfigureStep({
  status,
  installDir,
  createDesktop,
  onChangeInstallDir,
  onResetDir,
  onToggleDesktop,
  onBack,
  onInstall,
}: {
  status: InstallerStatus | null;
  installDir: string;
  createDesktop: boolean;
  onChangeInstallDir: () => void;
  onResetDir: () => void;
  onToggleDesktop: (v: boolean) => void;
  onBack: () => void;
  onInstall: () => void;
}) {
  const t = useT();
  const reinstall = status?.installExists ?? false;
  const isDefault =
    status !== null && installDir === status.defaultInstallDir;

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 space-y-10">
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.12em] font-medium text-sand">
            {reinstall
              ? t.installer.configure.eyebrowReinstall
              : t.installer.configure.eyebrowInstall}
          </div>
          <h2 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] text-app">
            {t.installer.configure.title}
          </h2>
          <p className="text-[13.5px] leading-relaxed text-soft max-w-[48ch]">
            {t.installer.configure.body}
          </p>
        </div>

        <section className="space-y-3">
          <Label>{t.installer.configure.dirLabel}</Label>
          <div className="rounded-lg border border-app bg-elevated p-2 flex items-center gap-2">
            <div className="flex-1 px-2 py-1.5 rounded-md bg-app border border-app overflow-hidden">
              <div
                className="text-[12.5px] font-mono text-app truncate"
                title={installDir}
              >
                {installDir || t.common.loading}
              </div>
            </div>
            <button
              onClick={onChangeInstallDir}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-app border border-app bg-elevated hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
            >
              <FolderOpen className="h-3 w-3" strokeWidth={2.4} />
              {t.common.edit}
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-faint">
              {t.installer.configure.dirHint(MODEL_SIZE_MB)}
            </p>
            {!isDefault && status && (
              <button
                onClick={onResetDir}
                className="text-[11px] text-muted hover:text-app transition-colors"
              >
                {t.installer.configure.resetDir}
              </button>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <Label>{t.installer.configure.optionsLabel}</Label>
          <Choice
            label={t.installer.configure.desktopShortcut.label}
            description={t.installer.configure.desktopShortcut.description}
            checked={createDesktop}
            onChange={onToggleDesktop}
          />
        </section>
      </div>

      <NavRow>
        <BackButton onClick={onBack} />
        <PrimaryButton
          onClick={onInstall}
          disabled={!installDir}
        >
          {reinstall
            ? t.installer.configure.ctaReinstall
            : t.installer.configure.ctaInstall}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
        </PrimaryButton>
      </NavRow>
    </div>
  );
}

function Choice({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="w-full flex items-start gap-3 px-3.5 py-3 rounded-lg border border-app bg-elevated hover:bg-hover transition-colors text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
    >
      <span
        className="mt-0.5 flex items-center justify-center h-4 w-4 rounded-[5px] border transition-colors flex-shrink-0"
        style={{
          background: checked ? "hsl(var(--sand))" : "transparent",
          borderColor: checked ? "hsl(var(--sand))" : "hsl(var(--border))",
        }}
      >
        {checked && (
          <Check
            className="h-2.5 w-2.5"
            strokeWidth={3.5}
            style={{ color: "hsl(var(--accent-fg))" }}
          />
        )}
      </span>
      <div className="flex-1">
        <div className="text-[13px] text-app">{label}</div>
        {description && (
          <div className="text-[11.5px] text-muted mt-0.5 leading-relaxed">
            {description}
          </div>
        )}
      </div>
    </button>
  );
}

/* ─── Step 3: Installing ─────────────────────────────────────────────── */

function InstallingStep({
  stages,
  progress,
}: {
  stages: StageState;
  progress: DownloadProgress | null;
}) {
  const t = useT();
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col justify-center space-y-12">
        <div className="space-y-2.5">
          <div className="text-[11px] uppercase tracking-[0.12em] font-medium text-sand">
            {t.installer.installing.eyebrow}
          </div>
          <h1 className="text-[32px] leading-[1.1] font-semibold tracking-[-0.03em] text-app">
            {t.installer.installing.title}
          </h1>
          <p className="text-[13.5px] leading-relaxed text-soft max-w-[44ch]">
            {t.installer.installing.body}
          </p>
        </div>

        <div className="space-y-1">
          <StageRow
            label={t.installer.stage.copyLabel}
            sublabel={t.installer.stage.copySublabel}
            state={stages.copy}
          />
          <StageRow
            label={t.installer.stage.modelLabel}
            sublabel={
              progress && stages.model === "running"
                ? t.installer.stage.modelProgress(
                    (progress.bytes / (1024 * 1024)).toFixed(1),
                    (progress.total / (1024 * 1024)).toFixed(1),
                    progress.percent.toFixed(0),
                  )
                : t.installer.stage.modelSublabel(MODEL_SIZE_MB)
            }
            state={stages.model}
            progress={stages.model === "running" ? progress?.percent : undefined}
          />
          <StageRow
            label={t.installer.stage.finalizeLabel}
            sublabel={t.installer.stage.finalizeSublabel}
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
  progress,
}: {
  label: string;
  sublabel: string;
  state: "pending" | "running" | "done";
  progress?: number;
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
        {state === "running" && progress !== undefined && (
          <div className="mt-2 h-[3px] rounded-full bg-subtle overflow-hidden">
            <motion.div
              animate={{ width: `${Math.max(2, progress)}%` }}
              transition={{ duration: 0.15, ease: "linear" }}
              className="h-full rounded-full bg-sand"
            />
          </div>
        )}
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
        style={{ background: "hsl(var(--sand-soft))" }}
      >
        <Loader2 className="h-3 w-3 text-sand animate-spin" strokeWidth={2.4} />
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

/* ─── Step 4: Done ───────────────────────────────────────────────────── */

function DoneStep({
  onLaunch,
  installDir,
}: {
  onLaunch: () => void;
  installDir: string;
}) {
  const t = useT();
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
          <Check className="h-8 w-8 text-moss" strokeWidth={2.4} />
        </motion.div>

        <div className="space-y-3">
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-app">
            {t.installer.done.title}
          </h1>
          <p className="text-[15px] leading-relaxed text-soft max-w-[44ch]">
            {t.installer.done.body}
          </p>
        </div>

        <div className="rounded-lg border border-app bg-elevated px-3.5 py-2.5">
          <div className="text-[10.5px] uppercase tracking-[0.1em] font-medium text-faint mb-1">
            {t.installer.done.installedInLabel}
          </div>
          <div
            className="text-[12.5px] font-mono text-app truncate"
            title={installDir}
          >
            {installDir}
          </div>
        </div>
      </div>

      <NavRow>
        <span />
        <PrimaryButton onClick={onLaunch}>
          {t.installer.done.cta}
          <Rocket className="h-3.5 w-3.5" strokeWidth={2.4} />
        </PrimaryButton>
      </NavRow>
    </div>
  );
}

/* ─── Error ──────────────────────────────────────────────────────────── */

function ErrorStep({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const t = useT();
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
            {t.installer.error.title}
          </h1>
          <p className="text-[13.5px] leading-relaxed text-soft max-w-[44ch]">
            {t.installer.error.body}
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
        <PrimaryButton onClick={onRetry}>
          {t.common.retry}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
        </PrimaryButton>
      </NavRow>
    </div>
  );
}

/* ─── Shared primitives ──────────────────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] uppercase tracking-[0.1em] font-medium text-faint">
      {children}
    </div>
  );
}

function NavRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-shrink-0 pt-10 mt-auto flex items-center justify-between gap-4">
      {children}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] text-muted hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
    >
      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
      {t.common.back}
    </button>
  );
}

function PrimaryButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
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
  );
}
