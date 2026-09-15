"use client";

import { CandidateStage, EngagementStatus } from "@/lib/api";
import { STAGE_META, STATUS_META } from "./stages";
import { useI18n } from "@/lib/i18n";

export function StageBadge({ stage }: { stage: CandidateStage }) {
  const { t } = useI18n();
  const meta = STAGE_META[stage] ?? { label: stage, pill: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30" };
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${meta.pill}`}
    >
      {t(`talent.stage.${stage}`, meta.label)}
    </span>
  );
}

export function StatusBadge({ status }: { status: EngagementStatus }) {
  const { t } = useI18n();
  const meta = STATUS_META[status] ?? {
    label: status,
    pill: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30",
  };
  return (
    <span
      className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${meta.pill}`}
    >
      {t(`talent.status.${status}`, meta.label)}
    </span>
  );
}
