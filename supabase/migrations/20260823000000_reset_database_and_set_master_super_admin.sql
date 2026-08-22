-- supabase/migrations/20260823000000_reset_database_and_set_master_super_admin.sql
-- Reset Database & Designate navgirekanta65@gmail.com as the Sole Master Super Admin

-- 1. Truncate all competition, participant, scoring, and staging tables
TRUNCATE TABLE public.scores CASCADE;
TRUNCATE TABLE public.event_state CASCADE;
TRUNCATE TABLE public.participants CASCADE;
TRUNCATE TABLE public.competition_settings CASCADE;
TRUNCATE TABLE public.competitions CASCADE;
TRUNCATE TABLE public.audit_logs CASCADE;

-- 2. Clear all user roles except navgirekanta65@gmail.com
DELETE FROM public.user_roles 
WHERE user_id NOT IN (
    SELECT id FROM public.profiles WHERE LOWER(email) = 'navgirekanta65@gmail.com'
);

-- 3. If navgirekanta65@gmail.com is present in auth.users, configure profile and grant Super Admin
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id FROM auth.users WHERE LOWER(email) = 'navgirekanta65@gmail.com' LIMIT 1;
    
    IF target_user_id IS NOT NULL THEN
        -- Upsert profile for navgirekanta65@gmail.com
        INSERT INTO public.profiles (id, email, full_name, is_active, created_at, updated_at)
        VALUES (target_user_id, 'navgirekanta65@gmail.com', 'Master Super Administrator', true, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET 
            email = 'navgirekanta65@gmail.com',
            full_name = 'Master Super Administrator',
            is_active = true,
            updated_at = NOW();

        -- Assign Super Admin role
        DELETE FROM public.user_roles WHERE user_id = target_user_id;
        INSERT INTO public.user_roles (user_id, role, updated_at)
        VALUES (target_user_id, 'super_admin', NOW());
    END IF;
END $$;
