import { useState, useEffect, useRef } from "react";

type Theme = "light" | "dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const skipBroadcast = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
    if (skipBroadcast.current) {
      skipBroadcast.current = false;
      return;
    }
    window.electronAPI?.notifyThemeChanged?.(theme);
  }, [theme]);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onThemeChanged?.((next) => {
      setTheme((prev) => {
        if (prev === next) return prev;
        skipBroadcast.current = true;
        return next;
      });
    });
    return unsubscribe;
  }, []);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}
