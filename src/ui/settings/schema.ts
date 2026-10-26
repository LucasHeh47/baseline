// Every setting in Baseline. `apply` runs when it changes (and at startup); `refresh` lists the
// parts of the UI that redraw.
import * as L from 'lucide';
import type { App } from '../app';
import { platform } from '../platform';
import { uiOptions } from '../widgets';
import type { SectionDef, SettingDef, SettingOption } from './store';

export const SECTIONS: SectionDef[] = [
  { id: 'appearance', label: 'Appearance', icon: L.Palette, description: 'Theme, colors and size.' },
  { id: 'home', label: 'Home & files', icon: L.House, description: 'What Baseline shows and how files open.' },
  { id: 'apps', label: 'Apps', icon: L.LayoutGrid, description: 'Installing and updating Gridline, Pixelline and Frameline, and where they are.' },
  { id: 'startup', label: 'Startup', icon: L.Power, description: 'Starting Baseline with Windows.' },
  { id: 'updates', label: 'Updates', icon: L.RefreshCw, description: 'Version and automatic updates.' },
];

const opts = (...pairs: [string, string][]): SettingOption[] => pairs.map(([value, label]) => ({ value, label }));

export const ACCENTS: Record<string, [string, string]> = {
  amber: ['#ffb547', '#c9730a'],
  coral: ['#ff8a70', '#d9482b'],
  violet: ['#a98bff', '#7c4dff'],
  blue: ['#4ea1ff', '#1a73e8'],
  green: ['#3fcf8e', '#188038'],
  pink: ['#f472b6', '#c2255c'],
};

/** A row in Settings that picks an app's .exe. */
function appPath(id: 'gridline' | 'pixelline' | 'frameline', name: string): SettingDef {
  return {
    id: `apps.${id}Path`,
    section: 'apps',
    group: name,
    label: `Where ${name} is`,
    description: `Only needed for a portable copy, or one installed somewhere unusual. Leave empty to find ${name} by itself.`,
    type: 'text',
    default: '',
    keywords: 'exe location portable path',
    refresh: ['live'],
  };
}

