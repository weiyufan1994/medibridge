import type { LocalizedText } from "@shared/types";
import type {
  AdminAppointmentStatus,
  AdminPaymentStatus,
} from "@/features/admin/types";

export type AdminLang = "zh" | "en";

const ADMIN_USER_MANAGEMENT_COPY = {
  title: { zh: "用户与权限", en: "Users & Roles" },
  description: {
    zh: "查看正式用户，并在现有角色边界内调整访问权限。",
    en: "Review formal users and adjust access within the existing role model.",
  },
  searchPlaceholder: {
    zh: "按邮箱或姓名搜索",
    en: "Search by email or name",
  },
  refresh: { zh: "刷新", en: "Refresh" },
  readOnlyNotice: {
    zh: "只有 admin 可以调整用户权限。ops 可查看但不可修改。",
    en: "Only admin can change user roles. Ops may review but cannot edit.",
  },
  user: { zh: "用户", en: "User" },
  loginMethod: { zh: "登录方式", en: "Login method" },
  lastSignedIn: { zh: "最近登录", en: "Last signed in" },
  currentRole: { zh: "当前角色", en: "Current role" },
  action: { zh: "操作", en: "Action" },
  loading: { zh: "正在加载用户列表…", en: "Loading users…" },
  empty: { zh: "没有匹配的正式用户。", en: "No matching formal users found." },
  unnamed: { zh: "未命名用户", en: "Unnamed user" },
  createdAt: { zh: "创建于", en: "Created" },
  viewDetails: { zh: "查看详情", en: "View details" },
  detailTitle: { zh: "用户权限详情", en: "User access details" },
  detailDescription: {
    zh: "核对账号信息、当前角色和该角色对应的后台能力。",
    en: "Review account details, the current role, and its admin capabilities.",
  },
  identity: { zh: "账号信息", en: "Account" },
  capabilitySummary: { zh: "角色能力摘要", en: "Role capability summary" },
  roleAssignment: { zh: "角色分配", en: "Role assignment" },
  saveRole: { zh: "保存角色", en: "Save role" },
  noBackendAccess: {
    zh: "不具备管理后台访问权限。",
    en: "No access to the administration console.",
  },
  operationsAccess: {
    zh: "可处理预约、转诊、只读目录和运营工具；不能修改用户角色或目录数据。",
    en: "Can operate bookings, referrals, read-only directory views, and operations tools; cannot change user roles or directory data.",
  },
  adminAccess: {
    zh: "可访问全部后台模块，并在现有服务端权限范围内执行维护操作。",
    en: "Can access every admin module and perform maintenance allowed by existing server permissions.",
  },
} as const;

const ADMIN_OVERVIEW_COPY = {
  needsAttention: { zh: "需要处理", en: "Needs attention" },
  todayAppointments: { zh: "今日新增预约", en: "Appointments today" },
  riskAppointments: { zh: "风险预约", en: "At-risk appointments" },
  unassignedReferrals: { zh: "待分配转诊", en: "Unassigned referrals" },
  refundReviews: { zh: "待审核退款", en: "Refund reviews" },
  todayScope: { zh: "本地时区 · 今日", en: "Local time zone · today" },
  currentScope: { zh: "当前未解决记录", en: "Current unresolved records" },
  taskQueue: { zh: "优先任务队列", en: "Priority task queue" },
  taskQueueDescription: {
    zh: "仅展示来自现有业务查询、可以直接进入处理的记录。",
    en: "Only records backed by existing business queries and ready for action are shown.",
  },
  noTasks: {
    zh: "当前没有需要优先处理的记录。",
    en: "There are no priority records to handle right now.",
  },
  openAppointment: { zh: "处理预约", en: "Open appointment" },
  openReferral: { zh: "处理转诊", en: "Open referral" },
  riskReason: { zh: "预约存在风险信号", en: "Appointment has risk signals" },
  waitingAssignment: {
    zh: "已支付，等待内部接单",
    en: "Paid and waiting for assignment",
  },
  awaitingRefundReview: {
    zh: "退款申请等待审核",
    en: "Refund request awaiting review",
  },
  loading: { zh: "正在加载运营任务…", en: "Loading operational tasks…" },
  loadFailed: {
    zh: "无法加载部分运营任务。",
    en: "Some operational tasks could not be loaded.",
  },
  refresh: { zh: "刷新", en: "Refresh" },
} as const;

