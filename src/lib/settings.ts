const STORAGE_KEY = "disk-scope-highlight-threshold";

export const HIGHLIGHT_THRESHOLD_STEPS = [
  0,
  1 * 1024 * 1024,
  10 * 1024 * 1024,
  50 * 1024 * 1024,
  100 * 1024 * 1024,
  250 * 1024 * 1024,
  500 * 1024 * 1024,
  1024 * 1024 * 1024,
  2 * 1024 * 1024 * 1024,
  5 * 1024 * 1024 * 1024,
  10 * 1024 * 1024 * 1024,
] as const;

const DEFAULT_INDEX = HIGHLIGHT_THRESHOLD_STEPS.indexOf(1024 * 1024 * 1024);

/**
 * スライダー値を閾値ステップの範囲に収める
 * @param index
 * @returns
 */
export function clampHighlightIndex(index: number): number {
  if (!Number.isFinite(index)) {
    return DEFAULT_INDEX;
  }
  return Math.min(
    HIGHLIGHT_THRESHOLD_STEPS.length - 1,
    Math.max(0, Math.round(index)),
  );
}

/**
 * 保存済みの強調サイズ閾値のインデックスを読み出す
 * @returns
 */
export function loadHighlightIndex(): number {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === null) {
    return DEFAULT_INDEX;
  }
  return clampHighlightIndex(Number(stored));
}

/**
 * 強調サイズ閾値のインデックスを保存する
 * @param index
 * @returns
 */
export function saveHighlightIndex(index: number): void {
  window.localStorage.setItem(STORAGE_KEY, String(clampHighlightIndex(index)));
}

/**
 * インデックスに対応するバイト閾値を返す。0 は強調なし
 * @param index
 * @returns
 */
export function highlightThresholdBytes(index: number): number {
  return HIGHLIGHT_THRESHOLD_STEPS[clampHighlightIndex(index)] ?? 0;
}
