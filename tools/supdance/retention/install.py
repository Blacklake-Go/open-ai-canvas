#!/usr/bin/env python3
"""Install runtime updates; preserve existing host-owned policy and systemd units."""

import argparse
import fcntl
import json
import os
from pathlib import Path
import subprocess

from verify_installation import FILES, MANIFEST, checksum, verify


def install(root, source):
    policy = root / FILES[0]
    if not policy.is_file() or policy.is_symlink():
        raise RuntimeError("Provision the private policy.json first; installer never creates or replaces it")
    json.loads(policy.read_text())
    if (root / MANIFEST).exists():
        verify(root)
    lock = root / "run/lock/supdance-maintenance.lock"
    lock.parent.mkdir(parents=True, exist_ok=True)
    with lock.open("a") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        runtime = root / "usr/local/lib/supdance-retention"
        runtime.mkdir(parents=True, exist_ok=True)
        for name in ["retention.py", "verify_installation.py"]:
            target = runtime / name
            temporary = target.with_suffix(".next")
            temporary.write_bytes((source / name).read_bytes())
            temporary.chmod(0o755)
            temporary.replace(target)
        for name in ["supdance-retention.service", "supdance-retention.timer"]:
            target = root / "etc/systemd/system" / name
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.is_symlink():
                raise RuntimeError("Refusing a systemd unit symlink")
            if not target.exists():
                target.write_bytes((source / name).read_bytes())
                target.chmod(0o644)
        guard = root / FILES[3]
        guard.parent.mkdir(parents=True, exist_ok=True)
        if not guard.exists():
            guard.write_text("[Service]\nExecStartPre=/usr/bin/python3 /usr/local/lib/supdance-retention/verify_installation.py\n")
            guard.chmod(0o644)
        manifest = root / MANIFEST
        if not manifest.exists():
            value = {"version": 1, "files": {name: checksum(root / name) for name in FILES}}
            with manifest.open("x") as out:
                json.dump(value, out, indent=2)
                out.write("\n")
            manifest.chmod(0o600)
        verify(root)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("/"), help="Offline staging root for deployment tests")
    args = parser.parse_args()
    root = args.root.resolve()
    os.umask(0o077)
    if root == Path("/") and os.geteuid() != 0:
        raise RuntimeError("Root required for a live installation")
    install(root, Path(__file__).resolve().parent)
    if root == Path("/"):
        subprocess.run(["systemctl", "daemon-reload"], check=True)
        subprocess.run(["systemctl", "enable", "--now", "supdance-retention.timer"], check=True)
    print("Retention runtime installed; existing policy and units preserved; protection verified")


if __name__ == "__main__":
    main()
