# 模仿学习与行为克隆 Behavior Cloning — Learning Session

> **Date:** 2026-07-02
> **Concept-IDs:** [模仿学习与行为克隆-behavior-cloning]
> **Knowledge Domain:** 强化学习、模仿学习与具身模型
> **Path:** VLA 视觉-语言-动作模型 → 模仿学习与行为克隆 Behavior Cloning
> **Level:** intermediate

---

## Positioning

在「具身智能」知识图谱里，行为克隆是 VLA 视觉-语言-动作模型领域下最主流、最直接的训练范式之一，也是 RT-1、RT-2、OpenVLA、π0 这类模型把大模型能力接到机器人动作上的关键训练入口喵。

## Analogy

可以把行为克隆想成新手司机坐在副驾驶，看老司机在各种路况下怎么打方向盘、踩油门、刹车，然后把每一帧「看到的路况」和「老司机做出的操作」记录下来训练自己喵。

训练时，新手只需要回答一个监督学习问题：看到这个路况时，老司机会怎么操作喵。

如果训练数据里有足够多直道、弯道、红灯、并线场景，新手就能在这些熟悉分布上做得很像老司机喵。

但问题也埋在这里：如果新手某一刻方向盘多打了一点，车偏到了老司机演示里从来没出现过的位置，后面的路况就变成了「训练时没见过的状态」喵。

这时它不是突然变笨，而是被自己前一步的小错误带到了专家轨迹之外，于是下一步更容易错，再下一步更偏，最后误差滚雪球喵。

这就是行为克隆最核心的软肋：训练时只看专家走过的状态，推理时却必须处理自己造成的状态分布喵。

## Core Mechanism

行为克隆的核心定义很朴素：给定专家演示数据集 `D = {(o_i, a_i)}`，训练一个策略模型 `π_θ(a|o)`，让它在观察 `o` 下输出尽量接近专家动作 `a` 的动作分布喵。

这里的 `o` 可以是机器人相机图像、语言指令、本体状态、历史动作、环境状态，`a` 可以是离散 action token，也可以是连续的关节位移、末端执行器位姿或夹爪开合量喵。

所以 BC 的本质不是「机器人自己试错学会任务」，而是把控制问题改写成监督学习问题喵。

如果动作是离散的，训练目标通常是交叉熵损失喵。

例如 VLA 里先把连续机器人动作通过 Action Tokenization 离散化成 token 序列，再让 Transformer 像预测文本 token 一样预测下一个动作 token，这件事本质上就是「对动作 token 做行为克隆」喵。

你刚学过的大模型预训练里，模型根据上下文预测下一个词 token；在 VLA 的 BC 训练里，模型根据图像、语言指令、历史轨迹预测下一个 action token 喵。

于是「Action Tokenization + 交叉熵」可以直接理解为：把机器人控制动作变成词表里的 token，然后用语言模型最熟悉的监督学习方式模仿专家动作喵。

如果动作是连续的，训练目标通常会换成 MSE、负对数似然或扩散模型目标喵。

MSE 的含义是让模型输出的连续动作向量尽量贴近专家动作向量喵。

负对数似然的含义是让专家动作在模型预测的概率分布下具有更高概率喵。

扩散策略的含义则是让模型从噪声中逐步生成一段接近专家演示的连续动作轨迹喵。

这些训练形式看起来差别很大，但只要监督信号来自专家演示动作，核心仍然是行为克隆喵。

从模型结构上看，BC 不要求策略一定是小网络喵。

它可以是一个 MLP，把低维状态映射到动作喵。

它可以是 CNN 或 ViT，把图像映射到动作喵。

它也可以是完整的 VLA Transformer，把视觉 token、语言 token、历史动作 token 拼成上下文，再自回归预测 action token 喵。

因此，BC 更像训练目标和数据范式，而不是某一种具体模型结构喵。

BC 的训练目标可以写成最大化专家动作的条件概率喵。

离散动作时，常见目标是最小化 `-log π_θ(a_i|o_i)` 喵。

连续动作时，常见目标是最小化 `‖â_i − a_i‖²`，或者最大化专家动作在预测分布 `p_θ(a|o)` 下的似然喵。

这和你熟悉的预训练很接近：语言模型拟合语料里的 token，BC 策略拟合专家轨迹里的动作喵。

但 BC 的难点不在「监督学习公式」本身，而在机器人推理时的闭环执行喵。

