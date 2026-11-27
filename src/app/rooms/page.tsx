"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  LayoutGrid,
  Layers,
  List,
  Plus,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { BuildingSummaryStrip } from "@/components/rooms/BuildingSummaryStrip";
import { RoomCardsGrid } from "@/components/rooms/RoomCardsGrid";
import {
  AddFloorModal,
  AssignMemberModal,
  BuildingFormModal,
  BulkRoomsModal,
  RoomFormModal,
  RoomInspectModal,
  TransferMemberModal,
} from "@/components/rooms/RoomModals";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/lib/i18n";
import {
  createBuilding,
  createMember,
  createRoom,
  createRoomsBatch,
  deleteBuilding,
  deleteRoom,
  listBuildings,
  listMembers,
  listRooms,
  setRoomStatus,
  updateBuilding,
  updateMember,
  updateRoom,
} from "@/services";
import {
  emitAlertsRefresh,
  getCached,
  invalidateCache,
  isCacheFresh,
  setCached,
  subscribeDormSync,
} from "@/lib/cache";
import { getTodayYYYYMMDD } from "@/lib/utils";
import type {
  Building,
  GenderPolicy,
  Member,
  MemberGender,
  Room,
  RoomStatus,
} from "@/types/database";

interface RoomsCachePayload {
  buildings: Building[];
  rooms: Room[];
  members: Member[];
}

