"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";

interface NewFileFormProps {
  domains: string[];
  initialDomain: string;
  variant: "playbook" | "failure";
  onSave: (domain: string, filename: string, content: string) => Promise<void>;
  onCancel: () => void;
}

export default function NewFileForm({
  domains,
  initialDomain,
  variant,
  onSave,
  onCancel,
}: NewFileFormProps) {
  const { locale, t } = useI18n();
  const [domain, setDomain] = useState(initialDomain);
  const [filename, setFilename] = useState("");
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = filename.trim();
    const fullName = trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
    if (!/^[a-zA-Z0-9_\-]+\.md$/.test(fullName)) {
      setError(t("knowledge.NewFileForm.filename_must_be_alphanumeric_with"));
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(domain, fullName, content);
    } catch (e) {
      setError(e instanceof Error ? e.message : (t("knowledge.NewFileForm.failed_to_create_file")));
      setIsSaving(false);
    }
  }

  const title = variant === "failure"
    ? (t("knowledge.NewFileForm.new_failure_case"))
    : (t("knowledge.NewFileForm.new_playbook_file"));
  const placeholder =
    variant === "failure"
      ? (t("knowledge.NewFileForm.company_x_oneline_failure_summarynn"))
      : (t("knowledge.NewFileForm.titlennwrite_your_knowledge_here"));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-lg border border-line-strong bg-surface-elevated px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <input
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder={variant === "failure" ? "my-failure-case.md" : "my_topic.md"}
          className="flex-1 rounded-lg border border-line-strong bg-surface-elevated px-3 py-2 text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="min-h-[400px] w-full rounded-xl border border-line-strong bg-surface-elevated px-4 py-3 text-sm text-fg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
      />
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={!filename.trim() || !content.trim() || isSaving}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-colors"
        >
          {isSaving ? (t("knowledge.NewFileForm.creating")) : (t("knowledge.NewFileForm.create_file"))}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-line-strong text-fg-muted hover:text-fg text-sm rounded-xl transition-colors"
        >
          {t("knowledge.NewFileForm.cancel")}
        </button>
      </div>
    </div>
  );
}
