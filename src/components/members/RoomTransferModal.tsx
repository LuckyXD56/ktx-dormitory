"use client";

import React, { useMemo, useState } from "react";
import { ArrowRight, Building2, Loader2, MoveRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pickLang, useI18n } from "@/lib/i18n";
import { updateMember } from "@/services";
import type { Building, Member, Room } from "@/types/database";

interface Props {
  open: boolean;
  onClose: () => void;
  member: Member | null;
  rooms: (Room & { building?: Building | null })[];
  onTransferred: () => void;
}

export function RoomTransferModal({ open, onClose, member, rooms, onTransferred }: Props) {
  const { lang } = useI18n();
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = (th: string, vi: string, en: string) =>
    pickLang(lang, { th, vi, en, zh: en, lo: th });

  // Group available rooms by building (exclude current room)
  const groupedRooms = useMemo(() => {
    const available = rooms.filter(
      (r) => r.id !== member?.room_id && r.status !== "maintenance"
    );
    const map = new Map<string, { building: Building | null; rooms: (Room & { building?: Building | null })[] }>();
    for (const r of available) {
      const bid = r.building_id;
      if (!map.has(bid)) map.set(bid, { building: r.building ?? null, rooms: [] });
      map.get(bid)!.rooms.push(r);
    }
    return Array.from(map.values());
  }, [rooms, member?.room_id]);

  const currentRoom = member?.room
    ? `${member.room.building?.name ?? ""} · ${member.room.room_number}`
    : label("ยังไม่ได้กำหนดห้อง", "Chưa có phòng", "No room assigned");

  const targetRoom = rooms.find((r) => r.id === selectedRoomId);

  const handleTransfer = async () => {
    if (!member || !selectedRoomId) return;
    setSaving(true);
    setError(null);
    try {
      await updateMember(member.id, { room_id: selectedRoomId, status: "active" });
      onTransferred();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromRoom = async () => {
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      await updateMember(member.id, { room_id: null });
      onTransferred();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  if (!member) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={label("ย้ายห้องพัก", "Chuyển phòng", "Room Transfer")}
      maxWidth="md"
    >
      <div className="space-y-5">
        {/* Member info */}
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0d4b97]/10 text-[#0d4b97] font-bold text-sm">
            {member.full_name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">{member.full_name}</p>
            <p className="text-xs text-slate-500">{member.student_code}</p>
          </div>
        </div>

        {/* Current → Target */}
        <div className="flex items-center gap-2 text-sm">
          <div className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-slate-600 text-center text-xs font-medium">
            {currentRoom}
          </div>
          <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />
          <div className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-medium transition-colors ${
            targetRoom
              ? "bg-[#0d4b97]/10 text-[#0d4b97] border border-[#0d4b97]/20"
              : "bg-slate-100 text-slate-400"
          }`}>
            {targetRoom
              ? `${targetRoom.building?.name ?? ""} · ${targetRoom.room_number}`
              : label("เลือกห้องปลายทาง...", "Chọn phòng đích...", "Select target room...")}
          </div>
        </div>

        {/* Room selector */}
        <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
          {groupedRooms.length === 0 && (
            <p className="p-4 text-center text-sm text-slate-400">
              {label("ไม่มีห้องว่าง", "Không có phòng trống", "No rooms available")}
            </p>
          )}
          {groupedRooms.map(({ building, rooms: bRooms }) => (
            <div key={building?.id ?? "none"}>
              <div className="sticky top-0 bg-slate-50 px-3 py-1.5 flex items-center gap-1.5 border-b border-slate-100">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  {building?.name ?? label("ไม่ระบุอาคาร", "Chưa xác định", "Unknown Building")}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-2">
                {bRooms.map((r) => {
                  const isFull = r.status === "full";
                  const isSelected = r.id === selectedRoomId;
                  return (
                    <button
                      key={r.id}
                      onClick={() => !isFull && setSelectedRoomId(r.id)}
                      disabled={isFull}
                      className={`rounded-lg border px-2 py-2 text-xs font-medium text-left transition-all ${
                        isSelected
                          ? "border-[#0d4b97] bg-[#0d4b97] text-white shadow-sm"
                          : isFull
                          ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                          : "border-slate-200 hover:border-[#0d4b97]/40 hover:bg-blue-50 text-slate-700"
                      }`}
                    >
                      <span className="block font-bold">{r.room_number}</span>
                      <span className={`block text-[10px] mt-0.5 ${isSelected ? "text-blue-200" : "text-slate-400"}`}>
                        {isFull ? label("เต็ม", "Đầy", "Full") : label("ว่าง", "Trống", "Available")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveFromRoom}
            disabled={saving || !member.room_id}
            className="text-rose-600 hover:bg-rose-50 text-xs"
          >
            {label("นำออกจากห้อง", "Rời khỏi phòng", "Remove from room")}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              {label("ยกเลิก", "Hủy", "Cancel")}
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={!selectedRoomId || saving}
              className="gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoveRight className="h-4 w-4" />
              )}
              {label("ยืนยันย้ายห้อง", "Xác nhận chuyển", "Confirm Transfer")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
