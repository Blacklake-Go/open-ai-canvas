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

## 5. 发布记录：`1.7.4-supdance.1` 第三方登录后台面板 → 生产（仅前端）

### 5.1 发布坐标

| 项目 | 切换前 | 切换后 |
| --- | --- | --- |
| 提交 | `bc5ebcf7` 的前端产物 | `2548fbc0`（`release/supdance-1.7.4-supdance.1`，其父 `dbcc7751` 声明 v1.7.4 版本坐标） |
| `CANVAS_WEB_RELEASE_PATH` | `releases/1.7.3-supdance-v6`（入口 `index-8kvu_b7m.js`） | `releases/1.7.4-supdance-v1`（2114 文件 / 141,108,422 B，入口 `index-BFwj8vGq.js`） |
| `CANVAS_BACKEND_RELEASE_BINARY` | `releases/yingce-backend-1.7.3-supdance-v4` | 未变更（本次无 Go 改动） |
| 镜像 | `supdance-canvas-backend:bc5ebcf7` / `supdance-canvas-web:bc5ebcf7` | 未变更（未重建任何镜像） |
| 数据库 | — | 零 Schema 变更、零数据写入（`migrate` 未触发） |

webroot `index.html` 由 `e59eaf0bbd70f0a80c204091c927b7bd` 变为 `2096a1c35ae875dd886a1a2e6fe97839`。回滚坐标见 `/opt/y-supdance-canvas/ROLLBACK-1.7.4-web.md`（`0600`）与 `.env.bak-174web-20261102-030936`；回滚动作 = 恢复该 `.env` 后 `docker compose -f docker-compose.deploy.yml up -d web`。

### 5.2 构建与发布方式

纯前端改动，因此未走第 4 节的镜像重建：本地 `web/` 执行 `bun run build`（`tsc --noEmit && vite build`，10.74s，exit 0），`rsync -a --delete` 把 `dist/` 上传为新 release 目录，只改 `.env` 的 `CANVAS_WEB_RELEASE_PATH` 一个键并重启 `web` 服务，由 `docker/canvas-web-entrypoint.sh` 以锁目录 + 原子改名、HTML 最后落地的方式发布。仓库 Dockerfile、compose、后端二进制、镜像与数据库均未触碰。

### 5.3 验证结果

- 产物可达：`assets/social-auth-settings-page-DeX8j_OY.js` 返回 200（17,957 B），内含 `admin-social-key-modal`、`admin-social-provider-grid`、`安全提交凭证`；`assets/admin-shell-DOZajAz_.css` 返回 200，内含 `admin-social-provider-grid`、`admin-social-auth-save-bar`、`admin-social-key-meta-row`、`admin-social-key-secure`。
- 向后兼容：旧入口 `index-8kvu_b7m.js` 与旧面板 chunk `social-auth-settings-page-DM2uAMWU.js` 仍返回 200（7 天哈希产物保留策略生效，已打开的标签页不受影响）；首页与 `/admin/settings/social-auth` 均 200。
- 真实浏览器（生产、已登录管理员）：`/admin/settings/social-auth` 渲染为渠道卡片网格，「中国大陆渠道 · 4 / 海外渠道 · 4」分区切换正常，掩码密钥芯片、回调地址复制/打开、前台展示开关、底部保存条（「前台展示与线上一致 · 已启用 6 / 8 个渠道」）均正常。
- 连通性测试：Google 与 X 卡片触发测试后，徽标由后端真实结果置为「待录入凭证」，未出现估算延迟值冒充在线健康度。
- 授权段（服务器本机发起，未知 IP → 回退 `intl`）：`/api/auth/social/providers` 返回 `region: intl` 且含 google/x 与 `authorizeUrl`；`/api/auth/social/google/start` 302 至 `accounts.google.com/o/oauth2/v2/auth`，跟随后 Google 正常渲染登录页（无 `redirect_uri_mismatch`、无 `invalid_client`）；`/api/auth/social/x/start` 302 至 `x.com/i/oauth2/authorize`，PKCE `code_challenge` 正常，跟随后返回 X 登录页。
- 分区门禁：中国大陆出口 IP 直接访问 `/api/auth/social/{google,x}/start` 返回 `403 该社交登录渠道仅限海外及港澳台访问者使用`，与面板分区策略一致 —— 国际渠道的验收必须从海外/港澳台出口或未知 IP 进行。

