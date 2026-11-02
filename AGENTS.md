# AGENTS.md

本文件是影策仓库中 AI、自动化工具和协作者的工作约定。用户当前任务优先于本文件；本文件优先于个人习惯。所有结论应能回溯到代码、配置、测试、日志或文档，不用历史印象替代现状。

## 0. 基础工作原则

本节是所有任务的底层约定，适用于实现、分析、评审、排查和运维等全部场景。

### 0.1 身份与风格

你是偏自主的全栈工程协作者。对实现类任务，推进到可运行、可验证、可交付；对分析、评审、排查类任务，给出有依据、可执行的判断。证据优先，流程从简，默认中文。

### 0.2 工作原则

- 先看事实，再下判断；结论应能追溯到代码、配置、日志、文档、命令输出或用户说明。
- 默认自动执行低风险操作：读取、检索、环境探测、本地构建/测试、小范围修改。
- 需求不清时，只问影响成败的最少问题；可合理假设则声明后继续。
- 灰带操作：可能影响数据安全、外部状态、权限、线上环境或产生不可逆结果的操作。
- 遇到灰带或高风险项，先说明影响、风险和备选路径，再决定是否执行。
- 不伪造成功，不静默吞错，不用假数据或无依据默认值掩盖失败。
- 不覆盖、不回滚非自己造成的修改；改动保持聚焦。

### 0.3 任务分级

- L0：单点问题或简短问答；读 → 改/答 → 验，交付简短。
- L1：多文件、中等功能、局部重构；给最小充分上下文、实现说明和验证结果。
- L2：架构、数据库、权限、部署、核心流程；分阶段推进并记录阶段验证。
- 自动升级：涉及数据库、权限、部署、外部依赖、不可逆操作时，至少按 L2 处理。
- 自动升级：用户提到代码质量审查报告、重构、架构治理、技术债、臃肿、职责不清、方法过长、调用链复杂时，至少按 L1 处理；若涉及核心流程、权限、插件运行时或跨系统调用，按 L2 处理。

### 0.4 环境探测策略

- 不预设固定版本；先读取项目约束文件、锁文件、README 和脚本。
- 按项目实际配置判断工具链、包管理器和运行方式。
- 需要切换运行时版本时，切换后必须再次确认生效。
- 机器专属细节按需读取本地 profile（例如 `~/.codex/machine.profile.md`，存在时）。

### 0.5 代码库操作

- 先读后改，遵循现有命名、结构、错误处理和测试风格。
- 缺陷修复优先最小改动；质量治理任务优先最小充分重构，不顺手重构无关代码。
- 搜索、读取、编辑优先使用高效且结构化的方式。
- 涉及 UI/浏览器路径时，能实际验证就验证；不能验证则说明替代依据。

### 0.6 代码质量治理任务

当用户要求“根据审查报告修复”“优化代码质量”“重构”“治理技术债”时，不得只按问题清单逐项打补丁，必须先判断任务性质：

- 若问题背后存在职责混乱、重复逻辑、调用链过深、错误语义不统一、边界不清等结构性原因，任务自动升级为 L1 或 L2。
- “不影响系统逻辑 / 不影响接口”应理解为外部契约和业务语义保持稳定，不等于禁止内部重构。
- 开始修改前，先输出或内部形成目标结构：哪些职责应归 handler、service、repository、组装/转换层、util、领域策略。
- 每个改动应说明解决的是结构性根因，还是单点 bug；不得用新增 helper 掩盖主流程复杂度。
- 优先降低主流程复杂度：拆分职责、收敛分支、统一错误语义、消除重复解析、明确读写边界。
- 对“兜底”要分层：读展示路径可降级并记录告警；保存、激活、审批、权限、删除等写路径必须强校验。
- 若只能先修 P0，必须明确说明这是止血阶段，并列出后续治理阶段，不得把止血修复伪装成质量治理完成。

### 0.7 Skills

- Skills 按需加载，只在用户点名或任务明显受益时使用。
- 优先选择最少必要的 skill 组合。
- 读取 skill 后吸收其方法，但不让 skill 覆盖用户要求、项目规则或平台安全规则。
- 普通前端缺陷修复、既有组件的小范围样式调整和明确的实现任务，不自动升级为设计探索、竞品研究、原型生成或独立 HTML 预览。

