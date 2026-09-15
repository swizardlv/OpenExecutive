"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  createDepartment,
  listDepartments,
  type DepartmentCreate,
  type DepartmentState,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const AUTHORITY_COLORS: Record<string, string> = {
  auto_execute: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  propose_only: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  escalate: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

function StatusPill({ status }: { status: string }) {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const cls =
    status === "on_track"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : status === "at_risk"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : "bg-rose-500/20 text-rose-300 border-rose-500/30";

  const label = isZh
    ? (status === "on_track" ? "正常推进" : status === "at_risk" ? "有风险" : "偏离目标")
    : status.replace("_", " ");

  return (
    <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

interface AddDepartmentModalProps {
  onCreated: (dept: DepartmentState) => void;
  onCancel: () => void;
}

function AddDepartmentModal({ onCreated, onCancel }: AddDepartmentModalProps) {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const [form, setForm] = useState<DepartmentCreate>({ title: "", mission: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  async function handleCreate() {
    setSaving(true);
    setErr(null);
    try {
      const dept = await createDepartment({ title: form.title.trim(), mission: form.mission });
      onCreated(dept);
    } catch (e) {
      setErr(e instanceof Error ? e.message : (isZh ? "创建失败" : "Create failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-surface-elevated rounded-xl border border-line p-6 space-y-4">
        <h2 className="text-sm font-semibold text-fg">
          {isZh ? "新增部门" : "New Department"}
        </h2>
        <label className="text-xs text-fg-muted flex flex-col gap-1">
          <span>{isZh ? "名称" : "Name"} <span className="text-rose-400">*</span></span>
          <input
            ref={titleRef}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            onKeyDown={(e) => { if (e.key === "Enter" && form.title.trim()) handleCreate(); }}
            className="px-2 py-1.5 rounded-lg bg-surface border border-line text-sm focus:outline-none focus:border-indigo-500"
            placeholder={isZh ? "客户成功部" : "Customer Success"}
          />
        </label>
        <label className="text-xs text-fg-muted flex flex-col gap-1">
          <span>{isZh ? "职责使命" : "Mission"} <span className="text-fg-muted/60">{isZh ? "(可选)" : "(optional)"}</span></span>
          <textarea
            value={form.mission}
            onChange={(e) => setForm((f) => ({ ...f, mission: e.target.value }))}
            rows={3}
            className="px-2 py-1.5 rounded-lg bg-surface border border-line text-sm focus:outline-none focus:border-indigo-500 resize-none"
            placeholder={isZh ? "该部门主要负责什么？" : "What does this department own?"}
          />
        </label>
        {err && <p className="text-xs text-rose-300">{err}</p>}
        <div className="flex gap-2">
          <button
            disabled={saving || !form.title.trim()}
            onClick={handleCreate}
            className="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
          >
            {saving ? (isZh ? "创建中…" : "Creating…") : (isZh ? "创建" : "Create")}
          </button>
          <button
            disabled={saving}
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-lg border border-line hover:bg-surface-overlay disabled:opacity-50"
          >
            {isZh ? "取消" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DepartmentsPage() {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const [depts, setDepts] = useState<DepartmentState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingDept, setAddingDept] = useState(false);

  useEffect(() => {
    listDepartments()
      .then(setDepts)
      .catch((e) => setError(e instanceof Error ? e.message : (isZh ? "加载失败" : "Failed to load")))
      .finally(() => setLoading(false));
  }, [isZh]);

  const authorityLabels: Record<string, string> = isZh
    ? { auto_execute: "自动执行", propose_only: "仅提议", escalate: "升级上报" }
    : { auto_execute: "Auto", propose_only: "Propose", escalate: "Escalate" };

  return (
    <div className="flex flex-col h-full bg-surface">
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-semibold text-fg">
              {isZh ? "部门架构" : "Departments"}
            </h1>
            <button
              onClick={() => setAddingDept(true)}
              className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30"
            >
              {isZh ? "+ 新增部门" : "+ Add department"}
            </button>
          </div>
          <p className="text-sm text-fg-muted mb-6">
            {isZh
              ? "每个部门由一名具备持续目标、授权级别和跟进周期的专业专员智能体负责。"
              : "Each department wraps a specialist agent with persistent Goals, authority level, and cadences."}
          </p>

          {loading && <p className="text-fg-muted text-sm">{isZh ? "加载中…" : "Loading…"}</p>}
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm mb-4">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {depts.map((ds) => {
              const cfg = ds.config;
              const atRisk = ds.goals.filter((g) => g.status === "at_risk").length;
              const offTrack = ds.goals.filter((g) => g.status === "off_track").length;
              const authCls = AUTHORITY_COLORS[cfg.authority_level] ?? "bg-surface-input/40 text-fg border-line";
              return (
                <Link
                  key={cfg.slug}
                  href={`/departments/${cfg.slug}`}
                  className="block rounded-xl border border-line bg-surface-elevated hover:bg-surface-overlay transition-colors p-4 group"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="text-sm font-semibold text-fg group-hover:text-indigo-300 transition-colors">
                        {cfg.title}
                      </div>
                      <div className="text-xs text-fg-muted mt-0.5">{cfg.charter.mission.slice(0, 80)}{cfg.charter.mission.length > 80 ? "…" : ""}</div>
                    </div>
                    <span className={`flex-shrink-0 inline-block px-2 py-0.5 rounded border text-[10px] font-medium ${authCls}`}>
                      {authorityLabels[cfg.authority_level] ?? cfg.authority_level}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-3 text-xs text-fg-muted">
                    <span>
                      {isZh
                        ? `${ds.goals.length} 个目标`
                        : `${ds.goals.length} Goal${ds.goals.length !== 1 ? "s" : ""}`}
                    </span>
                    {atRisk > 0 && <StatusPill status="at_risk" />}
                    {offTrack > 0 && <StatusPill status="off_track" />}
                    {ds.goals.length > 0 && atRisk === 0 && offTrack === 0 && (
                      <StatusPill status="on_track" />
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>

      {addingDept && (
        <AddDepartmentModal
          onCreated={(dept) => {
            setDepts((prev) => [...prev, dept]);
            setAddingDept(false);
          }}
          onCancel={() => setAddingDept(false)}
        />
      )}
    </div>
  );
}
