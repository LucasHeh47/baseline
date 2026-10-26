// The bridge between Baseline's main process and its UI (exposed as window.baseline).

export type SuiteAppId = 'baseline' | 'gridline' | 'pixelline' | 'frameline';

/** The apps that make files (everything but Baseline). */
export type WorkApp = 'gridline' | 'pixelline' | 'frameline';

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

/** A file from Gridline's, Pixelline's or Frameline's recent list. */
export interface SuiteFile {
  app: WorkApp;
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

export interface AppRelease {
  version: string;
  prerelease: boolean;
  url: string;
  size: number;
  notes: string;
}

/** Whether an app is installed, which version, and whether a newer one is out. */
export interface AppStatus {
  id: WorkApp;
  installed: boolean;
  exe: string | null;
  /** A portable copy: it updates itself (Baseline can't run an installer over it). */
  portable: boolean;
  current: string | null;
  latest: AppRelease | null;
  update: boolean;
  busy: boolean;
  /** Releases couldn't be checked (offline…). */
  error?: string;
}

export interface InstallProgress {
  id: WorkApp;
  phase: 'checking' | 'downloading' | 'installing' | 'done' | 'error';
  percent: number;
  version?: string;
}

export interface InstallResult {
  ok: boolean;
  version?: string;
  /** 'running' when the app is open (it has to be closed first). */
  error?: string;
}

export interface BaselineApi {
  platform: string;
  isDesktop: true;
  apps(extra?: AppPaths): Promise<SuiteApp[]>;
  /** Starts an app, with files to open or options like "--new" or "--template=budget". */
  launch(id: SuiteAppId, args?: string[], extra?: AppPaths): Promise<boolean>;
  /** How this copy runs: 'installed' copies install the other apps by themselves the first time. */
  installKind(): Promise<'installed' | 'portable' | 'dev'>;
  /** Installed versions and the newest releases (development builds too when asked; `fresh` asks GitHub again). */
  appStatus(extra: AppPaths, includeDev: boolean, fresh?: boolean): Promise<AppStatus[]>;
  /** Downloads the newest installer of an app and runs it silently. */
  installApp(id: WorkApp, includeDev: boolean): Promise<InstallResult>;
  onInstallProgress(cb: (p: InstallProgress) => void): void;
  recentFiles(): Promise<SuiteFile[]>;
  /** Opens a file in the app that makes it. */
  openFile(path: string, extra?: AppPaths): Promise<OpenResult>;
  /** The Open dialog; returns the files chosen (they can then be opened). */
  openFileDialog(): Promise<string[]>;
  pinFile(app: WorkApp, path: string, pinned: boolean): Promise<void>;
  removeFile(app: WorkApp, path: string): Promise<void>;
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
