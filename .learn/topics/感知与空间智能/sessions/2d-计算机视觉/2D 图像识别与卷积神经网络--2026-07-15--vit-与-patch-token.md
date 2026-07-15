# 2D 图像识别与卷积神经网络 — 学习会话（ViT 与 Patch/Token）

> **Date:** 2026-07-15
> **Concept-IDs:** [2d-图像识别与卷积神经网络]
> **Knowledge Domain:** 感知、传感器与空间智能
> **Path:** 2D 计算机视觉 → 2D 图像识别与卷积神经网络
> **Level:** beginner

---

## 定位

ViT 与 Patch/Token 是从 CNN 过渡到视觉 Transformer 的关键桥梁，它解释了二维图像如何转换成 Transformer 能处理的 Token 序列喵。

理解这一过程后，就能把已经掌握的多头注意力、QKV 和位置编码知识迁移到图像分类，并进一步理解检测与分割模型中的视觉 Transformer 喵。

## 类比

可以把一张公路巡检图像想象成一幅尺寸很大的道路地图，而 Transformer 是一场只接受标准格式报告的专家会议喵。

如果让每个像素都派一名代表参会，代表数量会达到数万，所有代表还要两两交流，会议成本很快就会失控喵。

ViT 因此先把地图切成许多大小相同的方形责任区，每个责任区就是一个 Patch 喵。

每个责任区把其中的颜色、纹理和边缘信息整理成一份固定长度的报告，这份报告就是一个 Patch Token 喵。

所有责任区的代表可以在自注意力层中互相交流，因此位于图像左上角的裂缝片段可以直接关注右下角的另一个裂缝片段喵。

由于报告本身没有写明责任区的位置，每位代表还必须佩戴一个位置编号，这对应位置编码喵。

会议中还会安排一名不对应任何实际区域的总负责人，它就是 `[CLS]` Token，负责汇总所有区域的信息并输出整张图像的分类结果喵。

## 核心机制

### 为什么 Transformer 不直接把每个像素当作 Token

Transformer 理论上可以把每个像素转换成一个 Token，但标准自注意力需要计算所有 Token 两两之间的注意力，因此计算量和注意力矩阵规模都随序列长度的平方增长喵。

一张 `224 × 224` 图像包含 `224 × 224 = 50,176` 个像素，如果每个像素都是一个 Token，序列长度就会达到 `50,176`喵。

单个注意力头需要构造一个约为 `50,176 × 50,176` 的注意力分数矩阵，其中包含约 25.18 亿个数值喵。

如果使用 32 位浮点数，仅保存这一张注意力分数矩阵就需要大约 10 GB 内存，训练时还要保存梯度、中间结果和多个注意力头，因此成本通常无法接受喵。

逐像素 Token 还会让模型耗费大量计算去重新发现相邻像素通常彼此相关这一基本事实，而图像的局部连续性本可以通过更紧凑的表示加以利用喵。

ViT 通过把邻近像素合并成 Patch，大幅缩短序列，使标准 Transformer 能在可接受的成本下处理图像喵。

### 从图像切分出 Patch

假设输入是一张形状为 `224 × 224 × 3` 的 RGB 图像，并选择 `16 × 16` 的 Patch 尺寸喵。

图像的高度方向可以切成 `224 ÷ 16 = 14` 行，宽度方向也可以切成 `14` 列，因此总共得到 `14 × 14 = 196` 个 Patch 喵。

每个 Patch 包含 `16 × 16 × 3 = 768` 个像素通道值，展平后就成为一个 768 维向量喵。

此时序列长度从逐像素方案的 `50,176` 降到了 `196`，不含 `[CLS]` Token 的注意力矩阵也从约 25.18 亿个元素降到了 `196² = 38,416` 个元素喵。

Patch 尺寸决定了计算量与细节保留之间的权衡，Patch 越大，Token 越少，但细小结构越容易被压缩；Patch 越小，细节越丰富，但自注意力成本会迅速增加喵。

### Patch Embedding 与 NLP 词嵌入的对应关系

