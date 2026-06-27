# Delta for sync-upstream-internalize-hermes

## Purpose

This change MUST sync to `paperclipai/paperclip:master`, make Hermes a built-in same-container adapter, and remove plugin-only/fork-local drift.

## A. Adapter Runtime — ADDED Requirements

### Requirement: Built-in Hermes runtime

Paperclip MUST use upstream `@paperclipai/hermes-paperclip-adapter`, expose Hermes as built-in, create no default Hermes agent, preserve non-Hermes plugins, protect Hermes secrets, and audit fork Hermes code before discard.

#### Scenario: Built-in no default
- GIVEN a fresh synced server/company
- WHEN board/API lists adapters and agents
- THEN `hermes_local` is available without plugin installation
- AND no Hermes agent exists until an operator hires one

#### Scenario: Plugin works
- GIVEN `~/.paperclip/adapter-plugins.json` has a valid non-Hermes plugin
- WHEN the server starts
- THEN that plugin is listed and Hermes remains built-in

#### Scenario: Secret protected
- GIVEN a Hermes agent is saved with an API key
- WHEN API/DB are inspected
- THEN plaintext is not returned or stored

#### Scenario: Audit visible
- GIVEN fork Hermes code is removed/bypassed
- WHEN PR #1 is reviewed
- THEN the PR body/artifact lists audited files and follow-up items

## B. Container Runtime — ADDED Requirements

### Requirement: Pinned Hermes image runtime

Agent-running production, development, and CI images MUST copy Hermes from stable `nousresearch/hermes-agent:<tag>`, expose `hermes` on `PATH`, and document exclusions and tag bumps.

#### Scenario: Hermes resolves
- GIVEN the runtime image is built
- WHEN `which hermes` and `hermes --help` run inside
- THEN both commands succeed

#### Scenario: Pinned tag
- GIVEN Dockerfiles after apply
- WHEN searched for `nousresearch/hermes-agent`
- THEN references use a stable tag, expected `v2026.6.19` unless re-verified

#### Scenario: Explicit image scope
- GIVEN Dockerfiles and Docker docs
- WHEN inspected
- THEN all agent-running images install Hermes consistently or document exclusion

## C. Documentation Consistency — ADDED Requirements

### Requirement: Docs match Hermes and PostgreSQL

`AGENTS.md` §11, `doc/SPEC-implementation.md`, Docker docs, and DB docs MUST describe built-in same-container Hermes, explicit hiring, and embedded PostgreSQL when `DATABASE_URL` is unset. `doc/HERMES_DASHBOARD_DEPLOYMENT.md` MUST be removed; verified guidance MAY move to English `doc/DOCKER.md`.

#### Scenario: Stale claims gone
- GIVEN updated docs
- WHEN searched for plugin-only/external-only Hermes, obsolete fork/branch claims, or default Hermes
- THEN no stale operator-facing claim remains

#### Scenario: Spanish fork doc no longer drifts
- GIVEN cleanup is complete
- WHEN `doc/` is inspected
- THEN `doc/HERMES_DASHBOARD_DEPLOYMENT.md` is absent
- AND notes are English and verified

#### Scenario: Database wording
- GIVEN updated docs
- WHEN searched for default database claims
- THEN `AGENTS.md`, `doc/DATABASE.md`, and `doc/SPEC-implementation.md` agree

## D. Sync Mechanics — ADDED Requirements

### Requirement: Pinned upstream sync

The fork MUST merge `upstream/master` at a stable tag, never `upstream/main`, document re-pin/resync, request PR #1 `size:exception`, and report slice checks.

#### Scenario: Explicit target
- GIVEN PR #1 is opened
- WHEN its body is inspected
- THEN it names the stable tag, `upstream/master`, and re-sync window

#### Scenario: Size exception
- GIVEN PR #1 has generated/upstream churn
- WHEN its PR body is inspected
- THEN it requests `size:exception` and explains evidence-based review

#### Scenario: Slice verification
- GIVEN each PR is ready
- WHEN its verification section is inspected
- THEN it records `pnpm -r typecheck`, `pnpm test:run`, `pnpm build`
- AND the container slice records a build; Hermes credentialed e2e is not required in CI

## Non-Goals

- Re-externalizing/plugin-only Hermes, default Hermes agents, credentialed e2e CI, or noncritical fork-only Hermes ports.

## Open Decisions

- Confirm upstream tag; proposal expects `v2026.626.0`.
- Confirm Hermes image tag; proposal expects `v2026.6.19`.
- Choose audit artifact format: PR checklist, markdown note, or follow-up issues.

## Verification

- Adapter: board/API list, fresh agent list, plugin fixture, secret redaction/encryption, audit artifact.
- Container: JS checks, Docker build, `which hermes`, `hermes --help`.
- Docs: grep stale Hermes/fork/database terms.
- Sync: inspect PR body for tag, `upstream/master`, re-pin, chain context, `size:exception`.
