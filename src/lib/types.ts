export type ViewNode = {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  fileCount: number;
  isOther: boolean;
  children: ViewNode[];
};

export type ScanProgress = {
  files: number;
  bytes: number;
  current: string;
};

export type NodeChild = {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  fileCount: number;
};

export type NodeDetail = {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  fileCount: number;
  modified: number | null;
  childTotal: number;
  children: NodeChild[];
};

export type ThemePreference = "system" | "light" | "dark";

export type DiskAccessStatus = {
  needed: boolean;
  granted: boolean;
};

export type VolumeInfo = {
  name: string;
  mountPath: string;
  totalBytes: number;
  availableBytes: number;
};
