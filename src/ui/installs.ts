// Installing the apps from Baseline and keeping them up to date: setting them up the
// first time an installed Baseline starts, checking for updates every few hours, and the progress
// shown on Home and Apps. The desktop shell does the downloading and installing.
import * as L from 'lucide';
import type { AppStatus, InstallProgress } from '../shared/api';
import { APP_NAMES, type ManagedApp } from '../shared/releases';
import type { App } from './app';
import { APP_INFO, appMark } from './catalog';
import { h, icon } from './dom';
import { isDesktop, platform } from './platform';
import { dialog, toast } from './widgets';

const SETUP_KEY = 'baseline.appsSetUp';
const CHANNEL_KEY = 'baseline.appsChannelSet';
const CHECK_EVERY = 6 * 3_600_000;
const IDS: ManagedApp[] = ['gridline', 'pixelline', 'frameline', 'beatline'];

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Without storage the setup note just shows again next time
  }
}

const names = (ids: ManagedApp[]) => ids.map((id) => APP_NAMES[id]).join(' and ');

export class Installs {
  private status = new Map<ManagedApp, AppStatus>();
  private progress = new Map<ManagedApp, InstallProgress>();
  private errors = new Map<ManagedApp, string>();
  /** Apps waiting to be installed; the first one is being installed. One installer runs at a time. */
  private queue: ManagedApp[] = [];
  /** Installed in this round (shown as done until the round ends). */
  private done = new Set<ManagedApp>();
  /** Apps in the queue that are already installed (so they're being updated). */
  private updating = new Set<ManagedApp>();
  private working = false;
  /** Baseline is setting the apps up by itself (the first start of an installed copy). */
  private settingUp = false;
  /** "Later" on the update note hides it until Baseline starts again. */
  private later = false;
  private started = false;
  checking = false;
  checkedAt = 0;

  constructor(private owner: App) {
    platform.onInstallProgress((p) => this.onProgress(p));
  }

  /** The first-run setup happened (or was turned down). */
  get setUp(): boolean {
    return stored(SETUP_KEY) === '1';
  }

  private get dev(): boolean {
    return this.owner.settings.bool('apps.devBuilds');
  }

  /** Called once the window is ready and the apps were looked for. */
  async startup(): Promise<void> {
    // A development build of Baseline sets the apps up with their development builds too (once:
    // the setting can be turned off again)
    if (isDesktop && !this.setUp && stored(CHANNEL_KEY) === null && (await platform.appVersion()).includes('-')) this.owner.settings.set('apps.devBuilds', true);
    store(CHANNEL_KEY, '1');
    this.started = true;
    if (this.owner.settings.bool('apps.checkUpdates') || !isDesktop) await this.check();
    if (!isDesktop) return;
    const missing = this.missing();
    if (!this.setUp && !missing.length) store(SETUP_KEY, '1');
    else if (!this.setUp && (await platform.installKind()) === 'installed' && this.owner.settings.bool('apps.installMissing')) {
      this.settingUp = true;
      await this.install(missing);
    }
    await this.autoUpdate();
    window.setInterval(() => void this.periodic(), CHECK_EVERY);
  }

  private async periodic(): Promise<void> {
    if (!this.owner.settings.bool('apps.checkUpdates')) return;
    await this.check();
    await this.autoUpdate();
  }

  devBuildsChanged(): void {
    if (this.started) void this.check(true);
  }

  // ---------- state ----------

  statusOf(id: ManagedApp): AppStatus | undefined {
    return this.status.get(id);
  }

  errorOf(id: ManagedApp): string | undefined {
    return this.errors.get(id);
  }

  /** Installing, or waiting to be. */
  busy(id: ManagedApp): boolean {
    return this.queue.includes(id);
  }

  missing(): ManagedApp[] {
    return IDS.filter((id) => !this.owner.app(id)?.installed);
  }

  /** Updates an installer can apply (portable copies update themselves). */
  updates(): ManagedApp[] {
    return IDS.filter((id) => {
      const s = this.status.get(id);
      return !!s?.update && !s.portable && !this.busy(id);
    });
  }

  // ---------- checking and installing ----------

