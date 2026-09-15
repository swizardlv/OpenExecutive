"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ExternalPeekChunk,
  ReviewAnnotation,
  ReviewItem,
  ReviewPriority,
  ReviewStatus,
  addAnnotation,
  bulkApproveReviewItems,
  deleteAnnotation,
  getBuiltinFile,
  getReviewItem,
  listAllAnnotations,
  listItemAnnotations,
  listReviewItems,
  patchAnnotation,
  patchReviewItem,
  peekExternalSource,
  updateBuiltinFile,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  needs_revision: "Needs revision",
};

const STATUS_CLASSES: Record<ReviewStatus, string> = {
  pending: "bg-amber-950/60 text-amber-400 border border-amber-900/60",
  approved: "bg-emerald-950/60 text-emerald-400 border border-emerald-900/60",
  rejected: "bg-red-950/60 text-red-400 border border-red-900/60",
  needs_revision: "bg-violet-950/60 text-violet-400 border border-violet-900/60",
};

const PRIORITY_CLASSES: Record<ReviewPriority, string> = {
  high: "bg-blue-950/60 text-blue-400 border border-blue-900/60",
  normal: "",
  low: "bg-surface-overlay/60 text-fg-muted border border-line-strong/60",
};

function StatusPill({ status }: { status: ReviewStatus }) {
  const { t } = useI18n();
  const label = t(`review.status.${status}`, STATUS_LABELS[status]);
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_CLASSES[status]}`}>
      {label}
    </span>
  );
}

function PriorityPill({ priority }: { priority: ReviewPriority }) {
  const { t } = useI18n();
  if (priority === "normal") return null;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PRIORITY_CLASSES[priority]}`}>
      {priority === "high"
        ? (t("ReviewQueue.high_priority"))
        : (t("ReviewQueue.low_priority"))}
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Slide-over detail panel
// ---------------------------------------------------------------------------

