#!/usr/bin/env python3
"""Verify host-local retention settings without reading secrets into logs."""

import argparse
import hashlib
import json
from pathlib import Path
import sys

MANIFEST = "etc/supdance-retention/deployment-protection.json"
FILES = ["etc/supdance-retention/policy.json",
         "etc/systemd/system/supdance-retention.service",
         "etc/systemd/system/supdance-retention.timer",
         "etc/systemd/system/supdance-retention.service.d/deployment-protection.conf"]


def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(root=Path("/")):
    manifest = root / MANIFEST
    data = json.loads(manifest.read_text())
    if data.get("version") != 1 or set(data.get("files", {})) != set(FILES):
        raise RuntimeError("Invalid deployment protection manifest")
    for name, expected in data["files"].items():
        path = root / name
        if path.is_symlink() or checksum(path) != expected:
            raise RuntimeError(f"Protected configuration changed: {name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("/"))
    args = parser.parse_args()
    try:
        verify(args.root.resolve())
    except (OSError, ValueError, RuntimeError) as error:
        print(f"Retention deployment protection failed: {error}", file=sys.stderr)
        sys.exit(1)
    print("Retention deployment protection passed")
