import { ScanSearch, Settings } from "lucide-react";
import { breadcrumbSegments, formatBytes, formatCount } from "../lib/format";
import type { ScanProgress, VolumeInfo } from "../lib/types";
import { Button } from "./Button";
import { VolumeHint } from "./VolumeHint";
import styles from "./Toolbar.module.css";

type ToolbarProps = {
  rootPath: string | null;
  viewPath: string | null;
  scanning: boolean;
  progress: ScanProgress | null;
  volume: VolumeInfo | null;
  settingsOpen: boolean;
  onPickFolder: () => void;
  onCancel: () => void;
  onNavigate: (path: string) => void;
  onToggleSettings: () => void;
};

/**
 * 走査操作・進捗・設定をまとめたバー
 * @param props
 * @returns
 */
export function Toolbar({
  rootPath,
  viewPath,
  scanning,
  progress,
  volume,
  settingsOpen,
  onPickFolder,
  onCancel,
  onNavigate,
  onToggleSettings,
}: ToolbarProps) {
  const crumbs =
    rootPath && viewPath ? breadcrumbSegments(rootPath, viewPath) : [];

  return (
    <header className={styles.root}>
      <div className={styles.brand}>Disk Scope</div>
      <div className={styles.actions}>
        <Button variant="primary" onClick={onPickFolder}>
          <ScanSearch size={16} />
          スキャン開始
        </Button>
        {scanning ? <Button onClick={onCancel}>キャンセル</Button> : null}
      </div>
      <div className={styles.status}>
        {volume ? <VolumeHint volume={volume} /> : null}
        {scanning && progress ? (
          <div>
            走査中 {formatCount(progress.files)} / {formatBytes(progress.bytes)}
            <div className={styles.statusPath} title={progress.current}>
              {progress.current}
            </div>
          </div>
        ) : rootPath ? (
          <div title={rootPath}>{rootPath}</div>
        ) : (
          <div>フォルダを選択して容量を表示します</div>
        )}
      </div>
      <Button
        active={settingsOpen}
        aria-label="設定"
        onClick={onToggleSettings}
      >
        <Settings size={18} />
      </Button>
      {crumbs.length > 0 && !settingsOpen ? (
        <nav className={styles.crumbs} aria-label="パンくず">
          {crumbs.map((segment, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <span key={segment.path}>
                {index > 0 ? <span className={styles.sep}>/</span> : null}
                {isLast ? (
                  <span className={styles.crumbCurrent}>{segment.name}</span>
                ) : (
                  <button
                    type="button"
                    className={styles.crumb}
                    onClick={() => onNavigate(segment.path)}
                  >
                    {segment.name}
                  </button>
                )}
              </span>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}
