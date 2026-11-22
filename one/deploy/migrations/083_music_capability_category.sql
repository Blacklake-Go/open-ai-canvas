-- 083_music_capability_category.sql
-- 将 music 从旧 audio 归并中独立出来：
--   1) 扩展 ai_models.category 枚举（019 的 CHECK 不含 music）；
--   2) 回填既有音乐生成模型为 music（按已知 ID 与显式能力标记）；
--   3) 迁移 canvas_model_config：把 music 模型从 audio 挂载拆分到 music 组，
--      并保证 audio/music 默认模型仍属于各自挂载（旧配置继续可读）。
-- 全过程幂等：可重复执行，不删除任何模型、任务或历史账单。

ALTER TABLE ai_studio.ai_models DROP CONSTRAINT IF EXISTS ai_models_category_check;
ALTER TABLE ai_studio.ai_models
  ADD CONSTRAINT ai_models_category_check
  CHECK (category IN (
    'image', 'image_edit', 'video', 'video_image', 'video_text',
    'audio', 'music', 'text', 'other'
  ));

-- 显式能力标记优先，其次按既有音乐生成模型 ID 回填。
-- 语音/声音克隆（minimax-speech-*, *-voice-clone）保持 audio，不在此列表内。
UPDATE ai_studio.ai_models
SET category = 'music',
    updated_at = now()
WHERE category = 'audio'
  AND (
    LOWER(COALESCE(capabilities->>'modality', '')) = 'music'
    OR LOWER(COALESCE(capabilities->>'sub_type', '')) = 'music'
    OR id IN (
      'minimax-music-3.0',
      'suno-create-music',
      'suno-remix-music',
      'suno-extend-music',
      'suno-add-vocals',
      'suno-add-instrumental',
      'suno-generate-mashup',
      'suno-generate-sounds',
      'mmaudio-v2-text-to-audio'
    )
  );

DO $$
DECLARE
  setting_row RECORD;
  config JSONB;
  mounts JSONB;
  defaults JSONB;
  music_catalog JSONB := '[]'::jsonb;
  audio_configured JSONB := '[]'::jsonb;
  music_configured JSONB := '[]'::jsonb;
  kept_audio JSONB := '[]'::jsonb;
  merged_music JSONB := '[]'::jsonb;
  default_audio TEXT;
  default_music TEXT;
BEGIN
  IF to_regclass('ops_bill.system_settings') IS NULL THEN
    RETURN;
  END IF;

  SELECT key, value_json INTO setting_row
  FROM ops_bill.system_settings
  WHERE key = 'canvas_model_config'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  config := setting_row.value_json;
  IF jsonb_typeof(config) <> 'object' THEN
    RETURN;
  END IF;

  mounts := config->'mountedModelIds';
  IF jsonb_typeof(mounts) <> 'object' THEN
    RETURN;
  END IF;

  SELECT COALESCE(jsonb_agg(id), '[]'::jsonb)
  INTO music_catalog
  FROM ai_studio.ai_models
  WHERE category = 'music';

  IF jsonb_typeof(mounts->'audio') = 'array' THEN
    audio_configured := mounts->'audio';
  END IF;
  IF jsonb_typeof(mounts->'music') = 'array' THEN
    music_configured := mounts->'music';
  END IF;

  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
  INTO kept_audio
  FROM jsonb_array_elements(audio_configured) AS value
  WHERE NOT (music_catalog ? (value #>> '{}'));

  -- audio 中移出的音乐模型并入 music 组，保留音乐组原有顺序并去重。
  SELECT COALESCE(jsonb_agg(DISTINCT value), '[]'::jsonb)
  INTO merged_music
  FROM jsonb_array_elements(
    music_configured || (
      SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
      FROM jsonb_array_elements(audio_configured) AS value
      WHERE music_catalog ? (value #>> '{}')
    )
  ) AS value;

  defaults := config->'defaults';
  IF jsonb_typeof(defaults) = 'object' THEN
    default_audio := COALESCE(defaults->>'audioModelId', '');
    default_music := COALESCE(defaults->>'musicModelId', '');

    -- audio 默认若被迁移到 music，先暂存为音乐默认。
    IF default_audio <> '' AND merged_music ? default_audio THEN
      IF default_music = '' THEN
        default_music := default_audio;
      END IF;
      default_audio := '';
    END IF;

    IF default_music <> '' AND NOT (merged_music ? default_music) THEN
      default_music := '';
    END IF;
    IF default_music = '' AND jsonb_array_length(merged_music) > 0 THEN
      default_music := merged_music->>0;
    END IF;

    IF default_audio <> '' AND NOT (kept_audio ? default_audio) THEN
      default_audio := '';
    END IF;
    IF default_audio = '' AND jsonb_array_length(kept_audio) > 0 THEN
      -- 优先选择语音合成模型，避免把声音克隆模型当作 TTS 默认值。
      SELECT value #>> '{}' INTO default_audio
      FROM jsonb_array_elements(kept_audio) AS value
      WHERE (value #>> '{}') LIKE 'minimax-speech%'
      LIMIT 1;
      IF default_audio IS NULL OR default_audio = '' THEN
        default_audio := kept_audio->>0;
      END IF;
    END IF;

    config := jsonb_set(config, '{defaults,audioModelId}', to_jsonb(default_audio), true);
    config := jsonb_set(config, '{defaults,musicModelId}', to_jsonb(default_music), true);
  END IF;

  config := jsonb_set(config, '{mountedModelIds,audio}', kept_audio, true);
  config := jsonb_set(config, '{mountedModelIds,music}', merged_music, true);

  IF config IS DISTINCT FROM setting_row.value_json THEN
    UPDATE ops_bill.system_settings
    SET value_json = config,
        updated_at = now()
    WHERE key = 'canvas_model_config';
  END IF;
END $$;
