# Mureka 音乐工具

在平台系统渠道中启用此协议，Base URL 填 `https://api.mureka.ai`，密钥须来自 Mureka API Platform。只在音乐工作台使用。渠道管理员分别创建、启用并报价以下上游模型标识。

| 上游模型标识 | 实际操作 |
| --- | --- |
| `mureka/reference` | 上传用户持有的参考音乐，按歌词生成 |
| `mureka/persona` | 用授权的人声样本创建或复用声线，再按歌词生成 |
| `mureka/remix` | 上传原曲，按新风格与歌词进行 Remix |
| `mureka/region` | 在原曲的选定毫秒区间重写歌词 |
| `mureka/stems` | 分离并归档 WAV 音轨 |

参考、声线与 Remix 使用 Mureka 9.5，每次请求 1 首。分轨使用 audio-separation-1，最多返回 5 轨。独立 SKU 的报价应覆盖对应操作及其前置步骤。宿主负责校验资源归属、前置上传、异步回查与结果归档。商户权限以 Mureka API Platform 账户和实际调用回执为准。

[官方接口文档](https://platform.mureka.ai/docs/)
