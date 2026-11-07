"""只读核对 www.supdance.com 的运行版本和宿主机源码候选。不生成发布包。"""

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from collections import deque
from pathlib import Path


SITE = "www.supdance.com"
DOCKER = ["docker", "--host", "unix:///var/run/docker.sock"]
SOURCE_ROOTS = [Path(p) for p in ("/opt", "/srv", "/home/wwwroot/AI/domain/www.supdance.com")]
SOURCE_DIR = re.compile(r"supdance|open-ai-canvas|waffo|yingce|source|snapshot|release|checkout|worktree|candidate|^(src|build|current|v?\d[\w.-]*|[0-9a-f]{7,64})$", re.I)
EXCLUDE_DIR = re.compile(r"backup|secret|credential|postgres|redis|(^|[-_.])(data|db|keys?|uploads?|storage)($|[-_.])", re.I)
SSH_TARGET = re.compile(r"(?:[\w.-]+@)?(?:[a-zA-Z0-9][\w.-]*|\[[a-fA-F0-9:]+\])", re.ASCII)
SHA = re.compile(r"(?:[0-9a-f]{40}|[0-9a-f]{64})")
TARGETS = ("/usr/share/nginx/html", "/opt/canvas-release", "/usr/local/bin/yingce-backend")


def command(args):
    env = {**os.environ, "GIT_OPTIONAL_LOCKS": "0", "GIT_TERMINAL_PROMPT": "0"}
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=10, env=env)
    except FileNotFoundError:
        return None, "命令未安装"
    except (OSError, subprocess.TimeoutExpired):
        return None, "命令超时或无法启动"
    return (result.stdout.strip(), None) if result.returncode == 0 else (None, "读取失败，请核对本机服务与只读权限")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def readiness(base, local=False):
    handlers = [NoRedirect()]
    if local:
        handlers.append(urllib.request.ProxyHandler({}))
    req = urllib.request.Request(base + "/api/health/ready", headers={"Host": SITE, "Accept": "application/json", "Cache-Control": "no-cache"})
    try:
        with urllib.request.build_opener(*handlers).open(req, timeout=6) as resp:
            body = json.loads(resp.read(32768))
        data = body.get("data", body)
        build, schema = data["build"], data["schema"]
        return {"ready": data.get("ready") is True,
                "build": {k: str(build[k])[:160] for k in ("version", "commit", "buildTime") if k in build},
                "schema": {k: schema[k] for k in ("current", "expected", "ready") if k in schema}}
    except (OSError, ValueError, TypeError, KeyError, AttributeError):
        return None


def containers():
    # Read only named fields. In particular never request a complete inspect document.
    fmt = '{{.ID}}\t{{.Label "com.docker.compose.project"}}\t{{.Label "com.docker.compose.service"}}'
    rows, error = command(DOCKER + ["ps", "--filter", "label=com.docker.compose.project", "--format", fmt])
    if error:
        return [], error
    found = []
    for row in rows.splitlines():
        fields = row.split("\t")
        if len(fields) != 3:
            continue
        cid, project, service = fields
        if not re.fullmatch(r"[a-f0-9]{12,64}", cid) or not re.search("supdance|yingce|open-ai-canvas", project, re.I) or service not in {"web", "backend"}:
            continue
        template = ('{{.Image}}\n{{index .Config.Labels "com.docker.compose.project.working_dir"}}\n'
                    '{{range .Mounts}}{{if or ' + " ".join('(eq .Destination "' + p + '")' for p in TARGETS) +
                    '}}{{if .RW}}rw{{else}}ro{{end}}\t{{.Source}}\t{{.Destination}}\n{{end}}{{end}}')
        details, err = command(DOCKER + ["container", "inspect", "--format", template, cid])
        if err or not details:
            return found, err or "容器元数据缺失"
        lines = details.splitlines()
        img = lines[0]
        revision, err = command(DOCKER + ["image", "inspect", "--format", '{{index .Config.Labels "org.opencontainers.image.revision"}}', img])
        item = {"project": project, "service": service, "container": cid, "image_id": img,
                "oci_revision": revision if revision and SHA.fullmatch(revision) else None,
                "working_dir": lines[1] if len(lines) > 1 and lines[1].startswith("/") else None,
                "release_mounts": []}
        for line in lines[2:]:
            mode, sep, rest = line.partition("\t")
            source, sep2, dest = rest.partition("\t")
            if sep and sep2 and dest in TARGETS:
                # Any overlay invalidates inference from the underlying image.
                item["release_mounts"].append({"target": dest, "mode": mode, **({"source": source} if mode == "ro" else {})})
        if service == "web":
            ports, _ = command(DOCKER + ["port", cid, "80/tcp"])
            port = re.search(r"^(?:127\.0\.0\.1|0\.0\.0\.0):([0-9]+)$", ports or "", re.M)
            if port and 0 < int(port[1]) < 65536:
                item["local_readiness"] = readiness("http://127.0.0.1:" + port[1], local=True)
        found.append(item)
    return found, None if found else "在本机 Docker 未发现匹配的 web/backend 项目"


