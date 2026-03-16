# PostgreSQL Migration History Strategy

日期：2026-03-15

## Problem

历史上，仓库中的 `drizzle/*.sql` 和 `drizzle/meta/_journal.json` 都还是 **MySQL 时代的迁移历史**。

这带来两个直接后果：

- `pnpm db:migrate` 会尝试把 MySQL SQL 执行到 PostgreSQL 上，必然失败
- PostgreSQL 不能把旧 migration 文件当作有效 bootstrap 路径

## Current Status

这次收口已经完成，当前状态是：

- 旧 MySQL migration 已归档到 `drizzle/archive/mysql/`
- PostgreSQL baseline 已重建为：
  - `drizzle/0000_wooden_onslaught.sql`
  - `drizzle/0001_seed_visit_retention_policies.sql`
- PostgreSQL journal 已重建为 `drizzle/meta/_journal.json`
- Drizzle migration history 已对齐到默认 schema：`drizzle.__drizzle_migrations`

## Result

现在已经不再需要把 PostgreSQL 当成“`db:push` only”的临时状态。

当前推荐规则是：

- brand-new PostgreSQL 数据库：直接使用 `pnpm db:migrate`
- `pnpm db:verify:migrations`：用于校验 baseline、seed migration、关键表、关键索引和默认数据
- 旧 MySQL SQL：只作为归档保留，不再参与 PostgreSQL 主流程

## Team Rule

从现在开始：

- 新 schema 变更继续基于 PostgreSQL baseline 生成新的 migration
- 不要再把新的 migration 混进 `drizzle/archive/mysql/`
- 如果本地数据库是通过 `db:push` 建出来的旧开发库，先运行：
  - `pnpm exec tsx scripts/repair-migration-history.ts`
  - `pnpm db:migrate`
  - `pnpm db:verify:migrations`

## Important Note

- `repair-migration-history.ts` 只对齐 `drizzle.__drizzle_migrations` 记录，不会补建缺失表。
- 如果 migration history 已显示某条 migration 已应用，但 `pnpm db:verify:migrations` 仍报缺表或缺索引，需要补执行缺失 migration 的 SQL，再重新校验。
