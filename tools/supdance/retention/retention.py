#!/usr/bin/env python3
"""Conservative, host-local retention for SupDance deployment artifacts."""

import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import zipfile

DAY = 86400
FORBIDDEN = {"pgdata", "postgres-data", "redis-data", "resources", "uploads"}


def run(args, **kwargs):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                            timeout=kwargs.pop("timeout", 120), **kwargs)
    if result.returncode:
        # Commands can contain private connection configuration. Never log stderr.
        raise RuntimeError(f"{Path(args[0]).name} failed (exit {result.returncode})")
    return result.stdout


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_json(path, value):
    path = Path(path)
    tmp = path.with_suffix(path.suffix + ".partial")
    tmp.write_text(json.dumps(value, indent=2) + "\n")
    os.chmod(tmp, 0o600)
    tmp.replace(path)


def overlaps(a, b):
    a, b = Path(a).resolve(), Path(b).resolve()
    return a == b or a in b.parents or b in a.parents


def aged(items, keep, days, now):
    ordered = sorted(items, key=lambda x: x[1], reverse=True)
    return [x[0] for x in ordered[keep:] if now - x[1] >= days * DAY]


def safe_artifact(path, roots, protected):
    path = Path(path)
    if not path.exists() or path.is_symlink():
        return False
    resolved = path.resolve()
    if resolved != path.absolute() or not any(Path(r).resolve() in resolved.parents for r in roots):
        return False
    if any(overlaps(resolved, p) for p in protected):
        return False
    if FORBIDDEN.intersection(path.parts):
        return False
    # Directories containing database/media data are never a deletion unit.
    for folder, dirs, files in os.walk(path):
        if FORBIDDEN.intersection(dirs) or "PG_VERSION" in files:
            return False
        if any(re.search(r"\.(dump|db|sqlite|sqlite3)$", f) for f in files):
            return False
    return not re.search(r"\.(dump|db|sqlite|sqlite3)$", path.name)


