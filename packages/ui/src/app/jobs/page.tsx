"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  WorkflowMeta,
  WorkflowRunSummary,
  WorkflowSection,
  deleteCustomWorkflow,
  deleteWorkflowRun,
  listWorkflowRuns,
  listWorkflows,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatRelativeTime } from "@/lib/relativeTime";
import { getWorkflowDescription, getWorkflowTitle } from "@/lib/workflowI18n";

const SECTION_ORDER: WorkflowSection[] = [
  "Board",
  "Capital & Investors",
  "Growth & GTM",
  "Product",
  "People",
  "Risk, Legal & Crisis",
  "Operating Cadence",
];

const SECTION_ORDER_ZH: Record<WorkflowSection, string> = {
  Board: "董事会",
  "Capital & Investors": "资本与投资人",
  "Growth & GTM": "业务增长与GTM",
  Product: "产品策略",
  People: "组织与团队",
  "Risk, Legal & Crisis": "风控法务与危机",
  "Operating Cadence": "运营节拍",
};

const SECTION_BLURB: Record<WorkflowSection, string> = {
  Board: "Decks, memos, and talking points for your board meetings.",
  "Capital & Investors":
    "Materials for raising capital and reporting to investors.",
  "Growth & GTM":
    "Positioning, launches, pricing, and competitive plays.",
  Product: "Strategy memos, retention and product decisions.",
  People: "Hiring, performance, org design, and compensation.",
  "Risk, Legal & Crisis":
    "Risk register, M&A diligence, and crisis-comms preparation.",
  "Operating Cadence":
    "The monthly, quarterly, and annual rhythm of running the company.",
};

const SECTION_BLURB_ZH: Record<WorkflowSection, string> = {
  Board: "用于董事会会议的演示文稿、备忘录与核心谈资。",
  "Capital & Investors": "用于股权融资与向投资人定期汇报的材料。",
  "Growth & GTM": "市场定位、发布计划、定价策略与竞争策略。",
  Product: "战略备忘录、留存分析与产品决策。",
  People: "招聘计划、绩效考核、组织架构与薪酬方案。",
  "Risk, Legal & Crisis": "风险清单、收并购尽调与危机公关准备。",
  "Operating Cadence": "驱动公司运转的月度、季度与年度节拍。",
};

type Tab = "catalog" | "runs";
type RunStatus = "active" | "done" | "error";

function isTab(v: string | null): v is Tab {
  return v === "catalog" || v === "runs";
}
function isStatus(v: string | null): v is RunStatus {
  return v === "active" || v === "done" || v === "error";
}

