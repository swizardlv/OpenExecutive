"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  approveWatchSuggestion,
  createWatchlistItem,
  declineWatchSuggestion,
  deleteWatchlistItem,
  listDepartments,
  listWatchlist,
  patchWatchlistItem,
  type WatchDeclineReason,
  type WatchlistCadence,
  type WatchlistItem,
  type WatchlistSeverity,
  type WatchlistSignalType,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// A research suggestion: the Executive wanted to watch this but was not sure
// enough to add it on its own. Sits in dry_run (polls, never alerts) until
// approved or declined here.
function isSuggestion(item: WatchlistItem): boolean {
  return item.origin === "research_proposed" && item.mode === "dry_run";
}

const DECLINE_REASONS: { value: WatchDeclineReason; label: string; labelZh: string; hint: string; hintZh: string }[] = [
  { value: "not_relevant", label: "Not relevant", labelZh: "不相关", hint: "Never suggest this company/topic again", hintZh: "不再建议此公司/主题" },
  { value: "too_noisy", label: "Too noisy", labelZh: "噪音过多", hint: "Keep it, but only high-severity signals", hintZh: "保留但仅接收高优先级信号" },
  { value: "wrong_source", label: "Wrong source", labelZh: "数据源不当", hint: "Right topic, drop only this feed/page", hintZh: "主题正确，仅取消该特定页面/源" },
];

const CADENCE_LABELS_ZH: Record<string, string> = {
  real_time: "实时",
  "15min": "15分钟",
  hourly: "每小时",
  daily: "每天",
  weekly: "每周",
};

const SEVERITY_LABELS_ZH: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

// Rationale + provenance stamp the research policy left on the row.
function policyStamp(item: WatchlistItem): { entity?: string; score?: number; source_url?: string } {
  const raw = (item.config_json as Record<string, unknown> | undefined)?._policy;
  return raw && typeof raw === "object" ? (raw as { entity?: string; score?: number; source_url?: string }) : {};
}

const CADENCES: WatchlistCadence[] = ["real_time", "15min", "hourly", "daily", "weekly"];
const SEVERITIES: WatchlistSeverity[] = ["low", "medium", "high", "urgent"];
const SIGNAL_TYPES: { value: WatchlistSignalType; label: string; labelZh: string; hint: string; hintZh: string }[] = [
  { value: "stock", label: "Stock", labelZh: "股票行情", hint: "Yahoo Finance ticker — e.g. AAPL", hintZh: "Yahoo 财经股票代码 — 例如 AAPL" },
  { value: "rss", label: "RSS / Atom", labelZh: "RSS / Atom 订阅", hint: "Feed URL — e.g. competitor changelog", hintZh: "订阅源 URL — 例如竞品更新日志" },
  { value: "vendor_status", label: "Vendor status", labelZh: "服务商状态", hint: "Statuspage atom/RSS feed URL", hintZh: "Statuspage 状态页 Atom/RSS 源" },
  { value: "edgar", label: "SEC EDGAR", labelZh: "SEC EDGAR 披露", hint: "Ticker or CIK — e.g. AAPL or 320193", hintZh: "股票代码或 CIK 编号 — 例如 AAPL 或 320193" },
  {
    value: "page_watch",
    label: "Page change",
    labelZh: "网页变动监控",
    hint: "Public page URL to watch for content changes — e.g. a pricing or careers page",
    hintZh: "用于监控内容变化的公开页面 URL — 例如价格页或招聘页",
  },
  {
    value: "query",
    label: "Web search (billed)",
    labelZh: "网络搜索（计费）",
    hint: "Standing search query — e.g. Acme Corp layoffs OR restructuring OR funding",
    hintZh: "持续搜索关键词 — 例如 公司裁员 OR 重组 OR 融资",
  },
];

// query runs an LLM web search every poll, so it bills per tick — unlike the
// keyless feed/EDGAR/page adapters. Surfaced as a warning in the add modal.
const BILLED_SIGNAL_TYPES: ReadonlySet<string> = new Set(["query"]);

// Pretty group-header label per signal type, derived from the add-modal's
// SIGNAL_TYPES so the two never drift. Unknown types fall back to the raw value.
const SIGNAL_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  SIGNAL_TYPES.map((s) => [s.value, s.label]),
);
const SIGNAL_TYPE_LABELS_ZH: Record<string, string> = Object.fromEntries(
  SIGNAL_TYPES.map((s) => [s.value, s.labelZh]),
);

