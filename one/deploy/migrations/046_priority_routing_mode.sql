-- 046_priority_routing_mode.sql
-- Persisted routing policies must accept the RunningHub-first priority strategy.
ALTER TABLE ai_studio.routing_policies
  DROP CONSTRAINT IF EXISTS routing_policies_routing_mode_check;

ALTER TABLE ai_studio.routing_policies
  ADD CONSTRAINT routing_policies_routing_mode_check
  CHECK (routing_mode IN ('cost', 'priority', 'quality', 'stability', 'balanced'));
