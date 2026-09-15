"use client";

import { CandidateStage, EngagementStatus } from "@/lib/api";
import { STAGE_META, STATUS_META } from "./stages";
import { useI18n } from "@/lib/i18n";

export function StageBadge({ stage }: { stage: CandidateStage }) {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const meta = STAGE_META[stage] ?? { label: stage, labelZh: stage, pill: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" };
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${meta.pill}`}
    >
      {isZh ? meta.labelZh : meta.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: EngagementStatus }) {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const meta = STATUS_META[status] ?? {
    label: status,
    labelZh: status,
    pill: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  };
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${meta.pill}`}
    >
      {isZh ? meta.labelZh : meta.label}
    </span>
  );
}
