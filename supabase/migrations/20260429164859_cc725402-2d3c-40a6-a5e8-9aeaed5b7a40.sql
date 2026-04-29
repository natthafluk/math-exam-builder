
-- Promote real user to super admin
UPDATE public.profiles
SET role = 'admin',
    approval_status = 'approved',
    is_super_admin = true,
    approved_at = now(),
    approved_by = id,
    updated_at = now()
WHERE email = 'natthawut.rean@gmail.com';

-- Delete test/demo accounts (profiles + auth users)
DELETE FROM auth.users
WHERE email IN ('admin@example.com','teacher@example.com','student@example.com');

DELETE FROM public.profiles
WHERE email IN ('admin@example.com','teacher@example.com','student@example.com');