Transformer 要求所有 Token 具有相同的嵌入维度，因此 ViT 会把每个展平后的 Patch 向量通过同一个线性层投影到 `embed_dim` 维空间喵。

如果 Patch 原始维度为 768，而模型嵌入维度为 192，那么线性投影会把每个 `768` 维向量转换为一个 `192` 维 Patch Token 喵。

这个过程称为 Patch Embedding，它与 NLP 中的词嵌入作用相似，都是把原始输入单位转换成 Transformer 能处理的统一向量表示喵。

两者的实现方式并不完全相同，因为 NLP 通常根据离散词 ID 查询嵌入表，而 ViT 通常对包含连续像素值的 Patch 执行线性投影喵。

所有 Patch 共用同一组投影参数，因此无论某个 Patch 位于图像何处，它都会使用相同方式转换为 Token 喵。

完成投影后，一批图像的张量会从 `[B, 3, 224, 224]` 变为 `[B, 196, embed_dim]`，其中 `B` 是批量大小喵。

### 为什么卷积可以实现 Patch Embedding

Patch Embedding 可以显式地执行切块、展平和线性投影，也可以用一个卷积层一次完成这些操作喵。

当 `nn.Conv2d` 的卷积核尺寸和步幅都设为 `16` 时，每次卷积正好覆盖一个 `16 × 16` 区域，并且相邻卷积窗口不会重叠喵。

如果卷积层有 `embed_dim` 个输出通道，就相当于为每个 Patch 计算 `embed_dim` 个不同的加权和，从而得到一个 `embed_dim` 维向量喵。

卷积层的权重形状为 `[embed_dim, 3, 16, 16]`，将每个输出通道的权重展平后，就与线性投影矩阵中的一列或一行相对应喵。

因此，`Conv2d(3, embed_dim, kernel_size=16, stride=16)` 在数学上等价于对所有不重叠 Patch 共享同一个「展平后再线性投影」操作喵。

卷积输出形状为 `[B, embed_dim, 14, 14]`，再把空间维展平并交换维度，就能得到 `[B, 196, embed_dim]` 的 Token 序列喵。

### `[CLS]` Token 如何汇总整张图像

ViT 通常在 196 个 Patch Token 前面添加一个可学习的 `[CLS]` Token，使序列长度变为 `197`喵。

`[CLS]` Token 不对应任何真实图像区域，而是一个由训练过程学习出来的全局信息容器喵。

进入自注意力层后，`[CLS]` Token 可以关注所有 Patch Token，同时各个 Patch Token 也可以与它交换信息喵。

经过多层 Transformer 编码器后，模型取出 `[CLS]` Token 的最终表示，并送入线性分类头预测正常、裂缝或坑槽喵。

这与文本分类模型使用 `[CLS]` Token 汇总整段文本的思路相似喵。

`[CLS]` 并不是唯一的全局汇总方式，某些视觉模型也会对全部 Patch Token 做平均池化，但经典 ViT 通常采用 `[CLS]` Token 喵。

### 为什么必须加入位置编码

自注意力根据 Token 内容计算 Q、K 和 V，但它本身没有内置的二维空间顺序概念喵。

更严格地说，如果不加入位置信息，重新排列输入 Token 时，自注意力输出也只会按相同方式重新排列，而使用 `[CLS]` 汇总时，模型无法仅凭这种机制区分不同的空间排列喵。

例如，同样一组沥青、裂缝和车道线 Patch 即使被打乱顺序，模型看到的内容集合仍然相同，但它们组成的道路结构已经完全不同喵。

经典 ViT 会为序列中的每个位置学习一个独立的位置嵌入，并将它直接加到对应的 Patch Token 上喵。

对于 196 个 Patch 和一个 `[CLS]` Token，可学习位置嵌入的形状通常是 `[1, 197, embed_dim]`喵。

加入位置嵌入后，Token 同时携带「这个区域包含什么」和「这个区域位于哪里」两类信息喵。

