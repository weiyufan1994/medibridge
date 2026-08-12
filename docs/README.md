# 项目文档索引

## 根目录

- `README.md` — 项目总览、启动方式与关键业务约束
- `.context/architecture.md` — 唯一架构与依赖契约
- `AGENTS.md` — 仓库维护与验证规则

## docs/changelog/

- `docs/changelog/REFACTOR_CHANGELOG.md` — 重构与发布记录

## docs/implementation/

- `docs/implementation/appointment_state_machine.md` — 预约与支付状态机
- `docs/implementation/appointment-link-auth.md` — 预约入口鉴权流程
- `docs/implementation/doctor-account-binding.md` — 医生账号绑定
- `docs/implementation/referral-service-v2.md` — 转诊服务实现约束
- `docs/implementation/visit-chat-mvp.md` — Visit chat 功能说明
- `docs/implementation/router-boundary-pattern.md` — 路由边界层约定
- `docs/implementation/bilingual-design.md` — 双语内容策略与字段规范

## docs/ops/

- `docs/ops/daily_scrape.md` — 每日医生信息抓取任务说明
- `docs/ops/production_deploy.md` — 生产部署 runbook
- `docs/ops/resend_rate_limit.md` — Resend 限流规则

## docs/plans/

- `docs/plans/PROJECT_MAP.md` — 系统结构速览
- `docs/plans/2026-Q2-commercialization-roadmap.md` — Q2 商业化执行计划
- `docs/plans/doctor-scheduling-and-safety-design.md` — 医生排班与 AI 急症熔断设计草案
- `docs/plans/2026-03-postgres-migration-audit.md` — MySQL 到 PostgreSQL 迁移审计历史记录（前置判断）
- `docs/plans/postgres-migration-history-strategy.md` — PostgreSQL baseline 与 migration 历史收口现状
- `docs/plans/postgres-local-cutover-checklist.md` — PostgreSQL 本地/测试环境验证清单
- `docs/plans/postgres-cloud-cutover-prep.md` — 云上 PostgreSQL 切换准备 runbook
- `docs/plans/postgres-production-cutover-strategy.md` — PostgreSQL 正式切库执行策略

## docs/archive/

- `docs/archive/2026-03-12/token_field_retirement_plan.md`
- `docs/archive/2026-03-12/token_validation_cleanup.md`
- `docs/archive/2026-03-12/token_migration_audit.md`
- `docs/archive/2026-03-12/CURRENT_PROGRESS_SUMMARY.md`
- `docs/archive/2026-03-12/phase1-appointment-payment-refactor.md`
- `docs/archive/2026-03-12/TEST_CHECKLIST.md`

## 规则

- 新文档优先放入 `docs/implementation`、`docs/ops`、`docs/plans`、`docs/changelog`。
- 架构规则只在 `.context/architecture.md` 定义；其他文档应链接而不是复制一套规则。
- 超过 400 行或超过 90 天未更新的内容优先归档。
