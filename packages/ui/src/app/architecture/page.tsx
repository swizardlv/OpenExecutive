'use client';

import { useEffect, useRef, useState } from 'react';

import DynamicSection from '@/components/architecture/DynamicSection';
import { useI18n } from '@/lib/i18n';

// The section nav is hardcoded so the sidebar renders instantly without
// waiting for the backend. IDs must match the SECTIONS registry in
// packages/core/openexecutive/architecture/sections.py.
const SECTIONS = [
  // "Without the Jargon" — plain-language landing cluster for non-engineers.
  {
    id: 'nojargon_what_it_is',
    label: 'Without the Jargon: What It Is',
    labelZh: '通俗解读：它是什么',
    sub: 'The 90-second version. A virtual executive with a council of specialists.',
    subZh: '90 秒速览。拥有专家专员委员会的虚拟高管。',
  },
  {
    id: 'nojargon_authority',
    label: 'Without the Jargon: How It Decides To Act',
    labelZh: '通俗解读：如何自主决策行动',
    sub: 'Three modes — act on its own, propose for approval, or escalate to you.',
    subZh: '三种模式 — 自主行动、提请审批或升级呈报。',
  },
  {
    id: 'nojargon_proactive',
    label: "Without the Jargon: When You're Not Watching",
    labelZh: '通俗解读：当你未关注时',
    sub: "Morning brief, check-ins, nudges — Open Executive doesn't wait to be asked.",
    subZh: '早报、日常巡检与主动提醒 — Open Executive 无需指令即主动推进。',
  },
  {
    id: 'nojargon_org',
    label: 'Without the Jargon: Who Approves What',
    labelZh: '通俗解读：谁审批什么',
    sub: 'Departments, heads, and approval tags — how proposals find the right person.',
    subZh: '部门、负责人与审批标签 — 提案如何精准路由至决策人。',
  },
  {
    id: 'overview',
    label: 'System Overview',
    labelZh: '系统全貌',
    sub: 'High-level topology: clients, API, orchestrator, specialist agents, knowledge layer.',
    subZh: '总体拓扑：客户端、API、编排器、专员智能体与知识库层。',
  },
  {
    id: 'lifecycle',
    label: 'Request Lifecycle',
    labelZh: '请求生命周期',
    sub: 'Full round-trip of a single chat message, including tool-use loop and parallel specialist calls.',
    subZh: '单条对话消息的完整生命周期，包含工具调用循环与并发专员咨询。',
  },
  {
    id: 'agents',
    label: 'Agent Council',
    labelZh: '专员委员会',
    sub: 'The Executive orchestrator and its specialist sub-agents — roles, models, and domains.',
    subZh: 'Executive 核心编排器及其各领域专员智能体 — 角色、模型与业务领域。',
  },
  {
    id: 'caching',
    label: 'Prompt Caching',
    labelZh: '提示词缓存机制',
    sub: 'How the system prompt is partitioned for Anthropic prompt caching, and what breaks the cache.',
    subZh: '系统提示词如何切片以命中 Anthropic 提示词缓存，以及何时会导致缓存失效。',
  },
  {
    id: 'rag',
    label: 'Knowledge & RAG',
    labelZh: '知识检索与 RAG',
    sub: 'ChromaDB collections, per-specialist domain filtering, and where retrieved context is injected.',
    subZh: 'ChromaDB 知识集合、各专员领域过滤及检索上下文的注入位置。',
  },
  {
    id: 'review',
    label: 'SME Knowledge Review',
    labelZh: '专家知识评审',
    sub: 'The pending-review queue, priority ordering, and how rejected/approved items affect retrieval.',
    subZh: '待评审队列、优先级排序以及采纳/驳回如何影响后续知识检索。',
  },
  {
    id: 'memory',
    label: 'Memory System',
    labelZh: '记忆系统',
    sub: 'Episodic SQLite memory (decisions, initiatives, advice, scheduled actions) and how it’s surfaced.',
    subZh: '情境化 SQLite 记忆库（决策、倡议、建议、定时任务）及其召回呈现机制。',
  },
  {
    id: 'peer_memory',
    label: 'Peer Memory (Person + Department)',
    labelZh: '协同记忆（人员与部门）',
    sub: 'External peer-keyed memory. Per-person scope keyed by Person.id for cross-channel continuity, and per-department scope keyed by department_<slug> for institutional voice.',
    subZh: '跨人员与部门的外部协同记忆：按 Person.id 保持跨渠道连续性，按部门 slug 沉淀组织制度语调。',
  },
  {
    id: 'org',
    label: 'Org Structure',
    labelZh: '组织架构',
    sub: 'Departments, goals, checklists, cadences; people registry; authority gates and channel resolution (Discord/Telegram/email).',
    subZh: '部门、目标、清单、节奏周期；人员花名册；权限门控与多渠道解析。',
  },
  {
    id: 'audit',
    label: 'Audit Log',
    labelZh: '审计日志',
    sub: 'Searchable, append-only record of chat turns, specialist consults, tool calls, scheduled actions, alerts, and inbound integrations.',
    subZh: '只增不可篡改的操作审计记录：对话轮次、专员咨询、工具调用、定时任务、告警与外部入站。',
  },
  {
    id: 'schemas',
    label: 'Data Schemas',
    labelZh: '数据模型与架构',
    sub: 'Key Pydantic models and database tables — the shape of the data flowing through the system.',
    subZh: '核心 Pydantic 模型与数据库表结构 — 贯穿整个系统的数据形态。',
  },
  {
    id: 'workflows',
    label: 'Workflows',
    labelZh: '工作流引擎',
    sub: 'Deterministic, multi-step orchestrations that produce structured artifacts, including the wait-for-human pause primitive.',
    subZh: '确定性多步编排引擎，生成结构化产物，支持等待人类审批暂停原语。',
  },
  {
    id: 'scheduler',
    label: 'Scheduler & Cadences',
    labelZh: '调度器与节奏周期',
    sub: 'The async scheduler runner, cadence DSL, scheduled_actions, and proactive nudges through the user’s last-used channel.',
    subZh: '异步调度执行器、节奏 DSL、定时任务以及通过用户最近活跃渠道的主动提醒。',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    labelZh: '外部集成',
    sub: 'External channels (Slack, Discord, email, Telegram, Google Chat, MCP gateway), attachments, and how they connect.',
    subZh: '外部渠道接入（Slack、Discord、邮件、Telegram、Google Chat、MCP 网关）及附件处理。',
  },
  {
    id: 'external_monitoring',
    label: 'External Monitoring',
    labelZh: '外部信号监控',
    sub: 'Polls the watchlist (vendor status pages, RSS / Atom feeds, stock tickers) and routes qualifying signals through the same alert pipeline as inbound email / Slack.',
    subZh: '轮询监控列表（供应商状态页、RSS/Atom 订阅源、股票行情），将有效信号路由至告警管线。',
  },
  {
    id: 'today',
    label: 'Today / Morning Brief',
    labelZh: '今日事报 / 晨会简报',
    sub: 'The /today route — per-department goal health, a roster with awaiting-action counts, and proposals routed to a person.',
    subZh: '/today 页面 — 各部门目标健康度、待办人员花名册与定向审批提案。',
  },
  {
    id: 'api',
    label: 'API Reference',
    labelZh: 'API 接口参考',
    sub: 'The FastAPI HTTP surface — endpoints grouped by router.',
    subZh: 'FastAPI HTTP 接口表面 — 按路由器分组的接口规范。',
  },
  {
    id: 'mcp_server',
    label: 'MCP Server',
    labelZh: 'MCP 服务端',
    sub: 'Open Executive exposed as an MCP server — company context as resources and the specialist council as tools, over Streamable-HTTP at /mcp for external agents.',
    subZh: '作为标准 MCP 服务端暴露 — 将公司上下文作为资源、专员委员会作为工具供外部智能体调用。',
  },
  {
    id: 'user_guide',
    label: 'User Guide Surface',
    labelZh: '用户使用指南',
    sub: "The /guide page — plain-language, per-feature overviews served from static prebuilt JSON, sharing this page's loader and renderer but separate from this technical reference.",
    subZh: '/guide 页面 — 面向业务用户的通俗功能概览，与本技术参考独立。',
  },
  {
    id: 'talent',
    label: 'Talent / Executive Search',
    labelZh: '人才招聘与猎头寻访',
    sub: 'The in-house hiring vertical: engagements (searches), candidates, the ChromaDB matching graph, and the draft-and-approve recruiting workflows.',
    subZh: '自建招聘猎头业务线：寻访项目、候选人画像、ChromaDB 匹配图谱与审批招募流。',
  },
  {
    id: 'staff_onboarding',
    label: 'Staff Onboarding',
    labelZh: '员工入职引导',
    sub: 'Role-tailored onboarding for new hires: reusable templates, per-hire plans with phased task checklists, the role_onboarding brief workflow, a bounded ramp drip, and chat + /today integration.',
    subZh: '面向新员工的量身定制入职方案：可复用模板、分阶段任务清单与渐进式赋能推送。',
  },
  {
    id: 'clients',
    label: 'Client Companies (Slots)',
    labelZh: '客户公司（多租户槽位）',
    sub: 'Multi-client mode for fractional executives: named save files of the full company context, one active at a time, with save-back switching and per-client MCP tool configs.',
    subZh: '面向兼职高管的多客户模式：命名保存完整公司上下文存档，快速切换且独立配置 MCP 工具。',
  },
];

