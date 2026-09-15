"use client";

import { useState } from "react";
import {
  searchKnowledge,
  type KnowledgeSearchHit,
  type KnowledgeSearchResponse,
  type KnowledgeSourceType,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

interface QueryPanelProps {
  domains: string[];
  onOpenFile?: (kind: "builtin" | "failures", domain: string, filename: string) => void;
}

const ALL_SOURCES: KnowledgeSourceType[] = ["builtin", "company", "failures", "external"];

export default function QueryPanel({ domains, onOpenFile }: QueryPanelProps) {
  const { locale, t } = useI18n();

  const specialistsList = [
    { id: "", label: t("knowledge.QueryPanel.all_specialists") },
    { id: "cso", label: t("knowledge.QueryPanel.cso_strategy") },
    { id: "cfo", label: t("knowledge.QueryPanel.cfo_finance") },
    { id: "chro", label: t("knowledge.QueryPanel.chro_hr") },
    { id: "gc", label: t("knowledge.QueryPanel.gc_legal") },
    { id: "coo", label: t("knowledge.QueryPanel.coo_operations") },
    { id: "cmo", label: t("knowledge.QueryPanel.cmo_marketing") },
    { id: "cpo", label: t("knowledge.QueryPanel.cpo_product_strategy") },
    { id: "board_comms", label: t("knowledge.QueryPanel.board_comms_board_finance") },
  ];

  const sourceLabels: Record<KnowledgeSourceType, string> = {
    builtin: t("knowledge.QueryPanel.builtin"),
    company: t("knowledge.QueryPanel.company"),
    failures: t("knowledge.QueryPanel.failures_2"),
    external: t("knowledge.QueryPanel.external"),
  };

  const [query, setQuery] = useState("");
  const [specialist, setSpecialist] = useState("");
  const [includes, setIncludes] = useState<Set<KnowledgeSourceType>>(new Set(ALL_SOURCES));
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<KnowledgeSearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!query.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await searchKnowledge({
        query: query.trim(),
        specialist: specialist || undefined,
        domain_filter: selectedDomains.size > 0 ? Array.from(selectedDomains) : undefined,
        include: Array.from(includes),
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : (t("knowledge.QueryPanel.search_failed")));
    } finally {
      setRunning(false);
    }
  }

  function toggleInclude(t: KnowledgeSourceType) {
    setIncludes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function toggleDomain(d: string) {
    setSelectedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div>
        <h2 className="text-base font-semibold text-fg">{t("knowledge.QueryPanel.query_mode")}</h2>
        <p className="text-xs text-fg-muted mt-1">
          {t("knowledge.QueryPanel.test_what_the_executive_would")}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-surface-elevated/40 p-4">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                run();
              }
            }}
            placeholder={t("knowledge.QueryPanel.eg_how_should_we_think")}
            className="flex-1 rounded-lg border border-line-strong bg-surface-elevated px-3 py-2 text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          <button
            onClick={run}
            disabled={!query.trim() || running}
            className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white text-sm font-medium transition-colors"
          >
            {running ? (t("knowledge.QueryPanel.running")) : (t("knowledge.QueryPanel.run"))}
          </button>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[11px] uppercase tracking-widest text-fg-muted">
              {t("knowledge.QueryPanel.specialist")}
            </label>
            <select
              value={specialist}
              onChange={(e) => setSpecialist(e.target.value)}
              className="rounded-lg border border-line-strong bg-surface-elevated px-2 py-1 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              {specialistsList.map((s) => (
                <option key={s.id || "all"} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[11px] uppercase tracking-widest text-fg-muted">
              {t("knowledge.QueryPanel.include")}
            </label>
            {ALL_SOURCES.map((t) => (
              <button
                key={t}
                onClick={() => toggleInclude(t)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  includes.has(t)
                    ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/40"
                    : "bg-surface-overlay/40 text-fg-muted border-line-strong"
                }`}
              >
                {sourceLabels[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[11px] uppercase tracking-widest text-fg-muted">
            {t("knowledge.QueryPanel.domains")}
          </label>
          {domains.map((d) => (
            <button
              key={d}
              onClick={() => toggleDomain(d)}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                selectedDomains.has(d)
                  ? "bg-surface-input text-fg border-line-strong"
                  : "bg-surface-overlay/40 text-fg-muted border-line-strong hover:text-fg"
              }`}
            >
              {d}
            </button>
          ))}
          {selectedDomains.size > 0 && (
            <button
              onClick={() => setSelectedDomains(new Set())}
              className="text-xs text-fg-muted hover:text-fg underline-offset-2 hover:underline"
            >
              {t("knowledge.QueryPanel.clear")}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 px-4 py-3 rounded-xl bg-red-950/40 border border-red-900/60">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <div className="text-xs text-fg-muted space-y-1">
            {result.effective_domains && result.effective_domains.length > 0 ? (
              <p>
                <span className="text-fg-muted">{t("knowledge.QueryPanel.domain_filter")}</span>{" "}
                {result.effective_domains.join(", ")}
              </p>
            ) : (
              <p>
                <span className="text-fg-muted">{t("knowledge.QueryPanel.domain_filter")}</span> {t("knowledge.QueryPanel.none_all_domains")}
              </p>
            )}
            <p>
              <span className="text-fg-muted">{t("knowledge.QueryPanel.specialists_that_would_see_these")}</span>{" "}
              {result.specialists_that_would_see_this.join(", ") || "—"}
            </p>
          </div>

          <ResultGroup
            title={t("knowledge.QueryPanel.playbooks")}
            kind="builtin"
            hits={result.builtin}
            accent="indigo"
            onOpenFile={onOpenFile}
          />
          <ResultGroup
            title={t("knowledge.QueryPanel.failures")}
            kind="failures"
            hits={result.failures}
            accent="rose"
            onOpenFile={onOpenFile}
          />
          <ResultGroup
            title={t("knowledge.QueryPanel.company_documents")}
            kind="company"
            hits={result.company}
            accent="emerald"
          />
          <ResultGroup
            title={t("knowledge.QueryPanel.reference_library")}
            kind="external"
            hits={result.external}
            accent="amber"
          />
        </div>
      )}
    </div>
  );
}

