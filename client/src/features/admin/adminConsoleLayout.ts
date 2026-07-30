import type { LocalizedText } from "@shared/types";
import { getAdminText, type AdminLang } from "@/features/admin/copy";

export type AdminConsoleSectionKey =
  | "overview"
  | "appointments"
  | "referrals"
  | "directory"
  | "users"
  | "operations";

export type AdminConsoleRole = "admin" | "ops" | string | null | undefined;

export type AdminConsoleModuleTabKey =
  | "directoryCatalog"
  | "directoryMedia"
  | "userRoles"
  | "doctorAccounts"
  | "operationAudit"
  | "operationMonitoring"
  | "operationExports"
  | "operationScheduling"
  | "operationRetention";

export type AdminOperationsTabKey =
  | "audit"
  | "monitoring"
  | "exports"
  | "scheduling"
  | "retention";

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
  collapseNavigation: {
    zh: "收起导航",
    en: "Collapse navigation",
  },
  expandNavigation: {
    zh: "展开导航",
    en: "Expand navigation",
  },
} as const;

const SECTION_COPY: Record<AdminConsoleSectionKey, AdminConsoleSectionConfig> =
  {
    overview: {
      navLabel: { zh: "总览", en: "Overview" },
      navDescription: {
        zh: "风险预约与待办队列",
        en: "Risk appointments and action queue",
      },
      title: {
        zh: "集中查看需要优先处理的后台动态",
        en: "Review the admin activity that needs attention first",
      },
      description: {
        zh: "汇总今日预约、风险预约、待分配转诊与退款审核，帮助你先处理最紧迫的任务。",
        en: "Track today's appointments, risky bookings, unassigned referrals, and refund reviews so urgent tasks surface first.",
      },
      summary: [
        { zh: "风险预约", en: "Risk appointments" },
        { zh: "待分配转诊", en: "Unassigned referrals" },
        { zh: "退款审核", en: "Refund reviews" },
      ],
    },
    appointments: {
      navLabel: { zh: "预约工作台", en: "Appointments" },
      navDescription: {
        zh: "筛选、批量操作与详情处理",
        en: "Filtering, batch actions, and case detail",
      },
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
      navDescription: {
        zh: "订单分配、跟进与排期",
        en: "Assignment, follow-up, and scheduling",
      },
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
        { zh: "排期协调", en: "Scheduling coordination" },
      ],
    },
    directory: {
      navLabel: { zh: "医院与目录", en: "Directory" },
      navDescription: {
        zh: "医院、联系人与媒体维护",
        en: "Hospitals, contacts, and media",
      },
      title: {
        zh: "医院与目录",
        en: "Hospital directory",
      },
      description: {
        zh: "维护转诊医院、联系人及医院媒体资源。",
        en: "Maintain referral hospitals, contacts, and hospital media.",
      },
      summary: [
        { zh: "医院目录", en: "Hospital directory" },
        { zh: "转诊联系人", en: "Referral contacts" },
        { zh: "医院媒体", en: "Hospital media" },
      ],
    },
    users: {
      navLabel: { zh: "用户与权限", en: "Users & Roles" },
      navDescription: {
        zh: "角色分配与账号访问控制",
        en: "Role assignment and access control",
      },
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
      navDescription: {
        zh: "审计、导出与运营维护工具",
        en: "Audits, exports, and operational tools",
      },
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

const MODULE_TAB_COPY: Record<AdminConsoleModuleTabKey, LocalizedText> = {
  directoryCatalog: {
    zh: "医院与联系人",
    en: "Hospitals & contacts",
  },
  directoryMedia: { zh: "医院媒体", en: "Hospital media" },
  userRoles: { zh: "用户角色", en: "User roles" },
  doctorAccounts: { zh: "医生账号", en: "Doctor accounts" },
  operationAudit: { zh: "操作审计", en: "Audit" },
  operationMonitoring: { zh: "分诊监控", en: "Monitoring" },
  operationExports: { zh: "数据导出", en: "Exports" },
  operationScheduling: { zh: "排班管理", en: "Scheduling" },
  operationRetention: { zh: "数据保留", en: "Retention" },
};

const SECTION_ORDER: readonly AdminConsoleSectionKey[] = [
  "overview",
  "appointments",
  "referrals",
  "directory",
  "users",
  "operations",
];

export type AdminConsoleFieldLabelKey = keyof typeof FIELD_LABELS;

export function getVisibleAdminConsoleSections(
  role: AdminConsoleRole
): AdminConsoleSectionKey[] {
  if (role === "admin") {
    return [...SECTION_ORDER];
  }
  if (role === "ops") {
    return SECTION_ORDER.filter(section => section !== "users");
  }
  return [];
}

export function getAdminConsoleChromeCopy(lang: AdminLang) {
  return {
    navigationEyebrow: getAdminText(
      lang,
      CONSOLE_CHROME_COPY.navigationEyebrow
    ),
    navigationDescription: getAdminText(
      lang,
      CONSOLE_CHROME_COPY.navigationDescription
    ),
    collapseNavigation: getAdminText(
      lang,
      CONSOLE_CHROME_COPY.collapseNavigation
    ),
    expandNavigation: getAdminText(lang, CONSOLE_CHROME_COPY.expandNavigation),
  };
}

export function getAdminConsoleFieldLabel(
  key: AdminConsoleFieldLabelKey,
  lang: AdminLang
) {
  return getAdminText(lang, FIELD_LABELS[key]);
}

export function getAdminConsoleModuleTabLabel(
  key: AdminConsoleModuleTabKey,
  lang: AdminLang
) {
  return getAdminText(lang, MODULE_TAB_COPY[key]);
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