function statusBadge(status: string, isZh?: boolean) {
  const color =
    status === "done"
      ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
      : status === "error"
      ? "bg-red-500/10 text-red-400 ring-red-500/30"
      : "bg-amber-500/10 text-amber-400 ring-amber-500/30";
  const label = isZh
    ? (status === "done" ? "已完成" : status === "error" ? "失败" : "进行中")
    : status;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ring-1 ${color}`}
    >
      {label}
    </span>
  );
}

function matchesQuery(q: string, ...fields: (string | undefined)[]): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some((f) => (f ?? "").toLowerCase().includes(needle));
}

function groupBy<T, K extends string>(
  arr: T[],
  keyFn: (item: T) => K
): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of arr) {
    const k = keyFn(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

function runStatusBucket(s: WorkflowRunSummary["status"]): RunStatus {
  if (s === "running") return "active";
  if (s === "done" || s === "error") return s;
  // Defensive: unknown future statuses surface under Active so they're not lost.
  return "active";
}

function JobsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab: Tab = isTab(searchParams.get("tab"))
    ? (searchParams.get("tab") as Tab)
    : "catalog";
  const statusParam = searchParams.get("status");
  const status: RunStatus | null = isStatus(statusParam) ? statusParam : null;

  const [workflows, setWorkflows] = useState<WorkflowMeta[]>([]);
  const [runs, setRuns] = useState<WorkflowRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [runsQuery, setRunsQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [wfs, rs] = await Promise.all([listWorkflows(), listWorkflowRuns()]);
      setWorkflows(wfs);
      setRuns(rs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null) sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const runCounts = useMemo(() => {
    const c = { active: 0, done: 0, error: 0 };
    for (const r of runs) c[runStatusBucket(r.status)]++;
    return c;
  }, [runs]);

  // Default the runs sub-tab once data is loaded and ?status is missing/invalid.
  // Ref guard ensures we only auto-set on the first eligible render, so a user
  // who explicitly navigates back to ?tab=runs without ?status isn't overridden
  // mid-interaction and StrictMode double-invocation doesn't double-write.
  const defaultedStatusRef = useRef(false);
  useEffect(() => {
    if (tab !== "runs" || loading) return;
    if (status !== null) return;
    if (defaultedStatusRef.current) return;
    defaultedStatusRef.current = true;
    const next: RunStatus = runCounts.active > 0 ? "active" : "done";
    setParam({ status: next });
  }, [tab, loading, status, runCounts.active, setParam]);

  const workflowTitleMap = useMemo(
    () => new Map(workflows.map((w) => [w.name, w.title] as const)),
    [workflows]
  );

  const { locale } = useI18n();
  const isZh = locale === "zh";

  const handleDelete = useCallback(
    async (runId: string) => {
      if (!confirm(isZh ? "确定删除此执行记录吗？" : "Delete this run?")) return;
      await deleteWorkflowRun(runId);
      refresh();
    },
    [refresh, isZh]
  );

  const handleDeleteCustom = useCallback(
    async (name: string) => {
      if (
        !confirm(
          isZh
            ? `确定删除自定义工作流 “${name}” 吗？此操作无法撤销。`
            : `Delete the custom workflow “${name}”? This cannot be undone.`
        )
      )
        return;
      await deleteCustomWorkflow(name);
      refresh();
    },
    [refresh, isZh]
  );

  return (
    <>
      <div className="flex items-center gap-1 border-b border-line mb-6">
        <TabButton
          active={tab === "catalog"}
          onClick={() => setParam({ tab: "catalog" })}
          label={isZh ? "工作流目录" : "Catalog"}
          count={workflows.length}
        />
        <TabButton
          active={tab === "runs"}
          onClick={() => setParam({ tab: "runs" })}
          label={isZh ? "执行记录" : "Runs"}
          count={runs.length}
        />
      </div>

      {loading && (
        <div className="text-sm text-fg-muted">
          {isZh ? "正在加载任务流…" : "Loading jobs…"}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-400 mb-4">
          {isZh ? "错误: " : "Error: "}{error}
        </div>
      )}

      {!loading && tab === "catalog" && (
        <CatalogView
          workflows={workflows}
          query={catalogQuery}
          onQueryChange={setCatalogQuery}
          onDeleteCustom={handleDeleteCustom}
        />
      )}

          {!loading && tab === "runs" && (
            <RunsView
              runs={runs}
              counts={runCounts}
              status={status ?? "active"}
              onStatusChange={(s) => setParam({ status: s })}
              query={runsQuery}
              onQueryChange={setRunsQuery}
              workflowTitleMap={workflowTitleMap}
              collapsed={collapsed}
              onToggleCollapsed={(key) =>
                setCollapsed((c) => ({ ...c, [key]: !c[key] }))
              }
              onDelete={handleDelete}
            />
          )}
    </>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-indigo-500 text-fg"
          : "border-transparent text-fg-muted hover:text-fg"
      }`}
    >
      {label}
      <span className="ml-2 text-xs text-fg-muted">{count}</span>
    </button>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full sm:w-80 px-3 py-1.5 text-sm rounded-md bg-surface/60 border border-line text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-indigo-500/40 focus:border-line-strong"
    />
  );
}

