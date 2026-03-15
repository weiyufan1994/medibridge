# PostgreSQL Migration Audit

日期：2026-03-15

## 状态更新

这份文档记录的是**迁移前审计结论**。自这次审计之后，下面这些事项已经完成：

- 运行时数据库驱动已切到 PostgreSQL
- `drizzle/schema.ts` 已迁到 PostgreSQL 方言
- 本地开发库已切到 PostgreSQL：`medibridge_dev`
- 医生基础数据、specialty tags、embeddings 已在本地 PostgreSQL 回填
- 医生搜索/推荐、AI 分诊、预约创建、admin 基础查询已在本地 PostgreSQL 验证通过
- PostgreSQL baseline migration 已重建
- MySQL migration 历史已归档到 `drizzle/archive/mysql/`

当前仍未完成的不是“本地 PostgreSQL 适配”，而是：

- 云上 PostgreSQL 测试环境落地
- 生产 RDS PostgreSQL 准备
- 生产切流与回滚演练

因此，阅读这份文档时请按下面方式理解：

- 文中标记为“MySQL 耦合点”的大部分问题，很多已经在代码层完成整改
- 这份文档现在更适合被当作**迁移审计历史记录**，而不是当前实施状态的唯一事实来源
- 当前实施状态应同时参考：
  - [postgres-migration-history-strategy.md](/Users/ich/projects/personal/medibridge/docs/plans/postgres-migration-history-strategy.md)
  - [postgres-local-cutover-checklist.md](/Users/ich/projects/personal/medibridge/docs/plans/postgres-local-cutover-checklist.md)
  - [postgres-production-cutover-strategy.md](/Users/ich/projects/personal/medibridge/docs/plans/postgres-production-cutover-strategy.md)

## 结论

MediBridge 当前**适合做 PostgreSQL 迁移准备**，原因是：

- 生产环境已经运行，但当前库中缺少高价值、难迁移的核心业务数据
- 后续明确要做 RAG、知识库、排班、审计，PostgreSQL 更适合作为长期底座
- 线上数据库已经是独立的 AWS RDS，而不是嵌入式本机数据库，具备独立替换条件

但这不是一次“切驱动即可”的轻量切换。当前项目对 MySQL 的耦合是**全栈级别**的：

- 数据库驱动层
- Drizzle schema 定义层
- Repo 查询层
- 错误码处理层
- 离线脚本层
- 迁移与部署配置层
- 测试桩数据层

因此，迁移应作为一个正式的小项目推进，而不是顺手重构。

建议判断：

- **是否值得迁：值得**
- **是否适合马上裸迁：不适合**
- **建议下一步：先做受控迁移，再切流**

## 当前线上状态摘要

本次只读云端审计确认：

- 应用运行在 EC2 `i-0c9bfbb5287d85ccf`
- 数据库为 AWS RDS MySQL `medibridge-prod-db`
- RDS 引擎版本：MySQL 8.4.7
- 当前应用运行时 `DATABASE_URL` 指向该 RDS 实例
- 当前生产资源占用较轻，具备底层替换窗口

这意味着：

- 现在已经不是“完全未上线”的空白环境
- 但仍然属于“可以接受结构性底座迁移”的阶段

## 审计范围

本次审计覆盖：

- `server/db.ts`
- `drizzle/schema.ts`
- `drizzle.config.ts`
- `server/modules/*`
- `scripts/*`
- 线上运行态与 RDS 现状

## 一、数据库接入层耦合

### 1. 驱动和 drizzle 方言直接绑定 MySQL

文件：

- [server/db.ts](/Users/ich/projects/personal/medibridge/server/db.ts)
- [drizzle.config.ts](/Users/ich/projects/personal/medibridge/drizzle.config.ts)

当前状态：

- 使用 `drizzle-orm/mysql2`
- 使用 `mysql2`
- `drizzle.config.ts` 的 `dialect` 明确写死为 `mysql`

影响：

- PostgreSQL 迁移必须替换：
  - `drizzle-orm/mysql2` -> PostgreSQL 驱动
  - `mysql2` -> `pg` 或 `postgres`
  - drizzle dialect -> `postgresql`

