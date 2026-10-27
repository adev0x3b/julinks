"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-storage";

/** The `dark` class on <html> is the source of truth; the toggle follows it, whoever changes it. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
const isDark = () => document.documentElement.classList.contains("dark");
// The server cannot see localStorage, so it renders a neutral button first.
const unknown = () => null;

/**
 * Light/dark switch for the app chrome. The choice lives in localStorage and
 * is applied as the `dark` class on <html>; with nothing stored, the system
 * setting wins (see the inline script in the root layout).
 */
export function ThemeToggle() {
  const dark = useSyncExternalStore<boolean | null>(subscribe, isDark, unknown);

  function toggle() {
    const next = !isDark();
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Private mode or storage off: the page still switches for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn-ghost px-2"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark ?? undefined}
      title={dark ? "Light mode" : "Dark mode"}
      data-testid="theme-toggle"
    >
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
