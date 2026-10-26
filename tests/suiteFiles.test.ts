import { describe, expect, it } from 'vitest';
import { appFor, folderOf, matchesQuery, orderFiles } from '../src/shared/suiteFiles';

describe('suite files', () => {
  it('knows which app opens a file', () => {
    expect(appFor('C:\\Docs\\Budget.XLSX')).toBe('gridline');
    expect(appFor('data.csv')).toBe('gridline');
    expect(appFor('macros.xlsm')).toBe('gridline');
    expect(appFor('stone.png')).toBe('pixelline');
    expect(appFor('hero.ora')).toBe('pixelline');
    expect(appFor('art.PSD')).toBe('pixelline');
    expect(appFor('notes.txt')).toBeNull();
  });

  it('finds files by every word of a search, in the name or the folder', () => {
    const f = { name: 'stone.png', path: 'C:\\Packs\\Cozy\\textures\\block\\stone.png' };
    expect(matchesQuery(f, 'stone')).toBe(true);
    expect(matchesQuery(f, 'cozy STONE')).toBe(true);
    expect(matchesQuery(f, 'cozy dirt')).toBe(false);
    expect(matchesQuery(f, '   ')).toBe(true);
  });

  it('lists pinned files first, then the most recent', () => {
    const list = orderFiles([
      { name: 'a', pinned: false, openedAt: 3 },
      { name: 'b', pinned: true, openedAt: 1 },
      { name: 'c', pinned: false, openedAt: 5 },
      { name: 'd', pinned: true, openedAt: 2 },
    ]);
    expect(list.map((x) => x.name)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('shortens folders for display', () => {
    expect(folderOf('C:\\Users\\you\\Documents\\Budget.xlsx')).toBe('…\\you\\Documents');
    expect(folderOf('C:\\Budget.xlsx')).toBe('C:');
  });
});
