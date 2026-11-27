-- ============================================================================
-- Import 172 Lao & Vietnamese Dormitory Students (STT 1..172)
-- Safe & Idempotent: ensures buildings/rooms/capacity exist before upserting
-- ============================================================================
DO $$
DECLARE
  v_bld_1 uuid;
  v_bld_2 uuid;
  v_bld_3 uuid;
  v_bld_id uuid;
  v_room_id uuid;
  v_other_occ integer;
  rec record;
  v_imported_codes text[] := ARRAY['PA0600320', 'PA0602059', 'PA0592397', 'PA0611104', 'PA0571115', 'P2881373', 'PA0598131', 'PA0611985', 'PA0598097', 'PA0521733', 'PA0554468', 'PA0530322', 'P3523503', 'P2757166', 'KTX-SAL-015', 'KTX-SAL-016', 'KTX-SAL-017', 'KTX-SAL-018', 'KTX-SAL-019', 'KTX-SAL-020', 'KTX-SAL-021', 'PA0538663', 'PA0563991', 'P3227824', 'P2941453', 'PA0567698', 'PA0548946', 'PA0601322', 'P2837071', 'PA0543975', 'PA0601324', 'PA0590959', 'P2866401', 'PA0623458', 'PA0584959', 'PA0616333', 'PA0585699', 'PA0615564', 'PA0589807', 'PA0582718', 'P1981324', 'PA0585625', 'P2038198', 'PA0601964', 'PA0599677', 'PA0598433', 'PA0597677', 'PA0583706', 'PA0599676', 'PA0608565', 'P2438454', 'PA0599675', 'P3261724', 'P3611536', 'PA0602056', 'PA0568494', 'PA0602328', 'PA0584246', 'P3598190', 'PA0591330', 'PA0600314', 'PA0597323', 'PA0607911', 'PA0600315', 'PA0612634', 'PA0607916', 'PA0611358', 'Q00842595', 'PA0600313', 'P3059303', 'PA0598218', 'PA0615052', 'PA0599553', 'PA0588676', 'PA0254148', 'P3047530', 'PA0611392', 'P3116240', 'P3145424', 'PA0604715', 'P3373431', 'PA0609192', 'PA0589020', 'P2786354', 'PA0597609', 'PA0571122', 'N2177544', 'P3451050', 'PA0562761', 'P3292523', 'KTX-SAL-091', 'KTX-SAL-092', 'KTX-SAL-093', 'KTX-SAL-094', 'KTX-SAL-095', 'KTX-SAL-096', 'KTX-SAL-097', 'KTX-SAL-098', 'KTX-SAL-099', 'KTX-SAL-100', 'KTX-SAL-101', 'KTX-SAL-102', 'KTX-SAL-103', 'KTX-SAL-104', 'KTX-SAL-105', 'KTX-SAL-106', 'KTX-SAL-107', 'KTX-SAL-108', 'KTX-SAL-109', 'KTX-SAL-110', 'KTX-SAL-111', 'PA0613712', 'P3600338', 'PA0583111', 'PA057066', 'PA0580901', 'PA0589008', 'PA0579957', 'PA0583709', 'PA0526944', 'PA0556019', 'PA0579244', 'PA0567460', 'PA0554383', 'PA0613447', 'P2639626', 'PA0490010', 'P2369555', 'P3329665', 'PA0567930', 'P3116654', 'P3583910', 'P3242413', 'P3543342', 'PA0613195', 'P2696343', 'PA0582862', 'P3114832', 'P3013217', 'PA0521274', 'PA0616321', 'P2941387', 'PA0533684', 'PA0602061', 'PA0607912', 'PA0607915', 'PA0612635', 'PA0571132', 'PA0600307', 'PA0597676', 'PA0574342', 'PA0561174', 'PA0583245', 'P3378087', 'P3345383', 'P3613460', 'P3349425', 'PA0615913', 'PA0613403', 'P3014517', 'PA0539919', 'P2726012', 'PA0533874', 'P2975768', 'P3103754', 'PA0311335', 'PA0613588', 'PA0620185', 'PA0612427', 'P2841599', 'P2741999', 'P3339285'];
