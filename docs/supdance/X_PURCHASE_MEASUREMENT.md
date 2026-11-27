# X 付款成功衡量

## 运行合同

前端扩展在 `web/src/supdance/marketing/`；宿主仅在应用根挂载同意组件，并在 `usePaymentOrderFlow.settle` 接收服务端 `credited` 订单时调用。不修改下单、通知验签、积分账本或数据库 Schema。

网站对标记为 `utm_source=x` 和 `utm_medium=paid_social` 的访问，按 `supdance_sales_zh`、`supdance_sales_ja`、`supdance_sales_202611`、`supdance_sales_zh_ja_202611` 和 `canvas_zh_market_202611` 选择像素 `rih9p`，其购买事件为 `tw-rih9p-rk5ya`。其余访问使用 `rinhf`、`tw-rinhf-rinl3`。同意后，系列标识和有效点击 ID 最多保留 30 天，用于恢复登录和付款返回后的归因。另一广告系列的访问替换本次归因，撤回时清除归因。一次购买只发送到其对应像素。

画布广告活动 `43176202` 的三个广告组以 `rih9p` 的 `Landing page views` 为优化事件。测量桥在未收到 `source=sales` 时也会识别这批广告来自同源首页且已同意衡量的访问，以支持还在使用旧应用资源的浏览器。这个判断只读取指定 UTM 及同意状态，桥接地址与对 X 发送的信息范围维持原合同。

生产入口使用 [Nginx 精确路径规则](../../tools/supdance/marketing/x-canvas-measurement.nginx.conf) 提供测量桥，避免未集成源码修改的 Web 构建覆盖测量桥。包含新 UTM 规则的应用构建经过线上验证后，可移除该入口规则并恢复由 Web 容器提供测量桥。真实 Chrome 对三组落地链接验证了同意前无测量请求、同意后选择 `rih9p`。其中一次不带广告点击 ID 的直访收到 X 的 HTTP 200，另外两次拦截了发出的请求。按广告组归因的落地页浏览以 X 广告报表的真实投放数据为准。

`web/public/supdance-x-measurement.html` 是正式测量桥接文档。用户同意后宿主创建 iframe，vendor 脚本在独立文档中运行，自动元数据不会携带工作台地址、标题、付款回跳参数或素材链接。父页面通过检查来源的 postMessage 传递金额、币种和 SHA-256 订单去重编号。合法点击标识以 twclid 传入独立文档。拒绝或撤回会移除 iframe，隐私页提供随时管理入口。支持原有 supdance-i18n 六种语言。

只发送本次接入后新建、已入账且金额有效的支付宝 `alipay-page-pay` 或微信 `wechat-native` 订单。CNY / USD 均按订单快照最小单位除以 100，不自行换汇。Waffo Enterprise、Waffo Pancake 与未知渠道目前不具备本扩展的正式收款确认名单，全部不发送；新增渠道必须先确认其生产/沙盒隔离。旧订单、兑换码、管理员改积分、URL 成功参数、待付款、失败和关闭订单不发送。

本机最多保存 200 条去重摘要；重复轮询和刷新不重复发送，跨浏览器的重复以 X `conversion_id` 去重。广告模块错误不会阻断支付确认或余额刷新。浏览器网络阻断、广告拦截、拒绝同意或付款后不再打开网站会导致漏报；此版本不是服务端 Conversion API，也不能保证每笔后端入账都传到 X。网页不传邮箱、手机号、创作内容或支付凭据。

## 验证与发布

- 专项测试覆盖真实金额与币种转换、状态/沙盒/历史/异常金额排除、同意边界、桥接加载与订单去重。
- 生产基线必须再次检查公网 release.json、容器和静态目录；本次从 `0bb324a4` / `v1.8.0-supdance.9` 创建独立工作区，保留原工作区已有修改。
- 只增量发布本次构建 assets、测量桥接文档并替换入口的构建资源引用，保留线上其他 public 内容；入口备份后可直接恢复，无数据库迁移或账本回滚。
- 不发送虚构 Purchase 来“激活”事件。最终验收需要新发生、用户同意衡量的真实付款，并核对 X 接收情况。纯本地测试、vendor 基础访问事件或 HTTP 200 不能代替真实购买验收。
- 本次广告测试总预算维持 USD 10；本接入不修改广告预算、付款卡或发布状态。

## 已取得的证据

- 类型检查与生产构建通过；付款衡量、扩展隔离与设计规范专项合计 24 pass / 0 fail。
- lint 通过。扩大前端测试在既有 `provider-neutral-generation-effects.test.ts` 两项跨标签锁用例超时；在未修改的 `0bb324a4` 工作区独立复测同样超时，未宣称全量测试通过。
- 公网前端增量已发布；生产入口原件在服务器 `releases/x-purchase-161f5a3b/index.before.html`。公开 release 基线、后端与数据库保持原部署。
- 真实 Chrome 的默认状态未观察到测量文档或 X 请求。同意后，测量文档、`static.ads-twitter.com/uwt.js` 与 `analytics.twitter.com/1/i/adsct` 均返回 HTTP 200；页面无错误日志。撤回后测量 iframe 数为 0。
- 隐私页已显示衡量说明与管理入口；已检查桌面明暗主题及手机断点，手机按钮改为纵向排列并保持至少 44px 的触控高度。
- X 广告草稿现场读取确认：每日 USD 10、总支出上限 USD 10、购买事件 `SupDance Purchase | 付款成功`。
- Purchase 真实付款验收仍需用户完成一笔新支付宝或微信付款；未以沙盒、旧订单、虚构交易或手工触发 Purchase 冒充真实收入。
