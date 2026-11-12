# SupDance 服务器备份与产物保留

本工具在服务器执行，不依赖桌面 Codex 常驻。安装文件为 `retention.py`、`supdance-retention.service`、`supdance-retention.timer`；服务器私有策略位于 `/etc/supdance-retention/policy.json`，不提交凭据或私有连接配置。

## 时间和范围

- 每日 03:30，明确使用 `Asia/Taipei`。先检查站点，再生成主站与 ONE 数据库备份、校验恢复材料、清理过期产物，最后再检查站点。错过的任务由 systemd 在恢复后补跑。
- 每日数据库备份至少保留最近 7 组，且至少保留 7 天；每周完整后端数据与 ONE 上传文件备份至少保留最近 2 组，且至少保留 14 天。完整备份间隔至少 7 天，首轮立即生成。
- 演练应用容器和已识别的生成副本至少保留 7 天。旧 Web 发布及无引用镜像至少保留 14 天，同时保留每类最新两个版本。
- 旧 `backup-YYYYMMDD-HHMMSS.zip` 仅在结构与既有完整备份格式一致、已超过 7 天、且另有至少两份此类备份及更新的有效恢复集时清理。
- 单轮最多处理 50 个对象、估计 8 GiB；不会为了达到空间目标缩短保留期。磁盘使用率达到 85% 时记录 warning 并返回非零状态。

## 保护边界

当前容器镜像和挂载、仍被停止容器引用的挂载、宿主服务工作目录、进程工作目录/可执行文件/打开文件，以及策略中固定的回滚目录与镜像都受保护。部署中运行容器集合变化时停止删除。数据库和 Redis 容器、所有 Docker 数据卷、数据库目录、原始历史数据库备份及用户素材目录不参与产物清理。只有本工具管理的每日数据库备份允许按上述规则轮换。

不执行 `docker system prune`、`volume prune`、源码清理或整棵 backups 目录删除。候选目录包含 `PG_VERSION`、数据库文件、resources、uploads 或 pgdata 时拒绝整目录清理。新出现的未知归档不根据大小或名称猜测删除资格。

备份有 SHA-256 元数据；备份缺失、过期、损坏，或者固定回滚材料改变时，清理停止。数据库备份通过完整 `pg_restore --file=/dev/null` 解析，绝不向数据库还原。完整数据归档通过 gzip 完整性检查。对数据的备份读取不替代跨数据库和对象存储的一致性恢复演练；应用回滚不能通过覆盖旧数据库来丢弃新交易。

本任务不修改现有数据库备份 cron，也不调用或更改现有素材回收站清理任务。

## 操作

```bash
# 只读计划；不会备份或删除业务数据
sudo python3 /usr/local/lib/supdance-retention/retention.py

# 手动运行与定时器相同的完整流程
sudo systemctl start supdance-retention.service

# 登记经过审核的新演练构建文件或纯生成目录，最短 7 天
sudo python3 /usr/local/lib/supdance-retention/retention.py \
  --register /opt/y-supdance-canvas/backups/example/build-output --days 7

systemctl list-timers supdance-retention.timer
journalctl -u supdance-retention.service --since today
sudo cat /var/lib/supdance-retention/last.json

# 暂停自动清理
sudo systemctl disable --now supdance-retention.timer
```

报告和登记表位于 `/var/lib/supdance-retention/`，历史报告保留 30 天。托管备份位于 `/opt/y-supdance-canvas/backups/retention-managed/`。配置、备份与报告目录仅 root 可写。新部署应更新固定回滚清单和文件校验值，并先执行只读计划；建议部署工具与清理共用 `/run/lock/supdance-maintenance.lock`，避免并行发布。

## 验证

```bash
python3 -m unittest discover -s tools/supdance/retention -p 'test_*.py' -v
systemd-analyze verify supdance-retention.service supdance-retention.timer
```

上线时还必须执行一次真实服务，确认备份完整解析、清理日志、站点与静态脚本访问、服务状态及下一次触发时间。用单独登记的过期纯文本产物验证删除路径；不能用此验证替代真实站点检查。
