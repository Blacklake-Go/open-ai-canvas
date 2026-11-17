# SupDance 邮件中心候选版本

插件 ID 保持 `supdance-email-marketing`，显示名为「邮件中心」，候选版本 `1.1.0`。这是独立分支上的开发候选；未切换生产、未修改 DNS、未使用生产 SMTP 外发，也没有真实收件证据。

## 部署基线与证据边界

只读核实的主站是 Go / React ONE，仓库为 `Blacklake-Go/open-ai-canvas`。目标线索中的 `lib/emailService.js`、Nodemailer 和 Next.js 邮件代码属于另一套旧系统，本候选没有修改它们，也没有修改独立的 OpenAI 插件仓库。

线上后端镜像名称包含 `email-marketing-20261117`，镜像标签元数据仍声明 `c7767d0992f218bc7d7609585964a3b1fca1f02f / v1.8.5-supdance.7-payment`。实际二进制的 Go build info 是 `vcs.revision=766010c63c2de3ea594ec6ac5bbd6b141a127286`、`vcs.modified=true`。因此不能把镜像标签冒充完整、干净的生产源码提交。

以下两项产物与本地留存文件逐字节一致：

| 产物 | SHA-256 |
| --- | --- |
| 生产后端二进制 | `bb4602dedfe98ff42136107b066f816abd156bc69ff0c8f05723dee21297eff6` |
| 生产 `email-marketing-manager-DpsMlOYy.js` | `2de453d12b947a8d6114e96c02bb57b4cac04a62e8860bb4d442af682258462c` |

前端运行镜像另挂载了 `email-marketing-20261117` 发布静态文件；不能仅看容器镜像标签判断当前页面内容。实际数据库为 PostgreSQL 17、Schema 105，协调服务为 Redis 7.4。候选从已提交且包含 Schema 105 的 `c7767d09` 建立，邮件插件现状单独留存在提交 `a5983087`；这仍不意味着候选基线与生产所有未提交文件完全相同。

只读配置核实：账户邮件已启用，主机为 `smtp.exmail.qq.com:465`，直接 TLS，保存的显示名是 `Supdance`。运行时与管理响应将这一品牌拼法规范成 `SupDance`，不自动改写原 SMTP 设置或密码。品牌来自 `system_settings.appearance`；客服与页脚复用现有 HTML 页脚配置。核查时未发现 `plugin.supdance-email-marketing.templates` 持久化记录，线上四套页面内容来自 v1.0 默认模板；迁移仍支持保留以后发现的已保存旧配置。

真实 Logo 的匿名 HTTPS GET 返回 PNG，原始尺寸 198×182，内容哈希为 `62345460d5fa7b8f23640aede203da6b86e1f7eb9e4cf67d020427b1a707f233`。候选不硬编码观察到的 `?v=` 参数，按实际外观资源读取并保存不可变图片快照。

## 后台与技术边界

主入口 `/admin/email-center`，旧入口 `/admin/plugins/email-marketing`、`/admin/email-marketing` 继续进入同一组件。原 `/admin/settings/email`、`/admin/email-logs` 保留，邮件中心直接复用其组件和 API。八个分区为概览、系统邮件、营销邮件、品牌与模板、联系人与偏好、SMTP 与发送策略、发送记录、版本与操作记录。

职责分配：

- `internal/supdance/emailcenter`：稳定事件目录、变量合同、内容模块、HTML 清洗、URL 策略和纯渲染；不读数据库、不发信、不生成凭证或权益。
- `internal/auth`：既有认证挑战、权限约束、SMTP 连接、发送容量隔离、测试白名单和投递结果分类；所有现存邮件最终经过同一个 `deliverEmail()`。
- `internal/app/supdance_email_*`：品牌继承与素材快照、后台编排、发布/回滚、营销活动和订阅策略。
- `internal/repository/supdance_email_*`：不可变版本、乐观锁、发送意图唯一性、联系人和持久化任务。
- 插件前端：后台组件、`--admin-*` 令牌、`supdance-i18n`、服务端预览、空沙箱 iframe；不在浏览器执行模板代码。

系统邮件不查询个人插件安装/启用状态。营销总开关、活动暂停和营销退订不会关闭符合条件的账户邮件。永久无效地址及供应商封禁会阻止所有类别发送；投诉、退订等营销抑制不被用来关闭必要账户邮件。

