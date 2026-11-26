

## AI Pose Gallery 子路径部署

- 线上静态应用来源固定为 `https://github.com/Blacklake-Go/ai-pose-gallery-zh`，部署在 `www.supdance.com/pose/` 与 `one.supdance.com/pose/`。
- 上游按站点根路径构建。`supdance/pose-subpath` 的 `8b386bb`、`8e33220` 只增加 `/pose/` 的 Vite base、路由 basepath、素材与代理路径适配，不改图库内容、生成协议或权限。
- 2026-11-25 生产目录切换到 `ec7a81e` 加上述适配；旧目录保留为 `pose.bak-20261125`。`www.supdance.com` 与 `one.supdance.com` 分别补齐 `/pose/` 静态路由，并保留配置备份。
- `/pose/api/proxy` 由 `scripts/supdance-proxy.ts` 打包为 `127.0.0.1:4187` 的 systemd 服务 `supdance-pose-proxy`，复用 `functions/api/proxy.ts` 的默认白名单、10 MiB 请求体限流与重定向保护；Nginx 只在两个站点的 `/pose/api/proxy` 精确路径转发。代理不读取或保存密钥，仅转发当前请求携带的允许请求头。

## 默认英语与八语补译

预演台以当前语言呈现演员、道具、机位、灯光、动作与镜头选项。画布人像质感的选项与无障碍标签也读取词库。场景对象名称、预设 ID 与生成提示词继续按原数据保存。

价目表生成时将内置文案预渲染为英文，浏览器继续按已保存偏好切换。插件中心、风格库和音频参数摘要也读取八语词库。命令、资源标识、定价数据和生成时使用的风格提示词保持原有数据格式。

相机、镜头、焦距和光圈的预设资料在画布面板渲染时从词库读取。电商工作台的画幅用途和创作、Agent 状态同样使用界面语言。预设标识和用于生成的提示词沿用原始数据。

首页、画布和模型选择器通过 `web/src/lib/image-quality.ts` 在渲染时解析图片质量文案。登录页和弹窗共用 `web/src/components/auth/auth-hero-copy.ts`，仅对内置品牌文案应用界面语言。

站点语言补丁沿用 `supdance-i18n-unified-eight-locales`。主应用、启动恢复页及独立静态页面默认使用英语；服务端错误的源语言仍是简体中文。合并上游时核对设备偏好、内置词条与价格页语言入口，以及静态转换器对界面字段和业务数据的区分。

## 邮件中心候选

后续用户已授权将邮件中心候选合入上游 v1.8.6 并部署。最新集成、二开保留、迁移及验证证据统一见 [本次集成记录](UPSTREAM_20261118.md)；下列候选限制描述保留其原阶段含义。

本次集成同时登记 `.github/workflows/quality.yml` 的媒体工具准备：先验证运行器现有 FFmpeg/ffprobe，缺失时才有界安装；不改变媒体用例、服务依赖检查或支付双架构门禁。

当前候选 1.2.0 增加八语言纯文案域、账号偏好、88 个独立模板、活动语言映射和站点 Logo 自动核对；Schema 107 仅增量添加五个字段。复用 `supdance-compact-model-picker` 插件 ID，显示为「页面管理」，聚合模型展示、HTML 页面和邮件原组件。语言菜单、注册/统一验证/社交入站邮件参数、个人设置及路由接触点均登记同一邮件补丁；不改认证规则、画廊开关或用户营销同意。当前设计、旧入口和回退边界见 [八语言说明](EMAIL_CENTER_LANGUAGES.md)。

保留 `supdance-email-marketing` 身份，以独立邮件域、原 SMTP、后台组件和原权限形成统一邮件中心。认证挑战保持原合同，保护模块接收服务端真实凭证与时效；旧模板只读存档，草稿和发布版本分离，品牌及图片按哈希保存快照。Schema 106 仅新增 `supdance_email_*` 表，日志通过独立 log_id 关联新收据，原日志主键和 90 天保留策略不变。

不可避免的核心接触点登记在 `SUPDANCE_UPSTREAM_PATCH_REGISTRY` 的 `supdance-email-center`。所有现有邮件调用集中经过原认证域；营销任务有独立连接/额度、明确同意与退订检查、有限重试和未知结果终止。账户邮件不依赖用户营销插件状态。候选没有生产切换、DNS 修改或真实外发授权，基线与未测范围见 [邮件中心说明](./EMAIL_CENTER.md)。

## 支付下单名额与账单能力边界

Waffo Pancake 的充值入口默认并排显示微信支付和支付宝图标。可在「支付充值 → 支付渠道 → Waffo Pancake → 配置 → 充值页支付图标」恢复原图标。该选项自动保存到充值设置，沿用现有支付配置版本和回调地址。宿主接触点包括 `internal/app/payment_settings.go`、支付渠道配置抽屉、钱包图标和充值面板。

`internal/repository/payment.go` 将过期非终态订单与可付款名额分离，保留旧插件依赖和晚到支付幂等路径；不通过改写订单终态解除阻塞。`payment_reconciliation.go`、model、导出及后台支付页新增明确的 `unsupported` 终态，插件未实现账单时不再作为临时失败反复重试，也不标记核对成功。支付宝适配器仅将账单查询的已验签 `NO_BILL_DATA` 映射为无账单。八语提示集中在 `supdance/plugins/i18n/locales/payment-reconciliation.ts`，复用后台 Badge 与 Callout。无数据库结构迁移，不改价格、余额、权限和支付通知验签。

## HTML 页面管理后台 V2 规范覆盖

- 后台样式隔离于 `html-page-manager/admin/`，复用 `--admin-*`、AdminModal 和 AdminSwitch，补齐响应式、键盘操作、加载失败与未保存提醒及六语种词条。
- iframe 保持脚本可用但移除同源权限，使用临时存储支持模板主题控件；格式化不改写原始脚本与预格式化空白。保存页面不会覆盖未保存页脚。
- 原有组合根 `backend/internal/app/supdance_html_page_manager_plugin.go` 增加批次保存强校验，无新增宿主挂载点和数据库迁移。操作与回退见 [HTML 页面管理](HTML_PAGE_MANAGER.md)。



## 法律正文六语统一

登录注册一体表单的协议名称入口统一在新标签打开 `https://www.supdance.com/terms`，包括同意勾选旁与只读说明入口；移除该表单旧的协议弹窗，不改变勾选、注册验证或同意状态传递。

认证页脚横排上方的分隔横线按用户要求移除，仅作用于认证页脚。

登录页脚按用户后续修正改为横排：短版权与四个法律/支持链接共用一行，窄屏按整项换行；仅认证页隐藏备案链接，其他页脚备案不变。该约定替代此前“版权、链接、备案分层”描述。

登录页修正：`AuthPageScene` 移除背景视频播放徽章，配置了视频时静音、循环、行内自动播放并在挂载后尝试启动；仍尊重系统减弱动效，浏览器拒绝自动播放时记录告警。认证页脚单独采用版权一行、法律链接自然换行且单项不折行、备案一行，保留44px触控高度；不影响工作区提示条或登录提交逻辑。

页脚品牌采用用户提供的标准 PNG（`supdance-footer-logo.png`），保持 1000:220 原图比例，使用 CSS 在深色主题反色、浅色主题保留原图；页脚自身随主题切换黑白背景及文字。React 站点与静态定价表同步，原文件不作像素修改。

