// Exposes a minimal, typed API to the UI. The UI never gets direct Node or file-system access.
import { contextBridge, ipcRenderer, webFrame } from 'electron';
import type { BaselineApi } from '../src/shared/api';

const api: BaselineApi = {
  platform: process.platform,
  isDesktop: true,
  apps: (extra) => ipcRenderer.invoke('suite:apps', extra ?? {}),
  launch: (id, args, extra) => ipcRenderer.invoke('suite:launch', id, args ?? [], extra ?? {}),
  installKind: () => ipcRenderer.invoke('app:install-kind'),
  appStatus: (extra, includeDev, fresh) => ipcRenderer.invoke('apps:status', extra ?? {}, !!includeDev, !!fresh),
  installApp: (id, includeDev) => ipcRenderer.invoke('apps:install', id, !!includeDev),
  onInstallProgress: (cb) => {
    ipcRenderer.on('apps:progress', (_e, p) => cb(p));
  },
  recentFiles: () => ipcRenderer.invoke('files:recent'),
  openFile: (p, extra) => ipcRenderer.invoke('files:open', p, extra ?? {}),
  openFileDialog: () => ipcRenderer.invoke('files:open-dialog'),
  pinFile: (app, p, pinned) => ipcRenderer.invoke('files:pin', app, p, pinned),
  removeFile: (app, p) => ipcRenderer.invoke('files:remove', app, p),
  thumbnail: (p) => ipcRenderer.invoke('files:thumbnail', p),
  showInFolder: (p) => ipcRenderer.send('files:show-in-folder', p),
  loginItem: (value) => ipcRenderer.invoke('app:login-item', value),
  pickExe: (name) => ipcRenderer.invoke('app:pick-exe', name),
  setTitle: (t) => ipcRenderer.send('win:set-title', t),
  setTheme: (t) => ipcRenderer.send('win:set-theme', t),
  openExternal: (url) => ipcRenderer.send('shell:open-external', url),
  onFocus: (cb) => {
    ipcRenderer.on('app:focus', () => cb());
  },
  toggleDevTools: () => ipcRenderer.send('win:devtools'),
  appVersion: () => ipcRenderer.invoke('app:version'),
  setZoomFactor: (f) => webFrame.setZoomFactor(Math.min(2, Math.max(0.5, Number(f) || 1))),
  updates: {
    check: (opts) => ipcRenderer.invoke('updates:check', opts),
    state: () => ipcRenderer.invoke('updates:state'),
    download: () => ipcRenderer.invoke('updates:download'),
    install: () => ipcRenderer.invoke('updates:install'),
    openPage: () => ipcRenderer.invoke('updates:open-page'),
    onState: (cb) => {
      ipcRenderer.on('updates:state', (_e, s) => cb(s));
    },
  },
};

contextBridge.exposeInMainWorld('baseline', api);
