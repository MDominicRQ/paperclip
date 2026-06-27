# Design: Sync Upstream and Internalize Hermes

## 1. Architecture overview

After the change, Paperclip keeps the upstream adapter architecture and only adds a pinned Hermes runtime to images that can execute local agents.

```text
Board/API ── lists/creates agents ──> server adapter registry
                                      ├─ built-ins: process/http/claude/codex/.../hermes_gateway/hermes_local
                                      └─ external plugins: non-built-in types from adapter plugin store

hermes_local agent run ──> @paperclipai/hermes-paperclip-adapter ──> `hermes` on PATH
                                                                  └─ HERMES_HOME=/paperclip/hermes in container
```

The built-in adapter registration remains the existing `registerBuiltInAdapters()` path in `server/src/adapters/registry.ts`. No default Hermes agent is created; a fresh board should show `hermes_local`/`hermes_gateway` in adapter inventory while `GET /api/companies/:companyId/agents` has no Hermes agent until an operator hires one. Add one low-noise startup log after built-in registration: `[paperclip] built-in adapters registered ... hermes_local, hermes_gateway`; this is observability only, not a new mechanism.

## 2. Fork Hermes audit plan

### Audit artifact format

PR #1 must create and attach `openspec/changes/sync-upstream-internalize-hermes/hermes-fork-audit.md`. The file is a markdown review artifact with:

- header: fork commit, upstream tag, Hermes image tag, upstream adapter package version, date, auditor;
- audited files list;
- feature matrix: `Feature | Fork evidence | Upstream evidence | Verdict | Disposition | Follow-up`;
- deletion checklist with exact source boundaries;
- unresolved follow-up issue links for every `follow-up` verdict.

`Verdict` values: `covered`, `critical-port`, `follow-up`, `drop`. `critical-port` is the only blocker class.

### Audit checklist

Compare fork inline code and helpers against upstream `@paperclipai/hermes-paperclip-adapter` for:

1. `hermes_local` and `hermes_gateway` registration.
2. Command resolution: `hermesCommand`, `command`, default `hermes` on `PATH`.
3. Local-agent JWT/API key injection and `PAPERCLIP_*` runtime env.
4. `HERMES_HOME` / shared config/session/memory behavior.
5. Model/provider detection from Hermes config.
6. Wake prompt, task markdown, session handoff, and Paperclip API guidance.
7. Session codec/resume and unknown/missing session behavior.
8. Skills support: list/sync Paperclip skills, user Hermes skills, preload behavior.
9. Config schema, UI parser, CLI formatter, transcript behavior.
10. Environment test diagnostics and secret redaction expectations.
11. Benign stderr handling and process spawn/cancel metadata.
12. Fork-only config push/drift sync: `/api/hermes/events`, `hermes-config-sync`, runtime config cache.
13. Docker runtime assumptions: binary path, Python venv, uv/uvx, Playwright path.

### Disposition rule

Block PR #1 only if upstream lacks functionality required to boot the server, list `hermes_local`, execute a Hermes run with `PAPERCLIP_API_KEY`, protect secrets, preserve session continuity, or resolve the `hermes` command. Everything else is follow-up: fork dashboard events, drift reconciliation, custom Paperclip skill preloading, rich user-Hermes skill scans, MCP helper paths, and extra environment-test hints become linked issues/PRs, not sync blockers.

### Deletion/preservation boundaries

In current fork `server/src/adapters/registry.ts`, delete fork Hermes glue and replace it with upstream factories:

- delete imports at current lines 12-16, 133-146, 152-153 if no remaining use after merge;
- add upstream import `createHermesGatewayServerAdapter, createHermesLocalServerAdapter` from `@paperclipai/hermes-paperclip-adapter`;
- delete helper block current lines 196-336 (`normalizeHermesContextTask`, `normalizeHermesConfig`, `withHermesPaperclipSkillArgs`, `buildHermesNativePaperclipPrompt`);
- delete inline `hermesLocalAdapter` current lines 557-725;
- preserve non-Hermes helpers current lines 155-193 and 338 onward, but accept upstream changes such as adapter model env caching and Claude header stamping;
- insert `const hermesGatewayAdapter = createHermesGatewayServerAdapter();` and `const hermesLocalAdapter = createHermesLocalServerAdapter();` in the upstream position;
- register both `hermesGatewayAdapter` and `hermesLocalAdapter` in the built-in list.

