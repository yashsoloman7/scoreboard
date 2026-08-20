-- ============================================================================
-- PURGE DEMO & PRACTICE SANDBOX SEED DATA
-- Cleans up any mock sandbox categories, demo participants, or test events
-- ============================================================================

-- 1. Remove Practice / Demo Scores
DELETE FROM public.scores 
WHERE event_id IN (
  SELECT id FROM public.competitions 
  WHERE environment = 'practice' OR name ILIKE '%practice%' OR name ILIKE '%demo%'
);

-- 2. Remove Practice / Demo Event States
DELETE FROM public.event_state 
WHERE event_id IN (
  SELECT id FROM public.competitions 
  WHERE environment = 'practice' OR name ILIKE '%practice%' OR name ILIKE '%demo%'
);

-- 3. Remove Practice / Demo Participants & Performances
DELETE FROM public.performances 
WHERE round_id IN (
  SELECT r.id FROM public.rounds r
  JOIN public.categories c ON r.category_id = c.id
  JOIN public.competitions comp ON c.competition_id = comp.id
  WHERE comp.environment = 'practice' OR comp.name ILIKE '%practice%' OR comp.name ILIKE '%demo%'
);

DELETE FROM public.participants 
WHERE environment = 'practice' 
   OR participant_name ILIKE '%demo%' 
   OR team_name ILIKE '%demo%'
   OR church_name ILIKE '%demo%';

-- 4. Remove Demo Categories & Rounds
DELETE FROM public.categories 
WHERE name ILIKE '%demo%' OR name ILIKE '%practice%';

-- 5. Remove Demo Competitions
DELETE FROM public.competitions 
WHERE environment = 'practice' OR name ILIKE '%practice%' OR name ILIKE '%demo%';
