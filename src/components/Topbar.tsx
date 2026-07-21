import { Sun, Moon, Monitor, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Theme } from "@/lib/theme";
import { useT } from "@/i18n";
import { Logo } from "./Logo";

interface TopbarProps {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
}

export function Topbar({ theme, onThemeChange }: TopbarProps) {
  const t = useT();
  return (
    <header
      data-tauri-drag-region
      aria-label={t.topbar.ariaLabel}
      className="h-11 flex-shrink-0 px-3 flex items-center justify-between border-b border-app bg-app select-none"
    >
      <div className="flex items-baseline gap-2.5 pl-1 pointer-events-none">
        <Logo size={14} className="text-sand self-center" />
        <span className="text-[12.5px] font-medium tracking-tight text-app">hyperwisper</span>
        <span className="text-[10.5px] font-mono text-faint">v0.1</span>
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeToggle theme={theme} onChange={onThemeChange} />
        <WindowControls />
      </div>
    </header>
  );
}

function ThemeToggle({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const t = useT();
  const options = [
    { value: "light" as const, icon: Sun, label: t.topbar.theme.light },
    { value: "dark" as const, icon: Moon, label: t.topbar.theme.dark },
    { value: "system" as const, icon: Monitor, label: t.topbar.theme.system },
  ];
  return (
    <div
      data-tauri-drag-region="false"
      role="radiogroup"
      aria-label={t.topbar.theme.groupAriaLabel}
      className="flex items-center gap-px rounded-md border border-app p-0.5 bg-elevated"
    >
      {options.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            className={`p-1.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))] ${
              active
                ? "text-app bg-hover"
                : "text-faint hover:text-app hover:bg-[hsl(var(--hover)/0.5)]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
          </button>
        );
      })}
    </div>
  );
}

function WindowControls() {
  const t = useT();
  const win = getCurrentWindow();
  return (
    <div data-tauri-drag-region="false" className="flex items-center gap-px ml-1">
      <WindowButton onClick={() => win.minimize()} label={t.window.minimize}>
        <Minus className="h-3 w-3" strokeWidth={2.2} />
      </WindowButton>
      <WindowButton onClick={() => win.toggleMaximize()} label={t.window.maximize}>
        <Square className="h-2.5 w-2.5" strokeWidth={2.5} />
      </WindowButton>
      <WindowButton onClick={() => win.hide()} label={t.window.close} danger>
        <X className="h-3 w-3" strokeWidth={2.4} />
      </WindowButton>
    </div>
  );
}

function WindowButton({
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
