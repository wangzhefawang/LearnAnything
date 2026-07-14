import contextlib
import importlib.util
import io
import json
import shutil
import tempfile
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_ROOT = REPO_ROOT / "tests" / "fixtures" / "v2-store"


def load_update_progress():
    script = REPO_ROOT / "scripts" / "update_progress.py"
    spec = importlib.util.spec_from_file_location("update_progress", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def prepare_store(module, root: Path) -> Path:
    shutil.copytree(FIXTURE_ROOT, root, dirs_exist_ok=True)
    module.REPO_ROOT = root
    module.TOPICS_DIR = root / ".learn" / "topics"
    (root / ".learn").mkdir()
    shutil.move(str(root / "topics"), module.TOPICS_DIR)
    module.README = root / "README.md"
    return module.TOPICS_DIR


def write_readme(module, body: str = "旧进度") -> str:
    text = f"before\n{module.START}\n{body}\n{module.END}\nafter\n"
    module.README.write_text(text, encoding="utf-8")
    return text


class UpdateProgressTests(unittest.TestCase):
    def test_stop_hook_runs_progress_script_in_quiet_mode(self):
        hooks_path = REPO_ROOT / ".codex" / "hooks.json"
        config = json.loads(hooks_path.read_text(encoding="utf-8"))

        command = config["hooks"]["Stop"][0]["hooks"][0]["command"]

        self.assertIn("scripts/update_progress.py", command)
        self.assertIn("--quiet", command)

    def test_build_block_summarizes_views_and_knowledge_domains(self):
        module = load_update_progress()
        with tempfile.TemporaryDirectory() as tmp:
            prepare_store(module, Path(tmp))

            block = module.build_block()

            self.assertIn("### 学习视图", block)
            self.assertIn("[示例岗位](.learn/topics/示例岗位.md)", block)
            self.assertIn(
                "| [示例岗位](.learn/topics/示例岗位.md) | 3 | 58% | 1 / 3 |", block
            )
            self.assertIn(
                "| [研究视图](.learn/topics/研究视图.md) | 1 | 50% | 0 / 1 |", block
            )
            self.assertIn("### 知识领域总览", block)
            self.assertIn("| 基础领域 | 2 | 75% | 1 / 2 |", block)
            self.assertIn("| 应用领域 | 1 | 25% | 0 / 1 |", block)
            self.assertNotIn("快照时间", block)

    def test_quiet_mode_does_not_write_stdout_when_readme_is_current(self):
        module = load_update_progress()
        with tempfile.TemporaryDirectory() as tmp:
            prepare_store(module, Path(tmp))
            block = module.build_block()
            write_readme(module, block)

            stdout = io.StringIO()
            with contextlib.redirect_stdout(stdout):
                module.main(quiet=True)

            self.assertEqual("", stdout.getvalue())

    def test_v1_store_fails_without_modifying_readme(self):
        module = load_update_progress()
        with tempfile.TemporaryDirectory() as tmp:
            topics = prepare_store(module, Path(tmp))
            state_path = topics / "基础领域" / "state.json"
            state = json.loads(state_path.read_text(encoding="utf-8"))
            state["version"] = 1
            state.pop("kind")
            state_path.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
            original = write_readme(module)

            stderr = io.StringIO()
            with contextlib.redirect_stderr(stderr), self.assertRaises(SystemExit) as raised:
                module.main(quiet=True)

            self.assertNotEqual(0, raised.exception.code)
            self.assertIn("v1", stderr.getvalue().lower())
            self.assertIn("基础领域", stderr.getvalue())
            self.assertEqual(original, module.README.read_text(encoding="utf-8"))

    def test_missing_views_fails_without_modifying_readme(self):
        module = load_update_progress()
        with tempfile.TemporaryDirectory() as tmp:
            topics = prepare_store(module, Path(tmp))
            for view_path in topics.glob("*.view.json"):
                view_path.unlink()
            original = write_readme(module)

            stderr = io.StringIO()
            with contextlib.redirect_stderr(stderr), self.assertRaises(SystemExit) as raised:
                module.main(quiet=True)

            self.assertNotEqual(0, raised.exception.code)
            self.assertIn("view", stderr.getvalue().lower())
            self.assertEqual(original, module.README.read_text(encoding="utf-8"))

    def test_inconsistent_v2_state_fails_without_modifying_readme(self):
        module = load_update_progress()
        with tempfile.TemporaryDirectory() as tmp:
            topics = prepare_store(module, Path(tmp))
            state_path = topics / "应用领域" / "state.json"
            state = json.loads(state_path.read_text(encoding="utf-8"))
            state["domains"][0]["concepts"][0]["practice_count"] = 0
            state_path.write_text(json.dumps(state, ensure_ascii=False), encoding="utf-8")
            original = write_readme(module)

            stderr = io.StringIO()
            with contextlib.redirect_stderr(stderr), self.assertRaises(SystemExit):
                module.main(quiet=True)

            self.assertIn("practice_count", stderr.getvalue())
            self.assertIn("last_practiced", stderr.getvalue())
            self.assertEqual(original, module.README.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
