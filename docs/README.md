# 项目文档索引

## 根目录
- `README.md` — 项目总览（当前文档）
- `CLAUDE.md` — 会话偏好与上下文规则（如存在）

## docs/changelog/
- `docs/changelog/REFACTOR_CHANGELOG.md` — 重构与发布记录

## docs/implementation/
- `docs/implementation/Project_Folders_Structure_Blueprint.md` — 文件结构与组织约定
- `docs/implementation/appointment_state_machine.md` — 预约与支付状态机
- `docs/implementation/appointment-link-auth.md` — 预约入口鉴权流程
- `docs/implementation/visit-chat-mvp.md` — Visit chat 功能说明
- `docs/implementation/router-boundary-pattern.md` — 路由边界层约定
- `docs/implementation/bilingual-design.md` — 双语内容策略与字段规范
- `docs/implementation/data-hospitals.md` — 医生/医院数据说明

## docs/ops/
- `docs/ops/daily_scrape.md` — 每日医生信息抓取任务说明
- `docs/ops/daily_scrape_prompt.md` — 抓取任务提示词模板
- `docs/ops/resend_rate_limit.md` — Resend 限流规则

## docs/plans/
- `docs/plans/PROJECT_MAP.md` — 系统结构速览
- `docs/plans/todo.md` — 当前开发任务清单

## docs/archive/
- `docs/archive/2026-03-12/token_field_retirement_plan.md`
- `docs/archive/2026-03-12/token_validation_cleanup.md`
- `docs/archive/2026-03-12/token_migration_audit.md`
- `docs/archive/2026-03-12/CURRENT_PROGRESS_SUMMARY.md`
- `docs/archive/2026-03-12/phase1-appointment-payment-refactor.md`
- `docs/archive/2026-03-12/TEST_CHECKLIST.md`

## 规则
- 新文档优先放入 `docs/implementation`、`docs/ops`、`docs/plans`、`docs/changelog`。
- 超过 400 行或超过 90 天未更新的内容优先归档。
