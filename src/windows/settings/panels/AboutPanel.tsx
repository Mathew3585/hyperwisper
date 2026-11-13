import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trash2, Loader2, Lock } from "lucide-react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/ipc";
import { useT } from "@/i18n";
import { CardTitle } from "./common";

/** Decorative waveform in the corner of the brand stage. */
const DECO = Array.from({ length: 22 }, (_, i) =>
  Math.round(8 + Math.abs(Math.sin(i * 0.55) * Math.cos(i * 0.21)) * 70)
);

export function AboutPanel() {
  const t = useT();
  const a = t.settings.about;
  const [uninstalling, setUninstalling] = useState(false);
  const [confirmingUninstall, setConfirmingUninstall] = useState(false);
  const [hotkey, setHotkey] = useState("Ctrl+Space");
  const [version, setVersion] = useState("0.1.0");

  useEffect(() => {
    api.getSettings().then((s) => setHotkey(s.hotkey)).catch(() => {});
    api.getRuntimeInfo().then((r) => setVersion(r.appVersion)).catch(() => {});
  }, []);

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

  const combo = hotkey.split("+").join(" + ");

  return (
    <div className="space-y-3.5">
      <section className="grid grid-cols-5 gap-3.5">
        {/* ─── Brand stage ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="stage col-span-3 min-h-[214px] p-6 flex flex-col justify-between gap-4"
        >
          <div className="stage-glow -right-10 -top-16 w-[340px] h-[300px]" />
          <div className="absolute right-6 bottom-[18px] flex items-center gap-1 h-20 -z-10" aria-hidden="true">
            {DECO.map((h, i) => (
              <span key={i} className="w-1 rounded-full bg-sand opacity-[0.22]" style={{ height: h }} />
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span
              className="h-[60px] w-[60px] rounded-2xl flex items-center justify-center bg-elevated"
              style={{ boxShadow: "inset 0 0 0 1px hsl(var(--border)), 0 10px 30px hsl(30 60% 60% / 0.25)" }}
            >
              <Logo size={32} className="text-sand" />
            </span>
            <div className="space-y-0.5">
              <h1 className="text-[30px] leading-none font-bold tracking-[-0.045em] text-app">Hyperwisper</h1>
              <div className="font-mono text-[11px] text-muted">
                v{version} · {t.ui.about.license}
              </div>
            </div>
          </div>
          <p className="text-[14px] leading-relaxed text-soft max-w-[42ch]">{a.tagline}</p>
          <div className="flex flex-wrap gap-1.5">
            {[t.ui.about.offline, t.ui.about.engine, t.ui.about.free].map((c) => (
              <span
                key={c}
                className="px-2.5 py-1 rounded-full text-[11.5px] text-soft bg-white/[0.07] border border-white/10"
              >
                {c}
              </span>
            ))}
          </div>
        </motion.div>

        {/* ─── Why ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06 }}
          className="card col-span-2 px-5 py-[18px] space-y-2.5"
        >
          <CardTitle>{a.whyLabel}</CardTitle>
          <p className="text-[12.5px] leading-relaxed text-soft">
            {a.why.p1Prefix} <strong className="font-semibold text-app">{a.why.p1Emphasis}</strong>{" "}
            {a.why.p1Suffix}
          </p>
          <p className="text-[12.5px] leading-relaxed text-soft">{a.why.p2}</p>
        </motion.div>
      </section>

      {/* ─── How it works ──────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        className="space-y-2.5"
      >
        <h2 className="text-[13px] font-semibold tracking-tight text-app">{a.howLabel}</h2>
        <div className="grid grid-cols-3 gap-3">
          <Step num="1" title={`${a.step1.titlePrefix} ${combo}`} description={a.step1.description} />
          <Step
            num="2"
            title={a.step2.title}
            description={`${a.step2.descriptionPrefix} ${combo} ${a.step2.descriptionSuffix}`}
          />
          <Step num="3" title={a.step3.title} description={a.step3.description} />
        </div>
      </motion.section>

      {/* ─── Privacy + danger zone ─────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18 }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="card rounded-[14px] px-[18px] py-4 flex items-start gap-3.5">
          <span
            className="h-[34px] w-[34px] flex-shrink-0 rounded-[10px] flex items-center justify-center text-moss"
            style={{ background: "hsl(var(--moss) / 0.14)" }}
          >
            <Lock className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="space-y-1">
            <span className="block text-[13px] font-semibold text-app">{a.privacyLabel}</span>
            <span className="block text-[12px] leading-relaxed text-muted">{a.privacyBody}</span>
          </span>
        </div>

        <div
          className="rounded-[14px] border px-[18px] py-4 flex items-center gap-3.5"
          style={{ background: "hsl(var(--ember) / 0.05)", borderColor: "hsl(var(--ember) / 0.25)" }}
        >
          <span className="flex-1 min-w-0 space-y-1">
            <span className="block text-[13px] font-semibold" style={{ color: "hsl(var(--ember))" }}>
              {a.uninstall.title}
            </span>
            <span className="block text-[12px] leading-relaxed text-muted">{a.uninstall.description}</span>
          </span>
          {!confirmingUninstall ? (
            <button
              type="button"
              onClick={() => setConfirmingUninstall(true)}
              disabled={uninstalling}
              className="flex-shrink-0 inline-flex items-center gap-1.5 h-[34px] px-3.5 rounded-[9px] text-[12px] font-medium border bg-elevated transition-colors hover:bg-[hsl(var(--ember)/0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ember))]"
              style={{ borderColor: "hsl(var(--ember) / 0.4)", color: "hsl(var(--ember))" }}
            >
              <Trash2 className="h-3 w-3" strokeWidth={2.4} />
              {a.uninstall.button}
            </button>
          ) : (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setConfirmingUninstall(false)}
                disabled={uninstalling}
                className="inline-flex items-center h-[34px] px-3 rounded-[9px] text-[12px] text-soft hover:bg-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sand))]"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={triggerUninstall}
                disabled={uninstalling}
                className="inline-flex items-center gap-1.5 h-[34px] px-3.5 rounded-[9px] text-[12px] font-medium text-white transition-opacity hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ember))]"
                style={{ background: "hsl(var(--ember))" }}
              >
                {uninstalling ? (
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.4} />
                ) : (
                  <Trash2 className="h-3 w-3" strokeWidth={2.4} />
                )}
                {uninstalling ? a.uninstall.launching : t.common.continue}
              </button>
            </div>
          )}
        </div>
      </motion.section>

      <footer className="pt-2 text-center text-[11.5px] text-muted">{a.credit}</footer>
    </div>
  );
}

function Step({ num, title, description }: { num: string; title: string; description: string }) {
  return (
    <div className="card rounded-[14px] p-4 space-y-2 min-h-[132px]">
      <span
        className="h-[26px] w-[26px] rounded-lg flex items-center justify-center font-mono text-[12px] font-medium text-sand"
        style={{ background: "hsl(var(--sand-soft))" }}
      >
        {num}
      </span>
      <div className="text-[13px] font-semibold tracking-tight text-app">{title}</div>
      <p className="text-[12px] leading-relaxed text-muted">{description}</p>
    </div>
  );
}
