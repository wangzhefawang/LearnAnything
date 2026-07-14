#!/usr/bin/env node
/**
 * build-manifest.mjs — 一次性生成概念归并表与会话映射清单（tasks 2.2–2.5）
 *
 * 输入：baseline/concepts-v1-snapshot.json（158 个旧概念权威快照）
 *       .learn/topics/ 各 topic 的 sessions/ 下的 36 份会话文件（仅用于对账，不修改）
 * 输出：migration/merge-manifest.json、migration/sessions-map.json
 *
 * 决策来源：openspec design.md 的 D2 边界规则 + D8 决议模型 + C1–C13 冲突裁决。
 * 用法：node openspec/changes/restructure-topics-to-knowledge-domains/migration/build-manifest.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..', '..');
const SNAPSHOT = join(HERE, '..', 'baseline', 'concepts-v1-snapshot.json');
const TOPICS_DIR = join(REPO, '.learn', 'topics');

/** concept_id 规范化：中文原样、ASCII 小写、非字母数字转单连字符、NFC、≤64 */
export function slugify(name) {
  const id = name
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  if (id.length === 0 || id.length > 64) throw new Error(`非法 concept_id: "${id}" (来自 "${name}")`);
  return id;
}

// ───────────────────────────────────────────────────────────────────
// 路由表：旧 topic|domain → 默认目标（keep 骨架）
// ───────────────────────────────────────────────────────────────────
const ROUTES = {
  '机器人开发与仿真测试实习|Linux 与远程开发部署': ['软件工程与协作', 'Linux 与远程开发部署'],
  '机器人开发与仿真测试实习|ROS 机器人操作系统': ['机器人系统与仿真', 'ROS 机器人操作系统'],
  '机器人开发与仿真测试实习|Gazebo 仿真环境': ['机器人系统与仿真', 'Gazebo 仿真环境'],
  '机器人开发与仿真测试实习|机器人导航': ['机器人系统与仿真', '机器人导航'],
  '机器人开发与仿真测试实习|机械臂控制与运动规划': ['机器人系统与仿真', '机械臂控制与运动规划'],
  '机器人开发与仿真测试实习|3D 视觉感知与 Open3D': ['感知与空间智能', '3D 视觉与点云'],
  '机器人开发与仿真测试实习|软件测试与团队协作': ['软件工程与协作', '软件测试与团队协作'],
  '具身智能|大模型基础（大脑底座）': ['大模型基础与对齐', '大模型基础'],
  '具身智能|VLA 视觉-语言-动作模型': ['强化学习与具身模型', 'VLA 视觉-语言-动作模型'],
  '具身智能|强化学习（小脑/运动智能）': ['强化学习与具身模型', '强化学习与运动控制'],
  '具身智能|物理仿真与 Sim-to-Real': ['机器人系统与仿真', '物理仿真与 Sim-to-Real'],
  '具身智能|安全评测与红队对抗': ['强化学习与具身模型', '安全评测与红队对抗'],
  '具身智能|工程与部署': null, // 全部逐概念改道，见 OVERRIDES
  '跨模态推理链自动驾驶|项目定位与整体架构': ['科研方法与实验', '研究定位与叙事'],
  '跨模态推理链自动驾驶|多模态大模型': ['多模态与视觉语言模型', '多模态大模型'],
  '跨模态推理链自动驾驶|思维链推理': ['大模型基础与对齐', '推理与思维链'],
  '跨模态推理链自动驾驶|视觉世界模型与生成': ['多模态与视觉语言模型', '视觉世界模型与生成'],
  '跨模态推理链自动驾驶|轨迹规划与数值自审计': ['自动驾驶系统', '轨迹规划与数值自审计'],
  '跨模态推理链自动驾驶|微调与实验方法': ['科研方法与实验', '实验设计与统计'],
  '跨模态推理链自动驾驶|数据、评测与工程实现': ['自动驾驶系统', '数据与评测'],
  '知识增强科研问答智能体|LLM 基础与本地部署': null, // 三个概念各有去处
  '知识增强科研问答智能体|文本向量化与语义匹配': ['agent-rag-与知识系统', 'RAG 与向量检索'],
  '知识增强科研问答智能体|向量检索与 FAISS': ['agent-rag-与知识系统', '向量检索与 FAISS'],
  '知识增强科研问答智能体|RAG 检索增强生成': ['agent-rag-与知识系统', 'RAG 与向量检索'],
  '知识增强科研问答智能体|知识图谱与 Neo4j': ['agent-rag-与知识系统', '知识图谱与 GraphRAG'],
  '知识增强科研问答智能体|Agent 与工具调用': ['agent-rag-与知识系统', 'Agent 智能体'],
  '知识增强科研问答智能体|系统架构与评估': ['agent-rag-与知识系统', '系统架构与评估'],
  '智驾系统开发|汽车结构与整车工作原理': ['车辆工程与功能安全', '汽车结构与整车工作原理'],
  '智驾系统开发|电子电气架构与车载通信': ['车辆工程与功能安全', '电子电气架构与车载通信'],
  '智驾系统开发|智驾硬件与传感器系统': ['自动驾驶系统', '智驾硬件与传感器系统'],
  '智驾系统开发|自动驾驶功能与算法链路': ['自动驾驶系统', '功能与算法链路'],
  '智驾系统开发|整车开发流程与系统集成': ['车辆工程与功能安全', '整车开发流程与系统集成'],
  '智驾系统开发|安全测试验证与协同交付': ['车辆工程与功能安全', '安全测试验证与协同交付'],
  'ai-agent-应用开发|LLM 与 Prompt 基础': ['agent-rag-与知识系统', 'Prompt 与上下文工程'],
  'ai-agent-应用开发|Agent 智能体': ['agent-rag-与知识系统', 'Agent 智能体'],
  'ai-agent-应用开发|RAG 知识库': ['agent-rag-与知识系统', 'RAG 与向量检索'],
  'ai-agent-应用开发|工作流编排与自动化': ['agent-rag-与知识系统', '工作流编排与自动化'],
  'ai-agent-应用开发|开发框架': ['agent-rag-与知识系统', '开发框架'],
  'ai-agent-应用开发|工程落地': ['agent-rag-与知识系统', '应用工程与落地'],
};

