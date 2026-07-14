# v1-to-v2-migration Specification

## Purpose
TBD - created by archiving change restructure-topics-to-knowledge-domains. Update Purpose after archive.
## Requirements
### Requirement: 概念归并表先行
迁移 MUST 以一份显式的概念归并表驱动：158 个旧概念（6 个 topic）中的每一个 MUST 有且仅有一条迁移决议，动作四选一——`keep`（原样迁入目标领域，targets 恰好 1 个）、`merge`（归入某 canonical concept_id，targets 恰好 1 个）、`split`（details 与学习证据分配到多个目标，targets ≥ 2 且 MUST 说明分配方式）、`discard`（废弃，附理由）；keep/merge/split 决议 MUST 携带目标知识领域，「移动」不是独立动作。design.md 冲突裁决清单（C1–C13）中的预裁决 MUST 原样落入归并表。

#### Scenario: split 决议迁移一个复合概念
- **WHEN** 迁移「Agent 架构与 ReAct 模式」（split → `agent-架构基础`、`react-推理与行动循环`）
- **THEN** 两个目标概念各得到指定的 details 分配，该旧概念在归并表中仍只占一条决议

#### Scenario: 归并表完整性校验
- **WHEN** 迁移脚本校验归并表
- **THEN** 存在未出现在表中的旧概念、或同一旧概念有两条决议时，迁移中止并报出清单

### Requirement: 进度合并规则
学习事件 MUST 定义为三元组 `(source_session_path, activity_type, concept_id)`；物理会话文件 MUST 恰好 36 份，每个概念迁移后的 `explain_count`/`practice_count` MUST 等于关联到它的对应类型三元组去重数。对判定为同一知识对象的概念，合并后的进度 MUST 满足：`confidence` 取各来源最高值（MUST NOT 取平均）、`last_explained`/`last_practiced` 取最新日期、无对应类型证据时计数为 0 且日期为 `null`、`status` 取 confidence 最高来源的 status（并列时取最近有学习活动者）。已知脏数据（`ai-agent-应用开发` 的计数丢失与 last_practiced 异常、「Transformer 架构」计数 6 与会话证据 7 不一致）MUST 以三元组重建修复。

#### Scenario: 以会话证据重建 Transformer 计数
- **WHEN** 迁移「Transformer 架构」（state 计数 explain_count=6，磁盘会话证据 7 份）
- **THEN** 重建后 explain_count=7，confidence=0.55，last_explained 取最新会话日期 2026-07-02

#### Scenario: 修复计数脏数据
- **WHEN** 迁移「Prompt 工程」（confidence 0.15、explain_count=0，磁盘仅有 2026-06-10 一份会话且无练习证据）
- **THEN** 重建后 explain_count=1、last_explained=2026-06-10、practice_count=0、last_practiced=null

#### Scenario: 合并双方 status 不同
- **WHEN** 合并 unexplored (conf 0) 与 in_progress (conf 0.05) 两个来源
- **THEN** 合并后 status=in_progress（取 confidence 最高来源的 status）

### Requirement: 会话文件迁移
36 个旧会话文件中的每一个 MUST 恰好映射一次到新布局：移入 primary concept（`Concept-IDs` 首位）所属知识领域的 `sessions/<domain-slug>/`，并注入 `Concept-IDs` 头部。一份会话覆盖多个概念时允许一对多映射，但 MUST NOT 复制成多份实体文件。孤儿会话 `PDF-扫描件处理-2026-06-18.md` MUST 按裁决挂入 `文档解析与分块` 的 Concept-IDs。

#### Scenario: 多概念会话迁移
- **WHEN** 迁移 `Agent 与工具调用--2026-07-13--整体概览.md`（覆盖 3 个概念）
- **THEN** 文件只落盘一份，头部 Concept-IDs 含 3 个 id，3 个概念的进度计数各记 1 次讲解事件

### Requirement: 迁移校验不变量
切换前 MUST 全量通过以下校验：每个旧概念恰好一条决议；每个旧会话恰好映射一次且物理文件总数恰好 36；`concept_id` 在概念定义间全局唯一；所有 view 引用可解析且视图内无重复；迁移前后学习事件三元组总数与最新日期可解释性对账（差异 MUST 可由归并表决议解释）；全部 state/view 通过结构校验；`render-views --check` 通过；v2 的 status/review 输出与冻结时保存的 v1 基线对账一致。

#### Scenario: 对账发现事件丢失
- **WHEN** 旧结构的学习事件三元组共 N 条，新结构重建后少于 N 且无 discard 决议可解释
- **THEN** 迁移中止，输出差异清单供人工裁决

### Requirement: 原子切换与不回头
数据迁移、6 个 SKILL.md、命令存根、`status.mjs`、各技能校验器、`update_progress.py`、README 生成与 CLAUDE.md 契约更新 MUST 在同一个迁移里程碑 commit 内完成切换；切换后日常技能 MUST 只认 v2 布局，MUST NOT 保留运行时 v1 兼容分支；CLAUDE.md 的「跨 topic 知识点进度同步」规则 MUST 随本次切换删除，`state.yaml` 等契约漂移一并修正。回滚 MUST 依赖 git（分支不合并或 revert 里程碑 commit）。

#### Scenario: 切换后遇到旧格式残留
- **WHEN** 切换后任一技能在 `.learn/topics/` 下读到 v1 格式文件
- **THEN** 报错提示残留文件需人工处理，不静默兼容

#### Scenario: 迁移期间冻结写入
- **WHEN** 迁移分支工作期间
- **THEN** 不进行任何学习会话写入，迁移以冻结快照为唯一输入

