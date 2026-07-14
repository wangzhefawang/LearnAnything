# Transformer 架构（位置编码 Positional Encoding）— Learning Session

> **Date:** 2026-07-02
> **Topic:** 具身智能
> **Path:** 大模型基础（大脑底座） → Transformer 架构
> **Level:** intermediate
> **说明:** 本节讲解由 codex 起草、Claude 审查修正后交付喵。

---

## Positioning

位置编码是 Transformer 架构中补充「顺序与空间线索」的模块，接在 token 表示进入自注意力之前，专门弥补你前几节反复看到的那个缺口——自注意力是「集合式」的、不天然知道谁在前谁在后喵。

## Analogy

可以把自注意力想成一堆机器人零件被倒在桌面上，注意力机制能判断每个零件和其他零件有什么关系，但如果没有编号、坐标或摆放顺序，它并不知道哪个零件本来在第 1 位、第 2 位、第 3 位喵。

位置编码就像给每个 token 贴上一个坐标标签，让模型知道「机器人」「推」「方块」不是一袋无序的词，而是一条有方向的动作描述喵。

## Core Mechanism

自注意力本身接近「集合式」处理，因为它主要看 token 之间的相似度（就是你学过的 QK 点积），而不是天然看 token 的先后顺序喵。

如果输入只有词向量，那么「机器人 推 方块」和「方块 推 机器人」包含的 token 几乎一样，模型可能知道这些词相关，却缺少足够强的顺序信号来判断动作主体和动作对象是否反了喵。

所以 Transformer 需要把「内容信息」和「位置信息」合在一起，最经典的做法是在输入 embedding 上加一个 position embedding喵。

**Sinusoidal 绝对位置编码**用固定的正弦和余弦函数生成每个位置的向量喵。

公式是：

```
PE(pos, 2i)   = sin( pos / 10000^(2i / d_model) )
PE(pos, 2i+1) = cos( pos / 10000^(2i / d_model) )
```

这里的 `pos` 是 token 的位置，`i` 是维度索引，`d_model` 是模型隐藏维度喵。

它的直觉是：低维和高维使用不同频率的波来描述同一个位置，有的维度变化很快、适合区分相邻 token，有的维度变化很慢、适合表达长距离位置关系喵。

这有点像给位置同时配上「秒针、分针、时针」三种尺度的读数，短距离和长距离都能被表示喵。

因为 sinusoidal 位置编码不是训练出来的表，而是公式算出来的，所以理论上可以给比训练时更长的位置生成编码，具备一定外推能力喵。

**学习式位置编码（learned positional embedding）**则更像给每个位置直接查一张可训练的表喵。

它的优点是灵活，模型可以自己学出最适合训练数据的位置表示喵。

它的缺点是外推较弱，因为如果训练时只学到了 512 个位置，遇到第 1000 个位置时就不一定有自然定义好的表示喵。

**现代大模型里还常见相对位置编码和 RoPE 这类方法**喵。

相对位置编码关注的不是「这个 token 是第几个」，而是「两个 token 相隔多远、方向如何」喵。

RoPE（Rotary Positional Embedding）会把位置信息通过「旋转」的方式注入到 Q 和 K 里，使点积注意力天然带上相对位置关系喵。

简单说，Sinusoidal 更像给每个词贴绝对坐标，RoPE 更像让两个词在计算注意力时自动感知彼此的相对距离和方向喵。

## Code Example

> 最小可运行示例：用 numpy 实现 sinusoidal 位置编码喵。

```python
import numpy as np

def sinusoidal_position_encoding(max_len, d_model):
    # positions 形状 [max_len, 1]，表示第 0、1、2... 个 token 的位置喵
    positions = np.arange(max_len)[:, np.newaxis]

    # dims 形状 [1, d_model]，表示 embedding 的每个维度喵
    dims = np.arange(d_model)[np.newaxis, :]

    # 每两个维度共享一个频率，2i 与 2i+1 用同一个 rate喵
    angle_rates = 1 / np.power(10000, (2 * (dims // 2)) / d_model)

    # 每个位置和每个维度组合出一个角度喵
    angle_rads = positions * angle_rates

    pe = np.zeros((max_len, d_model))
    pe[:, 0::2] = np.sin(angle_rads[:, 0::2])   # 偶数维填 sin喵
    pe[:, 1::2] = np.cos(angle_rads[:, 1::2])   # 奇数维填 cos喵
    return pe

pe = sinusoidal_position_encoding(max_len=5, d_model=8)
print("位置编码形状:", pe.shape)
print(np.round(pe, 4))
```

这段代码会生成形状 `(5, 8)` 的矩阵，表示 5 个位置、每个位置 8 维的位置编码喵。

第 0 行是第 0 个 token 的位置编码，第 1 行是第 1 个 token 的位置编码，依此类推喵。

偶数维用 `sin`、奇数维用 `cos`，这样每个位置都会得到一个由多种频率混合出来的独特向量喵。

在真实 Transformer 里，通常把这个 `pe` 加到 token embedding 上，让每个 token 同时携带「它是什么」和「它在哪里」两类信息喵。

## Common Misconceptions

误区一是以为自注意力天然知道顺序喵。实际上，如果没有位置编码，自注意力更像在处理一组 token 的关系，顺序信息不会自动出现喵。

误区二是以为位置编码只是告诉模型「第几个」，不参与语义理解喵。实际上位置会影响注意力分配，从而影响模型判断动作主体、动作对象和修饰关系喵。

误区三是以为 learned 位置编码一定比 sinusoidal 更高级喵。learned 更灵活，但 sinusoidal 有公式外推优势，两者取舍取决于模型设计和任务场景喵。

误区四是把 RoPE 理解成普通的绝对位置编号喵。RoPE 的重点不是给 token 加一个位置向量，而是在 QK 注意力计算中让相对位置关系自然体现出来喵。

## Socratic Check

问题一：句子「机器人推方块」和「方块推机器人」，没有位置编码时模型为什么容易混淆喵？

答案：因为两个句子的 token 集合几乎一样，自注意力能看到词之间相关，但缺少强顺序信号时，很难稳定判断谁是动作发起者、谁是动作承受者喵。

问题二：为什么说 sinusoidal 位置编码有一定外推能力喵？

答案：因为它不是只记住训练时见过的位置表，而是用公式根据任意 `pos` 现算编码，所以理论上能为更长序列的位置继续生成表示喵。

---

## Quick Summary

- 自注意力本身不天然知道 token 顺序，位置编码负责补上「在哪里」的信息喵。
- Sinusoidal 位置编码用不同频率的正弦/余弦表示位置，既能表达近距离差异，也能表达长距离模式，且有一定外推能力喵。
- learned 位置编码更灵活，RoPE 更强调相对位置关系，现代 Transformer 常按任务选择不同的位置机制喵。

## Next Steps

(Will be updated after the user chooses a sub-topic direction) 喵。