// 合并/拆分目标（canonical）注册表：id → [name, domain, subdomain]
const CANONICAL = {
  'llm-工作原理与-token': ['LLM 工作原理与 Token', '大模型基础与对齐', '大模型基础'],
  'function-calling-工具调用': ['Function Calling 工具调用', 'agent-rag-与知识系统', 'Agent 智能体'],
  'react-推理与行动循环': ['ReAct 推理与行动循环', 'agent-rag-与知识系统', 'Agent 智能体'],
  '向量化-embedding': ['向量化 Embedding', 'agent-rag-与知识系统', 'RAG 与向量检索'],
  'rag-召回与重排流程': ['RAG 召回与重排流程', 'agent-rag-与知识系统', 'RAG 与向量检索'],
  'rag-效果评估': ['RAG 效果评估', 'agent-rag-与知识系统', 'RAG 与向量检索'],
  '多模态大模型-mllm-vlm-基础': ['多模态大模型 MLLM/VLM 基础', '多模态与视觉语言模型', '多模态大模型'],
  'agent-架构基础': ['Agent 架构基础', 'agent-rag-与知识系统', 'Agent 智能体'],
  'prompt-工程': ['Prompt 工程', 'agent-rag-与知识系统', 'Prompt 与上下文工程'],
  '上下文设计与管理': ['上下文设计与管理', 'agent-rag-与知识系统', 'Prompt 与上下文工程'],
  '大模型预训练-pretraining': ['大模型预训练 Pretraining', '大模型基础与对齐', '训练与对齐'],
  '本地大模型部署与推理': ['本地大模型部署与推理', '软件工程与协作', '模型训练与部署工程'],
};
const T = (id) => ({ concept_id: id, name: CANONICAL[id][0], target_domain: CANONICAL[id][1], target_subdomain: CANONICAL[id][2] });

