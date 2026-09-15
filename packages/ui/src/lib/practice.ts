// Shared presentation helpers for practice-cockpit cards, used by both the
// /clients cockpit board and the briefing's "Across your clients" panel so
// the two surfaces can never drift.

import type { ClientCockpitCard } from "@/lib/api";

// Renewal badge thresholds (days until renewal_date).
export const RENEWAL_WARN_DAYS = 30;
export const RENEWAL_URGENT_DAYS = 7;

export function renewalBadge(
  daysToRenewal: number | null | undefined,
  locale?: string,
): { label: string; urgent: boolean } | null {
  if (typeof daysToRenewal !== "number" || daysToRenewal > RENEWAL_WARN_DAYS) {
    return null;
  }
  const isZh = locale === "zh";
  const label = isZh
    ? daysToRenewal <= 0
      ? "续约已到期"
      : `${daysToRenewal} 天后续约`
    : daysToRenewal <= 0
    ? "renewal due"
    : `renewal in ${daysToRenewal}d`;

  return {
    label,
    urgent: daysToRenewal <= RENEWAL_URGENT_DAYS,
  };
}

// One-line status summary for a card: counts that need attention, or the
// card's degraded/inactive state, plus the staleness stamp for parked cards.
export function clientCountsSummary(c: ClientCockpitCard, locale?: string): string {
  const isZh = locale === "zh";
  if (c.error) return isZh ? "状态不可用" : "status unavailable";
  if (!c.has_state) return isZh ? "尚未激活" : "not yet activated";
  const counts =
    [
      c.overdue_actions ? (isZh ? `${c.overdue_actions} 项逾期` : `${c.overdue_actions} overdue`) : null,
      c.awaiting_replies ? (isZh ? `${c.awaiting_replies} 项等待回复` : `${c.awaiting_replies} awaiting reply`) : null,
      c.unread_alerts ? (isZh ? `${c.unread_alerts} 条告警` : `${c.unread_alerts} alerts`) : null,
      c.onboarding_due_soon ? (isZh ? `${c.onboarding_due_soon} 项待办入职` : `${c.onboarding_due_soon} onboarding due`) : null,
    ]
      .filter(Boolean)
      .join(" · ") || (isZh ? "一切正常" : "all quiet");
  const stamp =
    !c.is_active && c.saved_at
      ? isZh
        ? ` · 截至 ${new Date(c.saved_at).toLocaleDateString("zh-CN")}`
        : ` · as of ${new Date(c.saved_at).toLocaleDateString()}`
      : "";
  return counts + stamp;
}
