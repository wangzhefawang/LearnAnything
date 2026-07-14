# 动作表征与 Action Tokenization — Learning Session

> **Date:** 2026-07-02
> **Concept-IDs:** [动作表征与-action-tokenization]
> **Knowledge Domain:** 强化学习、模仿学习与具身模型
> **Path:** VLA 视觉-语言-动作模型 → 动作表征与 Action Tokenization
> **Level:** beginner

---

## Positioning

动作表征（Action Representation）与动作标记化（Action Tokenization）是 VLA（Vision-Language-Action，视觉-语言-动作）模型里连接「多模态大脑输出」和「机器人真实执行」的桥梁：它把连续物理动作变成 Transformer 能生成、训练和解码的符号序列喵。

## Analogy

最贴切的类比是「连续音高到钢琴琴键」喵。人的声音或小提琴滑音可以在频率上连续变化，但钢琴把音高离散成 88 个键，每个键代表一个固定音高附近的范围喵。Action Tokenization 做的事很像：机器人末端向右移动 0.123、夹爪闭合 0.8 这类连续值，先被归一化、分段、映射成有限个编号，模型就可以像生成文字 token 一样生成动作 token 喵。代价是精度不再无限连续，但好处是语言模型熟悉的「下一个 token 预测」范式可以直接接管机器人控制喵。

## Core Mechanism

机器人动作空间通常是连续向量，而不是自然语言句子喵。以一个常见 7 维机械臂动作为例，一步动作可以写成 `[Δx, Δy, Δz, Δroll, Δpitch, Δyaw, gripper]` 喵。前 6 维描述末端执行器（end-effector）的位移和姿态变化，最后 1 维描述夹爪开合喵。真实系统里也可能用关节角速度、关节目标角、绝对末端位姿、动作 chunk，或再加一个终止动作的标志位喵。

理论上，模型可以直接回归连续动作值喵。比如让 Transformer 后面接一个线性层，输出 7 个浮点数，再用 MSE（Mean Squared Error，均方误差）训练喵。但在 VLA 里，动作 tokenization 有几个实际优势喵。第一，它能复用自回归 Transformer（Autoregressive Transformer）的训练方式：输入图像 token、语言 token，再预测下一个动作 token 喵。第二，它让动作和语言共享「词表分类」接口，训练时可以继续用交叉熵损失（Cross Entropy Loss）喵。第三，分类分布比单点回归更容易表达多峰动作选择，例如同一个场景里向左绕开或向右绕开都可能正确，MSE 容易把两者平均成一个错误的中间动作喵。第四，它降低了把机器人控制塞进大语言模型时的工程摩擦，因为输出层本来就是预测词表上的离散 token 喵。

主流方案之一是每维分箱离散化（per-dimension binning）喵。做法是先把每个动作维度归一化到固定范围，比如 `[-1, 1]`，再把这个范围均匀切成 256 个 bin，每个连续值落到哪个 bin，就变成哪个整数 token 喵。RT-1、RT-2 这类工作采用了类似的离散动作思路，RT-2 明确把机器人动作表达为文本 token，以便和视觉语言任务一起训练喵。OpenVLA 的开源实现中也有 `ActionTokenizer`，默认把连续动作离散到 256 个 bin，并映射到基础 tokenizer 词表里最少使用的一段 token 上喵。这个方案简单、稳定、容易调试，但缺点也明显：每个维度独立量化，难以捕捉动作维度之间和时间上的结构，而且高频灵巧操作会受到量化误差和 token 序列长度的限制喵。

另一类方案是学习型动作 tokenizer，例如 VQ-VAE（Vector Quantized Variational Autoencoder，矢量量化变分自编码器）或行为 codebook 喵。这类方法不是手工把每一维均匀切 256 份，而是训练一个编码器把一段连续动作压缩成离散 code，再训练解码器从 code 还原动作喵。它的优点是可以学习「常见动作片段」或「运动模式」，比如抓取前的靠近、夹爪闭合、抬起等动作组合喵。缺点是系统更复杂，需要额外训练 tokenizer，还要处理 codebook 利用率、重构误差、跨机器人泛化等问题喵。FAST（Frequency-space Action Sequence Tokenization，频域动作序列标记化）进一步强调对动作序列做压缩，它基于离散余弦变换（DCT）把高频动作序列压到更适合自回归 VLA 生成的 token 表示中，目标是缓解简单逐维分箱在高频灵巧控制中的不足喵。

动作 token 接回语言模型词表通常有两种办法喵。第一种是复用原文本词表中很少使用的一段 token，例如 OpenVLA 默认假设类似 Llama 的 BPE tokenizer 词表末尾是较少使用的 token，于是把最后 256 个 token 当作动作 bin 使用喵。第二种是扩展词表，显式新增 `<ACT_000>` 到 `<ACT_255>` 这样的动作 token 喵。复用词表省事，扩展词表更清晰，但可能需要重新初始化新增 embedding 并调整模型输出层喵。

推理时流程正好反过来喵。模型看到图像和语言指令后，先自回归生成一串 action token，例如 7 个 token 对应 7 个动作维度喵。系统再把每个 token 映射回 bin 编号，把 bin 编号解码成该 bin 的中心连续值，最后做反归一化，变成机器人控制器能执行的末端位移、姿态变化或夹爪命令喵。这个反过程叫去标记化（de-tokenization）喵。