// ───────────────────────────────────────────────────────────────────
// 覆盖表：旧 topic|concept → 显式决议（C1–C13 冲突项 + D2 边界改道）
// route 型覆盖 = 仍是 keep，只改目标领域/子域
// ───────────────────────────────────────────────────────────────────
const OVERRIDES = {
  // ── C1：保留两概念（不合并）
  '知识增强科研问答智能体|Transformers 编码架构': {
    action: 'keep',
    targets: [{ concept_id: 'transformer-编码架构', name: 'Transformers 编码架构', target_domain: '大模型基础与对齐', target_subdomain: '大模型基础' }],
    note: 'C1：与 transformer-架构(0.55) 保留为两概念——encoder/decoder 架构区分与科研文本适用性未被后者证据覆盖；id 按 design 定为 transformer-编码架构',
  },
  // ── C2：拆分「大语言模型 LLM 基本原理」（进度 0，零成本）
  '知识增强科研问答智能体|大语言模型 LLM 基本原理': {
    action: 'split',
    targets: [T('llm-工作原理与-token'), T('大模型预训练-pretraining'), T('本地大模型部署与推理')],
    note: 'C2 拆分 details：d1(自回归/token/上下文窗口/采样)→llm-工作原理与-token；d2(预训练/指令微调/对齐的区别)→大模型预训练-pretraining（区别性描述已涵盖 SFT/对齐，SFT/RLHF 概念无新增内容故不列为 targets）；d3(本地能力边界与幻觉)→本地大模型部署与推理',
  },
  // ── C2 canonical 持有方：仅改道到大模型领域（id 与机械 slug 一致，action 保持 keep）
  'ai-agent-应用开发|LLM 工作原理与 Token': { route: ['大模型基础与对齐', '大模型基础'], note: 'C2：canonical 进度来源（conf 0.1、有 2026-06-18 会话），接收拆分来的 d1' },
  // ── C3：拆分「提示词 Prompt 与上下文管理」（进度 0）
  '知识增强科研问答智能体|提示词 Prompt 与上下文管理': {
    action: 'split',
    targets: [T('prompt-工程'), T('上下文设计与管理')],
    note: 'C3 拆分 details：d1(系统/任务/约束提示词设计)→prompt-工程；d2(上下文组织顺序)、d3(长上下文截断与干扰)→上下文设计与管理',
  },
  // ── C4：合并 Function Calling
  'ai-agent-应用开发|工具调用 Function Calling': { action: 'merge', targets: [T('function-calling-工具调用')], note: 'C4：与知识增强/Function Calling 工具接口合并，details 取并集' },
  '知识增强科研问答智能体|Function Calling 工具接口': { action: 'merge', targets: [T('function-calling-工具调用')], note: 'C4：canonical 进度来源（conf 0.05、2026-07-13 讲 1 次）' },
  // ── C5：拆分「Agent 架构与 ReAct 模式」（details 为空，仅概念拆分）
  'ai-agent-应用开发|Agent 架构与 ReAct 模式': {
    action: 'split',
    targets: [T('agent-架构基础'), T('react-推理与行动循环')],
    note: 'C5 拆分：Agent 架构部分→新概念 agent-架构基础(0)；ReAct 部分并入 react-推理与行动循环(0.05)；源 details 为空，无需分配',
  },
  '知识增强科研问答智能体|ReAct 推理与行动循环': { action: 'merge', targets: [T('react-推理与行动循环')], note: 'C5：canonical 进度来源（conf 0.05、2026-07-13 讲 1 次）' },
  // ── C6：合并同名「向量化 Embedding」
  'ai-agent-应用开发|向量化 Embedding': { action: 'merge', targets: [T('向量化-embedding')], note: 'C6：canonical 进度来源（conf 0.1、有 2026-06-11 会话）' },
  '知识增强科研问答智能体|向量化 Embedding': { action: 'merge', targets: [T('向量化-embedding')], note: 'C6：唯一严格同名重复，details 取并集' },
  // ── C7：保留两概念（论文分块是场景特化）
  '知识增强科研问答智能体|论文文档分块 Chunking': {
    action: 'keep',
    targets: [{ concept_id: '论文文档分块-chunking', name: '论文文档分块 Chunking', target_domain: 'agent-rag-与知识系统', target_subdomain: 'RAG 与向量检索' }],
    note: 'C7：与 文档解析与分块(0.2) 保留为两概念，公式/表格/跨段依赖等论文特化内容不能由通用分块证据证明',
  },
  // ── C9：两组各自合并（进度均 0，details 取并集）
  'ai-agent-应用开发|检索调优与重排序': { action: 'merge', targets: [T('rag-召回与重排流程')], note: 'C9a：学习目标与评估证据等价（召回-重排流水线），details 取并集' },
  '知识增强科研问答智能体|RAG 召回与重排流程': { action: 'merge', targets: [T('rag-召回与重排流程')], note: 'C9a：canonical 名称沿用本源' },
  'ai-agent-应用开发|RAG 效果评估': { action: 'merge', targets: [T('rag-效果评估')], note: 'C9b：学习目标与评估证据等价（RAG 评估指标），details 取并集' },
  '知识增强科研问答智能体|RAG 效果评估指标': { action: 'merge', targets: [T('rag-效果评估')], note: 'C9b：details 取并集' },
  // ── C10：合并 VLM/MLLM（进度均 0）
  '具身智能|多模态视觉语言模型 VLM': { action: 'merge', targets: [T('多模态大模型-mllm-vlm-基础')], note: 'C10：canonical 名保留 MLLM 更宽语义；本源 details 为空' },
  '跨模态推理链自动驾驶|MLLM/VLM 基础': { action: 'merge', targets: [T('多模态大模型-mllm-vlm-基础')], note: 'C10：details 取并集（视觉编码器+LLM/对齐/图文交错输入）' },
  // ── D2 边界改道（action 仍为 keep，只改目标）
  '具身智能|大模型预训练 Pretraining': { route: ['大模型基础与对齐', '训练与对齐'] },
  '具身智能|监督微调 SFT': { route: ['大模型基础与对齐', '训练与对齐'] },
  '具身智能|RLHF 与人类对齐': { route: ['大模型基础与对齐', '训练与对齐'] },
  '具身智能|ROS2 机器人操作系统生态': { route: ['机器人系统与仿真', 'ROS 机器人操作系统'], note: 'C11：与 ROS1 五概念保留为概览/细分关系，同入一个子域' },
  '具身智能|多源传感器数据处理（IMU/力传感器/关节角度）': { route: ['感知与空间智能', '传感器与数据处理'] },
  '具身智能|边缘侧推理框架': { route: ['软件工程与协作', '模型训练与部署工程'] },
  '具身智能|国产算力并行训练（昇腾/摩尔线程）': { route: ['软件工程与协作', '模型训练与部署工程'] },
  '知识增强科研问答智能体|本地大模型部署与推理': { route: ['软件工程与协作', '模型训练与部署工程'], note: 'C2 的 d3(幻觉与能力边界) 将并入本概念 details' },
  '知识增强科研问答智能体|RoBERTa 文本编码器': { route: ['大模型基础与对齐', '大模型基础'] },
  '跨模态推理链自动驾驶|数值 CoT 规划': { route: ['自动驾驶系统', '轨迹规划与数值自审计'], note: 'D2：数值轨迹 CoT 归自动驾驶' },
  '跨模态推理链自动驾驶|跨模态 CoT 耦合与解耦': { route: ['多模态与视觉语言模型', '多模态大模型'], note: 'D2：跨模态 CoT 归多模态' },
  '跨模态推理链自动驾驶|3D 检测侧信息（YOLO3D）': { route: ['感知与空间智能', '3D 视觉与点云'], note: 'D2：通用视觉检测机制归感知' },
  '跨模态推理链自动驾驶|LoRA 参数高效微调': { route: ['大模型基础与对齐', '训练与对齐'] },
  '跨模态推理链自动驾驶|PyTorch / CUDA 训练推理流水线': { route: ['软件工程与协作', '模型训练与部署工程'] },
  '跨模态推理链自动驾驶|LaTeX 学术写作与可视化': { route: ['科研方法与实验', '学术写作与可视化'] },
  'ai-agent-应用开发|LLM API 调用与接口开发': { route: ['agent-rag-与知识系统', '应用工程与落地'] },
  // C8/C12/C13 保留项走默认路由，无需覆盖
};

