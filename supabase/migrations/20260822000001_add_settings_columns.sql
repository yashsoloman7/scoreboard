-- supabase/migrations/20260822000001_add_settings_columns.sql
-- ============================================================================
-- ADDITIVE MIGRATION: Ensure competition_settings contains all required columns
-- Idempotent and non-breaking.
-- ============================================================================

ALTER TABLE IF EXISTS public.competition_settings
    ADD COLUMN IF NOT EXISTS publish_passcode TEXT,
    ADD COLUMN IF NOT EXISTS criteria_config JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS solo_duration_seconds INTEGER DEFAULT 240,
    ADD COLUMN IF NOT EXISTS duet_duration_seconds INTEGER DEFAULT 300,
    ADD COLUMN IF NOT EXISTS group_duration_seconds INTEGER DEFAULT 480,
    ADD COLUMN IF NOT EXISTS instruments_enabled BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS instrument_max_marks NUMERIC(7,2) DEFAULT 100.00;
