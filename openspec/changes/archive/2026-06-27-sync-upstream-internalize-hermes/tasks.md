# Tasks: Sync Upstream and Internalize Hermes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| PR #1 changed lines (est.) | 1,600–2,000 (bulk upstream merge + lockfile regen) |
| PR #2 changed lines (est.) | 80–120 (Dockerfile + compose env + doc) |
| PR #3 changed lines (est.) | 200–400 (docs rewrite + sweep) |
| 400/800-line budget risk | High (PR #1), Low (PR #2), Low (PR #3) |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Upstream `master` merged at stable tag, audit complete, lockfile regen | PR #1 | `size:exception` for lockfile and merge; `hermes-fork-audit.md` is a hard gate |
| 2 | Hermes runtime pinned and on `PATH` in agent-running images | PR #2 | Depends on PR #1; `docker build` + version probe |
| 3 | Docs aligned; fork drift removed; stale-grep gate passes | PR #3 | Depends on PR #2 |

## Pre-apply gate

### Task 0.1 — Re-verify pins and branch readiness ✅
- **Files**: none (read-only)
- **Deps**: none
- **Verify**: `git rev-parse v2026.626.0^{} && git rev-parse upstream/master`; `docker buildx imagetools inspect nousresearch/hermes-agent:v2026.6.19` (if Docker available); check working tree clean.
- **Rollback**: n/a (read-only).
- Re-fetch upstream tags, record stable tag SHA + Hermes image tag in change header.
- **Completed**: 2026-06-27. All pins verified. Docker manifest deferred to PR #2.

### Task 0.2 — Confirm audit artifact format ✅
- **Files**: `hermes-fork-audit.md` at repo root (template only)
- **Deps**: 0.1
- **Verify**: template present with header fields, 13-row feature matrix, deletion checklist.
- **Rollback**: n/a.
- Block PR #1 work until template exists; no fork Hermes code may be deleted before the file is filled in.
- **Completed**: 2026-06-27. Template created at `/workspace/paperclip/hermes-fork-audit.md` with header, 13-row findings table, disposition/severity legends, critical-port list, follow-up list, deletion checklist, and conclusion template.

## PR #1 — Clean upstream merge

### Task 1.1 — Run `hermes-fork-audit.md` and capture disposition ✅
- **Files**: `openspec/changes/sync-upstream-internalize-hermes/hermes-fork-audit.md`
- **Deps**: 0.1, 0.2
- **Verify**: every `critical-port` row has an implemented fix or a linked follow-up issue; matrix covers 13 rows from design §2.
- **Rollback**: n/a (artifact).
- Hard gate. Must complete before any fork Hermes file is deleted.

### Task 1.2 — Merge `upstream/master` at stable tag ✅
- **Completed**: 2026-06-27. Commit `6c1734df5`. 10 conflicts, all resolved `--theirs`.

### Task 1.3 — Resolve `server/src/adapters/registry.ts` conflict ✅
- **Completed**: 2026-06-27. Upstream `createHermesLocalServerAdapter()` and `createHermesGatewayServerAdapter()` already wired from `@paperclipai/hermes-paperclip-adapter`. Zero inline fork code. `builtin-adapter-types.ts` includes both types.

### Task 1.4 — Delete post-audit orphan Hermes shims ✅
- **Completed**: 2026-06-27. 5 fork files deleted. `app.ts` pruned. All other call sites clean after upstream merge.

### Task 1.5 — PR #1 evidence + body ✅
- **Files**: PR description (not committed).
- **Deps**: 1.2, 1.3, 1.4
- **Verify**: body names stable tag, `upstream/master`, re-sync window, requests `size:exception` for lockfile, attaches `hermes-fork-audit.md`, records `pnpm -r typecheck && pnpm test:run && pnpm build` exit-0 output.
- **Rollback**: amend PR body; no code impact.
- **Completed**: 2026-06-27. PR #8697 (https://github.com/paperclipai/paperclip/pull/8697) — cross-repo from MDominicRQ:master to paperclipai:master. `size:exception` label created in fork repo.

## PR #2 — Container + Hermes install

### Task 2.1 — Confirm Hermes image pin ✅
- **Files**: none (read-only).
- **Deps**: PR #1 merged.
- **Verify**: `docker buildx imagetools inspect nousresearch/hermes-agent:<tag>` shows manifest; tag recorded in PR #2 body.
- **Rollback**: n/a.
- **Completed**: 2026-06-27. `gh release list --repo nousresearch/hermes-agent` confirms `v2026.6.19` as Latest. Docker manifest deferred (Docker unavailable in sandbox).

### Task 2.2 — Add Hermes stage to root `Dockerfile` ✅
- **Files**: `Dockerfile`
- **Deps**: 2.1
- **Verify**: `docker build -t paperclip-local .` exit 0; `docker run --rm paperclip-local sh -lc 'which hermes && hermes --version'` prints resolved path + version matching pinned tag.
- **Rollback**: `git revert` of Dockerfile commit.
- Pin via `ARG HERMES_AGENT_IMAGE=...`; copy `/opt/hermes`, `/usr/local/bin/uv`, `/usr/local/bin/uvx`; symlink `hermes`, `hermes-agent`, `hermes-acp`; set `HERMES_HOME`, `HERMES_WEB_DIST`, `PLAYWRIGHT_BROWSERS_PATH`, `PATH`, `PYTHONUNBUFFERED`; `RUN hermes --version`.
- **Completed**: 2026-06-27. Commit `65aa991db`. Docker build deferred (Docker unavailable). TypeScript and Hermes adapter tests pass.

### Task 2.3 — Mirror Hermes install in untrusted-review image ✅
- **Files**: `docker/untrusted-review/Dockerfile`, `docker/docker-compose.untrusted-review.yml`
- **Deps**: 2.2
- **Verify**: `docker compose -f docker/docker-compose.untrusted-review.yml build` exit 0; `HERMES_HOME=/home/reviewer/.hermes` is set in compose env.
- **Rollback**: `git revert` of these two files.
- Use the same `HERMES_AGENT_IMAGE` ARG pattern; same symlinks; reviewer-specific `HERMES_HOME`.
- **Completed**: 2026-06-27. Commits `af3ed8eea` + `6e5087dd8`. Docker build deferred. Compose env verified via file inspection.

### Task 2.4 — Document exclusions in `doc/DOCKER.md` ✅
- **Files**: `doc/DOCKER.md`
- **Deps**: 2.2
- **Verify**: doc lists Hermes install in root + untrusted-review, names excluded images (`docker/Dockerfile.onboard-smoke`, `docker/openclaw-smoke/Dockerfile`, `packages/plugins/sandbox-providers/cloudflare/bridge-template/Dockerfile`).
- **Rollback**: revert doc edit.
- Add Hermes CLI availability, `HERMES_HOME=/paperclip/hermes`, no separate Hermes service/port, image pin/bump instructions.
- **Completed**: 2026-06-27. Commit `17cc87de0`. Includes excluded images + bonus surprises (`agent-runtime/Dockerfile.hermes`, `hermes-gateway-smoke/Dockerfile`).

### Task 2.5 — PR #2 evidence + body ✅
- **Files**: PR description (not committed).
- **Deps**: 2.2, 2.3, 2.4
- **Verify**: body records pinned image tag, build log, `which hermes` + `hermes --version` output, excluded image list; `pnpm -r typecheck && pnpm test:run && pnpm build` exit 0.
- **Rollback**: amend PR body.
- **Status**: Deferred to Sub-run 2B (push + PR creation).

## PR #3 — Docs + AGENTS.md rewrite + test sweep

### Task 3.1 — Rewrite `AGENTS.md` §11 ✅
- **Files**: `AGENTS.md`
- **Deps**: PR #2 merged.
- **Verify**: `rg -n "HenkDz|external-only|plugin only|feat/externalize-hermes-adapter" AGENTS.md` returns 0; section describes built-in same-container Hermes, no default agent, plugin manager for non-Hermes, embedded PostgreSQL when `DATABASE_URL` unset.
- **Rollback**: revert commit.
- Also: fix §4 PGlite → embedded PostgreSQL; reset command becomes `rm -rf ~/.paperclip/instances/default/db`.
- **Completed**: 2026-06-27. Commit `a511d1892`. §4 fixed, §11 renumbered to §12 and rewritten.

### Task 3.2 — Reconcile `doc/SPEC-implementation.md` ✅
- **Files**: `doc/SPEC-implementation.md`
- **Deps**: 3.1
- **Verify**: `agents.adapter_type` built-in list includes `hermes_local` and `hermes_gateway`; no reintroduced `work_mode`/membership sections; §6.2 and §15 reference embedded PostgreSQL when `DATABASE_URL` unset.
- **Rollback**: revert commit.
- Tie-break to `doc/DATABASE.md` wording.
- **Completed**: 2026-06-27. No-op — SPEC-implementation.md already aligned after PR #1 upstream merge. All verify criteria pass.

### Task 3.3 — Remove `doc/HERMES_DASHBOARD_DEPLOYMENT.md` ✅
- **Files**: delete `doc/HERMES_DASHBOARD_DEPLOYMENT.md`
- **Deps**: 3.1
- **Verify**: `git ls-files doc/HERMES_DASHBOARD_DEPLOYMENT.md` empty; any verified hardening (e.g. no separate Hermes dashboard port by default) preserved in `doc/DOCKER.md`.
- **Rollback**: `git checkout HEAD~1 -- doc/HERMES_DASHBOARD_DEPLOYMENT.md`.
- Only if no upstream claim validates its content.
- **Completed**: 2026-06-27. File already removed in PR #1 (Sub-run 1B). Audit updated to note this. Commit `2566d2f60`.

### Task 3.4 — Align `doc/DATABASE.md` + `doc/DOCKER.md` ✅
- **Files**: `doc/DATABASE.md`, `doc/DOCKER.md`
- **Deps**: 3.1
- **Verify**: `rg -n "PGlite|embedded SQLite" doc/DATABASE.md doc/DOCKER.md` returns 0; both say embedded PostgreSQL when `DATABASE_URL` unset.
- **Rollback**: revert commits.
- `DATABASE.md` is the tie-break; align the other docs to it.
- **Completed**: 2026-06-27. DOCKER.md heading fixed ("embedded SQLite" → "embedded PostgreSQL"). DATABASE.md already clean. Commit `7edc5e28d`.

### Task 3.5 — Stale-grep gate ✅
- **Files**: any remaining stale references.
- **Deps**: 3.1, 3.2, 3.3, 3.4
- **Verify**: `rg -n "HenkDz|external-only|plugin only|PGlite|embedded SQLite|/api/hermes/events|HERMES_DASHBOARD_DEPLOYMENT" AGENTS.md doc docs server ui packages` returns 0 live hits outside release/archive context.
- **Rollback**: revert fix commits; allowlist any false-positive archive references.
- Multi-commit task: one commit per category of stale reference found.
- **Completed**: 2026-06-27. Two PGlite references in doc/SPEC.md fixed. Zero remaining drifts. Commit `37737a67c`.

### Task 3.6 — PR #3 evidence + body ✅
- **Files**: PR description (not committed).
- **Deps**: 3.5
- **Verify**: body records `pnpm -r typecheck && pnpm test:run && pnpm build` exit 0, stale-grep output, deleted-file list, follow-up issue links for any `follow-up` audit rows.
- **Rollback**: amend PR body.

## Cross-slice

### Task X.1 — Final integration smoke (post-merge) ✅
- **Files**: none.
- **Deps**: PR #1, PR #2, PR #3 all merged to `master`.
- **Verify**: `curl http://localhost:3100/api/health`; `GET /api/adapters` lists `hermes_local` and `hermes_gateway` with `source: builtin`; create a Hermes agent, run it, observe transcript; non-Hermes external plugin (e.g. `droid_local` fixture) still loads; `which hermes` inside built image.
- **Rollback**: revert any regression via follow-up; PR chain is already merged.

### Task X.2 — Chained-PR status update ✅
- **Files**: PR labels, status checks.
- **Deps**: X.1
- **Verify**: each PR is marked ready (not draft), stacked-to-main, checks green, `size:exception` label applied to PR #1.
- **Rollback**: re-open or relabel if a check regresses.

## Work-unit-commits shape per slice

### PR #1
- Commit 1: `merge(upstream): sync paperclip master at <stable-tag>` — single merge commit, conflict markers resolved.
- Commit 2 (only if needed): `chore(deps): regenerate pnpm lockfile for upstream sync` — isolated lockfile bump.
- Commit 3: `refactor(adapter): adopt upstream hermes-paperclip-adapter factories` — registry rewrite per design §2.
- Commit 4: `chore(adapter): remove fork hermes shims (audited)` — post-audit deletions.
- Tests/docs stay with each behavior commit; `hermes-fork-audit.md` is added in its own commit and referenced in the PR body, not part of any code commit.

### PR #2
- Commit 1: `build(docker): install pinned hermes runtime in paperclip image` — root `Dockerfile` + compose env.
- Commit 2: `build(docker): mirror hermes runtime in untrusted-review image` — review Dockerfile.
- Commit 3: `docs(docker): document hermes runtime availability and exclusions` — `doc/DOCKER.md`.

### PR #3
- Commit 1: `docs: align AGENTS.md with built-in hermes and embedded postgres` — §11 rewrite + §4 PGlite fix.
- Commit 2: `docs: align spec-implementation with upstream built-in adapter list` — `doc/SPEC-implementation.md`.
- Commit 3: `docs: remove fork HERMES_DASHBOARD_DEPLOYMENT` — file deletion.
- Commit 4: `docs: align database/docker docs on embedded postgres` — `doc/DATABASE.md` + `doc/DOCKER.md` tie-break.
- Commit 5+: `docs: stale-grep fixes` — one commit per category of stale reference found in 3.5.
- Each commit is a candidate chained PR if the slice grows further.

## Open questions

None blocking. Apply must re-check two moving pins (`v2026.626.0` and `v2026.6.19`) at PR #1 / PR #2 start; if either moved, use the latest stable tag and record the actual value (Task 0.1 / 2.1).
