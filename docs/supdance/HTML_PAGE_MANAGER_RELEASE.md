# HTML 页面管理后台生产发布记录

## 版本与提交

- 发布版本：`v1.8.5-supdance.4-html-admin`。
- 功能提交：`4f6f5f72c49d8bb67471f647486cfc311b4fab7c`。
- 前置提交：`25f4c949`，独立收录此前已上线的法律页、品牌页脚、定价页与登录页修改；同步测试断言到现有登录外壳行为。
- [Release 与校验附件](https://github.com/Blacklake-Go/open-ai-canvas/releases/tag/v1.8.5-supdance.4-html-admin)。
- [主分支流水线](https://github.com/Blacklake-Go/open-ai-canvas/actions/runs/43436834089)与[标签流水线](https://github.com/Blacklake-Go/open-ai-canvas/actions/runs/43436842197)均成功，包含前端、后端、Agent 静态检查、支付插件双架构验证与 Chrome E2E。

## 构建与部署

| 项目 | 固定值 |
| --- | --- |
| Web 镜像 | `ghcr.io/blacklake-go/open-ai-canvas-web@sha256:a01bef2b88f383158f8aabe3223e511393148f4f55323ba606b8b82db35969ad` |
| 后端镜像 | `ghcr.io/blacklake-go/open-ai-canvas-backend@sha256:72c7bb14f3a38efd71cf98b66034f4d1b8de53bca8887052296465f4e5353110` |
| 数据库 | PostgreSQL，Schema 102/102，无迁移 |
| Agent | 保留原运行容器与固定镜像 |
| 发布方式 | 沿用现有 Compose 与 Web 发布目录挂载，保留历史散列资源 |

镜像 revision 标签均与功能提交一致。Release 中的 amd64、arm64 更新器附件通过 SHA-256 校验；本次不替换宿主更新器、定期清理策略或 systemd 定时单元。

发布前已保存原配置、镜像与挂载信息，并制作可完整列出内容的 PostgreSQL 备份。仅更新 Web 和后端；PostgreSQL、Redis 与 Agent 容器 ID 保持不变。切换期间观察到短暂 502，发布资源完成后公网入口恢复 200，两个服务均为 healthy，就绪接口报告新版本和对应提交。

## 验证

- 本地推送前门禁：共 13 项，失败 0 项；前端全量 3943 通过、0 失败。
- 本地使用仓库指定 Bun 1.3.9。为避免整套 DOM 测试与后端并行编译造成资源争用，最终门禁串行执行，并使用 Bun 官方 `--smol` 模式；未放宽原测试断言和超时。
- 本地未覆盖的支付双架构产物、Agent 静态检查、PostgreSQL/Redis 依赖用例由已通过的云端流水线补齐。
- 线上真实 Chrome：桌面 1440×1000、手机视口 390×844，亮暗主题下三个后台区域均可访问且没有整页横向溢出；模板库与新建弹窗正常，预览 iframe 为 `allow-scripts`，页面运行错误 0。
- 后台只读验收前后，对页面和页脚的业务内容摘要进行比较并保持一致。默认配置的动态 `updatedAt` 不参与内容摘要。
- 六语言服务条款和隐私政策共 12 页均显示对应语言的正文和十个章节。定价页法律链接与品牌图片可用。
- 登录入口显示实际表单，视频保留 muted、autoplay、loop 属性；登录页运行错误 0。此次未提交真实登录或第三方授权。
- 临时验收会话已撤销，未修改现有账号权限；没有在生产执行新建、保存、重置或生成请求。
- 定期清理 service/timer 指纹检查通过，timer 保持 active。

本轮手机检查为浏览器视口模拟；实体触屏、软键盘和人工译文审校不作为已完成验收。

## 回退材料

部署目录内保留 `backups/html-admin-20261113/`，包括原环境配置、Compose、镜像与容器记录、数据库备份及 `rollback.sh`。回退脚本恢复旧镜像和旧 Web 发布目录；因没有 Schema 变化，不主动回退数据库。

回退会覆盖本批发布指针；若之后已有其他版本上线，须先核对当前版本及配置，避免覆盖后续发布。
