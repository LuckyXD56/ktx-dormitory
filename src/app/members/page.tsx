"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ArrowUpDown,
  Edit2,
  Eye,
  FileSpreadsheet,
  FileText,
  LogIn,
  LogOut,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ImportExcelModal } from "@/components/members/ImportExcelModal";
import { MemberDetailModal, MemberFormModal, type MemberFormState } from "@/components/members/MemberModals";
import { ResidenceCertificateModal } from "@/components/members/ResidenceCertificate";
import { RoomTransferModal } from "@/components/members/RoomTransferModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/ui/FilterBar";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/select";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { pickLang, useI18n } from "@/lib/i18n";
import {
  createMember,
  deleteMember,
  deleteMembersBatch,
  listBuildings,
  listMembers,
  listRooms,
  updateMember,
} from "@/services";
import {
  emitAlertsRefresh,
  emitDormSync,
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
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [form, setForm] = useState<MemberFormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [transferMember, setTransferMember] = useState<Member | null>(null);
  const [certMember, setCertMember] = useState<Member | null>(null);

  const loadData = useCallback(async (force = false) => {
    if (!force && isCacheFresh("members_page", 15_000)) {
      setLoading(false);
      return;
    }
    if (!getCached("members_page")) setLoading(true);
    try {
      const [mData, bData, rData] = await Promise.all([
        listMembers(),
        listBuildings(),
        listRooms(),
      ]);
      const payload: MembersCachePayload = {
        members: mData,
        buildings: bData,
        rooms: rData,
      };
      setMembers(payload.members);
      setBuildings(payload.buildings);
      setRooms(payload.rooms);
      setCached("members_page", payload);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  useEffect(() => {
    return subscribeDormSync(() => {
      loadData(true);
    });
  }, [loadData]);

  const [filtersReady, setFiltersReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) setSearch(q);
      const saved = window.sessionStorage.getItem("dorm_members_filters");
      if (saved) {
        const parsed = JSON.parse(saved) as {
          building?: string;
          floor?: string;
          status?: string;
          gender?: string;
          sortKey?: SortKey;
          sortAsc?: boolean;
        };
        if (parsed.building) setBuildingFilter(parsed.building);
        if (parsed.floor) setFloorFilter(parsed.floor);
        if (parsed.status) setStatusFilter(parsed.status);
        if (parsed.gender) setGenderFilter(parsed.gender);
        if (parsed.sortKey) setSortKey(parsed.sortKey);
        if (typeof parsed.sortAsc === "boolean") setSortAsc(parsed.sortAsc);
      }
    } catch {
      // Ignore storage error
    } finally {
      setFiltersReady(true);
    }
  }, []);

  useEffect(() => {
    if (!filtersReady || typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        "dorm_members_filters",
        JSON.stringify({
          building: buildingFilter,
          floor: floorFilter,
          status: statusFilter,
          gender: genderFilter,
          sortKey,
          sortAsc,
        })
      );
    } catch {
      // Ignore storage error
    }
  }, [
    filtersReady,
    buildingFilter,
    floorFilter,
    statusFilter,
    genderFilter,
    sortKey,
    sortAsc,
  ]);

  const refreshAfterMutation = async () => {
    invalidateCache("members_page");
    invalidateCache("rooms_page");
    invalidateCache("dashboard_page");
    emitAlertsRefresh();
    emitDormSync("members");
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
        const cmp = av.localeCompare(bv, undefined, {
          numeric: true,
          sensitivity: "base",
        });
        return sortAsc ? cmp : -cmp;
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

      if (editingMember) {
        await updateMember(editingMember.id, payload);
      } else {
        await createMember(payload);
      }

      showToast(t.common.successSave, "success");
      setModalOpen(false);
      await refreshAfterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setSaving(false);
    }
  };

  // Quick 1-click check-out / re-activate (Optimistic)
  const handleQuickStatus = async (m: Member, nextStatus: MemberStatus) => {
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

    try {
      await updateMember(m.id, { status: nextStatus, room_id: nextRoomId });
      showToast(t.common.successSave, "success");
      await refreshAfterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
      await loadData(true);
    }
  };

  const handleDelete = async () => {
    if (!deletingMember) return;
    const targetId = deletingMember.id;
    setDeleting(true);
    setMembers((prev) => prev.filter((m) => m.id !== targetId));
    setDeletingMember(null);

    try {
      await deleteMember(targetId);
      showToast(t.common.successDelete, "success");
      await refreshAfterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
      await loadData(true);
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
    setBulkConfirmOpen(false);
    setBulkDeleting(true);
    const ids = Array.from(selectedIds);
    setMembers((prev) => prev.filter((m) => !selectedIds.has(m.id)));
    setSelectedIds(new Set());
    try {
      await deleteMembersBatch(ids);
      showToast(t.common.successDelete, "success");
      await refreshAfterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
      await loadData(true);
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
        <PageHeader
          title={t.members.title}
          subtitle={t.members.subtitle}
          actions={
            <>
              {selectedIds.size > 0 && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={bulkDeleting}
                  onClick={() => setBulkConfirmOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  {t.members.deleteSelected.replace(
                    "{n}",
                    String(selectedIds.size)
                  )}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setImportOpen(true)}
                className="gap-1.5"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                {pickLang(lang, {
                  th: "นำเข้า Excel",
                  vi: "Nhập Excel",
                  en: "Import Excel",
                  zh: "导入 Excel",
                  lo: "ນຳເຂົ້າ Excel",
                })}
              </Button>
              <Button type="button" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {t.members.addMember}
              </Button>
            </>
          }
        />

        {/* Search & Filters */}
        <FilterBar
          hasActiveFilters={
            Boolean(search.trim()) ||
            buildingFilter !== "all" ||
            floorFilter !== "all" ||
            statusFilter !== "all" ||
            genderFilter !== "all"
          }
          onReset={() => {
            setSearch("");
            setBuildingFilter("all");
            setFloorFilter("all");
            setStatusFilter("all");
            setGenderFilter("all");
          }}
          resetLabel={t.common.reset}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.members.searchPlaceholder}
                className="pl-10"
              />
            </div>
            <Select
              value={buildingFilter}
              onChange={(e) => {
                setBuildingFilter(e.target.value);
                setFloorFilter("all");
              }}
            >
              <option value="all">
                {t.common.building}: {t.common.all}
              </option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
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
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">
                {t.common.status}: {t.common.all}
              </option>
              <option value="active">{t.members.statusActive}</option>
              <option value="on_leave">{t.members.statusOnLeave}</option>
              <option value="checked_out">{t.members.statusCheckedOut}</option>
              <option value="suspended">{t.members.statusSuspended}</option>
            </Select>
            <Select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
            >
              <option value="all">
                {t.members.gender}: {t.common.all}
              </option>
              <option value="male">{t.members.male}</option>
              <option value="female">{t.members.female}</option>
              <option value="other">{t.members.other}</option>
            </Select>
          </div>
        </FilterBar>

        {/* Members Table & Mobile Cards */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          {loading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : filteredMembers.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title={t.common.noData}
              action={
                <Button type="button" size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  {t.members.addMember}
                </Button>
              }
            />
          ) : (
            <>
              <div className="md:hidden divide-y divide-slate-100">
                {filteredMembers.map((m) => (
                  <div key={m.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(m.id)}
                          onChange={() => toggleSelect(m.id)}
                          className="h-4 w-4 rounded border-slate-300 shrink-0"
                        />
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-bold text-navy-800 overflow-hidden">
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
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {m.full_name}
                          </p>
                          <p className="text-xs font-mono text-navy-700">
                            {m.student_code}
                          </p>
                        </div>
                      </div>
                      {renderStatusBadge(m.status)}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {m.room
                          ? `${m.room.building?.code ?? ""} • ${t.rooms.floor} ${m.room.floor} • ${m.room.room_number}`
                          : t.members.unassigned}
                      </span>
                      <span>{m.phone || "-"}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() =>
                          handleQuickStatus(
                            m,
                            m.status === "checked_out" ? "active" : "checked_out"
                          )
                        }
                        className="rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {m.status === "checked_out"
                          ? t.members.quickActivate
                          : t.members.quickCheckOut}
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransferMember(m)}
                        className="rounded-xl border border-slate-200 p-2 text-indigo-600 hover:bg-indigo-50"
                        title={t.rooms.transferMember}
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCertMember(m)}
                        className="rounded-xl border border-slate-200 p-2 text-emerald-600 hover:bg-emerald-50"
                        title={pickLang(lang, {
                          th: "ใบรับรองการพัก",
                          vi: "Giấy xác nhận",
                          en: "Certificate",
                          zh: "住宿证明",
                          lo: "ໃບຢັ້ງຢືນທີ່ພັກ",
                        })}
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingMember(m)}
                        className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                        title={t.common.viewDetails}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(m)}
                        className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-navy-50 hover:text-navy-700"
                        title={t.common.edit}
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingMember(m)}
                        className="rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50"
                        title={t.common.delete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
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
                            onClick={() => setTransferMember(m)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                            title={t.rooms.transferMember}
                          >
                            <ArrowLeftRight className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setCertMember(m)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
                            title={pickLang(lang, {
                              th: "ใบรับรองการพัก",
                              vi: "Giấy xác nhận",
                              en: "Certificate",
                              zh: "住宿证明",
                              lo: "ໃບຢັ້ງຢືນທີ່ພັກ",
                            })}
                          >
                            <FileText className="h-4 w-4" />
                          </button>
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
            </>
          )}
        </div>
      </div>

      <MemberFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingMember={editingMember}
        form={form}
        setForm={setForm}
        rooms={rooms}
        roomOccupancyMap={roomOccupancyMap}
        saving={saving}
        onSubmit={handleSave}
        labels={{
          editMember: t.members.editMember,
          addMember: t.members.addMember,
          avatar: t.members.avatar,
          studentCode: t.members.studentCode,
          fullName: t.members.fullName,
          gender: t.members.gender,
          male: t.members.male,
          female: t.members.female,
          other: t.members.other,
          phone: t.members.phone,
          country: t.members.country,
          province: t.members.province,
          buildingRoom: t.members.buildingRoom,
          unassigned: t.members.unassigned,
          checkInDate: t.members.checkInDate,
          residenceStatus: t.members.residenceStatus,
          statusActive: t.members.statusActive,
          statusOnLeave: t.members.statusOnLeave,
          statusCheckedOut: t.members.statusCheckedOut,
          statusSuspended: t.members.statusSuspended,
          notes: t.common.notes,
          cancel: t.common.cancel,
          save: t.common.save,
          saving: t.common.saving,
        }}
      />

      <MemberDetailModal
        member={viewingMember}
        onClose={() => setViewingMember(null)}
        lang={lang}
        renderStatusBadge={renderStatusBadge}
        labels={{
          unassigned: t.members.unassigned,
          gender: t.members.gender,
          male: t.members.male,
          female: t.members.female,
          other: t.members.other,
          phone: t.members.phone,
          country: t.members.country,
          province: t.members.province,
          checkInDate: t.members.checkInDate,
          notes: t.common.notes,
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingMember)}
        onClose={() => setDeletingMember(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <ConfirmDialog
        open={bulkConfirmOpen}
        onClose={() => setBulkConfirmOpen(false)}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
      />

      <ImportExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        rooms={rooms}
        onImported={async (count) => {
          if (count > 0) {
            showToast(
              pickLang(lang, {
                th: `นำเข้าข้อมูลสำเร็จ ${count} รายการ`,
                vi: `Đã nhập thành công ${count} sinh viên`,
                en: `Imported ${count} members successfully`,
                zh: `成功导入 ${count} 名学生`,
                lo: `ນຳເຂົ້າຂໍ້ມູນສຳເລັດ ${count} ລາຍການ`,
              }),
              "success"
            );
            await refreshAfterMutation();
          }
        }}
      />

      <RoomTransferModal
        open={Boolean(transferMember)}
        onClose={() => setTransferMember(null)}
        member={transferMember}
        rooms={rooms}
        onTransferred={async () => {
          showToast(t.common.successSave, "success");
          await refreshAfterMutation();
        }}
      />

      <ResidenceCertificateModal
        open={Boolean(certMember)}
        onClose={() => setCertMember(null)}
        member={certMember}
      />
    </AppShell>
  );
}
