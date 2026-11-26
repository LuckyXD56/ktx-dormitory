"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  Edit2,
  Eye,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import {
  emitAlertsRefresh,
  getCached,
  invalidateCache,
  isCacheFresh,
  setCached,
  subscribeDormSync,
} from "@/lib/cache";
import { formatDate, getInitials, getTodayYYYYMMDD } from "@/lib/utils";
import type {
  Building,
  Member,
  MemberGender,
  MemberStatus,
  Room,
} from "@/types/database";

type SortKey = "student_code" | "full_name" | "check_in_date" | "status";

interface MembersCachePayload {
  members: Member[];
  buildings: Building[];
  rooms: Room[];
}

interface MemberFormState {
  student_code: string;
  full_name: string;
  avatar_url: string;
  gender: MemberGender;
  country: string;
  province: string;
  phone: string;
  room_id: string;
  check_in_date: string;
  status: MemberStatus;
  notes: string;
}

const emptyForm = (suggestedCode = ""): MemberFormState => ({
  student_code: suggestedCode,
  full_name: "",
  avatar_url: "",
  gender: "male",
  country: "ไทย",
  province: "",
  phone: "",
  room_id: "",
  check_in_date: getTodayYYYYMMDD(),
  status: "active",
  notes: "",
});

export default function MembersPage() {
  const { t, lang } = useI18n();
  const { isAdminOrAbove } = useAuth();
  const { showToast } = useToast();

  const initialCache = getCached<MembersCachePayload>("members_page");
  const [members, setMembers] = useState<Member[]>(initialCache?.members ?? []);
  const [buildings, setBuildings] = useState<Building[]>(
    initialCache?.buildings ?? []
  );
  const [rooms, setRooms] = useState<Room[]>(initialCache?.rooms ?? []);
  const [loading, setLoading] = useState(!initialCache);

  const [search, setSearch] = useState("");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [floorFilter, setFloorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("student_code");
  const [sortAsc, setSortAsc] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [form, setForm] = useState<MemberFormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async (force = false) => {
    const supabase = createClient();
    if (!supabase) return;
    if (!force && isCacheFresh("members_page", 15_000)) {
      setLoading(false);
      return;
    }
    if (!getCached("members_page")) setLoading(true);
    try {
      const [memRes, bldRes, roomRes] = await Promise.all([
        supabase
          .from("members")
          .select("*, room:rooms(*, building:buildings(*))")
          .order("created_at", { ascending: false }),
        supabase.from("buildings").select("*").order("code"),
        supabase
          .from("rooms")
          .select("*, building:buildings(*)")
          .order("room_number"),
      ]);
      const payload: MembersCachePayload = {
        members: (memRes.data as Member[]) ?? [],
        buildings: (bldRes.data as Building[]) ?? [],
        rooms: (roomRes.data as Room[]) ?? [],
      };
      setMembers(payload.members);
      setBuildings(payload.buildings);
      setRooms(payload.rooms);
      setCached("members_page", payload);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    return subscribeDormSync(() => {
      loadData(true);
    });
  }, [loadData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearch(q);
  }, []);

  const refreshAfterMutation = async () => {
    invalidateCache("members_page");
    invalidateCache("rooms_page");
    invalidateCache("dashboard_page");
    emitAlertsRefresh();
    await loadData(true);
  };

  const roomOccupancyMap = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((m) => {
      if (m.room_id && (m.status === "active" || m.status === "on_leave")) {
        map.set(m.room_id, (map.get(m.room_id) ?? 0) + 1);
      }
    });
    return map;
  }, [members]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter((m) => {
        if (q) {
          const match =
            m.full_name.toLowerCase().includes(q) ||
            m.student_code.toLowerCase().includes(q) ||
            m.phone.toLowerCase().includes(q) ||
            (m.room?.room_number ?? "").toLowerCase().includes(q);
          if (!match) return false;
        }
        if (
          buildingFilter !== "all" &&
          m.room?.building_id !== buildingFilter
        ) {
          return false;
        }
        if (
          floorFilter !== "all" &&
          String(m.room?.floor ?? "") !== floorFilter
        ) {
          return false;
        }
        if (statusFilter !== "all" && m.status !== statusFilter) return false;
        if (genderFilter !== "all" && m.gender !== genderFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const av = String(a[sortKey] ?? "");
        const bv = String(b[sortKey] ?? "");
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
  }, [
    members,
    search,
    buildingFilter,
    floorFilter,
    statusFilter,
    genderFilter,
    sortKey,
    sortAsc,
  ]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((p) => !p);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const openCreate = () => {
    setEditingMember(null);
    const suggested = `67${String(members.length + 1001).padStart(5, "0")}`;
    setForm(emptyForm(suggested));
    setModalOpen(true);
  };

  const openEdit = (m: Member) => {
    setEditingMember(m);
    setForm({
      student_code: m.student_code,
      full_name: m.full_name,
      avatar_url: m.avatar_url ?? "",
      gender: m.gender,
      country: m.country,
      province: m.province,
      phone: m.phone,
      room_id: m.room_id ?? "",
      check_in_date: m.check_in_date,
      status: m.status,
      notes: m.notes ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) return;

    setSaving(true);
    try {
      const payload = {
        student_code:
          form.student_code.trim() ||
          `STU${Date.now().toString().slice(-6)}`,
        full_name: form.full_name.trim(),
        avatar_url: form.avatar_url.trim() || null,
        gender: form.gender,
        country: form.country.trim() || "ไทย",
        province: form.province.trim(),
        phone: form.phone.trim(),
        room_id: form.room_id || null,
        check_in_date: form.check_in_date,
        status: form.status,
        notes: form.notes.trim(),
      };

      const { error } = editingMember
        ? await supabase
            .from("members")
            .update(payload)
            .eq("id", editingMember.id)
        : await supabase.from("members").insert(payload);

      if (error) {
        showToast(error.message, "error");
        return;
      }

      showToast(t.common.successSave, "success");
      setModalOpen(false);
      await refreshAfterMutation();
    } finally {
      setSaving(false);
    }
  };

  // Quick 1-click check-out / re-activate (Optimistic)
  const handleQuickStatus = async (m: Member, nextStatus: MemberStatus) => {
    const supabase = createClient();
    if (!supabase) return;
    const nextRoomId = nextStatus === "checked_out" ? null : m.room_id;

    setMembers((prev) =>
      prev.map((item) =>
        item.id === m.id
          ? {
              ...item,
              status: nextStatus,
              room_id: nextRoomId,
              room: nextRoomId ? item.room : null,
            }
          : item
      )
    );

    const { error } = await supabase
      .from("members")
      .update({ status: nextStatus, room_id: nextRoomId })
      .eq("id", m.id);

    if (error) {
      showToast(error.message, "error");
      await loadData(true);
      return;
    }
    showToast(t.common.successSave, "success");
    await refreshAfterMutation();
  };

  const handleDelete = async () => {
    if (!deletingMember) return;
    const supabase = createClient();
    if (!supabase) return;
    const targetId = deletingMember.id;
    setDeleting(true);
    // Optimistic removal
    setMembers((prev) => prev.filter((m) => m.id !== targetId));
    setDeletingMember(null);

    try {
      const { error } = await supabase
        .from("members")
        .delete()
        .eq("id", targetId);
      if (error) {
        showToast(error.message, "error");
        await loadData(true);
        return;
      }
      showToast(t.common.successDelete, "success");
      await refreshAfterMutation();
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMembers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMembers.map((m) => m.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(t.common.confirmDeleteDesc)) return;
    const supabase = createClient();
    if (!supabase) return;
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    setMembers((prev) => prev.filter((m) => !selectedIds.has(m.id)));
    setSelectedIds(new Set());
    try {
      const { error } = await supabase.from("members").delete().in("id", ids);
      if (error) {
        showToast(error.message, "error");
        await loadData(true);
        return;
      }
      showToast(t.common.successDelete, "success");
      await refreshAfterMutation();
    } finally {
      setBulkDeleting(false);
    }
  };

  const renderStatusBadge = (status: MemberStatus) => {
    switch (status) {
      case "active":
        return <Badge variant="emerald">{t.members.statusActive}</Badge>;
      case "on_leave":
        return <Badge variant="amber">{t.members.statusOnLeave}</Badge>;
      case "checked_out":
        return <Badge variant="slate">{t.members.statusCheckedOut}</Badge>;
      case "suspended":
        return <Badge variant="rose">{t.members.statusSuspended}</Badge>;
    }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {t.members.title}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{t.members.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedIds.size > 0 && (
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={handleBulkDelete}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {t.members.deleteSelected.replace(
                  "{n}",
                  String(selectedIds.size)
                )}
              </button>
            )}
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-navy-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t.members.addMember}
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.members.searchPlaceholder}
              className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-100"
            />
          </div>
          <select
            value={buildingFilter}
            onChange={(e) => {
              setBuildingFilter(e.target.value);
              setFloorFilter("all");
            }}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-navy-600 focus:outline-none"
          >
            <option value="all">
              {t.common.building}: {t.common.all}
            </option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-navy-600 focus:outline-none"
          >
            <option value="all">
              {t.rooms.floor}: {t.common.all}
            </option>
            {Array.from(
              new Set(
                rooms
                  .filter(
                    (r) =>
                      buildingFilter === "all" ||
                      r.building_id === buildingFilter
                  )
                  .map((r) => r.floor)
              )
            )
              .sort((a, b) => a - b)
              .map((fl) => (
                <option key={fl} value={String(fl)}>
                  {t.rooms.floor} {fl}
                </option>
              ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-navy-600 focus:outline-none"
          >
            <option value="all">
              {t.common.status}: {t.common.all}
            </option>
            <option value="active">{t.members.statusActive}</option>
            <option value="on_leave">{t.members.statusOnLeave}</option>
            <option value="checked_out">{t.members.statusCheckedOut}</option>
            <option value="suspended">{t.members.statusSuspended}</option>
          </select>
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-navy-600 focus:outline-none"
          >
            <option value="all">
              {t.members.gender}: {t.common.all}
            </option>
            <option value="male">{t.members.male}</option>
            <option value="female">{t.members.female}</option>
            <option value="other">{t.members.other}</option>
          </select>
        </div>

        {/* Members Table */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-navy-600" />
              <span className="text-sm">{t.common.loading}</span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">
              {t.common.noData}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={
                          filteredMembers.length > 0 &&
                          selectedIds.size === filteredMembers.length
                        }
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("student_code")}
                        className="inline-flex items-center gap-1 hover:text-slate-800"
                      >
                        {t.members.studentCode}
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("full_name")}
                        className="inline-flex items-center gap-1 hover:text-slate-800"
                      >
                        {t.members.fullName}
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="px-4 py-3">{t.members.buildingRoom}</th>
                    <th className="px-4 py-3 hidden md:table-cell">
                      {t.members.country} / {t.members.province}
                    </th>
                    <th className="px-4 py-3 hidden sm:table-cell">
                      {t.members.phone}
                    </th>
                    <th className="px-4 py-3 hidden xl:table-cell">
                      <button
                        type="button"
                        onClick={() => toggleSort("check_in_date")}
                        className="inline-flex items-center gap-1 hover:text-slate-800"
                      >
                        {t.members.checkInDate}
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("status")}
                        className="inline-flex items-center gap-1 hover:text-slate-800"
                      >
                        {t.common.status}
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(m.id)}
                          onChange={() => toggleSelect(m.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-navy-700">
                        {m.student_code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-bold text-navy-800 overflow-hidden">
                            {m.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.avatar_url}
                                alt={m.full_name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              getInitials(m.full_name)
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {m.full_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {m.gender === "male"
                                ? t.members.male
                                : m.gender === "female"
                                ? t.members.female
                                : t.members.other}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {m.room ? (
                          <Badge variant="navy">
                            {m.room.building?.code ?? ""} • {t.rooms.floor}{" "}
                            {m.room.floor} • {m.room.room_number}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">
                            {t.members.unassigned}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-slate-600">
                        {m.country}
                        {m.province ? ` • ${m.province}` : ""}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-700">
                        {m.phone || "-"}
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs text-slate-500">
                        {formatDate(m.check_in_date, lang)}
                      </td>
                      <td className="px-4 py-3">{renderStatusBadge(m.status)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {m.status === "checked_out" ? (
                            <button
                              type="button"
                              onClick={() => handleQuickStatus(m, "active")}
                              className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                              title={t.members.quickActivate}
                            >
                              <LogIn className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickStatus(m, "checked_out")
                              }
                              className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50"
                              title={t.members.quickCheckOut}
                            >
                              <LogOut className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setViewingMember(m)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy-700"
                            title={t.common.viewDetails}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(m)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-navy-50 hover:text-navy-700"
                            title={t.common.edit}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingMember(m)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            title={t.common.delete}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Member Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingMember ? t.members.editMember : t.members.addMember}
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <ImageUpload
            value={form.avatar_url}
            onChange={(url) => setForm((f) => ({ ...f, avatar_url: url }))}
            folder="avatars"
            label={t.members.avatar}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.members.studentCode} *
              </label>
              <input
                type="text"
                required
                value={form.student_code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, student_code: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.members.fullName} *
              </label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, full_name: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.members.gender}
              </label>
              <select
                value={form.gender}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    gender: e.target.value as MemberGender,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              >
                <option value="male">{t.members.male}</option>
                <option value="female">{t.members.female}</option>
                <option value="other">{t.members.other}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.members.phone}
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.members.country}
              </label>
              <input
                type="text"
                value={form.country}
                onChange={(e) =>
                  setForm((f) => ({ ...f, country: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.members.province}
              </label>
              <input
                type="text"
                value={form.province}
                onChange={(e) =>
                  setForm((f) => ({ ...f, province: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.members.buildingRoom}
              </label>
              <select
                value={form.room_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, room_id: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              >
                <option value="">{t.members.unassigned}</option>
                {rooms.map((r) => {
                  const occ = roomOccupancyMap.get(r.id) ?? 0;
                  const isCurrent = editingMember?.room_id === r.id;
                  const disabled =
                    r.status === "maintenance" ||
                    (!isCurrent && occ >= r.capacity);
                  return (
                    <option key={r.id} value={r.id} disabled={disabled}>
                      {r.building?.name ?? r.building?.code} — {r.room_number} (
                      {occ}/{r.capacity})
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.members.checkInDate}
              </label>
              <input
                type="date"
                value={form.check_in_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, check_in_date: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.members.residenceStatus}
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as MemberStatus,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              >
                <option value="active">{t.members.statusActive}</option>
                <option value="on_leave">{t.members.statusOnLeave}</option>
                <option value="checked_out">{t.members.statusCheckedOut}</option>
                <option value="suspended">{t.members.statusSuspended}</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.common.notes}
              </label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
            >
              {saving ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail View Modal */}
      <Modal
        open={Boolean(viewingMember)}
        onClose={() => setViewingMember(null)}
        title={viewingMember?.full_name ?? ""}
        subtitle={viewingMember?.student_code}
        maxWidth="md"
      >
        {viewingMember && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-navy-100 text-navy-800 font-bold text-lg flex items-center justify-center overflow-hidden">
                {viewingMember.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={viewingMember.avatar_url}
                    alt={viewingMember.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(viewingMember.full_name)
                )}
              </div>
              <div>
                <p className="font-bold text-slate-900 text-base">
                  {viewingMember.full_name}
                </p>
                <p className="text-slate-500">
                  {viewingMember.room
                    ? `${viewingMember.room.building?.name ?? ""} / ${viewingMember.room.room_number}`
                    : t.members.unassigned}
                </p>
                <div className="mt-1">{renderStatusBadge(viewingMember.status)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-100">
              <div>
                <p className="text-xs text-slate-400">{t.members.gender}</p>
                <p className="font-medium">
                  {viewingMember.gender === "male"
                    ? t.members.male
                    : viewingMember.gender === "female"
                    ? t.members.female
                    : t.members.other}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t.members.phone}</p>
                <p className="font-medium">{viewingMember.phone || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t.members.country}</p>
                <p className="font-medium">{viewingMember.country}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t.members.province}</p>
                <p className="font-medium">{viewingMember.province || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t.members.checkInDate}</p>
                <p className="font-medium">
                  {formatDate(viewingMember.check_in_date, lang)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">{t.common.notes}</p>
                <p className="font-medium">{viewingMember.notes || "-"}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingMember)}
        onClose={() => setDeletingMember(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </AppShell>
  );
}
