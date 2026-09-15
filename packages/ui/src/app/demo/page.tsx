"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FixtureSummary,
  FixtureLoadResult,
  FixtureStatus,
  GenerateFixtureResult,
  listFixtures,
  loadFixture,
  getFixtureStatus,
  snapshotCurrentState,
  unloadFixture,
  resetAllState,
  generateFixture,
  createFixture,
  deleteFixture,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const RESET_CONFIRM_TOKEN = "RESET";

function formatARR(arr: number | null): string {
  if (arr == null) return "—";
  if (arr >= 1_000_000_000) return `$${(arr / 1_000_000_000).toFixed(1)}B`;
  if (arr >= 1_000_000) return `$${(arr / 1_000_000).toFixed(0)}M`;
  if (arr >= 1_000) return `$${(arr / 1_000).toFixed(0)}K`;
  return `$${arr.toFixed(0)}`;
}

const STAGE_COLORS: Record<string, string> = {
  Seed: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Seed to Series A": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Pre-Series B": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Series A": "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  "Series B": "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  Growth: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Post-Deal Growth": "bg-violet-500/15 text-violet-400 border-violet-500/30",
  "Post-Deal": "bg-violet-500/15 text-violet-400 border-violet-500/30",
};

function stageBadge(stage: string) {
  const cls =
    STAGE_COLORS[stage] ?? "bg-surface-overlay text-fg-muted border-line";
  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cls}`}
    >
      {stage}
    </span>
  );
}

export default function DemoPage() {
  const { locale } = useI18n();
  const isZh = locale === "zh";

  const [fixtures, setFixtures] = useState<FixtureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingFixture, setLoadingFixture] = useState<string | null>(null);
  const [status, setStatus] = useState<FixtureStatus>({
    active_fixture: null,
    has_snapshot: false,
  });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    kind: "success" | "error";
  } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");

  // Create-with-AI modal state.
  const [createOpen, setCreateOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<GenerateFixtureResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);

  async function refreshFixtures() {
    try {
      setFixtures(await listFixtures());
    } catch {
      // tolerate transient failures — keep last-known list
    }
  }

  function closeCreate() {
    setCreateOpen(false);
    setDescription("");
    setDraft(null);
    setGenerating(false);
    setSaving(false);
  }

  async function handleGenerate() {
    if (!description.trim()) return;
    setGenerating(true);
    try {
      const result = await generateFixture(description.trim());
      setDraft(result);
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : (isZh ? "生成失败" : "Generation failed"),
        kind: "error",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveDraft(thenLoad: boolean) {
    if (!draft) return;
    setSaving(true);
    try {
      const result = await createFixture(draft.bundle, description.trim());
      setToast({
        message: isZh
          ? `已保存 ${result.display_name}${thenLoad ? " — 正在加载…" : ""}`
          : `Saved ${result.display_name}${thenLoad ? " — loading…" : ""}`,
        kind: "success",
      });
      closeCreate();
      await refreshFixtures();
      if (thenLoad) await handleLoad(result.name);
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : (isZh ? "保存失败" : "Save failed"),
        kind: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(name: string) {
    setDeletingName(name);
    try {
      await deleteFixture(name);
      setToast({ message: isZh ? `已删除 ${name}` : `Deleted ${name}`, kind: "success" });
      await refreshFixtures();
      await refreshStatus();
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : (isZh ? "删除失败" : "Delete failed"),
        kind: "error",
      });
    } finally {
      setDeletingName(null);
    }
  }

  useEffect(() => {
    void refreshFixtures();
    void refreshStatus();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function refreshStatus() {
    try {
      setStatus(await getFixtureStatus());
    } catch {
      // tolerate transient failures — UI state stays as last known
    } finally {
      setLoading(false);
    }
  }

  async function handleLoad(name: string) {
    setLoadingFixture(name);
    try {
      const result: FixtureLoadResult = await loadFixture(name);
      const mem = result.memory_seeded;
      const memTotal =
        (mem.decisions ?? 0) +
        (mem.initiatives ?? 0) +
        (mem.advice_given ?? 0);
      setToast({
        message: isZh
          ? `已加载 ${result.display_name} — 索引了 ${result.docs_indexed} 个分块，播种了 ${memTotal} 项记忆`
          : `Loaded ${result.display_name} — ${result.docs_indexed} chunks indexed, ${memTotal} memory items seeded`,
        kind: "success",
      });
      await refreshStatus();
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : (isZh ? "加载失败" : "Failed to load fixture"),
        kind: "error",
      });
    } finally {
      setLoadingFixture(null);
    }
  }

  async function handleSnapshot() {
    setBusy(true);
    try {
      const r = await snapshotCurrentState();
      setToast({
        message: isZh
          ? `快照已保存 — ${r.people_snapshotted} 人，${r.departments_snapshotted} 个部门，${r.docs_snapshotted} 篇文档`
          : `Snapshot saved — ${r.people_snapshotted} people, ${r.departments_snapshotted} departments, ${r.docs_snapshotted} docs`,
        kind: "success",
      });
      await refreshStatus();
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : (isZh ? "快照失败" : "Snapshot failed"),
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleUnload() {
    setBusy(true);
    try {
      const r = await unloadFixture();
      setToast({
        message: isZh
          ? `已恢复您的公司 — 重新索引了 ${r.docs_indexed} 个分块，${r.people_seeded} 人`
          : `Restored your company — ${r.docs_indexed} chunks reindexed, ${r.people_seeded} people`,
        kind: "success",
      });
      await refreshStatus();
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : (isZh ? "卸载失败" : "Unload failed"),
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setBusy(true);
    try {
      const r = await resetAllState();
      setToast({
        message: isZh
          ? `重置完成 — 播种了 ${r.departments_seeded} 个默认部门，快照已清除`
          : `Reset complete — ${r.departments_seeded} default departments seeded, snapshot wiped`,
        kind: "success",
      });
      setResetOpen(false);
      setResetConfirmText("");
      await refreshStatus();
    } catch (e: unknown) {
      setToast({
        message: e instanceof Error ? e.message : (isZh ? "重置失败" : "Reset failed"),
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-surface">
      <div className="border-b border-line px-6 py-5 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-fg">
            {isZh ? "公司模拟器" : "Company Simulator"}
          </h1>
          <p className="text-xs text-fg-muted mt-1">
            {isZh
              ? "将 Executive 置于真实业务场景中。加载模拟企业（包含完整画像、文档和记忆），在委托实际业务前检验其推理、优先级判断与决策能力。"
              : "Put the Executive in a real-world scenario. Load a simulated company — full profile, documents, and memory — and test how it reasons, prioritizes, and decides before you trust it with your own."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="shrink-0 text-xs font-medium px-3 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25 transition-colors cursor-pointer"
        >
          {isZh ? "✨ 用 AI 创建" : "✨ Create with AI"}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium border max-w-md text-center ${
            toast.kind === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Create-with-AI modal */}
      {createOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-line bg-surface-elevated p-5 shadow-xl">
            {!draft ? (
              <>
                <h2 className="text-sm font-semibold text-fg">
                  {isZh ? "使用 AI 创建模拟公司" : "Create a company with AI"}
                </h2>
                <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                  {isZh
                    ? "描述一家公司及具体场景。Executive 将生成全套企业资产（画像、团队、部门、历史与文档）供你预览确认后保存。"
                    : "Describe a company and scenario. The Executive will generate a full fixture — profile, team, departments, history, and docs — for you to review before saving."}
                </p>
                <textarea
                  autoFocus
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={generating}
                  placeholder={
                    isZh
                      ? "例如：一家针对独立牙医诊所的 A 轮垂类 SaaS 初创公司，团队 45 人，月亏损 60 万美元，正面临一家融资充裕的新竞争对手…"
                      : "e.g. A Series A vertical-SaaS startup selling scheduling software to independent dental practices, 45 people, burning $600K/month, facing a new well-funded competitor…"
                  }
                  className="mt-3 w-full text-xs rounded-lg border border-line bg-surface-input text-fg placeholder:text-fg-subtle px-3 py-2 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
                />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeCreate}
                    disabled={generating}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-line bg-surface-overlay text-fg-muted hover:text-fg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isZh ? "取消" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleGenerate()}
                    disabled={generating || !description.trim()}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                        {isZh ? "生成中…" : "Generating…"}
                      </span>
                    ) : (
                      isZh ? "生成" : "Generate"
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-fg">
                  {isZh ? "审查模拟公司数据" : "Review fixture"}
                </h2>
                <p className="text-xs text-fg-muted mt-1">
                  {isZh ? "根据你的场景生成完成。确认无误后点击保存。" : "Generated from your scenario. Review, then save."}
                </p>
                <label className="block text-[11px] text-fg-muted mt-3 mb-1">
                  {isZh ? "公司名称" : "Company name"}
                </label>
                <input
                  type="text"
                  value={draft.bundle.profile.name}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      bundle: {
                        ...draft.bundle,
                        profile: { ...draft.bundle.profile, name: e.target.value },
                      },
                    })
                  }
                  className="w-full text-xs rounded-lg border border-line bg-surface-input text-fg px-3 py-2 focus:outline-none focus:border-indigo-500/50"
                />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-line bg-surface-overlay px-3 py-2">
                    <span className="text-fg-muted">{isZh ? "所属行业：" : "Industry: "}</span>
                    <span className="text-fg">{draft.bundle.profile.industry || "—"}</span>
                  </div>
                  <div className="rounded-lg border border-line bg-surface-overlay px-3 py-2">
                    <span className="text-fg-muted">{isZh ? "融资阶段：" : "Stage: "}</span>
                    <span className="text-fg">{draft.bundle.profile.stage || "—"}</span>
                  </div>
                </div>
                <div className="mt-3 text-xs text-fg-muted">
                  <span className="text-fg font-medium">{draft.bundle.people.length}</span> {isZh ? "人" : "people"}
                  {" · "}
                  <span className="text-fg font-medium">{draft.bundle.departments.length}</span> {isZh ? "个部门" : "departments"}
                  {" · "}
                  <span className="text-fg font-medium">{draft.bundle.docs.length}</span> {isZh ? "篇文档" : "docs"}
                </div>
                <div className="mt-2 text-xs text-fg-muted">
                  <span className="text-fg font-medium">{draft.bundle.memory.decisions?.length ?? 0}</span> {isZh ? "条决策" : "decisions"}
                  {" · "}
                  <span className="text-fg font-medium">{draft.bundle.memory.initiatives?.length ?? 0}</span> {isZh ? "项倡议" : "initiatives"}
                  {" · "}
                  <span className="text-fg font-medium">{draft.bundle.memory.alerts?.length ?? 0}</span> {isZh ? "条告警" : "alerts"}
                </div>
                <div className="mt-3 rounded-lg border border-line bg-surface-overlay px-3 py-2 text-xs">
                  <p className="text-fg-muted mb-1">{isZh ? "团队" : "Team"}</p>
                  <ul className="space-y-0.5">
                    {draft.bundle.people.map((p) => (
                      <li key={p.full_name} className="text-fg truncate">
                        {p.full_name}
                        {p.role ? <span className="text-fg-muted"> — {p.role}</span> : null}
                        {p.is_principal ? (
                          <span className="text-indigo-300">{isZh ? " (负责人)" : " (principal)"}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setDraft(null)}
                    disabled={saving}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-line bg-surface-overlay text-fg-muted hover:text-fg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isZh ? "← 修改提示词" : "← Edit prompt"}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSaveDraft(false)}
                      disabled={saving || !draft.bundle.profile.name.trim()}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-line bg-surface-overlay text-fg hover:bg-surface-input transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {saving ? (isZh ? "保存中…" : "Saving…") : (isZh ? "保存" : "Save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveDraft(true)}
                      disabled={saving || !draft.bundle.profile.name.trim()}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isZh ? "保存并加载" : "Save & Load"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="px-6 py-6 max-w-4xl mx-auto">
        {loading && (
          <p className="text-sm text-fg-muted">
            {isZh ? "正在加载模拟场景…" : "Loading fixtures…"}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-400">
            {isZh ? `错误：${error}。后端服务是否正在运行？` : `Error: ${error}. Is the backend running?`}
          </p>
        )}

        {/* Active-fixture banner */}
        {!loading && status.active_fixture && (
          <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3 flex-wrap">
            <div className="text-xs text-amber-200 flex-1 min-w-0">
              <span className="font-medium">{isZh ? "当前生效的模拟公司：" : "Simulated company active:"}</span>{" "}
              <span className="font-mono text-amber-100">{status.active_fixture}</span>
              {!status.has_snapshot && (
                <span className="block text-amber-300/80 mt-1">
                  {isZh
                    ? "未找到原始公司快照 — 卸载将无法恢复任何数据。"
                    : "No snapshot of your original company exists — unload won't restore anything."}
                </span>
              )}
              {status.has_snapshot && (
                <span className="block text-amber-300/80 mt-1">
                  {isZh
                    ? "在模拟环境生效期间无法创建快照 — 请先卸载以捕获真实公司状态。"
                    : "Snapshotting is disabled while a fixture is active — unload first to capture your real state."}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {status.has_snapshot && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleUnload()}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? (isZh ? "处理中…" : "Working…") : (isZh ? "卸载并恢复我的公司" : "Unload to my company")}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Snapshot CTA when no fixture is active */}
        {!loading && !status.active_fixture && !error && fixtures.length > 0 && (
          <div className="mb-5 rounded-xl border border-line bg-surface-elevated px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-fg-muted flex-1 min-w-0">
              {status.has_snapshot ? (
                isZh ? (
                  <>公司快照已存在。加载模拟公司将替换当前状态；卸载时可从快照恢复。</>
                ) : (
                  <>Snapshot of your company exists. Loading a fixture will replace state; unload restores from the snapshot.</>
                )
              ) : (
                isZh ? (
                  <>暂无公司快照。加载模拟公司将先自动创建快照。您也可以现在手动保存快照。</>
                ) : (
                  <>No snapshot of your company yet. Loading a fixture will auto-snapshot first. You can also snapshot manually now.</>
                )
              )}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSnapshot()}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-line bg-surface-overlay text-fg hover:bg-surface-input transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? (isZh ? "处理中…" : "Working…") : (isZh ? "保存当前状态为我的公司快照" : "Snapshot current as my company")}
            </button>
          </div>
        )}

        {!loading && !error && fixtures.length === 0 && (
          <p className="text-sm text-fg-muted">
            {isZh ? (
              <>
                未找到预设场景。请将公司数据目录放置在{" "}
                <code className="text-xs bg-surface-overlay px-1 py-0.5 rounded">
                  fixtures/companies/
                </code>
                。
              </>
            ) : (
              <>
                No fixtures found. Add company directories to{" "}
                <code className="text-xs bg-surface-overlay px-1 py-0.5 rounded">
                  fixtures/companies/
                </code>
                .
              </>
            )}
          </p>
        )}

        {!loading && fixtures.length > 0 && (
          <>
            <p className="text-xs text-fg-muted mb-4">
              {isZh
                ? `共 ${fixtures.length} 个可用预设场景 — 点击“加载”替换当前生效的公司上下文。`
                : `${fixtures.length} fixture${fixtures.length !== 1 ? "s" : ""} available — click Load to replace the active company context.`}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fixtures.map((fx) => {
                const isActive = status.active_fixture === fx.name;
                const isLoading = loadingFixture === fx.name;
                return (
                  <div
                    key={fx.name}
                    className={`rounded-xl border p-4 flex flex-col gap-3 transition-colors ${
                      isActive
                        ? "border-indigo-500/40 bg-indigo-500/5"
                        : "border-line bg-surface-elevated"
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm font-semibold text-fg truncate">
                            {fx.display_name}
                          </h2>
                          {isActive && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {isZh ? "生效中" : "Active"}
                            </span>
                          )}
                          {fx.source === "generated" && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                              AI
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-fg-muted mt-0.5 truncate">
                          {fx.industry}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {stageBadge(fx.stage)}
                        {fx.source === "generated" && (
                          <button
                            type="button"
                            title={isZh ? "删除该生成的场景" : "Delete this generated fixture"}
                            disabled={deletingName === fx.name || isActive}
                            onClick={() => void handleDelete(fx.name)}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {deletingName === fx.name ? "…" : (isZh ? "删除" : "Delete")}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mission */}
                    {fx.mission && (
                      <p className="text-xs text-fg-muted line-clamp-2 leading-relaxed">
                        {fx.mission}
                      </p>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-xs text-fg-muted">
                      <span>
                        <span className="text-fg font-medium">
                          {formatARR(fx.arr)}
                        </span>{" "}
                        ARR
                      </span>
                      {fx.headcount && (
                        <span>
                          <span className="text-fg font-medium">
                            {fx.headcount}
                          </span>{" "}
                          {isZh ? "人" : "people"}
                        </span>
                      )}
                      <span>
                        <span className="text-fg font-medium">
                          {fx.doc_count}
                        </span>{" "}
                        {isZh ? "篇文档" : "docs"}
                      </span>
                    </div>

                    {/* Org snapshot — departments + leadership */}
                    {(fx.departments.length > 0 || fx.people.length > 0) && (
                      <div className="border-t border-line/60 pt-3 flex flex-col gap-3">
                        {fx.departments.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle mb-1.5">
                              {isZh ? `部门 · ${fx.departments.length}` : `Departments · ${fx.departments.length}`}
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {fx.departments.slice(0, 6).map((d) => (
                                <span
                                  key={d.title}
                                  title={d.head ? `${d.title} — ${isZh ? "负责人" : "led by"} ${d.head}` : d.title}
                                  className="text-[10px] leading-none px-1.5 py-1 rounded-md bg-surface-overlay border border-line text-fg-muted"
                                >
                                  {d.title}
                                </span>
                              ))}
                              {fx.departments.length > 6 && (
                                <span className="text-[10px] leading-none px-1.5 py-1 text-fg-subtle">
                                  {isZh ? `还有 ${fx.departments.length - 6} 个` : `+${fx.departments.length - 6} more`}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {fx.people.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle mb-1.5">
                              {isZh ? `管理团队 · ${fx.people.length}` : `Leadership · ${fx.people.length}`}
                            </p>
                            <ul className="flex flex-col gap-1">
                              {fx.people.slice(0, 5).map((p) => (
                                <li
                                  key={p.name}
                                  className="flex items-baseline gap-1.5 text-[11px] min-w-0"
                                >
                                  <span className="text-fg font-medium whitespace-nowrap">
                                    {p.name}
                                  </span>
                                  {p.is_principal && (
                                    <span className="text-[9px] uppercase tracking-wide px-1 py-px rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
                                      {isZh ? "负责人" : "Principal"}
                                    </span>
                                  )}
                                  {p.role && (
                                    <span className="text-fg-subtle truncate">
                                      {p.role}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Load button */}
                    <button
                      type="button"
                      disabled={isLoading || loadingFixture !== null}
                      onClick={() => void handleLoad(fx.name)}
                      className={`w-full mt-auto px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                        isActive
                          ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30"
                          : "bg-surface-overlay border-line text-fg hover:bg-surface-input"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-1.5">
                          <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          {isZh ? "加载中…" : "Loading…"}
                        </span>
                      ) : isActive ? (
                        isZh ? "重新加载" : "Reload"
                      ) : (
                        isZh ? "加载" : "Load"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {status.active_fixture && (
              <div className="mt-6 flex items-center gap-3">
                <p className="text-xs text-fg-muted">
                  {isZh ? "公司上下文已加载。前往对话界面即可发起提问。" : "Company context loaded. Head to the chat to ask questions."}
                </p>
                <Link
                  href="/"
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isZh ? "进入对话 →" : "Open chat →"}
                </Link>
              </div>
            )}

            {/* Danger zone — reset everything */}
            <div className="mt-10 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-red-300">
                    {isZh ? "危险区域 — 重置全部状态" : "Danger zone — Reset everything"}
                  </h3>
                  <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                    {isZh ? (
                      <>
                        清除当前实时公司数据<strong>及</strong>历史快照。重新初始化 8 个默认专业部门，恢复纯净空白起点。此操作不可逆。
                      </>
                    ) : (
                      <>
                        Clears your live company data <em>and</em> the snapshot.
                        Re-seeds the 8 default specialist departments so you start
                        from a sensible blank slate. There is no undo.
                      </>
                    )}
                  </p>
                </div>
                {!resetOpen && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setResetOpen(true)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isZh ? "重置全部数据" : "Reset everything"}
                  </button>
                )}
              </div>

              {resetOpen && (
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  <label
                    htmlFor="reset-confirm-input"
                    className="text-xs text-fg-muted whitespace-nowrap"
                  >
                    {isZh ? (
                      <>
                        输入 <code className="font-mono text-red-300">{RESET_CONFIRM_TOKEN}</code> 以确认：
                      </>
                    ) : (
                      <>
                        Type{" "}
                        <code className="font-mono text-red-300">{RESET_CONFIRM_TOKEN}</code>{" "}
                        to confirm:
                      </>
                    )}
                  </label>
                  <input
                    id="reset-confirm-input"
                    type="text"
                    autoFocus
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    disabled={busy}
                    placeholder={RESET_CONFIRM_TOKEN}
                    className="text-xs font-mono px-2 py-1.5 rounded-md border border-line bg-surface-input text-fg placeholder:text-fg-subtle focus:outline-none focus:border-red-500/50 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={
                      busy || resetConfirmText !== RESET_CONFIRM_TOKEN
                    }
                    onClick={() => void handleReset()}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/20 text-red-200 hover:bg-red-500/30 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {busy ? (isZh ? "重置中…" : "Resetting…") : (isZh ? "确认重置" : "Confirm reset")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setResetOpen(false);
                      setResetConfirmText("");
                    }}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-line bg-surface-overlay text-fg-muted hover:text-fg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isZh ? "取消" : "Cancel"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