BEGIN
  SELECT id INTO v_bld_1 FROM public.buildings WHERE code ~* '(^|\D)1$' OR name ~* '(^|\D)1$' OR name ~* '^kham$' ORDER BY created_at LIMIT 1;
  SELECT id INTO v_bld_2 FROM public.buildings WHERE code ~* '(^|\D)2$' OR name ~* '(^|\D)2$' ORDER BY created_at LIMIT 1;
  SELECT id INTO v_bld_3 FROM public.buildings WHERE code ~* '(^|\D)3$' OR name ~* '(^|\D)3$' ORDER BY created_at LIMIT 1;

  IF v_bld_1 IS NULL THEN
    INSERT INTO public.buildings (code, name, total_floors, gender_policy) VALUES ('NHA 1', 'Nhà 1', 5, 'mixed') RETURNING id INTO v_bld_1;
  END IF;
  IF v_bld_2 IS NULL THEN
    INSERT INTO public.buildings (code, name, total_floors, gender_policy) VALUES ('NHA 2', 'Nhà 2', 5, 'mixed') RETURNING id INTO v_bld_2;
  END IF;
  IF v_bld_3 IS NULL THEN
    INSERT INTO public.buildings (code, name, total_floors, gender_policy) VALUES ('NHA 3', 'Nhà 3', 5, 'mixed') RETURNING id INTO v_bld_3;
  END IF;

  -- Ensure every assigned room exists and has enough capacity for existing + imported occupants
  FOR rec IN
    SELECT * FROM (VALUES
      (1, '100', 1, 2, 6, 2500000),
      (1, '103', 1, 6, 6, 2500000),
      (1, '108', 1, 6, 6, 2500000),
      (1, '109', 1, 1, 6, 2500000),
      (1, '505', 5, 1, 6, 3000000),
      (2, '104', 1, 6, 6, 2500000),
      (2, '105', 1, 6, 6, 2500000),
      (2, '114', 1, 1, 6, 2500000),
      (2, '211', 2, 6, 6, 2500000),
      (2, '212', 2, 6, 6, 2500000),
      (2, '213', 2, 6, 6, 2500000),
      (2, '214', 2, 6, 6, 2500000),
      (2, '311', 3, 6, 6, 2500000),
      (2, '312', 3, 6, 6, 2500000),
      (2, '313', 3, 4, 6, 2500000),
      (2, '314', 3, 6, 6, 2500000),
      (2, '411', 4, 6, 6, 3000000),
      (2, '412', 4, 4, 6, 3000000),
      (2, '413', 4, 6, 6, 3000000),
      (2, '414', 4, 6, 6, 3000000),
      (2, '511', 5, 4, 6, 3000000),
      (2, '512', 5, 4, 6, 3000000),
      (2, '513', 5, 1, 6, 3000000),
      (3, '301', 3, 2, 6, 2500000),
      (3, '303', 3, 1, 6, 2500000),
      (3, '306', 3, 2, 6, 2500000),
      (3, '307', 3, 3, 6, 2500000),
      (3, '309', 3, 5, 6, 2500000),
      (3, '401', 4, 3, 6, 3000000),
      (3, '404', 4, 2, 6, 3000000),
      (3, '405', 4, 3, 6, 3000000),
      (3, '406', 4, 3, 6, 3000000),
      (3, '407', 4, 1, 6, 3000000),
      (3, '408', 4, 1, 6, 3000000),
      (3, '409', 4, 1, 6, 3000000),
      (3, '410', 4, 2, 6, 3000000),
      (3, '501', 5, 1, 6, 3000000),
      (3, '504', 5, 1, 6, 3000000),
      (3, '505', 5, 5, 6, 3000000),
      (3, '506', 5, 6, 6, 3000000),
      (3, '507', 5, 6, 6, 3000000),
      (3, '508', 5, 6, 6, 3000000),
      (3, '509', 5, 6, 6, 3000000),
      (3, '510', 5, 6, 6, 3000000)
    ) AS rm(b_num, r_num, floor_num, cnt, req_cap, fee)
  LOOP
    v_bld_id := CASE rec.b_num WHEN 1 THEN v_bld_1 WHEN 2 THEN v_bld_2 ELSE v_bld_3 END;
    SELECT id INTO v_room_id FROM public.rooms
      WHERE building_id = v_bld_id AND (room_number = rec.r_num OR room_number ~ ('(^|\D)' || rec.r_num || '$')) LIMIT 1;
    IF v_room_id IS NULL THEN
      INSERT INTO public.rooms (building_id, room_number, floor, capacity, monthly_fee, status)
      VALUES (v_bld_id, 'NHÀ ' || rec.r_num, rec.floor_num, rec.req_cap, rec.fee, 'available')
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

  -- Upsert all 172 students cleanly
  FOR rec IN
    SELECT * FROM (VALUES
      ('PA0600320', 'CHANTHAVONG TAVAN', 'male', 'Lào', 'Sekong', 1, '100', DATE '2026-11-10', 'วันเกิด: 17/08/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0602059', 'SOUNIXAY VILAPHAN', 'male', 'Lào', 'Sekong', 1, '100', DATE '2026-11-10', 'วันเกิด: 22/12/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0592397', 'KHODYOTHA CHANTHANA', 'female', 'Lào', 'Attapeu', 1, '103', DATE '2026-10-20', 'วันเกิด: 2009-02-02 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0611104', 'MANISENG THONGPHAN', 'male', 'Lào', 'Sekong', 3, '505', DATE '2026-11-10', 'วันเกิด: 17/11/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0571115', 'PHIMMASAN PHETTAPHONE', 'female', 'Lào', 'Attapeu', 1, '103', DATE '2026-10-20', 'วันเกิด: 2008-12-25 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P2881373', 'PHOMMAVONG NOUN', 'female', 'Lào', 'Attapeu', 1, '103', DATE '2026-10-20', 'วันเกิด: 2009-03-16 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0598131', 'SEELIBOUNLIENG AEKKAVOUT', 'male', 'Lào', 'Sekong', 3, '505', DATE '2026-11-10', 'วันเกิด: 15/10/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0611985', 'SENGKHAMBAI KHONESAVANH', 'male', 'Lào', 'Sekong', 3, '505', DATE '2026-11-10', 'วันเกิด: 14/09/1988 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0598097', 'SINSOUND DENSAVANH', 'male', 'Lào', 'Sekong', 3, '505', DATE '2026-11-10', 'วันเกิด: 27/09/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0521733', 'SOUTHAMMAKOTH PHOUTTHASACK', 'male', 'Lào', 'Sekong', 3, '505', DATE '2026-11-10', 'วันเกิด: 10/03/1993 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027) | Tự túc'),
      ('PA0554468', 'VANCHANTHY FONDY', 'female', 'Lào', 'Attapeu', 1, '103', DATE '2026-10-20', 'วันเกิด: 2008-07-21 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0530322', 'VIENGKEO CHANPHASOUK', 'female', 'Lào', 'Attapeu', 1, '103', DATE '2026-10-20', 'วันเกิด: 2008-09-22 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3523503', 'XAYSETTHA SANUANG', 'female', 'Lào', 'Attapeu', 1, '103', DATE '2026-10-20', 'วันเกิด: 2007-03-15 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P2757166', 'XAYYAKEOPOUKHAM BOUAXAY', 'male', 'Lào', 'Sekong', 1, '505', DATE '2026-11-10', 'วันเกิด: 05/04/1989 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-015', 'KEOPIMAN LARTOUK', 'female', 'Lào', 'Salavan', 1, '108', DATE '2026-11-13', 'วันเกิด: 25/01/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-016', 'KHANPASERD PHETSAMAI', 'female', 'Lào', 'Salavan', 1, '108', DATE '2026-11-13', 'วันเกิด: 22/03/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-017', 'PHANTHAVONG MOUKDAVANH', 'female', 'Lào', 'Salavan', 1, '108', DATE '2026-11-13', 'วันเกิด: 14/09/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-018', 'SONENALEE BOUNNONG', 'female', 'Lào', 'Salavan', 1, '108', DATE '2026-11-13', 'วันเกิด: 28/01/1985 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-019', 'SOUDTHICHAK VIPHAVANH', 'female', 'Lào', 'Salavan', 1, '108', DATE '2026-11-13', 'วันเกิด: 21/09/1988 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-020', 'SOULIYA MENA', 'female', 'Lào', 'Salavan', 1, '108', DATE '2026-11-13', 'วันเกิด: 17/11/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-021', 'MANAKOUN PHANAVANH', 'female', 'Lào', 'Salavan', 1, '109', DATE '2026-11-13', 'วันเกิด: 16/10/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0538663', 'KEOPASEUTH Phetphachan', 'female', 'Lào', 'Savannakhet', 2, '104', DATE '2026-10-20', 'วันเกิด: 2009-10-15 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0563991', 'LATSABANDITH Naphalai', 'female', 'Lào', 'Savannakhet', 2, '104', DATE '2026-10-20', 'วันเกิด: 2008-01-11 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3227824', 'LOUNTHAVONG Piyathida', 'female', 'Lào', 'Savannakhet', 2, '104', DATE '2026-10-20', 'วันเกิด: 2009-01-01 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P2941453', 'SOUVANNASAN NIVONE', 'female', 'Lào', 'Savannakhet', 2, '104', DATE '2026-10-20', 'วันเกิด: 1992-07-11 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0567698', 'TANLAMANY Soukvaly', 'female', 'Lào', 'Savannakhet', 2, '104', DATE '2026-10-20', 'วันเกิด: 2008-07-31 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0548946', 'THAVONGSY Inpanh', 'female', 'Lào', 'Savannakhet', 2, '104', DATE '2026-10-20', 'วันเกิด: 2008-04-07 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0601322', 'CHITTAMANY Davone', 'female', 'Lào', 'Savannakhet', 2, '105', DATE '2026-10-20', 'วันเกิด: 2008-09-08 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P2837071', 'HEMMABOUTH Nambia', 'female', 'Lào', 'Savannakhet', 2, '105', DATE '2026-10-20', 'วันเกิด: 2008-12-03 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0543975', 'KHAMNOUANVICHIT Souksamone', 'female', 'Lào', 'Savannakhet', 2, '105', DATE '2026-10-20', 'วันเกิด: 2008-08-22 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0601324', 'NANTHAVONGSA Souksavanh', 'female', 'Lào', 'Savannakhet', 2, '105', DATE '2026-10-20', 'วันเกิด: 2009-11-02 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0590959', 'XAYALATH Alisa', 'female', 'Lào', 'Savannakhet', 2, '105', DATE '2026-10-20', 'วันเกิด: 2008-07-19 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P2866401', 'XAYAVONG Thidasavanh', 'female', 'Lào', 'Savannakhet', 2, '105', DATE '2026-10-20', 'วันเกิด: 2009-01-16 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0623458', 'SIHACHAK BOUNLEUA', 'male', 'Lào', 'Attapeu', 2, '114', DATE '2026-10-20', 'วันเกิด: 1987-11-05 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0584959', 'CHANTHALUEXAY KHAIMOUKDA', 'female', 'Lào', 'Attapeu', 2, '211', DATE '2026-10-20', 'วันเกิด: 2008-03-13 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0616333', 'CHANTHAMATH OUMKHAM', 'female', 'Lào', 'Attapeu', 2, '211', DATE '2026-10-20', 'วันเกิด: 2008-12-15 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0585699', 'FONGSAMOUT MELISA', 'female', 'Lào', 'Attapeu', 2, '211', DATE '2026-10-20', 'วันเกิด: 2009-04-20 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0615564', 'KHAMPASONG OYKHOUANH', 'female', 'Lào', 'Attapeu', 2, '211', DATE '2026-10-20', 'วันเกิด: 2009-11-05 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0589807', 'PHATHEPSAVATH MOUKSAVANH', 'female', 'Lào', 'Attapeu', 2, '211', DATE '2026-10-20', 'วันเกิด: 2009-04-12 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0582718', 'PHOMMAVONG PANCAKE', 'female', 'Lào', 'Attapeu', 2, '211', DATE '2026-10-20', 'วันเกิด: 2008-09-16 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P1981324', 'BUDPHARONGI PHANATDA', 'female', 'Lào', 'Sekong', 2, '212', DATE '2026-11-10', 'วันเกิด: 22/06/1986 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0585625', 'CHANTHAVONGSA PHOUTSADY', 'female', 'Lào', 'Sekong', 2, '212', DATE '2026-11-10', 'วันเกิด: 17/06/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P2038198', 'PHOMMALAILOUN SICHAN', 'female', 'Lào', 'Sekong', 2, '212', DATE '2026-11-10', 'วันเกิด: 12/01/1993 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0601964', 'SAMANOCHAK KHANPHASONE', 'female', 'Lào', 'Attapeu', 2, '212', DATE '2026-10-20', 'วันเกิด: 2009-07-28 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0599677', 'SONECHALERN PHONEPHANA', 'female', 'Lào', 'Sekong', 2, '212', DATE '2026-11-10', 'วันเกิด: 14/07/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0598433', 'VALINGSA NOUKY', 'female', 'Lào', 'Sekong', 2, '212', DATE '2026-11-10', 'วันเกิด: 07/03/2006 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0597677', 'CHANPADID NOK AIENG', 'female', 'Lào', 'Sekong', 2, '213', DATE '2026-11-10', 'วันเกิด: 08/08/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0583706', 'SENTHAVISOUK SOMPASONG', 'female', 'Lào', 'Sekong', 2, '213', DATE '2026-11-10', 'วันเกิด: 25/09/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0599676', 'SOMMIXAI NEKKHAM', 'female', 'Lào', 'Sekong', 2, '213', DATE '2026-11-10', 'วันเกิด: 07/11/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0608565', 'THATHILAST THEPPHACHAN', 'female', 'Lào', 'Sekong', 2, '213', DATE '2026-11-10', 'วันเกิด: 01/06/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P2438454', 'VANNOUVONG PHETNINDA', 'female', 'Lào', 'Sekong', 2, '213', DATE '2026-11-10', 'วันเกิด: 23/12/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0599675', 'VILAIVONG SOUKKHAM', 'female', 'Lào', 'Sekong', 2, '213', DATE '2026-11-10', 'วันเกิด: 13/04/2007 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3261724', 'BOUTDAVIENG KHANMANY', 'female', 'Lào', 'Sekong', 2, '214', DATE '2026-11-10', 'วันเกิด: 17/11/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3611536', 'KUKEO KANYA', 'female', 'Lào', 'Sekong', 2, '214', DATE '2026-11-10', 'วันเกิด: 08/08/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0602056', 'LUANGPHAKDY THIPPHAVAN', 'female', 'Lào', 'Sekong', 2, '214', DATE '2026-11-10', 'วันเกิด: 28/12/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0568494', 'PHENGSENGSAY NAMPHET', 'female', 'Lào', 'Sekong', 2, '214', DATE '2026-11-10', 'วันเกิด: 05/06/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0602328', 'SENGSULIVONG AUKSONE', 'female', 'Lào', 'Sekong', 2, '214', DATE '2026-11-10', 'วันเกิด: 05/01/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0584246', 'SINSOUNO NAMFON', 'female', 'Lào', 'Sekong', 2, '214', DATE '2026-11-10', 'วันเกิด: 31/07/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3598190', 'BOUNHEUANGSAK LINDA', 'female', 'Lào', 'Sekong', 2, '311', DATE '2026-11-10', 'วันเกิด: 15/07/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0591330', 'CHANPHANAXAY AOUDDA', 'female', 'Lào', 'Sekong', 2, '311', DATE '2026-11-10', 'วันเกิด: 27/08/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0600314', 'KEOBUAPHOUN SAIYFON', 'female', 'Lào', 'Sekong', 2, '311', DATE '2026-11-10', 'วันเกิด: 28/05/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0597323', 'KEODUANGDY PHETSAMONE', 'female', 'Lào', 'Sekong', 2, '311', DATE '2026-11-10', 'วันเกิด: 05/11/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0607911', 'THINLAMAM POUNA', 'female', 'Lào', 'Sekong', 2, '311', DATE '2026-11-10', 'วันเกิด: 24/12/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0600315', 'XAIYAMAN SILITA', 'female', 'Lào', 'Sekong', 2, '311', DATE '2026-11-10', 'วันเกิด: 26/03/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0612634', 'BOUNTHASONE MAYLY', 'female', 'Lào', 'Sekong', 2, '312', DATE '2026-11-10', 'วันเกิด: 07/12/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0607916', 'INTHILATH SINNAPHA', 'female', 'Lào', 'Sekong', 2, '312', DATE '2026-11-10', 'วันเกิด: 31/10/2007 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0611358', 'KEOMANILAI VANPHENG', 'female', 'Lào', 'Sekong', 2, '312', DATE '2026-11-10', 'วันเกิด: 24/12/2007 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('Q00842595', 'NGUYỄN MAI HOÀNG YẾN', 'female', 'Việt Nam', 'Sekong', 2, '312', DATE '2026-11-10', 'วันเกิด: 09/12/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027) | Người Việt Nam ở Lào'),
      ('PA0600313', 'THAMMAVONG MANISAKHONE', 'female', 'Lào', 'Sekong', 2, '312', DATE '2026-11-10', 'วันเกิด: 18/08/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3059303', 'XAIYAVONG NOUNGNING', 'female', 'Lào', 'Sekong', 2, '312', DATE '2026-11-10', 'วันเกิด: 07/08/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0598218', 'INTHILATH CHINDA', 'female', 'Lào', 'Sekong', 2, '313', DATE '2026-11-10', 'วันเกิด: 29/12/2007 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0615052', 'KHOTYOTHA KHANVAY', 'female', 'Lào', 'Attapeu', 2, '313', DATE '2026-10-20', 'วันเกิด: 1941-10-02 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0599553', 'KHOUN IN AOY', 'female', 'Lào', 'Sekong', 2, '313', DATE '2026-11-10', 'วันเกิด: 10/02/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0588676', 'PAPHATSALANG LATHDAVAN', 'female', 'Lào', 'Champasack', 2, '313', DATE '2026-10-20', 'วันเกิด: 2008-04-02 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0254148', 'CHALERNPHON JACKKY', 'male', 'Lào', 'Attapeu', 2, '314', DATE '2026-10-20', 'วันเกิด: 1998-05-23 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3047530', 'CHANTHASACK KHAMYOU', 'male', 'Lào', 'Attapeu', 2, '314', DATE '2026-10-20', 'วันเกิด: 2005-08-25 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0611392', 'CHANTHAVONG MACKHIW', 'male', 'Lào', 'Attapeu', 2, '314', DATE '2026-10-20', 'วันเกิด: 2008-04-02 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3116240', 'KHAMPHAKDY SENGSUVANH', 'male', 'Lào', 'Attapeu', 2, '314', DATE '2026-10-20', 'วันเกิด: 1994-11-03 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3145424', 'PHIMMASAN PHETTHAVONG', 'male', 'Lào', 'Attapeu', 2, '314', DATE '2026-10-20', 'วันเกิด: 1990-06-06 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0604715', 'XAYYALOUANG EM', 'male', 'Lào', 'Attapeu', 2, '314', DATE '2026-10-20', 'วันเกิด: 2007-11-03 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3373431', 'KANYAVONG XAIYADETH', 'male', 'Lào', 'Attapeu', 2, '411', DATE '2026-10-20', 'วันเกิด: 2008-07-19 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0609192', 'KONEVEHA SOMPHONE', 'male', 'Lào', 'Attapeu', 2, '411', DATE '2026-10-20', 'วันเกิด: 2008-04-09 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0589020', 'LUANGKING THAVIXAI', 'male', 'Lào', 'Attapeu', 2, '411', DATE '2026-10-20', 'วันเกิด: 2008-10-06 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P2786354', 'SISANON SOUKPASERT', 'male', 'Lào', 'Attapeu', 2, '411', DATE '2026-10-20', 'วันเกิด: 2009-03-06 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0597609', 'THAMMAVONG SANTIXAY', 'male', 'Lào', 'Attapeu', 2, '411', DATE '2026-10-20', 'วันเกิด: 2008-02-04 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0571122', 'XAYSAVANG BOUNSOUAN', 'male', 'Lào', 'Attapeu', 2, '411', DATE '2026-10-20', 'วันเกิด: 2008-10-03 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('N2177544', 'GIANG CHÔN NY', 'male', 'Việt Nam', 'Attapeu', 2, '412', DATE '2026-10-20', 'วันเกิด: 2008-12-28 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027) | Người Việt Nam ở Lào'),
      ('P3451050', 'INTHASOMBAD SANASAI', 'male', 'Lào', 'Champasack', 2, '412', DATE '2026-10-20', 'วันเกิด: 2006-11-15 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0562761', 'KONGMANY HATMIXAY', 'male', 'Lào', 'Champasack', 2, '412', DATE '2026-10-20', 'วันเกิด: 2008-10-30 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3292523', 'SISAVATDY THAVONE', 'male', 'Lào', 'Champasack', 2, '412', DATE '2026-10-20', 'วันเกิด: 2008-09-10 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-091', 'BOUDKHOUN CHAIPASONG', 'female', 'Lào', 'Salavan', 2, '413', DATE '2026-11-13', 'วันเกิด: 24/06/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-092', 'MEUNLAD SABAITHIP', 'female', 'Lào', 'Salavan', 2, '413', DATE '2026-11-13', 'วันเกิด: 26/12/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-093', 'PHIMMAVONGSA PHONESY', 'female', 'Lào', 'Salavan', 2, '413', DATE '2026-11-13', 'วันเกิด: 09/03/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-094', 'VONGSALY VADSANA', 'female', 'Lào', 'Salavan', 2, '413', DATE '2026-11-13', 'วันเกิด: 05/10/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-095', 'XAISOMVANG LOUNNY', 'female', 'Lào', 'Salavan', 2, '413', DATE '2026-11-13', 'วันเกิด: 28/11/2007 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-096', 'XAYSAVANH PAVINA', 'female', 'Lào', 'Salavan', 2, '413', DATE '2026-11-13', 'วันเกิด: 03/07/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-097', 'DONETAVAN CHANSAMOUD', 'female', 'Lào', 'Salavan', 2, '414', DATE '2026-11-13', 'วันเกิด: 09/03/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-098', 'PHOMMASOUNTHONE THIPMANY', 'female', 'Lào', 'Salavan', 2, '414', DATE '2026-11-13', 'วันเกิด: 13/03/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-099', 'PHONGSAVATH KHONGTAVAN', 'female', 'Lào', 'Salavan', 2, '414', DATE '2026-11-13', 'วันเกิด: 21/08/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-100', 'SENTHAVISOUK VINITSA', 'female', 'Lào', 'Salavan', 2, '414', DATE '2026-11-13', 'วันเกิด: 10/06/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-101', 'SIVILAY THIPDOUANGCHAI', 'female', 'Lào', 'Salavan', 2, '414', DATE '2026-11-13', 'วันเกิด: 04/01/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-102', 'VONGNADY PALINA', 'female', 'Lào', 'Salavan', 2, '414', DATE '2026-11-13', 'วันเกิด: 28/03/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-103', 'KHAMSOPHA SAOVALAK', 'female', 'Lào', 'Salavan', 2, '511', DATE '2026-11-13', 'วันเกิด: 20/09/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-104', 'PANGVILAY PHONEMINA', 'female', 'Lào', 'Salavan', 2, '511', DATE '2026-11-13', 'วันเกิด: 14/03/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-105', 'RATTHAHAO KITSANA', 'male', 'Lào', 'Salavan', 2, '511', DATE '2026-11-13', 'วันเกิด: 06/09/1992 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-106', 'SAENGCHANTHAVONG MEKKHALA', 'female', 'Lào', 'Salavan', 2, '511', DATE '2026-11-13', 'วันเกิด: 22/01/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-107', 'LATSAMIVONG VIET', 'male', 'Lào', 'Salavan', 2, '512', DATE '2026-11-13', 'วันเกิด: 18/11/2010 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-108', 'PHIMPHISAN PHOUKEO', 'male', 'Lào', 'Salavan', 2, '512', DATE '2026-11-13', 'วันเกิด: 19/11/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-109', 'PHOTHILAK CHANTHAPHONE', 'male', 'Lào', 'Salavan', 2, '512', DATE '2026-11-13', 'วันเกิด: 10/11/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-110', 'VONGCHOMSY KALOUNA', 'male', 'Lào', 'Salavan', 2, '512', DATE '2026-11-13', 'วันเกิด: 10/03/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('KTX-SAL-111', 'SINGSAVATH SOUKIED', 'male', 'Lào', 'Salavan', 2, '513', DATE '2026-11-13', 'วันเกิด: 17/11/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0613712', 'SINGSOUVONG AMY', 'female', 'Lào', 'Champasack', 3, '301', DATE '2026-10-20', 'วันเกิด: 2009-12-07 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3600338', 'VANTHAVIXAY PONGKHUAN', 'female', 'Lào', 'Champasack', 3, '301', DATE '2026-10-20', 'วันเกิด: 2007-09-24 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0583111', 'PHOUYPASEUTH SISOUDA', 'female', 'Lào', 'Sekong', 3, '303', DATE '2026-11-10', 'วันเกิด: 13/02/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027) | Tự túc'),
      ('PA057066', 'BOUNYADET ALISA', 'female', 'Lào', 'Champasack', 3, '306', DATE '2026-10-20', 'วันเกิด: 2008-07-05 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0580901', 'CHANTHABANDIT INTHAWAR', 'female', 'Lào', 'Champasack', 3, '306', DATE '2026-10-20', 'วันเกิด: 2008-06-22 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0589008', 'BOUTCHANYA VANPHENG', 'female', 'Lào', 'Champasack', 3, '307', DATE '2026-10-20', 'วันเกิด: 2006-02-13 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0579957', 'THEPSOUVANH MESA', 'female', 'Lào', 'Champasack', 3, '307', DATE '2026-10-20', 'วันเกิด: 2009-04-16 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0583709', 'XAYTHANASY OLADY', 'female', 'Lào', 'Champasack', 3, '307', DATE '2026-10-20', 'วันเกิด: 2009-05-13 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0526944', 'NENGNOUVANG MAIMEE', 'female', 'Lào', 'Borikhamxay', 3, '309', DATE '2026-10-20', 'วันเกิด: 2008-09-15 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0556019', 'SAXAYYALATH KAYKEO', 'female', 'Lào', 'Borikhamxay', 3, '309', DATE '2026-10-20', 'วันเกิด: 2008-09-19 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0579244', 'SINGMAVONG SOUKSENGDAO', 'female', 'Lào', 'Borikhamxay', 3, '309', DATE '2026-10-20', 'วันเกิด: 2008-09-12 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0567460', 'THEPBOULY KEOMANIKHAM', 'female', 'Lào', 'Borikhamxay', 3, '309', DATE '2026-10-20', 'วันเกิด: 2008-10-15 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0554383', 'XIONGLAVANG PHANLANY', 'female', 'Lào', 'Borikhamxay', 3, '309', DATE '2026-10-20', 'วันเกิด: 2008-01-22 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0613447', 'BOUTSILI DALING', 'female', 'Lào', 'Champasack', 3, '401', DATE '2026-10-20', 'วันเกิด: 2008-05-03 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P2639626', 'DANGVINA MINTA', 'female', 'Lào', 'Champasack', 3, '401', DATE '2026-10-24', 'วันเกิด: 2008-09-04 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027) | HB Hội người Việt'),
      ('PA0490010', 'PHALINTHONE THITSAVANH', 'female', 'Lào', 'Champasack', 3, '401', DATE '2026-10-20', 'วันเกิด: 1990-09-29 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P2369555', 'CHOUNLAMANY XAYSETTHA', 'male', 'Lào', 'Savannakhet', 3, '404', DATE '2026-10-20', 'วันเกิด: 2000-10-29 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3329665', 'XAYASITH ALIYAKONE', 'male', 'Lào', 'Savannakhet', 3, '404', DATE '2026-10-20', 'วันเกิด: 1985-02-22 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0567930', 'KEOSAVANG XAYXANA', 'male', 'Lào', 'Borikhamxay', 3, '405', DATE '2026-10-20', 'วันเกิด: 2008-05-18 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3116654', 'THANONGSAK THAVIXAP', 'male', 'Lào', 'Borikhamxay', 3, '405', DATE '2026-10-20', 'วันเกิด: 2008-12-07 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3583910', 'THIPPHACHAN THANONGSIN', 'male', 'Lào', 'Borikhamxay', 3, '405', DATE '2026-10-20', 'วันเกิด: 2009-01-20 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3242413', 'NANTHANAVONE CHIENG', 'male', 'Lào', 'Savannakhet', 3, '406', DATE '2026-10-20', 'วันเกิด: 1986-05-07 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3543342', 'PHOMSAMOUTH SITHSAVED', 'male', 'Lào', 'Savannakhet', 3, '406', DATE '2026-10-20', 'วันเกิด: 1990-03-12 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0613195', 'TAIYAVONG SOUVANNAHONGTHONG', 'male', 'Lào', 'Savannakhet', 3, '406', DATE '2026-10-20', 'วันเกิด: 1993-08-04 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P2696343', 'PHAISITH Xaypeexa', 'male', 'Lào', 'Savannakhet', 3, '407', DATE '2026-10-20', 'วันเกิด: 2007-05-03 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0582862', 'ITSALA Hatkhounmy', 'male', 'Lào', 'Savannakhet', 3, '408', DATE '2026-10-20', 'วันเกิด: 2009-07-16 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3114832', 'SENGVILAY Ekkasith', 'male', 'Lào', 'Savannakhet', 3, '409', DATE '2026-10-20', 'วันเกิด: 2008-11-09 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3013217', 'SOUVANNASING Thatsaphone', 'male', 'Lào', 'Savannakhet', 3, '410', DATE '2026-10-20', 'วันเกิด: 2007-08-07 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0521274', 'VONGXAY Kitsanonh', 'male', 'Lào', 'Savannakhet', 3, '410', DATE '2026-10-20', 'วันเกิด: 2008-05-12 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0616321', 'KHOUAMANY SAMAKKHY', 'male', 'Lào', 'Sekong', 3, '501', DATE '2026-11-10', 'วันเกิด: 21/08/2009 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027) | Tự túc'),
      ('P2941387', 'CHANTHAVONG Phounsouk', 'male', 'Lào', 'Savannakhet', 3, '504', DATE '2026-10-20', 'วันเกิด: 2008-09-12 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0533684', 'BOUTTHI NARAPHAT', 'male', 'Lào', 'Sekong', 3, '506', DATE '2026-11-10', 'วันเกิด: 07/10/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0602061', 'MALIXAY THENDA', 'male', 'Lào', 'Sekong', 3, '506', DATE '2026-11-10', 'วันเกิด: 28/01/2010 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0607912', 'MENGMASONE CHONNY', 'male', 'Lào', 'Sekong', 3, '506', DATE '2026-11-10', 'วันเกิด: 21/02/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0607915', 'PHAXAY KANLAYA', 'male', 'Lào', 'Sekong', 3, '506', DATE '2026-11-10', 'วันเกิด: 27/09/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0612635', 'VATSANGA SENGSANAMXAI', 'male', 'Lào', 'Sekong', 3, '506', DATE '2026-11-10', 'วันเกิด: 18/08/2004 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0571132', 'XAYKEOYAVONG DINO', 'male', 'Lào', 'Sekong', 3, '506', DATE '2026-11-10', 'วันเกิด: 01/10/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0600307', 'KEOPHICHIT KHONESAVANH', 'male', 'Lào', 'Sekong', 3, '507', DATE '2026-11-10', 'วันเกิด: 29/07/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0597676', 'KEOXAIYAVONG KONGKHAM', 'male', 'Lào', 'Sekong', 3, '507', DATE '2026-11-10', 'วันเกิด: 29/07/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0574342', 'MANIVANH MILO', 'male', 'Lào', 'Sekong', 3, '507', DATE '2026-11-10', 'วันเกิด: 10/10/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0561174', 'NATSAVAN SONETHIDATE', 'male', 'Lào', 'Sekong', 3, '507', DATE '2026-11-10', 'วันเกิด: 05/10/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0583245', 'PHOUANGCHANPHEANG PASIT', 'male', 'Lào', 'Sekong', 3, '507', DATE '2026-11-10', 'วันเกิด: 20/05/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027) | Tự túc'),
      ('P3378087', 'SONECHALEUN KHAMSING', 'male', 'Lào', 'Sekong', 3, '507', DATE '2026-11-10', 'วันเกิด: 31/08/2008 | วันกลับ: 20/10/2027 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3345383', 'CHANTHAPHASOUK KHAMPASEUT', 'male', 'Lào', 'Champasack', 3, '508', DATE '2026-10-20', 'วันเกิด: 2008-12-30 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3613460', 'HEAUNGSACK VINDA', 'male', 'Lào', 'Champasack', 3, '508', DATE '2026-10-20', 'วันเกิด: 2007-12-18 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3349425', 'KEOPASEUTH XAYAPHONE', 'male', 'Lào', 'Champasack', 3, '508', DATE '2026-10-20', 'วันเกิด: 2007-08-18 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0615913', 'LUESASIN PHETNIKONE', 'male', 'Lào', 'Champasack', 3, '508', DATE '2026-10-20', 'วันเกิด: 2009-02-05 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0613403', 'SIPHANDONE KHOUNTHAVY', 'male', 'Lào', 'Champasack', 3, '508', DATE '2026-10-20', 'วันเกิด: 2008-09-14 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3014517', 'SOMBATDOUANG BOUNPASEUT', 'male', 'Lào', 'Champasack', 3, '508', DATE '2026-10-20', 'วันเกิด: 2007-04-18 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0539919', 'DOUANGSAVANH SAITHANG', 'male', 'Lào', 'Champasack', 3, '509', DATE '2026-10-20', 'วันเกิด: 2008-08-03 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P2726012', 'KEOCHAMPA BOUNKEUTH', 'male', 'Lào', 'Champasack', 3, '509', DATE '2026-10-20', 'วันเกิด: 2009-10-04 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0533874', 'SIBOUNHEUANG THEPVILAY', 'male', 'Lào', 'Champasack', 3, '509', DATE '2026-10-20', 'วันเกิด: 2007-08-21 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P2975768', 'THONGPASOME LAPHAXAY', 'male', 'Lào', 'Champasack', 3, '509', DATE '2026-10-20', 'วันเกิด: 1981-09-10 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3103754', 'VONGSAKDA SAKPASIT', 'male', 'Lào', 'Champasack', 3, '509', DATE '2026-10-20', 'วันเกิด: 2005-02-07 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0311335', 'XAYASENG XAYASAK', 'male', 'Lào', 'Champasack', 3, '509', DATE '2026-10-20', 'วันเกิด: 1997-01-30 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0613588', 'BUTTHAVI CHANTHAKAISONE', 'male', 'Lào', 'Champasack', 3, '510', DATE '2026-10-20', 'วันเกิด: 1992-01-24 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0620185', 'CHANLIVONG VONGSAVANH', 'male', 'Lào', 'Champasack', 3, '510', DATE '2026-10-20', 'วันเกิด: 2006-10-30 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('PA0612427', 'MUEN ANUKOUN SOUKVIXAI', 'male', 'Lào', 'Champasack', 3, '510', DATE '2026-10-20', 'วันเกิด: 1992-10-10 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P2841599', 'SENTHAVISOUK XAYYASIT', 'male', 'Lào', 'Champasack', 3, '510', DATE '2026-10-24', 'วันเกิด: 2008-10-18 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027) | HB Hội người Việt'),
      ('P2741999', 'SILIPHONEPHAN KHANSAVANH', 'male', 'Lào', 'Champasack', 3, '510', DATE '2026-10-20', 'วันเกิด: 1994-08-04 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027)'),
      ('P3339285', 'VILAYSACK SOMLAK', 'male', 'Lào', 'Champasack', 3, '510', DATE '2026-10-24', 'วันเกิด: 2006-10-30 | วันกลับ: 2027-10-20 | ກຽມພາສາຫວຽດ (2026-2027) | HB Hội người Việt')
    ) AS st(student_code, full_name, gender, country, province, b_num, r_num, check_in, notes)
  LOOP
    v_bld_id := CASE rec.b_num WHEN 1 THEN v_bld_1 WHEN 2 THEN v_bld_2 ELSE v_bld_3 END;
    SELECT id INTO v_room_id FROM public.rooms
      WHERE building_id = v_bld_id AND (room_number = rec.r_num OR room_number ~ ('(^|\D)' || rec.r_num || '$')) LIMIT 1;
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
