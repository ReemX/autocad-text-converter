export type Theme = "auto" | "light" | "dark";

const KEY = "theme";
const VALID: Theme[] = ["auto", "light", "dark"];

export function loadTheme(): Theme {
  const stored = localStorage.getItem(KEY);
  return stored && (VALID as string[]).includes(stored) ? (stored as Theme) : "auto";
}

export function applyTheme(theme: Theme) {
  if (theme === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(KEY, theme);
}
