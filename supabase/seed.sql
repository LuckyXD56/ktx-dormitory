-- ============================================================================
-- Optional Sample Seed Data for Dormitory Management System
-- 3 Buildings (A, B, C) x 5 Floors each
-- Run this AFTER running supabase/schema.sql in Supabase SQL Editor
-- ============================================================================

INSERT INTO public.buildings (code, name, total_floors, gender_policy, description)
VALUES
  ('A', 'อาคาร A (หอพักชาย)', 5, 'male', 'อาคารหอพักนักศึกษาชาย 5 ชั้น'),
  ('B', 'อาคาร B (หอพักหญิง)', 5, 'female', 'อาคารหอพักนักศึกษาหญิง 5 ชั้น'),
  ('C', 'อาคาร C (หอพักนานาชาติ)', 5, 'mixed', 'อาคารหอพักรวมและนักศึกษาแลกเปลี่ยน 5 ชั้น')
ON CONFLICT (code) DO UPDATE SET total_floors = GREATEST(public.buildings.total_floors, 5);

-- Generate 4 rooms per floor across all 5 floors for Buildings A, B, C
INSERT INTO public.rooms (building_id, room_number, floor, capacity, monthly_fee, status, notes)
SELECT
  b.id,
  b.code || fl::text || lpad(rm::text, 2, '0'),
  fl,
  4,
  CASE WHEN fl >= 4 THEN 3000.00 ELSE 2500.00 END,
  'available',
  'ชั้น ' || fl::text
FROM public.buildings b
CROSS JOIN generate_series(1, 5) AS fl
CROSS JOIN generate_series(1, 4) AS rm
WHERE b.code IN ('A', 'B', 'C')
ON CONFLICT (building_id, room_number) DO NOTHING;

-- Insert sample members
WITH r AS (
  SELECT r.id, r.room_number
  FROM public.rooms r
)
INSERT INTO public.members (student_code, full_name, gender, country, province, phone, room_id, check_in_date, status, notes)
SELECT v.student_code, v.full_name, v.gender, v.country, v.province, v.phone, r.id, v.check_in_date::date, v.status, v.notes
FROM (
  VALUES
    ('6701001', 'สมชาย ใจดี', 'male', 'ไทย', 'กรุงเทพมหานคร', '081-234-5678', 'A101', '2026-06-01', 'active', 'หัวหน้าห้อง A101'),
    ('6701002', 'Nguyễn Văn Minh', 'male', 'เวียดนาม', 'Hà Nội', '082-345-6789', 'A101', '2026-06-02', 'active', 'นักศึกษาแลกเปลี่ยน'),
    ('6701003', 'กิตติพงษ์ รักเรียน', 'male', 'ไทย', 'เชียงใหม่', '083-456-7890', 'A201', '2026-06-05', 'active', ''),
    ('6701004', 'Trần Thị Lan', 'female', 'เวียดนาม', 'TP. Hồ Chí Minh', '084-567-8901', 'B101', '2026-06-01', 'active', 'หัวหน้าห้อง B101'),
    ('6701005', 'ปิยะนุช สุขสันต์', 'female', 'ไทย', 'ขอนแก่น', '085-678-9012', 'B101', '2026-06-03', 'active', ''),
    ('6701006', 'Lê Hoàng Nam', 'male', 'เวียดนาม', 'Đà Nẵng', '086-789-0123', 'C101', '2026-07-01', 'on_leave', 'กลับบ้านช่วงสุดสัปดาห์')
) AS v(student_code, full_name, gender, country, province, phone, room_number, check_in_date, status, notes)
JOIN r ON r.room_number = v.room_number
ON CONFLICT (student_code) DO NOTHING;

-- Insert sample payments for current month
INSERT INTO public.payments (member_id, room_id, billing_month, fee_type, amount, paid_amount, status, due_date, paid_at, payment_method, receipt_number, notes)
SELECT
  m.id,
  m.room_id,
  to_char(CURRENT_DATE, 'YYYY-MM'),
  'room_fee',
  r.monthly_fee,
  CASE WHEN m.student_code IN ('6701001', '6701004') THEN r.monthly_fee ELSE 0 END,
  CASE WHEN m.student_code IN ('6701001', '6701004') THEN 'paid' ELSE 'unpaid' END,
  (date_trunc('month', CURRENT_DATE) + interval '5 days')::date,
  CASE WHEN m.student_code IN ('6701001', '6701004') THEN now() ELSE NULL END,
  CASE WHEN m.student_code IN ('6701001', '6701004') THEN 'transfer' ELSE NULL END,
  CASE WHEN m.student_code IN ('6701001', '6701004') THEN 'RCP-' || to_char(CURRENT_DATE, 'YYYYMM') || '-' || right(m.student_code, 3) ELSE NULL END,
  'ค่าห้องพักประจำเดือน'
FROM public.members m
JOIN public.rooms r ON r.id = m.room_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.payments p
  WHERE p.member_id = m.id AND p.billing_month = to_char(CURRENT_DATE, 'YYYY-MM')
);

-- Insert sample attendance logs
INSERT INTO public.attendance_logs (member_id, log_type, recorded_at, is_late, notes)
SELECT m.id, v.log_type, now() - (v.hours_ago || ' hours')::interval, v.is_late, v.notes
FROM public.members m
JOIN (
  VALUES
    ('6701001', 'check_in', 2, false, 'กลับเข้าหอเรียบร้อย'),
    ('6701002', 'late', 1, true, 'กลับเข้าหอหลัง 22:30 น.'),
    ('6701003', 'check_out', 5, false, 'ออกไปทำรายงานนอกหอ ยังไม่กลับ'),
    ('6701004', 'check_in', 3, false, 'เข้าหอตรงเวลา'),
    ('6701005', 'absent', 10, true, 'ไม่กลับเข้าหอตามเวลาที่กำหนด')
) AS v(student_code, log_type, hours_ago, is_late, notes)
  ON m.student_code = v.student_code;

-- Insert sample violation
INSERT INTO public.violations (member_id, violation_type, severity, occurred_at, description, penalty, status)
SELECT m.id, 'curfew', 'low', now() - interval '1 day', 'กลับเข้าหอพักหลังเวลาปิดประตู 23:00 น.', 'ตักเตือนครั้งที่ 1', 'pending'
FROM public.members m
WHERE m.student_code = '6701002'
  AND NOT EXISTS (SELECT 1 FROM public.violations WHERE member_id = m.id);

-- Insert sample announcements
INSERT INTO public.announcements (title, content, category, target_scope, is_pinned, published_at)
VALUES
  (
    'ประชุมชี้แจงกฎระเบียบหอพักประจำภาคเรียน / Họp phổ biến nội quy KTX',
    'ขอให้นักศึกษาทุกคนเข้าร่วมประชุม ณ ห้องโถงชั้น 1 เวลา 19:00 น. / Đề nghị toàn thể sinh viên tham dự họp tại sảnh tầng 1 lúc 19:00.',
    'meeting',
    'all',
    true,
    now()
  ),
  (
    'แจ้งตรวจความสะอาดห้องพักประจำสัปดาห์ / Thông báo kiểm tra vệ sinh phòng',
    'เจ้าหน้าที่จะเข้าตรวจความสะอาดห้องพักทุกวันเสาร์ เวลา 10:00 น. / Nhân viên sẽ kiểm tra vệ sinh phòng vào 10:00 sáng thứ Bảy hàng tuần.',
    'cleaning',
    'all',
    false,
    now() - interval '6 hours'
  );
