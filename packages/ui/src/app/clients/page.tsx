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
  const { locale } = useI18n();
  const isZh = locale === "zh";

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
      setToast({ message: isZh ? "加载客户列表失败" : "Failed to load clients", kind: "error" });
    } finally {
      setLoading(false);
    }
  }, [isZh]);

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
          ? (isZh
            ? `${created.display_name} 已从当前公司创建并已激活。`
            : `${created.display_name} created from your current company and is now active.`)
          : (isZh
            ? `${created.display_name} 已创建 — 请激活以开始入职引导。`
            : `${created.display_name} created — activate it to start onboarding.`),
        kind: "success",
      });
      setName("");
      await refresh();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : (isZh ? "创建失败" : "Create failed"), kind: "error" });
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
      setToast({ message: isZh ? "委托合作详情已保存。" : "Engagement details saved.", kind: "success" });
      setEditingSlug(null);
      await refresh();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : (isZh ? "保存失败" : "Save failed"), kind: "error" });
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
      setToast({ message: e instanceof Error ? e.message : (isZh ? "草案生成失败" : "Draft failed"), kind: "error" });
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
          message: isZh ? `${displayName} 已创建并激活。` : `${displayName} created and activated.`,
          kind: "success",
        });
      } else {
        setToast({
          message: isZh
            ? `${displayName} 已创建 — 请激活以开始委托合作。`
            : `${displayName} created — activate it to start the engagement.`,
          kind: "success",
        });
      }
      setDraft(null);
      setNotes("");
      setAttachments([]);
      await refresh();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : (isZh ? "创建失败" : "Create failed"), kind: "error" });
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
          ? (isZh
            ? `已切换至 ${slug}。MCP 工具配置已更新 — 将在下次 API 重启时生效。`
            : `Switched to ${slug}. MCP tool config changed — it applies on the next API restart.`)
          : (isZh ? `已切换至 ${slug}。` : `Switched to ${slug}.`),
        kind: "success",
      });
      await refresh();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : (isZh ? "切换失败" : "Switch failed"), kind: "error" });
    } finally {
      setBusySlug(null);
    }
  }

  async function handleSave() {
    setBusySlug(status.active);
    try {
      const result = await saveActiveClient();
      setToast({ message: isZh ? `已将 ${result.slug} 保存至存储槽。` : `Saved ${result.slug} to its slot.`, kind: "success" });
      await refresh();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : (isZh ? "保存失败" : "Save failed"), kind: "error" });
    } finally {
      setBusySlug(null);
    }
  }

  async function handleDelete(slug: string) {
    setBusySlug(slug);
    try {
      await deleteClient(slug);
      setToast({ message: isZh ? `已删除 ${slug}。` : `Deleted ${slug}.`, kind: "success" });
      setConfirmDelete(null);
      await refresh();
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : (isZh ? "删除失败" : "Delete failed"), kind: "error" });
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <main className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-xl font-semibold text-fg">
          {isZh ? "客户公司（多租户管理）" : "Client companies"}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          {isZh
            ? "在单个 Open Executive 实例中管理多家客户公司 — 同一时间仅一家处于激活运行状态。切换客户时会将当前客户的完整状态（对话、计划排期、入职规划、文档、MCP 工具）完整保存至其专属存储槽，并恢复目标客户的状态。"
            : "Run several client companies from one Open Executive — one active at a time. Switching saves the current client's full state (chat, schedule, onboarding plans, documents, MCP tools) to its slot and restores the target."}
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
            {isZh
              ? "夜间巡检轮转正在运行中 — 当前激活的客户将在休眠客户刷新期间短暂切换，之后会自动切回。"
              : "Overnight rotation is running — the active client will switch briefly while parked clients are refreshed, then return."}
          </div>
        )}

        {status.fixture_active && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
            {isZh ? (
              <>
                演示模拟公司 <strong>{status.fixture_active}</strong> 处于生效状态 — 请先在“公司模拟器”页面卸载它，然后再进行客户管理。
              </>
            ) : (
              <>
                Demo fixture <strong>{status.fixture_active}</strong> is active —
                unload it on the Company Simulator page before working with clients.
              </>
            )}
          </div>
        )}

        {/* Practice cockpit — only in multi-client mode (2+ slots) */}
        {cockpit.length >= 2 && (
          <div className="mt-6 rounded-xl border border-line bg-surface-elevated p-4">
            <h2 className="text-sm font-medium text-fg">
              {isZh ? "业务全景工作台" : "Practice cockpit"}
            </h2>
            <p className="mt-1 text-xs text-fg-muted">
              {isZh
                ? "所有客户业务一览。未激活的客户展示截至上一次保存点的状态。"
                : "All clients at a glance. Parked clients show their state as of the last save point."}
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
                        {isZh ? "生效中" : "active"}
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
                        {isZh ? "价值交付报告 →" : "Value report →"}
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
            {isZh ? "创建新客户" : "New client"}
          </h2>
          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isZh ? "客户公司名称" : "Client company name"}
              className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-line-strong"
            />
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as "current" | "blank")}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg focus:outline-none"
            >
              <option value="current">{isZh ? "从当前公司捕获" : "From current company"}</option>
              <option value="blank">{isZh ? "全新空白（重新入职引导）" : "Blank (onboard fresh)"}</option>
            </select>
            <button
              onClick={() => void handleCreate()}
              disabled={creating || !name.trim() || !!status.fixture_active}
              className="rounded-lg border border-line bg-surface-overlay px-4 py-2 text-sm font-medium text-fg hover:border-line-strong disabled:opacity-50"
            >
              {creating ? (isZh ? "创建中…" : "Creating…") : (isZh ? "创建客户" : "Create")}
            </button>
          </div>
          <p className="mt-2 text-xs text-fg-muted">
            {source === "current"
              ? (isZh
                ? "将当前生效公司的状态捕获到新客户存储槽中，并将其设为当前激活客户。"
                : "Captures the live company into the new client slot and makes it the active client.")
              : (isZh
                ? "创建一个空白客户。激活后即可运行公司入职引导并上传专属文档。"
                : "Creates an empty client. Activate it, then run company onboarding and upload its documents.")}
          </p>
        </div>

        {/* New engagement from intake notes (AI) */}
        <div className="mt-4 rounded-xl border border-line bg-surface-elevated p-4">
          <h2 className="text-sm font-medium text-fg">
            {isZh ? "从对接材料生成新客户 (AI)" : "New client from intake notes"}
          </h2>
          <p className="mt-1 text-xs text-fg-muted">
            {isZh
              ? "粘贴真实的客户对接材料（初访纪要、业务概述、官网文案等）或上传 PDF、Word、Excel、CSV 文件，AI 将自动梳理并草拟客户画像、组织架构、初始文档和已知沿革。上传的文件也将作为公司文档保存。AI 严格基于材料提取事实：未知项保持留白并列为待办问题，绝不导入任何联系人私人方式。"
              : "Paste real intake material — call notes, a brief, website copy — or attach PDFs, Word, Excel, or CSV files, and the AI drafts the client's profile, org, starter documents, and known history. Attachments are also saved as company documents. It extracts only what the material says: unknowns stay blank and become open questions, and no contact details are ever imported."}
          </p>

          {!draft ? (
            <>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={5}
                placeholder={
                  isZh
                    ? "例如：与 Meridian Solar 启动会纪要：位于德州的 80 人商业太阳能工程商，CEO 为 Dana Reyes，当前痛点是项目毛利率不够透明…"
                    : "e.g. Notes from the kickoff call with Meridian Solar: 80-person commercial solar installer in Texas, CEO Dana Reyes, struggling with project-margin visibility…"
                }
                className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-line-strong"
              />

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="cursor-pointer rounded-lg border border-line bg-surface-overlay px-3 py-1.5 text-xs font-medium text-fg hover:border-line-strong">
                  {isZh ? "添加附件" : "Attach files"}
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
                  {isZh ? "支持 PDF、Word、Excel、CSV 或纯文本" : "PDF, Word, Excel, CSV, or text"}
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
                        aria-label={isZh ? `移除 ${f.name}` : `Remove ${f.name}`}
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
                {generating ? (isZh ? "生成中…" : "Drafting…") : (isZh ? "草拟客户信息" : "Draft client")}
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
                  {isZh
                    ? `${draft.bundle.people.length} 人 · ${draft.bundle.departments.length} 个部门 · ${draft.bundle.docs.length} 篇文档`
                    : `${draft.bundle.people.length} people · ${draft.bundle.departments.length} departments · ${draft.bundle.docs.length} docs`}
                </span>
              </div>
              {draft.bundle.people.length > 0 && (
                <p className="mt-2 text-xs text-fg-muted">
                  {isZh ? "团队人员：" : "Roster: "}
                  {draft.bundle.people
                    .map((p) => `${p.full_name}${p.is_principal ? (isZh ? " (负责人)" : " (principal)") : ""}`)
                    .join(", ")}
                </p>
              )}
              {draft.bundle.docs.length > 0 && (
                <p className="mt-1 text-xs text-fg-muted">
                  {isZh ? "初始文档：" : "Docs: "}
                  {draft.bundle.docs.map((d) => d.filename).join(", ")}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => void handleCreateFromDraft(false)}
                  disabled={creatingDraft || !draftName.trim()}
                  className="rounded-lg border border-line bg-surface-overlay px-4 py-2 text-sm font-medium text-fg hover:border-line-strong disabled:opacity-50"
                >
                  {creatingDraft ? (isZh ? "创建中…" : "Creating…") : (isZh ? "创建客户" : "Create client")}
                </button>
                <button
                  onClick={() => void handleCreateFromDraft(true)}
                  disabled={creatingDraft || !draftName.trim()}
                  className="rounded-lg border border-line bg-surface-overlay px-4 py-2 text-sm font-medium text-fg hover:border-line-strong disabled:opacity-50"
                >
                  {creatingDraft ? (isZh ? "创建中…" : "Creating…") : (isZh ? "创建并激活" : "Create & activate")}
                </button>
                <button
                  onClick={() => setDraft(null)}
                  disabled={creatingDraft}
                  className="rounded-lg border border-line px-4 py-2 text-sm text-fg-muted hover:border-line-strong disabled:opacity-50"
                >
                  {isZh ? "← 修改材料" : "← Edit notes"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* List */}
        {loading ? (
          <p className="mt-6 text-sm text-fg-muted">
            {isZh ? "正在加载客户列表…" : "Loading clients…"}
          </p>
        ) : status.clients.length === 0 ? (
          <p className="mt-6 text-sm text-fg-muted">
            {isZh
              ? "暂无客户。从当前公司创建一个客户即可进入多客户管理模式 — 在创建之前单公司体验不受任何影响。"
              : "No clients yet. Create one from your current company to enter multi-client mode — single-company use is unaffected until you do."}
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
                            {isZh ? "生效中" : "active"}
                          </span>
                        )}
                        {c.has_mcp_config && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-line text-fg-muted">
                            {isZh ? "MCP 工具" : "MCP tools"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-fg-muted">
                        {[c.role, c.status, c.industry, c.stage]
                          .filter(Boolean)
                          .join(" · ") || c.slug}
                        {" · "}
                        {isZh ? `${c.doc_count} 篇文档` : `${c.doc_count} doc${c.doc_count !== 1 ? "s" : ""}`}
                        {c.saved_at
                          ? (isZh
                            ? ` · 保存于 ${new Date(c.saved_at).toLocaleString("zh-CN")}`
                            : ` · saved ${new Date(c.saved_at).toLocaleString()}`)
                          : (isZh ? " · 未曾保存" : " · never saved")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive ? (
                        <button
                          onClick={() => void handleSave()}
                          disabled={busy || !!status.fixture_active}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-fg hover:border-line-strong disabled:opacity-50"
                        >
                          {busy ? (isZh ? "保存中…" : "Saving…") : (isZh ? "立即保存" : "Save now")}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => void handleActivate(c.slug)}
                            disabled={busy || !!status.fixture_active}
                            className="rounded-lg border border-line bg-surface-overlay px-3 py-1.5 text-xs font-medium text-fg hover:border-line-strong disabled:opacity-50"
                          >
                            {busy ? (isZh ? "切换中…" : "Switching…") : (isZh ? "激活切换" : "Activate")}
                          </button>
                          {confirmDelete === c.slug ? (
                            <button
                              onClick={() => void handleDelete(c.slug)}
                              disabled={busy}
                              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 disabled:opacity-50"
                            >
                              {isZh ? "确认删除" : "Confirm delete"}
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(c.slug)}
                              disabled={busy}
                              aria-label={isZh ? `删除 ${c.display_name}` : `Delete ${c.display_name}`}
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
                          placeholder={isZh ? "您的角色（例如：兼职 CFO / 战略顾问）" : "Your role (e.g. Fractional CFO)"}
                          className="rounded border border-line bg-surface-elevated px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:outline-none"
                        />
                        <select
                          value={metaForm.status ?? "active"}
                          onChange={(e) => setMetaForm({ ...metaForm, status: e.target.value })}
                          className="rounded border border-line bg-surface-elevated px-2 py-1.5 text-xs text-fg focus:outline-none"
                        >
                          <option value="active">{isZh ? "活跃 (active)" : "active"}</option>
                          <option value="paused">{isZh ? "暂停 (paused)" : "paused"}</option>
                          <option value="winding_down">{isZh ? "收尾中 (winding down)" : "winding down"}</option>
                          <option value="completed">{isZh ? "已完成 (completed)" : "completed"}</option>
                        </select>
                        <label className="text-[11px] text-fg-muted flex items-center gap-2">
                          {isZh ? "续约日期" : "Renewal"}
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
                          placeholder={isZh ? "顾问月费/服务费（仅展示）" : "Retainer (display only)"}
                          className="rounded border border-line bg-surface-elevated px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:outline-none"
                        />
                        <input
                          value={metaForm.primary_contact ?? ""}
                          onChange={(e) =>
                            setMetaForm({ ...metaForm, primary_contact: e.target.value })
                          }
                          placeholder={isZh ? "核心对接人" : "Primary contact"}
                          className="rounded border border-line bg-surface-elevated px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:outline-none"
                        />
                        <input
                          value={metaForm.notes ?? ""}
                          onChange={(e) => setMetaForm({ ...metaForm, notes: e.target.value })}
                          placeholder={isZh ? "备注说明" : "Notes"}
                          className="rounded border border-line bg-surface-elevated px-2 py-1.5 text-xs text-fg placeholder:text-fg-muted focus:outline-none"
                        />
                        <div className="sm:col-span-2 flex gap-2">
                          <button
                            onClick={() => void handleSaveMeta()}
                            disabled={savingMeta}
                            className="rounded-lg border border-line bg-surface-overlay px-3 py-1.5 text-xs font-medium text-fg hover:border-line-strong disabled:opacity-50"
                          >
                            {savingMeta ? (isZh ? "保存中…" : "Saving…") : (isZh ? "保存详情" : "Save details")}
                          </button>
                          <button
                            onClick={() => setEditingSlug(null)}
                            disabled={savingMeta}
                            className="rounded-lg border border-line px-3 py-1.5 text-xs text-fg-muted hover:border-line-strong"
                          >
                            {isZh ? "取消" : "Cancel"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => openMetaEditor(c.slug)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300"
                      >
                        {isZh ? "委托合作详情" : "Engagement details"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-xs text-fg-muted leading-relaxed">
          {isZh
            ? "同一时间仅有一家客户公司处于激活运行状态 — 其定时任务才会触发，其文档才会被索引检索；休眠中的客户安全保存在其存储槽中。首次切换时会自动备份您的原始公司，并且随时可以在“公司模拟器”页面恢复。"
            : "Only the active client is live — its scheduled actions fire and its documents are indexed; parked clients sleep in their slots. Your original company is preserved automatically the first time you switch, and can be restored from the Company Simulator page."}
        </p>
      </div>
    </main>
  );
}
