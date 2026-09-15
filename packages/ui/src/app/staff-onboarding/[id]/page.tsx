"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  OnboardingPlan,
  OnboardingTask,
  activateOnboardingPlan,
  advanceOnboardingPlan,
  getOnboardingPlan,
  setOnboardingTaskStatus,
} from "@/lib/api";
import { PHASE_LABEL, PHASE_LABEL_ZH, PHASE_ORDER, STATUS_META } from "@/components/onboarding/meta";
import { useI18n } from "@/lib/i18n";

export default function OnboardingPlanDetailPage() {
  const { locale } = useI18n();
  const isZh = locale === "zh";

  const params = useParams();
  const planId = Number(params.id);

  const [plan, setPlan] = useState<OnboardingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getOnboardingPlan(planId)
      .then(setPlan)
      .catch((err) => setError(err instanceof Error ? err.message : (isZh ? "加载失败" : "Failed to load")))
      .finally(() => setLoading(false));
  }, [planId, isZh]);

  useEffect(() => {
    if (!Number.isNaN(planId)) load();
  }, [planId, load]);

  async function runAction(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isZh ? "操作失败" : "Action failed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleTask(task: OnboardingTask) {
    if (task.id == null) return;
    const next = task.status === "done" ? "pending" : "done";
    await runAction(() => setOnboardingTaskStatus(task.id as number, next));
  }

  if (loading) {
    return <div className="p-6 text-sm text-fg-muted">{isZh ? "加载中…" : "Loading…"}</div>;
  }
  if (error && !plan) {
    return (
      <div className="p-6">
        <Link href="/staff-onboarding" className="text-indigo-300 hover:text-indigo-200 text-sm">
          {isZh ? "← 返回" : "← Back"}
        </Link>
        <p className="mt-4 text-sm text-rose-300">{error}</p>
      </div>
    );
  }
  if (!plan) return null;

  const meta = STATUS_META[plan.status] ?? STATUS_META.draft;
  const tasksByPhase = PHASE_ORDER.map((phase) => ({
    phase,
    tasks: plan.tasks.filter((t) => t.phase === phase),
  })).filter((g) => g.tasks.length > 0);

  return (
    <div className="flex flex-col h-full bg-surface">
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <Link
            href="/staff-onboarding"
            className="text-indigo-300 hover:text-indigo-200 text-sm"
          >
            {isZh ? "← 全部方案" : "← All plans"}
          </Link>

          <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-fg">
                {plan.full_name}
                {plan.role && <span className="text-fg-muted"> — {plan.role}</span>}
              </h1>
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className={`px-2 py-0.5 text-[11px] rounded-full border ${meta.cls}`}>
                  {isZh ? meta.labelZh : meta.label}
                </span>
                <span className="text-fg-subtle">
                  {isZh ? (PHASE_LABEL_ZH[plan.current_phase] ?? plan.current_phase) : (PHASE_LABEL[plan.current_phase] ?? plan.current_phase)}
                </span>
                <span className="text-fg-subtle">· {isZh ? `入职日期 ${plan.start_date}` : `starts ${plan.start_date}`}</span>
                <span className="text-fg-subtle">· {isZh ? `已完成 ${plan.completion_pct}%` : `${plan.completion_pct}% complete`}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {plan.status === "draft" && (
                <button
                  onClick={() => runAction(() => activateOnboardingPlan(planId))}
                  disabled={busy}
                  className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white"
                >
                  {isZh ? "启用方案" : "Activate"}
                </button>
              )}
              <button
                onClick={() => runAction(() => advanceOnboardingPlan(planId))}
                disabled={busy}
                className="px-3 py-1.5 text-sm rounded-lg bg-surface-input border border-line hover:border-indigo-500 disabled:opacity-50"
              >
                {isZh ? "推进阶段" : "Advance phase"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
              {error}
            </div>
          )}

          {/* Tasks */}
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-3">
              {isZh ? "任务清单" : "Checklist"}
            </h2>
            {tasksByPhase.length === 0 && (
              <p className="text-sm text-fg-subtle">{isZh ? "此方案暂无任务。" : "No tasks on this plan."}</p>
            )}
            <div className="space-y-4">
              {tasksByPhase.map(({ phase, tasks }) => (
                <div key={phase}>
                  <div className="text-[11px] font-semibold text-fg-subtle uppercase tracking-wide mb-1.5">
                    {isZh ? (PHASE_LABEL_ZH[phase] ?? phase) : PHASE_LABEL[phase]}
                  </div>
                  <div className="space-y-1.5">
                    {tasks.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-3 rounded-lg border border-line bg-surface-elevated px-3 py-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={t.status === "done"}
                          onChange={() => toggleTask(t)}
                          disabled={busy || t.status === "skipped"}
                          className="accent-emerald-500"
                        />
                        <span
                          className={`text-sm flex-1 ${
                            t.status === "done"
                              ? "line-through text-fg-subtle"
                              : "text-fg"
                          }`}
                        >
                          {t.title}
                        </span>
                        {t.due_date && (
                          <span className="text-[11px] text-fg-subtle tabular-nums">
                            {isZh ? `截止 ${t.due_date}` : `due ${t.due_date}`}
                          </span>
                        )}
                        {t.status === "skipped" && (
                          <span className="text-[11px] text-fg-subtle">{isZh ? "已跳过" : "skipped"}</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Reading list */}
          {plan.reading_list.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-2">
                {isZh ? "推荐阅读资料" : "Suggested reading"}
              </h2>
              <ul className="list-disc list-inside text-sm text-fg-muted space-y-0.5">
                {plan.reading_list.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          )}

          {/* Ramp */}
          {plan.ramp_segments.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-2">
                {isZh ? "渐进式培训推送" : "Ramp drip"}
              </h2>
              <p className="text-sm text-fg-muted">
                {isZh
                  ? `${plan.ramp_segments.length} 条每日消息 · 已发送 ${plan.ramp_next_index} 条`
                  : `${plan.ramp_segments.length} daily message${plan.ramp_segments.length === 1 ? "" : "s"} · ${plan.ramp_next_index} sent`}
              </p>
            </section>
          )}

          {/* Welcome brief */}
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-2">
              {isZh ? "入职欢迎简报" : "Welcome brief"}
            </h2>
            {plan.brief_artifact ? (
              <div
                className="prose prose-invert prose-sm max-w-none rounded-lg border border-line bg-surface/40 p-6
                  prose-headings:text-fg prose-headings:font-semibold
                  prose-p:text-fg prose-p:leading-relaxed
                  prose-li:text-fg prose-strong:text-fg"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {plan.brief_artifact}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-fg-subtle">
                {isZh
                  ? `尚未生成欢迎简报 — 可在聊天中让 Executive “开始为 ${plan.full_name} 办理入职”以生成岗位定制的欢迎简报。`
                  : `No brief generated yet — ask the Executive to “start onboarding for ${plan.full_name}” in chat to generate the role-tailored welcome brief.`}
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