经典可学习位置嵌入通常绑定训练时的 Patch 网格尺寸，如果推理图像尺寸发生变化，往往需要对位置嵌入进行插值或采用能适应不同尺寸的位置编码方案喵。

### 自注意力在图像上表示什么

Patch Token 进入 Transformer 后，会像文本 Token 一样分别生成 Q、K 和 V 喵。

某个 Patch 的 Q 会与包括自身在内的所有 Patch 的 K 计算相似度，再经过 Softmax 得到注意力权重喵。

这些权重决定当前 Patch 应该从其他位置的 V 中吸收多少信息，因此一个 Patch 的新表示可以融合整张图像的上下文喵。

在公路图像中，一个包含细长暗线的 Patch 可能同时关注远处具有相似方向和纹理的 Patch，从而判断这些局部片段是否属于同一条长裂缝喵。

不同注意力头可以学习不同关系，例如一个头关注裂缝纹理的连续性，另一个头关注裂缝与车道线的区别，还有一个头关注坑槽与周围路面的整体明暗关系喵。

标准全局自注意力从第一层开始就允许任意两个 Patch 直接交换信息，因此它的全局建模路径很短喵。

CNN 的单个小卷积核只能观察邻近区域，通常需要堆叠多层卷积或进行下采样，才能让深层特征获得覆盖整张图像的感受野喵。

这并不表示 ViT 在第一层就一定理解了完整场景，而只是说明它在结构上允许远距离区域立即建立联系喵。

### 与 CNN 归纳偏置的进一步对比

CNN 把局部连接、权值共享和平移等变性写进了网络结构，因此它天然倾向于优先学习局部边缘与纹理喵。

这些先验缩小了模型需要从数据中探索的可能性范围，所以 CNN 在数据量较小的任务上通常更容易训练喵。

ViT 的 Patch Embedding 虽然也在不同位置共享投影参数，但后续全局自注意力并不强制模型优先关注邻近 Patch，也不天然保证图像平移后特征以相同方式平移喵。

这种较弱的视觉归纳偏置意味着 ViT 必须从数据中自行学会局部性、空间结构和常见视觉模式，因此在小型数据集上可能不如同规模 CNN 稳定喵。

当训练数据足够丰富，或者模型经过大规模监督预训练与自监督预训练后，较少的结构限制也会转化为更强的表示灵活性喵。

此时 ViT 可以学习跨越大范围的视觉关系，并随着模型规模和数据规模增加获得很强的性能喵。

因此，ViT 在大数据和强预训练条件下可能超过 CNN，但这不代表它在任何数据规模、计算预算和部署条件下都更合适喵。

对于公路病害项目，如果只有少量标注图像，从预训练模型开始微调通常比从零训练 ViT 更可靠喵。

### 公路长裂缝与 Patch 边界问题

长裂缝可能从图像一侧延伸到另一侧，并穿过不同光照区域、修补区域和路面纹理喵。

全局自注意力允许相距很远的 Patch 直接建立联系，因此模型有机会把分散在全图中的多个裂缝片段整合为一条连续病害喵。

这种能力对网状裂缝、贯穿裂缝以及需要结合大范围上下文排除车道线干扰的场景尤其有价值喵。

但 Patch 切分也可能破坏细小裂缝的连续性，因为一条很窄的裂缝可能恰好跨越两个 Patch 的边界，并在各自 Patch 中只占很少像素喵。

Patch Embedding 会把整个区域压缩成一个向量，如果 Patch 过大，细裂缝信号可能被大量正常路面纹理淹没喵。

减小 Patch 尺寸能够保留更细的空间信息，但 Token 数量会按面积增长，而全局注意力成本又会随 Token 数量的平方增长喵。

工程上需要结合图像分辨率、最小病害宽度、算力预算和任务类型选择 Patch 尺寸，而不能只套用固定的 `16 × 16` 配置喵。

### 混合架构的方向

一种常见思路是先让 CNN 提取局部边缘和纹理特征，再把较紧凑的特征图转换成 Token 交给 Transformer 建模全局关系喵。