Delete after audit if unreferenced by upstream replacement: `server/src/adapters/hermes-wrapper.ts`, `server/src/adapters/hermes-test.ts`, `server/src/adapters/hermes-runtime-config.ts`, `server/src/services/hermes-config-sync.ts`, `server/src/routes/hermes-config-events.ts`. Remove their call sites: `server/src/app.ts` import/mount for Hermes events; `server/src/services/agents.ts` runtime-cache invalidation; fork-only Hermes identity mapping in `server/src/routes/agents.ts`; drift constants/function/export and startup/periodic calls in `server/src/services/heartbeat.ts` and `server/src/index.ts`. Preserve `hermes_local` in sessioned local adapter allow-lists.

## 3. Docker image plan

### Inventory and per-file edits

| File | Scope | Edit |
|---|---|---|
| `Dockerfile` | Production Paperclip image; runs agents | Reapply Hermes stage on top of upstream Dockerfile; pin tag; copy venv; expose PATH/env; probe `hermes --version`. |
| `docker/untrusted-review/Dockerfile` | Dev/review image that may run Paperclip/local agents | Add same pinned Hermes runtime copy/probe with `HERMES_HOME=/home/reviewer/.hermes`; keep no Paperclip source assumptions. |
| `docker/Dockerfile.onboard-smoke` | npm onboarding smoke only | No Hermes install; document exclusion in `doc/DOCKER.md`. |
| `docker/openclaw-smoke/Dockerfile` | OpenClaw webhook fixture | No Hermes install; document exclusion. |
| `packages/plugins/sandbox-providers/cloudflare/bridge-template/Dockerfile` | Plugin sandbox bridge | No Hermes install; not a Paperclip agent-runtime image. |
| `docker/docker-compose.yml` | Full stack using root image | No Hermes service/port; inherits root image. Remove Spanish comments during docs/sweep. |
| `docker/docker-compose.quickstart.yml` | Quickstart using root image | No Hermes service/port; inherits root image. |
| `docker/docker-compose.untrusted-review.yml` | Review image compose | Expose `HERMES_HOME=/home/reviewer/.hermes`; no extra port. |

### Multi-stage shape

Use the root upstream stages (`base`, `deps`, `build`, `production`) and prepend one source stage:

- `ARG HERMES_AGENT_IMAGE=nousresearch/hermes-agent:v2026.6.19`
- `FROM ${HERMES_AGENT_IMAGE} AS hermes_runtime`
- `FROM node:lts-trixie-slim AS base`
- final `production` receives `/opt/hermes`, `/usr/local/bin/uv`, `/usr/local/bin/uvx`.

Target architecture is `linux/amd64` minimum. Add/claim `linux/arm64` only if `docker buildx imagetools inspect nousresearch/hermes-agent:<tag>` confirms both the Hermes source image and `node:lts-trixie-slim` publish that platform. Docker was unavailable in this design environment, so apply must verify.

### Binary, PATH, env, probe

Final root image must have:

- `/opt/hermes/.venv/bin/hermes` as source binary;
- symlinks `/usr/local/bin/hermes`, `/usr/local/bin/hermes-agent`, `/usr/local/bin/hermes-acp`;
- `ENV HERMES_HOME=/paperclip/hermes HERMES_WEB_DIST=/opt/hermes/hermes_cli/web_dist PLAYWRIGHT_BROWSERS_PATH=/opt/hermes/.playwright PYTHONUNBUFFERED=1 PATH=/opt/hermes/.venv/bin:${PATH}`;
- `RUN hermes --version` after PATH/symlink setup.

The adapter default command remains `hermes`; Paperclip locates it via `PATH`. Per-agent override remains existing adapter config `hermesCommand` or `command`; container-level override is normal `PATH` replacement plus `HERMES_HOME` for state. Do not add a separate `HERMES_COMMAND` env unless the upstream adapter adopts it.

### Dev, CI, prod

