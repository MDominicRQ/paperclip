# Exploration: sync-upstream-internalize-hermes

Date: 2026-06-27
Executor: sdd-explore (deepseek-v4-pro)

## 1. Fork State and Divergence

### Current state
- **Working tree**: clean (only untracked `openspec/` and `.atl/` directories)
- **Current branch**: `master`
- **Remotes**:
  - `origin` → `https://github.com/MDominicRQ/paperclip.git` (fork)
  - `upstream` → `https://github.com/paperclipai/paperclip.git` (canonical upstream)
- **Upstream default branch**: `master` (NOT `main` — the preflight incorrectly assumed `main`)
- **Upstream latest tag**: `v2026.626.0` (also `canary/v2026.627.0-canary.1`)

### Divergence quantification
| Metric | Value |
|--------|-------|
| Fork commits ahead of upstream | 67 |
| Fork commits behind upstream | 367 |
| Files changed in diff | 1,667 |
| Insertions | 20,941 |
| Deletions | 410,640 |

The fork is massively behind upstream. Most deletions are from the fork stripping CI scripts, test suites, docs, and issue templates that upstream expanded or changed.

### Fork's local commit history (top 67 commits)

The fork's diverged commits are almost entirely **Hermes adapter work** (wrapper, MCP support, environment variables, skill management, session handling) layered on top of a partial merge from upstream dated 2026-05-19. Recent commits:
```
4d59f3c8 feat(adapter): enhance Hermes integration with Paperclip skills management
d8591659 feat(adapter): enhance Hermes integration with new environment variables
26138211 feat(adapter): enhance Hermes integration with shared home and skill management
31358ab1 feat(adapter): refactor executeHermesWrapper to use HermesExecutionContext type
538719eb feat(adapter): wrap onSpawn in Hermes wrapper to inject processGroupId as null
...
```

### Fork QoL patches analysis

The fork's `AGENTS.md` §11 lists three "Fork QoL Patches (not in upstream)":

| Patch | Claim | Actual status in upstream |
|-------|-------|--------------------------|
| `stderr_group` | Amber accordion for MCP init noise | **ALREADY PRESENT** in upstream `RunTranscriptView.tsx` (lines 97, 531-536, 1257) |
| `tool_group` | Accordion for consecutive non-terminal tools | **ALREADY PRESENT** in upstream `RunTranscriptView.tsx` (lines 83, 371-396) |
| Dashboard excerpt | `LatestRunCard` strips markdown, first 3 lines/280 chars | **ALREADY PRESENT** in upstream `AgentDetail.tsx` (lines 1198-1280 — identical `useMemo` logic) |

**Conclusion**: All three "fork QoL patches" have been upstreamed since the fork diverged. They require ZERO preservation effort — the upstream merge will bring them in natively. The fork's `AGENTS.md` §11 is stale on this point.

---

## 2. Hermes Release/Binary Availability

### Canonical project
- **Repo**: `github.com/NousResearch/hermes-agent`
- **Package**: `hermes-agent` on PyPI
- **Language**: Python (NOT a standalone binary)

### Release assets
- Latest stable tag: `v2026.6.19` (Hermes Agent v0.17.0, "The Reach Release")
- Latest Docker tag: `nousresearch/hermes-agent:v2026.6.19` (available on Docker Hub)
- GitHub release assets:
  - `hermes_agent-0.17.0-py3-none-any.whl` (Python wheel)
  - `hermes_agent-0.17.0.tar.gz` (source tarball)
  - Sigstore signatures for both
  - **NO standalone linux/amd64 binary**

### CRITICAL FINDING: Binary download strategy is non-viable

The preflight decision says "download a release binary from Hermes's GitHub release in the Dockerfile". **Hermes Agent does NOT ship prebuilt platform binaries.** It is a Python package installable via `pip install hermes-agent` or usable via Docker image.

