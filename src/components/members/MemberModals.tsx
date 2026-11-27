"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/select";
import { formatDate, getInitials } from "@/lib/utils";
import type {
  Language,
  Member,
  MemberGender,
  MemberStatus,
  Room,
} from "@/types/database";

export interface MemberFormState {
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

interface MemberFormModalProps {
  open: boolean;
  onClose: () => void;
  editingMember: Member | null;
  form: MemberFormState;
  setForm: React.Dispatch<React.SetStateAction<MemberFormState>>;
  rooms: Room[];
  roomOccupancyMap: Map<string, number>;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  labels: {
    editMember: string;
    addMember: string;
    avatar: string;
    studentCode: string;
    fullName: string;
    gender: string;
    male: string;
    female: string;
    other: string;
    phone: string;
    country: string;
    province: string;
    buildingRoom: string;
    unassigned: string;
    checkInDate: string;
    residenceStatus: string;
    statusActive: string;
    statusOnLeave: string;
    statusCheckedOut: string;
    statusSuspended: string;
    notes: string;
    cancel: string;
    save: string;
    saving: string;
  };
}

export function MemberFormModal({
  open,
  onClose,
  editingMember,
  form,
  setForm,
  rooms,
  roomOccupancyMap,
  saving,
  onSubmit,
  labels,
}: MemberFormModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingMember ? labels.editMember : labels.addMember}
      maxWidth="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <ImageUpload
          value={form.avatar_url}
          onChange={(url) => setForm((f) => ({ ...f, avatar_url: url }))}
          folder="avatars"
          label={labels.avatar}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.studentCode} *
            </label>
            <Input
              type="text"
              required
              value={form.student_code}
              onChange={(e) =>
                setForm((f) => ({ ...f, student_code: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.fullName} *
            </label>
            <Input
              type="text"
              required
              value={form.full_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, full_name: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.gender}
            </label>
            <Select
              value={form.gender}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  gender: e.target.value as MemberGender,
                }))
              }
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
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.country}
            </label>
            <Input
              type="text"
              value={form.country}
              onChange={(e) =>
                setForm((f) => ({ ...f, country: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.province}
            </label>
            <Input
              type="text"
              value={form.province}
              onChange={(e) =>
                setForm((f) => ({ ...f, province: e.target.value }))
              }
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.buildingRoom}
            </label>
            <Select
              value={form.room_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, room_id: e.target.value }))
              }
            >
              <option value="">{labels.unassigned}</option>
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
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.checkInDate}
            </label>
            <Input
              type="date"
              value={form.check_in_date}
              onChange={(e) =>
                setForm((f) => ({ ...f, check_in_date: e.target.value }))
              }
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.residenceStatus}
            </label>
            <Select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as MemberStatus,
                }))
              }
            >
              <option value="active">{labels.statusActive}</option>
              <option value="on_leave">{labels.statusOnLeave}</option>
              <option value="checked_out">{labels.statusCheckedOut}</option>
              <option value="suspended">{labels.statusSuspended}</option>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {labels.notes}
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-500/15"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {labels.cancel}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
          >
            {saving ? labels.saving : labels.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}

interface MemberDetailModalProps {
  member: Member | null;
  onClose: () => void;
  lang: Language;
  renderStatusBadge: (status: MemberStatus) => React.ReactNode;
  labels: {
    unassigned: string;
    gender: string;
    male: string;
    female: string;
    other: string;
    phone: string;
    country: string;
    province: string;
    checkInDate: string;
    notes: string;
  };
}

export function MemberDetailModal({
  member,
  onClose,
  lang,
  renderStatusBadge,
  labels,
}: MemberDetailModalProps) {
  return (
    <Modal
      open={Boolean(member)}
      onClose={onClose}
      title={member?.full_name ?? ""}
      subtitle={member?.student_code}
      maxWidth="md"
    >
      {member && (
        <div className="space-y-4 text-sm">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-navy-100 text-navy-800 font-bold text-lg flex items-center justify-center overflow-hidden">
              {member.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.avatar_url}
                  alt={member.full_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(member.full_name)
              )}
            </div>
            <div>
              <p className="font-bold text-slate-900 text-base">
                {member.full_name}
              </p>
              <p className="text-slate-500">
                {member.room
                  ? `${member.room.building?.name ?? ""} / ${member.room.room_number}`
                  : labels.unassigned}
              </p>
              <div className="mt-1">
                {renderStatusBadge(member.status)}
                {!member.avatar_url && <Badge className="sr-only">avatar</Badge>}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-100">
            <div>
              <p className="text-xs text-slate-400">{labels.gender}</p>
              <p className="font-medium">
                {member.gender === "male"
                  ? labels.male
                  : member.gender === "female"
                  ? labels.female
                  : labels.other}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{labels.phone}</p>
              <p className="font-medium">{member.phone || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{labels.country}</p>
              <p className="font-medium">{member.country}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{labels.province}</p>
              <p className="font-medium">{member.province || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{labels.checkInDate}</p>
              <p className="font-medium">{formatDate(member.check_in_date, lang)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">{labels.notes}</p>
              <p className="font-medium">{member.notes || "-"}</p>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