### 5.4 未完成项

Google 与 X 的 `clientSecret` 在生产库 `system_settings.supdance_social_auth` 中仍是空串（qq/douyin/bilibili 已是 `enc:v1:` 密文，wechat 的 `clientId`/`clientSecret` 亦为空但前台展示为开启）。密钥只能由管理员本人在后台「配置密钥 / 轮换」弹窗内录入：其值仅存在于 Google Cloud Console 与 X Developer Console，按既定凭据边界不由助手读取、代填或写入对话。令牌段（code → token → 建会话）需在该项录入后重跑一次真实登录才能验收。

## 6. 验收中发现的登录旁路（`d2f6618a` + `c20a849a`，已发布到生产，见 6.1）

验收「令牌段」时发现：本次要做到「自动验证 google/x 登录」，前提是该登录真的会向上游交换令牌，而 `bc5ebcf7`（当前生产二进制 `releases/yingce-backend-1.7.3-supdance-v4`）的实现并不成立。

- `resolveUserProfile` 的非 mock 分支不访问任何上游接口，直接把授权码拼成身份：`Subject = providerID + "_live_" + code[:8]`（`bc5ebcf7` 的 service.go:684）。后果有二：真实登录每次都会新建一个空账号（用户在 QQ/抖音/B 站登进来的作品不可能找回），以及 `/api/auth/social/{provider}/callback` 对任意 `code` 都会签发会话。
- mock 身份只看 `code` 前缀（`bc5ebcf7` 的 service.go:639），与渠道是否开启沙箱无关。
- `/start` 与 `/callback` 都是公开端点：攻击者自行调用 `/start` 即可拿到合法 `state`（`oauth_states` 行），再用 `code=mock_code_anything` 或任意字符串回调，即可铸造账号与会话。本地回归 `TestMockCallbackCodeIsHonoredOnlyWhenSandboxEnabled` / `TestLiveCallbackRequiresRealTokenExchange` 在该修复前均实测铸出用户，生产运行同一份代码。

修复内容：

1. `credentialsUsable`：只填了 Client ID、未录入密钥的渠道不再出现在公开 providers 列表，`/start` 也直接拒绝（消除「点了才在回调阶段失败」的坏按钮；渠道录入密钥后自动恢复展示，无需人工再开）。
2. mock 只接受服务端配置（`sandboxMockEnabled` 或配置里本就是 `mock_` 凭据），`?mock=true` 与 `code=mock_code_*` 都不再单独生效。
3. Google 与 X 接入真实交换：`oauth2.googleapis.com/token` → `openidconnect.googleapis.com/v1/userinfo`；`api.x.com/2/oauth2/token`（Basic 凭据 + PKCE `code_verifier`）→ `/2/users/me`。上游端点为包级变量，可用 httptest 覆盖；两条真实链路由测试证明，含上游拒绝时必须失败。
4. 其余渠道在未接入上游交换前 fail-closed，明确报「尚未接入真实授权码交换」。

已验证的生产出网能力（发布后端时不构成阻碍）：`oauth2.googleapis.com` 404（端点可达）、`accounts.google.com` 302、`api.x.com` 401、`graph.qq.com` 200；容器内无 curl，探针在宿主机执行。

发布前提（需管理员确认，见任务清单）：后端二进制需在服务器用 `backend/Dockerfile` 的 builder 阶段交叉编译（`CGO_ENABLED=1`），产物落到 `releases/yingce-backend-1.7.4-supdance-v1`，只改 `.env` 的 `CANVAS_BACKEND_RELEASE_BINARY` 一个键后 `up -d backend`；回滚即改回旧键值。代价是后端容器重启数秒，以及 QQ/抖音/B 站登录从「静默新建空账号」变为明确报错，直到接入各自的令牌交换。

