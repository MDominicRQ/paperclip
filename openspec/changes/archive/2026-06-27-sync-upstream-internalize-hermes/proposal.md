# Proposal: Sync Upstream and Internalize Hermes

## Goal

Bring the fork back to upstream `paperclipai/paperclip:master`, make Hermes available as a built-in local agent runtime inside the Paperclip container, and remove the operator-facing drift between code, Docker manifests, and docs. Operators should be able to hire Hermes agents from the board without plugin installation or default auto-created agents; Paperclip agents should see a normal built-in adapter type, with credentials and runtime configuration flowing through the existing board/database mechanisms.

## Scope

### In Scope
- Full hand-resolved merge from `upstream/master`, pinned to the latest stable upstream tag available at implementation start.
- Adopt upstream workspace `@paperclipai/hermes-paperclip-adapter` built-in `hermes_local` / `hermes_gateway` packages.
- Preserve and pin the fork's proven Hermes container install strategy: `COPY --from=nousresearch/hermes-agent:v2026.6.19`.
- Keep external adapter plugin manager working for non-Hermes adapters.
- Update production, dev/CI-related Dockerfiles/docs so Hermes is consistently available on `PATH` where Paperclip runs agents.
- Rewrite drifted docs: `AGENTS.md` §11, `doc/SPEC-implementation.md`, `doc/DOCKER.md`, and database/runtime notes.

### Out of Scope
- Re-externalizing Hermes or restoring a fork-local inline `hermes_local` adapter.
- Porting fork-unique Hermes behavior inside the sync PR unless the audit finds it required for the built-in adapter to function.
- Auto-creating a default Hermes agent on first run.
- CI e2e Hermes execution against real credentials.

## Capabilities / Spec Contract

No baseline `openspec/specs/` files exist yet.

### New Capabilities
- `adapter-runtime`: built-in adapter registration, plugin coexistence, no default agent creation.
- `container-runtime`: Hermes binary/venv availability, `PATH`, env, and Docker image pinning.
- `documentation-consistency`: AGENTS/docs/spec alignment with code and deployment reality.

### Modified Capabilities
- None; no existing OpenSpec capability specs were present.

## Approach

### PR #1 — Clean upstream merge (`size:exception`)
- **Start:** fork `master` behind `upstream/master` with inline Hermes adapter and stale docs.
- **Work:** merge `upstream/master`; resolve conflicts manually; adopt upstream Hermes packages/registry wiring; audit fork `registry.ts`, `hermes-wrapper.*`, `hermes-runtime-config.*`, config-sync code before deletion; preserve fork-only files until audit conclusion.
- **Finish:** tree is upstream-synced, lockfile regenerated, built-in Hermes package present, plugin manager still loads non-Hermes plugins.
- **Verification:** `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`.
- **Rollback:** revert merge PR; no partial cherry-picks.

### PR #2 — Container + Hermes install
- **Start:** upstream-synced tree without guaranteed Hermes runtime in images.
- **Work:** pin `FROM nousresearch/hermes-agent:v2026.6.19 AS hermes_runtime`; copy `/opt/hermes`, `uv/uvx`; symlink `hermes`, `hermes-agent`, `hermes-acp`; set `HERMES_HOME`, `HERMES_WEB_DIST`, `PLAYWRIGHT_BROWSERS_PATH`, `PATH`; apply only to images that run Paperclip agents and explicitly document no-op images.
- **Finish:** Paperclip runtime images can resolve `hermes` on `PATH`.
- **Verification:** full JS checks plus container build; manual `hermes --help` / `which hermes` in built image when feasible.
- **Rollback:** revert Docker/doc changes; PR #1 remains valid with non-Hermes adapters.

### PR #3 — Docs, cleanup, and test sweep
- **Start:** code/container story works but docs may still describe fork-local/external Hermes.
- **Work:** rewrite `AGENTS.md` §11; reconcile `doc/SPEC-implementation.md`; update `doc/DOCKER.md`; replace PGlite/SQLite wording with embedded PostgreSQL; remove Spanish-only `doc/HERMES_DASHBOARD_DEPLOYMENT.md` and preserve any still-valid dashboard hardening as English notes only if the upstream adapter still supports that flow; delete unused fork Hermes files after audit.
- **Finish:** docs describe upstream-synced, built-in, same-container Hermes accurately.
- **Verification:** `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`, docs/code grep for stale `HenkDz`, `external-only`, `PGlite`, `embedded SQLite`, and obsolete Hermes event claims.
- **Rollback:** revert docs/cleanup PR; PRs #1-#2 remain functionally intact.

