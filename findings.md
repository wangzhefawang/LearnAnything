# 发现与决策

## 需求

- 状态标签改为 `🟢 已掌握`、`🔵 学习中`、`🟠 需练习`、`⚪ 未探索` 喵。
- 重要性标签改为 `🔴 核心`、`🟡 推荐`、`⚪ 可选` 喵。
- 所有存储枚举、schema、排序与统计逻辑保持不变喵。
- 检查全部使用点及其他脚本中的中文标签副本喵。
- 按用户给定命令重新生成并完整验证喵。

## 研究发现

- `scripts/learning-store-lib.mjs` 的两组集中映射在视图概念表中直接用于重要性列与状态列喵。
- `.claude/skills/learn-anything-status/scripts/status.mjs` 有独立的状态标签、状态图例和重要性标签映射，需要检查并同步标签呈现喵。
- `.claude/skills/*/scripts/utils.mjs` 也导出 `STATUS_LABEL`，需读取确认其现状与用途喵。
- `scripts/update_progress.py` 中命中的“已掌握”目前位于统计表头，属于自然语言统计文案而非枚举标签，需结合代码上下文最终确认喵。
- `tests/status.test.mjs` 对“核心”使用宽松匹配，仍需检查是否应加强到新标签喵。
- 集中状态映射的 `needs_practice` 当前是“待练习”，本次需按明确需求同时改为 `🟠 需练习` 喵。
- `render-views.mjs` 不维护标签副本，只调用 `renderViewMarkdown` 生成报告；加 emoji 不影响其比较、写入或摘要逻辑喵。
- 状态 CLI 的 `ZH_CN.statusLabel` 是纯中文副本，而 `conceptLine` 与图例当前另行输出 `STATUS_ICON`；直接替换映射会产生重复圆点，需同步调整展示拼接喵。
- 状态 CLI 的重要性映射只用于学习视图条目的方括号标签，可直接加圆点且不影响排序、汇总或存储值喵。
- 共享 `utils.mjs` 中的 `STATUS_LABEL` 是英文标签，不属于本次中文副本；其 `STATUS_ICON` 与四种指定颜色一致，验证 schema 仍使用英文枚举喵。
- 仓库内没有 `status.mts` 源文件，实际可维护入口是 `.claude/skills/learn-anything-status/scripts/status.mjs` 喵。
- 现有 `render-views.test.mjs` 验证确定性、摘要、字段与概念顺序，但尚未断言状态和重要性标签文本；应增加精确的新标签断言，同时保留所有现有结构检查喵。
- `status.test.mjs` 的视图测试仅以 `/核心|core/` 宽松匹配重要性，未验证中文彩色标签，也未验证状态标签不重复圆点喵。
- 测试夹具由 `makeStore()` 复制到系统临时目录，适合在不改仓库学习数据的情况下进行精确渲染断言喵。
- 现有视图夹具覆盖三种重要性和 `needs_practice`、`in_progress`、`mastered` 三种状态，但不覆盖 `unexplored`；完整七标签回归测试宜直接构造渲染输入或补充临时数据喵。
- `learning-store.test.mjs` 只验证存储校验行为，没有旧中文标签断言，无需因展示变化放宽任何结构或确定性检查喵。
- `update_progress.py` 的两处“已掌握 / 总数”是聚合统计列标题，下面只输出数字计数，并不存在状态或重要性枚举到中文标签的映射，因此不应改成带圆点的单值标签喵。
- `tests.test_update_progress` 同样只验证统计结构、计数与只读失败行为，没有旧标签断言，无需修改喵。
- 工具层启动的 PowerShell 能读取仓库绝对路径，但其外部 Node 子进程的 `process.cwd()` 是 `C:\`；Node 普通 `fs.existsSync()` 仍确认反斜杠绝对路径存在，当前异常集中在 `node --test` 的 Windows 路径参数解析喵。
- 直接执行绝对测试模块暴露实际根因：Node 对入口调用 `realpath` 时在 `D:\SAVE\Project` 收到 `EPERM`；需先在 PowerShell 内显式切换到仓库，再用相对路径启动 Node 喵。
- 临时镜像路径 `C:\Users\Tu Jinhao\AppData\Local\Temp\learn-anything-labels-codex-20260715` 当前不存在，可安全新建且位于明确可写根目录喵。
- 全部 Node 测试包括 validation、status、skill-contracts、render-views、migration 与 learning-store，镜像需包含 `scripts`、`tests`、`.claude/skills`、`.learn`、`.codex/hooks.json` 和 README 等被测资源喵。
- 最小实现将集中映射导出后由状态 CLI 复用；中文概念行检测标签是否已含图标，避免原有前置图标与新标签重复，中文图例直接显示完整彩色标签喵。
- 定向绿灯表明视图与状态 CLI 各 4 项测试全部通过，原有确定性、顺序、只读检查与 v1 拒绝测试均未受影响喵。
- 镜像中的真实学习数据已通过存储校验，且重新渲染后 `--check` 报告全部 7 份视图均为最新喵。
- 完整 Node 测试共 46 项全部通过，包含 5 份共享 `utils.mjs` 字节一致性测试，说明未改动英文共享标签或验证副本喵。
- Python 进度脚本测试共 6 项全部通过，确认统计输出、quiet 模式和失败不写入行为保持原样喵。
- 仓库与已验证镜像的 18 个 `state.json` / `.view.json` SHA-256 全部一致，英文枚举数据没有任何变化喵。
- 仓库与镜像的 7 份生成报告 SHA-256 全部一致，证明同步回仓库的是已通过验证的精确产物喵。
- 最终使用点检索显示集中映射用于视图表格，状态 CLI 通过导入复用两组映射；其余五份 `utils.mjs` 仅保留原英文 `STATUS_LABEL`，并由字节一致性测试保护喵。
- 状态 CLI 的统计表头也已改为复用集中状态标签，中文计数行则只显示数字，避免同一列标题和数值重复彩色圆点；英文计数格式保持原样喵。

## 技术决策

| 决策 | 理由 |
|---|---|
| 先更新现有测试或增加最小回归断言 | 遵循测试先行，并证明旧标签确实不满足需求喵。 |
| 状态 CLI 复用集中标签导出，并对中文概念行和图例消除重复图标 | 同步中文副本且保证每个标签只显示一个彩色圆点喵。 |

## 问题记录

| 问题 | 处理 |
|---|---|
| 全仓 `rg` 扫描 `.agents/skills` 与 `.codex/skills` 时访问被拒绝 | 改为检索真实源目录 `.claude/skills`，避免访问受限符号链接喵。 |
| Node 测试入口真实路径解析触发沙箱父目录 `EPERM` | 在 PowerShell 命令内显式 `Set-Location` 到仓库，并使用相对测试路径喵。 |
| `Set-Location` 与进程 API 仍受沙箱策略阻止 | 不申请权限或绕过策略，改用允许执行的临时目录镜像喵。 |
