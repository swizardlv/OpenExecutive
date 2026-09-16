import { DEFAULT_LOCALE } from "@/locales";

/**
 * Shared "N units ago" formatter.
 * Uses browser/runtime standard `Intl.RelativeTimeFormat` to support ANY locale dynamically.
 */
export function formatRelativeTime(iso: string, locale: string = DEFAULT_LOCALE): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    if (mins < 1) {
      return locale.startsWith("zh") ? "刚刚" : rtf.format(0, "minute");
    }
    if (mins < 60) return rtf.format(-mins, "minute");
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return rtf.format(-hrs, "hour");
    const days = Math.floor(hrs / 24);
    return rtf.format(-days, "day");
  } catch {
    // Fallback if Intl is unavailable
    if (mins < 1) return locale.startsWith("zh") ? "刚刚" : "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
}
