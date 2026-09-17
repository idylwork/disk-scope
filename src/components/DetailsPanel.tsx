import { ChevronLeft, File, Folder, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { revealInFinder } from "../lib/api";
import { formatBytes, formatCount, formatModified } from "../lib/format";
import type { NodeChild, NodeDetail, ViewNode } from "../lib/types";
import { Button } from "./Button";
import styles from "./DetailsPanel.module.css";

type DetailsPanelProps = {
  selected: ViewNode | null;
  detail: NodeDetail | null;
  listChildren: NodeChild[];
  listChildTotal: number;
  isRoot: boolean;
  canGoBack: boolean;
  busy: boolean;
  highlightThreshold: number;
  onBack: () => void;
  onSelectChild: (path: string) => void;
  onRename: (path: string, newName: string) => Promise<void>;
  onTrash: (path: string) => Promise<void>;
};

/**
 * 選択中のファイル/フォルダ詳細と操作を表示する
 * @param props
 * @returns
 */
export function DetailsPanel({
  selected,
  detail,
  listChildren,
  listChildTotal,
  isRoot,
  canGoBack,
  busy,
  highlightThreshold,
  onBack,
  onSelectChild,
  onRename,
  onTrash,
}: DetailsPanelProps) {
  const [draftName, setDraftName] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftName(detail?.name ?? selected?.name ?? "");
    setEditing(false);
    setConfirmOpen(false);
    setActionError(null);
  }, [detail?.path, detail?.name, selected?.path, selected?.name]);

  useEffect(() => {
    if (editing) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!confirmOpen) {
      return;
    }
    /**
     * 確認中は Escape で閉じる
     * @param keyboardEvent
     * @returns
     */
    function handleKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === "Escape" && !busy) {
        setConfirmOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, confirmOpen]);

  if (!selected) {
    return (
      <aside className={styles.root}>
        <p className={styles.empty}>図から項目を選択してください</p>
      </aside>
    );
  }

  const current = selected;
  const display = detail ?? {
    path: current.path,
    name: current.name,
    isDir: current.isDir,
    size: current.size,
    fileCount: current.fileCount,
    modified: null,
    childTotal: current.children.length,
    children: current.children,
  };
  const canRenameSelected = !current.isOther && !isRoot;

  /**
   * 選択中項目の名前編集を始める
   * @returns
   */
  function beginRename() {
    if (busy || !canRenameSelected) {
      return;
    }
    setActionError(null);
    setDraftName(display.name);
    setEditing(true);
  }

  /**
   * 入力中の名前で改名を実行する
   * @returns
   */
  async function commitRename() {
    if (!editing) {
      return;
    }
    const nextName = draftName.trim();
    setEditing(false);
    if (!nextName || nextName === display.name) {
      setDraftName(display.name);
      return;
    }
    setActionError(null);
    try {
      await onRename(display.path, nextName);
    } catch (error) {
      setDraftName(display.name);
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 名前編集を破棄する
   * @returns
   */
  function cancelRename() {
    setDraftName(display.name);
    setEditing(false);
  }

  /**
   * ゴミ箱への移動を確定する
   * @returns
   */
  async function handleTrash() {
    setActionError(null);
    try {
      await onTrash(display.path);
      setConfirmOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <aside className={styles.root}>
      {canGoBack ? (
        <button type="button" className={styles.back} onClick={onBack}>
          <ChevronLeft size={16} />
          戻る
        </button>
      ) : null}
      <div>
        {editing ? (
          <input
            ref={nameInputRef}
            className={styles.nameInput}
            value={draftName}
            disabled={busy}
            aria-label="名前"
            onChange={(changeEvent) => setDraftName(changeEvent.target.value)}
            onBlur={() => {
              void commitRename();
            }}
            onKeyDown={(keyboardEvent) => {
              if (keyboardEvent.key === "Enter") {
                keyboardEvent.preventDefault();
                void commitRename();
              }
              if (keyboardEvent.key === "Escape") {
                keyboardEvent.preventDefault();
                cancelRename();
              }
            }}
          />
        ) : canRenameSelected ? (
          <button
            type="button"
            className={styles.headingButton}
            title="クリックして名前を変更"
            onClick={beginRename}
          >
            {display.name}
          </button>
        ) : (
          <h2 className={styles.heading}>{display.name}</h2>
        )}
        <p className={styles.path}>
          {display.path}
          {current.isOther ? null : (
            <button
              type="button"
              className={styles.pathReveal}
              aria-label="Finder で開く"
              title="Finder で開く"
              onClick={() => {
                void revealInFinder(display.path).catch((error) => {
                  setActionError(
                    error instanceof Error ? error.message : String(error),
                  );
                });
              }}
            >
              <SquareArrowOutUpRight size={14} aria-hidden />
            </button>
          )}
        </p>
      </div>
      <dl className={styles.dl}>
        <dt>種類</dt>
        <dd>
          {current.isOther ? "集約" : display.isDir ? "フォルダ" : "ファイル"}
        </dd>
        <dt>サイズ</dt>
        <dd>{formatBytes(display.size)}</dd>
        {display.isDir ? (
          <>
            <dt>内訳</dt>
            <dd>{formatCount(display.fileCount)}</dd>
          </>
        ) : null}
        <dt>更新</dt>
        <dd>{display.modified ? formatModified(display.modified) : "—"}</dd>
      </dl>

      {canRenameSelected ? (
        <div className={styles.actions}>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 size={16} aria-hidden />
            ゴミ箱に入れる
          </Button>
        </div>
      ) : null}

      {actionError ? <p className={styles.error}>{actionError}</p> : null}

      {listChildren.length > 0 ? (
        <div className={styles.list}>
          {listChildren.map((child) => {
            const emphasized =
              highlightThreshold > 0 && child.size >= highlightThreshold;
            return (
              <button
                key={child.path}
                type="button"
                className={styles.child}
                data-active={child.path === current.path}
                onClick={() => onSelectChild(child.path)}
              >
                <span className={styles.childName}>
                  {child.isDir ? (
                    <Folder size={16} aria-hidden />
                  ) : (
                    <File size={16} aria-hidden />
                  )}
                  {child.name}
                </span>
                <span className={styles.childSize} data-large={emphasized}>
                  {formatBytes(child.size)}
                </span>
                {child.isDir ? (
                  <span className={styles.childMeta}>{formatCount(child.fileCount)}</span>
                ) : null}
              </button>
            );
          })}
          {listChildTotal > listChildren.length ? (
            <div className={styles.more}>
              他 {formatCount(listChildTotal - listChildren.length)}
            </div>
          ) : null}
        </div>
      ) : null}

      {confirmOpen
        ? createPortal(
            <div
              className={styles.dialogBackdrop}
              role="presentation"
              onClick={() => {
                if (!busy) {
                  setConfirmOpen(false);
                }
              }}
            >
              <div
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="trash-confirm-title"
                onClick={(clickEvent) => clickEvent.stopPropagation()}
              >
                <h2 id="trash-confirm-title">ゴミ箱に入れる</h2>
                <p>「{display.name}」をごみ箱に移動しますか？</p>
                <div className={styles.dialogActions}>
                  <Button
                    disabled={busy}
                    onClick={() => setConfirmOpen(false)}
                  >
                    キャンセル
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      void handleTrash();
                    }}
                  >
                    移動する
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </aside>
  );
}
