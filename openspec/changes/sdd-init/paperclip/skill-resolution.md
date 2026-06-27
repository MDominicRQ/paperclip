# Skill Resolution Cache — paperclip

Detected: 2026-06-27  
Resolution mode: `paths-injected`

## Scan Result

- Project skill roots found:
  - `/workspace/paperclip/skills/`
  - `/workspace/paperclip/.agents/skills/`
  - `/workspace/paperclip/.claude/skills/`
- Project skill roots not found:
  - `/workspace/paperclip/.opencode/skills/`
  - `/workspace/paperclip/opencode.json*`
- User/global OpenCode skill root found:
  - `/home/developer/.config/opencode/skills/`
- Non-SDD skill registry cache:
  - `/workspace/paperclip/.atl/skill-registry.md`

## Project Skills Relevant to Future Phases

| Skill | Path | Use |
| --- | --- | --- |
| `paperclip` | `/workspace/paperclip/skills/paperclip/SKILL.md` | Paperclip API coordination, issue updates, task status, governance. |
| `paperclip-dev` | `/workspace/paperclip/skills/paperclip-dev/SKILL.md` | Local Paperclip development, server lifecycle, tests/builds, worktrees. |
| `design-guide` | `/workspace/paperclip/.claude/skills/design-guide/SKILL.md` | UI components/pages/styling and Paperclip design-system conventions. |
| `create-agent-adapter` | `/workspace/paperclip/.agents/skills/create-agent-adapter/SKILL.md` | New or changed adapter packages and adapter registries. |
| `paperclip-create-plugin` | `/workspace/paperclip/skills/paperclip-create-plugin/SKILL.md` | External Paperclip plugin development and local plugin loop. |
| `company-creator` | `/workspace/paperclip/.agents/skills/company-creator/SKILL.md` | Agent company package scaffolding. |
| `paperclip-create-agent` | `/workspace/paperclip/skills/paperclip-create-agent/SKILL.md` | Hiring/configuring agents inside Paperclip. |
| `paperclip-converting-plans-to-tasks` | `/workspace/paperclip/skills/paperclip-converting-plans-to-tasks/SKILL.md` | Converting plans into Paperclip issues/tasks. |
| `diagnose-why-work-stopped` | `/workspace/paperclip/skills/diagnose-why-work-stopped/SKILL.md` | Forensics for stalled/looping work trees. |
| `terminal-bench-loop` | `/workspace/paperclip/skills/terminal-bench-loop/SKILL.md` | Bounded Terminal-Bench loop through Paperclip. |
| `release` | `/workspace/paperclip/.agents/skills/release/SKILL.md` | Full Paperclip release coordination. |
| `release-changelog` | `/workspace/paperclip/.agents/skills/release-changelog/SKILL.md` | Stable release changelog generation. |
| `release-changelog-discord-message` | `/workspace/paperclip/.agents/skills/release-changelog-discord-message/SKILL.md` | Discord release announcement. |
| `doc-maintenance` | `/workspace/paperclip/.agents/skills/doc-maintenance/SKILL.md` | Documentation drift audit and PR preparation. |
| `prcheckloop` | `/workspace/paperclip/.agents/skills/prcheckloop/SKILL.md` | Iterating PR checks to green. |
| `pr-report` | `/workspace/paperclip/.agents/skills/pr-report/SKILL.md` | Deep PR/contribution analysis report. |
| `deal-with-security-advisory` | `/workspace/paperclip/.agents/skills/deal-with-security-advisory/SKILL.md` | GitHub Security Advisory response. |

## User/OpenCode Skills Relevant to SDD Orchestration

These are intentionally not duplicated into `.atl/skill-registry.md` when the registry skip rules exclude SDD skills, but future SDD phases can load them by exact path:

| Skill | Path |
| --- | --- |
| `sdd-explore` | `/home/developer/.config/opencode/skills/sdd-explore/SKILL.md` |
| `sdd-propose` | `/home/developer/.config/opencode/skills/sdd-propose/SKILL.md` |
| `sdd-spec` | `/home/developer/.config/opencode/skills/sdd-spec/SKILL.md` |
| `sdd-design` | `/home/developer/.config/opencode/skills/sdd-design/SKILL.md` |
| `sdd-tasks` | `/home/developer/.config/opencode/skills/sdd-tasks/SKILL.md` |
| `sdd-apply` | `/home/developer/.config/opencode/skills/sdd-apply/SKILL.md` |
| `sdd-verify` | `/home/developer/.config/opencode/skills/sdd-verify/SKILL.md` |
| `sdd-archive` | `/home/developer/.config/opencode/skills/sdd-archive/SKILL.md` |

## Registry Contract

`.atl/skill-registry.md` is an index, not the source of truth. Future SDD phases should pass exact `SKILL.md` paths to phase executors, and those executors must read the full skill file before work.