  /** Looks up the installed versions and the newest releases. `fresh` asks GitHub again. */
  async check(fresh = false): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    this.owner.render();
    try {
      const list = await platform.appStatus(this.owner.appPaths(), this.dev, fresh);
      for (const s of list) this.status.set(s.id, s);
      this.checkedAt = Date.now();
    } finally {
      this.checking = false;
    }
    this.owner.render();
  }

  /** "Check for updates" from Apps or Settings: says what it found. */
  async checkNow(): Promise<void> {
    await this.check(true);
    const list = IDS.map((id) => this.status.get(id)).filter((s): s is AppStatus => !!s);
    const failed = list.find((s) => s.error);
    const ready = list.filter((s) => s.update);
    const installed = list.filter((s) => s.installed).map((s) => s.id);
    if (failed && !ready.length) toast(`Couldn't check for updates: ${failed.error}`, { kind: 'error' });
    else if (ready.length) toast(`Updates are ready: ${ready.map((s) => `${APP_NAMES[s.id]} ${s.latest?.version}`).join(' and ')}.`);
    else if (!installed.length) toast(`${names(IDS)} aren't installed yet.`);
    else toast(`${names(installed)} ${installed.length === 1 ? 'is' : 'are'} up to date.`, { kind: 'success' });
  }

  private async autoUpdate(): Promise<void> {
    if (!this.owner.settings.bool('apps.autoUpdate')) return;
    const ids = this.updates();
    if (ids.length) await this.install(ids, true);
  }

  /**
   * Installs (or updates) apps one after another. `quiet` updates in the background: nothing is said
   * when one can't be installed right now (it's open, or Baseline is offline); the next check tries again.
   */
  async install(ids: ManagedApp[], quiet = false): Promise<void> {
    for (const id of ids) {
      if (this.queue.includes(id)) continue;
      this.queue.push(id);
      this.errors.delete(id);
      if (this.owner.app(id)?.installed) this.updating.add(id);
    }
    this.later = false;
    this.owner.render();
    // An earlier call is already working through the queue
    if (this.working) return;
    this.working = true;
    while (this.queue.length) {
      const id = this.queue[0];
      const name = APP_NAMES[id];
      this.progress.set(id, { id, phase: 'checking', percent: 0 });
      this.owner.render();
      const r = await platform.installApp(id, this.dev);
      this.progress.delete(id);
      this.queue.shift();
      if (r.ok) {
        this.done.add(id);
        toast(`${name}${r.version ? ` ${r.version}` : ''} is ${this.updating.has(id) ? 'updated' : 'installed'}.`, { kind: 'success' });
      } else if (!quiet) {
        this.errors.set(id, r.error === 'running' ? `${name} is open. Close it, then try again.` : (r.error ?? `${name} couldn't be installed.`));
      }
      // The app list finds it now
      await this.owner.reload();
    }
    this.working = false;
    this.done.clear();
    this.updating.clear();
    if (this.settingUp || !this.setUp) {
      if (!this.missing().length) store(SETUP_KEY, '1');
      this.settingUp = false;
    }
    await this.check();
  }

  private onProgress(p: InstallProgress): void {
    const before = this.progress.get(p.id);
    // It finished already
    if (!before) return;
    this.progress.set(p.id, p);
    if (before.phase !== p.phase) return this.owner.render();
    // Downloading: only the bar moves
    for (const el of document.querySelectorAll<HTMLElement>(`[data-install="${p.id}"]`)) this.fillLine(el, p.id);
  }

  // ---------- what Home and Apps show ----------

  private stateText(id: ManagedApp): string {
    const p = this.progress.get(id);
    if (!p) return 'Waiting…';
    if (p.phase === 'downloading') return `Downloading${p.version ? ` ${p.version}` : ''}… ${p.percent}%`;
    if (p.phase === 'installing') return 'Installing…';
    if (p.phase === 'done') return 'Finishing…';
    if (p.phase === 'error') return 'Stopping…';
    return 'Getting ready…';
  }

  /** A progress bar with its words, kept up to date while the app downloads. */
  progressLine(id: ManagedApp): HTMLElement {
    const el = h('div', { class: 'install-line', 'data-install': id });
    this.fillLine(el, id);
    return el;
  }

  private fillLine(el: HTMLElement, id: ManagedApp): void {
    const p = this.progress.get(id);
    const moving = !p || p.phase === 'checking' || p.phase === 'installing';
    el.replaceChildren(
      h('span', { class: 'install-state' }, this.stateText(id)),
      h('div', { class: `install-bar${moving && p ? ' busy' : ''}` }, h('span', { style: { width: `${p?.phase === 'downloading' ? p.percent : moving ? 0 : 100}%` } })),
    );
  }

  /** Home: the apps being set up or updated, apps that aren't installed yet, or updates that are ready. */
  homeCard(): HTMLElement | null {
    const missing = this.setUp ? [] : this.missing();
    const rows = IDS.filter((id) => this.busy(id) || this.errors.has(id) || this.done.has(id) || missing.includes(id));
    if (rows.length) return this.installCard(rows, missing);
    const ups = this.updates();
    if (!ups.length || this.later) return null;
    const list = ups.map((id) => `${APP_NAMES[id]} ${this.status.get(id)?.current} → ${this.status.get(id)?.latest?.version}`).join(' · ');
    return h(
      'section',
      { class: 'install-card update' },
      h('span', { class: 'install-badge' }, icon(L.RefreshCw, 18)),
      h('div', { class: 'install-what' }, h('h2', null, ups.length === 1 ? 'An update is ready' : 'Updates are ready'), h('div', { class: 'install-sub' }, list)),
      h('div', { class: 'spacer' }),
      h('button', { class: 'btn text', onclick: () => void this.showNotes(ups) }, "What's new"),
      h('button', { class: 'btn text', onclick: () => {
        this.later = true;
        this.owner.render();
      } }, 'Later'),
      h('button', { class: 'btn primary', onclick: () => void this.install(ups) }, icon(L.Download, 15), ups.length === 1 ? 'Update' : 'Update all'),
    );
  }

  private installCard(rows: ManagedApp[], missing: ManagedApp[]): HTMLElement {
    const working = this.queue.length > 0;
    const title = working
      ? this.settingUp
        ? 'Setting up your apps'
        : rows.every((id) => this.updating.has(id))
          ? 'Updating your apps'
          : 'Installing your apps'
      : missing.length
        ? `Get ${names(missing)}`
        : 'Your apps';
    const text = working
      ? 'This takes a minute or two. Keep using Baseline meanwhile.'
      : missing.length
        ? `Baseline downloads ${missing.length === 1 ? 'it' : 'them'} from the release page and installs ${missing.length === 1 ? 'it' : 'them'} for you. Free, and no admin rights needed.`
        : '';
    const card = h(
      'section',
      { class: 'install-card' },
      h('div', { class: 'install-head' }, h('span', { class: 'install-badge' }, icon(working ? L.Download : L.LayoutGrid, 18)), h('div', null, h('h2', null, title), text ? h('div', { class: 'install-sub' }, text) : null)),
      h('div', { class: 'install-rows' }, ...rows.map((id) => this.installRow(id))),
    );
    const failed = rows.filter((id) => this.errors.has(id));
    const foot: HTMLElement[] = [];
    if (!working && missing.length) {
      foot.push(h('button', { class: 'btn primary', onclick: () => void this.install(missing) }, icon(L.Download, 15), missing.length === 1 ? `Install ${APP_NAMES[missing[0]]}` : missing.length === 2 ? 'Install both' : 'Install all'));
      foot.push(h('button', { class: 'btn text', onclick: () => {
        store(SETUP_KEY, '1');
        this.errors.clear();
        this.owner.render();
        toast('You can install them any time from Apps.');
      } }, 'Not now'));
    } else if (!working && failed.length) {
      foot.push(h('button', { class: 'btn text', onclick: () => {
        this.errors.clear();
        this.owner.render();
      } }, 'Dismiss'));
    }
    if (foot.length) card.append(h('div', { class: 'install-foot' }, ...foot));
    return card;
  }

  private installRow(id: ManagedApp): HTMLElement {
    const info = APP_INFO[id];
    const s = this.status.get(id);
    const err = this.errors.get(id);
    let right: HTMLElement;
    if (this.busy(id)) right = this.progressLine(id);
    else if (err) right = h('div', { class: 'install-error' }, icon(L.CircleAlert, 14), h('span', null, err), h('button', { class: 'btn outline small', onclick: () => void this.install([id]) }, 'Try again'));
    else if (this.done.has(id)) right = h('div', { class: 'install-done' }, icon(L.CircleCheck, 15), 'Ready');
    else right = h('button', { class: 'btn outline small', onclick: () => void this.install([id]) }, icon(L.Download, 13), 'Install');
    const sub = s?.latest && !this.owner.app(id)?.installed ? `${info.tagline} · ${s.latest.version}${s.latest.size ? `, ${Math.round(s.latest.size / 1048576)} MB` : ''}` : info.tagline;
    return h('div', { class: 'install-row' }, appMark(id, 16), h('div', { class: 'install-what' }, h('div', { class: 'install-name' }, info.name), h('div', { class: 'install-sub' }, sub)), h('div', { class: 'install-right' }, right));
  }

  /** The release notes of the updates, from their release pages. */
  async showNotes(ids: ManagedApp[]): Promise<void> {
    const body = h('div', { class: 'install-notes' });
    for (const id of ids) {
      const s = this.status.get(id);
      if (!s?.latest) continue;
      const notes = s.latest.notes
        .replace(/\r/g, '')
        .replace(/^#+\s*/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .trim();
      body.append(h('h3', null, `${APP_NAMES[id]} ${s.latest.version}`), h('p', null, notes || 'No notes for this version.'));
    }
    const v = await dialog<'update' | 'close'>("What's new", body, [
      { label: ids.length === 1 ? 'Update' : 'Update all', value: 'update', primary: true },
      { label: 'Close', value: 'close' },
    ], { cancelValue: 'close' });
    if (v === 'update') await this.install(ids);
  }
}