Production and quickstart/full compose share the root image. Untrusted review gets the same Hermes version but its own final stage and home path. Onboard/OpenClaw/Cloudflare smoke images are intentionally excluded because they do not run Paperclip local agents.

## 4. Chained PR slice plan

| Slice | Files touched | Evidence package | Acceptance criteria | Rollback | Depends on |
|---|---|---|---|---|---|
| PR #1 upstream merge (`size:exception`) | Upstream merge, lockfile/manifests, adapter registry/packages, audit artifact | PR body names upstream tag; `hermes-fork-audit.md`; conflict notes; full check output | `pnpm -r typecheck` exit 0; `pnpm test:run` exit 0; `pnpm build` exit 0; `GET /api/adapters` can list built-in Hermes in targeted/manual smoke; plugin fixture/non-Hermes adapter still loads | Revert merge PR wholesale; do not cherry-pick partial lockfile | none |
| PR #2 container+Hermes | `Dockerfile`, `docker/untrusted-review/Dockerfile`, compose env if needed, `doc/DOCKER.md` runtime note | Docker build log; `which hermes`; `hermes --version`; image tag/pin note | JS checks still pass; `docker build -t paperclip-local .` exit 0; `docker run --rm paperclip-local sh -lc 'which hermes && hermes --version'` exit 0 and version matches pinned tag; excluded images documented | Revert Docker/doc commit; PR #1 remains useful without container Hermes | PR #1 |
| PR #3 docs+sweep | `AGENTS.md`, `doc/SPEC-implementation.md`, `doc/DOCKER.md`, `doc/DATABASE.md`, delete fork Hermes docs/shims after audit | Doc diff; stale-grep output; deleted-file list; follow-up issue links | Full JS checks pass; stale grep for `HenkDz`, `external-only`, `plugin only`, `PGlite`, `embedded SQLite`, `/api/hermes/events` operator claims returns no live-doc hits except release/archive context | Revert docs/cleanup PR; if a deleted fork file is needed, restore via follow-up revert PR | PR #2 |

All PRs use stacked-to-main: PR #1 targets `master`; PR #2 targets PR #1 branch until PR #1 lands, then retargets `master`; PR #3 targets PR #2 branch until clean.

## 5. Tag pinning and re-sync procedure

Initial upstream pin:

1. `git fetch upstream master --tags`.
2. Select latest stable `vYYYY.MDD.P` tag from upstream, excluding `canary/*`; current verified tag is `v2026.626.0` and it equals `upstream/master` at design time.
3. Merge the tag commit, not an unbounded moving branch: `git merge --no-ff v2026.626.0`.
4. Record tag, commit SHA, and `upstream/master` SHA in PR #1 body and `hermes-fork-audit.md` header.

Hermes image pin:

1. Check latest stable Hermes Agent release/Docker tag at apply time.
2. Verify manifest exists: `docker buildx imagetools inspect nousresearch/hermes-agent:<tag>`.
3. Set `HERMES_AGENT_IMAGE` default in Dockerfiles to that stable tag; current expected pin is `v2026.6.19`.
4. Record tag in PR #2 body and `doc/DOCKER.md`.

Future cadence: open a sync PR for every upstream stable Paperclip release, or weekly if releases are frequent. Bump Hermes manually when Hermes ships a stable release: update Dockerfile ARG defaults, update docs, rebuild container, run version probe. Renovate is not assumed/configured for this image pin.

## 6. Plugin manager coexistence

Built-in Hermes uses the same server/UI/CLI registries as other built-ins. External adapter plugins remain loaded through `buildExternalAdapters()` and the adapter management routes. After PR #1, `BUILTIN_ADAPTER_TYPES` must include `hermes_gateway` and `hermes_local`, so install/delete/reload routes continue to reject direct replacement of built-ins while accepting non-Hermes plugins such as `droid_local`. Verification must include a non-Hermes plugin fixture and confirm Hermes still reports `source: builtin` in `GET /api/adapters`.

## 7. Documentation reconciliation

### `AGENTS.md`

