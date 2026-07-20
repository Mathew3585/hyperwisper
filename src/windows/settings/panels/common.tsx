/**
 * Shared primitives used across every panel — keep them dumb so the
 * "Quiet Premium" aesthetic stays consistent.
 */

export function PanelHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1.5">
      <h2 className="text-[20px] font-semibold tracking-[-0.022em] text-app">
        {title}
      </h2>
      {description && (
        <p className="text-[13px] text-muted leading-relaxed max-w-[44ch]">
          {description}
        </p>
      )}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 text-[11px] font-mono font-medium rounded border border-app bg-subtle text-soft tracking-tight">
      {children}
    </kbd>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] uppercase tracking-[0.1em] font-medium text-faint">
      {children}
    </div>
  );
}
