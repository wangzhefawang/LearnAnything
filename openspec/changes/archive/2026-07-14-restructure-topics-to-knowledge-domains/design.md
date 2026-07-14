# 设计：知识领域存储层 + 岗位/项目视图层

## Context

`.learn/topics/` 现有 6 个「岗位/项目」topic、158 个概念、36 个会话文件。知识点跨 topic 重叠严重，进度已分裂（如 Function Calling/ReAct 在「知识增强科研问答智能体」里已各讲过 1 次，而 ai-agent 里的同义概念仍是 unexplored，续学时无法衔接）。仓库由 6 个 SKILL.md 提示词 + 一组真实脚本（`status.mjs`、各技能 `render.mjs`/`utils.mjs` 校验器、`scripts/update_progress.py`）共同消费同一份数据契约。单用户仓库，git 全程可回滚，迁移期间可以暂停学习写入。

已知数据脏点：
- `ai-agent-应用开发` 为 v0 迁移遗留，存在 `explain_count=0` 但 `confidence>0` 且有会话文件的记录（计数丢失）。
- `PDF-扫描件处理-2026-06-18.md` 是孤儿会话，state.json 中无对应概念。
- CLAUDE.md 仍写 `state.yaml`，实际为 `state.json`（契约漂移）。
- 存在一份会话覆盖多个概念的实例（`Agent 与工具调用--2026-07-13--整体概览.md`）。
- 计数与会话证据不一致：「Transformer 架构」state 计数 explain_count=6，磁盘会话证据 7 份；全库 explain_count 合计 37 ≠ 物理会话文件 36（物理文件数与概念-会话关联数是两个口径）。

## Goals / Non-Goals

**Goals:**
- 每个知识点在全仓库有且仅有一份进度记录（single source of truth）。
- 岗位/项目作为视图保留：打开一个文件即可看到该岗位的学习进度。
- 知识领域可扩展：后续新领域可随时加入，不需要改 schema。
- 迁移后六个技能与所有脚本只认 v2 布局，无运行时双格式兼容。

**Non-Goals:**
- 不引入概念关系边（`specialization_of`、`prerequisites`）、`aliases`、`tags`、`session_id`、「要求深度」——全部推迟到确有需求时。
- 不改 review 优先级公式、status 生命周期取值、教学法规则。
- 不改会话文件命名规范的「概念名--日期--子主题」主体。

## Decisions

### D1 存储层/视图层分离

```
.learn/topics/
├── <知识领域>/                  ← 存储层（文件夹）
│   ├── knowledge-map.md
│   ├── state.json               (v2)
│   ├── sessions/<domain-slug>/
│   ├── exercises/<slug>/
│   └── quizzes/<slug>/
├── <岗位或项目名>.view.json      ← 视图层真相源（文件）
├── <岗位或项目名>.md             ← 自动生成进度报告（文件）
└── ...
```

文件夹=知识领域、文件=视图，同级共存、天然区分。机器发现视图**只认 `.view.json`**，同名 `.md` 仅是渲染产物。

替代方案：视图放独立目录（如 `.learn/views/`）——被否决，用户明确要求与知识领域一级文件夹同级，且同级更利于「打开 topics 目录一眼看全」。

### D2 知识领域切分（初始 10 个，可扩展）

| # | 显示名 | 目录名 |
|---|---|---|
| 1 | 大模型基础、训练与对齐 | `大模型基础与对齐` |
| 2 | 多模态、视觉语言与生成模型 | `多模态与视觉语言模型` |
| 3 | Agent、RAG 与知识系统 | `agent-rag-与知识系统` |
| 4 | 感知、传感器与空间智能 | `感知与空间智能` |
| 5 | 机器人系统、规划与仿真 | `机器人系统与仿真` |
| 6 | 强化学习、模仿学习与具身模型 | `强化学习与具身模型` |
| 7 | 自动驾驶系统 | `自动驾驶系统` |
| 8 | 车辆工程、车载系统与功能安全 | `车辆工程与功能安全` |
| 9 | 软件与机器学习工程协作 | `软件工程与协作` |
| 10 | 科研方法、评测与实验设计 | `科研方法与实验` |

