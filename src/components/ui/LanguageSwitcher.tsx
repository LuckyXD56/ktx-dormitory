"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useI18n, LANGUAGE_MAP, LANGUAGE_OPTIONS } from "@/lib/i18n";
import type { Language } from "@/types/database";

interface LanguageSwitcherProps {
  variant?: "dropdown" | "pills";
  onSelect?: (lang: Language) => void;
  disabled?: boolean;
  compactOnMobile?: boolean;
  className?: string;
}

export function LanguageSwitcher({
  variant = "dropdown",
  onSelect,
  disabled = false,
  compactOnMobile = false,
  className = "",
}: LanguageSwitcherProps) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleChoose = (next: Language) => {
    setOpen(false);
    if (onSelect) {
      onSelect(next);
    } else {
      setLang(next);
    }
  };

  if (variant === "pills") {
    return (
      <div
        role="group"
        aria-label="Language selector"
        className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}
      >
        {LANGUAGE_OPTIONS.map((opt) => {
          const active = opt.code === lang;
          return (
            <button
              key={opt.code}
              type="button"
              disabled={disabled}
              onClick={() => handleChoose(opt.code)}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 ${
                active
                  ? "border-navy-700 bg-navy-700 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-navy-200 hover:bg-slate-50"
              }`}
            >
              <span>{opt.flag}</span>
              <span>{opt.nativeName}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const current = LANGUAGE_MAP[lang] ?? LANGUAGE_MAP.th;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Switch Language (TH / VI / EN / ZH / LO)"
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-navy-900 hover:bg-navy-50 hover:border-navy-200 transition-colors disabled:opacity-50"
      >
        <Globe className="h-3.5 w-3.5 text-navy-600 shrink-0" />
        <span>{current.flag}</span>
        <span className={compactOnMobile ? "hidden sm:inline" : ""}>
          {current.nativeName}
        </span>
        {compactOnMobile && (
          <span className="sm:hidden">{current.shortLabel}</span>
        )}
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Languages"
          className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
        >
          {LANGUAGE_OPTIONS.map((opt) => {
            const active = opt.code === lang;
            return (
              <button
                key={opt.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => handleChoose(opt.code)}
                className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium transition-colors ${
                  active
                    ? "bg-navy-50 text-navy-900 font-semibold"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm leading-none">{opt.flag}</span>
                  <span>{opt.nativeName}</span>
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                  <span>{opt.shortLabel}</span>
                  {active && <Check className="h-3.5 w-3.5 text-navy-600" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
