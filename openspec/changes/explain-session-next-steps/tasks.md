## 1. 修改 explain SKILL.md

- [x] 1.1 调整 Step 4 与 Step 5 的顺序说明，要求在写会话文件前组织好 2-4 个深入方向建议、每个方向的 1-2 句理由及 practice 入口
- [x] 1.2 将会话文件模板 `## Next Steps` 下的占位文字替换为写入真实深入方向建议和 practice 入口的明确指引
- [x] 1.3 修改 Step 5，要求只展示会话文件中已经写入的建议，并保留「写文件后逐字回显」的 echo-verbatim 措辞与 zero-drift 不变量

## 2. 增加契约测试

- [x] 2.1 在 `tests/skill-contracts.test.mjs` 增加断言，确认 explain 技能的 `## Next Steps` 模板不再包含旧占位文字
- [x] 2.2 增加断言，确认 explain 技能明确要求把 2-4 个深入方向建议、每个方向的理由和 practice 入口写入会话文件
- [x] 2.3 增加断言，确认 Step 5 要求原样展示已落盘的建议内容，防止对话与会话文件发生漂移

## 3. 验证

- [ ] 3.1 运行 `node --test tests/*.test.mjs`，确认全部 Node.js 契约与行为测试通过
- [ ] 3.2 在 Claude Code 会话中运行 `/learn:explain` 冒烟，确认新会话文件的 `## Next Steps` 已填写，且方向、理由、顺序和 practice 入口与对话展示逐字一致
