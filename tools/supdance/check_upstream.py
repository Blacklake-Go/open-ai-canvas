#!/usr/bin/env python3
"""SupDance Upstream Sync & Compatibility Analyzer.

Compares the current SupDance baseline (from supdance/config/baseline.json) against
a target upstream Git ref (default: latest stable v* tag, or explicit --target),
analyzes changed files, schema migrations, dependencies, plugin contracts, and
conflicts with SupDance coupled/custom files, and generates UPSTREAM_UPDATE_REPORT.md.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import subprocess
import sys
from typing import Any


def run_git(repo_root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo_root,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr.strip()}")
    return result.stdout.strip()


def parse_semver_key(tag: str) -> tuple[int, ...]:
    cleaned = tag.lstrip("v")
    parts = re.split(r"[.-]", cleaned)
    nums: list[int] = []
    for part in parts:
        if part.isdigit():
            nums.append(int(part))
        else:
            # Prerelease suffix ranks lower than formal release
            nums.append(-1)
    return tuple(nums)


def find_latest_stable_tag(repo_root: Path) -> str:
    raw = run_git(repo_root, "tag", "-l", "v*")
    tags = [
        line.strip()
        for line in raw.splitlines()
        if line.strip() and "-" not in line and ".rc" not in line
    ]
    if not tags:
        raise RuntimeError("No stable v* tags found in repository")
    tags.sort(key=parse_semver_key)
    return tags[-1]


def classify_commits(commits: list[str]) -> dict[str, list[str]]:
    features: list[str] = []
    fixes: list[str] = []
    removals: list[str] = []
    others: list[str] = []
    for line in commits:
        lower = line.lower()
        if "feat(" in lower or "feat:" in lower:
            features.append(line)
        elif "fix(" in lower or "fix:" in lower:
            fixes.append(line)
        elif "revert" in lower or "remove" in lower or "删除" in line or "移除" in line:
            removals.append(line)
        else:
            others.append(line)
    return {
        "features": features,
        "fixes": fixes,
        "removals": removals,
        "others": others,
    }


def analyze_diff(
    repo_root: Path,
    base_ref: str,
    target_ref: str,
    baseline_cfg: dict[str, Any],
) -> dict[str, Any]:
    base_sha = run_git(repo_root, "rev-parse", f"{base_ref}^{{commit}}")
    target_sha = run_git(repo_root, "rev-parse", f"{target_ref}^{{commit}}")
    merge_base = run_git(repo_root, "merge-base", base_sha, target_sha)

    commits_raw = run_git(repo_root, "log", "--oneline", f"{base_sha}..{target_sha}")
    commits = [c for c in commits_raw.splitlines() if c.strip()]

    diff_status_raw = run_git(repo_root, "diff", "--name-status", base_sha, target_sha)
    changed_files: list[tuple[str, str]] = []
    renamed_or_deleted: list[str] = []
    for line in diff_status_raw.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        status = parts[0]
        path = parts[-1]
        changed_files.append((status, path))
        if status.startswith(("D", "R")):
            renamed_or_deleted.append(f"{status}\t{' -> '.join(parts[1:])}")

    changed_paths = {path for _, path in changed_files}
    coupled_files = set(baseline_cfg.get("coupledUpstreamFiles", []))
    direct_conflicts = sorted(changed_paths & coupled_files)

    db_changes = sorted(
        p for p in changed_paths
        if p.startswith(("backend/internal/database/", "backend/internal/model/"))
        or "backend-database.mdx" in p
    )
    api_changes = sorted(
        p for p in changed_paths
        if p.startswith(("backend/internal/handler/", "web/src/services/api/"))
        or "openapi" in p
        or "http-api.mdx" in p
    )
    plugin_changes = sorted(
        p for p in changed_paths
        if p.startswith(("web/src/lib/plugins/", "backend/internal/protocol/", "plugin-packages/"))
        or "plugin_management.go" in p
        or "protocol_plugins.go" in p
    )
    dep_changes = sorted(
        p for p in changed_paths
        if p in {"web/package.json", "web/bun.lock", "backend/go.mod", "backend/go.sum"}
    )
    deploy_ci_changes = sorted(
        p for p in changed_paths
        if p.startswith((".github/workflows/", "scripts/", "docker"))
        or p.endswith(("Dockerfile", ".yml", "nginx.conf"))
    )
    route_theme_changes = sorted(
        p for p in changed_paths
        if p in {"web/src/router.tsx", "web/src/lib/skin-themes.ts", "web/src/lib/app-theme.ts"}
    )

    # Risk assessment: LOW / MEDIUM / HIGH / CRITICAL
    risk_level = "LOW"
    risk_reasons: list[str] = []
    if direct_conflicts:
        risk_level = "HIGH"
        risk_reasons.append(f"直接修改了 SupDance 耦合文件: {', '.join(direct_conflicts)}")
    if db_changes:
        risk_level = "HIGH" if risk_level != "CRITICAL" else risk_level
        risk_reasons.append(f"涉及数据库 Schema 或 Model 变更 ({len(db_changes)} 个文件)")
    if route_theme_changes or plugin_changes:
        if risk_level == "LOW":
            risk_level = "MEDIUM"
        risk_reasons.append("涉及路由、皮肤令牌或插件宿主契约变更，需验证适配器兼容性")
    if dep_changes or deploy_ci_changes:
        if risk_level == "LOW" and len(commits) > 0:
            risk_level = "MEDIUM"
        risk_reasons.append("涉及依赖锁文件、Docker Compose 或 CI 构建流程变更")
    if not commits:
        risk_reasons.append("当前基线已与目标版本完全一致，无需升级")

    return {
        "base_ref": base_ref,
        "base_sha": base_sha,
        "target_ref": target_ref,
        "target_sha": target_sha,
        "merge_base": merge_base,
        "commits": commits,
        "classified": classify_commits(commits),
        "changed_count": len(changed_files),
        "direct_conflicts": direct_conflicts,
        "db_changes": db_changes,
        "api_changes": api_changes,
        "plugin_changes": plugin_changes,
        "dep_changes": dep_changes,
        "deploy_ci_changes": deploy_ci_changes,
        "route_theme_changes": route_theme_changes,
        "renamed_or_deleted": renamed_or_deleted,
        "risk_level": risk_level,
        "risk_reasons": risk_reasons,
    }


def render_markdown_report(analysis: dict[str, Any], latest_stable_tag: str, upstream_main_sha: str) -> str:
    c = analysis["classified"]
    has_updates = len(analysis["commits"]) > 0
    recommend = (
        "当前已处于目标版本，无需执行合并升级"
        if not has_updates
        else (
            "建议在独立 integration 分支验证并解决耦合冲突后再申请合并"
            if analysis["risk_level"] in {"HIGH", "CRITICAL"}
            else "建议创建 integration 分支运行完整 CI 后合并"
        )
    )

    def fmt_list(items: list[str], empty_msg: str = "无") -> str:
        if not items:
            return f"- {empty_msg}"
        return "\n".join(f"- `{item}`" for item in items[:25]) + (
            f"\n- ...（共 {len(items)} 项）" if len(items) > 25 else ""
        )

    return f"""# SupDance 上游版本升级评估报告 (UPSTREAM_UPDATE_REPORT)

