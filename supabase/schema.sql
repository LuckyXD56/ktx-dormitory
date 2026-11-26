-- ============================================================================
-- Dormitory Management System (ระบบจัดการหอพัก / Hệ thống Quản lý Ký túc xá)
-- Complete PostgreSQL + Supabase Schema, Triggers, Storage & RLS Policies
-- Run this in Supabase SQL Editor (Project -> SQL Editor -> New Query)
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABLES
-- ============================================================================

-- Staff / Admin Profiles linked to Supabase auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('super_admin', 'admin', 'staff')),
  phone text DEFAULT '',
  avatar_url text,
  preferred_language text NOT NULL DEFAULT 'th' CHECK (preferred_language IN ('th', 'vi')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Dormitory Buildings
CREATE TABLE IF NOT EXISTS public.buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  total_floors integer NOT NULL DEFAULT 4 CHECK (total_floors >= 1),
  gender_policy text NOT NULL DEFAULT 'mixed' CHECK (gender_policy IN ('male', 'female', 'mixed')),
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Dormitory Rooms
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  room_number text NOT NULL,
  floor integer NOT NULL DEFAULT 1 CHECK (floor >= 1),
  capacity integer NOT NULL DEFAULT 4 CHECK (capacity >= 1),
  monthly_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (monthly_fee >= 0),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'full', 'maintenance')),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (building_id, room_number)
);

-- Student / Resident Members
CREATE TABLE IF NOT EXISTS public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code text NOT NULL UNIQUE,
  full_name text NOT NULL,
  avatar_url text,
  gender text NOT NULL DEFAULT 'male' CHECK (gender IN ('male', 'female', 'other')),
  country text NOT NULL DEFAULT 'ไทย',
  province text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  check_in_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'checked_out', 'suspended')),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Check-in / Check-out / Late / Absent Attendance Logs
CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  log_type text NOT NULL CHECK (log_type IN ('check_in', 'check_out', 'late', 'absent')),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  is_late boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fee & Payment Records
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  billing_month text NOT NULL, -- format YYYY-MM
  fee_type text NOT NULL DEFAULT 'room_fee' CHECK (fee_type IN ('room_fee', 'water', 'electricity', 'fine', 'other')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  paid_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
  due_date date,
  paid_at timestamptz,
  payment_method text CHECK (payment_method IS NULL OR payment_method IN ('cash', 'transfer', 'qr', 'other')),
  receipt_number text,
  notes text DEFAULT '',
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Rule Violations & Penalties
CREATE TABLE IF NOT EXISTS public.violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  violation_type text NOT NULL DEFAULT 'curfew',
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL DEFAULT '',
  evidence_url text,
  penalty text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'appealed')),
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Dormitory Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('meeting', 'cleaning', 'inspection', 'rules', 'activity', 'general')),
  target_scope text NOT NULL DEFAULT 'all' CHECK (target_scope IN ('all', 'building', 'room')),
  target_building_id uuid REFERENCES public.buildings(id) ON DELETE SET NULL,
  target_room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast searching & reporting
