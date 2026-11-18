# 邮件八语言与页面管理候选验证

验证对象为第一阶段提交 `26b351fc` 之后的真实 Go/React 候选代码。生产没有切换，没有修改 DNS，没有使用生产 SMTP 登录、真实外发或启动批量营销。第一阶段的独立审计与结果保留在 `EMAIL_CENTER_VALIDATION.md`，本页只记录新增能力。

## 自动化证据

- `maillocale`：原生八语顺序、语言地区/权重匹配、非法范围跳过、词条完整性与格式参数一致性。
- `emailcenter`：88 个事件/语言组合、HTML 与纯文本、受保护代码、八语营销权益声明限制、Unicode 元数据长度与展开后的长度限制。
- `emailtpl`：八语实际消费日报、数值分隔、星期和洞察；原始名称与模型标识不翻译，原计算和中文报告合同保留。
- `auth`：八语通过真实本机 SMTP socket 捕获 MIME，核对主题、HTML lang、正文、受保护凭证与收据语言；保存偏好优先于匿名提示；修改语言不重发同一意图；注册和第三方补邮箱入口覆盖。最终邮件域与认证日志为 `i18n-final-backend.log`，认证包通过耗时 42.864 秒。
- App 专项使用 `go list` 的实际生产 GoFiles，加邮件中心、语言与消费日报测试执行；通过日志 `i18n-app-complete.log`。覆盖分语言草稿/发布/历史回滚与跨语言拒绝、语言更新不改变同意/抑制、八语活动版本及缺译拒绝、正式外观 Logo 替换与历史素材保留、WebP 像素/尺寸保留。
- SQLite 和隔离 PostgreSQL 的 Schema 106→107 保留与重入测试通过，`i18n-migrations.log`，总耗时 33.37 秒；没有修改既有迁移身份或校验和。PostgreSQL 只使用合成测试数据。

最终处理器全包测试通过，`i18n-final-handler.log`，耗时 436.821 秒。默认优化的大包处理器编译曾遇到主机内存压力并终止，随后使用 `-gcflags='yingce/backend/internal/app=-l'` 关闭 app 内联优化完成同源检查。正式 `cmd/server` 也以该选项构建通过，`i18n-final-server-build.log`。该选项只用于本地验证，不修改项目构建配置。

前端最终 `bun run typecheck`、`bun run lint`、`bun x vite build` 均通过，日志分别为 `i18n-final-typecheck.log`、`i18n-final-lint.log`、`i18n-final-web-build.log`。类型检查曾发现未登录语言保存函数可能返回空值，已统一为 async Promise 后重跑通过。构建耗时 4 分 28 秒，保留现有动态/静态导入混用等提示，没有将提示改写为零警告。

五个前端专项文件的最终聚合运行是 25 pass / 1 fail / 2475 assertions，唯一失败为既有模型选择器子进程外层 30 秒超时，见 `i18n-final-web-tests.log`。邮件八语词条、设计系统、补丁登记、插件清单与密码重置专项均通过；没有修改测试断言或产品逻辑来消除超时。独立运行真实 `compact-model-picker.harness.tsx` 并将默认用例超时放宽为 30 秒后，15 pass / 0 fail / 101 assertions，耗时 34.16 秒，`i18n-picker-harness-relaxed.log`；覆盖模型状态、报价、选择、管理员草稿/失败重试、音乐工作台及法律页脚。原聚合外层限制仍未通过，不将独立结果写成聚合全绿。

## 实际页面证据

实际页面入口为隔离 HTTPS 本地服务，使用独立合成 SQLite 数据和真实 React 路由。PostgreSQL 迁移测试独立通过，但 Docker/Redis 超时导致该套预览启动失败，页面验收切换到独立 SQLite。临时启动器只省略无关的大型电商/行业知识库导入，邮件、认证、权限、模板、品牌与页面管理均使用真实源码。

