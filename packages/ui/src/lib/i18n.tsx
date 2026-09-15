"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_LOCALE,
  LocaleOption,
  SUPPORTED_LOCALES,
  translate,
} from "@/locales";

export type Locale = string;

export interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  supportedLocales: LocaleOption[];
  t: (
    key: string,
    paramsOrFallback?: Record<string, string | number> | string,
    fallback?: string
  ) => string;
}

const STORAGE_KEY = "openexec_locale";

const I18nContext = createContext<I18nContextType>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  supportedLocales: SUPPORTED_LOCALES,
  t: (key: string, paramsOrFallback?: Record<string, string | number> | string, fallback?: string) => {
    if (typeof paramsOrFallback === "string") {
      return fallback ?? paramsOrFallback ?? key;
    }
    return fallback ?? key;
  },
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const isSupported = SUPPORTED_LOCALES.some((l) => l.code === saved);
      if (saved && isSupported) {
        setLocaleState(saved);
      } else {
        const navLang = (navigator.language || "").toLowerCase();
        // Check exact match or prefix
        const matched = SUPPORTED_LOCALES.find(
          (l) => navLang === l.code.toLowerCase() || navLang.startsWith(l.code.toLowerCase() + "-")
        );
        setLocaleState(matched ? matched.code : DEFAULT_LOCALE);
      }
    } catch {
      // Ignore SSR / localStorage exceptions
    }
    setMounted(true);
  }, []);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try {
      localStorage.setItem(STORAGE_KEY, nextLocale);
      document.documentElement.lang = nextLocale;
    } catch {
      // ignore
    }
  };

  const t = (
    key: string,
    paramsOrFallback?: Record<string, string | number> | string,
    fallback?: string
  ): string => {
    let params: Record<string, string | number> | undefined;
    let defaultFallback = fallback;

    if (typeof paramsOrFallback === "string") {
      defaultFallback = paramsOrFallback;
    } else if (paramsOrFallback && typeof paramsOrFallback === "object") {
      params = paramsOrFallback;
    }

    return translate(locale, key, params, defaultFallback);
  };

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        supportedLocales: SUPPORTED_LOCALES,
        t,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

/**
 * Dynamic Language Switcher that renders all registered languages from SUPPORTED_LOCALES.
 * Adding a language to `locales/index.ts` immediately appears here.
 */
export function LanguageSelect({ className = "" }: { className?: string }) {
  const { locale, setLocale, supportedLocales } = useI18n();

  return (
    <div
      className={`inline-flex items-center rounded-md border border-line bg-surface-overlay/80 p-0.5 text-xs ${className}`}
      role="group"
      aria-label="Language selector"
    >
      {supportedLocales.map((item) => (
        <button
          key={item.code}
          type="button"
          onClick={() => setLocale(item.code)}
          className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
            locale === item.code
              ? "bg-surface text-fg shadow-xs font-semibold"
              : "text-fg-muted hover:text-fg"
          }`}
          title={item.name}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// Backward-compatible alias
export const LanguageToggle = LanguageSelect;
