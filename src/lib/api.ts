import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { DiskAccessStatus, NodeDetail, ViewNode, VolumeInfo } from "./types";

/**
 * 指定フォルダの走査を開始する
 * @param path
 * @returns
 */
export function startScan(path: string): Promise<void> {
  return invoke("start_scan", { path });
}

/**
 * 実行中の走査を中断する
 * @returns
 */
export function cancelScan(): Promise<void> {
  return invoke("cancel_scan");
}

/**
 * サンバースト用に刈り込んだ部分木を取得する
 * @param path
 * @returns
 */
export function getView(path: string): Promise<ViewNode> {
  return invoke("get_view", { path });
}

/**
 * 選択項目の詳細を取得する
 * @param path
 * @returns
 */
export function getNode(path: string): Promise<NodeDetail> {
  return invoke("get_node", { path });
}

/**
 * 項目をごみ箱へ移動し、更新後のルートビューを返す
 * @param path
 * @returns
 */
export function trashPath(path: string): Promise<ViewNode> {
  return invoke("trash_path", { path });
}

/**
 * 項目を改名し、更新後のルートビューを返す
 * @param path
 * @param newName
 * @returns
 */
export function renamePath(path: string, newName: string): Promise<ViewNode> {
  return invoke("rename_path", { path, newName });
}

/**
 * フルディスクアクセスが必要か、許可済みかを返す
 * @returns
 */
export function diskAccessStatus(): Promise<DiskAccessStatus> {
  return invoke("disk_access_status");
}

/**
 * システム設定のフルディスクアクセス画面を開く
 * @returns
 */
export function openFullDiskAccessSettings(): Promise<void> {
  return invoke("open_full_disk_access_settings");
}

/**
 * パスが属するボリュームの容量と空きを返す
 * @param path
 * @returns
 */
export function getVolumeInfo(path: string): Promise<VolumeInfo> {
  return invoke("get_volume_info", { path });
}

/**
 * パスを Finder で表示する
 * @param path
 * @returns
 */
export function revealInFinder(path: string): Promise<void> {
  return revealItemInDir(path);
}