### Work-Unit Commit Shape
- PR #1: `merge(upstream): sync paperclip master` + conflict-resolution commits only when they isolate reviewable decisions.
- PR #2: `build(docker): install pinned hermes runtime in paperclip image`; `docs(docker): document hermes runtime availability`.
- PR #3: `docs: align fork guidance with built-in hermes`; `docs: align database/runtime wording`; `refactor(adapter): remove unused fork hermes shims` if audit proves safe.

## Decisions

| # | Decision | Rationale | Tradeoff |
|---|---|---|---|
| 1 | Full merge `upstream/master`. | Preserves upstream history and current code. | Large PR; requires `size:exception`. |
| 2 | Pin merge to latest stable upstream tag and document re-sync window. | Avoids unbounded canary drift. | Must re-check tag at apply start. |
| 3 | Use `upstream/master`, not `main`. | Explore confirmed upstream default branch. | Scripts/docs must not assume `main`. |
| 4 | Multi-stage Docker `COPY FROM nousresearch/hermes-agent:v2026.6.19`. | Hermes has no standalone binary; fork approach works. | Image dependency instead of source build. |
| 5 | Pin Hermes image to latest stable tag. | Reproducible builds. | Manual bump on Paperclip release. |
| 6 | Hermes runs in Paperclip container as built-in adapter. | Matches operator goal and prior preference. | Larger Paperclip image. |
| 7 | Adopt upstream `@paperclipai/hermes-paperclip-adapter` v0.3.1. | Upstream already has proper server/UI/CLI package. | Fork-only behavior may become follow-up work. |
| 8 | Audit fork Hermes code before discarding. | Prevents losing skills/config/runtime behavior silently. | Adds merge discipline. |
| 9 | Preserve plugin manager for non-Hermes adapters. | Built-ins must not regress extensibility. | Shadowing behavior must be verified. |
| 10 | Register adapter type only on first run. | Operator remains in control of hiring. | No out-of-box Hermes agent. |
| 11 | Update production/dev/CI Dockerfiles consistently. | Avoids environment-specific “works only locally”. | Some smoke images may be documented as intentionally out of scope. |
| 12 | Smoke per PR: typecheck, tests, build, container build. | Proves sync and runtime packaging. | Heavier verification than small changes. |
| 13 | No Hermes e2e CI smoke. | Avoids credentials/flaky external runtime. | Manual check needed. |
| 14 | Rewrite `AGENTS.md` §11. | Current fork guidance is factually stale. | Removes branch-specific local history. |
| 15 | Reconcile `doc/SPEC-implementation.md`. | V1 contract must match built-in Hermes story. | Must avoid long-horizon `SPEC.md` churn unless needed. |
| 16 | Remove Spanish-only deployment doc or fold valid English notes into `doc/DOCKER.md`. | Public repo docs should be accurate and English; current file references fork-only endpoints. | Potentially loses obsolete historical detail. |
| 17 | Tie-break DB docs to `doc/SPEC-implementation.md`/`doc/DATABASE.md`: embedded PostgreSQL when `DATABASE_URL` is unset. | Current V1 docs/code use embedded PostgreSQL. | `AGENTS.md` PGlite wording must be corrected. |

## Risks

| Severity | Risk | Mitigation |
|---|---|---|
| CRITICAL | PR #1 is not line-reviewable: 367 upstream commits, ~1,667 files, lockfile churn. | Treat as trusted upstream sync; request `size:exception`; verify by conflict review and full checks. |
| CRITICAL | `server/src/adapters/registry.ts` conflict can drop fork-unique Hermes behavior. | Mandatory audit checklist before deletion; port only critical behavior, defer enhancements. |
| CRITICAL | Hermes has no standalone binary release. | Use pinned Docker-image copy strategy, not GitHub binary download. |
| WARNING | Plugin manager could shadow or be shadowed by built-in Hermes. | Verify built-in type shadowing and non-Hermes plugin loading after merge. |
| WARNING | Docker consistency scope may overreach unrelated smoke images. | Apply Hermes only to Paperclip agent runtime images; document intentional exclusions. |
| WARNING | Docs may preserve obsolete Hermes webhook/dashboard claims. | Remove `doc/HERMES_DASHBOARD_DEPLOYMENT.md` unless current upstream code proves each claim. |
| SUGGESTION | Latest upstream/Hermes tags may move before apply. | Re-check stable tags during PR #1/#2 and record exact pins. |

