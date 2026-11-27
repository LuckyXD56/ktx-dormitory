"use client";

import React from "react";
import {
  ArrowRightLeft,
  BedDouble,
  Edit2,
  Plus,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, getInitials } from "@/lib/utils";
import type { Language, Member, Room } from "@/types/database";

interface RoomCardsGridProps {
  roomsGroupedByFloor: [number, Room[]][];
  membersByRoom: Map<string, Member[]>;
  viewMode: "compact" | "detailed";
  lang: Language;
  onInspectRoom: (roomId: string) => void;
  onAddRoomOnFloor: (floorNum: number) => void;
  onOpenAssignModal: (room: Room) => void;
  onTransferMember: (member: Member) => void;
  onRemoveFromRoom: (member: Member) => void;
  onToggleMaintenance: (room: Room) => void;
  onEditRoom: (room: Room) => void;
  onDeleteRoom: (roomId: string) => void;
  labels: {
    floor: string;
    room: string;
    occupants: string;
    bedsAvailable: string;
    addRoomOnFloor: string;
    statusMaintenance: string;
    statusAvailable: string;
    statusFull: string;
    membersInRoom: string;
    assignMember: string;
    emptyRoom: string;
    transferMember: string;
    removeFromRoom: string;
    edit: string;
    delete: string;
  };
}

/** Floor-grouped room cards supporting compact matrix and detailed management views. */
export function RoomCardsGrid({
  roomsGroupedByFloor,
  membersByRoom,
  viewMode,
  lang,
  onInspectRoom,
  onAddRoomOnFloor,
  onOpenAssignModal,
  onTransferMember,
  onRemoveFromRoom,
  onToggleMaintenance,
  onEditRoom,
  onDeleteRoom,
  labels,
}: RoomCardsGridProps) {
  return (
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
                  {labels.floor} {floorNum}
                </span>
                <span className="text-xs font-medium text-slate-600">
                  {floorRooms.length} {labels.room} • {labels.occupants}{" "}
                  <span className="tabular-nums">
                    {floorOcc}/{floorCap}
                  </span>{" "}
                  •{" "}
                  <strong className="text-emerald-700">
                    {labels.bedsAvailable.replace("{n}", String(floorFree))}
                  </strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => onAddRoomOnFloor(floorNum)}
                className="inline-flex items-center gap-1 rounded-lg bg-navy-50 border border-navy-200 px-2.5 py-1 text-xs font-semibold text-navy-700 hover:bg-navy-100 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                {labels.addRoomOnFloor}
              </button>
            </div>

            {viewMode === "compact" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {floorRooms.map((room) => {
                  const occupants = membersByRoom.get(room.id) ?? [];
                  const freeBeds = Math.max(0, room.capacity - occupants.length);
                  const isMaint = room.status === "maintenance";
                  const isFull = !isMaint && freeBeds === 0;

                  return (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => onInspectRoom(room.id)}
                      className={`text-left rounded-2xl border p-3.5 transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${
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
                        <span className="text-xs font-bold text-slate-800 tabular-nums">
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
                  const freeBeds = Math.max(0, room.capacity - occupants.length);
                  const isMaint = room.status === "maintenance";
                  const isFull = !isMaint && freeBeds === 0;

                  return (
                    <div
                      key={room.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-sm transition-shadow flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy-700 font-bold text-sm">
                              {room.room_number}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                {room.building?.name ?? room.building?.code} •{" "}
                                {labels.room} {room.room_number}
                              </p>
                              <p className="text-xs text-slate-500">
                                {labels.floor} {room.floor} •{" "}
                                {formatCurrency(Number(room.monthly_fee), lang)}
                              </p>
                            </div>
                          </div>

                          <Badge
                            variant={
                              isMaint ? "slate" : isFull ? "rose" : "emerald"
                            }
                          >
                            {isMaint
                              ? labels.statusMaintenance
                              : isFull
                              ? labels.statusFull
                              : labels.bedsAvailable.replace(
                                  "{n}",
                                  String(freeBeds)
                                )}
                          </Badge>
                        </div>

                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span className="inline-flex items-center gap-1">
                              <BedDouble className="h-3.5 w-3.5" />
                              {labels.occupants}
                            </span>
                            <span className="font-semibold text-slate-800 tabular-nums">
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
                              {labels.membersInRoom}
                            </p>
                            {!isMaint && freeBeds > 0 && (
                              <button
                                type="button"
                                onClick={() => onOpenAssignModal(room)}
                                className="inline-flex items-center gap-1 rounded-lg bg-navy-50 px-2 py-1 text-[11px] font-semibold text-navy-700 hover:bg-navy-100 transition-colors"
                              >
                                <UserPlus className="h-3 w-3" />
                                {labels.assignMember}
                              </button>
                            )}
                          </div>

                          {occupants.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-1">
                              {labels.emptyRoom}
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
                                      onClick={() => onTransferMember(m)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2 py-1 text-[10px] font-semibold text-navy-700 hover:bg-navy-50 transition-colors"
                                      title={labels.transferMember}
                                    >
                                      <ArrowRightLeft className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onRemoveFromRoom(m)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-white border border-rose-200 px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                                      title={labels.removeFromRoom}
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
                          onClick={() => onToggleMaintenance(room)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          {isMaint
                            ? labels.statusAvailable
                            : labels.statusMaintenance}
                        </button>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditRoom(room)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            {labels.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRoom(room.id)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {labels.delete}
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
  );
}
