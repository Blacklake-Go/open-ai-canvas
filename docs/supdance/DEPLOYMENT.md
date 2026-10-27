# SupDance Canvas — 生产部署规范与在线更新防护 (DEPLOYMENT.md)

## 1. 生产环境真实架构 (`43.133.253.76`)

经只读审计确认，生产环境 (`https://y.supdance.com` -> `https://one.supdance.com`) 当前采用 **Docker Compose 受管镜像 + SupDance 前端静态构建挂载** 的混合部署模式：

- **Compose 编排目录**：`/opt/y-supdance-canvas/docker-compose.deploy.yml`
- **环境配置文件**：`/opt/y-supdance-canvas/.env`（权限 `0600`）
- **监听端口与反向代理**：`y-supdance-canvas-web-1` 监听宿主机 `127.0.0.1:3240`，由宿主机 Nginx (`/home/wwwroot/AI/vhost/y.supdance.com-https.conf`) 承担 HTTPS 卸载与 WebSocket/SSE 反向代理。
- **持久化数据路径**：
  - PostgreSQL 17 数据卷：`/opt/open-ai-canvas-y-supdance/postgres-data`
  - Redis 7.4 数据卷：`/opt/open-ai-canvas-y-supdance/redis-data`
  - Backend 资源与配置数据卷 (`/data`)：`/opt/open-ai-canvas-y-supdance/backend-data`
  - Web 静态发布目录 (`/usr/share/nginx/html`)：`/home/wwwroot/AI/domain/y.supdance.com/web`
  - SupDance 定制前端构建产物挂载 (`/opt/canvas-release:ro`)：`/home/wwwroot/AI/domain/y.supdance.com/releases/1.7.1-connector`

---

## 2. CRITICAL 风险警告：上游 Host Updater 自动覆盖风险

### 2.1 风险机制分析

1. 宿主机上正在运行 `open-ai-canvas-updater.service`（`/usr/local/bin/open-ai-canvas-host-updater`），其工作目录指向 `/opt/y-supdance-canvas`。
2. 当管理员在后台点击“系统配置 → 系统更新”时，Host Updater 会：
   - 从 `ddcat-ai/open-ai-canvas` 下载官方 `docker-compose.deploy.yml` 覆盖 `/opt/y-supdance-canvas/docker-compose.deploy.yml`；
   - 拉取上游官方 `ghcr.io/ddcat-ai/open-ai-canvas-web` 与 `backend` 镜像并重启容器。
3. **后果**：官方 `docker-compose.deploy.yml` 中没有 `- ${CANVAS_WEB_RELEASE_PATH:-/opt/yingce-web-release}:/opt/canvas-release:ro` 这一行挂载！一旦通过后台在线更新，SupDance 的前端定制（如 Codex 连接器、自定义 UI）会被上游官方镜像直接覆盖。

### 2.2 防护规则

1. **严禁在管理后台直接点击“系统更新”升级生产环境**。
2. 建议在获得运维授权后，停用宿主机 `open-ai-canvas-updater.service`（`sudo systemctl disable --now open-ai-canvas-updater`），或在 `.env` 中清空 `CANVAS_UPDATER_TOKEN`，使后台在线更新按钮处于只读/禁用保护状态，所有升级统一走 SupDance 集成分支验证后的受控发布流程。

---

## 3. 部署前检查清单 (Pre-Deployment Checklist)

每次生产发布前必须逐项确认：

1. **Git 状态与版本确认**：确认代码已合并至 `supdance/main`，并已打上 `supdance/vYYYY.MM.DD.N` 标签。
2. **完整质量门禁通过**：
   - 前端：`cd web && bun install --frozen-lockfile && bun run typecheck && bun run lint && bun test && bun run build`
   - 后端：`cd backend && go test ./...`
3. **数据库与数据目录完整备份**：
   - 确认 `/opt/y-supdance-canvas/backups/` 下已生成最新的 PostgreSQL custom-format dump (`pg_dump -Fc`) 及 `backend-data` 备份，且已用 `pg_restore --list` 与 `sha256sum` 校验通过。
   - **停止条件**：若数据库备份失败或磁盘剩余空间不足，立即中止部署。
4. **数据库迁移预演**：
   - 检查目标版本是否有新 Schema 迁移（对比 [`UPSTREAM_BASELINE.md`](./UPSTREAM_BASELINE.md)）。
   - 若涉及 Schema 变更，必须获得明确授权，并在停服窗口内由 `migrate` 容器执行 `migrate-schema up` 与 `migrate-schema verify`。
5. **保护持久化与敏感文件**：
   - 严禁覆盖 `/opt/y-supdance-canvas/.env`、`/opt/open-ai-canvas-y-supdance/backend-data/.settings-key`、`postgres-data`、`redis-data` 及用户上传资源目录。
6. **健康验证**：
   - 部署后检查 `curl -sS http://127.0.0.1:3240/api/health/ready`，确认 `ready: true`、`checks.database: true`、`checks.schema: true` 及版本号、Commit 符合预期。
