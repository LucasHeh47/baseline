// Installing and updating Gridline and Pixelline from their GitHub releases: find the newest
// release, download its installer, and run it silently (per-user, no admin rights needed).
import { app } from 'electron';
import { execFile, spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AppRelease } from '../src/shared/api';
import { APP_NAMES, OWNER, pickRelease, trustedUrl, type GitHubRelease, type ManagedApp } from '../src/shared/releases';

const api = (p: string) => `https://api.github.com/repos/${OWNER}/${p}`;
const HEADERS = { Accept: 'application/vnd.github+json', 'User-Agent': 'Baseline' };

/** Releases change rarely: one look every 15 minutes is plenty (GitHub limits how often it's asked). */
const CACHE_MS = 15 * 60_000;
const cache = new Map<string, { at: number; rel: AppRelease | null }>();

/** The release to install for an app (see pickRelease). `fresh` skips the cache. */
export async function latestRelease(id: ManagedApp, includeDev: boolean, fresh = false): Promise<AppRelease | null> {
  const key = `${id}:${includeDev}`;
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.rel;
  const stableRes = await fetch(api(`${id}/releases/latest`), { headers: HEADERS });
  if (!stableRes.ok && stableRes.status !== 404) throw new Error(`GitHub answered ${stableRes.status}.`);
  const stable = stableRes.ok ? ((await stableRes.json()) as GitHubRelease) : null;
  let recent: GitHubRelease[] = [];
  // Development builds are only looked up when they're wanted, or there's no regular release yet
  if (includeDev || !stable) {
    const res = await fetch(api(`${id}/releases?per_page=10`), { headers: HEADERS });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}.`);
    recent = (await res.json()) as GitHubRelease[];
  }
  const rel = pickRelease(stable, recent, includeDev);
  cache.set(key, { at: Date.now(), rel });
  return rel;
}

const versions = new Map<string, string | null>();

/** The version of an installed program, from its file's version information. */
export async function exeVersion(exe: string): Promise<string | null> {
  const st = await fs.stat(exe).catch(() => null);
  if (!st) return null;
  // Reading it takes PowerShell a moment, so it's remembered until the file changes
  const key = `${exe}|${st.mtimeMs}`;
  if (versions.has(key)) return versions.get(key)!;
  const v = await new Promise<string | null>((resolve) => {
    // The apps' file version is the full one (1.0.6-beta.13); the product version is only numbers (1.0.6.0)
    const script = `$v = (Get-Item -LiteralPath $env:BASELINE_EXE).VersionInfo; if ($v.FileVersion) { $v.FileVersion } else { $v.ProductVersion }`;
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, BASELINE_EXE: exe }, windowsHide: true, timeout: 15000 }, (err, out) => {
      const text = String(out ?? '').trim().replace(/^(\d+\.\d+\.\d+)\.\d+$/, '$1');
      resolve(!err && /^\d+\.\d+\.\d+/.test(text) ? text : null);
    });
  });
  versions.set(key, v);
  return v;
}

/** Installed by an installer (so a newer installer can update it), not a portable copy. */
export function installedCopy(exe: string, name: string): boolean {
  return existsSync(path.join(path.dirname(exe), `Uninstall ${name}.exe`));
}

/** Whether an app is running (its installer can't replace it then). */
export function isRunning(exeName: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile('tasklist.exe', ['/FI', `IMAGENAME eq ${exeName}`, '/NH', '/FO', 'CSV'], { windowsHide: true, timeout: 10000 }, (err, out) => {
      resolve(!err && String(out).toLowerCase().includes(`"${exeName.toLowerCase()}"`));
    });
  });
}

/** Downloads an installer into Baseline's temporary folder, reporting progress 0–1. */
export async function download(id: ManagedApp, rel: AppRelease, onProgress: (p: number) => void): Promise<string> {
  if (!trustedUrl(id, rel.url)) throw new Error('That download isn’t from the app’s release page.');
  const dir = path.join(app.getPath('temp'), 'baseline-installers');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${APP_NAMES[id]}-Setup-${rel.version.replace(/[^\w.-]/g, '')}.exe`);
  const res = await fetch(rel.url, { headers: { 'User-Agent': 'Baseline' } });
  if (!res.ok || !res.body) throw new Error(`The download failed (${res.status}).`);
  const total = Number(res.headers.get('content-length')) || rel.size || 0;
  const out = createWriteStream(file);
  let got = 0;
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (!out.write(value)) await new Promise((r) => out.once('drain', r));
      if (total) onProgress(Math.min(1, got / total));
    }
  } finally {
    await new Promise((r) => out.end(r));
  }
  if (total && got < total) {
    await fs.rm(file, { force: true });
    throw new Error('The download stopped before it finished.');
  }
  return file;
}

/** Runs an installer silently and waits for it. Resolves with whether it succeeded. */
export function runInstaller(file: string): Promise<boolean> {
  // Tests check everything up to here without installing anything
  if (process.env.BASELINE_INSTALL_DRYRUN) return new Promise((r) => setTimeout(() => r(true), 1500));
  return new Promise((resolve) => {
    // The apps' installers install for the current user, without questions, with /S
    const child = spawn(file, ['/S'], { windowsHide: true, stdio: 'ignore' });
    child.on('error', () => resolve(false));
    child.on('exit', (code) => resolve(code === 0));
  });
}
