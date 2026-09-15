import { IconName } from "@/components/Icon";

// Single source of truth for the app's navigation. Both the chat-home
// sidebar (`app/page.tsx`, via `SidebarNav`) and the persistent rail
// (`components/shell/AppShell.tsx`) build their menus from here, so the
// two navs can never drift apart again. When adding a destination, add
// it ONCE in this file.

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /**
   * One-line plain-language explanation of the destination, surfaced as a
   * tooltip in the rail/sidebar and as card copy on the Settings hub.
   * Required so every new destination ships with an explanation.
   */
  description: string;
  /** Optional pending-count badge (e.g. items awaiting review). */
  badge?: number;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

export type NavLocale = "zh" | "en";

interface BuildOpts {
  /**
   * When false, the Company-profile entry points at the onboarding
   * wizard and is relabelled "Set up company". The chat home knows the
   * onboarding state from `/health`; the rail assumes onboarded (its
   * routes are only reachable post-setup).
   */
  isOnboarded?: boolean;
  /** Pending + needs-revision count shown on the Review entry. */
  reviewBadge?: number;
  /** Language locale for nav text (defaults to 'zh' for bilingual support). */
  locale?: NavLocale;
}

// Day-to-day navigation only. Power/admin tools live in the Settings
// area (see ADVANCED_ITEMS) so this list stays focused.
export function buildPrimaryNav({ isOnboarded = true, reviewBadge = 0, locale = "zh" }: BuildOpts = {}): NavGroup[] {
  const isZh = locale === "zh";

  return [
    {
      key: "workspace",
      label: isZh ? "工作空间" : "Workspace",
      items: [
        {
          href: "/review",
          label: isZh ? "知识审查" : "Review",
          icon: "check-circle",
          badge: reviewBadge,
          description: isZh
            ? "审查、通过或修正外部摄入的企业知识，确保执行准确。"
            : "Approve, reject, or correct incoming knowledge before the Executive relies on it.",
        },
        {
          href: "/jobs",
          label: isZh ? "任务流" : "Jobs",
          icon: "doc",
          description: isZh
            ? "产生交付物的多步骤复杂执行流程 — 董事会准备、GTM 规划等。"
            : "Multi-step workflows that produce a deliverable — board prep, GTM plans, reviews.",
        },
        {
          href: "/artifacts",
          label: isZh ? "文档产物" : "Artifacts",
          icon: "book",
          description: isZh
            ? "已完成的各类方案、草案与工作流交付物知识库。"
            : "Your library of finished documents — drafts and workflow outputs.",
        },
        {
          href: "/watchlist",
          label: isZh ? "监控清单" : "Watch list",
          icon: "eye",
          description: isZh
            ? "外部动态监控 — 股市行情、行业动态、系统状态与外部预警。"
            : "External monitors — tickers, feeds, status pages — that raise alerts.",
        },
      ],
    },
    {
      key: "company",
      label: isZh ? "企业管理" : "Company",
      items: [
        {
          href: "/departments",
          label: isZh ? "部门架构" : "Departments",
          icon: "grid",
          description: isZh
            ? "组织各业务部门：目标设定、决策权限及对口专员。"
            : "Org units with goals, an authority level, and a specialist behind each.",
        },
        {
          href: "/people",
          label: isZh ? "组织成员" : "People",
          icon: "users",
          description: isZh
            ? "团队成员通讯录 — 协同人员及其审批权责范围。"
            : "Your roster — who the Executive coordinates with and their approval scopes.",
        },
        {
          href: "/talent",
          label: isZh ? "人才猎聘" : "Talent",
          icon: "clipboard",
          description: isZh
            ? "高管招募、候选人画像与招聘流程跟踪。"
            : "Candidate searches and hiring engagements.",
        },
        {
          href: "/staff-onboarding",
          label: isZh ? "员工入职" : "Staff onboarding",
          icon: "users",
          description: isZh
            ? "新员工入职规划 — 任务进度、引导方案与欢迎资料。"
            : "Onboarding plans for new hires — progress, tasks, and welcome briefs.",
        },
        {
          href: isOnboarded ? "/company-profile" : "/onboard",
          label: isZh
            ? isOnboarded ? "企业画像" : "初始化企业画像"
            : isOnboarded ? "Company profile" : "Set up company",
          icon: "building",
          description: isZh
            ? "公司战略背景与核心身份 — 一次设置，随时编辑更新。"
            : "Your company's identity and strategy — set up once, edited any time.",
        },
      ],
    },
    {
      key: "knowledge",
      label: isZh ? "知识库" : "Knowledge",
      items: [
        {
          href: "/knowledge",
          label: isZh ? "企业知识库" : "Knowledge base",
          icon: "book",
          description: isZh
            ? "上传并索引企业核心文档，让执行团队熟悉业务背景。"
            : "Upload company documents so the Executive can ground its answers in your context.",
        },
        {
          href: "/skills",
          label: isZh ? "专员技能" : "Skills",
          icon: "bolt",
          description: isZh
            ? "各专业领域的标准作业程序 (SOP)、核查清单与业务剧本。"
            : "Reusable how-to procedures — checklists, playbooks, templates.",
        },
      ],
    },
  ];
}

// Localized helper getters
export function getPulseNavItem(locale: NavLocale = "zh"): NavItem {
  return {
    href: "/memories",
    label: locale === "zh" ? "状态脉搏" : "Pulse",
    icon: "activity",
    description: locale === "zh"
      ? "执行官的长期记忆与心跳 — 掌握的最新情况与运营节拍。"
      : "The Executive's memory and heartbeat — what it knows and the rhythm it runs on.",
  };
}

