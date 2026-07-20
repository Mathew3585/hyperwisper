import { useState } from "react";
import { motion } from "framer-motion";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/ipc";

export function AboutPanel() {
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
            Dictée vocale instantanée. Ta voix devient texte, partout dans
            Windows. Rien ne sort de ton ordinateur.
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
        <Label>Pourquoi</Label>
        <Paragraph>
          Parce que <em>parler</em> est 3× plus rapide qu'écrire au clavier. Tes
          idées sortent à la vitesse à laquelle tu les penses. Plus d'allers-
          retours mentaux entre la phrase et les doigts.
        </Paragraph>
        <Paragraph>
          Parce que les alternatives existantes te demandent un abonnement
          mensuel pour utiliser une technologie open-source. Hyperwisper, c'est
          le même résultat, sans abonnement, sans cloud, sans compromis.
        </Paragraph>
      </motion.section>

      {/* Comment ça marche */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.16 }}
        className="space-y-4"
      >
        <Label>Comment ça marche</Label>
        <div className="space-y-5">
          <Step
            num="1"
            title="Tu appuies sur Ctrl + Space"
            description="N'importe où dans Windows. Sur ton bureau, dans Discord, dans Word, dans ton terminal. La pill apparaît en haut de l'écran."
          />
          <Step
            num="2"
            title="Tu parles"
            description="Hyperwisper écoute et visualise ton audio en temps réel. Re-appuie sur Ctrl + Space quand tu as fini."
          />
          <Step
            num="3"
            title="Ton texte se colle"
            description="La transcription est faite sur ton PC en quelques secondes, puis collée exactement où ton curseur se trouve. Comme si tu l'avais tapée."
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
        <Label>Confidentialité</Label>
        <Paragraph>
          Aucun audio n'est envoyé sur internet. Aucun texte transcrit n'est
          partagé. Aucune statistique d'usage n'est collectée. Tout reste sur ta
          machine, pour toujours.
        </Paragraph>
      </motion.section>

      {/* Désinstallation */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="space-y-3"
      >
        <Label>Zone de danger</Label>
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
              Désinstaller Hyperwisper
            </div>
            <p className="text-[11.5px] text-muted leading-relaxed">
              Supprime l'application, le modèle, tes réglages et ton historique.
              Tu verras un écran de confirmation avant.
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
              Désinstaller…
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setConfirmingUninstall(false)}
                disabled={uninstalling}
                className="inline-flex items-center px-3 py-1.5 rounded-md text-[12px] text-muted hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))]"
              >
                Annuler
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
                {uninstalling ? "Lancement…" : "Continuer"}
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
        <span>Made by mathew · 2026</span>
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
