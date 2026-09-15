"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Locale = "zh" | "en";

interface Translations {
  [key: string]: {
    zh: string;
    en: string;
  };
}

export const DICTIONARY: Translations = {
  // Navigation
  "nav.newChat": { zh: "新建对话", en: "New chat" },
  "nav.briefing": { zh: "今日简报", en: "Briefing" },
  "nav.pulse": { zh: "状态脉搏", en: "Pulse" },
  "nav.workspace": { zh: "工作空间", en: "Workspace" },
  "nav.review": { zh: "知识审查", en: "Review" },
  "nav.jobs": { zh: "任务流", en: "Jobs" },
  "nav.artifacts": { zh: "文档产物", en: "Artifacts" },
  "nav.watchlist": { zh: "监控清单", en: "Watch list" },
  "nav.company": { zh: "企业管理", en: "Company" },
  "nav.departments": { zh: "部门架构", en: "Departments" },
  "nav.people": { zh: "组织成员", en: "People" },
  "nav.talent": { zh: "人才猎聘", en: "Talent" },
  "nav.settings": { zh: "系统设置", en: "Settings" },
  "nav.guide": { zh: "使用指南", en: "User Guide" },
  "nav.council": { zh: "专员议会", en: "Agent Council" },
  "nav.architecture": { zh: "系统架构", en: "Architecture" },
  "nav.audit": { zh: "审计日志", en: "Audit log" },
  "nav.usage": { zh: "Token消耗", en: "Token usage" },
  "nav.knowledge": { zh: "知识库", en: "Knowledge base" },
  "nav.skills": { zh: "专员技能", en: "Skills" },
  "nav.companyProfile": { zh: "企业画像", en: "Company profile" },
  "nav.staffOnboarding": { zh: "员工入职", en: "Staff onboarding" },
  "nav.clients": { zh: "客户企业", en: "Client Companies" },
  "nav.demo": { zh: "企业模拟器", en: "Company Simulator" },

  // Nav descriptions
  "desc.newChat": { zh: "开启新的决策与对话会话", en: "Start a fresh conversation" },
  "desc.briefing": { zh: "今日待办、跨部门进展与最新预警", en: "Daily operating brief" },
  "desc.pulse": { zh: "各部门长期记忆、上下文与关系图谱", en: "Episodic memory across departments" },
  "desc.review": { zh: "审查、通过或修正外部摄入的企业知识", en: "Approve, reject, or correct incoming knowledge" },
  "desc.jobs": { zh: "多步骤复杂执行工作流", en: "Multi-step workflows that produce a deliverable" },
  "desc.artifacts": { zh: "已生成的文档、方案与输出产物", en: "Library of finished documents" },
  "desc.watchlist": { zh: "外部市场动态、监控信源与预警", en: "External monitors that raise alerts" },
  "desc.departments": { zh: "各部门职责、授权级别与对应专员", en: "Org units with goals and authority levels" },
  "desc.people": { zh: "公司成员名单、审批权限与通道偏好", en: "Your roster and approval scopes" },
  "desc.talent": { zh: "高管招聘与候选人搜索管理", en: "Candidate searches and hiring engagements" },
  "desc.settings": { zh: "系统配置、模型选择与集成管理", en: "System configuration and integrations" },
  "desc.guide": { zh: "Open Executive 交互手册与实战指南", en: "Operator's field guide" },

  // User & Header
  "user.signOut": { zh: "退出登录", en: "Sign out" },
  "user.loading": { zh: "加载中…", en: "Loading…" },
  "shell.askOE": { zh: "向 OE 提问", en: "Ask OE" },
  "shell.askOEPlaceholder": { zh: "快速提问或检索…", en: "Search or ask anything…" },
  "shell.language": { zh: "语言", en: "Language" },

  // Chat UI
  "chat.placeholder": {
    zh: "提出问题、提交决策或要求分析…",
    en: "Ask a question, propose a decision, or ask for analysis…",
  },
  "chat.send": { zh: "发送", en: "Send" },
  "chat.stop": { zh: "停止", en: "Stop" },
  "chat.clear": { zh: "清空对话", en: "Clear chat" },
  "chat.deleteSession": { zh: "删除会话", en: "Delete session" },
  "chat.committeeReview": { zh: "委员会评审", en: "Committee review" },
  "chat.consulting": { zh: "执行官正在咨询专员…", en: "Executive is consulting specialists…" },
  "chat.responding": { zh: "执行官正在回复…", en: "Executive is responding…" },
  "chat.attachFiles": { zh: "添加附件", en: "Attach files" },
  "chat.recentSessions": { zh: "近期对话", en: "Recent sessions" },
  "chat.noRecentSessions": { zh: "暂无历史对话", en: "No recent chats" },
  "recent.title": { zh: "最近对话", en: "Recent" },
  "recent.searchPlaceholder": { zh: "搜索对话…", en: "Search conversations" },
  "recent.noMatch": { zh: "未找到匹配的对话。", en: "No conversations match." },
  "recent.untitled": { zh: "新对话", en: "Untitled chat" },
  "recent.deleteChat": { zh: "删除对话", en: "Delete chat" },
  "recent.showMore": { zh: "显示更多", en: "Show" },
  "chat.subtitle": {
    zh: "随时继续推进工作 — 重温待决事项、推进文档草案、协同各部门团队。",
    en: "Pick up where we left off — decisions to revisit, drafts to push forward, people to pull in.",
  },
  "chat.prompt1": {
    zh: "我们这季度的战略重点确定得如何了？",
    en: "Where did we land on this quarter's priorities?",
  },
  "chat.prompt2": {
    zh: "拉进管理层，讨论我目前拿不准的一项决策。",
    en: "Pull the team in on a decision I'm sitting on.",
  },
  "chat.prompt3": {
    zh: "在发出前，一起过一遍向董事会的汇报材料。",
    en: "Let's review the board update before it goes out.",
  },
  "chat.prompt4": {
    zh: "自上次同步以来，有哪些最新进展与变化？",
    en: "What's changed since our last sync?",
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "zh",
  setLocale: () => {},
  t: (key: string, fallback?: string) => fallback ?? key,
});

const STORAGE_KEY = "openexec_locale";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (saved === "zh" || saved === "en") {
        setLocaleState(saved);
      } else {
        const navLang = navigator.language?.toLowerCase() ?? "";
        if (navLang.startsWith("zh")) {
          setLocaleState("zh");
        } else {
          setLocaleState("en");
        }
      }
    } catch {
      // ignore SSR or storage exceptions
    }
    setMounted(true);
  }, []);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try {
      localStorage.setItem(STORAGE_KEY, nextLocale);
      document.documentElement.lang = nextLocale;
    } catch {
      // ignore
    }
  };

  const t = (key: string, fallback?: string): string => {
    const entry = DICTIONARY[key];
    if (entry) {
      return entry[locale] ?? fallback ?? key;
    }
    return fallback ?? key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <div className={`inline-flex items-center rounded-md border border-line bg-surface-overlay/80 p-0.5 text-xs ${className}`}>
      <button
        type="button"
        onClick={() => setLocale("zh")}
        className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
          locale === "zh"
            ? "bg-surface text-fg shadow-xs font-semibold"
            : "text-fg-muted hover:text-fg"
        }`}
        title="切换为中文"
      >
        中文
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
          locale === "en"
            ? "bg-surface text-fg shadow-xs font-semibold"
            : "text-fg-muted hover:text-fg"
        }`}
        title="Switch to English"
      >
        EN
      </button>
    </div>
  );
}
