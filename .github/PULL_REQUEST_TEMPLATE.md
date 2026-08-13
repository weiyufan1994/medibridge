# PR Checklist

## Architecture and boundary checks

- [ ] 文件位置符合 `.context/architecture.md` 的放置规则。
- [ ] 路由与模块边界未回退：路由仅依赖 `_core/trpc`、所属模块 `routerApi.ts` 或 application workflow。
- [ ] 跨模块依赖仅使用目标模块 `publicApi.ts`；workflow 未深层导入模块内部实现。
- [ ] `client/src/features` 未直接 import `@/pages/**`。
- [ ] 检查并确认 `server/core` 与 `client/src/layout` 均已清理，若仍有遗留文件请在 PR 说明且给出消除计划。

## Test and validation

- [ ] 已执行 `pnpm format:check`、`pnpm lint` 与 `pnpm check:secrets`。
- [ ] 已执行 `pnpm check:architecture`（`pnpm lint:imports` 为兼容别名）。
- [ ] 已执行 `pnpm test:router-boundary`。
- [ ] 已执行 `pnpm check` 与 `pnpm check:i18n:inline`。
- [ ] 已执行 `pnpm test:coverage`，且没有新增/扩大风险覆盖率例外。
- [ ] 已执行 `pnpm build` 与 `pnpm audit --prod --audit-level high`。
- [ ] 如有新增/改动业务路由与管理员接口，已补充/更新对应测试。

## Change summary

- 变更文件：
  - [ ] 列出关键文件

## Risk and follow-up

- [ ] 回归风险已说明（如跨文件目录迁移/导入重构）。
- [ ] 是否涉及兼容性策略（迁移期文件清理）以及回滚方案。
