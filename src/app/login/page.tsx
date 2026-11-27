"use client";

import React, { useEffect, useState } from "react";
import { Globe, Loader2, Lock, Mail, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/components/providers/ToastProvider";

export default function LoginPage() {
  const { t, lang, setLang } = useI18n();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inactiveNotice, setInactiveNotice] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("inactive") === "1") {
        setInactiveNotice(true);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) {
      window.location.href = "/setup";
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        showToast(error.message, "error");
        return;
      }
      if (data.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("is_active")
          .eq("id", data.user.id)
          .single();
        if (prof && prof.is_active === false) {
          await supabase.auth.signOut();
          showToast(t.auth.inactiveAccount, "error");
          return;
        }
        window.location.href = "/";
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt={t.appName}
              className="h-14 w-14 shrink-0 rounded-full bg-white object-cover shadow-md ring-1 ring-slate-200"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-navy-600">
                {t.appSubtitle}
              </p>
              <h1 className="text-base font-bold text-slate-900">{t.appName}</h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLang(lang === "th" ? "vi" : "th")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-slate-50"
          >
            <Globe className="h-3.5 w-3.5 text-navy-600" />
            {lang === "th" ? "🇹🇭 ไทย" : "🇻🇳 Tiếng Việt"}
          </button>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">
            {t.auth.loginTitle}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {t.auth.loginSubtitle}
          </p>
        </div>

        {inactiveNotice && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
            <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{t.auth.inactiveAccount}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="block mb-1.5 text-slate-700">
              {t.auth.email}
            </Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@dormitory.local"
                className="pl-10 h-11"
              />
            </div>
          </div>

          <div>
            <Label className="block mb-1.5 text-slate-700">
              {t.auth.password}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10 h-11"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            size="lg"
            className="w-full shadow-lg shadow-navy-600/20"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t.auth.signIn}
          </Button>
        </form>
      </div>
    </div>
  );
}
