"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Language } from "@/types/database";
import { th, type TranslationKeys } from "./th";
import { vi } from "./vi";

interface I18nContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: TranslationKeys;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "th",
  setLang: () => {},
  t: th,
});

const STORAGE_KEY = "dorm_app_lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("th");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "th" || saved === "vi") {
      setLangState(saved);
    }
  }, []);

  const setLang = (next: Language) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const t = lang === "vi" ? vi : th;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
