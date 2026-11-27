"use client";

import React, { useRef } from "react";
import { Printer } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { pickLang, useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import type { Member } from "@/types/database";

interface Props {
  open: boolean;
  onClose: () => void;
  member: Member | null;
}

export function ResidenceCertificateModal({ open, onClose, member }: Props) {
  const { lang } = useI18n();
  const printRef = useRef<HTMLDivElement>(null);

  const label = (th: string, vi: string, en: string) =>
    pickLang(lang, { th, vi, en, zh: en, lo: th });

  const handlePrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const win = window.open("", "_blank", "width=794,height=1123");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>Giấy xác nhận cư trú – ${member?.full_name ?? ""}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;900&display=swap');
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Be Vietnam Pro', sans-serif; background: #fff; color: #1a1a2e; }
          .page { width: 794px; min-height: 1123px; padding: 60px 72px; position: relative; }
          @media print {
            @page { size: A4; margin: 0; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>${html}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 500);
  };

  if (!member) return null;

  const today = new Date();
  const todayStr = formatDate(today.toISOString(), lang);
  const checkIn = formatDate(member.check_in_date, lang);
  const room = member.room;
  const building = room?.building;
  const issueNo = `KTX-${today.getFullYear()}-${String(member.student_code ?? "").slice(-4).padStart(4, "0")}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={label("ใบรับรองการพักอาศัย", "Giấy xác nhận cư trú", "Residence Certificate")}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Preview */}
        <div ref={printRef}>
          <div
            className="page bg-white text-[#1a1a2e]"
            style={{ fontFamily: "'Be Vietnam Pro', sans-serif", padding: "48px 64px", position: "relative", minHeight: "600px" }}
          >
            {/* Header accent bar */}
            <div style={{ height: 6, background: "linear-gradient(90deg,#c9a227,#f0c040,#0d4b97)", borderRadius: 3, marginBottom: 32 }} />

            {/* Institution header */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#666", textTransform: "uppercase" }}>
                TRƯỜNG ĐẠI HỌC SƯ PHẠM – ĐẠI HỌC ĐÀ NẴNG
              </p>
              <p style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                University of Science and Education – The University of Danang
              </p>
              <p style={{ fontSize: 10, color: "#888" }}>Ký Túc Xá Lưu Học Sinh Lào · KTX Student Dormitory</p>
            </div>

            {/* Title */}
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase", color: "#0a3673" }}>
                GIẤY XÁC NHẬN CƯ TRÚ
              </h1>
              <p style={{ fontSize: 12, color: "#555", marginTop: 4 }}>
                {label("ใบรับรองการพักอาศัย", "Certificate of Dormitory Residence", "Certificate of Dormitory Residence")}
              </p>
              <p style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>Số / No.: {issueNo}</p>
            </div>

            {/* Body */}
            <p style={{ fontSize: 13, lineHeight: 2, color: "#333", marginBottom: 16 }}>
              <strong>Ban Quản lý Ký Túc Xá</strong> trường Đại học Sư phạm – Đại học Đà Nẵng xác nhận sinh viên dưới đây
              hiện đang cư trú tại Ký Túc Xá của trường:
            </p>

            {/* Info table */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 24 }}>
              {[
                [label("ชื่อ-นามสกุล", "Họ và tên", "Full Name"), member.full_name],
                [label("เพศ", "Giới tính", "Gender"), member.gender === "female" ? "Nữ / Female" : member.gender === "male" ? "Nam / Male" : "Khác"],
                [label("สัญชาติ", "Quốc tịch", "Nationality"), member.country || "Lào"],
                [label("จังหวัด", "Tỉnh / Thành phố", "Province"), member.province || "—"],
                [label("เลขที่หนังสือเดินทาง", "Số hộ chiếu", "Passport No."), member.student_code || "—"],
                [label("อาคาร", "Tòa nhà", "Building"), building?.name ?? "—"],
                [label("ห้อง", "Phòng", "Room"), room?.room_number ?? "—"],
                [label("วันที่เข้าพัก", "Ngày vào ở", "Check-in Date"), checkIn],
              ].map(([k, v]) => (
                <tr key={k} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td style={{ padding: "8px 12px", fontWeight: 600, color: "#555", width: "40%", background: "#fafafa" }}>{k}</td>
                  <td style={{ padding: "8px 12px", color: "#1a1a2e", fontWeight: 700 }}>{v}</td>
                </tr>
              ))}
            </table>

            <p style={{ fontSize: 12, color: "#555", lineHeight: 1.8, marginBottom: 32 }}>
              Giấy xác nhận này được cấp để sinh viên sử dụng cho các mục đích hành chính và học vụ theo yêu cầu.
              <br />
              {label(
                "ใบรับรองนี้ออกให้เพื่อใช้ประกอบการดำเนินการทางราชการและการศึกษาตามที่ร้องขอ",
                "Certificate issued for administrative and academic purposes as requested.",
                "Certificate issued for administrative and academic purposes as requested."
              )}
            </p>

            {/* Footer signatures */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
              <div style={{ textAlign: "center", width: "45%" }}>
                <p style={{ fontSize: 11, color: "#888" }}>Ngày cấp / Date issued</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#0a3673", marginTop: 4 }}>{todayStr}</p>
              </div>
              <div style={{ textAlign: "center", width: "45%" }}>
                <div style={{ height: 60 }} />
                <div style={{ borderTop: "1px solid #333", paddingTop: 6 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#0a3673" }}>TRƯỞNG BAN QUẢN LÝ KTX</p>
                  <p style={{ fontSize: 10, color: "#888" }}>Head of Dormitory Management</p>
                </div>
              </div>
            </div>

            {/* Footer note */}
            <div style={{ marginTop: 40, borderTop: "1px solid #e5e5e5", paddingTop: 12 }}>
              <p style={{ fontSize: 9, color: "#bbb", textAlign: "center" }}>
                Tài liệu được tạo tự động từ hệ thống KTX Management · {new Date().toLocaleString("vi-VN")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            {label("ปิด", "Đóng", "Close")}
          </Button>
          <Button onClick={handlePrint} className="gap-1.5">
            <Printer className="h-4 w-4" />
            {label("พิมพ์ / บันทึก PDF", "In / Lưu PDF", "Print / Save PDF")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
