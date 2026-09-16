"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { DebugEvent, DebugEventKind } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface DebugPanelProps {
  events: DebugEvent[];
  onClose: () => void;
  isLive?: boolean;
}

const SPECIALIST_LABELS: Record<string, string> = {
  cso: "CSO",
  cfo: "CFO",
  chro: "CHRO",
  gc: "GC",
  coo: "COO",
  cmo: "CMO",
  cpo: "CPO",
  board_comms: "BoardComms",
};

// Icon paths — no labels here; labels come from i18n keys at render time
const KIND_ICONS: Record<
  DebugEventKind,
  { border: string; text: string; icon: string }
> = {
  knowledge_retrieved: {
    border: "border-l-emerald-500",
    text: "text-emerald-400",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
  },
  routing_decision: {
    border: "border-l-violet-500",
    text: "text-violet-400",
    icon: "M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5",
  },
  specialist_start: {
    border: "border-l-indigo-500",
    text: "text-indigo-400",
    icon: "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z",
  },
  specialist_done: {
    border: "border-l-indigo-300",
    text: "text-indigo-300",
    icon: "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
  synthesis_start: {
    border: "border-l-amber-500",
    text: "text-amber-400",
    icon: "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z",
  },
  skill_invocation: {
    border: "border-l-sky-500",
    text: "text-sky-400",
    icon: "M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25",
  },
  synthesis_done: {
    border: "border-l-emerald-400",
    text: "text-emerald-400",
    icon: "M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z",
  },
  turn_complete: {
    border: "border-l-emerald-500",
    text: "text-emerald-400",
    icon: "M5 13l4 4L19 7",
  },
  turn_error: {
    border: "border-l-rose-500",
    text: "text-rose-400",
    icon: "M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z",
  },
  committee_review_start: {
    border: "border-l-fuchsia-500",
    text: "text-fuchsia-400",
    icon: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z",
  },
  committee_review_done: {
    border: "border-l-fuchsia-400",
    text: "text-fuchsia-300",
    icon: "M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125",
  },
  committee_revision_start: {
    border: "border-l-fuchsia-500",
    text: "text-fuchsia-400",
    icon: "M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42",
  },
};

function summarize(event: DebugEvent, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const d = event.data;
  switch (event.kind) {
    case "knowledge_retrieved": {
      const sources = (d.sources as string[]) ?? [];
      const count = (d.chunk_count as number) ?? sources.length;
      return t("debug.knowledgeRetrieved", { count, sources: sources.length });
    }
    case "routing_decision": {
      const specialists = (d.specialists as { specialist: string }[]) ?? [];
      const names = specialists.map((s) => SPECIALIST_LABELS[s.specialist] ?? s.specialist).join(", ");
      return t("debug.routingTo", { names });
    }
    case "specialist_start": {
      const label = SPECIALIST_LABELS[d.specialist as string] ?? (d.specialist as string);
      return t("debug.specialistAnalyzing", { label });
    }
    case "specialist_done": {
      const label = SPECIALIST_LABELS[d.specialist as string] ?? (d.specialist as string);
      return t("debug.specialistDone", { label, ms: Number(d.duration_ms ?? 0), chars: Number(d.response_length ?? 0) });
    }
    case "skill_invocation": {
      const calls = (d.calls as { tool: string }[]) ?? [];
      const tools = calls.map((c) => c.tool).join(", ");
      return t("debug.skillInvocation", { count: calls.length, tools: tools || "" });
    }
    case "synthesis_start":
      return t("debug.synthesizing", { count: Number(d.specialist_count ?? 0) });
    case "synthesis_done":
      return t("debug.synthesizingDone", { ms: Number(d.total_duration_ms ?? 0) });
    case "turn_complete":
      return t("debug.turnComplete", { chunks: Number(d.chunks ?? 0), s: Number(d.duration_s ?? 0) });
    case "turn_error":
      return t("debug.turnError", { reason: String(d.reason ?? t("debug.unknown")) });
    case "committee_review_start": {
      const reviewers = (d.reviewers as string[]) ?? [];
      const friendly = reviewers
        .map((r) => r.replace(/_domain$/, "").replace(/_judge$/, ""))
        .map((r) => SPECIALIST_LABELS[r] ?? r);
      return t("debug.committeeReviewing", { count: reviewers.length, names: friendly.join(", ") });
    }
    case "committee_review_done": {
      const critiques = (d.critiques as { severity: string }[] | undefined) ?? [];
      const counts: Record<string, number> = { high: 0, medium: 0, low: 0 };
      for (const c of critiques) counts[c.severity] = (counts[c.severity] ?? 0) + 1;
      const parts = (["high", "medium", "low"] as const)
        .filter((sev) => counts[sev] > 0)
        .map((sev) => `${counts[sev]} ${t(`debug.severity.${sev}`)}`);
      const summary = parts.length ? parts.join(", ") : t("debug.noCritiques");
      return t("debug.committeeVerdict", { summary, ms: Number(d.review_ms ?? 0) });
    }
    case "committee_revision_start":
      return t("debug.revising");
    default:
      return event.kind;
  }
}

function EventCard({ event, index }: { event: DebugEvent; index: number }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const cfg = KIND_ICONS[event.kind] ?? {
    border: "border-l-fg-subtle",
    text: "text-fg-muted",
    icon: "M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z",
  };

  // i18n key for the event type label
  const kindLabelKey = `debug.kind.${event.kind}`;

  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      className={`w-full text-left border-l-4 ${cfg.border} pl-3 pr-3 py-2.5 rounded-r-lg bg-surface-elevated/60 mb-1.5 hover:bg-surface-overlay/60 transition-colors cursor-pointer`}
    >
      <div className="flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
          className={`w-3.5 h-3.5 flex-shrink-0 ${cfg.text}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
        </svg>
        <span className={`text-[11px] font-medium ${cfg.text}`}>{t(kindLabelKey, event.kind)}</span>
        <span className="text-[10px] text-fg-muted font-mono ml-auto tabular-nums">
          +{event.ts.toFixed(2)}s
        </span>
        <Icon
          name="chevron-right"
          size="w-3 h-3"
          className={`text-fg-muted transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </div>
      <p className="text-[11px] text-fg-muted mt-0.5 leading-snug text-left">{summarize(event, t)}</p>
      {expanded && (
        <pre className="mt-2 p-2.5 bg-surface rounded-lg text-[10px] font-mono text-fg-muted leading-relaxed break-all whitespace-pre-wrap text-left">
          {JSON.stringify(event.data, null, 2)}
        </pre>
      )}
    </button>
  );
}

export default function DebugPanel({ events, onClose, isLive = false }: DebugPanelProps) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [events.length]);

  return (
    <aside
      className="
        fixed inset-y-0 right-0 z-30 w-full max-w-sm
        md:relative md:max-w-none md:w-72
        flex-shrink-0 border-l border-line bg-surface-elevated flex flex-col h-full
      "
      aria-label={t("debug.panelAriaLabel")}
    >
      <div className="h-14 border-b border-line flex items-center justify-between px-4 flex-shrink-0">
        <span className="text-[11px] font-semibold text-fg-muted tracking-wider uppercase flex items-center gap-2">
          {t("debug.panelTitle")}
          {isLive && (
            <span className="flex items-center gap-1 text-emerald-400 normal-case tracking-normal font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse motion-reduce:animate-none" />
              {t("debug.live")}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="min-h-touch min-w-touch flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-overlay transition-colors rounded cursor-pointer"
          aria-label={t("debug.closePanel")}
        >
          <Icon name="close" size="w-4 h-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-fg-muted text-xs text-center px-4">
            <Icon name="activity" size="w-6 h-6" className="mb-2 opacity-40" />
            {isLive ? t("debug.connecting") : t("debug.empty")}
          </div>
        ) : (
          events.map((event, i) => <EventCard key={i} event={event} index={i} />)
        )}
      </div>
    </aside>
  );
}
