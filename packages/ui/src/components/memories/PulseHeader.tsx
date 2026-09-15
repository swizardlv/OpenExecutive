"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getActivityDaily,
  listAdvice,
  listDecisions,
  listInitiatives,
  listScheduledActions,
  type DailyActivityCount,
  type ScheduledAction,
} from "@/lib/api";
import {
  LivePulse,
  Skeleton,
  StatTile,
  formatRunAt,
  groupByRhythm,
  metaFor,
} from "./shared";

import { useI18n } from "@/lib/i18n";

// The Pulse header is the page's at-a-glance band: a strip of headline metrics
// plus the "heartbeat" — a GitHub-contributions-style heatmap of the
// Executive's self-initiated activity over the last 90 days. Every metric is
// derived from data the page already needs (pending scheduled actions + the
// three memory lists); only the per-day heatmap requires its own endpoint,
// since /today/activity returns the last-N items, not a daily timeline.

const HEATMAP_DAYS = 90;

interface HeaderData {
  pending: ScheduledAction[];
  memoriesTotal: number;
  heatmap: DailyActivityCount[];
}

export default function PulseHeader() {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const [data, setData] = useState<HeaderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);

    Promise.all([
      listScheduledActions("pending", 200, controller.signal),
      listDecisions(),
      listInitiatives(),
      listAdvice(),
      getActivityDaily(HEATMAP_DAYS, controller.signal),
    ])
      .then(([pending, decisions, initiatives, advice, daily]) => {
        if (cancelled) return;
        setData({
          pending,
          memoriesTotal: decisions.length + initiatives.length + advice.length,
          heatmap: daily.days,
        });
      })
      .catch((err) => {
        if ((err as Error)?.name !== "AbortError" && !cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const stats = useMemo(() => (data ? deriveStats(data, isZh) : null), [data, isZh]);

  return (
    <header className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">{isZh ? "状态脉搏" : "Pulse"}</h1>
        <p className="text-sm text-fg-muted mt-1 max-w-2xl">
          {isZh
            ? "执行团队长期记忆与运营脉搏 — 了解已知事实，并查看在您离开时自主执行的每日简报、反思与部门巡检。"
            : "What the Executive knows, and the rhythm it runs on — the briefs, reflections, and check-ins that fire on their own while you're away."}
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {loading || !stats
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-line bg-surface-elevated px-4 py-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-10 mt-2" />
              </div>
            ))
          : stats.map((s) => (
              <StatTile
                key={s.label}
                label={s.label}
                value={s.value}
                hint={s.hint}
                tone={s.tone}
              />
            ))}
      </div>

      {/* Heartbeat heatmap */}
      <section className="rounded-xl border border-line bg-surface-elevated p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-fg">{isZh ? "执行心跳" : "Heartbeat"}</h2>
            <span className="text-xs text-fg-subtle">{isZh ? `最近 ${HEATMAP_DAYS} 天` : `last ${HEATMAP_DAYS} days`}</span>
          </div>
          <LivePulse />
        </div>
        {loading || !data ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <Heatmap days={data.heatmap} isZh={isZh} />
        )}
      </section>
    </header>
  );
}

// --------------------------------------------------------------------------- #
// Stat derivation
// --------------------------------------------------------------------------- #

interface Stat {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "accent" | "emerald" | "amber";
}

