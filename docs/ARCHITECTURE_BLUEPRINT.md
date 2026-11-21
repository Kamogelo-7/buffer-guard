# Janu-worry MVP: Architecture Blueprint

Planning document, 22 November 2026. Architecture only: no feature or UI code.

## 0. Scope, assumptions and risks

**Goal:** a history-tracked budgeting app that (a) learns how item prices behave across up to 5 years, (b) models November/December spending against an untouchable January reserve, and (c) warns when a current price or spend deviates from history.

**Assumptions**
- Single user first, but every table and query is user-scoped so multi-tenant is free later.
- Default currency ZAR, timezone Africa/Johannesburg.
- Price history is entered manually or via CSV import. Historical spend is entered at monthly grain.
- Engines are deterministic: same inputs always give the same outputs.

**Risks flagged up front**
1. **Data entry burden.** Five years of history by hand will kill the app. CSV import and quick-add are MVP features, not extras.
2. **No SA retailer price API.** Do not plan scraping. The data moat is your own logged history.
3. **The reserve is a commitment device, not a lock.** The app cannot stop a bank card. 'Untouchable' means the engine refuses to count reserve money as spendable and makes overrides slow and logged.
4. **Over-engineering.** Build engines as pure functions with fixtures first. If an engine cannot be tested without a database, the boundary is wrong.

## 1. Architecture decisions

| Decision | Choice | Trade-off | Revisit when |
| :--- | :--- | :--- | :--- |
| **Data access** | Prisma for all data; supabase-js for auth only | Prisma gives migrations, typed BigInt/Decimal and transactions, but connects as a DB role that bypasses RLS. So every repository method takes a mandatory `userId`, and RLS stays enabled as defence in depth. | You add realtime or client-side queries |
| **Money** | Integer cents (`BIGINT`) in DB, `Money` class over `bigint` in code. Percentages as integer basis points (1% = 100 bps). | Slightly more ceremony than `number`, but zero floating-point drift across multi-year sums. | Multi-currency |
| **Engines** | Pure functions in `engines/`, no I/O, versioned | Services must load data first. Worth it: engines become trivially testable. | Engine runtime exceeds request budget |
| **Background work** | Vercel Cron plus `after()` on writes, idempotent recompute stored in `engine_runs` | Serverless has no daemon, so 'background' means scheduled plus post-response jobs. | Compute gets heavy: move to a Supabase Edge Function or queue |
| **State** | Server data stays on the server (RSC, `React.cache`, Suspense). Context only for UI state (selected year, scenario toggle). | No client cache layer to sync. | Heavy client interactivity |
| **Validation** | Zod at every boundary: form to action, DB row to domain, env | Small runtime cost, large safety win. | Never |
| **Errors** | `Result<T, AppError>` for expected failures, throw only for bugs, error boundary per route segment | Discipline needed at call sites. | Never |
| **Next.js version** | Pin the current stable at scaffold time. From 15 on, `cookies()`, `headers()` and `params` are async. | Avoid copying 14-era snippets blindly. | Major upgrades |

## 2. Layering and dependency rules

```
app/            routes, RSC pages, error boundaries (thin)
  features/     per-module UI, actions, queries, view-models
    services/   orchestration: load -> compute -> persist
      engines/  PURE, deterministic, versioned
      repositories/  the only place Prisma is imported
domain/         Money, types, Zod schemas, errors (imported by all, imports nothing)
```

**Rules (enforced in CI, not by good intentions)**
1. `engines/` may import only from `domain/`. No Prisma, no `fetch`, no `Date.now()` (the clock is an input).
2. Only `repositories/` imports Prisma. Repositories return domain types, never Prisma rows.
3. Components never import services or repositories. They call `features/*/queries.ts` (server) or `actions.ts` (mutations).
4. Server actions are thin: authenticate, validate, call a service, return `ActionResult`, revalidate.
5. Features do not import each other. Shared vocabulary lives in `domain/`.
6. Enforce with `eslint-plugin-boundaries` plus `dependency-cruiser` in CI. A rule violation fails the build.
7. No barrel files (`index.ts` re-exports): they bloat bundles. Import from the file directly.