const ADMIN_CONFIRMATION_COPY = {
  common: {
    cancel: { zh: "取消", en: "Cancel" },
    continue: { zh: "继续", en: "Continue" },
    confirm: { zh: "确认", en: "Confirm" },
  },
  reinitiatePayment: {
    title: { zh: "重新发起支付？", en: "Re-initiate payment?" },
    description: {
      zh: "这会创建新的结账会话，并使旧访问链接失效。",
      en: "This creates a new checkout session and invalidates previous access links.",
    },
  },
  resendAccessLink: {
    title: { zh: "重发访问链接？", en: "Resend access link?" },
    description: {
      zh: "这会签发新 token，并向患者发送邮件。",
      en: "This issues new tokens and sends an email to the patient.",
    },
  },
  issueAccessLinks: {
    title: { zh: "签发新访问链接？", en: "Issue new access links?" },
    description: {
      zh: "此前仍有效的访问链接将被吊销。",
      en: "Previously active access links will be revoked.",
    },
  },
  clearHospitalImage: {
    title: { zh: "清除医院图片？", en: "Remove hospital image?" },
    description: {
      zh: "医院当前封面会被移除，此操作需要重新上传才能恢复。",
      en: "The current hospital cover will be removed and must be uploaded again to restore it.",
    },
  },
  retentionCleanup: {
    title: { zh: "执行真实数据清理？", en: "Run live data cleanup?" },
    description: {
      zh: "这不是演练，符合保留策略的消息会被永久删除。",
      en: "This is not a dry run. Messages matching the retention policy will be permanently deleted.",
    },
  },
  updateUserRole: {
    title: { zh: "更新用户角色？", en: "Update user role?" },
    description: {
      zh: "角色变更会立即影响该用户可访问的功能。",
      en: "The role change immediately affects which features the user can access.",
    },
  },
  batchUpdateAppointments: {
    title: { zh: "执行批量预约更新？", en: "Apply batch booking update?" },
    description: {
      zh: "所选预约会按当前批量动作统一更新，请确认选择范围和目标状态。",
      en: "All selected bookings will be updated by this action. Confirm the selection and target state.",
    },
  },
  updateAppointmentStatus: {
    title: { zh: "更新预约状态？", en: "Update appointment status?" },
    description: {
      zh: "状态和支付状态会按当前选择更新，并写入操作原因。",
      en: "The booking and payment states will be updated with the recorded reason.",
    },
  },
  updateReferralStatus: {
    title: { zh: "更新转诊状态？", en: "Update referral status?" },
    description: {
      zh: "订单会进入所选状态，填写的原因将保留在时间线中。",
      en: "The order will move to the selected state and the reason will remain in its timeline.",
    },
  },
  completeReferralConsultation: {
    title: {
      zh: "确认患者已经完成问诊？",
      en: "Confirm the consultation is complete?",
    },
    description: {
      zh: "请仅在核实患者实际完成问诊后继续。订单将进入已完成状态，填写的依据会保留在时间线中。",
      en: "Continue only after verifying that the consultation actually occurred. The order will be completed and the recorded evidence will remain in its timeline.",
    },
  },
  deleteScheduleRule: {
    title: { zh: "删除排班规则？", en: "Delete schedule rule?" },
    description: {
      zh: "该周期性排班规则会被删除。",
      en: "This recurring scheduling rule will be deleted.",
    },
  },
  deleteScheduleException: {
    title: { zh: "删除排班例外？", en: "Delete schedule exception?" },
    description: {
      zh: "该日期的排班例外会被删除。",
      en: "The scheduling exception for this date will be deleted.",
    },
  },
  cancelDoctorInvite: {
    title: { zh: "取消医生邀请？", en: "Cancel doctor invitation?" },
    description: {
      zh: "当前邀请链接将不再可用。",
      en: "The current invitation link will no longer be usable.",
    },
  },
  revokeDoctorBinding: {
    title: { zh: "撤销医生绑定？", en: "Revoke doctor binding?" },
    description: {
      zh: "该账号将失去对应医生工作台的访问权限。",
      en: "The account will lose access to the linked doctor workspace.",
    },
  },
  initiateReferralRefund: {
    title: { zh: "发起转诊退款？", en: "Initiate referral refund?" },
    description: {
      zh: "订单会进入退款审核流程，患者可见进展可能随之更新。",
      en: "The order will enter refund review and patient-visible progress may be updated.",
    },
  },
  approveReferralRefund: {
    title: { zh: "批准退款？", en: "Approve refund?" },
    description: {
      zh: "批准后系统将继续推进实际退款处理。",
      en: "Approval advances the request into live refund processing.",
    },
  },
  rejectReferralRefund: {
    title: { zh: "驳回退款？", en: "Reject refund?" },
    description: {
      zh: "退款申请会被驳回，审核备注将保留在操作记录中。",
      en: "The refund request will be rejected and the review note will remain in the audit trail.",
    },
  },
} as const;

