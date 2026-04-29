CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (
      NEW.role IS DISTINCT FROM OLD.role OR
      NEW.requested_role IS DISTINCT FROM OLD.requested_role OR
      NEW.approval_status IS DISTINCT FROM OLD.approval_status OR
      NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin OR
      NEW.approved_by IS DISTINCT FROM OLD.approved_by OR
      NEW.approved_at IS DISTINCT FROM OLD.approved_at
    ) AND NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'เฉพาะผู้ดูแลระบบเท่านั้นที่เปลี่ยนบทบาทหรือสถานะอนุมัติได้';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_admin_fields_trg ON public.profiles;
CREATE TRIGGER protect_profile_admin_fields_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_admin_fields();

UPDATE public.profiles
SET role = 'teacher'::public.app_role,
    requested_role = 'teacher'::public.app_role,
    approval_status = 'approved',
    updated_at = now()
WHERE lower(email) = lower('lovefuk1453@gmail.com')
  AND is_super_admin = false;