// ───────────────────────────────────────────────────────────────────
// 会话映射：36 份，(path, concept_ids[, note])；primary 在首位
// ───────────────────────────────────────────────────────────────────
const AI = 'ai-agent-应用开发/sessions', JS = '具身智能/sessions', ZJ = '智驾系统开发/sessions',
      JQ = '机器人开发与仿真测试实习/sessions', ZS = '知识增强科研问答智能体/sessions';
const SESSIONS = [
  [`${AI}/记忆机制-2026-06-11.md`, ['记忆机制']],
  [`${AI}/上下文设计与管理-2026-06-10.md`, ['上下文设计与管理']],
  [`${AI}/文档解析与分块-2026-06-18.md`, ['文档解析与分块']],
  [`${AI}/向量化-Embedding-2026-06-11.md`, ['向量化-embedding']],
  [`${AI}/向量数据库与检索-2026-06-11.md`, ['向量数据库与检索']],
  [`${AI}/LLM-工作原理与-Token-2026-06-18.md`, ['llm-工作原理与-token']],
  [`${AI}/PDF-扫描件处理-2026-06-18.md`, ['文档解析与分块'], '孤儿会话裁决：挂入文档解析与分块（其子面向）'],
  [`${AI}/Prompt-工程-2026-06-10.md`, ['prompt-工程']],
  [`${JS}/vla-视觉-语言-动作模型/动作表征与 Action Tokenization--2026-07-02--整体概览.md`, ['动作表征与-action-tokenization']],
  [`${JS}/vla-视觉-语言-动作模型/模仿学习与行为克隆 Behavior Cloning--2026-07-02--整体概览.md`, ['模仿学习与行为克隆-behavior-cloning']],
  [`${JS}/vla-视觉-语言-动作模型/VLA 架构范式--2026-07-02--从-transformer-到-vla.md`, ['vla-架构范式']],
  [`${JS}/大模型基础大脑底座/大模型预训练 Pretraining--2026-06-28--整体概览.md`, ['大模型预训练-pretraining']],
  [`${JS}/大模型基础大脑底座/Transformer 架构--2026-06-26--整体概览.md`, ['transformer-架构']],
  [`${JS}/大模型基础大脑底座/Transformer 架构--2026-06-27--注意力分配.md`, ['transformer-架构']],
  [`${JS}/大模型基础大脑底座/Transformer 架构--2026-06-27--qkv计算机制.md`, ['transformer-架构']],
  [`${JS}/大模型基础大脑底座/Transformer 架构--2026-06-28--softmax注意力权重.md`, ['transformer-架构']],
  [`${JS}/大模型基础大脑底座/Transformer 架构--2026-07-01--多头注意力.md`, ['transformer-架构']],
  [`${JS}/大模型基础大脑底座/Transformer 架构--2026-07-02--完整-transformer-block.md`, ['transformer-架构']],
  [`${JS}/大模型基础大脑底座/Transformer 架构--2026-07-02--位置编码.md`, ['transformer-架构'], 'state 计数 6 vs 证据 7：重建后 explain_count=7'],
  [`${JS}/工程与部署/ROS2 机器人操作系统生态--2026-07-02--整体概览.md`, ['ros2-机器人操作系统生态']],
  [`${ZJ}/安全测试验证与协同交付/安全测试验证与协同交付--2026-07-12--整体概览.md`, ['功能安全-iso-26262', '预期功能安全-sotif', '智驾测试验证体系', '供应商协作与技术文档'], '数据修复：v1 state 未给这 4 概念记 explain，重建后各 +1（2026-07-12）'],
  [`${ZJ}/智驾硬件与传感器系统/智驾硬件与传感器系统--2026-07-12--整体概览.md`, ['摄像头与环视感知系统', '毫米波雷达与超声波雷达', '激光雷达与组合定位', '智驾域控制器计算平台']],
  [`${ZJ}/汽车结构与整车工作原理/汽车结构与整车工作原理--2026-07-13--整体概览.md`, ['车辆动力与底盘基础', '转向制动与线控执行系统', '车身与座舱电气负载', '车辆状态信号与动力学边界']],
  [`${ZJ}/自动驾驶功能与算法链路/端到端与大模型智驾落地--2026-07-13--小鹏第二代-vla.md`, ['端到端与大模型智驾落地']],
  [`${ZJ}/自动驾驶功能与算法链路/端到端与大模型智驾落地--2026-07-13--整体概览.md`, ['端到端与大模型智驾落地']],
  [`${ZJ}/自动驾驶功能与算法链路/端到端与大模型智驾落地--2026-07-13--整体概览检查题解答.md`, ['端到端与大模型智驾落地']],
  [`${ZJ}/自动驾驶功能与算法链路/ADAS-NOA 功能定义--2026-07-12--高速-noa-与城市-noa-场景难点深挖.md`, ['adas-noa-功能定义']],
  [`${ZJ}/自动驾驶功能与算法链路/ADAS-NOA 功能定义--2026-07-12--整体概览.md`, ['adas-noa-功能定义']],
  [`${ZJ}/自动驾驶功能与算法链路/ADAS-NOA 功能定义--2026-07-12--odd-边界与降级策略设计.md`, ['adas-noa-功能定义']],
  [`${ZJ}/自动驾驶功能与算法链路/ADAS-NOA 功能定义--2026-07-13--有图-轻图-无图技术路线之争.md`, ['adas-noa-功能定义']],
  [`${JQ}/ros-机器人操作系统/ROS 服务与动作通信--2026-07-13--整体概览.md`, ['ros-服务与动作通信']],
  [`${JQ}/ros-机器人操作系统/ROS 节点与话题通信--2026-07-12--整体概览.md`, ['ros-节点与话题通信']],
  [`${JQ}/软件测试与团队协作/机器人测试用例设计方法--2026-07-13--整体概览.md`, ['机器人测试用例设计方法']],
  [`${JQ}/软件测试与团队协作/软件测试与团队协作--2026-07-13--整体概览.md`, ['机器人测试用例设计方法', '缺陷管理与问题清单', 'git-团队协作流', '代码评审与集成测试']],
  [`${ZS}/agent-and-tool-calling/Agent 与工具调用--2026-07-13--整体概览.md`, ['function-calling-工具调用', 'react-推理与行动循环', '长文本问答策略']],
  [`${ZS}/knowledge-graph-and-neo4j/GraphRAG 与 KG+LLM 融合--2026-07-12--整体概览.md`, ['graphrag-与-kg-llm-融合']],
];

