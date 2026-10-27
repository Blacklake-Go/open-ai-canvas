# SupDance Canvas — 上游同步与升级工作流 (UPSTREAM_SYNC.md)

## 1. 版本检查机制

仓库内置 [`tools/supdance/check_upstream.py`](../../tools/supdance/check_upstream.py) 与 GitHub Actions 工作流 [`.github/workflows/supdance-upstream-sync.yml`](../../.github/workflows/supdance-upstream-sync.yml)。

### 本地手动检查命令

```bash
# 1. 拉取上游最新标签与分支
git fetch --tags upstream
git fetch upstream main

# 2. 检查最新正式 Release (默认策略) 并生成 UPSTREAM_UPDATE_REPORT.md
python3 tools/supdance/check_upstream.py --output UPSTREAM_UPDATE_REPORT.md

# 3. 预览上游开发分支 (upstream/main) 的未发布变更
python3 tools/supdance/check_upstream.py --include-unreleased-main --output .local/unreleased_main_report.md
```

## 2. 风险分级规则

`check_upstream.py` 根据变更文件自动计算风险等级：

- **`LOW`**：无直接冲突，不涉及路由、主题、插件契约或数据库变更。
- **`MEDIUM`**：涉及前端路由 (`web/src/router.tsx`)、皮肤令牌 (`web/src/lib/skin-themes.ts`)、插件契约、依赖锁文件或构建/部署脚本变化，需验证兼容层适配器。
- **`HIGH`**：直接修改了 SupDance 耦合的核心文件（列于 `supdance/config/baseline.json` 的 `coupledUpstreamFiles`），或包含 `backend/internal/database/` / `backend/internal/model/` 数据库 Schema 变更。
- **`CRITICAL`**：可能破坏数据完整性或覆盖生产环境持久化/自定义挂载的变更。

## 3. 标准合并与集成流程

每次集成上游新 Release（例如 `v1.7.2`）时，严格按以下 12 步执行：

1. **获取并验证标签**：`git fetch --tags upstream && git rev-parse v1.7.2^{commit}`。
2. **检查本地状态**：`git status --short`，确保无未保存修改。
3. **快进更新干净镜像分支**：
   ```bash
   git checkout main
   git merge --ff-only v1.7.2
   ```
4. **创建独立集成分支并生成报告**：
   ```bash
   bash tools/supdance/prepare_integration.sh v1.7.2
   ```
   该脚本会从 `supdance/main` 切出 `integration/upstream-v1.7.2` 并执行标准 `git merge`。
5. **冲突分析与解决**：
   - 使用 `git merge-base supdance/main v1.7.2` 确认共同祖先。
   - 对耦合文件（如 `canvas-cloud-agent-panel.tsx`）逐块对比上游变更与 SupDance 连接器逻辑，**严禁整文件使用 `git checkout --ours` 或 `--theirs`**，严禁为完成合并而删除 SupDance 功能。
   - 若遇到无法安全解决的冲突，保留 `integration/upstream-v1.7.2` 分支现场并终止合并。
6. **更新兼容层与基线配置**：更新 [`supdance/config/baseline.json`](../../supdance/config/baseline.json) 与 [`UPSTREAM_BASELINE.md`](./UPSTREAM_BASELINE.md)。
7. **运行前端测试门禁**：
   ```bash
   cd web
   bun install --frozen-lockfile
   bun run typecheck
   bun run lint
   bun test
   bun run build
   ```
8. **运行后端测试门禁**：
   ```bash
   cd backend
   go test ./...
   ```
9. **提交 Pull Request**：向 `supdance/main` 发起 PR，附上 `UPSTREAM_UPDATE_REPORT.md` 测试结果，经人工审核通过后合并。
10. **打正式发布标签**：合并后在 `supdance/main` 创建附注标签 `supdance/vYYYY.MM.DD.N`。
