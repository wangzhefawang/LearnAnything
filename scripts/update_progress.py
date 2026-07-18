#!/usr/bin/env python3
"""按 v2 学习视图刷新 README 中的「学习进度」区块。

零依赖，仅用标准库；脚本只替换 LEARN-PROGRESS 标记之间的内容。
当学习存储不是完整 v2 格式或没有 view 时，脚本不会改动 README。
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path


for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent
TOPICS_DIR = REPO_ROOT / ".learn" / "topics"
README = REPO_ROOT / "README.md"

START = "<!-- LEARN-PROGRESS:START 此区块由 scripts/update_progress.py 自动生成，请勿手动编辑 -->"
END = "<!-- LEARN-PROGRESS:END -->"

STATUSES = {"unexplored", "in_progress", "needs_practice", "mastered"}
IMPORTANCE = {"core", "recommended", "optional"}
CONCEPT_ID_RE = re.compile(r"^[\u3400-\u4dbf\u4e00-\u9fffa-z0-9]+(?:-[\u3400-\u4dbf\u4e00-\u9fffa-z0-9]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$")


class StoreValidationError(Exception):
    """学习存储无法安全聚合。"""


def _read_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise StoreValidationError(f"{path}: JSON 读取失败：{exc}") from exc
    if not isinstance(value, dict):
        raise StoreValidationError(f"{path}: 顶层必须是对象")
    return value


def _require_keys(value: dict, keys: tuple[str, ...], path: Path, scope: str) -> None:
    missing = [key for key in keys if key not in value]
    if missing:
        raise StoreValidationError(f"{path}: {scope} 缺少字段 {', '.join(missing)}")


def _valid_concept_id(value: object) -> bool:
    return (
        isinstance(value, str)
        and unicodedata.normalize("NFC", value) == value
        and value == value.lower()
        and len(value) <= 64
        and bool(CONCEPT_ID_RE.fullmatch(value))
    )


def _validate_state(state: dict, path: Path) -> None:
    if state.get("version") != 2 or state.get("kind") != "knowledge_domain":
        version = state.get("version")
        kind = state.get("kind")
        raise StoreValidationError(
            f"{path}: 检测到 v1/未迁移格式（version={version!r}, kind={kind!r}），请先完成数据迁移"
        )
    _require_keys(state, ("topic", "slug", "created", "domains"), path, "state")
    for key in ("topic", "slug"):
        if not isinstance(state[key], str) or not state[key]:
            raise StoreValidationError(f"{path}: {key} 必须是非空字符串")
    if not isinstance(state["created"], str) or not DATE_RE.fullmatch(state["created"]):
        raise StoreValidationError(f"{path}: created 日期格式无效")
    if not isinstance(state["domains"], list):
        raise StoreValidationError(f"{path}: domains 必须是数组")
    concept_keys = (
        "concept_id",
        "name",
        "status",
        "confidence",
        "practice_count",
        "explain_count",
        "last_explained",
        "last_practiced",
        "details",
    )
    for domain_index, domain in enumerate(state["domains"]):
        if not isinstance(domain, dict):
            raise StoreValidationError(f"{path}: domains[{domain_index}] 必须是对象")
        _require_keys(domain, ("name", "slug", "concepts"), path, f"domains[{domain_index}]")
        if any(not isinstance(domain[key], str) or not domain[key] for key in ("name", "slug")):
            raise StoreValidationError(f"{path}: domains[{domain_index}] 的 name/slug 必须是非空字符串")
        if not isinstance(domain["concepts"], list):
            raise StoreValidationError(f"{path}: domains[{domain_index}].concepts 必须是数组")
        for concept_index, concept in enumerate(domain["concepts"]):
            scope = f"domains[{domain_index}].concepts[{concept_index}]"
            if not isinstance(concept, dict):
                raise StoreValidationError(f"{path}: {scope} 必须是对象")
            _require_keys(concept, concept_keys, path, scope)
            if not _valid_concept_id(concept["concept_id"]):
                raise StoreValidationError(f"{path}: {scope}.concept_id 不符合规范")
            if not isinstance(concept["status"], str) or concept["status"] not in STATUSES:
                raise StoreValidationError(f"{path}: {scope}.status 不在四态枚举中")
            if not isinstance(concept["name"], str) or not concept["name"]:
                raise StoreValidationError(f"{path}: {scope}.name 必须是非空字符串")
            confidence = concept["confidence"]
            if isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1:
                raise StoreValidationError(f"{path}: {scope}.confidence 必须在 0–1 之间")
            for count_key in ("practice_count", "explain_count"):
                count = concept[count_key]
                if isinstance(count, bool) or not isinstance(count, int) or count < 0:
                    raise StoreValidationError(f"{path}: {scope}.{count_key} 必须是非负整数")
            for date_key in ("last_explained", "last_practiced"):
                date = concept[date_key]
                if date is not None and (not isinstance(date, str) or not DATE_RE.fullmatch(date)):
                    raise StoreValidationError(f"{path}: {scope}.{date_key} 日期格式无效")
            if (concept["explain_count"] > 0) != (concept["last_explained"] is not None):
                raise StoreValidationError(f"{path}: {scope} 的 explain_count 与 last_explained 不一致")
            if (concept["practice_count"] > 0) != (concept["last_practiced"] is not None):
                raise StoreValidationError(f"{path}: {scope} 的 practice_count 与 last_practiced 不一致")
            if not isinstance(concept["details"], list) or any(
                not isinstance(detail, str) or not detail for detail in concept["details"]
            ):
                raise StoreValidationError(f"{path}: {scope}.details 必须是非空字符串数组")


def _validate_view(view: dict, path: Path) -> None:
    if view.get("version") != 2 or view.get("kind") != "learning_view":
        raise StoreValidationError(f"{path}: 检测到 v1/未迁移 view 格式，请先完成数据迁移")
    _require_keys(view, ("name", "slug", "created", "concepts"), path, "view")
    for key in ("name", "slug"):
        if not isinstance(view[key], str) or not view[key]:
            raise StoreValidationError(f"{path}: {key} 必须是非空字符串")
    if not isinstance(view["created"], str) or not DATE_RE.fullmatch(view["created"]):
        raise StoreValidationError(f"{path}: created 日期格式无效")
    if not isinstance(view["concepts"], list):
        raise StoreValidationError(f"{path}: concepts 必须是数组")
    for index, reference in enumerate(view["concepts"]):
        if not isinstance(reference, dict):
            raise StoreValidationError(f"{path}: concepts[{index}] 必须是对象")
        keys = set(reference)
        if not {"concept_id", "importance"} <= keys or not keys <= {"concept_id", "importance", "note"}:
            raise StoreValidationError(
                f"{path}: concepts[{index}] 只能包含 concept_id、importance 与可选 note"
            )
        if not _valid_concept_id(reference["concept_id"]):
            raise StoreValidationError(f"{path}: concepts[{index}].concept_id 不符合规范")
        if not isinstance(reference["importance"], str) or reference["importance"] not in IMPORTANCE:
            raise StoreValidationError(f"{path}: concepts[{index}].importance 不在三档枚举中")
        if "note" in reference:
            note = reference["note"]
            if not isinstance(note, str) or not note.strip():
                raise StoreValidationError(f"{path}: concepts[{index}].note trim 后必须是非空字符串")
            if len(note) > 30:
                raise StoreValidationError(f"{path}: concepts[{index}].note 最多 30 个字符")


def load_store() -> tuple[list[dict], list[dict]]:
    try:
        entries = sorted(TOPICS_DIR.iterdir(), key=lambda path: path.name)
    except OSError as exc:
        raise StoreValidationError(f"无法读取 topics 根目录 {TOPICS_DIR}：{exc}") from exc

    states: list[dict] = []
    views: list[dict] = []
    definitions: dict[str, list[dict]] = {}

    for entry in entries:
        if entry.is_dir():
            path = entry / "state.json"
            if not path.exists():
                continue
            state = _read_json(path)
            _validate_state(state, path)
            record = {"path": path, "dir_name": entry.name, "state": state}
            states.append(record)
            for domain in state["domains"]:
                for concept in domain["concepts"]:
                    definitions.setdefault(concept["concept_id"], []).append(
                        {"concept": concept, "state": state, "domain": domain}
                    )
        elif entry.is_file() and entry.name.endswith(".view.json"):
            view = _read_json(entry)
            _validate_view(view, entry)
            views.append({"path": entry, "view": view})

    if not views:
        raise StoreValidationError(f"{TOPICS_DIR}: 未找到任何 .view.json 学习视图")

    duplicates = sorted(concept_id for concept_id, items in definitions.items() if len(items) != 1)
    if duplicates:
        raise StoreValidationError(f"concept_id 存在全局重复定义：{', '.join(duplicates)}")

    for record in views:
        seen: set[str] = set()
        for reference in record["view"]["concepts"]:
            concept_id = reference["concept_id"]
            if concept_id in seen:
                raise StoreValidationError(f"{record['path']}: 视图内重复引用 {concept_id}")
            seen.add(concept_id)
            if len(definitions.get(concept_id, [])) != 1:
                raise StoreValidationError(f"{record['path']}: concept_id {concept_id} 无法解析到恰好一个定义")
        record["definitions"] = definitions

    return states, views


def _percentage(value: float) -> str:
    return f"{round(value * 100)}%"


def _summary(concepts: list[dict]) -> tuple[int, float, int]:
    total = len(concepts)
    mean = sum(float(concept["confidence"]) for concept in concepts) / total if total else 0.0
    mastered = sum(concept["status"] == "mastered" for concept in concepts)
    return total, mean, mastered


def build_block() -> str:
    states, views = load_store()
    parts = [
        "## 📚 学习进度",
        "",
        "> 数据来源：`.learn/topics/*.view.json` 与各知识领域 `state.json`",
        "",
        "### 学习视图",
        "",
        "| 名称 | 概念数 | mean(confidence) | 已掌握 / 总数 |",
        "| --- | --- | --- | --- |",
    ]

    for record in views:
        view = record["view"]
        concepts = [record["definitions"][item["concept_id"]][0]["concept"] for item in view["concepts"]]
        total, mean, mastered = _summary(concepts)
        report_name = record["path"].name.removesuffix(".view.json") + ".md"
        link = f"[{view['name']}](.learn/topics/{report_name})"
        parts.append(f"| {link} | {total} | {_percentage(mean)} | {mastered} / {total} |")

    parts.extend(
        [
            "",
            "### 知识领域总览",
            "",
            "| 名称 | 概念数 | mean(confidence) | 已掌握 / 总数 |",
            "| --- | --- | --- | --- |",
        ]
    )
    for record in states:
        concepts = [concept for domain in record["state"]["domains"] for concept in domain["concepts"]]
        total, mean, mastered = _summary(concepts)
        parts.append(
            f"| {record['state']['topic']} | {total} | {_percentage(mean)} | {mastered} / {total} |"
        )
    return "\n".join(parts).rstrip()


def main(quiet: bool = False) -> None:
    try:
        block = build_block()
    except StoreValidationError as exc:
        print(f"学习进度未更新：{exc}", file=sys.stderr)
        raise SystemExit(1) from exc

    text = README.read_text(encoding="utf-8")
    pattern = re.compile(re.escape(START) + r".*?" + re.escape(END), re.DOTALL)
    if not pattern.search(text):
        raise SystemExit("未在 README.md 中找到 LEARN-PROGRESS 标记，请确认标记是否存在。")
    replacement = f"{START}\n{block}\n{END}"
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
