# PROJECT_MAP

## 1分钟快速了解系统全貌

1. 线上业务主链路是：`client` 发起 `trpc.xxx` 请求 -> `server/routers` 声明边界 -> `server/modules/*/routerApi.ts` 或 `server/workflows` -> 模块 action/repository -> PostgreSQL。
2. 线下数据主链路是：`scripts` 抓取/清洗/翻译/向量化 -> 产出到 `data` 与数据库 -> 供线上检索与推荐使用。
3. `shared` 只放前后端共用类型与常量，避免双端各写一份。
4. `drizzle` 是数据库结构与迁移真相源（schema + migration），业务逻辑不放这里。
5. 唯一架构契约是 [`.context/architecture.md`](../../.context/architecture.md)，本文只提供导航。

## 核心目录职责边界

### `client/`（前端应用层）

- 职责：React 页面、组件、状态与交互。
- 关键入口：`client/src/main.tsx`（挂载 React + tRPC client）、`client/src/App.tsx`（路由）。
- 数据边界：不直接连数据库，只通过 `client/src/lib/trpc.ts` 调 `AppRouter`。
- 约束：页面只负责路由参数、权限守卫和 feature 组合；跨 feature 依赖通过 `@/features/<feature>` 根入口。

### `server/`（在线业务与 API 层）

- 职责：tRPC/HTTP 边界、应用 workflow、领域 action 和 repository。
- 关键入口：`server/_core/index.ts`（Express + `/api/trpc` 挂载）。
- `server/routers/`：薄路由声明、输入输出 schema 和权限绑定。
- `server/modules/`：领域 action、schema、模块自有 repository；路由只使用 `routerApi.ts`，其他模块/workflow 只使用 `publicApi.ts`。
- `server/workflows/`：跨域事务与编排，只依赖参与模块的 `publicApi.ts`。
- `server/_core/`：启动、tRPC/context、auth/session/cookie 和外部服务适配器；除 composition root 外不依赖业务模块。
- `server/db.ts`：共享数据库连接基础设施，不是业务查询入口。

### `shared/`（双端共享契约）

- 职责：前后端共享常量、错误定义、类型导出。
- 典型文件：`shared/const.ts`、`shared/types.ts`。
- 价值：保证前后端对同一业务字段/错误码理解一致。

### `drizzle/`（数据库模型与迁移）

- 职责：Drizzle schema、relations、历史迁移 SQL 与快照。
- 典型文件：`drizzle/schema.ts`、`drizzle/*.sql`、`drizzle/meta/*`。
- 边界：只定义“数据结构是什么”，不写“业务怎么跑”。

## 两条数据流（必须区分）

### A. 离线数据处理流（Scraper -> Data -> DB/Vector）

1. 抓取/整理：`docs/ops/daily_scrape.md`、`scripts/track_progress.py` 等处理来源数据。
2. 落地文件：原始/中间结果进入 `data/`（医院/科室 Excel 与 JSON）。
3. 导入数据库：`scripts/import-doctors.mjs` 将结构化数据写入 PostgreSQL。
4. 翻译增强：`scripts/translate-bilingual.ts`、`scripts/translate-doctors.mjs` 生成英文镜像字段。
5. 向量化：`scripts/vectorize-doctors.mjs` 写入 doctor embeddings，供语义检索。

### B. 在线业务流（Client -> tRPC -> DB）

1. 用户在 `client` 页面触发查询/提交（如 triage、hospital、doctor、appointment）。
2. `client/src/lib/trpc.ts` 基于 `AppRouter` 调用 `/api/trpc`。
3. `server/routers/*` 完成 validation/permission 绑定，并委托模块 `routerApi.ts` 或 application workflow。
4. action/workflow 通过模块自有 repository 读写 PostgreSQL，并把稳定结果返回路由。

## 新同学最常见改动入口

1. 改页面交互：从对应 `client/src/features/<feature>` 开始，页面只做组合。
2. 改 API 能力：从对应 `server/routers/<domain>.ts` 和模块 `routerApi.ts` 开始。
3. 改查询行为：在数据所属模块的 repository 中调整，跨模块调用使用 `publicApi.ts`。
4. 改数据结构：先改 `drizzle/schema.ts`，再执行迁移与回归检查。
5. 跑离线数据任务：看 `scripts/`，数据产物在 `data/`。

## 一句话记忆

- `client/server` 解决“线上用户现在要用什么”。
- `scripts/data` 解决“线下数据如何持续生产与更新”。