// ───────────────────────────────────────────────────────────────────
// 生成
// ───────────────────────────────────────────────────────────────────
const snapshot = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
const errors = [];
const manifest = [];

for (const c of snapshot) {
  const key = `${c.topic}|${c.concept}`;
  const ov = OVERRIDES[key];
  let entry;
  if (ov && ov.action) {
    entry = { source: { topic: c.topic, domain: c.domain, concept: c.concept }, action: ov.action, targets: ov.targets, note: ov.note ?? '' };
  } else {
    const route = (ov && ov.route) || ROUTES[`${c.topic}|${c.domain}`];
    if (!route) { errors.push(`无路由且无覆盖: ${key}`); continue; }
    entry = {
      source: { topic: c.topic, domain: c.domain, concept: c.concept },
      action: 'keep',
      targets: [{ concept_id: slugify(c.concept), name: c.concept, target_domain: route[0], target_subdomain: route[1] }],
      note: (ov && ov.note) ?? '',
    };
  }
  manifest.push(entry);
}

// ── 自检 1：158 条决议、与 snapshot 一一对应
if (manifest.length !== snapshot.length) errors.push(`决议数 ${manifest.length} ≠ 概念数 ${snapshot.length}`);
const seen = new Set();
for (const m of manifest) {
  const k = `${m.source.topic}|${m.source.domain}|${m.source.concept}`;
  if (seen.has(k)) errors.push(`重复决议: ${k}`);
  seen.add(k);
}

