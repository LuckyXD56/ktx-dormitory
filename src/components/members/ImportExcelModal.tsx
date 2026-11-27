"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pickLang, useI18n } from "@/lib/i18n";
import { createMember } from "@/services";
import { getTodayYYYYMMDD } from "@/lib/utils";
import type { MemberGender, MemberStatus, Room, Building } from "@/types/database";

interface ImportRow {
  idx: number;
  full_name: string;
  gender: MemberGender;
  country: string;
  province: string;
  student_code: string;
  phone: string;
  check_in_date: string;
  expected_checkout: string;
  building_name: string;
  room_number: string;
  status: MemberStatus;
  notes: string;
  // resolved
  room_id: string | null;
  error: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  rooms: (Room & { building?: Building | null })[];
  onImported: (count: number) => void;
}

/** Normalize Excel serial date or string date → "YYYY-MM-DD" */
function normalizeDate(raw: unknown): string {
  if (!raw) return getTodayYYYYMMDD();
  if (typeof raw === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }
  const s = String(raw).trim();
  // dd/mm/yyyy
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  // yyyy-mm-dd already
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return getTodayYYYYMMDD();
}

function normalizeGender(raw: unknown): MemberGender {
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "nữ" || s === "female" || s === "f" || s === "หญิง" || s === "ຍິງ" || s === "女") return "female";
  if (s === "nam" || s === "male" || s === "m" || s === "ชาย" || s === "ຊາຍ" || s === "男") return "male";
  return "other";
}

/** Map row data from XLSX sheet row (column-name agnostic) */
function parseRow(
  raw: Record<string, unknown>,
  idx: number,
  rooms: (Room & { building?: Building | null })[]
): ImportRow {
  // Try multiple column name variants
  const get = (...keys: string[]): string =>
    String(keys.map((k) => raw[k] ?? "").find((v) => v !== "") ?? "").trim();

  const full_name =
    get("Họ và tên", "full_name", "ຊື່ ແລະ ນາມສະກຸນ", "Name", "Tên") ||
    get(...Object.keys(raw).filter((k) => /tên|name|ຊື່/i.test(k)));
  const gender_raw = get("Giới tính", "gender", "ເພດ", "Sex");
  const gender = normalizeGender(gender_raw || get(...Object.keys(raw).filter((k) => /gi.i|gender|ເພດ/i.test(k))));
  const country = get("Quốc tịch", "country", "ສັນຊາດ", "Nationality") || "Lào";
  const province = get("Tỉnh", "province", "ແຂວງ", "Province", "Tỉnh / แขวง");
  const student_code = get("Số hộ chiếu", "student_code", "ໜັງສືຜ່ານແດນ", "Passport", "Mã SV");
  const phone = get("phone", "Phone", "โทร", "SĐT") || "";
  const check_in_date = normalizeDate(
    raw["Ngày đến"] ?? raw["check_in_date"] ?? raw["ວັນທີມາ"] ?? raw["Ngày vào"]
  );
  const expected_checkout = normalizeDate(
    raw["Ngày đi"] ?? raw["Ngày đi dự kiến"] ?? raw["ວັນທີກັບ"] ?? ""
  );
  const notes_raw = get("Ghi chú", "notes", "ໝາຍເຫດ", "Tình trạng", "ສະຖານະ");
  const notes = notes_raw;

  // Resolve building + room
  const building_name = get("Nhà", "Tòa nhà", "ຕຶກ", "Building", "Nhà (ตึก)");
  const room_number_raw = get("Phòng", "ຫ້ອງ", "Room", "Phòng (ห้อง)");
  // Strip parenthetical e.g. "Phòng 109 (ຫ້ອງ 109)" → "109"
  const room_number = room_number_raw.replace(/\(.*?\)/g, "").replace(/[^\d]/g, "").trim();
  const building_digit = building_name.replace(/\(.*?\)/g, "").replace(/[^\d]/g, "").trim();

  let room_id: string | null = null;
  let error: string | null = null;

  if (room_number) {
    const matched = rooms.find((r) => {
      const rNum = r.room_number.replace(/[^\d]/g, "");
      if (rNum !== room_number) return false;
      if (!building_digit) return true;
      const bCode = (r.building?.code ?? r.building?.name ?? "").replace(/[^\d]/g, "");
      return bCode === building_digit || bCode.endsWith(building_digit);
    });
    if (matched) {
      room_id = matched.id;
    } else if (room_number) {
      error = `ไม่พบห้อง ${building_name} ห้อง ${room_number} ในระบบ`;
    }
  }

  if (!full_name) error = "ไม่พบชื่อในแถวนี้";

  return {
    idx,
    full_name,
    gender,
    country,
    province,
    student_code,
    phone,
    check_in_date,
    expected_checkout,
    building_name,
    room_number,
    status: "active",
    notes,
    room_id,
    error,
  };
}

