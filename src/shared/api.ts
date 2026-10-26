// The bridge between Baseline's main process and its UI (exposed as window.baseline).

export type SuiteAppId = 'baseline' | 'gridline' | 'pixelline';

export interface SuiteApp {
  id: SuiteAppId;
  name: string;
  description: string;
  installed: boolean;
  exe: string | null;
  version: string | null;
  /** Where to download it. */
  download: string;
}

/** A file from Gridline's or Pixelline's recent list. */
export interface SuiteFile {
  app: 'gridline' | 'pixelline';
  path: string;
  name: string;
  openedAt: number;
  pinned: boolean;
  size: number;
  modifiedAt: number;
}

export interface OpenResult {
  ok: boolean;
  app?: SuiteAppId;
  /** 'not-installed' when the app that opens it isn't installed. */
  error?: string;
}

/** Custom .exe locations from Settings, for portable copies. */
export type AppPaths = Partial<Record<SuiteAppId, string>>;

export interface BaselineApi {
  platform: string;
  isDesktop: true;
  apps(extra?: AppPaths): Promise<SuiteApp[]>;
  /** Starts an app, with files to open or options like "--new" or "--template=budget". */
  launch(id: SuiteAppId, args?: string[], extra?: AppPaths): Promise<boolean>;
  recentFiles(): Promise<SuiteFile[]>;
  /** Opens a file in the app that makes it. */
  openFile(path: string, extra?: AppPaths): Promise<OpenResult>;
  /** The Open dialog; returns the files chosen (they can then be opened). */
  openFileDialog(): Promise<string[]>;
  pinFile(app: 'gridline' | 'pixelline', path: string, pinned: boolean): Promise<void>;
  removeFile(app: 'gridline' | 'pixelline', path: string): Promise<void>;
  /** A data: URL picture of the file (the image, or its type's icon), or null. */
  thumbnail(path: string): Promise<string | null>;
  showInFolder(path: string): void;
  /** Start Baseline when signing in to Windows (reads the setting without a value). */
  loginItem(value?: boolean): Promise<boolean>;
  pickExe(appName: string): Promise<string | null>;
  setTitle(title: string): void;
  setTheme(theme: { dark: boolean; bar: string; symbol: string }): void;
  openExternal(url: string): void;
  /** The window got focus again (lists may have changed in the other apps). */
  onFocus(cb: () => void): void;
  toggleDevTools(): void;
  appVersion(): Promise<string>;
  setZoomFactor(factor: number): void;
  updates: UpdatesApi;
}

export interface UpdateCheckOptions {
  /** A background check at startup (no message when there's nothing new). */
  silent?: boolean;
  allowPrerelease?: boolean;
  autoDownload?: boolean;
}

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error' | 'unsupported';
  /** Version currently running. */
  current: string;
  /** Newest version found. */
  version?: string;
  notes?: string;
  percent?: number;
  error?: string;
  /** Portable builds can't update themselves; `url` is the download page. */
  portable?: boolean;
  url?: string;
}

export interface UpdatesApi {
  check(opts: UpdateCheckOptions): Promise<UpdateState>;
  state(): Promise<UpdateState>;
  download(): Promise<UpdateState>;
  install(): Promise<boolean>;
  openPage(): Promise<void>;
  onState(cb: (s: UpdateState) => void): void;
}
