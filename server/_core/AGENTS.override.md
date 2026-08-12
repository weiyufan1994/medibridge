# Core Runtime Safety Rules

These rules apply to `server/_core/*` in addition to the repository-level
instructions.

- Treat authentication, session parsing, cookies, request context, OAuth, and
  token transport as high-risk boundaries. Change one risk point per PR and
  preserve current error, expiry, revocation, and fallback semantics.
- Keep `server/_core/index.ts` as the composition root. No other core file may
  import a business module or router.
- Convert Express requests to project-owned DTOs before entering workflows or
  domain actions. Do not leak Express types into module APIs.
- Validate all values at the boundary and preserve existing permission checks.
  Never accept identity, role, or ownership claims from untrusted request
  fields when a verified session or token is required.
- Cookies carrying session or access state must retain their established
  `httpOnly`, `secure`, `sameSite`, domain, path, and expiry behavior unless a
  dedicated security change explicitly documents and tests the transition.
- Use the structured logger. Never log authorization headers, cookies, tokens,
  email addresses, database URLs, API keys, request bodies, or upstream
  response bodies. Prefer IDs, status codes, counts, and error class names.
- Keep provider secrets server-only. Do not expose them through `VITE_*`, URLs,
  client payloads, error responses, or test snapshots.
- Required verification for touched auth/session/cookie/context behavior:
  focused Vitest coverage, `pnpm check`, `pnpm check:architecture`,
  `pnpm lint:imports`, and `pnpm test:router-boundary` when the HTTP/tRPC edge
  changes.
