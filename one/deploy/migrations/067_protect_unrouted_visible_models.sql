-- Migration 067: Protect unrouted and concept models from being visible on frontend studio/canvas
-- These models do not currently have verified, functioning upstream provider routes.
-- Setting is_visible = false prevents users from encountering NO_COST_VERIFIED_ROUTE errors.
-- Administrators can still view, configure, and match them in /admin/models.

UPDATE ai_studio.ai_models
SET is_visible = false, updated_at = NOW()
WHERE id IN (
  'cogvideo-2b',
  'deepseek-r1',
  'deepseek-v3',
  'doubao-1.5-pro',
  'flux-3',
  'gemini-2-5-pro-tts',
  'gemini-3-1-flash-tts',
  'gemini-omni-flash',
  'gpt-4o',
  'hunyuan-video',
  'infinitetalk',
  'kling-2.1',
  'luma-dream-machine',
  'qwen-vl-max',
  'runway-image-to-video',
  'seedream-4.0',
  'seedream-5.0-edit',
  'sora-turbo',
  'topaz-video-ai',
  'udio-v1.5',
  'veo-3',
  'vidu-2.0',
  'wan2.1-text-to-image',
  'wan-2.2'
) AND is_visible = true;
