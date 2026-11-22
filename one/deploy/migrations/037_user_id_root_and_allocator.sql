-- Promote the existing six-digit public UID to the sole local user key.
-- All work is transactional; refuse to guess if any existing UID is invalid.

-- 1. 为可能存在的存量 NULL 或非 6 位纯数字的用户安全分配唯一的 6 位数字 UID (100000-999999)
DO $$
DECLARE
  r RECORD;
  new_num TEXT;
  exists_count INT;
BEGIN
  FOR r IN SELECT id FROM auth_usr.users WHERE user_number IS NULL OR user_number !~ '^[1-9][0-9]{5}$' LOOP
    LOOP
      new_num := FLOOR(100000 + random() * 900000)::TEXT;
      SELECT COUNT(*) INTO exists_count FROM auth_usr.users WHERE user_number = new_num;
      IF exists_count = 0 THEN
        UPDATE auth_usr.users SET user_number = new_num WHERE id = r.id;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM auth_usr.users
    WHERE user_number IS NULL OR user_number !~ '^[1-9][0-9]{5}$'
  ) THEN
    RAISE EXCEPTION 'Cannot promote user_number: every existing user must have one unique six-digit UID.';
  END IF;

  IF EXISTS (
    SELECT user_number FROM auth_usr.users
    GROUP BY user_number HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot promote user_number: duplicate six-digit UIDs exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM auth_usr.users source
    JOIN auth_usr.users collision ON collision.id::text = source.user_number
    WHERE collision.id::text <> source.id::text
  ) THEN
    RAISE EXCEPTION 'Cannot promote user_number: a target UID is already another users.id.';
  END IF;
END $$;

CREATE TEMP TABLE user_id_root_map ON COMMIT DROP AS
SELECT id::text AS old_id, user_number::text AS new_id
FROM auth_usr.users;

CREATE TABLE IF NOT EXISTS auth_usr.user_id_allocations (
  user_id VARCHAR(64) PRIMARY KEY,
  digit_length SMALLINT NOT NULL,
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_id_allocations_numeric_check
    CHECK (user_id ~ '^[1-9][0-9]{5,63}$'),
  CONSTRAINT user_id_allocations_length_check
    CHECK (length(user_id) = digit_length),
  CONSTRAINT user_id_allocations_digit_length_check
    CHECK (digit_length BETWEEN 6 AND 64)
);

COMMENT ON TABLE auth_usr.user_id_allocations IS
  'Append-only reservation ledger for the canonical users.id; prevents UID reuse after account deletion.';

INSERT INTO auth_usr.user_id_allocations (user_id, digit_length, allocated_at)
SELECT new_id, length(new_id)::smallint, COALESCE(u.created_at, now())
FROM user_id_root_map m
JOIN auth_usr.users u ON u.id::text = m.old_id
ON CONFLICT (user_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS user_id_allocations_length_idx
  ON auth_usr.user_id_allocations(digit_length);

CREATE TEMP TABLE user_id_root_fks ON COMMIT DROP AS
SELECT con.oid AS constraint_oid,
       con.conrelid AS relation_oid,
       con.conname AS constraint_name,
       con.conkey AS local_columns,
       con.confkey AS referenced_columns,
       pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint con
WHERE con.contype = 'f'
  AND con.confrelid = 'auth_usr.users'::regclass;

DO $$
DECLARE
  fk RECORD;
  ref_column RECORD;
  has_target_type BOOLEAN;
BEGIN
  -- This migration knows how to rewrite single-column references to users.id.
  IF EXISTS (
    SELECT 1 FROM user_id_root_fks
    WHERE cardinality(local_columns) <> 1 OR cardinality(referenced_columns) <> 1
  ) THEN
    RAISE EXCEPTION 'Unexpected composite foreign key to auth_usr.users; refusing to rewrite user IDs.';
  END IF;

  FOR fk IN SELECT * FROM user_id_root_fks LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.relation_oid::regclass, fk.constraint_name);
  END LOOP;

  -- FK metadata, rather than a naming convention, is authoritative for all
  -- constrained user references (including follower/following-style names).
  FOR fk IN SELECT * FROM user_id_root_fks LOOP
    SELECT attname INTO ref_column
    FROM pg_attribute
    WHERE attrelid = fk.relation_oid AND attnum = fk.local_columns[1] AND NOT attisdropped;

    EXECUTE format(
      'UPDATE %s AS row_data SET %I = map.new_id FROM user_id_root_map AS map WHERE row_data.%I::text = map.old_id',
      fk.relation_oid::regclass, ref_column.attname, ref_column.attname
    );
  END LOOP;

  -- Rewrite every relational user-reference column, including historical audit
  -- columns that intentionally have no FK. Only exact old IDs are changed.
  FOR ref_column IN
    SELECT ns.nspname AS schema_name, rel.relname AS table_name, att.attname AS column_name,
           rel.oid AS relation_oid
    FROM pg_class rel
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid
    JOIN pg_type typ ON typ.oid = att.atttypid
    WHERE rel.relkind IN ('r', 'p')
      AND ns.nspname IN ('auth_usr', 'ai_studio', 'ops_bill', 'sys_core')
      AND att.attnum > 0 AND NOT att.attisdropped
      AND typ.typname IN ('text', 'varchar', 'bpchar')
      AND att.attname IN (
        'user_id', 'actor_id', 'actor_user_id', 'admin_user_id', 'author_id',
        'created_by', 'requested_by', 'owner_id', 'target', 'target_id'
      )
      AND NOT (ns.nspname = 'auth_usr' AND rel.relname = 'users' AND att.attname = 'id')
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = ref_column.relation_oid AND attname = 'target_type' AND NOT attisdropped
    ) INTO has_target_type;

    IF ref_column.column_name = 'target_id' AND has_target_type THEN
      EXECUTE format(
        'UPDATE %I.%I AS row_data SET %I = map.new_id FROM user_id_root_map AS map WHERE row_data.%I::text = map.old_id AND row_data.target_type = %L',
        ref_column.schema_name, ref_column.table_name, ref_column.column_name,
        ref_column.column_name, 'user'
      );
    ELSE
      EXECUTE format(
        'UPDATE %I.%I AS row_data SET %I = map.new_id FROM user_id_root_map AS map WHERE row_data.%I::text = map.old_id',
        ref_column.schema_name, ref_column.table_name, ref_column.column_name,
        ref_column.column_name
      );
    END IF;
  END LOOP;

  UPDATE auth_usr.users AS users
  SET id = map.new_id
  FROM user_id_root_map AS map
  WHERE users.id::text = map.old_id;

  FOR fk IN SELECT * FROM user_id_root_fks LOOP
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I %s',
      fk.relation_oid::regclass, fk.constraint_name, fk.definition
    );
  END LOOP;
END $$;

ALTER TABLE auth_usr.users
  ADD CONSTRAINT users_id_numeric_check CHECK (id ~ '^[1-9][0-9]{5,63}$'),
  ADD CONSTRAINT users_id_allocation_fk
    FOREIGN KEY (id) REFERENCES auth_usr.user_id_allocations(user_id) ON DELETE RESTRICT;

ALTER TABLE auth_usr.users
  DROP COLUMN IF EXISTS uuid,
  DROP COLUMN IF EXISTS user_number;