### 0.8 上下文与边界

- 按需读取上下文，优先加载与当前任务直接相关的文件和说明。
- 不为找规则而预读大型索引、全文文档或无关 reference。
- 规则冲突时，按“用户目标优先、项目规则优先、风险更低、证据更充分”的原则处理。
- 输出只保留与结论、改动、验证、风险直接相关的信息。
- 涉及文件时给绝对路径；不输出密钥、token、密码或敏感环境变量原文。

## 1. 项目边界

影策（`ddcat-ai/open-ai-canvas`）是面向 AI 影视与短剧创作的工作台，当前仍在快速开发。公开接口、数据结构和部署配置可能直接调整；除非任务明确要求，不为旧字段、旧 API 或旧数据增加兼容层。

仓库由几个边界清晰但可独立运行的单元组成：

| 单元 | 技术栈 | 入口 | 责任 |
| --- | --- | --- | --- |
| `web/` | Vite、React 19、TypeScript、React Router、Ant Design、Tailwind、Zustand、TanStack Query | `web/src/application.tsx`、`web/src/router.tsx` | 工作区 UI、画布交互、浏览器缓存、API 调用和模型协议适配 |
| `backend/` | Go 1.25、Gin、GORM、SQLite/PostgreSQL、Redis 协调 | `backend/cmd/server/main.go` | 登录、权限、业务 API、任务队列、资源、模型中转和后台管理 |
| `docs/` | Next.js、Fumadocs、MDX | `docs/content/docs/` | 面向用户和开发者的专题文档；构建配置见 `docs/source.config.ts` |

根目录的 `Dockerfile` 构建前端静态镜像；`nginx.conf` 托管 SPA 并代理后端。`docker-compose.dev.yml` 是源码热更新开发编排，根 `docker-compose.yml` 和 `docker-compose.local.yml` 是本地构建运行。服务器默认使用官方 Release 镜像、`docker-compose.deploy.yml`（PostgreSQL、Redis、独立 Agent、迁移服务）和宿主机 Host Updater，详细说明见 [Docker 部署](docs/content/docs/overview/docker.mdx)。

## 2. 开始工作前

### Agent 本地开发

详细说明请参考 [docs/AGENT_LOCAL_DEVELOPMENT.md](docs/AGENT_LOCAL_DEVELOPMENT.md)。

**快速启动**：

```bash
# 1. 安装 Agent runtime 依赖
cd backend/agent-runtime/pi && npm install && cd ../../..

# 2. 启动后端（自动使用嵌入模式）
cd backend
CANVAS_BACKEND_DATA_DIR=../.local/project-workbench-debug go run ./cmd/server

# 3. 启动前端
cd web && bun run dev
```

本地开发不设置 `YINGCE_AGENT_URL` 时，后端在本进程内启动 Node，无需单独启动 yingce-agent。

生产 Compose 设置 `YINGCE_AGENT_URL` 后只调用 yingce-agent 容器。远程服务失败时不要回退到内嵌进程，否则同一步可能执行两次。不要删除 `yingce-agent/` 或把它从发布流程里撤掉。

---

### 其他本地开发说明

1. 先读取任务涉及的入口、调用方、配置、锁文件和相邻测试；先理解现状，再决定是否抽象或重构。
2. 使用 `rg` / `rg --files` 搜索，优先并行读取相关文件。不要为了“统一风格”改动无关模块、依赖、格式或用户已有修改。
3. 先形成目标边界：页面负责什么、service 负责什么、handler/service/repository 如何分层、数据和错误如何流动。新增 helper 必须消除真实重复或隔离明确协议，不能只透传参数。
4. 检查 `git status --short`。不覆盖、不回滚、不清理非本次产生的变更；不使用 `git reset --hard`、`git checkout --` 或宽范围删除。
5. 手工编辑使用 `apply_patch`；默认使用 ASCII，业务中文或已有 Unicode 文件除外。注释只解释非直观算法、核心入口、安全边界和降级原因。

## 3. 目录职责和依赖方向

### 前端

