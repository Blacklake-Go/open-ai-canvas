# SupDance Canvas — 独立扩展架构设计 (ARCHITECTURE.md)

## 1. 总体架构原则

采用 **Upstream Core + SupDance Extensions + Compatibility Adapters** 三层隔离架构：

1. **Upstream Core（上游核心层）**：
   - 保持原作者 `web/`、`backend/`、`plugin-packages/`、`yingce-agent/` 的目录结构与调用链不变。
   - 不因品牌定制而大规模复制或改写上游组件，不改动上游既有数据库迁移文件的名称与校验和。
2. **SupDance Extensions（独立扩展层）**：
   - 前端扩展位于 [`web/src/supdance/`](../../web/src/supdance/)。
   - 后端扩展位于 [`backend/internal/supdance/`](../../backend/internal/supdance/)。
   - 插件与配置位于 [`supdance/plugins/`](../../supdance/plugins/) 与 [`supdance/config/`](../../supdance/config/)。
   - 维护与同步工具位于 [`tools/supdance/`](../../tools/supdance/)。
3. **Compatibility Adapters（最小兼容适配层）**：
   - 前端适配位于 [`web/src/supdance/adapters/compatibility.ts`](../../web/src/supdance/adapters/compatibility.ts)。
   - 后端适配位于 [`backend/internal/supdance/adapters/compatibility.go`](../../backend/internal/supdance/adapters/compatibility.go)。

## 2. 目录结构映射

```text
open-ai-canvas/
├── web/
│   ├── src/
│   │   └── supdance/
│   │       ├── theme/           # SupDance Studio 皮肤预设与三层 Token 映射
│   │       ├── adapters/        # 路由防冲突合并、插件 Manifest 校验、上游补丁注册表
│   │       ├── registry/        # 统一导出与功能开关 (SupDanceFeatureFlags)
│   │       └── index.ts
│   └── test/
│       └── supdance-extension-isolation.test.ts
├── backend/
│   └── internal/
│       └── supdance/
│           ├── domain/          # 独立领域规则、表前缀 (supdance_) 与插件前缀 (supdance-) 约束
│           └── adapters/        # 宿主插件 API 版本与冲突检查及单元测试
├── supdance/
│   ├── plugins/                 # SupDance 自定义插件源码与 Manifest (supdance-*)
│   └── config/
│       └── baseline.json        # 机器可读的上游基线、耦合文件清单与监控路径
├── tools/
│   └── supdance/
│       ├── check_upstream.py        # 自动对比上游版本并生成 UPSTREAM_UPDATE_REPORT.md
│       ├── test_check_upstream.py   # 上游分析器单元测试
│       └── prepare_integration.sh   # 安全创建 integration/* 集成分支脚本
└── docs/
    └── supdance/                # SupDance 专属维护文档体系
```

## 3. UI 与主题隔离设计

- **复用现有三层设计令牌**：通过 `web/src/supdance/theme/supdance-skin.ts` 的 `createSupDanceSkinDefinition()` 基于上游 `DEFAULT_CLASSIC_SKIN` 派生 `supdance-studio` 主题，完整提供浅色/深色各 50 项颜色令牌、17 项组件参数和渐变主按钮配置。
- **零全局样式污染**：不向 `web/src/styles/globals.css` 注入不受控覆盖，不使用大范围 `!important`，不破坏上游 `classic` 锁定校验或管理后台（`/admin/*`）独立表面样式。
- **可逆开关**：`applySupDanceTheme(mode, { enabled: false })` 可随时无损恢复为上游默认 `classic` 皮肤。

## 4. 后端与数据库隔离设计

- **调用链合规**：遵循上游 `HTTP -> handler -> service -> app -> 业务域包 -> repository/model -> database`。`backend/internal/supdance/domain` 严禁反向 import `internal/app` 或 `internal/service`。
- **表命名空间强制前缀**：任何 SupDance 未来新增的业务表必须以 `supdance_` 开头（由 `domain.ValidateCustomTableName` 强制校验），绝不与上游表名冲突，且绝不修改上游 `schema_migrations` 版本 1–71 的任何既有迁移定义。