// ── 自检 2：目标概念定义唯一性（merge 汇聚合法；同 id 必须同名同域同子域）
const defs = new Map();
for (const m of manifest) {
  for (const t of m.targets) {
    const prev = defs.get(t.concept_id);
    const sig = `${t.name}|${t.target_domain}|${t.target_subdomain}`;
    if (prev && prev !== sig) errors.push(`concept_id 定义冲突: ${t.concept_id} → "${prev}" vs "${sig}"`);
    defs.set(t.concept_id, sig);
  }
}

// ── 自检 3：会话对磁盘全量对账
const diskSessions = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith('.md') && p.includes('sessions')) diskSessions.push(relative(TOPICS_DIR, p).replaceAll('\\', '/'));
  }
})(TOPICS_DIR);
const mapped = SESSIONS.map(([p]) => p);
for (const p of diskSessions) if (!mapped.includes(p)) errors.push(`磁盘会话未映射: ${p}`);
for (const p of mapped) if (!diskSessions.includes(p)) errors.push(`映射的会话不在磁盘: ${p}`);
if (new Set(mapped).size !== mapped.length) errors.push('sessions-map 有重复路径');
if (mapped.length !== 36) errors.push(`会话数 ${mapped.length} ≠ 36`);

// ── 自检 4：会话 concept_ids 全部可解析，且同一会话内无重复
const sessionsMap = SESSIONS.map(([path, ids, note]) => {
  for (const id of ids) if (!defs.has(id)) errors.push(`会话引用不可解析的 concept_id: ${id} (${path})`);
  if (new Set(ids).size !== ids.length) errors.push(`会话内重复 concept_id: ${path}`);
  const sig = defs.get(ids[0]);
  const [, dom, sub] = sig ? sig.split('|') : [null, '?', '?'];
  return { source_session_path: path, activity_type: 'explain', concept_ids: ids, target_domain: dom, target_subdomain: sub, ...(note ? { note } : {}) };
});

