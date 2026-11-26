-- SupDance main-site growth baseline. Run with psql -XAt -v ON_ERROR_STOP=1.
-- Output is aggregate JSON. The transaction contains no application or browser IDs.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL TIME ZONE 'Asia/Taipei';

WITH bounds AS (
    SELECT current_date - 28 AS since, current_date AS until
), cohort AS (
    SELECT u.id, u.created_at
    FROM users u CROSS JOIN bounds b
    WHERE u.role = 'user' AND u.created_at >= b.since AND u.created_at < b.until
), attempts AS (
    SELECT c.id, t.type, t.status, t.completed_at
    FROM cohort c JOIN tasks t ON t.user_id = c.id CROSS JOIN bounds b
    WHERE t.type IN ('canvas_text', 'canvas_image', 'canvas_video', 'canvas_audio')
      AND t.created_at >= c.created_at AND t.created_at < b.until
), won AS (
    SELECT id, MIN(completed_at) AS first_at
    FROM attempts CROSS JOIN bounds b
    WHERE status = 'succeeded' AND completed_at < b.until
    GROUP BY id
), accounts AS (
    SELECT c.id, c.created_at, w.first_at,
           EXISTS (SELECT 1 FROM attempts a WHERE a.id = c.id) AS attempted,
           EXISTS (SELECT 1 FROM attempts a WHERE a.id = c.id AND a.status = 'succeeded'
                   AND a.completed_at >= date_trunc('day', w.first_at) + interval '1 day'
                   AND a.completed_at < date_trunc('day', w.first_at) + interval '8 days') AS returned
    FROM cohort c LEFT JOIN won w USING (id)
), traffic AS (
    SELECT COUNT(DISTINCT session_hash) FILTER (WHERE received_at_epoch >= extract(epoch FROM b.since)) AS sessions,
           COUNT(DISTINCT visitor_hash) FILTER (WHERE received_at_epoch >= extract(epoch FROM b.since)) AS visitors,
           to_timestamp(MIN(received_at_epoch))::date AS first_observed_day
    FROM site_traffic_events CROSS JOIN bounds b
    WHERE type = 'page_view' AND received_at_epoch < extract(epoch FROM b.until)
), activation AS (
    SELECT COUNT(*) AS registered, COUNT(*) FILTER (WHERE attempted) AS attempted,
           COUNT(*) FILTER (WHERE first_at IS NOT NULL) AS first_success,
           COUNT(*) FILTER (WHERE created_at <= b.until - 1) AS eligible_24h,
           COUNT(*) FILTER (WHERE created_at <= b.until - 1 AND first_at < created_at + interval '24 hours') AS activated_24h,
           COUNT(*) FILTER (WHERE created_at <= b.until - 7) AS eligible_7d,
           COUNT(*) FILTER (WHERE created_at <= b.until - 7 AND first_at < created_at + interval '7 days') AS activated_7d,
           COUNT(*) FILTER (WHERE first_at::date <= b.until - 8) AS eligible_return_1_to_7,
           COUNT(*) FILTER (WHERE first_at::date <= b.until - 8 AND returned) AS returned_1_to_7
    FROM accounts CROSS JOIN bounds b
), activation_by_signup_week AS (
    SELECT date_trunc('week', created_at)::date AS week_of,
           COUNT(*) AS registered, COUNT(*) FILTER (WHERE attempted) AS attempted,
           COUNT(*) FILTER (WHERE created_at <= b.until - 1) AS eligible_24h,
           COUNT(*) FILTER (WHERE created_at <= b.until - 1 AND first_at < created_at + interval '24 hours') AS activated_24h,
           COUNT(*) FILTER (WHERE created_at <= b.until - 7) AS eligible_7d,
           COUNT(*) FILTER (WHERE created_at <= b.until - 7 AND first_at < created_at + interval '7 days') AS activated_7d
    FROM accounts CROSS JOIN bounds b
    GROUP BY 1
), activation_by_signup_day AS (
    SELECT d.signup_day::date AS signup_day,
           COUNT(a.id) AS registered,
           COUNT(a.id) FILTER (WHERE a.attempted) AS attempted,
           COUNT(a.id) FILTER (WHERE a.first_at IS NOT NULL) AS first_success,
           COUNT(a.id) FILTER (WHERE a.created_at <= b.until - 1) AS eligible_24h,
           COUNT(a.id) FILTER (WHERE a.created_at <= b.until - 1 AND a.first_at < a.created_at + interval '24 hours') AS activated_24h
    FROM bounds b CROSS JOIN LATERAL generate_series(b.until - 7, b.until - 1, interval '1 day') AS d(signup_day)
    LEFT JOIN accounts a ON a.created_at >= d.signup_day AND a.created_at < d.signup_day + interval '1 day'
    GROUP BY 1
), task_outcomes AS (
    SELECT t.type, COUNT(*) FILTER (WHERE t.status = 'succeeded') AS succeeded,
           COUNT(*) FILTER (WHERE t.status = 'failed') AS failed
    FROM tasks t CROSS JOIN bounds b
    WHERE t.type IN ('canvas_text', 'canvas_image', 'canvas_video', 'canvas_audio')
      AND t.created_at >= b.since AND t.created_at < b.until
    GROUP BY t.type
), partial_today AS (
    SELECT COUNT(*) AS registered, COUNT(*) FILTER (WHERE creative.attempted) AS attempted,
           COUNT(*) FILTER (WHERE creative.succeeded) AS succeeded
    FROM users u
    CROSS JOIN LATERAL (
        SELECT COUNT(*) > 0 AS attempted,
               COUNT(*) FILTER (WHERE status = 'succeeded' AND completed_at < statement_timestamp()) > 0 AS succeeded
        FROM tasks t
        WHERE t.user_id = u.id AND t.created_at >= u.created_at AND t.created_at < statement_timestamp()
          AND t.type IN ('canvas_text', 'canvas_image', 'canvas_video', 'canvas_audio')
    ) creative
    WHERE u.role = 'user' AND u.created_at >= current_date AND u.created_at < statement_timestamp()
)
SELECT jsonb_build_object(
    'period', jsonb_build_object('from', b.since, 'to_exclusive', b.until, 'timezone', 'Asia/Taipei'),
    'traffic', to_jsonb(traffic), 'new_account_activation', to_jsonb(activation),
    'activation_by_signup_week', (SELECT COALESCE(jsonb_agg(to_jsonb(w) ORDER BY w.week_of), '[]'::jsonb) FROM activation_by_signup_week w),
    'activation_by_signup_day', (SELECT jsonb_agg(to_jsonb(d) ORDER BY d.signup_day) FROM activation_by_signup_day d),
    'today_partial', jsonb_build_object('date', current_date, 'as_of', statement_timestamp()) || to_jsonb(partial_today),
    'task_outcomes_all_roles', (SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.type), '[]'::jsonb) FROM task_outcomes t)
)
FROM bounds b CROSS JOIN traffic CROSS JOIN activation CROSS JOIN partial_today;

ROLLBACK;
