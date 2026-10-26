// The Baseline window: Home (start something, recent files), Create (every blank file and preset),
// Files (everything Gridline and Pixelline opened recently), Apps, and Settings.
import * as L from 'lucide';
import type { AppPaths, SuiteApp, SuiteAppId, SuiteFile } from '../shared/api';
import { folderOf, matchesQuery, orderFiles } from '../shared/suiteFiles';
import { APP_INFO, BLANK_IMAGE, BLANK_SHEET, STARTERS, type Starter } from './catalog';
import { h, icon, kbd } from './dom';
import { isDesktop, platform } from './platform';
import { SettingsView } from './settings/SettingsView';
import { ACCENTS, SETTINGS } from './settings/schema';
import { Settings, type Refresh } from './settings/store';
import { Updates } from './updates';
import { closePopovers, dialog, showMenu, toast, tooltip } from './widgets';

export type Section = 'home' | 'create' | 'files' | 'apps';
type FileFilter = 'all' | 'gridline' | 'pixelline' | 'pinned';

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, amt: number): string {
  const to = amt < 0 ? 0 : 255;
  const a = Math.abs(amt);
  return '#' + hexToRgb(hex).map((c) => Math.round(c + (to - c) * a).toString(16).padStart(2, '0')).join('');
}

export function relativeTime(ms: number): string {
  const d = new Date(ms);
  const now = new Date();
  const mins = Math.round((now.getTime() - ms) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return `Yesterday, ${time}`;
  const days = (now.getTime() - ms) / 86400000;
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

function greeting(): string {
  const hr = new Date().getHours();
  return hr < 5 ? 'Good evening' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
}

/** The square, colored mark of an app. */
export function appMark(id: SuiteAppId, size = 18): HTMLElement {
  const info = APP_INFO[id];
  const el = h('span', { class: 'app-mark' }, icon(info.icon, size));
  el.style.background = `linear-gradient(135deg, ${info.colors[0]}, ${info.colors[1]})`;
  return el;
}

export class App {
  readonly settings = new Settings(SETTINGS);
  readonly updates: Updates;
  /** Updates show their progress here (a small line at the bottom of the rail). */
  readonly statusbar: { flash(text: string): void; setProgress(label: string | null, percent: number): void };
  private section: Section;
  private main: HTMLElement;
  private nav: HTMLElement;
  private status: HTMLElement;
  private search: HTMLInputElement;
  private files: SuiteFile[] = [];
  private apps: SuiteApp[] = [];
  private filter: FileFilter = 'all';
  private query = '';
  private thumbs = new Map<string, string | null>();
  private settingsView: SettingsView | null = null;
  private systemDark = matchMedia('(prefers-color-scheme: dark)');

  constructor(root: HTMLElement) {
    this.status = h('div', { class: 'rail-status' });
    this.statusbar = {
      flash: (text) => {
        this.status.textContent = text;
        setTimeout(() => {
          if (this.status.textContent === text) this.status.textContent = '';
        }, 3500);
      },
      setProgress: (label, percent) => {
        this.status.textContent = label === null ? '' : `${label} ${Math.round(percent)}%`;
      },
    };
    this.updates = new Updates(this);
    this.section = (['home', 'files', 'create'].includes(this.settings.str('home.start')) ? this.settings.str('home.start') : 'home') as Section;
    this.nav = h('nav', { class: 'rail-nav' });
    this.main = h('main', { class: 'bl-main' });
    this.search = h('input', { class: 'bl-search-input', type: 'search', placeholder: 'Search your files and things to make', spellcheck: false, 'aria-label': 'Search' }) as HTMLInputElement;
    this.search.addEventListener('input', () => {
      this.query = this.search.value.trim();
      if (this.query && this.section !== 'files' && this.section !== 'home') this.section = 'home';
      this.render();
    });
    this.search.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.search.value = '';
        this.query = '';
        this.render();
      } else if (e.key === 'Enter') {
        // Enter opens the first file found
        const first = this.visibleFiles()[0];
        if (first) void this.openFile(first);
      }
    });
    const settingsBtn = h('button', { class: 'btn', 'aria-label': 'Settings', onclick: () => this.openSettings() }, icon(L.Settings, 16));
    tooltip(settingsBtn, 'Settings', 'Ctrl+,');
    const themeBtn = h('button', { class: 'btn', 'aria-label': 'Switch light / dark theme', onclick: () => this.settings.set('appearance.theme', this.isDark ? 'light' : 'dark') });
    tooltip(themeBtn, 'Switch light / dark theme');
    const titlebar = h(
      'header',
      { class: 'titlebar' },
      h('div', { class: 'brand' }, appMark('baseline', 14), 'Baseline'),
      h('div', { class: 'spacer' }),
      h('label', { class: 'bl-search' }, icon(L.Search, 15), this.search, kbd('Ctrl+K')),
      h('div', { class: 'spacer' }),
      settingsBtn,
      themeBtn,
      isDesktop && platform.platform !== 'darwin' ? h('div', { class: 'controls-gap' }) : null,
    );
    this.themeBtn = themeBtn;
    root.append(titlebar, h('div', { class: 'bl-body' }, h('aside', { class: 'bl-rail' }, this.nav, h('div', { class: 'spacer' }), this.status), this.main));

    for (const d of this.settings.defs) if (d.apply) d.apply(this.settings.get(d.id) as never, this);
    this.settings.onChange((id) => this.onSettingChanged(id));
    this.systemDark.addEventListener('change', () => this.applyTheme());
    this.applyTheme();
    this.applyChrome();
    window.addEventListener('keydown', (e) => this.onKey(e));
    // The other apps change their lists: catch up when Baseline is looked at again
    platform.onFocus(() => void this.reload());
    window.setInterval(() => {
      if (document.visibilityState === 'visible') void this.reload();
    }, 60_000);
    this.renderNav();
    this.render();
    void this.reload();
    void this.updates.startup();
  }

  private themeBtn: HTMLElement;

  // ---------- data ----------

  /** Custom app locations from Settings. */
  appPaths(): AppPaths {
    const out: AppPaths = {};
    const g = this.settings.str('apps.gridlinePath');
    const p = this.settings.str('apps.pixellinePath');
    if (g) out.gridline = g;
    if (p) out.pixelline = p;
    return out;
  }

  async reload(): Promise<void> {
    const [files, apps] = await Promise.all([platform.recentFiles(), platform.apps(this.appPaths())]);
    const before = JSON.stringify([this.files, this.apps]);
    this.files = files;
    this.apps = apps;
    if (JSON.stringify([files, apps]) !== before) this.render();
  }

  private app(id: SuiteAppId): SuiteApp | undefined {
    return this.apps.find((a) => a.id === id);
  }

  private visibleFiles(limit?: number): SuiteFile[] {
    let list = this.files;
    if (this.filter === 'pinned') list = list.filter((f) => f.pinned);
    else if (this.filter !== 'all') list = list.filter((f) => f.app === this.filter);
    if (this.query) list = list.filter((f) => matchesQuery(f, this.query));
    list = orderFiles(list);
    return limit ? list.slice(0, limit) : list;
  }

  // ---------- actions ----------

  /** Starts something new in an app. */
  async start(s: Starter): Promise<void> {
    const a = this.app(s.app);
    if (!a?.installed) return this.notInstalled(s.app);
    const ok = await platform.launch(s.app, s.args, this.appPaths());
    if (ok) toast(`Opening ${APP_INFO[s.app].name}: ${s.name}…`);
    else this.notInstalled(s.app);
  }

  async openFile(f: { path: string; name: string; app?: SuiteAppId }): Promise<void> {
    const r = await platform.openFile(f.path, this.appPaths());
    if (r.ok) toast(`Opening ${f.name} in ${APP_INFO[r.app ?? 'gridline'].name}…`);
    else if (r.error === 'not-installed' && r.app) this.notInstalled(r.app);
    else toast(r.error ?? `Couldn't open ${f.name}.`, { kind: 'error' });
  }

  async openFromDisk(): Promise<void> {
    const paths = await platform.openFileDialog();
    for (const p of paths) await this.openFile({ path: p, name: p.split(/[\\/]/).pop() ?? p });
  }

  private notInstalled(id: SuiteAppId): void {
    const info = APP_INFO[id];
    const a = this.app(id);
    void dialog<'get' | 'find' | 'cancel'>(
      `${info.name} isn't installed`,
      `${info.name} opens ${info.noun}s. Download it (it's free), or tell Baseline where your copy is if you use the portable version.`,
      [
        { label: `Download ${info.name}`, value: 'get', primary: true },
        { label: 'Find my copy…', value: 'find' },
        { label: 'Cancel', value: 'cancel' },
      ],
      { cancelValue: 'cancel' },
    ).then(async (v) => {
      if (v === 'get') platform.openExternal(a?.download ?? `https://github.com/LucasHeh47/${id}/releases`);
      else if (v === 'find') {
        const p = await platform.pickExe(info.name);
        if (p) {
          this.settings.set(`apps.${id}Path`, p);
          await this.reload();
          toast(`Baseline will use ${info.name} from ${p}.`, { kind: 'success' });
        }
      }
    });
  }

  private async togglePin(f: SuiteFile): Promise<void> {
    await platform.pinFile(f.app, f.path, !f.pinned);
    f.pinned = !f.pinned;
    this.render();
  }

  private async forget(f: SuiteFile): Promise<void> {
    await platform.removeFile(f.app, f.path);
    this.files = this.files.filter((x) => x !== f);
    this.render();
  }

  // ---------- theme and settings ----------

  get isDark(): boolean {
    const t = this.settings.str('appearance.theme');
    return t === 'system' ? this.systemDark.matches : t === 'dark';
  }

  applyTheme(): void {
    const root = document.documentElement;
    const dark = this.isDark;
    root.dataset.theme = dark ? 'dark' : 'light';
    const pair = ACCENTS[this.settings.str('appearance.accent')] ?? ACCENTS.amber;
    const a = dark ? pair[0] : pair[1];
    const [r, g, b] = hexToRgb(a);
    root.style.setProperty('--accent', a);
    root.style.setProperty('--accent-strong', shade(a, dark ? -0.15 : -0.2));
    root.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, ${dark ? 0.16 : 0.12})`);
    root.style.setProperty('--accent-text', dark ? '#1f1300' : '#ffffff');
    platform.setTheme({ dark, bar: dark ? '#16181d' : '#f6f7f9', symbol: dark ? '#c9ced8' : '#3c4350' });
    this.themeBtn?.replaceChildren(icon(dark ? L.Sun : L.Moon, 16));
  }

  applyChrome(): void {
    document.documentElement.classList.toggle('reduce-motion', this.settings.bool('appearance.reduceMotion'));
    document.documentElement.classList.toggle('is-desktop', isDesktop);
  }

  private onSettingChanged(id: string): void {
    const d = this.settings.byId.get(id);
    if (!d) return;
    d.apply?.(this.settings.get(id) as never, this);
    const r = new Set<Refresh>(d.refresh ?? []);
    if (r.has('theme')) this.applyTheme();
    if (r.has('chrome')) this.applyChrome();
    if (r.has('live')) void this.reload().then(() => this.render());
  }

  savePrefs(): void {
    // Baseline keeps no preferences besides its settings
  }

  async saveBeforeQuit(): Promise<boolean> {
    return true;
  }

  openSettings(section?: string): void {
    closePopovers();
    if (this.settingsView) {
      this.settingsView.show(section);
      return;
    }
    this.settingsView = new SettingsView(this, section, () => {
      this.settingsView = null;
    });
    document.body.append(this.settingsView.el);
  }

  private onKey(e: KeyboardEvent): void {
    if (document.querySelector('.modal-backdrop') || this.settingsView) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.search.focus();
      this.search.select();
    } else if (ctrl && e.key === ',') {
      e.preventDefault();
      this.openSettings();
    } else if (ctrl && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      void this.openFromDisk();
    } else if (ctrl && e.altKey && e.key.toLowerCase() === 'i') platform.toggleDevTools();
  }

  // ---------- rendering ----------

  show(section: Section): void {
    this.section = section;
    this.renderNav();
    this.render();
    this.main.scrollTop = 0;
  }

  private renderNav(): void {
    const item = (id: Section, label: string, ic: L.IconNode) => h('button', { class: `rail-item${this.section === id ? ' on' : ''}`, onclick: () => this.show(id) }, icon(ic, 20), h('span', null, label));
    this.nav.replaceChildren(item('home', 'Home', L.House), item('create', 'Create', L.CirclePlus), item('files', 'Files', L.Folder), item('apps', 'Apps', L.LayoutGrid));
  }

  render(): void {
    const scroll = this.main.scrollTop;
    this.main.replaceChildren();
    if (this.query && this.section !== 'files') this.renderSearch();
    else if (this.section === 'home') this.renderHome();
    else if (this.section === 'create') this.renderCreate();
    else if (this.section === 'files') this.renderFiles();
    else this.renderApps();
    this.main.scrollTop = scroll;
    platform.setTitle('Baseline');
  }

  private renderHome(): void {
    const featured = this.settings.str('home.featured');
    const tiles: Starter[] = [];
    if (featured !== 'pixelline') tiles.push(BLANK_SHEET, STARTERS.find((s) => s.id === 'gl-budget')!);
    if (featured !== 'gridline') tiles.push(BLANK_IMAGE, STARTERS.find((s) => s.id === 'px-block-or-item')!, STARTERS.find((s) => s.id === 'px-full-hd')!);
    const missing = this.missingApps();
    this.main.append(
      h('h1', { class: 'bl-h1' }, greeting()),
      h('p', { class: 'bl-sub' }, 'Pick up where you left off, or start something new.'),
      h('div', { class: 'bl-row-head' }, h('h2', null, 'Start something new'), h('button', { class: 'btn text bl-link', onclick: () => this.show('create') }, 'Everything you can make', icon(L.ArrowRight, 14))),
      h('div', { class: 'tile-strip' }, ...tiles.map((s) => this.starterCard(s, true))),
      ...(missing ? [missing] : []),
      this.fileBlock(this.settings.num('home.recentCount')),
    );
  }

  /** A note for apps that aren't installed yet. */
  private missingApps(): HTMLElement | null {
    const missing = this.apps.filter((a) => a.id !== 'baseline' && !a.installed);
    if (!missing.length || !isDesktop) return null;
    return h(
      'div',
      { class: 'bl-note' },
      icon(L.Info, 16),
      h('span', null, `${missing.map((a) => a.name).join(' and ')} ${missing.length === 1 ? "isn't" : "aren't"} installed on this computer yet.`),
      ...missing.map((a) => h('button', { class: 'btn outline small', onclick: () => platform.openExternal(a.download) }, icon(L.Download, 13), `Get ${a.name}`)),
    );
  }

  private renderCreate(): void {
    this.main.append(h('h1', { class: 'bl-h1' }, 'Create'), h('p', { class: 'bl-sub' }, 'Pick a starting point. It opens in the app that makes it.'));
    for (const id of ['gridline', 'pixelline'] as const) {
      const info = APP_INFO[id];
      const list = STARTERS.filter((s) => s.app === id);
      const cats = [...new Set(list.map((s) => s.category))];
      this.main.append(h('div', { class: 'bl-app-head' }, appMark(id, 18), h('div', null, h('h2', null, info.name), h('div', { class: 'hint' }, info.tagline))));
      for (const c of cats) {
        this.main.append(h('h3', { class: 'bl-cat' }, c), h('div', { class: 'tile-grid' }, ...list.filter((s) => s.category === c).map((s) => this.starterCard(s))));
      }
    }
  }

  private renderFiles(): void {
    const open = h('button', { class: 'btn primary', onclick: () => void this.openFromDisk() }, icon(L.FolderOpen, 16), 'Open a file…');
    tooltip(open, 'Spreadsheets open in Gridline, images in Pixelline', 'Ctrl+O');
    this.main.append(h('div', { class: 'bl-row-head' }, h('div', null, h('h1', { class: 'bl-h1' }, 'Files'), h('p', { class: 'bl-sub' }, 'Everything you opened recently in Gridline and Pixelline.')), h('div', { class: 'spacer' }), open), this.fileBlock());
  }

  private renderSearch(): void {
    const q = this.query.toLowerCase();
    const starters = STARTERS.filter((s) => `${s.name} ${s.description} ${s.category} ${APP_INFO[s.app].name}`.toLowerCase().includes(q));
    this.main.append(h('h1', { class: 'bl-h1' }, `Results for “${this.query}”`));
    if (starters.length) this.main.append(h('h2', { class: 'bl-cat' }, 'Make something'), h('div', { class: 'tile-grid' }, ...starters.slice(0, 8).map((s) => this.starterCard(s))));
    this.main.append(this.fileBlock());
  }

  private renderApps(): void {
    this.main.append(h('h1', { class: 'bl-h1' }, 'Apps'), h('p', { class: 'bl-sub' }, 'Your apps. Each one updates itself.'));
    const grid = h('div', { class: 'app-grid' });
    for (const id of ['gridline', 'pixelline', 'baseline'] as const) {
      const a = this.app(id);
      const info = APP_INFO[id];
      const self = id === 'baseline';
      const status = self ? 'You’re here' : a?.installed ? (a.version ? `Version ${a.version}` : 'Installed') : 'Not installed';
      const actions = self
        ? [h('button', { class: 'btn outline', onclick: () => this.openSettings('updates') }, icon(L.RefreshCw, 15), 'Updates')]
        : a?.installed
          ? [
              h('button', { class: 'btn primary', onclick: async () => {
                if (await platform.launch(id, [], this.appPaths())) toast(`Opening ${info.name}…`);
                else this.notInstalled(id);
              } }, 'Open'),
              h('button', { class: 'btn outline', onclick: () => void this.start(id === 'gridline' ? BLANK_SHEET : BLANK_IMAGE) }, icon(L.Plus, 15), `New ${info.noun}`),
            ]
          : [
              h('button', { class: 'btn primary', onclick: () => platform.openExternal(a?.download ?? `https://github.com/LucasHeh47/${id}/releases`) }, icon(L.Download, 15), 'Get it'),
              h('button', { class: 'btn outline', onclick: () => this.notInstalled(id) }, 'I have a copy…'),
            ];
      grid.append(
        h(
          'div',
          { class: 'app-card' },
          h('div', { class: 'app-card-head' }, appMark(id, 26), h('div', null, h('div', { class: 'app-card-name' }, info.name), h('div', { class: `app-card-status${a?.installed || self ? ' ok' : ''}` }, status))),
          h('p', { class: 'app-card-text' }, info.tagline),
          a?.exe && !self ? h('div', { class: 'app-card-path', title: a.exe }, a.exe) : null,
          h('div', { class: 'app-card-actions' }, ...actions),
        ),
      );
    }
    this.main.append(grid);
  }

  private starterCard(s: Starter, big = false): HTMLElement {
    const thumb = h('div', { class: 'tile-thumb' });
    if (s.size) {
      // The canvas's shape, like the New image page in Pixelline
      const [w, hh] = s.size;
      const k = Math.min(56 / w, 56 / hh);
      thumb.append(h('span', { class: `tile-frame${s.args.some((a) => a === '--bg=transparent') ? ' transparent' : ''}`, style: { width: `${Math.max(10, Math.round(w * k))}px`, height: `${Math.max(10, Math.round(hh * k))}px` } }));
    } else {
      const badge = h('span', { class: 'tile-icon' }, icon(s.icon, big ? 26 : 22));
      badge.style.color = s.color;
      thumb.append(badge);
    }
    thumb.append(h('span', { class: 'tile-app' }, appMark(s.app, 12)));
    const card = h(
      'button',
      { class: `tile${big ? ' big' : ''}`, onclick: () => void this.start(s) },
      thumb,
      h('div', { class: 'tile-meta' }, h('div', { class: 'tile-title' }, s.name, s.live ? h('span', { class: 'live-tag' }, 'Live') : null), h('div', { class: 'tile-sub' }, s.size ? `${s.size[0]} × ${s.size[1]} · ${s.description}` : s.description)),
    );
    tooltip(card, `${s.description} Opens in ${APP_INFO[s.app].name}.`);
    return card;
  }

  // ---------- files ----------

  private fileBlock(limit?: number): HTMLElement {
    const chip = (id: FileFilter, label: string) =>
      h('button', { class: `chip${this.filter === id ? ' on' : ''}`, onclick: () => {
        this.filter = id;
        this.render();
      } }, label);
    const counts = { gridline: this.files.filter((f) => f.app === 'gridline').length, pixelline: this.files.filter((f) => f.app === 'pixelline').length, pinned: this.files.filter((f) => f.pinned).length };
    const head = h(
      'div',
      { class: 'bl-row-head' },
      h('h2', null, this.query ? 'Files' : 'Recent'),
      h('div', { class: 'chips' }, chip('all', 'All'), chip('gridline', `Spreadsheets${counts.gridline ? ` (${counts.gridline})` : ''}`), chip('pixelline', `Images${counts.pixelline ? ` (${counts.pixelline})` : ''}`), chip('pinned', `Pinned${counts.pinned ? ` (${counts.pinned})` : ''}`)),
    );
    const list = this.visibleFiles(limit);
    const wrap = h('section', { class: 'bl-files' }, head);
    if (!list.length) {
      const msg = this.query
        ? `No files match “${this.query}”.`
        : this.filter === 'pinned'
          ? 'Pin files you use often and they stay at the top. Point at a file and click the pin.'
          : isDesktop
            ? 'Files you open or save in Gridline and Pixelline show up here.'
            : 'Recent files are listed in the desktop app.';
      wrap.append(h('div', { class: 'bl-empty' }, icon(this.filter === 'pinned' ? L.Pin : L.Clock, 28), h('p', null, msg)));
      return wrap;
    }
    const thumbsOn = this.settings.bool('home.thumbnails');
    const rows = h('div', { class: 'file-list', role: 'list' });
    for (const f of list) rows.append(this.fileRow(f, thumbsOn));
    wrap.append(rows);
    if (limit && this.visibleFiles().length > limit && !this.query) wrap.append(h('button', { class: 'btn text bl-link more-files', onclick: () => this.show('files') }, `All ${this.visibleFiles().length} files`, icon(L.ArrowRight, 14)));
    return wrap;
  }

  private fileRow(f: SuiteFile, thumbsOn: boolean): HTMLElement {
    const ext = (/\.([^.]+)$/.exec(f.name)?.[1] ?? '').toUpperCase();
    const pic = h('span', { class: 'file-pic' });
    if (thumbsOn) this.loadThumb(f.path, pic, ext);
    else pic.append(h('span', { class: 'file-ext' }, ext));
    const pin = h('button', { class: `btn icon-only${f.pinned ? ' on' : ''}`, 'aria-label': f.pinned ? 'Unpin' : 'Pin to the top', onclick: (e: MouseEvent) => {
      e.stopPropagation();
      void this.togglePin(f);
    } }, icon(f.pinned ? L.PinOff : L.Pin, 15));
    tooltip(pin, f.pinned ? 'Unpin' : 'Pin to the top');
    const more = h('button', { class: 'btn icon-only', 'aria-label': 'More', onclick: (e: MouseEvent) => {
      e.stopPropagation();
      showMenu(
        [
          { label: `Open in ${APP_INFO[f.app].name}`, icon: L.ExternalLink, run: () => void this.openFile(f) },
          { label: 'Show in folder', icon: L.FolderSearch, run: () => platform.showInFolder(f.path) },
          { separator: true },
          { label: f.pinned ? 'Unpin' : 'Pin to the top', icon: f.pinned ? L.PinOff : L.Pin, run: () => void this.togglePin(f) },
          { label: 'Remove from the list', icon: L.X, run: () => void this.forget(f) },
        ],
        e.currentTarget as HTMLElement,
      );
    } }, icon(L.Ellipsis, 15));
    const row = h(
      'div',
      { class: 'file-row', role: 'listitem', tabindex: '0', title: f.path },
      pic,
      h('span', { class: 'file-name' }, h('span', { class: 'file-title' }, f.name, f.pinned ? h('span', { class: 'pinned-mark' }, icon(L.Pin, 12)) : null), h('span', { class: 'file-folder' }, folderOf(f.path))),
      h('span', { class: 'file-app' }, appMark(f.app, 12), APP_INFO[f.app].name),
      h('span', { class: 'file-when' }, relativeTime(f.openedAt)),
      h('span', { class: 'file-acts' }, pin, more),
    );
    row.addEventListener('click', () => void this.openFile(f));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void this.openFile(f);
    });
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      (more as HTMLButtonElement).click();
    });
    return row;
  }

  private loadThumb(p: string, el: HTMLElement, ext: string): void {
    const put = (url: string | null) => {
      el.replaceChildren(url ? h('img', { src: url, alt: '', class: /\.(png|gif|bmp)$/i.test(p) ? 'pixelated' : '' }) : h('span', { class: 'file-ext' }, ext));
    };
    if (this.thumbs.has(p)) return put(this.thumbs.get(p) ?? null);
    put(null);
    void platform.thumbnail(p).then((url) => {
      this.thumbs.set(p, url);
      put(url);
    });
  }
}
