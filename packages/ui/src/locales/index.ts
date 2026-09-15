import { zh } from "./zh";
import { en } from "./en";

export interface LocaleOption {
  code: string;
  name: string;
  label: string;
  direction?: "ltr" | "rtl";
}

/**
 * Registry of all supported languages in the system.
 *
 * To add a new language (e.g. Japanese `ja`, Spanish `es`, German `de`):
 * 1. Create a `locales/<code变为对应名称>.ts` dictionary file mapping keys.
 * 2. Add an entry here in SUPPORTED_LOCALES.
 * 3. Register it in the `LOCALES` object below.
 *
 * No UI components need to be modified when adding new languages!
 */
export const SUPPORTED_LOCALES: LocaleOption[] = [
  { code: "zh", name: "简体中文", label: "中文" },
  { code: "en", name: "English", label: "EN" },
];

/**
 * Primary default locale. Untranslated keys in any language will automatically
 * fall back to this primary dictionary.
 */
export const DEFAULT_LOCALE = "zh";

export const LOCALES: Record<string, Record<string, string>> = {
  zh,
  en,
};

/**
 * Resolve a translation string with fallback to default locale and variable interpolation.
 *
 * Examples:
 * - `translate("zh", "common.save")` -> "保存"
 * - `translate("en", "common.save")` -> "Save"
 * - `translate("en", "briefing.needsYou", { count: 3 })` -> "3 need you"
 * - `translate("ja", "common.save")` -> "保存" (falls back to DEFAULT_LOCALE "zh" if untranslated)
 */
export function translate(
  locale: string,
  key: string,
  params?: Record<string, string | number>,
  fallback?: string
): string {
  const currentDict = LOCALES[locale] || LOCALES[DEFAULT_LOCALE];
  const primaryDict = LOCALES[DEFAULT_LOCALE];

  let text = currentDict?.[key] ?? primaryDict?.[key] ?? fallback ?? key;

  if (params && typeof text === "string") {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }

  return text;
}