边界归属规则（迁移与今后新增概念都遵守）：
- 通用 VLM/MLLM → 多模态；通用 VLA、模仿学习 → 强化学习与具身模型；车厂 VLA 落地（如小鹏第二代 VLA）→ 自动驾驶系统，作为独立概念不与通用 VLA 合并进度。
- 摄像头/雷达/点云/RGB-D/三维重建等通用感知机制 → 感知与空间智能；车载布置、传感器冗余、域控接口 → 自动驾驶系统或车辆工程。
- 基础 CoT → 大模型基础；跨模态 CoT → 多模态；数值轨迹自审计 → 自动驾驶系统。
- **合并判据**：在一个场景获得的学习证据能否双向、无损地证明另一个场景已掌握；只能部分迁移的保留两个概念。
- 新概念不属于任何现有领域时，topic 技能可新建知识领域目录（领域集合开放）。

### D3 state.json v2（最小增量）

在 v1 基础上仅新增 `kind`，并把概念 `slug` 升级为 `concept_id`：

```json
{
  "version": 2,
  "kind": "knowledge_domain",
  "topic": "Agent、RAG 与知识系统",
  "slug": "agent-rag-与知识系统",
  "created": "2026-07-14",
  "domains": [
    {
      "name": "Agent 智能体",
      "slug": "agent-智能体",
      "concepts": [
        {
          "concept_id": "react-推理与行动循环",
          "name": "ReAct 推理与行动循环",
          "status": "in_progress",
          "confidence": 0.05,
          "practice_count": 0,
          "explain_count": 1,
          "last_explained": "2026-07-13",
          "last_practiced": null,
          "details": ["…"]
        }
      ]
    }
  ]
}
```

`concept_id` 规则：
- 中文保留式 slug（沿用现有惯例，**不做英文翻译**——翻译会产生同一概念多个 id 的失败模式）。
- 生成规则机械化：中文原样保留、ASCII 统一小写、空格与标点转单个连字符、禁止 Windows 非法字符、Unicode NFC 规范化、长度上限 64。
- **全仓库全局唯一**；概念改名或移动领域后 id 不变。
- 冲突按语义处理：真是同一知识对象则合并；不同对象则加语义限定词（如 `文本-embedding` / `动作-embedding`），不用领域前缀（领域归属会变）、不用数字/哈希后缀。
- 练习（exercises/）与题库（quizzes/）目录需要安全路径时直接使用 `concept_id`；会话文件仍按 `sessions/<domain-slug>/` 存放（见 D6）。
- 全局唯一性的范围是**各知识领域 state.json 中的概念定义之间**；view 对同一 `concept_id` 的引用不参与唯一性计数——多个 view 引用同一概念是合法且预期的。

### D4 view.json（视图真相源）

```json
{
  "version": 2,
  "kind": "learning_view",
  "name": "智驾系统开发",
  "slug": "智驾系统开发",
  "created": "2026-07-14",
  "concepts": [
    { "concept_id": "adas-noa-功能定义", "importance": "core" },
    { "concept_id": "预期功能安全-sotif", "importance": "recommended" }
  ]
}
```

- `importance` 三档：`core` / `recommended` / `optional`；它表达「岗位重要性」，**不是**「要求深度」（后者推迟）。
- 数组顺序即岗位学习路线与报告展示顺序，不设 `order` 字段。
- 岗位与科研项目共用 `kind: "learning_view"`，聚合行为一致，不加 `view_type`。
- **importance 不进 review 公式**：优先级公式保持不变，importance 仅作次级排序键（`core > recommended > optional`），仅在 priority 完全相同时生效。
- README 的岗位汇总指标定义为 `mean(confidence)` 并同时展示 `mastered/total`，不引入 importance 加权。