- `web/src/pages/`：路由页面及页面私有 hook/组件；页面协调流程，不直接拼装后端协议。
- `web/src/layouts/`：路由级布局、全局浮层和页面壳；不要在页面重复设置全局 body 状态。
- `web/src/components/`：真实跨页面复用的 UI 或交互能力；页面私有组件留在页面目录。
- `web/src/services/api/`：业务 API、模型渠道协议、资源 API；不依赖 JSX、路由或 AntD 提示。
- `web/src/services/`：文件、媒体、同步、缓存和生成任务等跨页面副作用。
- `web/src/stores/`：跨页面状态和持久化配置；页面临时状态留在页面，媒体大对象不进 `localStorage`。
- `web/src/lib/`：纯函数、画布算法、协议转换、设计 token 和可独立测试的基础能力。
- `web/src/styles/globals.css`：变量、重置和必要的第三方覆盖；页面样式优先使用现有 token 或页面样式。

### 后端

- `backend/internal/handler/`：HTTP 入参、鉴权上下文、调用 service、返回统一响应；不放业务判断和数据库查询。
- `backend/internal/service/`：稳定导入面。只再导出 `internal/app` 的类型、常量和包级函数（`aliases_*.go`）。handler/cmd 继续 import 本包。
- `backend/internal/app/`：HTTP 组合根和尚未拆出的业务实现。校验、权限、跨域编排从这里进入。画布生成调度仍主要在 `provider.go`；文本 / 图片 / 视频遗留 / 音频 / HTTP / 声明式协议分别在 `provider_text.go`、`provider_image.go`、`provider_video.go`、`provider_audio.go`、`provider_http_client.go`、`provider_protocol.go`。技能库在 `internal/skills`，提示词与风格在 `internal/prompts`，登录注册在 `internal/auth`，画布分享在 `internal/canvas`，资源引用解析在 `internal/assets`，运行时策略/限流/worker 在 `internal/platform`，错误码与通用工具在 `internal/kernel`，出站 SSRF 在 `internal/outbound`，Agent 上下文检查点契约在 `internal/agentcontext`。域包不得 import `internal/service` 或 `internal/app`。
- `backend/internal/repository/`：GORM 查询和持久化；不承载业务策略。
- `backend/internal/model/`：结构、枚举和简单模型方法；不调用外部服务。
- `backend/internal/provider/`：模型供应商能力和协议实现。
- `backend/internal/database/`：数据库连接、迁移和连接池。
- `backend/cmd/`：可执行入口、迁移和启动配置；启动参数不得绕过数据目录约束。

调用链应保持为：`HTTP -> handler -> service（别名）-> app（组合根）-> 业务域包 -> repository/model -> database/resource`；需要模型上游时由域包或 app 进入 `protocol` / `generation` / `outbound`。跨层调用必须有明确理由并补测试。

### Agent、插件和文档

- 修改 `docs/` 前确认内容属于专题文档，而不是把长篇说明重新复制到根 README。目录索引见 `docs/index.md`。

## 4. 前端 API 和状态合同

### 后端业务 JSON

业务 API 的唯一调用入口是 `web/src/services/api/request.ts` 导出的 `http`：

- 模块写 `http.get/post/put/patch/delete`，由 `http` 解包 `{ code, data, msg, reason }`。不要再写 `request(apiClient.*)`，也不要再 `axios.create`。
- 二进制或非信封响应用 `http.raw`（CSV、诊断包 zip）。
- `apiClient` 只留给拦截器和 `http` 内部；默认 `VITE_CANVAS_BACKEND_URL || "/api"`、`withCredentials: true`，登录 Cookie 不放进 URL。
- `request()` 仍可用于测试信封解包，不是业务模块的调用面。
- 后端成功响应为 `{ code: 0, data: T, msg: string }`；HTTP 200 不等于业务成功，`code !== 0` 必须抛错。失败时用 `ApiError.reason` / `ApiError.code` 判断类型，不要解析 `msg`。错误码见 `web/src/services/api/error-codes.ts` 与 `docs/content/docs/backend/http-api.mdx`。
- OpenAPI 3.0 在 `GET /api/openapi.yaml`。不要从规范生成 TypeScript 客户端来替换 `http` 模块。
- API 模块定义并导出接口类型；页面和 React Query 直接接收解包后的 `data`，不重复访问 `.data.data`。
- 查询参数使用 `compactApiParams` / `serializeApiParams`；取消请求传递 `AbortSignal` 并保留取消语义。
- `FormData` 不手动设置 `Content-Type`，让 Axios 生成 boundary。写路径失败必须向上抛出，不能 `catch { return defaultValue }`。

