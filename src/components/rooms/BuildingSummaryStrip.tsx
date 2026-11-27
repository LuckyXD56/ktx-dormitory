"use client";

import React from "react";
import { Edit2, Trash2 } from "lucide-react";
import type { Building, Member, Room } from "@/types/database";

interface BuildingSummaryStripProps {
  buildings: Building[];
  rooms: Room[];
  members: Member[];
  membersByRoom: Map<string, Member[]>;
  selectedBuilding: string;
  onSelectBuilding: (buildingId: string) => void;
  onEditBuilding: (building: Building) => void;
  onDeleteBuilding: (buildingId: string) => void;
  labels: {
    all: string;
    building: string;
    room: string;
    floor: string;
    activeResidents: string;
  };
}

/** Interactive building selector cards with live bed-occupancy progress bars. */
export function BuildingSummaryStrip({
  buildings,
  rooms,
  members,
  membersByRoom,
  selectedBuilding,
  onSelectBuilding,
  onEditBuilding,
  onDeleteBuilding,
  labels,
}: BuildingSummaryStripProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <button
        type="button"
        onClick={() => onSelectBuilding("all")}
        className={`rounded-2xl border p-4 text-left transition-all duration-150 ${
          selectedBuilding === "all"
            ? "border-navy-600 bg-gradient-to-br from-navy-700 to-navy-900 text-white shadow-md"
            : "border-slate-200 bg-white text-slate-800 hover:border-navy-200 hover:shadow-xs"
        }`}
      >
        <p className="text-xs font-semibold opacity-80">{labels.all}</p>
        <p className="text-lg font-bold mt-1">
          {buildings.length} {labels.building} • {rooms.length} {labels.room}
        </p>
        <p className="text-xs opacity-75 mt-1">
          {members.filter((m) => m.status === "active").length}{" "}
          {labels.activeResidents}
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
            onClick={() => onSelectBuilding(b.id)}
            className={`cursor-pointer rounded-2xl border p-4 transition-all duration-150 ${
              active
                ? "border-navy-600 bg-navy-950 text-white shadow-md"
                : "border-slate-200 bg-white text-slate-800 hover:border-navy-300 hover:shadow-xs"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider opacity-75">
                  {b.code} • {b.total_floors} {labels.floor}
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
                  onClick={() => onEditBuilding(b)}
                  className="rounded-lg p-1.5 opacity-75 hover:opacity-100 hover:bg-white/10 transition-colors"
                  aria-label="Edit building"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteBuilding(b.id)}
                  className="rounded-lg p-1.5 opacity-75 hover:opacity-100 hover:text-rose-400 transition-colors"
                  aria-label="Delete building"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-2.5">
              <div className="flex justify-between text-[11px] opacity-80 mb-1">
                <span>
                  {bRooms.length} {labels.room}
                </span>
                <span className="tabular-nums">
                  {occCount}/{totalCap} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200/30 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
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
  );
}
