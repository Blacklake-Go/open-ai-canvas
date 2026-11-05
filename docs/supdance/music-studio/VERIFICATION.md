# 音乐工作岛执行记录

执行时间：2026-11-05，Asia/Taipei。隔离分支 `codex/music-studio-rebuild-20261105`，基线 `origin/main@037b8ae9`。生产对照为 `v1.7.4-supdance.7`、`06504050`、Schema 81；本候选未部署、未推送。

## 环境与预算

本地运行真实宿主 Go 服务、SQLite Schema 81、Bun 1.3.9、Vite 实际路由与隔离存储。主站音乐路由和销售配置复制到受限本地渠道，凭据单独加密，不复制测试数据库到生产。原工作区未覆盖。

新增预算上限 50 积分，只创建 A/B 两条真实 RunningHub 任务：19.6 + 8.2 = **27.8**。隔离钱包初始 50，结束可用 22.2、预留 0，无充值。原两条仅回查和恢复，不重新生成、不新增用户账单。此证据不代表生产 PostgreSQL、生产钱包和生产对象存储验收。

## 回执、输出与账务

| 用例         | 内部任务 ID                            | 上游任务 ID           | 最终音频                                               |
| ------------ | -------------------------------------- | --------------------- | ------------------------------------------------------ |
| 原 Mureka v9 | `8bd8b3f9-ea93-5780-83b2-e295afb23ce9` | `2118073171151564801` | 1 MP3；151.470s；4,849,206 bytes                       |
| 原 Suno v6   | `40c2c768-b633-57ce-819c-3e5d97196f97` | `2118073747683573762` | 2 MP3；207.600 / 209.200s；4,883,001 / 4,743,657 bytes |
| A 原创纯音乐 | `690281e7-c60d-5e6d-a329-06228ecc1cf7` | `2118112667691548673` | 2 MP3；208.824 / 208.440s；4,776,534 / 4,686,582 bytes |
| B 原创歌词   | `3c0bdfbe-6001-5545-8c53-c88363c1eca2` | `2118114970524069890` | 1 MP3；152.830s；4,892,674 bytes                       |

四条主站任务均 succeeded，六个 ready Resource 对应六个共享 Asset。六个实际归档文件全部完整 ffmpeg 解码 PASS，字节数与资源记录相同并保存 SHA256。A 的浏览器下载、B 的主站授权下载也已完整解码。

A 路由为 Suno v5.5 `rhart-audio/suno-v5.5/single`，原创温暖钢琴/柔和弦乐描述、原生 `make_instrumental: "true"`，不发送时长。B 为 Mureka v9 `mureka-ai/mureka-v9/generate-song`；Verse/Chorus 原词与持久输入逐字相同，6 个真实换行保留；风格及 English 语言偏好单独进入 `prompt`。

A 账单 `f9adfa7a810545b9576b82871473c59f` 结算 19,600,000 微积分，B 账单 `9544b25345b10a0a6a58bd7b102bffa0` 结算 8,200,000。每单仅一条 reserve 和 consume；无退款、重复消费或残留预留。播放、查询和下载未新增账单。

## 修复与复测

原回执首次归档失败：渠道配置已经解析到上游 SKU，二次解析仍按显示别名比较。回归先复现失败，再修复仅接受同一数据库 SKU 的幂等解析；原任务 recover-media 后分别保存 1/2 首，没有重建供应商任务。

Chrome 自动翻译曾冻结动态费用和播放时间。音乐 React 区域增加翻译边界后，显示真实 13.1/19.6/8.2 报价、50/30.4/22.2 余额及持续变化的播放进度。模型名和作品原文保留。

## 验证矩阵

