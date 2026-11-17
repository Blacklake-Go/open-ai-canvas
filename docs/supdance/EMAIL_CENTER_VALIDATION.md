# 邮件中心候选验证记录

本记录对应独立分支 `codex/email-center-candidate-20261117`。验证对象是实际 Go 服务、React 路由、数据库迁移和本机 SMTP 捕获器；不是独立 HTML 仿制页面。生产只做了只读审计，没有生产切换、DNS 修改、SMTP 登录或真实外发。

## 环境与证据范围

候选基线、生产产物哈希及不能确定的完整源码对应关系见 [候选报告](./EMAIL_CENTER.md)。原工作区的未提交修改保留，候选使用独立 Git worktree。

主要联调环境为独立 PostgreSQL 17 合成数据库、Redis 7.4 独立数据库编号、独立后端端口和 Vite 代理。本地真实页面 origin 为 `https://localhost:3172`，后端只绑定 loopback。Schema 为 106。管理员、联系人、旧模板和账务数据均为合成夹具，**不是恢复后的生产数据库**。

测试 SMTP 仅绑定本机 loopback，捕获器不具备转发逻辑。真实公开站点 Logo 被下载后上传到隔离环境，匿名读取的内容哈希与审计结果一致。捕获 MIME、临时 DKIM 私钥、本地 HTTPS 证书、数据库和运行日志都放在 Git 忽略目录，没有提交。

后期 Docker 中的 PostgreSQL/Redis 出现异常 CPU 占用、SQL 及连接超时；已暂停本任务专用容器，停止重复失败的浏览器操作。后续页面与 HTTP 补充验证使用另一份合成 SQLite 数据，不能把它当作生产 PostgreSQL 恢复验收。该轮临时启动器跳过与邮件无关的行业分类大数据导入，仍调用候选实际 service、handler 和 React 路由；该启动器没有进入产品或提交。临时不可用页面如实显示错误和重试，没有静默伪造空结果。

## 自动验证

| 范围 | 实际执行与结果 |
| --- | --- |
| Auth、邮件母版、领域渲染、数据库、repository | `GOMAXPROCS=2 GOMEMLIMIT=1GiB go test -p 1 ./internal/auth ./internal/emailtpl ./internal/supdance/emailcenter ./internal/database ./internal/repository` 通过；数据库包另提供隔离 PostgreSQL DSN，运行增量迁移保留测试 |
| 安全收尾 | auth 与 emailcenter 包再次通过，包含验证码不得出现在主题/preheader 的字面值检查 |
| Handler | `go test -p 1 ./internal/handler` 通过，约 85 秒 |
| App 邮件及消费日报 | 使用 `go list` 的实际 app 生产源文件集合，加 `supdance_email_center_test.go`、`consumption_report_test.go`，执行 `go test -p 1 -vet=off … -run 'TestEmailCenter\|TestConsumptionReport' -timeout 90s` 通过。全 app 测试编译曾因本机内存压力中止，未宣称全包测试通过 |
| Go 服务构建 | 候选真实 `cmd/server` 构建成功，并用于本地联调 |
| 前端质量 | TypeScript 检查、`bun run lint` 和 `bun run build` 通过；构建仍有既有模块动态/静态导入混用提示 |
| 前端专项 | `bun test test/design-system-compliance.test.ts test/supdance-extension-isolation.test.ts test/official-application-plugins.test.ts test/password-reset.test.ts`：24 pass，0 fail，1460 次断言 |
| Nginx | 用现有本地 Web 镜像挂载候选配置执行 `nginx -t` 通过 |

核心测试覆盖：

- 注册/找回密码原有限速、过期、重放、账号限制和发送失败路径；现有挑战语义保持不变。
- 受保护验证码、真实过期时间、预览无有效验证码、变量/HTML 注入、危险 URL 与开放跳转、未证实权益承诺拒绝。
- 草稿与发布指针分离、旧 JSON 归档、初始化重入、乐观锁冲突、历史回滚、按事件灰度和安全母版降级。
- 本机假 SMTP 的完整 MIME 与共用渲染器一致，包含 HTML/纯文本；DATA 已接受后 QUIT 失败仍为成功，最终 DATA 确认丢失为未知。
- 持久发送意图跨 service 重建仍去重、并发认领、未知结果不回放、营销保留容量与系统发送槽隔离。
- 明确订阅、抑制、排队后退订、暂停/取消、崩溃任务转未知、退订令牌用途与密文前缀校验。
- DKIM 本地签名与验签、签名覆盖两个退订头、修改后验签失败；这不证明真实域 DNS/收件结果。
- SQLite 和实际 PostgreSQL 新迁移保留原 SMTP 密文夹具、原始模板 JSON、历史日志及通知设置，七张新表按合同建立，历史 schema checksum 未重写。

