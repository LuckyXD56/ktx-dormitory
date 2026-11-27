-- ============================================================================
-- Per-Room Student Accounts ('student' role) + Strict Room-Scoped RLS
-- ============================================================================

-- 1. Add room_id column & expand role constraint on public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS room_id uuid;

CREATE INDEX IF NOT EXISTS idx_profiles_room_id ON public.profiles(room_id);

DO $$
DECLARE
  c_name text;
BEGIN
  SELECT con.conname INTO c_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'profiles'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%role%';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', c_name);
  END IF;

  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('super_admin', 'admin', 'staff', 'student'));

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'profiles'
      AND con.conname = 'profiles_room_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_room_id_fkey
      FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Security helper: returns assigned room_id ONLY for active 'student' accounts
CREATE OR REPLACE FUNCTION public.current_user_room_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT room_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active = true
    AND role = 'student'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_room_id() TO anon, authenticated;

-- 3. Update handle_new_user() to support room_id & student metadata safely
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_existing_profile boolean;
  assigned_role text;
  meta_role text;
  meta_room_id uuid;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.profiles) INTO has_existing_profile;
  meta_role := NEW.raw_user_meta_data->>'role';

  IF NOT has_existing_profile THEN
    assigned_role := 'super_admin';
  ELSIF meta_role = 'student' THEN
    assigned_role := 'student';
  ELSE
    assigned_role := 'staff';
  END IF;

  BEGIN
    meta_room_id := NULLIF(NEW.raw_user_meta_data->>'room_id', '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    meta_room_id := NULL;
  END;

  INSERT INTO public.profiles (id, email, full_name, role, room_id, preferred_language)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, 'User'), '@', 1)),
    assigned_role,
    CASE WHEN assigned_role = 'student' THEN meta_room_id ELSE NULL END,
    CASE WHEN NEW.raw_user_meta_data->>'preferred_language' IN ('th', 'vi', 'en', 'zh', 'lo')
         THEN NEW.raw_user_meta_data->>'preferred_language'
         ELSE 'th' END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4. Lock down all table RLS policies so 'student' accounts ONLY see their own room

-- PROFILES: students only see their own row and cannot escalate role/room_id
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR public.current_user_role() IN ('super_admin', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
    AND is_active = (SELECT p.is_active FROM public.profiles p WHERE p.id = auth.uid())
    AND room_id IS NOT DISTINCT FROM (SELECT p.room_id FROM public.profiles p WHERE p.id = auth.uid())
  );

DROP POLICY IF EXISTS "profiles_manage_admin" ON public.profiles;
CREATE POLICY "profiles_manage_admin" ON public.profiles
  FOR UPDATE USING (public.current_user_role() = 'admin' AND role <> 'super_admin')
  WITH CHECK (public.current_user_role() = 'admin' AND role IN ('admin', 'staff', 'student'));

-- BUILDINGS: staff/admin read all; student reads only the building of their own room
DROP POLICY IF EXISTS "buildings_select" ON public.buildings;
CREATE POLICY "buildings_select" ON public.buildings
  FOR SELECT USING (
    public.current_user_role() IN ('super_admin', 'admin', 'staff')
    OR (
      public.current_user_role() = 'student'
      AND id = (SELECT r.building_id FROM public.rooms r WHERE r.id = public.current_user_room_id())
    )
  );

-- ROOMS: staff/admin read all; student reads ONLY their assigned room
DROP POLICY IF EXISTS "rooms_select" ON public.rooms;
CREATE POLICY "rooms_select" ON public.rooms
  FOR SELECT USING (
    public.current_user_role() IN ('super_admin', 'admin', 'staff')
    OR (
      public.current_user_role() = 'student'
      AND id = public.current_user_room_id()
    )
  );

-- MEMBERS: staff/admin read/write all; student reads ONLY residents in their own room (strictly read-only)
DROP POLICY IF EXISTS "members_select" ON public.members;
CREATE POLICY "members_select" ON public.members
  FOR SELECT USING (
    public.current_user_role() IN ('super_admin', 'admin', 'staff')
    OR (
      public.current_user_role() = 'student'
      AND room_id IS NOT NULL
      AND room_id = public.current_user_room_id()
    )
  );

DROP POLICY IF EXISTS "members_insert_active" ON public.members;
DROP POLICY IF EXISTS "members_insert_staff" ON public.members;
CREATE POLICY "members_insert_staff" ON public.members
  FOR INSERT WITH CHECK (public.current_user_role() IN ('super_admin', 'admin', 'staff'));

