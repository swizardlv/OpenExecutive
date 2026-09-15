"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  OnboardingPlan,
  OnboardingTemplate,
  createOnboardingPlan,
  listOnboardingPlans,
  listOnboardingTemplates,
} from "@/lib/api";
import { PHASE_LABEL, PHASE_LABEL_ZH, STATUS_META, STATUS_ORDER } from "@/components/onboarding/meta";
import { useI18n } from "@/lib/i18n";

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-input overflow-hidden">
      <div
        className="h-full rounded-full bg-emerald-500/70"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export default function StaffOnboardingPage() {
  const { locale } = useI18n();
  const isZh = locale === "zh";

  const [plans, setPlans] = useState<OnboardingPlan[]>([]);
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [role, setRole] = useState("");
  const [templateName, setTemplateName] = useState("");

  function load() {
    setLoading(true);
    Promise.all([listOnboardingPlans(), listOnboardingTemplates()])
      .then(([p, t]) => {
        setPlans(p);
        setTemplates(t);
      })
      .catch((err) => setError(err instanceof Error ? err.message : (isZh ? "加载失败" : "Failed to load")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(
    () =>
      [...plans].sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
          a.completion_pct - b.completion_pct,
      ),
    [plans],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !startDate) return;
    setSaving(true);
    setError(null);
    try {
      await createOnboardingPlan({
        full_name: fullName.trim(),
        start_date: startDate,
        role: role.trim() || undefined,
        template_name: templateName || undefined,
      });
      setFullName("");
      setStartDate("");
      setRole("");
      setTemplateName("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isZh ? "创建方案失败" : "Failed to create plan"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-baseline justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-semibold text-fg">
                {isZh ? "员工入职引导" : "Staff Onboarding"}
              </h1>
              <p className="text-sm text-fg-muted mt-0.5">
                {isZh
                  ? "新员工入职方案 — 进度、待办任务以及生成的定制欢迎简报。"
                  : "Onboarding plans for new hires — progress, tasks, and the generated welcome brief."}
              </p>
            </div>
            <button
              onClick={() => setShowCreate((s) => !s)}
              className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              {showCreate ? (isZh ? "取消" : "Cancel") : (isZh ? "新建方案" : "New plan")}
            </button>
          </div>

          {showCreate && (
            <form
              onSubmit={handleCreate}
              className="mb-6 rounded-xl border border-line bg-surface-elevated p-4 grid gap-3 sm:grid-cols-2"
            >
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-fg-muted">{isZh ? "员工姓名 *" : "Full name *"}</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="px-3 py-2 rounded-lg bg-surface-input border border-line focus:outline-none focus:border-indigo-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-fg-muted">{isZh ? "入职日期 *" : "Start date *"}</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="px-3 py-2 rounded-lg bg-surface-input border border-line focus:outline-none focus:border-indigo-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-fg-muted">{isZh ? "岗位角色" : "Role"}</span>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={isZh ? "例如：兼职 CFO" : "e.g. Fractional CFO"}
                  className="px-3 py-2 rounded-lg bg-surface-input border border-line focus:outline-none focus:border-indigo-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-fg-muted">{isZh ? "流程模板" : "Template"}</span>
                <select
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-surface-input border border-line focus:outline-none focus:border-indigo-500"
                >
                  <option value="">{isZh ? "不使用模板（空白方案）" : "No template (blank plan)"}</option>
                  {templates.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !fullName.trim() || !startDate}
                  className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
                >
                  {saving ? (isZh ? "创建中…" : "Creating…") : (isZh ? "创建入职方案" : "Create plan")}
                </button>
              </div>
            </form>
          )}

          {loading && <p className="text-fg-muted text-sm">{isZh ? "加载中…" : "Loading…"}</p>}
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm mb-4">
              {error}
            </div>
          )}
          {!loading && !error && plans.length === 0 && (
            <div className="rounded-xl border border-line bg-surface-elevated p-8 text-center">
              <p className="text-fg-muted text-sm">
                {isZh
                  ? "暂无入职方案。可在上方新建，或在聊天中让 Executive 协助办理新员工入职。"
                  : "No onboarding plans yet. Create one above, or ask the Executive to onboard a new hire in chat."}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {sorted.map((plan) => {
              const meta = STATUS_META[plan.status] ?? STATUS_META.draft;
              return (
                <Link
                  key={plan.id}
                  href={`/staff-onboarding/${plan.id}`}
                  className="block rounded-xl border border-line bg-surface-elevated p-4 hover:border-indigo-500/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                    <div className="min-w-0">
                      <span className="font-medium text-fg">{plan.full_name}</span>
                      {plan.role && (
                        <span className="text-sm text-fg-muted"> — {plan.role}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 text-[11px] rounded-full border ${meta.cls}`}
                      >
                        {isZh ? meta.labelZh : meta.label}
                      </span>
                      <span className="text-[11px] text-fg-subtle">
                        {isZh ? (PHASE_LABEL_ZH[plan.current_phase] ?? plan.current_phase) : (PHASE_LABEL[plan.current_phase] ?? plan.current_phase)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ProgressBar pct={plan.completion_pct} />
                    <span className="text-xs text-fg-subtle tabular-nums w-10 text-right">
                      {plan.completion_pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-fg-subtle">
                    {isZh ? `入职日期 ${plan.start_date}` : `Starts ${plan.start_date}`}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
