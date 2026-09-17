import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { AccessPrompt } from "./components/AccessPrompt";
import { DetailsPanel } from "./components/DetailsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { SunburstChart } from "./components/SunburstChart";
import { Toolbar } from "./components/Toolbar";
import {
  cancelScan,
  diskAccessStatus,
  getNode,
  getView,
  getVolumeInfo,
  openFullDiskAccessSettings,
  renamePath,
  startScan,
  trashPath,
} from "./lib/api";
import { parentPath } from "./lib/format";
import {
  highlightThresholdBytes,
  loadHighlightIndex,
  saveHighlightIndex,
} from "./lib/settings";
import {
  applyThemePreference,
  loadThemePreference,
  resolveTheme,
} from "./lib/theme";
import type {
  NodeDetail,
  ScanProgress,
  ThemePreference,
  ViewNode,
  VolumeInfo,
} from "./lib/types";
import styles from "./App.module.css";

/**
 * 詳細レスポンスから選択用ノードを作る
 * @param detail
 * @returns
 */
function viewFromDetail(detail: NodeDetail): ViewNode {
  return {
    path: detail.path,
    name: detail.name,
    isDir: detail.isDir,
    size: detail.size,
    fileCount: detail.fileCount,
    isOther: false,
    children: detail.children.map((child) => ({
      path: child.path,
      name: child.name,
      isDir: child.isDir,
      size: child.size,
      fileCount: child.fileCount,
      isOther: false,
      children: [],
    })),
  };
}

/**
 * ディスク容量の走査とサンバースト表示のルート
 * @returns
 */
