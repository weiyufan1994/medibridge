export const ADMIN_USER_MANAGEMENT_COPY = {
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

export const ADMIN_OVERVIEW_COPY = {
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