## 邮件事件覆盖表

全部现存入口已接入统一服务。表中“迁移”指候选代码接入，**不表示生产已切换**。当前邮件语言保持既有 `zh-CN`；新增 UI 使用国际化字典，部分其他界面语言采用英语回退，没有宣称已完成人工翻译。

| 事件 / 模板 key | 调用文件 | 触发条件 | 类别 | 必填数据 | 语言 | 开关 | 频控 / 幂等 | 日志 | 迁移 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `registration` | `auth/email.go` | 注册验证码及重发 | security | 代码、真实到期时间、收件人；受保护 code 模块 | zh-CN | 原账户邮件与注册策略 | 原域名规则、60 秒冷却；挑战 ID + 地址 + 意图 | 统一日志与 receipt | 已接入 |
| `password_reset` | `auth/password_reset.go` | 合法密码账号找回密码 | security | 同上 | zh-CN | 原账户邮件策略 | 原限速、枚举防护、第三方账号邮箱验证限制；挑战 ID | 同上 | 已接入 |
| `verification` | `auth/verification.go` | 现存身份/敏感操作验证码 | security | 代码、到期时间、收件人、服务端决定的认证用途 | zh-CN | 原账户邮件及认证条件 | 原共享通知配额、小时/日额度、一次性票据；验证 ID | 同上 | 已接入 |
| `profile_email` | `auth/account.go` | 当前凭据校验后向新邮箱发验证码 | security | 代码、到期时间、新地址 | zh-CN | 原账户邮件策略 | 原 60 秒冷却、共享配额、会话/凭据绑定；验证 ID | 同上 | 已接入 |
| `email_changed` | `auth/account.go` | 成功变更邮箱后通知旧地址 | security | 服务端生成的安全说明、脱敏新地址 | zh-CN | 原账户邮件策略 | 成功变更的验证 ID，不能重复创建 | 同上 | 已接入 |
| `consumption_report` | `app/consumption_report.go` | 已订阅且当日有消费的用户 | notification | 真实积分账务报告及账务摘要主题 | zh-CN | 原账户邮件 + 消费日报偏好 | 原跨实例租约、用户/日期条件领取；用户 + 日期 | 同上 | 已接入 |
| `test` | `auth/email_admin.go` | 原 SMTP 设置页测试 | test | 服务端测试说明，无有效凭证 | zh-CN | 原账户邮件 + 服务器测试白名单 | 每管理员每小时最多 10 次；分配独立测试意图 | 同上 | 已接入 |
| 系统/营销模板测试；日志 purpose=`marketing_test` | `app/supdance_email_marketing_plugin.go` | 管理员测试任一草稿 | test | 纯预览数据；验证码仅显示圆点 | 模板语言 | 原账户邮件 + 测试白名单 | 同一测试配额，不创建认证挑战 | 测试标记、审计与 receipt | 已接入 |
| `welcome` | `app/supdance_email_campaign.go` | 获明确订阅后的引导内容活动；不新增注册自动触发 | marketing | `name` | zh-CN | 营销执行门禁、平台插件开放、账户总开关 | 活动 + 地址 + 意图；发送前再检查订阅与抑制 | 同上 | 已接入，执行默认关闭 |
| `newsletter` | 同上 | 经核实的产品更新、教程或案例 | marketing | `update_title`、`update_body` | zh-CN | 同上 | 同上 | 同上 | 同上 |
| `credit_alert` | 同上 | 方案/账户入口介绍，未虚构余额或优惠 | marketing | `name` | zh-CN | 同上 | 同上 | 同上 | 同上 |
| `winback` | 同上 | 回归创作邀请，不自动创建回归礼 | marketing | `name` | zh-CN | 同上 | 同上 | 同上 | 同上 |

源码扫描未发现本系统已有的用户名/账号找回邮件、密码变更/重置成功通知、支付/退款/订阅交易邮件、MFA、异常登录、注销或生成完成邮件入口；这些项目标记为不适用，没有为凑清单新建业务事件。旧四套营销卡片没有实际余额告警调度器，也没有赠送权益实现；因此没有把“余额通知”伪装成现存系统事件。

## 母版、编辑与认证安全

