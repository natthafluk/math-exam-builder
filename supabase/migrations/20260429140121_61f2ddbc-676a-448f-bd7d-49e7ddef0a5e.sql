-- Allow authenticated users to insert their own profile row (needed for client-side repair upsert)
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);