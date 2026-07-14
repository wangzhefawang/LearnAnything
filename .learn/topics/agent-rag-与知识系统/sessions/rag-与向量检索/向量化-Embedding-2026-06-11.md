# 向量化 Embedding — 学习会话

> **Date:** 2026-06-11
> **Concept-IDs:** [向量化-embedding]
> **Knowledge Domain:** Agent、RAG 与知识系统
> **Path:** RAG 知识库/向量化 Embedding
> **Level:** 初学者偏上

---

## 定位

向量化 Embedding 位于 **RAG 知识库 → 向量化 Embedding** 分支，它是 RAG 系统的「地基中的地基」——没有它，文本就没法被计算机按**语义**搜索，只能做关键词匹配。它也是记忆机制思考题的答案：记忆太多时不全量加载，而是靠 Embedding 把每条记忆变成坐标点，用时只取离当前问题最近的那几个点。

## 类比

想象一个**巨大的图书馆**，书架上有 10 万本书。

传统检索（关键词）= 你知道书名里有「预算」二字，去书名目录里 Ctrl+F → 能找到写了「预算」的书，但找不到写了「成本控制」「花费上限」这些**意思相同但用词不同**的书。

Embedding 检索（语义）= 图书馆里每本书被贴上一张**坐标贴纸**，内容越相似的书被摆放得越近。你想找「预算」相关的书，只需要把「预算」也变成一张坐标贴纸，然后看周围最近的书架——「成本控制」「花费上限」「经费管理」全在旁边。

**Embedding = 把一段文字变成一组数字坐标（向量），让意思相近的文字在数学空间里也靠得近**。

## 核心机制

**1. 什么是向量（Vector）**

一个向量就是一组有序数字，比如 `[0.12, -0.34, 0.56, ...]`。Embedding 模型把任意一段文字映射成一个固定长度的向量——比如 OpenAI 的 `text-embedding-3-small` 输出 1536 维向量，意思是每段文字被编码成 1536 个数字。

你不需要理解每个数字的含义——重要的是：**语义相近的文字 → 向量也相近 → 可以用数学计算相似度**。

**2. 相似度怎么算**

两个向量之间最常用的度量是**余弦相似度（Cosine Similarity）**：

```
cos(A, B) = A·B / (|A| × |B|)
```

- 结果范围 [-1, 1]，1 = 完全相同方向（语义最近），0 = 无关，-1 = 完全相反
- 不关心向量长度（文本长短），只关心方向（语义方向）

实际效果：
- `embed("预算不超过5000元")` 和 `embed("花费上限五千")` → 余弦相似度约 0.92（很近）
- `embed("预算不超过5000元")` 和 `embed("今天天气不错")` → 余弦相似度约 0.15（很远）

**3. Embedding 模型 ≠ 生成模型**

| | Embedding 模型 | 生成模型（GPT/Claude） |
|---|---|---|
| 输入 | 一段文字 | 一段文字 |
| 输出 | 一组数字（向量） | 新的文字 |
| 用途 | 比较、检索 | 回答、创作 |
| 成本 | 极低（约生成模型 1/50） | 较高 |
| 例子 | text-embedding-3-small | gpt-4o, claude-opus-4-8 |

它们是 RAG 流水线上的两个独立环节：Embedding 负责「找到相关内容」，生成模型负责「基于找到的内容回答」。

**4. 完整的 Embedding 检索流程**

```
离线阶段（建库）：
  文档 → 分块 → 每块过 Embedding 模型 → 向量 → 存入向量数据库

在线阶段（查询）：
  用户问题 → 过同一个 Embedding 模型 → 查询向量
    → 在向量数据库里找 Top-K 最近的向量
    → 取出对应的原始文本块
    → 注入 LLM 上下文 → 生成回答
```

回到记忆的场景：3000 条记忆全部做一次 Embedding 存入向量库（建库），每次对话时把用户问题也做 Embedding，取 Top-5 最相关的记忆注入。

## 代码示例

