# leonfallm/skills

[![skills.sh](https://skills.sh/b/leonfallm/skills)](https://skills.sh/leonfallm/skills)

Cross-platform, agent-agnostic agent skills, built at [Monterro](https://www.monterro.com)
and shared. Plain scripts + markdown that work in Claude Code, Codex, Cursor, opencode, and
any Agent-Skills-standard harness.

## Quickstart (30-second setup)

Run the skills.sh installer:

```bash
npx skills@latest add leonfallm/skills
```

Pick the skills you want and which agents to install them to (Claude Code, Codex, Cursor, …).

## Install as a Claude Code plugin

Prefer a managed install you don't maintain by hand? These skills also ship as a native
Claude Code plugin — a read-only bundle that updates when a new version ships.

Inside Claude Code:

```
/plugin marketplace add leonfallm/skills
/plugin install leonfallm-skills@leonfallm
```

Or from your shell:

```bash
claude plugin marketplace add leonfallm/skills
claude plugin install leonfallm-skills@leonfallm
```

> Using Codex or another agent? The skills.sh installer puts these into Codex, Cursor,
> Copilot, and other Agent-Skills-standard harnesses too — the skills detect the harness
> they run in and adapt.

## Skills

- **[canvas-architect](./skills/engineering/canvas-architect/SKILL.md)** — Draw polished,
  hand-drawn architecture / C4 / flow / sequence / comparison diagrams on a live
  [tldraw offline](https://offline.tldraw.com) canvas. Reusable primitives, swappable
  palettes (ink / cool / warm), and a screenshot-verify loop so diagrams come out designed,
  not wireframed. Requires the free tldraw offline desktop app.

_More to come._

## Layout

```
skills/<category>/<name>/
  SKILL.md        # metadata (name, description) + instructions
  scripts/        # executable helpers
  references/     # docs loaded on demand
```