统一母版包含 preheader、真实 Logo 和文字品牌、标题、内容、操作入口、帮助与分类页脚，输出 HTML 与纯文本。模块覆盖标题、段落、图片、图文卡片、步骤、提示、摘要、按钮、功能亮点、作品封面、受保护验证码与账务报告，以及经清洗的 HTML。视频/音乐通过封面和允许的站内 HTTPS 链接展示，不使用脚本、iframe、表单或自动播放。

真实 Logo 和邮件图片保存为内容哈希寻址的公开快照，不依赖 Cookie 或短时签名。品牌完整公开字段另以 `sd.email.brand.<hash>` 存入原有 `system_settings`，该键长度符合原表限制；快照不构成第二套可编辑品牌配置。

预览 600/375/320px、禁图、纯文本、HTML 源码和暗色模拟都调用服务端同一渲染器。预览 iframe 使用 `sandbox=""` 和 `referrerPolicy="no-referrer"`。暗色模拟是浏览器检查工具，不是 Gmail、Outlook 等真实客户端兼容证明。

认证挑战继续由原流程随机生成六位数字、保存哈希并执行时效/单次使用/冷却/会话和凭据检查。模板不接收可编辑验证码或收件人。真实有效期从挑战的 `ExpiresAt` 计算；代码只进入受保护正文模块，不进入主题、preheader、预览、审计或普通日志。模板异常时使用验证过的内置安全母版；品牌读取异常的账户邮件可降级为文字品牌，并记录不含敏感值的告警。账户总开关和业务认证规则仍有效。

必需变量、保护模块、上下文转义和 URL 策略在发布/发送时强校验。HTML 使用解析器及标签、属性、CSS 白名单清洗；外站链接、脚本、表单、iframe、事件处理器、CSS URL、危险协议和跳转参数被拒绝或移除。图片与 CTA 只允许指定站内公开目标。没有接入真实权益证明的赠送、到账、优惠等承诺在发布和实际变量展开后均被拒绝；模板不能发积分或创建权益。

## 可靠性、订阅与状态

认证不排队敏感正文；营销任务只保存允许的非认证变量和固定模板版本。系统发送拥有四个独立连接槽，营销拥有一个连接槽，营销另限每分钟 10 次，且必须显式配置每日营销额度。该额度需在核实企业邮箱实际用途和总量后设置，并给账户邮件保留供应商容量；应用连接隔离不能证明供应商剩余额度。

活动支持草稿、按明确订阅来源分组、定时计划、暂停、取消和状态计数。每次计划最多 1000 个明确同意的联系人，注册不自动订阅。排队后、实际 SMTP 前都会检查营销订阅、scope 和抑制状态。暂停/取消不会撤回 SMTP 已接受的邮件。

发送意图唯一键绑定事件、收件人和业务意图，不包含模板版本。并发和重启不能通过换版重新创建同一发送。SMTP 明确临时拒绝或发送正文前的临时网络错误允许最多三次尝试，按 1/4 分钟退避；永久拒绝不重试。正文发送/最终确认失联记为 `unknown`，超过五分钟仍在 `sending` 的营销任务也转为未知，不自动回放或切换供应商。

日志保留原 90 天规则，不存正文或验证码；新 receipt 保存事件、模板、品牌哈希、通道、Message-ID、阶段和耗时。既有 `email_logs` 的 36 字符主键宽度不变，receipt 通过独立的 32 字符 `log_id` 关联。状态包含 SMTP 已接受、明确失败、策略抑制、取消、未知及排队状态。没有接收方服务器回执时，不显示已进收件箱或送达率；打开/点击、登录/首作/导出关联指标均未接入，没有伪造指标。

