# LearnAnything

个人学习仓库 —— 基于 [Learn Anything](.codex/skills/) / [Claude Code](.claude/skills/) 技能包的 AI 辅导学习记录。

<!-- LEARN-PROGRESS:START 此区块由 scripts/update_progress.py 自动生成，请勿手动编辑 -->
## 📚 学习进度

> 数据来源：`.learn/topics/*.view.json` 与各知识领域 `state.json`

### 学习视图

| 名称 | 概念数 | mean(confidence) | 已掌握 / 总数 |
| --- | --- | --- | --- |
| [ai-agent-应用开发](.learn/topics/ai-agent-应用开发.md) | 27 | 4% | 0 / 27 |
| [具身智能](.learn/topics/具身智能.md) | 28 | 3% | 0 / 28 |
| [商汤具身智能研究员](.learn/topics/商汤具身智能研究员.md) | 56 | 2% | 0 / 56 |
| [易成感知算法工程师](.learn/topics/易成感知算法工程师.md) | 19 | 7% | 0 / 19 |
| [智驾系统开发](.learn/topics/智驾系统开发.md) | 24 | 3% | 0 / 24 |
| [机器人开发与仿真测试实习](.learn/topics/机器人开发与仿真测试实习.md) | 26 | 2% | 0 / 26 |
| [机械臂仿真控制考核项目](.learn/topics/机械臂仿真控制考核项目.md) | 14 | 1% | 0 / 14 |
| [知识增强科研问答智能体](.learn/topics/知识增强科研问答智能体.md) | 27 | 2% | 0 / 27 |
| [跨模态推理链自动驾驶](.learn/topics/跨模态推理链自动驾驶.md) | 29 | 0% | 0 / 29 |

### 知识领域总览

| 名称 | 概念数 | mean(confidence) | 已掌握 / 总数 |
| --- | --- | --- | --- |
| Agent、RAG 与知识系统 | 41 | 2% | 0 / 41 |
| 多模态、视觉语言与生成模型 | 9 | 0% | 0 / 9 |
| 大模型基础、训练与对齐 | 10 | 6% | 0 / 10 |
| 强化学习、模仿学习与具身模型 | 15 | 2% | 0 / 15 |
| 感知、传感器与空间智能 | 13 | 1% | 0 / 13 |
| 机器人系统、规划与仿真 | 29 | 1% | 0 / 29 |
| 科研方法、评测与实验设计 | 10 | 0% | 0 / 10 |
| 自动驾驶系统 | 16 | 4% | 0 / 16 |
| 车辆工程、车载系统与功能安全 | 16 | 1% | 0 / 16 |
| 软件与机器学习工程协作 | 19 | 1% | 0 / 19 |
<!-- LEARN-PROGRESS:END -->

## 🛠 如何使用

在 Claude Code 或 Codex 会话中通过学习命令驱动 6 个核心学习流程：

- `/learn:topic <主题>` —— 初始化或加载一个学习主题
- `/learn:explain <概念>` —— 递归式深入讲解
- `/learn:practice <概念>` —— 项目模式 / 对话模式练习
- `/learn:quiz <概念>` —— 测验检验理解程度
- `/learn:review [主题]` —— 间隔重复推荐学习路径
- `/learn:status [主题]` —— 掌握度热力图

详见 [docs/命令教学.md](docs/命令教学.md)。

## 🔄 更新技能包

作者发布新版本后，在**仓库根目录**运行以下命令，把技能 / 命令文件刷新到最新版（仅更新 `.claude`/`.codex` 等技能文件，**不会影响 `.learn/` 学习进度**）：

```powershell
npx -y learn-anything-cli@latest update . --lang zh-CN
```

> 注：上方「学习进度」区块由脚本自动生成，学习后运行 `python scripts/update_progress.py` 即可刷新。
