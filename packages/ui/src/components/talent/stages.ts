import { CandidateStage, EngagementStatus, OfferStatus } from "@/lib/api";

/** Display label + Tailwind pill classes for each candidate pipeline stage. */
export const STAGE_META: Record<CandidateStage, { label: string; labelZh: string; pill: string }> = {
  lead: { label: "Lead", labelZh: "候选线索", pill: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
  screened: { label: "Screened", labelZh: "初筛通过", pill: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  interviewed: {
    label: "Interviewed",
    labelZh: "已面试",
    pill: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  },
  offer: { label: "Offer", labelZh: "录用发函", pill: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  placed: { label: "Placed", labelZh: "成功入职", pill: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  rejected: { label: "Rejected", labelZh: "已淘汰", pill: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
};

/** The forward pipeline (excludes the `rejected` off-ramp), in board order. */
export const PIPELINE_STAGES: CandidateStage[] = [
  "lead",
  "screened",
  "interviewed",
  "offer",
  "placed",
];

export const STATUS_META: Record<EngagementStatus, { label: string; labelZh: string; pill: string }> = {
  open: { label: "Open", labelZh: "进行中", pill: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  on_hold: { label: "On hold", labelZh: "已暂缓", pill: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  filled: { label: "Filled", labelZh: "已满额", pill: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
  cancelled: { label: "Cancelled", labelZh: "已取消", pill: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
};

/** Display label + Tailwind pill classes for each offer status. */
export const OFFER_STATUS_META: Record<OfferStatus, { label: string; labelZh: string; pill: string }> = {
  draft: { label: "Draft", labelZh: "草稿", pill: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
  pending_approval: {
    label: "Pending sign-off",
    labelZh: "待审批",
    pill: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  },
  extended: { label: "Extended", labelZh: "已发送", pill: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  accepted: { label: "Accepted", labelZh: "已接受", pill: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  declined: { label: "Declined", labelZh: "已谢绝", pill: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  expired: { label: "Expired", labelZh: "已过期", pill: "bg-rose-500/20 text-rose-300 border-rose-500/30" },
  rescinded: { label: "Rescinded", labelZh: "已撤回", pill: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" },
};

/** Text color for a 0-100 fit score (or muted when unscored). */
export function fitScoreColor(score: number | null): string {
  if (score == null) return "text-fg-subtle";
  if (score >= 80) return "text-emerald-300";
  if (score >= 60) return "text-amber-300";
  return "text-rose-300";
}
