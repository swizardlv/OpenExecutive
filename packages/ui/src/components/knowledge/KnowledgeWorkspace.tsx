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
  const { locale } = useI18n();
  const isZh = locale === "zh";
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
      setError(isZh ? "加载知识库索引失败" : "Failed to load knowledge index");
    }
  }, [isZh]);

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
        if (!cancelled) setError(isZh ? "加载文件失败" : "Failed to load file");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [selection, isZh]);

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
      setError(isZh ? "保存文件失败" : "Failed to save file");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (selection?.kind !== "file" || !selectedContent) return;
    const confirmMsg = isZh
      ? `删除 "${selectedContent.filename}"？这将从知识库中移除该文件。`
      : `Delete "${selectedContent.filename}"? This removes it from the knowledge base.`;
    if (!confirm(confirmMsg))
      return;
    const deleter =
      selection.fileKind === "builtin" ? deleteBuiltinFile : deleteFailureFile;
    try {
      await deleter(selection.domain, selection.filename);
      setSelection(null);
      await loadIndex();
    } catch {
      setError(isZh ? "删除文件失败" : "Failed to delete file");
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
          placeholder={isZh ? "过滤文件…" : "Filter files…"}
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
          <p className="text-sm text-fg-muted">{isZh ? "加载中…" : "Loading…"}</p>
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
  const { locale } = useI18n();
  const isZh = locale === "zh";
  return (
    <div className="max-w-xl">
      <h1 className="text-lg font-semibold text-fg mb-2">{isZh ? "知识库" : "Knowledge base"}</h1>
      <p className="text-sm text-fg-muted">
        {isZh
          ? "在左侧目录树中选择文件进行查看或编辑。内置目录包含 Executive 的默认操作指南（正面指引）和失败案例复盘（反面教训）—— 两者都会在对话检索时被调取。"
          : "Select a file in the tree to view or edit it. The Built-in tree holds the Executive's default playbooks (positive guidance) and failure case studies (negative learnings) — both are retrieved at chat time."}
      </p>
      <ul className="text-sm text-fg-muted mt-4 space-y-1.5 list-disc list-inside">
        <li>
          <span className="text-fg">{isZh ? "最佳实践（Playbooks）" : "Playbooks"}</span> —{" "}
          {isZh ? "各领域的框架与操作指南，作为正面参考示例。" : "domain frameworks and how-tos used as positive examples."}
        </li>
        <li>
          <span className="text-rose-300">{isZh ? "失败教训（Failures）" : "Failures"}</span> —{" "}
          {isZh ? "关键决策失误与踩坑复盘案例，在匹配度高时呈现。" : "case studies of what went wrong, surfaced when the question matches one strongly."}
        </li>
        <li>
          <span className="text-fg">{isZh ? "企业文档（Company）" : "Company"}</span> —{" "}
          {isZh ? "您上传的企业内部资料与文档。" : "your uploaded documents."}
        </li>
        <li>
          <span className="text-fg">{isZh ? "参考资料库（Reference Library）" : "Reference Library"}</span> —{" "}
          {isZh ? "开源教材与权威行业手册。" : "open-licensed textbooks and handbooks."}
        </li>
        <li>
          <span className="text-indigo-300">{isZh ? "检索测试（Query mode）" : "Query mode"}</span> —{" "}
          {isZh ? "直观查看 Executive 针对特定问题会调取哪些知识片段。" : "see exactly what the Executive would retrieve for a question."}
        </li>
      </ul>
    </div>
  );
}