## 1. 版本基线与目标概览

| 维度 | 值 |
| --- | --- |
| SupDance 当前已集成上游版本 | `{analysis["base_ref"]}` (`{analysis["base_sha"]}`) |
| 本次评估目标上游版本 | `{analysis["target_ref"]}` (`{analysis["target_sha"]}`) |
| 上游最新正式 Release | `{latest_stable_tag}` |
| 上游开发分支 (`upstream/main`) 最新 Commit | `{upstream_main_sha}` |
| 共同祖先 (Merge Base) | `{analysis["merge_base"]}` |
| 相差提交数量 | `{len(analysis["commits"])}` |
| 变更文件数量 | `{analysis["changed_count"]}` |
| **综合升级风险等级** | **{analysis["risk_level"]}** |
| **升级建议** | {recommend} |

## 2. 变更分类摘要

### 新增功能 (Features)
{fmt_list(c["features"])}

### Bug 修复 (Fixes)
{fmt_list(c["fixes"])}

### 删除或回退功能 (Removals / Reverts)
{fmt_list(c["removals"])}

### 其他变更 (Chores / Docs / Refactor)
{fmt_list(c["others"])}

## 3. 专项兼容性与冲突检查

### 3.1 与 SupDance 自定义/耦合模块的直接冲突
{fmt_list(analysis["direct_conflicts"], "无直接文件重叠冲突")}

