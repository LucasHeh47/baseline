// Which app opens which file, and how Baseline lists files (shared by the main process and the UI).
import type { WorkApp } from './api';

/** Files each app opens. */
export const OPENS: Record<WorkApp, RegExp> = {
  gridline: /\.(xlsx|xlsm|csv|tsv)$/i,
  pixelline: /\.(png|jpe?g|webp|gif|bmp|ico|ora|psd)$/i,
  frameline: /\.frameline$/i,
};

export function appFor(path: string): WorkApp | null {
  if (OPENS.gridline.test(path)) return 'gridline';
  if (OPENS.pixelline.test(path)) return 'pixelline';
  if (OPENS.frameline.test(path)) return 'frameline';
  return null;
}

/** Files found by search: every word somewhere in the name or folder (any case). */
export function matchesQuery(f: { name: string; path: string }, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${f.name} ${f.path}`.toLowerCase();
  return words.every((w) => text.includes(w));
}

/** Pinned files first, then the most recently opened. */
export function orderFiles<T extends { pinned: boolean; openedAt: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.openedAt - a.openedAt);
}

/** A short folder for display: the last two folders, or the whole path when it's short. */
export function folderOf(p: string): string {
  const parts = p.split(/[\\/]/);
  parts.pop();
  if (parts.length <= 2) return parts.join('\\');
  return '…\\' + parts.slice(-2).join('\\');
}
