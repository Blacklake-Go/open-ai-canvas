# 安装与更新
当前采用随宿主分发的内置插件包。普通管理员进入后台 → 插件管理 → Supdance全站视觉与交互引擎，点击安装/启用，再进入同一个 Visual Console。已安装旧版可点击升级至 2.0.1；升级保存迁移备份，原有用户发布颜色不会被新默认值静默覆盖。

开发者源码交付使用 `node scripts/package-visual-engine.mjs 输出目录`，包内包含 frontend、backend、manifest、必要宿主适配源文件、管理工具、文档和 release.json；压缩包附 SHA256SUMS。应按宿主适配点审查合并，不把完整宿主文件盲目覆盖到不同版本。修改后执行专项测试、类型检查、构建和真实页面验收。

命令行管理可用 `node scripts/visual-engine-plugin.mjs status --origin=https://站点`；写操作另传 `--session=浏览器storageState文件`。会话文件不随包分发，不打印 Cookie；远程要求 HTTPS，重定向失败关闭。命令有 install/activate/deactivate/update/uninstall/versions/rollback；卸载默认保留配置，清理需显式 --clear-config。

生产更新在既有完整 Compose 上使用不可变 release，备份发布指针、数据库与插件配置，检查候选二进制和静态资源摘要，更新 web/backend 的镜像和挂载指针，再验证 readiness、真实登录、控制台、公共配置和样式。PostgreSQL、Redis、Agent 编排沿用实际环境。自建镜像属于现有源码发布路径，不能标为官方 Release/Host Updater 已管理。
