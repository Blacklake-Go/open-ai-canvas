-- 062_onboarding_v3_tags.sql
-- 增补新人引导 2.0/3.0 两步式画像选项对应的运营标签，确保用户入驻时选取的职业与创作目的能安全落库到 user_tags。

INSERT INTO ops_bill.tags (id, name, slug, color, description)
VALUES
  -- 职业身份扩展
  ('tag_occ_media',     '职业:影视传媒',     'occ_media',     '#22d3ee', '画像维度:职业身份-传统媒体、影视、游戏等'),
  ('tag_occ_creator',   '职业:自媒体创作者', 'occ_creator',   '#ec4899', '画像维度:职业身份-图文、短视频等'),
  ('tag_occ_freelance', '职业:自由职业者',   'occ_freelance', '#f59e0b', '画像维度:职业身份-独立摄影师、撰稿人等'),
  ('tag_occ_design',    '职业:艺术与设计',   'occ_design',    '#06b6d4', '画像维度:职业身份-动画、插画、平面设计等'),
  ('tag_occ_edu',       '职业:教育培训',     'occ_edu',       '#14b8a6', '画像维度:职业身份-教师、AIGC培训等'),
  ('tag_occ_marketing', '职业:广告营销',     'occ_marketing', '#f97316', '画像维度:职业身份-广告营销、电商等'),
  ('tag_occ_tech',      '职业:技术研发',     'occ_tech',      '#3b82f6', '画像维度:职业身份-软件开发、产品运营等'),
  ('tag_occ_other',     '职业:其他领域',     'occ_other',     '#64748b', '画像维度:职业身份-其他自定义领域'),

  -- 创作场景与目的扩展
  ('tag_pur_self_media',   '场景:自媒体内容',   'pur_self_media',   '#ec4899', '画像维度:创作场景-短视频、社交媒体内容等'),
  ('tag_pur_ad_content',   '场景:商业广告创意', 'pur_ad_content',   '#f59e0b', '画像维度:创作场景-商业广告、商品宣传片等'),
  ('tag_pur_film_video',   '场景:影视短片制作', 'pur_film_video',   '#22d3ee', '画像维度:创作场景-微电影、短剧、故事片等'),
  ('tag_pur_prod_design',  '场景:产品界面设计', 'pur_prod_design',  '#06b6d4', '画像维度:创作场景-App UI、网页设计、产品原型等'),
  ('tag_pur_interest',     '场景:个人兴趣探索', 'pur_interest',     '#a855f7', '画像维度:创作场景-生活记录、艺术创作等'),
  ('tag_pur_inspiration',  '场景:创意灵感情绪', 'pur_inspiration',  '#eab308', '画像维度:创作场景-创意素材、分镜灵感等'),
  ('tag_pur_aigc_training','场景:AIGC教学培训', 'pur_aigc_training','#10b981', '画像维度:创作场景-AI视频教程、教学课件等'),
  ('tag_pur_other',        '场景:其他创作方向', 'pur_other',        '#64748b', '画像维度:创作场景-其他创作方向')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  color = EXCLUDED.color,
  description = EXCLUDED.description;
