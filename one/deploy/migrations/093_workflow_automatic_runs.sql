ALTER TABLE ai_studio.one_workflow_runs
  ADD COLUMN automation_state TEXT NOT NULL DEFAULT 'manual'
    CHECK (automation_state IN ('manual','active','stopped','completed')),
  ADD COLUMN automation_quote_id UUID,
  ADD COLUMN automation_caps INTEGER[],
  ADD COLUMN automation_reason TEXT,
  ADD COLUMN automation_poll_at TIMESTAMPTZ,
  ADD CONSTRAINT one_workflow_auto_active_check CHECK (
    automation_state <> 'active'
    OR (automation_quote_id IS NOT NULL AND automation_caps IS NOT NULL AND automation_poll_at IS NOT NULL)
  );

CREATE INDEX one_workflow_active_poll_idx
  ON ai_studio.one_workflow_runs (automation_poll_at, id) WHERE automation_state = 'active';
CREATE INDEX one_workflow_active_definition_idx
  ON ai_studio.one_workflow_runs (workflow_id) WHERE automation_state = 'active';

CREATE TABLE ai_studio.one_workflow_auto_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES ai_studio.one_workflow_runs(id) ON DELETE CASCADE,
  start_step INTEGER NOT NULL CHECK (start_step BETWEEN 0 AND 5),
  step_caps INTEGER[] NOT NULL CHECK (cardinality(step_caps) BETWEEN 1 AND 6 AND 0 <= ALL (step_caps)),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX one_workflow_auto_quotes_expiration_idx
  ON ai_studio.one_workflow_auto_quotes (expires_at);
