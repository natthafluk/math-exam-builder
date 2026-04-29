-- Reset password for teacher account lovefuk1453@gmail.com to 'lovely1453'
UPDATE auth.users
SET encrypted_password = crypt('lovely1453', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'lovefuk1453@gmail.com';

-- Ensure profile role stays teacher/approved
UPDATE public.profiles
SET role = 'teacher', approval_status = 'approved', full_name = 'ณัฐวุฒิ เรียนทำนา', updated_at = now()
WHERE email = 'lovefuk1453@gmail.com';