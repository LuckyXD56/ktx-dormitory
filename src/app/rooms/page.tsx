"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  BedDouble,
  Building2,
  Edit2,
  LayoutGrid,
  Layers,
  List,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/providers/ToastProvider";
import { useI18n } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import {
  emitAlertsRefresh,
  getCached,
  invalidateCache,
  isCacheFresh,
  setCached,
} from "@/lib/cache";
import { formatCurrency, getInitials, getTodayYYYYMMDD } from "@/lib/utils";
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

  // Preset 3x5 setup loading
  const [runningPreset, setRunningPreset] = useState(false);

  // Add Floor Modal
  const [addFloorOpen, setAddFloorOpen] = useState(false);
  const [afBuildingId, setAfBuildingId] = useState("");
  const [afCount, setAfCount] = useState(1);
  const [afAutoRooms, setAfAutoRooms] = useState(true);
  const [afRoomsPerFloor, setAfRoomsPerFloor] = useState(4);
  const [afCapacity, setAfCapacity] = useState(4);
  const [afFee, setAfFee] = useState(2500);
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
  const [rFee, setRFee] = useState(2500);
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
  const [bulkFee, setBulkFee] = useState(2500);
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
    const supabase = createClient();
    if (!supabase) return;
    if (!force && isCacheFresh("rooms_page", 15_000)) {
      setLoading(false);
      return;
    }
    if (!initialCache) setLoading(true);
    try {
      const [bRes, rRes, mRes] = await Promise.all([
        supabase.from("buildings").select("*").order("code"),
        supabase
          .from("rooms")
          .select("*, building:buildings(*)")
          .order("room_number"),
        supabase.from("members").select("*").order("full_name"),
      ]);
      const payload: RoomsCachePayload = {
        buildings: (bRes.data as Building[]) ?? [],
        rooms: (rRes.data as Room[]) ?? [],
        members: (mRes.data as Member[]) ?? [],
      };
      setBuildings(payload.buildings);
      setRooms(payload.rooms);
      setMembers(payload.members);
      setCached("rooms_page", payload);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

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

  // 1-Click 3 Buildings x 5 Floors Preset Setup
  const handlePreset3x5 = async () => {
    if (!window.confirm(t.rooms.preset3x5Confirm)) return;
    const supabase = createClient();
    if (!supabase) return;
    setRunningPreset(true);
    try {
      const presetBuildings: {
        code: string;
        name: string;
        gender_policy: GenderPolicy;
      }[] = [
        { code: "A", name: "อาคาร A", gender_policy: "male" },
        { code: "B", name: "อาคาร B", gender_policy: "female" },
        { code: "C", name: "อาคาร C", gender_policy: "mixed" },
      ];

      for (const pb of presetBuildings) {
        const existing = buildings.find(
          (b) => b.code.toUpperCase() === pb.code
        );
        if (!existing) {
          await supabase.from("buildings").insert({
            code: pb.code,
            name: pb.name,
            total_floors: 5,
            gender_policy: pb.gender_policy,
            description: "5 ชั้น",
          });
        } else if (existing.total_floors < 5) {
          await supabase
            .from("buildings")
            .update({ total_floors: 5 })
            .eq("id", existing.id);
        }
      }

      const { data: freshBlds } = await supabase
        .from("buildings")
        .select("*")
        .order("code");
      const { data: freshRooms } = await supabase
        .from("rooms")
        .select("building_id, room_number");

      const existingRoomSet = new Set(
        (freshRooms ?? []).map(
          (r: { building_id: string; room_number: string }) =>
            `${r.building_id}:${r.room_number}`
        )
      );

      const newRooms: {
        building_id: string;
        room_number: string;
        floor: number;
        capacity: number;
        monthly_fee: number;
        status: RoomStatus;
        notes: string;
      }[] = [];

      ((freshBlds as Building[]) ?? [])
        .filter((b) => ["A", "B", "C"].includes(b.code.toUpperCase()))
        .forEach((b) => {
          for (let fl = 1; fl <= 5; fl++) {
            for (let rm = 1; rm <= 4; rm++) {
              const roomNum = `${b.code}${fl}${String(rm).padStart(2, "0")}`;
              if (!existingRoomSet.has(`${b.id}:${roomNum}`)) {
                newRooms.push({
                  building_id: b.id,
                  room_number: roomNum,
                  floor: fl,
                  capacity: 4,
                  monthly_fee: fl >= 4 ? 3000 : 2500,
                  status: "available",
                  notes: "",
                });
              }
            }
          }
        });

      if (newRooms.length > 0) {
        const { error } = await supabase.from("rooms").insert(newRooms);
        if (error) {
          showToast(error.message, "error");
          return;
        }
      }

      showToast(t.rooms.preset3x5Success, "success");
      await refreshAfterMutation();
    } finally {
      setRunningPreset(false);
    }
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
    const supabase = createClient();
    if (!supabase) return;
    setSavingBuilding(true);
    try {
      const payload = {
        code: bCode.trim().toUpperCase(),
        name: bName.trim(),
        total_floors: Number(bFloors) || 1,
        gender_policy: bPolicy,
        description: bDesc.trim(),
      };
      const { error } = editingBuilding
        ? await supabase
            .from("buildings")
            .update(payload)
            .eq("id", editingBuilding.id)
        : await supabase.from("buildings").insert(payload);

      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successSave, "success");
      setBuildingModalOpen(false);
      await refreshAfterMutation();
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
    setRFee(2500);
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
    const supabase = createClient();
    if (!supabase) return;
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
      const { error } = editingRoom
        ? await supabase.from("rooms").update(payload).eq("id", editingRoom.id)
        : await supabase.from("rooms").insert(payload);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successSave, "success");
      setRoomModalOpen(false);
      await refreshAfterMutation();
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
    setAfFee(2500);
    setAddFloorOpen(true);
  };

  const handleSaveAddFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    const b = buildings.find((x) => x.id === afBuildingId);
    if (!b) return;

    setSavingFloor(true);
    try {
      const startFloor = b.total_floors + 1;
      const nextTotalFloors =
        b.total_floors + Math.max(1, Number(afCount) || 1);

      const { error: updErr } = await supabase
        .from("buildings")
        .update({ total_floors: nextTotalFloors })
        .eq("id", b.id);

      if (updErr) {
        showToast(updErr.message, "error");
        return;
      }

      if (afAutoRooms && afRoomsPerFloor > 0) {
        const existingNums = new Set(
          rooms
            .filter((r) => r.building_id === b.id)
            .map((r) => r.room_number)
        );
        const newRooms = [];
        for (let fl = startFloor; fl <= nextTotalFloors; fl++) {
          for (let idx = 1; idx <= afRoomsPerFloor; idx++) {
            const num = `${b.code}${fl}${String(idx).padStart(2, "0")}`;
            if (!existingNums.has(num)) {
              newRooms.push({
                building_id: b.id,
                room_number: num,
                floor: fl,
                capacity: Number(afCapacity) || 4,
                monthly_fee: Number(afFee) || 0,
                status: "available",
                notes: "",
              });
            }
          }
        }
        if (newRooms.length > 0) {
          const { error: roomErr } = await supabase
            .from("rooms")
            .insert(newRooms);
          if (roomErr) {
            showToast(roomErr.message, "error");
            return;
          }
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
    setBulkPrefix(defaultB?.code ?? "");
    setBulkFloorFrom(1);
    setBulkFloorTo(defaultB?.total_floors ?? 5);
    setBulkRoomsPerFloor(4);
    setBulkCapacity(4);
    setBulkFee(2500);
    setBulkOpen(true);
  };

  const handleBulkSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setSavingBulk(true);
    try {
      const existingNumbers = new Set(
        rooms
          .filter((r) => r.building_id === bulkBuildingId)
          .map((r) => r.room_number)
      );
      const rowsToInsert = [];
      for (let fl = bulkFloorFrom; fl <= bulkFloorTo; fl++) {
        for (let idx = 1; idx <= bulkRoomsPerFloor; idx++) {
          const num = `${bulkPrefix.trim()}${fl}${String(idx).padStart(2, "0")}`;
          if (!existingNumbers.has(num)) {
            rowsToInsert.push({
              building_id: bulkBuildingId,
              room_number: num,
              floor: fl,
              capacity: Number(bulkCapacity) || 4,
              monthly_fee: Number(bulkFee) || 0,
              status: "available",
              notes: "",
            });
          }
        }
      }
      if (rowsToInsert.length > 0) {
        const { error } = await supabase.from("rooms").insert(rowsToInsert);
        if (error) {
          showToast(error.message, "error");
          return;
        }
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
    } finally {
      setSavingBulk(false);
    }
  };

  const toggleRoomMaintenance = async (room: Room) => {
    const supabase = createClient();
    if (!supabase) return;
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

    const { error } = await supabase
      .from("rooms")
      .update({ status: nextStatus })
      .eq("id", room.id);

    if (error) {
      showToast(error.message, "error");
      await loadData(true);
      return;
    }
    showToast(t.common.successSave, "success");
    await refreshAfterMutation();
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
    const supabase = createClient();
    if (!supabase) return;
    setSavingAssign(true);
    try {
      if (assignMode === "existing") {
        if (!assignMemberId) return;
        const { error } = await supabase
          .from("members")
          .update({ room_id: assignRoom.id, status: "active" })
          .eq("id", assignMemberId);
        if (error) {
          showToast(error.message, "error");
          return;
        }
      } else {
        const { error } = await supabase.from("members").insert({
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
        if (error) {
          showToast(error.message, "error");
          return;
        }
      }
      showToast(t.common.successSave, "success");
      setAssignRoom(null);
      await refreshAfterMutation();
    } finally {
      setSavingAssign(false);
    }
  };

  const handleRemoveFromRoom = async (member: Member) => {
    const supabase = createClient();
    if (!supabase) return;

    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, room_id: null } : m))
    );

    const { error } = await supabase
      .from("members")
      .update({ room_id: null })
      .eq("id", member.id);

    if (error) {
      showToast(error.message, "error");
      await loadData(true);
      return;
    }
    showToast(t.common.successSave, "success");
    await refreshAfterMutation();
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferMember) return;
    const supabase = createClient();
    if (!supabase) return;
    setTransferring(true);
    try {
      const { error } = await supabase
        .from("members")
        .update({ room_id: targetRoomId || null })
        .eq("id", transferMember.id);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successSave, "success");
      setTransferMember(null);
      await refreshAfterMutation();
    } finally {
      setTransferring(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const supabase = createClient();
    if (!supabase) return;
    setDeleting(true);
    try {
      const table = deleteTarget.type === "building" ? "buildings" : "rooms";
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", deleteTarget.id);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successDelete, "success");
      if (deleteTarget.type === "room" && inspectRoomId === deleteTarget.id) {
        setInspectRoomId(null);
      }
      setDeleteTarget(null);
      await refreshAfterMutation();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {t.rooms.title}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{t.rooms.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={runningPreset}
              onClick={handlePreset3x5}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
            >
              {runningPreset ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {t.rooms.preset3x5}
            </button>
            <button
              type="button"
              onClick={openAddBuilding}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Building2 className="h-4 w-4 text-navy-600" />
              {t.rooms.addBuilding}
            </button>
            <button
              type="button"
              onClick={() => openAddFloorModal()}
              disabled={buildings.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {t.rooms.addFloor}
            </button>
            <button
              type="button"
              onClick={openBulkAdd}
              disabled={buildings.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-navy-200 bg-navy-50 px-3.5 py-2 text-xs sm:text-sm font-semibold text-navy-800 hover:bg-navy-100 disabled:opacity-50"
            >
              <Layers className="h-4 w-4" />
              {t.rooms.bulkAddRooms}
            </button>
            <button
              type="button"
              onClick={() => openAddRoom()}
              disabled={buildings.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-navy-600 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {t.rooms.addRoom}
            </button>
          </div>
        </div>

        {/* Buildings Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => {
              setSelectedBuilding("all");
              setSelectedFloor("all");
            }}
            className={`rounded-2xl border p-4 text-left transition-all ${
              selectedBuilding === "all"
                ? "border-navy-600 bg-gradient-to-br from-navy-700 to-navy-900 text-white shadow-md"
                : "border-slate-200 bg-white text-slate-800 hover:border-navy-200"
            }`}
          >
            <p className="text-xs font-semibold opacity-80">{t.common.all}</p>
            <p className="text-lg font-bold mt-1">
              {buildings.length} {t.common.building} • {rooms.length}{" "}
              {t.common.room}
            </p>
            <p className="text-xs opacity-75 mt-1">
              {members.filter((m) => m.status === "active").length}{" "}
              {t.dashboard.activeResidents}
            </p>
          </button>

          {buildings.map((b) => {
            const bRooms = rooms.filter((r) => r.building_id === b.id);
            const totalCap = bRooms.reduce((s, r) => s + r.capacity, 0);
            const occCount = bRooms.reduce(
              (s, r) => s + (membersByRoom.get(r.id) ?? []).length,
              0
            );
            const active = selectedBuilding === b.id;
            const pct = totalCap > 0 ? Math.round((occCount / totalCap) * 100) : 0;

            return (
              <div
                key={b.id}
                onClick={() => {
                  setSelectedBuilding(b.id);
                  setSelectedFloor("all");
                }}
                className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                  active
                    ? "border-navy-600 bg-navy-950 text-white shadow-md"
                    : "border-slate-200 bg-white text-slate-800 hover:border-navy-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-75">
                      {b.code} • {b.total_floors} {t.rooms.floor}
                    </span>
                    <p className="text-sm font-bold leading-snug truncate">
                      {b.name}
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => openEditBuilding(b)}
                      className="rounded-lg p-1 opacity-70 hover:opacity-100 hover:bg-white/10"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({ type: "building", id: b.id })
                      }
                      className="rounded-lg p-1 opacity-70 hover:opacity-100 hover:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2.5">
                  <div className="flex justify-between text-[11px] opacity-80 mb-1">
                    <span>
                      {bRooms.length} {t.common.room}
                    </span>
                    <span>
                      {occCount}/{totalCap} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200/30 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        active ? "bg-blue-400" : "bg-navy-600"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

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
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-3">
            <p className="text-sm text-slate-500">{t.common.noData}</p>
            {buildings.length === 0 && (
              <button
                type="button"
                disabled={runningPreset}
                onClick={handlePreset3x5}
                className="inline-flex items-center gap-2 rounded-xl bg-navy-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"
              >
                <Sparkles className="h-4 w-4" />
                {t.rooms.preset3x5}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {roomsGroupedByFloor.map(([floorNum, floorRooms]) => {
              const floorCap = floorRooms.reduce((s, r) => s + r.capacity, 0);
              const floorOcc = floorRooms.reduce(
                (s, r) => s + (membersByRoom.get(r.id) ?? []).length,
                0
              );
              const floorFree = Math.max(0, floorCap - floorOcc);

              return (
                <div key={floorNum} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex items-center rounded-lg bg-navy-900 px-2.5 py-1 text-xs font-bold text-white">
                        {t.rooms.floor} {floorNum}
                      </span>
                      <span className="text-xs font-medium text-slate-600">
                        {floorRooms.length} {t.common.room} •{" "}
                        {t.rooms.occupants} {floorOcc}/{floorCap} •{" "}
                        <strong className="text-emerald-700">
                          {t.rooms.bedsAvailable.replace(
                            "{n}",
                            String(floorFree)
                          )}
                        </strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAddRoom(floorNum)}
                      className="inline-flex items-center gap-1 rounded-lg bg-navy-50 border border-navy-200 px-2.5 py-1 text-xs font-semibold text-navy-700 hover:bg-navy-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t.rooms.addRoomOnFloor}
                    </button>
                  </div>

                  {viewMode === "compact" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                      {floorRooms.map((room) => {
                        const occupants = membersByRoom.get(room.id) ?? [];
                        const freeBeds = Math.max(
                          0,
                          room.capacity - occupants.length
                        );
                        const isMaint = room.status === "maintenance";
                        const isFull = !isMaint && freeBeds === 0;

                        return (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => setInspectRoomId(room.id)}
                            className={`text-left rounded-2xl border p-3.5 transition-all hover:shadow-md ${
                              isMaint
                                ? "border-slate-200 bg-slate-100/80 text-slate-600"
                                : isFull
                                ? "border-rose-200 bg-rose-50/50 hover:border-rose-300"
                                : "border-emerald-200 bg-white hover:border-navy-400"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-base font-bold text-slate-900">
                                {room.room_number}
                              </span>
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                  isMaint
                                    ? "bg-slate-400"
                                    : isFull
                                    ? "bg-rose-500"
                                    : "bg-emerald-500"
                                }`}
                              />
                            </div>
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {room.building?.code ?? ""} •{" "}
                              {formatCurrency(Number(room.monthly_fee), lang)}
                            </p>
                            <div className="mt-2.5 flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800">
                                {occupants.length}/{room.capacity}
                              </span>
                              <div className="flex -space-x-1.5">
                                {occupants.slice(0, 3).map((m) => (
                                  <span
                                    key={m.id}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-navy-600 text-[9px] font-bold text-white ring-2 ring-white"
                                  >
                                    {getInitials(m.full_name)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {floorRooms.map((room) => {
                        const occupants = membersByRoom.get(room.id) ?? [];
                        const freeBeds = Math.max(
                          0,
                          room.capacity - occupants.length
                        );
                        const isMaint = room.status === "maintenance";
                        const isFull = !isMaint && freeBeds === 0;

                        return (
                          <div
                            key={room.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col justify-between gap-4"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-700 font-bold text-sm">
                                    {room.room_number}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-slate-900">
                                      {room.building?.name ??
                                        room.building?.code}{" "}
                                      • {t.common.room} {room.room_number}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {t.rooms.floor} {room.floor} •{" "}
                                      {formatCurrency(
                                        Number(room.monthly_fee),
                                        lang
                                      )}
                                    </p>
                                  </div>
                                </div>

                                <Badge
                                  variant={
                                    isMaint
                                      ? "slate"
                                      : isFull
                                      ? "rose"
                                      : "emerald"
                                  }
                                >
                                  {isMaint
                                    ? t.rooms.statusMaintenance
                                    : isFull
                                    ? t.rooms.statusFull
                                    : t.rooms.bedsAvailable.replace(
                                        "{n}",
                                        String(freeBeds)
                                      )}
                                </Badge>
                              </div>

                              <div className="mt-3">
                                <div className="flex justify-between text-xs text-slate-500 mb-1">
                                  <span className="inline-flex items-center gap-1">
                                    <BedDouble className="h-3.5 w-3.5" />
                                    {t.rooms.occupants}
                                  </span>
                                  <span className="font-semibold text-slate-800">
                                    {occupants.length} / {room.capacity}
                                  </span>
                                </div>
                                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      isFull ? "bg-rose-500" : "bg-navy-600"
                                    }`}
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        (occupants.length /
                                          Math.max(1, room.capacity)) *
                                          100
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    {t.rooms.membersInRoom}
                                  </p>
                                  {!isMaint && freeBeds > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => openAssignModal(room)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-navy-50 px-2 py-1 text-[11px] font-semibold text-navy-700 hover:bg-navy-100"
                                    >
                                      <UserPlus className="h-3 w-3" />
                                      {t.rooms.assignMember}
                                    </button>
                                  )}
                                </div>

                                {occupants.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic py-1">
                                    {t.rooms.emptyRoom}
                                  </p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {occupants.map((m) => (
                                      <div
                                        key={m.id}
                                        className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5 border border-slate-100"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div className="h-6 w-6 rounded-full bg-navy-100 text-navy-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                            {getInitials(m.full_name)}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-xs font-semibold text-slate-800 truncate">
                                              {m.full_name}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                              {m.student_code}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setTransferMember(m);
                                              setTargetRoomId("");
                                            }}
                                            className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2 py-1 text-[10px] font-semibold text-navy-700 hover:bg-navy-50"
                                            title={t.rooms.transferMember}
                                          >
                                            <ArrowRightLeft className="h-3 w-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveFromRoom(m)
                                            }
                                            className="inline-flex items-center gap-1 rounded-lg bg-white border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50"
                                            title={t.rooms.removeFromRoom}
                                          >
                                            <UserMinus className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => toggleRoomMaintenance(room)}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                              >
                                <Wrench className="h-3.5 w-3.5" />
                                {isMaint
                                  ? t.rooms.statusAvailable
                                  : t.rooms.statusMaintenance}
                              </button>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditRoom(room)}
                                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  {t.common.edit}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: "room",
                                      id: room.id,
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  {t.common.delete}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Room Detail Modal (when clicking a room in Compact Matrix) */}
      <Modal
        open={Boolean(inspectedRoom)}
        onClose={() => setInspectRoomId(null)}
        title={
          inspectedRoom
            ? `${inspectedRoom.building?.name ?? inspectedRoom.building?.code ?? ""} • ${t.common.room} ${inspectedRoom.room_number}`
            : ""
        }
        subtitle={
          inspectedRoom
            ? `${t.rooms.floor} ${inspectedRoom.floor} • ${formatCurrency(Number(inspectedRoom.monthly_fee), lang)}`
            : ""
        }
        maxWidth="md"
      >
        {inspectedRoom && (() => {
          const occupants = membersByRoom.get(inspectedRoom.id) ?? [];
          const freeBeds = Math.max(0, inspectedRoom.capacity - occupants.length);
          const isMaint = inspectedRoom.status === "maintenance";
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 border border-slate-200">
                <span className="text-sm font-semibold text-slate-800">
                  {t.rooms.occupants}: {occupants.length}/{inspectedRoom.capacity}
                </span>
                {!isMaint && freeBeds > 0 && (
                  <button
                    type="button"
                    onClick={() => openAssignModal(inspectedRoom)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-navy-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {t.rooms.assignMember}
                  </button>
                )}
              </div>

              {occupants.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">
                  {t.rooms.emptyRoom}
                </p>
              ) : (
                <div className="space-y-2">
                  {occupants.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-navy-100 text-navy-800 text-xs font-bold flex items-center justify-center shrink-0">
                          {getInitials(m.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {m.full_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {m.student_code} • {m.phone || "-"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setTransferMember(m);
                            setTargetRoomId("");
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          {t.rooms.transferMember}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromRoom(m)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => toggleRoomMaintenance(inspectedRoom)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  {isMaint
                    ? t.rooms.statusAvailable
                    : t.rooms.statusMaintenance}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInspectRoomId(null);
                      openEditRoom(inspectedRoom);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    {t.common.edit}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({ type: "room", id: inspectedRoom.id })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t.common.delete}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Add Floor Modal */}
      <Modal
        open={addFloorOpen}
        onClose={() => setAddFloorOpen(false)}
        title={t.rooms.addFloorTitle}
        maxWidth="md"
      >
        <form onSubmit={handleSaveAddFloor} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.common.building} *
              </label>
              <select
                required
                value={afBuildingId}
                onChange={(e) => setAfBuildingId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.total_floors} {t.rooms.floor})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.floorsToAdd} *
              </label>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={afCount}
                onChange={(e) => setAfCount(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={afAutoRooms}
              onChange={(e) => setAfAutoRooms(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-navy-600"
            />
            {t.rooms.autoCreateRoomsOnFloor}
          </label>

          {afAutoRooms && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.rooms.roomsPerFloor}
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={afRoomsPerFloor}
                  onChange={(e) => setAfRoomsPerFloor(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.rooms.capacity}
                </label>
                <input
                  type="number"
                  min={1}
                  value={afCapacity}
                  onChange={(e) => setAfCapacity(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.rooms.monthlyFee}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={afFee}
                  onChange={(e) => setAfFee(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAddFloorOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={savingFloor}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {savingFloor ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Building Modal */}
      <Modal
        open={buildingModalOpen}
        onClose={() => setBuildingModalOpen(false)}
        title={editingBuilding ? t.rooms.editBuilding : t.rooms.addBuilding}
        maxWidth="md"
      >
        <form onSubmit={saveBuilding} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.buildingCode} *
              </label>
              <input
                type="text"
                required
                value={bCode}
                onChange={(e) => setBCode(e.target.value)}
                placeholder="A"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.totalFloors} *
              </label>
              <input
                type="number"
                min={1}
                required
                value={bFloors}
                onChange={(e) => setBFloors(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.buildingName} *
              </label>
              <input
                type="text"
                required
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.genderPolicy}
              </label>
              <select
                value={bPolicy}
                onChange={(e) => setBPolicy(e.target.value as GenderPolicy)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              >
                <option value="male">{t.rooms.policyMale}</option>
                <option value="female">{t.rooms.policyFemale}</option>
                <option value="mixed">{t.rooms.policyMixed}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.common.notes}
              </label>
              <textarea
                rows={2}
                value={bDesc}
                onChange={(e) => setBDesc(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setBuildingModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={savingBuilding}
              className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
            >
              {savingBuilding ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Room Modal */}
      <Modal
        open={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        title={editingRoom ? t.rooms.editRoom : t.rooms.addRoom}
        maxWidth="md"
      >
        <form onSubmit={saveRoom} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.common.building} *
              </label>
              <select
                required
                value={rBuildingId}
                onChange={(e) => setRBuildingId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.roomNumber} *
              </label>
              <input
                type="text"
                required
                value={rNumber}
                onChange={(e) => setRNumber(e.target.value)}
                placeholder="A101"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.floor}
              </label>
              <input
                type="number"
                min={1}
                value={rFloor}
                onChange={(e) => setRFloor(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.capacity}
              </label>
              <input
                type="number"
                min={1}
                value={rCapacity}
                onChange={(e) => setRCapacity(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.monthlyFee}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={rFee}
                onChange={(e) => setRFee(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.common.status}
              </label>
              <select
                value={rStatus}
                onChange={(e) => setRStatus(e.target.value as RoomStatus)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              >
                <option value="available">{t.rooms.statusAvailable}</option>
                <option value="full">{t.rooms.statusFull}</option>
                <option value="maintenance">{t.rooms.statusMaintenance}</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.common.notes}
              </label>
              <textarea
                rows={2}
                value={rNotes}
                onChange={(e) => setRNotes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRoomModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={savingRoom}
              className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
            >
              {savingRoom ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Add Rooms Modal */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title={t.rooms.bulkAddRooms}
        maxWidth="md"
      >
        <form onSubmit={handleBulkSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.common.building} *
              </label>
              <select
                required
                value={bulkBuildingId}
                onChange={(e) => {
                  setBulkBuildingId(e.target.value);
                  const b = buildings.find((x) => x.id === e.target.value);
                  if (b) {
                    setBulkPrefix(b.code);
                    setBulkFloorTo(b.total_floors);
                  }
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.roomPrefix}
              </label>
              <input
                type="text"
                value={bulkPrefix}
                onChange={(e) => setBulkPrefix(e.target.value)}
                placeholder="A"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.floorFrom}
              </label>
              <input
                type="number"
                min={1}
                required
                value={bulkFloorFrom}
                onChange={(e) => setBulkFloorFrom(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.floorTo}
              </label>
              <input
                type="number"
                min={bulkFloorFrom}
                required
                value={bulkFloorTo}
                onChange={(e) => setBulkFloorTo(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.roomsPerFloor}
              </label>
              <input
                type="number"
                min={1}
                max={30}
                required
                value={bulkRoomsPerFloor}
                onChange={(e) => setBulkRoomsPerFloor(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.capacity}
              </label>
              <input
                type="number"
                min={1}
                required
                value={bulkCapacity}
                onChange={(e) => setBulkCapacity(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.rooms.monthlyFee}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={bulkFee}
                onChange={(e) => setBulkFee(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setBulkOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={savingBulk}
              className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
            >
              {savingBulk ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign or Quick-Add Member to Room Modal */}
      <Modal
        open={Boolean(assignRoom)}
        onClose={() => setAssignRoom(null)}
        title={t.rooms.assignMember}
        subtitle={
          assignRoom
            ? `${assignRoom.building?.name ?? ""} • ${assignRoom.room_number}`
            : ""
        }
        maxWidth="md"
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAssignMode("existing")}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold border ${
                assignMode === "existing"
                  ? "bg-navy-600 text-white border-navy-600"
                  : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              {t.rooms.selectExistingMember}
            </button>
            <button
              type="button"
              onClick={() => setAssignMode("new")}
              className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold border ${
                assignMode === "new"
                  ? "bg-navy-600 text-white border-navy-600"
                  : "bg-white text-slate-700 border-slate-200"
              }`}
            >
              {t.rooms.orCreateNewMember}
            </button>
          </div>

          {assignMode === "existing" ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.common.member}
              </label>
              {assignableMembers.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  {t.common.noData}
                </p>
              ) : (
                <select
                  required
                  value={assignMemberId}
                  onChange={(e) => setAssignMemberId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {assignableMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.student_code} — {m.full_name} (
                      {m.room_id ? t.rooms.transferMember : t.members.unassigned}
                      )
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.members.studentCode} *
                </label>
                <input
                  type="text"
                  required
                  value={newStudentCode}
                  onChange={(e) => setNewStudentCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.members.fullName} *
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.members.gender}
                </label>
                <select
                  value={newGender}
                  onChange={(e) =>
                    setNewGender(e.target.value as MemberGender)
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setAssignRoom(null)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={
                savingAssign ||
                (assignMode === "existing" && assignableMembers.length === 0)
              }
              className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
            >
              {savingAssign ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Transfer Member Modal */}
      <Modal
        open={Boolean(transferMember)}
        onClose={() => setTransferMember(null)}
        title={t.rooms.transferMember}
        subtitle={transferMember?.full_name}
        maxWidth="sm"
      >
        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.rooms.selectNewRoom}
            </label>
            <select
              required
              value={targetRoomId}
              onChange={(e) => setTargetRoomId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
            >
              <option value="">-- {t.rooms.selectNewRoom} --</option>
              {rooms.map((r) => {
                const occ = (membersByRoom.get(r.id) ?? []).length;
                const disabled =
                  r.id === transferMember?.room_id ||
                  r.status === "maintenance" ||
                  occ >= r.capacity;
                return (
                  <option key={r.id} value={r.id} disabled={disabled}>
                    {r.building?.name ?? r.building?.code} — {r.room_number} (
                    {occ}/{r.capacity})
                  </option>
                );
              })}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTransferMember(null)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={transferring}
              className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
            >
              {transferring ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        loading={deleting}
      />
    </AppShell>
  );
}
