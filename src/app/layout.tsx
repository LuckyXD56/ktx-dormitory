import type { Metadata } from "next";
import { Anuphan, Noto_Sans_Lao, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";

const anuphan = Anuphan({
  subsets: ["thai", "vietnamese", "latin"],
  variable: "--font-anuphan",
});

const notoLao = Noto_Sans_Lao({
  subsets: ["lao"],
  variable: "--font-noto-lao",
  preload: false,
});

const notoSc = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-noto-sc",
  preload: false,
});

export const metadata: Metadata = {
  title: "Dormitory Management System | ระบบจัดการหอพัก",
  description:
    "Multilingual Dormitory Management System (TH, VI, EN, ZH, LO) backed by Supabase",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${anuphan.variable} ${notoLao.variable} ${notoSc.variable}`}
    >
      <body className="font-sans min-h-screen bg-slate-50 text-slate-900">
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