function ItemSlideOver({
  itemId,
  onClose,
  onUpdated,
}: {
  itemId: string;
  onClose: () => void;
  onUpdated: (item: ReviewItem) => void;
}) {
  const { t } = useI18n();
  const [detail, setDetail] = useState<{ item: ReviewItem; annotations: ReviewAnnotation[] } | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [newCorrection, setNewCorrection] = useState("");
  const [addingAnnotation, setAddingAnnotation] = useState(false);
  const [notes, setNotes] = useState("");
  const [externalChunks, setExternalChunks] = useState<ExternalPeekChunk[]>([]);
  const [externalChunkLimit, setExternalChunkLimit] = useState(10);
  const [loadingChunks, setLoadingChunks] = useState(false);

  useEffect(() => {
    getReviewItem(itemId).then((d) => {
      setDetail(d);
      setNotes(d.item.reviewer_notes);
    });
  }, [itemId]);

  const itemId_stable = detail?.item.item_id;

  // Reset all content state when the item changes.
  useEffect(() => {
    setContent(null);
    setContentLoading(false);
    setContentError(false);
    setExternalChunks([]);
    setExternalChunkLimit(10);
    setLoadingChunks(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId_stable]);

  useEffect(() => {
    if (!detail || detail.item.content_type !== "builtin") return;
    const [, domain, filename] = detail.item.item_id.split(":");
    let cancelled = false;
    setContentLoading(true);
    setContentError(false);
    setContent(null);
    getBuiltinFile(domain, filename)
      .then((f) => { if (!cancelled) setContent(f.content); })
      .catch(() => { if (!cancelled) { setContent(null); setContentError(true); } })
      .finally(() => { if (!cancelled) setContentLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId_stable]);

  useEffect(() => {
    if (!detail || detail.item.content_type !== "external") return;
    let cancelled = false;
    setLoadingChunks(true);
    peekExternalSource(detail.item.filename, externalChunkLimit)
      .then((r) => { if (!cancelled) setExternalChunks(r.chunks); })
      .catch(() => { if (!cancelled) setExternalChunks([]); })
      .finally(() => { if (!cancelled) setLoadingChunks(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId_stable, externalChunkLimit]);

  const refreshAnnotations = useCallback(() => {
    listItemAnnotations(itemId).then((anns) => {
      setDetail((prev) => prev ? { ...prev, annotations: anns } : prev);
    });
  }, [itemId]);

  const handleSaveEdit = async () => {
    if (!detail || editDraft === content) { setEditing(false); return; }
    setSaving(true);
    try {
      const [, domain, filename] = detail.item.item_id.split(":");
      await updateBuiltinFile(domain, filename, editDraft);
      setContent(editDraft);
      setEditing(false);
      // Reload item — status will have reset to needs_revision server-side
      const updated = await getReviewItem(itemId);
      setDetail(updated);
      onUpdated(updated.item);
    } finally {
      setSaving(false);
    }
  };

  const handleAddAnnotation = async () => {
    if (!newCorrection.trim()) return;
    setAddingAnnotation(true);
    try {
      await addAnnotation(itemId, newCorrection.trim());
      setNewCorrection("");
      refreshAnnotations();
    } finally {
      setAddingAnnotation(false);
    }
  };

  const handleToggleAnnotation = async (ann: ReviewAnnotation) => {
    await patchAnnotation(ann.annotation_id, { is_active: !ann.is_active });
    refreshAnnotations();
  };

  const handleDeleteAnnotation = async (annId: string) => {
    await deleteAnnotation(annId);
    refreshAnnotations();
  };

  const handleSaveNotes = async () => {
    if (!detail) return;
    const updated = await patchReviewItem(itemId, { reviewer_notes: notes });
    setDetail((prev) => prev ? { ...prev, item: updated } : prev);
    onUpdated(updated);
  };

  if (!detail) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-[560px] bg-surface-elevated border-l border-line flex items-center justify-center">
          <span className="text-fg-muted text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  const { item, annotations } = detail;
  const isBuiltin = item.content_type === "builtin";
  const isExternal = item.content_type === "external";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-[600px] bg-surface-elevated border-l border-line flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-line flex-shrink-0">
          <div>
            <p className="text-sm font-medium text-fg">{item.filename}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-[10px] bg-surface-overlay text-fg-muted border border-line-strong rounded px-1.5 py-0.5">{item.domain}</span>
              <span className="text-[10px] bg-surface-overlay text-fg-muted border border-line-strong rounded px-1.5 py-0.5">{item.content_type}</span>
              <StatusPill status={item.status} />
              <PriorityPill priority={item.priority} />
            </div>
          </div>
          <button onClick={onClose} className="text-fg-muted hover:text-fg p-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Builtin file content */}
          {isBuiltin && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-fg-muted uppercase tracking-wide">{t("ReviewQueue.document_content")}</p>
                {!editing && content != null && (
                  <button
                    onClick={() => { setEditDraft(content); setEditing(true); }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {t("ReviewQueue.edit")}
                  </button>
                )}
              </div>
              {editing ? (
                <div className="space-y-2">
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    className="w-full h-72 bg-surface-elevated border border-line-strong rounded-lg px-3 py-2 text-xs text-fg font-mono resize-y focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {saving ? (t("ReviewQueue.saving")) : (t("ReviewQueue.save"))}
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="text-xs text-fg-muted hover:text-fg px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {t("ReviewQueue.cancel")}
                    </button>
                  </div>
                </div>
              ) : contentLoading ? (
                <p className="text-xs text-fg-subtle">{t("ReviewQueue.loading")}</p>
              ) : contentError ? (
                <p className="text-xs text-red-500/70">{t("ReviewQueue.could_not_load_file_content")}</p>
              ) : content != null ? (
                <pre className="text-xs text-fg bg-surface-elevated/60 border border-line rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono max-h-96">{content}</pre>
              ) : null}
            </section>
          )}

          {/* External source chunks */}
          {isExternal && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-fg-muted uppercase tracking-wide">
                  {t("ReviewQueue.source_content")}
                </p>
                {loadingChunks && <span className="text-[10px] text-fg-subtle">{t("ReviewQueue.loading")}</span>}
              </div>
              <p className="text-[11px] text-fg-subtle mb-3">
                {t("ReviewQueue.indexed_chunks_desc", { filename: item.filename })}
              </p>
              {!loadingChunks && externalChunks.length === 0 && (
                <div className="bg-surface-elevated/60 border border-line rounded-lg p-4 text-center">
                  <p className="text-xs text-fg-muted mb-1">{t("ReviewQueue.no_indexed_chunks_found")}</p>
                  <p className="text-[11px] text-fg-subtle">
                    {t("ReviewQueue.run_ingest_hint")}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {externalChunks.map((chunk) => (
                  <div key={`${chunk.filename}:${chunk.chunk_index}`} className="bg-surface-elevated/60 border border-line rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] bg-surface-overlay text-fg-muted border border-line-strong rounded px-1.5 py-0.5">{chunk.domain}</span>
                      <span className="text-[10px] text-fg-subtle font-mono">{chunk.filename} · chunk {chunk.chunk_index}</span>
                    </div>
                    <p className="text-xs text-fg leading-relaxed">{chunk.text}</p>
                  </div>
                ))}
              </div>
              {externalChunks.length > 0 && externalChunks.length >= externalChunkLimit && (
                <button
                  onClick={() => setExternalChunkLimit((n) => n + 10)}
                  disabled={loadingChunks}
                  className="mt-3 text-xs text-fg-muted hover:text-fg transition-colors disabled:opacity-40"
                >
                  {t("ReviewQueue.load_10_more_chunks")}
                </button>
              )}
            </section>
          )}

          {/* Notes */}
          <section>
            <p className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">{t("ReviewQueue.reviewer_notes")}</p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder={t("ReviewQueue.add_your_review_notes_here")}
              className="w-full h-20 bg-surface-elevated border border-line-strong rounded-lg px-3 py-2 text-xs text-fg resize-none focus:outline-none focus:border-indigo-500 placeholder:text-fg-subtle"
            />
          </section>

          {/* Annotations */}
          <section>
            <p className="text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">
              {t("ReviewQueue.sme_corrections")}
              <span className="text-fg-subtle ml-1 normal-case font-normal">{t("ReviewQueue.injected_into_ai_retrieval_context")}</span>
            </p>
            <div className="space-y-2">
              {annotations.map((ann) => (
                <div key={ann.annotation_id} className={`flex items-start gap-2 p-2 rounded-lg border ${ann.is_active ? "bg-surface-elevated/60 border-line" : "bg-surface-elevated/20 border-line/40 opacity-50"}`}>
                  <p className="flex-1 text-xs text-fg">{ann.correction}</p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleAnnotation(ann)}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${ann.is_active ? "bg-emerald-950/60 text-emerald-400 border-emerald-900/60 hover:bg-red-950/60 hover:text-red-400 hover:border-red-900/60" : "bg-surface-overlay/60 text-fg-muted border-line-strong/60 hover:bg-emerald-950/60 hover:text-emerald-400 hover:border-emerald-900/60"}`}
                    >
                      {ann.is_active ? (t("ReviewQueue.active")) : (t("ReviewQueue.inactive"))}
                    </button>
                    <button
                      onClick={() => handleDeleteAnnotation(ann.annotation_id)}
                      className="text-fg-subtle hover:text-red-400 transition-colors p-0.5"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={newCorrection}
                  onChange={(e) => setNewCorrection(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleAddAnnotation(); } }}
                  placeholder={t("ReviewQueue.add_a_correction_or_clarification")}
                  className="flex-1 bg-surface-elevated border border-line-strong rounded-lg px-3 py-1.5 text-xs text-fg focus:outline-none focus:border-indigo-500 placeholder:text-fg-subtle"
                />
                <button
                  onClick={handleAddAnnotation}
                  disabled={addingAnnotation || !newCorrection.trim()}
                  className="text-xs bg-surface-overlay hover:bg-surface-input text-fg px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                >
                  {t("ReviewQueue.add")}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main ReviewQueue component
// ---------------------------------------------------------------------------

type Tab = "queue" | "all" | "annotations";
type RejectModalState = { itemId: string; notes: string } | null;

export default function ReviewQueue() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("queue");
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [allItems, setAllItems] = useState<ReviewItem[]>([]);
  const [annotations, setAnnotations] = useState<ReviewAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | "">("");
  const [filterDomain, setFilterDomain] = useState("");
  const [filterType, setFilterType] = useState<"builtin" | "external" | "">("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<RejectModalState>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, needsRevision] = await Promise.all([
        listReviewItems({ status: "pending", limit: 200 }),
        listReviewItems({ status: "needs_revision", limit: 200 }),
      ]);
      setItems([...pending, ...needsRevision]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listReviewItems({
        status: filterStatus || undefined,
        domain: filterDomain || undefined,
        content_type: filterType || undefined,
        limit: 500,
      });
      setAllItems(result);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterDomain, filterType]);

  const loadAnnotations = useCallback(async () => {
    setLoading(true);
    try {
      const anns = await listAllAnnotations(true);
      setAnnotations(anns);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "queue") loadQueue();
    else if (tab === "all") loadAll();
    else loadAnnotations();
  }, [tab, loadQueue, loadAll, loadAnnotations]);

  const handleApprove = async (item: ReviewItem) => {
    const updated = await patchReviewItem(item.item_id, { status: "approved" });
    setItems((prev) => prev.filter((i) => i.item_id !== item.item_id));
    setAllItems((prev) => prev.map((i) => (i.item_id === updated.item_id ? updated : i)));
  };

  const handleFlag = async (item: ReviewItem) => {
    const updated = await patchReviewItem(item.item_id, { status: "needs_revision" });
    setItems((prev) => prev.map((i) => (i.item_id === updated.item_id ? updated : i)));
    setAllItems((prev) => prev.map((i) => (i.item_id === updated.item_id ? updated : i)));
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal) return;
    const updated = await patchReviewItem(rejectModal.itemId, {
      status: "rejected",
      reviewer_notes: rejectModal.notes,
    });
    setItems((prev) => prev.filter((i) => i.item_id !== rejectModal.itemId));
    setAllItems((prev) => prev.map((i) => (i.item_id === updated.item_id ? updated : i)));
    setRejectModal(null);
  };

  const handlePriorityChange = async (item: ReviewItem, priority: ReviewPriority) => {
    const updated = await patchReviewItem(item.item_id, { priority });
    setItems((prev) => prev.map((i) => (i.item_id === updated.item_id ? updated : i)));
    setAllItems((prev) => prev.map((i) => (i.item_id === updated.item_id ? updated : i)));
  };

  const handleBulkApprove = async (domain?: string) => {
    await bulkApproveReviewItems(domain);
    await loadQueue();
    await loadAll();
  };

  const handleItemUpdated = (updated: ReviewItem) => {
    setItems((prev) => prev.map((i) => (i.item_id === updated.item_id ? updated : i)));
    setAllItems((prev) => prev.map((i) => (i.item_id === updated.item_id ? updated : i)));
  };

  // Unique domains from current list
  const domains = Array.from(new Set(allItems.map((i) => i.domain))).sort();

  return (
    <div className="p-6">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-line mb-6">
        {(["queue", "all", "annotations"] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === tabKey
                ? "text-fg border-indigo-500"
                : "text-fg-muted border-transparent hover:text-fg"
            }`}
          >
            {tabKey === "queue" ? t("ReviewQueue.review_queue") : tabKey === "all" ? t("ReviewQueue.all_items") : t("ReviewQueue.annotations")}
          </button>
        ))}
      </div>

      {/* Queue tab */}
      {tab === "queue" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-fg-muted">
              {loading ? (t("ReviewQueue.loading")) : (t("ReviewQueue.items_length_itemitems_length_____1____s_need_review", { items_length: items.length, items_length_____1____s: items.length !== 1 ? "s" : "" }))}
            </p>
            {items.length > 0 && (
              <button
                onClick={() => handleBulkApprove()}
                className="text-xs bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-900/60 px-3 py-1.5 rounded-lg transition-colors"
              >
                {t("ReviewQueue.approve_all_pending")}
              </button>
            )}
          </div>
          {!loading && items.length === 0 && (
            <div className="text-center py-16 text-fg-subtle text-sm">
              {t("ReviewQueue.all_caught_up_nothing_to")}
            </div>
          )}
          <div className="space-y-2">
            {items.map((item) => (
              <ItemRow
                key={item.item_id}
                item={item}
                onApprove={() => handleApprove(item)}
                onReject={() => setRejectModal({ itemId: item.item_id, notes: "" })}
                onFlag={() => handleFlag(item)}
                onView={() => setSelectedItemId(item.item_id)}
                onPriorityChange={(p) => handlePriorityChange(item, p)}
              />
            ))}
          </div>
        </div>
      )}

      {/* All items tab */}
      {tab === "all" && (
        <div>
          {/* Filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ReviewStatus | "")}
              className="bg-surface-elevated border border-line-strong rounded-lg px-3 py-1.5 text-xs text-fg focus:outline-none focus:border-indigo-500"
            >
              <option value="">{t("ReviewQueue.all_statuses")}</option>
              <option value="pending">{t("ReviewQueue.pending")}</option>
              <option value="approved">{t("ReviewQueue.approved")}</option>
              <option value="rejected">{t("ReviewQueue.rejected")}</option>
              <option value="needs_revision">{t("ReviewQueue.needs_revision")}</option>
            </select>
            <select
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              className="bg-surface-elevated border border-line-strong rounded-lg px-3 py-1.5 text-xs text-fg focus:outline-none focus:border-indigo-500"
            >
              <option value="">{t("ReviewQueue.all_domains")}</option>
              {domains.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "builtin" | "external" | "")}
              className="bg-surface-elevated border border-line-strong rounded-lg px-3 py-1.5 text-xs text-fg focus:outline-none focus:border-indigo-500"
            >
              <option value="">{t("ReviewQueue.all_types")}</option>
              <option value="builtin">{t("ReviewQueue.builtin")}</option>
              <option value="external">{t("ReviewQueue.reference_library")}</option>
            </select>
          </div>

          {/* Bulk approve by domain */}
          {domains.length > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {domains.map((d) => (
                <button
                  key={d}
                  onClick={() => handleBulkApprove(d)}
                  className="text-[10px] text-fg-muted hover:text-emerald-400 bg-surface-elevated border border-line-strong hover:border-emerald-900/60 px-2 py-1 rounded-lg transition-colors"
                >
                  {t("ReviewQueue.approve_all_pending_in_d", { d })}
                </button>
              ))}
            </div>
          )}

          {loading && <p className="text-sm text-fg-subtle">{t("ReviewQueue.loading")}</p>}
          <div className="space-y-2">
            {allItems.map((item) => (
              <ItemRow
                key={item.item_id}
                item={item}
                onApprove={() => handleApprove(item)}
                onReject={() => setRejectModal({ itemId: item.item_id, notes: "" })}
                onFlag={() => handleFlag(item)}
                onView={() => setSelectedItemId(item.item_id)}
                onPriorityChange={(p) => handlePriorityChange(item, p)}
              />
            ))}
            {!loading && allItems.length === 0 && (
              <p className="text-sm text-fg-subtle py-8 text-center">{t("ReviewQueue.no_items_match_the_filters")}</p>
            )}
          </div>
        </div>
      )}

      {/* Annotations tab */}
      {tab === "annotations" && (
        <div>
          <p className="text-sm text-fg-muted mb-4">
            {loading ? (t("ReviewQueue.loading")) : (t("ReviewQueue.annotations_length_active_sme_correctionannotations_length_____1____s", { annotations_length: annotations.length, annotations_length_____1____s: annotations.length !== 1 ? "s" : "" }))}
          </p>
          <div className="space-y-2">
            {annotations.map((ann) => (
              <div key={ann.annotation_id} className="bg-surface-elevated/40 border border-line rounded-lg p-3 flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] bg-surface-overlay text-fg-muted border border-line-strong rounded px-1.5 py-0.5">{ann.domain}</span>
                    <span className="text-[10px] text-fg-subtle">{ann.item_id}</span>
                  </div>
                  <p className="text-xs text-fg">{ann.correction}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => void patchAnnotation(ann.annotation_id, { is_active: false }).then(loadAnnotations)}
                    className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-900/60 px-1.5 py-0.5 rounded-full hover:bg-red-950/60 hover:text-red-400 hover:border-red-900/60 transition-colors"
                  >
                    {t("ReviewQueue.active")}
                  </button>
                  <button
                    onClick={() => void deleteAnnotation(ann.annotation_id).then(loadAnnotations)}
                    className="text-fg-subtle hover:text-red-400 p-0.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {!loading && annotations.length === 0 && (
              <p className="text-sm text-fg-subtle py-8 text-center">{t("ReviewQueue.no_active_corrections_open_a")}</p>
            )}
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setRejectModal(null)} />
          <div className="relative bg-surface-elevated border border-line-strong rounded-xl p-5 w-[400px] shadow-2xl">
            <p className="text-sm font-medium text-fg mb-3">{t("ReviewQueue.reject_item")}</p>
            <textarea
              value={rejectModal.notes}
              onChange={(e) => setRejectModal({ ...rejectModal, notes: e.target.value })}
              placeholder={t("ReviewQueue.optional_notes_about_why_this")}
              className="w-full h-24 bg-surface-elevated border border-line-strong rounded-lg px-3 py-2 text-xs text-fg resize-none focus:outline-none focus:border-red-500 placeholder:text-fg-subtle mb-3"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRejectModal(null)}
                className="text-xs text-fg-muted hover:text-fg px-3 py-1.5 rounded-lg transition-colors"
              >
                {t("ReviewQueue.cancel")}
              </button>
              <button
                onClick={handleRejectConfirm}
                className="text-xs bg-red-900/40 hover:bg-red-900/60 text-red-400 border border-red-900/60 px-3 py-1.5 rounded-lg transition-colors"
              >
                {t("ReviewQueue.reject")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over */}
      {selectedItemId && (
        <ItemSlideOver
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
          onUpdated={handleItemUpdated}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item row
// ---------------------------------------------------------------------------

function ItemRow({
  item,
  onApprove,
  onReject,
  onFlag,
  onView,
  onPriorityChange,
}: {
  item: ReviewItem;
  onApprove: () => void;
  onReject: () => void;
  onFlag: () => void;
  onView: () => void;
  onPriorityChange: (p: ReviewPriority) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="bg-surface-elevated/40 border border-line rounded-lg px-4 py-3 flex items-center gap-3">
      {/* Icon */}
      <div className="flex-shrink-0 text-fg-subtle">
        {item.content_type === "builtin" ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-fg font-medium truncate">{item.filename}</span>
          <span className="text-[10px] bg-surface-overlay text-fg-muted border border-line-strong rounded px-1.5 py-0.5">{item.domain}</span>
          <StatusPill status={item.status} />
          <PriorityPill priority={item.priority} />
        </div>
        <p className="text-[11px] text-fg-subtle mt-0.5">{t("ReviewQueue.added_formatdate_item_registered_at", { formatDate_item_registered_at: formatDate(item.registered_at) })}</p>
      </div>

      {/* Priority selector */}
      <select
        value={item.priority}
        onChange={(e) => onPriorityChange(e.target.value as ReviewPriority)}
        className="bg-surface-elevated border border-line-strong rounded-lg px-2 py-1 text-[10px] text-fg-muted focus:outline-none focus:border-indigo-500"
        title="Set priority"
      >
        <option value="low">{t("ReviewQueue.low")}</option>
        <option value="normal">{t("ReviewQueue.normal")}</option>
        <option value="high">{t("ReviewQueue.high")}</option>
      </select>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onView}
          className="text-[10px] text-fg-muted hover:text-fg bg-surface-overlay hover:bg-surface-input border border-line-strong px-2 py-1 rounded-lg transition-colors"
        >
          {t("ReviewQueue.view")}
        </button>
        {item.status !== "approved" && (
          <button
            onClick={onApprove}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/60 border border-emerald-900/60 px-2 py-1 rounded-lg transition-colors"
          >
            {t("ReviewQueue.approve")}
          </button>
        )}
        {item.status !== "needs_revision" && (
          <button
            onClick={onFlag}
            className="text-[10px] text-violet-400 hover:text-violet-300 bg-violet-950/40 hover:bg-violet-950/60 border border-violet-900/60 px-2 py-1 rounded-lg transition-colors"
          >
            {t("ReviewQueue.flag")}
          </button>
        )}
        {item.status !== "rejected" && (
          <button
            onClick={onReject}
            className="text-[10px] text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-950/60 border border-red-900/60 px-2 py-1 rounded-lg transition-colors"
          >
            {t("ReviewQueue.reject")}
          </button>
        )}
      </div>
    </div>
  );
}