function CatalogView({
  workflows,
  query,
  onQueryChange,
  onDeleteCustom,
}: {
  workflows: WorkflowMeta[];
  query: string;
  onQueryChange: (v: string) => void;
  onDeleteCustom: (name: string) => void;
}) {
  const { locale } = useI18n();
  const isZh = locale === "zh";

  const filtered = workflows.filter((w) => {
    const title = getWorkflowTitle(w.name, w.title, locale);
    const desc = getWorkflowDescription(w.name, w.description, locale);
    return matchesQuery(query, title, desc, w.title, w.description);
  });

  // User-created workflows are grouped together under "Custom" regardless of
  // their declared section, so they're easy to find, edit, and delete.
  const custom = filtered.filter((w) => w.is_custom);
  const builtin = filtered.filter((w) => !w.is_custom);
  const known = new Set<string>(SECTION_ORDER);
  const others = builtin.filter((w) => !known.has(w.section));

  const renderCard = (w: WorkflowMeta) => {
    const title = getWorkflowTitle(w.name, w.title, locale);
    const desc = getWorkflowDescription(w.name, w.description, locale);
    return (
      <Link
        key={w.name}
        href={`/jobs/${encodeURIComponent(w.name)}`}
        className="block rounded-lg border border-line bg-surface/40 hover:border-line-strong hover:bg-surface-elevated/40 p-5 transition"
      >
        <h3 className="text-base font-semibold text-fg mb-2">{title}</h3>
        <p className="text-sm text-fg-muted leading-relaxed mb-3">
          {desc}
        </p>
        <div className="flex items-center justify-between text-xs text-fg-muted">
          <span>{w.steps.length} {isZh ? "个步骤" : "steps"}</span>
          <span>~{w.estimated_minutes} {isZh ? "分钟" : "min"}</span>
        </div>
      </Link>
    );
  };

  const renderCustomCard = (w: WorkflowMeta) => {
    const title = getWorkflowTitle(w.name, w.title, locale);
    const desc = getWorkflowDescription(w.name, w.description, locale);
    return (
      <div
        key={w.name}
        className="rounded-lg border border-line bg-surface/40 p-5 transition hover:border-line-strong"
      >
        <Link href={`/jobs/${encodeURIComponent(w.name)}`} className="block">
          <h3 className="text-base font-semibold text-fg mb-2">{title}</h3>
          <p className="text-sm text-fg-muted leading-relaxed mb-3">
            {desc}
          </p>
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span>{w.steps.length} {isZh ? "个步骤" : "steps"}</span>
            <span>~{w.estimated_minutes} {isZh ? "分钟" : "min"}</span>
          </div>
        </Link>
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 text-xs">
          <Link
            href={`/jobs/new?edit=${encodeURIComponent(w.name)}`}
            className="text-indigo-400 hover:text-indigo-300"
          >
            {isZh ? "编辑" : "Edit"}
          </Link>
          <button
            type="button"
            onClick={() => onDeleteCustom(w.name)}
            className="text-fg-muted hover:text-red-400 transition"
          >
            {isZh ? "删除" : "Delete"}
          </button>
        </div>
      </div>
    );
  };

  const renderSection = (
    section: string,
    blurb: string,
    items: WorkflowMeta[],
    card: (w: WorkflowMeta) => React.ReactNode = renderCard
  ) => {
    const displayTitle = isZh
      ? (SECTION_ORDER_ZH[section as WorkflowSection] ?? (section === "Custom" ? "自定义工作流" : section === "Other" ? "其他" : section))
      : section;
    const displayBlurb = isZh
      ? (SECTION_BLURB_ZH[section as WorkflowSection] ?? blurb)
      : blurb;

    return (
      <div key={section}>
        <div className="mb-3 flex items-baseline gap-3">
          <h2 className="text-base font-semibold text-fg">{displayTitle}</h2>
          <span className="text-xs text-fg-muted">
            {items.length} {isZh ? "个工作流" : (items.length === 1 ? "job" : "jobs")}
          </span>
        </div>
        <p className="text-xs text-fg-muted mb-3 leading-relaxed">{displayBlurb}</p>
        <div className="grid sm:grid-cols-2 gap-4">{items.map(card)}</div>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder={isZh ? "搜索工作流标题或描述…" : "Search workflows by title or description…"}
        />
        <Link
          href="/jobs/new"
          className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 transition"
        >
          {isZh ? "+ 新建工作流" : "+ New workflow"}
        </Link>
      </div>

      {workflows.length === 0 ? (
        <div className="text-sm text-fg-muted">
          {isZh ? "暂未注册任何工作流。" : "No jobs registered yet."}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-fg-muted">
          {isZh ? `未找到与 “${query}” 匹配的工作流。` : `No jobs match “${query}”.`}
        </div>
      ) : (
        <div className="space-y-10">
          {custom.length > 0 &&
            renderSection(
              "Custom",
              isZh ? "您创建的专属工作流，可随时编辑或删除。" : "Workflows you created. Edit or delete them anytime.",
              custom,
              renderCustomCard
            )}
          {SECTION_ORDER.map((section) => {
            const items = builtin.filter((w) => w.section === section);
            if (items.length === 0) return null;
            return renderSection(section, SECTION_BLURB[section], items);
          })}
          {others.length > 0 &&
            renderSection(
              "Other",
              isZh ? "尚未归入特定分组的工作流。" : "Workflows not yet assigned to a known section.",
              others
            )}
        </div>
      )}
    </div>
  );
}

function RunsView({
  runs,
  counts,
  status,
  onStatusChange,
  query,
  onQueryChange,
  workflowTitleMap,
  collapsed,
  onToggleCollapsed,
  onDelete,
}: {
  runs: WorkflowRunSummary[];
  counts: Record<RunStatus, number>;
  status: RunStatus;
  onStatusChange: (s: RunStatus) => void;
  query: string;
  onQueryChange: (v: string) => void;
  workflowTitleMap: Map<string, string>;
  collapsed: Record<string, boolean>;
  onToggleCollapsed: (key: string) => void;
  onDelete: (runId: string) => void;
}) {
  const { locale } = useI18n();
  const isZh = locale === "zh";

  const visible = runs.filter(
    (r) =>
      runStatusBucket(r.status) === status &&
      matchesQuery(
        query,
        r.title,
        r.workflow_name,
        getWorkflowTitle(r.workflow_name, r.workflow_name, locale)
      )
  );

  const groups = useMemo(
    () => groupBy(visible, (r) => r.workflow_name),
    [visible]
  );

  const emptyMsg = isZh
    ? status === "active"
      ? "暂无进行中的执行记录。"
      : status === "done"
      ? "暂无已完成的执行记录。"
      : "暂无执行失败记录。"
    : status === "active"
    ? "No active runs."
    : status === "done"
    ? "No completed runs yet."
    : "No errors.";

  return (
    <div>
      <div className="flex items-center gap-1 mb-4">
        <StatusSegment
          active={status === "active"}
          onClick={() => onStatusChange("active")}
          label={isZh ? "进行中" : "Active"}
          count={counts.active}
          tone="amber"
        />
        <StatusSegment
          active={status === "done"}
          onClick={() => onStatusChange("done")}
          label={isZh ? "已完成" : "Done"}
          count={counts.done}
          tone="emerald"
        />
        <StatusSegment
          active={status === "error"}
          onClick={() => onStatusChange("error")}
          label={isZh ? "失败" : "Error"}
          count={counts.error}
          tone="red"
        />
      </div>

      <div className="mb-4">
        <SearchInput
          value={query}
          onChange={onQueryChange}
          placeholder={isZh ? "按标题或工作流搜索执行记录…" : "Search runs by title or workflow…"}
        />
      </div>

      {visible.length === 0 ? (
        <div className="text-sm text-fg-muted">
          {query
            ? isZh
              ? `未找到与 “${query}” 匹配的记录。`
              : `No runs match “${query}”.`
            : emptyMsg}
        </div>
      ) : (
        <div className="space-y-5">
          {Array.from(groups.entries()).map(([workflowName, items]) => {
            const rawTitle = workflowTitleMap.get(workflowName) ?? workflowName;
            const title = getWorkflowTitle(workflowName, rawTitle, locale);
            const isCollapsed = !!collapsed[workflowName];
            return (
              <div key={workflowName}>
                <button
                  type="button"
                  onClick={() => onToggleCollapsed(workflowName)}
                  className="w-full flex items-center gap-2 mb-2 text-left"
                >
                  <span
                    className={`text-fg-muted text-xs transition-transform ${
                      isCollapsed ? "" : "rotate-90"
                    }`}
                  >
                    ▶
                  </span>
                  <span className="text-sm font-semibold text-fg">
                    {title}
                  </span>
                  <span className="text-xs text-fg-muted">
                    {items.length} {isZh ? "次执行" : items.length === 1 ? "run" : "runs"}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="space-y-2">
                    {items.map((r) => (
                      <div
                        key={r.run_id}
                        className="flex items-center justify-between gap-4 rounded-md border border-line bg-surface/30 px-4 py-3"
                      >
                        <Link
                          href={`/jobs/runs/${encodeURIComponent(r.run_id)}`}
                          className="flex-1 min-w-0"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-fg truncate">
                              {r.title}
                            </span>
                            {statusBadge(r.status, isZh)}
                          </div>
                          <div className="text-xs text-fg-muted">
                            {isZh
                              ? `更新于 ${formatRelativeTime(r.updated_at, "zh")}`
                              : `updated ${formatRelativeTime(r.updated_at, "en")}`}
                          </div>
                        </Link>
                        <button
                          type="button"
                          onClick={() => onDelete(r.run_id)}
                          className="text-xs text-fg-muted hover:text-red-400 transition"
                          aria-label={isZh ? "删除记录" : "Delete run"}
                        >
                          {isZh ? "删除" : "Delete"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusSegment({
  active,
  onClick,
  label,
  count,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone: "amber" | "emerald" | "red";
}) {
  const toneRing =
    tone === "amber"
      ? "ring-amber-500/40 text-amber-300"
      : tone === "emerald"
      ? "ring-emerald-500/40 text-emerald-300"
      : "ring-red-500/40 text-red-300";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-md ring-1 transition ${
        active
          ? `bg-surface-elevated ${toneRing}`
          : "ring-line text-fg-muted hover:text-fg hover:ring-line-strong"
      }`}
    >
      {label}
      <span className="ml-1.5 text-fg-muted">{count}</span>
    </button>
  );
}

export default function JobsPage() {
  const { locale } = useI18n();
  const isZh = locale === "zh";

  return (
    <div className="flex flex-col h-full bg-surface text-fg">
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-fg mb-1">
              {isZh ? "高管工作流 (Jobs)" : "Executive Jobs"}
            </h1>
            <p className="text-sm text-fg-muted">
              {isZh
                ? "以业务交付为导向的结构化高管工作流 — 直接起草并输出完整成果物，而非简单的对话交流。每个工作流自动协调相关专业角色与知识库，高效产出专业方案。"
                : "Structured executive workflows that produce a deliverable — not a conversation. Each job orchestrates the relevant specialists and knowledge to draft a complete artifact."}
            </p>
          </div>
          <Suspense fallback={null}>
            <JobsPageInner />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