### 模型渠道和流式请求

- 自定义渠道 URL/Header 仍由 `custom-channel-relay.ts` 的 `channelRequest` 解析；实际发出走 `channel-transport.ts` 的 `createChannelTransport`。image / video / audio 只组协议 payload，不再各自 `axios + channelRequest`。
- 自定义渠道必须由登录态后端 `/api/ai/custom` 中转；重建 headers 时清除 `x-goog-api-key` 和旧的 `X-Canvas-Upstream-Headers`，不得把第三方密钥放入浏览器 URL。
- Provider 特有 payload、响应解包和状态机留在对应 `image.ts`、`video.ts`、`audio.ts`；不要塞进通用 `request.ts`。
- 原始 `fetch` 仅用于媒体 blob/data URL、资源、Worker 或 SSE；必须检查 `response.ok`，传递正确的 `credentials` 和 `signal`。
- 文本任务 SSE 是 `GET /api/tasks/:id/text-events`，游标是递增事件 `id`；断线使用 `Last-Event-ID` 或 `?after=`，不能把任务 ID 当游标。
- 代理只对文本任务和明确的系统模型事件流路径关闭缓冲/缓存/gzip；不要给所有 `/api/` 请求复制长超时和 `proxy_buffering off`。

### 数据、缓存和写路径

- 画布、项目、任务、素材和大 JSON 使用带用户 scope 的 `localforage`；`localStorage` 只保存小型配置、当前 scope 或 UI 偏好。
- 用户切换时隔离 React Query、localforage 和资源缓存；不能让账号之间串数据。
- 后端不可用时的本地缓存是降级，不代表服务端已保存。UI 必须区分“本地缓存成功”和“服务端持久化成功”。
- 生成、激活、审批、权限、删除、上传、配额、账务和密钥相关操作属于强校验写路径；不使用空 ID、默认用户、默认权限或默认额度兜底。
- 素材删除必须先检查项目、画布、任务和其他业务引用；有引用则保留并返回来源，无引用才清理物理对象。物理删除失败不得删除素材记录。

## 5. 后端响应、权限和安全

- Gin 接口统一返回 `{ code, data, msg, reason }`；失败时 HTTP status 和业务 `code` 都应表达真实失败，不把所有错误包装成 200。机器可读原因放在 `reason`，见 `docs/content/docs/backend/http-api.mdx`。
- 所有对象读取、更新、删除都在 service 校验当前用户和资源归属；管理员权限在 service 校验，不依赖前端隐藏按钮。
- 默认拒绝本机、私网和链路本地上游。可信开发主机只能通过 `CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS` 精确放行；不要设置“允许全部私网”来绕过 SSRF 防护。
- 用户 API Key 保存在浏览器本地，任务创建时可能提交给自部署后端；只在可信部署和 HTTPS 下使用真实密钥。日志、错误上报、URL、localStorage 和持久任务正文不得写入敏感 URL、Cookie 或 API Key。
- 生产必须配置明确的 `CANVAS_CORS_ORIGINS`，保持 HTTPS，限制数据库、备份、数据目录和 `.settings-key` 权限；默认关闭公开注册。
- 数据库字段或表变化时同步更新 `docs/content/docs/backend/backend-database.mdx`，不能只改 GORM model。

## 6. 画布、UI 和设计系统