训练数据里的状态 `o_i` 通常来自专家策略 `π_E` 访问过的轨迹分布喵。

部署时，状态却来自学习者策略 `π_θ` 自己访问过的轨迹分布喵。

这两个分布并不一样，这就是协变量偏移（covariate shift）喵。

在普通图像分类里，模型把一张猫图分错不会改变下一张输入图喵。

在机器人控制里，模型这一步夹爪偏了两厘米，下一步看到的图像、物体位置和接触状态都会随之改变喵。

因此小误差会改变未来输入，未来输入又更偏离专家数据，新的误差再继续放大，这就是复合误差（compounding error）喵。

理论上，如果单步错误率是 `ε`，长时序任务的错误影响可能随时间滚动累积，而不是像独立样本分类那样只损失当前样本喵。

DAgger（Dataset Aggregation）是缓解这个问题的经典方案喵。

它的思路是不要只让专家在专家自己访问过的状态上标注，而是让当前学习者先去跑，收集它实际会访问到的状态，再请专家在这些状态上给出正确动作喵。

然后把这些新标注聚合回数据集，重新训练策略喵。

这样训练分布会逐渐覆盖学习者部署时真正会遇到的偏离状态，模型就不再只会处理「老司机完美轨迹上的路况」喵。

BC 和 RL 的区别也可以一句话抓住喵。

BC 不需要奖励函数，也不需要大量在线环境交互，样本效率高，工程上更稳定，但它通常受限于专家水平，并且容易遇到分布漂移喵。

RL 可以通过试错和奖励信号超越专家，但代价是奖励设计更难、交互成本更高、训练也更不稳定喵。

所以很多现代具身系统会先用 BC 从专家数据获得一个可用初始策略，再考虑用 RL、偏好优化或在线数据继续提升——这也正是后面「强化学习」领域要展开的内容喵。

## Code Example

下面是一个最小可运行的 numpy 行为克隆例子：我们先生成专家数据，再训练一个线性策略从观察映射到离散动作 token 喵。

```python
import numpy as np

np.random.seed(0)

# Expert demonstrations: observation o = [position, velocity]
# Action tokens: 0 = push left, 1 = do nothing, 2 = push right
n = 800
position = np.random.uniform(-2.0, 2.0, size=(n, 1))
velocity = np.random.uniform(-1.0, 1.0, size=(n, 1))
X = np.concatenate([position, velocity], axis=1)

# A simple expert: push toward the origin and damp velocity
expert_score = -position[:, 0] - 0.5 * velocity[:, 0]
y = np.where(expert_score > 0.25, 2, np.where(expert_score < -0.25, 0, 1))

num_actions = 3
W = 0.01 * np.random.randn(2, num_actions)
b = np.zeros((1, num_actions))

def softmax(logits):
    logits = logits - logits.max(axis=1, keepdims=True)
    exp = np.exp(logits)
    return exp / exp.sum(axis=1, keepdims=True)

lr = 0.2
for step in range(1000):
    logits = X @ W + b
    probs = softmax(logits)

    # Cross-entropy on action tokens = behavior cloning for discrete actions
    loss = -np.log(probs[np.arange(n), y] + 1e-9).mean()

    # NOTE: copy probs before the in-place subtract, otherwise the accuracy
    # computed from probs.argmax below would read corrupted values.
    grad_logits = probs.copy()
    grad_logits[np.arange(n), y] -= 1
    grad_logits /= n

    grad_W = X.T @ grad_logits
    grad_b = grad_logits.sum(axis=0, keepdims=True)

    W -= lr * grad_W
    b -= lr * grad_b

    if step % 200 == 0:
        pred = probs.argmax(axis=1)
        acc = (pred == y).mean()
        print(f"step={step:4d} loss={loss:.4f} imitation_acc={acc:.3f}")

test_obs = np.array([
    [1.5, 0.2],
    [-1.2, -0.4],
    [0.05, 0.01],
])

test_probs = softmax(test_obs @ W + b)
test_actions = test_probs.argmax(axis=1)

print("test action probabilities:")
print(test_probs.round(3))
print("chosen action tokens:", test_actions)
```

运行后 loss 会从约 `1.10` 降到 `0.15`，`imitation_acc` 会从约 `0.05` 升到 `0.97`，三个测试观察分别被判为动作 `[0, 2, 1]`：右侧的状态往左推、左侧的状态往右推、接近原点的状态保持不动，正好复现了专家规则喵。

