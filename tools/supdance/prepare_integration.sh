#!/usr/bin/env bash
# SupDance 上游集成分支安全初始化脚本。
#
# 用法：
#   bash tools/supdance/prepare_integration.sh v1.7.2
#   bash tools/supdance/prepare_integration.sh v1.7.1 --dry-run
#
# 安全约束：
# 1. 检查工作树是否干净，拒绝在有未保存改动时直接合并。
# 2. 从 supdance/main 创建独立 integration/upstream-<target> 分支。
# 3. 先生成 UPSTREAM_UPDATE_REPORT.md。
# 4. 使用标准 git merge --no-commit --no-ff 预演或执行合并，绝不使用 ours/theirs 整文件覆盖。
# 5. 遇到冲突时保留集成分支现场并退出，供人工按共同祖先分析解决。

set -Eeuo pipefail

TARGET_REF="${1:-}"
MODE="${2:-}"

if [[ -z "$TARGET_REF" ]]; then
    echo "用法: bash tools/supdance/prepare_integration.sh <upstream-tag-or-sha> [--dry-run]" >&2
    exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
    echo "错误: 当前 Git 工作树存在未提交的跟踪文件修改，请先 commit 或 stash 后再创建集成分支。" >&2
    exit 1
fi

if ! git rev-parse --verify "${TARGET_REF}^{commit}" >/dev/null 2>&1; then
    echo "错误: 找不到目标版本或提交 '${TARGET_REF}'，请先执行 git fetch --tags upstream。" >&2
    exit 1
fi

SAFE_NAME="$(printf '%s' "$TARGET_REF" | tr '/:' '--')"
INTEGRATION_BRANCH="integration/upstream-${SAFE_NAME}"

if [[ "$MODE" == "--dry-run" ]]; then
    mkdir -p .local
    DRY_RUN_REPORT=".local/UPSTREAM_UPDATE_REPORT.${SAFE_NAME}.md"
    echo "==> 1. [Dry-run] 生成上游版本升级评估报告 (目标: ${TARGET_REF} -> ${DRY_RUN_REPORT})"
    python3 tools/supdance/check_upstream.py --target "$TARGET_REF" --output "$DRY_RUN_REPORT"
    echo "==> Dry-run 模式完成：评估报告已输出至 ${DRY_RUN_REPORT}，未污染当前分支跟踪文件，未切换分支或执行合并。"
    exit 0
fi

BASE_BRANCH="supdance/main"
if ! git show-ref --verify --quiet "refs/heads/${BASE_BRANCH}"; then
    echo "错误: 本地不存在 ${BASE_BRANCH} 分支。" >&2
    exit 1
fi

echo "==> 1. 从 ${BASE_BRANCH} 创建集成分支 ${INTEGRATION_BRANCH}"
git checkout -B "$INTEGRATION_BRANCH" "$BASE_BRANCH"

mkdir -p .local
TEMP_REPORT=".local/UPSTREAM_UPDATE_REPORT.${SAFE_NAME}.md"
echo "==> 2. 生成上游版本升级评估报告 (目标: ${TARGET_REF})"
python3 tools/supdance/check_upstream.py --target "$TARGET_REF" --output "$TEMP_REPORT"

echo "==> 3. 合并上游版本 ${TARGET_REF}（禁用整文件 ours/theirs 策略）"
if git merge --no-edit "$TARGET_REF"; then
    cp "$TEMP_REPORT" UPSTREAM_UPDATE_REPORT.md
    echo "==> 合并成功，无直接 Git 文本冲突，且已更新 UPSTREAM_UPDATE_REPORT.md。请继续运行前后端回归测试后再提交 PR。"
else
    cp "$TEMP_REPORT" UPSTREAM_UPDATE_REPORT.md || true
    echo "⚠️ 检测到合并冲突！已保留 ${INTEGRATION_BRANCH} 分支现场与 UPSTREAM_UPDATE_REPORT.md。" >&2
    echo "请使用 git status 查看冲突文件，结合共同祖先 (git merge-base ${BASE_BRANCH} ${TARGET_REF}) 手工解决，严禁删除 SupDance 自定义功能。" >&2
    exit 2
fi
