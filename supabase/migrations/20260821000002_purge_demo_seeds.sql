-- ============================================================================
-- SAFE PURGE OF DEMO & PRACTICE SANDBOX SEED DATA
-- Respects all Postgres Foreign Key constraints in exact reverse dependency order
-- ============================================================================

DO $$
DECLARE
  demo_comp_ids UUID[];
  demo_cat_ids UUID[];
  demo_round_ids UUID[];
  demo_perf_ids UUID[];
  demo_crit_ver_ids UUID[];
  demo_sub_ids UUID[];
BEGIN
  -- 1. Identify Demo Competition IDs
  SELECT ARRAY_AGG(id) INTO demo_comp_ids
  FROM public.competitions 
  WHERE environment = 'practice' 
     OR name ILIKE '%practice%' 
     OR name ILIKE '%demo%';

  -- 2. Identify Demo Category IDs
  SELECT ARRAY_AGG(id) INTO demo_cat_ids
  FROM public.categories 
  WHERE name ILIKE '%demo%' 
     OR name ILIKE '%practice%'
     OR (demo_comp_ids IS NOT NULL AND competition_id = ANY(demo_comp_ids));

  -- 3. Identify Demo Criteria Version IDs
  SELECT ARRAY_AGG(id) INTO demo_crit_ver_ids
  FROM public.criteria_versions
  WHERE demo_cat_ids IS NOT NULL AND category_id = ANY(demo_cat_ids);

  -- 4. Identify Demo Rounds
  SELECT ARRAY_AGG(id) INTO demo_round_ids
  FROM public.rounds
  WHERE demo_cat_ids IS NOT NULL AND category_id = ANY(demo_cat_ids);

  -- 5. Identify Demo Performances
  SELECT ARRAY_AGG(id) INTO demo_perf_ids
  FROM public.performances
  WHERE demo_round_ids IS NOT NULL AND round_id = ANY(demo_round_ids);

  -- 6. Identify Demo Score Submissions
  SELECT ARRAY_AGG(id) INTO demo_sub_ids
  FROM public.score_submissions
  WHERE (demo_perf_ids IS NOT NULL AND performance_id = ANY(demo_perf_ids))
     OR (demo_crit_ver_ids IS NOT NULL AND criteria_version_id = ANY(demo_crit_ver_ids));

  -- -------------------------------------------------------------
  -- DELETE IN EXACT REVERSE DEPENDENCY ORDER
  -- -------------------------------------------------------------

  -- A. Delete Score Entries
  IF demo_sub_ids IS NOT NULL THEN
    DELETE FROM public.score_entries WHERE submission_id = ANY(demo_sub_ids);
  END IF;

  -- B. Delete Score Submissions
  IF demo_sub_ids IS NOT NULL THEN
    DELETE FROM public.score_submissions WHERE id = ANY(demo_sub_ids);
  END IF;

  -- C. Delete Simple Scores & Overrides
  IF demo_comp_ids IS NOT NULL THEN
    DELETE FROM public.scores WHERE event_id = ANY(demo_comp_ids);
  END IF;

  -- D. Delete Category Criteria & Criteria Versions
  IF demo_crit_ver_ids IS NOT NULL THEN
    DELETE FROM public.category_criteria WHERE criteria_version_id = ANY(demo_crit_ver_ids);
    DELETE FROM public.criteria_versions WHERE id = ANY(demo_crit_ver_ids);
  END IF;

  -- E. Delete Performances & Rounds
  IF demo_perf_ids IS NOT NULL THEN
    DELETE FROM public.performances WHERE id = ANY(demo_perf_ids);
  END IF;
  IF demo_round_ids IS NOT NULL THEN
    DELETE FROM public.rounds WHERE id = ANY(demo_round_ids);
  END IF;

  -- F. Delete Category Judges & Categories
  IF demo_cat_ids IS NOT NULL THEN
    DELETE FROM public.category_judges WHERE category_id = ANY(demo_cat_ids);
    DELETE FROM public.categories WHERE id = ANY(demo_cat_ids);
  END IF;

  -- G. Delete Participants & Teams
  DELETE FROM public.participants 
  WHERE environment = 'practice' 
     OR participant_name ILIKE '%demo%' 
     OR team_name ILIKE '%demo%'
     OR church_name ILIKE '%demo%'
     OR (demo_comp_ids IS NOT NULL AND competition_id = ANY(demo_comp_ids));

  DELETE FROM public.teams
  WHERE environment = 'practice'
     OR name ILIKE '%demo%'
     OR (demo_comp_ids IS NOT NULL AND competition_id = ANY(demo_comp_ids));

  -- H. Delete Event States & Settings
  IF demo_comp_ids IS NOT NULL THEN
    DELETE FROM public.event_state WHERE event_id = ANY(demo_comp_ids);
    DELETE FROM public.competition_state WHERE competition_id = ANY(demo_comp_ids);
    DELETE FROM public.competition_settings WHERE competition_id = ANY(demo_comp_ids);
    DELETE FROM public.competitions WHERE id = ANY(demo_comp_ids);
  END IF;

  RAISE NOTICE 'Successfully purged all demo sandbox seeds and foreign key dependencies.';
END $$;