const ADMIN_STATUS_GUIDANCE_COPY = {
  referral: {
    title: { zh: "状态推进条件", en: "Status progression" },
    description: {
      zh: "系统会根据当前阶段决定推进方式；常规流程请优先使用下方专用操作。",
      en: "The current stage determines how the order advances. Use the dedicated action below for normal progression.",
    },
    currentStatus: { zh: "当前状态", en: "Current status" },
    nextStatus: { zh: "预计下一状态", en: "Expected next status" },
    noFixedTarget: {
      zh: "由当前操作结果决定",
      en: "Determined by the action outcome",
    },
    noNextStatus: {
      zh: "无后续状态",
      en: "No further status",
    },
    advanceModes: {
      automatic: {
        zh: "完成当前任务后自动推进，无需再手动更新状态。",
        en: "The status advances automatically after the current task; no separate status update is needed.",
      },
      manual: {
        zh: "完成条件后，由管理员确认进入下一状态。",
        en: "After the condition is met, an admin confirms the next status.",
      },
      dynamic: {
        zh: "下一状态由审核结果决定，请使用当前阶段的专用操作。",
        en: "The next status depends on the review outcome. Use the dedicated action for this stage.",
      },
      terminal: {
        zh: "这是终态，不能继续推进；如需核对请查看时间线。",
        en: "This is a terminal state. Review the timeline if verification is needed.",
      },
    },
    manualCorrectionTitle: {
      zh: "异常状态修正",
      en: "Exceptional status correction",
    },
    manualCorrectionDescription: {
      zh: "常规流程请使用上方当前任务。仅当业务动作已在线下完成、但系统记录未同步时，才手动修正状态。",
      en: "Use the current task for normal progression. Correct the state manually only when the business action happened outside the system and the record needs reconciliation.",
    },
    completionTitle: {
      zh: "确认问诊结果",
      en: "Confirm consultation outcome",
    },
    completionDescription: {
      zh: "“已完成”表示患者实际完成了问诊，不只是预约时间已经到达。请在联系患者或服务方核实后登记。",
      en: "Completed means the consultation actually occurred, not merely that its scheduled time passed. Verify with the patient or provider before recording it.",
    },
    completionNoAutoNotice: {
      zh: "预约时间经过后，系统不会自动更新为“已完成”。这可以避免患者未出席、医生改期或问诊取消时产生错误记录。",
      en: "The order does not complete automatically when the scheduled time passes. This avoids incorrect records when the patient does not attend, the provider reschedules, or the consultation is cancelled.",
    },
    completionReasonLabel: {
      zh: "完成依据 / 处理说明",
      en: "Completion evidence / handling note",
    },
    completionAction: {
      zh: "确认并标记已完成",
      en: "Confirm and mark completed",
    },
    statusDraftSaved: {
      zh: "未提交的说明已按订单保存在当前浏览器标签页中。",
      en: "The unsaved note is kept for this order in the current browser tab.",
    },
  },
  appointment: {
    title: { zh: "预约状态更新条件", en: "Appointment status conditions" },
    description: {
      zh: "只显示当前预约可以进入的下一状态；选择目标状态后，支付状态会限制为合法组合。",
      en: "Only valid next appointment states are shown. Payment choices are constrained to valid combinations for the selected target.",
    },
    currentCombination: {
      zh: "当前状态组合",
      en: "Current state pair",
    },
    targetStatus: { zh: "目标预约状态", en: "Target booking status" },
    availableTargets: {
      zh: "个可选目标状态",
      en: "valid next states",
    },
    targetPaymentStatus: {
      zh: "目标支付状态",
      en: "Target payment status",
    },
    noTransitions: {
      zh: "当前预约已处于终态，没有可用的后续状态更新。",
      en: "This booking is in a terminal state and has no available status transition.",
    },
    invalidSelection: {
      zh: "所选状态不是当前预约允许的下一步，请重新选择。",
      en: "The selected state is not a valid next step for this booking.",
    },
  },
  reasonRequirement: {
    zh: "请填写至少 3 个字符的操作原因；该原因会写入时间线。",
    en: "Enter at least 3 characters. The reason will be recorded in the timeline.",
  },
} as const;