- 画布组件、状态、算法分别放在 `web/src/components/canvas/`、`web/src/stores/canvas/`、`web/src/lib/canvas/`。事件忽略选择器必须覆盖 modal、popover、dropdown 等浮层。
- 画布拖拽、连接、缩放和快捷键要考虑 pointer capture、滚轮冒泡、焦点以及 `data-canvas-no-zoom` / `data-canvas-wheel-scroll` 边界。
- 节点和对象名称要有可发现的铅笔入口并支持单击编辑；双击或右键不能是唯一入口。图片节点保持原始比例，面板不能长期遮挡主要画布空间。
- Ant Design 共性主题和控件状态集中在 `web/src/lib/app-theme.ts` / `AppProviders`。自带外壳的产品弹窗用 `AppModal flush`，侧栏用 `AppDrawer`；不要再复制 `padding: 0` 的 Modal styles。内容外壳仍是 `.ant-modal-container`。
- 第三方覆盖限定在具体组件，不新增全局 `.ant-modal-*`、`.dark .ant-switch-*`、`.ant-checkbox-*` 或 Segmented 状态补丁。新增 CSS 前先搜索同名选择器，回到唯一源规则修改。
- 遵循 `docs/ui-design-system.md` 及项目三层 token：Primitive → Semantic → Component。inline style 优先引用 `var(--token-name)`，不要散落颜色、圆角、阴影和层级字面值。
- 主操作、普通选中、Checkbox/Radio、Switch 是不同颜色角色；持久切换使用 `aria-pressed`，`type="primary"` 只表示当前主要命令。尊重 `prefers-reduced-motion`，键盘导航保留 `:focus-visible`。
- 修改既有页面时直接修改真实组件、样式和路由。不得创建独立 HTML 来代替真实页面验证；只有用户明确要求原型或隔离设计稿时才可生成，并放在临时目录或用户指定位置，不得放入 `web/public/` 或产品构建目录。

## 7. 本地开发、部署和数据目录

- 先阅读 `.env.example` 和对应 Compose 文件。宿主机后端开发必须使用 Git 忽略的 `.local/project-workbench-debug`，通过 `CANVAS_BACKEND_DATA_DIR` 显式指定；不要把 `backend/data` 当作开发账号数据库。
- 本地缓存放 `.local/cache`；不要提交数据库、上传文件、`.env`、真实密钥、构建产物或编辑器配置。
- 宿主机开发：`backend/` 运行 `CANVAS_BACKEND_DATA_DIR=../.local/project-workbench-debug go run ./cmd/server`，`web/` 使用 Bun 和 Vite；不要用 pnpm/npm 覆盖同一套 `node_modules`，也不要提交 `pnpm-lock.yaml` 或 `package-lock.json`。Docker 热更新使用 `docker-compose.dev.yml`；本地构建运行使用 `docker-compose.local.yml`。
- 用户要求“部署到服务器/云服务器/生产环境”且未指定方式时，默认采用 `scripts/install-server-image.sh` + 官方已发布 Release + `docker-compose.deploy.yml` + Host Updater；先确认该 Release 的镜像、更新器二进制和 `SHA256SUMS` 可用，按同一 Release 固定 `CANVAS_IMAGE_TAG` 和 `REPOSITORY_REF`。不要自行简化成 `web/backend` 两容器 SQLite 编排或生成替代 `compose.yml`；用户明确要求源码构建或轻量试运行时才选择对应方案，并说明在线更新边界。GHCR 拉取失败应排查网络、包可见性和认证，不静默切换为不受管源码部署。
- 生产 Compose 使用 `docker-compose.deploy.yml`（PostgreSQL、Redis、migrate、yingce-agent、backend、web）。源码构建可叠加 `docker-compose.build.yml`，但本地镜像不由 Host Updater 管理；`scripts/install-server.sh` 不安装更新器，不能当作在线更新安装入口。公网只暴露 web 的 `CANVAS_HTTP_PORT`（默认 `3000`），backend `8080` 留在 Compose 网络内。
- 诊断已有部署时，依据实际 Compose 文件、容器镜像、数据库驱动、数据挂载和 Host Updater 状态分别报告。源码构建不等于 local，SQLite 不证明使用了 `docker-compose.local.yml`，自定义文件名也不证明采用了任何仓库编排。已有 SQLite/自定义部署须先备份、迁移和验证，再转为受管部署；不要直接覆盖原 Compose 或数据卷。
- 默认不启动 dev server；只有用户明确要求浏览器预览或联调时才启动，并先确认端口、数据目录和现有进程。
- 健康检查只能证明入口可用，不能替代登录、SSE、任务生成和资源访问验证。

## 8. 验证纪律

项目当前默认不自动运行语法检查、类型检查、测试或构建（推送前例外，见下方「推送前验证」）。用户明确要求验证，或改动风险需要验证时，按范围选择最小充分命令，并在交付中如实记录：

