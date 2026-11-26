-- Main-site terminal image/video tasks and their last correlated API result.
-- Run with psql -XAtq -v ON_ERROR_STOP=1. Return aggregate rows only.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL TIME ZONE 'Asia/Taipei';

WITH tasks_in_scope AS (
    SELECT t.id, t.type, t.status, t.user_id, t.created_at,
           CASE WHEN t.created_at >= current_date THEN 'today_partial'
                WHEN t.created_at >= current_date - 7 THEN 'last_7_full_days'
                ELSE 'prior_21_full_days' END AS period,
           COALESCE(CASE WHEN pg_input_is_valid(t.execution_diagnostic_json, 'jsonb')
                         THEN t.execution_diagnostic_json::jsonb->>'code' END, '') AS diagnostic,
           t.channel_model_id, t.billing_order_id
    FROM tasks t
    WHERE t.type IN ('canvas_image', 'canvas_video')
      AND t.status IN ('succeeded', 'failed')
      AND t.created_at >= current_date - 28 AND t.created_at < statement_timestamp()
), details AS (
    SELECT t.*, api.status_code,
           CASE WHEN mc.scope = 'system' THEN mc.name ELSE 'unattributed_or_user_channel' END AS channel,
           CASE WHEN mc.scope = 'system' AND cm.channel_id = mc.id THEN COALESCE(NULLIF(cm.display_name, ''), 'unattributed')
                ELSE 'unattributed' END AS model,
           CASE WHEN mc.scope = 'system' THEN mc.enabled AND mc.deleted_at IS NULL END AS channel_currently_enabled,
           CASE
             WHEN api.task_id IS NULL THEN 'no_correlated_api_call'
             WHEN api.error_code = 'request_not_sent' THEN 'request_not_sent'
             WHEN api.status_code = 429 THEN 'rate_limited'
             WHEN api.status_code IN (401, 403) THEN 'unauthorized_or_forbidden'
             WHEN api.status_code BETWEEN 500 AND 599 THEN 'upstream_5xx'
             WHEN api.status_code BETWEEN 400 AND 499 THEN 'upstream_other_4xx'
             WHEN lower(api.provider_status) IN ('failed', 'error', 'rejected') THEN 'provider_reported_failure'
             ELSE 'other_logged_response'
           END AS api_result_bucket
    FROM tasks_in_scope t
    LEFT JOIN billing_orders bo ON bo.id = t.billing_order_id
    LEFT JOIN channel_models cm ON cm.id = COALESCE(NULLIF(t.channel_model_id, ''), NULLIF(bo.channel_model_id, ''))
    LEFT JOIN LATERAL (
        SELECT l.task_id, l.status_code, l.provider_status, l.channel_id, l.error_code
        FROM api_call_logs l
        WHERE t.status = 'failed' AND l.task_id = t.id
        ORDER BY l.created_at DESC, l.id DESC LIMIT 1
    ) api ON TRUE
    LEFT JOIN model_channels mc ON mc.id = COALESCE(NULLIF(api.channel_id, ''), NULLIF(bo.channel_id, ''), NULLIF(cm.channel_id, ''))
), outcomes AS (
    SELECT period, type,
           COUNT(*) FILTER (WHERE status = 'succeeded') AS succeeded,
           COUNT(*) FILTER (WHERE status = 'failed') AS failed,
           COUNT(DISTINCT user_id) FILTER (WHERE status = 'failed') AS users_with_failure
    FROM details GROUP BY 1, 2
), failure_groups AS (
    SELECT period, type, diagnostic, api_result_bucket,
           channel, model, channel_currently_enabled,
           COUNT(*) AS tasks, COUNT(DISTINCT user_id) AS users, MAX(created_at)::date AS most_recent_day
    FROM details WHERE status = 'failed'
    GROUP BY 1, 2, 3, 4, 5, 6, 7
), channel_outcomes AS (
    SELECT period, type, channel, model,
           COUNT(*) FILTER (WHERE status = 'succeeded') AS succeeded,
           COUNT(*) FILTER (WHERE status = 'failed') AS failed
    FROM details GROUP BY 1, 2, 3, 4
), recent AS (
    SELECT type, COUNT(*) FILTER (WHERE status = 'succeeded') AS succeeded,
           COUNT(*) FILTER (WHERE status = 'failed') AS failed,
           COUNT(DISTINCT user_id) FILTER (WHERE status = 'failed') AS users_with_failure
    FROM details WHERE created_at >= statement_timestamp() - interval '90 minutes' GROUP BY type
), edit_ultra_configuration AS (
    SELECT COUNT(*) FILTER (WHERE mc.enabled AND cm.enabled AND p.enabled) AS enabled_price_tiers,
           COUNT(*) FILTER (WHERE mc.enabled AND cm.enabled AND p.enabled
                            AND COALESCE(CASE WHEN pg_input_is_valid(p.selector_json, 'jsonb')
                                              THEN p.selector_json::jsonb->>'operation' END, '') <> 'image_to_image') AS enabled_without_edit_selector
    FROM channel_model_price_tiers p JOIN channel_models cm ON cm.id = p.channel_model_id
    JOIN model_channels mc ON mc.id = cm.channel_id
    WHERE p.provider_model_key = 'rhart-image-n-pro-official/edit-ultra' AND mc.scope = 'system'
      AND p.deleted_at IS NULL AND cm.deleted_at IS NULL AND mc.deleted_at IS NULL
)
SELECT jsonb_build_object(
    'from', current_date - 28, 'as_of', statement_timestamp(), 'timezone', 'Asia/Taipei',
    'outcomes', (SELECT COALESCE(jsonb_agg(to_jsonb(o) ORDER BY o.period, o.type), '[]'::jsonb) FROM outcomes o),
    'created_last_90_minutes', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.type), '[]'::jsonb) FROM recent r),
    'runninghub_edit_ultra_configuration', (SELECT to_jsonb(c) FROM edit_ultra_configuration c),
    'channel_outcomes', (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.period, c.failed DESC, c.type, c.channel, c.model), '[]'::jsonb) FROM channel_outcomes c),
    'failure_groups', (SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY f.tasks DESC, f.period, f.type, f.channel, f.model), '[]'::jsonb) FROM failure_groups f)
);

ROLLBACK;
