import React, { createContext, useContext, useState } from "react";

export type LanguageMode = "en" | "zh";
export type ResolvedLanguage = "en" | "zh";

interface LanguageContextValue {
  mode: LanguageMode;
  resolved: ResolvedLanguage;
  setMode: (mode: LanguageMode) => void;
  reportInput: (text: string) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function readStoredLanguageMode(): LanguageMode | null {
  try {
    const stored = localStorage.getItem("languageMode");
    if (stored === "en" || stored === "zh") {
      return stored;
    }
  } catch {
    return null;
  }

  return null;
}

function resolveBrowserLanguage(): ResolvedLanguage {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const browserLang = (navigator.language || "").toLowerCase();
  return browserLang.startsWith("zh") ? "zh" : "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<LanguageMode>(() => {
    return readStoredLanguageMode() ?? resolveBrowserLanguage();
  });

  const setMode = (next: LanguageMode) => {
    setModeState(next);
    localStorage.setItem("languageMode", next);
  };

  // Kept for compatibility with existing callers.
  const reportInput = (_text: string) => {};
  const resolved: ResolvedLanguage = mode;

  return (
    <LanguageContext.Provider value={{ mode, resolved, setMode, reportInput }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