这段代码里的 `X` 就是观察 `o`，`y` 就是专家动作 `a` 的 action token 喵。

专家规则 `expert_score = -position - 0.5 * velocity` 扮演演示者，它会把系统推向原点并抑制速度喵。

训练循环里的 softmax 线性分类器就是一个极小版策略 `π_θ(a|o)` 喵。

交叉熵损失 `-log(probs[range(n), y])` 的含义是：在每个观察下，让专家选择的动作 token 概率尽量高喵。

这正是离散动作版本的行为克隆喵。

这里有一个容易踩的工程坑：`grad_logits` 必须先 `probs.copy()` 再做就地减 1，否则 `probs` 会被原地改写，后面用 `probs.argmax` 统计的 imitation_acc 会恒为 0，虽然梯度和最终权重其实是对的——这类「指标算错但训练看起来在动」的 bug 尤其隐蔽喵。

如果把这里的二维观察换成图像 token、语言 token 和历史动作 token，把线性层换成 Transformer，把三个动作 token 换成机器人动作词表，那么形式上就很接近 VLA 的训练循环喵。

如果动作不是 token，而是连续向量，比如 `[dx, dy, dz, gripper]`，你会把最后的交叉熵换成 MSE 或概率分布的负对数似然喵。

如果使用 Diffusion Policy，则模型不是一次输出动作，而是学习从噪声中去噪生成专家动作序列，但监督来源仍然是专家演示喵。

这个例子没有体现协变量偏移，因为它只在静态数据集上评估单步模仿准确率喵。

真实机器人部署时，策略输出动作会改变下一帧观察，所以即使单步 imitation accuracy 很高，也仍可能在长程闭环任务里逐渐漂移喵。

## Common Misconceptions

1. 误区一：以为 BC 准确率高就等于机器人任务一定成功喵。
单步动作预测准确率只说明模型在专家数据分布上像专家，不保证它能在自己造成的偏离状态里恢复喵。

2. 误区二：以为数据越多就必然解决协变量偏移喵。
更多专家轨迹能扩大覆盖面，但如果数据仍只来自专家完美轨迹，学习者犯错后进入的状态可能依然没有标注喵。

3. 误区三：以为 BC 学到了一种完整的任务理解喵。
BC 首先学到的是从观察到动作的条件映射，模型可能利用了语言、视觉和历史上下文，但这不自动等价于可靠的因果理解或规划能力喵。

4. 误区四：把 BC 和 RL 混成一类方法喵。
BC 是用专家动作做监督学习，RL 是用奖励和交互优化策略，二者都能训练策略，但学习信号、数据来源和失败模式不同喵。

5. 误区五：以为 Action Tokenization 只是工程细节喵。
Action Tokenization 改变了动作空间的学习形式，让机器人动作可以像文本 token 一样被 Transformer 用交叉熵预测，因此它直接决定了 BC 如何落到 VLA 训练里喵。

## Socratic Check

问题一：如果一个 VLA 模型把机器人连续动作离散化成 action tokens，然后用交叉熵预测专家演示里的下一个 action token，它是在做语言建模、行为克隆，还是两者都有喵？

参考答案：两者都有，但从机器人学习目标看它是在做行为克隆，从建模形式看它借用了语言模型的 token 预测范式喵。

问题二：为什么 BC 训练时 loss 很低，部署到真实机器人上仍然可能失败喵？

参考答案：因为训练 loss 只衡量专家轨迹分布上的拟合效果，而部署时策略的小错误会改变后续观察，把系统带到训练集中少见甚至没见过的状态，导致协变量偏移和复合误差喵。

---

## Quick Summary

- 行为克隆把「学控制」改写成监督学习：给定专家演示 `(o, a)`，训练策略 `π_θ(a|o)` 拟合专家动作喵。
- 在 VLA 里，Action Tokenization + 交叉熵本质上就是对离散动作 token 做行为克隆，而连续动作版本通常用 MSE、负对数似然或扩散目标喵。
- BC 的核心软肋是协变量偏移和复合误差，DAgger 通过让专家标注学习者实际访问过的状态来缓解这个问题喵。

> 参考背景可以记住四个名字：ALVINN 是早期驾驶模仿学习代表，DAgger 是处理分布漂移的经典方法，RT-1 展示了大规模机器人 BC 的威力，Diffusion Policy 则代表了连续动作序列生成式 BC 的重要路线喵。

## Next Steps
(Will be updated after the user chooses a sub-topic direction)
