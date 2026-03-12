# Phase 1 重构方案：AI 分诊独立配额 + 预约先支付闭环

## 0. 范围与原则
- 保持现有 AI 分诊配额系统不变（Guest / Free / Pro + 单 session 消息上限 + session 完成态）。
- 新增“预约支付闭环”，与 AI 配额完全独立，不共用计费逻辑。
- 预约与 AI 分诊强绑定：每条预约必须关联一个 `ai_chat_sessions.id`。
- 未支付用户不可获得诊室访问权限（token 不发放或无效）。

---

## 1）系统重构总体架构说明

### 1.1 目标架构（文字图）
1. `AI 模块`：
- `ai.createSession` / `ai.sendMessage` 继续按原配额控制。
- 分诊结束后产出 summary（已存在 `processTriageChat.summary`）并可持久化到分诊会话。

2. `预约支付模块`（新增核心）：
- 创建预约草稿（`draft/pending_payment`）并绑定 `triageSessionId`。
- 服务端创建 Stripe Checkout Session，保存 `stripeSessionId`。
- Stripe Webhook 验签成功后更新 `paymentStatus=paid` + `status=paid`，然后生成 patient/doctor token。

3. `诊室访问模块`：
- 不再仅校验 token。
- 必须同时校验 `appointment`、`paymentStatus`、`status`、`过期时间`。

4. `诊室消息模块`：
- 完整落库，支持 cursor 分页与向上加载历史。
- 继续支持 polling 拉新消息。

5. `翻译模块`：
- 发送时写入 `originalContent + translatedContent + sourceLanguage + targetLanguage`。
- 前端默认显示译文，可切换原文。

### 1.2 关键边界
- AI 额度耗尽 ≠ 不能付款预约。两条链路独立。
- Stripe 支付结果仅信任 webhook，前端回跳页面仅用于“支付处理中”提示。
- token 只在 webhook 成功后由后端生成并入库。

---

## 2）数据库迁移设计

### 2.1 `appointments` 字段升级
新增字段（在现有表基础上）：
- `triageSessionId int not null`：外键到 `ai_chat_sessions.id`。
- `paymentStatus enum('unpaid','pending','paid','failed','expired','refunded') not null default 'unpaid'`。
- `stripeSessionId varchar(255) null`：唯一（Stripe Checkout Session ID）。
- `amount int not null`：最小货币单位（分）。
- `currency varchar(8) not null default 'usd'`。
- `paidAt timestamp null`。

建议同步调整：
- `status` 枚举迁移为：`draft | pending_payment | paid | confirmed | in_session | completed | expired | refunded`。
- `sessionId`（旧字段）逐步废弃，用 `triageSessionId` 替代关联。

### 2.2 约束规则
- `appointments.triageSessionId`：
  - `NOT NULL`。
  - `FOREIGN KEY ... REFERENCES ai_chat_sessions(id)`。
- `UNIQUE INDEX appointmentsStripeSessionUk(stripeSessionId)`（允许 NULL）。
- `CHECK (amount > 0)`。
- `CHECK (currency IN ('usd','cny'))`（或改为配置白名单）。
- 推荐：`UNIQUE INDEX appointmentsTriageSessionUk(triageSessionId)`，保证一个分诊会话对应一个正式预约实体；支付重试在同一 appointment 上更新。

### 2.3 新增审计表（强烈建议）
`appointment_status_events`：
- `id, appointmentId, fromStatus, toStatus, operatorType(system|patient|doctor|admin|webhook), operatorId, reason, payloadJson, createdAt`。
- 作用：所有关键状态可追踪（满足风控与排障）。

### 2.4 消息翻译字段迁移
`appointmentMessages` 新增：
- `originalContent text not null`
- `translatedContent text not null`
- `sourceLanguage varchar(8) not null`
- `targetLanguage varchar(8) not null`
- `translationProvider varchar(64) null`

兼容期策略：
- 旧 `content` 可保留一版，后续以 `translatedContent` 作为 UI 默认展示字段。

---

## 3）状态机流程图说明（文字形式）

### 3.1 状态定义与访问权限
1. `draft`
- 含义：用户选医生后创建草稿，尚未发起支付。
- 权限：不可进入诊室，不生成 token。

2. `pending_payment`
- 含义：已创建 Stripe Checkout Session，等待支付结果。
- 权限：不可进入诊室，不生成 token。

3. `paid`
- 含义：Webhook 验签成功，支付完成。
- 权限：此时才允许生成 token；允许进入诊室准备页。

