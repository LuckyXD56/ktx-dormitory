# Dormitory Management System (ระบบจัดการหอพัก / Hệ thống Quản lý Ký túc xá)

ระบบบริหารจัดการหอพักนักศึกษาแบบครบวงจรสำหรับผู้ดูแลและเจ้าหน้าที่ (Admin / Staff / Super Admin) รองรับ 2 ภาษา (**ภาษาไทย** และ **ภาษาเวียดนาม**) เชื่อมต่อฐานข้อมูลจริงและระบบยืนยันตัวตนผ่าน **Supabase**

## ฟีเจอร์หลัก (Features)

1. **หน้า Dashboard & Mobile Quick Control**: ภาพรวมจำนวนสมาชิก, ห้องว่าง, ยอดค้างชำระ, คนไม่กลับเข้าหอ, กราฟรายรับและการเข้าพักแยกตามอาคาร และศูนย์ควบคุมด่วนสำหรับเปิดดูบนมือถือ
2. **ระบบจัดการสมาชิก (`/members`)**: เพิ่ม ลบ แก้ไข ค้นหา กรอง และเรียงลำดับข้อมูลนักศึกษาครบทุกฟิลด์ (รหัสนักศึกษา, ชื่อ-สกุล, รูปโปรไฟล์, เพศ, ประเทศ, แขวง/จังหวัด, เบอร์โทร, ห้อง/อาคาร, วันที่เข้าพัก, สถานะ, หมายเหตุ)
3. **ระบบจัดการห้องพัก (`/rooms`)**: จัดการอาคาร ห้องพัก ความจุ ค่าห้อง ตรวจสอบห้องว่าง รายชื่อผู้พักในแต่ละห้อง และย้ายสมาชิกระหว่างห้อง (พร้อม Trigger ตรวจสอบความจุอัตโนมัติใน PostgreSQL)
4. **ระบบเช็กชื่อเข้า-ออก (`/attendance`)**: เช็กชื่อด่วน 1 คลิก (เข้าหอ / ออกหอ / มาสาย / ไม่กลับเข้าหอ), แจ้งเตือนสมาชิกที่ยังไม่กลับเข้าหอ และประวัติย้อนหลัง
5. **ระบบจัดการค่าธรรมเนียม (`/fees`)**: สร้างบิลค่าห้องประจำเดือนอัตโนมัติ, บันทึกการชำระเงิน, ตรวจสอบคนจ่ายแล้ว/ยังไม่จ่าย, สรุปรายรับ และพิมพ์ใบเสร็จรับเงิน
6. **ระบบกฎระเบียบและการทำผิด (`/violations`)**: บันทึกการกระทำผิด แนบภาพหลักฐาน ระบุบทลงโทษ และติดตามสถานะ
7. **ระบบประกาศข่าวสาร (`/announcements`)**: สร้างประกาศทั้งหอ เฉพาะอาคาร หรือเฉพาะห้อง พร้อมปักหมุด
8. **ระบบรายงาน (`/reports`)**: ส่งออกไฟล์ **Excel (`.xlsx`)** และพิมพ์/บันทึกเป็น **PDF** ได้ครบทั้ง 5 ประเภทรายงาน
9. **ระบบบัญชีผู้ใช้งาน (`/users`)**: แบ่งสิทธิ์ `super_admin`, `admin`, `staff` พร้อม Row Level Security (RLS)

---

## วิธีติดตั้งและเริ่มต้นใช้งาน (Setup Guide)

### 1. สร้างโปรเจกต์บน Supabase และรันสคริปต์ฐานข้อมูล
1. เข้าไปที่ [Supabase Dashboard](https://supabase.com/dashboard) แล้วสร้างโปรเจกต์ใหม่
2. ไปที่ **SQL Editor → New Query**
3. คัดลอกคำสั่งทั้งหมดจากไฟล์ [`supabase/schema.sql`](./supabase/schema.sql) ไปรัน (จะสร้างตาราง, Trigger, RLS และ Storage Bucket `dorm-files`)
4. *(ทางเลือก)* หากต้องการข้อมูลตัวอย่าง (อาคาร, ห้องพัก, สมาชิก, บิล, ประวัติเช็กชื่อ) ให้รันไฟล์ [`supabase/seed.sql`](./supabase/seed.sql) ต่อได้เลย

### 2. ตั้งค่า Environment Variables
คัดลอกไฟล์ `.env.example` เป็น `.env.local`:
```bash
cp .env.example .env.local
```
แล้วนำค่าจาก **Supabase Dashboard → Project Settings → API** มาใส่:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### 3. ติดตั้ง Dependencies และรันเว็บไซต์
```bash
npm install
npm run dev
```
เปิดเบราว์เซอร์ไปที่ `http://localhost:3000` ระบบจะพาไปหน้า `/login` สามารถกด **"ลงทะเบียนเจ้าหน้าที่ใหม่"** เพื่อสร้างบัญชีแรก ซึ่งระบบจะกำหนดสิทธิ์ **`super_admin`** ให้โดยอัตโนมัติครับ

---

## วิธี Deploy ขึ้นออนไลน์ด้วย Vercel (เปิดใช้งานจากมือถือได้ทุกที่)

### 1. เตรียมโปรเจกต์และอัปโหลดขึ้น GitHub
```bash
git status
# ตรวจสอบให้แน่ใจว่าไฟล์ .env.local ไม่อยู่ในรายการที่จะ commit (ถูก .gitignore บังไว้แล้ว)
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

### 2. Import โปรเจกต์เข้า Vercel
1. ไปที่ [Vercel Dashboard](https://vercel.com/new) แล้วเลือก **Import Git Repository** จาก GitHub ของคุณ
2. ในหัวข้อ **Environment Variables** ให้เพิ่มตัวแปรจาก `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - *(ทางเลือก)* `SUPABASE_SERVICE_ROLE_KEY` — ใส่เมื่อต้องการใช้ปุ่มสร้างบัญชีเจ้าหน้าที่ใหม่โดยตรงจากหน้า `/users`
3. กด **Deploy**

### 3. ตั้งค่า URL บน Supabase (สำคัญหลัง Deploy)
1. ไปที่ **Supabase Dashboard → Authentication → URL Configuration**
2. ตั้งค่า **Site URL** เป็นโดเมน Vercel ของคุณ (เช่น `https://your-ktx-app.vercel.app`)
3. เพิ่ม `https://your-ktx-app.vercel.app/**` ลงใน **Redirect URLs** แล้วกดบันทึก