const ADMIN_APPOINTMENT_STATUS_LABELS: Record<
  AdminAppointmentStatus,
  LocalizedText
> = {
  draft: { zh: "草稿", en: "Draft" },
  pending_payment: { zh: "待支付", en: "Pending payment" },
  paid: { zh: "已支付", en: "Paid" },
  active: { zh: "问诊中", en: "Active" },
  ended: { zh: "问诊已结束", en: "Ended" },
  completed: { zh: "已完成", en: "Completed" },
  expired: { zh: "已过期", en: "Expired" },
  refunded: { zh: "已退款", en: "Refunded" },
  canceled: { zh: "已取消", en: "Canceled" },
};

const ADMIN_PAYMENT_STATUS_LABELS: Record<AdminPaymentStatus, LocalizedText> = {
  unpaid: { zh: "未支付", en: "Unpaid" },
  pending: { zh: "支付处理中", en: "Pending" },
  paid: { zh: "已支付", en: "Paid" },
  failed: { zh: "支付失败", en: "Failed" },
  expired: { zh: "支付已过期", en: "Expired" },
  refunded: { zh: "已退款", en: "Refunded" },
  canceled: { zh: "支付已取消", en: "Canceled" },
};

export type AdminConfirmationKey = Exclude<
  keyof typeof ADMIN_CONFIRMATION_COPY,
  "common"
>;

export function getAdminOverviewCopy(lang: AdminLang) {
  return Object.fromEntries(
    Object.entries(ADMIN_OVERVIEW_COPY).map(([key, value]) => [
      key,
      getAdminText(lang, value),
    ])
  ) as {
    [TKey in keyof typeof ADMIN_OVERVIEW_COPY]: string;
  };
}

export function getAdminUserManagementCopy(lang: AdminLang) {
  return Object.fromEntries(
    Object.entries(ADMIN_USER_MANAGEMENT_COPY).map(([key, value]) => [
      key,
      getAdminText(lang, value),
    ])
  ) as {
    [TKey in keyof typeof ADMIN_USER_MANAGEMENT_COPY]: string;
  };
}

export function getAdminRoleCapabilitySummary(
  role: "free" | "pro" | "admin" | "ops",
  lang: AdminLang
) {
  const copy = getAdminUserManagementCopy(lang);
  if (role === "admin") {
    return copy.adminAccess;
  }
  if (role === "ops") {
    return copy.operationsAccess;
  }
  return copy.noBackendAccess;
}

export function getAdminConfirmationCopy(
  lang: AdminLang,
  key: AdminConfirmationKey
) {
  const copy = ADMIN_CONFIRMATION_COPY[key];
  return {
    title: getAdminText(lang, copy.title),
    description: getAdminText(lang, copy.description),
    confirmLabel: getAdminText(lang, ADMIN_CONFIRMATION_COPY.common.confirm),
    continueLabel: getAdminText(lang, ADMIN_CONFIRMATION_COPY.common.continue),
    cancelLabel: getAdminText(lang, ADMIN_CONFIRMATION_COPY.common.cancel),
  };
}