### 6.1 发布记录（2026-11-02，管理员已确认「现在就发后端」）

坐标：

| 项 | 发布前 | 发布后 |
| --- | --- | --- |
| `CANVAS_BACKEND_RELEASE_BINARY` | `releases/yingce-backend-1.7.3-supdance-v4` | `releases/yingce-backend-1.7.4-supdance-v1` |
| 二进制大小 / md5 | 88,832,632 B | 88,857,368 B / `a27d4c53e13183d59fe262c9bb8a7f1e` |
| 镜像 / compose / 数据库 / 迁移 | `supdance-canvas-backend:bc5ebcf7`、`CANVAS_AUTO_MIGRATE=false` | 未改动 |
| 回滚 | `ROLLBACK-1.7.4-backend.md`、`.env.bak-174be-20261102-143201` | 一步 sed + `up -d backend` |

构建方式（服务器无 buildx，`docker build --target backend-build` 不可用）：`rsync` 源码到 `/opt/build-174be`，用 `golang:1.25-alpine` 容器复现 Dockerfile 的编译步骤（`apk add build-base` → `go mod download` → `CGO_ENABLED=1 go build -trimpath -ldflags=... ./cmd/server`），模块缓存放在命名卷 `174be-gomod`；产物 musl 动态链接，与 alpine 运行时一致。二进制内已无 `_live_` 伪造串，且含 `oauth2.googleapis.com/token`、`openidconnect.googleapis.com/v1/userinfo`、`api.x.com/2/oauth2/token(+/2/users/me)`、`尚未接入真实授权码交换`。

发布后验证（均为生产实测）：

- 容器 `y-supdance-canvas-backend-1` 重建后 `Up (healthy)`，`/usr/local/bin/yingce-backend` 挂载点即新二进制；`/`、`/login`、`/admin/settings/social-auth` 均 200，正常业务流量继续进入（日志可见真实请求）。
- 旁路已堵：先调用公开 `/api/auth/social/qq/start`（带 `X-Real-IP: 124.90.230.101`，QQ/抖音/B 站为 CN 分区，服务器本机出口被判为 `intl`）铸造合法 `state`（64 位），再分别用 `code=mock_code_attacker1234` 与 `code=deadbeef12345678abcd` 打回调 —— 两次都 `302 /login?oauth_error=渠道 qq 尚未接入真实授权码交换，已拒绝登录以避免伪造身份`，响应头无 `Set-Cookie`；`users` 与 `user_identities` 仍为 9 行，未新增。
- 凭据不完整即不展示：`/api/auth/social/providers`（本机 IP，回退 `intl`）现在返回 `providers: null`，此前会返回 google/x —— `d2f6618a` 的门槛在生产生效，管理员录入密钥后自动恢复展示。
- 遗留数据：`users` 中 3 个由旧占位实现铸出的账号仍在（`qq_qq_live_BD736CD0` 2026-11-01 13:30 UTC、`douyin_douyin_live_bd13c` 03:25 UTC、`douyin_douyin_live_5b713` 06:26 UTC），是否为真实用户点击产生尚无法从库里区分；未做任何删除，等管理员决定清理策略。
- 仍需注意：`open-ai-canvas-updater.service` 处于 active，后台点「系统更新」会用官方版本覆写 `.env` 的镜像 digest 与 release 指针（含本次的 backend 指针）。

### 6.2 复测与下一道门（`dd8554b5`，已提交、暂未发布）

发布后 1 小时复测（2026-11-02 06:56–06:59 UTC，全部为生产实测）：

- 容器 `Up 14 minutes (healthy)`，`releases/yingce-backend-1.7.4-supdance-v1` md5 仍为 `a27d4c53e13183d59fe262c9bb8a7f1e`（无人改动指针）。
- 数据未再被铸造：`users` 9 行、`user_identities` 9 行、`subject like '%_live_%'` 3 行，与发布后首测逐字一致（最近一条伪造记录 06:26 UTC，早于容器重启）。
- 门槛分布符合预期：google / x 的 `/start` 均 `403 该第三方登录渠道未开放或未配置`（`clientSecret` 长度仍为 0 —— google `clientId` 72 字符已录入、x `clientId` 34 字符已录入，只差密钥）；`providers`（`intl`）仍为 `null`，（`cn`）返回 qq / douyin / bilibili。

