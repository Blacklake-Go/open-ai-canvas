-- Make migration 036 safe for both known admin_notes layouts.
-- Fresh databases start with target_type/target_id/body/author_id from 001;
-- older manually-created databases may instead contain the legacy columns.
-- Add nullable legacy aliases only when absent so 036 can safely relax them
-- and backfill target-shaped columns without replacing existing values.

ALTER TABLE ops_bill.admin_notes
  ADD COLUMN IF NOT EXISTS user_id TEXT,
  ADD COLUMN IF NOT EXISTS admin_id TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT;