export function getAdminStatusGuidanceCopy(lang: AdminLang) {
  return {
    referral: {
      title: getAdminText(lang, ADMIN_STATUS_GUIDANCE_COPY.referral.title),
      description: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.description
      ),
      currentStatus: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.currentStatus
      ),
      nextStatus: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.nextStatus
      ),
      noFixedTarget: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.noFixedTarget
      ),
      noNextStatus: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.noNextStatus
      ),
      advanceModes: Object.fromEntries(
        Object.entries(ADMIN_STATUS_GUIDANCE_COPY.referral.advanceModes).map(
          ([key, value]) => [key, getAdminText(lang, value)]
        )
      ) as {
        [TKey in keyof typeof ADMIN_STATUS_GUIDANCE_COPY.referral.advanceModes]: string;
      },
      manualCorrectionTitle: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.manualCorrectionTitle
      ),
      manualCorrectionDescription: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.manualCorrectionDescription
      ),
      completionTitle: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.completionTitle
      ),
      completionDescription: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.completionDescription
      ),
      completionNoAutoNotice: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.completionNoAutoNotice
      ),
      completionReasonLabel: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.completionReasonLabel
      ),
      completionAction: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.completionAction
      ),
      statusDraftSaved: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.referral.statusDraftSaved
      ),
    },
    appointment: {
      title: getAdminText(lang, ADMIN_STATUS_GUIDANCE_COPY.appointment.title),
      description: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.appointment.description
      ),
      currentCombination: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.appointment.currentCombination
      ),
      targetStatus: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.appointment.targetStatus
      ),
      availableTargets: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.appointment.availableTargets
      ),
      targetPaymentStatus: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.appointment.targetPaymentStatus
      ),
      noTransitions: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.appointment.noTransitions
      ),
      invalidSelection: getAdminText(
        lang,
        ADMIN_STATUS_GUIDANCE_COPY.appointment.invalidSelection
      ),
    },
    reasonRequirement: getAdminText(
      lang,
      ADMIN_STATUS_GUIDANCE_COPY.reasonRequirement
    ),
  };
}

export function getAdminAppointmentStatusLabel(
  status: AdminAppointmentStatus,
  lang: AdminLang
) {
  return getAdminText(lang, ADMIN_APPOINTMENT_STATUS_LABELS[status]);
}

export function getAdminPaymentStatusLabel(
  status: AdminPaymentStatus,
  lang: AdminLang
) {
  return getAdminText(lang, ADMIN_PAYMENT_STATUS_LABELS[status]);
}

type LocalizedOption<TValue extends string> = {
  value: TValue;
  label: LocalizedText;
};

const REASON_LABELS: Record<string, LocalizedText> = {
  appointment_draft_created: { zh: "已创建草稿", en: "Draft created" },
  checkout_session_created: { zh: "已创建支付会话", en: "Checkout created" },
  stripe_webhook_paid: {
    zh: "Stripe 支付已确认",
    en: "Stripe payment settled",
  },
  payment_reinitiated: { zh: "已重启支付", en: "Payment re-initiated" },
  payment_refunded: { zh: "已退款", en: "Payment refunded" },
  checkout_session_expired: { zh: "支付会话已过期", en: "Checkout expired" },
  payment_failed: { zh: "支付失败", en: "Payment failed" },
  admin_reinitiate_payment: {
    zh: "管理员重启支付",
    en: "Admin re-initiated payment",
  },
  admin_resend_access_link: {
    zh: "管理员重发访问链接",
    en: "Admin resent access link",
  },
  admin_issue_access_links: {
    zh: "管理员签发新访问链接",
    en: "Admin issued new access links",
  },
  admin_status_update: { zh: "管理员更新状态", en: "Admin updated status" },
  appointment_canceled: { zh: "预约已取消", en: "Appointment canceled" },
  payment_link_email_failed: {
    zh: "支付链接邮件发送失败",
    en: "Link email failed",
  },
};

