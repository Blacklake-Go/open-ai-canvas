# 网站生成前提示词筛查

筛查默认关闭。启用后，后端在图片、视频普通任务与工作流调用上游创建接口之前，将最终展开的文本提示词发送至 Waffo；不发送参考媒体、用户身份、渠道密钥或任务正文。文本、音乐、音频任务不调用此接口。外部商户申请和重新提交不属于此代码功能。

## 处理边界

- 普通图片在风格与工具提示词展开之后检查；工作流使用其已解析的提示词检查，然后才水合媒体和创建上游任务。
- 仅 `allow` 继续生成。`block`、`review`、服务降级、异常响应、凭据缺失和超长提示词均不调用生成模型。服务端保存失败任务，原有终态与账务机制释放冻结额度；需要人工审核的任务由用户稍后重试。
- `429` 按 `Retry-After` 等待，`5xx` 与网络失败按 5、10、20 秒退避，最多重试三次。服务降级的 `review` 同样退避；其他 `4xx` 不重试。整个筛查最长 90 秒，过长的等待明确失败，保留可重试的任务记录。
- 筛查失败不能触发供应商路由切换。启用但配置错误时同样拒绝生成。
- 任意自定义 relay 请求无法可靠还原最终生成提示词。因此启用筛查时，relay 只允许读取；创建请求必须通过具有明确生成合同的任务队列。该限制也影响使用 relay 的直接文本请求，启用前必须确认其前端入口已使用队列，或保持关闭等待调整。
- 请求采用 RSA-SHA256 签名，固定 HTTPS 地址、拒绝重定向、限制响应大小。错误信息不包含提示词、签名、私钥或上游响应正文。

## 配置与启用

准备已有商户 ID，以及服务端可读取的 RSA PEM 私钥文件（PKCS#1 或 PKCS#8，至少 2048 位）。私钥不能提交仓库、写入浏览器配置或发到聊天中。宿主机文件限制为实际服务所需的读取权限。

受管部署的 `docker-compose.deploy.yml` 已透传三个配置变量。可将私钥保存于持久数据目录中的 `.waffo-prompt-private.pem`，限制为后端运行用户只读，并在服务器 `.env` 设置：

```dotenv
CANVAS_WAFFO_PROMPT_SCREENING_ENABLED=true
CANVAS_WAFFO_MERCHANT_ID=<merchant-id>
CANVAS_WAFFO_PRIVATE_KEY_FILE=/data/.waffo-prompt-private.pem
```

随后使用实际生产 Compose 和 `--no-deps` 重新创建后端。无需迁移数据库。可回滚这三个变量并重新创建后端；关闭筛查会恢复先前生成策略，应与网站审核和运营要求一起评估。

若私钥保存在数据目录之外，可使用 Compose override 在实际后端进程只读挂载文件。例如：

```yaml
services:
  backend:
    environment:
      CANVAS_WAFFO_PROMPT_SCREENING_ENABLED: "true"
      CANVAS_WAFFO_MERCHANT_ID: "${CANVAS_WAFFO_MERCHANT_ID}"
      CANVAS_WAFFO_PRIVATE_KEY_FILE: /run/secrets/waffo-private.pem
    volumes:
      - /path/to/private/waffo-private.pem:/run/secrets/waffo-private.pem:ro
```

使用 override 时必须将其纳入实际发布命令，并在后续 Host Updater 操作中保留。未来更新必须使用包含上述环境变量透传的 Compose；升级到不包含透传的文件会关闭筛查，升级前需校验实际容器环境。

启用前确认网站隐私披露、向第三方发送提示词的授权、relay 入口影响及现有凭据。先用专用测试提示词验证允许、拒绝、限流和服务失败，再验实际网站任务、上游零调用与额度释放。协议专项通过不等于真实商户调用成功。

关闭 `CANVAS_WAFFO_PROMPT_SCREENING_ENABLED` 并重新创建后端，可恢复原有 relay 和生成策略；该操作应与网站审核、隐私和运营决定保持一致。此功能没有数据库迁移。

官方合同：[生成前提示词筛查](https://docs.waffo.ai/zh/api-reference/endpoints/content-safety/scan-prompt)。
