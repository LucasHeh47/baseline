// Baseline's main process: the window, the suite's apps (finding and starting them), and the
// recent files of Gridline and Pixelline (read from each app's own list, so nothing is copied).
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, shell, type IpcMainInvokeEvent } from 'electron';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { SuiteAppId, SuiteFile } from '../src/shared/api';
import { appFor, OPENS } from '../src/shared/suiteFiles';
import { launchSuiteApp, registerSelf, safeLaunchArgs, suiteApps } from './suite';
import { setupUpdates } from './updater';

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const SMOKE_SCREENSHOT = process.env.BASELINE_SCREENSHOT;

const APP_FOLDERS: Record<'gridline' | 'pixelline', string> = { gridline: 'Gridline', pixelline: 'Pixelline' };

/** Where the apps keep their settings (tests point this somewhere else). */
const appData = () => process.env.BASELINE_APPDATA || app.getPath('appData');

/** Files the UI may open or show: from the apps' recent lists, or picked in the Open dialog. */
const known = new Set<string>();
const remember = (p: string) => known.add(path.resolve(p).toLowerCase());
const isKnown = (p: unknown): p is string => typeof p === 'string' && known.has(path.resolve(p).toLowerCase());

/** Custom app locations from Settings (portable copies). Only existing .exe files count. */
function customExes(extra: unknown): Partial<Record<SuiteAppId, string>> {
  const out: Partial<Record<SuiteAppId, string>> = {};
  if (!extra || typeof extra !== 'object') return out;
  for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
    if (['baseline', 'gridline', 'pixelline'].includes(k) && typeof v === 'string' && /\.exe$/i.test(v) && path.isAbsolute(v) && existsSync(v)) out[k as SuiteAppId] = v;
  }
  return out;
}

// ---------- recent files of the apps ----------

interface Recent {
  path: string;
  name: string;
  openedAt: number;
  pinned?: boolean;
}

const recentFile = (id: 'gridline' | 'pixelline') => path.join(appData(), APP_FOLDERS[id], 'recent.json');

async function readRecent(id: 'gridline' | 'pixelline'): Promise<Recent[]> {
  try {
    const list = JSON.parse(await fs.readFile(recentFile(id), 'utf8')) as Recent[];
    return Array.isArray(list) ? list.filter((r) => r && typeof r.path === 'string') : [];
  } catch {
    return [];
  }
}

async function writeRecent(id: 'gridline' | 'pixelline', list: Recent[]): Promise<void> {
  await fs.mkdir(path.dirname(recentFile(id)), { recursive: true });
  await fs.writeFile(recentFile(id), JSON.stringify(list, null, 2));
}

async function allRecent(): Promise<SuiteFile[]> {
  const out: SuiteFile[] = [];
  for (const id of ['gridline', 'pixelline'] as const) {
    for (const r of await readRecent(id)) {
      const st = await fs.stat(r.path).catch(() => null);
      if (!st) continue;
      remember(r.path);
      out.push({ app: id, path: r.path, name: r.name || path.basename(r.path), openedAt: r.openedAt || 0, pinned: !!r.pinned, size: st.size, modifiedAt: st.mtimeMs });
    }
  }
  return out.sort((a, b) => b.openedAt - a.openedAt);
}


// ---------- window ----------

let mainWindow: BrowserWindow | null = null;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: '#121417',
    title: 'Baseline',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#16181d', symbolColor: '#c9ced8', height: 40 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });
  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.once('ready-to-show', () => {
    win.show();
    if (SMOKE_SCREENSHOT) {
      setTimeout(async () => {
        const img = await win.webContents.capturePage();
        await fs.writeFile(SMOKE_SCREENSHOT, img.toPNG());
        app.exit(0);
      }, Number(process.env.BASELINE_SCREENSHOT_DELAY ?? 2500));
    }
  });
  // Coming back to Baseline: the lists may have changed in the other apps
  win.on('focus', () => win.webContents.send('app:focus'));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault();
  });
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });
  mainWindow = win;
  return win;
}

const senderWindow = (e: IpcMainInvokeEvent | Electron.IpcMainEvent) => BrowserWindow.fromWebContents(e.sender);

// ---------- IPC ----------

ipcMain.handle('suite:apps', (_e, extra: unknown) => suiteApps(customExes(extra)));
ipcMain.handle('suite:launch', async (_e, id: SuiteAppId, args: unknown, extra: unknown) => {
  if (!['gridline', 'pixelline'].includes(id)) return false;
  return launchSuiteApp(id, safeLaunchArgs(args), customExes(extra));
});

