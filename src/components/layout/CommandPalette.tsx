"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getCached, isCacheFresh, setCached } from "@/lib/cache";
import { useI18n } from "@/lib/i18n";

interface QuickMember {
  id: string;
  full_name: string;
  student_code: string;
  room_number?: string;
}

interface QuickRoom {
  id: string;
  room_number: string;
  floor: number;
  status: string;
  building_code?: string;
}

interface CommandIndex {
  members: QuickMember[];
  rooms: QuickRoom[];
}

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  group: "nav" | "member" | "room";
  icon: React.ReactNode;
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => setMounted(true), []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [indexData, setIndexData] = useState<CommandIndex>(
    () =>
      getCached<CommandIndex>("command_index", 120_000) ?? {
        members: [],
        rooms: [],
      }
  );

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const tId = window.setTimeout(() => inputRef.current?.focus(), 20);

    const loadIndex = async () => {
      const supabase = createClient();
      if (!supabase) return;
      if (isCacheFresh("command_index", 25_000)) {
        const cached = getCached<CommandIndex>("command_index", 120_000);
        if (cached) {
          setIndexData(cached);
          return;
        }
      }
      const [memRes, roomRes] = await Promise.all([
        supabase
          .from("members")
          .select("id, full_name, student_code, room:rooms(room_number)")
          .order("full_name")
          .limit(200),
        supabase
          .from("rooms")
          .select("id, room_number, floor, status, building:buildings(code)")
          .order("room_number")
          .limit(200),
      ]);
      const members: QuickMember[] = (memRes.data ?? []).map((m: Record<string, unknown>) => ({
        id: String(m.id),
        full_name: String(m.full_name ?? ""),
        student_code: String(m.student_code ?? ""),
        room_number:
          m.room && typeof m.room === "object"
            ? String((m.room as { room_number?: string }).room_number ?? "")
            : undefined,
      }));
      const rooms: QuickRoom[] = (roomRes.data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        room_number: String(r.room_number ?? ""),
        floor: Number(r.floor ?? 1),
        status: String(r.status ?? "available"),
        building_code:
          r.building && typeof r.building === "object"
            ? String((r.building as { code?: string }).code ?? "")
            : undefined,
      }));
      const next = { members, rooms };
      setIndexData(next);
      setCached("command_index", next);
    };
    loadIndex();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(tId);
    };
  }, [open]);

  const items = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();
    const isVi = lang === "vi";

    const navItems: CommandItem[] = [
      {
        id: "nav-dash",
        title: t.nav.dashboard,
        subtitle: isVi ? "Tổng quan KTX" : "ภาพรวมระบบหอพัก",
        href: "/",
        group: "nav",
        icon: <LayoutDashboard className="h-4 w-4 text-primary" />,
      },
      {
        id: "nav-members",
        title: t.nav.members,
        subtitle: isVi ? "Thêm / sửa thành viên" : "เพิ่ม ลบ แก้ไขรายชื่อสมาชิก",
        href: "/members",
        group: "nav",
        icon: <Users className="h-4 w-4 text-primary" />,
      },
      {
        id: "nav-rooms",
        title: t.nav.rooms,
        subtitle: isVi ? "Sơ đồ 3 tòa × 5 tầng" : "ผังห้องพัก 3 อาคาร × 5 ชั้น",
        href: "/rooms",
        group: "nav",
        icon: <Building2 className="h-4 w-4 text-primary" />,
      },
      {
        id: "nav-att",
        title: t.nav.attendance,
        subtitle: isVi ? "Điểm danh vào/ra nhanh" : "เช็กชื่อเข้า-ออกด่วน",
        href: "/attendance",
        group: "nav",
        icon: <ClipboardCheck className="h-4 w-4 text-emerald-600" />,
      },
      {
        id: "nav-fees",
        title: t.nav.fees,
        subtitle: isVi ? "Thu tiền phòng & hóa đơn" : "บิลค่าห้องและรับชำระเงิน",
        href: "/fees",
        group: "nav",
        icon: <CreditCard className="h-4 w-4 text-amber-600" />,
      },
      {
        id: "nav-viol",
        title: t.nav.violations,
        subtitle: isVi ? "Theo dõi vi phạm" : "บันทึกการกระทำผิดและบทลงโทษ",
        href: "/violations",
        group: "nav",
        icon: <ShieldAlert className="h-4 w-4 text-rose-600" />,
      },
      {
        id: "nav-ann",
        title: t.nav.announcements,
        subtitle: isVi ? "Thông báo ký túc xá" : "ประกาศข่าวสารหอพัก",
        href: "/announcements",
        group: "nav",
        icon: <Megaphone className="h-4 w-4 text-indigo-600" />,
      },
      {
        id: "nav-glassy",
        title: t.nav.glassyView,
        subtitle: isVi ? "Bảng điều khiển Glassy UI" : "ศูนย์ควบคุมแบบ Glassy UI",
        href: "/glassy-demo",
        group: "nav",
        icon: <Sparkles className="h-4 w-4 text-violet-600" />,
      },
    ];

    const matchedNav = navItems.filter(
      (i) =>
        !q ||
        i.title.toLowerCase().includes(q) ||
        i.subtitle.toLowerCase().includes(q)
    );

    const matchedMembers: CommandItem[] = q
      ? indexData.members
          .filter(
            (m) =>
              m.full_name.toLowerCase().includes(q) ||
              m.student_code.toLowerCase().includes(q) ||
              (m.room_number && m.room_number.toLowerCase().includes(q))
          )
          .slice(0, 6)
          .map((m) => ({
            id: `mem-${m.id}`,
            title: m.full_name,
            subtitle: `${m.student_code}${m.room_number ? ` · ${isVi ? "Phòng" : "ห้อง"} ${m.room_number}` : ""}`,
            href: `/members?q=${encodeURIComponent(m.student_code || m.full_name)}`,
            group: "member" as const,
            icon: <Users className="h-4 w-4 text-sky-600" />,
          }))
      : [];

    const matchedRooms: CommandItem[] = q
      ? indexData.rooms
          .filter(
            (r) =>
              r.room_number.toLowerCase().includes(q) ||
              (r.building_code && r.building_code.toLowerCase().includes(q))
          )
          .slice(0, 6)
          .map((r) => ({
            id: `room-${r.id}`,
            title: `${isVi ? "Phòng" : "ห้อง"} ${r.room_number}`,
            subtitle: `${r.building_code ? `${isVi ? "Tòa" : "อาคาร"} ${r.building_code} · ` : ""}${isVi ? "Tầng" : "ชั้น"} ${r.floor}`,
            href: `/rooms?building=${encodeURIComponent(r.building_code ?? "all")}`,
            group: "room" as const,
            icon: <Building2 className="h-4 w-4 text-emerald-600" />,
          }))
      : [];

    return [...matchedMembers, ...matchedRooms, ...matchedNav];
  }, [query, lang, t, indexData]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const navigateTo = (href: string) => {
    onClose();
    router.push(href);
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
      <div
        className="fixed inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="animate-modal-pop relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                onClose();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((prev) =>
                  items.length ? (prev + 1) % items.length : 0
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex((prev) =>
                  items.length ? (prev - 1 + items.length) % items.length : 0
                );
              } else if (e.key === "Enter" && items[activeIndex]) {
                e.preventDefault();
                navigateTo(items[activeIndex].href);
              }
            }}
            placeholder={
              lang === "vi"
                ? "Tìm nhanh tên sinh viên, số phòng hoặc menu..."
                : "ค้นหาด่วน: ชื่อสมาชิก รหัส เลขห้อง หรือเมนู..."
            }
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">
              {t.common.noData}
            </p>
          ) : (
            <div className="space-y-1">
              {items.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => navigateTo(item.href)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    idx === activeIndex
                      ? "bg-primary/10 text-primary"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {item.title}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {item.subtitle}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] text-slate-400">
          <span>↑↓ {lang === "vi" ? "Chọn" : "เลือก"} · Enter {lang === "vi" ? "Mở" : "เปิด"}</span>
          <span>Esc {lang === "vi" ? "Đóng" : "ปิด"}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