export default function RoomsPage() {
  const { t, lang } = useI18n();
  const { showToast } = useToast();

  const initialCache = getCached<RoomsCachePayload>("rooms_page");
  const [buildings, setBuildings] = useState<Building[]>(
    initialCache?.buildings ?? []
  );
  const [rooms, setRooms] = useState<Room[]>(initialCache?.rooms ?? []);
  const [members, setMembers] = useState<Member[]>(initialCache?.members ?? []);
  const [loading, setLoading] = useState(!initialCache);

  const [selectedBuilding, setSelectedBuilding] = useState("all");
  const [selectedFloor, setSelectedFloor] = useState<number | "all">("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"compact" | "detailed">("compact");

  // Room Detail Modal (for Compact Grid click)
  const [inspectRoomId, setInspectRoomId] = useState<string | null>(null);

  // Add Floor Modal
  const [addFloorOpen, setAddFloorOpen] = useState(false);
  const [afBuildingId, setAfBuildingId] = useState("");
  const [afCount, setAfCount] = useState(1);
  const [afAutoRooms, setAfAutoRooms] = useState(true);
  const [afRoomsPerFloor, setAfRoomsPerFloor] = useState(4);
  const [afCapacity, setAfCapacity] = useState(4);
  const [afFee, setAfFee] = useState(2500000);
  const [savingFloor, setSavingFloor] = useState(false);

  // Building Modal
  const [buildingModalOpen, setBuildingModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [bCode, setBCode] = useState("");
  const [bName, setBName] = useState("");
  const [bFloors, setBFloors] = useState(5);
  const [bPolicy, setBPolicy] = useState<GenderPolicy>("mixed");
  const [bDesc, setBDesc] = useState("");
  const [savingBuilding, setSavingBuilding] = useState(false);

  // Room Modal
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [rBuildingId, setRBuildingId] = useState("");
  const [rNumber, setRNumber] = useState("");
  const [rFloor, setRFloor] = useState(1);
  const [rCapacity, setRCapacity] = useState(4);
  const [rFee, setRFee] = useState(2500000);
  const [rStatus, setRStatus] = useState<RoomStatus>("available");
  const [rNotes, setRNotes] = useState("");
  const [savingRoom, setSavingRoom] = useState(false);

  // Bulk Add Rooms Modal
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBuildingId, setBulkBuildingId] = useState("");
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkFloorFrom, setBulkFloorFrom] = useState(1);
  const [bulkFloorTo, setBulkFloorTo] = useState(5);
  const [bulkRoomsPerFloor, setBulkRoomsPerFloor] = useState(4);
  const [bulkCapacity, setBulkCapacity] = useState(4);
  const [bulkFee, setBulkFee] = useState(2500000);
  const [savingBulk, setSavingBulk] = useState(false);

  // Assign / Quick-Add Member to Room Modal
  const [assignRoom, setAssignRoom] = useState<Room | null>(null);
  const [assignMode, setAssignMode] = useState<"existing" | "new">("existing");
  const [assignMemberId, setAssignMemberId] = useState("");
  const [newStudentCode, setNewStudentCode] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newGender, setNewGender] = useState<MemberGender>("male");
  const [newPhone, setNewPhone] = useState("");
  const [savingAssign, setSavingAssign] = useState(false);

  // Transfer Member Modal
  const [transferMember, setTransferMember] = useState<Member | null>(null);
  const [targetRoomId, setTargetRoomId] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "building" | "room";
    id: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async (force = false) => {
    if (!force && isCacheFresh("rooms_page", 15_000)) {
      setLoading(false);
      return;
    }
    if (!initialCache) setLoading(true);
    try {
      const [bData, rData, mData] = await Promise.all([
        listBuildings(),
        listRooms(),
        listMembers({ orderBy: "full_name", ascending: true }),
      ]);
      const payload: RoomsCachePayload = {
        buildings: bData,
        rooms: rData,
        members: mData,
      };
      setBuildings(payload.buildings);
      setRooms(payload.rooms);
      setMembers(payload.members);
      setCached("rooms_page", payload);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [filtersReady, setFiltersReady] = useState(false);

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
    try {
      const saved = window.sessionStorage.getItem("dorm_rooms_filters");
      if (saved) {
        const parsed = JSON.parse(saved) as {
          building?: string;
          floor?: number | "all";
          availability?: string;
          view?: "compact" | "detailed";
        };
        if (parsed.building) setSelectedBuilding(parsed.building);
        if (parsed.floor !== undefined) setSelectedFloor(parsed.floor);
        if (parsed.availability) setAvailabilityFilter(parsed.availability);
        if (parsed.view === "compact" || parsed.view === "detailed") {
          setViewMode(parsed.view);
        }
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
        "dorm_rooms_filters",
        JSON.stringify({
          building: selectedBuilding,
          floor: selectedFloor,
          availability: availabilityFilter,
          view: viewMode,
        })
      );
    } catch {
      // Ignore storage error
    }
  }, [
    filtersReady,
    selectedBuilding,
    selectedFloor,
    availabilityFilter,
    viewMode,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || buildings.length === 0) return;
    const param = new URLSearchParams(window.location.search).get("building");
    if (!param || param === "all") return;
    const found = buildings.find(
      (b) => b.id === param || b.code.toLowerCase() === param.toLowerCase()
    );
    if (found) setSelectedBuilding(found.id);
  }, [buildings]);

  const membersByRoom = useMemo(() => {
    const map = new Map<string, Member[]>();
    members.forEach((m) => {
      if (!m.room_id) return;
      if (m.status !== "active" && m.status !== "on_leave") return;
      const arr = map.get(m.room_id) ?? [];
      arr.push(m);
      map.set(m.room_id, arr);
    });
    return map;
  }, [members]);

  const inspectedRoom = useMemo(
    () => rooms.find((r) => r.id === inspectRoomId) ?? null,
    [rooms, inspectRoomId]
  );

  const assignableMembers = useMemo(() => {
    if (!assignRoom) return [];
    return members.filter(
      (m) =>
        m.room_id !== assignRoom.id &&
        m.status !== "checked_out" &&
        m.status !== "suspended"
    );
  }, [members, assignRoom]);

  const availableFloors = useMemo(() => {
    let maxFloor = 5;
    if (selectedBuilding === "all") {
      maxFloor = buildings.length === 0 ? 5 : 1;
      buildings.forEach((b) => {
        if (b.total_floors > maxFloor) maxFloor = b.total_floors;
      });
      rooms.forEach((r) => {
        if (r.floor > maxFloor) maxFloor = r.floor;
      });
    } else {
      const b = buildings.find((x) => x.id === selectedBuilding);
      maxFloor = Math.max(1, b?.total_floors ?? 1);
      rooms
        .filter((r) => r.building_id === selectedBuilding)
        .forEach((r) => {
          if (r.floor > maxFloor) maxFloor = r.floor;
        });
    }
    return Array.from({ length: maxFloor }, (_, i) => i + 1);
  }, [buildings, rooms, selectedBuilding]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (selectedBuilding !== "all" && r.building_id !== selectedBuilding) {
        return false;
      }
      if (selectedFloor !== "all" && r.floor !== selectedFloor) {
        return false;
      }
      const occ = (membersByRoom.get(r.id) ?? []).length;
      if (availabilityFilter === "available") {
        return r.status !== "maintenance" && occ < r.capacity;
      }
      if (availabilityFilter === "full") {
        return r.status !== "maintenance" && occ >= r.capacity;
      }
      if (availabilityFilter === "maintenance") {
        return r.status === "maintenance";
      }
      return true;
    });
  }, [
    rooms,
    selectedBuilding,
    selectedFloor,
    availabilityFilter,
    membersByRoom,
  ]);

  const roomsGroupedByFloor = useMemo(() => {
    const map = new Map<number, Room[]>();
    filteredRooms.forEach((r) => {
      const fl = r.floor || 1;
      const arr = map.get(fl) ?? [];
      arr.push(r);
      map.set(fl, arr);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filteredRooms]);

  const refreshAfterMutation = async () => {
    invalidateCache("rooms_page");
    invalidateCache("members_page");
    invalidateCache("dashboard_page");
    emitAlertsRefresh();
    await loadData(true);
  };

  // Building handlers
  const openAddBuilding = () => {
    setEditingBuilding(null);
    setBCode("");
    setBName("");
    setBFloors(5);
    setBPolicy("mixed");
    setBDesc("");
    setBuildingModalOpen(true);
  };

  const openEditBuilding = (b: Building) => {
    setEditingBuilding(b);
    setBCode(b.code);
    setBName(b.name);
    setBFloors(b.total_floors);
    setBPolicy(b.gender_policy);
    setBDesc(b.description ?? "");
    setBuildingModalOpen(true);
  };

  const saveBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBuilding(true);
    try {
      const payload = {
        code: bCode.trim().toUpperCase(),
        name: bName.trim(),
        total_floors: Number(bFloors) || 1,
        gender_policy: bPolicy,
        description: bDesc.trim(),
      };
      if (editingBuilding) {
        await updateBuilding(editingBuilding.id, payload);
      } else {
        await createBuilding(payload);
      }
      showToast(t.common.successSave, "success");
      setBuildingModalOpen(false);
      await refreshAfterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setSavingBuilding(false);
    }
  };

  // Room handlers
  const openAddRoom = (presetFloor?: number) => {
    setEditingRoom(null);
    const defaultB =
      selectedBuilding !== "all"
        ? selectedBuilding
        : buildings[0]?.id ?? "";
    setRBuildingId(defaultB);
    const targetFl =
      presetFloor ?? (selectedFloor !== "all" ? selectedFloor : 1);
    setRNumber("");
    setRFloor(targetFl);
    setRCapacity(4);
    setRFee(2500000);
    setRStatus("available");
    setRNotes("");
    setRoomModalOpen(true);
  };

  const openEditRoom = (r: Room) => {
    setEditingRoom(r);
    setRBuildingId(r.building_id);
    setRNumber(r.room_number);
    setRFloor(r.floor);
    setRCapacity(r.capacity);
    setRFee(Number(r.monthly_fee));
    setRStatus(r.status);
    setRNotes(r.notes ?? "");
    setRoomModalOpen(true);
  };

  const saveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRoom(true);
    try {
      const payload = {
        building_id: rBuildingId,
        room_number: rNumber.trim(),
        floor: Number(rFloor) || 1,
        capacity: Number(rCapacity) || 1,
        monthly_fee: Number(rFee) || 0,
        status: rStatus,
        notes: rNotes.trim(),
      };
      if (editingRoom) {
        await updateRoom(editingRoom.id, payload);
      } else {
        await createRoom(payload);
      }
      showToast(t.common.successSave, "success");
      setRoomModalOpen(false);
      await refreshAfterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setSavingRoom(false);
    }
  };

  // Add Floor handler
  const openAddFloorModal = (presetBuildingId?: string) => {
    const defaultB =
      presetBuildingId ??
      (selectedBuilding !== "all"
        ? selectedBuilding
        : buildings[0]?.id ?? "");
    setAfBuildingId(defaultB);
    setAfCount(1);
    setAfAutoRooms(true);
    setAfRoomsPerFloor(4);
    setAfCapacity(4);
    setAfFee(2500000);
    setAddFloorOpen(true);
  };

  const handleSaveAddFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    const b = buildings.find((x) => x.id === afBuildingId);
    if (!b) return;

    setSavingFloor(true);
    try {
      const startFloor = b.total_floors + 1;
      const nextTotalFloors =
        b.total_floors + Math.max(1, Number(afCount) || 1);

      await updateBuilding(b.id, { total_floors: nextTotalFloors });

      if (afAutoRooms && afRoomsPerFloor > 0) {
        const cleanCode = b.code.replace(/\s*[0-9]+$/, "").trim();
        const roomPrefix = cleanCode.length > 2 ? `${cleanCode} ` : cleanCode;
        const existingNums = new Set(
          rooms
            .filter((r) => r.building_id === b.id)
            .map((r) => r.room_number)
        );
        const newRooms = [];
        for (let fl = startFloor; fl <= nextTotalFloors; fl++) {
          for (let idx = 1; idx <= afRoomsPerFloor; idx++) {
            const num = `${roomPrefix}${fl}${String(idx).padStart(2, "0")}`;
            if (!existingNums.has(num)) {
              newRooms.push({
                building_id: b.id,
                room_number: num,
                floor: fl,
                capacity: Number(afCapacity) || 4,
                monthly_fee: Number(afFee) || 0,
                status: "available" as RoomStatus,
                notes: "",
              });
            }
          }
        }
        if (newRooms.length > 0) {
          await createRoomsBatch(newRooms);
        }
      }

      showToast(
        t.rooms.addedFloorsSuccess.replace("{n}", String(nextTotalFloors)),
        "success"
      );
      setAddFloorOpen(false);
      setSelectedBuilding(b.id);
      setSelectedFloor(startFloor);
      await refreshAfterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setSavingFloor(false);
    }
  };

  // Bulk Add Rooms
  const openBulkAdd = () => {
    const defaultB =
      selectedBuilding !== "all"
        ? buildings.find((b) => b.id === selectedBuilding) ?? buildings[0]
        : buildings[0];
    setBulkBuildingId(defaultB?.id ?? "");
    setBulkPrefix((defaultB?.code ?? "").replace(/\s*[0-9]+$/, "").trim());
    setBulkFloorFrom(1);
    setBulkFloorTo(defaultB?.total_floors ?? 5);
    setBulkRoomsPerFloor(4);
    setBulkCapacity(4);
    setBulkFee(2500000);
    setBulkOpen(true);
  };

  const handleBulkSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBulk(true);
    try {
      const existingNumbers = new Set(
        rooms
          .filter((r) => r.building_id === bulkBuildingId)
          .map((r) => r.room_number)
      );
      const rawPrefix = bulkPrefix.trim();
      const normalizedPrefix =
        rawPrefix.length > 2 ? `${rawPrefix} ` : rawPrefix;
      const rowsToInsert = [];
      for (let fl = bulkFloorFrom; fl <= bulkFloorTo; fl++) {
        for (let idx = 1; idx <= bulkRoomsPerFloor; idx++) {
          const num = `${normalizedPrefix}${fl}${String(idx).padStart(2, "0")}`;
          if (!existingNumbers.has(num)) {
            rowsToInsert.push({
              building_id: bulkBuildingId,
              room_number: num,
              floor: fl,
              capacity: Number(bulkCapacity) || 4,
              monthly_fee: Number(bulkFee) || 0,
              status: "available" as RoomStatus,
              notes: "",
            });
          }
        }
      }
      if (rowsToInsert.length > 0) {
        await createRoomsBatch(rowsToInsert);
      }
      showToast(
        t.rooms.generatedRoomsCount.replace(
          "{n}",
          String(rowsToInsert.length)
        ),
        "success"
      );
      setBulkOpen(false);
      await refreshAfterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setSavingBulk(false);
    }
  };

  const toggleRoomMaintenance = async (room: Room) => {
    const occ = (membersByRoom.get(room.id) ?? []).length;
    const nextStatus: RoomStatus =
      room.status === "maintenance"
        ? occ >= room.capacity
          ? "full"
          : "available"
        : "maintenance";

    setRooms((prev) =>
      prev.map((r) => (r.id === room.id ? { ...r, status: nextStatus } : r))
    );

    try {
      await setRoomStatus(room.id, nextStatus);
      showToast(t.common.successSave, "success");
      await refreshAfterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
      await loadData(true);
    }
  };

  const openAssignModal = (room: Room) => {
    setAssignRoom(room);
    const unassigned = members.filter(
      (m) =>
        m.room_id !== room.id &&
        m.status !== "checked_out" &&
        m.status !== "suspended"
    );
    setAssignMode(unassigned.length > 0 ? "existing" : "new");
    setAssignMemberId(unassigned[0]?.id ?? "");
    setNewStudentCode(
      `STU${String(Math.floor(10000 + Math.random() * 89999))}`
    );
    setNewFullName("");
    setNewGender("male");
    setNewPhone("");
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignRoom) return;
    setSavingAssign(true);
    try {
      if (assignMode === "existing") {
        if (!assignMemberId) return;
        await updateMember(assignMemberId, {
          room_id: assignRoom.id,
          status: "active",
        });
      } else {
        await createMember({
          student_code: newStudentCode.trim(),
          full_name: newFullName.trim(),
          gender: newGender,
          phone: newPhone.trim(),
          country: "ไทย",
          province: "",
          room_id: assignRoom.id,
          check_in_date: getTodayYYYYMMDD(),
          status: "active",
          notes: "",
        });
      }
      showToast(t.common.successSave, "success");
      setAssignRoom(null);
      await refreshAfterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setSavingAssign(false);
    }
  };

  const handleRemoveFromRoom = async (member: Member) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, room_id: null } : m))
    );
    try {
      await updateMember(member.id, { room_id: null });
      showToast(t.common.successSave, "success");
      await refreshAfterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
      await loadData(true);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferMember) return;
    setTransferring(true);
    try {
      await updateMember(transferMember.id, { room_id: targetRoomId || null });
      showToast(t.common.successSave, "success");
      setTransferMember(null);
      await refreshAfterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setTransferring(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "building") {
        await deleteBuilding(deleteTarget.id);
      } else {
        await deleteRoom(deleteTarget.id);
      }
      showToast(t.common.successDelete, "success");
      if (deleteTarget.type === "room" && inspectRoomId === deleteTarget.id) {
        setInspectRoomId(null);
      }
      setDeleteTarget(null);
      await refreshAfterMutation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : t.common.errorGeneric, "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <PageHeader
          title={t.rooms.title}
          subtitle={t.rooms.subtitle}
          actions={
            <>
              <button
                type="button"
                onClick={openAddBuilding}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Building2 className="h-4 w-4 text-navy-600" />
                {t.rooms.addBuilding}
              </button>
              <button
                type="button"
                onClick={() => openAddFloorModal()}
                disabled={buildings.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t.rooms.addFloor}
              </button>
              <button
                type="button"
                onClick={openBulkAdd}
                disabled={buildings.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl border border-navy-200 bg-navy-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-navy-800 hover:bg-navy-100 disabled:opacity-50 transition-colors"
              >
                <Layers className="h-4 w-4" />
                {t.rooms.bulkAddRooms}
              </button>
              <button
                type="button"
                onClick={() => openAddRoom()}
                disabled={buildings.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-navy-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-navy-700 disabled:opacity-50 transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t.rooms.addRoom}
              </button>
            </>
          }
        />

        {/* Buildings Strip */}
        <BuildingSummaryStrip
          buildings={buildings}
          rooms={rooms}
          members={members}
          membersByRoom={membersByRoom}
          selectedBuilding={selectedBuilding}
          onSelectBuilding={(id) => {
            setSelectedBuilding(id);
            setSelectedFloor("all");
          }}
          onEditBuilding={openEditBuilding}
          onDeleteBuilding={(id) => setDeleteTarget({ type: "building", id })}
          labels={{
            all: t.common.all,
            building: t.common.building,
            room: t.common.room,
            floor: t.rooms.floor,
            activeResidents: t.dashboard.activeResidents,
          }}
        />

        {/* Floor Tabs + View Mode Toggle */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 px-1">
              {t.rooms.floor}:
            </span>
            <button
              type="button"
              onClick={() => setSelectedFloor("all")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedFloor === "all"
                  ? "bg-navy-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {t.rooms.allFloors}
            </button>
            {availableFloors.map((fl) => {
              const countOnFloor = rooms.filter(
                (r) =>
                  (selectedBuilding === "all" ||
                    r.building_id === selectedBuilding) &&
                  r.floor === fl
              ).length;
              return (
                <button
                  key={fl}
                  type="button"
                  onClick={() => setSelectedFloor(fl)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedFloor === fl
                      ? "bg-navy-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {t.rooms.floor} {fl} ({countOnFloor})
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Availability Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: "all", label: t.common.all },
                { key: "available", label: t.rooms.statusAvailable },
                { key: "full", label: t.rooms.statusFull },
                { key: "maintenance", label: t.rooms.statusMaintenance },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setAvailabilityFilter(f.key)}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    availabilityFilter === f.key
                      ? "bg-navy-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Compact vs Detailed View Switcher */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("compact")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  viewMode === "compact"
                    ? "bg-white text-navy-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {t.rooms.compactView}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("detailed")}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  viewMode === "detailed"
                    ? "bg-white text-navy-700 shadow-xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                {t.rooms.detailedView}
              </button>
            </div>
          </div>
        </div>

        {/* Rooms Grouped by Floor */}
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 rounded-xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : roomsGroupedByFloor.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs">
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title={t.common.noData}
              action={
                buildings.length === 0 ? (
                  <button
                    type="button"
                    onClick={openAddBuilding}
                    className="inline-flex items-center gap-2 rounded-xl bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"
                  >
                    <Building2 className="h-4 w-4" />
                    {t.rooms.addBuilding}
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <RoomCardsGrid
            roomsGroupedByFloor={roomsGroupedByFloor}
            membersByRoom={membersByRoom}
            viewMode={viewMode}
            lang={lang}
            onInspectRoom={(roomId) => setInspectRoomId(roomId)}
            onAddRoomOnFloor={(fl) => openAddRoom(fl)}
            onOpenAssignModal={openAssignModal}
            onTransferMember={(m) => {
              setTransferMember(m);
              setTargetRoomId("");
            }}
            onRemoveFromRoom={handleRemoveFromRoom}
            onToggleMaintenance={toggleRoomMaintenance}
            onEditRoom={openEditRoom}
            onDeleteRoom={(id) => setDeleteTarget({ type: "room", id })}
            labels={{
              floor: t.rooms.floor,
              room: t.common.room,
              occupants: t.rooms.occupants,
              bedsAvailable: t.rooms.bedsAvailable,
              addRoomOnFloor: t.rooms.addRoomOnFloor,
              statusMaintenance: t.rooms.statusMaintenance,
              statusAvailable: t.rooms.statusAvailable,
              statusFull: t.rooms.statusFull,
              membersInRoom: t.rooms.membersInRoom,
              assignMember: t.rooms.assignMember,
              emptyRoom: t.rooms.emptyRoom,
              transferMember: t.rooms.transferMember,
              removeFromRoom: t.rooms.removeFromRoom,
              edit: t.common.edit,
              delete: t.common.delete,
            }}
          />
        )}
      </div>

      <RoomInspectModal
        inspectedRoom={inspectedRoom}
        occupants={inspectedRoom ? (membersByRoom.get(inspectedRoom.id) ?? []) : []}
        lang={lang}
        onClose={() => setInspectRoomId(null)}
        onOpenAssign={openAssignModal}
        onTransferMember={(m) => {
          setTransferMember(m);
          setTargetRoomId("");
        }}
        onRemoveFromRoom={handleRemoveFromRoom}
        onToggleMaintenance={toggleRoomMaintenance}
        onEditRoom={openEditRoom}
        onDeleteRoom={(id) => setDeleteTarget({ type: "room", id })}
        labels={{
          room: t.common.room,
          floor: t.rooms.floor,
          occupants: t.rooms.occupants,
          assignMember: t.rooms.assignMember,
          emptyRoom: t.rooms.emptyRoom,
          transferMember: t.rooms.transferMember,
          statusAvailable: t.rooms.statusAvailable,
          statusMaintenance: t.rooms.statusMaintenance,
          edit: t.common.edit,
          delete: t.common.delete,
        }}
      />

      <AddFloorModal
        open={addFloorOpen}
        onClose={() => setAddFloorOpen(false)}
        buildings={buildings}
        afBuildingId={afBuildingId}
        setAfBuildingId={setAfBuildingId}
        afCount={afCount}
        setAfCount={setAfCount}
        afAutoRooms={afAutoRooms}
        setAfAutoRooms={setAfAutoRooms}
        afRoomsPerFloor={afRoomsPerFloor}
        setAfRoomsPerFloor={setAfRoomsPerFloor}
        afCapacity={afCapacity}
        setAfCapacity={setAfCapacity}
        afFee={afFee}
        setAfFee={setAfFee}
        savingFloor={savingFloor}
        onSubmit={handleSaveAddFloor}
        labels={{
          addFloorTitle: t.rooms.addFloorTitle,
          building: t.common.building,
          floor: t.rooms.floor,
          floorsToAdd: t.rooms.floorsToAdd,
          autoCreateRoomsOnFloor: t.rooms.autoCreateRoomsOnFloor,
          roomsPerFloor: t.rooms.roomsPerFloor,
          capacity: t.rooms.capacity,
          monthlyFee: t.rooms.monthlyFee,
          cancel: t.common.cancel,
          save: t.common.save,
          saving: t.common.saving,
        }}
      />

      <BuildingFormModal
        open={buildingModalOpen}
        onClose={() => setBuildingModalOpen(false)}
        editingBuilding={editingBuilding}
        bCode={bCode}
        setBCode={setBCode}
        bFloors={bFloors}
        setBFloors={setBFloors}
        bName={bName}
        setBName={setBName}
        bPolicy={bPolicy}
        setBPolicy={setBPolicy}
        bDesc={bDesc}
        setBDesc={setBDesc}
        savingBuilding={savingBuilding}
        onSubmit={saveBuilding}
        labels={{
          editBuilding: t.rooms.editBuilding,
          addBuilding: t.rooms.addBuilding,
          buildingCode: t.rooms.buildingCode,
          totalFloors: t.rooms.totalFloors,
          buildingName: t.rooms.buildingName,
          genderPolicy: t.rooms.genderPolicy,
          policyMale: t.rooms.policyMale,
          policyFemale: t.rooms.policyFemale,
          policyMixed: t.rooms.policyMixed,
          notes: t.common.notes,
          cancel: t.common.cancel,
          save: t.common.save,
          saving: t.common.saving,
        }}
      />

      <RoomFormModal
        open={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        editingRoom={editingRoom}
        buildings={buildings}
        rBuildingId={rBuildingId}
        setRBuildingId={setRBuildingId}
        rNumber={rNumber}
        setRNumber={setRNumber}
        rFloor={rFloor}
        setRFloor={setRFloor}
        rCapacity={rCapacity}
        setRCapacity={setRCapacity}
        rFee={rFee}
        setRFee={setRFee}
        rStatus={rStatus}
        setRStatus={setRStatus}
        rNotes={rNotes}
        setRNotes={setRNotes}
        savingRoom={savingRoom}
        onSubmit={saveRoom}
        labels={{
          editRoom: t.rooms.editRoom,
          addRoom: t.rooms.addRoom,
          building: t.common.building,
          roomNumber: t.rooms.roomNumber,
          floor: t.rooms.floor,
          capacity: t.rooms.capacity,
          monthlyFee: t.rooms.monthlyFee,
          status: t.common.status,
          statusAvailable: t.rooms.statusAvailable,
          statusFull: t.rooms.statusFull,
          statusMaintenance: t.rooms.statusMaintenance,
          notes: t.common.notes,
          cancel: t.common.cancel,
          save: t.common.save,
          saving: t.common.saving,
        }}
      />

      <BulkRoomsModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        buildings={buildings}
        bulkBuildingId={bulkBuildingId}
        setBulkBuildingId={setBulkBuildingId}
        bulkPrefix={bulkPrefix}
        setBulkPrefix={setBulkPrefix}
        bulkFloorFrom={bulkFloorFrom}
        setBulkFloorFrom={setBulkFloorFrom}
        bulkFloorTo={bulkFloorTo}
        setBulkFloorTo={setBulkFloorTo}
        bulkRoomsPerFloor={bulkRoomsPerFloor}
        setBulkRoomsPerFloor={setBulkRoomsPerFloor}
        bulkCapacity={bulkCapacity}
        setBulkCapacity={setBulkCapacity}
        bulkFee={bulkFee}
        setBulkFee={setBulkFee}
        savingBulk={savingBulk}
        onSubmit={handleBulkSave}
        labels={{
          bulkAddRooms: t.rooms.bulkAddRooms,
          building: t.common.building,
          roomPrefix: t.rooms.roomPrefix,
          floorFrom: t.rooms.floorFrom,
          floorTo: t.rooms.floorTo,
          roomsPerFloor: t.rooms.roomsPerFloor,
          capacity: t.rooms.capacity,
          monthlyFee: t.rooms.monthlyFee,
          cancel: t.common.cancel,
          save: t.common.save,
          saving: t.common.saving,
        }}
      />

      <AssignMemberModal
        assignRoom={assignRoom}
        onClose={() => setAssignRoom(null)}
        assignMode={assignMode}
        setAssignMode={setAssignMode}
        assignableMembers={assignableMembers}
        assignMemberId={assignMemberId}
        setAssignMemberId={setAssignMemberId}
        newStudentCode={newStudentCode}
        setNewStudentCode={setNewStudentCode}
        newFullName={newFullName}
        setNewFullName={setNewFullName}
        newGender={newGender}
        setNewGender={setNewGender}
        newPhone={newPhone}
        setNewPhone={setNewPhone}
        savingAssign={savingAssign}
        onSubmit={handleAssignSubmit}
        labels={{
          assignMember: t.rooms.assignMember,
          selectExistingMember: t.rooms.selectExistingMember,
          orCreateNewMember: t.rooms.orCreateNewMember,
          member: t.common.member,
          noData: t.common.noData,
          transferMember: t.rooms.transferMember,
          unassigned: t.members.unassigned,
          studentCode: t.members.studentCode,
          fullName: t.members.fullName,
          gender: t.members.gender,
          male: t.members.male,
          female: t.members.female,
          other: t.members.other,
          phone: t.members.phone,
          cancel: t.common.cancel,
          save: t.common.save,
          saving: t.common.saving,
        }}
      />

      <TransferMemberModal
        transferMember={transferMember}
        onClose={() => setTransferMember(null)}
        rooms={rooms}
        membersByRoom={membersByRoom}
        targetRoomId={targetRoomId}
        setTargetRoomId={setTargetRoomId}
        transferring={transferring}
        onSubmit={handleTransfer}
        labels={{
          transferMember: t.rooms.transferMember,
          selectNewRoom: t.rooms.selectNewRoom,
          cancel: t.common.cancel,
          save: t.common.save,
          saving: t.common.saving,
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </AppShell>
  );
}
