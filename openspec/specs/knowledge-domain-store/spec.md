# knowledge-domain-store Specification

## Purpose
TBD - created by archiving change restructure-topics-to-knowledge-domains. Update Purpose after archive.
## Requirements
### Requirement: 知识领域是进度的唯一存储层
系统 SHALL 以 `.learn/topics/<知识领域>/` 目录作为知识点与学习进度的唯一真相源；任何知识点在全仓库 MUST 只存在一份进度记录（status/confidence/计数/日期）。视图文件 MUST NOT 存储进度数值。

#### Scenario: 同一知识点被多个岗位需要
- **WHEN** 两个视图（如「智驾系统开发」和「跨模态推理链自动驾驶」）都引用概念 `多模态大模型-mllm-vlm-基础`
- **THEN** 该概念的进度只存在于其所属知识领域的 state.json 中，任一学习动作更新后，两个视图聚合到的进度同步变化

#### Scenario: 讲解一个概念后写进度
- **WHEN** explain 技能完成一次讲解
- **THEN** 进度写入该概念所属知识领域的 state.json，不写入任何 view 文件

### Requirement: state.json v2 结构
知识领域的 state.json MUST 包含 `version: 2`、`kind: "knowledge_domain"`、`topic`、`slug`、`created`、`domains[]`；每个概念 MUST 包含 `concept_id`、`name`、`status`、`confidence`、`practice_count`、`explain_count`、`last_explained`、`last_practiced`、`details`。`status` 取值 MUST 保持 v1 的四态：`unexplored` → `in_progress` → `needs_practice` ⇄ `mastered`。

#### Scenario: 校验器读取 v2 state.json
- **WHEN** `utils.mjs` 校验器读取一份知识领域 state.json
- **THEN** 缺少 `kind` 或 `concept_id`、或 `status` 取值不在四态之内时校验失败并报具体字段

#### Scenario: 技能遇到 v1 格式
- **WHEN** 任一技能读取到 `version: 1` 或缺少 `kind` 的 state.json
- **THEN** 技能 MUST 报错提示需要迁移，而不是尝试兼容解析

### Requirement: concept_id 命名与全局唯一性
`concept_id` MUST 为中文保留式 slug：中文原样保留、ASCII 字母统一小写、空格与标点转为单个连字符、不含 Windows 非法字符、Unicode NFC 规范化、长度不超过 64 字符。`concept_id` MUST 在**所有知识领域 state.json 的概念定义之间**全局唯一；view 文件对 `concept_id` 的引用不参与唯一性计数。概念改名或移动领域后 `concept_id` MUST NOT 变更。

#### Scenario: 新建概念生成 id
- **WHEN** topic 技能为概念「预期功能安全 SOTIF」生成 id
- **THEN** 得到 `预期功能安全-sotif`，且校验器确认其在全仓库唯一

#### Scenario: 不同知识对象同名冲突
- **WHEN** 两个语义不同的概念生成了相同的 `concept_id`
- **THEN** MUST 通过增加概念自身语义限定词区分（如 `文本-embedding` / `动作-embedding`），MUST NOT 使用领域前缀或数字/哈希后缀

#### Scenario: 概念移动到另一个领域
- **WHEN** 一个概念从领域 A 移动到领域 B
- **THEN** 其 `concept_id` 保持不变，引用它的所有 view 无需修改

#### Scenario: 多个 view 引用同一概念定义
- **WHEN** 「智驾系统开发」和「跨模态推理链自动驾驶」两个 view 都引用 `多模态大模型-mllm-vlm-基础`
- **THEN** 全局唯一性校验通过——唯一性只约束概念定义，跨 view 共同引用是合法且预期的

### Requirement: 知识领域集合开放可扩展
知识领域集合 MUST 保持开放：当新概念不属于任何现有领域时，topic 技能 SHALL 允许创建新的知识领域目录，新目录 MUST 遵循同一 v2 schema 与 concept_id 规则。

#### Scenario: 学习一个全新领域的主题
- **WHEN** 用户 `/learn` 一个现有 10 个领域都容纳不了的主题（如「金融工程」）
- **THEN** topic 技能创建新知识领域目录并生成合规的 knowledge-map.md 与 state.json v2

### Requirement: 概念边界归属规则
向知识领域分配概念时 SHALL 遵守合并判据：在一个场景获得的学习证据能双向、无损地证明另一个场景已掌握时才视为同一概念；只能部分迁移时 MUST 保留为两个概念。通用机制归通用领域（VLM→多模态、通用感知→感知与空间智能），场景特化实现归应用领域（车厂 VLA 落地→自动驾驶系统）。

#### Scenario: 新增一个场景特化概念
- **WHEN** 用户要学习「小鹏第二代 VLA」
- **THEN** 该概念建在「自动驾驶系统」领域，不与「强化学习与具身模型」里的通用 VLA 概念合并进度

### Requirement: 会话文件声明所覆盖的概念
会话文件头部 MUST 包含 `Concept-IDs` 数组字段作为会话与概念的权威关联；一份会话覆盖多个概念时 MUST 只保存一份实体文件，MUST NOT 为每个概念复制副本。数组第一个 id 为 primary concept，MUST 决定会话文件的物理落点（该概念所属领域的 `sessions/<domain-slug>/`）与文件名中的概念名主体。头部的 `Knowledge Domain` 与 `Path` 为展示信息，不参与解析。练习与题库目录路径 MUST 直接使用 `concept_id`；会话目录沿用 `sessions/<domain-slug>/` 布局。

#### Scenario: 一份领域概览覆盖三个概念
- **WHEN** explain 技能产出一份覆盖三个概念的领域概览会话
- **THEN** 会话文件头部写 `Concept-IDs: [id1, id2, id3]`，文件只落盘一次，三个概念的 explain 记录都指向它

#### Scenario: 会话覆盖的概念横跨两个领域
- **WHEN** 一份会话的 Concept-IDs 含领域 A 的 `id1`（首位）与领域 B 的 `id2`
- **THEN** 文件落盘在领域 A 的 `sessions/<domain-slug>/` 下，领域 B 不保存副本

