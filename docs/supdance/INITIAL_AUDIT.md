# SupDance Canvas — 全面初始审计报告 (INITIAL_AUDIT.md)

## 1. 当前 Git 拓扑与多工作区现状

### 1.1 本地工作区与远程仓库拓扑

- **当前开发工作区**：`/Users/seelucency/Documents/dev/One`（已从本机最新 `v1.7.1` 仓库克隆并完成 `git fetch --unshallow` 完整历史恢复，共 1,701+ 提交）。
- **`origin`（SupDance 自有仓库）**：`https://github.com/Blacklake-Go/open-ai-canvas.git`
- **`upstream`（原作者上游仓库）**：`https://github.com/ddcat-ai/open-ai-canvas.git`
- **共同祖先（Merge Base）**：`89fcb53fd65969cb58ae1eba5d18381db51819d1`（精确对应上游正式版 `v1.7.1` 标签）。
- **子模块与嵌套仓库**：无 Git 子模块（`.gitmodules` 不存在）。

### 1.2 本地、远程与生产的已知版本映射

| 环境 / 引用 | 分支 / 标签 | Commit SHA | 对应上游基线 | 状态说明 |
| --- | --- | --- | --- | --- |
| `upstream/main` | `main` | `e9ce0604f9896e533cd2230b3d2711bf0d3f0e85` | `v1.7.1` + 1 commit | 含未发布提交 `feat(platform): 推广中心`（涉及 Schema 迁移与路由变化） |
| 上游最新正式 Release | `v1.7.1` | `89fcb53fd65969cb58ae1eba5d18381db51819d1` | `v1.7.1` | 2026-10-26 发布的最新稳定 Release，Schema 版本 71 |
| `origin/main` | `main` | `89fcb53fd65969cb58ae1eba5d18381db51819d1` | `v1.7.1` | 与上游 `v1.7.1` 完全一致的干净镜像分支 |
| `supdance/main` | `supdance/main` | `6825bcd82abfa650c7645a6bafe11fd24dc74326` (基线) | `v1.7.1` | SupDance 长期产品主分支（在 `v1.7.1` 基础上包含 Codex Agent 连接器与 SupDance 扩展架构） |
| 生产服务器运行容器 | `y-supdance-canvas` | Backend/Web/Agent 均运行 `v1.7.1` (`89fcb53f`) | `v1.7.1` | `/opt/y-supdance-canvas` 运行官方 GHCR 镜像 + 挂载 SupDance 定制前端构建产物 |
| 生产服务器旧源码目录 | `/opt/open-ai-canvas-y-supdance` | `a934a655` (`v1.6.9.1`) + 未提交工作树改动 | `v1.6.9.1` | 历史遗留源码目录，包含未提交的 5 个 Codex 连接器文件（已确认与本地 `6825bcd8` 同源） |

---

## 2. 生产服务器只读审计结果 (`43.133.253.76`)

通过授权 SSH 密钥只读检查确认了生产环境的真实拓扑（未修改任何生产配置或重启任何服务）：

### 2.1 网站目录与 Nginx 反向代理结构

1. **`/home/wwwroot/AI/domain/y.supdance.com/web/`**：
   - **真实性质**：该目录**不是** Git 源码仓库（无 `.git`），而是通过 Docker Volume (`CANVAS_WEB_DATA_PATH=/home/wwwroot/AI/domain/y.supdance.com/web:/usr/share/nginx/html`) 挂载给 `y-supdance-canvas-web-1` 容器的前端静态资源发布目录。
   - **同级目录 `/home/wwwroot/AI/domain/y.supdance.com/releases/1.7.1-connector`**：通过 `CANVAS_WEB_RELEASE_PATH` 挂载到 `web` 容器内的 `/opt/canvas-release:ro`，用于在容器启动时将携带 SupDance Codex 连接器二开的前端静态构建产物同步到 `/usr/share/nginx/html`。
   - **历史备份目录**：同级存在 `web-bak-20261024-095941` 与 `web.prev-20261026T175230Z-1.7.1`。
2. **域名与 Nginx 配置 (`/home/wwwroot/AI/vhost/y.supdance.com-https.conf`)**：
   - `https://y.supdance.com` 与 `http://y.supdance.com` 均 `301` 重定向至 `https://one.supdance.com$request_uri`。
   - `https://one.supdance.com` 由宿主机 Nginx 监听 443，将 `/`、WebSocket (`/api/canvas-projects/[^/]+/realtime`)、SSE (`/api/(tasks/[^/]+/text-events|agent/runs/[^/]+/events)`) 及流式 AI 接口反向代理至 `http://127.0.0.1:3240`。

### 2.2 Docker Compose、数据库、Redis 与持久化路径

生产环境由 `/opt/y-supdance-canvas/docker-compose.deploy.yml` 编排（项目名 `y-supdance-canvas`）：

