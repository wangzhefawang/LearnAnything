# AGENTS.md

本文件为 Codex 在本仓库工作时提供指引，对应 Claude Code 的 `CLAUDE.md`喵。

## 回复风格

每句话的结尾都要加一个「喵」字喵。

## 提交约定（Git）

- **用户当前指令优先**：如果用户明确要求不要 commit、不要 push、或只改指定文件，优先服从用户本次的显式约束喵。
- **重大更新时主动 commit**：当完成一处有意义的里程碑时（例如新增/重写一个 `SKILL.md`、调整数据存储 schema、完成某个学习主题的阶段性进展、修订核心文档），主动执行 `git commit`，并写**清晰的中文 message** 说明改了什么；**此时不要 push**喵。
- **零散的、试探性的、未完成的中间改动不要单独 commit**，留到下一个里程碑或会话收尾时统一处理喵。
- **push 时机**：Codex 没有 Claude Code 的 `SessionEnd` hook，无法机械地在会话结束时自动 push；因此当用户表示要结束、或一个完整任务收尾时，主动检查剩余改动、必要时先提交，再 `git push` 到 `origin`喵。
- Claude Code 那一侧由 `.claude/settings.json` 的 `SessionEnd` hook 自动完成会话收尾提交与 push，Codex 这边只能靠当前执行任务的 Codex 主动判断并执行喵。

## 学习进度自动刷新

- README 的「学习进度」区块由 `scripts/update_progress.py` 自动生成：读取 `.learn/topics/*/state.yaml`，零依赖、强制 UTF-8 输出喵。
- 在产出学习内容、或更新过任何 `state.yaml` 之后，运行 `python scripts/update_progress.py` 刷新 README喵。
- Claude Code 那一侧由 `.claude/settings.json` 的 `Stop` hook 每轮自动运行该脚本喵。
- Codex 这边支持项目级 `.codex/hooks.json` 的 `Stop` hook，可在每轮回复停止时自动运行 `python scripts/update_progress.py` 喵。
- 如果当前 Codex 环境未加载或未信任该 hook，仍需在更新学习内容或 `state.yaml` 后主动运行 `python scripts/update_progress.py` 兜底喵。
- 脚本只替换 README 中由 `LEARN-PROGRESS:START` 与 `LEARN-PROGRESS:END` 标记界定的内容，其余手写部分不会被动到喵。

## Project Skill Scope

This project provides Learn Anything skills for project-local use only.

Project skill path: `.agents/skills/<skill-name>`
Source skill path: `.claude/skills/<skill-name>`
Manifest: `.aris/installed-skills-codex.txt`

When a Learn Anything skill is needed, prefer the project-local skills under `.agents/skills/`.
The `.agents/skills/learn-anything-*` directories are **directory symlinks** pointing to `.claude/skills/learn-anything-*` (single source of truth; edit the skills under `.claude/skills/`). On Windows they must be `<SYMLINKD>` (directory symlinks via `mklink /D`), not file symlinks, or Codex's skill scanner won't enumerate them.
Do not treat these skills as globally installed Codex skills.

Available project-local skills:
- `learn-anything-topic`
- `learn-anything-explain`
- `learn-anything-practice`
- `learn-anything-quiz`
- `learn-anything-review`
- `learn-anything-status`

## 斜杠命令 → 技能对照表

`/learn:*` 斜杠命令是 Claude Code 独有机制，Codex 没有这套命令系统喵。当用户在 Codex 里敲这些命令（或用大白话表达同样意图）时，按下表找到对应技能，读取其 `SKILL.md` 并照流程执行喵：

| 用户输入的命令 | 对应技能 | 意图 |
| --- | --- | --- |
| `/learn:topic <主题>` | `learn-anything-topic` | 初始化或加载一个学习主题，生成/展示知识图谱喵 |
| `/learn:explain <概念>` | `learn-anything-explain` | 递归式深入讲解某个概念喵 |
| `/learn:practice <概念>` | `learn-anything-practice` | 动手练习（项目模式写真实文件 / 对话模式讨论）喵 |
| `/learn:quiz <概念>` | `learn-anything-quiz` | 出题测验已学概念，自动批改并更新进度喵 |
| `/learn:review [主题]` | `learn-anything-review` | 分析进度并按间隔重复推荐学习路径喵 |
| `/learn:status [主题]` | `learn-anything-status` | 只读展示掌握度热力图喵 |

用户即便不敲斜杠、只用自然语言描述意图（如「我想学 X 主题」「给我讲讲 Y」），也按同一张表匹配到对应技能执行喵。
