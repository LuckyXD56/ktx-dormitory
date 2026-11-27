-- Expand supported languages in public.profiles and handle_new_user()
-- Supports: Thai (th), Vietnamese (vi), English (en), Chinese (zh), Lao (lo)

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'profiles'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%preferred_language%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_preferred_language_check
    CHECK (preferred_language IN ('th', 'vi', 'en', 'zh', 'lo'));
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_existing_profile boolean;
  assigned_role text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.profiles) INTO has_existing_profile;

  IF NOT has_existing_profile THEN
    assigned_role := 'super_admin';
  ELSE
    assigned_role := 'staff';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'User'), '@', 1)),
    assigned_role,
    CASE WHEN NEW.raw_user_meta_data->>'preferred_language' IN ('th', 'vi', 'en', 'zh', 'lo')
         THEN NEW.raw_user_meta_data->>'preferred_language'
         ELSE 'th' END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
