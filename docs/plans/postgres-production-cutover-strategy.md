# PostgreSQL Production Cutover Strategy

日期：2026-03-15

> 配套准备文档：`docs/plans/postgres-cloud-cutover-prep.md`

## Goal

将 MediBridge 从当前 MySQL 主库切换到 PostgreSQL，且不在一期同时引入 `pgvector`。

## Current Baseline

当前本地验证已完成：

- PostgreSQL 本地库 `medibridge_dev` 已创建
- 当前 schema 已通过 PostgreSQL baseline migration 成功落库
- 基础数据已导入：
  - hospitals: 3
  - departments: 66
  - doctors: 1397
  - doctor_specialty_tags: 1466
  - doctorEmbeddings: 1397
- 医生列表、搜索、推荐链路已经在 PostgreSQL 上验证通过
- brand-new PostgreSQL smoke DB 已验证可直接执行 `pnpm db:migrate`

## Key Decision

生产切库采用：

- **新 PostgreSQL 库初始化**
- **重新导入基础医生数据**
- **重新回填 specialty tags / bilingual / embeddings**
- **应用连接串切换**

不采用：

- 双写
- 增量同步
- 直接执行旧 MySQL migration SQL

## Why This Strategy

原因是当前生产环境中的高价值数据负担仍然较轻，且医生基础数据可重建。  
与其做一次复杂的数据转换迁移，不如把 PostgreSQL 当成新的权威起点。

## Recommended Sequence

### 1. Prepare PostgreSQL RDS

- 创建新的 PostgreSQL RDS
- 开启自动备份
- 开启删除保护
- 配置安全组，仅允许应用实例访问
- 建立目标数据库，例如 `medibridge_prod`

### 2. Apply Baseline Schema

- 不使用旧 MySQL migration SQL
- 使用当前 PostgreSQL schema 作为 baseline
- 在目标数据库执行 `pnpm db:migrate`

### 3. Seed and Backfill

按顺序执行：

1. `pnpm import:doctors`
2. `pnpm exec tsx scripts/backfill-doctor-specialty-tags.ts`
3. `pnpm translate:bilingual`
4. `pnpm vectorize:doctors`

### 4. Verification Before Traffic

必须验证：

- `pnpm check`
- 核心回归测试
- `pnpm verify:doctors:postgres`
- 本地/测试环境的真实医生搜索与推荐
- 支付、预约、visit room 核心链路

### 5. Production Cutover

- 更新生产 `DATABASE_URL`
- 保留原 MySQL 配置但不再作为主连接
- 发布 PostgreSQL 版本应用
- 执行 smoke test：
  - health check
  - hospitals list
  - doctor search
  - doctor recommend
  - appointment create
  - token access

### 6. Stabilization Window

- 观察至少一个完整验证周期
- 期间保留 MySQL 回滚路径
- 确认无阻塞问题后再考虑退役 MySQL

## Rollback Rule

切流后如果出现以下问题，应立即回滚到 MySQL：

- 应用无法启动或连接池不稳定
- 医生搜索/推荐明显异常
- 预约创建失败
- visit room 消息写入失败
- 后台关键列表查询失败

回滚方式：

- 恢复原生产 `DATABASE_URL`
- 重新发布 MySQL 版本应用

## Exit Criteria

满足以下条件，才算 PostgreSQL 一期切库完成：

- 生产应用以 PostgreSQL 为主库运行
- 医生目录与推荐链路稳定
- 预约与 visit 主链路可用
- 生产日志无持续数据库错误
- MySQL 不再承担主写入职责