Replace current duplicated `## 11. Fork-Specific: HenkDz/paperclip` section with `## 12. Fork-Specific: upstream sync and built-in Hermes`. Remove: HenkDz identity, `feat/externalize-hermes-adapter`, external-only/plugin-only Hermes, QoL-not-upstream claims, NTFS/local branch notes that are not current repo policy. Add: fork tracks `paperclipai/paperclip:master` stable tags; Hermes is built-in via upstream `@paperclipai/hermes-paperclip-adapter`; Hermes runtime is installed in Paperclip agent-running containers; external plugin manager remains for non-Hermes adapters; no default Hermes agent is auto-created; use embedded PostgreSQL when `DATABASE_URL` is unset. Also fix section numbering and change §4 from “PGlite” to “embedded PostgreSQL at `~/.paperclip/instances/default/db`”; reset command becomes `rm -rf ~/.paperclip/instances/default/db`.

### `doc/SPEC-implementation.md`

Update `agents.adapter_type` built-in list to include `hermes_local` and `hermes_gateway`; keep OpenClaw/external plugin language. Do not reintroduce removed fork `work_mode`/membership sections. Ensure §6.2 and §15 continue to say embedded PostgreSQL when `DATABASE_URL` is unset.

### `doc/HERMES_DASHBOARD_DEPLOYMENT.md`

Remove the file. Its webhook/dashboard assertions are fork-only and not part of the upstream built-in adapter contract. Only preserve a short English note in `doc/DOCKER.md` if verified: Paperclip Docker does not publish a separate Hermes dashboard port by default.

### `doc/DATABASE.md` and Docker docs

`doc/DATABASE.md` is already the tie-break: embedded PostgreSQL when `DATABASE_URL` is unset. Keep it, and align `AGENTS.md` plus `doc/DOCKER.md` (“Quickstart (embedded PostgreSQL)”, not SQLite/PGlite). In `doc/DOCKER.md`, add Hermes CLI availability, `HERMES_HOME=/paperclip/hermes`, no separate Hermes service/port, image pin/bump instructions, and excluded images list.

## 8. Open Decisions

None blocking. Apply must re-check two moving pins (`v2026.626.0` and `v2026.6.19`) immediately before PR #1/#2. If either moved, use the latest stable tag and record the actual value.

## 9. Risks and mitigations

| Severity | Risk | Mitigation |
|---|---|---|
| Critical | Upstream merge is too large for line review. | Use `size:exception`, merge stable tag, audit conflicts, require full checks. |
| Critical | Fork-only Hermes behavior is silently lost. | Mandatory `hermes-fork-audit.md`; only critical runtime gaps block, enhancements become issues. |
| High | Hermes source image may not support desired platform. | Verify manifest in PR #2; claim amd64 only unless arm64 is proven. |
| High | Dockerfile drifts from upstream package layout. | Start from upstream Dockerfile; layer only pinned Hermes runtime. |
| Medium | Plugin manager regression or built-in shadowing confusion. | Test non-Hermes plugin install/list and reject Hermes overwrite as built-in. |
| Medium | Docs preserve stale fork/webhook/PGlite claims. | PR #3 stale-grep acceptance gate. |

## 10. Validation strategy

Per PR baseline:

```sh
pnpm -r typecheck
pnpm test:run
pnpm build
```

PR #1 extras:

```sh
git rev-parse v2026.626.0^{}
git rev-parse upstream/master
```

Expected: selected stable tag/SHA recorded; checks exit 0; `hermes-fork-audit.md` has no `critical-port` without an implemented fix.

PR #2 extras:

```sh
docker build -t paperclip-local .
docker run --rm paperclip-local sh -lc 'which hermes && hermes --version'
docker compose -f docker/docker-compose.quickstart.yml config
docker compose -f docker/docker-compose.untrusted-review.yml build
```

Expected: build exits 0; `which hermes` prints `/usr/local/bin/hermes` or `/opt/hermes/.venv/bin/hermes`; version output corresponds to pinned Hermes tag.

PR #3 extras:

```sh
rg -n "HenkDz|external-only|plugin only|PGlite|embedded SQLite|/api/hermes/events|HERMES_DASHBOARD_DEPLOYMENT" AGENTS.md doc docs server ui packages
```

Expected: no stale operator-facing hits; release/archive history may remain only outside live guidance if intentionally excluded from grep scope.
