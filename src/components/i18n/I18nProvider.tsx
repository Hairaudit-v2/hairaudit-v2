"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isSupportedLocale,
  normalizeLocale,
  type SupportedLocale,
} from "@/lib/i18n/constants";
import { getTranslation, type TranslateFn } from "@/lib/i18n/getTranslation";

type I18nContextValue = {
  locale: SupportedLocale;
  /** Apply locale for UI and persist (localStorage; PATCH profile when signed in). */
  setLocale: (locale: SupportedLocale) => void;
  t: TranslateFn;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function safeStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / quota */
  }
}

function safeStorageRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function persistLocaleRemote(locale: SupportedLocale) {
  void fetch("/api/profiles", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferred_language: locale }),
  }).catch(() => {
    /* guest or offline — ignore */
  });
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    const rawStored = window.localStorage.getItem(LOCALE_STORAGE_KEY)?.trim() ?? "";

    if (rawStored !== "") {
      if (!isSupportedLocale(rawStored)) {
        safeStorageRemove(LOCALE_STORAGE_KEY);
        /* fall through to profile fetch */
      } else {
        setLocaleState(rawStored);
        return;
      }
    }

    fetch("/api/profiles")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { preferred_language?: string } | null) => {
        const pref = normalizeLocale(data?.preferred_language);
        if (pref !== DEFAULT_LOCALE) {
          safeStorageSet(LOCALE_STORAGE_KEY, pref);
        }
        setLocaleState(pref);
      })
      .catch(() => {
        /* ignore */
      });
  }, []);

  const setLocale = useCallback((next: SupportedLocale) => {
    setLocaleState(next);
    safeStorageSet(LOCALE_STORAGE_KEY, next);
    persistLocaleRemote(next);
  }, []);

  const t = useCallback((key: string) => getTranslation(key, locale), [locale]) as TranslateFn;

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
