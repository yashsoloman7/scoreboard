-- ============================================================================
-- COMPREHENSIVE SAFE PURGE OF DEMO & PRACTICE DATA
-- Deletes all dependent rows across all 25+ schema tables in reverse FK order
-- ============================================================================

DO $$
DECLARE
  demo_comp_ids UUID[];
  demo_cat_ids UUID[];
  demo_round_ids UUID[];
  demo_perf_ids UUID[];
  demo_crit_ver_ids UUID[];
  demo_sub_ids UUID[];
  demo_result_ids UUID[];
  demo_award_ids UUID[];
  demo_rule_ids UUID[];
  demo_team_ids UUID[];
  demo_part_ids UUID[];
BEGIN
  -- 1. Identify Demo Competition IDs
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO demo_comp_ids
  FROM public.competitions 
  WHERE environment = 'practice' 
     OR name ILIKE '%practice%' 
     OR name ILIKE '%demo%';

  -- 2. Identify Demo Category IDs
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO demo_cat_ids
  FROM public.categories 
  WHERE name ILIKE '%demo%' 
     OR name ILIKE '%practice%'
     OR competition_id = ANY(demo_comp_ids);

  -- 3. Identify Demo Criteria Versions & Rounds
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO demo_crit_ver_ids
  FROM public.criteria_versions
  WHERE category_id = ANY(demo_cat_ids);

  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO demo_round_ids
  FROM public.rounds
  WHERE category_id = ANY(demo_cat_ids);

  -- 4. Identify Demo Results, Rules, Awards
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO demo_result_ids
  FROM public.results
  WHERE category_id = ANY(demo_cat_ids) OR round_id = ANY(demo_round_ids);

  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO demo_rule_ids
  FROM public.tie_break_rules
  WHERE category_id = ANY(demo_cat_ids);

  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO demo_award_ids
  FROM public.awards
  WHERE competition_id = ANY(demo_comp_ids);

  -- 5. Identify Demo Participants & Teams
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO demo_part_ids
  FROM public.participants
  WHERE environment = 'practice' 
     OR participant_name ILIKE '%demo%' 
     OR team_name ILIKE '%demo%'
     OR church_name ILIKE '%demo%'
     OR competition_id = ANY(demo_comp_ids);

  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO demo_team_ids
  FROM public.teams
  WHERE environment = 'practice' 
     OR name ILIKE '%demo%' 
     OR competition_id = ANY(demo_comp_ids);

  -- 6. Identify Demo Performances
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO demo_perf_ids
  FROM public.performances
  WHERE round_id = ANY(demo_round_ids)
     OR participant_id = ANY(demo_part_ids)
     OR team_id = ANY(demo_team_ids);

  -- 7. Identify Demo Score Submissions
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO demo_sub_ids
  FROM public.score_submissions
  WHERE performance_id = ANY(demo_perf_ids)
     OR criteria_version_id = ANY(demo_crit_ver_ids);

  -- ===========================================================================
  -- PHASE 1: LEAF TABLES (ENTRIES, SESSIONS, TIMERS, TIE BREAKERS, SCORES)
  -- ===========================================================================
  DELETE FROM public.score_entries WHERE submission_id = ANY(demo_sub_ids);
  DELETE FROM public.score_history WHERE submission_id = ANY(demo_sub_ids);
  DELETE FROM public.result_entries 
  WHERE result_id = ANY(demo_result_ids) 
     OR performance_id = ANY(demo_perf_ids)
     OR participant_id = ANY(demo_part_ids)
     OR team_id = ANY(demo_team_ids);

  DELETE FROM public.award_winners
  WHERE award_id = ANY(demo_award_ids)
     OR participant_id = ANY(demo_part_ids)
     OR team_id = ANY(demo_team_ids);

  DELETE FROM public.tie_break_decisions
  WHERE rule_id = ANY(demo_rule_ids)
     OR result_id = ANY(demo_result_ids)
     OR performance_id = ANY(demo_perf_ids);

  DELETE FROM public.scores 
  WHERE event_id = ANY(demo_comp_ids) 
     OR participant_id = ANY(demo_part_ids);

  DELETE FROM public.timers 
  WHERE performance_id = ANY(demo_perf_ids) 
     OR competition_id = ANY(demo_comp_ids);

  DELETE FROM public.judge_sessions WHERE performance_id = ANY(demo_perf_ids);
  DELETE FROM public.judge_assignments 
  WHERE category_id = ANY(demo_cat_ids) 
     OR round_id = ANY(demo_round_ids);

  -- ===========================================================================
  -- PHASE 2: SUBMISSIONS, CRITERIA, PERFORMANCES, RESULTS & AWARDS
  -- ===========================================================================
  DELETE FROM public.score_submissions WHERE id = ANY(demo_sub_ids);
  DELETE FROM public.category_criteria WHERE criteria_version_id = ANY(demo_crit_ver_ids);
  DELETE FROM public.criteria_versions WHERE id = ANY(demo_crit_ver_ids);
  DELETE FROM public.results WHERE id = ANY(demo_result_ids);
  DELETE FROM public.tie_break_rules WHERE id = ANY(demo_rule_ids);
  DELETE FROM public.awards WHERE id = ANY(demo_award_ids);

  DELETE FROM public.performances WHERE id = ANY(demo_perf_ids);

  -- ===========================================================================
  -- PHASE 3: ROUNDS, TEAMS, TEAM MEMBERS, PARTICIPANTS, CATEGORIES
  -- ===========================================================================
  DELETE FROM public.team_members 
  WHERE team_id = ANY(demo_team_ids) 
     OR participant_id = ANY(demo_part_ids);

  DELETE FROM public.teams WHERE id = ANY(demo_team_ids);

  -- Clear active participant references in event_state before deleting participants
  UPDATE public.event_state 
  SET active_participant_id = NULL 
  WHERE active_participant_id = ANY(demo_part_ids) OR event_id = ANY(demo_comp_ids);

  DELETE FROM public.participants WHERE id = ANY(demo_part_ids);

  DELETE FROM public.rounds WHERE id = ANY(demo_round_ids);
  DELETE FROM public.categories WHERE id = ANY(demo_cat_ids);

  -- ===========================================================================
  -- PHASE 4: EVENT STATES, SETTINGS & COMPETITIONS
  -- ===========================================================================
  DELETE FROM public.event_state WHERE event_id = ANY(demo_comp_ids);
  DELETE FROM public.competition_state WHERE competition_id = ANY(demo_comp_ids);
  DELETE FROM public.competition_settings WHERE competition_id = ANY(demo_comp_ids);
  DELETE FROM public.competitions WHERE id = ANY(demo_comp_ids);

  RAISE NOTICE 'Complete cleanup of demo / practice sandbox data finished successfully.';
END $$;
