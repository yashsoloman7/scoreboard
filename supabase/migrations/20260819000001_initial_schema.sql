-- supabase/migrations/20260819000001_initial_schema.sql
-- Complete PostgreSQL Schema DDL for State-Level Music Competition Platform

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
DO $$ BEGIN
    CREATE TYPE app_role_enum AS ENUM ('super_admin', 'admin', 'event_operator', 'judge', 'unauthorized');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE competition_status_enum AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE performer_type_enum AS ENUM ('solo', 'duet', 'group');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE performance_status_enum AS ENUM ('scheduled', 'on_deck', 'performing', 'scoring', 'completed', 'disqualified', 'no_show');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE score_status_enum AS ENUM ('draft', 'submitted', 'locked', 'reopened');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE timer_status_enum AS ENUM ('idle', 'running', 'paused', 'stopped', 'overtime');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE result_status_enum AS ENUM ('draft', 'under_review', 'approved', 'published');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE environment_mode_enum AS ENUM ('live', 'practice');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. USERS & RBAC
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role app_role_enum NOT NULL DEFAULT 'unauthorized',
    granted_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_role UNIQUE(user_id, role)
);

-- 2. COMPETITIONS & SETTINGS
CREATE TABLE IF NOT EXISTS public.competitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    venue TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status competition_status_enum NOT NULL DEFAULT 'draft',
    environment environment_mode_enum NOT NULL DEFAULT 'live',
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.competition_settings (
    competition_id UUID PRIMARY KEY REFERENCES public.competitions(id) ON DELETE CASCADE,
    allow_multiple_judge_devices BOOLEAN NOT NULL DEFAULT false,
    require_admin_device_approval BOOLEAN NOT NULL DEFAULT true,
    auto_lock_score_on_submit BOOLEAN NOT NULL DEFAULT true,
    default_timer_duration_seconds INTEGER NOT NULL DEFAULT 300,
    warning_threshold_seconds INTEGER NOT NULL DEFAULT 30,
    allow_practice_mode BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CATEGORIES & ROUNDS
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    performer_type performer_type_enum NOT NULL DEFAULT 'solo',
    display_order INTEGER NOT NULL DEFAULT 0,
    scoring_formula TEXT NOT NULL DEFAULT 'weighted_sum',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_competition_category_order UNIQUE(competition_id, display_order)
);

CREATE TABLE IF NOT EXISTS public.rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL DEFAULT 'Preliminary Round',
    is_final BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_round UNIQUE(category_id, round_number)
);

-- 4. CRITERIA & VERSIONING
CREATE TABLE IF NOT EXISTS public.criteria_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    locked_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_version UNIQUE(category_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.category_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    criteria_version_id UUID NOT NULL REFERENCES public.criteria_versions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    max_marks NUMERIC(5,2) NOT NULL CHECK (max_marks > 0),
    weight NUMERIC(5,2) NOT NULL DEFAULT 1.0 CHECK (weight > 0),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_version_criteria_order UNIQUE(criteria_version_id, display_order)
);

-- 5. PARTICIPANTS, TEAMS & MEMBERS
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    participant_code TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    institution TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    environment environment_mode_enum NOT NULL DEFAULT 'live',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_comp_participant_code UNIQUE(competition_id, participant_code, environment)
);

CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    team_code TEXT NOT NULL,
    name TEXT NOT NULL,
    institution TEXT,
    environment environment_mode_enum NOT NULL DEFAULT 'live',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_comp_team_code UNIQUE(competition_id, team_code, environment)
);

CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
    role_in_team TEXT DEFAULT 'Member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_team_participant UNIQUE(team_id, participant_id)
);

-- 6. PERFORMANCES & SCHEDULE
CREATE TABLE IF NOT EXISTS public.performances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
    participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    performance_order INTEGER NOT NULL,
    performance_code TEXT NOT NULL,
    status performance_status_enum NOT NULL DEFAULT 'scheduled',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_performance_target CHECK (
        (participant_id IS NOT NULL AND team_id IS NULL) OR 
        (participant_id IS NULL AND team_id IS NOT NULL)
    ),
    CONSTRAINT uq_round_performance_order UNIQUE(round_id, performance_order)
);

-- 7. JUDGE ASSIGNMENTS & SESSIONS
CREATE TABLE IF NOT EXISTS public.judge_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    judge_seat_number INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_judge UNIQUE(category_id, judge_id),
    CONSTRAINT uq_category_seat UNIQUE(category_id, judge_seat_number)
);

CREATE TABLE IF NOT EXISTS public.judge_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    judge_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT,
    ip_address INET,
    is_approved BOOLEAN NOT NULL DEFAULT false,
    approved_by UUID REFERENCES public.profiles(id),
    last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_judge_device UNIQUE(judge_id, competition_id, device_id)
);

-- 8. SCORE SUBMISSIONS, ENTRIES & AUDIT HISTORY
CREATE TABLE IF NOT EXISTS public.score_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    performance_id UUID NOT NULL REFERENCES public.performances(id) ON DELETE RESTRICT,
    judge_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    criteria_version_id UUID NOT NULL REFERENCES public.criteria_versions(id) ON DELETE RESTRICT,
    status score_status_enum NOT NULL DEFAULT 'draft',
    idempotency_key UUID NOT NULL DEFAULT uuid_generate_v4(),
    total_raw_score NUMERIC(7,2) NOT NULL DEFAULT 0.00,
    total_weighted_score NUMERIC(7,2) NOT NULL DEFAULT 0.00,
    submitted_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    device_fingerprint TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_performance_judge_submission UNIQUE(performance_id, judge_id, criteria_version_id)
);