function ResultGroup({
  title,
  kind,
  hits,
  accent,
  onOpenFile,
}: {
  title: string;
  kind: "builtin" | "failures" | "company" | "external";
  hits: KnowledgeSearchHit[];
  accent: "indigo" | "rose" | "emerald" | "amber";
  onOpenFile?: (kind: "builtin" | "failures", domain: string, filename: string) => void;
}) {
  const { locale, t } = useI18n();
  const accentClass = {
    indigo: "text-indigo-400 border-l-indigo-500/40",
    rose: "text-rose-400 border-l-rose-500/50",
    emerald: "text-emerald-400 border-l-emerald-500/40",
    amber: "text-amber-400 border-l-amber-500/40",
  }[accent];
  const isOpenable = kind === "builtin" || kind === "failures";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className={`text-xs font-semibold uppercase tracking-widest ${accentClass.split(" ")[0]}`}>
          {title}
        </h3>
        <span className="text-[10px] text-fg-subtle">
          {hits.length} {t("knowledge.QueryPanel.hithits_length_____1_________s", { hits_length_____1_________s: hits.length === 1 ? "" : "s" })}
        </span>
      </div>
      {hits.length === 0 ? (
        <p className="text-xs text-fg-subtle">{t("knowledge.QueryPanel.no_matches")}</p>
      ) : (
        <div className="space-y-2">
          {hits.map((h, i) => (
            <div
              key={`${kind}-${h.filename}-${h.chunk_index ?? i}`}
              className={`rounded-lg bg-surface-elevated/60 border border-line border-l-2 px-3 py-2 ${accentClass}`}
            >
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div className="flex items-baseline gap-2 flex-wrap text-xs">
                  <span className="text-fg font-medium">{h.filename}</span>
                  <span className="text-fg-muted">·</span>
                  <span className="text-fg-muted">{h.domain}</span>
                  {h.publisher && (
                    <>
                      <span className="text-fg-muted">·</span>
                      <span className="text-fg-muted">{h.publisher}</span>
                    </>
                  )}
                  <span className="text-fg-muted">·</span>
                  <span className="text-fg-muted">{t("knowledge.QueryPanel.dist_h_distance_tofixed_3", { h_distance_toFixed_3: h.distance.toFixed(3) })}</span>
                </div>
                {isOpenable && onOpenFile && (
                  <button
                    onClick={() => onOpenFile(kind, h.domain, h.filename)}
                    className="text-[10px] text-fg-muted hover:text-fg transition-colors"
                  >
                    {t("knowledge.QueryPanel.open")}
                  </button>
                )}
              </div>
              <p className="text-xs text-fg mt-1.5 whitespace-pre-wrap leading-relaxed">
                {h.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