ipcMain.handle('files:recent', () => allRecent());
ipcMain.handle('files:open', async (_e, p: string, extra: unknown) => {
  if (!isKnown(p) || !existsSync(p)) return { ok: false, error: 'That file is gone. It may have been moved or deleted.' };
  const id = appFor(p);
  if (!id) return { ok: false, error: 'No app in the suite opens that kind of file.' };
  const ok = await launchSuiteApp(id, [path.resolve(p)], customExes(extra));
  return ok ? { ok: true, app: id } : { ok: false, error: 'not-installed', app: id };
});
ipcMain.handle('files:open-dialog', async (e) => {
  const win = senderWindow(e);
  const res = await dialog.showOpenDialog(win!, {
    title: 'Open a file',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Spreadsheets and images', extensions: ['xlsx', 'xlsm', 'csv', 'tsv', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ora', 'psd'] },
      { name: 'Spreadsheets (Gridline)', extensions: ['xlsx', 'xlsm', 'csv', 'tsv'] },
      { name: 'Images (Pixelline)', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ora', 'psd'] },
    ],
  });
  if (res.canceled) return [];
  for (const p of res.filePaths) remember(p);
  return res.filePaths;
});
ipcMain.handle('files:pin', async (_e, id: 'gridline' | 'pixelline', p: string, pinned: boolean) => {
  if (!(id in OPENS) || !isKnown(p)) return;
  const list = await readRecent(id);
  for (const r of list) if (r.path.toLowerCase() === p.toLowerCase()) r.pinned = pinned ? true : undefined;
  await writeRecent(id, list);
});
ipcMain.handle('files:remove', async (_e, id: 'gridline' | 'pixelline', p: string) => {
  if (!(id in OPENS) || typeof p !== 'string') return;
  await writeRecent(
    id,
    (await readRecent(id)).filter((r) => r.path.toLowerCase() !== p.toLowerCase()),
  );
});
/** A small picture of a file: the image itself for pictures, the file type's icon otherwise. */
ipcMain.handle('files:thumbnail', async (_e, p: string) => {
  if (!isKnown(p)) return null;
  try {
    if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) {
        const { width, height } = img.getSize();
        const s = Math.min(1, 240 / Math.max(width, height));
        // Pixel art stays crisp when it's enlarged in the page (CSS pixelated)
        return (s < 1 ? img.resize({ width: Math.max(1, Math.round(width * s)), height: Math.max(1, Math.round(height * s)), quality: 'good' }) : img).toDataURL();
      }
    }
    const thumb = await nativeImage.createThumbnailFromPath(p, { width: 240, height: 180 }).catch(() => null);
    if (thumb && !thumb.isEmpty()) return thumb.toDataURL();
    return (await app.getFileIcon(p, { size: 'large' })).toDataURL();
  } catch {
    return null;
  }
});
ipcMain.on('files:show-in-folder', (_e, p: string) => {
  if (isKnown(p)) shell.showItemInFolder(p);
});

ipcMain.handle('app:login-item', (_e, value?: boolean) => {
  if (typeof value === 'boolean' && app.isPackaged) app.setLoginItemSettings({ openAtLogin: value });
  return app.getLoginItemSettings().openAtLogin;
});
ipcMain.on('win:set-title', (e, title: string) => senderWindow(e)?.setTitle(String(title)));
ipcMain.on('win:set-theme', (e, t: { dark: boolean; bar: string; symbol: string }) => {
  const win = senderWindow(e);
  try {
    win?.setTitleBarOverlay?.({ color: t.bar, symbolColor: t.symbol, height: 40 });
    win?.setBackgroundColor(t.dark ? '#121417' : '#ffffff');
  } catch {
    // not supported on this platform
  }
});
ipcMain.on('win:devtools', (e) => e.sender.toggleDevTools());
ipcMain.on('shell:open-external', (_e, url: string) => {
  if (typeof url === 'string' && /^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
});
ipcMain.handle('app:version', () => app.getVersion());
/** Picks an app's .exe in Settings (for portable copies). */
ipcMain.handle('app:pick-exe', async (e, name: string) => {
  const win = senderWindow(e);
  const res = await dialog.showOpenDialog(win!, { title: `Where is ${String(name).slice(0, 40)}?`, properties: ['openFile'], filters: [{ name: 'Programs', extensions: ['exe'] }] });
  return res.canceled ? null : (res.filePaths[0] ?? null);
});

setupUpdates();

// ---------- lifecycle ----------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = mainWindow ?? BrowserWindow.getAllWindows()[0];
    if (!win) {
      createWindow();
      return;
    }
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    app.setAppUserModelId('com.baseline.app');
    createWindow();
    void registerSelf('baseline');
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