4. `confirmed`
- 含义：支付后确认排班/医生接单成功。
- 权限：可进入诊室。

5. `in_session`
- 含义：双方已进入会话（首条医生/患者消息后自动进入）。
- 权限：可读写消息。

6. `completed`
- 含义：会诊结束。
- 权限：只读历史，不可发送。

7. `expired`
- 含义：超时未支付或会话过期。
- 权限：拒绝访问。

8. `refunded`
- 含义：退款成功。
- 权限：拒绝访问（或按业务允许只读归档）。

### 3.2 合法流转
- `draft -> pending_payment`
- `pending_payment -> paid`（仅 webhook）
- `pending_payment -> expired`（超时）
- `pending_payment -> failed`（可由 `paymentStatus` 表示，不单列主状态）
- `paid -> confirmed`
- `confirmed -> in_session`
- `in_session -> completed`
- `paid|confirmed|in_session -> refunded`
- `paid|confirmed -> expired`（超时未开诊）

### 3.3 状态机硬规则
- token 只允许在 `paid` 及之后生成。
- `paymentStatus != paid` 时，诊室访问必拒绝。
- 状态跳转必须写 `appointment_status_events`。

---

## 4）支付闭环设计（Stripe）

### 4.1 服务端流程
1. `POST /payments/checkout-session`（或 `trpc.payments.createCheckoutSession`）
- 输入：`appointmentId`。
- 校验：预约归属、`triageSessionId` 存在、状态为 `draft/pending_payment`。
- 行为：调用 Stripe 创建 Checkout Session，写入 `stripeSessionId`，状态置 `pending_payment`。

2. `POST /payments/webhook`（HTTP 原始 body）
- 使用 `Stripe-Signature` + webhook secret 验签。
- 仅处理 `checkout.session.completed`（可扩展 `payment_intent.payment_failed` 等）。
- 幂等：按 `stripeSessionId` + 事件 ID 去重。
- 成功后：
  - 更新 `paymentStatus=paid`、`paidAt=now`、`status=paid`。
  - 生成 `patientTokenHash` / `doctorTokenHash`、设置过期时间。
  - 写状态事件日志。

3. 回跳页（前端）
- 只展示“支付处理中/成功待确认”，然后轮询后端查询状态。
- 不以回跳参数作为支付真相。

### 4.2 安全原则
- 不信任前端支付结果。
- 不在前端生成 token。
- 仅 webhook 成功后发放访问权限。

---

## 5）API 设计草案

### 5.1 预约与支付
1. `appointments.createDraft`
- 入参：`doctorId, triageSessionId, appointmentType, scheduledAt, email`。
- 出参：`appointmentId, status=draft, paymentStatus=unpaid`。

2. `payments.createCheckoutSession`
- 入参：`appointmentId`。
- 出参：`checkoutUrl`。

3. `payments.getStatus`
- 入参：`appointmentId`。
- 出参：`status, paymentStatus, paidAt`。

4. `payments.webhook`（REST）
- Stripe 调用，内部验签与状态推进。

5. `appointments.getByToken`
- 新增返回：`paymentStatus, triageSummary`。
- 返回前执行访问控制网关。

### 5.2 诊室消息分页
1. `visit.listMessages`
- 入参：`appointmentId, token, cursor?, direction(before|after), limit`。
- 出参：`messages, nextCursor, hasMore`。

2. `visit.pollNewMessages`
- 入参：`afterCursor`。
- 出参：新消息增量。

3. `visit.sendMessage`
- 入参：`content + 客户端语言`。
- 服务端翻译后同时落 `original/translated`。

---

## 6）诊室访问权限矩阵

| 条件 | 校验结果 | 访问结论 |
|---|---|---|
| token 无效/不匹配 | fail | 401/403 |
| appointment 不存在 | fail | 404 |
| paymentStatus != paid | fail | 402/403（建议统一 403） |
| accessToken 已过期/撤销 | fail | 403 |
| status in (`draft`,`pending_payment`,`expired`,`refunded`) | fail | 403 |
| status in (`paid`,`confirmed`) | pass | 允许进入（可限制发送） |
| status == `in_session` | pass | 允许读写 |
| status == `completed` | partial | 允许只读 |

建议网关函数：`validateVisitAccess(appointmentId, token, action)`
- `action`: `read_history | send_message | join_room`
- 在一个函数里统一完成 5 项校验，避免路由分散绕过。

---

## 7）AI 分诊与预约强绑定方案

### 7.1 绑定规则
- `appointments.triageSessionId` 强制非空 + FK。
- 创建草稿时验证：
  - triage session 存在。
  - triage session 属于当前用户。
  - triage session 已完成（建议 `ai_chat_sessions.status=completed`）。

