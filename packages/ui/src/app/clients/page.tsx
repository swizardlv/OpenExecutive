"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import Icon from "@/components/Icon";
import { useI18n } from "@/lib/i18n";
import {
  activateClient,
  type ClientCockpitCard,
  type ClientDraftResult,
  type ClientMetaPatch,
  type ClientsStatus,
  createClient,
  createClientFromDraft,
  deleteClient,
  generateClientDraft,
  getClientsCockpit,
  listClients,
  saveActiveClient,
  updateClientMeta,
} from "@/lib/api";
import { clientCountsSummary, renewalBadge } from "@/lib/practice";

// Client-company switcher for fractional / multi-client use. One client is
// live at a time; switching saves the current client back to its slot and
// restores the target. Single-company installs see only the intro + create
// form — nothing about the default experience changes until a client exists.
// base64url-encode a prefill payload for the /jobs/{name} runner page
// (mirrors decodePrefill there).
function encodePrefill(payload: Record<string, string>): string {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default function ClientsPage() {
  const { locale, t } = useI18n();

  const [status, setStatus] = useState<ClientsStatus>({
    active: null,
    fixture_active: null,
    clients: [],
  });
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" } | null>(null);
  const [name, setName] = useState("");
  const [source, setSource] = useState<"current" | "blank">("current");
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Engagement-intake (AI draft) flow.
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<ClientDraftResult | null>(null);
  const [draftName, setDraftName] = useState("");
  const [creatingDraft, setCreatingDraft] = useState(false);

  // Practice cockpit (multi-client only) + per-slot engagement metadata edit.
  const [cockpit, setCockpit] = useState<ClientCockpitCard[]>([]);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [metaForm, setMetaForm] = useState<ClientMetaPatch>({});
  const [savingMeta, setSavingMeta] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const next = await listClients();
      setStatus(next);
      if (next.clients.length >= 2) {
        try {
          setCockpit((await getClientsCockpit()).clients);
        } catch {
          setCockpit([]);
        }
      } else {
        setCockpit([]);
      }
    } catch {
      setToast({ message: t("clients.page.failed_to_load_clients"), kind: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const created = await createClient(name.trim(), source);
      setToast({
        message: created.active
          ? (t("clients.page.created_display_name_created_from_your_current", { created_display_name: created.display_name }))
          : (t("clients.page.created_display_name_created_activate_it_to", { created_display_name: created.display_name })),
        kind: "success",
      });
      setName("");
      await refresh();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : (t("clients.page.create_failed")), kind: "error" });
    } finally {
      setCreating(false);
    }
  }

  function openMetaEditor(slug: string) {
    const c = status.clients.find((x) => x.slug === slug) as
      | (Record<string, unknown> & { slug: string })
      | undefined;
    setMetaForm({
      role: (c?.role as string) ?? "",
      status: (c?.status as string) ?? "active",
      renewal_date: (c?.renewal_date as string) ?? "",
      retainer: (c?.retainer as string) ?? "",
      primary_contact: (c?.primary_contact as string) ?? "",
      notes: (c?.notes as string) ?? "",
    });
    setEditingSlug(slug);
  }

  async function handleSaveMeta() {
    if (!editingSlug) return;
    setSavingMeta(true);
    try {
      // Drop empty strings so we never overwrite with blanks unintentionally.
      const patch = Object.fromEntries(
        Object.entries(metaForm).filter(([, v]) => v !== "" && v !== undefined),
      ) as ClientMetaPatch;
      await updateClientMeta(editingSlug, patch);
      setToast({ message: t("clients.page.engagement_details_saved"), kind: "success" });
      setEditingSlug(null);
      await refresh();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : (t("clients.page.save_failed")), kind: "error" });
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleGenerateDraft() {
    if (!notes.trim() && attachments.length === 0) return;
    setGenerating(true);
    try {
      const result = await generateClientDraft(notes.trim(), attachments);
      setDraft(result);
      setDraftName(result.display_name);
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : (t("clients.page.draft_failed")), kind: "error" });
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreateFromDraft(activate: boolean) {
    if (!draft) return;
    setCreatingDraft(true);
    try {
      const displayName = draftName.trim() || draft.display_name;
      const bundle = { ...draft.bundle, profile: { ...draft.bundle.profile, name: displayName } };
      const created = await createClientFromDraft(displayName, bundle, notes.trim());
      if (activate) {
        await activateClient(created.slug);
        setToast({
          message: t("clients.page.displayname_created_and_activated", { displayName }),
          kind: "success",
        });
      } else {
        setToast({
          message: t("clients.page.displayname_created_activate_it_to", { displayName }),
          kind: "success",
        });
      }
      setDraft(null);
      setNotes("");
      setAttachments([]);
      await refresh();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : (t("clients.page.create_failed")), kind: "error" });
    } finally {
      setCreatingDraft(false);
    }
  }

  async function handleActivate(slug: string) {
    setBusySlug(slug);
    try {
      const result = await activateClient(slug);
      setToast({
        message: result.mcp_config_changed
          ? (t("clients.page.switched_to_slug_mcp_tool", { slug }))
          : (t("clients.page.switched_to_slug", { slug })),
        kind: "success",
      });
      await refresh();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : (t("clients.page.switch_failed")), kind: "error" });
    } finally {
      setBusySlug(null);
    }
  }

  async function handleSave() {
    setBusySlug(status.active);
    try {
      const result = await saveActiveClient();
      setToast({ message: t("clients.page.saved_result_slug_to_its_slot", { result_slug: result.slug }), kind: "success" });
      await refresh();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : (t("clients.page.save_failed")), kind: "error" });
    } finally {
      setBusySlug(null);
    }
  }

  async function handleDelete(slug: string) {
    setBusySlug(slug);
    try {
      await deleteClient(slug);
      setToast({ message: t("clients.page.deleted_slug", { slug }), kind: "success" });
      setConfirmDelete(null);
      await refresh();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : (t("clients.page.delete_failed")), kind: "error" });
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <main className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-xl font-semibold text-fg">
          {t("clients.page.client_companies")}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          {t("clients.page.run_several_client_companies_from")}
        </p>

        {toast && (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              toast.kind === "success"
                ? "border-line bg-surface-elevated text-fg"
                : "border-red-500/40 bg-red-500/10 text-red-400"
            }`}
          >
            {toast.message}
          </div>
        )}

        {status.rotation_in_progress && (
          <div className="mt-4 rounded-lg border border-line bg-surface-elevated px-3 py-2 text-sm text-fg-muted">
            {t("clients.page.overnight_rotation_is_running_the")}
          </div>
        )}

        {status.fixture_active && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
            {t("clients.page.demo_fixture_active", { name: status.fixture_active })}
          </div>
        )}

        {/* Practice cockpit — only in multi-client mode (2+ slots) */}
        {cockpit.length >= 2 && (
          <div className="mt-6 rounded-xl border border-line bg-surface-elevated p-4">
            <h2 className="text-sm font-medium text-fg">
              {t("clients.page.practice_cockpit")}
            </h2>
            <p className="mt-1 text-xs text-fg-muted">
              {t("clients.page.all_clients_at_a_glance")}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {cockpit.map((c) => (
                <div
                  key={`cockpit-${c.slug}`}
                  className={`rounded-lg border p-3 ${
                    c.is_active ? "border-line-strong bg-surface-overlay" : "border-line"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium text-fg truncate">
                      {c.display_name}
                      {c.role ? (
                        <span className="text-fg-muted font-normal"> · {c.role}</span>
                      ) : null}
                    </div>
                    {c.is_active ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 flex-shrink-0">
                        {t("clients.page.active")}
                      </span>
                    ) : (
                      (() => {
                        const badge = renewalBadge(c.days_to_renewal, locale);
                        return badge ? (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                              badge.urgent
                                ? "border-red-500/40 bg-red-500/10 text-red-400"
                                : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                            }`}
                          >
                            {badge.label}
                          </span>
                        ) : null;
                      })()
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-fg-muted">
                    {clientCountsSummary(c, locale)}
                  </div>
                  {c.has_state && (
                    <div className="mt-1.5">
                      <Link
                        href={`/jobs/engagement_value_report?prefill=${encodePrefill({ client_slug: c.slug })}`}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300"
                      >
                        {t("clients.page.value_report")}
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create */}
        <div className="mt-6 rounded-xl border border-line bg-surface-elevated p-4">
          <h2 className="text-sm font-medium text-fg">
            {t("clients.page.new_client")}
          </h2>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("clients.page.client_company_name")}
              className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-line-strong"
            />
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as "current" | "blank")}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:outline-none"
            >
              <option value="current">{t("clients.page.from_current_company")}</option>
              <option value="blank">{t("clients.page.blank_onboard_fresh")}</option>
            </select>
            <button
              onClick={() => void handleCreate()}
              disabled={creating || !name.trim() || !!status.fixture_active}
              className="rounded-lg border border-line bg-surface-overlay px-4 py-2 text-sm font-medium text-fg hover:border-line-strong disabled:opacity-50"
            >
              {creating ? (t("clients.page.creating")) : (t("clients.page.create"))}
            </button>
          </div>
          <p className="mt-2 text-xs text-fg-muted">
            {source === "current"
              ? (t("clients.page.captures_the_live_company_into"))
              : (t("clients.page.creates_an_empty_client_activate"))}
          </p>
        </div>

        {/* New engagement from intake notes (AI) */}
        <div className="mt-4 rounded-xl border border-line bg-surface-elevated p-4">
          <h2 className="text-sm font-medium text-fg">
            {t("clients.page.new_client_from_intake_notes")}
          </h2>
          <p className="mt-1 text-xs text-fg-muted">
            {t("clients.page.paste_real_intake_material_call")}
          </p>

          {!draft ? (
            <>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder={
                  t("clients.page.eg_notes_from_the_kickoff")
                }
                className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-line-strong"
              />

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded-lg border border-line bg-surface-overlay px-3 py-1.5 text-xs font-medium text-fg hover:border-line-strong">
                  {t("clients.page.attach_files")}
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.docx,.doc,.xlsx,.xlsm,.csv,.md,.txt"
                    className="hidden"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? []);
                      if (picked.length) setAttachments((prev) => [...prev, ...picked]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-xs text-fg-muted">
                  {t("clients.page.pdf_word_excel_csv_or")}
                </span>
              </div>

              {attachments.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {attachments.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-fg"
                    >
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((prev) => prev.filter((_, j) => j !== i))
                        }
                        aria-label={t("clients.page.remove_f_name", { f_name: f.name })}
                        className="shrink-0 text-fg-muted hover:text-fg"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                onClick={() => void handleGenerateDraft()}
                disabled={
                  generating ||
                  (!notes.trim() && attachments.length === 0) ||
                  !!status.fixture_active
                }
                className="mt-2 rounded-lg border border-line bg-surface-overlay px-4 py-2 text-sm font-medium text-fg hover:border-line-strong disabled:opacity-50"
              >
                {generating ? (t("clients.page.drafting")) : (t("clients.page.draft_client"))}
              </button>
            </>
          ) : (
            <div className="mt-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:outline-none focus:border-line-strong"
                />
                <span className="text-xs text-fg-muted">
                  {t("clients.page.draft_bundle_people_length_people_draft_bundle_departments_length_departments_draft_bundle_docs_length", { draft_bundle_people_length: draft.bundle.people.length, draft_bundle_departments_length: draft.bundle.departments.length, draft_bundle_docs_length: draft.bundle.docs.length })}
                </span>
              </div>
              {draft.bundle.people.length > 0 && (
                <p className="mt-2 text-xs text-fg-muted">
                  {t("clients.page.roster")}
                  {draft.bundle.people
                    .map((p) => `${p.full_name}${p.is_principal ? (t("clients.page.principal")) : ""}`)
                    .join(", ")}
                </p>
              )}
              {draft.bundle.docs.length > 0 && (
                <p className="mt-1 text-xs text-fg-muted">
                  {t("clients.page.docs")}
                  {draft.bundle.docs.map((d) => d.filename).join(", ")}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => void handleCreateFromDraft(false)}
                  disabled={creatingDraft || !draftName.trim()}
                  className="rounded-lg border border-line bg-surface-overlay px-4 py-2 text-sm font-medium text-fg hover:border-line-strong disabled:opacity-50"
                >
                  {creatingDraft ? (t("clients.page.creating")) : (t("clients.page.create_client"))}
                </button>
                <button
                  onClick={() => void handleCreateFromDraft(true)}
                  disabled={creatingDraft || !draftName.trim()}
                  className="rounded-lg border border-line bg-surface-overlay px-4 py-2 text-sm font-medium text-fg hover:border-line-strong disabled:opacity-50"
                >
                  {creatingDraft ? (t("clients.page.creating")) : (t("clients.page.create_activate"))}
                </button>
                <button
                  onClick={() => setDraft(null)}
                  disabled={creatingDraft}
                  className="rounded-lg border border-line px-4 py-2 text-sm text-fg-muted hover:border-line-strong disabled:opacity-50"
                >
                  {t("clients.page.edit_notes")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* List */}
        {loading ? (
          <p className="mt-6 text-sm text-fg-muted">
            {t("clients.page.loading_clients")}
          </p>
        ) : status.clients.length === 0 ? (
          <p className="mt-6 text-sm text-fg-muted">
            {t("clients.page.no_clients_yet_create_one")}
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {status.clients.map((c) => {
              const isActive = c.slug === status.active;
              const busy = busySlug === c.slug;
              return (
                <div
                  key={c.slug}
                  className={`rounded-xl border p-4 ${
                    isActive
                      ? "border-line-strong bg-surface-overlay"
                      : "border-line bg-surface-elevated"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-fg truncate">
                          {c.display_name}
                        </h3>
                        {isActive && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                            {t("clients.page.active")}
                          </span>
                        )}
                        {c.has_mcp_config && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-line text-fg-muted">
                            {t("clients.page.mcp_tools")}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        {[c.role, c.status, c.industry, c.stage]
                          .filter(Boolean)
                          .join(" · ") || c.slug}
                        {" · "}
                        {t("clients.page.c_doc_count_docc_doc_count_____1____s", { c_doc_count: c.doc_count, c_doc_count_____1____s: c.doc_count !== 1 ? "s" : "" })}
                        {c.saved_at
                          ? (t("clients.page.saved_new_date_c_saved_at__tolocalestring", { new_Date_c_saved_at__toLocaleString: new Date(c.saved_at).toLocaleString(), new_Date_c_saved_at__toLocaleString__zh_CN: new Date(c.saved_at).toLocaleString("zh-CN") }))
                          : (t("clients.page.never_saved"))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive ? (
                        <button
                          onClick={() => void handleSave()}
                          disabled={busy || !!status.fixture_active}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-fg hover:border-line-strong disabled:opacity-50"
                        >
                          {busy ? (t("clients.page.saving")) : (t("clients.page.save_now"))}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => void handleActivate(c.slug)}
                            disabled={busy || !!status.fixture_active}
                            className="rounded-lg border border-line bg-surface-overlay px-3 py-1.5 text-xs font-medium text-fg hover:border-line-strong disabled:opacity-50"
                          >
                            {busy ? (t("clients.page.switching")) : (t("clients.page.activate"))}
                          </button>
                          {confirmDelete === c.slug ? (
                            <button
                              onClick={() => void handleDelete(c.slug)}
                              disabled={busy}
                              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 disabled:opacity-50"
                            >
                              {t("clients.page.confirm_delete")}
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(c.slug)}
                              disabled={busy}
                              aria-label={t("clients.page.delete_c_display_name", { c_display_name: c.display_name })}
                              className="rounded-lg border border-line px-2 py-1.5 text-xs text-fg-muted hover:border-line-strong disabled:opacity-50"
                            >
                              <Icon name="trash" size="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-2">
                    {editingSlug === c.slug ? (
                      <div className="rounded-lg border border-line bg-surface p-3 grid gap-2 sm:grid-cols-2">
                        <input
                          value={metaForm.role ?? ""}
                          onChange={(e) => setMetaForm({ ...metaForm, role: e.target.value })}
                          placeholder={t("clients.page.your_role_eg_fractional_cfo")}
                          className="rounded border border-line bg-surface-elevated px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:outline-none"
                        />
                        <select
                          value={metaForm.status ?? "active"}
                          onChange={(e) => setMetaForm({ ...metaForm, status: e.target.value })}
                          className="rounded border border-line bg-surface-elevated px-2 py-1.5 text-xs text-fg focus:outline-none"
                        >
                          <option value="active">{t("clients.page.active")}</option>
                          <option value="paused">{t("clients.page.paused")}</option>
                          <option value="winding_down">{t("clients.page.winding_down")}</option>
                          <option value="completed">{t("clients.page.completed")}</option>
                        </select>
                        <label className="text-[11px] text-fg-muted flex items-center gap-2">
                          {t("clients.page.renewal")}
                          <input
                            type="date"
                            value={metaForm.renewal_date ?? ""}
                            onChange={(e) =>
                              setMetaForm({ ...metaForm, renewal_date: e.target.value })
                            }
                            className="flex-1 rounded border border-line bg-surface-elevated px-2 py-1.5 text-xs text-fg focus:outline-none"
                          />
                        </label>
                        <input
                          value={metaForm.retainer ?? ""}
                          onChange={(e) => setMetaForm({ ...metaForm, retainer: e.target.value })}
                          placeholder={t("clients.page.retainer_display_only")}
                          className="rounded border border-line bg-surface-elevated px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:outline-none"
                        />
                        <input
                          value={metaForm.primary_contact ?? ""}
                          onChange={(e) =>
                            setMetaForm({ ...metaForm, primary_contact: e.target.value })
                          }
                          placeholder={t("clients.page.primary_contact")}
                          className="rounded border border-line bg-surface-elevated px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:outline-none"
                        />
                        <input
                          value={metaForm.notes ?? ""}
                          onChange={(e) => setMetaForm({ ...metaForm, notes: e.target.value })}
                          placeholder={t("clients.page.notes")}
                          className="rounded border border-line bg-surface-elevated px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:outline-none"
                        />
                        <div className="sm:col-span-2 flex gap-2">
                          <button
                            onClick={() => void handleSaveMeta()}
                            disabled={savingMeta}
                            className="rounded-lg border border-line bg-surface-overlay px-3 py-1.5 text-xs font-medium text-fg hover:border-line-strong disabled:opacity-50"
                          >
                            {savingMeta ? (t("clients.page.saving")) : (t("clients.page.save_details"))}
                          </button>
                          <button
                            onClick={() => setEditingSlug(null)}
                            disabled={savingMeta}
                            className="rounded-lg border border-line px-3 py-1.5 text-xs text-fg-muted hover:border-line-strong"
                          >
                            {t("clients.page.cancel")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => openMetaEditor(c.slug)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300"
                      >
                        {t("clients.page.engagement_details")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-xs text-fg-muted leading-relaxed">
          {t("clients.page.only_the_active_client_is")}
        </p>
      </div>
    </main>
  );
}
