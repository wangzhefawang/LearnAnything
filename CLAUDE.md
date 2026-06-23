# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 回复风格

每句话的结尾都要加一个「喵」字喵。

## 提交约定（Git）

- **重大更新时主动 commit**：当完成一处有意义的里程碑时（例如新增/重写一个 `SKILL.md`、调整数据存储 schema、完成某个学习主题的阶段性进展、修订核心文档），主动执行 `git commit`，并写**清晰的中文 message** 说明改了什么；**此时不要 push**喵。
- **零散的、试探性的、未完成的中间改动不要单独 commit**，留到下一个里程碑或交给会话结束的兜底提交喵。
- **push 交给 `SessionEnd` hook 自动完成**，不要在会话中途手动 push（除非用户明确要求）喵。
- 会话结束时 `.claude/settings.json` 的 `SessionEnd` hook 会兜底提交所有剩余改动并 push 到 `origin`喵。

## 这个仓库是什么

这**不是**应用程序代码，而是一个名为「Learn Anything」的 **Claude Code 技能包**，一套完全由 Markdown 提示词文件构成的 AI 辅导系统喵。这里没有构建流程、没有测试套件、也没有可运行的二进制文件；真正的「程序」就是 `.claude/skills/` 里那些由 Claude 自己执行的指令喵。在这里工作时，你修改的是 *Claude 的行为*，而不是在写需要编译的软件喵。

## 仓库结构

- `.claude/commands/learn/*.md` —— 轻量的斜杠命令入口（`/learn:topic`、`/learn:explain`、`/learn:practice`、`/learn:review`、`/learn:status`），每个都只是转发给对应的技能喵。
- `.claude/skills/learn-anything-*/SKILL.md` —— 真正的逻辑所在；每个文件都是一段详细的提示词，定义了一条辅导工作流喵。
- `.learn/topics/<topic-name>/` —— 运行时的数据存储，由技能在学习过程中创建和修改（在用户开始某个主题前为空）喵。

每个命令文件都是对应技能的 1:1 包装 —— 要改变行为，请编辑 `SKILL.md`，而不是命令存根喵。

## 五个技能及其关联

这些技能是相互独立的命令，但共享一份契约：`.learn/topics/<topic>/` 数据存储喵。

- **learn-anything-topic**（`/learn <topic>`）—— 入口；生成 `knowledge-map.md` + 初始 `state.yaml`，或加载已有主题并汇报进度喵。
- **learn-anything-explain**（`/learn-explain <concept>`）—— 递归式深入讲解，采用「定位 → 类比 → 机制 → 代码 → 常见误区 → 苏格拉底式检查」的结构喵。
- **learn-anything-practice**（`/learn-practice <concept>`）—— 双模式练习：**项目模式**为编程类主题在 `exercises/<slug>/` 下写真实文件，**对话模式**为概念类主题进行讨论喵。
- **learn-anything-review**（`/learn-review [topic]`）—— 分析进度，并用间隔重复的优先级评分推荐学习路径喵。
- **learn-anything-status**（`/learn-status [topic]`）—— 只读的掌握度热力图可视化喵。

## 数据存储契约（最需要理解的部分）

每个技能都读写同一份 per-topic 文件，因此这份 schema 的一致性是核心的架构关注点喵。

```
.learn/topics/<topic-name>/
├── knowledge-map.md      # 层级化的概念树（## 领域 / - 概念 / 缩进的细节）
├── state.yaml            # 每个概念的进度，是所有技能的唯一真相来源
├── sessions/             # 完整保存的讲解与练习记录
└── exercises/<slug>/     # 项目模式的练习文件（README.md、starter.<ext> 等）
```

`state.yaml` 每个概念的字段：`path`（"Domain/Concept"）、`status`、`last_practiced`、`practice_count`、`confidence`（0.0–1.0）喵。

`status` 生命周期是五个技能共享的词汇 —— 如果你修改任何技能，请保持这些取值完全一致喵：
`unexplored` → `in_progress` → `needs_practice` ⇄ `mastered`喵。

review 技能用下面这条公式给概念排序，所以 confidence 和 `last_practiced` 必须保持有意义喵：
```
priority = (1 - confidence) * (days_since_last_practice + 1) * w
w = 1.0 needs_practice | 0.6 in_progress | 0.3 mastered | 0.1 unexplored
```

## 每个技能都必须遵守的约定（编辑提示词时）

- **语言镜像** —— 每个技能开头都会指示 Claude 用用户的语言回复；编辑时请保留这条规则喵。
- **同回合持久化（关键不变量）** —— `explain` 和 `practice` 必须在产出讲解内容的**同一回合**内写入会话文件*并*更新 `state.yaml`，在展示下一步选项之前完成；这在那些技能里被标为 ⚠️ CRITICAL，不可弱化喵。
- **会话文件自包含** —— 保存的会话必须包含完整的讲解内容，而非要点列表，这样用户脱离聊天也能重读喵。
- **文件名语言** —— 会话/练习文件名直接采用概念在知识图谱中出现的原样名称（kebab 化 + 日期），绝不强行翻译喵。
- **教学法即规格** —— 苏格拉底式引导优先于灌输、每个抽象概念都要有类比、难度依据 `state.yaml` 的 confidence 自适应；这些行为规则**就是**产品本身，请把它们当作功能需求对待喵。

## 如何测试改动

这里没有自动化测试喵。要验证一处改动，请在 Claude Code 会话里运行对应的斜杠命令（例如 `/learn:explain <concept>`），确认工作流步骤、`.learn/topics/` 下的文件写入、以及 `state.yaml` 的变更都与技能规格相符喵。技能在示例里用的是 `bash` 风格命令（`mkdir -p`），但本仓库跑在 Windows/PowerShell 上 —— 改动任何创建目录的步骤时，请确认它在宿主 shell 里确实能用喵。
