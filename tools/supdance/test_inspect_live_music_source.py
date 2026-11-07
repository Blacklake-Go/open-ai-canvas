import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import inspect_live_music_source as audit


class LiveSourceTest(unittest.TestCase):
    def test_ssh_uses_existing_authorization_and_stdin(self):
        with patch("sys.argv", ["audit", "--ssh", "ops@prod"]), patch.object(audit.subprocess, "run", return_value=subprocess.CompletedProcess([], 2)) as run:
            self.assertEqual(audit.main(), 2)
            args = run.call_args.args[0]
            self.assertIn("BatchMode=yes", args)
            self.assertIn("StrictHostKeyChecking=yes", args)
            self.assertEqual(args[-3:], ["--", "ops@prod", "python3 -"])
            self.assertEqual(run.call_args.kwargs["input"], Path(audit.__file__).read_bytes())

    def test_only_correlated_full_revision_confirms_backend_identity(self):
        sha = "a" * 40
        state = {"ready": True, "build": {"commit": sha, "buildTime": "2026-11-07", "version": "test"}, "schema": {"current": 88}}
        web = {"project": "supdance", "service": "web", "local_readiness": state}
        backend = {"project": "supdance", "service": "backend", "oci_revision": sha, "release_mounts": []}
        repo = {"head": sha}
        self.assertEqual(audit.classify(state, [web, backend], [repo])[1], [sha])
        for revised, containers in (
            (state, [web, {**backend, "release_mounts": [{"target": "/usr/local/bin/yingce-backend", "mode": "ro"}]}]),
            (state, [web, {**backend, "project": "another"}]),
            (state, [web, backend, {**web, "project": "second"}]),
            ({**state, "build": {**state["build"], "commit": "waffo-enterprise-candidate"}}, [web, backend]),
        ):
            self.assertEqual(audit.classify(revised, containers, [repo])[1], [])
            self.assertIn("未证实", repo["identity"])

    def test_name_only_search_includes_source_snapshots_but_skips_backups_and_symlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            paths = [root / x / "src" for x in ("supdance-release", "supdance-backup", "unrelated")]
            for path in paths:
                (path / "backend").mkdir(parents=True)
                (path / "web").mkdir()
                (path / "backend/go.mod").touch()
                (path / "web/package.json").touch()
                (path / "plugin-packages/waffo-enterprise").mkdir(parents=True)
            (root / "waffo-link").symlink_to(paths[-1], target_is_directory=True)
            result = audit.source_candidates([root])
            self.assertEqual([x["path"] for x in result], [str(paths[0])])
            self.assertIsNone(result[0]["head"])
            self.assertEqual(result[0]["waffo_named_sources"], ["plugin-packages/waffo-enterprise"])

    def test_unavailable_docker_and_explicit_inspect_projections(self):
        with patch.object(audit, "command", return_value=(None, "命令未安装")):
            self.assertEqual(audit.containers(), ([], "命令未安装"))
        with patch.object(audit, "command", side_effect=[
            ("123456abcdef\tsupdance\tbackend", None),
            ("sha256:" + "f" * 64 + "\n/opt/supdance\nro\t/opt/supdance/releases/abc\t/usr/local/bin/yingce-backend", None),
            ("b" * 40, None),
        ]) as run:
            rows, error = audit.containers()
            self.assertIsNone(error)
            self.assertEqual(rows[0]["release_mounts"][0]["source"], "/opt/supdance/releases/abc")
            for call in run.call_args_list:
                args = call.args[0]
                self.assertIn("--format", args)
                self.assertNotIn("Config.Env", " ".join(args))
