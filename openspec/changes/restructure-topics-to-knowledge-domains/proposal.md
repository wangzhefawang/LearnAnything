# 提案：topic 重构为「知识领域存储层 + 岗位/项目视图层」

## Why

当前 6 个 topic 全部按「岗位/项目」组织，知识点大量重叠（Transformer/LLM 基础出现在 4 个 topic、RAG/Embedding 在两个 topic 里近乎完全重复），同一知识点的学习进度已经开始在多个 topic 间分裂；CLAUDE.md 中的「跨 topic 知识点进度同步」规则只是给这个结构性问题打的补丁。本变更把知识点变为唯一存储层（single source of truth），岗位/项目降级为引用视图，从结构上消除进度分裂。

## What Changes

- **BREAKING**：`.learn/topics/` 下的一级目录从「岗位/项目」改为「知识领域」（初始 10 个，可扩展）；现有 6 个 topic 的 158 个概念经语义归并后迁入新领域。
- **BREAKING**：`state.json` 升级为 v2 schema：新增 `kind: "knowledge_domain"`，概念的 `slug` 升级为全局唯一、中文保留式的 `concept_id`。
- 新增视图层：每个岗位/项目一个 `<名称>.view.json`（真相源，引用 `concept_id` + `importance`）和一个自动生成的 `<名称>.md` 进度报告，与知识领域文件夹同级。
- 会话文件头部新增 `Concept-IDs` 数组字段；36 个现有会话文件迁移到新知识领域目录。
- 六个技能（topic/explain/practice/quiz/review/status）及 `status.mjs`、`render.mjs`、校验器、`scripts/update_progress.py` 改造为只认 v2 布局；topic 技能新增「从已有知识领域挑概念组装视图」模式。
- CLAUDE.md 数据契约重写；删除「跨 topic 知识点进度同步」规则；修正 `state.yaml` 等契约漂移。
- 迁移采用「离线准备 + 全量校验 + 一次性原子切换」，不保留运行时双格式兼容。

## Capabilities

### New Capabilities
- `knowledge-domain-store`: 知识领域存储层——目录布局、state.json v2 schema、concept_id 命名与全局唯一性规则、领域可扩展性要求。
- `learning-view`: 岗位/项目视图层——view.json schema、importance 三档语义、自动生成 Markdown 报告的确定性与再生成时机、README 汇总链接。
- `v1-to-v2-migration`: 一次性迁移——概念语义归并表、进度合并规则、会话映射、迁移校验不变量、原子切换流程。

### Modified Capabilities
（`openspec/specs/` 目前为空，无既有 spec 需要修改；六个技能的行为变更全部落在上述三个新 capability 中约束。）

## Impact

- **数据**：`.learn/topics/` 全部 6 个 topic 目录、6 份 state.json、36 个会话文件；练习/测验目录（schema 中已定义，当前无实例）的路径规则同步调整。
- **技能与脚本**：6 个 SKILL.md、6 个命令存根、`status.mjs`、各技能 `render.mjs`/`utils.mjs` 校验器、新增跨文件校验器 `validate-learning-store.mjs`、`scripts/update_progress.py` 及其测试 `tests/test_update_progress.py`、README 进度区块。
- **文档契约**：CLAUDE.md（数据存储契约、跨 topic 同步规则、会话文件命名规范中的目录部分）。
- **不受影响**：review 优先级公式、status 生命周期取值、教学法规则（苏格拉底式、类比、难度自适应）、会话文件命名规范的「概念名--日期--子主题」主体。