### 3.2 数据库迁移与 Schema 变化
{fmt_list(analysis["db_changes"], "无数据库迁移或 Model 文件变化")}

### 3.3 API 合同变化
{fmt_list(analysis["api_changes"], "无核心 API 路由或客户端请求合同变化")}

### 3.4 插件合同变化 (`.yingce-plugin` / `apiVersion`)
{fmt_list(analysis["plugin_changes"], "无插件宿主合同变化，SupDance 插件保持兼容")}

### 3.5 依赖与锁文件变化
{fmt_list(analysis["dep_changes"], "无前后端依赖锁文件变化")}

### 3.6 部署配置与 CI 变化
{fmt_list(analysis["deploy_ci_changes"], "无部署编排或 CI 工作流变化")}

### 3.7 关键文件改名或删除
{fmt_list(analysis["renamed_or_deleted"], "无文件改名或删除")}

## 4. 风险判定依据与预计影响范围

{fmt_list(analysis["risk_reasons"])}

## 5. 标准集成操作流程

1. 创建集成分支：`bash tools/supdance/prepare_integration.sh {analysis["target_ref"]}`
2. 若存在冲突，优先保留上游安全/Bug 修复与 SupDance 连接器/扩展能力，**严禁整文件无差别使用 `--ours` 或 `--theirs`**。
3. 运行验证：`cd web && bun run typecheck && bun run lint && bun test` 以及 `cd backend && go test ./...`。
4. 通过 PR 提交人工审核，禁止自动合并到 `supdance/main` 或直接改动生产服务器。
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze upstream updates for SupDance Canvas")
    parser.add_argument(
        "--target",
        default="",
        help="Target git ref to compare against (default: latest stable v* tag)",
    )
    parser.add_argument(
        "--include-unreleased-main",
        action="store_true",
        help="Compare against upstream/main instead of latest stable release tag",
    )
    parser.add_argument(
        "--output",
        default="UPSTREAM_UPDATE_REPORT.md",
        help="Output markdown report path (relative to repo root or absolute)",
    )
    parser.add_argument(
        "--json-output",
        default="",
        help="Optional JSON summary output path",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    baseline_path = repo_root / "supdance" / "config" / "baseline.json"
    if not baseline_path.is_file():
        print(f"Missing baseline config: {baseline_path}", file=sys.stderr)
        return 1

    baseline_cfg = json.loads(baseline_path.read_text(encoding="utf-8"))
    base_ref = baseline_cfg["upstreamBaseline"]["tag"]
    latest_stable_tag = find_latest_stable_tag(repo_root)

    try:
        upstream_main_sha = run_git(repo_root, "rev-parse", "upstream/main")
    except RuntimeError:
        upstream_main_sha = "unverified (upstream/main not fetched)"

    if args.target:
        target_ref = args.target
    elif args.include_unreleased_main:
        target_ref = "upstream/main"
    else:
        target_ref = latest_stable_tag

    analysis = analyze_diff(repo_root, base_ref, target_ref, baseline_cfg)
    report_md = render_markdown_report(analysis, latest_stable_tag, upstream_main_sha)

    out_path = Path(args.output)
    if not out_path.is_absolute():
        out_path = repo_root / out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(report_md, encoding="utf-8")

    if args.json_output:
        json_path = Path(args.json_output)
        if not json_path.is_absolute():
            json_path = repo_root / json_path
        json_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(json.dumps(analysis, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "base": analysis["base_ref"],
                "target": analysis["target_ref"],
                "latestStableRelease": latest_stable_tag,
                "upstreamMainCommit": upstream_main_sha,
                "commitCount": len(analysis["commits"]),
                "changedFiles": analysis["changed_count"],
                "directConflicts": analysis["direct_conflicts"],
                "riskLevel": analysis["risk_level"],
                "reportPath": str(out_path.relative_to(repo_root) if out_path.is_relative_to(repo_root) else out_path),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
