# RunningHub Standard Model 接口字段

## 协议身份

- 插件 ID：`runninghub-standard`。
- Provider ID：`runninghub-standard-image` / `runninghub-standard-video` / `runninghub-standard-audio`。
- 能力：`image` / `video` / `audio`。
- 默认 Base URL：`https://www.runninghub.ai`。
- 鉴权驱动：`bearer`。
- 创建：`POST /openapi/v2/{{request.model}}`。
- 查询：`POST /openapi/v2/query`。

## 配置字段

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `apiKey` | secret | 是 | RunningHub API Key（标准模型需企业级-共享密钥）。 |

## 统一字段映射

| 统一字段 | 类型 | 必填 | 上游映射 | 说明 |
| --- | --- | --- | --- | --- |
| `model` | string | 是 | `create path` | 标准模型端点，如 `rhart-image-g-2-official/text-to-image`、`kling-v4/image-to-video`。 |
| `prompt` | string | 是 | `prompt` / `text` | 提示词或合成文本。 |
| `images` | media[] | 否 | image：`imageUrls`；video：`imageUrl`+`firstImageUrl`+`lastImageUrl`+`imageUrls` | 参考图、编辑源图或首尾帧。 |
| `videos` | media[] | 否 | video：`videoUrl` | 参考视频。 |
| `audios` | media[] | 否 | audio：`audioUrl`；video：`audioUrl` | 参考音频。 |
| `duration` | integer | 否 | video/audio：`duration`（字符串化） | 时长秒数。 |
| `aspectRatio` | string | 否 | `aspectRatio` | 画幅比例。 |
| `resolution` | string | 否 | `resolution` | 分辨率档位。 |
| `quality` | string | 否 | `quality` | 质量档位。 |
| `watermark` | boolean | 否 | video：`watermark` | 水印开关。 |
| `seed` | integer | 否 | `seed` | 随机种子。 |
| `providerOptions` | object | 否 | audio：`voice_id`/`speed`/`volume`/`pitch`/`emotion`/`lyrics`/`style`（命名空间 `runninghub-standard.*`） | 厂商扩展字段。 |

## 上游请求模板逐字段清单

| 上游位置 | 值或转换表达式 |
| --- | --- |
| `create.originPath` / `poll.originPath` | `true`：路径以 `/openapi/v2/...` 为站点根路径直发，避免宿主按 OpenAI 兼容默认值插入 `/v1` 前缀（否则上游返回 401） |
| `create.method` | `"POST"` |
| `create.path` | `"/openapi/v2/{{request.model}}"` |
| `create.contentType` | `"application/json"` |
| `create.body.prompt` | `{"$ref":"request.prompt"}` |
| `create.body.imageUrls` (image) | `{"$omitEmpty":{"$map":{"from":{"$ref":"request.images"},"as":"media","in":{"$ref":"media.value"}}}}` |
| `create.body.imageUrl/firstImageUrl` (video) | 第一张参考图 URL |
| `create.body.lastImageUrl` (video) | role 为 `last` 的参考图 URL |
| `create.body.imageUrls` (video) | 参考图 URL 列表；单图也发送，满足只接受 `imageUrls` 的端点（如 Veo 3.1 Fast） |
| `create.body.videoUrl/audioUrl` | 参考视频/音频的第一个 URL |
| `create.body.duration` | `{"$omitEmpty":{"$toString":{"$ref":"request.duration"}}}` |
| `create.body.aspectRatio/resolution/quality/seed/watermark` | 同名统一字段，空值省略 |
| `create.body.enable_base64_output` (audio) | 常量 `false` |
| `create.body.english_normalization` (audio) | 常量 `false` |
| `create.body.voice_id/speed/volume/pitch/emotion/lyrics/style` (audio) | `{"$omitEmpty":{"$ref":"request.providerOptions.runninghub-standard.*"}}` |
| `poll.method` | `"POST"` |
| `poll.path` | `"/openapi/v2/query"` |
| `poll.body.taskId` | `{"$ref":"taskId"}` |

## 响应映射逐字段清单

