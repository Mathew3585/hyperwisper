import { Sun, Moon, Monitor, Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Theme } from "@/lib/theme";
import { useT } from "@/i18n";
import { Logo } from "./Logo";

export interface NavItem {
  id: string;
  label: string;
}

interface TopbarProps {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  /** Section tabs. Omitted during onboarding, where there is nowhere to go. */
  nav?: NavItem[];
  active?: string;
  onSelect?: (id: string) => void;
}

/**
 * Title bar and navigation in one strip: brand on the left, section tabs in
 * the middle, theme + window controls on the right. The whole strip is a
 * drag region; the interactive parts opt out.
 */
export function Topbar({ theme, onThemeChange, nav, active, onSelect }: TopbarProps) {
  const t = useT();
  return (
    <header
      data-tauri-drag-region
      aria-label={t.topbar.ariaLabel}
      className="h-[54px] flex-shrink-0 pl-[18px] pr-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-soft bg-app select-none"
    >
      <div className="flex items-center gap-2.5 pointer-events-none min-w-0">
        <span className="h-7 w-7 flex-shrink-0 rounded-lg flex items-center justify-center bg-[#221d19] dark:bg-[hsl(var(--bg-subtle))]">
          <Logo size={16} className="text-[#d6995c]" />
        </span>
        <span className="hidden min-[900px]:inline text-[13.5px] font-semibold tracking-[-0.02em] text-app truncate">
          Hyperwisper
        </span>
      </div>

      {nav && nav.length > 0 ? (
        <nav
          data-tauri-drag-region="false"
          aria-label={t.sidebar.navAriaLabel}
          className="flex items-center gap-0.5 p-[3px] rounded-[11px] border border-app bg-subtle"
        >
          {nav.map((item) => {
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect?.(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={`h-[30px] px-3 rounded-lg border text-[12.5px] font-medium tracking-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sand))] ${
                  isActive
                    ? "bg-elevated border-app text-app"
                    : "border-transparent text-soft hover:text-app hover:bg-[hsl(var(--hover)/0.7)]"
                }`}
                style={isActive ? { boxShadow: "0 1px 2px rgba(60,35,15,0.10)" } : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      ) : (
        <span />
      )}

      <div data-tauri-drag-region="false" className="flex items-center justify-end gap-0.5">
        <ThemeButton theme={theme} onChange={onThemeChange} />
        <WindowControls />
      </div>
    </header>
  );
}

const THEME_ORDER: Theme[] = ["light", "dark", "system"];

/** One button that cycles light → dark → system; the icon shows the current one. */
function ThemeButton({ theme, onChange }: { theme: Theme; onChange: (t: Theme) => void }) {
  const t = useT();
  const labels = { light: t.topbar.theme.light, dark: t.topbar.theme.dark, system: t.topbar.theme.system };
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
  const label = t.ui.themeCycle(labels[theme]);
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={label}
      aria-label={label}
      className="flex items-center justify-center h-7 w-[34px] rounded-[7px] text-soft hover:bg-hover hover:text-app transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sand))]"
    >
      <Icon className="h-[14px] w-[14px]" strokeWidth={2.1} />
    </button>
  );
}

function WindowControls() {
  const t = useT();
  const win = getCurrentWindow();
  return (
    <div className="flex items-center gap-px ml-0.5">
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
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center h-7 w-[34px] rounded-[7px] text-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--sand))] ${
        danger ? "hover:bg-[hsl(var(--ember)/0.15)] hover:text-ember" : "hover:bg-hover hover:text-app"
      }`}
    >
      {children}
    </button>
  );
}
