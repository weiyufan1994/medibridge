# SaaS 架构升级与重构总结清单

## 发布背景
本次发布完成了从“单次工具”到“可沉淀长期用户资产的 SaaS 平台”升级，核心目标是：
- 建立完整身份生命周期（Guest -> Free -> Pro）
- 实现无密码准入与游客资产无损合并
- 增加 AI 问诊商业化计费护栏（Session 配额 + Message 兜底）

## 1. 前端 Feature 拆分与能力收敛
### 已完成
- 前端按领域拆分为 `features/auth`、`features/triage`、`features/appointment`、`features/visit`、`features/hospitals`
- 认证能力集中到 `features/auth`：
  - `useAuth`（身份状态与游客/正式用户区分）
  - `LoginModal`（邮箱验证码登录）
  - `deviceId` 初始化与持久化
- AI 问诊前端接入新会话机制：
  - 先 `createSession`，再 `sendMessage`
  - 游客额度耗尽时弹出引导登录
  - 命中 20 条兜底后禁用输入并高亮预约入口

### 结果
- 认证、问诊、预约、会诊职责边界更清晰
- 核心转化路径（问诊 -> 登录 -> 预约）前端闭环完成

## 2. 后端 Repository 模式解耦
### 已完成
- 路由层与数据层解耦，路由负责编排，Repository 负责持久化
- 补齐并强化 `modules/*/repo.ts`：
  - `auth`：影子账户查找/创建、正式账户查找/创建、合并函数
  - `appointments`：按邮箱绑定用户、按 token hash 查询
  - `ai`：会话创建、配额计数、消息读写、会话状态更新
- `server/_core/context.ts` 支持 `x-device-id` 回退构建游客身份

### 结果
- 关键业务逻辑可测试、可替换、可演进
- 核心数据操作从路由抽离，降低后续迭代风险

## 3. Passwordless 与 Magic Link 准入改造
### 已完成
- 彻底移除密码路径（数据库与 UI 均无 password 字段）
- 新增无密码认证接口：
  - `requestOtp`
  - `verifyOtpAndMerge`
  - `verifyMagicLink`
- 实现游客到正式账户的数据合并：
  - 预约、就诊消息、会诊相关数据迁移到正式 `userId`
- 前端支持 URL token 劫持登录并清理参数

### 结果
- 支持“先用后登”体验，降低首用摩擦
- 身份升级过程资产不丢失，满足 SaaS 长期沉淀要求

## 4. AI 计费模型升级（商业化核心）
### 已完成
- 新增分层数据模型：
  - `ai_chat_sessions`（完整会诊单元）
  - `ai_chat_messages`（会诊内逐条消息）
- Session 额度拦截：
  - Guest：终身 1 次
  - Free：每天 1 次
  - Pro：不限
- Message 兜底拦截：
  - 单 Session 最多 20 条消息
  - 超限后直接返回预设结束语，不再调用大模型
  - 自动将 Session 标记为 `completed`
- Prompt 强化：要求在 5-8 回合内收敛并明确引导预约

### 结果
- 成本风险可控（限制长尾会话消耗）
- 商业漏斗更稳定（对话末端强引导预约/转化）

## 5. 核心测试补强
### 已完成
- `server/auth.test.ts`
  - 覆盖 `verifyOtpAndMerge` 的数据合并关键断言
- `server/ai-billing.test.ts`
  - 覆盖 `createSession` 中 Guest/Free 配额超限 `FORBIDDEN` 断言

### 结果
- “资产不丢失”与“计费拦截”两条生命线具备回归保护

## 6. 兼容与迁移注意事项
- 任何 `drizzle/schema.ts` 更新后必须生成并执行 PostgreSQL migration：`pnpm db:migrate:safe`
- OTP 当前使用进程内存储（开发态），生产建议迁移到 Redis/DB
- 现有路由与前端已切到新认证与计费模型，避免回退到旧流程

## 最终全局冒烟测试建议
1. 游客首次问诊 -> 正常创建 Session
2. 游客再次新建 Session -> 命中额度限制并弹出登录引导
3. 邮箱 OTP 登录 -> 游客数据成功合并到正式账户
4. Free 用户同日第二次新建 Session -> 命中 `FORBIDDEN`
5. Pro 用户连续创建 Session -> 不受额度限制
6. 同一 Session 连续发到 20 条 -> 触发兜底结束语、会话完成、输入禁用
7. Magic Link 登录链路 -> 成功签发 Cookie 并保留资产归属