Swin Transformer 则把注意力限制在局部窗口内，并通过移动窗口让相邻窗口逐层交换信息，从而降低高分辨率图像的计算成本喵。

这些方案都在尝试平衡 CNN 的局部归纳偏置与 Transformer 的长距离建模能力，但本次只把它们作为后续学习的入口喵。

## 代码示例

下面的 PyTorch 示例使用一个步幅等于 Patch 尺寸的卷积层完成 Patch Embedding，再加入 `[CLS]` Token、可学习位置嵌入和单层 Transformer Encoder，最终执行正常、裂缝、坑槽三分类喵。

```python
import torch
from torch import nn


torch.manual_seed(42)


class TinyRoadViT(nn.Module):
    def __init__(
        self,
        image_size: int = 224,
        patch_size: int = 16,
        in_channels: int = 3,
        embed_dim: int = 192,
        num_heads: int = 3,
        num_classes: int = 3,
    ) -> None:
        super().__init__()

        if image_size % patch_size != 0:
            raise ValueError("image_size must be divisible by patch_size")

        if embed_dim % num_heads != 0:
            raise ValueError("embed_dim must be divisible by num_heads")

        patches_per_side = image_size // patch_size
        self.num_patches = patches_per_side**2

        # 卷积核尺寸和步幅都等于 Patch 尺寸，因此窗口互不重叠
        self.patch_embedding = nn.Conv2d(
            in_channels=in_channels,
            out_channels=embed_dim,
            kernel_size=patch_size,
            stride=patch_size,
        )

        # CLS Token 和位置嵌入都属于可训练参数
        self.cls_token = nn.Parameter(
            torch.zeros(1, 1, embed_dim)
        )
        self.position_embedding = nn.Parameter(
            torch.zeros(1, self.num_patches + 1, embed_dim)
        )

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim,
            nhead=num_heads,
            dim_feedforward=embed_dim * 4,
            dropout=0.1,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )

        # 本示例只堆叠一个 Transformer Encoder 层
        self.encoder = nn.TransformerEncoder(
            encoder_layer,
            num_layers=1,
        )

        self.final_norm = nn.LayerNorm(embed_dim)
        self.classifier = nn.Linear(embed_dim, num_classes)

        nn.init.trunc_normal_(self.cls_token, std=0.02)
        nn.init.trunc_normal_(self.position_embedding, std=0.02)

    def forward(self, images: torch.Tensor) -> torch.Tensor:
        batch_size = images.shape[0]

        # [B, 3, 224, 224] 转为 [B, embed_dim, 14, 14]
        patch_grid = self.patch_embedding(images)

        # 展平空间网格，再变为 [B, 196, embed_dim]
        patch_tokens = patch_grid.flatten(2).transpose(1, 2)

        if patch_tokens.shape[1] != self.num_patches:
            raise ValueError("input image size does not match the model")

        # 为批次中的每张图像复制同一个可学习 CLS Token
        cls_tokens = self.cls_token.expand(batch_size, -1, -1)

        # 把 CLS Token 放到 Patch Token 序列最前面
        tokens = torch.cat([cls_tokens, patch_tokens], dim=1)

        # 注入每个序列位置对应的空间位置信息
        tokens = tokens + self.position_embedding

        encoded_tokens = self.encoder(tokens)

        # 取出编码后的 CLS Token 作为整张图像的表示
        image_representation = self.final_norm(
            encoded_tokens[:, 0]
        )

        logits = self.classifier(image_representation)
        return logits


model = TinyRoadViT()
loss_fn = nn.CrossEntropyLoss()
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=1e-3,
    weight_decay=1e-4,
)

# 构造一个包含四张图像的示意批次
images = torch.randn(4, 3, 224, 224)
labels = torch.tensor([0, 1, 2, 1])

# 执行一次完整的前向传播与参数更新
model.train()
optimizer.zero_grad()

logits = model(images)
loss = loss_fn(logits, labels)

loss.backward()
optimizer.step()

print("logits shape:", logits.shape)
print("loss:", loss.item())
```

### 逐段讲解

