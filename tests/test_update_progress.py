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


if __name__ == "__main__":
    unittest.main()