## Code Example

```python
import numpy as np

BINS = 256
MIN_ACTION = -1.0
MAX_ACTION = 1.0

def tokenize_action(action):
    action = np.asarray(action, dtype=np.float32)
    clipped = np.clip(action, MIN_ACTION, MAX_ACTION)
    step = (MAX_ACTION - MIN_ACTION) / BINS
    tokens = np.floor((clipped - MIN_ACTION) / step).astype(np.int32)
    tokens = np.clip(tokens, 0, BINS - 1)
    return tokens

def detokenize_action(tokens):
    tokens = np.asarray(tokens, dtype=np.int32)
    step = (MAX_ACTION - MIN_ACTION) / BINS
    values = MIN_ACTION + (tokens.astype(np.float32) + 0.5) * step
    return values

action = np.array([0.12, -0.34, 0.00, 0.91, -0.87, 0.45, 1.00], dtype=np.float32)

tokens = tokenize_action(action)
recovered = detokenize_action(tokens)
error = recovered - action

print("original: ", action)
print("tokens:   ", tokens)
print("decoded:  ", recovered)
print("error:    ", error)
print("max abs error:", np.max(np.abs(error)))
```

这段代码先设定 256 个 bin，并规定所有动作维度都已经归一化到 `[-1, 1]` 喵。`tokenize_action` 先把越界动作裁剪到合法范围，避免模型或数据中的异常值落到 bin 外喵。`step = 2 / 256` 表示每个 bin 的宽度是 `0.0078125` 喵。`np.floor((clipped - MIN_ACTION) / step)` 把连续值换算成 bin 编号，例如越接近 `-1` 编号越小，越接近 `1` 编号越大喵。最后一次 `clip` 是为了处理边界值 `1.0`，否则它会被算成 256，而合法 token 只能是 0 到 255 喵。

`detokenize_action` 使用 bin 的中心值来还原连续动作喵。比如 token 0 不还原成 `-1.0`，而是还原成第一个小区间的中心喵。这样做的误差最多大约是半个 bin 宽，也就是 `0.00390625` 喵。这个误差就是量化误差（quantization error），它说明 tokenization 并不是无损压缩喵。bin 越少，误差越大；bin 越多，精度更细，但模型要区分的类别也更多，数据需求和训练难度可能上升喵。

在真正的 VLA 里，上面的整数 token 还会被映射到语言模型词表里的 token id 喵。比如可以把动作 token 0 映射到 `<ACT_000>`，把动作 token 255 映射到 `<ACT_255>`，也可以映射到现有 tokenizer 中预留或少用的词表位置喵。关键点是：模型生成的是离散符号，机器人执行前必须把这些符号解码回连续控制量喵。

## Common Misconceptions

误区一是以为动作 token 和文本 token 有自然语义关系喵。动作 token 42 并不等于某个中文词或英文词的意思，它只是某个动作维度上某个数值区间的编号喵。即使复用了语言模型词表里的旧 token，它在动作位置上的含义也由训练数据重新定义喵。

误区二是以为 bin 越多越好喵。bin 更多会降低单步量化误差，但也会让分类空间更细、更稀疏，模型需要更多数据才能学会稳定预测喵。对于噪声较大的机器人数据，过细的 bin 甚至可能让模型学习到传感器噪声，而不是稳定动作规律喵。

误区三是忽略动作归一化喵。不同动作维度的物理尺度可能完全不同，例如 `Δx` 是米，旋转是弧度，夹爪是开合比例喵。如果不先归一化，某些维度会被过粗或过细地离散，模型学到的 token 分布也会失衡喵。

误区四是以为离散化没有精度损失喵。只要把连续值映射成有限个 token，就一定存在量化误差喵。工程上要评估这个误差对控制是否可接受，尤其是插孔、旋钮、穿线等需要毫米级精度的任务喵。

## Socratic Check

如果某个场景下机器人既可以从左边绕过障碍，也可以从右边绕过障碍，那么用 MSE 回归一个连续动作和用分箱分类预测一个动作分布，哪个更容易表达这种「两个答案都合理」的情况，为什么喵？

如果把每维动作从 256 个 bin 改成 4096 个 bin，量化误差会变小，但训练一定会变好吗喵？

---

## Quick Summary
- 动作表征解决「机器人动作长什么样」，Action Tokenization 解决「怎样把连续动作变成 Transformer 能生成的离散符号」喵。
- 每维分箱简单可靠，RT-2、OpenVLA 这类 VLA 思路都利用了动作离散化来接入语言模型式自回归预测，但它会带来量化误差和结构表达不足喵。
- 学习型 tokenizer 和 FAST 等方法试图把动作序列压缩成更有结构的离散表示，代价是系统复杂度更高、需要额外训练和验证喵。

> 参考背景可见 RT-1、RT-2、OpenVLA 与 FAST 的论文页面，以及 OpenVLA 的 `ActionTokenizer` 开源实现喵。

## Next Steps
(Will be updated after the user chooses a sub-topic direction)