class Retention:
    def __init__(self, config, apply=False, backup=False):
        self.config = config
        self.apply, self.backup = apply, backup
        self.state = Path(config["state"])
        self.state.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.managed = Path(config["managed_backups"])
        self.managed.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.report = {"started": dt.datetime.now(dt.timezone.utc).isoformat(),
                       "mode": "apply" if apply else "dry-run", "actions": [], "skipped": []}
        self.used = 0

    def containers(self):
        ids = run(["docker", "ps", "-aq"]).decode().split()
        return json.loads(run(["docker", "inspect", *ids])) if ids else []

    def live_ids(self):
        return sorted(c["Id"] for c in self.containers() if c["State"]["Running"])

    def updater_references(self):
        paths = []
        for raw in self.config.get("updater_state_files", []):
            state = Path(raw)
            if not state.exists():
                continue
            value = json.loads(state.read_text())
            phase = value.get("operation", {}).get("phase")
            if phase in {"preflight", "backing_up", "pulling", "draining", "migrating", "switching", "verifying", "rolling_back"}:
                raise RuntimeError("Host Updater deployment is active; cleanup stopped")
            backup = value.get("lastBackup")
            if backup:
                path = Path(backup["path"])
                if not path.is_file():
                    raise RuntimeError("Host Updater rollback archive is missing")
                paths.append(str(path))
        return paths

    def protections(self):
        containers = self.containers()
        protected = list(self.config["protected_paths"]) + [str(self.managed), str(self.state)]
        protected += self.updater_references()
        # Even stopped database containers and unexpired drills protect their mounts.
        protected += [m["Source"] for c in containers for m in c["Mounts"]]
        for unit in self.config["services"]:
            cwd = run(["systemctl", "show", unit, "-p", "WorkingDirectory", "--value"]).decode().strip()
            if cwd and cwd != "/":
                protected.append(cwd)
        for proc in Path("/proc").iterdir():
            if proc.name.isdigit():
                for part in ("cwd", "exe"):
                    try:
                        target = (proc / part).resolve(strict=True)
                        if str(target).startswith("/opt/"):
                            protected.append(str(target))
                    except (OSError, RuntimeError):
                        pass
                try:
                    for link in (proc / "fd").iterdir():
                        try:
                            target = link.resolve(strict=True)
                            if str(target).startswith(self.config["root"] + "/"):
                                protected.append(str(target))
                        except (OSError, RuntimeError):
                            pass
                except OSError:
                    pass
        return protected

    def health(self):
        for url in self.config["health_urls"]:
            with urllib.request.urlopen(url, timeout=30) as response:
                data = response.read(5 * 1024 * 1024)
                if response.status != 200:
                    raise RuntimeError("Public health request failed")
                if url.endswith("/api/health/ready"):
                    payload = json.loads(data)
                    ready = payload.get("data", {})
                    if payload.get("code") != 0 or ready.get("ready") is not True or not all(ready.get("checks", {}).get(k) is True for k in ("database", "runtime", "schema")):
                        raise RuntimeError("Application readiness failed")
                elif url == self.config["health_urls"][1]:
                    match = re.search(rb'<script[^>]+src="([^"]+\.js)"', data)
                    if not match:
                        raise RuntimeError("Public HTML has no application script")
                    script = urllib.parse.urljoin(url, match[1].decode())
                    if urllib.parse.urlsplit(script).netloc != urllib.parse.urlsplit(url).netloc:
                        raise RuntimeError("Unexpected application script host")
                    with urllib.request.urlopen(script, timeout=30) as asset:
                        if asset.status != 200 or "html" in asset.headers.get("Content-Type", ""):
                            raise RuntimeError("Application JavaScript unavailable")
                        asset.read(256)
        for unit in self.config["services"]:
            run(["systemctl", "is-active", "--quiet", unit])
        for c in self.containers():
            if c["State"]["Running"] and c["State"].get("Health", {}).get("Status", "healthy") != "healthy":
                raise RuntimeError("Running container is unhealthy")

    def validate_pins(self):
        self.updater_references()
        for pin in self.config["required_files"]:
            if digest(pin["path"]) != pin["sha256"]:
                raise RuntimeError("Pinned recovery file missing or changed")
        for image in self.config["rollback_images"]:
            run(["docker", "image", "inspect", image])

    def record_backup(self, kind, files):
        entry = {"version": 1, "kind": kind, "created": time.time(),
                 "files": [{"name": p.name, "sha256": digest(p)} for p in files]}
        write_json(self.managed / (files[0].stem + ".json"), entry)

    def valid_records(self):
        result = []
        seen = set()
        for p in self.managed.glob("*.json"):
            d = json.loads(p.read_text())
            if d.get("version") != 1 or d.get("kind") not in ("daily", "weekly"):
                raise RuntimeError("Invalid managed backup metadata")
            for f in d["files"]:
                if f["name"] in seen or Path(f["name"]).name != f["name"] or digest(self.managed / f["name"]) != f["sha256"]:
                    raise RuntimeError("Managed backup hash mismatch")
                seen.add(f["name"])
            result.append((p, d))
        return result

    def make_backups(self):
        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        files = []
        main = self.managed / (stamp + "-main.dump")
        raw = run(["docker", "exec", self.config["main_db_container"], "sh", "-c",
                   'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'], timeout=300)
        # Parse the full archive without restoring or writing to any database.
        run(["docker", "exec", "-i", self.config["main_db_container"], "pg_restore", "--file=/dev/null"], input=raw, timeout=300)
        main.write_bytes(raw)
        os.chmod(main, 0o600)
        files.append(main)
        pid = run(["systemctl", "show", self.config["one_service"], "-p", "MainPID", "--value"]).decode().strip()
        env = dict(x.split(b"=", 1) for x in Path("/proc", pid, "environ").read_bytes().split(b"\0") if b"=" in x)
        u = urllib.parse.urlsplit(env[b"DATABASE_URL"].decode())
        if u.scheme not in ("postgres", "postgresql"):
            raise RuntimeError("Unexpected ONE database protocol")
        pg_env = dict(os.environ, PGHOST=u.hostname, PGPORT=str(u.port or 5432),
                      PGDATABASE=urllib.parse.unquote(u.path.lstrip("/")),
                      PGUSER=urllib.parse.unquote(u.username or ""), PGPASSWORD=urllib.parse.unquote(u.password or ""))
        ssl = urllib.parse.parse_qs(u.query).get("sslmode")
        if ssl:
            pg_env["PGSSLMODE"] = ssl[0]
        one = self.managed / (stamp + "-one.dump")
        one.write_bytes(run(["/usr/bin/pg_dump", "-Fc"], env=pg_env, timeout=300))
        os.chmod(one, 0o600)
        run(["/usr/bin/pg_restore", "--file=/dev/null", str(one)], timeout=300)
        files.append(one)
        self.record_backup("daily", files)
        weekly = [d for _, d in self.valid_records() if d["kind"] == "weekly"]
        if not weekly or time.time() - max(d["created"] for d in weekly) >= 7 * DAY:
            if shutil.disk_usage(self.managed).free < 3 * 1024**3:
                raise RuntimeError("Insufficient room for a verified full backup; no cleanup")
            archives = []
            for label, source in self.config["weekly_sources"].items():
                archive = self.managed / (stamp + "-" + label + ".tgz")
                temp = archive.with_suffix(".tgz.partial")
                try:
                    run(["tar", "-czf", str(temp), "-C", source, "."], timeout=900)
                    run(["gzip", "-t", str(temp)], timeout=300)
                    os.chmod(temp, 0o600)
                    temp.replace(archive)
                    archives.append(archive)
                except Exception:
                    temp.unlink(missing_ok=True)
                    for completed in archives:
                        completed.unlink(missing_ok=True)
                    raise
            self.record_backup("weekly", archives)

    def backup_gate(self):
        records = self.valid_records()
        for kind, max_age in (("daily", 2 * DAY), ("weekly", 15 * DAY)):
            found = [d for _, d in records if d["kind"] == kind]
            if not found or time.time() - max(d["created"] for d in found) > max_age:
                raise RuntimeError("Fresh verified recovery set required before cleanup")
        return records

    def action(self, kind, target, size, callback):
        if self.used + size > self.config["max_bytes_per_run"] or len(self.report["actions"]) >= 50:
            self.report["skipped"].append({"target": str(target), "reason": "batch byte limit"})
            return
        if self.apply:
            if self.live_ids() != self.baseline:
                raise RuntimeError("Deployment changed during cleanup; stopped")
            callback()
        self.used += size
        self.report["actions"].append({"kind": kind, "target": str(target), "estimated_bytes": size})

    def prune_managed(self, records):
        for kind, keep, days in (("daily", 7, 7), ("weekly", 2, 14)):
            items = [(p, d["created"]) for p, d in records if d["kind"] == kind]
            selected = set(aged(items, keep, days, time.time()))
            for p, d in records:
                if p not in selected:
                    continue
                files = [self.managed / f["name"] for f in d["files"]]
                self.action("managed-backup", p, sum(f.stat().st_size for f in files),
                            lambda paths=files + [p]: [f.unlink() for f in paths])

    def prune_containers(self):
        pattern = r"/supdance-(stage2|delivery|upstream185|regwaffo)-"
        for c in self.containers():
            if c["State"]["Status"] != "exited" or not re.match(pattern, c["Name"]):
                continue
            database = re.search(r"postgres|redis|mysql|mongo|[-_]db(?:[-_\s]|$)", c["Name"] + " " + c["Config"]["Image"])
            if database or any(m["Destination"].startswith(("/var/lib/postgresql", "/var/lib/mysql", "/var/lib/mongo")) or (Path(m["Source"]) / "PG_VERSION").exists() for m in c["Mounts"]):
                continue
            finished = dt.datetime.fromisoformat(c["State"]["FinishedAt"].replace("Z", "+00:00"))
            if time.time() - finished.timestamp() < 7 * DAY:
                continue
            self.action("stopped-app-container", c["Name"], 0,
                        lambda name=c["Id"]: run(["docker", "rm", name]))

    def prune_artifacts(self):
        root = Path(self.config["root"])
        groups = [(list((root / "releases").iterdir()), 2, 14)]
        # Only known generated subtrees; never recurse/delete entire backup roots.
        patterns = ["*/candidate-web", "*/candidate-data/plugin-packages/runtime",
                    "*/drill/snapshot/opt/www.supdance.com/backend-data/plugin-packages/runtime"]
        groups += [(list((root / "backups").glob(p)), 0, 7) for p in patterns]
        registry = self.state / "registered.json"
        if registry.exists():
            groups += [([Path(x["path"])], 0, max(7, x["days"])) for x in json.loads(registry.read_text())]
        for paths, keep, days in groups:
            if keep:
                paths = [p for p in paths if p.is_dir() and any((p / i).is_file() for i in ("index.html", "web/index.html", "dist/index.html", "build/index.html"))]
            for p in aged([(p, p.stat().st_mtime) for p in paths if p.exists()], keep, days, time.time()):
                if not safe_artifact(p, [root / "releases", root / "backups"], self.protections()):
                    self.report["skipped"].append({"target": str(p), "reason": "protected reference or data content"})
                    continue
                size = int(run(["du", "-sb", str(p)]).split()[0])
                def remove(path=p):
                    if not safe_artifact(path, [root / "releases", root / "backups"], self.protections()):
                        raise RuntimeError("Artifact acquired a protected reference")
                    shutil.rmtree(path) if path.is_dir() else path.unlink()
                self.action("artifact", p, size, remove)
        zips = [p for p in (root / "backups").glob("backup-*.zip") if re.fullmatch(r"backup-\d{8}-\d{6}\.zip", p.name)]
        for p in aged([(p, p.stat().st_mtime) for p in zips], 2, 7, time.time()):
            if any(overlaps(p, x) for x in self.protections()):
                continue
            with zipfile.ZipFile(p) as archive:
                if set(archive.namelist()) != {"database.dump", "backend-data.tar", "metadata.json"}:
                    self.report["skipped"].append({"target": str(p), "reason": "unknown backup format"})
                    continue
            self.action("expired-full-backup", p, p.stat().st_size, p.unlink)

    def prune_images(self):
        ids = run(["docker", "image", "ls", "-q", "--no-trunc"]).decode().split()
        images = json.loads(run(["docker", "image", "inspect", *sorted(set(ids))])) if ids else []
        pinned = {json.loads(run(["docker", "image", "inspect", p]))[0]["Id"] for p in self.config["rollback_images"]}
        referenced = {c["Image"] for c in self.containers()}
        families = {}
        for image in images:
            tags = image.get("RepoTags") or []
            if not tags or not all(re.match(r"^(ghcr.io/blacklake-go/open-ai-canvas-(backend|web|yingce-agent)|supdance-(canvas|gallery|delivery|stage2)[\w-]*):", t) for t in tags):
                continue
            family = "agent" if any("agent" in t for t in tags) else "web" if any("web" in t for t in tags) else "backend"
            created = dt.datetime.fromisoformat(image["Created"].replace("Z", "+00:00")).timestamp()
            families.setdefault(family, []).append((image, created))
        for entries in families.values():
            selected = aged([(i["Id"], t) for i, t in entries], 2, 14, time.time())
            for i, _ in entries:
                if i["Id"] not in selected or i["Id"] in pinned | referenced:
                    continue
                def remove(image=i):
                    if image["Id"] in {c["Image"] for c in self.containers()}:
                        raise RuntimeError("Image acquired a container reference")
                    run(["docker", "image", "rm", *image["RepoTags"]])
                self.action("unused-image", i["Id"], i["Size"], remove)

    def execute(self):
        self.baseline = self.live_ids()
        self.report["disk_before"] = shutil.disk_usage(self.config["root"])._asdict()
        try:
            self.health()
            self.validate_pins()
            if self.apply and self.backup:
                self.make_backups()
            records = self.backup_gate()
            self.prune_managed(records)
            self.prune_containers()
            self.prune_artifacts()
            self.prune_images()
            self.report["status"] = "success"
        except Exception as error:
            self.report["status"] = "failed"
            self.report["error"] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
        finally:
            try:
                self.health()
                if self.live_ids() != self.baseline:
                    raise RuntimeError("Running container set changed")
                self.report["post_health"] = "passed"
            except Exception:
                self.report["post_health"] = "failed"
                self.report["status"] = "failed"
            disk = shutil.disk_usage(self.config["root"])
            self.report["disk_after"] = disk._asdict()
            # Match df: reserved filesystem blocks are unavailable to applications.
            self.report["disk_used_percent"] = round(disk.used * 100 / (disk.used + disk.free), 1)
            if self.report["status"] == "success" and self.report["disk_used_percent"] >= 85:
                self.report["status"] = "warning"
            self.report["finished"] = dt.datetime.now(dt.timezone.utc).isoformat()
            stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            write_json(self.state / (stamp + "-" + self.report["mode"] + ".json"), self.report)
            write_json(self.state / ("last.json" if self.apply else "last-dry-run.json"), self.report)
            # Only our own old reports, never business logs or backup metadata.
            for p in self.state.glob("????????T??????Z-*.json"):
                if time.time() - p.stat().st_mtime > 30 * DAY:
                    p.unlink()
        print(json.dumps(self.report))
        return 0 if self.report["status"] == "success" else 1


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="/etc/supdance-retention/policy.json")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--backup", action="store_true")
    parser.add_argument("--register", metavar="PATH")
    parser.add_argument("--days", type=int, default=7)
    args = parser.parse_args()
    os.umask(0o077)
    with open("/run/lock/supdance-maintenance.lock", "a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("Another maintenance run is active", file=sys.stderr)
            return 1
        service = Retention(json.loads(Path(args.config).read_text()), args.apply, args.backup)
        if args.register:
            p = Path(args.register).absolute()
            if not safe_artifact(p, [Path(service.config["root"]) / "backups", Path(service.config["root"]) / "releases"], service.protections()):
                raise RuntimeError("Registration rejected: protected reference or data content")
            file = service.state / "registered.json"
            entries = json.loads(file.read_text()) if file.exists() else []
            entries = [x for x in entries if x["path"] != str(p)]
            entries.append({"path": str(p), "days": max(7, args.days)})
            write_json(file, entries)
            print("Artifact registered")
            return 0
        return service.execute()


if __name__ == "__main__":
    sys.exit(main())
