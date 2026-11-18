export type ThemeMode = "dark" | "light";

export const THEME_STORAGE_KEY = "theme";
export const THEME_EVENT_NAME = "theme-change";

export interface ThemeChangeDetail {
  isDark: boolean;
  theme: ThemeMode;
}

export function applyThemeToDOM(isDark: boolean, targetDoc?: Document): void {
  const doc = targetDoc ?? (typeof document !== "undefined" ? document : null);
  if (!doc) return;

  if (isDark) {
    doc.documentElement.classList.add("dark");
    doc.documentElement.classList.remove("light");
    if (doc.body) {
      doc.body.classList.add("dark");
      doc.body.classList.remove("light");
    }
  } else {
    doc.documentElement.classList.remove("dark");
    doc.documentElement.classList.add("light");
    if (doc.body) {
      doc.body.classList.remove("dark");
      doc.body.classList.add("light");
    }
  }
}

export function saveThemePreference(isDark: boolean, storage?: Storage): void {
  const s = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  if (!s) return;
  s.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light");
}

export function getThemePreference(storage?: Storage, targetDoc?: Document): boolean {
  const s = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  if (s) {
    const saved = s.getItem(THEME_STORAGE_KEY);
    if (saved === "dark") return true;
    if (saved === "light") return false;
  }
  const doc = targetDoc ?? (typeof document !== "undefined" ? document : null);
  if (doc) {
    return doc.documentElement.classList.contains("dark");
  }
  return true;
}

export function dispatchThemeEvent(isDark: boolean, win?: Window): void {
  const w = win ?? (typeof window !== "undefined" ? window : null);
  if (!w) return;
  w.dispatchEvent(
    new CustomEvent<ThemeChangeDetail>(THEME_EVENT_NAME, {
      detail: {
        isDark,
        theme: isDark ? "dark" : "light",
      },
    })
  );
}
