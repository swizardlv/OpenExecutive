"use client";

// Shared helpers for the Pulse page (memory + cadence). Extracted from the
// former single-file EpisodicMemories component so the Cadence and Memory
// sections — and the redesigned PulseHeader — can reuse them without
// duplication. Holds three things: domain/format helpers, the scheduled-action
// "rhythm" taxonomy (used by both the header stat strip and CadenceSection),
// and a handful of presentational primitives (StatTile, LivePulse, etc.).

import Icon, { type IconName } from "@/components/Icon";
import type { ScheduledAction } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatRunAt } from "@/lib/relativeTime";

export { formatRunAt };

export const DOMAINS = [
  "strategy",
  "finance",
  "hr",
  "legal",
  "operations",
  "marketing",
  "product",
  "board",
  "general",
];

export const STATUSES = ["active", "paused", "completed", "planned"];

/** ISO timestamp → YYYY-MM-DD. */
export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export const STATUS_PILL: Record<string, string> = {
  pending: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  running: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  cancelled: "bg-surface-input/40 text-fg-muted border-line-strong/40",
};

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-fg-muted text-sm">{message}</div>
  );
}

// ---------------------------------------------------------------------------
// Rhythm taxonomy — turns raw scheduled_actions `kind` strings into the human
// rhythm groups shown on the Pulse page. Shared by PulseHeader (counts) and
// CadenceSection (cards). `ad_hoc` is intentionally absent from the groups: the
// Follow-ups block owns it (its own status filter + cancel).
// ---------------------------------------------------------------------------

export type RhythmGroup = "daily" | "departments" | "awaiting" | "system";

export interface KindMeta {
  label: string;
  group: RhythmGroup;
  blurb?: string;
}

export const KIND_META: Record<string, KindMeta> = {
  principal_brief_morning: {
    label: "Morning brief",
    group: "daily",
    blurb: "Whole-company state, sent to you each morning.",
  },
  executive_reflection: {
    label: "Executive reflection",
    group: "daily",
    blurb: "Decides what to act on, just before the morning brief.",
  },
  principal_brief_eod: {
    label: "End-of-day digest",
    group: "daily",
    blurb: "What landed today and what's still open.",
  },
  dept_cadence: { label: "Check-in", group: "departments" },
  awaiting_human: { label: "Awaiting a human reply", group: "awaiting" },
  proactive_nudge: { label: "Nudge", group: "awaiting" },
  nudge_scan: {
    label: "Nudge scan",
    group: "system",
    blurb: "Chases stalled commitments and idle initiatives.",
  },
  external_monitor_scan: {
    label: "External monitor",
    group: "system",
    blurb: "Watches the watch list for material signals.",
  },
  watchlist_research_scan: {
    label: "Watchlist research",
    group: "system",
    blurb: "Periodic research pass over your watch list.",
  },
};

export function metaFor(
  action: ScheduledAction,
  t?: (k: string, p?: any, fallback?: string) => string
): KindMeta {
  const base = KIND_META[action.kind];
  if (base) {
    if (!t) return base;
    return {
      group: base.group,
      label: t(`memories.kind.${action.kind}.label`, base.label),
      blurb: base.blurb ? t(`memories.kind.${action.kind}.blurb`, base.blurb) : undefined,
    };
  }
  return {
    label: action.kind || (t ? t("memories.kind.scheduled_action", "Scheduled action") : "Scheduled action"),
    group: action.channel === "__internal__" ? "system" : "awaiting",
  };
}

