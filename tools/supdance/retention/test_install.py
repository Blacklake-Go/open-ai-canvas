import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from install import install
from verify_installation import FILES, MANIFEST, verify


class DeploymentProtectionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.source = Path(__file__).resolve().parent
        policy = self.root / FILES[0]
        policy.parent.mkdir(parents=True)
        policy.write_text(json.dumps({"protected_paths": ["keep-current", "keep-rollback"], "private_setting": "preserve"}))
        units = self.root / "etc/systemd/system"
        units.mkdir(parents=True)
        for name in ["supdance-retention.service", "supdance-retention.timer"]:
            (units / name).write_text((self.source / name).read_text() + "\n# local customization must survive\n")
        self.original = {name: (self.root / name).read_bytes() for name in FILES[:3]}

    def test_reinstall_preserves_custom_units_policy_and_manifest(self):
        install(self.root, self.source)
        baseline = (self.root / MANIFEST).read_bytes()
        install(self.root, self.source)
        self.assertEqual((self.root / MANIFEST).read_bytes(), baseline)
        for name, data in self.original.items():
            self.assertEqual((self.root / name).read_bytes(), data)
        verify(self.root)

    def test_changed_policy_fails_before_runtime_or_units_are_written(self):
        install(self.root, self.source)
        runtime = self.root / "usr/local/lib/supdance-retention/retention.py"
        runtime.write_text("sentinel")
        (self.root / FILES[0]).write_text("{}")
        with self.assertRaisesRegex(RuntimeError, "Protected configuration changed"):
            install(self.root, self.source)
        self.assertEqual(runtime.read_text(), "sentinel")

    def test_missing_or_changed_timer_fails_verification(self):
        install(self.root, self.source)
        timer = self.root / FILES[2]
        timer.write_text("[Timer]\nOnCalendar=*-*-* 00:00:00\n")
        with self.assertRaises(RuntimeError):
            verify(self.root)
        timer.unlink()
        with self.assertRaises(OSError):
            verify(self.root)

    def test_installer_never_bootstraps_a_missing_private_policy(self):
        (self.root / FILES[0]).unlink()
        with self.assertRaises(RuntimeError):
            install(self.root, self.source)
        self.assertFalse((self.root / "usr/local/lib/supdance-retention").exists())

    def test_real_web_publication_and_republication_preserve_host_protection(self):
        install(self.root, self.source)
        repository = self.source.parents[2]
        binary = self.root / "test-bin"
        binary.mkdir()
        nginx = binary / "nginx"
        nginx.write_text("#!/bin/sh\nexit 0\n")
        nginx.chmod(0o755)
        html = self.root / "var/www/html"
        release = self.root / "release"
        (release / "assets").mkdir(parents=True)
        env = dict(os.environ, PATH=str(binary) + os.pathsep + os.environ["PATH"],
                   CANVAS_WEB_RELEASE_DIR=str(release), CANVAS_WEB_HTML_DIR=str(html))
        for version in ["old", "new"]:
            (release / "index.html").write_text(version)
            (release / "assets" / (version + ".js")).write_text(version)
            subprocess.run(["sh", str(repository / "docker/canvas-web-entrypoint.sh")], env=env, check=True)
            self.assertEqual((html / "index.html").read_text(), version)
            verify(self.root)
        for name, data in self.original.items():
            self.assertEqual((self.root / name).read_bytes(), data)


if __name__ == "__main__":
    unittest.main()
