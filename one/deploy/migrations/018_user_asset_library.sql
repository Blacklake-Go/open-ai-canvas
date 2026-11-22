-- 018_user_asset_library.sql
-- 我的资产库：两级子文件夹与全维度素材管理架构

-- 1. 用户资产两级文件夹表
CREATE TABLE IF NOT EXISTS ai_studio.asset_folders (
  id VARCHAR(64) PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  parent_id VARCHAR(64) REFERENCES ai_studio.asset_folders(id) ON DELETE CASCADE,
  depth SMALLINT NOT NULL DEFAULT 1 CHECK (depth IN (1, 2)),
  name VARCHAR(128) NOT NULL,
  color VARCHAR(32) DEFAULT '#22d3ee',
  icon VARCHAR(32) DEFAULT 'folder',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS asset_folders_user_parent_name_idx 
  ON ai_studio.asset_folders(user_id, COALESCE(parent_id, 'root'), name);
CREATE INDEX IF NOT EXISTS asset_folders_user_idx 
  ON ai_studio.asset_folders(user_id, parent_id, sort_order ASC);

-- 2. 用户私有资产主表
CREATE TABLE IF NOT EXISTS ai_studio.user_assets (
  id VARCHAR(64) PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_usr.users(id) ON DELETE CASCADE,
  folder_id VARCHAR(64) REFERENCES ai_studio.asset_folders(id) ON DELETE SET NULL,
  creation_id TEXT REFERENCES ai_studio.creations(id) ON DELETE SET NULL,
  
  -- 类别与来源 (严格与应用类别一致：image, video, audio, workflow)
  asset_type VARCHAR(32) NOT NULL DEFAULT 'image' CHECK (asset_type IN ('image', 'video', 'audio', 'workflow')),
  studio_id VARCHAR(64) NOT NULL DEFAULT 'image',
  title VARCHAR(255),
  
  -- 媒体资源
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  preview_url TEXT,
  mime_type VARCHAR(64) DEFAULT 'image/webp',
  file_size_bytes BIGINT DEFAULT 0,
  width INT,
  height INT,
  aspect_ratio VARCHAR(32),
  duration_seconds NUMERIC(8, 2),
  
  -- 生成核心元数据 (记录时间、提示词、模型与生成上下文)
  prompt TEXT NOT NULL DEFAULT '',
  negative_prompt TEXT DEFAULT '',
  model_id VARCHAR(128),
  model_name VARCHAR(128),
  provider VARCHAR(64),
  generation_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  credit_cost INT NOT NULL DEFAULT 0,
  generation_duration_ms INT DEFAULT 0,
  
  -- 状态与操作
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(32) NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'archived', 'trash')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_assets_user_folder_idx ON ai_studio.user_assets(user_id, folder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_assets_user_type_idx ON ai_studio.user_assets(user_id, asset_type, created_at DESC);
CREATE INDEX IF NOT EXISTS user_assets_user_fav_idx ON ai_studio.user_assets(user_id, is_favorite, created_at DESC) WHERE is_favorite = TRUE;
CREATE INDEX IF NOT EXISTS user_assets_creation_idx ON ai_studio.user_assets(creation_id);

-- 3. 存量生成记录回填：将历史成功生成内容同步至私有资产库
DO $$
BEGIN
  INSERT INTO ai_studio.user_assets (
    id,
    user_id,
    folder_id,
    creation_id,
    asset_type,
    studio_id,
    title,
    media_url,
    thumbnail_url,
    prompt,
    model_id,
    model_name,
    provider,
    generation_params,
    credit_cost,
    generation_duration_ms,
    created_at,
    updated_at
  )
  SELECT
    'ast_' || substr(md5(c.id || c.created_at::text), 1, 16) AS id,
    c.user_id,
    NULL AS folder_id,
    c.id AS creation_id,
    CASE 
      WHEN lower(c.studio_id) LIKE '%video%' OR lower(c.studio_id) LIKE '%cinema%' OR lower(c.studio_id) LIKE '%motion%' OR lower(c.studio_id) LIKE '%clip%' OR lower(c.studio_id) LIKE '%lip%' THEN 'video'
      WHEN lower(c.studio_id) LIKE '%audio%' OR lower(c.studio_id) LIKE '%music%' THEN 'audio'
      WHEN lower(c.studio_id) LIKE '%workflow%' OR lower(c.studio_id) LIKE '%agent%' THEN 'workflow'
      ELSE 'image'
    END AS asset_type,
    COALESCE(c.studio_id, 'image') AS studio_id,
    COALESCE(NULLIF(c.label, ''), '生成作品') AS title,
    c.result_url AS media_url,
    c.result_url AS thumbnail_url,
    COALESCE(NULLIF(c.label, ''), c.input_summary_json->>'prompt', '') AS prompt,
    c.model AS model_id,
    c.model AS model_name,
    c.provider,
    COALESCE(c.input_summary_json, c.metadata_json, '{}'::jsonb) AS generation_params,
    c.credit_cost,
    COALESCE(c.duration_ms, 0) AS generation_duration_ms,
    c.created_at,
    c.updated_at
  FROM ai_studio.creations c
  WHERE c.status = 'succeeded' 
    AND c.result_url IS NOT NULL 
    AND c.result_url != ''
    AND NOT EXISTS (
      SELECT 1 FROM ai_studio.user_assets a WHERE a.creation_id = c.id
    )
  ON CONFLICT (id) DO NOTHING;
END $$;