| 容器名称 | 当前运行镜像与 Digest | 状态与端口 | 持久化 / 挂载位置 |
| --- | --- | --- | --- |
| `y-supdance-canvas-web-1` | `ghcr.io/ddcat-ai/open-ai-canvas-web@sha256:833ecbfa99fe88ee7e8e5aff21c98db07da6033db905ad63454d89363a23e952` | Healthy, `127.0.0.1:3240->3000/tcp` | `/home/wwwroot/AI/domain/y.supdance.com/web` (`/usr/share/nginx/html`) 及 `/home/wwwroot/AI/domain/y.supdance.com/releases/1.7.1-connector` (`/opt/canvas-release:ro`) |
| `y-supdance-canvas-backend-1` | `ghcr.io/ddcat-ai/open-ai-canvas-backend@sha256:da21981ba178b3ce5e77b0ab19de828457f31275a404a77e98d263a51f9297fc` | Healthy, `8080/tcp` (内网) | `/opt/open-ai-canvas-y-supdance/backend-data:/data` |
| `y-supdance-canvas-yingce-agent-1` | `ghcr.io/ddcat-ai/open-ai-canvas-yingce-agent@sha256:c821a60623f23bc9b75af26f9f426e3bcd7a88b35029a9421263932d791667c6` | Healthy, `8081/tcp` (内网) | 无状态容器 (`MAX_CONCURRENT_SESSIONS=2`) |
| `y-supdance-canvas-migrate-1` | 同 `backend` 镜像 | Exited (0) | 一次性执行 `migrate-schema up`，当前 Schema `current: 71, expected: 71` |
| `y-supdance-canvas-postgres-1` | `postgres:17-alpine` | Healthy, `5432/tcp` (内网) | `/opt/open-ai-canvas-y-supdance/postgres-data:/var/lib/postgresql/data` |
| `y-supdance-canvas-redis-1` | `redis:7.4-alpine` (`--appendonly yes`) | Healthy, `6379/tcp` (内网) | `/opt/open-ai-canvas-y-supdance/redis-data:/data` |

### 2.3 线上未提交代码核查与快照保全

- 在 `/opt/open-ai-canvas-y-supdance` 中发现 Git `HEAD` 停留在 `a934a655` (`v1.6.9.1`)，工作树存在 3 个修改文件与 2 个未跟踪文件：
  1. `web/src/components/canvas/canvas-cloud-agent-connectors.css` (SHA256: `3790f58f...`)
  2. `web/src/components/canvas/canvas-cloud-agent-connectors.tsx` (SHA256: `3fd743cd...`)
  3. `web/src/components/canvas/canvas-cloud-agent-panel.tsx` (基于 `v1.6.9.1`/`v1.6.9.2` 的旧面板文件)
  4. `web/src/components/canvas/use-codex-connector.ts` (SHA256: `d57756ee...`)
  5. `web/src/services/api/codex-connector.ts` (SHA256: `8bf383a3...`)
- **核对结论**：上述前 2 个与后 2 个文件的 SHA256 与本仓库 `6825bcd8` (`supdance/agent-connector-1.7.1`) **100% 字节级一致**；第 3 个文件 `canvas-cloud-agent-panel.tsx` 已在 `6825bcd8` 中完整移植到了 `v1.7.1` 基线，且线上 `/home/wwwroot/AI/domain/y.supdance.com/web/index.html` 的入口 bundle hash (`index-gVm09-ce.js`) 与本地 `6825bcd8` 构建产物完全一致。因此**不存在丢失的未知线上功能**。

---

## 3. 当前定制代码清单

| 模块 | 文件路径 | 类型 | 说明 |
| --- | --- | --- | --- |
| Codex Agent 连接器 API | `web/src/services/api/codex-connector.ts` | 新增文件 | 发现 (`127.0.0.1:17372`)、配对、SSE ticket、线程管理与审批转发 |
| Codex Agent 状态机 Hook | `web/src/components/canvas/use-codex-connector.ts` | 新增文件 | 连接状态机、消息流合并与中断控制 |
| Agent 连接器栏 UI | `web/src/components/canvas/canvas-cloud-agent-connectors.tsx` | 修改上游文件 | 在底部连接器栏接入 Codex 状态弹窗、重连、新建对话与断开按钮 |
| Agent 连接器栏样式 | `web/src/components/canvas/canvas-cloud-agent-connectors.css` | 修改上游文件 | 连接器图标阵列、连接态脉冲点与操作浮层样式 |
| 云端 Agent 面板 | `web/src/components/canvas/canvas-cloud-agent-panel.tsx` | 修改上游文件 | 挂载 `useCodexConnector`，在 Codex 连接时接管发送与停止动作 |

---

## 4. 风险等级与初始化前发现的关键问题

| 风险项 | 等级 | 证据与原因 |
| --- | --- | --- |
| **Host Updater 在线更新覆盖二开风险** | **CRITICAL** | 宿主机 `open-ai-canvas-updater.service` 处于 `active (running)` 状态，直接监听 `/opt/y-supdance-canvas`。若在后台点击“系统更新”，Updater 会从 `ddcat-ai/open-ai-canvas` 下载官方 `docker-compose.deploy.yml` 并覆盖 `/opt/y-supdance-canvas/docker-compose.deploy.yml`，**抹掉 `- ${CANVAS_WEB_RELEASE_PATH}:/opt/canvas-release:ro` 挂载**，导致 SupDance 前端定制立刻被上游官方 `web` 镜像覆盖丢失。 |
| **生产环境控制目录与数据目录跨目录耦合** | **HIGH** | Compose 控制文件在 `/opt/y-supdance-canvas`，而 `backend-data`、`postgres-data`、`redis-data` 却放在旧源码目录 `/opt/open-ai-canvas-y-supdance/` 下，容易在清理旧源码目录时误删生产数据库。 |
| **未发布上游分支 (`upstream/main`) 含破坏性迁移** | **HIGH** | `upstream/main` (`e9ce0604`) 相比 `v1.7.1` 新增了推广中心功能及数据库迁移，不可直接无审核合并到生产。 |
| **Agent 面板单文件耦合度高** | **MEDIUM** | `canvas-cloud-agent-panel.tsx` 超过 1,500 行，上游每次改动云端 Agent UI 都可能产生邻近行合并冲突。 |