## 真实后台页面

由主 Agent 直接操作 Playwright 的本地真实路由。以下结论只覆盖所列邮件中心场景，不表示全站逐页验收。

| 场景 | 观察结果 |
| --- | --- |
| 概览与品牌 | 11 个稳定模板事件，四份合成旧营销模板归档；真实 Logo 匿名 HTTPS 200；营销默认暂停 |
| 草稿/发布 | 页面修改注册模板并保存，发布指针先不变；点击发布后指针改变；历史 builtin 回滚成功 |
| 离开未保存内容 | 发现重复确认并修复；取消后输入保留，确认离开仅出现一次弹窗，重新进入显示已保存草稿 |
| 邮件尺寸 | iframe 实测宽度分别为 600、375、320；外层横向滚动承载宽预览，不把 600px 悄悄缩成容器宽度 |
| 长文本与禁图 | 通过普通预览变量输入 700 个连续字符；检查各尺寸、禁图与纯文本；预览中无脚本元素 |
| 明暗模式 | 实际后台亮/暗主题及邮件暗色模拟可切换，预览与编辑器来自真实组件；不视作邮件客户端兼容结论 |
| 系统模板测试 | 模板测试和原 SMTP 测试各捕获一封邮件；均带测试标记、HTML/纯文本，无有效认证验证码；非白名单地址返回 403 |
| 联系人与活动 | 合成已验证用户明确订阅；页面建立活动，按订阅来源分组，定时、暂停、恢复及取消成功；取消任务 attempts=0 |
| 队列与营销 | PostgreSQL 真实 worker 只向本机捕获器提交一封营销 MIME，测试执行时每日限额 1；队列 API 收件地址脱敏 |
| 暂时不可用 | Docker 故障期间日志/队列/操作记录显示真实错误，没有显示已送达或伪造送达率；恢复后的补充检查单列 |
| 移动端补测 | 390×844 实际页面无文档横向溢出，页面/root 宽度均为 390；桌面邮件编辑页与移动概览截图已直接查看 |
| 退订 HTTP 补测 | 从真实捕获 MIME 提取不透明链接；匿名 GET 后仍订阅，匿名 HTTPS POST 直接 200、无 Location、无登录 Cookie，随后偏好为未订阅；此 HTTP 验证使用合成 SQLite |
| 恢复后管理页 | SMTP 设置显示实际关闭状态；队列/日志成功返回新合成库空态，操作记录 API 与管理员访问审计补查；没有将空库当作原 PostgreSQL 历史数据 |

本地留证位于 Git 忽略的 `.local/cache/email-center/`，包括 `final-overview-light.png`、`final-system-light-320.png`、`final-marketing-dark.png` 及专项命令日志。文件中的本地地址和合成记录不是生产收件证据。

捕获器最终共三封 MIME：两封白名单系统/SMTP 测试，一封明确订阅用户的营销测试。营销 MIME 含单独收件人、HTML/纯文本、`List-Unsubscribe` 与 `List-Unsubscribe-Post`；DKIM 签名的 header 列表包含两者。`capture-validation.json` 保存布尔验证结果，不保存退订令牌。HTTP 补测后本地 SMTP 设置已关闭，营销执行开关仍为 false；没有外部收件证据。

## 收尾与未覆盖项

没有执行生产恢复库迁移、生产安装/灰度或旧镜像回退演练。Schema 105 程序不能直接连接 Schema 106；回退必须使用支持新 schema 的构建，保留新增退订、抑制、收据和审计。

没有执行全量 `go test ./...`、全部 Web 测试、推送前全量验证脚本、CI、支付插件双架构或 Linux 双架构镜像构建；本候选没有推送。没有冒充这些项目通过。

Gmail、Outlook、Apple Mail、QQ、163 均未实际收件或客户端验收。实际企业邮箱用途/额度/回执、DKIM DNS、From 对齐与真实 Authentication-Results 未核实。SPF/DMARC 只读查询结果及 TLS 握手范围见候选报告；营销仍默认关闭。退信/投诉自动同步和行为/转化指标没有接入。

生产执行前应先审查候选提交与基线差异，在授权的恢复库完成迁移与恢复校验，核实外层代理退订查询日志、DNS/发件配置和供应商许可，再对明确授权的白名单执行真实收件及代表客户端验收。正式营销须另行授权并设置已核实额度。