| 映射位置 | 上游路径或转换表达式 |
| --- | --- |
| `response.taskId` | `{"$coalesce":[{"$ref":"response.taskId"},{"$ref":"taskId"}]}` |
| `response.status` | `{"$coalesce":[{"$ref":"response.status"},"pending"]}` |
| `response.message` | `{"$coalesce":[{"$ref":"response.errorMessage"},{"$ref":"response.errorCode"}]}` |
| `response.images` (image provider) | `{"$ref":"response.results"}` |
| `response.videos` (video provider) | `{"$ref":"response.results"}` |
| `response.audios` (audio provider) | `{"$ref":"response.results"}` |
| `response.errorPaths[0]` | `"errorCode"` |
| `response.messagePaths[0]` | `"errorMessage"` |
| `response.resultEphemeral` | `true` |
| `response.usage` | `{"$ref":"response.usage"}` |

## 响应与错误

上游 `status` 为 `QUEUED/RUNNING` 时映射为待处理/生成中，`SUCCESS` 映射为成功，`FAILED` 与非空 `errorCode` 映射为失败并携带 `errorMessage`。`results[].url` 是 24 小时临时链接，宿主立即下载持久化。

## 兼容边界

标准模型各端点的参数集合不同（例如 gpt-image 端点要求 `quality`，可灵端点要求 `firstImageUrl`）。模板统一携带通用字段并省略空值，端点会忽略与其无关的字段；模型特有参数通过渠道模型的参数默认值或 `providerOptions.runninghub-standard.*` 传入。上游官方文档声明标准模型 API 仅支持企业级-共享 API Key。

<!-- YINGCE_MANIFEST_CONTRACT_START -->
## Manifest 完整接口定义

以下 JSON 与插件包内实际 `manifest.json` 逐字段一致，覆盖插件身份、权限、配置、鉴权、参数、校验、创建、Agent、查询、取消、结果下载、响应和 Agent 响应映射。`documentation` 字段的值就是当前完整文档；为避免文档在自身内部无限递归，JSON 中仅用等义占位文本表示正文。

