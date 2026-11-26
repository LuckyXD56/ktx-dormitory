"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Edit2, Loader2, Megaphone, Pin, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
} from "@/lib/cache";
import { formatDateTime } from "@/lib/utils";
import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementScope,
  Building,
  Room,
} from "@/types/database";

export default function AnnouncementsPage() {
  const { t, lang } = useI18n();
  const { user, isAdminOrAbove } = useAuth();
  const { showToast } = useToast();

  const initialAnn = getCached<{
    announcements: Announcement[];
    buildings: Building[];
    rooms: Room[];
  }>("announcements_page");

  const [announcements, setAnnouncements] = useState<Announcement[]>(
    initialAnn?.announcements ?? []
  );
  const [buildings, setBuildings] = useState<Building[]>(
    initialAnn?.buildings ?? []
  );
  const [rooms, setRooms] = useState<Room[]>(initialAnn?.rooms ?? []);
  const [loading, setLoading] = useState(!initialAnn);

  const [catFilter, setCatFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [aTitle, setATitle] = useState("");
  const [aContent, setAContent] = useState("");
  const [aCategory, setACategory] = useState<AnnouncementCategory>("general");
  const [aScope, setAScope] = useState<AnnouncementScope>("all");
  const [aBuildingId, setABuildingId] = useState("");
  const [aRoomId, setARoomId] = useState("");
  const [aPinned, setAPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async (force = false) => {
    const supabase = createClient();
    if (!supabase) return;
    if (!force && isCacheFresh("announcements_page", 15_000)) {
      setLoading(false);
      return;
    }
    if (!getCached("announcements_page")) setLoading(true);
    try {
      const [aRes, bRes, rRes] = await Promise.all([
        supabase
          .from("announcements")
          .select(
            "*, building:buildings(*), room:rooms(*), author:profiles(id, full_name, role)"
          )
          .order("is_pinned", { ascending: false })
          .order("published_at", { ascending: false }),
        supabase.from("buildings").select("*").order("code"),
        supabase
          .from("rooms")
          .select("*, building:buildings(*)")
          .order("room_number"),
      ]);
      const payload = {
        announcements: (aRes.data as Announcement[]) ?? [],
        buildings: (bRes.data as Building[]) ?? [],
        rooms: (rRes.data as Room[]) ?? [],
      };
      setAnnouncements(payload.announcements);
      setBuildings(payload.buildings);
      setRooms(payload.rooms);
      setCached("announcements_page", payload);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const refreshAnnouncements = async () => {
    invalidateCache("announcements_page");
    invalidateCache("dashboard_page");
    emitAlertsRefresh();
    await loadData(true);
  };

  const categoryLabel = (c: AnnouncementCategory) => {
    switch (c) {
      case "meeting":
        return t.announcements.catMeeting;
      case "cleaning":
        return t.announcements.catCleaning;
      case "inspection":
        return t.announcements.catInspection;
      case "rules":
        return t.announcements.catRules;
      case "activity":
        return t.announcements.catActivity;
      default:
        return t.announcements.catGeneral;
    }
  };

  const openAdd = () => {
    setEditing(null);
    setATitle("");
    setAContent("");
    setACategory("meeting");
    setAScope("all");
    setABuildingId(buildings[0]?.id ?? "");
    setARoomId(rooms[0]?.id ?? "");
    setAPinned(false);
    setModalOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setATitle(a.title);
    setAContent(a.content);
    setACategory(a.category);
    setAScope(a.target_scope);
    setABuildingId(a.target_building_id ?? buildings[0]?.id ?? "");
    setARoomId(a.target_room_id ?? rooms[0]?.id ?? "");
    setAPinned(a.is_pinned);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase || !user) return;
    setSaving(true);
    try {
      const payload = {
        title: aTitle.trim(),
        content: aContent.trim(),
        category: aCategory,
        target_scope: aScope,
        target_building_id:
          aScope === "building" ? aBuildingId || null : null,
        target_room_id: aScope === "room" ? aRoomId || null : null,
        is_pinned: aPinned,
        created_by: user.id,
      };
      const { error } = editing
        ? await supabase
            .from("announcements")
            .update(payload)
            .eq("id", editing.id)
        : await supabase.from("announcements").insert(payload);

      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successSave, "success");
      setModalOpen(false);
      await refreshAnnouncements();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const supabase = createClient();
    if (!supabase) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", deletingId);
      if (error) {
        showToast(error.message, "error");
        return;
      }
      showToast(t.common.successDelete, "success");
      setDeletingId(null);
      await refreshAnnouncements();
    } finally {
      setDeleting(false);
    }
  };

  const visible = announcements.filter(
    (a) => catFilter === "all" || a.category === catFilter
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {t.announcements.title}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {t.announcements.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"
          >
            <Plus className="h-4 w-4" />
            {t.announcements.addAnnouncement}
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {(
            [
              "all",
              "meeting",
              "cleaning",
              "inspection",
              "rules",
              "activity",
              "general",
            ] as const
          ).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCatFilter(cat)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                catFilter === cat
                  ? "bg-navy-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {cat === "all" ? t.common.all : categoryLabel(cat)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-navy-600" />
            <span className="text-sm">{t.common.loading}</span>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            {t.common.noData}
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((a) => (
              <div
                key={a.id}
                className={`rounded-2xl border p-5 shadow-xs ${
                  a.is_pinned
                    ? "border-navy-300 bg-navy-50/40"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {a.is_pinned && (
                        <Badge variant="navy">
                          <Pin className="h-3 w-3" />
                          {t.announcements.pinned}
                        </Badge>
                      )}
                      <Badge variant="sky">{categoryLabel(a.category)}</Badge>
                      <Badge variant="slate">
                        {a.target_scope === "all"
                          ? t.announcements.scopeAll
                          : a.target_scope === "building"
                          ? `${t.announcements.scopeBuilding}: ${a.building?.name ?? ""}`
                          : `${t.announcements.scopeRoom}: ${a.room?.room_number ?? ""}`}
                      </Badge>
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {a.title}
                    </h2>
                    <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                      {a.content}
                    </p>
                    <p className="text-xs text-slate-400 pt-1">
                      {t.announcements.publishedAt}:{" "}
                      {formatDateTime(a.published_at, lang)}
                      {a.author ? ` • ${a.author.full_name}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(a)}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-navy-700"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(a.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          editing
            ? t.announcements.editAnnouncement
            : t.announcements.addAnnouncement
        }
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.announcements.announcementTitle} *
            </label>
            <input
              type="text"
              required
              value={aTitle}
              onChange={(e) => setATitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.announcements.category}
              </label>
              <select
                value={aCategory}
                onChange={(e) =>
                  setACategory(e.target.value as AnnouncementCategory)
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="meeting">{t.announcements.catMeeting}</option>
                <option value="cleaning">{t.announcements.catCleaning}</option>
                <option value="inspection">
                  {t.announcements.catInspection}
                </option>
                <option value="rules">{t.announcements.catRules}</option>
                <option value="activity">{t.announcements.catActivity}</option>
                <option value="general">{t.announcements.catGeneral}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t.announcements.targetScope}
              </label>
              <select
                value={aScope}
                onChange={(e) => setAScope(e.target.value as AnnouncementScope)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="all">{t.announcements.scopeAll}</option>
                <option value="building">{t.announcements.scopeBuilding}</option>
                <option value="room">{t.announcements.scopeRoom}</option>
              </select>
            </div>

            {aScope === "building" && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.common.building}
                </label>
                <select
                  value={aBuildingId}
                  onChange={(e) => setABuildingId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {aScope === "room" && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t.common.room}
                </label>
                <select
                  value={aRoomId}
                  onChange={(e) => setARoomId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.building?.name ?? r.building?.code} — {r.room_number}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t.announcements.content} *
            </label>
            <textarea
              rows={4}
              required
              value={aContent}
              onChange={(e) => setAContent(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={aPinned}
              onChange={(e) => setAPinned(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-navy-600"
            />
            {t.announcements.pinTop}
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-navy-600 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
            >
              <Megaphone className="h-4 w-4" />
              {saving ? t.common.saving : t.common.save}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </AppShell>
  );
}
