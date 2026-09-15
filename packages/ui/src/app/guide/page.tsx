'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import DynamicSection from '@/components/architecture/DynamicSection';
import { useI18n } from '@/lib/i18n';

// The section nav is hardcoded so the sidebar renders instantly without
// waiting for the backend. IDs must match the GUIDE_SECTIONS registry in
// packages/core/openexecutive/guide/sections.py.
const RAW_SECTIONS = [
  {
    id: 'chat',
    en: { label: 'Chat & Briefing', sub: "The main surface — talk to the Executive, and land on a briefing of what's happened." },
    zh: { label: '对话与简报', sub: "核心交互界面 — 与 Executive 交流，并获取发生的关键业务简报。" },
  },
  {
    id: 'ask_oe',
    en: { label: 'Ask OE', sub: 'The page-aware assistant panel — explains any screen and fills forms for you to review.' },
    zh: { label: 'Ask OE', sub: '感知当前页面的智能侧边栏 — 解释任何屏幕并预填表单供您审核。' },
  },
  {
    id: 'today',
    en: { label: 'Today / Morning Brief', sub: 'What needs you right now: proposals, department health, and people with open items.' },
    zh: { label: '今日聚焦 / 晨间简报', sub: '急需您关注的事项：待办提案、部门健康度以及有未决事项的成员。' },
  },
  {
    id: 'pulse',
    en: { label: 'Pulse (Memory)', sub: "The Executive's running memory — decisions made, initiatives in flight, advice gathered." },
    zh: { label: '律动（记忆库）', sub: 'Executive 的持续记忆体系 — 沉淀的决策、进行中的举措与收集的建议。' },
  },
  {
    id: 'review',
    en: { label: 'Review Queue', sub: 'Approve, reject, or correct incoming knowledge before the Executive relies on it.' },
    zh: { label: '审核队列', sub: '在 Executive 正式采用新摄取的知识前，进行审批、驳回或修正。' },
  },
  {
    id: 'jobs',
    en: { label: 'Jobs (Workflows)', sub: 'Multi-step workflows that produce a deliverable — board prep, GTM plan, perf review.' },
    zh: { label: '工作流任务', sub: '产出可交付成果的多步骤业务工作流 — 董事会准备、GTM 方案、绩效评估。' },
  },
  {
    id: 'artifacts',
    en: { label: 'Artifacts', sub: 'Your library of finished documents — drafts and workflow outputs in one place.' },
    zh: { label: '成果物文档库', sub: '已完成的成果物资产库 — 草稿与工作流产出文档统一集中存放。' },
  },
  {
    id: 'watchlist',
    en: { label: 'Watch List', sub: 'External monitors — stock tickers, RSS feeds, status pages, web queries — that raise alerts.' },
    zh: { label: '监控清单', sub: '外部监控探针 — 股票行情、RSS 订阅、服务状态页、网络检索并触发预警。' },
  },
  {
    id: 'departments',
    en: { label: 'Departments', sub: 'Org units, each with goals, an authority level, and a specialist behind it.' },
    zh: { label: '业务部门', sub: '组织单元，各自拥有工作目标、授权级别和对应的专属领域专家。' },
  },
  {
    id: 'people',
    en: { label: 'People', sub: 'Your roster — who the Executive coordinates with, their SLAs, channels, and approval scopes.' },
    zh: { label: '团队成员', sub: '人员花名册 — Executive 协同的对象、SLA 响应指标、联络通道与审批范围。' },
  },
  {
    id: 'talent',
    en: { label: 'Talent', sub: 'Candidate searches and hiring — engagements, pipeline stages, scoring, and offers.' },
    zh: { label: '人才招聘', sub: '候选人寻访与招聘流程 — 招聘专项、漏斗阶段、综合评分与 Offer。' },
  },
  {
    id: 'staff_onboarding',
    en: { label: 'Staff onboarding', sub: 'Templated ramp-up plans for new hires — tasks, phases, check-ins, and welcome briefs.' },
    zh: { label: '新员工入职', sub: '新员工标准化入职培养方案 — 阶段任务、定期 Check-in 与迎新指引。' },
  },
  {
    id: 'company_profile',
    en: { label: 'Company Profile & Onboarding', sub: "Your company's identity and strategy — set up once, edited any time." },
    zh: { label: '公司画像与初始化', sub: '企业身份定位与核心发展战略 — 一次设定，随业务发展随时维护。' },
  },
  {
    id: 'knowledge',
    en: { label: 'Knowledge base', sub: 'Upload company documents so the Executive can ground its answers in your context.' },
    zh: { label: '企业知识库', sub: '上传企业内部文档，使 Executive 的回答紧密结合真实业务上下文。' },
  },
  {
    id: 'skills',
    en: { label: 'Skills', sub: 'Reusable how-to procedures the Executive can pull up — checklists, playbooks, templates.' },
    zh: { label: '技能库', sub: '可复用的标准作业程序 — 核对清单、实操指南与各类模板。' },
  },
  {
    id: 'council',
    en: { label: 'Agent Council', sub: "Configure the specialists — models, prompts, reasoning depth, and the Executive's voice." },
    zh: { label: '专家委员会', sub: '配置各领域智能体专家 — 选用模型、系统提示词、推理深度及语气风格。' },
  },
  {
    id: 'audit',
    en: { label: 'Audit Log', sub: 'A searchable record of every turn, consult, tool call, alert, and scheduled action.' },
    zh: { label: '审计日志', sub: '支持检索的完整系统日志 — 记录每次交互、专家咨询、工具调用与定时操作。' },
  },
  {
    id: 'token_usage',
    en: { label: 'Token Usage', sub: 'Where your spend goes — tokens and cost by day, model, and session.' },
    zh: { label: 'Token 消耗与花费', sub: '追踪资金与 Token 消耗 — 按日期、模型和会话查看费用与用量明细。' },
  },
  {
    id: 'simulator',
    en: { label: 'Company Simulator', sub: 'Load a realistic test company to try the Executive before trusting it with real data.' },
    zh: { label: '模拟企业演练', sub: '载入逼真的仿真企业数据，在托付真实生产数据前完整演练 Executive。' },
  },
  {
    id: 'clients',
    en: { label: 'Client Companies', sub: 'Multi-client mode for fractional work — switch the live company between named client slots.' },
    zh: { label: '多客户公司', sub: '兼职/顾问模式多租户支持 — 在各个已配置的客户公司席位间随时切换。' },
  },
  {
    id: 'integrations',
    en: { label: 'Integrations', sub: 'Reach the Executive where you already work — Slack, Discord, Telegram, email, Google Chat, MCP.' },
    zh: { label: '第三方平台集成', sub: '在日常办公通讯工具中连接 Executive — Slack、Discord、Telegram、邮件、Google Chat、MCP。' },
  },
  {
    id: 'settings',
    en: { label: 'Settings & Advanced', sub: 'The hub for power-user tools that sit outside the day-to-day nav — including this guide.' },
    zh: { label: '设置与高级功能', sub: '日常常规导航之外的高级配置与管理工具中心 — 包括本指南。' },
  },
];