```json
{
  "apiVersion": "yingce.plugin/v2",
  "id": "runninghub-standard",
  "name": "RunningHub Standard Model",
  "version": "1.0.0",
  "author": "RunningHub / 影策",
  "description": "RunningHub 标准模型 API 独立请求协议插件。",
  "permissions": [
    "generation.run",
    "media.read"
  ],
  "configuration": {
    "fields": [
      {
        "name": "apiKey",
        "type": "secret",
        "label": "API Key",
        "required": true
      }
    ]
  },
  "contributes": {
    "providers": [
      {
        "id": "runninghub-standard-image",
        "label": "RunningHub Standard Image",
        "capabilities": [
          "image"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation",
          "agent"
        ],
        "baseUrl": "https://www.runninghub.ai",
        "requiresPublicMediaUrls": false,
        "auth": {
          "type": "bearer",
          "field": "apiKey"
        },
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": true,
            "mapping": "create path",
            "description": "RunningHub 标准模型端点，如 rhart-image-g-2-official/text-to-image。"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt",
            "description": "图片提示词或编辑指令。"
          },
          {
            "name": "images",
            "type": "media[]",
            "required": false,
            "mapping": "imageUrls",
            "description": "参考图或编辑源图，图生图端点必填。"
          },
          {
            "name": "aspectRatio",
            "type": "string",
            "required": false,
            "mapping": "aspectRatio",
            "description": "画幅比例，如 16:9。"
          },
          {
            "name": "resolution",
            "type": "string",
            "required": false,
            "mapping": "resolution",
            "description": "分辨率档位 1k/2k/4k，多数端点必填。"
          },
          {
            "name": "quality",
            "type": "string",
            "required": false,
            "mapping": "quality",
            "description": "质量档位 low/medium/high，仅部分端点接受。"
          },
          {
            "name": "seed",
            "type": "integer",
            "required": false,
            "mapping": "seed",
            "description": "随机种子。"
          },
          {
            "name": "providerOptions",
            "type": "object",
            "required": false,
            "mapping": "provider-specific fields",
            "description": "插件命名空间内的厂商扩展字段。"
          }
        ],
        "imageParameters": [
          {
            "name": "size",
            "label": "画幅比例",
            "type": "string",
            "binding": "aspectRatio"
          },
          {
            "name": "imageResolution",
            "label": "分辨率",
            "type": "string",
            "values": [
              "1k",
              "2k",
              "4k"
            ],
            "default": "1k",
            "pricing": true,
            "binding": "resolution"
          },
          {
            "name": "quality",
            "label": "质量",
            "type": "string",
            "pricing": true,
            "values": [
              "low",
              "medium",
              "high"
            ],
            "default": "medium",
            "binding": "quality"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/openapi/v2/{{request.model}}",
          "contentType": "application/json",
          "body": {
            "prompt": {
              "$ref": "request.prompt"
            },
            "imageUrls": {
              "$omitEmpty": {
                "$map": {
                  "from": {
                    "$ref": "request.images"
                  },
                  "as": "media",
                  "in": {
                    "$ref": "media.value"
                  }
                }
              }
            },
            "aspectRatio": {
              "$omitEmpty": {
                "$ref": "request.aspectRatio"
              }
            },
            "resolution": {
              "$omitEmpty": {
                "$ref": "request.resolution"
              }
            },
            "quality": {
              "$omitEmpty": {
                "$ref": "request.quality"
              }
            },
            "seed": {
              "$omitEmpty": {
                "$ref": "request.seed"
              }
            }
          },
          "originPath": true
        },
        "poll": {
          "method": "POST",
          "path": "/openapi/v2/query",
          "contentType": "application/json",
          "body": {
            "taskId": {
              "$ref": "taskId"
            }
          },
          "originPath": true
        },
        "response": {
          "taskId": {
            "$coalesce": [
              {
                "$ref": "response.taskId"
              },
              {
                "$ref": "taskId"
              }
            ]
          },
          "status": {
            "$coalesce": [
              {
                "$ref": "response.status"
              },
              "pending"
            ]
          },
          "message": {
            "$coalesce": [
              {
                "$ref": "response.errorMessage"
              },
              {
                "$ref": "response.errorCode"
              }
            ]
          },
          "images": {
            "$ref": "response.results"
          },
          "errorPaths": [
            "errorCode"
          ],
          "messagePaths": [
            "errorMessage"
          ],
          "resultEphemeral": true,
          "usage": {
            "$ref": "response.usage"
          }
        }
      },
      {
        "id": "runninghub-standard-video",
        "label": "RunningHub Standard Video",
        "capabilities": [
          "video"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation",
          "agent"
        ],
        "baseUrl": "https://www.runninghub.ai",
        "requiresPublicMediaUrls": false,
        "auth": {
          "type": "bearer",
          "field": "apiKey"
        },
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": true,
            "mapping": "create path",
            "description": "RunningHub 标准模型端点，如 kling-v4/image-to-video。"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "prompt",
            "description": "视频提示词。"
          },
          {
            "name": "images",
            "type": "media[]",
            "required": false,
            "mapping": "imageUrl/firstImageUrl/lastImageUrl/imageUrls",
            "description": "首帧、尾帧或参考图；单图同时映射 imageUrl 与 firstImageUrl。"
          },
          {
            "name": "videos",
            "type": "media[]",
            "required": false,
            "mapping": "videoUrl/videoUrls",
            "description": "参考视频输入。"
          },
          {
            "name": "audios",
            "type": "media[]",
            "required": false,
            "mapping": "audioUrl",
            "description": "参考音频输入。"
          },
          {
            "name": "duration",
            "type": "integer",
            "required": false,
            "mapping": "duration (string)",
            "description": "时长秒数，上游按字符串接收。"
          },
          {
            "name": "aspectRatio",
            "type": "string",
            "required": false,
            "mapping": "aspectRatio",
            "description": "画幅比例。"
          },
          {
            "name": "resolution",
            "type": "string",
            "required": false,
            "mapping": "resolution",
            "description": "分辨率档位，如 720p/1080p。"
          },
          {
            "name": "quality",
            "type": "string",
            "required": false,
            "mapping": "quality",
            "description": "质量档位，仅部分端点接受。"
          },
          {
            "name": "watermark",
            "type": "boolean",
            "required": false,
            "mapping": "watermark",
            "description": "水印开关。"
          },
          {
            "name": "seed",
            "type": "integer",
            "required": false,
            "mapping": "seed",
            "description": "随机种子。"
          },
          {
            "name": "providerOptions",
            "type": "object",
            "required": false,
            "mapping": "provider-specific fields",
            "description": "插件命名空间内的厂商扩展字段。"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/openapi/v2/{{request.model}}",
          "contentType": "application/json",
          "body": {
            "prompt": {
              "$ref": "request.prompt"
            },
            "imageUrl": {
              "$omitEmpty": {
                "$first": {
                  "$map": {
                    "from": {
                      "$ref": "request.images"
                    },
                    "as": "media",
                    "in": {
                      "$ref": "media.value"
                    }
                  }
                }
              }
            },
            "firstImageUrl": {
              "$omitEmpty": {
                "$first": {
                  "$map": {
                    "from": {
                      "$ref": "request.images"
                    },
                    "as": "media",
                    "in": {
                      "$ref": "media.value"
                    }
                  }
                }
              }
            },
            "lastImageUrl": {
              "$omitEmpty": {
                "$first": {
                  "$map": {
                    "from": {
                      "$filter": {
                        "from": {
                          "$ref": "request.images"
                        },
                        "as": "media",
                        "where": {
                          "$eq": [
                            {
                              "$ref": "media.role"
                            },
                            "last"
                          ]
                        }
                      }
                    },
                    "as": "media",
                    "in": {
                      "$ref": "media.value"
                    }
                  }
                }
              }
            },
            "imageUrls": {
              "$omitEmpty": {
                "$map": {
                  "from": {
                    "$ref": "request.images"
                  },
                  "as": "media",
                  "in": {
                    "$ref": "media.value"
                  }
                }
              }
            },
            "videoUrl": {
              "$omitEmpty": {
                "$first": {
                  "$map": {
                    "from": {
                      "$ref": "request.videos"
                    },
                    "as": "media",
                    "in": {
                      "$ref": "media.value"
                    }
                  }
                }
              }
            },
            "audioUrl": {
              "$omitEmpty": {
                "$first": {
                  "$map": {
                    "from": {
                      "$ref": "request.audios"
                    },
                    "as": "media",
                    "in": {
                      "$ref": "media.value"
                    }
                  }
                }
              }
            },
            "duration": {
              "$omitEmpty": {
                "$toString": {
                  "$ref": "request.duration"
                }
              }
            },
            "aspectRatio": {
              "$omitEmpty": {
                "$ref": "request.aspectRatio"
              }
            },
            "resolution": {
              "$omitEmpty": {
                "$ref": "request.resolution"
              }
            },
            "quality": {
              "$omitEmpty": {
                "$ref": "request.quality"
              }
            },
            "watermark": {
              "$omitEmpty": {
                "$ref": "request.watermark"
              }
            },
            "seed": {
              "$omitEmpty": {
                "$ref": "request.seed"
              }
            }
          },
          "originPath": true
        },
        "poll": {
          "method": "POST",
          "path": "/openapi/v2/query",
          "contentType": "application/json",
          "body": {
            "taskId": {
              "$ref": "taskId"
            }
          },
          "originPath": true
        },
        "response": {
          "taskId": {
            "$coalesce": [
              {
                "$ref": "response.taskId"
              },
              {
                "$ref": "taskId"
              }
            ]
          },
          "status": {
            "$coalesce": [
              {
                "$ref": "response.status"
              },
              "pending"
            ]
          },
          "message": {
            "$coalesce": [
              {
                "$ref": "response.errorMessage"
              },
              {
                "$ref": "response.errorCode"
              }
            ]
          },
          "videos": {
            "$ref": "response.results"
          },
          "errorPaths": [
            "errorCode"
          ],
          "messagePaths": [
            "errorMessage"
          ],
          "resultEphemeral": true,
          "usage": {
            "$ref": "response.usage"
          }
        }
      },
      {
        "id": "runninghub-standard-audio",
        "label": "RunningHub Standard Audio",
        "capabilities": [
          "audio"
        ],
        "scopes": [
          "admin.system-channel",
          "user.custom-channel",
          "canvas",
          "creation",
          "agent"
        ],
        "baseUrl": "https://www.runninghub.ai",
        "requiresPublicMediaUrls": false,
        "auth": {
          "type": "bearer",
          "field": "apiKey"
        },
        "parameters": [
          {
            "name": "model",
            "type": "string",
            "required": true,
            "mapping": "create path",
            "description": "RunningHub 标准模型端点，如 rhart-audio/text-to-audio/speech-2.8-hd。"
          },
          {
            "name": "prompt",
            "type": "string",
            "required": true,
            "mapping": "text/prompt",
            "description": "合成文本或音乐描述。"
          },
          {
            "name": "audios",
            "type": "media[]",
            "required": false,
            "mapping": "audioUrl",
            "description": "参考音频输入。"
          },
          {
            "name": "duration",
            "type": "integer",
            "required": false,
            "mapping": "duration (string)",
            "description": "时长秒数。"
          },
          {
            "name": "providerOptions",
            "type": "object",
            "required": false,
            "mapping": "provider-specific fields",
            "description": "插件命名空间内的厂商扩展字段，如 voice_id/speed/emotion/lyrics。"
          }
        ],
        "create": {
          "method": "POST",
          "path": "/openapi/v2/{{request.model}}",
          "contentType": "application/json",
          "body": {
            "prompt": {
              "$ref": "request.prompt"
            },
            "text": {
              "$ref": "request.prompt"
            },
            "enable_base64_output": false,
            "english_normalization": false,
            "voice_id": {
              "$omitEmpty": {
                "$ref": "request.providerOptions.runninghub-standard.voice_id"
              }
            },
            "speed": {
              "$omitEmpty": {
                "$ref": "request.providerOptions.runninghub-standard.speed"
              }
            },
            "volume": {
              "$omitEmpty": {
                "$ref": "request.providerOptions.runninghub-standard.volume"
              }
            },
            "pitch": {
              "$omitEmpty": {
                "$ref": "request.providerOptions.runninghub-standard.pitch"
              }
            },
            "emotion": {
              "$omitEmpty": {
                "$ref": "request.providerOptions.runninghub-standard.emotion"
              }
            },
            "lyrics": {
              "$omitEmpty": {
                "$ref": "request.providerOptions.runninghub-standard.lyrics"
              }
            },
            "style": {
              "$omitEmpty": {
                "$ref": "request.providerOptions.runninghub-standard.style"
              }
            },
            "audioUrl": {
              "$omitEmpty": {
                "$first": {
                  "$map": {
                    "from": {
                      "$ref": "request.audios"
                    },
                    "as": "media",
                    "in": {
                      "$ref": "media.value"
                    }
                  }
                }
              }
            },
            "duration": {
              "$omitEmpty": {
                "$toString": {
                  "$ref": "request.duration"
                }
              }
            },
            "aspectRatio": {
              "$omitEmpty": {
                "$ref": "request.aspectRatio"
              }
            },
            "resolution": {
              "$omitEmpty": {
                "$ref": "request.resolution"
              }
            },
            "quality": {
              "$omitEmpty": {
                "$ref": "request.quality"
              }
            }
          },
          "originPath": true
        },
        "poll": {
          "method": "POST",
          "path": "/openapi/v2/query",
          "contentType": "application/json",
          "body": {
            "taskId": {
              "$ref": "taskId"
            }
          },
          "originPath": true
        },
        "response": {
          "taskId": {
            "$coalesce": [
              {
                "$ref": "response.taskId"
              },
              {
                "$ref": "taskId"
              }
            ]
          },
          "status": {
            "$coalesce": [
              {
                "$ref": "response.status"
              },
              "pending"
            ]
          },
          "message": {
            "$coalesce": [
              {
                "$ref": "response.errorMessage"
              },
              {
                "$ref": "response.errorCode"
              }
            ]
          },
          "audios": {
            "$ref": "response.results"
          },
          "errorPaths": [
            "errorCode"
          ],
          "messagePaths": [
            "errorMessage"
          ],
          "resultEphemeral": true,
          "usage": {
            "$ref": "response.usage"
          }
        }
      }
    ]
  },
  "documentation": "<当前插件的完整 documentation，由 README.md 与 docs/interface.md 拼接而成；为避免 JSON 递归，此处不重复展开正文。>"
}
```
<!-- YINGCE_MANIFEST_CONTRACT_END -->
