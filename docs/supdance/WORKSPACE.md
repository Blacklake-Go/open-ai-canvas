# SupDance Canvas — 工作区与开发维护规范 (WORKSPACE.md)

## 1. 产品定位与仓库关系

- **产品名称**：SupDance Canvas（线上主入口：`https://y.supdance.com` -> `https://one.supdance.com`）
- **上游仓库 (`upstream`)**：`https://github.com/ddcat-ai/open-ai-canvas.git`
- **自有仓库 (`origin`)**：`https://github.com/Blacklake-Go/open-ai-canvas.git`
- **架构策略**：`Upstream Core + SupDance Extensions + Compatibility Adapters`

## 2. 开发环境要求与多端切换支持

支持在 macOS、Windows (PowerShell) 及 Codex 云端/本地工作区之间无缝切换：

| 工具 | 版本要求 | 说明 |
| --- | --- | --- |
| **Bun** | `1.3.9` (精确匹配 `web/package.json` 的 `packageManager`) | **严禁**使用 `npm`、`pnpm` 或 `yarn` 安装 `web/` 依赖或生成多余锁文件（CI 有 `package-manager-lockfile.test.ts` 门禁） |
| **Go** | `1.25.0+` | 后端构建与测试 |
| **Python** | `3.10+` | 运行 `tools/supdance/check_upstream.py` 与上游重叠审计脚本 |
| **Docker Compose** | `v2+` | 容器化联调与生产镜像构建 |

### 跨平台工作区切换步骤

```bash
# 1. 克隆自有仓库并配置 upstream
git clone https://github.com/Blacklake-Go/open-ai-canvas.git
cd open-ai-canvas
git remote add upstream https://github.com/ddcat-ai/open-ai-canvas.git
git fetch --tags upstream
git fetch --tags origin

# 2. 切换到 SupDance 长期产品主分支
git checkout supdance/main

# 3. 准备 Git 忽略的本地开发数据与缓存目录
mkdir -p .local/project-workbench-debug .local/cache/go-build .local/cache/go-mod
```

## 3. Git 分支模型与职责

```text
upstream/main
    |
    v
origin/main (干净镜像分支，只做 fast-forward 同步)
    |
    +----------------------+
    |                      |
    v                      v
supdance/main           integration/upstream-vX.Y.Z
    |                      ^
    |                      |
    +------ merge ---------+
    |
    +-- feature/ui-*
    +-- feature/plugin-*
    +-- feature/backend-*
    +-- hotfix/*
    |
    v
tested release (supdance/vYYYY.MM.DD.N)
    |
    v
production
```

- **`upstream/main`**：原作者开发分支，只读，禁止推送。
- **`origin/main`**：与上游保持同步的干净镜像分支，不在其上直接提交 SupDance 业务代码。
- **`supdance/main`**：SupDance 长期产品主分支，合并所有经过验证的自定义功能与上游升级集成分支。
- **`feature/*` / `hotfix/*`**：从 `supdance/main` 切出，独立开发具体功能或修复。
- **`integration/upstream-vX.Y.Z`**：使用 `bash tools/supdance/prepare_integration.sh vX.Y.Z` 从 `supdance/main` 创建，专门用于集成并验证上游正式 Release。
- **发布标签 (`supdance/vYYYY.MM.DD.N`)**：使用附注标签（Annotated Tag）记录上游基线 Commit、SupDance Commit 及生产镜像 Digest。

## 4. AI 编程工作区永久规则

为避免覆盖原作者的根 `AGENTS.md`，上游规则完整保留在根 [`AGENTS.md`](../../AGENTS.md)，SupDance 专属规则由本文档与 [`ARCHITECTURE.md`](./ARCHITECTURE.md) 承载：

### 每次开发前必须执行

1. 检查 `git status --short` 与当前分支（严禁在 `origin/main` 直接开发）。
2. 确认任务目标，阅读 [`CUSTOMIZATIONS.md`](./CUSTOMIZATIONS.md) 与 [`UPSTREAM_BASELINE.md`](./UPSTREAM_BASELINE.md)。
3. 判断新需求是否可以通过 `.yingce-plugin` (`yingce.plugin/v2`) 或 `web/src/supdance/`、`backend/internal/supdance/` 独立扩展实现。
4. 若不可避免需要修改上游核心文件，必须保持最小侵入并在 `web/src/supdance/adapters/compatibility.ts` 的 `SUPDANCE_UPSTREAM_PATCH_REGISTRY` 及 [`CUSTOMIZATIONS.md`](./CUSTOMIZATIONS.md) 中登记。

### 每次开发后必须执行

1. 检查 `git diff`，确认无无关重构、无密钥泄露、无多余锁文件。
2. 对修改过的前端文件执行 Prettier 检查（`cd web && bun scripts/check-changed-formatting.mjs`）。
3. 运行前端验证：`cd web && bun run typecheck && bun run lint && bun test`。
4. 运行后端验证：`cd backend && go test ./...`。
5. 更新 [`CUSTOMIZATIONS.md`](./CUSTOMIZATIONS.md) 与 [`CHANGELOG.md`](./CHANGELOG.md)，如实区分“已运行测试验证”与“未验证”。
