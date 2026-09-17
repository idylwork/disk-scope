import { HardDrive } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatBytes, usedPercent } from "../lib/format";
import type { VolumeInfo } from "../lib/types";
import styles from "./VolumeHint.module.css";

type VolumeHintProps = {
  volume: VolumeInfo;
};

/**
 * ホバー可能なポインタかどうかを返す
 * @returns
 */
function isHoverPointer(): boolean {
  return window.matchMedia("(hover: hover)").matches;
}

/**
 * 選択パスが属するボリュームの空きと容量を出す
 * @param props
 * @returns
 */
export function VolumeHint({ volume }: VolumeHintProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const usedBytes = Math.max(0, volume.totalBytes - volume.availableBytes);
  const percent = usedPercent(usedBytes, volume.totalBytes);

  useEffect(() => {
    if (!open) {
      return;
    }
    /**
     * タッチで開いたポップオーバーを外タップで閉じる
     * @param event
     * @returns
     */
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-open={open}
      aria-label={`空き ${formatBytes(volume.availableBytes)} / 全体 ${formatBytes(volume.totalBytes)}（${volume.name}）`}
    >
      <span
        className={styles.icon}
        aria-hidden="true"
        onClick={() => {
          if (isHoverPointer()) {
            return;
          }
          setOpen((current) => !current);
        }}
      >
        <HardDrive size={18} />
      </span>
      <div className={styles.popover} role="tooltip">
        <div className={styles.name}>{volume.name}</div>
        {volume.name !== volume.mountPath ? (
          <div className={styles.mount}>{volume.mountPath}</div>
        ) : null}
        <div>
          空き {formatBytes(volume.availableBytes)} / 全体{" "}
          {formatBytes(volume.totalBytes)}
        </div>
        <div className={styles.usage}>使用率 {percent}%</div>
      </div>
    </div>
  );
}
