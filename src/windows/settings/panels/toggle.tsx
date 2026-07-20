import { motion } from "framer-motion";

/**
 * Pixel-perfect toggle: 22×40 track, 16 px knob, balanced 2 px margins.
 * Knob position animates via `left` so the spring doesn't fight Tailwind's
 * vertical translate on the same `transform`.
 */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative h-[22px] w-[40px] rounded-full transition-colors duration-200 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--sand))] focus-visible:ring-offset-[hsl(var(--bg))]"
      style={{
        background: checked ? "hsl(var(--sand))" : "hsl(var(--bg-subtle))",
        border: "1px solid hsl(var(--border))",
      }}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <motion.span
        initial={false}
        animate={{ left: checked ? 21 : 2 }}
        transition={{ type: "spring", stiffness: 600, damping: 32 }}
        className="absolute top-1/2 -translate-y-1/2 h-[16px] w-[16px] rounded-full"
        style={{
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.12)",
        }}
      />
    </button>
  );
}
