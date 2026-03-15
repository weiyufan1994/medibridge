# 医生排班与 AI 急症熔断设计草案

## 目标

这份设计草案解决三个当前最短板的问题：

1. 预约缺少真实供给模型
2. AI 分诊缺少医疗安全熔断
3. AI 分诊缺少外部医疗知识注入

设计目标：

- 在不推翻现有预约/支付状态机的前提下补齐排班能力
- 在不放大 LLM 自由度的前提下补齐高风险拦截
- 在不自训练模型的前提下，用轻量 RAG 提高分诊一致性

## 一、医生排班系统

### 1. 当前问题

当前 `appointments` 已经能表达预约订单，但不能表达医生真实供给。现状更接近：

- 用户提交一个预约请求
- 系统记录时间和支付状态

缺口是：

- 医生什么时候可接诊
- 一个时间段是否已经售出
- 改期是否冲突
- 不同时区如何一致表达

### 2. 设计原则

- 保留现有 `appointments` 作为交易主表
- 新增排班和 slot 层，不把 slot 逻辑揉进 `appointments`
- slot 是供给实体，appointment 是交易实体
- 所有排班相关时间统一存 UTC，同时保留医生展示时区

### 3. 建议数据模型

#### `doctor_profiles`

用途：补齐医生供给侧配置，不直接承担认证。

建议字段：

- `id`
- `doctorId`
- `displayName`
- `timezone`
- `status` (`active | paused | archived`)
- `acceptsOnlineChat`
- `acceptsVideoCall`
- `defaultConsultationDurationMinutes`
- `bufferMinutes`
- `createdAt`
- `updatedAt`

#### `doctor_availability_rules`

用途：表达长期排班规则。

建议字段：

- `id`
- `doctorProfileId`
- `dayOfWeek` (`0-6`)
- `startMinuteOfDay`
- `endMinuteOfDay`
- `effectiveFrom`
- `effectiveTo`
- `visitType` (`online_chat | video_call | in_person`)
- `slotDurationMinutes`
- `isEnabled`
- `createdAt`
- `updatedAt`

#### `doctor_time_off`

用途：表达请假、停诊、会议占用等例外。

建议字段：

- `id`
- `doctorProfileId`
- `startAt`
- `endAt`
- `reason`
- `createdAt`

#### `doctor_time_slots`

用途：表达某个具体时刻是否可售。

建议字段：

- `id`
- `doctorProfileId`
- `startAt`
- `endAt`
- `timezone`
- `visitType`
- `capacity`
- `reservedCount`
- `status` (`open | locked | booked | blocked | expired`)
- `sourceRuleId`
- `createdAt`
- `updatedAt`

建议唯一约束：

- `doctorProfileId + startAt + visitType`

#### `appointment_slot_allocations`

用途：建立预约与 slot 的显式绑定，避免把 slot 信息硬塞进 appointment。

建议字段：

- `id`
- `appointmentId`
- `slotId`
- `status` (`locked | confirmed | released`)
- `lockedAt`
- `confirmedAt`
- `releasedAt`
- `releaseReason`

建议唯一约束：

- `appointmentId`
- `slotId`（同一 appointment 不应重复绑定）

### 4. 对现有 `appointments` 的建议改动

建议补充字段：

- `doctorProfileId`
- `slotId` 或仅通过 `appointment_slot_allocations` 关联
- `visitStartedAt`
- `visitEndedAt`
- `noShowMarkedAt`

不建议直接删除当前 `scheduledAt`，而是短期保留：

- `scheduledAt` 作为兼容字段
- 新逻辑以 `slot.startAt` 为真相源

### 5. 模块边界建议

新增模块：

- `server/modules/scheduling/`

建议结构：

- `repo.ts`
- `schemas.ts`
- `actions.ts`
- `routerApi.ts`
- `slotGenerator.ts`
- `slotAllocator.ts`
- `conflictPolicy.ts`

边界：