export function getSettingsNavItem(locale: NavLocale = "zh"): NavItem {
  return {
    href: "/settings",
    label: locale === "zh" ? "系统设置" : "Settings",
    icon: "cog",
    description: locale === "zh"
      ? "系统配置、诊断测试与管理工具中心。"
      : "Configuration, diagnostics, and power-user tools.",
  };
}

export function getGuideNavItem(locale: NavLocale = "zh"): NavItem {
  return {
    href: "/guide",
    label: locale === "zh" ? "使用指南" : "User Guide",
    icon: "info",
    description: locale === "zh"
      ? "系统功能交互全景手册 — 各模块介绍与最佳实践。"
      : "Plain-language overviews of every feature — what each one is and what it does.",
  };
}

export function getNewChatDescription(locale: NavLocale = "zh"): string {
  return locale === "zh" ? "与 AI 执行团队开启全新对话与决策。" : "Start a fresh conversation with the Executive.";
}

export function getBriefingDescription(locale: NavLocale = "zh"): string {
  return locale === "zh" ? "查看今日重点事项、待决决策与重要动态。" : "Land on a daily brief of what's happened and what needs you.";
}

export const PULSE_NAV_ITEM: NavItem = getPulseNavItem("en");
export const SETTINGS_NAV_ITEM: NavItem = getSettingsNavItem("en");
export const GUIDE_NAV_ITEM: NavItem = getGuideNavItem("en");
export const NEW_CHAT_DESCRIPTION = getNewChatDescription("en");
export const BRIEFING_DESCRIPTION = getBriefingDescription("en");

// Admin / power-user tools surfaced on the Settings hub page rather than
// in the primary nav — they aren't part of the day-to-day loop.
export function getAdvancedItems(locale: NavLocale = "zh"): NavItem[] {
  const isZh = locale === "zh";
  return [
    {
      href: "/council",
      label: isZh ? "专员议会" : "Agent Council",
      icon: "users",
      description: isZh
        ? "配置智能体 — 模型选择、系统提示词、深度推理及执行官人设声音。"
        : "Configure the agents — models, system prompts, deep-reasoning, and the Executive voice persona.",
    },
    {
      href: "/audit",
      label: isZh ? "审计日志" : "Audit log",
      icon: "doc-search",
      description: isZh
        ? "可检索的事件日志 — 记录每一次对话轮次、专员咨询、工具调用与定时任务。"
        : "Searchable event log of every chat turn, specialist consult, tool call, and scheduled action.",
    },
    {
      href: "/audit/usage",
      label: isZh ? "Token消耗" : "Token usage",
      icon: "activity",
      description: isZh
        ? "全会话的聚合 Token 用量与成本统计 — 按天、按模型和总额。"
        : "Aggregate token usage and cost across all sessions — totals, by day, and by model.",
    },
    {
      href: "/guide",
      label: isZh ? "使用指南" : "User Guide",
      icon: "info",
      description: isZh
        ? "系统功能全景操作手册 — 各模块介绍与最佳实践指引。"
        : "Plain-language overviews of every feature — what each one is and what it does.",
    },
    {
      href: "/architecture",
      label: isZh ? "系统架构" : "Architecture",
      icon: "grid",
      description: isZh
        ? "交互式参考文档，阐释系统的底层架构与协同机制。"
        : "Interactive reference docs explaining how the system is built.",
    },
    {
      href: "/demo",
      label: isZh ? "企业模拟器" : "Company Simulator",
      icon: "cog",
      description: isZh
        ? "加载预置公司预设、对当前数据生成快照，或使用 AI 生成全新企业沙盒场景。"
        : "Load prebuilt company fixtures, snapshot your current data, or generate a new scenario with AI.",
    },
    {
      href: "/clients",
      label: isZh ? "客户企业" : "Client Companies",
      icon: "building",
      description: isZh
        ? "兼任高管多客户模式 — 在不同具名客户企业槽位之间无缝切换运行。"
        : "Multi-client mode for fractional work — switch the live company between named client slots.",
    },
  ];
}

export const ADVANCED_ITEMS: NavItem[] = getAdvancedItems("en");

export function getMobilePrimary(locale: NavLocale = "zh"): NavItem[] {
  const isZh = locale === "zh";
  return [
    { href: "/", label: isZh ? "今日简报" : "Briefing", icon: "clipboard", description: getBriefingDescription(locale) },
    getPulseNavItem(locale),
    { href: "/?new=1", label: isZh ? "新建对话" : "New chat", icon: "plus", description: getNewChatDescription(locale) },
    {
      href: "/people",
      label: isZh ? "组织成员" : "People",
      icon: "users",
      description: isZh
        ? "成员花名册 — 执行团队协同人员与各自治理审批权限范围。"
        : "Your roster — who the Executive coordinates with and their approval scopes.",
    },
    {
      href: "/jobs",
      label: isZh ? "任务流" : "Jobs",
      icon: "doc",
      description: isZh
        ? "产出关键成果的多步骤工作流 — 董事会准备、GTM计划与业务审查。"
        : "Multi-step workflows that produce a deliverable — board prep, GTM plans, reviews.",
    },
  ];
}

// Anchors the mobile bottom nav. ≤5 per Material guidance; "More" opens
// the drawer with the full menu. `/` lands on the briefing surface.
export const MOBILE_PRIMARY: NavItem[] = getMobilePrimary("en");