def source_candidates(roots):
    # Bounded names-only search. Do not walk application data, backups or project source trees.
    queue = deque((p, 0) for p in roots)
    visited, repos = set(), []
    while queue and len(visited) < 300:
        path, depth = queue.popleft()
        try:
            if path.is_symlink() or path in visited or not path.is_dir() or EXCLUDE_DIR.search(path.name):
                continue
            visited.add(path)
            if (path / "backend/go.mod").is_file() and (path / "web/package.json").is_file():
                rev = None
                if (path / ".git").exists():
                    rev, _ = command(["git", "-C", str(path), "rev-parse", "--verify", "HEAD"])
                # Also recognize source releases without .git. Never inspect file contents.
                hits = []
                for folder in ("backend/internal/app", "backend/internal/supdance", "plugin-packages", "web/src/supdance/plugins"):
                    directory = path / folder
                    if directory.is_dir() and not directory.is_symlink():
                        hits.extend(str(q.relative_to(path)) for q in directory.iterdir()
                                    if "waffo" in q.name.lower() and not q.name.startswith(".") and not q.is_symlink())
                repos.append({"path": str(path), "head": rev if rev and SHA.fullmatch(rev) else None,
                              "waffo_named_sources": sorted(hits)[:8]})
                continue
            if depth < 4:
                queue.extend((p, depth + 1) for p in sorted(path.iterdir()) if SOURCE_DIR.search(p.name) and not p.name.startswith("."))
        except OSError:
            continue
    return repos


def classify(public, items, repos):
    build = (public or {}).get("build", {})
    public_sha = build.get("commit", "")
    matched_projects = {c["project"] for c in items if c.get("local_readiness") == public and public and public["ready"] and build.get("commit") and build.get("buildTime")}
    backends = [c for c in items if c["service"] == "backend" and c["project"] in matched_projects]
    verified = set()
    if len(matched_projects) == 1 and len(backends) == 1 and SHA.fullmatch(public_sha) and public_sha == backends[0]["oci_revision"] and not backends[0]["release_mounts"]:
        verified.add(public_sha)
    for repo in repos:
        repo["identity"] = "与线上后端和本机 OCI 一致的提交（工作树仍待核验）" if repo["head"] in verified else "候选，未证实为线上源码"
    return sorted(matched_projects), sorted(verified)


def inspect_host():
    public = readiness("https://" + SITE)
    items, error = containers()
    roots = list(SOURCE_ROOTS)
    for item in items:
        for raw in [item["working_dir"], *(m.get("source") for m in item["release_mounts"])]:
            if not raw:
                continue
            try:
                path = Path(raw).resolve()
            except (OSError, RuntimeError):
                continue
            if not any(base == path or base in path.parents for base in SOURCE_ROOTS) or any(EXCLUDE_DIR.search(s) for s in path.parts):
                continue
            roots.append(path if path.is_dir() else path.parent)
    repos = source_candidates(roots)
    projects, revisions = classify(public, items, repos)
    print(json.dumps({"public_readiness": public, "docker_status": error or "已读取", "containers": items,
                      "same_readiness_projects": projects, "verified_backend_revisions": revisions, "source_candidates": repos,
                      "release_decision": "只读核对不构成发布依据。"
                      + ("提交可进一步验证。" if revisions else "未证实线上后端对应的源码提交。"),
                      "next": ("在部署宿主执行或通过 --ssh 使用已授权的目标，核对本机 Docker 权限。" if error else "") +
                      "核对运行挂载的发布清单、构建来源与本地未提交的 Waffo 改动。取得对应源码后在隔离副本验证支付及音乐流程。"},
                     ensure_ascii=False, indent=2))
    return 0 if not error and any(r["head"] in revisions for r in repos) else 2


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ssh", metavar="目标", help="已授权的 SSH 主机或 user@host，须有已校验的主机密钥")
    args = parser.parse_args()
    if not args.ssh:
        return inspect_host()
    if len(args.ssh) > 255 or args.ssh.startswith("-") or not SSH_TARGET.fullmatch(args.ssh):
        parser.error("SSH 目标格式无效")
    ssh = ["ssh", "-T", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "UpdateHostKeys=no",
           "-o", "ClearAllForwardings=yes", "-o", "ForwardAgent=no", "-o", "ConnectTimeout=8", "--", args.ssh, "python3 -"]
    try:
        return subprocess.run(ssh, input=Path(__file__).read_bytes(), timeout=150).returncode
    except (OSError, subprocess.TimeoutExpired):
        print("SSH 未能启动或超时，请核对已授权的主机别名和网络。", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
