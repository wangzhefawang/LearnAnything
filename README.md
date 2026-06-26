# LearnAnything

个人学习仓库 —— 基于 [Learn Anything](.claude/skills/) Claude Code 技能包的 AI 辅导学习记录。

<!-- LEARN-PROGRESS:START 此区块由 scripts/update_progress.py 自动生成，请勿手动编辑 -->
## 📚 学习进度

> 数据来源：`.learn/topics/*/state.yaml` ｜ 快照时间：2026-06-27
> 图例：✅ 已掌握 ｜ 🔵 学习中 ｜ 🟡 待练习 ｜ ⚪ 未开始

_暂无学习记录。运行 `/learn:topic <主题>` 开始第一个主题。_
<!-- LEARN-PROGRESS:END -->

## 🛠 如何使用

在 Claude Code 会话中通过斜杠命令驱动学习流程：

- `/learn:topic <主题>` —— 初始化或加载一个学习主题
- `/learn:explain <概念>` —— 递归式深入讲解
- `/learn:practice <概念>` —— 项目模式 / 对话模式练习
- `/learn:review [主题]` —— 间隔重复推荐学习路径
- `/learn:status [主题]` —— 掌握度热力图

详见 [docs/命令教学.md](docs/命令教学.md)。

## 🔄 更新技能包

作者发布新版本后，在**仓库根目录**运行以下命令，把技能 / 命令文件刷新到最新版（仅更新 `.claude`/`.codex` 等技能文件，**不会影响 `.learn/` 学习进度**）：

```powershell
npx -y learn-anything-cli@latest update . --lang zh-CN
```

> 注：上方「学习进度」区块由脚本自动生成，学习后运行 `python scripts/update_progress.py` 即可刷新。
