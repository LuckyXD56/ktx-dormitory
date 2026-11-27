"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Droplets,
  History,
  Loader2,
  Receipt,
  Save,
  Search,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterBar } from "@/components/ui/FilterBar";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/StatCard";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { pickLang, useI18n } from "@/lib/i18n";
import {
  createPaymentsBatch,
  listBuildings,
  listMembers,
  listRooms,
  listUtilityReadings,
  markUtilitiesBilled,
  upsertUtilityReadingsBatch,
} from "@/services";
import {
  emitAlertsRefresh,
  getCached,
  invalidateCache,
  setCached,
  subscribeDormSync,
} from "@/lib/cache";
import { formatCurrency, getCurrentMonthYYYYMM } from "@/lib/utils";
import type {
  Building,
  Member,
  Room,
  UtilityReading,
} from "@/types/database";

interface MeterRowState {
  room: Room;
  elec_prev: number;
  elec_curr: number;
  water_prev: number;
  water_curr: number;
  billed: boolean;
  saved: boolean;
  dirty: boolean;
}

function getPreviousMonth(ym: string): string {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return ym;
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

export default function UtilitiesPage() {
  const { lang, t } = useI18n();
  const { user, isAdminOrAbove } = useAuth();
  const { showToast } = useToast();

  const [month, setMonth] = useState(getCurrentMonthYYYYMM());
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [elecRate, setElecRate] = useState(3500);
  const [waterRate, setWaterRate] = useState(15000);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [rows, setRows] = useState<Record<string, MeterRowState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState(false);
  const [missingTable, setMissingTable] = useState(false);

  const label = useCallback(
    (th: string, vi: string, en: string, zh: string, lo: string) =>
      pickLang(lang, { th, vi, en, zh, lo }),
    [lang]
  );

  const loadData = useCallback(
    async (targetMonth: string) => {
      setLoading(true);
      setMissingTable(false);
      try {
        const [bData, rData, mData] = await Promise.all([
          listBuildings(),
          listRooms(),
          listMembers({ statuses: ["active", "on_leave"] }),
        ]);
        setBuildings(bData);
        setRooms(rData);
        setMembers(mData);

        let readings: UtilityReading[] = [];
        try {
          readings = await listUtilityReadings(targetMonth);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("utility_readings") || msg.includes("42P01")) {
            setMissingTable(true);
          } else {
            throw err;
          }
        }

        const readingByRoom = new Map<string, UtilityReading>();
        readings.forEach((r) => readingByRoom.set(r.room_id, r));

        if (readings.length > 0) {
          setElecRate(readings[0].elec_rate);
          setWaterRate(readings[0].water_rate);
        }

        const nextRows: Record<string, MeterRowState> = {};
        rData.forEach((room) => {
          const existing = readingByRoom.get(room.id);
          nextRows[room.id] = {
            room,
            elec_prev: existing?.elec_prev ?? 0,
            elec_curr: existing?.elec_curr ?? 0,
            water_prev: existing?.water_prev ?? 0,
            water_curr: existing?.water_curr ?? 0,
            billed: existing?.billed_to_payments ?? false,
            saved: Boolean(existing),
            dirty: false,
          };
        });
        setRows(nextRows);
        setCached(`utilities_${targetMonth}`, { bData, rData, mData, readings });
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : t.common.errorGeneric,
          "error"
        );
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    const cached = getCached<{
      bData: Building[];
      rData: Room[];
      mData: Member[];
      readings: UtilityReading[];
    }>(`utilities_${month}`, 20_000);
    if (cached) {
      setBuildings(cached.bData);
      setRooms(cached.rData);
      setMembers(cached.mData);
    }
    loadData(month);
  }, [month, loadData]);

  useEffect(() => {
    return subscribeDormSync((table) => {
      if (!table || table === "utility_readings" || table === "rooms") {
        loadData(month);
      }
    });
  }, [month, loadData]);

  const roomOccupantsMap = useMemo(() => {
    const map = new Map<string, Member[]>();
    members.forEach((m) => {
      if (m.room_id) {
        const list = map.get(m.room_id) ?? [];
        list.push(m);
        map.set(m.room_id, list);
      }
    });
    return map;
  }, [members]);

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rooms.filter((r) => {
      if (buildingFilter !== "all" && r.building_id !== buildingFilter) {
        return false;
      }
      if (q) {
        const bName = (r.building?.name ?? "").toLowerCase();
        const bCode = (r.building?.code ?? "").toLowerCase();
        return (
          r.room_number.toLowerCase().includes(q) ||
          bName.includes(q) ||
          bCode.includes(q)
        );
      }
      return true;
    });
  }, [rooms, buildingFilter, search]);

  const updateRowField = (
    roomId: string,
    field: "elec_prev" | "elec_curr" | "water_prev" | "water_curr",
    value: number
  ) => {
    const safeVal = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
    setRows((prev) => {
      const cur = prev[roomId];
      if (!cur) return prev;
      return {
        ...prev,
        [roomId]: {
          ...cur,
          [field]: safeVal,
          dirty: true,
        },
      };
    });
  };

  const handleCarryOverPrevMonth = async () => {
    const prevMonth = getPreviousMonth(month);
    try {
      const prevReadings = await listUtilityReadings(prevMonth);
      if (prevReadings.length === 0) {
        showToast(
          label(
            `ไม่พบข้อมูลมิเตอร์ของเดือน ${prevMonth}`,
            `Không có dữ liệu công tơ tháng ${prevMonth}`,
            `No meter readings found for ${prevMonth}`,
            `未找到 ${prevMonth} 的水电表数据`,
            `ບໍ່ພົບຂໍ້ມູນມິເຕີຂອງເດືອນ ${prevMonth}`
          ),
          "info"
        );
        return;
      }
      const prevMap = new Map(prevReadings.map((r) => [r.room_id, r]));
      let updatedCount = 0;
      setRows((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((roomId) => {
          const p = prevMap.get(roomId);
          if (p) {
            next[roomId] = {
              ...next[roomId],
              elec_prev: p.elec_curr,
              water_prev: p.water_curr,
              dirty: true,
            };
            updatedCount++;
          }
        });
        return next;
      });
      showToast(
        label(
          `ดึงเลขมิเตอร์เดือน ${prevMonth} สำเร็จ (${updatedCount} ห้อง)`,
          `Đã lấy chỉ số tháng ${prevMonth} (${updatedCount} phòng)`,
          `Loaded ${prevMonth} readings (${updatedCount} rooms)`,
          `已载入 ${prevMonth} 读数 (${updatedCount} 间房)`,
          `ດຶງເລກມິເຕີເດືອນ ${prevMonth} ສຳເລັດ (${updatedCount} ຫ້ອງ)`
        ),
        "success"
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t.common.errorGeneric,
        "error"
      );
    }
  };

  const handleSaveAll = async () => {
    const toSave = filteredRooms
      .map((r) => rows[r.id])
      .filter(
        (row) =>
          row &&
          (row.dirty ||
            row.elec_curr > 0 ||
            row.elec_prev > 0 ||
            row.water_curr > 0 ||
            row.water_prev > 0)
      );

    if (toSave.length === 0) {
      showToast(
        label(
          "ยังไม่มีตัวเลขมิเตอร์ที่เปลี่ยนแปลง",
          "Chưa có thay đổi nào để lưu",
          "No meter changes to save",
          "没有需要保存的读数变更",
          "ຍັງບໍ່ມີຕົວເລກມິເຕີທີ່ປ່ຽນແປງ"
        ),
        "info"
      );
      return;
    }

    setSaving(true);
    try {
      await upsertUtilityReadingsBatch(
        toSave.map((row) => ({
          room_id: row.room.id,
          billing_month: month,
          elec_prev: row.elec_prev,
          elec_curr: row.elec_curr,
          elec_rate: elecRate,
          water_prev: row.water_prev,
          water_curr: row.water_curr,
          water_rate: waterRate,
          recorded_by: user?.id ?? null,
        }))
      );
      showToast(t.common.successSave, "success");
      invalidateCache(`utilities_${month}`);
      await loadData(month);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t.common.errorGeneric,
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateBills = async () => {
    // Only bill rooms that have occupants, >0 cost, and not yet billed
    const billable = filteredRooms
      .map((r) => {
        const row = rows[r.id];
        const occ = roomOccupantsMap.get(r.id) ?? [];
        if (!row || row.billed || occ.length === 0) return null;
        const elecUsage = Math.max(0, row.elec_curr - row.elec_prev);
        const waterUsage = Math.max(0, row.water_curr - row.water_prev);
        const elecAmount = elecUsage * elecRate;
        const waterAmount = waterUsage * waterRate;
        if (elecAmount <= 0 && waterAmount <= 0) return null;
        return { row, primaryMember: occ[0], elecUsage, waterUsage, elecAmount, waterAmount };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (billable.length === 0) {
      showToast(
        label(
          "ไม่มีห้องที่มียอดค้างออกบิล (ต้องมีผู้พักและมียอด > 0)",
          "Không có phòng nào cần xuất hóa đơn điện/nước",
          "No unbilled rooms with occupants and usage > 0",
          "没有需要生成水电账单的房间",
          "ບໍ່ມີຫ້ອງທີ່ຕ້ອງອອກບິນຄ່າໄຟ/ນ້ຳ"
        ),
        "info"
      );
      return;
    }

    setBilling(true);
    try {
      // Save readings first so DB is up to date
      await upsertUtilityReadingsBatch(
        billable.map(({ row }) => ({
          room_id: row.room.id,
          billing_month: month,
          elec_prev: row.elec_prev,
          elec_curr: row.elec_curr,
          elec_rate: elecRate,
          water_prev: row.water_prev,
          water_curr: row.water_curr,
          water_rate: waterRate,
          recorded_by: user?.id ?? null,
        }))
      );

      const paymentsPayload = billable.flatMap(
        ({ row, primaryMember, elecUsage, waterUsage, elecAmount, waterAmount }) => {
          const items = [];
          if (elecAmount > 0) {
            items.push({
              member_id: primaryMember.id,
              room_id: row.room.id,
              billing_month: month,
              fee_type: "electricity" as const,
              amount: elecAmount,
              paid_amount: 0,
              status: "unpaid" as const,
              notes: `${row.room.building?.code ?? ""} ${row.room.room_number}: ${row.elec_prev} → ${row.elec_curr} (${elecUsage} kWh × ${elecRate.toLocaleString()})`,
              recorded_by: user?.id ?? null,
            });
          }
          if (waterAmount > 0) {
            items.push({
              member_id: primaryMember.id,
              room_id: row.room.id,
              billing_month: month,
              fee_type: "water" as const,
              amount: waterAmount,
              paid_amount: 0,
              status: "unpaid" as const,
              notes: `${row.room.building?.code ?? ""} ${row.room.room_number}: ${row.water_prev} → ${row.water_curr} (${waterUsage} m³ × ${waterRate.toLocaleString()})`,
              recorded_by: user?.id ?? null,
            });
          }
          return items;
        }
      );

      await createPaymentsBatch(paymentsPayload);
      await markUtilitiesBilled(
        billable.map((b) => b.row.room.id),
        month
      );
      emitAlertsRefresh();
      showToast(
        label(
          `ออกบิลค่าไฟ/น้ำสำเร็จ ${billable.length} ห้อง (${paymentsPayload.length} รายการ)`,
          `Đã xuất hóa đơn điện/nước cho ${billable.length} phòng (${paymentsPayload.length} khoản)`,
          `Generated ${paymentsPayload.length} utility bills for ${billable.length} rooms`,
          `已为 ${billable.length} 间房生成 ${paymentsPayload.length} 条水电账单`,
          `ອອກບິນຄ່າໄຟ/ນ້ຳສຳເລັດ ${billable.length} ຫ້ອງ`
        ),
        "success"
      );
      await loadData(month);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : t.common.errorGeneric,
        "error"
      );
    } finally {
      setBilling(false);
    }
  };

  const totals = useMemo(() => {
    let totalElecKwh = 0;
    let totalWaterM3 = 0;
    let totalElecCost = 0;
    let totalWaterCost = 0;
    let billedRooms = 0;
    filteredRooms.forEach((r) => {
      const row = rows[r.id];
      if (!row) return;
      const eUse = Math.max(0, row.elec_curr - row.elec_prev);
      const wUse = Math.max(0, row.water_curr - row.water_prev);
      totalElecKwh += eUse;
      totalWaterM3 += wUse;
      totalElecCost += eUse * elecRate;
      totalWaterCost += wUse * waterRate;
      if (row.billed) billedRooms++;
    });
    return {
      totalElecKwh,
      totalWaterM3,
      totalElecCost,
      totalWaterCost,
      totalAll: totalElecCost + totalWaterCost,
      billedRooms,
    };
  }, [filteredRooms, rows, elecRate, waterRate]);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={label(
            "ค่าไฟ / ค่าน้ำ แยกรายห้อง",
            "Điện & Nước theo phòng",
            "Electricity & Water Meters",
            "分房间水电表管理",
            "ຄ່າໄຟ / ຄ່ານ້ຳ ແຍກຕາມຫ້ອງ"
          )}
          subtitle={label(
            "จดเลขมิเตอร์ประจำเดือน คำนวณอัตโนมัติ และออกบิลเข้าสู่ระบบค่าธรรมเนียม",
            "Ghi chỉ số điện nước hàng tháng, tính tiền tự động và xuất hóa đơn theo phòng",
            "Record monthly meter readings, auto-calculate usage, and generate room bills",
            "录入每月水电表读数，自动计费并一键生成房间账单",
            "ຈົດເລກມິເຕີປະຈຳເດືອນ ຄິດໄລ່ອັດຕະໂນມັດ ແລະ ອອກບິນເຂົ້າລະບົບ"
          )}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCarryOverPrevMonth}
                disabled={loading || missingTable}
                className="gap-1.5"
              >
                <History className="h-4 w-4 text-slate-600" />
                {label(
                  "ดึงเลขเดือนก่อน",
                  "Lấy số tháng trước",
                  "Load Prev Month",
                  "载入上月读数",
                  "ດຶງເລກເດືອນກ່ອນ"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveAll}
                disabled={saving || loading || missingTable}
                className="gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 text-primary" />
                )}
                {t.common.save}
              </Button>
              {isAdminOrAbove && (
                <Button
                  type="button"
                  onClick={handleGenerateBills}
                  disabled={billing || loading || missingTable}
                  className="gap-1.5"
                >
                  {billing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Receipt className="h-4 w-4" />
                  )}
                  {label(
                    "ออกบิลค่าไฟ/น้ำ",
                    "Xuất hóa đơn điện/nước",
                    "Generate Bills",
                    "生成水电账单",
                    "ອອກບິນຄ່າໄຟ/ນ້ຳ"
                  )}
                </Button>
              )}
            </div>
          }
        />

        {missingTable && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm text-amber-900">
                <p className="font-semibold">
                  {label(
                    "ยังไม่ได้สร้างตาราง utility_readings ใน Supabase",
                    "Bảng utility_readings chưa được tạo trong Supabase",
                    "Table utility_readings has not been created in Supabase yet",
                    "Supabase 中尚未创建 utility_readings 表",
                    "ຍັງບໍ່ໄດ້ສ້າງຕາຕະລາງ utility_readings ໃນ Supabase"
                  )}
                </p>
                <p className="text-amber-700 mt-0.5">
                  {label(
                    "กรุณารันไฟล์ supabase/migrations/20261127_utility_meters.sql ใน Supabase SQL Editor แล้วกดรีเฟรช",
                    "Vui lòng chạy file supabase/migrations/20261127_utility_meters.sql trong Supabase SQL Editor rồi tải lại trang",
                    "Please run supabase/migrations/20261127_utility_meters.sql in the Supabase SQL Editor, then refresh.",
                    "请在 Supabase SQL Editor 中运行 supabase/migrations/20261127_utility_meters.sql 后刷新。",
                    "ກະລຸນາລັນໄຟລ໌ supabase/migrations/20261127_utility_meters.sql ໃນ Supabase SQL Editor ແລ້ວໂຫຼດໜ້າໃໝ່"
                  )}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(
                  "supabase/migrations/20261127_utility_meters.sql"
                );
                showToast("Copied migration path", "info");
              }}
              className="shrink-0 gap-1.5 bg-white"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Path
            </Button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={label("ค่าไฟฟ้ารวม", "Tổng tiền điện", "Total Electricity", "电费合计", "ຄ່າໄຟຟ້າລວມ")}
            value={formatCurrency(totals.totalElecCost, lang)}
            hint={`${totals.totalElecKwh.toLocaleString()} kWh`}
            icon={<Zap className="h-5 w-5" />}
            tone="amber"
          />
          <StatCard
            label={label("ค่าน้ำประปารวม", "Tổng tiền nước", "Total Water", "水费合计", "ຄ່ານ້ຳປະປາລວມ")}
            value={formatCurrency(totals.totalWaterCost, lang)}
            hint={`${totals.totalWaterM3.toLocaleString()} m³`}
            icon={<Droplets className="h-5 w-5" />}
            tone="sky"
          />
          <StatCard
            label={label("ยอดรวมทั้งหมด", "Tổng cộng điện nước", "Combined Total", "水电总计", "ຍອດລວມທັງໝົດ")}
            value={formatCurrency(totals.totalAll, lang)}
            icon={<Receipt className="h-5 w-5" />}
            tone="navy"
          />
          <StatCard
            label={label("ออกบิลแล้ว", "Phòng đã xuất bill", "Billed Rooms", "已出账房间", "ອອກບິນແລ້ວ")}
            value={`${totals.billedRooms} / ${filteredRooms.length}`}
            icon={<CheckCircle2 className="h-5 w-5" />}
            tone="emerald"
          />
        </div>

        {/* Filters & Rates */}
        <FilterBar
          hasActiveFilters={buildingFilter !== "all" || Boolean(search.trim())}
          onReset={() => {
            setBuildingFilter("all");
            setSearch("");
          }}
          resetLabel={t.common.reset}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                {t.fees.billingMonth}
              </label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                {t.common.building}
              </label>
              <Select
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
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
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                {label("ค่าไฟ (VND/kWh)", "Đơn giá điện", "Elec Rate (VND/kWh)", "电价 (VND/度)", "ຄ່າໄຟ (VND/kWh)")}
              </label>
              <Input
                type="number"
                min={0}
                value={elecRate}
                onChange={(e) => setElecRate(Math.max(0, Number(e.target.value)))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                {label("ค่าน้ำ (VND/m³)", "Đơn giá nước", "Water Rate (VND/m³)", "水价 (VND/方)", "ຄ່ານ້ຳ (VND/m³)")}
              </label>
              <Input
                type="number"
                min={0}
                value={waterRate}
                onChange={(e) => setWaterRate(Math.max(0, Number(e.target.value)))}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                {t.common.search}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.common.room}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </FilterBar>

        {/* Table */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
          {loading ? (
            <TableSkeleton rows={6} cols={7} />
          ) : filteredRooms.length === 0 ? (
            <EmptyState
              icon={<Zap className="h-6 w-6" />}
              title={t.common.noData}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">{t.common.room}</th>
                    <th className="px-3 py-3 text-center text-amber-700">
                      <span className="inline-flex items-center gap-1">
                        <Zap className="h-3.5 w-3.5" />
                        {label("ไฟเก่า", "Điện cũ", "Elec Prev", "上月电", "ໄຟເກົ່າ")}
                      </span>
                    </th>
                    <th className="px-3 py-3 text-center text-amber-700">
                      {label("ไฟใหม่", "Điện mới", "Elec Curr", "本月电", "ໄຟໃໝ່")}
                    </th>
                    <th className="px-3 py-3 text-right text-amber-700">
                      {label("ใช้/เงิน", "Tiền điện", "Elec Cost", "电费", "ຄ່າໄຟ")}
                    </th>
                    <th className="px-3 py-3 text-center text-sky-700">
                      <span className="inline-flex items-center gap-1">
                        <Droplets className="h-3.5 w-3.5" />
                        {label("น้ำเก่า", "Nước cũ", "Water Prev", "上月水", "ນ້ຳເກົ່າ")}
                      </span>
                    </th>
                    <th className="px-3 py-3 text-center text-sky-700">
                      {label("น้ำใหม่", "Nước mới", "Water Curr", "本月水", "ນ້ຳໃໝ່")}
                    </th>
                    <th className="px-3 py-3 text-right text-sky-700">
                      {label("ใช้/เงิน", "Tiền nước", "Water Cost", "水费", "ຄ່ານ້ຳ")}
                    </th>
                    <th className="px-4 py-3 text-right">
                      {label("รวม", "Tổng", "Total", "合计", "ລວມ")}
                    </th>
                    <th className="px-4 py-3 text-center">{t.common.status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRooms.map((r) => {
                    const row = rows[r.id];
                    if (!row) return null;
                    const occCount = (roomOccupantsMap.get(r.id) ?? []).length;
                    const elecUsage = Math.max(0, row.elec_curr - row.elec_prev);
                    const waterUsage = Math.max(0, row.water_curr - row.water_prev);
                    const elecCost = elecUsage * elecRate;
                    const waterCost = waterUsage * waterRate;
                    const total = elecCost + waterCost;

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <p className="font-semibold text-slate-900">
                            {r.building?.code ?? ""} • {r.room_number}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {occCount} {t.common.member}
                          </p>
                        </td>
                        <td className="px-2 py-2.5">
                          <input
                            type="number"
                            min={0}
                            disabled={row.billed}
                            value={row.elec_prev}
                            onChange={(e) =>
                              updateRowField(r.id, "elec_prev", Number(e.target.value))
                            }
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs font-mono focus:border-primary focus:outline-none disabled:bg-slate-100"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <input
                            type="number"
                            min={0}
                            disabled={row.billed}
                            value={row.elec_curr}
                            onChange={(e) =>
                              updateRowField(r.id, "elec_curr", Number(e.target.value))
                            }
                            className="w-20 rounded-lg border border-amber-200 bg-amber-50/30 px-2 py-1 text-right text-xs font-mono font-semibold focus:border-amber-500 focus:outline-none disabled:bg-slate-100"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <p className="text-xs font-semibold text-slate-800">
                            {formatCurrency(elecCost, lang)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {elecUsage} kWh
                          </p>
                        </td>
                        <td className="px-2 py-2.5">
                          <input
                            type="number"
                            min={0}
                            disabled={row.billed}
                            value={row.water_prev}
                            onChange={(e) =>
                              updateRowField(r.id, "water_prev", Number(e.target.value))
                            }
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-right text-xs font-mono focus:border-primary focus:outline-none disabled:bg-slate-100"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <input
                            type="number"
                            min={0}
                            disabled={row.billed}
                            value={row.water_curr}
                            onChange={(e) =>
                              updateRowField(r.id, "water_curr", Number(e.target.value))
                            }
                            className="w-20 rounded-lg border border-sky-200 bg-sky-50/30 px-2 py-1 text-right text-xs font-mono font-semibold focus:border-sky-500 focus:outline-none disabled:bg-slate-100"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <p className="text-xs font-semibold text-slate-800">
                            {formatCurrency(waterCost, lang)}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {waterUsage} m³
                          </p>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap font-bold text-navy-900">
                          {formatCurrency(total, lang)}
                        </td>
                        <td className="px-4 py-2.5 text-center whitespace-nowrap">
                          {row.billed ? (
                            <Badge variant="emerald">
                              {label("ออกบิลแล้ว", "Đã xuất bill", "Billed", "已出账", "ອອກບິນແລ້ວ")}
                            </Badge>
                          ) : row.dirty ? (
                            <Badge variant="amber">
                              {label("ยังไม่บันทึก", "Chưa lưu", "Unsaved", "未保存", "ຍັງບໍ່ໄດ້ບັນທຶກ")}
                            </Badge>
                          ) : row.saved ? (
                            <Badge variant="navy">
                              {label("บันทึกแล้ว", "Đã lưu", "Saved", "已保存", "ບັນທຶກແລ້ວ")}
                            </Badge>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
