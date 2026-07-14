# VLA 架构范式（从 Transformer 到 VLA）— Learning Session

> **Date:** 2026-07-02
> **Concept-IDs:** [vla-架构范式]
> **Knowledge Domain:** 强化学习、模仿学习与具身模型
> **Path:** VLA 视觉-语言-动作模型 → VLA 架构范式
> **Level:** intermediate

---

## Positioning

VLA 架构范式位于「Transformer / VLM 基础」之后，是把大模型从「理解文本和图像」推进到「根据视觉观察与语言指令生成机器人动作」的关键分支，也是你把前面整条 Transformer 主干接到具身智能上的第一步喵。

## Analogy

可以把 VLA 想成一个机器人「大脑翻译器」喵。摄像头告诉它「看到了红色方块和桌子」，人类语言告诉它「把红色方块放到桌子上」，模型最后不是回答一句话，而是输出机械臂下一连串可执行动作喵。

## Core Mechanism

VLA 的全称是 Vision-Language-Action，核心直觉是用**一个统一模型**把「看到什么 + 听到什么」映射成「下一步做什么」喵。

它和你熟悉的 Transformer 是连续的：图像可以切成 patch token，语言可以切成 text token，机器人自己的关节角、夹爪状态、末端位姿等本体状态有时也编码成 state token，然后把这些 token 拼成一个**统一序列**喵。

这个统一序列进入 Transformer 后，自注意力会让视觉 token、语言 token 和状态 token 互相「看见」彼此，从而完成**跨模态融合**——这正好复用你学过的 token 化 + 注意力 + block 堆叠喵。

以「把红色方块放到桌子上」为例：语言 token 强调目标是「红色方块」和「桌子」，视觉 token 提供它们的位置，状态 token 提供机械臂现在在哪里，Transformer Block 负责把这些信息在多层注意力中整合起来喵。

VLA 真正**新增的关键点是动作输出**，因为模型最后不能只生成「我会把它放上去」这类文本，而要输出机器人控制系统能执行的动作喵。主流有两条路线，这里点到为止喵：

- **① 离散化 Action Tokenization**：把连续动作空间切成离散动作 token，再像语言模型生成下一个词那样**自回归生成**动作序列；RT-1、RT-2 可放在这个坐标系里理解喵。
- **② 连续动作头**：在 Transformer 表征后接一个回归头，或用**扩散模型 / flow** 生成一段连续动作 chunk；Diffusion Policy、π0 可放在这个方向上理解喵。

**VLM 与 VLA 的关键区别**在于输出目标不同：VLM 通常输出文本，VLA 输出动作喵。这个区别带来更高要求，因为动作必须连续、稳定、实时闭环，并且会真的改变物理世界喵。换句话说，VLM 错答一句话通常只是语义错误，而 VLA 的动作错误可能导致夹空、撞到桌面、推飞物体，甚至损坏设备喵。

代表性工作可以先记住几个名字作为地图坐标：**RT-1、RT-2、OpenVLA、π0**喵。

主线压缩成一句话：**统一 token 序列**把视觉、语言、状态放进同一个 Transformer，**Transformer** 负责融合上下文，**动作输出头**负责把融合后的表征变成机器人动作喵。

## Code Example

> 最小骨架：视觉 token + 语言 token 拼接 → 单层 Transformer 编码 → 动作头输出 7 维动作喵。