CREATE TABLE IF NOT EXISTS public.score_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES public.score_submissions(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES public.category_criteria(id) ON DELETE RESTRICT,
    raw_score NUMERIC(5,2) NOT NULL CHECK (raw_score >= 0),
    weighted_score NUMERIC(5,2) NOT NULL CHECK (weighted_score >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_submission_criterion UNIQUE(submission_id, criterion_id)
);

CREATE TABLE IF NOT EXISTS public.score_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES public.score_submissions(id) ON DELETE CASCADE,
    reopened_by UUID NOT NULL REFERENCES public.profiles(id),
    reopen_reason TEXT NOT NULL,
    previous_raw_total NUMERIC(7,2) NOT NULL,
    previous_weighted_total NUMERIC(7,2) NOT NULL,
    previous_scores_snapshot JSONB NOT NULL,
    reopened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resubmitted_at TIMESTAMPTZ
);

-- 9. TIMERS & COMPETITION STATE
CREATE TABLE IF NOT EXISTS public.timers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    performance_id UUID UNIQUE NOT NULL REFERENCES public.performances(id) ON DELETE CASCADE,
    status timer_status_enum NOT NULL DEFAULT 'idle',
    configured_duration_seconds INTEGER NOT NULL DEFAULT 300,
    warning_threshold_seconds INTEGER NOT NULL DEFAULT 30,
    started_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    accumulated_duration_seconds NUMERIC(8,3) NOT NULL DEFAULT 0.000,
    overtime_seconds NUMERIC(8,3) NOT NULL DEFAULT 0.000,
    last_updated_by UUID REFERENCES public.profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.competition_state (
    competition_id UUID PRIMARY KEY REFERENCES public.competitions(id) ON DELETE CASCADE,
    active_category_id UUID REFERENCES public.categories(id),
    active_round_id UUID REFERENCES public.rounds(id),
    active_performance_id UUID REFERENCES public.performances(id),
    is_live_active BOOLEAN NOT NULL DEFAULT false,
    updated_by UUID REFERENCES public.profiles(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. RESULTS & TIE-BREAKS
CREATE TABLE IF NOT EXISTS public.results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
    status result_status_enum NOT NULL DEFAULT 'draft',
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_round_result UNIQUE(category_id, round_id)
);

CREATE TABLE IF NOT EXISTS public.result_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_id UUID NOT NULL REFERENCES public.results(id) ON DELETE CASCADE,
    performance_id UUID NOT NULL REFERENCES public.performances(id) ON DELETE RESTRICT,
    rank INTEGER NOT NULL,
    final_score NUMERIC(7,3) NOT NULL,
    judge_count INTEGER NOT NULL,
    raw_average NUMERIC(7,3) NOT NULL,
    standard_deviation NUMERIC(7,3) NOT NULL DEFAULT 0.000,
    breakdown_json JSONB NOT NULL,
    is_tie BOOLEAN NOT NULL DEFAULT false,
    tie_resolution_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_result_performance UNIQUE(result_id, performance_id)
);

CREATE TABLE IF NOT EXISTS public.tie_break_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    priority_order INTEGER NOT NULL DEFAULT 1,
    rule_type TEXT NOT NULL,
    target_criterion_id UUID REFERENCES public.category_criteria(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_tie_priority UNIQUE(category_id, priority_order)
);

CREATE TABLE IF NOT EXISTS public.tie_break_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_entry_id UUID NOT NULL REFERENCES public.result_entries(id) ON DELETE CASCADE,
    decided_by UUID NOT NULL REFERENCES public.profiles(id),
    reason TEXT NOT NULL,
    jury_signatories TEXT[],
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. AWARDS
CREATE TABLE IF NOT EXISTS public.awards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    categoryId UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_comp_award_code UNIQUE(competition_id, code)
);

CREATE TABLE IF NOT EXISTS public.award_winners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    award_id UUID NOT NULL REFERENCES public.awards(id) ON DELETE CASCADE,
    performance_id UUID REFERENCES public.performances(id) ON DELETE RESTRICT,
    participant_id UUID REFERENCES public.participants(id) ON DELETE RESTRICT,
    team_id UUID REFERENCES public.teams(id) ON DELETE RESTRICT,
    is_override BOOLEAN NOT NULL DEFAULT false,
    override_reason TEXT,
    overridden_by UUID REFERENCES public.profiles(id),
    awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_award_winner UNIQUE(award_id, performance_id)
);

-- 12. AUDIT LOGS & SNAPSHOT BACKUPS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID REFERENCES public.competitions(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id UUID NOT NULL,
    old_state JSONB,
    new_state JSONB,
    reason TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.backups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    trigger_event TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256_checksum TEXT NOT NULL,
    metadata JSONB NOT NULL,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HIGH PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_perf_round ON public.performances(round_id, performance_order);
CREATE INDEX IF NOT EXISTS idx_perf_status ON public.performances(status);
CREATE INDEX IF NOT EXISTS idx_score_sub_perf ON public.score_submissions(performance_id, status);
CREATE INDEX IF NOT EXISTS idx_score_sub_judge ON public.score_submissions(judge_id);
CREATE INDEX IF NOT EXISTS idx_audit_comp_entity ON public.audit_logs(competition_id, entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_judge_assign_cat ON public.judge_assignments(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_judge_sessions_hb ON public.judge_sessions(judge_id, last_heartbeat);
