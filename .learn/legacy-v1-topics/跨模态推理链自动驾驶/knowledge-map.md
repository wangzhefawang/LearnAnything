# 跨模态推理链可解释端到端自动驾驶（Cross-modal ReCoT）

> 0/29 mastered · 0% complete

## 项目定位与整体架构

- ⚪ **研究问题与动机** (unexplored)
  - 端到端驾驶的黑箱问题
  - 可解释性诉求
  - 各模态贡献缺乏受控验证
- ⚪ **OpenEMMA 基座与 FSDrive 相关工作** (unexplored)
  - OpenEMMA 免训练 MLLM 驾驶
  - FSDrive 视觉时空 CoT
  - novelty 差异化
- ⚪ **三分支架构总览** (unexplored)
  - 视觉 CoT 世界模型
  - 文本 CoT 推理
  - 数值 CoT 规划+自审计
- ⚪ **发现弧线叙事定位** (unexplored)
  - 建构跨模态 CoT
  - 消融发现视觉拖后腿
  - 受控归因研究

## 多模态大模型

- ⚪ **MLLM/VLM 基础** (unexplored)
  - 视觉编码器+LLM
  - 视觉-语言对齐
  - 图文交错输入
- ⚪ **Qwen-VL / Llama-Vision 主干** (unexplored)
  - Qwen2.5-VL-7B
  - Llama-3.2-11B-Vision
  - 第二主干外部效度
- ⚪ **多图条件输入** (unexplored)
  - 当前帧+未来帧双图提示
  - 时序接地混淆风险
- ⚪ **免训练推理范式** (unexplored)
  - 零训练驱动
  - max\_new\_tokens 与解析
  - 推理调用次数与成本

## 思维链推理

- ⚪ **思维链（CoT）原理** (unexplored)
  - 逐步推理
  - 提示工程
  - 结构化 vs 松散链
- ⚪ **结构化文本 CoT** (unexplored)
  - 事实→归因→决策
  - 解析成功率
  - 文本分支主导增益
- ⚪ **数值 CoT 规划** (unexplored)
  - speed/curvature 序列
  - 作为自审计信号
- ⚪ **跨模态 CoT 耦合与解耦** (unexplored)
  - 分支可自由组合
  - 视觉不与文本叠加
  - 增益归因

## 视觉世界模型与生成

- ⚪ **世界模型与未来帧预测** (unexplored)
  - 1s 后未来帧
  - 作为视觉推理中间步骤
  - 回输主干
- ⚪ **SD-VAE 潜空间编解码** (unexplored)
  - 图像压缩到潜空间
  - 编码器/解码器
  - 潜表示维度
- ⚪ **ViT 潜空间回归（LatentDiT）** (unexplored)
  - 非扩散：单次前向直接回归
  - 潜空间 MSE + LPIPS
  - 回归到均值模糊
- ⚪ **视觉分支负结果与边界** (unexplored)
  - oracle 真帧仍有害
  - LoRA 也无法解锁
  - 界定 FSDrive 范式边界

## 轨迹规划与数值自审计

- ⚪ **端到端轨迹规划** (unexplored)
  - 从感知直接到轨迹
  - 开环规划
- ⚪ **speed-curvature 参数化与积分** (unexplored)
  - 速度-曲率建模
  - 积分成轨迹
  - 运动学约束
- ⚪ **数值物理自审计** (unexplored)
  - 加速度双侧钳制
  - 零成本后处理
  - 碰撞失败率归零
- ⚪ **3D 检测侧信息（YOLO3D）** (unexplored)
  - 3D 目标检测
  - BEV 表示
  - 作为感知辅助

## 微调与实验方法

- ⚪ **LoRA 参数高效微调** (unexplored)
  - 低秩适配
  - LLM vs 视觉塔适配
  - 模仿式微调 -37%
- ⚪ **消融实验与受控归因** (unexplored)
  - 8 配置消融
  - 把增益归到具体分支
  - 增益与视觉解耦
- ⚪ **统计显著性与等价性检验** (unexplored)
  - 配对 t 检验 / Wilcoxon
  - TOST 等价性检验
  - 置信区间
  - 伪复制风险
- ⚪ **oracle / 安慰剂对照设计** (unexplored)
  - oracle 真帧 vs 复制当前帧
  - 双臂配对
  - 混淆去除
- ⚪ **可解释性量化** (unexplored)
  - 推理一致性（文本决策 vs 数值轨迹）
  - 横向 vs 纵向
  - 混淆矩阵
  - 不预测准确率

## 数据、评测与工程实现

- ⚪ **nuScenes 与开环评测** (unexplored)
  - nuScenes 数据集
  - val-150 划分
  - 定位精度 ≤0.1m
- ⚪ **评测指标** (unexplored)
  - ADE@T / L2
  - CFR 碰撞失败率
  - ParseRate 解析率
  - 推理成本
- ⚪ **PyTorch / CUDA 训练推理流水线** (unexplored)
  - RTX 5090 / bf16
  - latent 编码与样本对构造
  - 断点续跑
  - pixi 环境管理
- ⚪ **LaTeX 学术写作与可视化** (unexplored)
  - XeLaTeX + biblatex-apa
  - TikZ 矢量图
  - 浮动体排版
