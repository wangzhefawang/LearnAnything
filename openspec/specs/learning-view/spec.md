# learning-view Specification

## Purpose
TBD - created by archiving change restructure-topics-to-knowledge-domains. Update Purpose after archive.
## Requirements
### Requirement: view.json 是视图的唯一真相源
每个岗位/项目 MUST 对应一个 `.learn/topics/<名称>.view.json`，包含 `version: 2`、`kind: "learning_view"`、`name`、`slug`、`created`、`concepts[]`；每个条目 MUST 只含 `concept_id` 与 `importance`。岗位与科研项目 MUST 共用同一 `kind`，不作区分。机器发现视图 MUST 只依据 `.view.json` 文件，MUST NOT 把任意同级 `.md` 当作视图。

#### Scenario: status 技能枚举所有视图
- **WHEN** `/learn:status` 需要列出所有岗位/项目
- **THEN** 它扫描 `.learn/topics/*.view.json`，忽略同级的 `.md` 文件与知识领域文件夹

### Requirement: importance 三档语义
`importance` MUST 取 `core` / `recommended` / `optional` 三值之一，表达该概念对此岗位的重要性；系统 MUST NOT 将其解释为要求深度。`concepts[]` 数组顺序即该岗位的建议学习路线与报告展示顺序。review 的优先级公式 MUST 保持不变，`importance` 仅作次级排序键（`core > recommended > optional`），仅在 priority 完全相同时生效，MUST NOT 进入公式计算。

#### Scenario: review 按视图推荐时两概念 priority 相同
- **WHEN** 视图内两个概念的 priority 计算结果相同，一个 `core` 一个 `optional`
- **THEN** `core` 排在前面；priority 不同时仍按 priority 排序

#### Scenario: 校验器读取 view.json
- **WHEN** 校验器读取一份 view.json
- **THEN** `importance` 出现三值之外的取值时校验失败

### Requirement: 视图引用必须可解析且不重复
view.json 中每个 `concept_id` MUST 能在全部知识领域 state.json 中解析到恰好一个概念，且同一 view 内 MUST NOT 重复引用同一 `concept_id`。校验器 MUST 检查这两条并在违反时报具体 id。

#### Scenario: 引用了不存在的概念
- **WHEN** 校验器发现 view 中某 `concept_id` 在所有知识领域中都找不到
- **THEN** 校验失败并列出断链的 id 与所在 view 文件

### Requirement: 岗位进度聚合
status/review 技能 SHALL 支持按视图聚合：给定一个 view，顺着 `concept_id` 到各知识领域 state.json 取进度，按 view 内顺序与 importance 渲染该岗位的掌握度热力图与推荐路径。聚合 MUST 每次重读 view.json 与 state.json，MUST NOT 读取自动生成的 `.md` 报告。

#### Scenario: 查看某岗位进度
- **WHEN** 用户运行 `/learn:status 智驾系统开发`
- **THEN** 输出该视图全部概念的进度热力图，数据来自各知识领域 state.json 的实时值

#### Scenario: 查看知识领域自身进度
- **WHEN** 用户运行 `/learn:status 自动驾驶系统`
- **THEN** 直接渲染该知识领域 state.json 的进度，不经过任何视图

### Requirement: 自动生成的岗位进度报告
每个 view MUST 伴随一份自动生成的 `.learn/topics/<名称>.md` 进度报告。生成 MUST 确定性（同一输入产生相同字节，不含生成时刻），顶部 MUST 声明「自动生成勿手改」并附输入摘要哈希。explain/practice/quiz 更新状态后 MUST 在同回合重新生成受影响的报告；view.json 修改后 MUST 立即重新生成；SessionEnd hook 仅作兜底。系统 MUST 提供 `--check` 模式：只比对磁盘报告与重算结果，不写文件。

#### Scenario: 讲解后报告同步刷新
- **WHEN** explain 更新了概念 `adas-noa-功能定义` 的 confidence，而该概念被「智驾系统开发」view 引用
- **THEN** 同回合内 `智驾系统开发.md` 被重新生成，内容反映新 confidence

#### Scenario: 检查报告是否过期
- **WHEN** 运行 `render-views --check`
- **THEN** 磁盘上任一岗位 md 与重算结果不一致时返回非零并列出过期文件，且不修改任何文件

### Requirement: topic 技能支持组装视图
topic 技能 SHALL 新增视图组装模式：新建岗位/项目时，从已有知识领域挑选概念生成 view.json；仅当所需概念不存在时才在相应知识领域中新建概念，MUST NOT 为视图凭空生成独立的概念树。

#### Scenario: 新建一个岗位视图
- **WHEN** 用户 `/learn` 一个新岗位「机器人算法工程师」
- **THEN** topic 技能列出各知识领域中匹配的既有概念供挑选组成 view.json，缺失的概念补建到对应知识领域后再引用

### Requirement: README 汇总视图进度
`scripts/update_progress.py` SHALL 在 README 进度区块展示各视图的汇总进度并链接到对应的岗位 md 报告。汇总指标 MUST 定义为概念 confidence 的算术平均 `mean(confidence)`，并同时展示 `mastered/total`；MUST NOT 引入 importance 加权。

#### Scenario: 会话结束刷新 README
- **WHEN** SessionEnd hook 运行 `update_progress.py`
- **THEN** README 进度区块含每个视图的汇总（概念数、mean(confidence)、mastered/total）及指向 `<名称>.md` 的链接