CREATE INDEX IF NOT EXISTS idx_members_room_id ON public.members(room_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON public.members(status);
CREATE INDEX IF NOT EXISTS idx_members_student_code ON public.members(student_code);
CREATE INDEX IF NOT EXISTS idx_rooms_building_id ON public.rooms(building_id);
CREATE INDEX IF NOT EXISTS idx_attendance_member_recorded ON public.attendance_logs(member_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_member_month ON public.payments(member_id, billing_month);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_violations_member_occurred ON public.violations(member_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_published ON public.announcements(is_pinned DESC, published_at DESC);

-- ============================================================================
-- 2. HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_buildings_updated ON public.buildings;
CREATE TRIGGER trg_buildings_updated BEFORE UPDATE ON public.buildings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_rooms_updated ON public.rooms;
CREATE TRIGGER trg_rooms_updated BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_members_updated ON public.members;
CREATE TRIGGER trg_members_updated BEFORE UPDATE ON public.members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated ON public.payments;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_violations_updated ON public.violations;
CREATE TRIGGER trg_violations_updated BEFORE UPDATE ON public.violations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_announcements_updated ON public.announcements;
CREATE TRIGGER trg_announcements_updated BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile when a new auth user signs up.
-- The VERY FIRST user in the system automatically becomes 'super_admin'.
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
    CASE WHEN NEW.raw_user_meta_data->>'preferred_language' IN ('th', 'vi')
         THEN NEW.raw_user_meta_data->>'preferred_language'
         ELSE 'th' END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enforce room capacity and keep room status ('available' / 'full') synchronized
CREATE OR REPLACE FUNCTION public.sync_room_occupancy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_room_id uuid;
  occ_count integer;
  room_cap integer;
  room_status text;
BEGIN
  -- Validate new room capacity on INSERT / UPDATE
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.room_id IS NOT NULL AND NEW.status IN ('active', 'on_leave') THEN
    SELECT capacity, status INTO room_cap, room_status FROM public.rooms WHERE id = NEW.room_id;
    IF room_status = 'maintenance' THEN
      RAISE EXCEPTION 'Cannot assign member to a room under maintenance';
    END IF;
    SELECT COUNT(*) INTO occ_count
    FROM public.members
    WHERE room_id = NEW.room_id
      AND status IN ('active', 'on_leave')
      AND id <> NEW.id;
    IF occ_count >= room_cap THEN
      RAISE EXCEPTION 'Room is already at full capacity (%/% beds)', occ_count, room_cap;
    END IF;
  END IF;

  -- Recalculate NEW.room_id status
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.room_id IS NOT NULL THEN
    target_room_id := NEW.room_id;
    SELECT capacity, status INTO room_cap, room_status FROM public.rooms WHERE id = target_room_id;
    IF room_status <> 'maintenance' THEN
      SELECT COUNT(*) INTO occ_count FROM public.members WHERE room_id = target_room_id AND status IN ('active', 'on_leave');
      UPDATE public.rooms
      SET status = CASE WHEN occ_count >= room_cap THEN 'full' ELSE 'available' END
      WHERE id = target_room_id;
    END IF;
  END IF;

  -- Recalculate OLD.room_id status if moved or deleted
  IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.room_id IS DISTINCT FROM NEW.room_id)) AND OLD.room_id IS NOT NULL THEN
    target_room_id := OLD.room_id;
    SELECT capacity, status INTO room_cap, room_status FROM public.rooms WHERE id = target_room_id;
    IF FOUND AND room_status <> 'maintenance' THEN
      SELECT COUNT(*) INTO occ_count FROM public.members WHERE room_id = target_room_id AND status IN ('active', 'on_leave');
      UPDATE public.rooms
      SET status = CASE WHEN occ_count >= room_cap THEN 'full' ELSE 'available' END
      WHERE id = target_room_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_members_room_sync ON public.members;
CREATE TRIGGER trg_members_room_sync
  AFTER INSERT OR UPDATE OF room_id, status OR DELETE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.sync_room_occupancy();

-- ============================================================================
-- 3. RLS SECURITY HELPERS & POLICIES
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true);
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_active_user());

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    AND is_active = (SELECT is_active FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "profiles_manage_super_admin" ON public.profiles;
CREATE POLICY "profiles_manage_super_admin" ON public.profiles
  FOR ALL USING (public.current_user_role() = 'super_admin')
  WITH CHECK (public.current_user_role() = 'super_admin');

DROP POLICY IF EXISTS "profiles_manage_admin" ON public.profiles;
CREATE POLICY "profiles_manage_admin" ON public.profiles
  FOR UPDATE USING (public.current_user_role() = 'admin' AND role <> 'super_admin')
  WITH CHECK (public.current_user_role() = 'admin' AND role IN ('admin', 'staff'));

-- BUILDINGS policies (Any authenticated user can manage buildings freely)
DROP POLICY IF EXISTS "buildings_select" ON public.buildings;
CREATE POLICY "buildings_select" ON public.buildings FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "buildings_write_admin" ON public.buildings;
CREATE POLICY "buildings_write_admin" ON public.buildings
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ROOMS policies
DROP POLICY IF EXISTS "rooms_select" ON public.rooms;
CREATE POLICY "rooms_select" ON public.rooms FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "rooms_write_admin" ON public.rooms;
CREATE POLICY "rooms_write_admin" ON public.rooms
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- MEMBERS policies
DROP POLICY IF EXISTS "members_select" ON public.members;
CREATE POLICY "members_select" ON public.members FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "members_write_admin" ON public.members;
CREATE POLICY "members_write_admin" ON public.members
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ATTENDANCE_LOGS policies
DROP POLICY IF EXISTS "attendance_select" ON public.attendance_logs;
CREATE POLICY "attendance_select" ON public.attendance_logs FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "attendance_insert_staff" ON public.attendance_logs;
CREATE POLICY "attendance_insert_staff" ON public.attendance_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "attendance_update_staff" ON public.attendance_logs;
CREATE POLICY "attendance_update_staff" ON public.attendance_logs
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "attendance_delete_admin" ON public.attendance_logs;
CREATE POLICY "attendance_delete_admin" ON public.attendance_logs
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- PAYMENTS policies
DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "payments_write_admin" ON public.payments;
CREATE POLICY "payments_write_admin" ON public.payments
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- VIOLATIONS policies
DROP POLICY IF EXISTS "violations_select" ON public.violations;
CREATE POLICY "violations_select" ON public.violations FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "violations_insert_staff" ON public.violations;
CREATE POLICY "violations_insert_staff" ON public.violations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "violations_update_staff" ON public.violations;
CREATE POLICY "violations_update_staff" ON public.violations
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "violations_delete_admin" ON public.violations;
CREATE POLICY "violations_delete_admin" ON public.violations
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ANNOUNCEMENTS policies
DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
CREATE POLICY "announcements_select" ON public.announcements FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "announcements_write_admin" ON public.announcements;
CREATE POLICY "announcements_write_admin" ON public.announcements
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- 4. STORAGE BUCKET FOR AVATARS & VIOLATION EVIDENCE
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('dorm-files', 'dorm-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "dorm_files_public_read" ON storage.objects;
CREATE POLICY "dorm_files_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'dorm-files');

DROP POLICY IF EXISTS "dorm_files_auth_upload" ON storage.objects;
CREATE POLICY "dorm_files_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'dorm-files' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "dorm_files_auth_update" ON storage.objects;
CREATE POLICY "dorm_files_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'dorm-files' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "dorm_files_admin_delete" ON storage.objects;
CREATE POLICY "dorm_files_admin_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'dorm-files' AND auth.uid() IS NOT NULL);

-- ============================================================================
-- 5. GRANTS & BACKFILL (Required so Supabase API roles can access tables under RLS)
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO anon, authenticated;

-- Backfill any existing auth.users that do not yet have a profile row
INSERT INTO public.profiles (id, email, full_name, role, preferred_language)
SELECT
  u.id,
  COALESCE(u.email, ''),
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(COALESCE(u.email, 'User'), '@', 1)),
  CASE
    WHEN u.id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
    THEN 'super_admin'
    ELSE 'staff'
  END,
  'th'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- Ensure the earliest registered user is super_admin if no super_admin exists yet
UPDATE public.profiles
SET role = 'super_admin'
WHERE id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'super_admin');
