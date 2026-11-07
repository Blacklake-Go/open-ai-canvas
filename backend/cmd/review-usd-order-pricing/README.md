# 模型整单美元扣分

- 在 `backend` 下运行 `go run ./cmd/review-usd-order-pricing < cases.json > receipts.json`，每行试价均按一笔完整订单或一种完整订单情景填入。命令只读输入文件，输出逐行回执。有阻断行时仍输出所有结果，以非零状态退出。
- 输入是 JSON 数组。每项填写 `id`、`orderUnit`、`basis`、`retailUSD`、`costUSD`、`costSource`、`netUSDPerPoint`、`revenueSource`。金额用十进制字符串或整数比率字符串，保持原始精度。每分净收入应计入赠金、返佣、支付费税及全部适用扣减。成本与支付来源字段填单据或结算条件版本。
- `basis: "verified"` 表示调用方已核实输入，输出 `verifiedTrial`。`basis: "scenario"` 用于带假设的测算，输出 `scenarioOnly`。两者均只作试价。缺少必需金额或来源则输出 `blocked` 和原因，保留可计算的商业参考分，不生成试价分。
- `minMarginBPS` 默认 0（保本）。大于 0 时同时传该情景的 `grossUSDPerPoint`（相同赠金、返佣口径下税费前实付 USD/分）。毛利的分母是实付金额。多种情景分别出具回执并取最高下限。
- [ ] 接入后用同一版本定价快照测试报价、冻结、实扣和退款，核对旧订单仍按原快照处理。
