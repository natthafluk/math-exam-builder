REVOKE ALL ON FUNCTION public.get_my_profile() FROM anon;
REVOKE ALL ON FUNCTION public.repair_my_profile() FROM anon;
REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.repair_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_my_profile() TO authenticated;