function deriveStats({ pending, memoriesTotal, heatmap }: HeaderData, isZh: boolean): Stat[] {
  const groups = groupByRhythm(pending);
  const followups = pending.filter((a) => a.kind === "ad_hoc").length;

  // Soonest pending fire = the literal "next beat".
  const soonest = pending.reduce<ScheduledAction | null>((best, a) => {
    if (!best) return a;
    return a.run_at.localeCompare(best.run_at) < 0 ? a : best;
  }, null);
  const nextBeat = soonest
    ? { value: formatRunAt(soonest.run_at).relative || (isZh ? "即将" : "soon"), hint: metaFor(soonest).label }
    : { value: "—", hint: isZh ? "暂无排期" : "nothing scheduled" };

  // The heatmap is oldest → newest, so the last entry is today.
  const beatsToday = heatmap.length > 0 ? heatmap[heatmap.length - 1].count : 0;

  return [
    { label: isZh ? "今日心跳" : "Beats today", value: beatsToday, tone: "emerald", hint: isZh ? "已执行动作" : "actions fired" },
    { label: isZh ? "下次心跳" : "Next beat", value: nextBeat.value, tone: "accent", hint: nextBeat.hint },
    { label: isZh ? "日常节律" : "Daily rhythms", value: groups.daily.length },
    { label: isZh ? "部门巡检" : "Dept check-ins", value: groups.departments.length },
    { label: isZh ? "待跟进项" : "Follow-ups", value: followups },
    { label: isZh ? "记忆条目" : "Memories", value: memoriesTotal },
  ];
}

// --------------------------------------------------------------------------- #
// Heatmap — GitHub-contributions-style grid (weeks as columns, weekdays as rows)
// --------------------------------------------------------------------------- #

// Intensity → background. Step 0 is an idle cell (surface), 1–4 ramp emerald.
// These read correctly in both light and dark mode.
const LEVEL_BG = [
  "bg-surface-input/60",
  "bg-emerald-500/30",
  "bg-emerald-500/55",
  "bg-emerald-400/80",
  "bg-emerald-400",
];

// Inclusive upper bound of each non-max step; a day's count maps to the first
// step it fits under, else the top level. Length is LEVEL_BG.length − 1 so the
// two arrays stay in lockstep (steps 0..3 here, step 4 = "more than 6").
const INTENSITY_STOPS = [0, 1, 3, 6];

function intensity(count: number): number {
  for (let i = 0; i < INTENSITY_STOPS.length; i++) {
    if (count <= INTENSITY_STOPS[i]) return i;
  }
  return INTENSITY_STOPS.length; // top level (= LEVEL_BG.length − 1)
}

/** UTC weekday (0=Sun) of a YYYY-MM-DD date string. */
function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Chunk the dense day list into weekday-aligned columns of 7. */
function toWeeks(days: DailyActivityCount[]): (DailyActivityCount | null)[][] {
  if (days.length === 0) return [];
  const cells: (DailyActivityCount | null)[] = [];
  for (let i = 0; i < weekday(days[0].date); i++) cells.push(null); // lead padding
  cells.push(...days);
  while (cells.length % 7 !== 0) cells.push(null); // trailing padding
  const weeks: (DailyActivityCount | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function Heatmap({ days, isZh = false }: { days: DailyActivityCount[]; isZh?: boolean }) {
  const weeks = useMemo(() => toWeeks(days), [days]);
  const total = useMemo(() => days.reduce((n, d) => n + d.count, 0), [days]);

  return (
    <div>
      <div
        className="flex gap-1 overflow-x-auto pb-1"
        role="img"
        aria-label={`Activity heatmap: ${total} actions over the last ${days.length} days`}
      >
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((cell, di) =>
              cell === null ? (
                <div key={di} className="h-3 w-3" />
              ) : (
                <div
                  key={di}
                  className={`h-3 w-3 rounded-[3px] ${LEVEL_BG[intensity(cell.count)]}`}
                  title={`${cell.date}: ${cell.count} ${cell.count === 1 ? "action" : "actions"}`}
                  aria-label={`${cell.date}: ${cell.count} ${cell.count === 1 ? "action" : "actions"}`}
                />
              ),
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-2 text-[11px] text-fg-subtle">
        <span>{isZh ? "较少" : "less"}</span>
        {LEVEL_BG.map((bg, i) => (
          <span key={i} className={`h-3 w-3 rounded-[3px] ${bg}`} aria-hidden="true" />
        ))}
        <span>{isZh ? "较多" : "more"}</span>
      </div>
    </div>
  );
}
