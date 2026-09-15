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
  const { t } = useI18n();
  const cls =
    status === "on_track"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : status === "at_risk"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
      : "bg-rose-500/20 text-rose-300 border-rose-500/30";

  const label =
    status === "on_track"
      ? t("departments.page.status_on_track")
      : status === "at_risk"
      ? t("departments.page.status_at_risk")
      : status === "off_track"
      ? t("departments.page.status_off_track")
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
  const { t } = useI18n();
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
      setErr(e instanceof Error ? e.message : (t("departments.page.create_failed")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-surface-elevated rounded-xl border border-line p-6 space-y-4">
        <h2 className="text-sm font-semibold text-fg">
          {t("departments.page.new_department")}
        </h2>
        <label className="text-xs text-fg-muted flex flex-col gap-1">
          <span>{t("departments.page.name")} <span className="text-rose-400">*</span></span>
          <input
            ref={titleRef}
            type="text"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t("departments.page.eg_finance_talent_engineering")}
            className="w-full px-3 py-1.5 rounded bg-surface-input border border-line text-sm text-fg"
          />
        </label>
        <label className="text-xs text-fg-muted flex flex-col gap-1">
          <span>{t("departments.page.mission_charter_optional")}</span>
          <textarea
            rows={3}
            value={form.mission}
            onChange={(e) => setForm({ ...form, mission: e.target.value })}
            placeholder={t("departments.page.what_is_this_department_responsible")}
            className="w-full px-3 py-1.5 rounded bg-surface-input border border-line text-sm text-fg resize-none"
          />
        </label>
        {err && <div className="text-xs text-rose-400">{err}</div>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs rounded bg-surface-overlay hover:bg-surface-input border border-line text-fg"
          >
            {t("departments.page.cancel")}
          </button>
          <button
            type="button"
            disabled={saving || !form.title.trim()}
            onClick={handleCreate}
            className="px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
          >
            {saving ? (t("departments.page.creating")) : (t("departments.page.create_department"))}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DepartmentsPage() {
  const { t } = useI18n();
  const [depts, setDepts] = useState<DepartmentState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingDept, setAddingDept] = useState(false);

  useEffect(() => {
    listDepartments()
      .then(setDepts)
      .catch((e) => setError(e instanceof Error ? e.message : (t("departments.page.failed_to_load"))))
      .finally(() => setLoading(false));
  }, []);

  const authorityLabels: Record<string, string> = {
    auto_execute: t("departments.page.authority_auto_execute"),
    propose_only: t("departments.page.authority_propose_only"),
    escalate: t("departments.page.authority_escalate"),
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-xl font-semibold text-fg">
              {t("departments.page.departments")}
            </h1>
            <button
              onClick={() => setAddingDept(true)}
              className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30"
            >
              {t("departments.page.add_department")}
            </button>
          </div>
          <p className="text-sm text-fg-muted mb-6">
            {t("departments.page.each_department_wraps_a_specialist")}
          </p>

          {loading && <p className="text-fg-muted text-sm">{t("departments.page.loading")}</p>}
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
                      {t("departments.page.ds_goals_length_goalds_goals_length_____1____s", { ds_goals_length: ds.goals.length, ds_goals_length_____1____s: ds.goals.length !== 1 ? "s" : "" })}
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
