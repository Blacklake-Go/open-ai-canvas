# SupDance Canvas — 生产部署规范与在线更新防护 (DEPLOYMENT.md)

## 1. 生产环境真实架构 (`43.133.253.76`)

经只读审计确认，生产环境 (`https://y.supdance.com` -> `https://one.supdance.com`) 当前采用 **Docker Compose 受管镜像 + SupDance 前端静态构建挂载** 的混合部署模式：

- **Compose 编排目录**：`/opt/y-supdance-canvas/docker-compose.deploy.yml`
- **环境配置文件**：`/opt/y-supdance-canvas/.env`（权限 `0600`）
- **监听端口与反向代理**：`y-supdance-canvas-web-1` 监听宿主机 `127.0.0.1:3240`，由宿主机 Nginx (`/home/wwwroot/AI/vhost/y.supdance.com-https.conf`) 承担 HTTPS 卸载与 WebSocket/SSE 反向代理。
- **持久化数据路径**：
  - PostgreSQL 17 数据卷：`/opt/www.supdance.com/postgres-data`
  - Redis 7.4 数据卷：`/opt/www.supdance.com/redis-data`
  - Backend 资源与配置数据卷 (`/data`)：`/opt/www.supdance.com/backend-data`
  - Web 静态发布目录 (`/usr/share/nginx/html`)：`/home/wwwroot/AI/domain/www.supdance.com/web`
  - SupDance 定制前端构建产物挂载 (`/opt/canvas-release:ro`)：`/home/wwwroot/AI/domain/www.supdance.com/releases/<发布号>`
  - SupDance 定制后端二进制挂载 (`/usr/local/bin/yingce-backend:ro`)：`/opt/y-supdance-canvas/releases/<发布号>`

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

---

## 4. 发布记录：`supdance/v2026.11.01.1` → 生产 (`bc5ebcf7`)

### 4.1 发布坐标

| 项目 | 切换前 | 切换后 |
| --- | --- | --- |
| 提交 | `1.7.3-supdance-v3` 构建 | `bc5ebcf7`（`supdance/main`） |
| `CANVAS_BACKEND_IMAGE` | `ghcr.io/ddcat-ai/open-ai-canvas-backend@sha256:2a2a8527…` | `supdance-canvas-backend:bc5ebcf7`（服务器本地构建） |
| `CANVAS_WEB_IMAGE` | `ghcr.io/ddcat-ai/open-ai-canvas-web@sha256:f6431c24…` | `supdance-canvas-web:bc5ebcf7`（服务器本地构建） |
| `CANVAS_BACKEND_RELEASE_BINARY` | `releases/yingce-backend-1.7.3-supdance-v3` | `releases/yingce-backend-1.7.3-supdance-v4` |
| `CANVAS_WEB_RELEASE_PATH` | `releases/1.7.3-supdance-v3` | `releases/1.7.3-supdance-v6`（2114 文件，入口 `index-8kvu_b7m.js`） |
| `CANVAS_YINGCE_AGENT_IMAGE` | `sha256:1c293d07…` | 未变更（`bc5ebcf7` 未触及 `yingce-agent/`、根 `Dockerfile`、compose、`nginx.conf`） |

其余 `.env` 键（数据库连接、`CANVAS_CORS_ORIGINS`、`CANVAS_PUBLIC_BASE_URL`、`CANVAS_REGISTRATION_ENABLED=false`、更新器令牌）逐项确认零变更；回滚坐标与数据库备份记录在 `/opt/y-supdance-canvas/ROLLBACK-bc5ebcf7.md`（`0600`）。

### 4.2 构建方式与限制

生产服务器 Docker 29.1.3 仅有 legacy builder（无 buildx），仓库 `Dockerfile` 与 `backend/Dockerfile` 使用 BuildKit 专属语法（`FROM --platform=$BUILDPLATFORM`、`RUN --mount=type=cache`、裸 `ARG TARGETOS/TARGETARCH`）。发布采用 **build-only 副本**：在服务器 checkout `/opt/build-bc5ebcf7` 内生成 `Dockerfile.legacy` / `backend/Dockerfile.legacy`，仅去掉 `--platform` 与 cache mount、并把 `TARGETOS/TARGETARCH` 显式默认 `linux/amd64`（与服务器架构一致）。仓库内的 Dockerfile 未被修改，服务器未安装新组件。

