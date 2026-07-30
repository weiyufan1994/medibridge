import type { LocalizedText } from "@shared/types";
import { getAdminText, type AdminLang } from "@/features/admin/copy";

export type AdminConsoleSectionKey =
  | "overview"
  | "appointments"
  | "referrals"
  | "users"
  | "operations";

type AdminConsoleSectionConfig = {
  navLabel: LocalizedText;
  navDescription: LocalizedText;
  title: LocalizedText;
  description: LocalizedText;
  summary: readonly LocalizedText[];
};

const CONSOLE_CHROME_COPY = {
  navigationEyebrow: {
    zh: "后台导航",
    en: "Admin navigation",
  },
  navigationDescription: {
    zh: "按模块切换工作区，保留更多垂直空间给实际操作内容。",
    en: "Switch between admin modules while keeping more vertical room for the workspace itself.",
  },
} as const;

const SECTION_COPY: Record<AdminConsoleSectionKey, AdminConsoleSectionConfig> = {
  overview: {
    navLabel: { zh: "总览", en: "Overview" },
    navDescription: { zh: "风险、分诊与近期动态", en: "Risk, triage, and recent activity" },
    title: {
      zh: "集中查看需要优先处理的后台动态",
      en: "Review the admin activity that needs attention first",
    },
    description: {
      zh: "汇总风险预约、分诊会话和异常事件，帮助你先抓住最重要的变化。",
      en: "Track risky appointments, triage sessions, and abnormal events in one place so the highest-priority changes surface first.",
    },
    summary: [
      { zh: "风险动态", en: "Risk activity" },
      { zh: "分诊会话", en: "Triage sessions" },
      { zh: "异常事件", en: "Event monitoring" },
    ],
  },
  appointments: {
    navLabel: { zh: "预约工作台", en: "Appointments" },
    navDescription: { zh: "筛选、批量操作与详情处理", en: "Filtering, batch actions, and case detail" },
    title: {
      zh: "处理预约筛选、批量操作与单条详情",
      en: "Work through appointment filters, batch actions, and case detail",
    },
    description: {
      zh: "在同一工作区内查看预约列表、筛选条件与操作详情，不改变原有处理流程。",
      en: "Keep the existing appointment list, filters, and action detail in one workspace without changing the underlying workflow.",
    },
    summary: [
      { zh: "筛选视图", en: "Filtered views" },
      { zh: "批量操作", en: "Batch actions" },
      { zh: "详情面板", en: "Detail panel" },
    ],
  },
  referrals: {
    navLabel: { zh: "转诊工作台", en: "Referrals" },
    navDescription: { zh: "订单分配、跟进与目录维护", en: "Assignment, follow-up, and catalog upkeep" },
    title: {
      zh: "聚焦转诊订单处理与状态推进",
      en: "Focus on referral order handling and status progression",
    },
    description: {
      zh: "保留现有转诊工作台功能，把主要空间留给订单列表、详情和状态操作。",
      en: "Keep the existing referral workspace behavior intact while giving more room to the order list, detail, and status actions.",
    },
    summary: [
      { zh: "订单处理", en: "Order handling" },
      { zh: "状态更新", en: "Status updates" },
      { zh: "目录维护", en: "Catalog upkeep" },
    ],
  },
  users: {
    navLabel: { zh: "用户与权限", en: "Users & Roles" },
    navDescription: { zh: "角色分配与账号访问控制", en: "Role assignment and access control" },
    title: {
      zh: "管理后台账号角色与访问权限",
      en: "Manage admin account roles and access",
    },
    description: {
      zh: "快速搜索用户、查看当前角色，并在现有权限边界内完成角色调整。",
      en: "Search accounts, inspect current roles, and make role changes within the existing permission boundaries.",
    },
    summary: [
      { zh: "角色分配", en: "Role assignment" },
      { zh: "访问控制", en: "Access control" },
      { zh: "账号检索", en: "Account search" },
    ],
  },
  operations: {
    navLabel: { zh: "运营工具", en: "Operations" },
    navDescription: { zh: "审计、导出与运营维护工具", en: "Audits, exports, and operational tools" },
    title: {
      zh: "集中处理后台审计与运营维护动作",
      en: "Handle audits and operational maintenance from one place",
    },
    description: {
      zh: "将审计日志、导出中心和后台维护工具放在统一区域，减少切换成本。",
      en: "Keep audit logs, export workflows, and operational maintenance tools in one focused workspace.",
    },
    summary: [
      { zh: "审计日志", en: "Audit logs" },
      { zh: "导出中心", en: "Export center" },
      { zh: "维护工具", en: "Maintenance tools" },
    ],
  },
};

const FIELD_LABELS = {
  email: { zh: "邮箱", en: "Email" },
  appointment: { zh: "预约", en: "Appointment" },
  status: { zh: "状态", en: "Status" },
  payment: { zh: "支付", en: "Payment" },
  doctor: { zh: "医生", en: "Doctor" },
  risk: { zh: "风险", en: "Risk" },
  riskFlagged: { zh: "仅高风险", en: "Flagged only" },
  riskClear: { zh: "无风险", en: "Clear only" },
  search: { zh: "搜索", en: "Search" },
  operator: { zh: "操作人", en: "Operator" },
  action: { zh: "动作", en: "Action" },
  from: { zh: "开始", en: "From" },
  to: { zh: "结束", en: "To" },
} as const;

export type AdminConsoleFieldLabelKey = keyof typeof FIELD_LABELS;

export function getAdminConsoleChromeCopy(lang: AdminLang) {
  return {
    navigationEyebrow: getAdminText(lang, CONSOLE_CHROME_COPY.navigationEyebrow),
    navigationDescription: getAdminText(lang, CONSOLE_CHROME_COPY.navigationDescription),
  };
}

export function getAdminConsoleFieldLabel(
  key: AdminConsoleFieldLabelKey,
  lang: AdminLang
) {
  return getAdminText(lang, FIELD_LABELS[key]);
}

export function getAdminConsoleSectionCopy(
  section: AdminConsoleSectionKey,
  lang: AdminLang
) {
  const copy = SECTION_COPY[section];

  return {
    navLabel: getAdminText(lang, copy.navLabel),
    navDescription: getAdminText(lang, copy.navDescription),
    title: getAdminText(lang, copy.title),
    description: getAdminText(lang, copy.description),
    summary: copy.summary.map(item => getAdminText(lang, item)),
  };
}
