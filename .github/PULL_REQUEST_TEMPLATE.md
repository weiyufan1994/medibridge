# PR Checklist

## Architecture and boundary checks
- [ ] 文件位置符合 `.context/architecture.md` 的放置规则。
- [ ] 路由与模块边界未回退：`server/routers/*` 仅通过 `../modules/<module>/routerApi` 引用模块。
- [ ] `client/src/features` 未直接 import `@/pages/**`。
- [ ] 检查并确认 `server/core` 与 `client/src/layout` 均已清理，若仍有遗留文件请在 PR 说明且给出消除计划。

## Test and validation
- [ ] 已执行 `pnpm test:router-boundary`。
- [ ] 已执行 `pnpm lint:imports`。
- [ ] 已执行 `pnpm check`（或确认仅受已知兼容影响）。
- [ ] 如有新增/改动业务路由与管理员接口，已补充/更新对应测试。

## Change summary
- 变更文件：
  - [ ] 列出关键文件

## Risk and follow-up
- [ ] 回归风险已说明（如跨文件目录迁移/导入重构）。
- [ ] 是否涉及兼容性策略（迁移期文件清理）以及回滚方案。