interface SectionMeta {
  id: string;
  fresh: boolean;
  generated_at: string | null;
}

function DiagramLegend() {
  const { t } = useI18n();
  const items: { label: string; color: string; border: string }[] = [
    { label: t('architecture.legend.entry_client'), color: '#1e3a8a', border: '#60a5fa' },
    { label: t('architecture.legend.compute_agent'), color: '#312e81', border: '#a5b4fc' },
    { label: t('architecture.legend.storage'), color: '#365314', border: '#a3e635' },
    { label: t('architecture.legend.cached'), color: '#713f12', border: '#facc15' },
    { label: t('architecture.legend.external'), color: '#3f3f46', border: '#a1a1aa' },
    { label: t('architecture.legend.hot_not_cached'), color: '#7f1d1d', border: '#fca5a5' },
  ];
  return (
    <div className="rounded-lg bg-surface border border-line px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle mb-2">
        {t("architecture.page.diagram_legend")}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: it.color, border: `1.5px solid ${it.border}` }}
            />
            <span className="text-fg-muted">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ArchitecturePage() {
  const { locale, t } = useI18n();
  const [activeSection, setActiveSection] = useState('overview');
  const [sectionMeta, setSectionMeta] = useState<Record<string, SectionMeta>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Single cheap listing call — no generation triggered.
  useEffect(() => {
    fetch(`/api/backend/architecture/sections?locale=${encodeURIComponent(locale)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { sections: SectionMeta[] }) => {
        const map: Record<string, SectionMeta> = {};
        for (const s of data.sections) map[s.id] = s;
        setSectionMeta(map);
      })
      .catch(() => {});
  }, [locale]);

  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActiveSection(e.target.id);
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const freshCount = Object.values(sectionMeta).filter((s) => s.fresh).length;
  const totalCount = SECTIONS.length;

  return (
    <div className="flex flex-1 min-h-0 bg-surface text-fg overflow-hidden">
      <aside className="w-52 flex-shrink-0 border-r border-line flex flex-col bg-surface-elevated">
        <div className="px-3 py-4">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle mb-2">
            {t("architecture.page.architecture")}
          </p>
          <nav className="space-y-0.5">
            {SECTIONS.map((sec) => {
              const meta = sectionMeta[sec.id];
              // Content ships with the image, so a section is either
              // present (green) or, if a file is somehow missing, absent (grey).
              const dotColor = meta?.fresh ? 'bg-emerald-500/60' : 'bg-surface-input';
              return (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    activeSection === sec.id
                      ? 'bg-indigo-500/10 text-indigo-400'
                      : 'text-fg-muted hover:text-fg hover:bg-surface-overlay/60'
                  }`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`} />
                  <span className="truncate">{t(`architecture.section.${sec.id}.label`)}</span>
                </a>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto px-4 py-4 border-t border-line space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle mb-2">
            {t("architecture.page.reference")}
          </p>
          <div className="flex justify-between text-xs">
            <span className="text-fg-subtle">{t("architecture.page.sections")}</span>
            <span className="text-fg-muted font-mono">{freshCount} / {totalCount}</span>
          </div>
          <p className="text-[10px] text-fg-subtle leading-relaxed">
            {t("architecture.page.a_map_of_how_the")}
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-10 space-y-20">
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-fg">
                {t("architecture.page.open_executive_architecture")}
              </h1>
              <p className="mt-2 text-sm text-fg-muted">
                {t("architecture.page.a_reference_map_of_how")}
              </p>
            </div>
            <DiagramLegend />
          </div>

          {SECTIONS.map((sec) => (
            <DynamicSection
              key={sec.id}
              id={sec.id}
              title={t(`architecture.section.${sec.id}.label`)}
              sub={t(`architecture.section.${sec.id}.sub`)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
