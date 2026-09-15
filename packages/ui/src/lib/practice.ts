// Shared presentation helpers for practice-cockpit cards, used by both the
// /clients cockpit board and the briefing's "Across your clients" panel so
// the two surfaces can never drift.

import type { ClientCockpitCard } from "@/lib/api";
import { DEFAULT_LOCALE, translate } from "@/locales";

// Renewal badge thresholds (days until renewal_date).
export const RENEWAL_WARN_DAYS = 30;
export const RENEWAL_URGENT_DAYS = 7;

export function renewalBadge(
  daysToRenewal: number | null | undefined,
  locale: string = DEFAULT_LOCALE,
): { label: string; urgent: boolean } | null {
  if (typeof daysToRenewal !== "number" || daysToRenewal > RENEWAL_WARN_DAYS) {
    return null;
  }
  const label =
    daysToRenewal <= 0
      ? translate(locale, "practice.renewalDue")
      : translate(locale, "practice.renewalIn", { days: daysToRenewal });

  return {
    label,
    urgent: daysToRenewal <= RENEWAL_URGENT_DAYS,
  };
}

// One-line status summary for a card: counts that need attention, or the
// card's degraded/inactive state, plus the staleness stamp for parked cards.
export function clientCountsSummary(c: ClientCockpitCard, locale: string = DEFAULT_LOCALE): string {
  if (c.error) return translate(locale, "practice.unavailable");
  if (!c.has_state) return translate(locale, "practice.notActivated");
  const counts =
    [
      c.overdue_actions ? translate(locale, "practice.overdue", { count: c.overdue_actions }) : null,
      c.awaiting_replies ? translate(locale, "practice.awaitingReply", { count: c.awaiting_replies }) : null,
      c.unread_alerts ? translate(locale, "practice.alerts", { count: c.unread_alerts }) : null,
      c.onboarding_due_soon ? translate(locale, "practice.onboardingDue", { count: c.onboarding_due_soon }) : null,
    ]
      .filter(Boolean)
      .join(" · ") || translate(locale, "practice.allQuiet");

  const stamp =
    !c.is_active && c.saved_at
      ? translate(locale, "practice.asOf", {
          date: new Date(c.saved_at).toLocaleDateString(locale),
        })
      : "";
  return counts + stamp;
}
