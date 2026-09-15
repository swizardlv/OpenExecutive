"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useAskOEFormContext } from "@/components/askoe/AskOEContext";
import { useI18n } from "@/lib/i18n";
import {
  getCompanyProfile,
  updateCompanyProfile,
  type CompanyProfile,
  type PageFormField,
} from "@/lib/api";

// ── helpers ──────────────────────────────────────────────────────────────────

function listToText(items: string[]): string {
  return items.join("\n");
}

function textToList(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ── Ask OE plumbing ──────────────────────────────────────────────────────────
// The page registers one flat form descriptor covering every section; when
// Ask OE proposes values, they land here as `pending` and each section's
// effect merges its own keys into its draft state and flips into edit mode —
// so the user reviews through the section's normal Save button.

export interface PendingValues {
  seq: number;
  values: Record<string, unknown>;
}

/** Accepts a string[] or a newline-joined string (models send either). */
function coerceList(raw: unknown): string[] | null {
  if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === "string");
  if (typeof raw === "string") return textToList(raw);
  return null;
}

const TEXT_FIELDS = new Set([
  "name", "industry", "stage", "mission", "vision",
  "target_customer_profile", "north_star_metric",
]);
const NUM_FIELDS = new Set([
  "founding_year", "headcount", "annual_revenue_arr",
  "burn_rate_monthly", "runway_months",
]);
const LIST_FIELDS = new Set([
  "pain_points", "primary_competitors", "competitive_advantages",
  "priorities", "culture_values", "operating_principles",
  "departments", "leadership_team", "vendors", "tickers",
]);

/** Flat snapshot of the SAVED profile — feeds both the Ask OE form
 * descriptor (getFields) and the undo restore values. */
function snapshotProfile(profile: CompanyProfile): Record<string, unknown> {
  return {
    name: profile.name,
    industry: profile.industry,
    stage: profile.stage,
    founding_year: profile.founding_year,
    headcount: profile.headcount,
    annual_revenue_arr: profile.annual_revenue_arr,
    mission: profile.mission,
    vision: profile.vision,
    target_customer_profile: profile.target_customer.profile,
    pain_points: profile.target_customer.pain_points,
    primary_competitors: profile.competitive_landscape.primary_competitors,
    competitive_advantages: profile.competitive_landscape.competitive_advantages,
    vendors: profile.vendors ?? [],
    tickers: profile.tickers ?? [],
    priorities: profile.strategic_priorities.current_year,
    north_star_metric: profile.strategic_priorities.north_star_metric,
    culture_values: profile.culture.values,
    operating_principles: profile.culture.operating_principles,
    departments: profile.org_structure.departments,
    leadership_team: profile.org_structure.leadership_team,
    burn_rate_monthly: profile.financials.burn_rate_monthly,
    runway_months: profile.financials.runway_months,
  };
}

// ── sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-fg-muted font-medium uppercase tracking-wide mb-1">
      {children}
    </p>
  );
}

function FieldValue({ children }: { children: React.ReactNode }) {
  const { locale, t } = useI18n();
  return <p className="text-sm text-fg">{children || <span className="text-fg-subtle italic">{t("company_profile.page.not_set")}</span>}</p>;
}

function Pills({ items }: { items: string[] }) {
  const { locale, t } = useI18n();
  if (!items.length) return <span className="text-sm text-fg-subtle italic">{t("company_profile.page.not_set")}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i} className="inline-block px-2 py-0.5 bg-surface-overlay text-fg text-xs rounded-md">
          {item}
        </span>
      ))}
    </div>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-line-strong bg-surface-overlay px-3 py-2 text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-colors"
    />
  );
}

function Textarea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full rounded-lg border border-line-strong bg-surface-overlay px-3 py-2 text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 resize-none transition-colors"
    />
  );
}

interface SectionProps {
  title: string;
  saving: boolean;
  onSave: () => Promise<void>;
  viewContent: React.ReactNode;
  editContent: React.ReactNode;
  // Optional controlled editing — used by Ask OE to flip a section into
  // edit mode when it applies suggested values. Uncontrolled by default.
  editing?: boolean;
  onEditingChange?: (v: boolean) => void;
}

