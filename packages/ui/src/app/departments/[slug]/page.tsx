"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import TimeframePicker, { suggestPeriodValue } from "@/components/TimeframePicker";
import {
  createGoal,
  deleteGoal,
  deleteDepartment,
  getDepartment,
  listPeople,
  updateDepartment,
  updateGoal,
  type DepartmentConfig,
  type DepartmentState,
  type Goal,
  type Person,
  type PeriodType,
} from "@/lib/api";
import { formatRelativeTime } from "@/lib/relativeTime";
import { useI18n } from "@/lib/i18n";

// Auto-refresh cadence for the detail page. The `dept_cadence` scheduler
// fires at most once per department per cadence (default daily), so any
// poll faster than ~30s is overkill for review-driven status changes
// but keeps the page feeling live for cross-tab edits.
const POLL_INTERVAL_MS = 30_000;
// "Last reviewed >N days ago" → render the row with a stale accent.
// Healthy departments have `daily@09:00` so nothing should ever exceed 1d;
// 7d catches departments that drift well past their cadence.
const STALE_REVIEW_DAYS = 7;
const STALE_REVIEW_MS = STALE_REVIEW_DAYS * 24 * 60 * 60 * 1000;

function isStaleReview(lastReviewedAt: string): boolean {
  if (!lastReviewedAt) return false; // "Never reviewed" rendered separately
  const ts = new Date(lastReviewedAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts > STALE_REVIEW_MS;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_OPTS = ["on_track", "at_risk", "off_track"] as const;
type GoalStatus = (typeof STATUS_OPTS)[number];

const STATUS_COLORS: Record<string, string> = {
  on_track: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  at_risk: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  off_track: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

const AUTHORITY_OPTS: DepartmentConfig["authority_level"][] = [
  "auto_execute",
  "propose_only",
  "escalate",
];

function getAuthorityMeta(level: DepartmentConfig["authority_level"], t: (k: string) => string) {
  const meta = {
    auto_execute: {
      label: t("departments.slug.page.acts_on_its_own"),
      hint: t("departments.slug.page.the_specialist_runs_actions_in"),
    },
    propose_only: {
      label: t("departments.slug.page.proposes_you_approve"),
      hint: t("departments.slug.page.the_specialist_drafts_actions_and"),
    },
    escalate: {
      label: t("departments.slug.page.escalates_to_a_human"),
      hint: t("departments.slug.page.the_specialist_will_not_act"),
    },
  };
  return meta[level];
}

function cls(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Goal row — view or edit
// ---------------------------------------------------------------------------

interface GoalRowProps {
  slug: string;
  goal: Goal;
  onSaved: (updated: Goal) => void;
  onDeleted: (id: number) => void;
  // Surface edit-mode transitions so the parent can pause polling — a
  // server snapshot replacing `goals` while a user is mid-edit would
  // flicker the view label and discard the form state.
  onEditingChange?: (editing: boolean) => void;
}

function _formatPeriodLabel(g: Goal, t: (k: string, f?: string) => string): string {
  if (g.period_type === "ongoing") return g.period_value || t("departments.slug.page.ongoing", "持续推进");
  const typeLabel = t(`departments.slug.page.period_${g.period_type}`, g.period_type);
  return `${typeLabel}: ${g.period_value}`;
}

function GoalRow({ slug, goal, onSaved, onDeleted, onEditingChange }: GoalRowProps) {
  const { locale, t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    period_type: goal.period_type,
    period_value: goal.period_value,
    key_result: goal.key_result,
    target: goal.target,
    current: goal.current,
    status: goal.status as GoalStatus,
  });

  const statusLabels: Record<GoalStatus, string> = {
    on_track: t("departments.slug.page.on_track"),
    at_risk: t("departments.slug.page.at_risk"),
    off_track: t("departments.slug.page.off_track"),
  };

  // Centralise the editing transition so save/cancel/enter all notify
  // the parent — avoids forgetting the call in one branch.
  function setEditingAndNotify(next: boolean) {
    setEditing(next);
    onEditingChange?.(next);
  }

  const editingRef = useRef(editing);
  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);
  useEffect(() => {
    return () => {
      if (editingRef.current) onEditingChange?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stale = isStaleReview(goal.last_reviewed_at);

  if (!editing) {
    return (
      <div
        className={cls(
          "flex items-start gap-3 py-3 border-b border-line last:border-0 group",
          stale && "border-l-2 border-l-amber-500/60 pl-3 -ml-3"
        )}
      >
        <span
          className={cls(
            "mt-0.5 flex-shrink-0 inline-block px-2 py-0.5 rounded border text-[10px] font-medium",
            STATUS_COLORS[goal.status]
          )}
        >
          {statusLabels[goal.status as GoalStatus] ?? goal.status.replace("_", " ")}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-fg font-medium">{goal.key_result}</div>
          <div className="text-xs text-fg-muted mt-0.5">
            {t("departments.slug.page.target_2")}{goal.target}
            {goal.current ? ` — ${t("departments.slug.page.current_2")}${goal.current}` : ""}
          </div>
          <div className="text-xs text-fg-subtle mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{_formatPeriodLabel(goal, t)}</span>
            <span aria-hidden="true">·</span>
            {goal.last_reviewed_at ? (
              <span className={cls(stale && "text-amber-400")}>
                {t("departments.slug.page.last_reviewed_formatrelativetime_goal_last_reviewed_at", { formatRelativeTime_goal_last_reviewed_at: formatRelativeTime(goal.last_reviewed_at), formatRelativeTime_goal_last_reviewed_at__locale: formatRelativeTime(goal.last_reviewed_at, locale) })}
              </span>
            ) : (
              <span className="italic">{t("departments.slug.page.never_reviewed")}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <div className="flex gap-1">
            <button
              onClick={() => setEditingAndNotify(true)}
              className="px-2 py-1 text-xs rounded bg-surface-overlay hover:bg-surface-input border border-line"
            >
              {t("departments.slug.page.edit")}
            </button>
            <button
              disabled={deleting}
              onClick={async () => {
                if (!window.confirm(t("departments.slug.page.delete_this_goal"))) return;
                setDeleting(true);
                setErr(null);
                try {
                  await deleteGoal(slug, goal.id!);
                  onDeleted(goal.id!);
                } catch (e) {
                  setErr(e instanceof Error ? e.message : (t("departments.slug.page.delete_failed")));
                  setDeleting(false);
                }
              }}
              className="px-2 py-1 text-xs rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 disabled:opacity-50"
            >
              {deleting ? "…" : (t("departments.slug.page.delete"))}
            </button>
          </div>
          {err && <span className="text-[10px] text-rose-300">{err}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="py-3 border-b border-line last:border-0 space-y-2">
      <TimeframePicker
        periodType={form.period_type}
        periodValue={form.period_value}
        onChange={(pt, pv) => setForm((f) => ({ ...f, period_type: pt, period_value: pv }))}
        size="compact"
      />
      <label className="text-xs text-fg-muted flex flex-col gap-1">
        {t("departments.slug.page.status")}
        <select
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as GoalStatus }))}
          className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm focus:outline-none focus:border-indigo-500"
        >
          {STATUS_OPTS.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-fg-muted flex flex-col gap-1">
        {t("departments.slug.page.key_result")}
        <input
          value={form.key_result}
          onChange={(e) => setForm((f) => ({ ...f, key_result: e.target.value }))}
          className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm focus:outline-none focus:border-indigo-500"
          placeholder={t("departments.slug.page.close_series_a_by_jun")}
        />
      </label>
      <label className="text-xs text-fg-muted flex flex-col gap-1">
        {t("departments.slug.page.target")}
        <input
          value={form.target}
          onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
          className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm focus:outline-none focus:border-indigo-500"
          placeholder={t("departments.slug.page.what_does_done_look_like")}
        />
      </label>
      <label className="text-xs text-fg-muted flex flex-col gap-1">
        {t("departments.slug.page.current")}
        <input
          value={form.current}
          onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
          className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm focus:outline-none focus:border-indigo-500"
          placeholder={t("departments.slug.page.where_are_we_now")}
        />
      </label>
      {err && <p className="text-xs text-rose-300">{err}</p>}
      <div className="flex gap-2">
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setErr(null);
            try {
              const updated = await updateGoal(slug, goal.id!, form);
              onSaved(updated);
              setEditingAndNotify(false);
            } catch (e) {
              setErr(e instanceof Error ? e.message : (t("departments.slug.page.save_failed")));
            } finally {
              setSaving(false);
            }
          }}
          className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
        >
          {saving ? (t("departments.slug.page.saving")) : (t("departments.slug.page.save"))}
        </button>
        <button
          disabled={saving}
          onClick={() => {
            setForm({
              period_type: goal.period_type,
              period_value: goal.period_value,
              key_result: goal.key_result,
              target: goal.target,
              current: goal.current,
              status: goal.status as GoalStatus,
            });
            setEditingAndNotify(false);
            setErr(null);
          }}
          className="px-3 py-1.5 text-xs rounded-lg border border-line hover:bg-surface-overlay disabled:opacity-50"
        >
          {t("departments.slug.page.cancel")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Goal form
// ---------------------------------------------------------------------------

interface AddGoalFormProps {
  slug: string;
  onCreated: (goal: Goal) => void;
  onCancel: () => void;
}

function AddGoalForm({ slug, onCreated, onCancel }: AddGoalFormProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<{
    period_type: PeriodType;
    period_value: string;
    key_result: string;
    target: string;
    current: string;
    status: GoalStatus;
  }>(() => ({
    period_type: "quarter",
    period_value: suggestPeriodValue("quarter"),
    key_result: "",
    target: "",
    current: "",
    status: "on_track",
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  const statusLabels: Record<GoalStatus, string> = {
    on_track: t("departments.slug.page.on_track"),
    at_risk: t("departments.slug.page.at_risk"),
    off_track: t("departments.slug.page.off_track"),
  };

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  return (
    <div className="py-3 border-b border-line space-y-2 bg-surface-overlay/30 px-4 -mx-4 rounded-lg">
      <div className="text-xs font-semibold text-fg-muted uppercase tracking-wide mb-1">
        {t("departments.slug.page.new_goal")}
      </div>
      <TimeframePicker
        periodType={form.period_type}
        periodValue={form.period_value}
        onChange={(pt, pv) => setForm((f) => ({ ...f, period_type: pt, period_value: pv }))}
        size="compact"
      />
      <label className="text-xs text-fg-muted flex flex-col gap-1">
        {t("departments.slug.page.status")}
        <select
          value={form.status}
          onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as GoalStatus }))}
          className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm focus:outline-none focus:border-indigo-500"
        >
          {STATUS_OPTS.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-fg-muted flex flex-col gap-1">
        {t("departments.slug.page.key_result")}
        <input
          ref={firstRef}
          value={form.key_result}
          onChange={(e) => setForm((f) => ({ ...f, key_result: e.target.value }))}
          className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm focus:outline-none focus:border-indigo-500"
          placeholder={t("departments.slug.page.what_do_we_want_to")}
        />
      </label>
      <label className="text-xs text-fg-muted flex flex-col gap-1">
        {t("departments.slug.page.target")}
        <input
          value={form.target}
          onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
          className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm focus:outline-none focus:border-indigo-500"
          placeholder={t("departments.slug.page.measurable_target")}
        />
      </label>
      <label className="text-xs text-fg-muted flex flex-col gap-1">
        {t("departments.slug.page.current_optional")}
        <input
          value={form.current}
          onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
          className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm focus:outline-none focus:border-indigo-500"
          placeholder={t("departments.slug.page.current_progress")}
        />
      </label>
      {err && <p className="text-xs text-rose-300">{err}</p>}
      <div className="flex gap-2">
        <button
          disabled={saving || !form.period_value || !form.key_result || !form.target}
          onClick={async () => {
            setSaving(true);
            setErr(null);
            try {
              const goal = await createGoal(slug, form);
              onCreated(goal);
            } catch (e) {
              setErr(e instanceof Error ? e.message : (t("departments.slug.page.create_failed")));
            } finally {
              setSaving(false);
            }
          }}
          className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
        >
          {saving ? (t("departments.slug.page.creating")) : (t("departments.slug.page.add_goal_2"))}
        </button>
        <button
          disabled={saving}
          onClick={onCancel}
          className="px-3 py-1.5 text-xs rounded-lg border border-line hover:bg-surface-overlay disabled:opacity-50"
        >
          {t("departments.slug.page.cancel")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DepartmentDetailPage() {
  const { locale, t } = useI18n();
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();

  const [dept, setDept] = useState<DepartmentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // People for the head-person picker (loaded lazily)
  const [people, setPeople] = useState<Person[]>([]);

  // Settings edit state
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    authority_level: "propose_only" as DepartmentConfig["authority_level"],
    mission: "",
    cadences: {} as Record<string, string>,
    headcount: "",
    budget_usd: "",
    head_person_id: null as number | null,
    slack_channel_id: "",
    discord_channel_id: "",
    telegram_chat_id: "",
    // One entity per line in the textarea; split + trimmed on save.
    watched_entities: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsErr, setSettingsErr] = useState<string | null>(null);

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  // Goal state
  const [goals, setGoals] = useState<Goal[]>([]);
  const [addingGoal, setAddingGoal] = useState(false);

  const [editingGoalCount, setEditingGoalCount] = useState(0);
  const editingGoalCountRef = useRef(0);
  const editingSettingsRef = useRef(false);
  const addingGoalRef = useRef(false);
  useEffect(() => {
    editingGoalCountRef.current = editingGoalCount;
  }, [editingGoalCount]);
  useEffect(() => {
    editingSettingsRef.current = editingSettings;
  }, [editingSettings]);
  useEffect(() => {
    addingGoalRef.current = addingGoal;
  }, [addingGoal]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    function applyDept(d: DepartmentState, isInitial: boolean) {
      if (cancelled) return;
      setDept(d);
      if (isInitial || editingGoalCountRef.current === 0) {
        setGoals(d.goals);
      }
      if (isInitial || !editingSettingsRef.current) {
        setSettingsForm({
          authority_level: d.config.authority_level,
          mission: d.config.charter.mission,
          cadences: { ...d.config.cadences },
          headcount: d.headcount != null ? String(d.headcount) : "",
          budget_usd: d.budget_usd != null ? String(d.budget_usd) : "",
          head_person_id: d.config.head_person_id,
          slack_channel_id: d.config.slack_channel_id ?? "",
          discord_channel_id: d.config.discord_channel_id ?? "",
          telegram_chat_id: d.config.telegram_chat_id ?? "",
          watched_entities: (d.config.watched_entities ?? []).join("\n"),
        });
      }
      if (isInitial && d.config.head_person_id != null) {
        listPeople().then(setPeople).catch(() => {});
      }
    }

    getDepartment(slug)
      .then((d) => applyDept(d, /* isInitial */ true))
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : (t("departments.slug.page.failed_to_load")));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const interval = window.setInterval(() => {
      if (
        editingGoalCountRef.current > 0
        || editingSettingsRef.current
        || addingGoalRef.current
      ) {
        return;
      }
      getDepartment(slug)
        .then((d) => applyDept(d, /* isInitial */ false))
        .catch(() => {});
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [slug]);

  useEffect(() => {
    if (editingSettings && people.length === 0) {
      listPeople().then(setPeople).catch(() => {});
    }
  }, [editingSettings, people.length]);

  async function saveSettings() {
    if (!dept) return;
    setSavingSettings(true);
    setSettingsErr(null);
    try {
      const headcountNum = settingsForm.headcount.trim() !== "" ? Number(settingsForm.headcount) : undefined;
      const budgetNum = settingsForm.budget_usd.trim() !== "" ? Number(settingsForm.budget_usd) : undefined;
      const updated = await updateDepartment(slug, {
        authority_level: settingsForm.authority_level,
        charter: {
          mission: settingsForm.mission,
          scope: dept.config.charter.scope,
          out_of_scope: dept.config.charter.out_of_scope,
        },
        cadences: settingsForm.cadences,
        headcount: headcountNum,
        budget_usd: budgetNum,
        head_person_id: settingsForm.head_person_id,
        slack_channel_id: settingsForm.slack_channel_id.trim() || null,
        discord_channel_id: settingsForm.discord_channel_id.trim() || null,
        telegram_chat_id: settingsForm.telegram_chat_id.trim() || null,
        watched_entities: settingsForm.watched_entities
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
      });
      setDept(updated);
      setEditingSettings(false);
    } catch (e) {
      setSettingsErr(e instanceof Error ? e.message : (t("departments.slug.page.save_failed")));
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {loading && <p className="text-fg-muted text-sm">{t("departments.slug.page.loading")}</p>}
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
              {error}
            </div>
          )}
          {dept && (
            <>
              {/* Header */}
              <div className="flex items-start justify-between mb-6 gap-3">
                <div>
                  <h1 className="text-xl font-semibold text-fg">{dept.config.title}</h1>
                  <div className="text-xs text-fg-muted mt-1">
                    {dept.config.specialist_key ? (
                      <>{t("departments.slug.page.specialist")}<code className="font-mono text-fg">{dept.config.specialist_key}</code></>
                    ) : (
                      <span className="italic">{t("departments.slug.page.informational_department_no_specialist_agent")}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      if (editingSettings) {
                        setSettingsForm({
                          authority_level: dept.config.authority_level,
                          mission: dept.config.charter.mission,
                          cadences: { ...dept.config.cadences },
                          headcount: dept.headcount != null ? String(dept.headcount) : "",
                          budget_usd: dept.budget_usd != null ? String(dept.budget_usd) : "",
                          head_person_id: dept.config.head_person_id,
                          slack_channel_id: dept.config.slack_channel_id ?? "",
                          discord_channel_id: dept.config.discord_channel_id ?? "",
                          telegram_chat_id: dept.config.telegram_chat_id ?? "",
                          watched_entities: (dept.config.watched_entities ?? []).join("\n"),
                        });
                        setSettingsErr(null);
                      }
                      setEditingSettings((v) => !v);
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg border border-line hover:bg-surface-overlay transition-colors"
                  >
                    {editingSettings ? (t("departments.slug.page.cancel")) : (t("departments.slug.page.edit_settings"))}
                  </button>
                  <button
                    disabled={deleting}
                    onClick={async () => {
                      const confirmMsg = t("departments.slug.page.delete_dept_config_title_this_will_also", { dept_config_title: dept.config.title });
                      if (!window.confirm(confirmMsg)) return;
                      setDeleting(true);
                      setDeleteErr(null);
                      try {
                        await deleteDepartment(slug);
                        router.push("/departments");
                      } catch (e) {
                        setDeleteErr(e instanceof Error ? e.message : (t("departments.slug.page.delete_failed")));
                        setDeleting(false);
                      }
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 disabled:opacity-50 transition-colors"
                  >
                    {deleting ? (t("departments.slug.page.deleting")) : (t("departments.slug.page.delete_department"))}
                  </button>
                </div>
              </div>
              {deleteErr && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm mb-4">
                  {deleteErr}
                </div>
              )}

              {/* Settings — three stacked cards in edit mode, single summary card in read mode */}
              {editingSettings ? (
                <div className="space-y-4 mb-6">
                  {/* Card 1: Charter */}
                  <section className="rounded-xl border border-line bg-surface-elevated px-4 py-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-3">
                      {t("departments.slug.page.charter")}
                    </h3>
                    <label className="text-xs text-fg-muted flex flex-col gap-1">
                      {t("departments.slug.page.mission")}
                      <textarea
                        value={settingsForm.mission}
                        onChange={(e) =>
                          setSettingsForm((f) => ({ ...f, mission: e.target.value }))
                        }
                        rows={3}
                        className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm focus:outline-none focus:border-indigo-500 resize-none"
                      />
                    </label>
                  </section>

                  {/* Card 2: How it acts */}
                  <section className="rounded-xl border border-line bg-surface-elevated px-4 py-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-3">
                      {t("departments.slug.page.how_it_acts")}
                    </h3>
                    <div className="space-y-3">
                      <label className="text-xs text-fg-muted flex flex-col gap-1">
                        {t("departments.slug.page.department_head")}
                        <select
                          value={settingsForm.head_person_id ?? ""}
                          onChange={(e) =>
                            setSettingsForm((f) => ({
                              ...f,
                              head_person_id: e.target.value ? Number(e.target.value) : null,
                            }))
                          }
                          className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">{t("departments.slug.page.none")}</option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.full_name}{p.role ? ` — ${p.role}` : ""}{p.is_principal ? (t("departments.slug.page.you")) : ""}
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] text-fg-muted">
                          {t("departments.slug.page.the_executive_surfaces_this_person")}
                        </span>
                      </label>
                      <div className="space-y-1.5">
                        {AUTHORITY_OPTS.map((a) => {
                          const meta = getAuthorityMeta(a, t);
                          const checked = settingsForm.authority_level === a;
                          return (
                            <label
                              key={a}
                              className={cls(
                                "flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors",
                                checked
                                  ? "border-indigo-500/50 bg-indigo-600/10"
                                  : "border-line hover:border-indigo-500/30 bg-surface-input"
                              )}
                            >
                              <input
                                type="radio"
                                name="authority_level"
                                value={a}
                                checked={checked}
                                onChange={() =>
                                  setSettingsForm((f) => ({ ...f, authority_level: a }))
                                }
                                className="mt-0.5 accent-indigo-500 flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-fg">{meta.label}</div>
                                <div className="text-[10px] text-fg-muted mt-0.5">{meta.hint}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>

                      <div>
                        <div className="text-xs text-fg-muted mb-1">{t("departments.slug.page.recurring_checkin")}</div>
                        {Object.entries(settingsForm.cadences).map(([name, spec]) => (
                          <div key={name} className="flex items-center gap-2 mb-1.5">
                            <input
                              value={name}
                              readOnly
                              className="flex-1 px-2 py-1.5 rounded-lg bg-surface-input border border-line text-xs font-mono text-fg-muted focus:outline-none"
                            />
                            <input
                              value={spec}
                              onChange={(e) =>
                                setSettingsForm((f) => ({
                                  ...f,
                                  cadences: { ...f.cadences, [name]: e.target.value },
                                }))
                              }
                              className="flex-1 px-2 py-1.5 rounded-lg bg-surface-input border border-line text-xs font-mono focus:outline-none focus:border-indigo-500"
                              placeholder="daily@09:00"
                            />
                          </div>
                        ))}
                        <p className="text-[10px] text-fg-muted mt-1">
                          {t("departments.slug.page.when_set_the_specialist_posts")}
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Card 3: Numbers */}
                  <section className="rounded-xl border border-line bg-surface-elevated px-4 py-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-3">
                      {t("departments.slug.page.numbers")}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-fg-muted flex flex-col gap-1">
                        {t("departments.slug.page.headcount")}
                        <input
                          type="number"
                          min={0}
                          value={settingsForm.headcount}
                          onChange={(e) =>
                            setSettingsForm((f) => ({ ...f, headcount: e.target.value }))
                          }
                          className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </label>
                      <label className="text-xs text-fg-muted flex flex-col gap-1">
                        {t("departments.slug.page.budget_usd")}
                        <input
                          type="number"
                          min={0}
                          value={settingsForm.budget_usd}
                          onChange={(e) =>
                            setSettingsForm((f) => ({ ...f, budget_usd: e.target.value }))
                          }
                          className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </label>
                    </div>
                  </section>

                  {/* Card 4: Broadcast channels — OE can post to these team rooms */}
                  <section className="rounded-xl border border-line bg-surface-elevated px-4 py-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-1">
                      {t("departments.slug.page.team_channels")}
                    </h3>
                    <p className="text-[10px] text-fg-muted mb-3">
                      {t("departments.slug.page.when_set_the_executive_can")}
                    </p>
                    <div className="space-y-2">
                      <label className="text-xs text-fg-muted flex flex-col gap-1">
                        Slack channel ID
                        <input
                          type="text"
                          value={settingsForm.slack_channel_id}
                          onChange={(e) =>
                            setSettingsForm((f) => ({ ...f, slack_channel_id: e.target.value }))
                          }
                          placeholder="C01234ABCDE"
                          className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </label>
                      <label className="text-xs text-fg-muted flex flex-col gap-1">
                        Discord channel ID
                        <input
                          type="text"
                          value={settingsForm.discord_channel_id}
                          onChange={(e) =>
                            setSettingsForm((f) => ({ ...f, discord_channel_id: e.target.value }))
                          }
                          placeholder="123456789012345678"
                          className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </label>
                      <label className="text-xs text-fg-muted flex flex-col gap-1">
                        Telegram chat ID
                        <input
                          type="text"
                          value={settingsForm.telegram_chat_id}
                          onChange={(e) =>
                            setSettingsForm((f) => ({ ...f, telegram_chat_id: e.target.value }))
                          }
                          placeholder="-1001234567890"
                          className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </label>
                    </div>
                  </section>

                  {/* Card 5: Watched entities */}
                  <section className="rounded-xl border border-line bg-surface-elevated px-4 py-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-1">
                      {t("departments.slug.page.watched_entities")}
                    </h3>
                    <p className="text-[10px] text-fg-muted mb-3">
                      {t("departments.slug.page.vendors_competitors_or_tickers_this")}
                    </p>
                    <label className="text-xs text-fg-muted flex flex-col gap-1">
                      {t("departments.slug.page.watched_entities_one_per_line")}
                      <textarea
                        value={settingsForm.watched_entities}
                        onChange={(e) =>
                          setSettingsForm((f) => ({ ...f, watched_entities: e.target.value }))
                        }
                        rows={4}
                        placeholder={"Brex\nStripe\nACME"}
                        className="px-2 py-1.5 rounded-lg bg-surface-input border border-line text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </label>
                  </section>

                  {settingsErr && <p className="text-xs text-rose-300">{settingsErr}</p>}
                  <button
                    disabled={savingSettings}
                    onClick={saveSettings}
                    className="px-4 py-1.5 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                  >
                    {savingSettings ? (t("departments.slug.page.saving")) : (t("departments.slug.page.save_settings"))}
                  </button>
                </div>
              ) : (
                <section className="rounded-xl border border-line bg-surface-elevated px-4 py-4 mb-6">
                  <div className="divide-y divide-line">
                    <div className="flex items-start gap-3 py-2">
                      <div className="w-36 flex-shrink-0 text-xs text-fg-muted pt-0.5">{t("departments.slug.page.how_it_acts")}</div>
                      <div>
                        <div className="text-sm text-fg">
                          {getAuthorityMeta(dept.config.authority_level, t).label}
                        </div>
                        <div className="text-[10px] text-fg-muted mt-0.5">
                          {getAuthorityMeta(dept.config.authority_level, t).hint}
                        </div>
                      </div>
                    </div>
                    {[
                      [t("departments.slug.page.mission"), dept.config.charter.mission || "—"],
                      ...(dept.config.head_person_id != null
                        ? [[t("departments.slug.page.head"), people.find((p) => p.id === dept.config.head_person_id)?.full_name ?? `Person #${dept.config.head_person_id}`]]
                        : []),
                      ...(dept.headcount != null ? [[t("departments.slug.page.headcount"), String(dept.headcount)]] : []),
                      ...(dept.budget_usd != null ? [[t("departments.slug.page.budget"), `$${dept.budget_usd.toLocaleString()}`]] : []),
                      ...(dept.config.slack_channel_id ? [[t("departments.slug.page.slack_channel"), dept.config.slack_channel_id]] : []),
                      ...(dept.config.discord_channel_id ? [[t("departments.slug.page.discord_channel"), dept.config.discord_channel_id]] : []),
                      ...(dept.config.telegram_chat_id ? [[t("departments.slug.page.telegram_chat"), dept.config.telegram_chat_id]] : []),
                      ...((dept.config.watched_entities ?? []).length > 0
                        ? [[t("departments.slug.page.watched_entities"), (dept.config.watched_entities ?? []).join(", ")]]
                        : []),
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-start gap-3 py-2">
                        <div className="w-36 flex-shrink-0 text-xs text-fg-muted pt-0.5">{label}</div>
                        <div className="text-sm text-fg">{value}</div>
                      </div>
                    ))}
                    {Object.entries(dept.config.cadences).length > 0 && (
                      <div className="flex items-start gap-3 py-2">
                        <div className="w-36 flex-shrink-0 text-xs text-fg-muted pt-0.5">{t("departments.slug.page.recurring_checkin")}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(dept.config.cadences).map(([n, s]) => (
                            <span key={n} className="px-2 py-0.5 rounded bg-surface-overlay border border-line text-xs font-mono text-fg">
                              {n}: {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Charter scope (read-only) */}
              {(dept.config.charter.scope.length > 0 || dept.config.charter.out_of_scope.length > 0) && (
                <section className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {dept.config.charter.scope.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-2">
                        {t("departments.slug.page.in_scope")}
                      </h2>
                      <ul className="list-disc list-inside space-y-1">
                        {dept.config.charter.scope.map((s, i) => (
                          <li key={i} className="text-sm text-fg">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {dept.config.charter.out_of_scope.length > 0 && (
                    <div>
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-2">
                        {t("departments.slug.page.out_of_scope")}
                      </h2>
                      <ul className="list-disc list-inside space-y-1">
                        {dept.config.charter.out_of_scope.map((s, i) => (
                          <li key={i} className="text-sm text-fg-muted">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </section>
              )}

              {/* Goals */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                    {t("departments.slug.page.goals_goals_length", { goals_length: goals.length })}
                  </h2>
                  {!addingGoal && (
                    <button
                      onClick={() => setAddingGoal(true)}
                      className="px-3 py-1 text-xs rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30"
                    >
                      {t("departments.slug.page.add_goal")}
                    </button>
                  )}
                </div>

                <div className="rounded-xl border border-line bg-surface-elevated px-4">
                  {addingGoal && (
                    <AddGoalForm
                      slug={slug}
                      onCreated={(goal) => {
                        setGoals((prev) => [...prev, goal]);
                        setAddingGoal(false);
                      }}
                      onCancel={() => setAddingGoal(false)}
                    />
                  )}
                  {goals.length === 0 && !addingGoal ? (
                    <p className="py-6 text-sm text-fg-muted text-center">
                      {t("departments.slug.page.no_goals_yet")}{" "}
                      <button
                        onClick={() => setAddingGoal(true)}
                        className="text-indigo-400 hover:underline"
                      >
                        {t("departments.slug.page.add_one")}
                      </button>
                    </p>
                  ) : (
                    goals.map((goal) => (
                      <GoalRow
                        key={goal.id}
                        slug={slug}
                        goal={goal}
                        onSaved={(updated) =>
                          setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)))
                        }
                        onDeleted={(id) => setGoals((prev) => prev.filter((g) => g.id !== id))}
                        onEditingChange={(editing) =>
                          setEditingGoalCount((c) => Math.max(0, c + (editing ? 1 : -1)))
                        }
                      />
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
