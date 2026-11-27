-- ============================================================================
-- Room-level Electricity & Water Meter Readings (utility_readings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.utility_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  billing_month text NOT NULL,
  elec_prev integer NOT NULL DEFAULT 0,
  elec_curr integer NOT NULL DEFAULT 0,
  elec_rate integer NOT NULL DEFAULT 3500,
  water_prev integer NOT NULL DEFAULT 0,
  water_curr integer NOT NULL DEFAULT 0,
  water_rate integer NOT NULL DEFAULT 15000,
  elec_amount numeric(12,0) GENERATED ALWAYS AS (GREATEST(0, elec_curr - elec_prev) * elec_rate) STORED,
  water_amount numeric(12,0) GENERATED ALWAYS AS (GREATEST(0, water_curr - water_prev) * water_rate) STORED,
  billed_to_payments boolean NOT NULL DEFAULT false,
  notes text,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, billing_month)
);

CREATE INDEX IF NOT EXISTS idx_utility_readings_month ON public.utility_readings(billing_month);
CREATE INDEX IF NOT EXISTS idx_utility_readings_room_month ON public.utility_readings(room_id, billing_month);

ALTER TABLE public.utility_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "utility_readings_select" ON public.utility_readings;
CREATE POLICY "utility_readings_select" ON public.utility_readings
  FOR SELECT USING (
    public.current_user_role() IN ('super_admin', 'admin', 'staff')
    OR (
      public.current_user_role() = 'student'
      AND room_id = public.current_user_room_id()
    )
  );

DROP POLICY IF EXISTS "utility_readings_insert_staff" ON public.utility_readings;
CREATE POLICY "utility_readings_insert_staff" ON public.utility_readings
  FOR INSERT WITH CHECK (public.current_user_role() IN ('super_admin', 'admin', 'staff'));

DROP POLICY IF EXISTS "utility_readings_update_staff" ON public.utility_readings;
CREATE POLICY "utility_readings_update_staff" ON public.utility_readings
  FOR UPDATE USING (public.current_user_role() IN ('super_admin', 'admin', 'staff'))
  WITH CHECK (public.current_user_role() IN ('super_admin', 'admin', 'staff'));

DROP POLICY IF EXISTS "utility_readings_delete_admin" ON public.utility_readings;
CREATE POLICY "utility_readings_delete_admin" ON public.utility_readings
  FOR DELETE USING (public.current_user_role() IN ('super_admin', 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.utility_readings TO authenticated;
