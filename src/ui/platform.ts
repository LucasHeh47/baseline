// Access to the desktop shell. In a browser (development only) there are no apps to start, so a
// small sample of files is shown instead.
import type { BaselineApi, SuiteApp, SuiteFile } from '../shared/api';

declare global {
  interface Window {
    baseline?: BaselineApi;
  }
}

const day = 86_400_000;
const SAMPLE_FILES: SuiteFile[] = [
  { app: 'gridline', path: 'C:\\Users\\you\\Documents\\Budget 2026.xlsx', name: 'Budget 2026.xlsx', openedAt: Date.now() - 3_600_000, pinned: true, size: 18_400, modifiedAt: Date.now() - 3_600_000 },
  { app: 'pixelline', path: 'C:\\Users\\you\\Pictures\\textures\\stone.png', name: 'stone.png', openedAt: Date.now() - 2 * 3_600_000, pinned: false, size: 512, modifiedAt: Date.now() - 2 * 3_600_000 },
  { app: 'pixelline', path: 'C:\\Users\\you\\Pictures\\sprites\\hero.ora', name: 'hero.ora', openedAt: Date.now() - day, pinned: false, size: 9_300, modifiedAt: Date.now() - day },
  { app: 'gridline', path: 'C:\\Users\\you\\Documents\\Fantasy league.xlsx', name: 'Fantasy league.xlsx', openedAt: Date.now() - 3 * day, pinned: false, size: 41_000, modifiedAt: Date.now() - 3 * day },
];

const SAMPLE_APPS: SuiteApp[] = [
  { id: 'baseline', name: 'Baseline', description: 'Home for your apps and files', installed: true, exe: null, version: __APP_VERSION__, download: 'https://github.com/LucasHeh47/baseline/releases' },
  { id: 'gridline', name: 'Gridline', description: 'Spreadsheets', installed: true, exe: null, version: null, download: 'https://github.com/LucasHeh47/gridline/releases' },
  { id: 'pixelline', name: 'Pixelline', description: 'Images and pixel art', installed: false, exe: null, version: null, download: 'https://github.com/LucasHeh47/pixelline/releases' },
];

const webFallback: Omit<BaselineApi, 'isDesktop'> & { isDesktop: boolean } = {
  platform: 'web',
  isDesktop: false,
  apps: async () => SAMPLE_APPS,
  launch: async () => false,
  recentFiles: async () => SAMPLE_FILES,
  openFile: async () => ({ ok: false, error: 'Opening files works in the desktop app.' }),
  openFileDialog: async () => [],
  pinFile: async (_app, p, pinned) => {
    const f = SAMPLE_FILES.find((x) => x.path === p);
    if (f) f.pinned = pinned;
  },
  removeFile: async (_app, p) => {
    const i = SAMPLE_FILES.findIndex((x) => x.path === p);
    if (i >= 0) SAMPLE_FILES.splice(i, 1);
  },
  thumbnail: async () => null,
  showInFolder: () => undefined,
  loginItem: async () => false,
  pickExe: async () => null,
  setTitle: (t) => {
    document.title = t;
  },
  setTheme: () => undefined,
  openExternal: (url) => {
    if (/^(https?:|mailto:)/i.test(url)) window.open(url, '_blank', 'noopener');
  },
  onFocus: (cb) => window.addEventListener('focus', cb),
  toggleDevTools: () => undefined,
  appVersion: async () => __APP_VERSION__,
  setZoomFactor: () => undefined,
  updates: {
    check: async () => ({ status: 'unsupported', current: __APP_VERSION__, error: 'Updates are available in the desktop app.' }),
    state: async () => ({ status: 'unsupported', current: __APP_VERSION__ }),
    download: async () => ({ status: 'unsupported', current: __APP_VERSION__ }),
    install: async () => false,
    openPage: async () => undefined,
    onState: () => undefined,
  },
};

export const platform: BaselineApi = (window.baseline ?? webFallback) as BaselineApi;
export const isDesktop = !!window.baseline;
