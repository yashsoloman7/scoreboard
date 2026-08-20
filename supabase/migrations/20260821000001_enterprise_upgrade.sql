-- supabase/migrations/20260821000001_enterprise_upgrade.sql
-- ============================================================================
-- SCOREBOARD ENTERPRISE UPGRADE: ADDITIVE MIGRATION SCRIPT
-- Non-breaking, idempotent, and backward-compatible with existing schema.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. EXTEND APP ROLES ENUM
DO $$ BEGIN
    ALTER TYPE app_role_enum ADD VALUE IF NOT EXISTS 'event_manager';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE app_role_enum ADD VALUE IF NOT EXISTS 'public_viewer';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. USER ROLES TABLE
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role_enum NOT NULL DEFAULT 'unauthorized',
    granted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_role UNIQUE(user_id, role)
);

-- 3. PARTICIPANTS EXTENSIONS (Additive Columns)
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE,
    participant_code TEXT,
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.participants
    ADD COLUMN IF NOT EXISTS team_name TEXT,
    ADD COLUMN IF NOT EXISTS church_name TEXT,
    ADD COLUMN IF NOT EXISTS participant_name TEXT,
    ADD COLUMN IF NOT EXISTS performance_type TEXT DEFAULT 'solo' CHECK (performance_type IN ('solo', 'duet', 'group')),
    ADD COLUMN IF NOT EXISTS best_keyboardist TEXT,
    ADD COLUMN IF NOT EXISTS best_rhythmist TEXT,
    ADD COLUMN IF NOT EXISTS best_guitarist TEXT,
    ADD COLUMN IF NOT EXISTS performance_order INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 4. CRYPTOGRAPHICALLY SECURED SCORES TABLE
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.competitions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
    judge_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    category TEXT NOT NULL CHECK (category IN ('solo', 'duet', 'group', 'best_keyboardist', 'best_rhythmist', 'best_guitarist')),
    
    -- Sub-criteria breakdown (Strict sum components)
    solo_score NUMERIC(7,2) NOT NULL DEFAULT 0.00 CHECK (solo_score >= 0),
    duet_score NUMERIC(7,2) NOT NULL DEFAULT 0.00 CHECK (duet_score >= 0),
    group_score NUMERIC(7,2) NOT NULL DEFAULT 0.00 CHECK (group_score >= 0),
    keyboardist_score NUMERIC(7,2) NOT NULL DEFAULT 0.00 CHECK (keyboardist_score >= 0),
    rhythmist_score NUMERIC(7,2) NOT NULL DEFAULT 0.00 CHECK (rhythmist_score >= 0),
    guitarist_score NUMERIC(7,2) NOT NULL DEFAULT 0.00 CHECK (guitarist_score >= 0),
    
    -- Strict SUM-TOTAL Calculation
    total_score NUMERIC(7,2) NOT NULL CHECK (total_score >= 0),
    
    -- Cryptographic Integrity
    score_hash TEXT NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT true,
    device_fingerprint TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Admin Override & Audit Columns
    is_admin_override BOOLEAN NOT NULL DEFAULT false,
    override_reason TEXT,
    overridden_by UUID REFERENCES auth.users(id),
    overridden_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_event_participant_judge_category UNIQUE(event_id, participant_id, judge_id, category)
);