export function ImportExcelModal({ open, onClose, rooms, onImported }: Props) {
  const { lang } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [phase, setPhase] = useState<"idle" | "preview" | "importing" | "done">("idle");
  const [importedCount, setImportedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const label = (th: string, vi: string, en: string) =>
    pickLang(lang, { th, vi, en, zh: en, lo: th });

  const processFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(ev.target?.result, { type: "binary", cellDates: false });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
            defval: "",
            raw: true,
          });
          const parsed = json
            .map((r, i) => parseRow(r, i + 1, rooms))
            .filter((r) => r.full_name); // skip blank rows
          setRows(parsed);
          setPhase("preview");
        } catch {
          setErrors(["ไม่สามารถอ่านไฟล์ได้ กรุณาใช้ไฟล์ .xlsx หรือ .csv"]);
        }
      };
      reader.readAsBinaryString(file);
    },
    [rooms]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    const validRows = rows.filter((r) => !r.error);
    setPhase("importing");
    const errs: string[] = [];
    let count = 0;
    for (const row of validRows) {
      try {
        await createMember({
          student_code: row.student_code || `IMP-${Date.now()}-${row.idx}`,
          full_name: row.full_name,
          gender: row.gender,
          country: row.country || "Lào",
          province: row.province || "",
          phone: row.phone || "",
          room_id: row.room_id,
          check_in_date: row.check_in_date,
          status: row.status,
          notes: row.notes || "",
        });
        count++;
      } catch (e: unknown) {
        errs.push(`${row.full_name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setImportedCount(count);
    setErrors(errs);
    setPhase("done");
    onImported(count);
  };

  const reset = () => {
    setRows([]);
    setFileName("");
    setPhase("idle");
    setImportedCount(0);
    setErrors([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.filter((r) => !!r.error).length;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={label("นำเข้าข้อมูลจาก Excel", "Nhập từ Excel", "Import from Excel")}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Phase: idle — drop zone */}
        {phase === "idle" && (
          <>
            <p className="text-sm text-slate-500">
              {label(
                "รองรับไฟล์ .xlsx และ .csv ที่มีคอลัมน์ชื่อ, เพศ, สัญชาติ, จังหวัด, เลขหนังสือเดินทาง, อาคาร, ห้อง, วันเข้า",
                "Hỗ trợ .xlsx và .csv với các cột: họ tên, giới tính, quốc tịch, tỉnh, hộ chiếu, tòa nhà, phòng, ngày đến",
                "Supports .xlsx and .csv with columns: name, gender, nationality, province, passport, building, room, check-in date"
              )}
            </p>

            {/* Download template */}
            <button
              onClick={() => {
                const ws = XLSX.utils.aoa_to_sheet([
                  ["Họ và tên", "Giới tính", "Quốc tịch", "Tỉnh / แขวง", "Số hộ chiếu", "Nhà", "Phòng", "Ngày đến", "Ngày đi", "Ghi chú"],
                  ["NGUYEN VAN A", "Nam", "Lào", "Vientiane", "PA0000001", "1", "101", "2026-10-20", "2027-10-20", ""],
                ]);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Template");
                XLSX.writeFile(wb, "ktx_import_template.xlsx");
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0d4b97] hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              {label("ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx)", "Tải file mẫu (.xlsx)", "Download template (.xlsx)")}
            </button>

            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-colors p-10 ${
                dragOver
                  ? "border-[#0d4b97] bg-blue-50"
                  : "border-slate-200 hover:border-[#0d4b97]/50 hover:bg-slate-50"
              }`}
            >
              <FileSpreadsheet className="h-10 w-10 text-emerald-500" />
              <div className="text-center">
                <p className="font-semibold text-slate-700 text-sm">
                  {label("ลากไฟล์มาวาง หรือคลิกเพื่อเลือก", "Kéo thả file hoặc nhấp để chọn", "Drag & drop or click to select")}
                </p>
                <p className="text-xs text-slate-400 mt-1">.xlsx, .xls, .csv</p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
          </>
        )}

        {/* Phase: preview */}
        {phase === "preview" && (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                {fileName}
              </div>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                {validCount} {label("แถวพร้อม import", "hàng sẵn sàng", "rows ready")}
              </Badge>
              {errorCount > 0 && (
                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                  {errorCount} {label("แถวมีปัญหา", "hàng lỗi", "rows with errors")}
                </Badge>
              )}
              <button onClick={reset} className="ml-auto text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                <X className="h-3.5 w-3.5" />
                {label("เลือกไฟล์ใหม่", "Chọn file khác", "Change file")}
              </button>
            </div>

            <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-semibold text-slate-600 w-6">#</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">{label("ชื่อ-นามสกุล", "Họ và tên", "Name")}</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">{label("เพศ", "Giới tính", "Gender")}</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">{label("อาคาร/ห้อง", "Tòa/Phòng", "Bldg/Room")}</th>
                    <th className="px-3 py-2 font-semibold text-slate-600">{label("สถานะ", "Trạng thái", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.idx} className={r.error ? "bg-rose-50" : "even:bg-slate-50/50"}>
                      <td className="px-3 py-1.5 text-slate-400">{r.idx}</td>
                      <td className="px-3 py-1.5 font-medium text-slate-800">{r.full_name || <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-1.5 text-slate-500">{r.gender}</td>
                      <td className="px-3 py-1.5 text-slate-500">
                        {r.building_name && r.room_number
                          ? `${r.building_name} / ${r.room_number}`
                          : "—"}
                        {r.room_id && <span className="ml-1 text-emerald-600">✓</span>}
                      </td>
                      <td className="px-3 py-1.5">
                        {r.error ? (
                          <span className="text-rose-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            {r.error}
                          </span>
                        ) : (
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {label("พร้อม", "Sẵn sàng", "Ready")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={handleClose}>{label("ยกเลิก", "Hủy", "Cancel")}</Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Upload className="h-4 w-4 mr-1.5" />
                {label(`นำเข้า ${validCount} รายการ`, `Nhập ${validCount} hàng`, `Import ${validCount} rows`)}
              </Button>
            </div>
          </>
        )}

        {/* Phase: importing */}
        {phase === "importing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 animate-spin text-[#0d4b97]" />
            <p className="text-sm font-medium text-slate-600">
              {label("กำลังนำเข้าข้อมูล...", "Đang nhập dữ liệu...", "Importing data...")}
            </p>
          </div>
        )}

        {/* Phase: done */}
        {phase === "done" && (
          <div className="space-y-4">
            <div className={`flex items-center gap-3 rounded-xl p-4 ${errors.length === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
              <CheckCircle2 className={`h-7 w-7 ${errors.length === 0 ? "text-emerald-600" : "text-amber-600"}`} />
              <div>
                <p className="font-semibold text-slate-800">
                  {label(
                    `นำเข้าสำเร็จ ${importedCount} รายการ`,
                    `Đã nhập thành công ${importedCount} hàng`,
                    `Successfully imported ${importedCount} records`
                  )}
                </p>
                {errors.length > 0 && (
                  <p className="text-xs text-amber-700 mt-0.5">
                    {label(`${errors.length} รายการล้มเหลว`, `${errors.length} hàng lỗi`, `${errors.length} failed`)}
                  </p>
                )}
              </div>
            </div>
            {errors.length > 0 && (
              <div className="max-h-36 overflow-auto rounded-lg bg-rose-50 border border-rose-200 p-3 space-y-1">
                {errors.map((e, i) => (
                  <p key={i} className="text-xs text-rose-700">{e}</p>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { reset(); }}>
                {label("นำเข้าอีกครั้ง", "Nhập thêm", "Import more")}
              </Button>
              <Button onClick={handleClose}>
                {label("เสร็จสิ้น", "Xong", "Done")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