### D5 自动生成的岗位进度报告 `<名称>.md`

- 永远不是任何技能的输入；聚合一律重读 `view.json` + 各 state.json。
- **确定性生成**：同一输入产生完全相同字节；不写入生成时刻等易变内容，顶部带输入摘要哈希与「自动生成勿手改」声明。
- 再生成时机：explain/practice/quiz 更新状态的同回合、view.json 被修改后；SessionEnd hook 仅兜底。
- 渲染函数共享，两个入口：`status`（终端输出，不落盘）与 `render-views`（写岗位 md）；另有 `render-views --check` 只比对不写盘，供迁移校验与提交前使用。
- README 由 `update_progress.py` 展示岗位汇总并链接到各岗位 md。

### D6 会话文件头部

新增 `Concept-IDs` 数组（一份会话可覆盖多个概念，只存一份实体、多概念引用同一会话，不复制）：

```markdown
> **Date:** 2026-07-14
> **Knowledge Domain:** Agent、RAG 与知识系统
> **Concept-IDs:** [function-calling-工具接口, react-推理与行动循环]
> **Path:** Agent 智能体 → Agent 与工具调用
> **Level:** beginner
```

`Knowledge Domain` 与 `Path` 是给人看的非权威信息，权威关联以 `Concept-IDs` 为准。

**物理落点规则**：`Concept-IDs` 数组的**第一个 id 是 primary concept**，决定会话文件的存放目录（该概念所属领域的 `sessions/<domain-slug>/`）与文件名中的概念名主体；其余 id 仅是关联概念。一份会话覆盖多个领域的概念时同样只落盘一份，落在 primary concept 所在领域。

### D7 一次性原子切换（否决两阶段并行）

两阶段并行意味着六个技能同时理解 v1 topic、v2 领域、view 三种对象，且并行期新会话落点不明，可能制造新的进度分裂。单用户仓库、数据量小、git 可回滚，故采用**离线准备 + 全量校验 + 一次切换**；唯一保留的 v1 兼容能力在迁移脚本里，不在日常技能里。

### D8 归并决议模型与进度合并规则

归并表中每个旧概念有且仅有一条决议，动作四选一：

```text
action: keep | merge | split | discard
targets: [concept_id, ...]    # keep/merge 恰好 1 个；split ≥ 2 个；discard 为空并附理由
target_domain: <目标知识领域>   # 所有 keep/merge/split 决议都携带，「移动」不是独立动作
```

`split` 决议必须同时说明 details 与既有学习证据（若有）如何在目标间分配。

**学习事件的唯一定义**：三元组 `(source_session_path, activity_type, concept_id)`。物理会话文件必须恰好 36 份；每个概念迁移后的 `explain_count` = 关联到它的 explain 三元组去重数（`practice_count` 同理）。

进度合并规则：
- `confidence` 取各来源最高值，**不取平均**（`unexplored` 的 0 会稀释真实进度）。
- `last_explained`/`last_practiced` 取最新日期；无对应类型证据时计数为 0 且日期为 `null`（一并修复 `ai-agent-应用开发` 中 practice_count=0 但 last_practiced 非空的脏数据）。
- `status` 取 confidence 最高来源的 status；confidence 并列时取最近有学习活动的来源（当前快照实际只需覆盖 `unexplored + in_progress → in_progress`）。
- `ai-agent-应用开发` 的 explain_count 丢失、「Transformer 架构」的计数 6 vs 证据 7 等不一致，一律以会话证据三元组重建为准。

## 冲突裁决清单（迁移归并表的预裁决，13 项）

「合并」= 归并为单一概念并按 D8 合并进度；「保留」= 概念都保留、各自进度不动（同入目标领域）；「拆分」= 一个旧概念的 details/证据分配到多个目标概念。所有裁决以 D2 的合并判据（学习证据双向无损可证）为准绳。