function App() {
  const [theme, setTheme] = useState<ThemePreference>(() => loadThemePreference());
  const [highlightIndex, setHighlightIndex] = useState(() => loadHighlightIndex());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [viewTree, setViewTree] = useState<ViewNode | null>(null);
  const [viewPath, setViewPath] = useState<string | null>(null);
  const [selected, setSelected] = useState<ViewNode | null>(null);
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [listFolder, setListFolder] = useState<NodeDetail | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsDiskAccess, setNeedsDiskAccess] = useState(false);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessDismissed, setAccessDismissed] = useState(false);
  const [volume, setVolume] = useState<VolumeInfo | null>(null);
  const [volumeNonce, setVolumeNonce] = useState(0);

  useEffect(() => {
    applyThemePreference(theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    /**
     * OS の外観変更を system 設定へ反映する
     * @returns
     */
    function handleSchemeChange() {
      applyThemePreference(theme);
    }
    media.addEventListener("change", handleSchemeChange);
    return () => media.removeEventListener("change", handleSchemeChange);
  }, [theme]);

  /**
   * 強調サイズの閾値を保存する
   * @param index
   * @returns
   */
  function handleHighlightIndexChange(index: number) {
    setHighlightIndex(index);
    saveHighlightIndex(index);
  }

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    const pending = Promise.all([
      listen<ScanProgress>("scan-progress", (event) => {
        setProgress(event.payload);
      }),
      listen<ViewNode>("scan-tree", (event) => {
        setViewTree(event.payload);
        setViewPath(event.payload.path);
        setRootPath(event.payload.path);
        setSelected((current) => current ?? event.payload);
      }),
      listen("scan-done", () => {
        setScanning(false);
      }),
      listen<string>("scan-error", (event) => {
        setError(event.payload);
        setScanning(false);
      }),
    ]);

    return () => {
      void pending.then((unlisteners) => {
        for (const unlisten of unlisteners) {
          unlisten();
        }
      });
    };
  }, []);

  /**
   * フルディスクアクセスの状態を取り直す
   * @returns
   */
  async function refreshDiskAccess() {
    const status = await diskAccessStatus();
    setNeedsDiskAccess(status.needed && !status.granted);
    return status;
  }

  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    void refreshDiskAccess();
    /**
     * 設定アプリから戻ったタイミングで許可状態を見直す
     * @returns
     */
    function handleFocus() {
      void refreshDiskAccess();
      setVolumeNonce((current) => current + 1);
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  useEffect(() => {
    if (!isTauri() || !rootPath) {
      setVolume(null);
      return;
    }
    let cancelled = false;
    void getVolumeInfo(rootPath)
      .then((nextVolume) => {
        if (!cancelled) {
          setVolume(nextVolume);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVolume(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [rootPath, volumeNonce]);

  useEffect(() => {
    if (!selected || selected.isOther) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    void getNode(selected.path)
      .then((nextDetail) => {
        if (cancelled) {
          return;
        }
        setDetail(nextDetail);
        if (nextDetail.isDir) {
          setListFolder(nextDetail);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(String(requestError));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selected, viewTree]);

  /**
   * システム設定のフルディスクアクセスを開く
   * @returns
   */
  async function handleOpenSettings() {
    await openFullDiskAccessSettings();
  }

  /**
   * フォルダ選択ダイアログから走査を始める
   * @returns
   */
  async function handlePickFolder() {
    if (!isTauri()) {
      return;
    }
    const status = await refreshDiskAccess();
    if (status.needed && !status.granted) {
      setAccessModalOpen(true);
      return;
    }
    await pickFolderAndScan();
  }

  /**
   * 許可案内を閉じる。走査前ならフォルダ選択へ進む
   * @returns
   */
  async function handleSkipAccess() {
    const shouldPick = accessModalOpen;
    setAccessModalOpen(false);
    setAccessDismissed(true);
    if (shouldPick) {
      await pickFolderAndScan();
    }
  }

  /**
   * フォルダピッカーを開いて走査する
   * @returns
   */
  async function pickFolderAndScan() {
    const picked = await open({
      directory: true,
      multiple: false,
      title: "走査するフォルダを選択",
    });
    if (typeof picked !== "string") {
      return;
    }
    setError(null);
    setScanning(true);
    setProgress(null);
    setSelected(null);
    setDetail(null);
    setListFolder(null);
    setViewTree(null);
    setViewPath(picked);
    setRootPath(picked);
    try {
      await startScan(picked);
    } catch (requestError) {
      setScanning(false);
      setError(String(requestError));
    }
  }

  /**
   * 指定パスを現在のサンバースト根にする
   * @param path
   * @returns
   */
  async function handleNavigate(path: string) {
    const view = await getView(path);
    setViewTree(view);
    setViewPath(view.path);
    setSelected(view);
    if (view.isDir) {
      const folder = await getNode(view.path);
      setDetail(folder);
      setListFolder(folder);
    }
  }

  /**
   * フォルダ詳細の一覧へ戻る
   * @returns
   */
  async function handleBackToList() {
    if (!rootPath) {
      return;
    }
    if (selected && !selected.isDir && listFolder) {
      setSelected(viewFromDetail(listFolder));
      setDetail(listFolder);
      return;
    }
    const currentPath = selected?.path ?? listFolder?.path;
    if (!currentPath) {
      return;
    }
    const parent = parentPath(currentPath, rootPath);
    const parentDetail = await getNode(parent);
    setSelected(viewFromDetail(parentDetail));
    setDetail(parentDetail);
    setListFolder(parentDetail);
  }

  /**
   * 詳細一覧の子を選択する
   * @param path
   * @returns
   */
  async function handleSelectChild(path: string) {
    const nextDetail = await getNode(path);
    setSelected(viewFromDetail(nextDetail));
    setDetail(nextDetail);
  }

  /**
   * 改名後に表示中の木と選択を更新する
   * @param path
   * @param newName
   * @returns
   */
  async function handleRename(path: string, newName: string) {
    if (!rootPath) {
      return;
    }
    setBusy(true);
    try {
      const rootView = await renamePath(path, newName);
      const nextPath = `${parentPath(path, rootView.path)}/${newName}`;
      const nextViewPath = viewPath === path ? nextPath : (viewPath ?? rootView.path);
      const view = await getView(nextViewPath);
      const nextDetail = await getNode(nextPath);
      const listPath = nextDetail.isDir
        ? nextDetail.path
        : parentPath(nextPath, rootView.path);
      const nextList = await getNode(listPath);
      setRootPath(rootView.path);
      setViewTree(view);
      setViewPath(view.path);
      setSelected(viewFromDetail(nextDetail));
      setDetail(nextDetail);
      setListFolder(nextList);
    } finally {
      setBusy(false);
    }
  }

  /**
   * 削除後に表示中の木と選択を更新する
   * @param path
   * @returns
   */
  async function handleTrash(path: string) {
    if (!rootPath) {
      return;
    }
    setBusy(true);
    try {
      const rootView = await trashPath(path);
      const shouldLeave =
        viewPath === path || Boolean(viewPath?.startsWith(`${path}/`));
      const nextViewPath = shouldLeave
        ? parentPath(path, rootView.path)
        : (viewPath ?? rootView.path);
      const view = await getView(nextViewPath);
      const nextList = await getNode(nextViewPath);
      setRootPath(rootView.path);
      setViewTree(view);
      setViewPath(view.path);
      setSelected(view);
      setDetail(nextList);
      setListFolder(nextList);
      setVolumeNonce((current) => current + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.root}>
      <Toolbar
        rootPath={rootPath}
        viewPath={viewPath}
        scanning={scanning}
        progress={progress}
        volume={volume}
        settingsOpen={settingsOpen}
        onPickFolder={() => {
          void handlePickFolder();
        }}
        onCancel={() => {
          void cancelScan();
          setScanning(false);
        }}
        onNavigate={(path) => {
          void handleNavigate(path);
        }}
        onToggleSettings={() => setSettingsOpen((open) => !open)}
      />
      {needsDiskAccess && (!accessDismissed || accessModalOpen) ? (
        <AccessPrompt
          modalOpen={accessModalOpen}
          onOpenSettings={() => {
            void handleOpenSettings();
          }}
          onSkip={() => {
            void handleSkipAccess();
          }}
        />
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {settingsOpen ? (
        <SettingsPanel
          theme={theme}
          highlightIndex={highlightIndex}
          onThemeChange={setTheme}
          onHighlightIndexChange={handleHighlightIndexChange}
          onClose={() => setSettingsOpen(false)}
        />
      ) : (
        <div className={styles.layout}>
          <section className={styles.chart}>
            <SunburstChart
              data={viewTree}
              selectedPath={selected?.path ?? null}
              canZoomOut={Boolean(rootPath && viewPath && viewPath !== rootPath)}
              isDark={resolveTheme(theme) === "dark"}
              onSelect={setSelected}
              onZoomIn={(node) => {
                void handleNavigate(node.path);
              }}
              onZoomOut={() => {
                if (rootPath && viewPath) {
                  void handleNavigate(parentPath(viewPath, rootPath));
                }
              }}
            />
          </section>
          <section className={styles.details}>
            <DetailsPanel
              selected={selected}
              detail={detail}
              listChildren={listFolder?.children ?? []}
              listChildTotal={listFolder?.childTotal ?? 0}
              isRoot={Boolean(selected && rootPath && selected.path === rootPath)}
              canGoBack={Boolean(
                selected && rootPath && selected.path !== rootPath,
              )}
              busy={busy}
              highlightThreshold={highlightThresholdBytes(highlightIndex)}
              onBack={() => {
                void handleBackToList();
              }}
              onSelectChild={(path) => {
                void handleSelectChild(path);
              }}
              onRename={handleRename}
              onTrash={handleTrash}
            />
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