const WEBHOOK_TYPE_LABELS: Record<string, LocalizedText> = {
  "checkout.session.completed": { zh: "结账完成", en: "Checkout completed" },
  "checkout.session.expired": { zh: "结账过期", en: "Checkout expired" },
  "payment_intent.payment_failed": { zh: "支付失败", en: "Payment failed" },
  "charge.refunded": { zh: "已退款", en: "Charge refunded" },
  "refund.updated": { zh: "退款更新", en: "Refund updated" },
  signature_invalid: { zh: "签名无效", en: "Signature invalid" },
  signature_verification_failed: {
    zh: "签名校验失败",
    en: "Signature verification failed",
  },
  missing_session_id: { zh: "缺少 session id", en: "Missing session id" },
  malformed_event: { zh: "事件格式错误", en: "Malformed event" },
  db_unavailable: { zh: "数据库不可用", en: "DB unavailable" },
  processing_error: { zh: "处理失败", en: "Processing error" },
  webhook_error_missing_session_id: {
    zh: "Webhook 缺少 session id",
    en: "Webhook missing session id",
  },
  webhook_error_processing: {
    zh: "Webhook 处理失败",
    en: "Webhook processing error",
  },
};

const APPOINTMENT_TYPE_OPTIONS: ReadonlyArray<
  LocalizedOption<"online_chat" | "video_call" | "in_person">
> = [
  { value: "online_chat", label: { zh: "图文问诊", en: "Online Chat" } },
  { value: "video_call", label: { zh: "视频问诊", en: "Video Call" } },
  { value: "in_person", label: { zh: "线下面诊", en: "In Person" } },
];

const WEEKDAY_OPTIONS: ReadonlyArray<
  LocalizedOption<"0" | "1" | "2" | "3" | "4" | "5" | "6">
> = [
  { value: "0", label: { zh: "周日", en: "Sunday" } },
  { value: "1", label: { zh: "周一", en: "Monday" } },
  { value: "2", label: { zh: "周二", en: "Tuesday" } },
  { value: "3", label: { zh: "周三", en: "Wednesday" } },
  { value: "4", label: { zh: "周四", en: "Thursday" } },
  { value: "5", label: { zh: "周五", en: "Friday" } },
  { value: "6", label: { zh: "周六", en: "Saturday" } },
];

const EXCEPTION_ACTION_OPTIONS: ReadonlyArray<
  LocalizedOption<"block" | "extend" | "replace">
> = [
  { value: "block", label: { zh: "停诊/封盘", en: "Block" } },
  { value: "extend", label: { zh: "加班扩容", en: "Extend" } },
  { value: "replace", label: { zh: "替换时段", en: "Replace" } },
];

export function getAdminText(lang: AdminLang, text: LocalizedText) {
  return lang === "zh" ? text.zh : text.en;
}

export function getAdminReasonLabel(
  reason: string | null | undefined,
  lang: AdminLang
) {
  const raw = (reason ?? "").trim();
  if (!raw) {
    return "-";
  }
  const baseReason = raw.includes(":") ? raw.split(":")[0] : raw;
  const localized = REASON_LABELS[baseReason];
  if (!localized) {
    return raw;
  }
  const label = getAdminText(lang, localized);
  return raw.startsWith(`${baseReason}:`)
    ? `${label} (${raw.slice(baseReason.length + 1)})`
    : label;
}

export function getAdminWebhookTypeLabel(type: string, lang: AdminLang) {
  const localized = WEBHOOK_TYPE_LABELS[type];
  return localized ? getAdminText(lang, localized) : type;
}

export function getAppointmentTypeOptions(lang: AdminLang) {
  return APPOINTMENT_TYPE_OPTIONS.map(item => ({
    value: item.value,
    label: getAdminText(lang, item.label),
  }));
}

export function getWeekdayOptions(lang: AdminLang) {
  return WEEKDAY_OPTIONS.map(item => ({
    value: item.value,
    label: getAdminText(lang, item.label),
  }));
}

export function getWeekdayLabel(value: string, lang: AdminLang) {
  const option = WEEKDAY_OPTIONS.find(item => item.value === value);
  return option ? getAdminText(lang, option.label) : value;
}

export function getExceptionActionOptions(lang: AdminLang) {
  return EXCEPTION_ACTION_OPTIONS.map(item => ({
    value: item.value,
    label: getAdminText(lang, item.label),
  }));
}

