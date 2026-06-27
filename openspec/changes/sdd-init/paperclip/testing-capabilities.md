# Testing Capabilities

**Strict TDD Mode**: enabled  
**Detected**: 2026-06-27  
**Project**: paperclip

## Test Runner

- Command: `pnpm test`
- Framework: Vitest
- Script path: root `package.json` → `pnpm run test:run` → `scripts/run-vitest-stable.mjs`
- Root config: `vitest.config.ts` with projects for shared packages, adapters, plugin SDK, server, UI, and CLI

## Test Layers

| Layer | Available | Tool | Command |
| --- | --- | --- | --- |
| Unit | ✅ | Vitest | `pnpm test` or targeted Vitest project commands |
| Integration | ✅ | Vitest + Supertest/server setup | `pnpm test`, `pnpm test:run:general -- --group <group>`, `pnpm test:run:serialized -- --shard-index <n> --shard-count <n>` |
| E2E | ✅ | Playwright | `pnpm test:e2e` |
| Release smoke | ✅ | Playwright | `pnpm test:release-smoke` |
| Storybook review | ✅ | Storybook | `pnpm storybook`, `pnpm build-storybook` |

## Coverage

- Available: ❌
- Command: `—`
- Evidence: no root coverage script or coverage configuration was detected.

## Quality Tools

| Tool | Available | Command | Evidence |
| --- | --- | --- | --- |
| Linter | ❌ | `—` | No root lint script or ESLint config detected. |
| Type checker | ✅ | `pnpm -r typecheck` | AGENTS.md handoff rule and workspace package scripts. |
| Formatter | ❌ | `—` | No root format script or Prettier config detected. |
| Build | ✅ | `pnpm build` | Root package script runs workspace preflight then `pnpm -r build`. |

## Default Verification Policy

Use the cheapest local default unless scope requires more:

```sh
pnpm test
```

Browser suites stay opt-in:

```sh
pnpm test:e2e
pnpm test:release-smoke
```

PR-ready broad verification for significant changes:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

## CI Evidence

`.github/workflows/pr.yml` runs policy checks, typecheck/build-gap checks, release-registry tests, grouped general Vitest suites, serialized server shards, build, canary dry run, and Playwright e2e.

## Strict TDD Rationale

Strict TDD is enabled by SDD fallback because no explicit marker was found and the project has a real automated test runner. Apply it pragmatically: write or update focused tests before behavior changes when feasible, then run the smallest targeted proof first. Do not default to browser suites unless the change touches browser flows or release smoke behavior.
