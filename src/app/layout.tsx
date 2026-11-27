import type { Metadata } from "next";
import { Anuphan } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";

const anuphan = Anuphan({
  subsets: ["thai", "vietnamese", "latin"],
  variable: "--font-anuphan",
});

export const metadata: Metadata = {
  title: "Dormitory Management System | ระบบจัดการหอพัก",
  description:
    "Modern bilingual Thai & Vietnamese Dormitory Management System backed by Supabase",
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
    <html lang="th" className={anuphan.variable}>
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