| # | 涉及概念（topic/概念，confidence） | 建议 | 理由与合并后取值 |
|---|---|---|---|
| C1 | 具身智能/Transformer 架构 (0.55, 证据 7 份会话、state 计数 6) ↔ 知识增强/Transformers 编码架构 (0) | 保留两概念 | 后者 details 含 encoder-only/decoder-only/encoder-decoder 区分与科研文本编码适用性，前者的 7 次会话未覆盖，不满足双向判据；`transformer-架构` 重建后计数 7、conf 0.55，`transformer-编码架构` 保持 0 |
| C2 | ai-agent/LLM 工作原理与 Token (0.1) ↔ 知识增强/大语言模型 LLM 基本原理 (0) | 拆分后者 | 后者范围更宽（预训练/指令微调/对齐/幻觉/本地模型边界），拆入 `llm-工作原理与-token`(0.1)、大模型领域既有的预训练/SFT/对齐概念，「幻觉与本地模型能力边界」detail 归入既有「本地大模型部署与推理」概念；其进度为 0，拆分零成本 |
| C3 | 知识增强/提示词 Prompt 与上下文管理 (0) ↔ ai-agent/Prompt 工程 (0.15) + ai-agent/上下文设计与管理 (0.1) | 拆分前者 | 拆入 ai-agent 已有的两个概念（其进度为 0，无损）；两概念进度不变 |
| C4 | ai-agent/工具调用 Function Calling (0) ↔ 知识增强/Function Calling 工具接口 (0.05, 讲 1 次) | 合并 → `function-calling-工具调用` | 同一学习对象；conf 0.05 |
| C5 | ai-agent/Agent 架构与 ReAct 模式 (0) ↔ 知识增强/ReAct 推理与行动循环 (0.05, 讲 1 次) | 拆分前者 | 前者是复合概念，拆为 `agent-架构基础`(0) 与并入 `react-推理与行动循环`(0.05)，避免丢失 Agent 架构部分 |
| C6 | ai-agent/向量化 Embedding (0.1) ↔ 知识增强/向量化 Embedding (0) | 合并 → `向量化-embedding` | 唯一严格同名重复；conf 0.1 |
| C7 | ai-agent/文档解析与分块 (0.2) ↔ 知识增强/论文文档分块 Chunking (0) | 保留两概念 | 后者是论文场景特化（公式/表格/跨段依赖），直接合并会把 0.2 扩张到未学部分；`文档解析与分块` 保持 0.2，`论文文档分块-chunking` 保持 0 |
| C8 | ai-agent/向量数据库与检索 (0.1) ↔ 知识增强/FAISS 四概念（索引构建、索引类型、度量选择、召回优化，全 0） | 保留 | 基础 vs 深入特化，FAISS 细节不能由通用检索证明 |
| C9 | ai-agent/检索调优与重排序 (0) ↔ 知识增强/RAG 召回与重排流程 (0)；ai-agent/RAG 效果评估 (0) ↔ 知识增强/RAG 效果评估指标 (0) | 各自合并 | 学习目标与评估证据等价（同为召回-重排流程/RAG 评估指标），details 取并集；进度均为 0 故无污染风险 |
| C10 | 具身智能/多模态视觉语言模型 VLM (0) ↔ 跨模态/MLLM-VLM 基础 (0) | 合并 → `多模态大模型-mllm-vlm-基础` | 学习对象等价、details 取并集；canonical 名保留 MLLM 以免丢失更宽语义 |
| C11 | 具身智能/ROS2 机器人操作系统生态 (0.1) ↔ 机器人实习/ROS 五概念 (两个 0.05) | 保留 | 父子/概览与细分关系，不可合并；同入「机器人系统与仿真」领域 |
| C12 | 智驾/端到端与大模型智驾落地 (0.15, 讲 3 次) ↔ 跨模态/端到端轨迹规划 (0) | 保留 | 工程落地视角 vs 科研算法视角，证据仅部分迁移 |
| C13 | 机器人实习/Gazebo 三概念 ↔ 具身智能/仿真引擎 Isaac Gym-MuJoCo (0) | 保留 | 不同引擎不同用途；同入「机器人系统与仿真」领域 |

