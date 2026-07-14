# 任务清单：topic 重构为知识领域 + 视图

## 1. 准备、冻结与基线

- [ ] 1.1 冻结学习写入，提交完整快照 commit（迁移唯一输入）
- [ ] 1.2 用现有 v1 工具生成并保存 status/review 基线输出（切换后旧工具无法再读旧结构）
- [ ] 1.3 建迁移分支，创建 10 个知识领域的目录名与显示名对照（design D2）

## 2. 归并表（人工裁决输入）

- [ ] 2.1 导出 158 个旧概念清单（topic/domain/concept/进度快照）
- [ ] 2.2 按 design 冲突裁决清单 C1–C13 填入预裁决决议（keep/merge/split/discard + targets + 目标领域；split 项写明 details 与证据分配）
- [ ] 2.3 为其余机械搬迁概念标注目标领域与 canonical concept_id（含 NFC/小写/连字符规范化）
- [ ] 2.4 建立 36 份会话的 `(source_session_path, activity_type, concept_id)` 事件三元组清单（含孤儿会话挂载、primary concept 指定）
- [ ] 2.5 归并表完整性自检：每个旧概念恰好一条决议、concept_id 在定义间全局唯一、每份会话恰好映射一次
- [ ] 2.6 归并表交用户抽查（冲突项全审、搬迁项抽查）后定稿

## 3. 校验器、渲染器与测试先行

- [ ] 3.1 各技能 utils.mjs：单文件结构校验 `validateStateV2` / `validateViewV2`（v2 字段、四态 status、importance 三值）
- [ ] 3.2 新增权威跨文件校验器 `validate-learning-store.mjs`：concept_id 定义间全局唯一、view 引用可解析且视图内无重复、会话 Concept-IDs 关联、计数/日期一致性
- [ ] 3.3 新增共享渲染模块 + `render-views` 入口（确定性输出、输入摘要哈希、「勿手改」声明）与 `--check` 模式
- [ ] 3.4 status.mjs 支持知识领域视角与 view 聚合视角双模式（importance 仅作次级排序键）
- [ ] 3.5 update_progress.py 改为按视图汇总 README 进度（mean(confidence) + mastered/total）并链接岗位 md
- [ ] 3.6 自动化测试：concept_id 规范化与唯一性、view 引用解析/重复/importance 枚举、status 双模式、render-views 确定性与 --check 非写入、update_progress 岗位汇总；更新既有 tests/test_update_progress.py

## 4. 迁移脚本与数据生成

- [ ] 4.1 编写迁移脚本：读冻结快照 + 归并表，生成 10 个知识领域目录（knowledge-map.md + state.json v2）
- [ ] 4.2 进度合并与计数重建：confidence 取最高、日期取最新、status 取最高 confidence 来源、计数按事件三元组去重重建（修复 ai-agent 与 Transformer 脏数据）
- [ ] 4.3 会话迁移：36 份会话按 primary concept 移入目标领域 sessions/，注入 Concept-IDs 头部
- [ ] 4.4 生成 6 个 view.json（原 6 个 topic 各一，concepts 顺序沿用原 knowledge-map 顺序，importance 初值 core，供用户后调）
- [ ] 4.5 迁移输出通过 3.1/3.2 全部校验与 3.6 测试；针对冻结快照写精确断言测试（概念总数、36 份会话、关键概念进度值）
- [ ] 4.6 首次运行 render-views，生成 6 份岗位 md 报告并复核样式

## 5. 六技能与契约切换

- [ ] 5.1 learn-anything-topic SKILL.md：知识领域创建 + 视图组装模式（禁止为视图凭空建概念树）
- [ ] 5.2 learn-anything-explain SKILL.md：按 concept_id 定位、写进度到知识领域、同回合 render-views
- [ ] 5.3 learn-anything-practice SKILL.md：同上，exercises 路径用 concept_id
- [ ] 5.4 learn-anything-quiz SKILL.md：同上，quizzes 路径用 concept_id
- [ ] 5.5 learn-anything-review SKILL.md：支持按 view 聚合推荐（公式不变，importance 次级排序）
- [ ] 5.6 learn-anything-status SKILL.md：双视角只读展示
- [ ] 5.7 6 个命令存根措辞同步
- [ ] 5.8 CLAUDE.md：重写数据契约、删除跨 topic 同步规则、修正 state.yaml 漂移、会话命名规范目录部分更新
- [ ] 5.9 遇 v1 残留报错不兼容的行为写入各技能与校验器
- [ ] 5.10 SessionEnd hook 接入 render-views 兜底刷新

## 6. 验证与原子切换

- [ ] 6.1 跑全量迁移校验不变量（specs/v1-to-v2-migration）
- [ ] 6.2 v2 status/review 输出与 1.2 保存的 v1 基线对账（概念数、活跃概念、最近学习记录；差异均可由归并表解释）
- [ ] 6.3 render-views --check 与全部结构校验、自动化测试通过
- [ ] 6.4 在复制出的 fixture 目录上冒烟一次 explain 全流程（同回合持久化 + 报告刷新），不污染真实数据
- [ ] 6.5 用户验收 view.json 的 importance 初值与岗位 md 报告样式
- [ ] 6.6 合并迁移里程碑 commit（数据 + 技能 + 脚本 + 契约同一提交），删除旧 topic 目录