复杂度：**低**

这部分改动不难，但它只是迁移入口，不是主要成本。

### 2. 时区初始化逻辑使用 MySQL 会话语义

文件：

- [server/db.ts](/Users/ich/projects/personal/medibridge/server/db.ts)

当前状态：

- 连接建立后执行 `SET time_zone = '+00:00'`

影响：

- PostgreSQL 中应改为等价的时区初始化方式
- 需要重新确认数据库 session 时区与应用层 UTC 约定

复杂度：**低**

## 二、Schema 层耦合

### 1. 整个 schema 基于 mysql-core

文件：

- [drizzle/schema.ts](/Users/ich/projects/personal/medibridge/drizzle/schema.ts)

当前状态：

- 使用 `mysqlTable`
- 使用 `mysqlEnum`
- 字段类型来自 `drizzle-orm/mysql-core`

影响：

- 全表定义需要迁移到 PostgreSQL 对应类型
- enum 定义、主键、自增、时间字段都需要整体替换

复杂度：**高**

这是迁移的主战场之一。

### 2. 向量数据当前存在 JSON 字段中

文件：

- [drizzle/schema.ts](/Users/ich/projects/personal/medibridge/drizzle/schema.ts)

涉及表：

- `doctorEmbeddings.embedding`

当前状态：

- 向量以 `json` 形式存储

影响：

- 如果迁 PostgreSQL 同时上 `pgvector`，这是一个好机会
- 可将向量字段从 `json` 升级为真正的 vector 类型
- 也可以先保持 JSON/array 兼容，二阶段再上 `pgvector`

复杂度：

- **仅迁 PostgreSQL：中**
- **同时引入 pgvector：中高**

建议：

- 若迁库，建议顺手规划 `pgvector`
- 但不要强求第一天就把所有向量链路完全重构完

## 三、Repo 与查询层耦合

### 1. 插入结果依赖 MySQL `insertId`

文件示例：

- [server/modules/ai/repo.ts](/Users/ich/projects/personal/medibridge/server/modules/ai/repo.ts)
- [server/modules/visit/actions.ts](/Users/ich/projects/personal/medibridge/server/modules/visit/actions.ts)
- [server/modules/visit/realtimeGateway.ts](/Users/ich/projects/personal/medibridge/server/modules/visit/realtimeGateway.ts)
- [server/modules/appointments/checkoutActions.ts](/Users/ich/projects/personal/medibridge/server/modules/appointments/checkoutActions.ts)

当前状态：

- 多处代码直接解析 `insertId`
- 部分地方已经有 fallback lookup，但仍以 MySQL 返回头为主

影响：

- PostgreSQL 默认不会返回 MySQL 风格的 `insertId`
- 需要统一改成：
  - `returning()`
  - 或显式查询回查

复杂度：**中高**

这是迁移中最容易遗漏、但又最容易造成功能异常的部分。

### 2. 更新/删除结果依赖 `affectedRows`

文件示例：

- [server/modules/appointments/repo.ts](/Users/ich/projects/personal/medibridge/server/modules/appointments/repo.ts)
- [server/modules/admin/repo.ts](/Users/ich/projects/personal/medibridge/server/modules/admin/repo.ts)
- [scripts/backfill-legacy-appointment-tokens.ts](/Users/ich/projects/personal/medibridge/scripts/backfill-legacy-appointment-tokens.ts)

当前状态：

- 自定义解析器直接读取 `affectedRows`

影响：

- PostgreSQL 返回语义不同
- 需要统一封装一层“受影响行数提取”

复杂度：**中**

建议：

- 在迁库前先抽一个数据库适配层，避免业务代码继续散落读取 `affectedRows`

### 3. 使用 MySQL 特有 SQL 语义

文件示例：

- [server/modules/appointments/repo.ts](/Users/ich/projects/personal/medibridge/server/modules/appointments/repo.ts)
- [server/modules/admin/repo.ts](/Users/ich/projects/personal/medibridge/server/modules/admin/repo.ts)