function Section({
  title,
  saving,
  onSave,
  viewContent,
  editContent,
  editing: editingProp,
  onEditingChange,
}: SectionProps) {
  const { locale, t } = useI18n();
  const [editingState, setEditingState] = useState(false);
  const editing = editingProp ?? editingState;
  const setEditing = onEditingChange ?? setEditingState;
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    try {
      await onSave();
      setEditing(false);
    } catch {
      setError(t("company_profile.page.save_failed_please_try_again"));
    }
  }

  return (
    <div className="bg-surface-elevated border border-line rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {t("company_profile.page.edit")}
          </button>
        )}
      </div>

      {editing ? editContent : viewContent}

      {editing && (
        <>
          {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {saving ? (t("company_profile.page.saving")) : (t("company_profile.page.save"))}
            </button>
            <button
              onClick={() => { setEditing(false); setError(null); }}
              disabled={saving}
              className="px-3 py-1.5 border border-line-strong text-fg-muted hover:text-fg text-xs rounded-lg transition-colors disabled:opacity-40"
            >
              {t("company_profile.page.cancel")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Merges Ask OE `pending` values into a section's draft state (values are
// already validated/coerced page-side) and flips the section into edit
// mode so the suggestion is visible behind the normal Save button.
// Returns the controlled editing pair for <Section>.
function usePendingSection(
  pending: PendingValues | null,
  appliers: Record<string, (v: unknown) => void>
): [boolean, (v: boolean) => void] {
  const [editing, setEditing] = useState(false);
  const appliersRef = useRef(appliers);
  appliersRef.current = appliers;
  useEffect(() => {
    if (!pending) return;
    let touched = false;
    for (const [key, apply] of Object.entries(appliersRef.current)) {
      if (key in pending.values) {
        apply(pending.values[key]);
        touched = true;
      }
    }
    if (touched) setEditing(true);
  }, [pending]);
  return [editing, setEditing];
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function CompanyProfilePage() {
  const { locale, t } = useI18n();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingValues | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    getCompanyProfile()
      .then(setProfile)
      .catch((err: Error) => {
        if (err.message === "404") setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(
    async (patch: Partial<CompanyProfile>) => {
      setSaving(true);
      try {
        const updated = await updateCompanyProfile(patch);
        setProfile(updated);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  // Register with Ask OE once the profile is loaded. Field values are the
  // SAVED profile values — unsaved per-section drafts stay local to each
  // section until the user hits Save.
  useAskOEFormContext(
    profile
      ? {
          formId: "company_profile",
          title: t("company_profile.page.company_profile"),
          description: t("company_profile.page.the_structured_company_profile_the"),
          getFields: (): PageFormField[] => {
            const flat = snapshotProfile(profile);
            const label = (k: string) => k.replaceAll("_", " ");
            return Object.entries(flat).map(([name, value]) => ({
              name,
              label: label(name),
              type: NUM_FIELDS.has(name)
                ? ("number" as const)
                : LIST_FIELDS.has(name)
                  ? ("json" as const)
                  : ("text" as const),
              value,
              description: LIST_FIELDS.has(name) ? (t("company_profile.page.json_array_of_strings")) : "",
            }));
          },
          applyPatch: (values) => {
            const applied: string[] = [];
            const skipped: string[] = [];
            const picked: Record<string, unknown> = {};
            for (const [key, raw] of Object.entries(values)) {
              if (TEXT_FIELDS.has(key) && typeof raw === "string") {
                picked[key] = raw;
                applied.push(key);
              } else if (NUM_FIELDS.has(key) && Number.isFinite(Number(raw))) {
                picked[key] = Number(raw);
                applied.push(key);
              } else if (LIST_FIELDS.has(key)) {
                const list = coerceList(raw);
                if (list !== null) {
                  picked[key] = list;
                  applied.push(key);
                } else skipped.push(key);
              } else skipped.push(key);
            }
            if (applied.length > 0) {
              setPending({ seq: ++seqRef.current, values: picked });
            }
            const savedSnapshot = snapshotProfile(profile);
            return {
              applied,
              skipped,
              undo: () => {
                // Restore the SAVED values for the touched fields; sections
                // stay in edit mode so the user sees what was restored.
                const restore: Record<string, unknown> = {};
                for (const k of applied) restore[k] = savedSnapshot[k];
                setPending({ seq: ++seqRef.current, values: restore });
              },
            };
          },
        }
      : null
  );

  return (
    <div className="flex flex-col h-full bg-surface">
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-10">

          {loading && (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {notFound && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-5 py-4 flex items-center justify-between">
              <p className="text-sm text-fg">{t("company_profile.page.no_company_profile_set_up")}</p>
              <Link href="/onboard" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                {t("company_profile.page.complete_setup")}
              </Link>
            </div>
          )}

          {profile && (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-lg font-semibold text-fg">{profile.name}</h1>
                  <p className="text-sm text-fg-muted mt-0.5">{[profile.industry, profile.stage].filter(Boolean).join(" · ")}</p>
                </div>
                <Link href="/onboard" className="text-xs text-fg-muted hover:text-fg-muted transition-colors">
                  {t("company_profile.page.rerun_setup_wizard")}
                </Link>
              </div>

              <div className="flex flex-col gap-4">

                {/* Company Basics */}
                <CompanyBasicsSection profile={profile} saving={saving} onSave={save} pending={pending} />

                {/* Mission & Vision */}
                <MissionSection profile={profile} saving={saving} onSave={save} pending={pending} />

                {/* Target Customer */}
                <TargetCustomerSection profile={profile} saving={saving} onSave={save} pending={pending} />

                {/* Competitive Landscape */}
                <CompetitiveSection profile={profile} saving={saving} onSave={save} pending={pending} />

                {/* External Dependencies (vendors + tickers the research policy may watch on its own) */}
                <ExternalDependenciesSection profile={profile} saving={saving} onSave={save} pending={pending} />

                {/* Strategic Priorities */}
                <PrioritiesSection profile={profile} saving={saving} onSave={save} pending={pending} />

                {/* Culture */}
                <CultureSection profile={profile} saving={saving} onSave={save} pending={pending} />

                {/* Org Structure */}
                <OrgSection profile={profile} saving={saving} onSave={save} pending={pending} />

                {/* Financials */}
                <FinancialsSection profile={profile} saving={saving} onSave={save} pending={pending} />

              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ── section components ────────────────────────────────────────────────────────

function CompanyBasicsSection({ profile, saving, onSave, pending }: SectionComponentProps) {
  const { locale, t } = useI18n();
  const [name, setName] = useState(profile.name);
  const [industry, setIndustry] = useState(profile.industry);
  const [stage, setStage] = useState(profile.stage);
  const [foundingYear, setFoundingYear] = useState(profile.founding_year?.toString() ?? "");
  const [headcount, setHeadcount] = useState(profile.headcount?.toString() ?? "");
  const [arr, setArr] = useState(profile.annual_revenue_arr?.toString() ?? "");

  useEffect(() => {
    setName(profile.name); setIndustry(profile.industry); setStage(profile.stage);
    setFoundingYear(profile.founding_year?.toString() ?? "");
    setHeadcount(profile.headcount?.toString() ?? "");
    setArr(profile.annual_revenue_arr?.toString() ?? "");
  }, [profile]);

  const [editing, setEditing] = usePendingSection(pending, {
    name: (v) => setName(String(v)),
    industry: (v) => setIndustry(String(v)),
    stage: (v) => setStage(String(v)),
    founding_year: (v) => setFoundingYear(v == null ? "" : String(v)),
    headcount: (v) => setHeadcount(v == null ? "" : String(v)),
    annual_revenue_arr: (v) => setArr(v == null ? "" : String(v)),
  });

  return (
    <Section
      title={t("company_profile.page.company_basics")}
      editing={editing}
      onEditingChange={setEditing}
      saving={saving}
      onSave={() => onSave({
        name, industry, stage,
        founding_year: foundingYear ? parseInt(foundingYear) : null,
        headcount: headcount ? parseInt(headcount) : null,
        annual_revenue_arr: arr ? parseFloat(arr) : null,
      })}
      viewContent={
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div><FieldLabel>{t("company_profile.page.name")}</FieldLabel><FieldValue>{profile.name}</FieldValue></div>
          <div><FieldLabel>{t("company_profile.page.industry")}</FieldLabel><FieldValue>{profile.industry}</FieldValue></div>
          <div><FieldLabel>{t("company_profile.page.stage")}</FieldLabel><FieldValue>{profile.stage}</FieldValue></div>
          <div><FieldLabel>{t("company_profile.page.founded")}</FieldLabel><FieldValue>{profile.founding_year?.toString()}</FieldValue></div>
          <div><FieldLabel>{t("company_profile.page.headcount")}</FieldLabel><FieldValue>{profile.headcount?.toString()}</FieldValue></div>
          <div><FieldLabel>{t("company_profile.page.arr_2")}</FieldLabel><FieldValue>{profile.annual_revenue_arr != null ? `$${profile.annual_revenue_arr.toLocaleString()}` : undefined}</FieldValue></div>
        </div>
      }
      editContent={
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel>{t("company_profile.page.name")}</FieldLabel><Input value={name} onChange={setName} placeholder="Acme Corp" /></div>
          <div><FieldLabel>{t("company_profile.page.industry")}</FieldLabel><Input value={industry} onChange={setIndustry} placeholder="B2B SaaS" /></div>
          <div><FieldLabel>{t("company_profile.page.stage")}</FieldLabel><Input value={stage} onChange={setStage} placeholder="Series A" /></div>
          <div><FieldLabel>{t("company_profile.page.founded")}</FieldLabel><Input value={foundingYear} onChange={setFoundingYear} type="number" placeholder="2022" /></div>
          <div><FieldLabel>{t("company_profile.page.headcount")}</FieldLabel><Input value={headcount} onChange={setHeadcount} type="number" placeholder="40" /></div>
          <div><FieldLabel>{t("company_profile.page.arr")}</FieldLabel><Input value={arr} onChange={setArr} type="number" placeholder="500000" /></div>
        </div>
      }
    />
  );
}

function MissionSection({ profile, saving, onSave, pending }: SectionComponentProps) {
  const { locale, t } = useI18n();
  const [mission, setMission] = useState(profile.mission);
  const [vision, setVision] = useState(profile.vision);
  useEffect(() => { setMission(profile.mission); setVision(profile.vision); }, [profile]);

  const [editing, setEditing] = usePendingSection(pending, {
    mission: (v) => setMission(String(v)),
    vision: (v) => setVision(String(v)),
  });

  return (
    <Section
      title={t("company_profile.page.mission_vision")}
      editing={editing}
      onEditingChange={setEditing}
      saving={saving}
      onSave={() => onSave({ mission, vision })}
      viewContent={
        <div className="space-y-4">
          <div><FieldLabel>{t("company_profile.page.mission")}</FieldLabel><FieldValue>{profile.mission}</FieldValue></div>
          <div><FieldLabel>{t("company_profile.page.vision")}</FieldLabel><FieldValue>{profile.vision}</FieldValue></div>
        </div>
      }
      editContent={
        <div className="space-y-3">
          <div><FieldLabel>{t("company_profile.page.mission")}</FieldLabel><Textarea value={mission} onChange={setMission} rows={2} placeholder={t("company_profile.page.why_does_this_company_exist")} /></div>
          <div><FieldLabel>{t("company_profile.page.vision")}</FieldLabel><Textarea value={vision} onChange={setVision} rows={2} placeholder={t("company_profile.page.where_are_you_in_5")} /></div>
        </div>
      }
    />
  );
}

function TargetCustomerSection({ profile, saving, onSave, pending }: SectionComponentProps) {
  const { locale, t } = useI18n();
  const [customerProfile, setCustomerProfile] = useState(profile.target_customer.profile);
  const [painPoints, setPainPoints] = useState(listToText(profile.target_customer.pain_points));
  useEffect(() => {
    setCustomerProfile(profile.target_customer.profile);
    setPainPoints(listToText(profile.target_customer.pain_points));
  }, [profile]);

  const [editing, setEditing] = usePendingSection(pending, {
    target_customer_profile: (v) => setCustomerProfile(String(v)),
    pain_points: (v) => setPainPoints(listToText(v as string[])),
  });

  return (
    <Section
      title={t("company_profile.page.target_customer")}
      editing={editing}
      onEditingChange={setEditing}
      saving={saving}
      onSave={() => onSave({ target_customer: { profile: customerProfile, pain_points: textToList(painPoints) } })}
      viewContent={
        <div className="space-y-4">
          <div><FieldLabel>{t("company_profile.page.customer_profile")}</FieldLabel><FieldValue>{profile.target_customer.profile}</FieldValue></div>
          <div><FieldLabel>{t("company_profile.page.pain_points")}</FieldLabel><Pills items={profile.target_customer.pain_points} /></div>
        </div>
      }
      editContent={
        <div className="space-y-3">
          <div><FieldLabel>{t("company_profile.page.customer_profile")}</FieldLabel><Textarea value={customerProfile} onChange={setCustomerProfile} rows={2} placeholder={t("company_profile.page.who_is_your_ideal_customer")} /></div>
          <div><FieldLabel>{t("company_profile.page.pain_points_one_per_line")}</FieldLabel><Textarea value={painPoints} onChange={setPainPoints} rows={3} placeholder={t("company_profile.page.too_slow_to_onboardnno_visibility")} /></div>
        </div>
      }
    />
  );
}

function CompetitiveSection({ profile, saving, onSave, pending }: SectionComponentProps) {
  const { locale, t } = useI18n();
  const [competitors, setCompetitors] = useState(listToText(profile.competitive_landscape.primary_competitors));
  const [advantages, setAdvantages] = useState(listToText(profile.competitive_landscape.competitive_advantages));
  useEffect(() => {
    setCompetitors(listToText(profile.competitive_landscape.primary_competitors));
    setAdvantages(listToText(profile.competitive_landscape.competitive_advantages));
  }, [profile]);

  const [editing, setEditing] = usePendingSection(pending, {
    primary_competitors: (v) => setCompetitors(listToText(v as string[])),
    competitive_advantages: (v) => setAdvantages(listToText(v as string[])),
  });

  return (
    <Section
      title={t("company_profile.page.competitive_landscape")}
      editing={editing}
      onEditingChange={setEditing}
      saving={saving}
      onSave={() => onSave({ competitive_landscape: { primary_competitors: textToList(competitors), competitive_advantages: textToList(advantages) } })}
      viewContent={
        <div className="space-y-4">
          <div><FieldLabel>{t("company_profile.page.primary_competitors")}</FieldLabel><Pills items={profile.competitive_landscape.primary_competitors} /></div>
          <div><FieldLabel>{t("company_profile.page.our_advantages")}</FieldLabel><Pills items={profile.competitive_landscape.competitive_advantages} /></div>
        </div>
      }
      editContent={
        <div className="space-y-3">
          <div><FieldLabel>{t("company_profile.page.competitors_one_per_line")}</FieldLabel><Textarea value={competitors} onChange={setCompetitors} rows={3} placeholder={"Salesforce\nHubSpot"} /></div>
          <div><FieldLabel>{t("company_profile.page.our_advantages_one_per_line")}</FieldLabel><Textarea value={advantages} onChange={setAdvantages} rows={3} placeholder={t("company_profile.page.10x_faster_onboardingnopen_source")} /></div>
        </div>
      }
    />
  );
}

function ExternalDependenciesSection({ profile, saving, onSave, pending }: SectionComponentProps) {
  const { locale, t } = useI18n();
  const [vendors, setVendors] = useState(listToText(profile.vendors ?? []));
  const [tickers, setTickers] = useState(listToText(profile.tickers ?? []));
  useEffect(() => {
    setVendors(listToText(profile.vendors ?? []));
    setTickers(listToText(profile.tickers ?? []));
  }, [profile]);

  const [editing, setEditing] = usePendingSection(pending, {
    vendors: (v) => setVendors(listToText(v as string[])),
    tickers: (v) => setTickers(listToText(v as string[])),
  });

  return (
    <Section
      title={t("company_profile.page.external_dependencies")}
      editing={editing}
      onEditingChange={setEditing}
      saving={saving}
      onSave={() => onSave({ vendors: textToList(vendors), tickers: textToList(tickers) })}
      viewContent={
        <div className="space-y-4">
          <p className="text-xs text-fg-subtle">
            {t("company_profile.page.named_here_a_vendor_or")}
          </p>
          <div><FieldLabel>{t("company_profile.page.vendors_dependencies")}</FieldLabel><Pills items={profile.vendors ?? []} /></div>
          <div><FieldLabel>{t("company_profile.page.tracked_tickers")}</FieldLabel><Pills items={profile.tickers ?? []} /></div>
        </div>
      }
      editContent={
        <div className="space-y-3">
          <div><FieldLabel>{t("company_profile.page.vendors_one_per_line")}</FieldLabel><Textarea value={vendors} onChange={setVendors} rows={3} placeholder={"Stripe\nAWS"} /></div>
          <div><FieldLabel>{t("company_profile.page.tickers_one_per_line_yours")}</FieldLabel><Textarea value={tickers} onChange={setTickers} rows={3} placeholder={"CRM\nHUBS"} /></div>
        </div>
      }
    />
  );
}

function PrioritiesSection({ profile, saving, onSave, pending }: SectionComponentProps) {
  const { locale, t } = useI18n();
  const [priorities, setPriorities] = useState(listToText(profile.strategic_priorities.current_year));
  const [northStar, setNorthStar] = useState(profile.strategic_priorities.north_star_metric);
  useEffect(() => {
    setPriorities(listToText(profile.strategic_priorities.current_year));
    setNorthStar(profile.strategic_priorities.north_star_metric);
  }, [profile]);

  const [editing, setEditing] = usePendingSection(pending, {
    priorities: (v) => setPriorities(listToText(v as string[])),
    north_star_metric: (v) => setNorthStar(String(v)),
  });

  return (
    <Section
      title={t("company_profile.page.strategic_priorities")}
      editing={editing}
      onEditingChange={setEditing}
      saving={saving}
      onSave={() => onSave({ strategic_priorities: { current_year: textToList(priorities), north_star_metric: northStar } })}
      viewContent={
        <div className="space-y-4">
          <div><FieldLabel>{t("company_profile.page.this_years_priorities")}</FieldLabel><Pills items={profile.strategic_priorities.current_year} /></div>
          <div><FieldLabel>{t("company_profile.page.north_star_metric")}</FieldLabel><FieldValue>{profile.strategic_priorities.north_star_metric}</FieldValue></div>
        </div>
      }
      editContent={
        <div className="space-y-3">
          <div><FieldLabel>{t("company_profile.page.priorities_one_per_line")}</FieldLabel><Textarea value={priorities} onChange={setPriorities} rows={3} placeholder={t("company_profile.page.launch_v1nhire_3_engineers")} /></div>
          <div><FieldLabel>{t("company_profile.page.north_star_metric")}</FieldLabel><Input value={northStar} onChange={setNorthStar} placeholder="MRR or DAU" /></div>
        </div>
      }
    />
  );
}

function CultureSection({ profile, saving, onSave, pending }: SectionComponentProps) {
  const { locale, t } = useI18n();
  const [values, setValues] = useState(listToText(profile.culture.values));
  const [principles, setPrinciples] = useState(listToText(profile.culture.operating_principles));
  useEffect(() => {
    setValues(listToText(profile.culture.values));
    setPrinciples(listToText(profile.culture.operating_principles));
  }, [profile]);

  const [editing, setEditing] = usePendingSection(pending, {
    culture_values: (v) => setValues(listToText(v as string[])),
    operating_principles: (v) => setPrinciples(listToText(v as string[])),
  });

  return (
    <Section
      title={t("company_profile.page.culture_values")}
      editing={editing}
      onEditingChange={setEditing}
      saving={saving}
      onSave={() => onSave({ culture: { values: textToList(values), operating_principles: textToList(principles) } })}
      viewContent={
        <div className="space-y-4">
          <div><FieldLabel>{t("company_profile.page.values")}</FieldLabel><Pills items={profile.culture.values} /></div>
          <div><FieldLabel>{t("company_profile.page.operating_principles")}</FieldLabel><Pills items={profile.culture.operating_principles} /></div>
        </div>
      }
      editContent={
        <div className="space-y-3">
          <div><FieldLabel>{t("company_profile.page.values_one_per_line")}</FieldLabel><Textarea value={values} onChange={setValues} rows={3} placeholder={t("company_profile.page.transparencynbias_for_action")} /></div>
          <div><FieldLabel>{t("company_profile.page.operating_principles_one_per_line")}</FieldLabel><Textarea value={principles} onChange={setPrinciples} rows={3} placeholder={t("company_profile.page.default_to_asyncnwrite_it_down")} /></div>
        </div>
      }
    />
  );
}

function OrgSection({ profile, saving, onSave, pending }: SectionComponentProps) {
  const { locale, t } = useI18n();
  const [departments, setDepartments] = useState(listToText(profile.org_structure.departments));
  const [leadership, setLeadership] = useState(listToText(profile.org_structure.leadership_team));
  useEffect(() => {
    setDepartments(listToText(profile.org_structure.departments));
    setLeadership(listToText(profile.org_structure.leadership_team));
  }, [profile]);

  const [editing, setEditing] = usePendingSection(pending, {
    departments: (v) => setDepartments(listToText(v as string[])),
    leadership_team: (v) => setLeadership(listToText(v as string[])),
  });

  return (
    <Section
      title={t("company_profile.page.org_structure")}
      editing={editing}
      onEditingChange={setEditing}
      saving={saving}
      onSave={() => onSave({ org_structure: { departments: textToList(departments), leadership_team: textToList(leadership) } })}
      viewContent={
        <div className="space-y-4">
          <div><FieldLabel>{t("company_profile.page.departments")}</FieldLabel><Pills items={profile.org_structure.departments} /></div>
          <div><FieldLabel>{t("company_profile.page.leadership_team")}</FieldLabel><Pills items={profile.org_structure.leadership_team} /></div>
        </div>
      }
      editContent={
        <div className="space-y-3">
          <div><FieldLabel>{t("company_profile.page.departments_one_per_line")}</FieldLabel><Textarea value={departments} onChange={setDepartments} rows={3} placeholder={t("company_profile.page.engineeringnproductngtm")} /></div>
          <div><FieldLabel>{t("company_profile.page.leadership_team_one_per_line")}</FieldLabel><Textarea value={leadership} onChange={setLeadership} rows={3} placeholder={"Alice Chen, CEO\nBob Smith, CTO"} /></div>
        </div>
      }
    />
  );
}

function FinancialsSection({ profile, saving, onSave, pending }: SectionComponentProps) {
  const { locale, t } = useI18n();
  const [burn, setBurn] = useState(profile.financials.burn_rate_monthly?.toString() ?? "");
  const [runway, setRunway] = useState(profile.financials.runway_months?.toString() ?? "");
  useEffect(() => {
    setBurn(profile.financials.burn_rate_monthly?.toString() ?? "");
    setRunway(profile.financials.runway_months?.toString() ?? "");
  }, [profile]);

  const [editing, setEditing] = usePendingSection(pending, {
    burn_rate_monthly: (v) => setBurn(v == null ? "" : String(v)),
    runway_months: (v) => setRunway(v == null ? "" : String(v)),
  });

  return (
    <Section
      title={t("company_profile.page.financials")}
      editing={editing}
      onEditingChange={setEditing}
      saving={saving}
      onSave={() => onSave({
        financials: {
          burn_rate_monthly: burn ? parseFloat(burn) : null,
          runway_months: runway ? parseFloat(runway) : null,
          key_metrics: profile.financials.key_metrics,
        }
      })}
      viewContent={
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div><FieldLabel>{t("company_profile.page.monthly_burn_2")}</FieldLabel><FieldValue>{profile.financials.burn_rate_monthly != null ? `$${profile.financials.burn_rate_monthly.toLocaleString()}${t("company_profile.page.mo")}` : undefined}</FieldValue></div>
          <div><FieldLabel>{t("company_profile.page.runway")}</FieldLabel><FieldValue>{profile.financials.runway_months != null ? `${profile.financials.runway_months} ${t("company_profile.page.months")}` : undefined}</FieldValue></div>
        </div>
      }
      editContent={
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel>{t("company_profile.page.monthly_burn")}</FieldLabel><Input value={burn} onChange={setBurn} type="number" placeholder="50000" /></div>
          <div><FieldLabel>{t("company_profile.page.runway_months")}</FieldLabel><Input value={runway} onChange={setRunway} type="number" placeholder="18" /></div>
        </div>
      }
    />
  );
}

interface SectionComponentProps {
  profile: CompanyProfile;
  saving: boolean;
  onSave: (patch: Partial<CompanyProfile>) => Promise<void>;
  // Ask OE suggested values (flat keys) — sections merge their own keys
  // into draft state and flip into edit mode when one lands.
  pending: PendingValues | null;
}