export const SETTINGS: SettingDef[] = [
  // ---------- Appearance ----------
  { id: 'appearance.theme', section: 'appearance', group: 'Theme', label: 'Theme', description: '"Match Windows" follows your system setting.', type: 'select', default: 'dark', options: opts(['dark', 'Dark'], ['light', 'Light'], ['system', 'Match Windows']), refresh: ['theme'], keywords: 'dark mode light mode' },
  { id: 'appearance.accent', section: 'appearance', group: 'Theme', label: 'Accent color', type: 'select', default: 'amber', options: Object.keys(ACCENTS).map((k) => ({ value: k, label: k[0].toUpperCase() + k.slice(1) })), refresh: ['theme'] },
  { id: 'appearance.uiZoom', section: 'appearance', group: 'Layout', label: 'Interface size', type: 'number', default: 100, min: 80, max: 150, step: 10, unit: '%', desktopOnly: true, apply: (v: number) => platform.setZoomFactor(v / 100), keywords: 'zoom scale bigger smaller' },
  { id: 'appearance.reduceMotion', section: 'appearance', group: 'Layout', label: 'Reduce motion', type: 'toggle', default: false, refresh: ['chrome'], keywords: 'animation accessibility' },
  { id: 'appearance.tooltips', section: 'appearance', group: 'Tooltips & messages', label: 'Tooltips', type: 'toggle', default: true, apply: (v: boolean) => (uiOptions.tooltips = v) },
  { id: 'appearance.toastSeconds', section: 'appearance', group: 'Tooltips & messages', label: 'How long messages stay on screen', type: 'number', default: 4.5, min: 2, max: 20, step: 0.5, unit: 'seconds', apply: (v: number) => (uiOptions.toastMs = v * 1000) },

  // ---------- Home & files ----------
  { id: 'home.start', section: 'home', group: 'When Baseline opens', label: 'Show', type: 'select', default: 'home', options: opts(['home', 'Home'], ['files', 'Files'], ['create', 'Create']), keywords: 'start page' },
  { id: 'home.recentCount', section: 'home', group: 'Home', label: 'Recent files on Home', type: 'number', default: 12, min: 4, max: 50, step: 1, refresh: ['live'] },
  { id: 'home.thumbnails', section: 'home', group: 'Home', label: 'Show pictures of files', description: 'Images show a small preview; other files show their icon.', type: 'toggle', default: true, refresh: ['live'], keywords: 'thumbnails previews' },
  { id: 'home.featured', section: 'home', group: 'Home', label: 'Quick start tiles', type: 'select', default: 'both', options: opts(['both', 'Everything'], ['gridline', 'Spreadsheets'], ['pixelline', 'Images'], ['frameline', 'Videos']), refresh: ['live'] },

  // ---------- Apps ----------
  { id: 'apps.installMissing', section: 'apps', group: 'Installing & updating', label: 'Install the apps when Baseline is set up', description: 'The first time an installed Baseline starts, it installs the apps this computer doesn’t have yet.', type: 'toggle', default: true, desktopOnly: true, keywords: 'setup first run download' },
  { id: 'apps.checkUpdates', section: 'apps', group: 'Installing & updating', label: 'Check the apps for updates', description: 'When Baseline starts, and every few hours while it’s open.', type: 'toggle', default: true, desktopOnly: true, keywords: 'version new' },
  { id: 'apps.autoUpdate', section: 'apps', group: 'Installing & updating', label: 'Update the apps automatically', description: 'Installs updates in the background while the app is closed. Otherwise Home asks first.', type: 'toggle', default: false, desktopOnly: true, keywords: 'background silent' },
  { id: 'apps.devBuilds', section: 'apps', group: 'Installing & updating', label: 'Development builds of the apps', description: 'Install and update Gridline, Pixelline and Frameline to their newest development builds. They have the newest features first, but may have bugs.', type: 'toggle', default: false, desktopOnly: true, keywords: 'beta preview pre-release developer branch', apply: (_v: boolean, app: App) => app.installs?.devBuildsChanged() },
  { id: 'apps.checkNow', section: 'apps', group: 'Installing & updating', label: 'Check for app updates now', type: 'action', desktopOnly: true, action: { label: 'Check now', run: (app) => app.installs.checkNow() } },
  appPath('gridline', 'Gridline'),
  { id: 'apps.gridlineChoose', section: 'apps', group: 'Gridline', label: 'Find Gridline.exe', type: 'action', desktopOnly: true, action: { label: 'Choose…', run: async (app) => {
    const p = await platform.pickExe('Gridline');
    if (p) app.settings.set('apps.gridlinePath', p);
  } } },
  appPath('pixelline', 'Pixelline'),
  { id: 'apps.pixellineChoose', section: 'apps', group: 'Pixelline', label: 'Find Pixelline.exe', type: 'action', desktopOnly: true, action: { label: 'Choose…', run: async (app) => {
    const p = await platform.pickExe('Pixelline');
    if (p) app.settings.set('apps.pixellinePath', p);
  } } },
  appPath('frameline', 'Frameline'),
  { id: 'apps.framelineChoose', section: 'apps', group: 'Frameline', label: 'Find Frameline.exe', type: 'action', desktopOnly: true, action: { label: 'Choose…', run: async (app) => {
    const p = await platform.pickExe('Frameline');
    if (p) app.settings.set('apps.framelinePath', p);
  } } },

  // ---------- Startup ----------
  { id: 'startup.withWindows', section: 'startup', group: 'Startup', label: 'Start Baseline when you sign in to Windows', description: 'It opens to Home, ready to open your apps and files.', type: 'toggle', default: false, desktopOnly: true, apply: (v: boolean) => void platform.loginItem(v), keywords: 'login boot autostart' },

  // ---------- Updates ----------
  { id: 'updates.version', section: 'updates', group: 'Version', label: 'Installed version', type: 'info', info: async () => {
    const v = await platform.appVersion();
    return v.includes('-') ? `Baseline ${v} (development build)` : `Baseline ${v}`;
  } },
  { id: 'updates.check', section: 'updates', group: 'Version', label: 'Check for a newer version', type: 'action', desktopOnly: true, action: { label: 'Check now', run: (app) => app.updates.check(false) } },
  { id: 'updates.whatsNew', section: 'updates', group: 'Version', label: "What's new in this version", type: 'action', action: { label: 'Show', run: (app) => app.updates.showWhatsNew() } },
  { id: 'updates.onStartup', section: 'updates', group: 'Automatic updates', label: 'Check for updates when Baseline starts', type: 'toggle', default: true, desktopOnly: true },
  { id: 'updates.autoDownload', section: 'updates', group: 'Automatic updates', label: 'Download updates in the background', description: "You're still asked before anything is installed.", type: 'toggle', default: false, desktopOnly: true },
  { id: 'updates.devBranch', section: 'updates', group: 'Automatic updates', label: 'Developer branch', description: 'Get development builds of Baseline as soon as they are made. They have the newest features first, but may have bugs.', type: 'toggle', default: false, desktopOnly: true, keywords: 'beta preview development pre-release channel', apply: (v: boolean, app: App) => app.updates?.devBranchChanged(v) },
  { id: 'updates.showNotes', section: 'updates', group: 'Automatic updates', label: "Show what's new after updating", type: 'toggle', default: true },
];
