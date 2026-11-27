-- ============================================================================
-- Migration: 20261127_rls_role_granularity.sql
-- Purpose:
--   1. Ensure ALL reads & writes require an active user profile (`public.is_active_user()`),
--      blocking deactivated accounts (`is_active = false`) at the PostgreSQL RLS layer.
--   2. Enforce Role-Based Access Control (RBAC) across operational vs admin tables:
--      - Active users (`super_admin`, `admin`, `staff`):
--          * SELECT across buildings, rooms, members, attendance_logs, payments, violations, announcements
--          * INSERT / UPDATE on daily operational logs (`attendance_logs`, `violations`)
--          * INSERT / UPDATE on `members` and `payments` (front-desk check-in & receipt collection)
--      - Admins & Super Admins (`current_user_role() IN ('super_admin', 'admin')`):
--          * Full INSERT / UPDATE / DELETE on `buildings`, `rooms`, `announcements`
--          * DELETE permissions on `members`, `attendance_logs`, `payments`, `violations`, and storage objects
-- ============================================================================

-- Ensure helper functions exist and stay hardened
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

-- BUILDINGS (Read: active users | Write: admin / super_admin)
DROP POLICY IF EXISTS "buildings_select" ON public.buildings;
CREATE POLICY "buildings_select" ON public.buildings
  FOR SELECT USING (public.is_active_user());

DROP POLICY IF EXISTS "buildings_write_admin" ON public.buildings;
CREATE POLICY "buildings_write_admin" ON public.buildings
  FOR ALL USING (public.current_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.current_user_role() IN ('super_admin', 'admin'));

-- ROOMS (Read: active users | Write: admin / super_admin)
DROP POLICY IF EXISTS "rooms_select" ON public.rooms;
CREATE POLICY "rooms_select" ON public.rooms
  FOR SELECT USING (public.is_active_user());

DROP POLICY IF EXISTS "rooms_write_admin" ON public.rooms;
CREATE POLICY "rooms_write_admin" ON public.rooms
  FOR ALL USING (public.current_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.current_user_role() IN ('super_admin', 'admin'));

-- MEMBERS (Read/Create/Update: active users | Delete: admin / super_admin)
DROP POLICY IF EXISTS "members_select" ON public.members;
CREATE POLICY "members_select" ON public.members
  FOR SELECT USING (public.is_active_user());

DROP POLICY IF EXISTS "members_write_admin" ON public.members;
DROP POLICY IF EXISTS "members_insert_active" ON public.members;
DROP POLICY IF EXISTS "members_update_active" ON public.members;
DROP POLICY IF EXISTS "members_delete_admin" ON public.members;

CREATE POLICY "members_insert_active" ON public.members
  FOR INSERT WITH CHECK (public.is_active_user());

CREATE POLICY "members_update_active" ON public.members
  FOR UPDATE USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "members_delete_admin" ON public.members
  FOR DELETE USING (public.current_user_role() IN ('super_admin', 'admin'));

-- ATTENDANCE_LOGS (Read/Insert/Update: active users | Delete: admin / super_admin)
DROP POLICY IF EXISTS "attendance_select" ON public.attendance_logs;
CREATE POLICY "attendance_select" ON public.attendance_logs
  FOR SELECT USING (public.is_active_user());

DROP POLICY IF EXISTS "attendance_insert_staff" ON public.attendance_logs;
CREATE POLICY "attendance_insert_staff" ON public.attendance_logs
  FOR INSERT WITH CHECK (public.is_active_user());

DROP POLICY IF EXISTS "attendance_update_staff" ON public.attendance_logs;
CREATE POLICY "attendance_update_staff" ON public.attendance_logs
  FOR UPDATE USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

DROP POLICY IF EXISTS "attendance_delete_admin" ON public.attendance_logs;
CREATE POLICY "attendance_delete_admin" ON public.attendance_logs
  FOR DELETE USING (public.current_user_role() IN ('super_admin', 'admin'));

-- PAYMENTS (Read/Create/Record payment: active users | Delete: admin / super_admin)
DROP POLICY IF EXISTS "payments_select" ON public.payments;
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (public.is_active_user());

DROP POLICY IF EXISTS "payments_write_admin" ON public.payments;
DROP POLICY IF EXISTS "payments_insert_active" ON public.payments;
DROP POLICY IF EXISTS "payments_update_active" ON public.payments;
DROP POLICY IF EXISTS "payments_delete_admin" ON public.payments;

CREATE POLICY "payments_insert_active" ON public.payments
  FOR INSERT WITH CHECK (public.is_active_user());

CREATE POLICY "payments_update_active" ON public.payments
  FOR UPDATE USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY "payments_delete_admin" ON public.payments
  FOR DELETE USING (public.current_user_role() IN ('super_admin', 'admin'));

-- VIOLATIONS (Read/Insert/Update: active users | Delete: admin / super_admin)
DROP POLICY IF EXISTS "violations_select" ON public.violations;
CREATE POLICY "violations_select" ON public.violations
  FOR SELECT USING (public.is_active_user());

DROP POLICY IF EXISTS "violations_insert_staff" ON public.violations;
CREATE POLICY "violations_insert_staff" ON public.violations
  FOR INSERT WITH CHECK (public.is_active_user());

DROP POLICY IF EXISTS "violations_update_staff" ON public.violations;
CREATE POLICY "violations_update_staff" ON public.violations
  FOR UPDATE USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

DROP POLICY IF EXISTS "violations_delete_admin" ON public.violations;
CREATE POLICY "violations_delete_admin" ON public.violations
  FOR DELETE USING (public.current_user_role() IN ('super_admin', 'admin'));

-- ANNOUNCEMENTS (Read: active users | Write: admin / super_admin)
DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
CREATE POLICY "announcements_select" ON public.announcements
  FOR SELECT USING (public.is_active_user());

DROP POLICY IF EXISTS "announcements_write_admin" ON public.announcements;
CREATE POLICY "announcements_write_admin" ON public.announcements
  FOR ALL USING (public.current_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (public.current_user_role() IN ('super_admin', 'admin'));

-- STORAGE (Upload/Update: active users | Delete: admin / super_admin)
DROP POLICY IF EXISTS "dorm_files_auth_upload" ON storage.objects;
CREATE POLICY "dorm_files_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'dorm-files' AND public.is_active_user());

DROP POLICY IF EXISTS "dorm_files_auth_update" ON storage.objects;
CREATE POLICY "dorm_files_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'dorm-files' AND public.is_active_user());

DROP POLICY IF EXISTS "dorm_files_admin_delete" ON storage.objects;
CREATE POLICY "dorm_files_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'dorm-files'
    AND public.current_user_role() IN ('super_admin', 'admin')
  );
