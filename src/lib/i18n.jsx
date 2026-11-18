import React, { createContext, useContext, useState, useEffect } from "react";
import { en } from "./i18n/en";
import { hi } from "./i18n/hi";
import { gu } from "./i18n/gu";

export const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "hi", label: "हिन्दी", short: "HI" },
  { code: "gu", label: "ગુજરાતી", short: "GU" },
];

const dict = { en, hi, gu };

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("app_lang") || "en"; } catch { return "en"; }
  });
  useEffect(() => {
    try { localStorage.setItem("app_lang", lang); } catch {}
  }, [lang]);
  const t = (key) => (dict[lang] && dict[lang][key]) || dict.en[key] || key;
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(LanguageContext);
  if (!ctx) return { lang: "en", setLang: () => {}, t: (k) => dict.en[k] || k };
  return ctx;
}