当前状态：

- 使用 `timestampdiff`
- 使用 `values(...)`

影响：

- 这些语义需要重写为 PostgreSQL 等价表达

复杂度：**中**

其中高风险点：

- token cooldown
- retention policy upsert

### 4. 使用 `onDuplicateKeyUpdate`

文件示例：

- [server/modules/auth/repo.ts](/Users/ich/projects/personal/medibridge/server/modules/auth/repo.ts)
- [server/modules/admin/repo.ts](/Users/ich/projects/personal/medibridge/server/modules/admin/repo.ts)
- [server/modules/appointments/repo.ts](/Users/ich/projects/personal/medibridge/server/modules/appointments/repo.ts)
- [scripts/import-doctors.mjs](/Users/ich/projects/personal/medibridge/scripts/import-doctors.mjs)
- [scripts/backfill-doctor-specialty-tags.ts](/Users/ich/projects/personal/medibridge/scripts/backfill-doctor-specialty-tags.ts)

影响：

- 虽然 PostgreSQL 有 upsert 语义，但写法和行为边界不同
- 所有 upsert 相关逻辑都需要复核

复杂度：**中**

### 5. 基于 MySQL 错误码做分支逻辑

文件示例：

- [server/modules/visit/actions.ts](/Users/ich/projects/personal/medibridge/server/modules/visit/actions.ts)
- [server/modules/visit/realtimeGateway.ts](/Users/ich/projects/personal/medibridge/server/modules/visit/realtimeGateway.ts)
- [server/stripeWebhookRoute.ts](/Users/ich/projects/personal/medibridge/server/stripeWebhookRoute.ts)
- [server/paypalWebhookRoute.ts](/Users/ich/projects/personal/medibridge/server/paypalWebhookRoute.ts)

当前状态：

- 直接判断：
  - `ER_DUP_ENTRY`
  - `ER_NO_REFERENCED_ROW_2`

影响：

- PostgreSQL 错误码完全不同
- 需要抽象为数据库无关错误类别：
  - duplicate
  - foreign_key_violation
  - unique_conflict

复杂度：**中**

## 四、脚本层耦合

### 1. 多个导入/翻译/校验脚本直接依赖 mysql2

文件示例：

- [scripts/import-doctors.mjs](/Users/ich/projects/personal/medibridge/scripts/import-doctors.mjs)
- [scripts/vectorize-doctors.mjs](/Users/ich/projects/personal/medibridge/scripts/vectorize-doctors.mjs)
- [scripts/translate-bilingual.ts](/Users/ich/projects/personal/medibridge/scripts/translate-bilingual.ts)
- [scripts/repair-migration-history.ts](/Users/ich/projects/personal/medibridge/scripts/repair-migration-history.ts)
- [scripts/verify-migrations.ts](/Users/ich/projects/personal/medibridge/scripts/verify-migrations.ts)
- [scripts/add-hospital-links.mjs](/Users/ich/projects/personal/medibridge/scripts/add-hospital-links.mjs)
- [scripts/translate-doctors.mjs](/Users/ich/projects/personal/medibridge/scripts/translate-doctors.mjs)

影响：

- 这些脚本要么改 PostgreSQL 驱动
- 要么通过应用内统一 DB 接入复用，减少双套数据库接入方式

复杂度：**高**

这是迁移项目里经常被忽略的一层。线上服务迁完不代表离线链路就能跑。

## 五、测试层耦合

### 1. 测试桩直接模拟 MySQL 返回结构

文件示例：

- [server/visit.test.ts](/Users/ich/projects/personal/medibridge/server/visit.test.ts)
- [server/modules/visit/realtimeGateway.test.ts](/Users/ich/projects/personal/medibridge/server/modules/visit/realtimeGateway.test.ts)
- [server/appointments.test.ts](/Users/ich/projects/personal/medibridge/server/appointments.test.ts)

当前状态：

- mock 里存在 `insertId`
- mock 里存在 MySQL duplicate error code

影响：

- 测试层要跟着一起迁
- 否则会出现代码已经适配 PostgreSQL，但测试还在验证旧语义

