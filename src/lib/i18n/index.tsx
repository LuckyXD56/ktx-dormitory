"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Language } from "@/types/database";
import { th, type TranslationKeys } from "./th";
import { vi } from "./vi";
import { en } from "./en";
import { zh } from "./zh";
import { lo } from "./lo";
import { isValidLanguage } from "./languages";

export * from "./languages";

const DICTIONARIES: Record<Language, TranslationKeys> = {
  th,
  vi,
  en,
  zh,
  lo,
};

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
    if (isValidLanguage(saved)) {
      setLangState(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = (next: Language) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const t = DICTIONARIES[lang] ?? th;

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
