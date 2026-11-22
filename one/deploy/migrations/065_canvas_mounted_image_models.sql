-- 065_canvas_mounted_image_models.sql
-- Ensure canvas_model_config mounts verified image models: seedream-4.5, seedream-5.0-pro, seedream-5.0-lite

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM ops_bill.system_settings WHERE key = 'canvas_model_config') THEN
    UPDATE ops_bill.system_settings
    SET value_json = jsonb_set(
      jsonb_set(
        value_json::jsonb,
        '{mountedModelIds,image}',
        '["seedream-4.5", "seedream-5.0-pro", "seedream-5.0-lite"]'::jsonb
      ),
      '{defaults,imageModelId}',
      to_jsonb(COALESCE(NULLIF(value_json->'defaults'->>'imageModelId', ''), 'seedream-4.5'))
    ),
    updated_at = NOW()
    WHERE key = 'canvas_model_config';
  ELSE
    INSERT INTO ops_bill.system_settings (key, value_json, updated_by, updated_at)
    VALUES (
      'canvas_model_config',
      '{
        "mountedModelIds": {
          "image": ["seedream-4.5", "seedream-5.0-pro", "seedream-5.0-lite"],
          "video": [],
          "audio": [],
          "text": []
        },
        "defaults": {
          "imageModelId": "seedream-4.5",
          "videoModelId": "",
          "audioModelId": "",
          "textModelId": "",
          "canvasImageCount": "1",
          "audioVoice": "alloy",
          "audioFormat": "mp3",
          "audioSpeed": "1",
          "audioInstructions": "",
          "systemPrompt": ""
        }
      }'::jsonb,
      'migration:065',
      NOW()
    );
  END IF;
END $$;