复杂度：**中**

## 六、部署与运行配置耦合

### 1. 环境与部署默认假设 MySQL URL

文件：

- [drizzle.config.ts](/Users/ich/projects/personal/medibridge/drizzle.config.ts)
- [.env.development](/Users/ich/projects/personal/medibridge/.env.development)
- [.env.production](/Users/ich/projects/personal/medibridge/.env.production)

当前状态：

- 开发环境示例为 MySQL URL
- 生产运行时也是 RDS MySQL

影响：

- 迁移时不仅要改代码，还要新建：
  - RDS PostgreSQL
  - 新的 parameter / env
  - 新的网络访问策略

复杂度：**中**

## 七、风险分级

### 低风险

- `server/db.ts` 驱动替换
- `drizzle.config.ts` dialect 切换
- 环境变量改为 PostgreSQL URL

### 中风险

- `onDuplicateKeyUpdate` 迁移
- `insertId`/`affectedRows` 改造
- MySQL 错误码替换
- 典型 repo 查询改造

### 高风险

- `drizzle/schema.ts` 全量迁移
- 所有离线数据脚本迁移
- 生产数据迁移与切流
- 同步引入 `pgvector` 时的 schema 和检索链路改造

## 八、是否建议同时引入 pgvector

建议：**是，但分阶段**

推荐分法：

### Phase A: 先完成数据库迁移

- MySQL -> PostgreSQL
- 保持现有 `doctorEmbeddings.embedding` 兼容形态
- 确保业务稳定

### Phase B: 再引入 pgvector

- 新增 vector 字段
- 补向量索引
- 逐步把医生向量检索迁到 PostgreSQL 向量检索
- 未来再把 triage knowledge RAG 放进统一底座

原因：

- 这样可避免数据库迁移与检索逻辑重写同时发生
- 风险更可控

## 九、推荐迁移路径

### Step 1：先做代码适配层收敛

在正式迁移前，先抽象以下通用能力：

- 插入结果提取
- 更新结果提取
- DB 错误分类

目标：

- 先把业务代码从 MySQL 头信息和错误码里解耦

### Step 2：迁移 schema 到 PostgreSQL 方言

- 新建 PostgreSQL 版 Drizzle schema
- 生成 PostgreSQL migration
- 在本地起 PostgreSQL 做验证

### Step 3：迁移 repo 层高耦合逻辑

优先处理：

- `appointments/repo.ts`
- `visit/actions.ts`
- `visit/realtimeGateway.ts`
- `auth/repo.ts`
- `ai/repo.ts`

### Step 4：迁移脚本

优先处理：

- `import-doctors`
- `translate-bilingual`
- `vectorize-doctors`
- migration 校验/修复脚本

### Step 5：准备新 RDS PostgreSQL

- 创建新实例
- 配安全组
- 配备份和删除保护
- 建基础数据库

### Step 6：导入医生基础数据

因为当前重要数据不多，可采用更简单策略：

- 新库初始化
- 重新跑导入脚本
- 重新跑翻译与向量化脚本

### Step 7：切换应用

- 更新 `DATABASE_URL`
- 跑迁移
- 验证关键链路

## 十、我的建议

综合判断：

### 值得现在迁

原因：

- 当前数据包袱轻
- 未来需求更适合 PostgreSQL
- 现在迁移成本显著低于未来

### 但不要直接开改生产

建议先做两个前置动作：

1. 本地或测试环境先完成 PostgreSQL 适配
2. 建立新的 PostgreSQL RDS，再导入现有医生数据做演练

## 十一、建议的下一步

如果继续推进，我建议按下面顺序做：

1. 先出 PostgreSQL 目标 schema 草案
2. 再做 MySQL 语义解耦改造
3. 再新建 PostgreSQL RDS 演练导入
4. 最后再切应用

## 十二、我可以继续帮你做什么

下一步最合适的是下面两个方向之一：

1. 直接产出 PostgreSQL 改造任务清单
2. 直接开始做 PostgreSQL 版 schema 与 DB 接入改造

建议先做 1，再做 2。
