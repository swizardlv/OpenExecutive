// Bilingual localization dictionary and helpers for Executive Jobs / Workflows

export interface WorkflowTranslation {
  title: string;
  description: string;
}

export const WORKFLOW_TRANSLATIONS: Record<string, WorkflowTranslation> = {
  annual_plan: {
    title: "年度运营计划",
    description: "结合过往经营成果与各部门现状，制定下一年度的目标、战略支柱、核心指标与资源规划。",
  },
  department_check_in: {
    title: "部门例行检视",
    description: "根据各部门节奏进行例行复盘，检视部门目标推进状态与关键阻碍。",
  },
  board_prep: {
    title: "董事会汇报材料",
    description: "起草完整的董事会汇报包，涵盖经营大盘、亮点成就、痛点挑战与关键议题备忘录。",
  },
  candidate_outreach: {
    title: "候选人外联话术序列",
    description: "根据高管岗位画像生成定制化的候选人主动触达邮件与多轮跟进序列。",
  },
  candidate_screen: {
    title: "候选人初筛评估",
    description: "对比候选人简历履历与岗位胜任力模型，生成客观初筛评分与评估问卷。",
  },
  churn_deep_dive: {
    title: "客户流失专题剖析",
    description: "针对近期流失客户与缩容账户进行归因分析，诊断核心流失原因并制定挽留策略。",
  },
  comp_refresh: {
    title: "薪酬结构调整与激励",
    description: "结合市场对标数据与团队绩效，起草团队薪酬调优与期权激励方案。",
  },
  competitive_teardown: {
    title: "竞品深度拆解分析",
    description: "对竞争对手的新动作、商业模式、定价变动进行全面对比与策略反制拆解。",
  },
  crisis_comms: {
    title: "危机公关响应方案",
    description: "针对突发公关事件起草危机应对预案、对外媒体通稿、客户告知函及发言人 Q&A。",
  },
  morning_brief: {
    title: "早间高管简报",
    description: "汇总过去24小时全公司各业务线最新变化、关键预警与今日核心待办。",
  },
  end_of_day_digest: {
    title: "日终工作汇总",
    description: "汇总当天各部门工作进展、决策落地情况与明日重点跟进事项。",
  },
  executive_reflection: {
    title: "高管复盘反思",
    description: "系统对组织协同效率、跨部门摩擦与决策执行闭环进行自主反思复盘。",
  },
  exec_search_brief: {
    title: "高管招聘需求简报",
    description: "提炼核心高管职位的招聘职责、期望画像、薪酬范围与关键寻访渠道。",
  },
  fundraising_prep: {
    title: "股权融资筹备",
    description: "起草融资 Pitch Deck 框架、财务关键指标提炼、投资人常见问答及尽调清单。",
  },
  gtm_launch: {
    title: "市场发布计划 (GTM)",
    description: "规划新产品或重大功能发布的跨部门协同时间线、营销推广渠道与增长目标。",
  },
  interview_coordination: {
    title: "面试安排与指引",
    description: "为各轮面试官生成结构化面试提纲、考察重点关注项与评分表。",
  },
  engagement_value_report: {
    title: "业务合作交付价值报告",
    description: "从数据库中抓取本期关键决策、倡议推动、告警处置等客观交付成果，生成客户续约价值报告。",
  },
  investor_update: {
    title: "月度投资人通报",
    description: "结构化汇总月度核心指标、业务亮点、面临挑战与需要投资人协助的诉求 (Asks)。",
  },
  ma_evaluation: {
    title: "收并购标的评估",
    description: "评估潜在并购标的的战略契合度、协同效应、估值区间与整合风险。",
  },
  mbr: {
    title: "月度业务经营检视 (MBR)",
    description: "全方位检视各部门月度 KPI 达成情况、经营收支、异常归因与下月攻坚重点。",
  },
  offer_approval: {
    title: "Offer 方案与审批",
    description: "起草完整的薪酬 Package 提案，提交招聘决策人审批并起草正式聘用意向函。",
  },
  new_hire_onboarding: {
    title: "新人入职引导 (30/60/90天)",
    description: "为新入职员工生成岗位 30/60/90 天目标规划、导师对接清单与首月里程碑。",
  },
  org_design: {
    title: "组织架构设计与评审",
    description: "评估当前组织层级架构，设计组织变动方案、权责划分与汇报线调整。",
  },
  performance_review: {
    title: "绩效考核评估筹备",
    description: "起草员工绩效评估包，结合日常工作产出与 OKR 完成度生成客观绩效草稿。",
  },
  pricing_review: {
    title: "产品定价与包装方案",
    description: "基于客户支付意愿、成本结构与市场竞品，设计或调整产品定价梯度与打包方案。",
  },
  product_strategy: {
    title: "产品战略备忘录",
    description: "明确产品中长期愿景、核心差异化价值、技术路线图及优先级权衡。",
  },
  quarterly_plan: {
    title: "季度运营计划",
    description: "承接年度战略拆解季度重点战役，制定各部门关键结果与资源分配。",
  },
  reference_check: {
    title: "背景调查与背调汇总",
    description: "汇总推荐人访谈记录，核实候选人既往业绩真实性、团队协作与领导风格。",
  },
  risk_register: {
    title: "年度企业风险登记表",
    description: "梳理企业在战略、合规、财务、安全等维度的潜在风险敞口与应对缓解措施。",
  },
  role_onboarding: {
    title: "岗位就职引导",
    description: "帮助新晋主管或新转岗人员快速熟悉部门职责、制度知识与核心利益相关方。",
  },
  executive_research: {
    title: "深度前瞻专题研究",
    description: "驱动多专业专家与联网检索，针对特定行业趋势、技术变革或政策展开深度调研。",
  },
};

