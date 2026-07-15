## Why

explain 技能仅在对话中给出深入方向建议，保存的会话文件却始终在 `## Next Steps` 中保留占位文字，导致文件脱离聊天后无法完整呈现本次讲解的后续路径，不符合会话文件自包含约定。

## What Changes

- 修改 `.claude/skills/learn-anything-explain/SKILL.md`，要求在写会话文件前组织好 2-4 个深入方向建议及 practice 入口，并将其写入 `## Next Steps`。
- 将会话文件模板中的占位文字替换为填写真实建议内容的明确指引，包括每个方向的学习理由。
- 调整 Step 5，使其原样展示会话文件中已经写入的建议，不再重新组织或改写内容，保持 zero-drift 不变量。
- 在 `tests/skill-contracts.test.mjs` 中增加提示词契约测试，固化 Next Steps 持久化与原样展示行为。
- 本变更不包含 BREAKING 变更。

## Capabilities

### New Capabilities

- `explain-session-recording`：定义 explain 会话文件的内容自包含契约，要求 `## Next Steps` 持久化本次讲解产生的深入方向建议与 practice 入口。

### Modified Capabilities

无。`knowledge-domain-store` 等现有 capability 的需求保持不变。

## Impact

- 修改文件：`.claude/skills/learn-anything-explain/SKILL.md`、`tests/skill-contracts.test.mjs`。
- 历史会话文件不回填，已有内容保持原样；新契约仅约束变更生效后由 explain 技能创建的会话文件。