### Viable approaches for Docker integration
1. **COPY FROM Docker image** (already in fork's Dockerfile): `FROM nousresearch/hermes-agent:v2026.6.19 AS hermes_runtime` and `COPY --from=hermes_runtime /opt/hermes /opt/hermes`
2. **`pip install` in Dockerfile**: Install Python + hermes-agent via pip. Simpler but slower build.
3. **Docker image as base**: Use `nousresearch/hermes-agent` directly. Changes architecture significantly.

**Recommendation**: Continue with approach (1) — COPY FROM tagged Docker image. This is already proven in the fork's Dockerfile, provides a Python venv with all deps, and avoids rebuilding the Hermes Python environment from scratch.

### Version pinning
- Pin to `nousresearch/hermes-agent:v2026.6.19` (not `:latest`)
- Bump tag on each Paperclip release
- Docker Hub `latest` tag tracks `main` and is a moving target

---

## 3. Adapter System: Fork vs Upstream

### Upstream's Hermes adapter (the truth)

Upstream commit `fd2f82ac5 [codex] Add built-in Hermes adapters (#8543)` added:
- `packages/adapters/hermes/` — `@paperclipai/hermes-paperclip-adapter` v0.3.1
  - Full adapter with local CLI (`hermes_local`) and gateway (`hermes_gateway`) support
  - Package has proper exports: `.`, `./server`, `./ui`, `./cli`, `./ui-parser`, `./gateway`, etc.
  - Includes `paperclip.adapterUiParser` metadata
- `packages/adapters/hermes-gateway/` — `@paperclipai/adapter-hermes-gateway` v0.1.0
  - Thin compatibility shim that re-exports from `@paperclipai/hermes-paperclip-adapter/gateway`
- Registration in `server/src/adapters/registry.ts`:
  ```ts
  import { createHermesGatewayServerAdapter, createHermesLocalServerAdapter } from "@paperclipai/hermes-paperclip-adapter";
  const hermesGatewayAdapter = createHermesGatewayServerAdapter();
  const hermesLocalAdapter = createHermesLocalServerAdapter();
  ```

### Fork's Hermes adapter (the divergence)

The fork has:
- **NO** `packages/adapters/hermes/` or `packages/adapters/hermes-gateway/` workspace packages
- An inline `hermes_local` adapter defined in `server/src/adapters/registry.ts` (lines 557-900+, ~400 lines)
- Helper files: `server/src/adapters/hermes-wrapper.js` and `server/src/adapters/hermes-runtime-config.js`
- Imports from `hermes-paperclip-adapter` (external npm package, NOT workspace)
- The inline adapter handles: config normalization, env wiring, shared Hermes home, model detection, wake payload rendering, skills preloading, Paperclip skill injection, and process spawning

### Conflict analysis

| Area | Upstream | Fork | Resolution |
|------|----------|------|------------|
| Adapter package | `@paperclipai/hermes-paperclip-adapter` (workspace) | `hermes-paperclip-adapter` (external npm) | **Adopt upstream** workspace package |
| Registry registration | `createHermesLocalServerAdapter()` factory | ~400 lines of inline code | **Discard fork's inline code** |
| Server imports | Clean factory call | Direct wrapper + runtime-config imports | **Adopt upstream's clean import** |
| UI adapter | Built-in via package's `./ui` export | External `ui-parser.js` from package | **Adopt upstream** |
| CLI adapter | Built-in via package's `./cli` export | External format-event | **Adopt upstream** |

### Plugin manager coexistence
Both fork and upstream support external adapter loading via `~/.paperclip/adapter-plugins.json`. Upstream's built-in Hermes adapters do NOT conflict with this system — the plugin loader checks `BUILTIN_ADAPTER_TYPES` and skips external adapters that shadow built-ins. No changes needed to the plugin manager.

---

## 4. Docker Setup

### Dockerfiles in repo
| File | Purpose |
|------|---------|
| `Dockerfile` | **Production image** (multi-stage: base, deps, build, production) |
| `docker/Dockerfile.onboard-smoke` | Onboarding smoke test |
| `docker/openclaw-smoke/Dockerfile` | OpenClaw smoke test |
| `docker/untrusted-review/Dockerfile` | Untrusted review environment |

### Upstream Dockerfile (clean)
- 4 stages: `base`, `deps`, `build`, `production`
- Installs CLIs: `@anthropic-ai/claude-code`, `@openai/codex`, `opencode-ai`, `@google/gemini-cli`
- Copies `packages/adapters/hermes/package.json` and `packages/adapters/hermes-gateway/package.json` for deps
- **NO** Hermes binary/venv integration
- Minimal apt packages: `ca-certificates gosu curl gh git wget ripgrep python3`

### Fork Dockerfile (Hermes-enhanced)
- 5 stages: adds `hermes_runtime` stage at the top
- Additional stage: `FROM nousresearch/hermes-agent:latest AS hermes_runtime`
- Copies Hermes venv: `COPY --from=hermes_runtime /opt/hermes /opt/hermes`
- Copies uv binaries: `COPY --from=hermes_runtime /usr/local/bin/uv /usr/local/bin/uvx`
- Installs `anthropic>=0.39.0` via uv pip if not present
- Symlinks: `hermes`, `hermes-agent`, `hermes-acp` into `/usr/local/bin/`
- Additional apt packages: `openssh-client jq ffmpeg procps` (+ python3 from base)
- Extra ENV vars: `HERMES_HOME`, `HERMES_WEB_DIST`, `PLAYWRIGHT_BROWSERS_PATH`, `API_SERVER_ENABLED`, `PYTHONUNBUFFERED`, extended `PATH`
- Creates `/paperclip/hermes` and `/paperclip/hermes/agents` directories

### What must merge
The fork's Dockerfile Hermes integration must be **re-applied on top of upstream's Dockerfile** because:
1. Upstream's Dockerfile has evolved (added `gemini-cli`, `skills-catalog`, `teams-catalog`, changed script paths)
2. The fork's Dockerfile has old deps stage (missing `skills-catalog`, `teams-catalog`, `link-plugin-dev-sdk.mjs`, etc.)
3. The Hermes stage + copy + symlinks + env vars must be layered onto the current upstream structure

### Docker Compose files
All in `docker/`:
- `docker-compose.yml` — production compose
- `docker-compose.quickstart.yml` — quickstart
- `docker-compose.untrusted-review.yml` — untrusted review

None reference Hermes explicitly; Hermes runs inside the Paperclip container.

---

## 5. Documentation Drift

### Stale claims in fork vs upstream reality

| File | Fork claim | Reality (upstream) | Severity |
|------|-----------|-------------------|----------|
| `AGENTS.md` §11 | "external-only Hermes adapter story" | Fork's own `master` has **inline** `hermes_local` code in registry | **Critical** — fork documents itself wrong |
| `AGENTS.md` §11 | "Fork QoL Patches (not in upstream)" | All 3 patches already in upstream | **High** — stale claim |
| `AGENTS.md` §11 | Branch strategy references `feat/externalize-hermes-adapter` | Current branch is `master`, not that branch | **High** — wrong branch documented |
| `AGENTS.md` §11 | Hermes registered via "Board → Adapter manager" | Fork has inline Hermes registration, not plugin-based | **Critical** — completely wrong |
| `doc/SPEC-implementation.md` L156 | `adapter_type` built-ins include `hermes_local`, `hermes_gateway` | Upstream lists WITHOUT these (they're built-in but not listed in spec) | **Medium** — spec drift |
| `doc/SPEC-implementation.md` L232-237 | `work_mode` field described (`standard`, `ask`, `planning`) | Upstream removed `work_mode` from spec | **Medium** |
| `doc/SPEC-implementation.md` L324-350 | `project_memberships` + `agent_memberships` sections | Upstream removed these (now simpler) | **Medium** |
| `doc/SPEC-implementation.md` L48-49 | "Low-trust agent presets" section | Upstream removed it | **Low** |
| `README.md` L1-7 | Banner image `doc/assets/banner.jpg`, old tagline | Upstream has `doc/assets/header.png`, "Open-source orchestration for zero-human companies" | **Medium** |
| `README.md` | Missing "COMING SOON: Clipmart" section | Upstream added it | **Low** |
| `README.md` L287-302 | `.npmrc` troubleshooting block | Upstream removed it | **Low** |
| `doc/DEVELOPING.md` L42-52 | "Run config-change semantics (Hermes)" section | Not in upstream | **High** — fork-only section |
| `doc/DATABASE.md` L146-156 | "Resource membership tables" section | Upstream removed it | **Medium** |
| `doc/PRODUCT.md` L121 | Extra "do not" line about visibility | Upstream removed it | **Low** |
| `doc/DOCKER.md` | Missing `bootstrap-ceo` removal | Upstream removed browser claim + bootstrap-ceo | **Low** |
| `doc/HERMES_DASHBOARD_DEPLOYMENT.md` | NEW file (spanish) | Not in upstream | **High** — fork-only doc |

### Files that exist ONLY in fork
- `doc/HERMES_DASHBOARD_DEPLOYMENT.md` — Spanish-language Hermes dashboard deployment hardening guide
- `server/src/adapters/hermes-wrapper.js` — Fork's Hermes adapter wrapper
- `server/src/adapters/hermes-runtime-config.js` — Fork's runtime config helper
- `server/src/services/hermes-config-sync.js` (implied by import) — Fork's config sync service

---

## 6. Chained-PR Feasibility

### Proposed 3-slice plan from preflight

| Slice | Description | Estimated changed lines | Budget risk |
|-------|-------------|------------------------|-------------|
| (a) Clean upstream merge | Merge `upstream/master` into fork, resolve conflicts | **Massive** — 1,667 files, 410k deleted, 21k inserted | **Critical — impossible to PR-review** |
| (b) Docker + Hermes binary | Layer Hermes Docker stage onto merged Dockerfile | ~80-120 lines | **Low** |
| (c) Adapter wiring + tests + docs | Wire built-in adapters, update docs, tests | ~200-400 lines (if using upstream's packages) | **Low-Medium** |

### Critical insight

**Slice (a) cannot be a conventional code-review PR.** A 367-commit merge into a fork with 67 local divergent commits touching 1,667 files is NOT reviewable as line-level changes. The merge must be treated as a **trusted upstream sync**, verified by:
1. `git merge upstream/master` with manual conflict resolution
2. The resulting tree passes `pnpm -r typecheck && pnpm test:run && pnpm build`
3. The fork's unique files (Hermes wrapper, config sync service, Hermes dashboard doc) are preserved
4. The Dockerfile Hermes integration is re-applied post-merge

### Chained PR strategy (revised)

Given the findings, the realistic delivery is:

**PR #1: Upstream sync merge** (not code-reviewable line-by-line)
- `git merge upstream/master` into fork's `master`
- Resolve conflicts (focus areas: `server/src/adapters/registry.ts`, `Dockerfile`, `AGENTS.md`, `doc/*`)
- Discard fork's inline Hermes adapter code; adopt upstream's `@paperclipai/hermes-paperclip-adapter`
- Keep fork's `Dockerfile` Hermes stage intact (it will merge-clean or need re-application)
- Keep fork-only files: `doc/HERMES_DASHBOARD_DEPLOYMENT.md`, `server/src/adapters/hermes-wrapper.js`, `server/src/adapters/hermes-runtime-config.js`
- Verify: `pnpm -r typecheck && pnpm test:run && pnpm build`
- **Size exception required** — this is a merge, not a code review

**PR #2: Docker Hermes integration** (~100 lines)
- Pin Hermes image tag: `nousresearch/hermes-agent:v2026.6.19` (not `:latest`)
- Ensure Hermes stage is cleanly integrated with upstream's evolved Dockerfile
- Add/update `doc/DOCKER.md` with Hermes binary notes
- Verify: `docker build -t paperclip-local .` succeeds

**PR #3: Docs sync + cleanup** (~200 lines)
- Rewrite `AGENTS.md` §11 to reflect current reality (sync complete, Hermes built-in via upstream)
- Align `doc/SPEC-implementation.md` adapter type list
- Remove or translate `doc/HERMES_DASHBOARD_DEPLOYMENT.md`
- Remove fork's inline Hermes wrapper files if unused after PR #1
- Verify: docs reflect actual code state

### Hotspots that may blow the budget
1. `server/src/adapters/registry.ts` — fork has ~400 lines of inline Hermes code that will conflict with upstream's factory-based approach. This is the SINGLE BIGGEST conflict.
2. `Dockerfile` — fork's Hermes stage must be merged with upstream's evolved multi-stage build
3. `pnpm-lock.yaml` — will be regenerated entirely (not reviewable, requires lockfile refresh)

---

## 7. Open Questions for Proposal Phase

These questions could not be closed during exploration and MUST be resolved in the proposal:

1. **Merge strategy**: Should we do a true `git merge upstream/master` (preserving both histories) or a rebase-style approach (replay fork's patches on top of upstream)?
   - Merge preserves attribution but creates a messy history
   - Rebase is cleaner but rewrites fork history

2. **Inline Hermes code disposition**: The fork's `registry.ts` inline Hermes adapter, `hermes-wrapper.js`, and `hermes-runtime-config.js` — do they contain any functionality that upstream's `@paperclipai/hermes-paperclip-adapter` does NOT provide?
   - Specifically: Paperclip skills preloading, config version sync, Hermes home management, wake prompt rendering
   - Need to audit fork features before discarding

3. **External adapter package**: The fork imports from `hermes-paperclip-adapter` (external npm). Upstream uses `@paperclipai/hermes-paperclip-adapter` (workspace). Which version is more recent/complete? Are they the same package published under different names?

4. **Hermes Docker image vs pip install**: The fork copies FROM Docker image. Should we switch to `pip install hermes-agent==0.17.0` for better reproducibility and smaller image? Tradeoff: COPY is faster to build, pip is more standard.

5. **`doc/HERMES_DASHBOARD_DEPLOYMENT.md`**: This Spanish-language doc exists only in the fork. Should it be translated to English, kept as-is, or removed?

6. **Version pin for re-sync window**: The preflight says "pin to upstream tag with documented re-sync window." Which tag? `v2026.626.0` is the latest stable. Should the fork track canary releases?

7. **Fork identity**: The fork is `MDominicRQ/paperclip` but AGENTS.md documents `HenkDz/paperclip`. Which is the authoritative fork identity? This affects PR targeting and docs.

---

## 8. Executive Summary

**The upstream fork divergence is extreme** (367 commits behind, 1,667 files changed). This is not a trivial sync — it's a heavyweight merge with significant conflicts.

**The single most important finding**: Upstream already has fully built-in Hermes adapters (`@paperclipai/hermes-paperclip-adapter` v0.3.1) with proper registration, UI parsers, CLI formatters, and test coverage. The fork's entire inline Hermes adapter implementation should be evaluated against upstream's and likely discarded. This dramatically reduces the scope of slice (c).

**The Hermes binary story is different than assumed**: Hermes Agent is a Python package, not a standalone binary. The fork's Dockerfile approach (COPY FROM Docker image) is pragmatic and should be continued, but must be pinned to a specific tag.

**All 3 fork QoL patches are already upstreamed** — they require zero preservation effort.

**Three CRITICAL risks**:
1. Hermes does NOT ship prebuilt binaries (the preflight's binary-download strategy is non-viable)
2. The `server/src/adapters/registry.ts` merge conflict will be severe (fork's inline code vs upstream's factory)
3. The `pnpm-lock.yaml` will be fully regenerated (not reviewable)
