# SupDance Stripe 支付

Stripe 渠道使用托管 Checkout 收取主站一次性的积分和存储商品款。后台商品是价格和权益的来源。渠道复用主站的 USD / CNY 结算换算，并固定 Checkout 币种和应付金额。Stripe 控制可用支付方式。

## 安装与配置

1. 从仓库根目录运行 `sh supdance/plugins/supdance-payment-stripe/build.sh`。在带有 Stripe 宿主适配的版本中，通过「插件管理」上传构建产物。也可以随部署将包加入宿主的官方插件目录。
2. 打开「支付充值 → 支付渠道 → Stripe → 配置」。填写主站的公网 HTTPS 地址和结算币种。测试模式使用隔离环境，填写指定的主站测试用户 ID。
3. 在 Stripe 所选模式的 Workbench 中注册后台显示的 `/api/payments/notify/stripe/webhook` 完整地址。使用发送完整对象快照的事件端点，订阅 `checkout.session.completed`、`checkout.session.async_payment_succeeded`、`checkout.session.async_payment_failed` 和 `checkout.session.expired`。
4. 在后台保存同一模式的 Stripe API 密钥与端点签名密钥，再启用渠道。受限密钥需要创建、读取及过期 Checkout Sessions 的权限。凭据由宿主加密保存。续存或轮换配置时保留同一个 Stripe 端点。

启用后，可用用户在钱包选购积分或存储商品，并在支付方式中选择 Stripe。付款页返回主站后可查阅订单状态。Stripe 通知和主动查单共用同一入账事务。延迟付款需要 Stripe 确认已支付才能发放权益。Stripe 交易引用保存为 Checkout Session ID。

已有订单的渠道按宿主规则锁定 `mode`。在同一主站测试时，从正式安装包生成独立的沙盒包，两个渠道分别保存配置和订单：

```sh
python3 supdance/plugins/supdance-payment-stripe/sandbox-package.py \
  /path/to/ourslake-stripe.yingce-plugin /path/to/ourslake-stripe-sandbox.yingce-plugin
```

沙盒包复用相同的运行文件，渠道 ID 为 `stripe-sandbox`，且只接受测试模式。安装后在「Stripe Sandbox」后台配置指定测试用户，Webhook 路径为 `/api/payments/notify/stripe-sandbox/webhook`。有权使用 Stripe 的用户在钱包看到「Stripe」并默认选中。正式与沙盒渠道同时可用时，钱包显示正式渠道。停用渠道会阻止新单，已下单的 Stripe 事件仍可通过对应端点处理。插件覆盖一次性收款与关单，退款、订阅和 Stripe 账单下载需在 Stripe 侧处理。

## 自动化验证

从仓库根目录运行 `sh supdance/plugins/supdance-payment-stripe/test.sh`。脚本构建本机支付包，在隔离 SQLite 验证安装、后台配置、用户渠道权限、通知验签与入账幂等，并对 Stripe SDK 请求做本地协议测试。已有本机支付包时可用 `SUPDANCE_STRIPE_PLUGIN_PACKAGE` 指定完整路径。

真实 Stripe API 冒烟测试可向测试进程注入 `SUPDANCE_STRIPE_SANDBOX_API_KEY`。该用例在 Stripe 沙盒创建、查询并过期一张测试收银台。本地联调可将站点地址设为本机回环 HTTP 地址，在沙盒用 Stripe CLI 将上述四种事件转发到本地 Webhook。配置使用监听进程的 Webhook 签名密钥。