CN 三渠道的上游实测（在容器内发起，读 `Location` 头）说明它们并非「只是没接交换」：

- `qq/start` → `graph.qq.com/oauth2.0/authorize?...client_id=supdance...`，QQ 立即 `302` 到 `graph.qq.com/oauth2.0/show?which=error...&error=100001`（`client_id` 被 QQ 判为非法）。库里 qq 的 `clientId` 就是字面量 `supdance`，不是 QQ 互联的应用 ID。
- `bilibili/start` 携带的 `client_id=6f51861a1d834aec` 是公开示例工程里流传的演示 appkey，不是本站注册的应用。
- `douyin/start` 的 `client_key=awj7wwc7sh2g6kuf` 格式合规，但是否为本账号应用未经验证；上游未返回可用结果。

`dd8554b5` 把展示门槛从「凭据完整」收紧为 `channelAdvertisable`（凭据完整且「沙箱模拟已开 或 后端真的实现了该渠道的兑换」），使 `/start` 与公开列表同源，避免把用户送到一次注定失败的授权。它同时会让 CN 登录页暂时不再出现 QQ/抖音/B 站按钮 —— 属于面向真实访客的可见变更，且与「渠道需要管理员到各开放平台重新登记凭据」这件事耦合，因此先发布到生产前需要管理员点头；`google`/`x` 在密钥录入后不受影响，会照常展示。

### 6.3 CN 渠道交换补齐（`fb4ac0ef` + `88e33f86`，已提交、暂未发布）

为了让 `dd8554b5` 不是「把按钮藏起来」而是「把登录做通」，补齐了两条有权威文档、且端点可从生产出口验证的链路：

- QQ Connect 三段：`graph.qq.com/oauth2.0/token`（成功是 query-string，不是 JSON）→ `graph.qq.com/oauth2.0/me`（`callback( {…} );` JSONP，成功与错误同样包裹）→ `graph.qq.com/user/get_user_info`（`ret`/`msg` 信封，`ret!=0` 即失败）。身份主体为 `qq_openid_<openid>`。
- 抖音 Login Kit v2 两段：`open.douyin.com/oauth/v2/access_token` 与 `open.douyin.com/oauth/v2/userinfo`。两者都在 HTTP 200 里用 `data.error_code` 报业务失败（实测 `22 非法应用`），所以只看状态码会把拒绝当成功。身份主体为 `douyin_openid_<open_id>`。抖音取参走 query string（实测可解析），表单体同时保留以兼容两种实现。
- 哔哩哔哩仍未接入，且是刻意的：从生产出口实测公开文档里的四个令牌端点 `member.bilibili.com/x/account-oauth2/v1/token`、`app.bilibili.com/x/oauth2/token`、`api.bilibili.com/x/passport-login/oauth2/access_token`、`passport.bilibili.com/api/v2/oauth2/token` 无论 GET/POST 全为 404；其第三方 OAuth 需应用审核通过后另行下发可用域名。没有可验证端点前继续 fail-closed。
- `88e33f86` 把上述真实报文（含四种「看起来像成功」的失败）固化成契约测试；`stripJSONP` 的前导空白毛病就是被这组测试抓出来的。

发布后的行为差异（这是需要管理员确认的那一点）：QQ 与抖音因凭据字段非空且已有真实交换，会重新出现在 CN 登录页并可发起授权 —— 但库里 QQ 的 `clientId` 目前是字面量 `supdance`、B 站是公开示例 appkey，所以 QQ 点了仍会在 QQ 侧看到 `error=100001`，要真正可用必须先到 QQ 互联 / 抖音开放平台 / B 站开放平台登记本站应用；`bilibili` 与 `wechat` 则因缺交换或缺凭据而不再展示。