export const STANDARD_FIELD_LABELS_ZH: Record<string, string> = {
  headline_metrics: "核心指标数据",
  wins: "阶段成果与业务亮点",
  challenges: "当前挑战与瓶颈痛点",
  deep_dive_topic_1: "深度研讨专题一",
  deep_dive_topic_2: "深度研讨专题二",
  decisions_needed: "需要决议的事项",
  description: "描述说明",
  context: "背景信息与上下文",
  notes: "备注说明",
  summary: "总结摘要",
  candidate_id: "候选人",
  engagement_id: "招聘岗位委托",
  role_title: "岗位名称",
  client_slug: "客户公司代码",
  period: "所属周期 / 阶段",
  department: "所属部门",
  quarter: "季度",
  year: "年份",
  target_company: "目标公司",
  competitor_name: "竞争对手名称",
  incident_description: "突发事件详情",
  event_summary: "事件概况",
  stakeholders: "利益相关方",
  candidate_name: "候选人姓名",
  reviewer_name: "评估人姓名",
  employee_name: "员工姓名",
  current_level: "当前职级",
  proposed_level: "调整后职级",
  evaluation_criteria: "评估标准",
  goals: "目标要求",
  instructions: "执行指示",
  topic: "主题",
  query: "检索关键词",
  title: "标题",
  name: "名称标识",
  focus_area: "核心关注领域",
  market: "目标市场",
  timeframe: "时间范围",
};

export function getWorkflowTitle(name: string, fallback: string, locale: string): string {
  if (locale === "zh" && WORKFLOW_TRANSLATIONS[name]) {
    return WORKFLOW_TRANSLATIONS[name].title;
  }
  return fallback;
}

export function getWorkflowDescription(name: string, fallback: string, locale: string): string {
  if (locale === "zh" && WORKFLOW_TRANSLATIONS[name]) {
    return WORKFLOW_TRANSLATIONS[name].description;
  }
  return fallback;
}

export function getWorkflowFieldLabel(fieldName: string, fallback: string, locale: string): string {
  if (locale === "zh" && STANDARD_FIELD_LABELS_ZH[fieldName]) {
    return STANDARD_FIELD_LABELS_ZH[fieldName];
  }
  return fallback;
}
