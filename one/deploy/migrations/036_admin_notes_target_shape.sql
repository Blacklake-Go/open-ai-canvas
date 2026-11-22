-- 036: 对齐 ops_bill.admin_notes 的实际读写形状（向后兼容，纯增量）
-- 现象：后台用户详情页读取/新增管理员备注报 "column target_type does not exist"。
-- 根因：lib/repositories/notes.js 以 (target_type, target_id, body, author_id, author_email) 读写，
--       且 INSERT 不提供 user_id / admin_id / content；线上表这三列是 NOT NULL，形状来自更早的手工建表。
-- 处理：只新增列、只放宽旧列的 NOT NULL、只补索引与回填；不删列、不改类型、不清空任何既有数据（当前 0 行）。
-- 旧列继续保留，历史写入路径不受影响。

ALTER TABLE ops_bill.admin_notes
  ADD COLUMN IF NOT EXISTS target_type  TEXT,
  ADD COLUMN IF NOT EXISTS target_id    TEXT,
  ADD COLUMN IF NOT EXISTS body         TEXT,
  ADD COLUMN IF NOT EXISTS author_id    TEXT,
  ADD COLUMN IF NOT EXISTS author_email TEXT;

ALTER TABLE ops_bill.admin_notes ALTER COLUMN user_id  DROP NOT NULL;
ALTER TABLE ops_bill.admin_notes ALTER COLUMN admin_id DROP NOT NULL;
ALTER TABLE ops_bill.admin_notes ALTER COLUMN content  DROP NOT NULL;

-- 既有行按旧列语义映射到新列，保证两种形状都不丢信息（新列已有值不覆盖）
UPDATE ops_bill.admin_notes
   SET target_type  = COALESCE(target_type, 'user'),
       target_id    = COALESCE(target_id, user_id),
       body         = COALESCE(body, content),
       author_id    = COALESCE(author_id, admin_id)
 WHERE target_id IS NULL OR body IS NULL;

-- listNotes() 的过滤路径：WHERE target_type = $1 AND target_id = $2 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS admin_notes_target_idx
  ON ops_bill.admin_notes (target_type, target_id, created_at DESC);
