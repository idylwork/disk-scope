import { X } from "lucide-react";
import { formatBytes } from "../lib/format";
import {
  HIGHLIGHT_THRESHOLD_STEPS,
  highlightThresholdBytes,
} from "../lib/settings";
import type { ThemePreference } from "../lib/types";
import { Button } from "./Button";
import styles from "./SettingsPanel.module.css";

type SettingsPanelProps = {
  theme: ThemePreference;
  highlightIndex: number;
  onThemeChange: (theme: ThemePreference) => void;
  onHighlightIndexChange: (index: number) => void;
  onClose: () => void;
};

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "自動" },
  { value: "light", label: "ライト" },
  { value: "dark", label: "ダーク" },
];

/**
 * テーマと強調サイズの設定画面
 * @param props
 * @returns
 */
export function SettingsPanel({
  theme,
  highlightIndex,
  onThemeChange,
  onHighlightIndexChange,
  onClose,
}: SettingsPanelProps) {
  const threshold = highlightThresholdBytes(highlightIndex);

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <h1 className={styles.title}>設定</h1>
        <Button aria-label="閉じる" onClick={onClose}>
          <X size={18} />
        </Button>
      </header>
      <div className={styles.body}>
        <fieldset className={styles.field}>
          <legend>カラー</legend>
          <div className={styles.theme}>
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={styles.themeButton}
                data-active={theme === option.value}
                onClick={() => onThemeChange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.field}>
          <legend>強調表示するサイズ</legend>
          <label className={styles.rangeLabel} htmlFor="highlight-threshold">
            {threshold === 0 ? "なし" : `${formatBytes(threshold)} 以上`}
          </label>
          <input
            id="highlight-threshold"
            className={styles.range}
            type="range"
            min={0}
            max={HIGHLIGHT_THRESHOLD_STEPS.length - 1}
            step={1}
            value={highlightIndex}
            onChange={(changeEvent) => {
              onHighlightIndexChange(Number(changeEvent.target.value));
            }}
          />
        </fieldset>
      </div>
    </section>
  );
}