页脚右列按用户要求移除邮件订阅提示和旧社区跳转，改为与工具两列同排版的“法律与支持”竖排导航，提供服务条款、隐私、AUP、法律中心、定价、MCP 和联系邮箱。标题与联系文字适配当前中英法德日韩，其余复用既有词条；历史后台订阅字段保留以避免修改数据契约，但前台不再渲染。

页脚精简：法律正文末尾不再重复版权、法律中心及邮箱。全站最底栏仅显示年份、Supdance 品牌与已有备案链接，移除技术宣传和状态标识；工具列分为图片/视频/音乐、素材/技能/插件，创作列包含画布、短剧、创作首页、电商及任务。全部为真实路由，沿用现有六语词条。

后续上线调整：再次核对参考站的账号、内容权利、公开传播、付款、终止、免责，以及隐私收集、模型处理者、选择、保留、跨境与权利章节。本站采用独立品牌化正文，保留既有七日未使用积分退款政策，不复制对方的不可撤销公开内容许可或移动 App 条款。页脚核心入口改为现有侧栏图片、视频、音乐、画布、项目、素材和技能路由，名称复用站点六语词条；页脚专属黑底白字样式避免全站强调色渗透。按本次用户明确要求，工具链接优先于历史后台页脚列配置，其余配置仍保留。

服务条款与隐私政策在 SupDance 独立扩展中共用 `service-policies.ts`，使用当前中英法德日韩六语；`legal-html.ts` 从相同内容导出独立 HTML，HTML 页面管理的两份新建模板同步引用。按用户要求移除个人姓名及个人商户身份表述，品牌与客服邮箱保留，不推定公司主体。旧版法律文档共用元信息也不再包含个人姓名。

公开路由保留现有布局、广告偏好入口及语言切换，补齐法德映射与本地化元信息。独立 HTML 使用浏览器系统明暗色、无脚本及打印排版，语言链接指向对应的真实站点路由；广告偏好在在线隐私页面管理。此模板调整不修改已保存在数据库中的自定义页面，未执行生产部署。

内容涵盖付费合同、生成失败积分处理、模型权利限制、终止申诉、供应商处理、跨境、存储、保留与隐私权利。不声称未知支付认证、普遍零留存或固定期限彻底删除，不改变实际支付、生成及账务实现。文本参考 Pollo 两份公开政策的议题结构，按本站服务重新撰写。

## 上游 v1.8.5 与后续 main 集成保留记录

### 八语言国际化统一

站点语言、资源和组件库配置统一使用上游 i18next，SupDance 保留翻译管理、审核与既有覆盖。接缝登记为 `supdance-i18n-unified-eight-locales`；命名空间、构建期静态界面文字处理、发布与导入保护见 [国际化统一说明](I18N_UNIFICATION.md)。不修改模型参数、生成提示词、价格、权限或既有审核历史。

### 简洁模型选择器 1.1.0

宽度与说明排版仅修改 `web/src/supdance/plugins/compact-model-picker/picker.css`，不新增宿主补丁。92 个模型说明基线位于 `supdance/config/model-descriptions.json`；生产只更新展示说明和一项不符参数的展示名称，不修改模型键、能力、价格或启停状态。来源与发布方式见 [模型选择器说明](MODEL_PICKER_COPY.md)。