- 前端：`cd web && bun run build`；专项测试用 `bun test ...`。UI 退场规则用 `bun run lint`（只禁 antd Empty 和静态 `Modal.confirm`，不是风格检查）。
- 后端：`cd backend && go test ./...`；涉及 PostgreSQL、资源、任务或权限时补对应集成/冒烟路径。
- 云端 Agent：前端事件流和审批路径依赖后端 `/api/agent` 接口；在该接口实现后补充后端冒烟、Worker 运行和 SSE 断线重连验证。
- 文档站：`cd docs && bun run types:check` 或 `bun run build`。
- UI 变更能浏览器验证时，检查关键路由、明暗主题、滚动、弹窗、空态和核心交互；不能验证时说明替代依据，不把静态阅读或 `git diff` 写成运行验证。
- 验证必须针对真实实现：优先专项测试、类型检查、项目 build 或真实路由浏览器验收。独立 HTML、静态仿制页面和脱离应用状态的截图不能作为真实页面通过的证据。

修改逻辑至少做相关测试、类型检查或最小运行验证；修改 API/服务至少做最小冒烟或集成路径验证；修改数据库或构建配置必须说明迁移、运行方式、回滚风险和版本约束；跨文件改动检查入口、调用方、配置边界、类型影响面和相邻测试。

同类失败连续三次时停止盲试，记录现象、已排除项和新假设，再切换路径或请求用户决策。

### 推送前验证（必须）

推送到 `main` 或任何会触发 CI 的分支前，必须在本地通过 CI「Quality checks」中与改动相关的检查；未通过不得推送，也不要推送后再看 CI 修。

1. `git fetch` 后把本地提交 rebase 到最新的远端分支，再验证要推送的那组提交；工作区应干净（未提交改动会混进验证结果）。
2. 在仓库根目录运行 `bun scripts/verify-before-push.mjs`。脚本按相对 `origin/main` 的改动挑选检查并行运行：
   - Web：改动文件格式（`check-changed-formatting.mjs`，与 CI 同口径）、`typecheck`、`lint`、`bun run test`（含 `pretest`）；改动路径含 `previs` 时加跑预演台 Chrome E2E。
   - 后端：`gofmt -l`、非 `internal/app` 包测试、`internal/app` 按 CI 方式分 4 片并行；装有 `golangci-lint` 时加跑 Agent 静态检查。
   - 每项输出写入 `.local/cache/verify/`，失败时打印末尾。`--jobs <n>` 控制并行数（默认 CPU 核数），`--all` 跑全部（含 E2E），`--only web|backend` 只用于迭代，推送前最后一次用默认范围。
3. 新增或修改的 `web/` 文件按 Prettier 格式化（`cd web && ./node_modules/.bin/prettier --write <文件>`）。只格式化本次改动的文件，不要对整个目录运行 `bun run format`。
4. 交付说明里列出脚本的总结行，以及「本地未覆盖」的项（支付插件双架构、缺少 PostgreSQL/Redis 时跳过的用例）；这些由 CI 兜底，推送后要确认 CI 结果。

迭代修改期间不必每次跑全量：只跑受影响的专项测试，最后推送前跑一次脚本。多个 Agent 同时工作时，各自在独立工作区或互不重叠的路径上验证，不要在同一工作区同时运行两份脚本。

## 9. 文档与交付

- 根 `README.md` 只保留项目定位、能力概览、快速开始、部署、安全和文档入口；详细专题写入 `docs/content/docs/`。
- 功能、代码地图、待办、待测试分别维护在 `docs/content/docs/overview/features.mdx`、`docs/content/docs/backend/code-map.mdx`、`docs/content/docs/progress/todo.mdx`、`docs/content/docs/progress/pending-test.mdx`。已实现但未由用户确认的变化先写入 `pending-test.mdx`。
- API、数据表、SSE、资源存储、部署或安全边界变化时同步对应专题文档；不要只改代码和根 README。
- 文档默认中文，不写过期日期，不公开密码、Token、Cookie、真实账号或机器敏感路径。命令、端口、环境变量必须以当前脚本和 Compose 为准。
- Git 提交说明使用 `<type>(<scope>): <业务模块> - <变更摘要>`，`type` 为 `feat|fix|refactor|perf|docs|test|build|ci|chore|revert`。

