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
import { pickLang, useI18n } from "@/lib/i18n";

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

    const navItems: CommandItem[] = [
      {
        id: "nav-dash",
        title: t.nav.dashboard,
        subtitle: pickLang(lang, {
          th: "ภาพรวมระบบหอพัก",
          vi: "Tổng quan KTX",
          en: "Dormitory overview",
          zh: "宿舍总览",
          lo: "ພາບລວມລະບົບຫໍພັກ",
        }),
        href: "/",
        group: "nav",
        icon: <LayoutDashboard className="h-4 w-4 text-primary" />,
      },
      {
        id: "nav-members",
        title: t.nav.members,
        subtitle: pickLang(lang, {
          th: "เพิ่ม ลบ แก้ไขรายชื่อสมาชิก",
          vi: "Thêm / sửa thành viên",
          en: "Add, edit & assign residents",
          zh: "增删改住宿生信息",
          lo: "ເພີ່ມ ລຶບ ແກ້ໄຂລາຍຊື່ສະມາຊິກ",
        }),
        href: "/members",
        group: "nav",
        icon: <Users className="h-4 w-4 text-primary" />,
      },
      {
        id: "nav-rooms",
        title: t.nav.rooms,
        subtitle: pickLang(lang, {
          th: "ผังห้องพักและอาคาร",
          vi: "Sơ đồ tòa nhà & phòng",
          en: "Buildings & room floor plan",
          zh: "楼栋与房间分布图",
          lo: "ຜັງຫ້ອງພັກ ແລະ ອາຄານ",
        }),
        href: "/rooms",
        group: "nav",
        icon: <Building2 className="h-4 w-4 text-primary" />,
      },
      {
        id: "nav-att",
        title: t.nav.attendance,
        subtitle: pickLang(lang, {
          th: "เช็กชื่อเข้า-ออกด่วน",
          vi: "Điểm danh vào/ra nhanh",
          en: "Quick check-in / check-out",
          zh: "快速出入点名",
          lo: "ເຊັກຊື່ເຂົ້າ-ອອກດ່ວນ",
        }),
        href: "/attendance",
        group: "nav",
        icon: <ClipboardCheck className="h-4 w-4 text-emerald-600" />,
      },
      {
        id: "nav-fees",
        title: t.nav.fees,
        subtitle: pickLang(lang, {
          th: "บิลค่าห้องและรับชำระเงิน",
          vi: "Thu tiền phòng & hóa đơn",
          en: "Room billing & fee collection",
          zh: "房费账单与缴费记录",
          lo: "ບິນຄ່າຫ້ອງ ແລະ ຮັບຊຳລະເງິນ",
        }),
        href: "/fees",
        group: "nav",
        icon: <CreditCard className="h-4 w-4 text-amber-600" />,
      },
      {
        id: "nav-viol",
        title: t.nav.violations,
        subtitle: pickLang(lang, {
          th: "บันทึกการกระทำผิดและบทลงโทษ",
          vi: "Theo dõi vi phạm",
          en: "Disciplinary records & penalties",
          zh: "违规记录与处理",
          lo: "ບັນທຶກການລະເມີດ ແລະ ບົດລົງໂທດ",
        }),
        href: "/violations",
        group: "nav",
        icon: <ShieldAlert className="h-4 w-4 text-rose-600" />,
      },
      {
        id: "nav-ann",
        title: t.nav.announcements,
        subtitle: pickLang(lang, {
          th: "ประกาศข่าวสารหอพัก",
          vi: "Thông báo ký túc xá",
          en: "Dormitory notices & news",
          zh: "宿舍通知与公告",
          lo: "ປະກາດຂ່າວສານຫໍພັກ",
        }),
        href: "/announcements",
        group: "nav",
        icon: <Megaphone className="h-4 w-4 text-indigo-600" />,
      },
      {
        id: "nav-glassy",
        title: t.nav.glassyView,
        subtitle: pickLang(lang, {
          th: "ศูนย์ควบคุมแบบ Glassy UI",
          vi: "Bảng điều khiển Glassy UI",
          en: "Glassy UI Control View",
          zh: "Glassy 控制视图",
          lo: "ສູນຄວບຄຸມແບບ Glassy UI",
        }),
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
            subtitle: `${m.student_code}${m.room_number ? ` · ${t.common.room} ${m.room_number}` : ""}`,
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
            title: `${t.common.room} ${r.room_number}`,
            subtitle: `${r.building_code ? `${t.common.building} ${r.building_code} · ` : ""}${t.rooms.floor} ${r.floor}`,
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
            placeholder={pickLang(lang, {
              th: "ค้นหาด่วน: ชื่อสมาชิก รหัส เลขห้อง หรือเมนู...",
              vi: "Tìm nhanh tên sinh viên, số phòng hoặc menu...",
              en: "Quick search: student name, ID, room, or menu...",
              zh: "快速搜索：学生姓名、学号、房号或菜单...",
              lo: "ຄົ້ນຫາດ່ວນ: ຊື່ສະມາຊິກ ລະຫັດ ເລກຫ້ອງ ຫຼື ເມນູ...",
            })}
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
          <span>
            ↑↓{" "}
            {pickLang(lang, {
              th: "เลือก",
              vi: "Chọn",
              en: "Select",
              zh: "选择",
              lo: "ເລືອກ",
            })}{" "}
            · Enter{" "}
            {pickLang(lang, {
              th: "เปิด",
              vi: "Mở",
              en: "Open",
              zh: "打开",
              lo: "ເປີດ",
            })}
          </span>
          <span>
            Esc{" "}
            {pickLang(lang, {
              th: "ปิด",
              vi: "Đóng",
              en: "Close",
              zh: "关闭",
              lo: "ປິດ",
            })}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