interface SectionMeta {
  id: string;
  fresh: boolean;
  generated_at: string | null;
}

export default function GuidePage() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  const sections = useMemo(() => {
    return RAW_SECTIONS.map((s) => ({
      id: s.id,
      label: isZh ? s.zh.label : s.en.label,
      sub: isZh ? s.zh.sub : s.en.sub,
    }));
  }, [isZh]);

  const [activeSection, setActiveSection] = useState('chat');
  const [sectionMeta, setSectionMeta] = useState<Record<string, SectionMeta>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Single cheap listing call — no generation triggered.
  useEffect(() => {
    fetch('/api/backend/guide/sections')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { sections: SectionMeta[] }) => {
        const map: Record<string, SectionMeta> = {};
        for (const s of data.sections) map[s.id] = s;
        setSectionMeta(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActiveSection(e.target.id);
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );
    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, [sections]);

  const freshCount = Object.values(sectionMeta).filter((s) => s.fresh).length;
  const totalCount = sections.length;

  return (
    <div className="flex flex-1 min-h-0 bg-surface text-fg overflow-hidden">
      <aside className="w-52 flex-shrink-0 border-r border-line flex flex-col bg-surface-elevated">
        <div className="px-3 py-4">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle mb-2">
            {isZh ? "用户指南" : "User Guide"}
          </p>
          <nav className="space-y-0.5">
            {sections.map(({ id, label }) => {
              const meta = sectionMeta[id];
              const dotColor = meta?.fresh ? 'bg-emerald-500/60' : 'bg-surface-input';
              return (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                    activeSection === id
                      ? 'bg-indigo-500/10 text-indigo-400'
                      : 'text-fg-muted hover:text-fg hover:bg-surface-overlay/60'
                  }`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`} />
                  <span>{label}</span>
                </a>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto px-4 py-4 border-t border-line space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-subtle mb-2">
            {isZh ? "概览指标" : "Reference"}
          </p>
          <div className="flex justify-between text-xs">
            <span className="text-fg-subtle">{isZh ? "功能模块" : "Features"}</span>
            <span className="text-fg-muted font-mono">{freshCount} / {totalCount}</span>
          </div>
          <p className="text-[10px] text-fg-subtle leading-relaxed">
            {isZh
              ? "简要概述每项功能是什么及其业务价值。如需查看系统底层架构，请参阅“架构参考”。"
              : "Plain-language overviews of what each feature is and what it does. For how the system is built, see the Architecture reference."}
          </p>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-10 space-y-20">
          <div>
            <h1 className="text-2xl font-bold text-fg">
              {isZh ? "Open Executive — 用户指南" : "Open Executive — User Guide"}
            </h1>
            <p className="mt-2 text-sm text-fg-muted">
              {isZh
                ? "全面速览各项功能：它是什么，能为您做什么。这不是冗长的技术手册 —— 只需片刻即可了解各项功能的使用定位。如需了解技术实现细节，请参阅“架构参考”。"
                : "A quick tour of every feature: what it is, and what it does for you. Not a manual — just enough to know where to go and why. For the technical internals, see the Architecture reference."}
            </p>
          </div>

          {sections.map(({ id, label, sub }) => (
            <DynamicSection key={id} id={id} title={label} sub={sub} basePath="guide" />
          ))}
        </div>
      </main>
    </div>
  );
}
