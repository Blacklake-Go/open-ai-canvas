#!/usr/bin/env python3
"""Unit tests for tools/supdance/check_upstream.py."""

import json
from pathlib import Path
import subprocess
import tempfile
import unittest

from check_upstream import classify_commits, parse_semver_key


class CheckUpstreamTest(unittest.TestCase):
    def test_parse_semver_key_orders_releases_and_prereleases_properly(self):
        tags = ["v1.6.9", "v1.7.1-rc1", "v1.7.0", "v1.6.9.2", "v1.7.1", "v1.6.8.12"]
        sorted_tags = sorted(tags, key=parse_semver_key)
        self.assertEqual(
            sorted_tags,
            ["v1.6.8.12", "v1.6.9", "v1.6.9.2", "v1.7.0", "v1.7.1-rc1", "v1.7.1"],
        )

    def test_classify_commits(self):
        sample = [
            "e9ce0604 feat(platform): 推广中心 - 支持邀请注册",
            "981dcd18 fix(canvas): 提示词引用 - 缩略图恢复",
            "89fcb53f chore(web): 代码格式",
            "12345678 revert: 移除旧接口",
        ]
        grouped = classify_commits(sample)
        self.assertEqual(len(grouped["features"]), 1)
        self.assertEqual(len(grouped["fixes"]), 1)
        self.assertEqual(len(grouped["removals"]), 1)
        self.assertEqual(len(grouped["others"]), 1)

    def test_cli_generates_report_for_baseline_and_upstream_main(self):
        repo_root = Path(__file__).resolve().parents[2]
        script = repo_root / "tools" / "supdance" / "check_upstream.py"
        baseline_cfg = json.loads((repo_root / "supdance" / "config" / "baseline.json").read_text(encoding="utf-8"))
        baseline_tag = baseline_cfg["upstreamBaseline"]["tag"]
        with tempfile.TemporaryDirectory() as tmpdir:
            md_out = Path(tmpdir) / "report.md"
            json_out = Path(tmpdir) / "report.json"
            proc = subprocess.run(
                [
                    "python3",
                    str(script),
                    "--target",
                    baseline_tag,
                    "--output",
                    str(md_out),
                    "--json-output",
                    str(json_out),
                ],
                cwd=repo_root,
                capture_output=True,
                text=True,
                check=True,
            )
            summary = json.loads(proc.stdout)
            json_payload = json.loads(json_out.read_text(encoding="utf-8"))
            for data in (summary, json_payload):
                self.assertEqual(data["base"], baseline_tag)
                self.assertEqual(data["target"], baseline_tag)
                self.assertEqual(data["commitCount"], 0)
                self.assertEqual(data["riskLevel"], "LOW")
            self.assertTrue(md_out.is_file())
            self.assertIn("UPSTREAM_UPDATE_REPORT", md_out.read_text(encoding="utf-8"))

            # Verify --include-unreleased-main detects upstream/main commits and outputs valid JSON keys
            main_md = Path(tmpdir) / "main_report.md"
            main_json = Path(tmpdir) / "main_report.json"
            proc_main = subprocess.run(
                [
                    "python3",
                    str(script),
                    "--include-unreleased-main",
                    "--output",
                    str(main_md),
                    "--json-output",
                    str(main_json),
                ],
                cwd=repo_root,
                capture_output=True,
                text=True,
                check=True,
            )
            main_payload = json.loads(main_json.read_text(encoding="utf-8"))
            self.assertEqual(main_payload["target"], "upstream/main")
            self.assertGreaterEqual(main_payload["commitCount"], 1)
            self.assertIn(main_payload["riskLevel"], {"LOW", "MEDIUM", "HIGH", "CRITICAL"})
            self.assertEqual(main_payload["riskLevel"], json.loads(proc_main.stdout)["riskLevel"])


if __name__ == "__main__":
    unittest.main()