- 旧 `/admin/plugins/email-marketing?section=system&emailLocale=ja-JP` 实际跳转到 `/admin/plugins/page-management?section=system&emailLocale=ja-JP&page=email`，页面出现模型展示、HTML 页面、邮件中心三个分区。
- 英语、繁中、西班牙语、法语、德语、韩语、日语实际切换成功；每次 iframe HTML lang 对应所选代码，受保护代码为占位，脚本数为 0，并展示真实站点 Logo。构建产物又确认简体中文 `zh-CN` 预览与旧入口跳转，八种语言均覆盖。
- 600/375/320 三档边框内宽分别 598/373/318，内容 scrollWidth 与其一致；页面无横向溢出。真实页面截图为 `i18n-japanese-desktop.png`，已检查 Logo 和日语排版。
- HTML 分区实际显示原有五个页面与模板编辑器，没有复制或新建另一份页面数据。
- 通过聚合页切到模型展示，实际显示原简洁选择器设置、简介/报价开关、画廊全局/首页开关及合规锁；未保存或改变这些业务设置。邮件草稿离开时只出现一个确认框，取消后主题保留；确认后能进入真实 HTML 模板工作台。
- 全局菜单切为法语，重载后页面 `lang=fr-FR`，真实会话中的 `preferredLocale=fr-FR`。模板语言参数独立保留。拦截本地语言 PUT 模拟 503 时，页面与服务端仍为法语，显示法语保存失败提示，没有假装切换成功。
- 在本地正式外观 API 上传合成 PNG 并切换 Logo，触发返回窗口的品牌核对后，iframe 自动使用新哈希图片；未保存主题完整保留。新旧图片在无 Cookie context 中都为 200。随后通过同一正式 API 恢复原 Logo，核对预览恢复成功；没有改动生产外观。
- 390×844 手机和 820×844 平板下 document.scrollWidth 等于视口宽度；法语后台与德语模板组合已检查。手机亮暗主题截图为 `i18n-french-mobile-light.png`、`i18n-french-mobile-dark.png`，已视觉检查。

开发服务重载曾遭遇本地启动资源超时，连续同类超时后停止反复尝试开发服务，切换构建产物完成上述后续验证。浏览器选择器也曾因 AntD Tab 辅助文字、按钮名称导致超时，按实际 DOM 修正后继续检查，未据此改动产品。八种邮件内容与发送合同的覆盖以实际 SMTP、渲染和业务专项结果为准；没有重新启用 SMTP 做额外 UI 外发。

## 验证边界与环境清理

本轮没有执行全部仓库 Go/Web 测试或推送前 Quality checks，没有推送。全 app 测试曾受内存限制，本页不宣称全包通过。相关 Go 域/认证/处理器、App 专项、双数据库迁移、前端类型/Lint/构建与上述实际页面分别记录；原前端聚合超时单独保留。

本轮 36 个修改 Web 文件的 Prettier 检查通过，`i18n-final-format.log`；Go 文件已 gofmt，`git diff --check` 与暂存内容的密钥模式检查通过。未提交 `.local`、数据库、MIME、密钥或构建产物。

验收结束确认本地 SMTP 仍关闭，未启用营销 worker。任务专用后端、构建预览与 HTTPS 代理已停止，浏览器 QA 页面已关闭，临时合成会话 Cookie 状态文件已移除。原 Logo 已恢复，未触碰原有开发工作区或生产配置。

没有生产快照恢复、生产迁移、上线、DNS 或旧镜像回退演练。Schema 105/106 旧程序不能直接使用 107 数据库；回退需要支持新增结构的构建，保留偏好、版本、退订、收据和审计，不回放发送事件。

没有真实外部收件、Authentication-Results、Gmail/Outlook/Apple Mail/QQ/163 客户端显示、实体手机软键盘或辅助技术验收；八语翻译未经过原生语言人工审校。历史自定义正文和站点品牌字段保留原文，不宣称已自动翻译运营保存内容。

测试容器 Redis 已停止。任务专用 PostgreSQL 初次停止时 Docker 报告未收到退出事件，期间未反复强制操作或重启整个 Docker；最终只读 inspect 已确认 `status=exited`、`running=false`。容器只含合成数据，先前停止报错与已通过的 PostgreSQL 保留测试分别记录。