孤儿会话裁决：`PDF-扫描件处理-2026-06-18.md` → 建议挂入 `文档解析与分块` 的 `Concept-IDs`（属其子面向），不新建概念。

## Risks / Trade-offs

- [LLM 维护 schema 漂移：技能提示词写出不合法 v2] → 单文件结构校验留在各技能 `utils.mjs`（`validateStateV2`/`validateViewV2`）；concept_id 全局唯一、view 引用解析、会话关联等**跨文件不变量**收敛到唯一权威的 `validate-learning-store.mjs`，避免六份 utils 复制全局逻辑后漂移。不变量靠校验器承担，不靠 LLM 自觉。
- [岗位 md 报告过期] → 确定性生成 + 同回合再生成 + hook 兜底 + `render-views --check`；报告永不作为输入。
- [语义归并误判（把不同知识对象合并）] → 158 概念的归并表全量人工审核（冲突项已预裁决，其余为机械搬迁），迁移脚本要求每个旧概念**有且仅有一个**迁移决议。
- [会话搬迁丢失或重复] → 每个旧会话映射恰好一次（允许一对多概念，禁止复制多份），迁移校验对账。
- [六技能+脚本一次性切换出错] → 独立分支离线完成，新旧结构并行各跑一次 status/review 对账后才合并；git 可整体回滚。
- [同一天内旧格式又被写入] → 迁移分支工作期间暂停学习会话（单用户可控）。

## Migration Plan

1. 冻结学习写入，提交完整快照；**用现有 v1 工具生成并保存 status/review 基线输出**（切换后旧工具无法再读旧结构，基线必须此时留存）。
2. 在独立分支制定 v2 schema 与**概念归并表**（158 个旧概念 → 每个一条 D8 决议：keep/merge/split/discard + targets + 目标领域），冲突项按上表裁决。
3. 先实现 v2 校验器（单文件 + 跨文件）与渲染器，再让迁移脚本从旧树一次性生成新知识领域目录、6 个 view.json、会话新布局（含 `Concept-IDs` 头部注入与计数重建）。
4. 全量校验不变量：
   - 每个旧概念恰好一个迁移决议；每个旧会话恰好映射一次；
   - `concept_id` 全局唯一；所有 view 引用可解析且不重复；
   - 迁移前后学习事件数与最新日期可解释性对账；
   - 所有 state/view/quiz 通过结构校验；`render-views --check` 通过。
5. 同一提交内切换 6 个 SKILL.md、命令存根、`status.mjs`、各 `render.mjs`/`utils.mjs`、`update_progress.py`、README 生成、CLAUDE.md 契约（删跨 topic 同步规则、修 state.yaml 漂移）。
6. 用 v2 工具生成 status/review，与第 1 步保存的 v1 基线对账（岗位概念数、活跃概念、最近学习记录一致，差异均可由归并表决议解释）。
7. 合并为一个明确的迁移里程碑 commit；旧目录不保留运行时副本，历史靠 git。
8. 下一次学习会话起只写 v2。

回滚策略：里程碑 commit 之前全部在分支上，主干回滚 = 不合并；合并后发现问题则 revert 该 commit。

## Open Questions

- 归并表中非冲突概念的领域归属（约 130 个机械搬迁项）在 tasks 阶段生成全量清单供抽查，是否需要用户全量过目？（建议：只抽查 + 冲突项全审）

（已决：`render-views` 采用共享渲染模块 + 独立入口脚本，`status` 保持只读，职责清晰。）
