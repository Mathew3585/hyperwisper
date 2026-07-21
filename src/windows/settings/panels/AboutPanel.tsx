import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/ipc";
import { useT } from "@/i18n";

export function AboutPanel() {
  const t = useT();
  const [uninstalling, setUninstalling] = useState(false);
  const [confirmingUninstall, setConfirmingUninstall] = useState(false);

  async function triggerUninstall() {
    setUninstalling(true);
    try {
      // Spawns a new process with --uninstall (which shows the custom
      // UninstallerApp) and exits the current one.
      await api.installerTriggerUninstallUi();
    } catch (e) {
      console.error("trigger uninstall failed:", e);
      setUninstalling(false);
    }
  }

  return (
    <div className="space-y-14">
      {/* Hero — brand */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="space-y-8"
      >
        <Logo size={64} className="text-sand" />
        <div className="space-y-2.5">
          <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] text-app">
            hyperwisper
          </h1>
          <p className="text-[15px] leading-relaxed text-soft max-w-[44ch]">
            {t.settings.about.tagline}
          </p>
        </div>
      </motion.section>

      {/* Pourquoi */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="space-y-4"
      >
        <Label>{t.settings.about.whyLabel}</Label>
        <Paragraph>
          {t.settings.about.why.p1Prefix} <em>{t.settings.about.why.p1Emphasis}</em>{" "}
          {t.settings.about.why.p1Suffix}
        </Paragraph>
        <Paragraph>{t.settings.about.why.p2}</Paragraph>
      </motion.section>

      {/* Comment ça marche */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.16 }}
        className="space-y-4"
      >
        <Label>{t.settings.about.howLabel}</Label>
        <div className="space-y-5">
          <Step
            num="1"
            title={`${t.settings.about.step1.titlePrefix} Ctrl + Space`}
            description={t.settings.about.step1.description}
          />
          <Step
            num="2"
            title={t.settings.about.step2.title}
            description={`${t.settings.about.step2.descriptionPrefix} Ctrl + Space ${t.settings.about.step2.descriptionSuffix}`}
          />
          <Step
            num="3"
            title={t.settings.about.step3.title}
            description={t.settings.about.step3.description}
          />
        </div>
      </motion.section>

      {/* Confidentialité */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.24 }}
        className="space-y-4"
      >
        <Label>{t.settings.about.privacyLabel}</Label>
        <Paragraph>{t.settings.about.privacyBody}</Paragraph>
      </motion.section>

      {/* Désinstallation */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="space-y-3"
      >
        <Label>{t.settings.about.dangerLabel}</Label>
        <div
          className="rounded-lg border p-4 flex items-start justify-between gap-4"
          style={{
            background: "hsl(var(--ember) / 0.04)",
            borderColor: "hsl(var(--ember) / 0.22)",
          }}
        >
          <div className="flex-1 space-y-1">
            <div className="text-[13px] font-medium text-app flex items-center gap-2">
              <AlertTriangle className="h-3 w-3" strokeWidth={2.4} style={{ color: "hsl(var(--ember))" }} />
              {t.settings.about.uninstall.title}
            </div>
            <p className="text-[11.5px] text-muted leading-relaxed">
              {t.settings.about.uninstall.description}
            </p>
          </div>
          {!confirmingUninstall ? (
            <button
              onClick={() => setConfirmingUninstall(true)}
              disabled={uninstalling}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ember))]"
              style={{
                background: "transparent",
                borderColor: "hsl(var(--ember) / 0.4)",
                color: "hsl(var(--ember))",
              }}
            >
              <Trash2 className="h-3 w-3" strokeWidth={2.4} />
              {t.settings.about.uninstall.button}
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setConfirmingUninstall(false)}
                disabled={uninstalling}
                className="inline-flex items-center px-3 py-1.5 rounded-md text-[12px] text-muted hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={triggerUninstall}
                disabled={uninstalling}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--ember))]"
                style={{
                  background: "hsl(var(--ember))",
                  color: "white",
                }}
              >
                {uninstalling ? (
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.4} />
                ) : (
                  <Trash2 className="h-3 w-3" strokeWidth={2.4} />
                )}
                {uninstalling
                  ? t.settings.about.uninstall.launching
                  : t.common.continue}
              </button>
            </div>
          )}
        </div>
      </motion.section>

      {/* Footer */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.38 }}
        className="pt-6 flex items-center justify-between text-[11.5px] text-faint border-t border-soft"
      >
        <span className="font-mono">v0.1.0</span>
        <span>{t.settings.about.credit}</span>
      </motion.section>
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

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14px] leading-[1.65] text-soft max-w-[58ch]">{children}</p>
  );
}

function Step({
  num,
  title,
  description,
}: {
  num: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div
        className="flex items-center justify-center h-7 w-7 rounded-full font-mono text-[12px] font-semibold flex-shrink-0"
        style={{
          background: "hsl(var(--sand-soft))",
          color: "hsl(var(--sand))",
          border: "1px solid hsl(var(--sand) / 0.25)",
        }}
      >
        {num}
      </div>
      <div className="flex-1 space-y-1 pt-0.5">
        <div className="text-[14px] font-medium tracking-tight text-app">{title}</div>
        <p className="text-[13px] leading-relaxed text-soft max-w-[54ch]">{description}</p>
      </div>
    </div>
  );
}
