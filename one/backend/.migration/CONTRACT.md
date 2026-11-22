# ONE Go 后端 Wave-3 分片迁移契约（所有分片必须遵守）

## 工程位置（绝对路径）

- 工作树：`/Users/seelucency/Documents/dev/One-one-refactor`（分支 `feat/one-refactor`）
- Go 后端根：`/Users/seelucency/Documents/dev/One-one-refactor/one/backend`
- **ONE 源码基准（严格只读，绝不修改）**：`/Users/seelucency/Documents/dev/Supdance Pro`
- 分片规格：`one/backend/.migration/spec_<分片名>.json`（含每条路由的 methods / policyTier / responseFormat / 权限点 / 幂等 scope / 源码绝对路径 / 源码前 4000 字符）

## 唯一交付物

**只新建一个文件**：`one/backend/internal/handler/<分片名>_handlers.go`
（admin_a → `admin_a_handlers.go`，admin_b → `admin_b_handlers.go`，core → `core_handlers.go`）

在这个文件里用 `init()` + `registerBatch(...)` 自注册本分片全部路由的**真实** handler。

**严禁修改任何其他文件**（尤其 `router.go`、`vertical_slice.go`、`*_protocol.go`、`*_test.go`、`config.go`、`main.go`、envelope、middleware、domain、其他分片文件）。需要新 helper 就写在自己这一个文件里。多个 Agent 并行写不同文件 = 零冲突。

## 挂载契约（已由主线程落地，只读使用）

```go
// router.go 里已存在：
type mountFunc func(method, nextPath string, h http.Handler)
func registerBatch(fn func(d *Dependencies, mount mountFunc))
// NewRouter 在 stub 注册之前调用所有 registerBatch，
// 所以 mount 会覆盖对应 (method, path) 的 501 stub。

func init() {
    registerBatch(func(d *Dependencies, mount mountFunc) {
        mount("GET", "/api/xxx/...", wrapAdmin(d, "usersRead", "", adminXxxHandler))
        // ... 本分片全部 (method, path) 对
    })
}
```

**必须覆盖本分片 spec 里每一条路由的每一个 method**（例如 `GET,POST,DELETE` 要 mount 3 次）。少挂一条就仍是 stub。

## 共享设施（`*_protocol.go`，只读使用，勿重复实现）

Admin 分片：
- `wrapAdmin(d, permissionRaw, scope, fn)` — 自动完成：权限鉴权（401/403 + 精确文案）、幂等（写方法强制 `Idempotency-Key`，8–200 字符，`CONFLICT 409` / 缓存重放）、panic→`INTERNAL_ERROR 500`、`{ok:true,data,meta:{requestId}}` 信封。
- `permissionRaw` 直接传 spec 的 `analysis.perm`（camelCase，如 `usersRead`），`adminPermission()` 已自动映射成点号。
- `scope` 传 spec 的 `analysis.scope`；GET/读路由传 `""`。仅当源码确实调用 `checkIdempotency` 才传非空 scope。
- `fn` 签名：`func(w, r, d, u *middleware.SessionUser, reqID string) (any, map[string]any, *adminError)`
  - 返回数据 + 可选 meta + 错误；`adminErr(code, msg, status)` 造错误。
  - 需要自己写响应（CSV/导出）时返回 `AdminAlreadyWritten`。
- 权限点、错误码、文案必须对照源码 `lib/admin/authz.js`。

Non-admin 分片（core/misc）：
- `wrapDomain(d, policyTier, fn)` — 按 policyTier 应用 RequireAuth/OptionalAuth。
- `fn` 签名：`func(w, r, d, u *middleware.SessionUser)`，用 `envelope.DomainJSON / SuccessJSON / DomainError / WriteErrorByFormat` 写响应。
- `dbUnavailable(w, r, format)`、`pathParam(r, name)`、`queryInt(...)` 可直接用。

共享小工具（`helpers.go`）：`decodeJSONBody`、`readBodyLimit`、`clientIP`、`requestOrigin`、`writeDomainError`、`firstNonEmpty`（在某 handler 文件里，见 `auth_handlers.go`）。

## 硬红线（违反 = 交付作废）

1. **不伪造成功**：禁止挂载恒返回 `data:null` / `{} / ok:true` 的空壳来把 501 消掉。每个 handler 必须有真实语义：
   - 能直接从源码确定的：参数校验、错误码/文案、challenge 握手、限流、幂等、权限、响应信封、重定向、Range/206、OPTIONS——必须等价实现。
   - 持久数据读写：用 `d.Pool`（`pgxpool.Pool`）参数化 SQL 直连 4-Schema；**`d.Pool == nil`（单测/降级）时必须诚实返回 `503 DB_UNAVAILABLE`，绝不编造业务数据**。
   - SQL 表名/列名必须对照 `Supdance Pro/lib/db/migrations/*.sql`，禁止臆造列。
2. **不改 UI / 页面 / 路由**：本任务纯后端。
3. **Supdance Pro 只读**；不写生产；不动主站工作树 `/Users/seelucency/Documents/dev/One`。
4. **不新增产品页面、不新增可视化界面**。
5. 复杂派生逻辑（成本核算、对账聚合等）若源码超出单条 SQL 可等价表达，用清晰注释标出 `// TODO(integration-verify): ...` 并给出所依据的源码函数，不要假装已完成；但该路由仍必须有真实的鉴权/校验/DB 路径。
6. 不引入 Kafka/gRPC/Service Mesh；不复制外部开源项目核心逻辑。

## 响应格式对照（`responseFormat`）

| format | 写法 |
|---|---|
| `admin_ok_meta_envelope` | `wrapAdmin` 自动处理（或 `envelope.AdminOK` / `AdminError`） |
| `direct_domain_json` | `envelope.DomainJSON(w, status, payload)` / `DomainError` |
| `success_flagged_json` | `envelope.SuccessJSON(w, status, fields)` |
| `binary_redirect_xml_or_callback` | `http.Redirect` / 直接 `w.Write` text、xml、二进制；错误用 `envelope.WriteErrorByFormat` |
| `upstream_proxy_passthrough` | 透传上游 status + body（见 misc 分片策略） |

## 验证（每个分片完成前必须跑，报告精确结果）

```bash
cd /Users/seelucency/Documents/dev/One-one-refactor/one/backend
gofmt -w internal/handler/<分片名>_handlers.go
go test -count=1 ./...          # 必须全绿
go vet ./...                    # 必须干净
```

主线程守卫测试 `TestWave1ExactMountedRouteCountsVsStubs` 已改为**动态计数**（逐条探测 238 路由，501 记 stub、否则记 real，断言 real+stub=238 且 real≥78）。分片落地后 real 会自然上升；全部完成时主线程会追加 `stubCount == 0` 断言。

## 完成条件

- 本分片 spec 里所有 (method, path) 都真实 mount（该分片的路由不再返回 501）。
- `go test ./...` 全绿、`go vet ./...` 干净。
- 报告：实现了多少条、哪些是完整业务等价、哪些标了 `integration-verify` 及原因、验证命令输出。
