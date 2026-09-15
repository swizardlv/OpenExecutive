"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAskOEFormContext } from "@/components/askoe/AskOEContext";
import {
  DYNAMIC_SPECIALISTS,
  DynamicInputField,
  DynamicStep,
  DynamicWorkflowDef,
  PageFormField,
  Person,
  WorkflowSection,
  createCustomWorkflow,
  getCustomWorkflow,
  listPeople,
  updateCustomWorkflow,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const SECTIONS: WorkflowSection[] = [
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

type StepKind = DynamicStep["kind"];

function newStep(kind: StepKind, idx: number): DynamicStep {
  const id = `step_${idx + 1}`;
  if (kind === "specialist")
    return { kind, id, title: "", specialist: "cso", goal: "", rag_query: "" };
  if (kind === "approval_gate")
    return {
      kind,
      id,
      title: "",
      person_id: 0,
      question: "",
      timeout_hours: 48,
      on_timeout: "escalate",
    };
  return { kind, id, title: "Assemble", instructions: "", specialist: "cso" };
}

const inputCls =
  "w-full px-3 py-1.5 text-sm rounded-md bg-surface/60 border border-line text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-indigo-500/40";
const labelCls = "block text-xs font-medium text-fg-muted mb-1";

// ---- Ask OE form descriptor helpers ---------------------------------------

const INPUT_FIELDS_SCHEMA =
  'JSON array of input-field objects: {"name": snake_case string, "label": string, ' +
  '"description"?: string, "required": boolean, "multiline": boolean}. ' +
  "Reference fields in step goals with {field_name} placeholders.";

function stepsSchema(people: Person[]): string {
  const roster = people.map((p) => `${p.id} = ${p.full_name} (${p.role})`).join("; ");
  return (
    "JSON array of step objects, run in order. Three kinds: " +
    '{"kind": "specialist", "id": string, "title": string, "specialist": one of [' +
    DYNAMIC_SPECIALISTS.join(", ") +
    '], "goal": string (may use {field} placeholders), "rag_query"?: string} | ' +
    '{"kind": "approval_gate", "id": string, "title": string, "person_id": number, ' +
    '"question": string, "timeout_hours"?: number, "on_timeout"?: "escalate" | "auto_proceed" | "fail"} | ' +
    '{"kind": "synthesis", "id": string, "title": string, "specialist"?: string, "instructions"?: string}. ' +
    "The LAST step must be a synthesis step. " +
    (roster ? `person_id must be one of: ${roster}.` : "No people on the roster yet.")
  );
}

/** Parse a json-typed proposal value (the model may send a JSON string). */
function asJsonValue(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function coerceInputFields(raw: unknown): DynamicInputField[] | null {
  const v = asJsonValue(raw);
  if (!Array.isArray(v)) return null;
  const out: DynamicInputField[] = [];
  for (const f of v) {
    if (typeof f !== "object" || f === null) continue;
    const rec = f as Record<string, unknown>;
    if (typeof rec.name !== "string" || typeof rec.label !== "string") continue;
    out.push({
      name: rec.name,
      label: rec.label,
      description: typeof rec.description === "string" ? rec.description : "",
      required: rec.required !== false,
      multiline: rec.multiline === true,
    });
  }
  return out;
}

const STEP_KINDS: ReadonlySet<string> = new Set([
  "specialist",
  "approval_gate",
  "synthesis",
]);

function coerceSteps(raw: unknown): DynamicStep[] | null {
  const v = asJsonValue(raw);
  if (!Array.isArray(v)) return null;
  const out: DynamicStep[] = [];
  v.forEach((s, i) => {
    if (typeof s !== "object" || s === null) return;
    const rec = s as Record<string, unknown>;
    const kind = rec.kind;
    if (typeof kind !== "string" || !STEP_KINDS.has(kind)) return;
    // Start from the kind's defaults so missing optional keys stay valid,
    // then overlay whatever the proposal supplied.
    const base = newStep(kind as StepKind, i) as unknown as Record<string, unknown>;
    const merged = { ...base, ...rec, kind } as unknown as DynamicStep;
    if (typeof merged.id !== "string" || !merged.id) merged.id = `step_${i + 1}`;
    out.push(merged);
  });
  return out.length > 0 ? out : null;
}

function BuilderInner() {
  const { locale, t } = useI18n();

  const router = useRouter();
  const searchParams = useSearchParams();
  const editName = searchParams.get("edit");

  const [people, setPeople] = useState<Person[]>([]);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [section, setSection] = useState<WorkflowSection>("Operating Cadence");
  const [estimatedMinutes, setEstimatedMinutes] = useState(4);
  const [fields, setFields] = useState<DynamicInputField[]>([]);
  const [steps, setSteps] = useState<DynamicStep[]>([
    newStep("specialist", 0),
    newStep("synthesis", 1),
  ]);
  const [cadenceEnabled, setCadenceEnabled] = useState(false);
  const [cadence, setCadence] = useState("weekly@mon@09:00");
  const [cadencePersonId, setCadencePersonId] = useState<number>(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!editName);

  useEffect(() => {
    listPeople()
      .then((p) => setPeople(p.filter((x) => !x.archived)))
      .catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    if (!editName) return;
    getCustomWorkflow(editName)
      .then((d) => {
        setName(d.name);
        setTitle(d.title);
        setDescription(d.description ?? "");
        setSection(d.section);
        setEstimatedMinutes(d.estimated_minutes);
        setFields(d.input_fields);
        setSteps(d.steps);
        if (d.cadence) {
          setCadenceEnabled(true);
          setCadence(d.cadence);
          setCadencePersonId(d.cadence_person_id ?? 0);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [editName]);

  // ---- Ask OE registration -------------------------------------------------
  // Recreated each render so getFields/applyPatch close over current state;
  // the hook re-registers only when formId changes and refreshes closures
  // on every render.
  const { suggestedCls, clearSuggested } = useAskOEFormContext({
    formId: "workflow_builder",
    title: editName
      ? t("jobs.new.page.edit_workflow")
      : t("jobs.new.page.new_workflow"),
    description: t("jobs.new.page.builds_a_reusable_executive_job"),
    getFields: (): PageFormField[] => [
      {
        name: "name",
        label: t("jobs.new.page.name_snake_case_unique"),
        type: "text",
        value: name,
        required: true,
        description: editName
          ? (t("jobs.new.page.immutable_this_workflow_already_exists"))
          : (t("jobs.new.page.snake_case_unique_identifier_eg_weekly_competitor_watch")),
      },
      { name: "title", label: t("jobs.new.page.title"), type: "text", value: title, required: true },
      { name: "description", label: t("jobs.new.page.description"), type: "text", value: description },
      {
        name: "section",
        label: t("jobs.new.page.section"),
        type: "select",
        options: [...SECTIONS],
        value: section,
      },
      {
        name: "estimated_minutes",
        label: t("jobs.new.page.estimated_minutes"),
        type: "number",
        value: estimatedMinutes,
        description: "1-120.",
      },
      {
        name: "input_fields",
        label: t("jobs.new.page.input_fields"),
        type: "json",
        value: fields,
        description: INPUT_FIELDS_SCHEMA,
      },
      {
        name: "steps",
        label: t("jobs.new.page.steps"),
        type: "json",
        value: steps,
        required: true,
        description: stepsSchema(people),
      },
      {
        name: "cadence_enabled",
        label: t("jobs.new.page.run_on_a_schedule"),
        type: "boolean",
        value: cadenceEnabled,
      },
      {
        name: "cadence",
        label: t("jobs.new.page.cadence"),
        type: "text",
        value: cadence,
        description: "daily@HH:MM / weekly@DOW@HH:MM / quarterly@DD-HH:MM, UTC.",
      },
      {
        name: "cadence_person_id",
        label: t("jobs.new.page.deliver_artifact_to_person_id"),
        type: "number",
        value: cadencePersonId,
        description:
          people.map((p) => `${p.id} = ${p.full_name}`).join("; ") || (t("jobs.new.page.no_people_yet")),
      },
    ],
    applyPatch: (values) => {
      const prior = {
        name, title, description, section, estimatedMinutes,
        fields, steps, cadenceEnabled, cadence, cadencePersonId,
      };
      const applied: string[] = [];
      const skipped: string[] = [];
      for (const [key, raw] of Object.entries(values)) {
        switch (key) {
          case "name":
            if (editName || typeof raw !== "string") skipped.push(key);
            else { setName(raw); applied.push(key); }
            break;
          case "title":
            if (typeof raw !== "string") skipped.push(key);
            else { setTitle(raw); applied.push(key); }
            break;
          case "description":
            if (typeof raw !== "string") skipped.push(key);
            else { setDescription(raw); applied.push(key); }
            break;
          case "section":
            if (typeof raw === "string" && (SECTIONS as string[]).includes(raw)) {
              setSection(raw as WorkflowSection);
              applied.push(key);
            } else skipped.push(key);
            break;
          case "estimated_minutes": {
            const n = Number(raw);
            if (Number.isFinite(n) && n >= 1 && n <= 120) {
              setEstimatedMinutes(Math.round(n));
              applied.push(key);
            } else skipped.push(key);
            break;
          }
          case "input_fields": {
            const parsed = coerceInputFields(raw);
            if (parsed !== null) { setFields(parsed); applied.push(key); }
            else skipped.push(key);
            break;
          }
          case "steps": {
            const parsed = coerceSteps(raw);
            if (parsed !== null) { setSteps(parsed); applied.push(key); }
            else skipped.push(key);
            break;
          }
          case "cadence_enabled":
            if (typeof raw === "boolean") { setCadenceEnabled(raw); applied.push(key); }
            else skipped.push(key);
            break;
          case "cadence":
            if (typeof raw !== "string") skipped.push(key);
            else { setCadence(raw); setCadenceEnabled(true); applied.push(key); }
            break;
          case "cadence_person_id": {
            const n = Number(raw);
            if (Number.isFinite(n) && people.some((p) => p.id === n)) {
              setCadencePersonId(n);
              applied.push(key);
            } else skipped.push(key);
            break;
          }
          default:
            skipped.push(key);
        }
      }
      return {
        applied,
        skipped,
        undo: () => {
          setName(prior.name);
          setTitle(prior.title);
          setDescription(prior.description);
          setSection(prior.section);
          setEstimatedMinutes(prior.estimatedMinutes);
          setFields(prior.fields);
          setSteps(prior.steps);
          setCadenceEnabled(prior.cadenceEnabled);
          setCadence(prior.cadence);
          setCadencePersonId(prior.cadencePersonId);
        },
      };
    },
  });

  const updateField = useCallback(
    (i: number, patch: Partial<DynamicInputField>) =>
      setFields((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f))),
    []
  );
  const updateStep = useCallback(
    (i: number, patch: Partial<DynamicStep>) =>
      setSteps((ss) =>
        ss.map((s, idx) => (idx === i ? ({ ...s, ...patch } as DynamicStep) : s))
      ),
    []
  );
  const moveStep = useCallback(
    (i: number, dir: -1 | 1) =>
      setSteps((ss) => {
        const j = i + dir;
        if (j < 0 || j >= ss.length) return ss;
        const next = [...ss];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      }),
    []
  );

  async function handleSave() {
    setError(null);
    setSaving(true);
    const def: DynamicWorkflowDef = {
      name: name.trim(),
      title: title.trim(),
      description: description.trim(),
      section,
      estimated_minutes: estimatedMinutes,
      input_fields: fields,
      steps,
      cadence: cadenceEnabled ? cadence.trim() : null,
      cadence_person_id: cadenceEnabled ? cadencePersonId : null,
    };
    try {
      if (editName) await updateCustomWorkflow(editName, def);
      else await createCustomWorkflow(def);
      router.push(`/jobs/${encodeURIComponent(def.name)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-fg-muted">{t("jobs.new.page.loading")}</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/jobs" className="text-xs text-fg-muted hover:text-fg">
          {t("jobs.new.page.back_to_jobs")}
        </Link>
        <h1 className="text-2xl font-semibold text-fg mt-2 mb-1">
          {editName
            ? t("jobs.new.page.edit_workflow_title____editname", { title____editName: title || editName })
            : t("jobs.new.page.new_workflow")}
        </h1>
        <p className="text-sm text-fg-muted">
          {t("jobs.new.page.build_a_reusable_executive_job")}
        </p>
      </div>

      {/* Metadata */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-fg">{t("jobs.new.page.details")}</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t("jobs.new.page.name_snake_case_unique")}</label>
            <input
              className={`${inputCls} ${suggestedCls("name")}`}
              value={name}
              disabled={!!editName}
              onChange={(e) => { setName(e.target.value); clearSuggested("name"); }}
              placeholder="weekly_competitor_watch"
            />
          </div>
          <div>
            <label className={labelCls}>{t("jobs.new.page.title")}</label>
            <input
              className={`${inputCls} ${suggestedCls("title")}`}
              value={title}
              onChange={(e) => { setTitle(e.target.value); clearSuggested("title"); }}
              placeholder={t("jobs.new.page.weekly_competitor_watch")}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>{t("jobs.new.page.description")}</label>
          <input
            className={`${inputCls} ${suggestedCls("description")}`}
            value={description}
            onChange={(e) => { setDescription(e.target.value); clearSuggested("description"); }}
            placeholder={t("jobs.new.page.what_this_workflow_produces")}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>{t("jobs.new.page.section")}</label>
            <select
              className={`${inputCls} ${suggestedCls("section")}`}
              value={section}
              onChange={(e) => { setSection(e.target.value as WorkflowSection); clearSuggested("section"); }}
            >
              {SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {t(`jobs.new.section.${s}`, s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("jobs.new.page.estimated_minutes")}</label>
            <input
              type="number"
              min={1}
              max={120}
              className={`${inputCls} ${suggestedCls("estimated_minutes")}`}
              value={estimatedMinutes}
              onChange={(e) => { setEstimatedMinutes(Number(e.target.value)); clearSuggested("estimated_minutes"); }}
            />
          </div>
        </div>
      </section>

      {/* Input fields */}
      <section
        className={`space-y-3 rounded-md ${suggestedCls("input_fields")}`}
        onInput={() => clearSuggested("input_fields")}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-fg">{t("jobs.new.page.input_fields")}</h2>
          <button
            type="button"
            className="text-xs text-indigo-400 hover:text-indigo-300"
            onClick={() =>
              setFields((fs) => [
                ...fs,
                { name: "", label: "", description: "", required: true, multiline: false },
              ])
            }
          >
            {t("jobs.new.page.add_field")}
          </button>
        </div>
        <p className="text-xs text-fg-muted">
          {t("jobs.new.page.freetext_fields_the_user_fills")}
        </p>
        {fields.length === 0 && (
          <p className="text-xs text-fg-subtle">{t("jobs.new.page.no_input_fields")}</p>
        )}
        {fields.map((f, i) => (
          <div
            key={i}
            className="rounded-md border border-line bg-surface/30 p-3 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end"
          >
            <div>
              <label className={labelCls}>{t("jobs.new.page.field_name")}</label>
              <input
                className={inputCls}
                value={f.name}
                onChange={(e) => updateField(i, { name: e.target.value })}
                placeholder="topic"
              />
            </div>
            <div>
              <label className={labelCls}>{t("jobs.new.page.label")}</label>
              <input
                className={inputCls}
                value={f.label}
                onChange={(e) => updateField(i, { label: e.target.value })}
                placeholder={t("jobs.new.page.topic")}
              />
            </div>
            <div className="flex items-center gap-3 pb-1.5">
              <label className="flex items-center gap-1 text-xs text-fg-muted">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) => updateField(i, { required: e.target.checked })}
                />
                {t("jobs.new.page.required")}
              </label>
              <button
                type="button"
                className="text-xs text-fg-muted hover:text-red-400"
                onClick={() => setFields((fs) => fs.filter((_, idx) => idx !== i))}
              >
                {t("jobs.new.page.remove")}
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Steps */}
      <section
        className={`space-y-3 rounded-md ${suggestedCls("steps")}`}
        onInput={() => clearSuggested("steps")}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-fg">{t("jobs.new.page.steps")}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs text-indigo-400 hover:text-indigo-300"
              onClick={() =>
                setSteps((ss) => [...ss, newStep("specialist", ss.length)])
              }
            >
              {t("jobs.new.page.specialist_3")}
            </button>
            <button
              type="button"
              className="text-xs text-indigo-400 hover:text-indigo-300"
              onClick={() =>
                setSteps((ss) => [...ss, newStep("approval_gate", ss.length)])
              }
            >
              {t("jobs.new.page.approval_gate_2")}
            </button>
          </div>
        </div>
        <p className="text-xs text-fg-muted">
          {t("jobs.new.page.steps_run_in_order_the")}
        </p>
        {steps.map((s, i) => (
          <StepEditor
            key={i}
            step={s}
            index={i}
            total={steps.length}
            people={people}
            onChange={(patch) => updateStep(i, patch)}
            onMove={(dir) => moveStep(i, dir)}
            onRemove={() => setSteps((ss) => ss.filter((_, idx) => idx !== i))}
          />
        ))}
      </section>

      {/* Cadence */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-base font-semibold text-fg">
          <input
            type="checkbox"
            checked={cadenceEnabled}
            onChange={(e) => setCadenceEnabled(e.target.checked)}
          />
          {t("jobs.new.page.run_on_a_schedule")}
        </label>
        {cadenceEnabled && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                {t("jobs.new.page.cadence_dailyhhmm_weeklydowhhmm_quarterlyddhhmm_utc")}
              </label>
              <input
                className={`${inputCls} ${suggestedCls("cadence")}`}
                value={cadence}
                onChange={(e) => { setCadence(e.target.value); clearSuggested("cadence"); }}
                placeholder="weekly@mon@09:00"
              />
            </div>
            <div>
              <label className={labelCls}>{t("jobs.new.page.deliver_artifact_to")}</label>
              <select
                className={`${inputCls} ${suggestedCls("cadence_person_id")}`}
                value={cadencePersonId}
                onChange={(e) => { setCadencePersonId(Number(e.target.value)); clearSuggested("cadence_person_id"); }}
              >
                <option value={0}>{t("jobs.new.page.select_a_person")}</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} — {p.role}
                  </option>
                ))}
              </select>
            </div>
            <p className="sm:col-span-2 text-xs text-fg-subtle">
              {t("jobs.new.page.scheduled_runs_supply_no_inputs")}
            </p>
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-line pt-4">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          {saving ? (t("jobs.new.page.saving")) : editName ? (t("jobs.new.page.save_changes")) : (t("jobs.new.page.create_workflow"))}
        </button>
        <Link href="/jobs" className="text-sm text-fg-muted hover:text-fg">
          {t("jobs.new.page.cancel")}
        </Link>
      </div>
    </div>
  );
}

function StepEditor({
  step,
  index,
  total,
  people,
  onChange,
  onMove,
  onRemove,
}: {
  step: DynamicStep;
  index: number;
  total: number;
  people: Person[];
  onChange: (patch: Partial<DynamicStep>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const kindLabel = {
    specialist: t("jobs.new.page.specialist_2"),
    approval_gate: t("jobs.new.page.approval_gate"),
    synthesis: t("jobs.new.page.synthesis"),
  }[step.kind] ?? step.kind.replace("_", " ");

  return (
    <div className="rounded-md border border-line bg-surface/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
          {index + 1}. {kindLabel}
        </span>
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0}>
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
          >
            ↓
          </button>
          <button
            type="button"
            className="hover:text-red-400"
            onClick={onRemove}
          >
            {t("jobs.new.page.remove")}
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>{t("jobs.new.page.step_id")}</label>
          <input
            className={inputCls}
            value={step.id}
            onChange={(e) => onChange({ id: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>{t("jobs.new.page.title")}</label>
          <input
            className={inputCls}
            value={step.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>
      </div>

      {step.kind === "specialist" && (
        <>
          <div>
            <label className={labelCls}>{t("jobs.new.page.specialist")}</label>
            <select
              className={inputCls}
              value={step.specialist}
              onChange={(e) => onChange({ specialist: e.target.value })}
            >
              {DYNAMIC_SPECIALISTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("jobs.new.page.goal_use_field_placeholders")}</label>
            <textarea
              className={`${inputCls} min-h-[80px]`}
              value={step.goal}
              onChange={(e) => onChange({ goal: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>{t("jobs.new.page.knowledge_base_query_optional")}</label>
            <input
              className={inputCls}
              value={step.rag_query ?? ""}
              onChange={(e) => onChange({ rag_query: e.target.value })}
            />
          </div>
        </>
      )}

      {step.kind === "approval_gate" && (
        <>
          <div>
            <label className={labelCls}>{t("jobs.new.page.ask_which_person")}</label>
            <select
              className={inputCls}
              value={step.person_id}
              onChange={(e) => onChange({ person_id: Number(e.target.value) })}
            >
              <option value={0}>{t("jobs.new.page.select_a_person")}</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} — {p.role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>{t("jobs.new.page.question")}</label>
            <textarea
              className={`${inputCls} min-h-[60px]`}
              value={step.question}
              onChange={(e) => onChange({ question: e.target.value })}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t("jobs.new.page.timeout_hours")}</label>
              <input
                type="number"
                min={1}
                max={720}
                className={inputCls}
                value={step.timeout_hours ?? 48}
                onChange={(e) => onChange({ timeout_hours: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className={labelCls}>{t("jobs.new.page.on_timeout")}</label>
              <select
                className={inputCls}
                value={step.on_timeout ?? "escalate"}
                onChange={(e) =>
                  onChange({
                    on_timeout: e.target.value as "escalate" | "auto_proceed" | "fail",
                  })
                }
              >
                <option value="escalate">{t("jobs.new.page.escalate")}</option>
                <option value="auto_proceed">{t("jobs.new.page.auto_proceed")}</option>
                <option value="fail">{t("jobs.new.page.fail")}</option>
              </select>
            </div>
          </div>
        </>
      )}

      {step.kind === "synthesis" && (
        <>
          <div>
            <label className={labelCls}>{t("jobs.new.page.synthesis_specialist")}</label>
            <select
              className={inputCls}
              value={step.specialist ?? "cso"}
              onChange={(e) => onChange({ specialist: e.target.value })}
            >
              {DYNAMIC_SPECIALISTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>
              {t("jobs.new.page.instructions_optional_leave_blank_to")}
            </label>
            <textarea
              className={`${inputCls} min-h-[60px]`}
              value={step.instructions ?? ""}
              onChange={(e) => onChange({ instructions: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function NewWorkflowPage() {
  return (
    <div className="flex flex-col h-full bg-surface text-fg">
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <Suspense fallback={null}>
            <BuilderInner />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