/** Group pending rows (excluding ad_hoc) by rhythm group, each sorted soonest-first. */
export function groupByRhythm(
  actions: ScheduledAction[],
): Record<RhythmGroup, ScheduledAction[]> {
  const groups: Record<RhythmGroup, ScheduledAction[]> = {
    daily: [],
    departments: [],
    awaiting: [],
    system: [],
  };
  for (const a of actions) {
    if (a.kind === "ad_hoc") continue;
    groups[metaFor(a).group].push(a);
  }
  for (const key of Object.keys(groups) as RhythmGroup[]) {
    groups[key].sort((x, y) => x.run_at.localeCompare(y.run_at));
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Presentational primitives — kept dependency-free and theme-token-driven so
// they render correctly in both light and dark mode.
// ---------------------------------------------------------------------------

type StatTone = "default" | "accent" | "emerald" | "amber";

const STAT_VALUE_TONE: Record<StatTone, string> = {
  default: "text-fg",
  accent: "text-indigo-300",
  emerald: "text-emerald-300",
  amber: "text-amber-300",
};

/** A single at-a-glance metric: small label, big number, optional hint. */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatTone;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface-elevated px-4 py-3 min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-fg-subtle truncate">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums truncate ${STAT_VALUE_TONE[tone]}`}>
        {value}
      </div>
      {hint && <div className="text-[11px] text-fg-muted mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

/**
 * "Live" indicator: a beating emerald dot + optional label. The ping animation
 * is disabled under `prefers-reduced-motion` via Tailwind's `motion-reduce`
 * variant (SSR-safe — no JS hook, no hydration mismatch). The solid dot always
 * shows, so the indicator never disappears, it just stops animating.
 */
export function LivePulse({
  label,
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  const { t } = useI18n();
  const displayLabel = label ?? t("memories.live", "Live");
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      {displayLabel && (
        <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-300">
          {displayLabel}
        </span>
      )}
    </span>
  );
}

export type TagTone = "info" | "muted";

const TAG_TONE: Record<TagTone, string> = {
  info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  muted: "bg-surface-input/40 text-fg-subtle border-line",
};

/** Small categorical pill (e.g. "Once a day · for you"). Reuses the app's pill recipe. */
export function Tag({ label, tone = "muted" }: { label: string; tone?: TagTone }) {
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${TAG_TONE[tone]}`}>
      {label}
    </span>
  );
}

const TITLE_MAP_ZH: Record<string, string> = {
  "In flight": "正在执行",
  "Executive search": "高管猎聘",
  "Across your clients": "客户企业",
  "Staff onboarding": "员工入职",
  "Monitoring": "监控清单",
  "Across the team": "团队其他事项",
  "Needs you": "待您处理",
  "Recent activity": "近期动态",
  "Cadence": "运行节拍",
  "Episodic memory": "情景记忆",
  "Handled": "已处理事项",
  "Departments": "部门架构",
  "People": "组织成员",
  "Follow-ups": "待跟进事项",
};

/** Section header: optional icon, title, optional count badge, optional tag pill, optional subtitle. */
export function SectionHeading({
  title,
  count,
  icon,
  tag,
  tagTone = "muted",
  subtitle,
}: {
  title: string;
  count?: number;
  icon?: IconName;
  tag?: string;
  tagTone?: TagTone;
  subtitle?: string;
}) {
  const { t } = useI18n();
  const displayTitle = t(`memories.section.${title}`, TITLE_MAP_ZH[title] || title);
  const displayTag = tag ? t(`memories.tag.${tag}`, tag) : undefined;

  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 flex-wrap">
        {icon && <Icon name={icon} size="w-4 h-4" className="text-fg-subtle" />}
        <h3 className="text-sm font-semibold text-fg">{displayTitle}</h3>
        {count != null && (
          <span className="text-xs font-normal tabular-nums text-fg-subtle">{count}</span>
        )}
        {displayTag && <Tag label={displayTag} tone={tagTone} />}
      </div>
      {subtitle && <p className="text-xs text-fg-muted mt-0.5">{subtitle}</p>}
    </div>
  );
}

/** Shimmer placeholder for >300ms loads. Honors reduced-motion. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse motion-reduce:animate-none rounded-md bg-surface-input/60 ${className}`}
      aria-hidden="true"
    />
  );
}
