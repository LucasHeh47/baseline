import { describe, expect, it } from 'vitest';
import { compareVersions, pickRelease, toRelease, trustedUrl, type GitHubRelease } from '../src/shared/releases';

const rel = (tag: string, prerelease: boolean, extra: Partial<GitHubRelease> = {}): GitHubRelease => ({
  tag_name: `v${tag}`,
  prerelease,
  draft: false,
  body: `Notes for ${tag}`,
  assets: [
    { name: `Gridline-Portable-${tag}.exe`, browser_download_url: `https://github.com/LucasHeh47/gridline/releases/download/v${tag}/Gridline-Portable-${tag}.exe`, size: 10 },
    { name: `Gridline-Setup-${tag}.exe`, browser_download_url: `https://github.com/LucasHeh47/gridline/releases/download/v${tag}/Gridline-Setup-${tag}.exe`, size: 20 },
    { name: `Gridline-Setup-${tag}.exe.blockmap`, browser_download_url: 'https://github.com/x', size: 1 },
  ],
  ...extra,
});

describe('app releases', () => {
  it('orders versions, with development builds before their release', () => {
    expect(compareVersions('1.0.5', '1.0.4')).toBeGreaterThan(0);
    expect(compareVersions('1.0.4', '1.0.10')).toBeLessThan(0);
    expect(compareVersions('v1.0.6', '1.0.6')).toBe(0);
    expect(compareVersions('1.0.6-beta.14', '1.0.6')).toBeLessThan(0);
    expect(compareVersions('1.0.6-beta.14', '1.0.6-beta.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.6-beta.1', '1.0.5')).toBeGreaterThan(0);
    expect(compareVersions('0.2.0', '0.2.0-beta.2')).toBeGreaterThan(0);
  });

  it('takes the installer, not the portable copy', () => {
    const r = toRelease(rel('1.0.4', false))!;
    expect(r.version).toBe('1.0.4');
    expect(r.url).toMatch(/Gridline-Setup-1\.0\.4\.exe$/);
    expect(r.size).toBe(20);
    expect(toRelease(rel('1.0.4', false, { draft: true }))).toBeNull();
    expect(toRelease(rel('1.0.4', false, { assets: [] }))).toBeNull();
  });

  it('picks the newest regular release, or development builds when asked', () => {
    const stable = rel('1.0.4', false);
    const recent = [rel('1.0.6-beta.14', true), rel('1.0.6-beta.13', true), rel('1.0.5-beta.9', true)];
    expect(pickRelease(stable, recent, false)?.version).toBe('1.0.4');
    expect(pickRelease(stable, recent, true)?.version).toBe('1.0.6-beta.14');
    // A release made after the development builds wins either way
    expect(pickRelease(rel('1.0.6', false), recent, true)?.version).toBe('1.0.6');
    // No regular release yet: the newest development build
    expect(pickRelease(null, [rel('0.1.0-beta.1', true), rel('0.2.0-beta.2', true)], false)?.version).toBe('0.2.0-beta.2');
    expect(pickRelease(null, [], false)).toBeNull();
  });

  it('only downloads from the app’s own release page', () => {
    expect(trustedUrl('gridline', 'https://github.com/LucasHeh47/gridline/releases/download/v1.0.4/Gridline-Setup-1.0.4.exe')).toBe(true);
    expect(trustedUrl('pixelline', 'https://github.com/LucasHeh47/gridline/releases/download/v1.0.4/Gridline-Setup-1.0.4.exe')).toBe(false);
    expect(trustedUrl('gridline', 'http://github.com/LucasHeh47/gridline/releases/download/v1/x.exe')).toBe(false);
    expect(trustedUrl('gridline', 'https://github.com.evil.example/LucasHeh47/gridline/releases/download/v1/x.exe')).toBe(false);
    expect(trustedUrl('gridline', 'https://github.com/someone/gridline/releases/download/v1/x.exe')).toBe(false);
    expect(trustedUrl('gridline', 'https://github.com/LucasHeh47/gridline/releases/download/../../../evil/x.exe')).toBe(false);
    expect(trustedUrl('gridline', 'not a url')).toBe(false);
  });
});
