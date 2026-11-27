-- ============================================================================
-- Import 14 Additional Lao Dormitory Students (Tòa 3: Rooms 103, 107, 109, 203)
-- Safe & Idempotent
-- ============================================================================
DO $$
DECLARE
  v_bld_3 uuid;
  v_room_id uuid;
  v_other_occ integer;
  rec record;
  v_imported_codes text[] := ARRAY['PA0515197', 'PA0506116', 'P2902908', 'P3585391', 'P2988873', 'P3612736', 'P2554223', 'PA0425791', 'P3233065', 'PA0491359', 'P3083628', 'PA0543627', 'PA0535104', 'P3574676'];
BEGIN
  SELECT id INTO v_bld_3 FROM public.buildings WHERE code ~* '(^|\D)3$' OR name ~* '(^|\D)3$' ORDER BY created_at LIMIT 1;
  IF v_bld_3 IS NULL THEN
    INSERT INTO public.buildings (code, name, total_floors, gender_policy) VALUES ('NHA 3', 'Nhà 3', 5, 'mixed') RETURNING id INTO v_bld_3;
  END IF;

  FOR rec IN
    SELECT * FROM (VALUES
      (3, '103', 1, 4, 6, 2500000),
      (3, '107', 1, 4, 6, 2500000),
      (3, '109', 1, 4, 6, 2500000),
      (3, '203', 2, 2, 6, 2500000)
    ) AS rm(b_num, r_num, floor_num, cnt, req_cap, fee)
  LOOP
    SELECT id INTO v_room_id FROM public.rooms
      WHERE building_id = v_bld_3 AND (room_number = rec.r_num OR room_number ~ ('(^|\D)' || rec.r_num || '$')) LIMIT 1;
    IF v_room_id IS NULL THEN
      INSERT INTO public.rooms (building_id, room_number, floor, capacity, monthly_fee, status)
      VALUES (v_bld_3, 'NHÀ ' || rec.r_num, rec.floor_num, rec.req_cap, rec.fee, 'available')
      ON CONFLICT (building_id, room_number) DO UPDATE SET
        capacity = GREATEST(public.rooms.capacity, rec.req_cap),
        status = CASE WHEN public.rooms.status = 'maintenance' THEN 'available' ELSE public.rooms.status END;
    ELSE
      SELECT COUNT(*) INTO v_other_occ FROM public.members
        WHERE room_id = v_room_id AND status IN ('active', 'on_leave') AND NOT (student_code = ANY(v_imported_codes));
      UPDATE public.rooms SET
        capacity = GREATEST(capacity, v_other_occ + rec.cnt, rec.req_cap),
        status = CASE WHEN status = 'maintenance' THEN 'available' ELSE status END
      WHERE id = v_room_id;
    END IF;
  END LOOP;

  FOR rec IN
    SELECT * FROM (VALUES
      ('PA0515197', 'PHOMMASEN POUKHAM', 'female', 'Lào', '', 3, '109', DATE '2026-10-01', 'วันเกิด: 1988-06-04 | วันกลับ: 25/9/2027 | ກຽມພາສາຫວຽດ 2026-2027'),
      ('PA0506116', 'SINGTHABOUTH KHANTIVONG', 'female', 'Lào', '', 3, '109', DATE '2026-10-01', 'วันเกิด: 2009-05-05 | วันกลับ: 25/9/2027 | ກຽມພາສາຫວຽດ 2026-2027'),
      ('P2902908', 'CHANTHAMITH CHINDAPHONE', 'female', 'Lào', '', 3, '109', DATE '2026-10-01', 'วันเกิด: 2008-01-07 | วันกลับ: 25/9/2027 | ກຽມພາສາຫວຽດ 2026-2027'),
      ('P3585391', 'LASAPHON SONGKAN', 'female', 'Lào', '', 3, '109', DATE '2026-10-01', 'วันเกิด: 2009-04-12 | วันกลับ: 25/9/2027 | ກຽມພາສາຫວຽດ 2026-2027'),
      ('P2988873', 'SINNAVONG SOUTTHIDA', 'female', 'Lào', '', 3, '203', DATE '2026-10-01', 'วันเกิด: 2008-12-16 | วันกลับ: 25/9/2027 | ກຽມພາສາຫວຽດ 2026-2027'),
      ('P3612736', 'ALOUNSAVAT PAVINA', 'female', 'Lào', '', 3, '203', DATE '2026-10-01', 'วันเกิด: 2008-10-09 | วันกลับ: 25/9/2027 | ກຽມພາສາຫວຽດ 2026-2027'),
      ('P2554223', 'PHIMVONGSA PHISITXAY', 'male', 'Lào', '', 3, '103', DATE '2026-10-01', 'วันเกิด: 2009-07-31 | วันกลับ: 25/9/2027 | ກຽມພາສາຫວຽດ 2026-2027'),
      ('PA0425791', 'AMPHONE PHOUTTHASITH', 'male', 'Lào', '', 3, '103', DATE '2026-10-01', 'วันเกิด: 2008-07-13 | วันกลับ: 25/9/2027 | ກຽມພາສາຫວຽດ 2026-2027'),
      ('P3233065', 'SIHAMAYA PHOUTTHIDA', 'female', 'Lào', '', 3, '107', DATE '2026-10-01', 'วันเกิด: 2007-12-19 | วันกลับ: 25/9/2027 | ກຽມພາສາຫວຽດ 2026-2027'),
      ('PA0491359', 'VONGONCHANH PHONEPHIMON', 'female', 'Lào', '', 3, '107', DATE '2026-10-01', 'วันเกิด: 2008-10-30 | วันกลับ: 25/9/2027 | ກຽມພາສາຫວຽດ 2026-2027'),
      ('P3083628', 'HATSAPHONE LILAVANH', 'female', 'Lào', '', 3, '107', DATE '2026-10-01', 'วันเกิด: 2006-10-30 | วันกลับ: 25/9/2027 | ກຽມພາສາຫວຽດ 2026-2027'),
      ('PA0543627', 'KEOBOUNHEUANG SAYKHAM', 'male', 'Lào', '', 3, '103', DATE '2026-10-01', 'วันเกิด: 2009-03-28 | วันกลับ: 25/9/2027 | ກຽມພາສາຫວຽດ 2026-2027'),
      ('PA0535104', 'ONPHACHANH SOUPHAPHONE', 'female', 'Lào', '', 3, '107', DATE '2026-10-01', 'วันเกิด: 2006-10-22 | วันกลับ: 25/9/2027 | ກຽມພາສາຫວຽດ 2026-2027'),
      ('P3574676', 'KEOSOMPHANH XAYPAXA', 'male', 'Lào', '', 3, '103', DATE '2026-10-01', 'วันเกิด: 2009-12-02 | วันกลับ: 25/9/2027 | ກຽມພາສາຫວຽດ 2026-2027')
    ) AS st(student_code, full_name, gender, country, province, b_num, r_num, check_in, notes)
  LOOP
    SELECT id INTO v_room_id FROM public.rooms
      WHERE building_id = v_bld_3 AND (room_number = rec.r_num OR room_number ~ ('(^|\D)' || rec.r_num || '$')) LIMIT 1;
    INSERT INTO public.members (student_code, full_name, gender, country, province, phone, room_id, check_in_date, status, notes)
    VALUES (rec.student_code, rec.full_name, rec.gender, rec.country, rec.province, '', v_room_id, rec.check_in, 'active', rec.notes)
    ON CONFLICT (student_code) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      gender = EXCLUDED.gender,
      country = EXCLUDED.country,
      province = EXCLUDED.province,
      room_id = EXCLUDED.room_id,
      check_in_date = EXCLUDED.check_in_date,
      status = 'active',
      notes = EXCLUDED.notes;
  END LOOP;
END $$;
