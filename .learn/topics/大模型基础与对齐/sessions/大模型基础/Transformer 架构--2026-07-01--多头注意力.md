# Transformer 架构（多头注意力 Multi-Head Attention）— Learning Session

> **Date:** 2026-07-01
> **Concept-IDs:** [transformer-架构]
> **Knowledge Domain:** 大模型基础、训练与对齐
> **Path:** 大模型基础（大脑底座） → Transformer 架构
> **Level:** intermediate

---

## Positioning

多头注意力是在你上一节学的“单头 QKV 计算”之上做的扩展：把一次注意力拆成多个并行的“头”，让模型同时从多个不同的角度看同一段序列，是真实 Transformer 里默认使用的形态喵。

## Analogy

可以把单头注意力想成只请了一位专家来读句子喵。

这位专家很厉害，但他一次只带一副“眼镜”，只能重点看一种关系，比如只盯着“谁是动作的执行者”喵。

多头注意力则是同时请来 8 位专家，每人戴一副不同的眼镜：一位专看语法主谓关系，一位专看指代（“它”指的是谁），一位专看位置远近，一位专看修饰关系……喵。

每位专家独立读完、各自给出结论，最后由一个“主编”（输出矩阵 W_O）把 8 份结论汇总拼接成一份最终报告喵。

关键在于：8 位专家不是重复劳动，而是各看各的角度，合起来比一个人看得更全面喵。

## Core Mechanism

单头注意力的问题是：一组 Q/K/V 只能学到一种“契合模式”，一次 softmax 出来的注意力分布，往往会集中在某一类关系上，其它关系就被稀释掉了喵。

多头注意力的解决办法是**并行开多组 Q/K/V**，具体分四步喵。

**第一步：切分成多个头。** 假设模型维度 d_model = 512，头数 h = 8，那么每个头的维度就是 d_k = 512 / 8 = 64喵。输入向量通过各自的 W_Q^i、W_K^i、W_V^i（i = 1…8）投影到 64 维的子空间，每个头拿到一套独立的 Q/K/V喵。

**第二步：每个头独立算注意力。** 每个头都跑一遍上一节学的完整流程 `softmax(QKᵀ / √d_k) · V`，得到一个 64 维的输出喵。8 个头就有 8 个 64 维输出，互不干扰喵。

**第三步：拼接（Concat）。** 把 8 个头的输出沿维度方向拼起来，8 × 64 = 512，重新变回 d_model 的维度喵。

**第四步：输出投影 W_O。** 拼接后的向量再乘一个输出矩阵 W_O，把各头的信息融合、混合到一起，得到多头注意力的最终结果喵。

写成公式就是喵：

```
head_i   = Attention(Q·W_Q^i, K·W_K^i, V·W_V^i)
MultiHead = Concat(head_1, …, head_h) · W_O
```

一个重要的直觉：**总参数量和总计算量并没有暴涨**，因为每个头的维度被切小了（512 → 64）喵。8 个 64 维的头加起来还是 512 维，相当于把“一个大注意力”重新分配成“8 个小注意力”，几乎不增加成本却换来了多视角的表达能力喵。

在具身智能里这一点很有用：一个头可能盯着语言指令里的动词，一个头盯着图像里物体的位置，一个头盯着机器人当前的关节状态，多头让模型能同时聚合多种模态、多种关系的线索喵。

## Code Example

> 在上一节单头代码的基础上，扩展成多头并拼接，用 numpy 手写一遍喵。

```python
import numpy as np

def softmax(x, axis=-1):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / np.sum(e, axis=axis, keepdims=True)

def attention(Q, K, V):
    d_k = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(d_k)      # 点积 + 缩放
    weights = softmax(scores)             # 归一化
    return weights @ V                    # 对 V 加权求和

# 4 个 token，模型维度 d_model = 8，头数 h = 2，故每头 d_k = 4
np.random.seed(0)
n_tokens, d_model, h = 4, 8, 2
d_k = d_model // h                        # = 4

X = np.random.randn(n_tokens, d_model)    # 输入序列

# 每个头一套独立的 W_Q / W_K / W_V（这里随机代表“已学好的参数”）
heads = []
for i in range(h):
    Wq = np.random.randn(d_model, d_k)
    Wk = np.random.randn(d_model, d_k)
    Wv = np.random.randn(d_model, d_k)
    Q, K, V = X @ Wq, X @ Wk, X @ Wv      # 投影到该头的子空间
    heads.append(attention(Q, K, V))      # 每头独立算注意力 → (4, 4)

concat = np.concatenate(heads, axis=-1)   # 拼接 → (4, 8)
W_O = np.random.randn(d_model, d_model)   # 输出投影
output = concat @ W_O                      # 融合 → (4, 8)

print("每个头的输出形状:", heads[0].shape)   # (4, 4)
print("拼接后形状:", concat.shape)           # (4, 8)
print("多头注意力最终输出形状:", output.shape) # (4, 8)
```

走查一遍：每个头把 8 维输入投影到 4 维子空间，各自跑一次注意力得到 (4, 4)喵。两个头拼起来恢复到 (4, 8)，再经 W_O 融合，输出维度和输入一致，可以直接堆叠下一层喵。

注意每个头的 W_Q/W_K/W_V 都是独立的随机矩阵，这正是不同头能学到不同关系的根源——它们把 token 投影到了不同的子空间喵。

## Common Misconceptions

第一个误区是以为多头就是把同样的注意力算 8 遍喵。其实每个头有独立的投影矩阵，看的是不同子空间、不同关系，结果各不相同喵。

第二个误区是以为多头会让计算量翻好几倍喵。因为每个头的维度被切小了（d_model / h），总计算量和单个全维度注意力大致相当，不是简单的 ×h喵。

第三个误区是忘了最后的 W_O喵。拼接只是把各头结果并排放好，真正让它们互相融合、交流的是输出投影矩阵 W_O，少了它各头信息就没被整合喵。

第四个误区是以为头越多一定越好喵。头太多会让每个头维度过小、表达能力不足；头数是需要权衡的超参数，常见是 8、12、16喵。

## Socratic Check

先想一个问题：如果 d_model = 512、头数 h = 8，那每个头的维度 d_k 是多少，8 个头拼接后又变回多少维喵？

答案是每头 d_k = 512 / 8 = 64，拼接后 8 × 64 = 512，正好回到 d_model，所以能无缝接入下一层喵。

再想一个问题：如果去掉输出矩阵 W_O，直接把拼接结果送进下一层，会损失什么喵？

答案是会损失“各头之间的信息融合”——W_O 让不同头学到的关系能够交叉组合，去掉它每个头就只是各说各话、没被真正整合成统一表示喵。

---

## Quick Summary

- 多头注意力 = 把一次注意力拆成 h 个并行的“头”，每头在一个更小的子空间（d_k = d_model / h）里独立跑一遍 `softmax(QKᵀ/√d_k)·V`喵。
- 每个头有独立的 W_Q/W_K/W_V，看的是不同角度的关系（语法、指代、位置、模态……），最后 Concat 再经 W_O 融合成最终输出喵。
- 因为维度被切小，多头几乎不增加计算量却换来多视角表达；W_O 是让各头信息真正交流的关键一步喵。

## Next Steps

(Will be updated after the user chooses a sub-topic direction) 喵。
