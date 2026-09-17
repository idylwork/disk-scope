/**
 * バイト数を読みやすい単位に変換する
 * @param bytes
 * @returns
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB", "TB", "PB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

/**
 * 全体に対する使用率をパーセント整数にする
 * @param usedBytes
 * @param totalBytes
 * @returns
 */
export function usedPercent(usedBytes: number, totalBytes: number): number {
  if (totalBytes <= 0) {
    return 0;
  }
  return Math.round((usedBytes / totalBytes) * 100);
}

/**
 * 件数を日本語表記にする
 * @param count
 * @returns
 */
export function formatCount(count: number): string {
  return `${count.toLocaleString("ja-JP")}件`;
}

/**
 * UNIX秒をローカル日時にする
 * @param unixSeconds
 * @returns
 */
export function formatModified(unixSeconds: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(unixSeconds * 1000));
}

/**
 * 走査ルートを下回らない親パスを返す
 * @param path
 * @param rootPath
 * @returns
 */
export function parentPath(path: string, rootPath: string): string {
  if (path === rootPath) {
    return rootPath;
  }
  const separatorIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (separatorIndex <= 0) {
    return rootPath;
  }
  const parent = path.slice(0, separatorIndex);
  return parent.startsWith(rootPath) ? parent : rootPath;
}

/**
 * ルートから現在地までのパンくずを作る
 * @param rootPath
 * @param currentPath
 * @returns
 */
export function breadcrumbSegments(
  rootPath: string,
  currentPath: string,
): Array<{ name: string; path: string }> {
  const delimiter = rootPath.includes("\\") ? "\\" : "/";
  const parts = rootPath.split(/[/\\]/).filter(Boolean);
  const rootName = parts[parts.length - 1] ?? rootPath;
  const segments = [{ name: rootName, path: rootPath }];
  if (currentPath === rootPath || !currentPath.startsWith(rootPath)) {
    return segments;
  }
  const rest = currentPath.slice(rootPath.length).replace(/^[/\\]/, "");
  if (!rest) {
    return segments;
  }
  let cursor = rootPath;
  for (const name of rest.split(/[/\\]/)) {
    cursor = cursor.endsWith(delimiter) ? `${cursor}${name}` : `${cursor}${delimiter}${name}`;
    segments.push({ name, path: cursor });
  }
  return segments;
}
