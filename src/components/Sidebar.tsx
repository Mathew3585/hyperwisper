import { motion } from "framer-motion";
import { Sparkle, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useT } from "@/i18n";

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface SidebarProps {
  items: NavItem[];
  active: string;
  onSelect: (id: string) => void;
  /** When set, the footer becomes a clickable account card that
   *  routes to the given panel id. */
  accountPanelId?: string;
}

export function Sidebar({
  items,
  active,
  onSelect,
  accountPanelId,
}: SidebarProps) {
  const t = useT();
  return (
    <aside className="w-[212px] flex-shrink-0 border-r border-app bg-app flex flex-col">
      <nav
        aria-label={t.sidebar.navAriaLabel}
        className="flex-1 px-2.5 pt-3 pb-2 space-y-px overflow-y-auto"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`relative w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))] ${
                isActive
                  ? "text-app bg-hover"
                  : "text-soft hover:bg-[hsl(var(--hover)/0.6)]"
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="sidebar-rail"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-sand"
                />
              )}
              <Icon className="h-3.5 w-3.5" strokeWidth={isActive ? 2.25 : 1.85} />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {accountPanelId && (
        <AccountFooter
          isActive={active === accountPanelId}
          onClick={() => onSelect(accountPanelId)}
        />
      )}
    </aside>
  );
}

function AccountFooter({
  isActive,
  onClick,
}: {
  isActive: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      aria-label={t.sidebar.accountAriaLabel}
      aria-current={isActive ? "page" : undefined}
      className={`border-t border-app p-2.5 group transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--sand))] ${
        isActive ? "bg-hover" : "hover:bg-[hsl(var(--hover)/0.5)]"
      }`}
    >
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <div
          className="flex items-center justify-center h-6 w-6 rounded-md flex-shrink-0"
          style={{
            background: "hsl(var(--sand-soft))",
            border: "1px solid hsl(var(--sand) / 0.25)",
          }}
        >
          <Sparkle className="h-3 w-3 text-sand" strokeWidth={2.4} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[11.5px] font-medium tracking-tight text-app leading-tight">
            Hyperwisper
          </div>
          <div className="text-[10px] tracking-[0.06em] uppercase font-medium text-faint mt-px">
            {t.sidebar.accountLabel}
          </div>
        </div>
        <ChevronRight
          className="h-3 w-3 text-faint group-hover:text-soft transition-colors flex-shrink-0"
          strokeWidth={2.2}
        />
      </div>
    </button>
  );
}
