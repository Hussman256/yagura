"use client";

import { useEffect, useState } from "react";

/**
 * Light/dark toggle. The actual theme is applied instantly, pre-hydration,
 * by the inline script in layout.tsx (reads localStorage, falls back to
 * system preference) — this component only reflects and changes it after
 * mount. Rendering nothing until mounted avoids a hydration mismatch
 * between the server's guess and whatever the script already applied.
 */

type Theme = "dark" | "light";

const STORAGE_KEY = "yagura-theme";

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private browsing / storage disabled — theme just won't persist */
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle(): void {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      className="flex h-6 w-6 items-center justify-center text-washi-dim transition-colors hover:text-washi"
    >
      {theme === "light" ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
          <path
            d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
            strokeLinejoin="round"
          />
        </svg>
      ) : theme === "dark" ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="square"
          />
        </svg>
      ) : (
        <span className="block h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