- `appointments` 继续负责交易与状态机
- `scheduling` 负责供给、slot、冲突、预占
- `appointments` 通过 `scheduling` 提供的稳定接口完成 slot 锁定和释放

### 6. 关键流程

#### 流程 A：查询可预约时间

1. 前端传入 `doctorId + visitType + date range + timezone`
2. `scheduling` 读取规则、time off、已有预约
3. 返回可售 slot 列表

#### 流程 B：创建预约

1. 前端选择 slot
2. `appointments.createV2` 调用 `scheduling.lockSlot`
3. 创建 appointment，状态仍走现有 `draft/pending_payment`
4. 支付成功后调用 `confirmSlotAllocation`
5. 支付失败、取消、过期时调用 `releaseSlotAllocation`

#### 流程 C：改期

1. 校验 appointment 当前状态是否允许改期
2. 申请新 slot
3. 锁定新 slot
4. 释放旧 slot
5. 记录状态事件和操作审计

### 7. 并发策略

需要处理两个风险：

- 同一 slot 被多个用户同时下单
- 已支付订单与未支付锁定订单相互覆盖

建议策略：

- `doctor_time_slots.reservedCount < capacity` 才允许锁定
- 使用事务完成：
  - 查询 slot 当前状态
  - 增加 `reservedCount`
  - 创建 allocation
- 为未支付锁定设置超时释放

### 8. 对前端的影响

患者侧：

- 预约弹窗从“选任意时间”改为“选真实 slot”

医生侧：

- 新增“今日预约 / 未来预约 / 已完成 / 已取消”视图

后台：

- 可查看 slot 冲突、释放原因、no-show

## 二、AI 分诊 RAG 与急症熔断机制

### 1. 当前问题

当前分诊流程能输出 `urgency`，但没有形成真正的安全闭环：

- 没有外部权威知识作为分诊参考
- 没有独立的红旗症状规则层
- 没有明确的中断行为
- 没有风险审计记录

### 2. 设计原则

- 先检索、后生成
- 规则优先，LLM 辅助
- 一旦命中红旗症状，中断优先于继续追问
- 熔断结果必须可追踪、可审计、可解释

### 3. 建议数据模型

#### `triage_knowledge_documents`

建议字段：

- `id`
- `sourceType` (`guideline | pathway | faq`)
- `title`
- `lang`
- `body`
- `version`
- `status` (`draft | active | archived`)
- `sourceUrl`
- `createdAt`
- `updatedAt`

#### `triage_knowledge_chunks`

建议字段：

- `id`
- `documentId`
- `chunkText`
- `chunkSummary`
- `tagsJson`
- `embedding`
- `createdAt`

建议索引：

- `documentId`
- `tagsJson`（如数据库能力允许）

#### `triage_risk_events`

建议字段：

- `id`
- `aiChatSessionId`
- `userId`
- `riskCode`
- `severity` (`high | critical`)
- `matchedText`
- `detectionSource` (`rule | llm | hybrid`)
- `recommendedAction`
- `createdAt`

#### `triage_session_flags`

建议字段：

- `id`
- `aiChatSessionId`
- `flagType` (`red_flag | consent_missing | manual_review_required`)
- `flagValue`
- `createdAt`

### 4. 首批红旗症状范围

建议首批只覆盖最典型高风险：

- 胸痛 / 胸闷伴呼吸困难
- 大出血 / 呕血 / 黑便
- 单侧肢体无力 / 口角歪斜 / 言语不清
- 意识障碍 / 晕厥 / 抽搐
- 严重呼吸困难
- 严重过敏反应
- 自杀、自伤、伤人风险

### 5. RAG 范围

RAG 不建议一开始做成“大而全医疗百科”，而是只覆盖高价值分诊知识。

首批建议知识源：

- 常见主诉对应科室路由规则
- 常见症状的分诊问询框架
- 红旗症状处置建议
- 常见慢病/用药场景的补充追问模板

首批目标不是“给出诊断”，而是：

- 让分诊追问更稳定
- 让 `urgency` 更一致
- 让科室/医生推荐更可解释

