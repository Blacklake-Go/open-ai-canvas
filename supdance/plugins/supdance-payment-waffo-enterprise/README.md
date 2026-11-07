# Waffo Enterprise Sandbox

使用官方 Go SDK v2.3.0，实现影策钱包的一次性支付创建、查单、取消与签名通知。支持 Linux、macOS、Windows 的 amd64/arm64。需要同时部署支持签名应答、用户上下文和限定用户的宿主版本。

## 配置

- 在插件中心安装包，支付后台填写商户 ID、收款 API Key、商户 RSA 私钥和 Waffo 公钥。使用企业版沙盒凭据。
- 插件升级后重新保存渠道配置，确保新订单绑定的插件版本与配置快照一致；升级前先处理未完成订单。
- `environment` 必须是 `SANDBOX`，`allowedUserId` 为指定审核账号的用户 ID。宿主列表和下单入口均检查这个限定，插件再次校验稳定的用户 ID。
- 结算货币可填 `CNY` 或 `USD`。宿主沿已有金额换算与汇率快照合同处理商品价格。插件从服务端请求读取货币和最小单位金额。
- 公网地址和商品地址使用 HTTPS，通常商品地址可用公开的 `/pricing`。
- 请求中的 `notifyUrl` 固定到订单创建时的配置版本。通知必须保留原始请求体和 `X-SIGNATURE`。SDK 验签并生成签名应答，宿主持久接收后返回原始 `{"message":"success"}` 与对应签名。

## 订单与到账

商户订单号同时作为 32 字符 `paymentRequestId`，在 SDK 写调用前由宿主持久化。收单号保存到订单的 `provider_trade_no`。未知创建状态使用原请求号查单，未知取消状态只在查到成功付款或确切关闭后结束。签名通知与查单均校验商户、审核账号、支付产品、金额、币种、订单号和终态。通知落入持久收件箱，宿主的订单事务负责幂等发放积分或存储权益。

此版本只能在指定账号中模拟充值。沙盒不产生真实收款。退款、订阅、自动扣款及正式环境未集成。

在仓库根目录执行 `sh supdance/plugins/supdance-payment-waffo-enterprise/build.sh` 构建。产物在 `.local/cache/waffo-enterprise/`。
