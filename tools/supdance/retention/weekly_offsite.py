"""Verified encrypted transport for weekly recovery archives."""

import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import resource
import shutil
import subprocess
import tempfile
import uuid


TRANSPORT = Path(__file__).with_name("cos-offsite")
KEY_DIR = Path("/etc/supdance-retention/offsite")
GPG_HOME = Path("/var/lib/supdance-retention/offsite/weekly-gnupg")
PREFIX = "ops-backups/supdance-prod/weekly/"
GIB = 1024**3


class HashingReader:
    def __init__(self, stream):
        self.stream = stream
        self.sha = hashlib.sha256()

    def read(self, size=-1):
        data = self.stream.read(size)
        self.sha.update(data)
        return data


def archive_digest(stream):
    reader = HashingReader(stream)
    with gzip.GzipFile(fileobj=reader) as archive:
        while archive.read(8 * 1024**2):
            pass
    return reader.sha.hexdigest()


def command(*args):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=1200)
    if result.returncode:
        raise RuntimeError(f"{Path(args[0]).name} failed (exit {result.returncode})")
    return json.loads(result.stdout)


def gpg_args():
    GPG_HOME.mkdir(mode=0o700, parents=True, exist_ok=True)
    return ["gpg", "--homedir", str(GPG_HOME), "--no-options", "--no-symkey-cache",
            "--batch", "--yes", "--no-tty", "--pinentry-mode", "loopback",
            "--passphrase-file", str(KEY_DIR / "archive.key")]


def validate(entry):
    remote = entry["offsite"]
    name = entry["name"]
    pattern = re.escape(PREFIX) + r"[a-f0-9]{32}/" + re.escape(name + ".gpg")
    if (not re.fullmatch(pattern, remote["key"]) or not re.fullmatch(r"[a-f0-9]{64}", entry["sha256"])
            or not isinstance(remote["size"], int) or remote["size"] < 1):
        raise RuntimeError("Invalid weekly offsite archive reference")
    expected = {"size": remote["size"], "private": True, "expirationHeader": False}
    if command(TRANSPORT, "head", remote["key"]) != expected:
        raise RuntimeError("Weekly offsite archive metadata mismatch")


def publish_manifest(path, entry):
    if not re.fullmatch(r"\d{8}T\d{6}Z-[a-z][a-z0-9-]*\.json", path.name):
        raise RuntimeError("Invalid weekly offsite manifest name")
    key = PREFIX + "manifests/" + path.name
    with tempfile.TemporaryDirectory(prefix=".weekly-manifest-", dir=path.parent) as directory:
        staged = Path(directory) / path.name
        staged.write_text(json.dumps(entry, indent=2) + "\n")
        if command(TRANSPORT, "put", key, staged) != {"key": key, "size": staged.stat().st_size, "private": True}:
            raise RuntimeError("Unexpected weekly offsite manifest receipt")
        if command(TRANSPORT, "get", key) != entry:
            raise RuntimeError("Weekly offsite manifest readback mismatch")


def verify_remote(entry, output=None):
    validate(entry)
    with subprocess.Popen([TRANSPORT, "get", entry["offsite"]["key"]], stdout=subprocess.PIPE) as download:
        args = [*gpg_args(), "--decrypt", "--output", str(output) if output else "-"]
        with subprocess.Popen(args, stdin=download.stdout, stdout=subprocess.PIPE) as decrypt:
            download.stdout.close()
            try:
                if output:
                    decrypt.communicate()
                    with output.open("rb") as stream:
                        digest = archive_digest(stream)
                else:
                    digest = archive_digest(decrypt.stdout)
            except Exception:
                decrypt.kill()
                download.kill()
                raise
            if decrypt.wait() or download.wait() or digest != entry["sha256"]:
                raise RuntimeError("Weekly offsite archive readback hash mismatch")


def store(name, staging, *, source=None, existing=None):
    if not re.fullmatch(r"\d{8}T\d{6}Z-[a-z][a-z0-9-]*\.tgz", name) or (source is None) == (existing is None):
        raise RuntimeError("Invalid weekly archive input")
    limit = min(4 * GIB, shutil.disk_usage(staging).free - 3 * GIB)
    if limit < GIB:
        raise RuntimeError("Insufficient staging space for weekly offsite backup")

    def guard_disk():
        resource.setrlimit(resource.RLIMIT_FSIZE, (limit, limit))

    with tempfile.TemporaryDirectory(prefix=".weekly-offsite-", dir=staging) as directory:
        encrypted = Path(directory) / "archive.gpg"
        args = [*gpg_args(), "--symmetric", "--cipher-algo", "AES256", "--s2k-digest-algo", "SHA512",
                "--compress-algo", "none", "--output", str(encrypted)]
        if existing is not None:
            subprocess.run([*args, "--", str(existing)], check=True, timeout=1200, preexec_fn=guard_disk)
        else:
            with subprocess.Popen(["tar", "-czf", "-", "-C", source, "."], stdout=subprocess.PIPE) as archive:
                try:
                    subprocess.run(args, stdin=archive.stdout, check=True, timeout=1200, preexec_fn=guard_disk)
                except Exception:
                    archive.kill()
                    raise
                finally:
                    archive.stdout.close()
                if archive.wait():
                    raise RuntimeError("Weekly source changed or could not be archived")
        with subprocess.Popen([*gpg_args(), "--decrypt", "--output", "-", encrypted],
                              stdout=subprocess.PIPE) as local:
            try:
                digest = archive_digest(local.stdout)
            except Exception:
                local.kill()
                raise
            if local.wait():
                raise RuntimeError("Failed to decrypt the staged weekly archive")
        key = PREFIX + uuid.uuid4().hex + "/" + name + ".gpg"
        uploaded = command(TRANSPORT, "put", key, encrypted)
        if uploaded != {"key": key, "size": encrypted.stat().st_size, "private": True}:
            raise RuntimeError("Unexpected weekly offsite upload receipt")
        entry = {"name": name, "sha256": digest, "offsite": {"key": key, "size": uploaded["size"]}}
        verify_remote(entry)
        return entry


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("archive")
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    manifest = json.loads(args.manifest.read_text())
    if manifest.get("version") != 1 or manifest.get("kind") != "weekly":
        raise RuntimeError("Expected a weekly backup manifest")
    entry, = [item for item in manifest["files"] if item["name"] == args.archive]
    if args.destination.exists() or args.destination.is_symlink() or not args.destination.is_absolute():
        raise RuntimeError("Recovery output must be an unused absolute path")
    with tempfile.TemporaryDirectory(prefix=".weekly-restore-", dir=args.destination.parent) as directory:
        staged = Path(directory) / "archive.tgz"
        verify_remote(entry, staged)
        os.link(staged, args.destination)
    print(f"Restored and verified {args.archive}")


if __name__ == "__main__":
    main()
