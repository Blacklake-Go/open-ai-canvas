import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

from retention import DAY, Retention, aged, digest, overlaps, safe_artifact


class BoundaryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()
        self.artifact = self.root / "releases" / "old"
        self.artifact.mkdir(parents=True)
        (self.artifact / "index.html").write_text("generated")

    def test_retains_minimum_copies_even_when_old(self):
        self.assertEqual(aged([("one", 1), ("two", 2), ("three", 3)], 2, 7, 30 * DAY), ["one"])

    def test_never_expires_recent_items(self):
        self.assertEqual(aged([("old", 1), ("new", 19 * DAY)], 0, 7, 20 * DAY), ["old"])

    def test_current_descendant_protects_whole_release(self):
        self.assertFalse(safe_artifact(self.artifact, [self.root / "releases"], [self.artifact / "index.html"]))

    def test_protected_parent_protects_nested_path(self):
        self.assertFalse(safe_artifact(self.artifact, [self.root / "releases"], [self.root]))

    def test_sibling_prefix_does_not_overlap(self):
        self.assertFalse(overlaps(self.root / "foo", self.root / "foobar"))

    def test_root_itself_is_not_a_deletion_candidate(self):
        self.assertFalse(safe_artifact(self.root, [self.root], []))

    def test_symlink_to_live_release_rejected(self):
        p = self.root / "releases" / "alias"
        p.symlink_to(self.artifact, target_is_directory=True)
        self.assertFalse(safe_artifact(p, [self.root / "releases"], []))

    def test_nested_media_or_database_rejects_whole_directory(self):
        for name in ["resources", "uploads", "pgdata"]:
            with self.subTest(name=name):
                p = self.artifact / name
                p.mkdir()
                self.assertFalse(safe_artifact(self.artifact, [self.root / "releases"], []))
                self.assertFalse(safe_artifact(p, [self.root / "releases"], []))
                p.rmdir()

    def test_database_files_and_pg_version_reject_whole_directory(self):
        for name in ["database.dump", "account.sqlite", "state.db", "PG_VERSION"]:
            with self.subTest(name=name):
                p = self.artifact / name
                p.write_text("data")
                self.assertFalse(safe_artifact(self.artifact, [self.root / "releases"], []))
                p.unlink()

    def test_generated_only_directory_is_eligible(self):
        self.assertTrue(safe_artifact(self.artifact, [self.root / "releases"], []))


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name).resolve()
        self.service = Retention({"root": str(root), "state": str(root / "state"),
                                  "managed_backups": str(root / "backups"),
                                  "max_bytes_per_run": 1000}, apply=True)
        self.service.baseline = ["live"]

    def test_hash_mismatch_blocks_all_cleanup(self):
        file = self.service.managed / "main.dump"
        file.write_bytes(b"backup")
        self.service.record_backup("daily", [file])
        file.write_bytes(b"corrupted")
        with self.assertRaisesRegex(RuntimeError, "hash mismatch"):
            self.service.backup_gate()

    def test_missing_weekly_backup_blocks_cleanup(self):
        file = self.service.managed / "main.dump"
        file.write_bytes(b"backup")
        self.service.record_backup("daily", [file])
        with self.assertRaisesRegex(RuntimeError, "recovery set"):
            self.service.backup_gate()

    def test_metadata_cannot_escape_backup_root(self):
        p = self.service.managed / "bad.json"
        p.write_text(json.dumps({"version": 1, "kind": "daily", "files": [
            {"name": "../secret", "sha256": "irrelevant"}]}))
        with self.assertRaises(RuntimeError):
            self.service.valid_records()

    def test_batch_cap_prevents_delete(self):
        called = []
        self.service.action("artifact", "large", 1001, lambda: called.append(1))
        self.assertEqual(called, [])

    def test_changed_deployment_stops_deletion(self):
        with patch.object(self.service, "live_ids", return_value=["new"]):
            with self.assertRaisesRegex(RuntimeError, "Deployment changed"):
                self.service.action("artifact", "old", 1, self.fail)

    def test_dry_run_does_not_delete(self):
        self.service.apply = False
        called = []
        self.service.action("artifact", "old", 1, lambda: called.append(1))
        self.assertFalse(called)

    def test_failed_precheck_still_checks_post_health_and_writes_failure(self):
        with patch.object(self.service, "live_ids", return_value=["live"]), \
             patch.object(self.service, "health", side_effect=[RuntimeError("not ready"), None]) as health, \
             patch.object(self.service, "prune_artifacts") as prune, patch("builtins.print"):
            self.assertEqual(self.service.execute(), 1)
            self.assertEqual(health.call_count, 2)
            prune.assert_not_called()
        self.assertEqual(json.loads((self.service.state / "last.json").read_text())["status"], "failed")

    def test_raw_database_dump_outside_managed_root_is_never_a_candidate(self):
        p = self.service.state.parent / "historic.dump"
        p.write_bytes(b"keep")
        with patch.object(self.service, "live_ids", return_value=["live"]):
            self.service.prune_managed([])
        self.assertTrue(p.exists())

    def test_database_and_redis_drill_containers_are_never_removed(self):
        for image, name, destination in [("custom", "/supdance-stage2-old", "/var/lib/postgresql/data"),
                                          ("redis:7", "/supdance-stage2-redis", "/data"),
                                          ("custom", "/supdance-stage2-test-db", "/data")]:
            c = {"Name": name, "Id": "db", "Config": {"Image": image},
                 "State": {"Status": "exited", "FinishedAt": "2020-01-01T00:00:00Z"},
                 "Mounts": [{"Destination": destination, "Source": str(self.service.state)}]}
            with self.subTest(name=name), patch.object(self.service, "containers", return_value=[c]), \
                 patch.object(self.service, "action") as action:
                self.service.prune_containers()
                action.assert_not_called()

    def test_same_backup_file_cannot_belong_to_two_restore_sets(self):
        file = self.service.managed / "main.dump"
        file.write_bytes(b"backup")
        self.service.record_backup("daily", [file])
        entry = {"version": 1, "kind": "weekly", "created": time.time(),
                 "files": [{"name": file.name, "sha256": digest(file)}]}
        (self.service.managed / "duplicate.json").write_text(json.dumps(entry))
        with self.assertRaises(RuntimeError):
            self.service.valid_records()

    def test_backup_rotation_keeps_seven_newest_restore_sets(self):
        records = []
        for n in range(9):
            file = self.service.managed / f"backup-{n}.dump"
            file.write_bytes(b"archive")
            meta = self.service.managed / f"backup-{n}.json"
            meta.write_text("{}")
            records.append((meta, {"kind": "daily", "created": time.time() - (20 - n) * DAY,
                                   "files": [{"name": file.name}]}))
        with patch.object(self.service, "live_ids", return_value=["live"]):
            self.service.prune_managed(records)
        self.assertEqual(len(list(self.service.managed.glob("*.dump"))), 7)
        self.assertFalse((self.service.managed / "backup-0.dump").exists())
        self.assertTrue((self.service.managed / "backup-8.dump").exists())

    def test_current_or_pinned_image_is_kept_even_when_old(self):
        images = [{"Id": str(n), "RepoTags": [f"supdance-canvas-web:v{n}"], "Size": 1,
                   "Created": f"2020-01-0{n+1}T00:00:00Z"} for n in range(3)]
        for pinned in [True, False]:
            self.service.config["rollback_images"] = ["pin"] if pinned else []
            def commands(args):
                if args[:3] == ["docker", "image", "ls"]:
                    return b"0\n1\n2"
                return json.dumps([images[0]] if args[-1] == "pin" else images).encode()
            with self.subTest(pinned=pinned), patch("retention.run", side_effect=commands), \
                 patch.object(self.service, "containers", return_value=[] if pinned else [{"Image": "0"}]), \
                 patch.object(self.service, "action") as action:
                self.service.prune_images()
                action.assert_not_called()


if __name__ == "__main__":
    unittest.main()
