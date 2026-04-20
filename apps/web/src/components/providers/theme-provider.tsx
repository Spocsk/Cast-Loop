"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const STORAGE_KEY = "cast-loop-theme";
const DEFAULT_THEME: ResolvedTheme = "light";

const ThemeContext = createContext<ThemeContextValue | null>(null);

const isThemePreference = (value: string | null): value is ThemePreference => {
  return value === "system" || value === "light" || value === "dark";
};

const readStoredPreference = (): ThemePreference | null => {
  try {
    const storedPreference = window.localStorage.getItem(STORAGE_KEY);
    return isThemePreference(storedPreference) ? storedPreference : null;
  } catch {
    return null;
  }
};

const persistPreference = (preference: ThemePreference) => {
  try {
    if (preference === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    return;
  }
};

const resolveSystemTheme = (): ResolvedTheme => {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const resolveTheme = (preference: ThemePreference): ResolvedTheme => {
  if (preference === "system") {
    return resolveSystemTheme();
  }

  return preference;
};

const readInitialPreference = (): ThemePreference => {
  if (typeof window === "undefined") {
    return "system";
  }

  const storedPreference = readStoredPreference();
  if (storedPreference) {
    return storedPreference;
  }

  const attributePreference = document.documentElement.dataset.themePreference ?? null;
  if (isThemePreference(attributePreference)) {
    return attributePreference;
  }

  return "system";
};

const readInitialResolvedTheme = (): ResolvedTheme => {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }

  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
};

const applyThemeToDocument = (preference: ThemePreference, resolvedTheme: ResolvedTheme) => {
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = preference;
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readInitialPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(readInitialResolvedTheme);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const syncTheme = () => {
      const nextResolvedTheme = resolveTheme(preference);
      setResolvedTheme(nextResolvedTheme);
      applyThemeToDocument(preference, nextResolvedTheme);
      persistPreference(preference);
    };

    syncTheme();

    const handleSystemThemeChange = () => {
      if (preference !== "system") {
        return;
      }

      syncTheme();
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [preference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      setPreference
    }),
    [preference, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
};
