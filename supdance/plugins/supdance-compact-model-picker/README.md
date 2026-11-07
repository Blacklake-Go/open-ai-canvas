# 简洁模型选择器

`supdance-compact-model-picker` 为创作工具的模型菜单保留左侧品牌栏。右侧每个模型显示一行名称，可附一行简介以及带原计费单位的积分报价。

## 首次安装与后续升级

这是随 SupDance 宿主构建的扩展。`manifest.json` 描述插件身份和设置入口，界面与 API 由本站 Web、Backend 源码提供。单独上传清单无法安装这两部分。

1. 先记录正在运行的本站提交 SHA 和镜像摘要，以该固定提交创建集成分支。首次安装时合入包含本插件的完整提交。以后更新上游时，将选定的上游版本合入保留插件的本站分支。
2. 检查补丁登记中的宿主接入点，尤其是共享模型选择器、后台路由、内置插件注册和 API 注册。解决冲突后，从仓库根目录分别运行下面两个回归命令，并通过本站发布门禁。

   ```sh
   (cd web && bun test test/supdance-extension-isolation.test.ts)
   (cd backend && go test ./internal/handler ./internal/supdance/compactpicker -run '^TestSupDanceCompactPicker' -count=1)
   ```

3. 由 CI 从同一个已验证的合并提交构建本站发布镜像，固定 Web、Backend 和配套 Agent 的摘要。保留上一个稳定版本、Compose 配置与已验证可恢复的备份，通过现有 Host Updater 发布该固定版本。
4. 核对运行镜像的 revision 与发布提交一致。打开后台面板，保存一项显示设置，再重新打开创作页的模型菜单，确认品牌切换、选中模型和报价单位均正常。

宿主接入点见 [补丁登记](../../../web/src/supdance/adapters/compatibility.ts)。生产版本与部署流程见 [本站维护记录](../../../docs/supdance/SITE_CLOSURE.md)。

## 后台设置与回滚

管理员在「插件」中进入「模型选择器」，或直接打开 `/admin/plugins/compact-model-picker`。首次使用时三个开关都已开启。

| 开关 | 作用 |
| --- | --- |
| 启用简洁选择器 | 切换简洁菜单与宿主菜单，与插件中心的平台开关同步。 |
| 显示模型简介 | 在模型名称下显示已有简介。 |
| 显示积分报价 | 显示模型的已有报价和单位。该选项只影响展示。 |

修改后点击「保存设置」。需要立即恢复宿主菜单时，关闭「启用简洁选择器」并保存，再重新打开菜单。简介和价格偏好会保留。如果发布本身需要回滚，通过 Host Updater 切回发版前记录的稳定版本。

## HTTP 接口

| 方法 | 路径 | 访问范围 |
| --- | --- | --- |
| GET | `/api/supdance/compact-model-picker/settings` | 公开读取当前展示配置 |
| GET、PUT | `/api/admin/supdance/compact-model-picker/settings` | 仅限登录管理员 |

成功响应的 `data` 和 PUT 请求正文使用相同的三个布尔字段。PUT 需一次提交全部字段。

```json
{"enabled":true,"showDescription":true,"showPrice":true}
```
