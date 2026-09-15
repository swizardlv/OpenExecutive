// Shared display metadata for the staff-onboarding surfaces (list page, detail
// page, and the briefing panel), so the labels/colours never drift apart —
// mirrors how the talent vertical centralises its stage metadata in
// `components/talent/stages.ts`.
import type { OnboardingPhase, OnboardingStatus } from "@/lib/api";

export const STATUS_META: Record<OnboardingStatus, { label: string; labelZh: string; cls: string }> = {
  draft: { label: "Draft", labelZh: "草稿", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  active: { label: "Active", labelZh: "进行中", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  completed: { label: "Completed", labelZh: "已完成", cls: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
  archived: { label: "Archived", labelZh: "已归档", cls: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
};

export const PHASE_ORDER: OnboardingPhase[] = [
  "pre_start",
  "week_1",
  "day_30",
  "day_60",
  "day_90",
];

export const PHASE_LABEL: Record<OnboardingPhase, string> = {
  pre_start: "Pre-start",
  week_1: "Week 1",
  day_30: "Day 30",
  day_60: "Day 60",
  day_90: "Day 90",
};

export const PHASE_LABEL_ZH: Record<OnboardingPhase, string> = {
  pre_start: "入职前",
  week_1: "第 1 周",
  day_30: "第 30 天",
  day_60: "第 60 天",
  day_90: "第 90 天",
};

// Sort weight for grouping plans on the list page (active first).
export const STATUS_ORDER: Record<OnboardingStatus, number> = {
  active: 0,
  draft: 1,
  completed: 2,
  archived: 3,
};

// Tolerant lookups for values that arrive as plain strings from the briefing
// digest (which types phase/status loosely).
export function phaseLabel(phase: string, isZh?: boolean): string {
  if (isZh) {
    return PHASE_LABEL_ZH[phase as OnboardingPhase] ?? phase;
  }
  return PHASE_LABEL[phase as OnboardingPhase] ?? phase;
}

export function statusMeta(status: string): { label: string; labelZh: string; cls: string } {
  return STATUS_META[status as OnboardingStatus] ?? STATUS_META.draft;
}
