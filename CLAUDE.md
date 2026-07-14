# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 回复风格

每句话的结尾都要加一个「喵」字喵。

## 默认工作方式

- **除非用户明确要求，默认召唤 codex 来干活，Claude 负责审查其产出内容**——即先把任务交给 codex（`mcp__codex__codex` 工具）执行，Claude 再对结果做审查、把关和必要的修正喵。
- **适用范围包含讲解辅导**：不只是写代码/改文件/跑脚本这类实现任务，连 learn-anything 的讲解、练习、答疑等内容，也要先让 codex 起草，Claude 再审查修正后交付喵。
- 用户明确说「你自己做」「不用 codex」之类时，Claude 直接执行，不再转交喵。
- **codex 也必须遵守本文件的所有约定**：委派 codex 起草时，要把「会话文件命名规范」等约束一并传达给它；无论是 codex 还是 Claude 落盘，最终文件名都必须符合下面的规范喵。

## 会话文件命名规范

learn-anything 的讲解会话文件位于 `.learn/topics/<知识领域>/sessions/<子域-slug>/`，统一采用如下命名喵：

```
<概念名原样>--YYYY-MM-DD--<子主题-kebab>.md
```

- `<概念名原样>`：与 `state.json` 中该概念的 `name` 完全一致，不翻译、不改写（例如 `Transformer 架构`、`大模型预训练 Pretraining`）喵。
- 分隔符是**双连字符 `--`**，把「概念名 / 日期 / 子主题」三段清晰隔开喵。
- **日期 `YYYY-MM-DD` 夹在中间**：这样同一概念的会话文件在文件系统里会先按概念聚合、再按时间自然排序，便于回看学习时间线喵。
- `<子主题-kebab>`：本次讲解聚焦的子主题，转成 kebab-case（拉丁字母小写、以连字符连词，中文照写），例如 `多头注意力`、`位置编码`、`qkv计算机制`、`softmax注意力权重`；若本次就是该概念的总览，用 `整体概览`喵。
- 同一概念同一天的不同子主题因子主题不同而天然不重名喵。

会话头部必须是 blockquote，并至少包含以下字段喵：

```markdown
> **Date:** YYYY-MM-DD
> **Concept-IDs:** [primary-concept-id, other-concept-id]
> **Knowledge Domain:** 知识领域显示名
> **Path:** 子域 → 主概念
> **Level:** beginner/intermediate/advanced
```

一次讲解覆盖多个概念时只写一份会话文件，`Concept-IDs` 列出全部实际覆盖的 `concept_id`，primary 必须放在首位喵。

## 提交约定（Git）

- **重大更新时主动 commit**：当完成一处有意义的里程碑时（例如新增/重写一个 `SKILL.md`、调整数据存储 schema、完成某个学习主题的阶段性进展、修订核心文档），主动执行 `git commit`，并写**清晰的中文 message** 说明改了什么；**此时不要 push**喵。
- **零散的、试探性的、未完成的中间改动不要单独 commit**，留到下一个里程碑或交给会话结束的兜底提交喵。
- **push 交给 `SessionEnd` hook 自动完成**，不要在会话中途手动 push（除非用户明确要求）喵。
- 会话结束时 `.claude/settings.json` 的 `SessionEnd` hook 会兜底提交所有剩余改动并 push 到 `origin`喵。

## 这个仓库是什么

这**不是**传统应用程序，而是名为「Learn Anything」的 Claude Code 技能包，核心程序是 `.claude/skills/` 中由 Claude 执行的 Markdown 提示词喵。
仓库同时包含无外部依赖的 Node.js 校验、渲染与状态脚本，以及用于验证提示词契约和数据行为的自动化测试喵。

## 仓库结构

- `.claude/commands/learn/*.md` —— 轻量的斜杠命令入口（`/learn:topic`、`/learn:explain`、`/learn:practice`、`/learn:quiz`、`/learn:review`、`/learn:status`），每个都只是转发给对应的技能喵。
- `.claude/skills/learn-anything-*/SKILL.md` —— 真正的逻辑所在；每个文件都是一段详细的提示词，定义了一条辅导工作流喵。
- `.learn/topics/<知识领域>/` —— v2 知识定义、学习进度和领域归属的运行时存储喵。
- `.learn/topics/<视图名>.view.json` —— 岗位、项目或学习目标的概念引用真相源喵。
- `.learn/topics/<视图名>.md` —— 由 `scripts/render-views.mjs` 自动生成的进度报告，不得手改喵。
- `scripts/validate-learning-store.mjs` —— 执行 v2 schema、`concept_id` 全局唯一、view 引用、会话头和计数日期一致性的权威校验喵。
- `scripts/render-views.mjs` —— 从 view.json 与实时领域 state 切片确定性生成视图报告，支持 `--check` 喵。
- `tests/*.test.mjs` 与 `tests/test_update_progress.py` —— 自动化契约与行为测试喵。

每个命令文件都是对应技能的 1:1 包装 —— 要改变行为，请编辑 `SKILL.md`，而不是命令存根喵。

## 六个技能及其关联

这些技能是相互独立的命令，但共享 v2 知识领域与学习视图契约喵。

