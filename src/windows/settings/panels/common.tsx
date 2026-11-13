/**
 * Shared primitives for the "Studio" layout: a page header, cards and the
 * small bits (keycaps, status chips) every panel reuses. Keep them dumb so
 * the panels stay visually consistent.
 */

export function PanelHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="space-y-1 min-w-0">
        <h1 className="text-[26px] leading-tight font-bold tracking-[-0.04em] text-app">
          {title}
        </h1>
        {description && (
          <p className="text-[13px] text-soft leading-relaxed max-w-[64ch]">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </header>
  );
}

/** Bold 13px heading used at the top of a card, with an optional right slot. */
export function CardTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-[13px] font-semibold tracking-tight text-app">{children}</h2>
      {action}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-mono font-medium rounded border border-app border-b-2 bg-subtle text-app tracking-tight">
      {children}
    </kbd>
  );
}

/**
 * A real-looking key. `accent` paints the bottom edge in sand — used on the
 * last key of the shortcut so the eye lands on it.
 */
export function KeyCap({
  children,
  accent,
  size = "md",
}: {
  children: React.ReactNode;
  accent?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dims =
    size === "lg"
      ? "h-11 min-w-[54px] px-4 text-[14px] rounded-[10px]"
      : size === "md"
      ? "h-8 min-w-[40px] px-3 text-[12.5px] rounded-lg"
      : "h-[26px] min-w-[30px] px-2 text-[11.5px] rounded-[7px]";
  return (
    <kbd
      className={`inline-flex items-center justify-center font-semibold font-sans tracking-tight bg-elevated text-app border border-app ${dims}`}
      style={{
        borderBottomWidth: 3,
        borderBottomColor: accent ? "hsl(var(--sand))" : "hsl(var(--border))",
      }}
    >
      {children}
    </kbd>
  );
}

/** "Ctrl+Shift+Space" → keycaps, the last one accented. */
export function HotkeyCaps({
  combo,
  size = "md",
}: {
  combo: string;
  size?: "sm" | "md" | "lg";
}) {
  const parts = combo.split("+").map((p) => p.trim()).filter(Boolean);
  return (
    <span className="inline-flex items-center gap-1.5">
      {parts.map((p, i) => (
        <span key={`${p}-${i}`} className="inline-flex items-center gap-1.5">
          <KeyCap size={size} accent={i === parts.length - 1}>
            {p}
          </KeyCap>
          {i < parts.length - 1 && <span className="text-muted text-[12px]">+</span>}
        </span>
      ))}
    </span>
  );
}

export type Tone = "ok" | "warn" | "error" | "neutral";

const TONE_STYLE: Record<Tone, { bg: string; fg: string; dot: string }> = {
  ok: { bg: "hsl(var(--moss) / 0.14)", fg: "hsl(var(--moss))", dot: "hsl(var(--moss))" },
  warn: { bg: "hsl(var(--sand) / 0.16)", fg: "hsl(var(--sand))", dot: "hsl(var(--sand))" },
  error: { bg: "hsl(var(--ember) / 0.14)", fg: "hsl(var(--ember))", dot: "hsl(var(--ember))" },
  neutral: { bg: "hsl(var(--bg-subtle))", fg: "hsl(var(--text-muted))", dot: "hsl(var(--text-faint))" },
};

/** Small rounded status pill with a leading dot. */
export function StatusChip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const s = TONE_STYLE[tone];
  return (
    <span
      className="inline-flex items-center gap-[7px] pl-2 pr-2.5 py-1 rounded-full text-[11.5px] font-semibold tracking-tight"
      style={{ background: s.bg, color: s.fg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
      {children}
    </span>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11.5px] font-medium text-muted">{children}</div>;
}

/** Secondary button: white, bordered. `danger` turns it red. */
export function GhostButton({
  children,
  onClick,
  disabled,
  danger,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1.5 h-[34px] px-3 rounded-[9px] border text-[12px] font-medium bg-elevated transition-colors disabled:opacity-60 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sand))] ${
        danger ? "hover:bg-[hsl(var(--ember)/0.08)]" : "border-app text-soft hover:bg-hover hover:text-app"
      }`}
      style={
        danger
          ? { borderColor: "hsl(var(--ember) / 0.35)", color: "hsl(var(--ember))" }
          : undefined
      }
    >
      {children}
    </button>
  );
}

/** Primary button: ink-filled in light mode, paper-filled in dark. */
export function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 h-[34px] px-3.5 rounded-[9px] text-[12px] font-medium transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sand))]"
      style={{ background: "hsl(var(--text))", color: "hsl(var(--bg))" }}
    >
      {children}
    </button>
  );
}
