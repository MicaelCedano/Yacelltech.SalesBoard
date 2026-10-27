"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { MotionConfig } from "motion/react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";
const ThemeContext = createContext({ theme: "light" as Theme, toggleTheme: () => {} });

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    const sync = (event: StorageEvent) => {
      if (event.key !== "salesboard-theme") return;
      const next = event.newValue === "dark" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      document.documentElement.classList.toggle("dark", next === "dark");
      setTheme(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.documentElement.classList.toggle("dark", next === "dark");
    setTheme(next);
    try { window.localStorage.setItem("salesboard-theme", next); } catch { /* Preferencia solo para esta sesión. */ }
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}><MotionConfig reducedMotion="user" transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>{children}</MotionConfig></ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const label = theme === "light" ? "Activar modo oscuro" : "Activar modo claro";
  return <button type="button" className="icon-button" onClick={toggleTheme} aria-label={label} title={label}>
    {theme === "light" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
  </button>;
}
