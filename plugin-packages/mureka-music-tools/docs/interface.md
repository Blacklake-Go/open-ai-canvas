# Mureka 音乐工具接口

## 配置和调用

在系统渠道配置文件中选择 `mureka-music-tools`。服务端持有 Mureka `apiKey`，使用 Bearer 认证和官方 Base URL。按 README 中各工具的 `model` 标识单独设定每次价格。参考、Persona 和 Remix 请求固定 `n=1`。局部重写按接口返回实际作品数量，分轨按一次分离计费。

## 上游合同

| 工具 | 前置请求 | 处理请求 |
| --- | --- | --- |
| 参考音频 | `POST /v1/files/upload`，multipart 文件和 `purpose=reference` | `POST /v1/song/generate` 携带歌词、`reference_id` |
| Persona | `POST /v1/song/vocal-clone`，multipart 声音样本 | 复用同一个账号、渠道和样本绑定的 `vocal_id`，提交歌词和可选风格 |
| Remix | `POST /v1/files/upload`，`purpose=remix` | `POST /v1/song/remix` 携带 `upload_audio_id`、新风格和歌词 |
| 局部重生成 | `POST /v1/files/upload`，`purpose=audio` | `POST /v1/song/region-edit` 携带新歌词、起止毫秒 |
| 分轨 | 宿主读取所属用户的原始文件 | `POST /v1/song/stem` 携带 `url` 音频数据和 `audio-separation-1` |

## 响应和恢复

生成类接口返回任务 `id` 和 `status`。宿主持久化回执后使用 `GET /v1/song/query/{task_id}` 查询，并将成功结果中的 `choices[].url` 归档。分轨接口同步返回 `zip_url`。宿主保存加密的归档地址，再校验、暂存和登记每条 WAV。前端只接收当前账号自己的作品、资源及音轨名称。新的工具渠道需要部署包含对应工作器的后端版本。

[官方 API 文档](https://platform.mureka.ai/docs/)

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "mureka-music-tools",
  "name": "Mureka Music Tools",
  "version": "1.0.0",
  "author": "SupDance",
  "description": "Official Mureka API operations for the music workbench",
  "documentation": "<当前插件的完整 documentation，由 README.md 与 docs/interface.md 拼接而成；为避免 JSON 递归，此处不重复展开正文。>",
  "permissions": [
    "generation.run",
    "media.read"
  ],
  "configuration": {
    "fields": [
      {
        "name": "apiKey",
        "type": "secret",
        "label": "Mureka API Key",
        "required": true
      }
    ]
  },
  "contributes": {
    "providers": [
      {
        "id": "mureka-music-tools",
        "label": "Mureka Music Tools",
        "capabilities": [
          "audio"
        ],
        "scopes": [
          "admin.system-channel"
        ],
        "baseUrl": "https://api.mureka.ai",
        "detachedPolling": true,
        "auth": {
          "type": "bearer",
          "field": "apiKey"
        },
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": true,
            "mapping": "music operation SKU",
            "values": [
              "mureka/reference",
              "mureka/persona",
              "mureka/remix",
              "mureka/region",
              "mureka/stems"
            ],
            "description": "Select and price one operation per channel model."
          }
        ],
        "create": {
          "method": "POST",
          "path": "/v1/song/generate",
          "contentType": "application/json",
          "body": {
            "model": "mureka-9.5",
            "lyrics": {
              "$ref": "request.extra.lyrics"
            },
            "n": 1,
            "reference_id": {
              "$omitEmpty": {
                "$ref": "request.extra.reference_id"
              }
            },
            "vocal_id": {
              "$omitEmpty": {
                "$ref": "request.extra.vocal_id"
              }
            }
          }
        },
        "poll": {
          "method": "GET",
          "path": "/v1/song/query/{{taskId}}"
        },
        "response": {
          "taskId": {
            "$ref": "response.id"
          },
          "status": {
            "$ref": "response.status"
          },
          "message": {
            "$ref": "response.failed_reason"
          },
          "audios": {
            "$ref": "response.choices"
          }
        }
      }
    ]
  }
}
```
<!-- YINGCE_MANIFEST_CONTRACT_END -->
