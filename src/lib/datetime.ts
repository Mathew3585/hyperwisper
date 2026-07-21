import type { Dictionary } from "@/i18n";

/**
 * Relative timestamp for a dictation, e.g. "just now", "12 min ago", "3 h ago".
 *
 * The dashboard and the history list both render this. They used to carry
 * their own copies, which drifted apart (one said "il y a 3h", the other
 * "il y a 3 h") — this is the single implementation both call now.
 *
 * Past 24 hours the relative form stops being useful, so we fall back to an
 * absolute day/month formatted for the active UI locale.
 */
export function formatRelativeTime(
  timestamp: number,
  t: Dictionary,
  intlLocale: string,
  options: { withTime?: boolean } = {},
): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return t.time.justNow;
  if (diff < 3_600_000) return t.time.minutesAgo(Math.floor(diff / 60_000));
  if (diff < 86_400_000) return t.time.hoursAgo(Math.floor(diff / 3_600_000));

  // The two call sites want different precision past 24h, and collapsing
  // them onto one format lost information: the history list is a log, where
  // "12 Mar, 14:35" distinguishes entries the dashboard never has to.
  return new Date(timestamp).toLocaleString(intlLocale, {
    day: "2-digit",
    month: "short",
    ...(options.withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