- 本轮已合并上游 main `bae6a36c2e835733295a48087eb9c424ea619bc2`（含 v1.8.5），生产应用固定为 `3cb3331b923264c7a26b5981375d938a3a989e15` / `v1.8.5-supdance.1`。合并请求与云端发布检查见 [PR15](https://github.com/Blacklake-Go/open-ai-canvas/pull/15)、[发布流水线](https://github.com/Blacklake-Go/open-ai-canvas/actions/runs/43164401842)。
- 186 个扩展源码及清单路径无缺失；音乐、身份桥源码不变，保留支付、社交登录、HTML 页面、简洁模型选择器、翻译、主题外观及 Codex。已退役视觉引擎不恢复。
- 上游真实 MCP 列表与原有 Codex 连接操作并存；成片手动合成、版本恢复与本站时间线精修并存。生成副作用继续要求跨标签互斥，缺少 Web Locks 时拒绝不安全降级。
- 已发布迁移 1–99 的名称与校验和保留；三项上游新增迁移映射为本站 100–102。恢复副本完成迁移幂等、历史财务/资产/插件/密钥保持以及匹配旧库的旧版启动演练，生产迁移后数据库为 102。
- 既有翻译界面补齐 41 组六语言词条；新增上游 460 个扫描项仍为待翻译清单，登记于 `supdance/i18n/upstream-v1.8.5-review.json`，不计作翻译完成。
- 本地完整门禁 13 项全部通过、前端 3936 项通过；云端必需 PostgreSQL/Redis、Agent 架构和支付插件验证通过。恢复副本真实浏览器验证模型选择关闭/焦点、明暗主题、移动端，以及 ONE 钱包、投稿、权限和撤稿；生产另做无业务写入的浏览器检查。本轮未新增收费模型调用。
- 旧 Agent 在空闲时未响应退出信号；运营确认 active=0、queued=0 且业务任务已结束后结束旧容器，未强行中断工作。以后部署先排空主站任务，再检查 Agent 活动及队列后限时退出，不能仅延长等待或盲目强杀。
- 线上开放新写入后，不允许仅恢复旧数据库快照覆盖后续交易。即时恢复仅限受控维护窗口、保护数据核验通过并保留失败版本前向备份；后续故障优先前向修复或对账后恢复。
- 宿主接缝登记 `supdance-upstream-185-preservation`；完整边界见 [源码集成说明](./UPSTREAM_V1_8_5_SOURCE_MERGE.md)。

# SupDance Canvas — 独立改造与定制代码清单 (CUSTOMIZATIONS.md)

## 上游世界引擎

合入上游 `5ca284ce` 的世界引擎，保留自由画布的团队路由、字幕与剪辑时间线，以及视频拼接的音画时间基准处理。工具、预设和界面词条使用现有八语词库，场景名称、预设标识和模型提示词沿用源值。世界引擎沿用上游的局部浅色面板以保持 WebGL 叠层对比度。接缝登记为 `supdance-world-engine`，详见[集成记录](UPSTREAM_WORLD_ENGINE.md)。

## 上游 v1.8.7.1 集成

团队空间、协议版本锁定和新画布交互集成到现有宿主。保留音乐任务回查、插件挂载、八语入口和支付账务字段，接缝登记为 `supdance-upstream-20261120-preservation`。本站继续使用已发布的 1–108 账本，新迁移使用 109–112。详见[本次集成记录](UPSTREAM_20261120.md)。

## 上游 main 完整更新与二开保留

集成 `3979305c` 的十二项更新，保留最新八语言、HTML 后台、法律页、音乐、模型选择器、社交登录、Waffo、ONE 桥和 Codex。迁移保留已发布 1–102，上游新增映射为本站 103–105。社交插件绑定接口更名以避免与上游微信同名方法冲突，原行为保持。新分镜与权限界面的显示文案接入原生词库；生成提示词和用户内容保持原文。新接缝登记 `supdance-upstream-20261114-preservation`，具体取舍、验证和部署边界见 [更新记录](UPSTREAM_20261114.md)。

## 灵感大厅合规公开边界

独立领域模块 `backend/internal/supdance/gallery` 恢复原始目录、精选池、翻译和上新分类，通过页面管理保留全局开关、首页开关、合规锁和逐条限制。来源包置于非公开归档，目录、翻译、缩略图和上新均由服务端按当前设置过滤。审核记录、插件身份和管理员审计保留，无 Schema 变更。登记为 `supdance-gallery-compliance`；部署及回滚见 [专题说明](./WAFFO_GALLERY_ISOLATION.md)。

「页面管理 → 灵感中心」增加策展工作区。原创案例包归服务端目录管理，沿用原案例 ID。后台保存标签、首页精选顺序与封面焦点。公开目录由现有审核服务核对资格后叠加已发布版本。相关上游接缝登记于 `supdance-gallery-compliance`，见 [策展说明](./INSPIRATION_CURATION.md)。

在上游 `367846d0` 和 `ec5ed973` 的详情布局与共享搜索控件基础上，优化窄屏滚动和底部操作。搜索控件复用本站八语清空文案，详情继续读取本地化案例。

## 2026-11-12 音乐钱包与视觉插件退役

音乐基础表单及高级操作复用宿主 `useWalletBalance` 查询，包含现有用户归属校验，与顶栏共享预占、结算与退款后的余额。音乐任务到达终态后发送宿主 `wallet:updated` 事件；保持微积分账本和原始报价不变，不能用界面四舍五入代替整数积分定价迁移。

视觉引擎的前后端实现、路由、管理入口、注册和打包工具已移除；紧凑模型选择器保留。主题与首屏加载回到宿主实现，历史配置及审计保持原样。此前章节中“保留视觉引擎”的描述属于历史合并记录，现由[退役说明](./visual-engine/RETIRED.md)取代。接缝登记为 `supdance-delivery-integrity`。

## 上游 v1.8.4.1 合并接缝

- 集成候选 `v1.8.4.1-supdance.1` 以 Schema 99 为目标；本地已应用迁移 1–93 保持原记录，上游新增迁移 93–98 顺延为本地 94–99，逐项保留名称、checksum、实现和顺序。
- 保留既有 SupDance 插件、支付扩展、音乐工作台、社交登录、视觉引擎、Codex 连接器、法务与六语系统。新增短剧造型与角色图片词条继续使用 `supdance-creation` 六语来源，不翻译用户输入或生成参数。
- 画布多段媒体剪辑与选中视频合并继续作为本地能力；适配上游串行 FFmpeg 队列，并保留上游图片对比工具。核心文件登记于 `supdance-canvas-video-merge` 和 `supdance-drama-style-i18n`。
- 时间线编辑器、字幕、短剧精剪和内置 editor 插件按要求保留，不接受上游删除；扩展节点 Markdown、HTML、SVG、图表、对比保持原注册。登记于 `supdance-canvas-timeline-editor`。
- 这是源码集成候选，不代表数据库迁移、发布或生产验收完成。逐项处理和验证边界见[源码合并记录](./UPSTREAM_V1_8_4_1_SOURCE_MERGE.md)。

## OpenAI Supdance 插件业务桥接

独立 Supdance 插件通过 `/api/supdance-openai/v1` 访问主站。服务凭据由宿主注入，按账号校验项目与画布归属。画布追加分镜前绑定预览、版本和用户，提交沿用原生变更回执。后端无数据迁移。审核文本使用主站任务和积分预授权，仅在同时配置审核账号和模型时开放。部署及验收见 [OpenAI 插件业务桥接](./OPENAI_PLUGIN_BRIDGE.md)。

SupDance Studio 私有 v2 入口同时承载官网图像、视频和音乐生成。音乐采用官网音乐插件的启用状态、系统模型、报价、任务去重、积分账本和媒体归档。素材分页复用官网用户素材表的活动状态、分类和搜索，并验证关联资源的账号归属。已部署版本由独立候选 MCP 调用该私有入口。

上游接缝登记为 `supdance-openai-plugin-bridge`。生产发版后需使用专用审核账号复测桥接与 ChatGPT 两端用例。

## 上游 v1.8.3 合并接缝

保留紧凑模型选择器、工作区法务条、音乐、视觉引擎、Waffo 及 X 付款衡量。上游登录注册合并为一个表单后，社交入口与协议状态一同迁入共用表单。创作岛保留音乐参数及原有生成入口并接入思考档位，模型价格保留 SupDance 上下文分档与上游参考视频价，后台搜索共用包含本站定制入口的导航目录。Schema 映射、语言覆盖及验证见[源码合并记录](./UPSTREAM_V1_8_3_SOURCE_MERGE.md)。

## 三方登录绑定回跳与账号安全

社交登录域负责渠道准入、回跳、入站和身份绑定策略。宿主提供原登录会话、站点注册与邮箱验证策略，仓储负责身份和会话写入的事务校验。系统应用 ID 与可上传包的生命周期隔离。个人资料全局浮窗和独立设置页分别恢复原入口，身份列表读回后确认成功。共用认证、仓储、插件注册与设置页接缝登记在上游兼容注册表和 baseline。沿用现有表字段，前后端需同时发布。

## 简洁模型选择器首次渲染与开关同步

共享 `ModelPicker` 提前读取公开显示策略。已确认开启的策略保存在浏览器小型配置中；未知策略先显示简洁加载状态，首次读取失败显示重试，刷新失败保留上次确认的外观。只有服务端明确返回关闭才使用原生菜单，不再因请求等待或错误临时退回旧版。后台成功保存及插件可用性切换取消旧请求、同步查询缓存与浏览器缓存，并订阅跨标签页更新；旧请求不能覆盖刚确认的开启状态。桌面菜单为 560px，品牌栏最多 144px，手机品牌栏 88px，列间距收紧为 8px，品牌和模型行触控高度至少 44px。修改涉及既有共享选择器、后台插件开关及插件内部设置／样式，不改变模型 ID、计费或生成合同。

## X 付款成功衡量

`supdance-x-purchase-measurement`：用户同意后，独立测量文档接收服务端已入账订单的金额、币种和去重摘要；沙盒、旧订单和未确认订单不发送。应用根与付款确认 hook 各增加一个接缝，不改变支付和账本，隐私政策同步说明。实现、渠道边界、回滚和真实购买待验收见 [X_PURCHASE_MEASUREMENT.md](./X_PURCHASE_MEASUREMENT.md)。

## 工作区法务提示条关闭偏好

工作区 `SiteComplianceFooter` 仅首次进入显示并提供关闭按钮。首次显示后在当前浏览器记录已展示，即使没有点击关闭，刷新或再次进入工作区也隐藏；旧版已关闭的偏好继续生效。记录展示状态在挂载后的 effect 中执行，避免 StrictMode 重复初始化跳过首次展示。登录页及法务正文页保留原有页脚。关闭文案接入原生六语，关闭目标为 44px；不修改法务正文、备案配置或任何支付与生成逻辑。

## 简洁模型选择器的手机布局与音乐工作台接入

- `workspace-product.css` 的旧菜单列宽及手机单列规则仅匹配非简洁菜单，简洁插件自行管理双栏和窄屏换行，避免手机品牌入口消失。
- 独立音乐工作台直接复用共享 `ModelPicker`，用音乐能力目录限定可选型号；名称、简介和报价沿平台模型目录显示。下架型号禁选，加载及提交期间禁用菜单。
- 草稿仍由音乐 store 管理，实时询价及提交仍走原音乐接口，不修改模型 ID、价格、支付插件或生成合同。组件回归拒绝生成请求；设备及上线验收边界见待测试清单。

## Waffo 企业版沙盒

独立扩展在 `backend/internal/supdance/waffopayment/`，可安装包在 `supdance/plugins/supdance-payment-waffo-enterprise/`。宿主支付 SDK、通知 handler、支付服务与仓储增加最小接缝：真实买家字段、指定测试用户限制、动态签名应答、下单交易号绑定及未知状态保留。无数据库迁移；复用已有积分账本与通知收件箱。范围与验收限制见 [企业版接入](./WAFFO_ENTERPRISE.md)。

## Waffo 商户重审整改

- 复用既有 `contentsafety` 与生成任务筛查入口，通过生产 Compose 透传商户 ID、开关和私钥文件路径。密钥继续保存在服务器受限文件中。默认关闭，没有数据库迁移。
- 隐私政策六个文本版本补充 Waffo 生成前文本筛查、发送范围和官方披露的原文保留规则。首页、介绍页及法律链接复用 `SitePolicyLinks`。
- 上线前验证真实商户扫描接口、拦截时上游零调用与失败路由不切换。启用后任意创建型 custom relay 被拒绝，图片与视频创建使用任务队列。后续更新须保留 Compose 的三个环境变量映射。

## 账户浮窗窄屏修复

生产 390px 验收发现旧固定侧栏使资料正文仅剩84px。本站新增的 `web/src/components/layout/user-profile-modal.tsx` 改为小于LG时使用统一Select，沿用同一分组、插件准入和tab回调；桌面保留侧栏。使用现有语义token、原生词条和44px关闭目标，不改变资料、安全、计费和生成协议。运行态布局及关闭焦点须在新版本上线后重新验收。

## 上游 v1.8.0 合并接缝

- 数据库保留已应用的本站83，上游83–87映射为本站84–88，保留名称、校验和、实现与顺序。
- 售价上下文分档与分时规则按档互斥；保留成本分档、一小时缓存子集、订单快照与成本未知语义。
- 创作首页采用上游模式卡并保留音乐插件准入、独立音频模型回调、报价、歌词与时长控件；设置页采用上游分组与动态协议声明，保留社交账户入口。
- 合并新增短剧集插入、资产包和剪映导出入口时继续使用原生创建namespace；保留日推荐与上新标记的本地化。
- 新增核心标题与价格展示接缝登记于兼容注册表及 baseline；验证和部署记录见 [源码合并记录](./UPSTREAM_V1_8_SOURCE_MERGE.md)。

## 网站集成候选：六语、访客入口与文本定价

- 电商及小说改编页面显式接入 `supdance-creation` i18next namespace，使用宿主原生中英法德日韩。保留用户输入、模型 ID、请求参数与服务状态原文，不恢复 DOM 扫描翻译。
- 共享 `workspace-guest-actions` 为侧栏和顶栏提供登录／注册药丸；`SitePolicyLinks` 同时用于工作区与独立 welcome 入口。移动端法务链接横向换行，保留 44px 触控目标；账户菜单清理重复设置入口。
- 文本模型的上下文分档、五分钟／一小时缓存用量沿既有订单和成本快照实现，Schema 83 只增列；目录和管理表单传递完整售价分档，用户目录不公开成本。保留现有赠金、返佣及余额。
- 上游接缝完整登记于 `supdance-site-closure-interfaces` 和 `supdance/config/baseline.json`。这是涉及计费的高风险候选，必须通过本地推送门禁、CI、备份恢复演练及线上验收后才可视为已交付。
- 公开价目表复用原生六语与 `yingce:locale`，对页面完整静态文案显式翻译，不翻译模型标识和金额单元格；真实 HTML 的六语及回切测试保护此合同。
- `supdance-model-brand-mode-preservation` 保留原工作区既有 Mureka 图标及 ID；视频菜单只过滤当前输入不适用的型号，不全局下架模型，也不改变图生视频能力或后台启用状态。

## 原生多语言接管

界面语言以 `web/src/i18n` 与 `useLocaleStore` 为唯一来源；旧 DOM 翻译和上游目录 postprocessor 退出。扩展 key 在 `web/src/supdance/adapters/upstream-i18n.ts` 注册独立 namespace，所有语言入口与设置复用上游组件。登录共用表单保留社交登录和协议强校验。下方旧语言入口及 DOM 引擎描述为历史实现，现行合同见 [原生多语言集成](./NATIVE_I18N_UPSTREAM_SYNC.md)。


## 音乐素材写入边界

- 平台音频任务的规范素材由后端 `registerRecoveredMediaAssets` 按任务和输出序号生成稳定 ID；音乐工作台只读任务及资源，不再在载入历史或轮询完成时调用前端 `addAsset`。移除仅内存去重的旧桥接，避免目录未 hydration 或刷新后产生随机副本。历史重载、账号状态重置和轮询完成共用真实 store 回归；既有素材不自动删除。
- 创作页模型分组、目标时长与音乐结果组件保留最小适配，业务协议在 `plugin-packages/runninghub-standard/`，独立工作台适配在 `web/src/supdance/plugins/music-generation/services/music-site-api.ts`。
- 复用平台模型目录、报价、`canvas_audio` 任务和资源访问 API，不增加账本、用户或数据表；新文案通过 `supdance-i18n` 六语词条模块提供。
- 上游更新需保留 RunningHub 1.1.2 源清单与发行包，避免启动时旧官方包覆盖音乐接口；创作页、工作台、失败退款与账号切换需共同回归。
## 音乐工作台统一渠道补丁

- 创作页模型分组与音乐结果组件保留最小适配；音乐工作台通过主站配置读取模型、能力和报价，不展示没有接通的时长、人声与格式参数。
- 复用平台模型目录、报价、`canvas_audio` 任务和资源访问 API，不增加账本、用户或数据表；新文案通过 `supdance-i18n` 六语词条模块提供。
- 音乐模块版本为 1.3.0、最低宿主版本 1.7.4，RunningHub 协议包为 1.1.2。源码与发行包必须一起升级并重启，不能只改插件数据库版本。
- 音频沿宿主分离轮询、媒体 checkpoint、稳定资产 ID 和账务状态机；恢复旧后台测试只回查原上游 ID，不创建任务到供应商、不补扣历史账目。生命周期状态、准入与管理员审计原子提交，卸载保留配置和用户偏好。
- 宿主接缝登记于 `supdance-music-host-tasks`、`supdance-music-player-docking`、`supdance-music-original-asset-titles` compatibility registry 与 `supdance/config/baseline.json`。实现、迁移与风险见 [音乐实现说明](music-studio/IMPLEMENTATION.md)，实测范围见 [音乐验收记录](music-studio/VERIFICATION.md)。

## 完整上游同步：正式版与 main

- 快照节流在刷新函数完成同步准备后记录时间，避免准备开销侵占实际请求的最短间隔。用 35 毫秒同步准备的真实回归先复现小于 100 毫秒的请求间隔，再验证修复；原有批处理、单个在途刷新与失败传播合同保留。登记为 `supdance-agent-snapshot-throttle`。
- 统一发布门禁复现 Agent 取消清理与调度器的 revision 冲突：`CancelCloudAgent` 在取消意图保存后，对清理阶段增加有界重读重试并保留 context 取消；不重复创建取消事件、不重提收费任务、不改变已提交媒体任务继续执行的策略。补丁登记为 `supdance-agent-cancellation-cleanup`。
- 统一发布收敛公开价目表、生成岛/侧栏入口和法律页共享导航；补丁登记为 `supdance-public-pricing`。静态价格保留已审核快照，不在构建或部署时重新抓取文档及换算价格。音乐工作台使用平台目录、报价和通用任务合同，保留 RunningHub 1.1.1 包与后台已配置售价。
- 法律页提取共享头部导致 10 个原有中文源文的扫描锚点变化；逐项与 `037b8ae9` 源文核对相同后更新扫描基线，不代表这些既有正文已补译。音乐能力按协议收敛：Suno 仅简单模式，Mureka 不提交纯音乐参数，MiniMax 保留歌词/纯音乐；时长为目标提示，实际以供应商音频为准。

- 版本 `v1.7.4-supdance.7` 自 `eadb3622` 顺序合并正式版 `7c14ffdd` 和 `main@8de0a239`；保留两个上游祖先及自有插件提交，实际部署以 [完整集成记录](./STAGED_UPSTREAM_CANDIDATE.md) 为准。
- 九个冲突按语义处理：设置仓储同时保留 `LockSystemSetting` 与 `SystemSettingsWithPrefix`；OpenAPI 按完整端点保留视觉引擎与电商请求体及响应；侧栏保留 SupDance `t()`、音乐开关、账号菜单；审批测试外层 30 秒保留大于子进程 20 秒的期限。版本、变更日志及三篇文档保留双方内容。
- 电商侧栏使用后台功能条件和既有六语词条；同步 main 的支付/币种和 TOS 表单协议，避免保留旧 UI 却调用新后端合同。
- 保留已上线第一阶段：正式版自带 `b0d56dea` 分页，再精确带入 `common.load_more`、令牌、焦点与 44px 触控适配；移植 `338b75c8` 品牌与第二屏修复、相关测试及 E2E 调用参数。`supdance-agent-history-pagination` registry 与 baseline 两个路径同步保留；第一阶段文档不整体覆盖候选。
- 集成包含 Schema 81、积分默认零奖励与取消登录补发，以及通用素材恢复。音乐插件复用后端规范素材；RunningHub 真实结果、素材去重和多标签恢复分别记录运行证据，不把静态合并视为业务闭环通过。
- 新适配器 `web/src/supdance/adapters/upstream-i18n.ts` 将上游 `web/src/i18n/index.ts` 的翻译后处理接入 SupDance 词库。插件语言、管理员词条和停用控制优先；仅保留一个语言选择器和 AntD locale 配置。新增耦合点已登记 compatibility registry 与 baseline。英文、西班牙语、繁体中文及停用回退有真实 React 渲染回归。
- 创作页上传提示复用上游原生翻译键，经同一桥接保留插件发布优先；源码扫描器识别两套合法目录并排除目录定义，未知键仍拒绝。上游待译候选与本次接入基线单独记录在 `supdance/i18n/upstream-main-8de0a239-review.json`，不计作补译完成。
- 迁移先在 PostgreSQL 备份恢复副本演练；旧 Schema 78 程序拒绝连接 Schema 81，回退必须恢复匹配数据库。源码元数据不能替代生产迁移证据。

本文件记录 SupDance Canvas 相对上游 `ddcat-ai/open-ai-canvas` 的每一项定制改造、耦合边界及升级处理方式。

## v1.8.0 账户宿主与原生界面接入

- `supdance-profile-router-host`：账户浮窗的 `ProfilePane` 已使用 `useAuthEntry`、`useSearchParams`。全局 Provider 只管理通用上下文；账户宿主放在所有路由共享的 `SupDanceRouteHosts`，与 `Outlet` 共用 Router，跨页面保持窗口身份。不要重新把账户宿主挂到 `RouterProvider` 外，也不要用孤立的 MemoryRouter 绕过生产导航。真实资料窗口有独立 DOM 回归。
- `supdance-native-upstream-ui`：画布 HUD、批量进度、Token 规则与音乐建议使用宿主 `upstream` 区域六语目录。星期用当前语言的 `Intl` 标签，保存的星期编号、上海时段、价格字段和上下文阈值不变；音乐建议仅翻译标题和说明，点击发送的原提示词不变。面包屑与侧栏音乐名称读取原生词条。
- 外层反代若保留历史 `/api/v1/` 入口，必须让 `/api/v1/supdance/music/` 更长前缀指向当前应用，并沿用当前应用的 Cookie 隔离和转发头。仅容器健康检查不能发现这种错误；认证后的能力、报价、作品列表和原音频访问需一起验收。
- 本批不改变 Schema 88、模型价格、赠金、返佣、用户权限或已保存内容；其余上游文案继续保留明确的待译状态。

## 统一社交登录插件：`supdance-social-auth` v1.4.0

补丁 ID：`supdance-social-auth`

分发工具：`python3 tools/supdance/package_social_auth.py --output-dir /tmp/supdance-social-auth-release`，生成 `.yingce-plugin`、SHA-256 清单和宿主部署说明。包仅携带清单与文档，使用宿主顶层 ID/名称/版本合同；不声明独立 Web 入口，不包含真实凭据。完整 Go/React 实现已随 `1.7.4-supdance-social-1.3.3`（`42de461f`）宿主部署，不能把元数据包上传等同于运行时代码升级。

Bilibili 依据[网页接入](https://open.bilibili.com/doc/4/aac73b2e-4ff2-b75c-4c96-35ced865797b)、[账号授权](https://openhome.bilibili.com/doc/4/eaf0e2b5-bde9-b9a0-9be1-019bb455701c)、[接口签名](https://open.bilibili.com/doc/4/8673959e-f7bb-56e6-6e68-d225f971b81b)与[用户信息](https://open.bilibili.com/doc/4/feb66f99-7d87-c206-00e7-d84164cd701c)实现真实协议；要求 USER_INFO 授权。令牌交换按官方合同在服务端 URL 参数传入凭据，禁止记录该请求 URL；用户资料使用随机 nonce、当前时间戳和 HMAC-SHA256。服务商头像禁止热链，当前保留原生头像回退，缓存适配待验收。端点可达与本地协议测试仍不能代替正式应用授权。

v1.3.2 根据真实 QQ 授权页的 100001 错误补齐数字 App ID 校验；无效或尚未就绪的历史配置在管理界面显示为停用，避免空凭据开关保持开启的误导。

入站票据使用共享 Redis（键前缀 `supdance:socialauth:onboarding-ticket:`，有效期 30 分钟），通过 Lua 原子读取并删除。共享存储失败时中止入站写入。未配置 Redis 的单进程环境使用内存票据。

合并渠道凭据管理、运营控制与授权后入站流程。后台保留四列配置列表、480px 凭据浮窗和独立运营页；账号中心保留第三方身份展示、绑定、换绑与防孤立解绑保护。关闭插件后，授权开始、回调与入站完成均拒绝执行。

真实授权使用服务商令牌交换、浏览器绑定 Cookie、一次性 state 与 X S256 PKCE。移除默认 Mock 凭据与模拟身份链路，历史 Mock 凭据不能展示为可用渠道。QQ、微信、抖音、Bilibili、Google、X 和 TikTok 已提供协议适配。Instagram 保留配置入口。配置字段完整和授权端点可达不代表生产授权已验收。

TikTok Login Kit 仅申请 Web 的 `user.info.basic`，回调为 `/api/auth/social/tiktok/callback`。服务端核对令牌和资料中的 `open_id`，读取昵称、头像并沿用站内注册和身份绑定流程。身份按 TikTok client key 隔离，Sandbox 与 Production 使用独立凭据。访问令牌仅用于本次资料读取，无需保存刷新令牌。

入站表单校验和协议确认后先消费票据，再创建账号与身份。服务商明确验证过的邮箱可自动绑定，手填邮箱须通过本次入站验证码核验。渠道停用与宿主注册策略在入站完成时仍会检查。注册奖励沿用站点统一积分策略，防孤立保护固定开启。

与宿主耦合点为 `RegisterSocialAuthRoutes`、`supdance_social_auth_plugin.go`、`AppProviders`、登录注册页、用户资料浮窗与 `router.tsx`。服务商凭据由宿主加密，运营统计来自数据库，端点探测不携带凭据且不生成账号。真实服务商授权、回调验收与界面核对列于待测试文档。

## 1. 定制功能矩阵

| 功能名称 | 文件位置 | 依赖关系 | 与上游耦合程度 | 是否使用扩展接口 | 上游升级时是否需人工处理 |
| --- | --- | --- | --- | --- | --- |
| **本机 SupDance Canvas Agent (Codex) 连接器服务** | [`web/src/services/api/codex-connector.ts`](../../web/src/services/api/codex-connector.ts) | 浏览器原生 `fetch`、`EventSource`、`sessionStorage` | **无耦合（纯新增文件）** | 独立服务模块 | 否 |
| **Codex 连接器状态机 Hook** | [`web/src/components/canvas/use-codex-connector.ts`](../../web/src/components/canvas/use-codex-connector.ts) | `codex-connector.ts`、`@/lib/client-id`、`CloudAgentChatMessage` 类型 | **低耦合（纯新增文件）** | 引用上游聊天消息类型 | 仅当 `CloudAgentChatMessage` 结构变更时需适配 |
| **Agent 连接器底部入口栏与样式** | [`web/src/components/canvas/canvas-cloud-agent-connectors.tsx`](../../web/src/components/canvas/canvas-cloud-agent-connectors.tsx)<br>[`web/src/components/canvas/canvas-cloud-agent-connectors.css`](../../web/src/components/canvas/canvas-cloud-agent-connectors.css) | Ant Design `Popover`/`Button`、`lucide-react` | **中耦合（修改上游核心组件）** | 组件 Props 扩展 (`codex`, `onConnectCodex` 等) | 是（若上游修改底部连接器图标栏需合并） |
| **云端 Agent 面板 Codex 接入点** | [`web/src/components/canvas/canvas-cloud-agent-panel.tsx`](../../web/src/components/canvas/canvas-cloud-agent-panel.tsx) | `useCodexConnector`、`AgentConnectorsBar` | **中耦合（修改上游核心组件）** | 在 `CanvasCloudAgentPanel` 内挂载 Hook 并分流提交/停止动作 | 是（上游改动 Agent 面板时需重点核对） |
| **SupDance Studio 皮肤与主题扩展** | [`web/src/supdance/theme/supdance-skin.ts`](../../web/src/supdance/theme/supdance-skin.ts) | `@/lib/skin-themes` (`DEFAULT_CLASSIC_SKIN`, `applySkinTheme`) | **无侵入（纯新增命名空间）** | 100% 复用上游三层皮肤 Token 接口 | 否（除非上游增删 `SkinModeTokens` 字段，有单测自动捕获） |
| **前端兼容层与路由/插件守卫** | [`web/src/supdance/adapters/compatibility.ts`](../../web/src/supdance/adapters/compatibility.ts)<br>[`web/src/supdance/registry/index.ts`](../../web/src/supdance/registry/index.ts) | `@/lib/plugins/plugin-registry`、`react-router` | **无侵入（纯新增命名空间）** | 复用上游插件注册器 | 否 |
| **后端领域与兼容层守卫** | [`backend/internal/supdance/domain/extension.go`](../../backend/internal/supdance/domain/extension.go)<br>[`backend/internal/supdance/adapters/compatibility.go`](../../backend/internal/supdance/adapters/compatibility.go) | Go 标准库 | **无侵入（纯新增 internal 子包）** | 独立包，不反向依赖 `internal/app` | 否 |
| **SupDance 工作流助手插件模板** | [`supdance/plugins/supdance-workflow-assistant/manifest.json`](../../supdance/plugins/supdance-workflow-assistant/manifest.json) | `yingce.plugin/v2` 契约 | **无侵入（独立目录）** | 原生 `.yingce-plugin` Manifest 合同 | 否 |
| **站点多语言与实时词条插件 (`supdance-i18n`)** | [`web/src/supdance/plugins/i18n/`](../../web/src/supdance/plugins/i18n/)<br>[`backend/internal/supdance/i18n/`](../../backend/internal/supdance/i18n/)<br>[`supdance/plugins/supdance-i18n/`](../../supdance/plugins/supdance-i18n/) | `yingce.plugin/v2`、`SystemSetting`、Zustand、Ant Design `ConfigProvider` | **低耦合（插件化热插拔架构）** | 复用平台插件注册表、后台插件可用性开关与 `SystemSetting` KV存储 | 仅当顶栏或后台导航入口结构调整时需核对单行挂载点 |
| **SupDance 全站 UI Design System 规范与合规体系** | [`docs/design-system/`](../../docs/design-system/)<br>[`web/test/design-system-compliance.test.ts`](../../web/test/design-system-compliance.test.ts) | `@/lib/skin-themes`, `globals.css`, Ant Design | **无侵入（纯新增规范与非侵入式门禁单测）** | 遵守上游四层架构与多皮肤合同 | 否（上游升级零冲突） |
| **统一第三方社交登录插件 (`supdance-social-auth`)** | [`web/src/supdance/plugins/social-auth/`](../../web/src/supdance/plugins/social-auth/)<br>[`backend/internal/supdance/socialauth/`](../../backend/internal/supdance/socialauth/)<br>[`supdance/plugins/supdance-social-auth/`](../../supdance/plugins/supdance-social-auth/) | `yingce.plugin/v2`、OAuth2、JWT、Ant Design | **低耦合（插件化热插拔架构）** | 登录页挂载第三方登录组件与后台独立管理配置 | 仅当登录页结构变化时需核对挂载点 |
| **全站视觉与交互引擎 (`supdance-visual-engine`)** | [`web/src/supdance/plugins/visual-engine/`](../../web/src/supdance/plugins/visual-engine/)<br>[`backend/internal/supdance/visualengine/`](../../backend/internal/supdance/visualengine/)<br>[`supdance/plugins/supdance-visual-engine/`](../../supdance/plugins/supdance-visual-engine/) | `yingce.plugin/v2`、主题/浮层扩展接口、`SystemSetting`、Zustand | **低耦合（插件化热插拔架构）** | 双入口 Visual Console、主题/浮层扩展与独立生命周期管理 | 核对主题扩展、后台插件入口、路由与诊断订阅挂载点 |

---

## 2. 不可避免的上游核心文件补丁登记

### 补丁 ID：`supdance-guest-workspace-tools`

- 创作首页通过 `web/src/pages/create/index.tsx` 挂载游客工具导航，展示短剧制作、电商 Agent、图片生成、视频生成和音乐生成，沿用已有路由守卫与登录后回跳。工作区通过 `GET /api/public/workspace-tools` 获取游客侧栏所需的六个布尔开关，侧栏继续按后台配置显示。上游合并时核对首页挂载点、公开字段、工作区初始化和工具路由守卫。

### 上游 v1.8.7.2

- 保留 SupDance 创作结果入库、音乐模式、短剧剪辑时间线、访客入口、八语启动提示和 Studio 私有网关，合并上游结果恢复、精修画布和页面资源恢复。上游 Agent 历史归档迁移顺延到本站 113。19 个重叠协议包核对了协议字段、文档和附带文件后采用上游正式发行版，已安装的定制版本由现有发行版记录管理。

### 补丁 ID：`supdance-asset-form-viewport`

- `web/src/pages/assets/index.tsx` 仅限制新增和编辑素材共用弹窗的高度，让正文独立滚动并保留可见的底部操作区。上游合并时核对弹窗正文与操作区的布局。

### 资产页方舟认证角标与浏览器翻译

- `web/src/pages/assets/asset-library-cards.tsx` 为认证状态保留独立文案元素。上游合并时保留此结构及 `web/index.html` 的 `translate="no"`，由站内国际化提供界面语言。自动测试覆盖入口声明与审核角标结构。
### 资产页方舟认证角标

- `web/src/pages/assets/asset-library-cards.tsx` 为认证角标保留稳定的文案元素。合并上游时保留该结构，避免浏览器翻译包裹文本后，审核轮询替换图标触发 DOM 插入异常。

所有对上游文件的直接修改均同步登记在 [`web/src/supdance/adapters/compatibility.ts`](../../web/src/supdance/adapters/compatibility.ts) 的 `SUPDANCE_UPSTREAM_PATCH_REGISTRY` 与 [`supdance/config/baseline.json`](../../supdance/config/baseline.json) 中：

### 补丁 ID：`supdance-codex-agent-connector`
- **被修改的上游文件**：
  1. `web/src/components/canvas/canvas-cloud-agent-connectors.css`
  2. `web/src/components/canvas/canvas-cloud-agent-connectors.tsx`
  3. `web/src/components/canvas/canvas-cloud-agent-panel.tsx`
  4. `web/src/components/canvas/canvas-cloud-agent-settings.tsx`
- **修改原因**：在面板挂载 `useCodexConnector` 并分流本机发送与停止；按上游新布局将连接器移入设置「工具与连接」，由面板注入真实状态和操作。连接本机期间阻止云端队列自动派发，保留云端队列和附件流程。
- **上游基线**：`v1.7.3.4` (`dc035d51311925e48ab1542df094bd1e2b07ba7f`)
- **升级风险与回归保障**：上述 4 个文件纳入 `coupledUpstreamFiles` 监控，并通过插件隔离、Agent 布局和模型选择专项检查；真实本机配对与页面验收仍需在运行环境完成。

### 补丁 ID：`supdance-workspace-governance`
- **被修改的上游文件**：
  1. `.gitignore`
  2. `AGENTS.md`
- **修改原因**：上游 `.gitignore` 默认忽略 `docs/*`，需最小化放行 `!docs/supdance/`；并在 `AGENTS.md` 末尾追加第 10 节二开文档索引指针，不改动上游既有 1–9 节约定。
- **上游基线**：`v1.7.2` (`e4e3a40c94242b8845650e4c7090ec7cb6c46ed0`)
- **升级风险与回归保障**：`LOW`，均位于文件尾部追加且已纳入 `coupledUpstreamFiles` 与 `SUPDANCE_UPSTREAM_PATCH_REGISTRY` 自动对齐校验。

### 补丁 ID：`supdance-i18n-plugin`
- **1.2.0 扩展**：增加 Babel AST 增量扫描、版本化源文/译文基线、上游 Release 扫描草稿产物、可选受预算约束的模型补译 CLI，以及后台翻译更新中心。工作流草稿、审核、发布、锁定和十次历史回滚复用 SystemSetting，发布与审计事务提交；已有编辑/导入接口共享行锁。公开版本、ETag 与语言包恢复逻辑同步升级。宿主新增修改仅涉及 Quality/Upstream CI、推送前验证脚本、service 别名和 VERSION；业务实现继续位于原插件边界。详见 `docs/content/docs/backend/supdance-i18n.mdx`。
- **被修改的上游文件**：
  1. `backend/internal/app/plugin_management.go`
  2. `backend/internal/handler/api.go`
  3. `web/src/lib/plugins/builtin/index.ts`
  4. `web/src/components/layout/app-providers.tsx`
  5. `web/src/components/layout/workspace-top-bar.tsx`
  6. `web/src/pages/auth/auth-scene.tsx`
  7. `web/src/pages/canvas/canvas-project-top-bar.tsx`
  8. `web/src/pages/admin/components/admin-shell.tsx`
  9. `web/src/pages/admin/plugins/plugins-page.tsx`
  10. `web/src/router.tsx`
- **修改原因**：以可热插拔插件形式在站点右上角挂载语言切换器 `<TopbarLanguageSwitcher />`、在 `AppProviders` 注入动态 `ConfigProvider locale` 与 `<SupDanceI18nRuntimeHost />`，并在后台挂载语言管理设置 (`/admin/i18n/settings`) 与字段词条修改 (`/admin/i18n/entries`) 路由。
- **上游基线**：`v1.7.2` (`e4e3a40c94242b8845650e4c7090ec7cb6c46ed0`)
- **升级风险与回归保障**：`LOW`，所有核心状态、词库、DOM 翻译器与后台管理页面均隔离在 `web/src/supdance/plugins/i18n/` 与 `backend/internal/supdance/i18n/` 下，宿主仅保留单行组件挂载与路由注册。

### 补丁 ID：`supdance-music-plugin-gates`
- **被修改的上游文件**：
  1. `web/src/components/auth/require-plugin.tsx`
  2. `web/src/pages/create/creation-workspace.tsx`
  3. `web/src/stores/use-plugin-store.ts`
  4. `web/src/lib/model-picker-groups.ts`
- **修改原因**：上游路由守卫 (`RequirePlugin`) 与创作岛模式药丸原先优先读取本地安装记录（`ensurePlugin` 新建记录默认 `enabled=false`）或别名 id `music-generation`（服务端无对应状态记录），会把服务端 `effectiveEnabled=true` 的插件误判为停用（`/toolbox/music` 曾因此整页拦截）。现将判定收敛为 `use-plugin-store` 导出的 `selectPluginEffectivelyEnabled`（服务端 states → 运行时 statuses → 本地安装记录），插件 id 一律使用清单 id `supdance-music-generation`，与后端 `CheckMusicTaskAdmission` 的准入判定保持一致。
- **上游基线**：`v1.7.3`
- **升级风险与回归保障**：`LOW`，仅调整插件生效判定的读取顺序与 id 常量来源，不改变任何路由、权限或业务逻辑；已纳入 `coupledUpstreamFiles` 与 `SUPDANCE_UPSTREAM_PATCH_REGISTRY` 自动对齐校验，并由 `web/test/supdance-extension-isolation.test.ts` 校验注册表与 `supdance/config/baseline.json` 对齐。
- **完整上游合并后的并行补丁收敛**：保留音乐配置任务已部署的 Suno / Mureka / MiniMax 品牌分组、选项去重与整数秒时长滑条。分组只影响显示，不合并渠道身份，不改变模型选择、报价或收费。滑条复用 AntD 和既有国际化词条，预设按钮同步禁用态与 `aria-pressed`。模型分组、渠道身份与报价回归位于 `web/test/model-picker-groups.test.ts`，后续更新须同时保留这些控件改动。

### 补丁 ID：`supdance-visual-engine`

- 页面规则、加载回退与模型选择器精简样式在插件目录内生效。上游升级时保留既有主题与浮层扩展接入点，合并候选由 `supdance-upstream-sync.yml` 运行扩展隔离、宿主皮肤及视觉引擎专项回归。
- 运行时按宿主扩展能力启停，复用服务端发布包。应用挂载、Router、皮肤及浮层扩展由升级门禁检查。运行态验收和上游 UI 差异见 [宿主兼容性](visual-engine/HOST_COMPATIBILITY.md)。
- 动效总开关复用 `motion.enabled`，新配置默认关闭；插件生命周期内控制全站 CSS 与现有 Motion 库，页面规则不能越过总开关。关闭时复用上游 `WorkspaceRouteLoader`，不新增加载或路由动画、不新增宿主补丁点；既有发布配置需管理员关闭开关后发布。上游比对依据与回滚方式见 `visual-engine/MOTION_ENGINE.md`。
- **被修改的上游文件**：
  1. `backend/internal/app/plugin_management.go`
  2. `backend/internal/handler/api.go`
  3. `web/src/application.tsx`
  4. `web/src/components/auth/auth-session-hydrator.tsx`
  5. `web/src/components/layout/app-providers.tsx`
  6. `web/src/components/ui/product/app-drawer/app-drawer.tsx`
  7. `web/src/components/ui/product/app-modal/app-modal.tsx`
  8. `web/src/layouts/user-layout.tsx`
  9. `web/src/lib/canvas-theme.ts`
  10. `web/src/lib/skin-themes.ts`
  11. `web/src/pages/admin/components/admin-shell.tsx`
  12. `web/src/pages/admin/plugins/plugins-page.tsx`
  13. `web/src/router.tsx`
  14. `web/src/services/diagnostics/client-diagnostics.ts`
  15. `web/src/stores/canvas/use-canvas-theme-store.ts`
  16. `web/src/lib/overlay-extensions.ts`，为现有 Modal 和 Drawer 提供扩展变更订阅。
  17. `web/src/styles/globals.css`，空间工作台的现有遮罩规则读取扩展变量，默认值沿用宿主。
- **修改原因**：以独立插件形式挂载双入口 Visual Console、主题/浮层扩展、恢复动画边界和插件生命周期控制；业务配置、权限、审计、发布与回滚集中在 `web/src/supdance/plugins/visual-engine/` 和 `backend/internal/supdance/visualengine/`。
- **上游基线**：`v1.7.3`
- **升级风险与回归保障**：`LOW`，所有耦合点已纳入 `SUPDANCE_UPSTREAM_PATCH_REGISTRY`、`supdance/config/baseline.json` 与扩展隔离测试；配置热插拔、失败回退、停用清理和发布/回滚已有专项测试，但独立安装包闭环仍待完成。

## 法律页默认模板品牌标识

原工作区法律页默认模板的站点标识一并保留。独立 HTML 模板沿用既有黑底品牌和 32px 容器／27px 图像，不继承宿主设计 token；这是现有品牌图像的局部例外，只影响默认条款与 AUP 模板，不覆盖用户已保存页面。

## 网站生成前提示词筛查

独立 `backend/internal/supdance/contentsafety/` 负责 Waffo 签名、判定和有界重试。组合根仅初始化开关并在普通／工作流生成前调用；路由尝试拒绝针对筛查失败切换供应商。自定义 relay 的创建路径在启用时关闭，读取保留，避免任意 payload 绕过最终提示词检查。默认关闭，启用依赖商户配置、提示词外发授权与真实任务验收。没有数据库变更。配置、回退与影响见 [PROMPT_SCREENING.md](PROMPT_SCREENING.md)。
## ONE identity and community bridge (2026-11-12)

See [ONE federation](ONE_FEDERATION.md) for scoped ownership proofs, read-only
canonical wallet/media, legacy accounting compatibility and rollout/rollback.
The host seams are registered under `supdance-one-identity-community`.
## 音乐插件 UI 与后台主题隔离

- 音乐后台复用 AdminPageFrame、AdminSegmented、SettingsSectionCard、AdminStatTile、AdminDrawer 和 AdminModal；共享音乐表单通过显式 admin 属性选择宿主后台控件。
- `music-admin.css` 在音乐后台及其浮层根内映射后台令牌。前台继续使用站点语义令牌，触控目标、焦点态、窄屏布局及减少动效集中在音乐插件样式内；不改变报价、权限、钱包或任务协议。
- 生产 Web 发布 `8a791236`（`supdance/v2026.11.12.2`）；复用既有 Compose，并通过只读 release 挂载和 Web 入口脚本发布。真实 Chrome 的桌面及手机明暗主题矩阵、三个辅助弹窗通过，未提交收费生成。剩余人工范围见待测试清单。

## 线上磁盘备份与产物保留

- 独立运维实现位于 `tools/supdance/retention/`，使用服务器 systemd 定时运行，不改业务服务、数据库表或素材回收规则。配置及凭据留在服务器，源码中不保存私有环境。
- 当前部署、固定回滚材料、数据库和素材受保护；备份校验、引用检查、数量与年龄保留、每批删除上限及结束健康检查共同约束自动删除。规则与操作见 [定期清理策略](SERVER_RETENTION.md)。

个人中心使用局部中性色，创作首页在返回时退出历史对话。后台语言管理共用系统语言列表并可保存站点配置。插件安装、卸载和启停通知各标签页，页面管理的 HTML 和邮件模块跟随各自的插件状态。

## 积分中心结算展示

补丁 `supdance-wallet-checkout-presentation` 在现有结算栏将已识别的渠道显示为品牌简称。积分套餐在总积分下显示已包含的赠送数量，只有商品说明中的基础积分与赠送积分之和等于发放总额才展示明细。积分标识使用中性色宝石图标。此接缝独立于下单和积分发放。

## 站点维护者信息

欢迎页移除上游贡献者名录及其导航、头像和联系方式，MIT 入口直接下载仓库的 `LICENSE`。仓库维护者使用 `supdance`，安全和社区报告统一使用本站支持邮箱。继承代码的原始版权声明保存在 `LICENSE` 和 `NOTICE`，上游同步仍按实际仓库地址进行。升级时核对 `supdance-maintainer-metadata`，避免欢迎页再次从上游 README 加载个人信息。

`web/test/supdance-maintainer-metadata.test.ts` 随 GitHub 的 Web 质量检查运行。解决上游冲突后，核对名录、头像、维护者联系方式及原始 MIT 声明。Web 镜像同时携带 `LICENSE` 和 `NOTICE`，正式发布应以通过检查的 SupDance 标签构建并部署。

## 图片工作台与全站完整性补齐

创作页图片模式提交后跳转独立 `/workspace/image/:sessionId` 工作台（`web/src/pages/workspace/`）。结果经 `consumeGenerationTaskMessage` 幂等物化入素材库；云端恢复按 `resultStorageKeys` 重建展示；网络中断标 `syncInterrupted` 自动重连，未确认失败只提供重新获取结果；参数面板与报价接模型能力合同和服务端 `quoteModel`；个人路由受 `imageWorkbenchEnabled` 门禁，团队空间不开放图片生成。创作历史 settings 前后端 16 键对齐（含 `imageResolution`），`instrumental`/`transparentBackground` 布尔往返保持类型。MiniMax Music 协议补 `detachedPolling`，风格/语言并入 prompt（runninghub-standard 1.1.3）。上游退役的 `/timeline/*` 接口与 editor-shell 留置不改动画布本地时间线（`supdance-canvas-timeline-editor`）。

## SupDance Studio 私有业务入口

候选侧栏在官网后端进程内增加独立私有监听，可选配置见 `.env.example`。网关的 v1 和 v2 使用各自的服务凭据，官网公开监听保留现有 v1 配置。候选的 MCP 和 OAuth 保持独立进程及数据卷。启用时，短剧项目、用户权限、资源、积分账本与后台任务沿用官网服务和数据，存储配额检查由同一后端进程协调。本变更没有数据库迁移。

Studio 优先使用官网系统渠道目录。渠道报价与生成通过现有任务入口重建规格、价格档和执行协议，报价签名含实际协议绑定。工作台继续接受已支持的逻辑模型选择。此变更不调整官网模型 API。

