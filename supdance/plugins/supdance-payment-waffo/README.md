# Waffo Pancake 支付渠道

通过影策 `yingce.payment/v1` RPC 运行，使用 `@waffo/pancake-ts` 创建一次性钱包充值收银台。宿主负责订单、加密配置、回调收件箱和幂等入账。插件包适用于使用 Node.js 20+ 的 Linux 和 macOS。Windows 未提供入口。

## 构建与配置

1. 在仓库根目录执行 `sh supdance/plugins/supdance-payment-waffo/build.sh`。构建需要 npm、Bun 和 zip，生成的插件包在 `.local/cache/waffo-pancake/`。
2. 在 Waffo 后台选择指定店铺，创建或选用一次性商品。生产商品须先发布。核对商品支持的充值币种和税务分类，再复制 `PROD_…`。目前宿主支持 USD 与 CNY，Waffo 对 CNY 一次性收银台提供微信支付。
3. 在影策后台上传插件包，填写公网 HTTPS 根地址、Merchant ID、Store ID、Product ID、税务分类和对应环境的商户 RSA 私钥。生产使用 `prod`。私钥填写到后台密钥字段。渠道验证检查配置格式和密钥，商户权限及商品发布状态需通过实际环境验收。
4. 在 Waffo 店铺后台添加 HTTP Webhook，选择与渠道一致的环境，只订阅 `order.completed`。将影策该渠道当前配置版本的通知地址填入 Waffo，格式为 `https://你的域名/api/payments/notify/waffo-pancake/<配置版本ID>`。保存新配置会产生新的版本地址。保留旧地址直到该版本的在途订单结束。多个版本回调并存时，只有订单所属版本会接受该事件。
5. 在测试环境以测试商品和测试私钥验收下单、回跳、真实签名通知、重复投递、主动补查和积分到账，再启用生产渠道。宿主要求订单币种和金额完全相符。请验证 Waffo 含税实收与钱包订单金额一致，税费导致金额变化时宿主会拒绝自动入账。

## 接口范围

- `create_order` 使用钱包订单金额覆盖商品价格，以商户订单号作为 Waffo 业务编号，并为 SDK 写请求设置幂等键。浏览器回跳只用于返回订单页面。
- `verify_notification` 使用原始请求体和 SDK 验签，校验环境、店铺及订单关联字段，按 Waffo 通知给出的实收金额交由宿主验证。
- `query_order` 通过商户订单号查询唯一的成功付款，验证店铺、环境及一次性商品，再将 GraphQL `Payment.amount` 和币种交由宿主核对。空查询结果仍保留待支付状态。
- 商户接口未提供本插件可用的一次性收银台主动撤销。关单请求只同步已确认的成功付款，其他订单继续由宿主保留并补查。弃单可能长期占用活跃订单或商品限额，需纳入渠道上线验收。退款、订阅和账单下载超出本插件范围。

接入参考 [Waffo Pancake 官方 Skill](https://docs.waffo.ai/zh/integrate/skill)。