### 6. 检测流程

#### Stage 0: RAG 检索

在调用 `processTriageChat` 前，先基于以下输入检索知识片段：

- 最近一轮用户消息
- 当前会话摘要候选
- 已抽取出的症状关键词

返回 2-5 条高相关知识片段，注入到系统提示词或上游上下文中。

要求：

- 只允许使用受控知识源
- 如果没有足够高置信命中，宁可不注入
- 不允许把任意网络搜索结果直接喂给模型

#### Stage 1: 输入前规则检测

在 `sendMessageAction` 写入用户消息后、调用 `processTriageChat` 前执行规则扫描。

如果命中高风险：

- 写入 `triage_risk_events`
- 追加固定 assistant 安全提示
- 结束 session
- 不继续调用 LLM

#### Stage 2: LLM 输出后辅助检测

如果规则层未命中，再允许 LLM 继续分诊。

LLM 返回后增加一次后处理：

- 如果 `summary` 或 `reply` 暗示高风险，则补记风险事件
- 但不依赖它作为唯一判定

### 7. 固定安全响应

命中高风险后，前端不应继续普通分诊，应展示：

- 明确提示当前情况不适合继续线上 AI 分诊
- 引导立即前往急诊或联系当地急救
- 停止继续输入

### 8. 模块边界建议

新增模块：

- `server/modules/triageSafety/`
- `server/modules/triageKnowledge/`

建议结构：

- `rules.ts`
- `scanner.ts`
- `repo.ts`
- `schemas.ts`
- `copy.ts`

以及：

- `retriever.ts`
- `chunking.ts`
- `routerApi.ts`

边界：

- `triageKnowledge` 负责知识片段检索和注入
- `ai/actions.ts` 调用 `triageSafety.scanMessage`
- `ai/actions.ts` 或 `ai/service.ts` 调用 `triageKnowledge.retrieveContext`
- `ai/service.ts` 继续只负责 LLM 分诊生成
- `triageSafety` 不依赖前端，只返回结构化风险结果

### 9. 对现有 AI 流程的建议改造

在 `createSessionAction` / `sendMessageAction` 之外，不建议把安全逻辑塞进 prompt。

推荐顺序：

1. 用户消息入库
2. RAG 检索知识片段
3. 规则扫描
4. 如命中高风险，直接熔断
5. 如未命中，再带着知识片段进入 LLM 分诊
6. 返回结果后补做审计

### 10. 后台与运营可见性

后台建议新增：

- 高风险事件列表
- 按 risk code 聚合
- 关联 session、user、createdAt
- 是否人工跟进
- RAG 命中知识片段审计
- 命中率和无命中率统计

## 三、建议实施顺序

### P0

- `doctor_profiles`
- `doctor_availability_rules`
- `doctor_time_slots`
- `appointment_slot_allocations`
- `triage_knowledge_documents`
- `triage_knowledge_chunks`
- `triage_risk_events`
- 基础知识检索器
- 基础规则扫描器

### P1

- 医生工作台
- 改期冲突处理
- consent 留痕
- 风险事件后台视图
- 知识源管理与版本化

### P2

- 更灵活的 recurring schedule
- 视频问诊深度集成
- 更细的风控分级和人工审核队列

## 四、与现有系统的兼容策略

- 不推翻 `appointments` 主表
- 不推翻当前支付与 token 状态机
- 先引入新的 scheduling 和 triageSafety 模块
- 通过 router boundary pattern 暴露稳定 `routerApi`

## 五、落地建议

如果只做一轮最小改造，建议先落地以下内容：

1. 新增排班表与 slot 查询接口
2. 预约创建改为基于 slot
3. 增加最小 RAG 知识库和检索接口
4. 增加红旗症状规则扫描
5. 命中后中断 session 并记录风险事件
6. 医生工作台只做“今日待接诊 + 进入房间 + 查看摘要”

这样能最小代价补齐当前最关键的业务短板。
