import type { Language } from "@/types/database";

export interface LanguageOption {
  code: Language;
  shortLabel: string;
  nativeName: string;
  flag: string;
  intlLocale: string;
}

export const SUPPORTED_LANGUAGES: readonly Language[] = [
  "th",
  "vi",
  "en",
  "zh",
  "lo",
] as const;

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  {
    code: "th",
    shortLabel: "TH",
    nativeName: "ภาษาไทย",
    flag: "🇹🇭",
    intlLocale: "th-TH",
  },
  {
    code: "vi",
    shortLabel: "VI",
    nativeName: "Tiếng Việt",
    flag: "🇻🇳",
    intlLocale: "vi-VN",
  },
  {
    code: "en",
    shortLabel: "EN",
    nativeName: "English",
    flag: "🇬🇧",
    intlLocale: "en-US",
  },
  {
    code: "zh",
    shortLabel: "ZH",
    nativeName: "中文",
    flag: "🇨🇳",
    intlLocale: "zh-CN",
  },
  {
    code: "lo",
    shortLabel: "LO",
    nativeName: "ພາສາລາວ",
    flag: "🇱🇦",
    intlLocale: "lo-LA",
  },
] as const;

export const LANGUAGE_MAP: Record<Language, LanguageOption> = {
  th: LANGUAGE_OPTIONS[0],
  vi: LANGUAGE_OPTIONS[1],
  en: LANGUAGE_OPTIONS[2],
  zh: LANGUAGE_OPTIONS[3],
  lo: LANGUAGE_OPTIONS[4],
};

export function isValidLanguage(value: unknown): value is Language {
  return (
    value === "th" ||
    value === "vi" ||
    value === "en" ||
    value === "zh" ||
    value === "lo"
  );
}

export function normalizeLanguage(value: unknown): Language {
  return isValidLanguage(value) ? value : "th";
}

export function pickLang<T>(lang: Language, map: Record<Language, T>): T {
  return map[lang] ?? map.th;
}
