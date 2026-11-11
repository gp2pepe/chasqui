import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
} from "react";

export interface LocaleMeta {
  code: string;
  name: string;
  flag?: string;
}

export type TranslationDictionary = {
  _meta?: LocaleMeta;
  [key: string]: unknown;
};

interface I18nContextType {
  locale: string;
  availableLocales: LocaleMeta[];
  setLocale: (code: string) => void;
  t: (keyPath: string, variables?: Record<string, string | number>) => string;
}

// Carga automática de todos los archivos *.json presentes en src/locales/ sin tocar código
const localeModules: Record<string, unknown> = import.meta.glob(
  "./../locales/*.json",
  { eager: true }
);

function buildLocalesRegistry(): {
  locales: Record<string, TranslationDictionary>;
  metas: LocaleMeta[];
} {
  const locales: Record<string, TranslationDictionary> = {};
  const metas: LocaleMeta[] = [];

  for (const [filePath, content] of Object.entries(localeModules)) {
    const raw = ((content as { default?: TranslationDictionary })?.default ||
      content) as TranslationDictionary;
    const inferredCode =
      filePath.split("/").pop()?.replace(/\.json$/, "") || "en";
    const meta: LocaleMeta = {
      code: raw._meta?.code || inferredCode,
      name: raw._meta?.name || inferredCode.toUpperCase(),
      flag: raw._meta?.flag,
    };
    locales[meta.code] = raw;
    metas.push(meta);
  }

  // Asegurar orden: Inglés primero, luego alfabético
  metas.sort((a, b) => {
    if (a.code === "en") return -1;
    if (b.code === "en") return 1;
    return a.name.localeCompare(b.name);
  });

  return { locales, metas };
}

const { locales: LOCALE_DICTIONARIES, metas: AVAILABLE_LOCALES } =
  buildLocalesRegistry();

const I18nContext = createContext<I18nContextType | null>(null);

function getNestedValue(
  dict: TranslationDictionary | undefined,
  path: string
): string | null {
  if (!dict) return null;
  const parts = path.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : null;
}

const STORAGE_KEY = "chasqui_locale";

interface I18nProviderProps {
  readonly children: React.ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && LOCALE_DICTIONARIES[saved]) {
        return saved;
      }
    } catch {
      // Ignorar fallos de localStorage en sandbox
    }
    return LOCALE_DICTIONARIES["en"] ? "en" : AVAILABLE_LOCALES[0]?.code || "en";
  });

  const setLocale = useCallback((nextLocale: string) => {
    if (LOCALE_DICTIONARIES[nextLocale]) {
      setLocaleState(nextLocale);
      try {
        localStorage.setItem(STORAGE_KEY, nextLocale);
      } catch {
        // Ignorar
      }
    }
  }, []);

  const t = useCallback(
    (keyPath: string, variables?: Record<string, string | number>): string => {
      // 1. Buscar en el idioma activo
      let val = getNestedValue(LOCALE_DICTIONARIES[locale], keyPath);
      // 2. Fallback a inglés si no se encuentra
      if (!val && locale !== "en") {
        val = getNestedValue(LOCALE_DICTIONARIES["en"], keyPath);
      }
      // 3. Si sigue sin existir, devolver la clave
      if (!val) {
        return keyPath;
      }
      // 4. Reemplazar variables {{var}}
      if (variables) {
        for (const [k, v] of Object.entries(variables)) {
          val = val.replaceAll(`{{${k}}}`, String(v));
        }
      }
      return val;
    },
    [locale]
  );

  const value = useMemo(
    () => ({
      locale,
      availableLocales: AVAILABLE_LOCALES,
      setLocale,
      t,
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
