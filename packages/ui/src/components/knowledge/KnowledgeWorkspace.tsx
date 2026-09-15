"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createBuiltinFile,
  createFailureFile,
  deleteBuiltinFile,
  deleteFailureFile,
  getBuiltinFile,
  getFailureFile,
  listBuiltinFiles,
  listFailureFiles,
  updateBuiltinFile,
  updateFailureFile,
  type BuiltinFileContent,
  type BuiltinFileMeta,
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import CompanyPanel from "./CompanyPanel";
import FileEditor from "./FileEditor";
import NewFileForm from "./NewFileForm";
import QueryPanel from "./QueryPanel";
import ReferencePanel from "./ReferencePanel";
import SourceTree, { type FileKind, type Selection } from "./SourceTree";

const DOMAINS = [
  "board",
  "finance",
  "hr",
  "legal",
  "marketing",
  "operations",
  "product",
  "strategy",
];

export default function KnowledgeWorkspace() {
  const { t } = useI18n();
  const [builtinFiles, setBuiltinFiles] = useState<BuiltinFileMeta[]>([]);
  const [failureFiles, setFailureFiles] = useState<BuiltinFileMeta[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [selectedContent, setSelectedContent] = useState<BuiltinFileContent | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const loadIndex = useCallback(async () => {
    try {
      const [b, f] = await Promise.all([listBuiltinFiles(), listFailureFiles()]);
      setBuiltinFiles(b);
      setFailureFiles(f);
    } catch {
      setError(t("knowledge.KnowledgeWorkspace.failed_to_load_knowledge_index"));
    }
  }, [t]);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  // Load file content whenever selection points at a file.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setSelectedContent(null);
      setEditContent("");
      setIsDirty(false);
      if (selection?.kind !== "file") return;
      try {
        const fetcher = selection.fileKind === "builtin" ? getBuiltinFile : getFailureFile;
        const data = await fetcher(selection.domain, selection.filename);
        if (cancelled) return;
        setSelectedContent(data);
        setEditContent(data.content);
      } catch {
        if (!cancelled) setError(t("knowledge.KnowledgeWorkspace.failed_to_load_file"));
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selection, t]);

  async function handleSave() {
    if (selection?.kind !== "file" || !selectedContent) return;
    const updater =
      selection.fileKind === "builtin" ? updateBuiltinFile : updateFailureFile;
    setIsSaving(true);
    setError(null);
    try {
      await updater(selection.domain, selection.filename, editContent);
      setIsDirty(false);
    } catch {
      setError(t("knowledge.KnowledgeWorkspace.failed_to_save_file"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (selection?.kind !== "file" || !selectedContent) return;
    const confirmMsg = t("knowledge.KnowledgeWorkspace.delete_selectedcontent_filename_this_removes_it", { selectedContent_filename: selectedContent.filename });
    if (!confirm(confirmMsg))
      return;
    const deleter =
      selection.fileKind === "builtin" ? deleteBuiltinFile : deleteFailureFile;
    try {
      await deleter(selection.domain, selection.filename);
      setSelection(null);
      await loadIndex();
    } catch {
      setError(t("knowledge.KnowledgeWorkspace.failed_to_delete_file"));
    }
  }

  async function handleCreate(
    fileKind: FileKind,
    domain: string,
    filename: string,
    content: string
  ) {
    const creator = fileKind === "builtin" ? createBuiltinFile : createFailureFile;
    await creator(domain, filename, content);
    await loadIndex();
    setSelection({ kind: "file", fileKind, domain, filename });
  }

  const openFile = useCallback(
    (fileKind: FileKind, domain: string, filename: string) => {
      setSelection({ kind: "file", fileKind, domain, filename });
    },
    []
  );

  return (
    <div className="flex h-full">
      <aside className="w-64 flex-shrink-0 border-r border-line bg-surface/40 px-4 py-5 overflow-y-auto">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("knowledge.KnowledgeWorkspace.filter_files")}
          className="w-full mb-4 rounded-lg border border-line bg-surface-elevated px-2.5 py-1.5 text-xs text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
        <SourceTree
          domains={DOMAINS}
          builtinFiles={builtinFiles}
          failureFiles={failureFiles}
          selection={selection}
          filter={filter}
          onSelect={setSelection}
        />
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto px-8 py-6">
        {error && (
          <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {selection === null && (
          <EmptyState />
        )}

        {selection?.kind === "file" && selectedContent && (
          <FileEditor
            file={selectedContent}
            content={editContent}
            isDirty={isDirty}
            isSaving={isSaving}
            variant={selection.fileKind === "failures" ? "failure" : "playbook"}
            onChange={(v) => {
              setEditContent(v);
              setIsDirty(true);
            }}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        )}

        {selection?.kind === "file" && !selectedContent && !error && (
          <p className="text-sm text-fg-muted">{t("knowledge.KnowledgeWorkspace.loading")}</p>
        )}

        {selection?.kind === "new" && (
          <NewFileForm
            domains={DOMAINS}
            initialDomain={DOMAINS[0]}
            variant={selection.fileKind === "failures" ? "failure" : "playbook"}
            onSave={(domain, filename, content) =>
              handleCreate(selection.fileKind, domain, filename, content)
            }
            onCancel={() => setSelection(null)}
          />
        )}

        {selection?.kind === "company" && <CompanyPanel domains={DOMAINS} />}
        {selection?.kind === "reference" && <ReferencePanel />}
        {selection?.kind === "query" && (
          <QueryPanel domains={DOMAINS} onOpenFile={openFile} />
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="max-w-xl">
      <h1 className="text-lg font-semibold text-fg mb-2">{t("knowledge.KnowledgeWorkspace.knowledge_base")}</h1>
      <p className="text-sm text-fg-muted">
        {t("knowledge.KnowledgeWorkspace.select_a_file_in_the")}
      </p>
      <ul className="text-sm text-fg-muted mt-4 space-y-1.5 list-disc list-inside">
        <li>
          <span className="text-fg">{t("knowledge.KnowledgeWorkspace.playbooks")}</span> —{" "}
          {t("knowledge.KnowledgeWorkspace.domain_frameworks_and_howtos_used")}
        </li>
        <li>
          <span className="text-rose-300">{t("knowledge.KnowledgeWorkspace.failures")}</span> —{" "}
          {t("knowledge.KnowledgeWorkspace.case_studies_of_what_went")}
        </li>
        <li>
          <span className="text-fg">{t("knowledge.KnowledgeWorkspace.company")}</span> —{" "}
          {t("knowledge.KnowledgeWorkspace.your_uploaded_documents")}
        </li>
        <li>
          <span className="text-fg">{t("knowledge.KnowledgeWorkspace.reference_library")}</span> —{" "}
          {t("knowledge.KnowledgeWorkspace.openlicensed_textbooks_and_handbooks")}
        </li>
        <li>
          <span className="text-indigo-300">{t("knowledge.KnowledgeWorkspace.query_mode")}</span> —{" "}
          {t("knowledge.KnowledgeWorkspace.see_exactly_what_the_executive")}
        </li>
      </ul>
    </div>
  );
}
