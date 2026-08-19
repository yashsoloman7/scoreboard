-- supabase/migrations/20260819000003_stored_procedures.sql
-- Server-Authoritative Stored Procedures (RPCs) & Integrity Triggers

-- 1. TRIGGER: Prevent modifying LOCKED scores directly
CREATE OR REPLACE FUNCTION public.check_score_submission_lock()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status = 'locked' AND NEW.status != 'reopened') THEN
        RAISE EXCEPTION 'This score submission is locked and cannot be modified directly. An administrator must reopen it.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_locked_scores ON public.score_submissions;
CREATE TRIGGER trg_protect_locked_scores
    BEFORE UPDATE ON public.score_submissions
    FOR EACH ROW
    EXECUTE FUNCTION public.check_score_submission_lock();


-- 2. RPC: submit_judge_score (Atomic Transaction)
CREATE OR REPLACE FUNCTION public.submit_judge_score(
    p_performance_id UUID,
    p_criteria_version_id UUID,
    p_idempotency_key UUID,
    p_entries JSONB, -- Array of { "criterionId": "...", "rawScore": 9.5, "notes": "..." }
    p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_judge_id UUID;
    v_category_id UUID;
    v_round_id UUID;
    v_submission_id UUID;
    v_existing_status score_status_enum;
    v_entry RECORD;
    v_max_marks NUMERIC;
    v_weight NUMERIC;
    v_raw_score NUMERIC;
    v_weighted_score NUMERIC;
    v_total_raw NUMERIC := 0.00;
    v_total_weighted NUMERIC := 0.00;
BEGIN
    v_judge_id := auth.uid();
    IF v_judge_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User is not authenticated';
    END IF;

    -- Look up performance and category
    SELECT r.category_id, p.round_id INTO v_category_id, v_round_id
    FROM public.performances p
    JOIN public.rounds r ON r.id = p.round_id
    WHERE p.id = p_performance_id;

    IF v_category_id IS NULL THEN
        RAISE EXCEPTION 'Invalid performance ID';
    END IF;

    -- Verify judge assignment
    IF NOT EXISTS (
        SELECT 1 FROM public.judge_assignments 
        WHERE category_id = v_category_id AND judge_id = v_judge_id AND is_active = true
    ) AND public.get_auth_role() NOT IN ('super_admin', 'admin') THEN
        RAISE EXCEPTION 'Judge is not assigned to this category';
    END IF;

    -- Check existing submission state
    SELECT id, status INTO v_submission_id, v_existing_status
    FROM public.score_submissions
    WHERE performance_id = p_performance_id AND judge_id = v_judge_id;

    IF v_existing_status = 'locked' THEN
        -- If already locked with same idempotency key, return success idempotently
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Score is already submitted and locked (Idempotent)',
            'submission_id', v_submission_id,
            'status', 'locked'
        );
    END IF;

    -- Create or update submission record
    IF v_submission_id IS NULL THEN
        INSERT INTO public.score_submissions (
            performance_id, judge_id, criteria_version_id, status, idempotency_key, device_fingerprint, submitted_at, locked_at
        ) VALUES (
            p_performance_id, v_judge_id, p_criteria_version_id, 'locked', p_idempotency_key, p_device_fingerprint, NOW(), NOW()
        ) RETURNING id INTO v_submission_id;
    ELSE
        UPDATE public.score_submissions SET
            criteria_version_id = p_criteria_version_id,
            status = 'locked',
            idempotency_key = p_idempotency_key,
            device_fingerprint = p_device_fingerprint,
            submitted_at = NOW(),
            locked_at = NOW(),
            updated_at = NOW()
        WHERE id = v_submission_id;
    END IF;

    -- Insert / Replace Score Entries
    FOR v_entry IN SELECT * FROM jsonb_to_recordset(p_entries) AS x(
        "criterionId" UUID, "rawScore" NUMERIC, "notes" TEXT
    ) LOOP
        -- Validate against criteria table
        SELECT max_marks, weight INTO v_max_marks, v_weight
        FROM public.category_criteria
        WHERE id = v_entry."criterionId" AND criteria_version_id = p_criteria_version_id;

        IF v_max_marks IS NULL THEN
            RAISE EXCEPTION 'Criterion % does not exist in version %', v_entry."criterionId", p_criteria_version_id;
        END IF;

        IF v_entry."rawScore" < 0 OR v_entry."rawScore" > v_max_marks THEN
            RAISE EXCEPTION 'Score % exceeds valid range [0, %]', v_entry."rawScore", v_max_marks;
        END IF;

        v_raw_score := v_entry."rawScore";
        v_weighted_score := (v_raw_score / v_max_marks) * v_weight;

        v_total_raw := v_total_raw + v_raw_score;
        v_total_weighted := v_total_weighted + v_weighted_score;

        INSERT INTO public.score_entries (
            submission_id, criterion_id, raw_score, weighted_score, notes, updated_at
        ) VALUES (
            v_submission_id, v_entry."criterionId", v_raw_score, v_weighted_score, v_entry."notes", NOW()
        )
        ON CONFLICT (submission_id, criterion_id) DO UPDATE SET
            raw_score = EXCLUDED.raw_score,
            weighted_score = EXCLUDED.weighted_score,
            notes = EXCLUDED.notes,
            updated_at = NOW();
    END LOOP;

    -- Update totals
    UPDATE public.score_submissions SET
        total_raw_score = v_total_raw,
        total_weighted_score = v_total_weighted
    WHERE id = v_submission_id;

    -- Audit log entry
    INSERT INTO public.audit_logs (
        actor_id, action, entity, entity_id, new_state, created_at
    ) VALUES (
        v_judge_id, 'SCORE_SUBMITTED_AND_LOCKED', 'score_submissions', v_submission_id,
        jsonb_build_object('raw_total', v_total_raw, 'weighted_total', v_total_weighted, 'performance_id', p_performance_id),
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_submission_id,
        'status', 'locked',
        'raw_total', v_total_raw,
        'weighted_total', v_total_weighted
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. RPC: reopen_judge_score (Admin-Only with Mandatory Audit)
CREATE OR REPLACE FUNCTION public.reopen_judge_score(
    p_submission_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID;
    v_sub RECORD;
    v_entries_snapshot JSONB;
BEGIN
    v_admin_id := auth.uid();
    IF public.get_auth_role() NOT IN ('super_admin', 'admin') THEN
        RAISE EXCEPTION 'Unauthorized: Only Administrators can reopen a locked score';
    END IF;

    IF LENGTH(TRIM(p_reason)) < 10 THEN
        RAISE EXCEPTION 'A detailed reason (min 10 chars) is mandatory for reopening a score';
    END IF;

    SELECT * INTO v_sub FROM public.score_submissions WHERE id = p_submission_id;
    IF v_sub.id IS NULL THEN
        RAISE EXCEPTION 'Score submission not found';
    END IF;

    -- Snapshot current score entries
    SELECT jsonb_object_agg(criterion_id::text, raw_score) INTO v_entries_snapshot
    FROM public.score_entries
    WHERE submission_id = p_submission_id;

    -- Record history
    INSERT INTO public.score_history (
        submission_id, reopened_by, reopen_reason, previous_raw_total, previous_weighted_total, previous_scores_snapshot, reopened_at
    ) VALUES (
        p_submission_id, v_admin_id, p_reason, v_sub.total_raw_score, v_sub.total_weighted_score, COALESCE(v_entries_snapshot, '{}'::jsonb), NOW()
    );

    -- Transition status to reopened
    UPDATE public.score_submissions SET
        status = 'reopened',
        locked_at = NULL,
        updated_at = NOW()
    WHERE id = p_submission_id;

    -- Audit log
    INSERT INTO public.audit_logs (
        actor_id, action, entity, entity_id, old_state, new_state, reason, created_at
    ) VALUES (
        v_admin_id, 'SCORE_REOPENED', 'score_submissions', p_submission_id,
        jsonb_build_object('status', v_sub.status, 'raw_total', v_sub.total_raw_score),
        jsonb_build_object('status', 'reopened'),
        p_reason,
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'submission_id', p_submission_id, 'status', 'reopened');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. RPC: control_timer_event (Authoritative Live Clock State)
CREATE OR REPLACE FUNCTION public.control_timer_event(
    p_performance_id UUID,
    p_action TEXT, -- 'start', 'pause', 'resume', 'stop', 'reset', 'update_duration'
    p_duration_seconds INTEGER DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_timer RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_accumulated NUMERIC := 0.000;
    v_new_status timer_status_enum;
BEGIN
    v_user_id := auth.uid();
    IF public.get_auth_role() NOT IN ('super_admin', 'admin', 'event_operator') THEN
        RAISE EXCEPTION 'Unauthorized to control live timer';
    END IF;

    -- Ensure timer record exists
    SELECT * INTO v_timer FROM public.timers WHERE performance_id = p_performance_id;
    IF v_timer.id IS NULL THEN
        INSERT INTO public.timers (performance_id, configured_duration_seconds, status)
        VALUES (p_performance_id, COALESCE(p_duration_seconds, 300), 'idle')
        RETURNING * INTO v_timer;
    END IF;

    IF p_action = 'start' THEN
        UPDATE public.timers SET
            status = 'running',
            started_at = v_now,
            paused_at = NULL,
            accumulated_duration_seconds = 0.000,
            last_updated_by = v_user_id,
            updated_at = v_now
        WHERE performance_id = p_performance_id;
        v_new_status := 'running';

    ELSIF p_action = 'pause' THEN
        IF v_timer.status = 'running' THEN
            v_accumulated := v_timer.accumulated_duration_seconds + EXTRACT(EPOCH FROM (v_now - v_timer.started_at));
        ELSE
            v_accumulated := v_timer.accumulated_duration_seconds;
        END IF;

        UPDATE public.timers SET
            status = 'paused',
            paused_at = v_now,
            accumulated_duration_seconds = v_accumulated,
            last_updated_by = v_user_id,
            updated_at = v_now
        WHERE performance_id = p_performance_id;
        v_new_status := 'paused';

    ELSIF p_action = 'resume' THEN
        UPDATE public.timers SET
            status = 'running',
            started_at = v_now,
            paused_at = NULL,
            last_updated_by = v_user_id,
            updated_at = v_now
        WHERE performance_id = p_performance_id;
        v_new_status := 'running';

    ELSIF p_action = 'stop' THEN
        IF v_timer.status = 'running' THEN
            v_accumulated := v_timer.accumulated_duration_seconds + EXTRACT(EPOCH FROM (v_now - v_timer.started_at));
        ELSE
            v_accumulated := v_timer.accumulated_duration_seconds;
        END IF;

        UPDATE public.timers SET
            status = 'stopped',
            paused_at = v_now,
            accumulated_duration_seconds = v_accumulated,
            overtime_seconds = GREATEST(0, v_accumulated - v_timer.configured_duration_seconds),
            last_updated_by = v_user_id,
            updated_at = v_now
        WHERE performance_id = p_performance_id;
        v_new_status := 'stopped';

    ELSIF p_action = 'reset' THEN
        UPDATE public.timers SET
            status = 'idle',
            started_at = NULL,
            paused_at = NULL,
            accumulated_duration_seconds = 0.000,
            overtime_seconds = 0.000,
            last_updated_by = v_user_id,
            updated_at = v_now
        WHERE performance_id = p_performance_id;
        v_new_status := 'idle';

    ELSIF p_action = 'update_duration' AND p_duration_seconds IS NOT NULL THEN
        UPDATE public.timers SET
            configured_duration_seconds = p_duration_seconds,
            last_updated_by = v_user_id,
            updated_at = v_now
        WHERE performance_id = p_performance_id;
        v_new_status := v_timer.status;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'performance_id', p_performance_id,
        'status', v_new_status,
        'server_timestamp', v_now
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
