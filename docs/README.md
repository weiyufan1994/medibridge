# 项目文档索引

## 根目录
- `README.md` — 项目总览（当前文档）
- `CLAUDE.md` — 会话偏好与上下文规则（如存在）

## docs/implementation/
- `docs/implementation/appointment_state_machine.md` — 预约与支付状态机
- `docs/implementation/appointment-link-auth.md` — 预约入口鉴权流程
- `docs/implementation/visit-chat-mvp.md` — Visit chat 功能说明
- `docs/implementation/router-boundary-pattern.md` — 路由边界层约定
- `docs/implementation/bilingual-design.md` — 双语内容策略与字段规范

## docs/ops/
- `docs/ops/daily_scrape.md` — 每日医生信息抓取任务说明
- `docs/ops/resend_rate_limit.md` — Resend 限流规则

## docs/plans/
- `docs/plans/PROJECT_MAP.md` — 系统结构速览

## 规则
- 新文档优先放入 `docs/implementation`、`docs/ops`、`docs/plans`、`docs/changelog`。
- 超过 400 行或超过 90 天未更新的内容优先归档。
