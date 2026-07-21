import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { en } from "./locales/en";
import { fr } from "./locales/fr";
import { es } from "./locales/es";
import { de } from "./locales/de";
import { pt } from "./locales/pt";

/**
 * UI language. Distinct from the *transcription* language in
 * `whisperLanguages.ts` — the interface can be English while you dictate
 * in Japanese, and that pairing is common.
 *
 * `en` is the source of truth: `Dictionary` is derived from it, so every
 * other locale must supply exactly the same keys with the same shapes or
 * the build fails. There is no runtime "missing key" fallback because
 * there cannot be a missing key.
 */
export type Dictionary = typeof en;

export const UI_LOCALES = [
  { code: "en", native: "English" },
  { code: "fr", native: "Français" },
  { code: "es", native: "Español" },
  { code: "de", native: "Deutsch" },
  { code: "pt", native: "Português" },
] as const;

export type UiLocale = (typeof UI_LOCALES)[number]["code"];

const DICTIONARIES: Record<UiLocale, Dictionary> = { en, fr, es, de, pt };

const STORAGE_KEY = "hyperwisper-locale";

function isUiLocale(v: string): v is UiLocale {
  return UI_LOCALES.some((l) => l.code === v);
}

/**
 * Explicit choice wins; otherwise take the browser/OS language. Tauri's
 * webview reports the Windows display language, so a French Windows opens
 * in French without the user configuring anything.
 */
export function detectLocale(): UiLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isUiLocale(stored)) return stored;
  } catch {
    // localStorage can throw in restricted webview contexts — fall through
  }

  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language ?? "",
  ];
  for (const tag of candidates) {
    const base = tag.split("-")[0]?.toLowerCase() ?? "";
    if (isUiLocale(base)) return base;
  }
  return "en";
}

export function storeLocale(locale: UiLocale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Non-fatal: the choice just won't survive a restart.
  }
}

/**
 * Dictionary lookup for code that runs outside React and so cannot use a hook
 * — `lib/toasts.ts`, wired up once at startup from module scope. Resolve it at
 * *call* time, never at module load, or a language change won't take effect.
 */
export function getDictionary(): Dictionary {
  return DICTIONARIES[detectLocale()];
}

interface I18nValue {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: Dictionary;
  /** BCP-47 tag for Intl formatting (dates, numbers, relative time). */
  intlLocale: string;
}

const I18nContext = createContext<I18nValue | null>(null);

const INTL_TAGS: Record<UiLocale, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
  pt: "pt-BR",
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(() => detectLocale());

  const setLocale = useCallback((next: UiLocale) => {
    setLocaleState(next);
    storeLocale(next);
  }, []);

  // Keep <html lang> in sync so the webview hyphenates and spell-checks
  // against the right language.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale,
      t: DICTIONARIES[locale],
      intlLocale: INTL_TAGS[locale],
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  return ctx;
}

/** Shorthand for the common case: `const t = useT();` then `t.settings.audio.title`. */
export function useT(): Dictionary {
  return useI18n().t;
}
