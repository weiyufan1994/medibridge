import type { LocalizedText } from "@shared/types";
import type {
  AdminAppointmentStatus,
  AdminPaymentStatus,
} from "@/features/admin/types";

export const ADMIN_CONFIRMATION_COPY = {
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

export const ADMIN_STATUS_GUIDANCE_COPY = {
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
    noNextStatus: { zh: "无后续状态", en: "No further status" },
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
    completionTitle: { zh: "确认问诊结果", en: "Confirm consultation outcome" },
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
    currentCombination: { zh: "当前状态组合", en: "Current state pair" },
    targetStatus: { zh: "目标预约状态", en: "Target booking status" },
    availableTargets: { zh: "个可选目标状态", en: "valid next states" },
    targetPaymentStatus: { zh: "目标支付状态", en: "Target payment status" },
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

export const ADMIN_APPOINTMENT_STATUS_LABELS: Record<
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

export const ADMIN_PAYMENT_STATUS_LABELS: Record<
  AdminPaymentStatus,
  LocalizedText
> = {
  unpaid: { zh: "未支付", en: "Unpaid" },
  pending: { zh: "支付处理中", en: "Pending" },
  paid: { zh: "已支付", en: "Paid" },
  failed: { zh: "支付失败", en: "Failed" },
  expired: { zh: "支付已过期", en: "Expired" },
  refunded: { zh: "已退款", en: "Refunded" },
  canceled: { zh: "支付已取消", en: "Canceled" },
};