const RISK_MESSAGES: Record<string, LocalizedText> = {
  PENDING_PAYMENT_TIMEOUT: {
    zh: "支付待处理超过 30 分钟。",
    en: "Payment has been pending for over 30 minutes.",
  },
  TOKEN_EXPIRING_SOON: {
    zh: "至少有一个有效访问令牌将在 2 小时内过期。",
    en: "At least one active access token expires within 2 hours.",
  },
  TOKEN_USAGE_EXHAUSTED: {
    zh: "有一个活跃令牌已达最大使用次数，可能会阻止进入会诊室。",
    en: "An active token reached max uses and may block room access.",
  },
  WEBHOOK_FAILURE: {
    zh: "支付时间线中检测到 Webhook 失败事件。",
    en: "Webhook failure events detected in payment timeline.",
  },
  PAID_BUT_NOT_ACTIVE: {
    zh: "在未激活状态下已产生会诊消息。",
    en: "Messages exist while appointment is not active yet.",
  },
};

export function getAdminRiskMessage(
  code: keyof typeof RISK_MESSAGES | "DOCTOR_REPLY_SLA_OVERDUE",
  lang: AdminLang,
  params?: { waitingMinutes?: number }
) {
  if (code === "PENDING_PAYMENT_TIMEOUT")
    return getAdminText(lang, RISK_MESSAGES.PENDING_PAYMENT_TIMEOUT);
  if (code === "TOKEN_EXPIRING_SOON")
    return getAdminText(lang, RISK_MESSAGES.TOKEN_EXPIRING_SOON);
  if (code === "TOKEN_USAGE_EXHAUSTED")
    return getAdminText(lang, RISK_MESSAGES.TOKEN_USAGE_EXHAUSTED);
  if (code === "WEBHOOK_FAILURE")
    return getAdminText(lang, RISK_MESSAGES.WEBHOOK_FAILURE);
  if (code === "PAID_BUT_NOT_ACTIVE")
    return getAdminText(lang, RISK_MESSAGES.PAID_BUT_NOT_ACTIVE);
  const waitingMinutes = params?.waitingMinutes ?? 0;
  return lang === "zh"
    ? `医生回复超时：患者已等待 ${waitingMinutes} 分钟。`
    : `Doctor reply SLA overdue: patient has waited ${waitingMinutes} minutes.`;
}

const SUGGESTION_COPY = {
  suggest_reinitiate_payment: {
    title: { zh: "重发起支付流程", en: "Re-initiate checkout" },
    detail: {
      zh: "支付待处理时间过长。创建新的支付会话。",
      en: "Pending payment timed out. Create a fresh checkout session.",
    },
  },
  suggest_inspect_webhook: {
    title: { zh: "检查 webhook 时间线", en: "Inspect webhook timeline" },
    detail: {
      zh: "检测到 webhook 失败。请先检查事件顺序，再重试支付。",
      en: "Webhook failures detected. Check event sequence before retrying payment.",
    },
  },
  suggest_notify_doctor_followup: {
    title: { zh: "提醒医生跟进", en: "Notify doctor follow-up" },
    detail: {
      zh: "患者消息尚未被处理。立即触发医生跟进提醒。",
      en: "Patient message is waiting. Trigger doctor follow-up reminder now.",
    },
  },
  suggest_resend_access_link: {
    title: { zh: "重发患者入室链接", en: "Resend patient access link" },
    detail: {
      zh: "支付已完成。若患者无法进入会诊室，请重新发送入室链接。",
      en: "Payment is settled. Resend entry link if patient cannot enter room.",
    },
  },
  suggest_issue_access_links: {
    title: { zh: "签发新的患者/医生访问链接", en: "Issue new access links" },
    detail: {
      zh: "作废旧链接并重新签发一对新的患者/医生链接。",
      en: "Revoke old links and issue a fresh patient/doctor pair.",
    },
  },
  suggest_monitor_only: {
    title: { zh: "无紧急动作", en: "No urgent action" },
    detail: {
      zh: "当前状态看起来稳定，持续监测时间线更新。",
      en: "Current state looks stable. Continue monitoring timeline updates.",
    },
  },
} as const;

export function getAdminSuggestionCopy(
  key: keyof typeof SUGGESTION_COPY,
  lang: AdminLang
) {
  return {
    title: getAdminText(lang, SUGGESTION_COPY[key].title),
    detail: getAdminText(lang, SUGGESTION_COPY[key].detail),
  };
}
