import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path


def load_update_progress():
    script = Path(__file__).resolve().parents[1] / "scripts" / "update_progress.py"
    spec = importlib.util.spec_from_file_location("update_progress", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class UpdateProgressTests(unittest.TestCase):
    def test_stop_hook_runs_progress_script_in_quiet_mode(self):
        hooks_path = Path(__file__).resolve().parents[1] / ".codex" / "hooks.json"
        config = json.loads(hooks_path.read_text(encoding="utf-8"))

        command = config["hooks"]["Stop"][0]["hooks"][0]["command"]

        self.assertIn("scripts/update_progress.py", command)
        self.assertIn("--quiet", command)

    def test_quiet_mode_does_not_write_stdout_when_readme_is_current(self):
        module = load_update_progress()

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            topics = root / ".learn" / "topics" / "demo"
            topics.mkdir(parents=True)
            (topics / "state.yaml").write_text(
                """topic: demo
concepts:
  - path: "基础/概念"
    status: unexplored
    last_practiced: null
    practice_count: 0
    confidence: 0.0
""",
                encoding="utf-8",
            )

            module.REPO_ROOT = root
            module.TOPICS_DIR = root / ".learn" / "topics"
            module.README = root / "README.md"
            block = module.build_block()
            module.README.write_text(
                f"before\n{module.START}\n{block}\n{module.END}\nafter\n",
                encoding="utf-8",
            )

            stdout = io.StringIO()
            with contextlib.redirect_stdout(stdout):
                module.main(quiet=True)

            self.assertEqual("", stdout.getvalue())

    def test_build_block_reads_state_json_topics(self):
        module = load_update_progress()

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            topics = root / ".learn" / "topics" / "demo"
            topics.mkdir(parents=True)
            (topics / "state.json").write_text(
                json.dumps(
                    {
                        "version": 1,
                        "topic": "demo",
                        "slug": "demo",
                        "created": "2026-06-27",
                        "domains": [
                            {
                                "name": "基础",
                                "slug": "基础",
                                "concepts": [
                                    {
                                        "name": "Transformer 架构",
                                        "slug": "transformer-架构",
                                        "status": "in_progress",
                                        "confidence": 0.1,
                                        "practice_count": 0,
                                        "explain_count": 1,
                                        "last_explained": "2026-06-27",
                                        "last_practiced": None,
                                        "details": [],
                                    }
                                ],
                            },
                            {
                                "name": "强化学习（小脑/运动智能）",
                                "slug": "强化学习小脑-运动智能",
                                "concepts": [
                                    {
                                        "name": "PPO 算法",
                                        "slug": "ppo-算法",
                                        "status": "unexplored",
                                        "confidence": 0,
                                        "practice_count": 0,
                                        "explain_count": 0,
                                        "last_explained": None,
                                        "last_practiced": None,
                                        "details": [],
                                    }
                                ],
                            },
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            module.TOPICS_DIR = root / ".learn" / "topics"

            block = module.build_block()

            self.assertIn("`.learn/topics/*/state.json`", block)
            self.assertIn("### demo", block)
            self.assertIn("基础 / Transformer 架构", block)
            self.assertIn("强化学习（小脑/运动智能）", block)
            self.assertNotIn("| 强化学习（小脑 |", block)
            self.assertIn("🔵", block)
            self.assertIn("10%", block)
            self.assertIn("2026-06-27", block)
            self.assertNotIn("暂无学习记录", block)


if __name__ == "__main__":
    unittest.main()
