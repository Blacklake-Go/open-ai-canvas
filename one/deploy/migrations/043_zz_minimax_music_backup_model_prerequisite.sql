-- Migration 044 assigns minimax-music-3.0 as a backup model by foreign key.
-- On a clean install seed a disabled catalog row; on an already-migrated
-- database do not recreate operator data if the catalog row was later removed.
-- The ledger table is absent in the raw SQL migration rehearsal, so inspect it
-- dynamically instead of binding a static reference to a not-yet-created table.
DO $$
DECLARE
  migration_044_applied BOOLEAN := FALSE;
BEGIN
  IF to_regclass('sys_core.schema_migrations') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM sys_core.schema_migrations WHERE version = $1)'
      INTO migration_044_applied
      USING '044_model_tiering_and_shrink_routing';
  END IF;

  IF NOT migration_044_applied THEN
    INSERT INTO ai_studio.ai_models
      (id, slug, name, display_name, category, status)
    VALUES
      ('minimax-music-3.0', 'minimax-music-3.0',
       'MiniMax Music 3.0 (migration prerequisite)',
       'MiniMax Music 3.0 (migration prerequisite)', 'audio', 'disabled')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
