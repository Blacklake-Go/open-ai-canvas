# SupDance Canvas — 安全回滚与灾难恢复手册 (RECOVERY.md)

> **安全声明**：本文件不包含任何真实服务器密码、数据库密码、Token 或私密连接字符串。所有生产恢复操作在执行前必须获得明确运维授权。

## 1. 当前线上基线与回滚锚点快照

| 项目 | 当前生产运行基线 (`v1.7.1`) | 上一稳定版本快照 |
| --- | --- | --- |
| **SupDance 标签 / Commit** | `supdance/v2026.10.27.1` (`6825bcd82abfa650c7645a6bafe11fd24dc74326`) | `a934a655` (`v1.6.9.1` + connector patch) |
| **上游基线标签 / Commit** | `v1.7.1` (`89fcb53fd65969cb58ae1eba5d18381db51819d1`) | `v1.6.9.2` / `v1.6.9.1` |
| **Backend 镜像 Digest** | `ghcr.io/ddcat-ai/open-ai-canvas-backend@sha256:da21981ba178b3ce5e77b0ab19de828457f31275a404a77e98d263a51f9297fc` | 记录于 `/var/lib/open-ai-canvas-updater/previous.env` |
| **Web 镜像 Digest** | `ghcr.io/ddcat-ai/open-ai-canvas-web@sha256:833ecbfa99fe88ee7e8e5aff21c98db07da6033db905ad63454d89363a23e952` | 记录于 `/var/lib/open-ai-canvas-updater/previous.env` |
| **Yingce-Agent 镜像 Digest** | `ghcr.io/ddcat-ai/open-ai-canvas-yingce-agent@sha256:c821a60623f23bc9b75af26f9f426e3bcd7a88b35029a9421263932d791667c6` | 记录于 `/var/lib/open-ai-canvas-updater/previous.env` |
| **数据库 Schema 版本** | `71` | `59` (`v1.6.9.1` / `v1.6.9.2`) |
| **数据库与配置备份位置** | `/opt/y-supdance-canvas/backups/pre-1.7.1-20261026T174516Z/pre-1.7.1-20261026T174516Z.sql.gz` | `/opt/y-supdance-canvas/backups/backup-20261023-121722.zip` (SHA256: `c0edf2cea7ff8775daefb7505ad7b824b168dbd8eee7839d787bc63354099410`) |
| **前端静态目录快照** | `/home/wwwroot/AI/domain/y.supdance.com/releases/1.7.1-connector` | `/home/wwwroot/AI/domain/y.supdance.com/web.prev-20261026T175230Z-1.7.1` 及 `web-bak-20261024-095941` |
| **Nginx 配置备份** | `/home/wwwroot/AI/vhost/y.supdance.com-https.conf` | `/home/wwwroot/AI/vhost/y.supdance.com.conf.before-y-canvas-20261022` |

---

## 2. 核心原则：代码回滚不等于数据库回滚

1. **严禁用旧版 Backend 二进制直接连接更高版本的 PostgreSQL Schema**：
   - 上游 `schema_migrations` 具有严格的最高版本与 SHA256 校验和检查（例如 Schema 71 相比 Schema 59 删除了旧逐镜字段并新增短剧剧情段表）。旧版 Backend 启动时会因数据库版本高于二进制支持版本而直接拒绝启动。
2. **分开设计两类回滚**：
   - **纯前端 / 同 Schema 补丁回滚**：不涉及数据库恢复，仅切换 `CANVAS_WEB_RELEASE_PATH` 或同 Schema 的容器镜像 Digest。
   - **跨 Schema 重大故障回滚**：必须先停写 Web/Backend，验证数据库备份完整性，恢复匹配的 PostgreSQL 备份与 `.env` / Compose 快照，再启动旧版镜像。

---

## 3. 场景 A：同 Schema 版本下的前端或容器快速回滚

当仅需回滚 SupDance 前端二开静态包（数据库 Schema 未变化，仍为 `71`）：

```bash
# 1. 在服务器上检查可用前端快照目录
ls -la /home/wwwroot/AI/domain/y.supdance.com/
ls -la /home/wwwroot/AI/domain/y.supdance.com/releases/

# 2. 修改 /opt/y-supdance-canvas/.env 中的 CANVAS_WEB_RELEASE_PATH 指向目标构建目录，或将 web.prev-* 同步回 web 目录
cd /opt/y-supdance-canvas
docker compose --env-file .env -f docker-compose.deploy.yml up -d --no-deps --force-recreate web

# 3. 验证就绪状态
curl -fsS http://127.0.0.1:3240/api/health/ready
```

---

## 4. 场景 B：跨数据库 Schema 的完整灾难恢复流程

当新版本发生致命数据库迁移故障或严重生产不可用，且已获得明确恢复授权时：

```bash
cd /opt/y-supdance-canvas

# 1. 立即停止 web 与 backend，防止继续产生新脏数据（保持 postgres 运行）
docker compose --env-file .env -f docker-compose.deploy.yml stop web backend yingce-agent

# 2. 对当前故障现场再做一次保全快照（防二次损坏）
umask 077
docker compose --env-file .env -f docker-compose.deploy.yml exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "backups/emergency-before-rollback-$(date +%Y%m%d-%H%M%S).dump"

# 3. 校验目标恢复备份文件的完整性（以 custom dump 或 .sql.gz 为例）
sha256sum backups/backup-*.zip backups/pre-*/*.sql.gz

# 4. 恢复数据库（根据备份格式选择 pg_restore 或 gunzip | psql）
# 5. 恢复更新前保存的 docker-compose.deploy.yml 与 .env 中的镜像 @sha256:... 引用
# 6. 启动服务并验证健康检查与 schema.current == schema.expected
docker compose --env-file .env -f docker-compose.deploy.yml up -d
curl -fsS http://127.0.0.1:3240/api/health/ready
```