退订遵循 [RFC 8058](https://www.rfc-editor.org/rfc/rfc8058)：正文提供入口，GET 仅展示确认页，HTTPS POST 不依赖登录、二次确认或重定向。令牌用现有设置加密密钥加密并限制营销退订用途，不在 URL 暴露地址。发送时生成 `List-Unsubscribe` 和 `List-Unsubscribe-Post`，本地 DKIM 签名明确覆盖两者。签名配置完整仍不代表 DNS 或真实收件验证通过。

应用访问日志不记录查询串；候选 Nginx 对退订路径关闭 access log。生产外层代理须同步检查，不能假定容器配置能覆盖宿主机代理日志。

## 数据与 API

Schema 106 新增七张 `supdance_email_*` 表：templates、revisions、receipts、contacts、brand_assets、campaigns、jobs。原 SMTP 设置、原四模板 JSON、email_logs、认证挑战、消费日报订阅、账务和权限表均不被重置。详细字段合同见 [数据库文档](../content/docs/backend/backend-database.mdx)。

管理 API 主前缀 `/api/admin/email-center`，旧插件 API 前缀 `/api/admin/plugins/supdance-email-marketing` 共用同一组新处理器。提供 overview、initialize、模板 draft/publish/preview/test、图片素材、campaigns、queue 和 activity。所有写请求限体积并在 service 验证管理员。旧 raw HTML 整批覆盖配置和裸测试 API 不再作为可绕过发布合同的写通道；旧后台页面地址兼容，新页面使用新合同。

账户偏好为 `GET/PUT /api/auth/email-center/preference`。公开图片为 `/api/public/email-center/brand/:hash`，公开退订为 `GET/POST /api/public/email-center/unsubscribe`。发送记录仍走原 `/api/admin/email-logs`，附加 receipt 元数据；读取时脱敏收件人并记录管理员访问。

## 迁移、灰度与回退

1. 将当前已发布产物、数据库备份和 `.settings-key` 保存在授权的备份位置。先在隔离恢复库运行候选迁移，并核对原 SMTP/模板/记录/订阅；本任务没有恢复或切换生产数据库。
2. 使用同一候选提交构建后端和前端。显式提供实际驱动与连接，先运行 `bash tools/supdance/email-center/migrate.sh status`，再在批准的目标运行 `... up`、`... verify`。脚本没有默认数据库，也不打印连接字符串。
3. 后台执行“初始化并保留旧模板”。它是可重入操作，逐事件建立内置发布版本，并将已保存的旧 JSON 留为 `legacy` 历史版本；原设置不改写。旧 HTML 原文可审查、转换成清洗模块后重新发布，不能直接执行或发布旧原文。营销持续暂停。
4. 用捕获器或已明确授权的白名单邮箱验收。`CANVAS_EMAIL_TEST_RECIPIENTS` 为空时，所有真实 SMTP/模板测试收件人被拒绝。
5. 使用 `CANVAS_EMAIL_CENTER_ROLLOUT_EVENTS` 按事件选择正式发布模板；未选事件使用同一邮件服务中的安全内置模板，不会走新旧两条实际发送路径。空值使用各事件已发布版本。营销还有独立的执行开关、平台开放和额度/DKIM 门禁。
6. 发生问题时先设置 `CANVAS_EMAIL_CENTER_SAFE_MODE=true`、`CANVAS_EMAIL_MARKETING_ENABLED=false`，并暂停活动。可以回滚某个模板的发布指针。所有版本、发送收据、退订、抑制和审计保留，不回放已处理意图。

旧 Schema 105 程序会拒绝连接 Schema 106，**不能直接把旧镜像切回新库，也不能删除迁移记录冒充降级**。代码级回退应使用支持 Schema 106 的修复/回退构建；数据库恢复须离线验证并合并新增退订、抑制、收据与审计。本候选没有提供会丢弃这些记录的 down 脚本。

## 发送域核查与未完成验收

只读 TLS 握手验证了 `smtp.exmail.qq.com:465` 的受信任证书和 TLS 1.3；没有登录 SMTP 或发送邮件。本地 DNS 查询在 `supdance.com` 和 `_dmarc.supdance.com` 未得到 SPF/DMARC 记录。DKIM 实际 selector、From/Return-Path 对齐和真实 Authentication-Results 没有邮件原始头作为证据，不能判定已通过或已失败。腾讯企业邮箱具体套餐、用途限制、实际额度及回执能力也未核实，不能借用另一产品“腾讯云邮件推送”的限制值。

生产上线、域认证调整、真实白名单测试、真实活动启动仍待本任务之外的明确执行授权。真实 Gmail、Outlook、Apple Mail、QQ、163 客户端均未验收；退信/投诉自动接入、可核验收件方回执、实际打开/点击/站内转化分析未接入。复杂旅程和 A/B 测试不在本候选范围内。

本地自动测试与浏览器验收结果见 [候选验证记录](./EMAIL_CENTER_VALIDATION.md)，必须与实现、生产状态、真实收件分别阅读。