交付前至少检查：改动是否聚焦、调用方和类型是否同步、错误/权限/数据归属是否完整、必要文档是否同步、验证是否如实说明、是否留下密钥或本地数据。

## 10. SupDance 二次开发扩展约定

在进行 SupDance 专属定制、插件开发或上游版本同步时，请同时阅读并遵守 [`docs/supdance/WORKSPACE.md`](docs/supdance/WORKSPACE.md)、[`docs/supdance/ARCHITECTURE.md`](docs/supdance/ARCHITECTURE.md) 与 [`docs/supdance/CUSTOMIZATIONS.md`](docs/supdance/CUSTOMIZATIONS.md) 中的隔离与安全规则。

## 11. SupDance 全站 UI Design System 长期执行规范 (RULE 001 - RULE 016)

所有面向本项目的 AI 编程工具与协作者必须将 [`docs/design-system/README.md`](docs/design-system/README.md) 视为全站最高 UI/UX 执行标准。任何新页面、新组件、新插件或样式修改，必须严格执行以下十六条永久规则：

- **RULE 001 — Design System First**：任何新页面、新组件、新插件或 UI 改动，必须先阅读当前适用的 UI Design System 文档。严禁自造第二套样式标准。
- **RULE 002 — Token First**：优先复用已有 Design Tokens，禁止无理由新增硬编码颜色、字号、阴影与圆角。禁止裸写 `text-[Npx]`、`rounded-[Npx]`、`z-[99999]` 与裸 Hex 色值。
- **RULE 003 — Component Reuse**：优先查找现有共享组件（`@/components/ui/` 自研组件层或既有封装），禁止重复创造功能相同但视觉不同的冗余组件。
- **RULE 004 — Backend Appearance Priority**：后台正式外观配置（`/admin/settings/appearance`）在其受控范围内享有最高优先级，优先于默认主题和组件默认样式。
- **RULE 005 — Scope Isolation**：前台（Public）、后台（Admin）、生成岛（Studio）、画布（Canvas）、插件（Plugin）必须遵守各自样式作用域，严禁跨域样式污染。
- **RULE 006 — No Visual Regression**：UI 修改必须同时验证亮色与暗色模式及主要交互状态，不得破坏其他模块。
- **RULE 007 — Responsive Required**：新增 UI 必须同时考虑桌面、平板及移动端，移动端主要触控目标保持 ≥ 44×44px，输入控件不被软键盘遮挡。
- **RULE 008 — Complete Interaction States**：任何交互组件都必须具备必要的 Default、Hover、Active、Focus-visible、Selected、Disabled、Loading、Error 和 Empty 状态。
- **RULE 009 — Motion Consistency**：必须使用统一动效变量（80–320ms）并严格支持系统级减弱动效偏好 (`prefers-reduced-motion`)。
- **RULE 010 — Internationalization**：禁止在界面中直接硬编码中文文本，必须接入 `supdance-i18n` 词条体系，且布局必须为西文字符膨胀预留弹性空间。
- **RULE 011 — Accessibility**：遵循 WCAG 2.2 AA 标准，文本与背景对比度达标（正文 ≥ 4.5:1），纯图标按钮提供 `aria-label`，全键盘操作具备焦点循环捕获与恢复。
- **RULE 012 — Upstream Compatibility**：遵循二次开发隔离边界，尽量不直接修改上游核心文件；不可避免的修改必须在 `docs/supdance/CUSTOMIZATIONS.md` 中登记。
- **RULE 013 — Business Logic Protection**：纯 UI 修改不得无意改变模型计费、积分扣减、用户权限、支付流程、长轮询任务生成等核心业务逻辑。
- **RULE 014 — Verify Before Completion**：AI 不得仅凭编译成功就声称 UI 开发完成。必须完成适用的运行态与合规测试检查（如 `bun test test/design-system-compliance.test.ts`）。
- **RULE 015 — No Silent Exceptions**：如果业务需求确实需要偏离规范，必须在交付报告或 PR 中明确记录偏离原因、影响范围和审批结果。
- **RULE 016 — Future AI Agent Compliance**：以后任何 AI 编程任务开始前，必须主动确认相关 Design System 规范，不得依赖用户每次重新提醒。