```python
import numpy as np
np.random.seed(0)

def softmax(x, axis=-1):
    x = x - np.max(x, axis=axis, keepdims=True)
    return np.exp(x) / np.sum(np.exp(x), axis=axis, keepdims=True)

def layer_norm(x, eps=1e-5):
    return (x - x.mean(-1, keepdims=True)) / np.sqrt(x.var(-1, keepdims=True) + eps)

def transformer_block(x, d):
    Wq, Wk, Wv, Wo = (np.random.randn(d, d) / np.sqrt(d) for _ in range(4))
    q, k, v = x @ Wq, x @ Wk, x @ Wv
    attn = softmax(q @ k.T / np.sqrt(d), axis=-1)
    x = layer_norm(x + (attn @ v) @ Wo)                 # 注意力子层 + 残差
    W1 = np.random.randn(d, 4 * d) / np.sqrt(d)
    W2 = np.random.randn(4 * d, d) / np.sqrt(4 * d)
    x = layer_norm(x + np.maximum(0, x @ W1) @ W2)      # FFN 子层 + 残差
    return x, attn

d_model, vocab = 32, 100

# 视觉 patch token（假装来自图像编码器）喵
vision_tokens = np.random.randn(4, d_model)
# 语言指令 token（查 embedding 表）喵
text_ids = np.array([12, 7, 31, 45, 9, 3])
text_tokens = (np.random.randn(vocab, d_model) / np.sqrt(d_model))[text_ids]

# 关键骨架：拼成统一序列（加一个 [CLS] 汇总位）+ 位置编码
cls = np.zeros((1, d_model))
tokens = np.concatenate([cls, vision_tokens, text_tokens], axis=0)  # (11, 32)
tokens = tokens + np.random.randn(*tokens.shape) / np.sqrt(d_model)

encoded, attn = transformer_block(tokens, d_model)
pooled = encoded[0]                                     # 用 [CLS] 表征做汇总

# 最小动作头：把融合表征映射成 7 维动作
action = np.tanh(pooled @ (np.random.randn(d_model, 7) / np.sqrt(d_model)))
for name, val in zip(["dx","dy","dz","droll","dpitch","dyaw","gripper"], action):
    print(f"{name}: {val:.3f}")
```

`vision_tokens` 类比图像 patch，携带「红色方块/桌子在哪里」的视觉线索喵。`text_tokens` 携带「把红色方块放到桌子上」的任务意图喵。`np.concatenate` 就是 VLA 的关键骨架之一：把不同模态统一成同维 token 再拼成一个序列喵。`transformer_block` 里的注意力让语言的「红色方块」和视觉里的红色区域建立联系喵。最后 `W_action` 是最小化动作头，把融合后的 `[CLS]` 表征映射成 7 维动作（末端位移、旋转、夹爪开合）喵。真实 VLA 会更复杂：可能输出多个时间步的动作 chunk，也可能加入状态 token、历史帧、相机标定和安全控制模块喵。

## Common Misconceptions

误区一是以为 VLA 只是「会看图的 LLM」喵。VLA 的核心不是回答文本，而是产生物理动作喵。

误区二是以为把图像和语言丢进 Transformer 就够了喵。其实动作空间的建模方式、控制频率、闭环反馈和安全约束同样关键喵。

误区三是以为动作 token 和语言 token 完全一样喵。动作 token 背后对应连续控制量，离散化会引入精度、平滑性和误差积累问题喵。

误区四是以为 VLA 一次输出完整计划就结束了喵。真实机器人通常需要边看边动，持续根据新观察修正动作喵。

## Socratic Check

问题一：如果 VLM 看到红色方块后回答「我应该把它放到桌子上」，为什么这还不是 VLA喵？

答案：因为它只输出了文本意图，没有输出机器人控制器可执行的动作序列喵。

问题二：为什么 VLA 里要把图像 token、语言 token 和状态 token 放进同一个 Transformer 序列里喵？

答案：为了让自注意力在同一个空间里建立跨模态关联，例如把「红色方块」这个语言目标和视觉中的具体物体位置、机械臂当前位姿联系起来喵。

---

## Quick Summary

- VLA 是把视觉观察、语言指令和机器人动作连接起来的统一模型，把「看到+听到」映射成「下一步做什么」喵。
- 它复用了 Transformer 的 token 化、自注意力融合和 Block 堆叠，只是在输入端加入视觉与状态、在输出端加入动作建模喵。
- VLA 和 VLM 最大的区别是输出动作而非文本，因此必须面对连续控制、实时闭环和物理因果；代表工作有 RT-1/RT-2/OpenVLA/π0喵。

## Next Steps

(Will be updated after the user chooses a sub-topic direction) 喵。