DROP POLICY IF EXISTS "members_update_active" ON public.members;
DROP POLICY IF EXISTS "members_update_staff" ON public.members;
CREATE POLICY "members_update_staff" ON public.members
  FOR UPDATE USING (public.current_user_role() IN ('super_admin', 'admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('super_admin', 'admin', 'staff'));

-- ATTENDANCE_LOGS: staff/admin read/write all; student reads ONLY logs for members in their own room
DROP POLICY IF EXISTS "attendance_select" ON public.attendance_logs;
CREATE POLICY "attendance_select" ON public.attendance_logs
  FOR SELECT USING (
    public.current_user_role() IN ('super_admin', 'admin', 'staff')
    OR (
      public.current_user_role() = 'student'
      AND EXISTS (
        SELECT 1 FROM public.members m
        WHERE m.id = attendance_logs.member_id
          AND m.room_id = public.current_user_room_id()
      )
    )
  );

DROP POLICY IF EXISTS "attendance_insert_staff" ON public.attendance_logs;
CREATE POLICY "attendance_insert_staff" ON public.attendance_logs
  FOR INSERT WITH CHECK (public.current_user_role() IN ('super_admin', 'admin', 'staff'));

DROP POLICY IF EXISTS "attendance_update_staff" ON public.attendance_logs;
CREATE POLICY "attendance_update_staff" ON public.attendance_logs
  FOR UPDATE USING (public.current_user_role() IN ('super_admin', 'admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('super_admin', 'admin', 'staff'));

-- PAYMENTS: staff/admin read/write all; student reads ONLY bills linked to their room or roommates
DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (
    public.current_user_role() IN ('super_admin', 'admin', 'staff')
    OR (
      public.current_user_role() = 'student'
      AND (
        room_id = public.current_user_room_id()
        OR EXISTS (
          SELECT 1 FROM public.members m
          WHERE m.id = payments.member_id
            AND m.room_id = public.current_user_room_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "payments_insert_active" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_staff" ON public.payments;
CREATE POLICY "payments_insert_staff" ON public.payments
  FOR INSERT WITH CHECK (public.current_user_role() IN ('super_admin', 'admin', 'staff'));

DROP POLICY IF EXISTS "payments_update_active" ON public.payments;
DROP POLICY IF EXISTS "payments_update_staff" ON public.payments;
CREATE POLICY "payments_update_staff" ON public.payments
  FOR UPDATE USING (public.current_user_role() IN ('super_admin', 'admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('super_admin', 'admin', 'staff'));

-- VIOLATIONS: restricted strictly to super_admin, admin, staff (hidden from student accounts)
DROP POLICY IF EXISTS "violations_select" ON public.violations;
CREATE POLICY "violations_select" ON public.violations
  FOR SELECT USING (public.current_user_role() IN ('super_admin', 'admin', 'staff'));

DROP POLICY IF EXISTS "violations_insert_staff" ON public.violations;
CREATE POLICY "violations_insert_staff" ON public.violations
  FOR INSERT WITH CHECK (public.current_user_role() IN ('super_admin', 'admin', 'staff'));

DROP POLICY IF EXISTS "violations_update_staff" ON public.violations;
CREATE POLICY "violations_update_staff" ON public.violations
  FOR UPDATE USING (public.current_user_role() IN ('super_admin', 'admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('super_admin', 'admin', 'staff'));

-- ANNOUNCEMENTS: staff/admin read all; student reads ONLY all-dorm, their building, or their own room
DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
CREATE POLICY "announcements_select" ON public.announcements
  FOR SELECT USING (
    public.current_user_role() IN ('super_admin', 'admin', 'staff')
    OR (
      public.current_user_role() = 'student'
      AND (
        target_scope = 'all'
        OR (
          target_scope = 'building'
          AND target_building_id = (
            SELECT r.building_id FROM public.rooms r WHERE r.id = public.current_user_room_id()
          )
        )
        OR (
          target_scope = 'room'
          AND target_room_id = public.current_user_room_id()
        )
      )
    )
  );

-- STORAGE: tighten uploads/updates to staff/admin only
DROP POLICY IF EXISTS "dorm_files_auth_upload" ON storage.objects;
CREATE POLICY "dorm_files_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'dorm-files'
    AND public.current_user_role() IN ('super_admin', 'admin', 'staff')
  );

DROP POLICY IF EXISTS "dorm_files_auth_update" ON storage.objects;
CREATE POLICY "dorm_files_auth_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'dorm-files'
    AND public.current_user_role() IN ('super_admin', 'admin', 'staff')
  );
