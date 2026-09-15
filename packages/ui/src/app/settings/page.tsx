"use client";

import Link from "next/link";

import Icon from "@/components/Icon";
import { getAdvancedItems } from "@/components/shell/navConfig";
import { useI18n } from "@/lib/i18n";

// Settings hub — home for admin / power-user tools that were pulled out
// of the primary nav to keep day-to-day navigation focused. Each tool is
// a full route; this page is just the directory that points to them.
export default function SettingsPage() {
  const { locale } = useI18n();
  const items = getAdvancedItems(locale);
  const isZh = locale === "zh";

  return (
    <main className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-xl font-semibold text-fg">
          {isZh ? "系统设置与高级工具" : "Settings & advanced"}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          {isZh
            ? "系统配置、诊断测试与管理工具中心。这些工具位于日常工作空间主导航之外。"
            : "Configuration, diagnostics, and power-user tools. These sit outside the day-to-day workspace nav."}
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-xl border border-line bg-surface-elevated p-4 hover:border-line-strong hover:bg-surface-overlay transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-fg-muted group-hover:text-fg transition-colors">
                  <Icon name={item.icon} size="w-5 h-5" />
                </span>
                <h2 className="text-sm font-medium text-fg">{item.label}</h2>
              </div>
              <p className="mt-2 text-xs text-fg-muted leading-relaxed">
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
