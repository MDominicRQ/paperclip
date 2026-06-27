# SDD Init Report — paperclip

Detected: 2026-06-27  
Executor model: openai/gpt-5.5  
Persistence mode: OpenSpec  
Topic key: `sdd-init/paperclip`

## Sources Read

Primary repo guidance was read in the requested order:

1. `/workspace/paperclip/AGENTS.md`
2. `/workspace/paperclip/doc/GOAL.md`
3. `/workspace/paperclip/doc/PRODUCT.md`
4. `/workspace/paperclip/doc/SPEC-implementation.md`
5. `/workspace/paperclip/doc/DEVELOPING.md`
6. `/workspace/paperclip/doc/DATABASE.md`

Additional detection inputs:

- `/workspace/paperclip/package.json`
- `/workspace/paperclip/pnpm-workspace.yaml`
- `/workspace/paperclip/vitest.config.ts`
- `/workspace/paperclip/server/package.json`
- `/workspace/paperclip/server/vitest.config.ts`
- `/workspace/paperclip/ui/package.json`
- `/workspace/paperclip/ui/vite.config.ts`
- `/workspace/paperclip/ui/vitest.config.ts`
- `/workspace/paperclip/tests/e2e/playwright.config.ts`
- `/workspace/paperclip/.github/workflows/pr.yml`
- `/workspace/paperclip/.atl/skill-registry.md`

## Project Summary

Paperclip is a control plane for autonomous AI companies. One deployment can manage multiple companies, with work organized around company goals, agents/employees, org structure, issues/tasks, comments/documents/work products, approvals, heartbeats, costs, budgets, and audit visibility.

`doc/SPEC-implementation.md` is the concrete V1 build contract and controls V1 behavior when it conflicts with longer-horizon product context.

## Detected Stack

| Area | Detection |
| --- | --- |
| Package manager | pnpm 9.15.4 (`packageManager`, CI setup) |
| Runtime | Node.js 20+ locally (`engines`, docs); CI uses Node 24 (`.github/workflows/pr.yml`) |
| Language | TypeScript, ESM (`type: module`, `moduleResolution: NodeNext`) |
| Backend | Express 5 REST API in `server/`, structured logging via pino/pino-http, validation with Zod/AJV |
| Frontend | React 19, Vite 6, React Router 7, TanStack Query, Tailwind CSS v4, Radix/shadcn-style primitives |
| Database | PostgreSQL via Drizzle ORM; embedded PostgreSQL by default when `DATABASE_URL` is unset; optional Docker/hosted Postgres |
| Tests | Vitest root multi-project config; server tests run in Node with Supertest setup; Playwright e2e/release smoke suites |
| Build | Root `pnpm build` runs workspace preflight then `pnpm -r build` |
| Adapter/plugin model | Built-in workspace adapters plus external plugin loading; adapter packages expose server/UI/CLI surfaces |

## Architecture and Conventions

### Repository shape

- `server/`: Express REST API, auth, orchestration, scheduler/worker behavior, adapter registry.
- `ui/`: React + Vite board UI served by the API server in dev middleware mode.
- `packages/db/`: Drizzle schema, migrations, database clients and migration tooling.
- `packages/shared/`: shared API types, validators, constants, telemetry contracts.
- `packages/adapters/`: built-in local/session/gateway adapter packages.
- `packages/adapter-utils/`: shared adapter types and runtime utilities.
- `packages/plugins/`: plugin SDK, examples, and plugin packages.
- `cli/`: `paperclipai` command-line interface.
- `doc/`: product, operational, database, deployment, and plan documentation.

### Control-plane invariants

Future SDD phases MUST preserve these repo rules unless the spec is intentionally updated:

- Every business/domain entity is company-scoped and routes/services must enforce company boundaries.
- Contracts must stay synchronized across database schema/exports, shared types/constants/validators, server routes/services, and UI API clients/pages.
- Issue/task ownership is single-assignee.
- `in_progress` task transitions require atomic checkout semantics.
- Approval gates govern board-sensitive actions.
- Budget hard stops auto-pause work and prevent new invocations.
- Mutating actions write activity log entries.
- API endpoints live under `/api` and use consistent HTTP errors (`400/401/403/404/409/422/500`).
- Board access is full-control operator context; agent access uses bearer API keys scoped to one company.

