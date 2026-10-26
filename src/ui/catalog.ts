// What Baseline can start: blank files and presets in each app, and how to ask the app for them
// (command-line options the apps understand).
import * as L from 'lucide';
import type { SuiteAppId } from '../shared/api';
import { h, icon } from './dom';

export interface Starter {
  id: string;
  app: 'gridline' | 'pixelline' | 'frameline';
  name: string;
  description: string;
  icon: L.IconNode;
  /** Card accent. */
  color: string;
  /** Options passed to the app. */
  args: string[];
  category: string;
  /** Size shown on image and video cards. */
  size?: [number, number];
  /** Downloads live data the first time (Gridline presets). */
  live?: boolean;
  keywords?: string;
}

const sheet = (id: string, name: string, description: string, icon: L.IconNode, category: string, color: string, live = false): Starter => ({ id: `gl-${id}`, app: 'gridline', name, description, icon, color, args: [`--template=${id}`], category, live });

const image = (name: string, w: number, h: number, category: string, bg: 'transparent' | 'white' | 'black', description: string, icon: L.IconNode = L.Image): Starter => ({
  id: `px-${name.toLowerCase().replace(/\W+/g, '-')}`,
  app: 'pixelline',
  name,
  description,
  icon,
  color: '#a98bff',
  args: [`--new=${w}x${h}`, `--bg=${bg}`, `--name=${name.replace(/\s*\(.*\)$/, '')}`],
  category,
  size: [w, h],
});

const video = (name: string, w: number, h: number, fps: number, description: string, icon: L.IconNode = L.Clapperboard): Starter => ({
  id: `fl-${name.toLowerCase().replace(/\W+/g, '-')}`,
  app: 'frameline',
  name,
  description,
  icon,
  color: '#ff5c6c',
  args: [`--new=${w}x${h}`, `--fps=${fps}`, `--name=${name}`],
  category: 'Video',
  size: [w, h],
});

export const BLANK_SHEET: Starter = { id: 'gl-blank', app: 'gridline', name: 'Blank spreadsheet', description: 'An empty workbook', icon: L.Plus, color: '#3fcf8e', args: ['--new'], category: 'Spreadsheets' };

export const BLANK_IMAGE: Starter = image('Blank image', 32, 32, 'Images', 'transparent', 'A transparent canvas (any size in Pixelline)', L.Plus);

export const BLANK_VIDEO: Starter = video('HD video', 1920, 1080, 30, 'YouTube and most cameras (1080p, 30 fps)', L.Plus);

export const STARTERS: Starter[] = [
  BLANK_SHEET,
  sheet('budget', 'Monthly budget', 'Plan income and spending by category; log purchases and the budget totals them.', L.Wallet, 'Personal finance', '#3fcf8e'),
  sheet('loan', 'Loan & mortgage calculator', 'Monthly payment, total interest, payoff date and a payment schedule.', L.House, 'Personal finance', '#ff9f43'),
  sheet('debt', 'Debt payoff planner', 'Pay off cards and loans faster: avalanche versus snowball.', L.TrendingDown, 'Personal finance', '#e8618c'),
  sheet('networth', 'Net worth & savings', 'What you own and owe, a savings goal and long-term growth.', L.PiggyBank, 'Personal finance', '#a78bfa'),
  sheet('stocks', 'Stock portfolio', 'Holdings with live prices, gains, allocation and a watchlist.', L.ChartCandlestick, 'Investing', '#4ea1ff', true),
  sheet('crypto', 'Crypto portfolio', 'Live coin prices, the value of your holdings and the last 7 days.', L.Bitcoin, 'Investing', '#ffd43b', true),
  sheet('nfl', 'NFL team tracker', 'A team’s schedule, results, stats and its division race.', L.Trophy, 'Sports', '#e8618c', true),
  sheet('fantasy', 'Fantasy football', 'Weekly fantasy points for your roster and player comparisons.', L.Medal, 'Sports', '#22b8cf', true),
  sheet('travel', 'Trip planner', 'A trip budget at live exchange rates, the forecast and holidays.', L.Plane, 'Planning', '#22b8cf', true),
  sheet('project', 'Project tracker', 'Tasks with owners, status, priority and due dates.', L.ListChecks, 'Planning', '#94d82d'),
  BLANK_IMAGE,
  image('Block or item', 16, 16, 'Minecraft', 'transparent', 'A vanilla-size texture', L.Box),
  image('Block or item (32×)', 32, 32, 'Minecraft', 'transparent', 'For 2× resource packs', L.Box),
  image('Block or item (64×)', 64, 64, 'Minecraft', 'transparent', 'For 4× resource packs', L.Box),
  image('Player skin', 64, 64, 'Minecraft', 'transparent', 'Classic and slim skins', L.User),
  image('Pack icon', 128, 128, 'Minecraft', 'transparent', 'The pack.png of a resource pack', L.Package),
  image('Animated texture', 16, 64, 'Minecraft', 'transparent', 'Four frames, stacked top to bottom', L.Film),
  image('Sprite', 32, 32, 'Pixel art', 'transparent', 'A character or item', L.Sword),
  image('Tileset', 128, 128, 'Pixel art', 'transparent', '8 × 8 tiles of 16 pixels', L.LayoutGrid),
  image('Icon', 256, 256, 'Pixel art', 'transparent', 'An app or game icon', L.AppWindow),
  image('Full HD', 1920, 1080, 'Photos & graphics', 'white', 'A wallpaper or a slide', L.Monitor),
  image('Square post', 1080, 1080, 'Photos & graphics', 'white', 'For social media', L.Square),
  image('Thumbnail', 1280, 720, 'Photos & graphics', 'white', 'A video thumbnail', L.Clapperboard),
  BLANK_VIDEO,
  video('Vertical video', 1080, 1920, 30, 'Shorts, Reels and TikTok', L.Smartphone),
  video('Square video', 1080, 1080, 30, 'Instagram posts', L.Square),
  video('Smooth 60 fps', 1920, 1080, 60, 'Games and sports', L.Gamepad2),
  video('Film look', 1920, 1080, 24, 'A cinematic 24 fps', L.Film),
  video('4K video', 3840, 2160, 30, 'Ultra HD', L.Monitor),
];

export const APP_INFO: Record<SuiteAppId, { name: string; noun: string; colors: [string, string]; icon: L.IconNode; tagline: string }> = {
  baseline: { name: 'Baseline', noun: 'home', colors: ['#ffb547', '#ff6f61'], icon: L.LayoutDashboard, tagline: 'Home for your apps and files' },
  gridline: { name: 'Gridline', noun: 'spreadsheet', colors: ['#4ea1ff', '#3fcf8e'], icon: L.Grid2x2, tagline: 'Spreadsheets with live data, formulas and macros. Opens and saves Excel files.' },
  pixelline: { name: 'Pixelline', noun: 'image', colors: ['#a98bff', '#ff7ab6'], icon: L.Shapes, tagline: 'Pixel art, game textures and photos, with layers, filters and animation.' },
  frameline: { name: 'Frameline', noun: 'video', colors: ['#ff5c6c', '#a98bff'], icon: L.Clapperboard, tagline: 'Video editing with a timeline, titles, transitions, color and sound.' },
};

/** The square, colored mark of an app. */
export function appMark(id: SuiteAppId, size = 18): HTMLElement {
  const info = APP_INFO[id];
  const el = h('span', { class: 'app-mark' }, icon(info.icon, size));
  el.style.background = `linear-gradient(135deg, ${info.colors[0]}, ${info.colors[1]})`;
  return el;
}
