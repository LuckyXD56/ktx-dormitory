export type UserRole = "super_admin" | "admin" | "staff" | "student";
export type Language = "th" | "vi" | "en" | "zh" | "lo";

export type GenderPolicy = "male" | "female" | "mixed";
export type RoomStatus = "available" | "full" | "maintenance";
export type MemberGender = "male" | "female" | "other";
export type MemberStatus = "active" | "on_leave" | "checked_out" | "suspended";
export type AttendanceLogType = "check_in" | "check_out" | "late" | "absent";
export type FeeType = "room_fee" | "water" | "electricity" | "fine" | "other";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type PaymentMethod = "cash" | "transfer" | "qr" | "other";
export type ViolationSeverity = "low" | "medium" | "high";
export type ViolationStatus = "pending" | "resolved" | "appealed";
export type AnnouncementCategory =
  | "meeting"
  | "cleaning"
  | "inspection"
  | "rules"
  | "activity"
  | "general";
export type AnnouncementScope = "all" | "building" | "room";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  preferred_language: Language;
  room_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Building {
  id: string;
  code: string;
  name: string;
  total_floors: number;
  gender_policy: GenderPolicy;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  building_id: string;
  room_number: string;
  floor: number;
  capacity: number;
  monthly_fee: number;
  status: RoomStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  building?: Building | null;
}

export interface Member {
  id: string;
  student_code: string;
  full_name: string;
  avatar_url: string | null;
  gender: MemberGender;
  country: string;
  province: string;
  phone: string;
  room_id: string | null;
  check_in_date: string;
  status: MemberStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  room?: (Room & { building?: Building | null }) | null;
}

export interface UtilityReading {
  id: string;
  room_id: string;
  billing_month: string;
  elec_prev: number;
  elec_curr: number;
  elec_rate: number;
  water_prev: number;
  water_curr: number;
  water_rate: number;
  elec_amount: number;
  water_amount: number;
  billed_to_payments: boolean;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
  room?: (Room & { building?: Building | null }) | null;
}

export interface AttendanceLog {
  id: string;
  member_id: string;
  log_type: AttendanceLogType;
  recorded_at: string;
  is_late: boolean;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  member?: Member | null;
  recorder?: Pick<Profile, "id" | "full_name" | "role"> | null;
}

export interface Payment {
  id: string;
  member_id: string;
  room_id: string | null;
  billing_month: string;
  fee_type: FeeType;
  amount: number;
  paid_amount: number;
  status: PaymentStatus;
  due_date: string | null;
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  receipt_number: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
  member?: Member | null;
  room?: (Room & { building?: Building | null }) | null;
}

export interface UtilityReading {
  id: string;
  room_id: string;
  billing_month: string;
  elec_prev: number;
  elec_curr: number;
  elec_rate: number;
  water_prev: number;
  water_curr: number;
  water_rate: number;
  elec_amount: number;
  water_amount: number;
  billed_to_payments: boolean;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
  room?: (Room & { building?: Building | null }) | null;
}

export interface Violation {
  id: string;
  member_id: string;
  violation_type: string;
  severity: ViolationSeverity;
  occurred_at: string;
  description: string;
  evidence_url: string | null;
  penalty: string;
  status: ViolationStatus;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
  member?: Member | null;
  recorder?: Pick<Profile, "id" | "full_name" | "role"> | null;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  target_scope: AnnouncementScope;
  target_building_id: string | null;
  target_room_id: string | null;
  is_pinned: boolean;
  published_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  building?: Building | null;
  room?: Room | null;
  author?: Pick<Profile, "id" | "full_name" | "role"> | null;
}