// Group display order: known types in SIGNAL_TYPES order; unknown types sort last.
const SIGNAL_TYPE_ORDER: string[] = SIGNAL_TYPES.map((s) => s.value);

// Turn a kebab-case slug into a readable title: "stock-aapl" → "stock aapl".
// The full slug stays the identity (used for routing + shown on hover).
function humanizeSlug(slug: string): string {
  return slug.replace(/-+/g, " ").trim();
}

// Relative time. Kept inline so the watchlist page is self-contained;
// Briefing.tsx has its own copy with the same formula.
function formatRelTime(iso: string | null): string {
  if (!iso) return "never";
  try {
    const diff = new Date(iso).getTime() - Date.now();
    const abs = Math.abs(diff);
    if (abs < 60_000) return "now";
    if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m`;
    if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)}h`;
    return `${Math.round(abs / 86_400_000)}d`;
  } catch {
    return "—";
  }
}

function ModePill({ mode }: { mode: string }) {
  const isDry = mode === "dry_run";
  const cls = isDry
    ? "bg-zinc-500/20 text-zinc-300 border-zinc-500/30"
    : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${cls}`}>
      {mode}
    </span>
  );
}

function DeclineMenu({
  slug,
  busy,
  onPick,
  label,
}: {
  slug: string;
  busy: boolean;
  onPick: (slug: string, reason: WatchDeclineReason) => void;
  label: string;
}) {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className="px-3 py-1.5 text-xs rounded-lg border border-line hover:bg-surface-overlay disabled:opacity-50"
      >
        {label}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-line bg-surface-elevated shadow-lg p-1">
          {DECLINE_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => {
                setOpen(false);
                onPick(slug, r.value);
              }}
              className="w-full text-left px-2 py-1.5 rounded hover:bg-surface-overlay"
            >
              <div className="text-xs text-fg">{isZh ? r.labelZh : r.label}</div>
              <div className="text-[10px] text-fg-subtle">{isZh ? r.hintZh : r.hint}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  item,
  busy,
  onApprove,
  onDecline,
  departmentTitle,
}: {
  item: WatchlistItem;
  busy: boolean;
  onApprove: (slug: string) => void;
  onDecline: (slug: string, reason: WatchDeclineReason) => void;
  departmentTitle?: string;
}) {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const stamp = policyStamp(item);
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-fg truncate" title={item.slug}>
            {humanizeSlug(item.slug)}
          </div>
          <div className="text-xs text-fg-muted truncate" title={item.target}>
            {item.signal_type} · {item.target}
          </div>
        </div>
        <span className="flex-shrink-0 inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium bg-amber-500/20 text-amber-200 border-amber-500/30">
          {isZh ? "建议监控" : "suggested"}
        </span>
      </div>
      {item.notes && <p className="text-xs text-fg mt-2">{item.notes}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-muted mt-2">
        {stamp.entity && <span>{isZh ? `关联: ${stamp.entity}` : `about: ${stamp.entity}`}</span>}
        {item.route_to_department && (
          <span title={isZh ? "已指派该部门主管审核" : "This department's head was asked to review it"}>
            {isZh ? `归属: ${departmentTitle ?? item.route_to_department}` : `for: ${departmentTitle ?? item.route_to_department}`}
          </span>
        )}
        <span>{isZh ? `建议于 ${formatRelTime(item.created_at)} 前` : `suggested ${formatRelTime(item.created_at)} ago`}</span>
        <span>{isZh ? `影子触发: ${item.fired_count} 次` : `seen in shadow: ${item.fired_count} signal${item.fired_count === 1 ? "" : "s"}`}</span>
        {stamp.source_url && (
          <a href={stamp.source_url} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200">
            {isZh ? "数据源 ↗" : "source ↗"}
          </a>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-line">
        <DeclineMenu slug={item.slug} busy={busy} onPick={onDecline} label={isZh ? "忽略…" : "Decline…"} />
        <button
          type="button"
          disabled={busy}
          onClick={() => onApprove(item.slug)}
          className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
        >
          {busy ? "…" : (isZh ? "批准监控" : "Approve")}
        </button>
      </div>
    </div>
  );
}

function WatchCard({
  item,
  onToggle,
  toggleBusy,
  onStopWatching,
  departmentTitle,
}: {
  item: WatchlistItem;
  onToggle: (slug: string, enabled: boolean) => void;
  toggleBusy: boolean;
  onStopWatching?: (slug: string, reason: WatchDeclineReason) => void;
  departmentTitle?: string;
}) {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const isResearch = item.origin === "research";
  const stamp = policyStamp(item);
  return (
    <div className="rounded-xl border border-line bg-surface-elevated hover:bg-surface-overlay transition-colors p-4 group">
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link href={`/watchlist/${encodeURIComponent(item.slug)}`} className="flex-1 min-w-0">
          <div
            className="text-sm font-semibold text-fg group-hover:text-indigo-300 transition-colors truncate"
            title={item.slug}
          >
            {humanizeSlug(item.slug)}
          </div>
          <div className="text-xs text-fg-muted mt-0.5 truncate" title={item.target}>
            {item.target}
          </div>
        </Link>
        <div className="flex-shrink-0 flex items-center gap-2">
          <ModePill mode={item.mode} />
        </div>
      </div>
      {isResearch && (
        <p className="text-[11px] text-fg-muted mb-2">
          <span className="text-indigo-300">{isZh ? "由 Executive 自动添加" : "Added by the Executive"}</span>
          {stamp.entity ? ` · ${isZh ? "关联" : "about"} ${stamp.entity}` : ""}
          {item.route_to_department ? ` · ${isZh ? "归属" : "for"} ${departmentTitle ?? item.route_to_department}` : ""}
          {item.notes ? ` · ${item.notes}` : ""}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-muted mb-2">
        <span>{isZh ? `周期: ${CADENCE_LABELS_ZH[item.cadence] ?? item.cadence}` : `cadence: ${item.cadence}`}</span>
        <span>{isZh ? `级别: ${SEVERITY_LABELS_ZH[item.severity_floor] ?? item.severity_floor}→${SEVERITY_LABELS_ZH[item.severity_ceiling] ?? item.severity_ceiling}` : `severity: ${item.severity_floor}→${item.severity_ceiling}`}</span>
        <span>{isZh ? `触发: ${item.fired_count}` : `fired: ${item.fired_count}`}</span>
        {item.dismiss_count > 0 && <span>{isZh ? `忽略: ${item.dismiss_count}` : `dismissed: ${item.dismiss_count}`}</span>}
        <span>{isZh ? `上次: ${formatRelTime(item.last_fired_at)}` : `last: ${formatRelTime(item.last_fired_at)}`}</span>
      </div>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-line">
        <label className="flex items-center gap-1.5 text-xs text-fg-muted cursor-pointer">
          <input
            type="checkbox"
            checked={item.enabled}
            disabled={toggleBusy}
            onChange={(e) => onToggle(item.slug, e.target.checked)}
            className="accent-indigo-500 disabled:opacity-50"
          />
          {isZh ? "启用" : "enabled"}
        </label>
        <div className="flex items-center gap-2">
          {isResearch && onStopWatching && (
            <DeclineMenu slug={item.slug} busy={toggleBusy} onPick={onStopWatching} label={isZh ? "停止监控…" : "Stop watching…"} />
          )}
          <Link
            href={`/watchlist/${encodeURIComponent(item.slug)}`}
            className="text-xs text-indigo-300 hover:text-indigo-200"
          >
            {isZh ? "详情 →" : "inspect →"}
          </Link>
        </div>
      </div>
    </div>
  );
}

interface AddModalProps {
  onCreated: (w: WatchlistItem) => void;
  onClose: () => void;
}

function AddWatchModal({ onCreated, onClose }: AddModalProps) {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const [slug, setSlug] = useState("");
  const [signalType, setSignalType] = useState<WatchlistSignalType>("stock");
  const [target, setTarget] = useState("");
  const [trigger, setTrigger] = useState("");
  const [cadence, setCadence] = useState<WatchlistCadence>("15min");
  const [severityFloor, setSeverityFloor] = useState<WatchlistSeverity>("low");
  const [severityCeiling, setSeverityCeiling] = useState<WatchlistSeverity>("urgent");
  const [mode, setMode] = useState<"active" | "dry_run">("active");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const slugRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    slugRef.current?.focus();
  }, []);

  const selectedSignal = SIGNAL_TYPES.find((s) => s.value === signalType);
  const targetHint = (isZh ? selectedSignal?.hintZh : selectedSignal?.hint) ?? "";

  async function submit() {
    setSaving(true);
    setErr(null);
    let parsedTrigger: Record<string, unknown> = {};
    if (trigger.trim()) {
      try {
        parsedTrigger = JSON.parse(trigger);
      } catch {
        setErr(isZh ? "触发规则必须是有效的 JSON，例如 {\"abs_change_pct_gte\": 5}" : "Trigger must be valid JSON, e.g. {\"abs_change_pct_gte\": 5}");
        setSaving(false);
        return;
      }
    }
    try {
      const created = await createWatchlistItem({
        slug: slug.trim(),
        signal_type: signalType,
        target: target.trim(),
        trigger: parsedTrigger,
        cadence,
        severity_floor: severityFloor,
        severity_ceiling: severityCeiling,
        mode,
        notes: notes.trim(),
      });
      onCreated(created);
    } catch (e) {
      setErr(e instanceof Error ? e.message : (isZh ? "创建失败" : "Create failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="bg-surface-elevated border border-line rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-fg mb-4">{isZh ? "添加监控项" : "Add monitor"}</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-fg-muted mb-1">{isZh ? "唯一标识（kebab-case）" : "Slug (kebab-case)"}</label>
            <input
              ref={slugRef}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="stock-aapl"
              className="w-full px-3 py-2 text-sm rounded-lg bg-surface-input border border-line"
            />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">{isZh ? "信号类型" : "Signal type"}</label>
            <select
              value={signalType}
              onChange={(e) => setSignalType(e.target.value as WatchlistSignalType)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-surface-input border border-line"
            >
              {SIGNAL_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {isZh ? s.labelZh : s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">{isZh ? "监控目标" : "Target"}</label>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={targetHint}
              className="w-full px-3 py-2 text-sm rounded-lg bg-surface-input border border-line"
            />
            <p className="text-[10px] text-fg-subtle mt-1">{targetHint}</p>
            {BILLED_SIGNAL_TYPES.has(signalType) && (
              <p className="text-[10px] text-amber-300/90 mt-1">
                {isZh
                  ? "⚠ 计费提醒：每次轮询都会调用大模型进行网络搜索。建议选择较慢的频率（每天/每周）并设置精确的查询词。"
                  : "⚠ Billed: runs an LLM web search on every poll. Prefer a slower cadence (daily / weekly) and a tight query."}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">{isZh ? "触发规则（JSON，可选）" : "Trigger (JSON, optional)"}</label>
            <textarea
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              placeholder={
                signalType === "stock"
                  ? '{"abs_change_pct_gte": 5}'
                  : signalType === "edgar"
                    ? '{"forms": ["8-K", "10-K"]}'
                    : signalType === "rss" ||
                        signalType === "query" ||
                        signalType === "page_watch"
                      ? '{"keywords": ["layoffs", "downtime"]}'
                      : "{}"
              }
              rows={3}
              className="w-full px-3 py-2 text-sm font-mono rounded-lg bg-surface-input border border-line"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-fg-muted mb-1">{isZh ? "检查周期" : "Cadence"}</label>
              <select
                value={cadence}
                onChange={(e) => setCadence(e.target.value as WatchlistCadence)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-surface-input border border-line"
              >
                {CADENCES.map((c) => (
                  <option key={c} value={c}>
                    {isZh ? CADENCE_LABELS_ZH[c] : c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">{isZh ? "监控模式" : "Mode"}</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "active" | "dry_run")}
                className="w-full px-3 py-2 text-sm rounded-lg bg-surface-input border border-line"
              >
                <option value="active">{isZh ? "生效 (active)" : "active"}</option>
                <option value="dry_run">{isZh ? "预演 (dry_run)" : "dry_run"}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">{isZh ? "最低告警级别" : "Severity floor"}</label>
              <select
                value={severityFloor}
                onChange={(e) => setSeverityFloor(e.target.value as WatchlistSeverity)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-surface-input border border-line"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {isZh ? SEVERITY_LABELS_ZH[s] : s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">{isZh ? "最高告警级别" : "Severity ceiling"}</label>
              <select
                value={severityCeiling}
                onChange={(e) => setSeverityCeiling(e.target.value as WatchlistSeverity)}
                className="w-full px-3 py-2 text-sm rounded-lg bg-surface-input border border-line"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {isZh ? SEVERITY_LABELS_ZH[s] : s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">{isZh ? "备注说明" : "Notes"}</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              className="w-full px-3 py-2 text-sm rounded-lg bg-surface-input border border-line"
            />
          </div>
        </div>

        {err && (
          <div className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-line hover:bg-surface-overlay disabled:opacity-50"
          >
            {isZh ? "取消" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={saving || !slug.trim() || !target.trim()}
            onClick={submit}
            className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50"
          >
            {saving ? (isZh ? "添加中…" : "Adding…") : (isZh ? "确认添加" : "Add monitor")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WatchlistPage() {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busySlugs, setBusySlugs] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  // slug → title for the "for: <department>" label on routed watches.
  const [departmentTitles, setDepartmentTitles] = useState<Record<string, string>>({});

  const toggleCollapsed = (key: string) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  // Group monitors by signal type, mirroring the artifacts/runs collapsible
  // groups. Known types render in SIGNAL_TYPES order; any unknown type sorts
  // last (alphabetically) so a new backend adapter never silently vanishes.
  const suggestions = useMemo(() => items.filter(isSuggestion), [items]);

  const groups = useMemo(() => {
    const map = new Map<string, WatchlistItem[]>();
    for (const it of items) {
      if (isSuggestion(it)) continue;
      const bucket = map.get(it.signal_type);
      if (bucket) bucket.push(it);
      else map.set(it.signal_type, [it]);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      const ia = SIGNAL_TYPE_ORDER.indexOf(a);
      const ib = SIGNAL_TYPE_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
    return keys.map((k) => ({
      key: k,
      label: (isZh ? SIGNAL_TYPE_LABELS_ZH[k] : SIGNAL_TYPE_LABELS[k]) ?? k,
      items: map.get(k)!,
    }));
  }, [items, isZh]);

  function refresh() {
    setLoading(true);
    listWatchlist()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : (isZh ? "加载失败" : "Failed to load")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    listDepartments()
      .then((states) =>
        setDepartmentTitles(Object.fromEntries(states.map((d) => [d.config.slug, d.config.title]))),
      )
      .catch(() => {});
  }, []);

  function markBusy(slug: string, busy: boolean) {
    setBusySlugs((prev) => {
      const next = new Set(prev);
      if (busy) next.add(slug);
      else next.delete(slug);
      return next;
    });
  }

  async function approve(slug: string) {
    markBusy(slug, true);
    try {
      const updated = await approveWatchSuggestion(slug);
      setItems((prev) => prev.map((it) => (it.slug === slug ? updated : it)));
    } catch (e) {
      setError(e instanceof Error ? e.message : (isZh ? "批准失败" : "Approve failed"));
    } finally {
      markBusy(slug, false);
    }
  }

  async function decline(slug: string, reason: WatchDeclineReason) {
    markBusy(slug, true);
    try {
      const res = await declineWatchSuggestion(slug, reason);
      if (res.result === "removed") {
        setItems((prev) => prev.filter((it) => it.slug !== slug));
      } else {
        // too_noisy: the row went live with a high floor — reload it.
        refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : (isZh ? "忽略失败" : "Decline failed"));
    } finally {
      markBusy(slug, false);
    }
  }

  async function stopWatching(slug: string, reason: WatchDeclineReason) {
    markBusy(slug, true);
    try {
      if (reason === "too_noisy") {
        // Same remedy the decline route applies: keep the source, only
        // high-severity signals surface.
        const updated = await patchWatchlistItem(slug, { severity_floor: "high" });
        setItems((prev) => prev.map((it) => (it.slug === slug ? updated : it)));
      } else {
        await deleteWatchlistItem(slug, reason);
        setItems((prev) => prev.filter((it) => it.slug !== slug));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : (isZh ? "移除失败" : "Remove failed"));
    } finally {
      markBusy(slug, false);
    }
  }

  async function toggle(slug: string, enabled: boolean) {
    // Optimistic. The disabled prop on the input prevents a second
    // click landing while the PATCH is in flight, so the revert path
    // can safely flip back to the prior value.
    setBusySlugs((prev) => new Set(prev).add(slug));
    setItems((prev) =>
      prev.map((it) => (it.slug === slug ? { ...it, enabled } : it)),
    );
    try {
      const updated = await patchWatchlistItem(slug, { enabled });
      setItems((prev) => prev.map((it) => (it.slug === slug ? updated : it)));
    } catch (e) {
      setItems((prev) =>
        prev.map((it) => (it.slug === slug ? { ...it, enabled: !enabled } : it)),
      );
      setError(e instanceof Error ? e.message : (isZh ? "切换失败" : "Toggle failed"));
    } finally {
      setBusySlugs((prev) => {
        const next = new Set(prev);
        next.delete(slug);
        return next;
      });
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      {showAdd && (
        <AddWatchModal
          onCreated={(w) => {
            setItems((prev) => [...prev, w]);
            setShowAdd(false);
          }}
          onClose={() => setShowAdd(false)}
        />
      )}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold text-fg">{isZh ? "监控列表" : "Watch list"}</h1>
              <p className="text-sm text-fg-muted mt-0.5">
                {isZh
                  ? "Executive 正在监测的外部信号与动态。经过严重级别筛选与分流的信号将转化为简报中的决策提案。"
                  : "External conditions the Executive is monitoring. Signals that survive severity + triage become proposals in your briefing."}
              </p>
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="flex-shrink-0 px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              {isZh ? "+ 添加监控项" : "+ Add monitor"}
            </button>
          </div>

          {loading && <p className="text-fg-muted text-sm">{isZh ? "加载中…" : "Loading…"}</p>}
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm mb-4">
              {error}
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="rounded-xl border border-line bg-surface-elevated p-8 text-center">
              <p className="text-fg-muted text-sm mb-3">{isZh ? "暂无正在监控的项目。" : "Nothing being watched yet."}</p>
              <p className="text-xs text-fg-subtle mb-4">
                {isZh ? "可以在对话中让 Executive 监控，例如：" : "Ask the Executive in chat: "}{" "}
                <span className="italic">
                  {isZh ? "监控苹果公司股价，波动达到 5% 时提醒我。" : "Watch Apple stock, alert me on 5% moves."}
                </span>
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {isZh ? "添加监控项 →" : "Add a monitor →"}
              </button>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="mb-8">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-sm font-semibold text-fg">{isZh ? "Executive 智能建议" : "Suggested by the Executive"}</span>
                <span className="text-xs text-fg-muted">
                  {isZh ? `${suggestions.length} 项等待您决策` : `${suggestions.length} waiting for you`}
                </span>
              </div>
              <p className="text-xs text-fg-subtle mb-3">
                {isZh
                  ? "调研系统认为值得关注但尚未完全关联到核心业务的数据源。它们在影子模式下运行，在您批准前绝不会触发直接告警。您的拒绝决策将被记住。"
                  : "Sources the research council thought worth monitoring but couldn't tie firmly enough to your company data to add on its own. They poll in shadow mode and never alert until you approve. Declines are remembered."}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {suggestions.map((item) => (
                  <SuggestionCard
                    key={item.id}
                    item={item}
                    busy={busySlugs.has(item.slug)}
                    onApprove={approve}
                    onDecline={decline}
                    departmentTitle={departmentTitles[item.route_to_department]}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            {groups.map((group) => {
              const isCollapsed = !!collapsed[group.key];
              return (
                <div key={group.key}>
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(group.key)}
                    className="w-full flex items-center gap-2 mb-3 text-left"
                  >
                    <span
                      className={`text-fg-muted text-xs transition-transform ${
                        isCollapsed ? "" : "rotate-90"
                      }`}
                    >
                      ▶
                    </span>
                    <span className="text-sm font-semibold text-fg">
                      {group.label}
                    </span>
                    <span className="text-xs text-fg-muted">
                      {group.items.length}{" "}
                      {isZh ? "个监控项" : (group.items.length === 1 ? "monitor" : "monitors")}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {group.items.map((item) => (
                        <WatchCard
                          key={item.id}
                          item={item}
                          onToggle={toggle}
                          toggleBusy={busySlugs.has(item.slug)}
                          onStopWatching={stopWatching}
                          departmentTitle={departmentTitles[item.route_to_department]}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
