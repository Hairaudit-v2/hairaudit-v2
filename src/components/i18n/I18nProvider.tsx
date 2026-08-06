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
import { clearSeoLocaleCookie, syncSeoLocaleCookie } from "@/lib/i18n/syncSeoLocaleCookie";
import { getTranslation, type TranslateFn } from "@/lib/i18n/getTranslation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

/**
 * Persist locale to the server only when a session user exists.
 * Never signs out or navigates on 401 — guests are a no-op.
 */
function persistLocaleRemote(locale: SupportedLocale) {
  void (async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;
      await fetch("/api/profiles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferred_language: locale }),
      });
    } catch {
      /* guest, missing public env, or offline — ignore */
    }
  })();
}

function applyLocale(locale: SupportedLocale, setLocaleState: (l: SupportedLocale) => void) {
  setLocaleState(locale);
  if (locale !== DEFAULT_LOCALE) {
    safeStorageSet(LOCALE_STORAGE_KEY, locale);
  }
  syncSeoLocaleCookie(locale);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    const rawStored = window.localStorage.getItem(LOCALE_STORAGE_KEY)?.trim() ?? "";

    if (rawStored !== "") {
      if (!isSupportedLocale(rawStored)) {
        safeStorageRemove(LOCALE_STORAGE_KEY);
        clearSeoLocaleCookie();
        /* fall through to auth-gated profile fetch */
      } else {
        setLocaleState(rawStored);
        syncSeoLocaleCookie(rawStored);
        return;
      }
    }

    let cancelled = false;

    // HA-AUTH-PROFILE-401-FIX: resolve auth first; skip /api/profiles for anonymous visitors
    // so public routes do not emit auth-fault noise or race OAuth session cookies.
    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;

        if (!session?.user) {
          applyLocale(DEFAULT_LOCALE, setLocaleState);
          return;
        }

        const res = await fetch("/api/profiles");
        if (cancelled) return;
        if (!res.ok) {
          applyLocale(DEFAULT_LOCALE, setLocaleState);
          return;
        }
        const data = (await res.json().catch(() => null)) as {
          authenticated?: boolean;
          preferred_language?: string;
          profile?: { preferred_language?: string } | null;
        } | null;

        if (!data || data.authenticated === false) {
          applyLocale(DEFAULT_LOCALE, setLocaleState);
          return;
        }

        const pref = normalizeLocale(data.preferred_language ?? data.profile?.preferred_language);
        applyLocale(pref, setLocaleState);
      } catch {
        if (!cancelled) applyLocale(DEFAULT_LOCALE, setLocaleState);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setLocale = useCallback((next: SupportedLocale) => {
    setLocaleState(next);
    safeStorageSet(LOCALE_STORAGE_KEY, next);
    syncSeoLocaleCookie(next);
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