| 项目                              | 状态           | 证据与边界                                                                                                                        |
| --------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 实际目录、能力、价格              | PASS           | 服务端主站配置；不硬编码价格                                                                                                      |
| 1500 报价 / 194.76 余额拒绝       | PASS           | 服务端与前端回归，不作为真实余额默认值                                                                                            |
| 5 并发相同 nonce                  | PASS           | 单任务、单账单、单次预留                                                                                                          |
| 原日志恢复、不重新生成/补扣       | PASS           | 原上游 ID、三首持久归档、无新增账单                                                                                               |
| 重启与暂时查询 503                | PASS           | 自动化 mock：一次 create，重建 Service 后只查询同一 ID；不冒充真实供应商重启验收                                                  |
| ready 部分输出、权限与分页        | PASS           | 无上游 URL 泄露、跨用户拒绝、host/legacy 交错分页                                                                                 |
| 停用时在途任务继续                | PASS           | B running 时 draining；成功归档结算；overview 收敛 disabled/0；随后恢复本地启用                                                   |
| 生命周期/卸载保留                 | PASS           | 状态、准入、审计事务；旧数据及用户偏好保留                                                                                        |
| 后台刷新后任务终态/详情           | PASS           | Tasks 中 B 音频、两级 ID、Saved/Settled、原词与风格                                                                               |
| 播放/暂停/seek/切歌/音量/静音     | PASS           | Chrome 真路由；seek 到 0:45，单首播放，静音切为 Unmute                                                                            |
| A 浏览器下载                      | PASS           | 4,776,534 bytes 原始 MP3，完整解码                                                                                                |
| B 浏览器下载                      | BLOCKED        | Chrome 明示“已被您的组织屏蔽”；未改变或绕过策略；授权后端下载与完整解码 PASS                                                      |
| MIME/Range                        | PASS           | B 实测 206、1024 bytes、audio/mpeg、bytes 0-1023/4892674                                                                          |
| 六种界面语言                      | PASS           | English、简/繁中文、日语、韩语、西班牙语在真路由切换；费用、作品和播放器翻译更新，原文不变；未遍历全部错误/后台状态组合           |
| 浅色与深色                        | PASS           | 真实页面及独立截图；继续使用宿主主题                                                                                              |
| 390/320 窄屏                      | PASS           | Create/Library 切换、真实作品与播放器；document scrollWidth 等于视口宽度；播放器底部在视口内                                      |
| 宿主助手避让播放器                | PASS           | 完整重新加载后 playerTop=752、launcherBottom=732；生产 hook 拖拽/键盘回归通过                                                     |
| 共享资产可见                      | PASS           | 真资产路由显示六个音频，时长/大小与真实文件一致；重新加载后六个标题仍保持原文                                                     |
| 前后台草稿恢复                    | PASS           | 前台输入后整页刷新，描述保持；进入后台测试页恢复同一用户草稿，费用与余额可见                                                      |
| 管理员媒体交付                    | PASS           | 后台 Tasks 点击真实 B 音频进入 Pause 状态；管理员资源接口 Range 返回 206/1024 bytes，匿名请求 401；前端投影回归覆盖专用管理员链接 |
| 真实手机软键盘                    | NOT RUN        | 仅桌面环境；viewport 不能替代真实设备                                                                                             |
| 无人声、人声/歌词遵循、旋律音质   | NOT RUN        | 没有主观听音能力，只确认参数与技术媒体结果                                                                                        |
| WAV/FLAC、续写、参考音频、流预览  | NOT APPLICABLE | 接通操作不提供，界面不承诺                                                                                                        |
| 新音乐重复/乱序回调               | NOT APPLICABLE | 新 RunningHub 路径持久轮询，无新无签名回调                                                                                        |
| 其他模型新生成、生产账务/对象存储 | NOT RUN        | 预算及环境范围外                                                                                                                  |

本地文件交付未设置 Content-Disposition，下载沿同源浏览器 download 文件名合同；跨域对象存储交付尚未验证，不能据此宣称生产文件名行为通过。

## 自动化与构建

后端专项通过：`go test -ldflags='-s -w' ./internal/app ./internal/protocol ./internal/supdance/music -run 'Music|TestRunningHubSunoResults|TestMediaRecovery' -count=1`。handler 早前输出过 no tests to run，不计为 API 集成证据。

前端音乐、设计系统、播放器避让与隔离专项：69 pass / 0 fail，4106 个断言，11 个文件。最终 `tsc --noEmit && vite build`、`eslint src test` 通过，Vite 构建 6.66 秒。构建保留已有的大 chunk 提示。

附加宿主存储权限专项 `TestAdminStorage|TestResourceAccess` 因磁盘空间不足在 Go 链接阶段失败，测试没有执行，不能记作通过；未删除其他项目缓存或重复盲试。上述音乐后端专项已在此前成功完成，之后没有修改 Go 语义。完整 CI、文档站构建、PostgreSQL/Redis 和生产发布未执行。

运行日志在忽略的 `.local/cache/music-*`。原始上游 JSON 和媒体授权 URL 不提交；去敏账务/请求记录、六音频完整性记录、实际 MP3 和真实界面截图保留在本任务本地证据目录。截图仅作为界面证据，不替代真实上游、资产和账务记录。

最终截图包含 `music-studio-final-dark.jpg`、`music-studio-final-light.jpg`、`music-studio-final-details.jpg`（1280×700）和 `music-studio-final-mobile-create.jpg`、`music-studio-final-mobile-library.jpg`（390×700）。截图后恢复默认桌面视口、深色与 English，并保留实际验收页。Reuse settings 实测恢复 B 原词、风格、English 语言偏好与 Custom 模式，没有提交新生成。
