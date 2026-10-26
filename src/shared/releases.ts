// Reading the apps' GitHub releases: comparing versions and picking the installer to download.
// Kept free of Electron so it can be tested.
import type { AppRelease } from './api';

export type ManagedApp = 'gridline' | 'pixelline';

export const OWNER = 'LucasHeh47';
export const APP_NAMES: Record<ManagedApp, string> = { gridline: 'Gridline', pixelline: 'Pixelline' };

/** A release as the GitHub API lists it (only the fields Baseline reads). */
export interface GitHubRelease {
  tag_name: string;
  prerelease: boolean;
  draft: boolean;
  body?: string | null;
  assets: { name: string; browser_download_url: string; size: number }[];
}

/** Compares versions like 1.0.6 and 1.0.6-beta.14 (a beta comes before its release). Positive when a > b. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    const [main, pre] = v.trim().replace(/^v/, '').split('-');
    const nums = main.split('.').map((n) => parseInt(n, 10) || 0);
    const beta = pre ? parseInt(pre.replace(/\D+/g, ''), 10) || 0 : Infinity;
    return { nums, beta };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) if ((x.nums[i] ?? 0) !== (y.nums[i] ?? 0)) return (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
  if (x.beta === y.beta) return 0;
  return x.beta > y.beta ? 1 : -1;
}

/** The installer of a release (not the portable copy), or null when it has none. */
export function toRelease(r: GitHubRelease): AppRelease | null {
  if (r.draft) return null;
  const setup = r.assets.find((a) => /-Setup-[^/]*\.exe$/i.test(a.name));
  return setup ? { version: r.tag_name.replace(/^v/, ''), prerelease: r.prerelease, url: setup.browser_download_url, size: setup.size, notes: r.body ?? '' } : null;
}

/**
 * The release to install: the newest regular release, or the newest development build when they
 * are asked for (or when an app has no regular release yet).
 */
export function pickRelease(stable: GitHubRelease | null, recent: GitHubRelease[], includeDev: boolean): AppRelease | null {
  const regular = stable && !stable.prerelease ? toRelease(stable) : null;
  if (regular && !includeDev) return regular;
  const all = [regular, ...recent.map(toRelease)].filter((r): r is AppRelease => !!r && (includeDev || !regular || !r.prerelease));
  all.sort((a, b) => compareVersions(b.version, a.version));
  return all[0] ?? null;
}

/** Only installers from the apps' own release pages are downloaded. */
export function trustedUrl(id: ManagedApp, url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname === 'github.com' && u.pathname.startsWith(`/${OWNER}/${id}/releases/download/`);
  } catch {
    return false;
  }
}
