-- Historical route 074 references a catalogue model previously imported only in production.
-- New databases need its identity for the foreign key. This placeholder is deliberately
-- unpublished and carries no claimed capabilities, credentials or selling price.
-- Existing installations keep their reviewed model and configuration unchanged.
INSERT INTO ai_studio.ai_models
  (id, slug, name, display_name, category, status, tier, is_visible, auto_route_eligible)
VALUES
  ('seedance-2.0', 'seedance-2.0', 'Seedance 2.0', 'Seedance 2.0', 'video', 'disabled', 'experimental', FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;
