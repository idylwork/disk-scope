import type { ThemePreference } from "./types";

const STORAGE_KEY = "disk-scope-theme";

/**
 * 保存済みのテーマ設定を読み出す
 * @returns
 */
export function loadThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

/**
 * テーマ設定を保存し、document に反映する
 * @param preference
 * @returns
 */
export function applyThemePreference(preference: ThemePreference): void {
  window.localStorage.setItem(STORAGE_KEY, preference);
  document.documentElement.dataset.theme = resolveTheme(preference);
}

/**
 * 指定設定を実際のライト/ダークへ解決する
 * @param preference
 * @returns
 */
export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return preference;
}