### 7.2 摘要读取与展示
- summary 存储建议：
  - 方案 A（推荐）：给 `ai_chat_sessions` 增加 `summary` 字段。
  - 方案 B：新增 `ai_triage_summaries(sessionId unique, summary, keywords, extractionJson)`。
- `VisitRoom` 加载 `appointments.getByToken` 时联表返回 summary，UI 顶部置顶卡片展示。
- 防重复生成：
  - 仅在 triage 首次完成时写入 summary。
  - 若存在 summary，不重复调用 LLM。

---

## 8）聊天存储与分页机制

### 8.1 Cursor 设计
- cursor 推荐结构：`base64("{createdAtISO}|{id}")`。
- 排序：`ORDER BY createdAt DESC, id DESC`（向上翻历史）。

### 8.2 加载策略
- 初次进入：拉最新 `limit=50`。
- 向上加载：`direction=before&cursor=<oldestCursor>` 继续获取更早消息。
- 轮询新消息：`direction=after&cursor=<latestCursor>` 获取增量。

### 8.3 完整存储
- 不做硬截断，消息全量入库。
- 客户端仅分页展示，不限制后端保留总量。

---

## 9）翻译系统架构设计

### 9.1 发送链路
1. 客户端发送 `originalContent` + `sourceLanguage`。
2. 服务端识别目标语言（按会诊双方语言偏好或默认语言）。
3. 调用翻译服务得到 `translatedContent`。
4. 一次写库落全字段（原文+译文）。

### 9.2 展示链路
- 默认显示 `translatedContent`。
- UI 提供“查看原文”切换。
- 翻译失败回退：`translatedContent=originalContent` + 记录 provider/error。

---

## 10）安全与风控机制
- Stripe webhook 必须签名验证，且用原始 body。
- token 必须带过期时间与撤销字段，哈希存储。
- token 与 appointment 强绑定（校验哈希时必须命中 appointment 行）。
- 所有关键状态写审计日志：
  - 创建草稿
  - 创建支付会话
  - webhook 收到/验签失败/支付成功
  - token 发放
  - 访问拒绝（未支付、过期、状态不允许）
- 风控补充：
  - webhook 幂等去重
  - resend token 频控
  - 失败支付重试次数限制

---

## 11）模块依赖关系
- `ai` 模块：独立配额与分诊，不依赖支付。
- `appointments` 模块：依赖 `ai_chat_sessions`（强绑定）。
- `payments` 模块：依赖 `appointments`，通过 webhook 反向推进预约状态。
- `visit` 模块：依赖 `appointments + token + paymentStatus` 的统一访问网关。
- `translation` 模块：依赖 `visit.sendMessage` 的消息入库流程。
- `audit` 模块：被 `appointments/payments/visit` 共用记录关键事件。

---

## 12）开发优先级建议
1. **P0：数据模型与访问闸门**
- 先做 DB 迁移（`triageSessionId/paymentStatus/...` + 审计表）。
- 实现统一 `validateVisitAccess`，拦截未支付访问。

2. **P0：Stripe 闭环**
- `createCheckoutSession` + `webhook` + 幂等 + 支付后发 token。

3. **P1：状态机落地**
- 新状态与状态转移服务，替换散落更新逻辑。

4. **P1：AI summary 强绑定展示**
- summary 持久化与 VisitRoom 置顶展示。

5. **P2：消息 cursor 分页**
- 历史分页 + 轮询增量合并。

6. **P2：翻译落库**
- 原文/译文双存与 UI 切换。

---

## 13）潜在风险分析
- 风险 1：旧 appointment 兼容
- 影响：历史数据无 `triageSessionId`。
- 应对：迁移期允许临时 nullable + 回填脚本，回填后再 `NOT NULL`。

- 风险 2：Webhook 重放/乱序
- 影响：状态重复推进、重复发 token。
- 应对：事件去重表 + 状态幂等检查（仅从 `pending_payment` 可进入 `paid`）。

- 风险 3：支付成功但排班失败
- 影响：用户体验差。
- 应对：`paid -> confirmed` 分离，排班失败走人工处理或自动退款流。

- 风险 4：消息翻译延迟
- 影响：发送体验变慢。
- 应对：同步翻译超时降级（先入原文并标记待翻译，异步补译）。

- 风险 5：轮询与分页游标冲突
- 影响：重复/丢消息。
- 应对：统一 `(createdAt,id)` 比较规则，前端 merge 去重。