`patch_embedding` 使用 `16 × 16` 卷积核和 `16` 步幅，因此每个输出位置只对应一个互不重叠的 Patch 喵。

该卷积层有 `192` 个输出通道，所以每个 Patch 会被投影成一个 192 维 Token 喵。

卷积权重形状为 `[192, 3, 16, 16]`，每组权重都会对一个 `16 × 16 × 3` Patch 计算一次加权和，这与把 Patch 展平为 768 维后再应用一个共享线性层等价喵。

卷积输出的形状是 `[B, 192, 14, 14]`，`flatten(2)` 把 `14 × 14` 网格展平成 196 个位置，`transpose(1, 2)` 再把嵌入维移动到最后喵。

`cls_token` 的初始形状是 `[1, 1, 192]`，使用 `expand` 后会为批次中的每张图像提供一个共享参数但独立参与计算的 `[CLS]` Token 喵。

拼接 `[CLS]` 后，序列形状变为 `[B, 197, 192]`，位置嵌入也采用相同形状，因此可以逐元素相加喵。

`TransformerEncoderLayer` 内部包含多头自注意力、前馈网络、残差连接和层归一化，而示例只使用一层，以突出 Patch 到 Token 再到分类的主流程喵。

编码完成后，程序只取序列索引 `0` 的 `[CLS]` 表示，并通过线性分类器输出三个 logits 喵。

`CrossEntropyLoss` 直接接收 logits 和整数类别标签，因此模型内部不需要提前执行 Softmax 喵。

示例最后执行了一次反向传播和优化器更新，说明 Patch Embedding、位置嵌入、`[CLS]` Token、Transformer 和分类头可以作为一个整体端到端训练喵。

## 常见误区

- **误区一：一个 Patch 就是一个像素**——Patch 通常包含许多像素，例如 `16 × 16` RGB Patch 包含 768 个像素通道值，而一个 Token 是这些值经过投影后的向量表示喵。

- **误区二：每个 Patch Token 永远都是 768 维**——768 只是 `16 × 16 × 3` Patch 展平后的原始维度，经过 Patch Embedding 后的维度由模型的 `embed_dim` 决定喵。

- **误区三：自注意力会自动知道 Patch 在图像中的位置**——自注意力只根据 Token 内容建立关系，必须加入位置编码才能明确区分左上角、中心和右下角等位置喵。

- **误区四：ViT 在任何数据集上都一定优于 CNN**——ViT 的视觉归纳偏置更弱，数据不足或缺少预训练时可能不如 CNN，而大规模数据和强预训练通常更有利于发挥其能力喵。

- **误区五：Patch 越小就一定越好**——较小 Patch 能保留更多细节，但会增加 Token 数量，并让全局自注意力的计算与显存开销近似按 Token 数量的平方增长喵。

## 苏格拉底式检查

- 如果把一张图像的 196 个 Patch 完全打乱，但不使用位置编码，模型还能仅凭自注意力判断哪些裂缝片段在空间上彼此相邻吗喵？

- 如果要识别只有几个像素宽的裂缝，把 Patch 从 `16 × 16` 改为 `8 × 8` 可能带来什么好处，又会让注意力计算量发生怎样的变化喵？

---

## 快速总结

- ViT 用 Patch 把高分辨率图像压缩成较短的 Token 序列，从而避免逐像素自注意力带来的平方级成本爆炸喵。

- `224 × 224 × 3` 图像按 `16 × 16` 切分后得到 196 个 Patch，每个 Patch 先展平为 768 维，再投影到统一的嵌入维度喵。

- `[CLS]` Token 用于汇总整张图像的信息，位置嵌入则让模型知道各个 Patch 原本位于哪里喵。

- 全局自注意力允许远距离 Patch 从第一层开始直接交互，但 ViT 缺少 CNN 那样强烈的局部性和平移等变性先验喵。

- 全局注意力有利于关联贯穿公路图像的长裂缝，而 Patch 边界与过大的 Patch 也可能削弱细小裂缝信号喵。

## 下一步

（待用户选择子主题方向后更新）
