ALTER TABLE ops_bill.banner_history
    ADD COLUMN campaign_id VARCHAR(64),
    ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE ops_bill.banner_history
SET campaign_id = id;

UPDATE ops_bill.banner_history h
SET enabled = (s.value_json->>'enabled')::boolean
FROM ops_bill.system_settings s
WHERE s.key = 'site_banner'
  AND h.id = s.value_json->>'id'
  AND jsonb_typeof(s.value_json->'enabled') = 'boolean';

UPDATE ops_bill.banner_history h
SET is_active = FALSE
WHERE is_active AND NOT EXISTS (
    SELECT 1 FROM ops_bill.system_settings s
    WHERE s.key = 'site_banner' AND h.id = s.value_json->>'id'
);