// ── 自检 5：split 决议必须有分配说明且 targets ≥ 2
for (const m of manifest) {
  if (m.action === 'split' && (!m.note || m.targets.length < 2)) errors.push(`split 决议缺分配说明或 targets<2: ${m.source.concept}`);
}

if (errors.length) {
  console.error(`❌ 自检失败 ${errors.length} 项：`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}

writeFileSync(join(HERE, 'merge-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
writeFileSync(join(HERE, 'sessions-map.json'), JSON.stringify(sessionsMap, null, 2) + '\n', 'utf8');

// ── 统计报告
const actionCount = {}, domainCount = {}, subCount = {};
for (const m of manifest) actionCount[m.action] = (actionCount[m.action] ?? 0) + 1;
for (const [, sig] of defs) {
  const [, d, s] = ['', ...sig.split('|').slice(1)];
  domainCount[d] = (domainCount[d] ?? 0) + 1;
  subCount[`${d} / ${s}`] = (subCount[`${d} / ${s}`] ?? 0) + 1;
}
const triples = sessionsMap.reduce((n, s) => n + s.concept_ids.length, 0);
console.log(`✅ 自检通过。决议 ${manifest.length} 条，目标概念定义 ${defs.size} 个，会话 ${sessionsMap.length} 份，explain 事件三元组 ${triples} 条`);
console.log('\n各 action 计数：' + JSON.stringify(actionCount));
console.log('\n各知识领域概念数：');
for (const [d, n] of Object.entries(domainCount).sort((a, b) => b[1] - a[1])) console.log(`  ${d}: ${n}`);
console.log('\n各子域概念数：');
for (const [s, n] of Object.entries(subCount).sort()) console.log(`  ${s}: ${n}`);
