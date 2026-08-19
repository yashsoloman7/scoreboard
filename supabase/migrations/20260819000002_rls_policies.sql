-- supabase/migrations/20260819000002_rls_policies.sql
-- Production Row Level Security (RLS) Policies

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.criteria_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judge_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.judge_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.result_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tie_break_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tie_break_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.award_winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

-- Helper security function: Check user role
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS app_role_enum AS $$
DECLARE
    v_role app_role_enum;
BEGIN
    SELECT role INTO v_role 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    ORDER BY created_at DESC 
    LIMIT 1;

    RETURN COALESCE(v_role, 'unauthorized'::app_role_enum);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (public.get_auth_role() IN ('super_admin', 'admin', 'event_operator'));

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 2. User Roles Policies
CREATE POLICY "Admins can manage user roles" ON public.user_roles
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Users can view own role" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- 3. Competitions Policies
CREATE POLICY "Public and Judges can view active competitions" ON public.competitions
    FOR SELECT USING (status IN ('active', 'completed') OR public.get_auth_role() IN ('super_admin', 'admin', 'event_operator'));

CREATE POLICY "Admins can manage competitions" ON public.competitions
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin'));

-- 4. Categories & Rounds
CREATE POLICY "Authenticated users can view categories" ON public.categories
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage categories" ON public.categories
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Authenticated users can view rounds" ON public.rounds
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage rounds" ON public.rounds
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin'));

-- 5. Criteria Versions & Criteria
CREATE POLICY "Authenticated users can view criteria" ON public.category_criteria
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can view criteria versions" ON public.criteria_versions
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage criteria" ON public.category_criteria
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Admins can manage criteria versions" ON public.criteria_versions
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin'));

-- 6. Participants & Teams
CREATE POLICY "Authenticated users can view participants" ON public.participants
    FOR SELECT USING (true);

CREATE POLICY "Admins and Operators can manage participants" ON public.participants
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin', 'event_operator'));

CREATE POLICY "Authenticated users can view teams" ON public.teams
    FOR SELECT USING (true);

CREATE POLICY "Admins and Operators can manage teams" ON public.teams
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin', 'event_operator'));

CREATE POLICY "Authenticated users can view team members" ON public.team_members
    FOR SELECT USING (true);

CREATE POLICY "Admins and Operators can manage team members" ON public.team_members
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin', 'event_operator'));

-- 7. Performances
CREATE POLICY "Authenticated users can view performances" ON public.performances
    FOR SELECT USING (true);

CREATE POLICY "Admins and Operators can manage performances" ON public.performances
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin', 'event_operator'));

-- 8. Judge Assignments & Sessions
CREATE POLICY "Judges can view own assignments" ON public.judge_assignments
    FOR SELECT USING (auth.uid() = judge_id OR public.get_auth_role() IN ('super_admin', 'admin', 'event_operator'));

CREATE POLICY "Admins can manage judge assignments" ON public.judge_assignments
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Judges can manage own sessions" ON public.judge_sessions
    FOR ALL USING (auth.uid() = judge_id OR public.get_auth_role() IN ('super_admin', 'admin'));

-- 9. Score Submissions & Score Entries
CREATE POLICY "Judges can view own score submissions" ON public.score_submissions
    FOR SELECT USING (auth.uid() = judge_id OR public.get_auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Judges can insert own score submissions" ON public.score_submissions
    FOR INSERT WITH CHECK (
        auth.uid() = judge_id AND 
        public.get_auth_role() IN ('judge', 'super_admin', 'admin')
    );

CREATE POLICY "Judges can update own DRAFT submissions" ON public.score_submissions
    FOR UPDATE USING (
        auth.uid() = judge_id AND 
        status IN ('draft', 'reopened')
    );

CREATE POLICY "Admins can manage score submissions" ON public.score_submissions
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Judges can manage own score entries" ON public.score_entries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.score_submissions sub 
            WHERE sub.id = submission_id AND (sub.judge_id = auth.uid() OR public.get_auth_role() IN ('super_admin', 'admin'))
        )
    );

CREATE POLICY "Admins can view score history" ON public.score_history
    FOR SELECT USING (public.get_auth_role() IN ('super_admin', 'admin'));

-- 10. Timers & Live State
CREATE POLICY "Anyone can view live timers" ON public.timers
    FOR SELECT USING (true);

CREATE POLICY "Operators and Admins can manage timers" ON public.timers
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin', 'event_operator'));

CREATE POLICY "Anyone can view competition state" ON public.competition_state
    FOR SELECT USING (true);

CREATE POLICY "Operators and Admins can manage competition state" ON public.competition_state
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin', 'event_operator'));

-- 11. Results & Tie Breakers
CREATE POLICY "Published results are public, drafts are admin only" ON public.results
    FOR SELECT USING (status = 'published' OR public.get_auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Admins can manage results" ON public.results
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Published result entries are public" ON public.result_entries
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.results r WHERE r.id = result_id AND (r.status = 'published' OR public.get_auth_role() IN ('super_admin', 'admin')))
    );

CREATE POLICY "Admins can manage result entries" ON public.result_entries
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin'));

-- 12. Awards & Audit Logs
CREATE POLICY "Awards are public" ON public.awards
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage awards" ON public.awards
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Award winners are public" ON public.award_winners
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage award winners" ON public.award_winners
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT USING (public.get_auth_role() IN ('super_admin', 'admin'));

CREATE POLICY "Admins can view backups" ON public.backups
    FOR ALL USING (public.get_auth_role() IN ('super_admin', 'admin'));
