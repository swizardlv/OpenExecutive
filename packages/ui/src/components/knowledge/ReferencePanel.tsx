"use client";

import { useEffect, useState } from "react";
import {
  listExternalSources,
  peekExternalSource,
  type ExternalPeekChunk,
  type ExternalSourceInfo,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function ReferencePanel() {
  const { locale, t } = useI18n();
  const [sources, setSources] = useState<ExternalSourceInfo[] | null>(null);
  const [totalChunks, setTotalChunks] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [peeking, setPeeking] = useState<string | null>(null);
  const [peekChunks, setPeekChunks] = useState<ExternalPeekChunk[]>([]);
  const [peekError, setPeekError] = useState<string | null>(null);

  useEffect(() => {
    listExternalSources()
      .then((data) => {
        setSources(data.sources);
        setTotalChunks(data.total_chunks);
      })
      .catch(() => setError(t("knowledge.ReferencePanel.failed_to_load_reference_library")));
  }, [t]);

  async function handlePeek(id: string) {
    setPeeking(id);
    setPeekChunks([]);
    setPeekError(null);
    try {
      const data = await peekExternalSource(id, 5);
      setPeekChunks(data.chunks);
      if (data.chunks.length === 0) {
        setPeekError(
          t("knowledge.ReferencePanel.no_indexed_chunks_yet_run")
        );
      }
    } catch {
      setPeekError(t("knowledge.ReferencePanel.failed_to_load_chunks"));
    }
  }

  if (error) {
    return (
      <div className="text-sm text-red-400 px-4 py-3 rounded-xl bg-red-950/40 border border-red-900/60">
        {error}
      </div>
    );
  }
  if (sources === null) {
    return <p className="text-sm text-fg-muted">{t("knowledge.ReferencePanel.loading")}</p>;
  }

  const ingested = sources.filter((s) => s.is_ingested);
  const pending = sources.filter((s) => !s.is_ingested);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-fg">{t("knowledge.ReferencePanel.reference_library")}</h2>
        <p className="text-sm text-fg-muted mt-1">
          {t("knowledge.ReferencePanel.oer_desc")}
        </p>
        <p className="text-xs text-fg-muted mt-2">
          {t("knowledge.ReferencePanel.ingested_length_ingested_pending_length_pending_totalchunks_tolocalestring", { ingested_length: ingested.length, pending_length: pending.length, totalChunks_toLocaleString: totalChunks.toLocaleString() })}
        </p>
      </div>

      <div className="space-y-2">
        {sources.map((src) => (
          <SourceCard
            key={src.id}
            source={src}
            isExpanded={peeking === src.id}
            chunks={peeking === src.id ? peekChunks : []}
            peekError={peeking === src.id ? peekError : null}
            onPeek={() => handlePeek(src.id)}
            onCollapse={() => {
              setPeeking(null);
              setPeekChunks([]);
              setPeekError(null);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SourceCard({
  source,
  isExpanded,
  chunks,
  peekError,
  onPeek,
  onCollapse,
}: {
  source: ExternalSourceInfo;
  isExpanded: boolean;
  chunks: ExternalPeekChunk[];
  peekError: string | null;
  onPeek: () => void;
  onCollapse: () => void;
}) {
  const { locale, t } = useI18n();
  const fetchedLabel = source.last_fetched_at
    ? new Date(source.last_fetched_at * 1000).toLocaleString(locale)
    : (t("knowledge.ReferencePanel.never"));

  return (
    <div className="rounded-xl bg-surface-overlay/60 border border-line-strong/50 overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-fg font-medium">{source.title}</p>
            <span
              className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                source.is_ingested
                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/60"
                  : "bg-surface-input/60 text-fg-muted border border-line-strong/60"
              }`}
            >
              {source.is_ingested ? (t("knowledge.ReferencePanel.ingested")) : (t("knowledge.ReferencePanel.pending"))}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-fg-muted border border-line-strong px-1.5 py-0.5 rounded">
              {t("knowledge.ReferencePanel.phase_source_phase", { source_phase: source.phase })}
            </span>
          </div>
          <p className="text-xs text-fg-muted mt-1">
            {source.publisher} · {source.license} ·{" "}
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg-muted hover:text-fg underline-offset-2 hover:underline"
            >
              {t("knowledge.ReferencePanel.source")}
            </a>
          </p>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {source.domains.map((d) => (
              <span
                key={d}
                className="text-[10px] text-fg-muted bg-surface-input/60 border border-line-strong/60 px-1.5 py-0.5 rounded"
              >
                {d}
              </span>
            ))}
          </div>
          <p className="text-xs text-fg-muted mt-2">
            {t("knowledge.ReferencePanel.source_chunks_tolocalestring_chunks_source_files_filesource_files_____1_________s_fetched", { source_chunks_toLocaleString: source.chunks.toLocaleString(), source_files: source.files, source_files_____1_________s: source.files === 1 ? "" : "s", fetchedLabel })}
          </p>
        </div>
        <button
          onClick={isExpanded ? onCollapse : onPeek}
          disabled={!source.is_ingested}
          className="text-xs px-3 py-1.5 rounded-lg bg-surface-input/60 border border-line-strong/60 text-fg hover:bg-surface-input disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          {isExpanded ? (t("knowledge.ReferencePanel.hide")) : (t("knowledge.ReferencePanel.peek"))}
        </button>
      </div>
      {isExpanded && (
        <div className="border-t border-line-strong/50 px-4 py-3 space-y-2 bg-surface-elevated/40">
          {peekError && <p className="text-xs text-fg-muted">{peekError}</p>}
          {chunks.map((c) => (
            <div
              key={`${c.filename}-${c.chunk_index}-${c.domain}`}
              className="text-xs text-fg bg-surface-overlay/60 border border-line-strong/50 rounded-lg px-3 py-2"
            >
              <p className="text-[10px] text-fg-muted mb-1">
                {c.domain} · {c.filename} · {t("knowledge.ReferencePanel.chunk_c_chunk_index", { c_chunk_index: c.chunk_index })}
              </p>
              <p className="whitespace-pre-wrap leading-relaxed">
                {c.text.length > 600 ? c.text.slice(0, 600) + "…" : c.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
