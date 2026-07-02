# Transformer 架构（完整 Transformer Block）— Learning Session

> **Date:** 2026-07-02
> **Topic:** 具身智能
> **Path:** 大模型基础（大脑底座） → Transformer 架构
> **Level:** intermediate
> **说明:** 本节讲解由 codex 起草、Claude 审查修正后交付喵。

---

## Positioning

完整 Transformer Block 就是把你前几节学的「多头注意力负责看谁」和「前馈网络负责加工每个 token」这两件事，用残差连接和 LayerNorm 稳定地串成一层计算单元喵。

## Analogy

把机器人执行「把红色方块放到桌子上」想成一条推理流水线喵。

注意力像机器人环顾现场，判断「红色」「方块」「桌子」「放到」这些信息彼此该关注多少喵。

残差连接像一条信息高速公路，让原始观察不要在复杂加工中丢失喵。

LayerNorm 像每一步之后做一次尺度校准，避免某些信号突然过大或过小喵。

FFN 像机器人脑内的逐词加工器，把每个位置上的信息进一步变成更有用的动作特征喵。

## Core Mechanism

标准 Transformer Encoder Block 通常包含两个子层：多头自注意力子层和前馈网络 FFN 子层喵。

每个子层外面都配有残差连接和 LayerNorm，所以一个 block 不是只有 attention，而是 attention、FFN、residual、normalization 的组合喵。

在现代常见的 **Pre-LN** 写法里，数据在一个 block 里的流动顺序是这样喵：

1. 对输入 `x` 做 LayerNorm，再送入多头自注意力，得到 `MHA(LN(x))`喵。
2. 把注意力输出和原输入相加，得到 `x1 = x + MHA(LN(x))`喵。
3. 对 `x1` 做 LayerNorm，再送入 FFN，得到 `FFN(LN(x1))`喵。
4. 把 FFN 输出和 `x1` 相加，得到最终输出 `y = x1 + FFN(LN(x1))`喵。

**残差连接**的形式是 `x + Sublayer(x)`喵。它让信息有一条直通路径，即使子层暂时学得不好，原始信息也能继续往后传喵。在很深的网络里，残差连接还能缓解梯度消失，让反向传播时梯度更容易传回浅层喵。用机器人例子说，哪怕某一层对「红色方块」的加工还不稳定，原来的「红色方块」信息也不会被完全覆盖喵。

**LayerNorm** 的作用是稳定每个 token 表示内部各维度的数值分布喵。它不是在 batch 维度上归一化，而是对单个 token 的 hidden vector 做归一化，所以很适合变长序列和语言模型喵。直觉上，它像每一层都把特征尺度拉回一个可控范围，减少深层堆叠时数值分布乱飘的问题喵。

**Post-LN vs Pre-LN**：Post-LN 是原始 Transformer 论文的 Add & Norm 顺序，写成 `LN(x + Sublayer(x))`喵。Pre-LN 是许多现代 GPT 类模型常用的顺序，写成 `x + Sublayer(LN(x))`喵。Pre-LN 通常更容易训练很深的模型，因为残差主路径更直接、梯度流动更顺畅喵。

**FFN（前馈网络）**通常是两层线性变换加一个非线性激活，写成 `FFN(x) = Linear2(Activation(Linear1(x)))`，激活常用 ReLU 或 GELU喵。中间维度通常放大到 `4 × d_model`，例如 `d_model = 768` 时中间层是 `3072`喵。关键分工是：注意力负责让 token 之间**交换信息**，而 FFN 负责对每个 token 自己的表示做非线性变换，它是**逐 token 独立加工**、不混合不同 token 的喵。

**堆叠与 Encoder/Decoder 差别**：真实模型会把 N 个这样的 block 堆叠起来，例如 12 层、24 层，或大型模型的 96 层；越往上层表示越抽象，从局部词义逐渐变成任务、关系和行动意图喵。Encoder block 用双向自注意力，适合完整看见输入的理解任务喵。Decoder block 则用 masked self-attention（避免当前位置偷看未来 token），在 Encoder-Decoder 架构里还会多一个 cross-attention 去关注 encoder 的输出喵。

## Code Example

> 最小可运行示例：numpy 实现一个 Pre-LN Transformer Encoder Block 前向喵。

