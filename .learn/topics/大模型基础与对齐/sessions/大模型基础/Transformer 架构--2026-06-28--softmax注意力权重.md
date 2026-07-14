# Transformer 架构 — Learning Session

> **Date:** 2026-06-28
> **Concept-IDs:** [transformer-架构]
> **Knowledge Domain:** 大模型基础、训练与对齐
> **Path:** 大模型基础（大脑底座） → Transformer 架构
> **Level:** beginner

---

## Positioning

Softmax 注意力权重位于 Transformer 架构里的注意力计算环节，它连接了 QK 相似度分数和最终用来加权 Value 的上下文信息喵。

## Analogy

可以把 softmax 想成一个预算分配器喵。

假设你有 100 分注意力预算，要理解“放到”这个词时，模型会先给每个词打一个原始重要性分数喵。

但是原始分数可能是 2.3、0.1、-1.2 这种不好直接解释的数字喵。

Softmax 的作用就是把这些分数转换成一组总和为 1 的比例，比如 0.35、0.10、0.05 这种注意力权重喵。

这样模型就能清楚地表达“我把多少比例的注意力分给每个 token”喵。

## Core Mechanism

在 Transformer 里，某个 token 会用自己的 Query 去和所有 token 的 Key 做点积，得到一组原始分数喵。

这些原始分数表示“当前 token 和其他 token 有多匹配”喵。

但原始分数不能直接当权重用，因为它们可能有正有负，大小范围也不固定，总和也不等于 1 喵。

Softmax 会做三件事喵。

第一，它会对每个分数取指数，让更高的分数变得更突出，也让所有结果变成正数喵。

第二，它会把每个指数结果除以全部指数结果的总和，让所有权重加起来等于 1 喵。

第三，它会保留相对大小，也就是原来分数更高的 token 会拿到更大的注意力权重喵。

公式可以写成 `softmax(x_i) = exp(x_i) / sum(exp(x_j))` 喵。

举个直觉例子，如果“放到”对“方块”的原始分数是 3，对“桌子”的原始分数是 3，对“把”的原始分数是 0，那么 softmax 后“方块”和“桌子”会拿到明显更高的权重喵。

最后模型会用这些权重去加权求和所有 Value，得到“放到”这个 token 融合上下文后的新表示喵。

所以 softmax 注意力权重的本质不是判断“哪个词绝对重要”，而是在当前 token 的视角下，把上下文信息按比例混合起来喵。

## Code Example

```python
import math

tokens = ["机器人", "把", "红色", "方块", "放到", "桌子", "上"]

# 这些是“放到”对每个 token 的原始注意力分数喵。
scores = [2.0, 0.2, 0.8, 3.0, 0.5, 3.0, 1.0]

exp_scores = [math.exp(score) for score in scores]
total = sum(exp_scores)
weights = [score / total for score in exp_scores]

for token, weight in zip(tokens, weights):
    print(token, round(weight, 3))

print("sum =", round(sum(weights), 3))
```

这段代码展示了 softmax 的最小过程喵。

`scores` 是原始匹配分数，可以理解为 Query 和 Key 点积后的结果喵。

`math.exp` 会放大高分 token 和低分 token 的差距喵。

最后每个指数分数除以总和，就得到总和为 1 的注意力权重喵。

输出里的 `sum = 1.0` 表示这些权重可以被当成比例来使用喵。

## Common Misconceptions

第一个误区是以为 softmax 只是普通归一化喵。

普通归一化可能只是除以总和，而 softmax 会先取指数，所以高分 token 会被更明显地突出喵。

第二个误区是以为注意力权重越大就说明这个词在所有情况下都更重要喵。

注意力权重是相对于当前 token、当前层、当前注意力头的，不是一个全局固定重要性标签喵。

第三个误区是以为 softmax 后只有最大分数有用喵。

实际上 softmax 会保留多个 token 的贡献，只是高分 token 的贡献更大喵。

第四个误区是忽略缩放因子喵。

真实 Transformer 会先把 QK 点积分数除以 `sqrt(d_k)`，再做 softmax，这是为了避免分数太大导致 softmax 过早变得极端喵。

## Socratic Check

你可以想一个问题：如果不做 softmax，直接拿原始 QK 分数去加权 Value，会有什么问题喵。

答案是权重可能有负数、总和不稳定、尺度不统一，模型很难把它们当成可解释的比例来混合信息喵。

再想一个问题：如果某个分数特别大，softmax 会发生什么喵。

答案是它会拿到接近 1 的权重，其他 token 的权重会被压得很小，所以真实模型需要缩放和训练稳定技巧来避免过度极端喵。

---

## Quick Summary

- Softmax 把 QK 原始分数变成总和为 1 的注意力权重喵。
- Softmax 会突出高分 token，但不会完全丢掉其他 token 喵。
- 注意力权重最终用来加权求和 Value，形成当前 token 的上下文表示喵。

## Next Steps

(Will be updated after the user chooses a sub-topic direction) 喵。