用 OpenAI Embedding API 实现一个最小检索器——把上一讲的 `MemoryStore` 从全量加载升级为语义检索：

```python
import json
import numpy as np
from openai import OpenAI

client = OpenAI()
EMBED_MODEL = "text-embedding-3-small"

def get_embedding(text: str) -> list[float]:
    """把一段文字变成 1536 维向量"""
    resp = client.embeddings.create(input=text, model=EMBED_MODEL)
    return resp.data[0].embedding

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """余弦相似度：方向越接近越大"""
    a, b = np.array(a), np.array(b)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

# ===== 建库：把记忆全部向量化 =====
memories = [
    "用户预算上限为5000元",
    "用户偏好用 PowerShell 而非 Bash",
    "项目部署在阿里云 ECS 上",
    "上次用方案A失败了，换方案B才成功",
    "用户的老板姓张，喜欢看数据图表",
]
memory_vectors = [get_embedding(m) for m in memories]  # 每条记忆→向量

# ===== 检索：找跟当前问题最相关的记忆 =====
question = "帮我估算一下这个方案要花多少钱"
q_vector = get_embedding(question)

scores = [cosine_similarity(q_vector, mv) for mv in memory_vectors]
top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:3]

print("最相关的 3 条记忆：")
for i in top_indices:
    print(f"  [{scores[i]:.3f}] {memories[i]}")
# 输出示例：
#   [0.847] 用户预算上限为5000元           ← 语义最近，命中！
#   [0.612] 上次用方案A失败了，换方案B才成功
#   [0.534] 项目部署在阿里云 ECS 上
```

代码走读：`get_embedding()` 是唯一和 API 交互的地方——输入文字、输出数字数组；`cosine_similarity()` 是纯数学运算，非常快；检索就是「问题向量 vs 所有记忆向量，排序取 Top-K」。生产中不会用 for 循环暴力算——那是向量数据库（Chroma/Milvus/FAISS）干的活，它们用索引结构把百万级搜索压缩到毫秒级。

## 常见误区

1. **「Embedding 能理解文字含义」** —— 不够精确。它捕捉的是**统计语义相似性**，不是逻辑推理。「猫追老鼠」和「老鼠追猫」的 Embedding 非常接近（同样的词），但含义完全相反——细粒度语义理解是 LLM 的活，不是 Embedding 的活。

2. **「Embedding 越新越好，直接用最贵的」** —— 对多数业务场景，`text-embedding-3-small`（1536 维）和 `-large`（3072 维）的检索效果差距很小，但后者存储翻倍、速度减半。先用 small，不够再换。

3. **「向量检索能替代关键词搜索」** —— 各有盲区。向量搜索擅长「意思相近但用词不同」（语义匹配），但对精确匹配（订单号、错误码）反而不如关键词。生产中常两者混合（hybrid search）。

4. **「文本越长，Embedding 越准」** —— 反了。一段 5000 字的文章被压缩成 1536 个数字，信息必然大量丢失。所以 RAG 流水线有一个关键步骤叫「分块（Chunking）」——先把文档切成 200-500 字的小块，每块单独 Embedding，检索粒度才够细。

## 苏格拉底式检查

回顾上一讲的思考题：用向量检索找相关记忆时，用户问「推荐个餐厅」，而「预算上限 5000 元」这条记忆跟「餐厅」语义距离很远，可能检索不到。现在你知道了 Embedding 的工作原理——有什么办法能让这种「间接相关但很重要」的约束不被遗漏？（提示：不一定只靠检索本身来解决）

---

## 快速总结

- Embedding = 把文字变成数字向量，语义相近则向量相近
- 余弦相似度衡量两个向量的语义接近程度（-1 到 1）
- Embedding 模型和生成模型是 RAG 流水线的两个独立环节，前者找内容、后者答问题
- 完整流程：离线（文档→分块→向量→存库）+ 在线（问题→向量→检索Top-K→注入LLM）
- 向量检索和关键词搜索各有盲区，生产中常混合使用

## 下一步

（待用户选择子方向后更新）
