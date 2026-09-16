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

/**
 * ISO timestamp -> absolute string plus relative label ("in 5m" / "5分钟后", "3d ago" / "3天前").
 */
export function formatRunAt(
  iso: string,
  locale: string = DEFAULT_LOCALE
): { absolute: string; relative: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { absolute: iso, relative: "" };
  const absolute = d.toLocaleString(locale);
  const deltaMs = d.getTime() - Date.now();
  const abs = Math.abs(deltaMs);
  const mins = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "always" });
    let relative = "";
    if (mins < 60) {
      relative = rtf.format(deltaMs >= 0 ? mins : -mins, "minute");
    } else if (hours < 48) {
      relative = rtf.format(deltaMs >= 0 ? hours : -hours, "hour");
    } else {
      relative = rtf.format(deltaMs >= 0 ? days : -days, "day");
    }
    return { absolute, relative };
  } catch {
    let unit: string;
    if (mins < 60) unit = `${mins}m`;
    else if (hours < 48) unit = `${hours}h`;
    else unit = `${days}d`;
    const relative = deltaMs >= 0 ? `in ${unit}` : `${unit} ago`;
    return { absolute, relative };
  }
}
