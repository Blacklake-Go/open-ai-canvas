# SupDance 社交登录插件 v1.3.4

插件 ID：`supdance-social-auth`。当前生产入口为 `https://www.supdance.com`；原站、ONE 与 Canvas 的用户、数据库和钱包不在本插件更新时合并。

## 安装与打包

本插件包含编译进宿主的 Go 授权处理、React 登录与用户资料组件，以及可分发的插件清单。完整升级必须同时部署包含这些实现的宿主前后端；单独上传 `.yingce-plugin` 只能更新插件中心清单，不能为旧宿主添加 Go/React 实现。

从本仓库运行：

```sh
python3 tools/supdance/package_social_auth.py --output-dir /tmp/supdance-social-auth-release
```

产出 `supdance-social-auth-1.3.4.yingce-plugin`、所含文件哈希清单及部署说明。打包仅读取明确列出的源码清单和本说明，不读取 `.env`、业务数据、浏览器内容或服务商凭据。产物保存在仓库外，代码仓库只提交可复现打包工具。

`.yingce-plugin` 使用宿主要求的顶层 ID、名称和版本合同，保持原始插件 ID 和版本。宿主要求及源码提交记录在包内 `docs/host-requirements.json`。当前生产实现为 `42de461f`，版本 `1.7.4-supdance-social-1.3.3`；包内宿主要求以此次运行打包工具的实际提交为准。

## 当前行为

- QQ、微信、抖音、Bilibili、Google、X 已实现服务商授权码协议；Instagram、TikTok 为预留配置入口，禁止用模拟身份展示为可用。
- 大陆与国际渠道按服务端 IP 分区展示；仅配置完整且管理员已启用的渠道对外开放。公开接口不提供模拟分区绕过。
- 凭据保存在宿主加密配置中。首次保存后保持停用，管理员另行启用；端点可达探测不能证明密钥有效。
- 回调校验一次性 state 和浏览器 Cookie；X 使用 S256 PKCE。仅服务商验证过的邮箱可自动匹配，不能凭未验证邮箱或昵称合并账号。
- 新身份先进入入站表单，提交资料并同意协议后才创建账号；同一真实身份重复授权复用原账号。多个渠道要归属同一站内账号，应在已有账号内主动绑定。
- 入站票据由浏览器 HttpOnly Cookie 持有，有效期为 30 分钟。共享 Redis 原子消费失败时中止写入，未配置 Redis 的单进程环境使用内存票据。手填邮箱须完成本次入站的邮件验证。
- 用户中心支持绑定、换绑及防孤立解绑。绑定完成后回到发起页，前端读取已保存的身份再显示成功。已绑定身份可用于原会话的安全复验。旧 Mock 账号不按前缀自动删除或合并，保留已有资产。

## 验证边界

真实 Bilibili 已有授权回调、用户资料与入站票据生产证据；真实注册、重复登录复用和主动绑定仍需对应账号完成操作。QQ、Google、X 等渠道需要各自的有效凭据及真实授权验收。测试、包解析和健康检查均不能代替真实服务商验收。

源码位置：`backend/internal/supdance/socialauth/`、`web/src/supdance/plugins/social-auth/`。后台入口：`/admin/settings/social-auth`；运营入口：`/admin/settings/social-auth/operations`。
