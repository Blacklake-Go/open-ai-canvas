# 音乐工作岛改动清单

以下仅列本隔离候选相对 `origin/main@037b8ae9` 的改动，不包含原工作区已有修改。职责和回滚见 [实现说明](IMPLEMENTATION.md)，执行结果见 [验收记录](VERIFICATION.md)。

| 文件 | 用途 |
| --- | --- |
| `backend/internal/app/channel_models_test_call.go` | 音乐测试转到显示报价的统一测试中心，保留真实上游回执。 |
| `backend/internal/app/provider.go` | 同一数据库 SKU 的重复解析保持幂等，修复结果归档误拒绝。 |
| `backend/internal/app/provider_audio.go` | 音频操作、原词/风格映射及真实媒体结果。 |
| `backend/internal/app/provider_http_client.go` | 创建响应提取真实供应商任务 ID。 |
| `backend/internal/app/provider_protocol.go` | 音频协议接入宿主分离轮询。 |
| `backend/internal/app/provider_protocol_async.go` | 暂时查询故障继续跟踪原供应商 ID。 |
| `backend/internal/app/provider_protocol_request.go` | 原样映射歌词、独立风格与原生纯音乐参数。 |
| `backend/internal/app/supdance_music_plugin.go` | 生命周期、配置准入、审计事务与排空后持久停用。 |
| `backend/internal/app/supdance_music_plugin_test.go` | 生命周期事务失败、排空持久化和卸载保留回归。 |
| `backend/internal/app/supdance_music_reads.go` | 历史与管理员读取、真实账务、分页及部分输出权限。 |
| `backend/internal/app/supdance_music_reads_test.go` | 所有权、部分输出与宿主/历史合并分页回归。 |
| `backend/internal/app/supdance_music_recovery.go` | 原测试日志回执恢复，不重新创建供应商任务或补扣历史费用。 |
| `backend/internal/app/supdance_music_site.go` | 主站目录、能力、用户分组、报价、参数校验和幂等提交。 |
| `backend/internal/app/supdance_music_site_test.go` | 真实目录/报价、余额不足、幂等、回执恢复与宿主任务回归。 |
| `backend/internal/app/task_creation.go` | 宿主音乐任务提交与幂等、账务链路接缝。 |
| `backend/internal/app/task_media_assets.go` | 稳定共享资产及音乐参数、供应商任务关联。 |
| `backend/internal/app/task_worker.go` | 持久任务轮询与归档恢复接缝。 |
| `backend/internal/handler/supdance_music.go` | 音乐 HTTP 入参、用户/管理员接口及统一响应。 |
| `backend/internal/protocol/runninghub_music_results_test.go` | 供应商多媒体结果只提取有效音频回归。 |
| `backend/internal/repository/supdance_music_tasks.go` | 宿主音乐任务查询、分页和活动数。 |
| `backend/internal/supdance/music/adapter.go` | 保留真实歌词换行，收敛原生纯音乐及风格映射。 |
| `backend/internal/supdance/music/repository.go` | 历史读取不执行 AutoMigrate。 |
| `docs/content/docs/backend/backend-database.mdx` | 说明复用 Schema 81、不改历史账目与回滚约束。 |
| `docs/content/docs/backend/http-api.mdx` | 当前音乐 API、强校验、旧回执与归档恢复合同。 |
| `docs/content/docs/overview/features.mdx` | 用户可见能力及准确的验收边界。 |
| `docs/content/docs/plugins/music-generation-lifecycle.mdx` | 用现行生命周期与数据保留合同替换旧报告。 |
| `docs/content/docs/progress/music-generation-testing.mdx` | 用真实 A/B 和阻塞状态替换未证实的完成报告。 |
| `docs/content/docs/progress/pending-test.mdx` | 区分已验证结果、用户听感、真机与生产待验。 |
| `docs/supdance/CHANGELOG.md` | 记录未发布的音乐 1.3.0 候选。 |
| `docs/supdance/CUSTOMIZATIONS.md` | 记录二次开发宿主改动及升级边界。 |
| `docs/supdance/music-studio/IMPLEMENTATION.md` | 架构、能力、异步、账务、生命周期及回滚说明。 |
| `docs/supdance/music-studio/VERIFICATION.md` | 实际任务、文件、账目、运行验证和未覆盖范围。 |
| `plugin-packages/runninghub-standard.yingce-plugin` | 与源码清单一致的 RunningHub 1.1.2 发行包。 |
| `plugin-packages/runninghub-standard/docs/interface.md` | RunningHub 音频参数、查询、结果和版本合同。 |
| `plugin-packages/runninghub-standard/manifest.json` | Suno/Mureka 音频字段、参数及多结果查询协议。 |
| `supdance/config/baseline.json` | 登记音乐宿主接缝及匹配的集成版本。 |
| `supdance/plugins/supdance-music-generation/manifest.json` | 音乐 1.3.0 注册、菜单、生命周期与最低宿主要求。 |
| `web/src/components/canvas/use-agent-launcher-position.ts` | 浮动助手感知底部播放器，响应尺寸及位置约束。 |
| `web/src/components/layout/workspace-top-bar.tsx` | 音乐标题与面包屑，移除重复品牌。 |
| `web/src/lib/canvas/agent-launcher-position.ts` | 复用现有位置算法，增加底部占位约束。 |
| `web/src/pages/admin/components/channel-model-editor.tsx` | 音乐测试导航到统一的付费测试中心。 |
| `web/src/pages/assets/asset-library-cards.tsx` | 共享资产卡片保留作品标题原文。 |
| `web/src/pages/assets/asset-library-panels.tsx` | 共享资产详情保留作品标题原文。 |
| `web/src/pages/create/creation-music.css` | 创作岛音乐区域、窄屏与宿主 token。 |
| `web/src/pages/create/creation-workspace-messages.tsx` | 真实音乐结果、多音轨与共享播放器接入。 |
| `web/src/pages/create/creation-workspace.tsx` | 创作岛读取主站模型与能力，保留品牌与版本身份。 |
| `web/src/router.tsx` | 保留音乐工作岛与既有后台入口。 |
| `web/src/stores/use-locale-store.ts` | 无保存偏好时使用 English。 |
| `web/src/supdance/adapters/compatibility.ts` | 登记宿主任务、播放器避让和标题原文保护接缝。 |
| `web/src/supdance/plugins/i18n/locales/index.ts` | 合并音乐独立六语词条。 |
| `web/src/supdance/plugins/i18n/locales/music-site.ts` | 六语音乐状态、错误、费用、后台与交互词条。 |
| `web/src/supdance/plugins/i18n/store.ts` | 音乐独立词典接入，默认语言遵守已保存偏好。 |
| `web/src/supdance/plugins/music-generation/admin/music-admin-settings-page.tsx` | 统一后台标签、任务回执、报价测试、生命周期及草稿恢复。 |
| `web/src/supdance/plugins/music-generation/components/lyrics-editor.tsx` | 多行原词、段落结构和国际化编辑操作。 |
| `web/src/supdance/plugins/music-generation/components/music-form.tsx` | 服务端能力驱动 Simple/Custom、报价、余额及提交。 |
| `web/src/supdance/plugins/music-generation/components/music-master-stage.tsx` | 移除旧中央假舞台，复用真实作品卡片。 |
| `web/src/supdance/plugins/music-generation/components/music-task-details.tsx` | 前后台共用参数、歌词、媒体详情与素材库管理入口。 |
| `web/src/supdance/plugins/music-generation/components/task-card.tsx` | 真实任务状态、分组音轨、播放下载与结算摘要。 |
| `web/src/supdance/plugins/music-generation/components/waveform-player.tsx` | 单一播放状态、进度、队列、音量、错误和宿主避让通知。 |
| `web/src/supdance/plugins/music-generation/index.ts` | 现有插件机制注册与音乐独立词典导出。 |
| `web/src/supdance/plugins/music-generation/pages/music-workbench-page.tsx` | 左右工作岛、搜索筛选、详情、参数复用及窄屏切换。 |
| `web/src/supdance/plugins/music-generation/services/music-api.ts` | 兼容宿主任务投影、管理员资源入口及统一音乐接口。 |
| `web/src/supdance/plugins/music-generation/services/music-asset-bridge.ts` | 已有宿主资产不重复入库，保留旧历史桥接。 |
| `web/src/supdance/plugins/music-generation/services/music-site-api.ts` | 主站能力、报价、提交与真实任务/媒体/账务转换。 |
| `web/src/supdance/plugins/music-generation/stores/use-music-store.ts` | 用户隔离、草稿、幂等提交、历史恢复与单实例音频状态。 |
| `web/src/supdance/plugins/music-generation/styles/music-generation.css` | 移除旧独立主题和假波形样式。 |
| `web/src/supdance/plugins/music-generation/styles/music-workbench.css` | 真实工作岛、响应式、播放器与宿主 token 样式。 |
| `web/test/agent-launcher-position.test.mjs` | 实际 hook 的播放器避让、拖拽、键盘与移除恢复。 |
| `web/test/creation-island-music.test.ts` | 创作岛音乐模式与动态模型合同。 |
| `web/test/music-site-api.test.ts` | 宿主任务、真实输出、账务、管理员媒体与费用准入投影。 |
| `web/test/music-workbench-alignment.test.ts` | 删除旧固定目录与布局断言，改由主站 API 专项及真实页面验收覆盖。 |
| `web/test/supdance-extension-isolation.test.ts` | 已登记宿主文件、接缝与版本隔离合同。 |
| `web/test/supdance-music-manifest-challenger.test.ts` | 插件清单、最低宿主及升级合同。 |
| `web/test/supdance-music-store-playback.test.ts` | 草稿/用户隔离、幂等提交、查询故障和单一播放状态。 |
| `docs/supdance/music-studio/CHANGES.md` | 本次候选逐文件改动清单。 |
