## ADDED Requirements

### Requirement: 会话文件必须持久化深入方向建议

explain 技能保存的会话文件 MUST 在 `## Next Steps` 小节写入本次讲解产出的 2-4 个深入方向建议，每个方向 MUST 包含 1-2 句学习理由，并且 MUST 提供 `/learn:practice` 入口。该小节 MUST NOT 保留占位文字。

#### Scenario: 讲解完成后保存会话文件

- **WHEN** explain 技能完成概念讲解并写入本次会话文件
- **THEN** 会话文件的 `## Next Steps` 小节包含 2-4 个深入方向建议、每个方向的学习理由以及 `/learn:practice` 入口

#### Scenario: 生成新的会话文件

- **WHEN** explain 技能根据会话文件模板生成新的讲解记录
- **THEN** `## Next Steps` 小节写入本次讲解的真实建议内容，且不包含等待用户选择子主题后再更新的占位文字

### Requirement: 对话展示与落盘内容必须零漂移

explain 技能 MUST 在写会话文件之前完成深入方向建议的组织，并 SHALL 将同一建议内容写入会话文件。文件写入后，技能 MUST 在对话中原样展示已写入 `## Next Steps` 的建议，不得重新组织、改写或省略。

#### Scenario: 写入后展示深入方向建议

- **WHEN** explain 技能已经将深入方向建议写入会话文件的 `## Next Steps` 小节
- **THEN** Step 5 在对话中逐字展示该小节中已写入的建议内容

#### Scenario: 建议包含 practice 入口

- **WHEN** 会话文件的 `## Next Steps` 小节包含深入方向建议及 `/learn:practice` 入口
- **THEN** 对话中展示的方向、理由、顺序和 practice 入口与落盘内容完全一致