```python
import numpy as np
np.random.seed(0)

def softmax(x, axis=-1):
    x = x - np.max(x, axis=axis, keepdims=True)
    e = np.exp(x)
    return e / np.sum(e, axis=axis, keepdims=True)

def layer_norm(x, gamma, beta, eps=1e-5):
    mean = np.mean(x, axis=-1, keepdims=True)
    var = np.var(x, axis=-1, keepdims=True)
    return gamma * (x - mean) / np.sqrt(var + eps) + beta

def gelu(x):
    return 0.5 * x * (1.0 + np.tanh(np.sqrt(2.0 / np.pi) * (x + 0.044715 * x**3)))

def multi_head_self_attention(x, p, num_heads):
    batch, seq_len, d_model = x.shape
    head_dim = d_model // num_heads
    q = (x @ p["Wq"]).reshape(batch, seq_len, num_heads, head_dim).transpose(0, 2, 1, 3)
    k = (x @ p["Wk"]).reshape(batch, seq_len, num_heads, head_dim).transpose(0, 2, 1, 3)
    v = (x @ p["Wv"]).reshape(batch, seq_len, num_heads, head_dim).transpose(0, 2, 1, 3)
    scores = q @ k.transpose(0, 1, 3, 2) / np.sqrt(head_dim)
    attn = softmax(scores, axis=-1)
    context = (attn @ v).transpose(0, 2, 1, 3).reshape(batch, seq_len, d_model)
    return context @ p["Wo"], attn

def ffn(x, p):
    return gelu(x @ p["W1"] + p["b1"]) @ p["W2"] + p["b2"]

def transformer_block_pre_ln(x, p, num_heads):
    attn_out, attn_w = multi_head_self_attention(layer_norm(x, p["ln1_g"], p["ln1_b"]), p, num_heads)
    x1 = x + attn_out                                  # 残差①
    y = x1 + ffn(layer_norm(x1, p["ln2_g"], p["ln2_b"]), p)  # 残差②
    return y, attn_w

batch, seq_len, d_model, num_heads = 1, 5, 8, 2
d_ff = 4 * d_model
x = np.random.randn(batch, seq_len, d_model)
p = {
    "Wq": np.random.randn(d_model, d_model) * 0.02,
    "Wk": np.random.randn(d_model, d_model) * 0.02,
    "Wv": np.random.randn(d_model, d_model) * 0.02,
    "Wo": np.random.randn(d_model, d_model) * 0.02,
    "W1": np.random.randn(d_model, d_ff) * 0.02, "b1": np.zeros(d_ff),
    "W2": np.random.randn(d_ff, d_model) * 0.02, "b2": np.zeros(d_model),
    "ln1_g": np.ones(d_model), "ln1_b": np.zeros(d_model),
    "ln2_g": np.ones(d_model), "ln2_b": np.zeros(d_model),
}
y, attn = transformer_block_pre_ln(x, p, num_heads)
print("输入形状:", x.shape)          # (1, 5, 8)
print("输出形状:", y.shape)          # (1, 5, 8)，与输入一致，可继续堆叠
print("注意力权重形状:", attn.shape)  # (1, 2, 5, 5)
```

`x` 可想成一句具身智能指令中每个 token 的向量表示喵。`multi_head_self_attention` 让每个 token 根据 QKV 去看其他 token，例如「放到」关注「红色方块」和「桌子」喵。第一次残差 `x1 = x + attn_out` 在保留原始 token 信息的同时叠加上下文喵。`ffn` 对每个 token 做进一步非线性加工，例如把「红色方块」加工成更接近「目标物体」的内部特征喵。第二次残差 `y = x1 + ffn_out` 把加工结果叠回主路径，输出形状与输入一致，可以直接喂给下一层喵。

## Common Misconceptions

误区一是以为 Transformer Block 只有注意力喵。实际上注意力只是其中一个子层，FFN、残差连接和 LayerNorm 同样关键喵。

误区二是以为 FFN 会像注意力一样混合不同 token喵。FFN 是逐 token 独立执行的，不负责 token 间通信，token 间通信主要发生在自注意力里喵。

误区三是以为 LayerNorm 只是可有可无的数值小技巧喵。在深层 Transformer 中，它对稳定训练和控制激活分布非常重要喵。

误区四是以为 Pre-LN 和 Post-LN 只是写法顺序不同、没有实际影响喵。两者都表达 Add 与 Norm 的思想，但 Pre-LN 通常更适合训练更深的现代模型喵。

## Socratic Check

问题一：如果去掉残差连接，只保留注意力和 FFN，会有什么风险喵？

答案：深层网络更容易丢失早期信息，梯度也更难稳定传回浅层，训练会更困难喵。

问题二：注意力已经能加工信息了，为什么还需要 FFN喵？

答案：注意力主要负责 token 之间的信息路由，而 FFN 负责对每个 token 的表示做非线性变换，两者分工不同、缺一不可喵。

---

## Quick Summary

- 完整 Encoder Block = 多头自注意力子层 + FFN 子层，且每个子层都配残差连接和 LayerNorm喵。
- 残差连接提供信息高速公路（缓解梯度消失），LayerNorm 稳定数值分布，FFN 做逐 token 的非线性特征加工喵。
- 真实 Transformer 堆叠很多个 block；Encoder 偏理解完整输入，Decoder 还要处理 masked self-attention 和可能的 cross-attention喵。

## Next Steps

(Will be updated after the user chooses a sub-topic direction) 喵。
