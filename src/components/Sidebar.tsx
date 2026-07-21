import { motion } from "framer-motion";
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
}

export function Sidebar({ items, active, onSelect }: SidebarProps) {
  const t = useT();
  return (
    <aside className="w-[212px] flex-shrink-0 border-r border-app bg-app flex flex-col">
      {/* The nav is the whole sidebar now that the account card is gone. It
          scrolls on its own rather than stretching its buttons. */}
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
    </aside>
  );
}