### 4.3 演练与切换顺序

1. 隔离演练栈 `/opt/drill-bc5ebcf7/docker-compose.drill.yml`：独立 PostgreSQL/Redis/数据目录，仅监听 `127.0.0.1:3270`（backend）与 `127.0.0.1:3271`（web），不与主栈共享任何卷。
2. 演练 `migrate` 一次性服务输出 `{"current":77,"expected":77,"ready":true}`；后端与前端容器 `healthy`。
3. 迁移预演（对应检查清单第 4 项）：把生产 `pg_dump` 恢复到演练栈的 `prodcopy` 库（131 表 / 6 用户 / 台账 76 行），用新镜像的 `migrate-schema up` 执行后，`schema_migrations` 版本列表与生产逐行一致、表数量不变、用户数据完好 → 本次发布对生产库为**零 Schema 变更**。
4. 切换主栈 `.env` 四项 → `docker compose -f docker-compose.deploy.yml up -d`（`migrate` 先跑并 `Exited (0)`，随后 backend、web 依次重建）。

### 4.4 验证结果

- 演练栈（真实浏览器、已登录）：`/toolbox/music` 三栏音乐工作台正常渲染，`/create` 创作岛出现「音乐」药丸，`/plugins` 插件中心正常；后端日志仅有一条登录前的 `/api/model-catalog 401` WARN。
- 生产切换后：`api/health/ready` 返回 `version v1.7.3`、`schema 77/77 ready`、`checks` 全 `true`；`https://www.supdance.com/` 入口 chunk 变为 `index-8kvu_b7m.js`，旧 chunk `index-DDzwZqEH.js` 仍返回 200（7 天保留策略生效，老标签页不受影响）。
- 生产真实浏览器（已登录）：`/toolbox/music` 正常渲染工作台；`/api/plugins/status` 仅返回规范标识 `supdance-music-generation`（`effectiveEnabled: true`、`canToggle: true`），幻影别名 `music-generation` 已消失；`/plugins`、`/create`、`/admin/plugins`、`/admin/i18n/entries`、`/assets` 均无错误态。
- 数据完整性：131 表 / 6 用户 / 迁移台账 76 行（1..77）与切换前一致；`plugin_platform_states` 仅含 `ai-art-critique`、`supdance-i18n`、`supdance-music-generation` 三行，未被本次发布改动。

### 4.5 遗留风险与后续动作

1. **本地镜像不受 Host Updater 管理**：`supdance-canvas-*:bc5ebcf7` 只存在于生产服务器本地镜像库。若执行 `docker image prune -a` 或宿主机重装，镜像将丢失（`ROLLBACK-bc5ebcf7.md` 记录的官方 digest 仍可回滚，但 SupDance 代码只存在于 `releases/` 下的宿主二进制与前端产物中）。后续如需可推送至私有 Registry 固定。
2. **`open-ai-canvas-updater.service` 仍为 `active`**：一旦在后台点击“系统更新”，`.env` 的镜像 digest 与 compose 会被官方版本覆盖（见第 2 节）。停用前，任何在线更新都需先按本节流程重新发布。
3. **生产 `pluginCenterEnabled=false`**（`system_settings.feature_availability`，2026-10-29 由管理员设置，早于本次发布）：前台 `/plugins` 显示「插件中心暂未开放」。这会影响插件守卫页上「前往插件中心」自助开启入口的可用性——若未来需要在生产让用户自助开启插件，需先该项打开并重新验收。
4. **服务器 `/opt/www.supdance.com` 是数据目录宿主**（`backend-data`/`postgres-data`/`redis-data`/`updater-socket`），其内残留的 git checkout 仍停在 `a934a655` 且有未提交改动；本次发布未触碰该目录，运行态与它无关。
5. **磁盘水位**：发布前 `/` 已用 98%（剩余 1.2G），清理悬空镜像回收 1.66G 后为 87%（剩余 7.5G）。旧 `releases/1.7.3-supdance-v1..v5` 与 `yingce-backend-…-v1..v3` 仍占约 1G，可在确认无需回滚后按保留策略清理。
