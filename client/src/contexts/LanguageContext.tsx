import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type LanguageMode = "auto" | "en" | "zh";
export type ResolvedLanguage = "en" | "zh";

interface LanguageContextValue {
  mode: LanguageMode;
  resolved: ResolvedLanguage;
  setMode: (mode: LanguageMode) => void;
  reportInput: (text: string) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const detectLanguage = (text: string): ResolvedLanguage =>
  /[\u4e00-\u9fff]/.test(text) ? "zh" : "en";

const detectFromNavigator = (): ResolvedLanguage => {
  if (typeof navigator === "undefined") return "en";
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en";
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<LanguageMode>(() => {
    const stored = localStorage.getItem("languageMode");
    if (stored === "en" || stored === "zh" || stored === "auto") {
      return stored;
    }
    return "auto";
  });
  const [detected, setDetected] = useState<ResolvedLanguage>(() => detectFromNavigator());

  const setMode = (next: LanguageMode) => {
    setModeState(next);
    localStorage.setItem("languageMode", next);
  };

  const reportInput = (text: string) => {
    if (!text) return;
    setDetected(detectLanguage(text));
  };

  const resolved = useMemo<ResolvedLanguage>(
    () => (mode === "auto" ? detected : mode),
    [mode, detected]
  );

  useEffect(() => {
    if (mode === "auto") {
      setDetected(prev => prev ?? detectFromNavigator());
    }
  }, [mode]);

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