## Open Questions

| Question | Proposal Resolution |
|---|---|
| Merge or rebase? | Merge `upstream/master`; do not rewrite fork history. |
| Does fork Hermes code contain irreplaceable functionality? | Unknown until audit; audit is required before discard, but follow-up porting must not block sync unless needed for built-in Hermes to run. |
| External `hermes-paperclip-adapter` vs upstream workspace package? | Use upstream workspace `@paperclipai/hermes-paperclip-adapter`; remove external dependency unless audit proves a missing capability. |
| Docker image copy vs `pip install`? | Docker image copy; faster, already proven, and avoids rebuilding Hermes Python env. |
| Fate of Spanish deployment doc? | Remove it; preserve any still-valid hardening guidance in English `doc/DOCKER.md` only after code verification. |
| Upstream pin / canary? | Stable tag only, expected `v2026.626.0` from explore; no canary tracking. |
| Fork identity in docs? | Avoid hardcoded fork owner names; describe “this fork” and use actual remotes during PR work. |

### Proposal Question Round

Interactive product assumptions are considered accepted for this proposal unless the orchestrator corrects them: the business pain is operator confusion from drift; target users are self-hosted operators hiring Hermes agents; the desired outcome is built-in same-container Hermes without plugin installation; the main downside to avoid is silently losing fork-specific Hermes behavior during sync.

## Validation

- **Per-slice:** PR #1/2/3 each run `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`; PR #2 also builds the Paperclip container.
- **Manual checks:** board lists built-in Hermes adapter type; operator can create/hire a Hermes agent; environment test reports Hermes CLI availability; `which hermes` resolves inside the built image; non-Hermes external plugin still loads.
- **Doc checks:** grep for stale branch/owner/runtime claims and confirm `DATABASE_URL` unset consistently means embedded PostgreSQL.

## Dependencies

### Internal
- `server/src/adapters/registry.ts`, `server/src/adapters/builtin-adapter-types.ts`
- `packages/adapters/hermes/`, `packages/adapters/hermes-gateway/`, `packages/adapter-utils/`
- `ui/src/adapters/registry.ts`, `cli/src/adapters/registry.ts`
- plugin loader and `~/.paperclip/adapter-plugins.json` flow
- `Dockerfile`, `docker/Dockerfile.onboard-smoke`, `docker/untrusted-review/Dockerfile`, Docker docs
- `AGENTS.md`, `doc/SPEC-implementation.md`, `doc/DATABASE.md`, `doc/DOCKER.md`

### External
- `paperclipai/paperclip` remote `upstream/master`, stable tag expected `v2026.626.0`
- `nousresearch/hermes-agent:v2026.6.19`
- pnpm lockfile regeneration and Node/pnpm versions from repo config
- Docker daemon for image smoke builds

## Rollback

| Slice | Rollback |
|---|---|
| PR #1 | Revert the upstream merge branch/PR wholesale; keep fork `master` unchanged. |
| PR #2 | Revert Hermes Docker runtime install and docs; keep upstream adapter code from PR #1. |
| PR #3 | Revert docs/cleanup only; restore deleted fork Hermes files if audit later shows they are still needed. |

## Success Criteria

- [ ] Fork sync is based on `upstream/master` and latest stable upstream tag, not `main` or canary.
- [ ] Upstream built-in Hermes adapter package is used; no fork-local inline `hermes_local` remains unless audit requires a temporary bridge.
- [ ] Hermes image is pinned to `nousresearch/hermes-agent:v2026.6.19` or the re-verified latest stable tag.
- [ ] Paperclip runtime container has `hermes` on `PATH`.
- [ ] Docs consistently describe built-in same-container Hermes and embedded PostgreSQL defaults.
- [ ] Plugin manager remains functional for non-Hermes adapters.