- **learn-anything-topic**（`/learn:topic <name>`）—— 双模式入口；维护或扩展知识领域，或从领域概念组装岗位/项目学习视图喵。
- **learn-anything-explain**（`/learn:explain <concept>`）—— 递归式深入讲解，采用「定位 → 类比 → 机制 → 代码 → 常见误区 → 苏格拉底式检查」的结构喵。
- **learn-anything-practice**（`/learn:practice <concept>`）—— 双模式练习；项目模式在领域的 `exercises/<concept_id>/` 写真实文件，对话模式进行概念讨论喵。
- **learn-anything-quiz**（`/learn:quiz <concept-or-scope>`）—— 为已讲解或非 unexplored 的概念生成、批改并保存 `quizzes/<concept_id>/` 题库喵。
- **learn-anything-review**（`/learn:review [知识领域名或视图名]`）—— 按领域或 view 引用聚合进度，并用间隔重复公式推荐路径喵。
- **learn-anything-status**（`/learn:status [知识领域名或视图名]`）—— 调用双模式 CLI 只读展示领域热力图、视图聚合或全库总览喵。

## 数据存储契约（最需要理解的部分）

知识领域拥有概念定义与进度，学习视图只引用领域概念，两者职责不得混淆喵。

```
.learn/topics/
├── <知识领域>/
│   ├── state.json                 # version: 2, kind: knowledge_domain
│   ├── knowledge-map.md           # # 领域 / ## 子域 / - 概念 / 缩进细节
│   ├── sessions/<子域-slug>/      # 完整讲解会话
│   ├── exercises/<concept_id>/    # 项目模式练习与练习记录
│   └── quizzes/<concept_id>/      # 可复用题库
├── <视图名>.view.json             # version: 2, kind: learning_view，引用真相源
└── <视图名>.md                    # 自动生成的进度报告
```

`state.json` 是领域内概念定义和进度的真相源，每个概念必须包含 `concept_id`、`name`、`status`、`confidence`、`practice_count`、`explain_count`、`last_explained`、`last_practiced` 与 `details` 喵。
`view.json` 是视图成员和顺序的真相源，每项只能包含 `concept_id` 与 `importance`，其中 importance 为 `core`、`recommended` 或 `optional` 喵。
生成的 `<视图名>.md` 不是输入或真相源，任何技能都不得直接编辑喵。

### concept_id 规则

- 概念定位、会话头、练习目录、题库目录和 view 引用一律使用 `concept_id`，用户口语概念名必须先解析为恰好一个 ID 喵。
- 解析歧义时列出候选的概念名、`concept_id`、子域和所属知识领域，等待用户选择，不得猜测喵。
- 新 ID 使用 NFC 规范化，ASCII 字母小写，非字母数字序列折叠为单连字符，去掉首尾连字符，最多 64 个字符；中文等 Unicode 字母保持原样喵。
- `concept_id` 在全部知识领域的定义间全局唯一，写入后运行 `node scripts/validate-learning-store.mjs .learn/topics` 校验喵。
- 读到 `version: 1` 或缺少 `kind` 的 state 时，明确告知用户数据未迁移并停止，不得兼容解析或静默转换喵。

`status` 生命周期是六个技能共享的词汇，修改任何技能时必须保持这些取值完全一致喵：
`unexplored` → `in_progress` → `needs_practice` ⇄ `mastered`喵。

review 技能用下面这条公式给概念排序，所以 confidence 和 `last_practiced` 必须保持有意义喵：
```
priority = (1 - confidence) * (days_since_last_practice + 1) * w
w = 1.0 needs_practice | 0.6 in_progress | 0.3 mastered | 0.1 unexplored
```

## 每个技能都必须遵守的约定（编辑提示词时）

- **语言镜像** —— 每个技能开头都会指示 Claude 用用户的语言回复；编辑时请保留这条规则喵。
- **同回合持久化（关键不变量）** —— 任何技能写入会话/练习/题库并更新 `state.json` 时，必须在产出内容的同一回合完成；随后同回合运行 `node scripts/validate-learning-store.mjs .learn/topics` 和 `node scripts/render-views.mjs .learn/topics`，再展示下一步选项喵。
- **会话文件自包含** —— 保存的会话必须包含完整的讲解内容，而非要点列表，这样用户脱离聊天也能重读喵。
- **文件名语言** —— 会话与练习文件名采用概念在 state 中的原样名称，不翻译；子主题部分才做 kebab 化喵。
- **教学法即规格** —— 苏格拉底式引导优先于灌输、每个抽象概念都要有类比、难度依据 `state.json` 的 confidence 自适应；这些行为规则就是产品功能喵。

## 如何测试改动

运行 `node --test tests/*.test.mjs` 验证 Node 契约与行为，并运行 `python -m unittest tests.test_update_progress` 验证 README 进度脚本喵。
提示词改动还应在 Claude Code 会话中运行对应斜杠命令做冒烟，确认领域/视图选择、文件写入和同回合渲染符合技能规格喵。
仓库运行在 Windows/PowerShell 上，示例不得依赖宿主不存在的 Bash 专用语法喵。
