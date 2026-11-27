"use client";

import React from "react";
import {
  ArrowRightLeft,
  Edit2,
  Trash2,
  UserMinus,
  UserPlus,
  Wrench,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/select";
import { formatCurrency, getInitials } from "@/lib/utils";
import type {
  Building,
  GenderPolicy,
  Language,
  Member,
  MemberGender,
  Room,
  RoomStatus,
} from "@/types/database";

interface RoomInspectModalProps {
  inspectedRoom: Room | null;
  occupants: Member[];
  lang: Language;
  onClose: () => void;
  onOpenAssign: (room: Room) => void;
  onTransferMember: (member: Member) => void;
  onRemoveFromRoom: (member: Member) => void;
  onToggleMaintenance: (room: Room) => void;
  onEditRoom: (room: Room) => void;
  onDeleteRoom: (roomId: string) => void;
  labels: {
    room: string;
    floor: string;
    occupants: string;
    assignMember: string;
    emptyRoom: string;
    transferMember: string;
    statusAvailable: string;
    statusMaintenance: string;
    edit: string;
    delete: string;
  };
}

export function RoomInspectModal({
  inspectedRoom,
  occupants,
  lang,
  onClose,
  onOpenAssign,
  onTransferMember,
  onRemoveFromRoom,
  onToggleMaintenance,
  onEditRoom,
  onDeleteRoom,
  labels,
}: RoomInspectModalProps) {
  return (
    <Modal
      open={Boolean(inspectedRoom)}
      onClose={onClose}
      title={
        inspectedRoom
          ? `${inspectedRoom.building?.name ?? inspectedRoom.building?.code ?? ""} • ${labels.room} ${inspectedRoom.room_number}`
          : ""
      }
      subtitle={
        inspectedRoom
          ? `${labels.floor} ${inspectedRoom.floor} • ${formatCurrency(Number(inspectedRoom.monthly_fee), lang)}`
          : ""
      }
      maxWidth="md"
    >
      {inspectedRoom && (() => {
        const freeBeds = Math.max(0, inspectedRoom.capacity - occupants.length);
        const isMaint = inspectedRoom.status === "maintenance";
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 border border-slate-200">
              <span className="text-sm font-semibold text-slate-800">
                {labels.occupants}: {occupants.length}/{inspectedRoom.capacity}
              </span>
              {!isMaint && freeBeds > 0 && (
                <button
                  type="button"
                  onClick={() => onOpenAssign(inspectedRoom)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-navy-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-700"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {labels.assignMember}
                </button>
              )}
            </div>

            {occupants.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                {labels.emptyRoom}
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
                        onClick={() => onTransferMember(m)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-navy-700 hover:bg-navy-50"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                        {labels.transferMember}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveFromRoom(m)}
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
                onClick={() => onToggleMaintenance(inspectedRoom)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Wrench className="h-3.5 w-3.5" />
                {isMaint ? labels.statusAvailable : labels.statusMaintenance}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditRoom(inspectedRoom);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  {labels.edit}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteRoom(inspectedRoom.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {labels.delete}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </Modal>
  );
}

interface AddFloorModalProps {
  open: boolean;
  onClose: () => void;
  buildings: Building[];
  afBuildingId: string;
  setAfBuildingId: (id: string) => void;
  afCount: number;
  setAfCount: (n: number) => void;
  afAutoRooms: boolean;
  setAfAutoRooms: (v: boolean) => void;
  afRoomsPerFloor: number;
  setAfRoomsPerFloor: (n: number) => void;
  afCapacity: number;
  setAfCapacity: (n: number) => void;
  afFee: number;
  setAfFee: (n: number) => void;
  savingFloor: boolean;
  onSubmit: (e: React.FormEvent) => void;
  labels: {
    addFloorTitle: string;
    building: string;
    floor: string;
    floorsToAdd: string;
    autoCreateRoomsOnFloor: string;
    roomsPerFloor: string;
    capacity: string;
    monthlyFee: string;
    cancel: string;
    save: string;
    saving: string;
  };
}

export function AddFloorModal({
  open,
  onClose,
  buildings,
  afBuildingId,
  setAfBuildingId,
  afCount,
  setAfCount,
  afAutoRooms,
  setAfAutoRooms,
  afRoomsPerFloor,
  setAfRoomsPerFloor,
  afCapacity,
  setAfCapacity,
  afFee,
  setAfFee,
  savingFloor,
  onSubmit,
  labels,
}: AddFloorModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={labels.addFloorTitle} maxWidth="md">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.building} *
            </label>
            <Select
              required
              value={afBuildingId}
              onChange={(e) => setAfBuildingId(e.target.value)}
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.total_floors} {labels.floor})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.floorsToAdd} *
            </label>
            <Input
              type="number"
              min={1}
              max={20}
              required
              value={afCount}
              onChange={(e) => setAfCount(Number(e.target.value))}
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
          {labels.autoCreateRoomsOnFloor}
        </label>

        {afAutoRooms && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {labels.roomsPerFloor}
              </label>
              <Input
                type="number"
                min={1}
                max={30}
                value={afRoomsPerFloor}
                onChange={(e) => setAfRoomsPerFloor(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {labels.capacity}
              </label>
              <Input
                type="number"
                min={1}
                value={afCapacity}
                onChange={(e) => setAfCapacity(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {labels.monthlyFee}
              </label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={afFee}
                onChange={(e) => setAfFee(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={savingFloor}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {savingFloor ? labels.saving : labels.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface BuildingFormModalProps {
  open: boolean;
  onClose: () => void;
  editingBuilding: Building | null;
  bCode: string;
  setBCode: (v: string) => void;
  bFloors: number;
  setBFloors: (v: number) => void;
  bName: string;
  setBName: (v: string) => void;
  bPolicy: GenderPolicy;
  setBPolicy: (v: GenderPolicy) => void;
  bDesc: string;
  setBDesc: (v: string) => void;
  savingBuilding: boolean;
  onSubmit: (e: React.FormEvent) => void;
  labels: {
    editBuilding: string;
    addBuilding: string;
    buildingCode: string;
    totalFloors: string;
    buildingName: string;
    genderPolicy: string;
    policyMale: string;
    policyFemale: string;
    policyMixed: string;
    notes: string;
    cancel: string;
    save: string;
    saving: string;
  };
}

export function BuildingFormModal({
  open,
  onClose,
  editingBuilding,
  bCode,
  setBCode,
  bFloors,
  setBFloors,
  bName,
  setBName,
  bPolicy,
  setBPolicy,
  bDesc,
  setBDesc,
  savingBuilding,
  onSubmit,
  labels,
}: BuildingFormModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingBuilding ? labels.editBuilding : labels.addBuilding}
      maxWidth="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.buildingCode} *
            </label>
            <Input
              type="text"
              required
              value={bCode}
              onChange={(e) => setBCode(e.target.value)}
              placeholder="A"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.totalFloors} *
            </label>
            <Input
              type="number"
              min={1}
              required
              value={bFloors}
              onChange={(e) => setBFloors(Number(e.target.value))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.buildingName} *
            </label>
            <Input
              type="text"
              required
              value={bName}
              onChange={(e) => setBName(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.genderPolicy}
            </label>
            <Select
              value={bPolicy}
              onChange={(e) => setBPolicy(e.target.value as GenderPolicy)}
            >
              <option value="male">{labels.policyMale}</option>
              <option value="female">{labels.policyFemale}</option>
              <option value="mixed">{labels.policyMixed}</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.notes}
            </label>
            <textarea
              rows={2}
              value={bDesc}
              onChange={(e) => setBDesc(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-500/15"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={savingBuilding}
            className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
          >
            {savingBuilding ? labels.saving : labels.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface RoomFormModalProps {
  open: boolean;
  onClose: () => void;
  editingRoom: Room | null;
  buildings: Building[];
  rBuildingId: string;
  setRBuildingId: (id: string) => void;
  rNumber: string;
  setRNumber: (v: string) => void;
  rFloor: number;
  setRFloor: (v: number) => void;
  rCapacity: number;
  setRCapacity: (v: number) => void;
  rFee: number;
  setRFee: (v: number) => void;
  rStatus: RoomStatus;
  setRStatus: (v: RoomStatus) => void;
  rNotes: string;
  setRNotes: (v: string) => void;
  savingRoom: boolean;
  onSubmit: (e: React.FormEvent) => void;
  labels: {
    editRoom: string;
    addRoom: string;
    building: string;
    roomNumber: string;
    floor: string;
    capacity: string;
    monthlyFee: string;
    status: string;
    statusAvailable: string;
    statusFull: string;
    statusMaintenance: string;
    notes: string;
    cancel: string;
    save: string;
    saving: string;
  };
}

export function RoomFormModal({
  open,
  onClose,
  editingRoom,
  buildings,
  rBuildingId,
  setRBuildingId,
  rNumber,
  setRNumber,
  rFloor,
  setRFloor,
  rCapacity,
  setRCapacity,
  rFee,
  setRFee,
  rStatus,
  setRStatus,
  rNotes,
  setRNotes,
  savingRoom,
  onSubmit,
  labels,
}: RoomFormModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingRoom ? labels.editRoom : labels.addRoom}
      maxWidth="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.building} *
            </label>
            <Select
              required
              value={rBuildingId}
              onChange={(e) => setRBuildingId(e.target.value)}
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.roomNumber} *
            </label>
            <Input
              type="text"
              required
              value={rNumber}
              onChange={(e) => setRNumber(e.target.value)}
              placeholder="A101"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.floor}
            </label>
            <Input
              type="number"
              min={1}
              value={rFloor}
              onChange={(e) => setRFloor(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.capacity}
            </label>
            <Input
              type="number"
              min={1}
              value={rCapacity}
              onChange={(e) => setRCapacity(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.monthlyFee}
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={rFee}
              onChange={(e) => setRFee(Number(e.target.value))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.status}
            </label>
            <Select
              value={rStatus}
              onChange={(e) => setRStatus(e.target.value as RoomStatus)}
            >
              <option value="available">{labels.statusAvailable}</option>
              <option value="full">{labels.statusFull}</option>
              <option value="maintenance">{labels.statusMaintenance}</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.notes}
            </label>
            <textarea
              rows={2}
              value={rNotes}
              onChange={(e) => setRNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-500/15"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={savingRoom}
            className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
          >
            {savingRoom ? labels.saving : labels.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface BulkRoomsModalProps {
  open: boolean;
  onClose: () => void;
  buildings: Building[];
  bulkBuildingId: string;
  setBulkBuildingId: (id: string) => void;
  bulkPrefix: string;
  setBulkPrefix: (v: string) => void;
  bulkFloorFrom: number;
  setBulkFloorFrom: (v: number) => void;
  bulkFloorTo: number;
  setBulkFloorTo: (v: number) => void;
  bulkRoomsPerFloor: number;
  setBulkRoomsPerFloor: (v: number) => void;
  bulkCapacity: number;
  setBulkCapacity: (v: number) => void;
  bulkFee: number;
  setBulkFee: (v: number) => void;
  savingBulk: boolean;
  onSubmit: (e: React.FormEvent) => void;
  labels: {
    bulkAddRooms: string;
    building: string;
    roomPrefix: string;
    floorFrom: string;
    floorTo: string;
    roomsPerFloor: string;
    capacity: string;
    monthlyFee: string;
    cancel: string;
    save: string;
    saving: string;
  };
}

export function BulkRoomsModal({
  open,
  onClose,
  buildings,
  bulkBuildingId,
  setBulkBuildingId,
  bulkPrefix,
  setBulkPrefix,
  bulkFloorFrom,
  setBulkFloorFrom,
  bulkFloorTo,
  setBulkFloorTo,
  bulkRoomsPerFloor,
  setBulkRoomsPerFloor,
  bulkCapacity,
  setBulkCapacity,
  bulkFee,
  setBulkFee,
  savingBulk,
  onSubmit,
  labels,
}: BulkRoomsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={labels.bulkAddRooms} maxWidth="md">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.building} *
            </label>
            <Select
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
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.roomPrefix}
            </label>
            <Input
              type="text"
              value={bulkPrefix}
              onChange={(e) => setBulkPrefix(e.target.value)}
              placeholder="A"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.floorFrom}
            </label>
            <Input
              type="number"
              min={1}
              required
              value={bulkFloorFrom}
              onChange={(e) => setBulkFloorFrom(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.floorTo}
            </label>
            <Input
              type="number"
              min={bulkFloorFrom}
              required
              value={bulkFloorTo}
              onChange={(e) => setBulkFloorTo(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.roomsPerFloor}
            </label>
            <Input
              type="number"
              min={1}
              max={30}
              required
              value={bulkRoomsPerFloor}
              onChange={(e) => setBulkRoomsPerFloor(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.capacity}
            </label>
            <Input
              type="number"
              min={1}
              required
              value={bulkCapacity}
              onChange={(e) => setBulkCapacity(Number(e.target.value))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.monthlyFee}
            </label>
            <Input
              type="number"
              min={0}
              step="0.01"
              required
              value={bulkFee}
              onChange={(e) => setBulkFee(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={savingBulk}
            className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
          >
            {savingBulk ? labels.saving : labels.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface AssignMemberModalProps {
  assignRoom: Room | null;
  onClose: () => void;
  assignMode: "existing" | "new";
  setAssignMode: (m: "existing" | "new") => void;
  assignableMembers: Member[];
  assignMemberId: string;
  setAssignMemberId: (id: string) => void;
  newStudentCode: string;
  setNewStudentCode: (v: string) => void;
  newFullName: string;
  setNewFullName: (v: string) => void;
  newGender: MemberGender;
  setNewGender: (v: MemberGender) => void;
  newPhone: string;
  setNewPhone: (v: string) => void;
  savingAssign: boolean;
  onSubmit: (e: React.FormEvent) => void;
  labels: {
    assignMember: string;
    selectExistingMember: string;
    orCreateNewMember: string;
    member: string;
    noData: string;
    transferMember: string;
    unassigned: string;
    studentCode: string;
    fullName: string;
    gender: string;
    male: string;
    female: string;
    other: string;
    phone: string;
    cancel: string;
    save: string;
    saving: string;
  };
}

export function AssignMemberModal({
  assignRoom,
  onClose,
  assignMode,
  setAssignMode,
  assignableMembers,
  assignMemberId,
  setAssignMemberId,
  newStudentCode,
  setNewStudentCode,
  newFullName,
  setNewFullName,
  newGender,
  setNewGender,
  newPhone,
  setNewPhone,
  savingAssign,
  onSubmit,
  labels,
}: AssignMemberModalProps) {
  return (
    <Modal
      open={Boolean(assignRoom)}
      onClose={onClose}
      title={labels.assignMember}
      subtitle={
        assignRoom
          ? `${assignRoom.building?.name ?? ""} • ${assignRoom.room_number}`
          : ""
      }
      maxWidth="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
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
            {labels.selectExistingMember}
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
            {labels.orCreateNewMember}
          </button>
        </div>

        {assignMode === "existing" ? (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.member}
            </label>
            {assignableMembers.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">{labels.noData}</p>
            ) : (
              <Select
                required
                value={assignMemberId}
                onChange={(e) => setAssignMemberId(e.target.value)}
              >
                {assignableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.student_code} — {m.full_name} (
                    {m.room_id ? labels.transferMember : labels.unassigned})
                  </option>
                ))}
              </Select>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {labels.studentCode} *
              </label>
              <Input
                type="text"
                required
                value={newStudentCode}
                onChange={(e) => setNewStudentCode(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {labels.fullName} *
              </label>
              <Input
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {labels.gender}
              </label>
              <Select
                value={newGender}
                onChange={(e) => setNewGender(e.target.value as MemberGender)}
              >
                <option value="male">{labels.male}</option>
                <option value="female">{labels.female}</option>
                <option value="other">{labels.other}</option>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {labels.phone}
              </label>
              <Input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={
              savingAssign ||
              (assignMode === "existing" && assignableMembers.length === 0)
            }
            className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
          >
            {savingAssign ? labels.saving : labels.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface TransferMemberModalProps {
  transferMember: Member | null;
  onClose: () => void;
  rooms: Room[];
  membersByRoom: Map<string, Member[]>;
  targetRoomId: string;
  setTargetRoomId: (id: string) => void;
  transferring: boolean;
  onSubmit: (e: React.FormEvent) => void;
  labels: {
    transferMember: string;
    selectNewRoom: string;
    cancel: string;
    save: string;
    saving: string;
  };
}

export function TransferMemberModal({
  transferMember,
  onClose,
  rooms,
  membersByRoom,
  targetRoomId,
  setTargetRoomId,
  transferring,
  onSubmit,
  labels,
}: TransferMemberModalProps) {
  return (
    <Modal
      open={Boolean(transferMember)}
      onClose={onClose}
      title={labels.transferMember}
      subtitle={transferMember?.full_name}
      maxWidth="sm"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {labels.selectNewRoom}
          </label>
          <Select
            required
            value={targetRoomId}
            onChange={(e) => setTargetRoomId(e.target.value)}
          >
            <option value="">-- {labels.selectNewRoom} --</option>
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
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={transferring}
            className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
          >
            {transferring ? labels.saving : labels.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