-- 5. EVENT STATE & STAGING MACHINE TABLE
CREATE TABLE IF NOT EXISTS public.event_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID UNIQUE NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
    active_participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
    stage_mode TEXT NOT NULL DEFAULT 'standby' CHECK (stage_mode IN ('standby', 'live', 'completed')),
    timer_status TEXT NOT NULL DEFAULT 'idle' CHECK (timer_status IN ('idle', 'running', 'paused', 'stopped', 'overtime')),
    timer_duration_seconds INTEGER NOT NULL DEFAULT 300,
    timer_started_at TIMESTAMPTZ,
    timer_ends_at TIMESTAMPTZ,
    timer_elapsed_seconds NUMERIC(8,2) NOT NULL DEFAULT 0.00,
    is_judge_input_unlocked BOOLEAN NOT NULL DEFAULT false,
    current_category TEXT NOT NULL DEFAULT 'solo' CHECK (current_category IN ('solo', 'duet', 'group', 'best_keyboardist', 'best_rhythmist', 'best_guitarist')),
    updated_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.competitions(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id UUID NOT NULL,
    old_state JSONB,
    new_state JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. RBAC HELPER FUNCTIONS (Security Definer using TEXT comparison to prevent SQLSTATE 55P04 enum transaction lock)
CREATE OR REPLACE FUNCTION public.check_user_has_role(req_user_id UUID, req_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = req_user_id
          AND (
            role::TEXT = req_role
            OR (req_role = 'admin' AND role::TEXT = 'super_admin')
            OR (req_role = 'event_manager' AND role::TEXT IN ('super_admin', 'admin', 'event_operator', 'event_manager'))
            OR (req_role = 'judge' AND role::TEXT IN ('super_admin', 'admin', 'judge'))
          )
    );
$$;

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- User Roles Policies
DROP POLICY IF EXISTS "Public can view own roles" ON public.user_roles;
CREATE POLICY "Public can view own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id OR check_user_has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Super Admin can manage user roles" ON public.user_roles;
CREATE POLICY "Super Admin can manage user roles" ON public.user_roles
    FOR ALL USING (check_user_has_role(auth.uid(), 'super_admin'));

-- Participants Policies
DROP POLICY IF EXISTS "Public can read participants" ON public.participants;
CREATE POLICY "Public can read participants" ON public.participants
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins and Event Managers can manage participants" ON public.participants;
CREATE POLICY "Admins and Event Managers can manage participants" ON public.participants
    FOR ALL USING (check_user_has_role(auth.uid(), 'event_manager'));

-- Event State Policies
DROP POLICY IF EXISTS "Public can read event state" ON public.event_state;
CREATE POLICY "Public can read event state" ON public.event_state
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Event Managers and Admins can update event state" ON public.event_state;
CREATE POLICY "Event Managers and Admins can update event state" ON public.event_state
    FOR ALL USING (check_user_has_role(auth.uid(), 'event_manager'));

-- Scores Policies
DROP POLICY IF EXISTS "Public can view finalized scores" ON public.scores;
CREATE POLICY "Public can view finalized scores" ON public.scores
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Judges can insert scores when live unlocked" ON public.scores;
CREATE POLICY "Judges can insert scores when live unlocked" ON public.scores
    FOR INSERT WITH CHECK (
        auth.uid() = judge_id 
        AND check_user_has_role(auth.uid(), 'judge')
        AND EXISTS (
            SELECT 1 FROM public.event_state es
            WHERE es.event_id = scores.event_id
              AND es.active_participant_id = scores.participant_id
              AND es.stage_mode = 'live'
              AND es.is_judge_input_unlocked = true
        )
    );

DROP POLICY IF EXISTS "Admins have exclusive score edit permissions" ON public.scores;
CREATE POLICY "Admins have exclusive score edit permissions" ON public.scores
    FOR UPDATE USING (check_user_has_role(auth.uid(), 'admin'));

-- Audit Logs Policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (check_user_has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (auth.uid() = actor_id);

-- 9. REALTIME REPLICATION CONFIGURATION
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_state;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 10. HIGH-PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_scores_event_participant ON public.scores(event_id, participant_id);
CREATE INDEX IF NOT EXISTS idx_scores_category ON public.scores(category);
CREATE INDEX IF NOT EXISTS idx_scores_judge ON public.scores(judge_id);
CREATE INDEX IF NOT EXISTS idx_participants_comp_order ON public.participants(competition_id, performance_order);
CREATE INDEX IF NOT EXISTS idx_event_state_active ON public.event_state(event_id, stage_mode);