### Documentation conventions

- Do not replace strategic docs wholesale unless explicitly asked; prefer additive updates.
- Keep `doc/SPEC.md` and `doc/SPEC-implementation.md` aligned when behavior changes.
- Repo plan docs belong in `doc/plans/YYYY-MM-DD-slug.md` unless a Paperclip issue plan document is requested.
- PR descriptions must follow `.github/PULL_REQUEST_TEMPLATE.md` and include the exact model used.

### Database workflow

When changing the data model:

1. Edit `packages/db/src/schema/*.ts`.
2. Export new tables from `packages/db/src/schema/index.ts`.
3. Generate migration with `pnpm db:generate`.
4. Validate compile with `pnpm -r typecheck`.

`packages/db/drizzle.config.ts` reads compiled schema from `dist/schema/*.js`, and `pnpm db:generate` compiles `packages/db` first.

## Strict TDD Decision

**Strict TDD Mode: enabled.**

Evidence:

- No existing `openspec/config.yaml` or explicit strict-TDD marker was present before initialization.
- The root package has a stable default test command: `pnpm test`, delegating to `pnpm test:run` and `scripts/run-vitest-stable.mjs`.
- Root `vitest.config.ts` enumerates test projects for shared packages, db, adapter utils, adapters, plugin SDK, server, UI, and CLI.
- Server Vitest config uses Node environment, Supertest setup, and serialized execution safeguards for integration-heavy tests.
- Product spec requires unit, integration, e2e, and regression coverage for control-plane behavior.
- Per the sdd-init decision gate, when no explicit marker exists but a test runner exists, strict TDD defaults to true.

Operational interpretation:

- Use RED-GREEN-REFACTOR for implementation phases where behavior is testable.
- Start with the smallest targeted check that proves the change.
- Keep Playwright browser suites opt-in unless the change touches browser/release flows or explicit CI/release verification.

## Testing Capability Summary

See `testing-capabilities.md` for the cached testing table. Key commands:

- Default local/agent test: `pnpm test`
- Interactive Vitest: `pnpm test:watch`
- Browser e2e: `pnpm test:e2e`
- Release smoke browser suite: `pnpm test:release-smoke`
- Typecheck: `pnpm -r typecheck`
- Build: `pnpm build`
- PR-ready broad verification: `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`

No lint, formatter, or coverage script was detected in root manifests.

## Skill Resolution Summary

Skill resolution mode: `paths-injected`.

- Project skills were found under `/workspace/paperclip/skills/`, `/workspace/paperclip/.agents/skills/`, and `/workspace/paperclip/.claude/skills/`.
- No `/workspace/paperclip/.opencode/` directory or `opencode.json*` file was found.
- User/global OpenCode skills are available under `/home/developer/.config/opencode/skills/`.
- `.atl/skill-registry.md` is the cached non-SDD skill index.
- SDD phase skills are available as user/global OpenCode skills and are listed in `skill-resolution.md` for orchestrator handoff.

## Detected Risks / Drift

- `AGENTS.md` says the fork branch should have no built-in Hermes dependency and no built-in `hermes_local` registration, but the current `server/package.json` and `ui/package.json` still list `hermes-paperclip-adapter`. Treat this as documentation/manifest drift to verify before adapter-related changes.
- `AGENTS.md` says dev uses embedded PGlite, while `doc/DEVELOPING.md`, `doc/DATABASE.md`, and manifests point to embedded PostgreSQL via `embedded-postgres`. Treat `doc/DATABASE.md` as the operational database source unless maintainers clarify the naming drift.
- No lint/formatter command is configured at the root; future phases should not claim lint/format verification unless they add or identify a project-specific command.

## Artifacts Written

- `openspec/config.yaml`
- `openspec/changes/sdd-init/paperclip/sdd-init-paperclip.md`
- `openspec/changes/sdd-init/paperclip/testing-capabilities.md`
- `openspec/changes/sdd-init/paperclip/skill-resolution.md`
- `openspec/specs/.gitkeep`
- `openspec/changes/archive/.gitkeep`
- `.atl/skill-registry.md`

## Next Recommended Phase

Run `/sdd-new <change-name>` or `/sdd-explore <change-name>` for the next real change. This bootstrap did not start planning or implementation work.
