# 大模型基础、训练与对齐

## 大模型基础

- Transformer 架构
- LLM 工作原理与 Token
  - 自回归生成、上下文窗口、温度等采样参数
  - 理解自回归生成、token、上下文窗口与概率采样
- Transformers 编码架构
  - 理解 self-attention、位置编码与多头注意力
  - 区分 encoder-only、decoder-only 与 encoder-decoder 架构
  - 理解科研文本编码任务中 encoder 模型的适用性
- RoBERTa 文本编码器
  - 理解 RoBERTa 相对 BERT 的训练策略差异
  - 掌握 CLS 向量、平均池化等句向量提取方式
  - 了解领域语料对科研文本语义表示质量的影响

## 训练与对齐

- 大模型预训练 Pretraining
  - 掌握预训练、指令微调与对齐的基本区别
- 监督微调 SFT
- RLHF 与人类对齐
- LoRA 参数高效微调
  - 低秩适配
  - LLM vs 视觉塔适配
  - 模仿式微调 -37%

## 推理与思维链

- 思维链（CoT）原理
  - 逐步推理
  - 提示工程
  - 结构化 vs 松散链
- 结构化文本 CoT
  - 事实→归因→决策
  - 解析成功率
  - 文本分支主导增益
