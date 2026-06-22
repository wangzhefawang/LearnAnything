## Project Skill Scope

This project provides Learn Anything skills for project-local use only.

Project skill path: `.agents/skills/<skill-name>`
Source skill path: `.claude/skills/<skill-name>`
Manifest: `.aris/installed-skills-codex.txt`

When a Learn Anything skill is needed, prefer the project-local skills under `.agents/skills/`.
The `.agents/skills/learn-anything-*` directories are copied from `.claude/skills/learn-anything-*`.
Do not treat these skills as globally installed Codex skills.

Available project-local skills:
- `learn-anything-topic`
- `learn-anything-explain`
- `learn-anything-practice`
- `learn-anything-review`
- `learn-anything-status`
