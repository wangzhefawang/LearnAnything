#!/usr/bin/env python3
"""根据 .learn/topics/*/state.yaml 自动刷新 README 中的「学习进度」区块。

零依赖，仅用标准库；直接运行即可：

    python scripts/update_progress.py

脚本只会替换 README.md 中
<!-- LEARN-PROGRESS:START --> 与 <!-- LEARN-PROGRESS:END --> 之间的内容，
其余部分（简介、使用说明等）原样保留。
"""

from __future__ import annotations

import datetime as _dt
import argparse
import re
import sys
from pathlib import Path

# Windows 控制台默认可能用 GBK 编码 stdout，强制 UTF-8 以免中文输出乱码
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
TOPICS_DIR = REPO_ROOT / ".learn" / "topics"
README = REPO_ROOT / "README.md"

START = "<!-- LEARN-PROGRESS:START 此区块由 scripts/update_progress.py 自动生成，请勿手动编辑 -->"
END = "<!-- LEARN-PROGRESS:END -->"

STATUS_ICON = {
    "mastered": "✅",
    "needs_practice": "🟡",
    "in_progress": "🔵",
    "unexplored": "⚪",
}
STATUS_LABEL = {
    "mastered": "已掌握",
    "needs_practice": "待练习",
    "in_progress": "学习中",
    "unexplored": "未开始",
}


def parse_state(text: str):
    """极简解析针对本仓库固定结构的 state.yaml（topic + concepts 列表）。"""
    topic = None
    concepts: list[dict] = []
    cur: dict | None = None
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if line.startswith("topic:"):
            topic = line.split(":", 1)[1].strip().strip('"')
        elif re.match(r"^\s*-\s*path:", line):
            if cur:
                concepts.append(cur)
            cur = {"path": line.split("path:", 1)[1].strip().strip('"')}
        elif cur is not None and re.match(r"^\s+\w+:", line):
            key, _, val = stripped.partition(":")
            cur[key.strip()] = val.strip().strip('"')
    if cur:
        concepts.append(cur)
    return topic, concepts


def _conf(c: dict) -> float:
    try:
        return float(c.get("confidence", 0) or 0)
    except ValueError:
        return 0.0


def render_topic(topic: str, concepts: list[dict]) -> str:
    # 按领域（path 中 "/" 前的部分）分组，保持 state.yaml 原有顺序
    domains: dict[str, list[dict]] = {}
    for c in concepts:
        domain = c["path"].split("/", 1)[0].strip()
        domains.setdefault(domain, []).append(c)

    counts = {k: 0 for k in STATUS_ICON}
    for c in concepts:
        counts[c.get("status", "unexplored")] = counts.get(c.get("status", "unexplored"), 0) + 1

    lines: list[str] = []
    lines.append(f"### {topic}\n")
    lines.append(
        f"总览：{len(concepts)} 个概念 · "
        f"🔵 学习中 {counts['in_progress']} · "
        f"⚪ 未开始 {counts['unexplored']} · "
        f"🟡 待练习 {counts['needs_practice']} · "
        f"✅ 已掌握 {counts['mastered']}\n"
    )

    # 领域汇总表
    lines.append("| 领域 | 进度 | 已掌握 / 总数 |")
    lines.append("| --- | --- | --- |")
    for domain, items in domains.items():
        bar = "".join(STATUS_ICON.get(i.get("status", "unexplored"), "⚪") for i in items)
        mastered = sum(1 for i in items if i.get("status") == "mastered")
        lines.append(f"| {domain} | {bar} | {mastered} / {len(items)} |")
    lines.append("")

    # 当前正在学习/待练习的概念
    active = [c for c in concepts if c.get("status") in ("in_progress", "needs_practice")]
    active.sort(key=_conf, reverse=True)
    if active:
        lines.append("**当前正在学习的概念**（按掌握度 confidence 排序）：\n")
        lines.append("| 概念 | 状态 | 掌握度 | 最近学习 |")
        lines.append("| --- | --- | --- | --- |")
        for c in active:
            status = c.get("status", "unexplored")
            icon = STATUS_ICON.get(status, "⚪")
            pct = f"{round(_conf(c) * 100)}%"
            last = c.get("last_session") or c.get("last_practiced") or "—"
            if last == "null":
                last = "—"
            pretty_path = c["path"].replace("/", " / ")
            lines.append(f"| {pretty_path} | {icon} | {pct} | {last} |")
        lines.append("")

    return "\n".join(lines)


def build_block() -> str:
    today = _dt.date.today().isoformat()
    parts = [
        "## 📚 学习进度\n",
        f"> 数据来源：`.learn/topics/*/state.yaml` ｜ 快照时间：{today}",
        "> 图例：✅ 已掌握 ｜ 🔵 学习中 ｜ 🟡 待练习 ｜ ⚪ 未开始\n",
    ]

    state_files = sorted(TOPICS_DIR.glob("*/state.yaml"))
    if not state_files:
        parts.append("_暂无学习记录。运行 `/learn:topic <主题>` 开始第一个主题。_")
    for sf in state_files:
        topic, concepts = parse_state(sf.read_text(encoding="utf-8"))
        topic = topic or sf.parent.name
        parts.append(render_topic(topic, concepts))

    return "\n".join(parts).rstrip()


def main(quiet: bool = False) -> None:
    block = build_block()
    text = README.read_text(encoding="utf-8")

    pattern = re.compile(
        re.escape(START) + r".*?" + re.escape(END), re.DOTALL
    )
    replacement = f"{START}\n{block}\n{END}"
    if not pattern.search(text):
        raise SystemExit(
            "未在 README.md 中找到 LEARN-PROGRESS 标记，请确认标记是否存在。"
        )
    new_text = pattern.sub(lambda _: replacement, text)

    if new_text == text:
        if not quiet:
            print("README 进度已是最新，无需更新。")
        return
    README.write_text(new_text, encoding="utf-8")
    if not quiet:
        print("已更新 README.md 学习进度区块。")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="刷新 README 学习进度区块。")
    parser.add_argument("--quiet", action="store_true", help="不向 stdout 输出普通状态消息。")
    args = parser.parse_args()
    main(quiet=args.quiet)
