# Visual Engine 宿主审计与适配清单
## 已核实架构
上游基线 v1.7.3.4，当前宿主构建 v1.7.4-supdance.2、Schema 78。前端 React 19、Vite 8、Bun、AntD、Tailwind、Zustand；后端模块声明 Go 1.25，Gin/GORM，生产 PostgreSQL、Redis 和独立 yingce-agent。原开发 checkout 有其他修改，本任务使用隔离 worktree；不覆盖原目录。

## 页面及组件矩阵
| 页面/范围 | 实际路由 | Token 与组件 | 接入及边界 |
|---|---|---|---|
| 注册/登录/重置 | /register、/login、/forgot-password、/zh/login | AppProviders、表单、按钮 | 共享主题；认证/next 策略保持宿主权威 |
| 创作入口 | /、/create | Composer、模型/参数选择、任务提示 | 语义变量、AntD、Canvas Theme 扩展；不改变生成 |
| 图片/视频/音乐 | /toolbox/image、/toolbox/video、/toolbox/music | 统一参数、模型菜单、状态 | 同应用适配；不声称真实收费生成通过 |
| 自由画布 | /canvas、/canvas/:id | CanvasToolbar、ZoomMenu、AgentPanel、节点 | 显式画布配色扩展，传递安全颜色而非向 Canvas2D 写 CSS var |
| 项目/分集 | /projects、/projects/new、/projects/:projectId、/projects/:projectId/e/:episodeId | 列表、表单、弹窗、面板 | 全局 Theme/语义 Token；数据读写保持宿主 |
| 资源/历史 | /assets、/tasks | AssetLibraryCard、媒体、状态 | 语义表面/遮罩渐变；资源操作不改 |
| 用户与积分 | /settings、/wallet、/referral | 表单、Tabs、Table、Modal | 视觉适配；积分、订单、支付不改 |
| 技能/插件 | /skills、/skills/:skillId/edit、/plugins、/plugins/eagle | 列表、控件、浮层 | 同应用主题；外部 Eagle 不由本插件控制 |
| 分享 | /share/canvas/:token | 画布只读展示 | 权限及资源仍由分享 API 决定 |
| 后台 | /admin/* | AdminShell、AntD、各业务管理页 | 保持宿主原生风格；只新增两个入口 |
| Visual Console | /admin/plugins/visual-engine | 插件内部 16 模块 | 单控制台；/admin/visual-engine 仅重定向 |
| 第三方授权 | 宿主 social-auth API/回调 | 宿主授权状态 | 不接管账号绑定、OAuth 或短信 |
| 独立子域名/独立音频应用 | 未核实独立前端路径 | 不推定共享 React | 保持未验收，需单独适配 |

## 最小宿主扩展
主题刷新前后钩子、浮层 styles 扩展、canvasThemes 显式解析器与订阅、AppProviders 的 UI fallback/扩展槽、脱敏 startup 事件订阅、已有路由/插件目录/侧栏挂载、鉴权及存储事务端口。完整源文件白名单见 compatibility.ts 与 baseline.json，自动测试核对存在性和一致性。

静态 import 的模块缓存不会因卸载物理消失；热插拔验证以停止增强、移除活动注册、导航及监听、恢复颜色与样式为准。源码独立目录与宿主适配文件分别交付。上游缺少这些接口时原生降级，而非重写业务。

## 风险与回滚
宿主皮肤优先于插件共享字段；后台主动隔离。配置原子发布和版本快照，旧草稿拒绝覆盖。源码发布使用不可变 release、原配置和数据库备份、旧镜像及挂载指针；失败恢复旧服务再核验。外部模型、支付与独立子站没有被本插件改写或伪造成功。

