"""Build the distributable metadata package for the host-integrated social plugin."""

import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile


def build_package(output_dir):
    root = Path(__file__).resolve().parents[2]
    plugin_dir = root / "supdance/plugins/supdance-social-auth"
    source = json.loads((plugin_dir / "manifest.json").read_text())
    readme = (plugin_dir / "README.md").read_bytes()
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip()
    manifest = {
        "apiVersion": source["apiVersion"],
        "id": source["id"],
        "version": source["version"],
        "name": source["name"],
        "author": source["author"],
        "description": "社交登录配置、入站和身份绑定；需配套 SupDance 宿主实现及真实服务商验收。",
        "documentation": readme.decode(),
        "enabled": False,
        "runtime": {"backend": "declarative"},
        "installable": True,
        "surfaces": source["surfaces"],
        "permissions": source["permissions"],
        "contributes": source["contributes"],
    }
    requirements = {
        "pluginId": source["id"],
        "pluginVersion": source["version"],
        "sourceCommit": commit,
        "requiredImplementationCommit": commit,
        "requiredHostBuild": f"1.7.4-supdance-social-{source['version']}",
        "packageUpdates": "plugin-center metadata only",
        "fullUpgrade": "Deploy the matching host backend and web implementation; uploading this package cannot upgrade host code.",
        "credentialsIncluded": False,
    }
    def encode(value):
        return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()
    files = {
        "manifest.json": encode(manifest),
        "README.md": readme,
        "docs/host-requirements.json": encode(requirements),
    }
    output_dir = output_dir.resolve()
    if output_dir == root or root in output_dir.parents:
        raise ValueError("产物须保存在仓库外，避免将构建产物提交到代码库")
    output_dir.mkdir(parents=True, exist_ok=True)
    package = output_dir / f'{source["id"]}-{source["version"]}.yingce-plugin'
    with zipfile.ZipFile(package, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in sorted(files.items()):
            entry = zipfile.ZipInfo(name, date_time=(2026, 11, 3, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, content)
    with zipfile.ZipFile(package) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == set(files)
    checksums = {
        "package": package.name,
        "sha256": hashlib.sha256(package.read_bytes()).hexdigest(),
        "bytes": package.stat().st_size,
        "sourceCommit": commit,
        "files": {name: hashlib.sha256(content).hexdigest() for name, content in sorted(files.items())},
    }
    (output_dir / (package.name + ".sha256.json")).write_bytes(encode(checksums))
    (output_dir / "DEPLOYMENT.md").write_bytes(readme)
    print(json.dumps(checksums, ensure_ascii=False, indent=2))
    return package


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", required=True, type=Path)
    build_package(parser.parse_args().output_dir)
