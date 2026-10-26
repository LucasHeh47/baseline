# Developing Baseline

Baseline is an [Electron](https://www.electronjs.org/) app written in TypeScript, with no UI framework, built the same way as Gridline and Pixelline.

```
npm install
npm run dev        # hot reload
npm start          # production build
npm test
npm run dist       # Windows installer and portable exe in release/
```

## Layout

| Path | Contents |
| --- | --- |
| `electron/main.ts` | The window, the apps' recent lists, thumbnails, opening files in the right app |
| `electron/suite.ts` | Finding and starting the suite's apps. **The same file is in all three apps**; change it in each |
| `electron/installer.ts` | Downloading the apps' installers from their GitHub releases and running them silently |
| `src/shared/releases.ts` | Comparing versions and picking the release to install (tested in `tests/releases.test.ts`) |
| `src/ui/installs.ts` | The first-run setup, update checks, and the install progress on Home and Apps |
| `src/shared/` | Types for the bridge to the UI, and which app opens which files |
| `src/ui/app.ts` | Home, Create, Files and Apps |
| `src/ui/catalog.ts` | What can be started: blank files and presets, and the options passed to each app |
| `src/ui/settings/schema.ts` | Every setting |

## How the apps talk

- **Starting something new:** Baseline starts the app with options it understands:
  - Gridline: `--new` (a blank workbook) or `--template=budget`;
  - Pixelline: `--new=16x16 --bg=transparent --name=Sword`.

  When the app is already running, the options reach its open window, like files do.
- **Opening a file:** Baseline starts the app with the file's path.
- **Recent files:** Baseline reads `%APPDATA%\Gridline\recent.json` and `%APPDATA%\Pixelline\recent.json`. Pins and removals are written back there.

## Testing without touching your own files

`BASELINE_APPDATA=<folder>` makes Baseline read the apps' lists from `<folder>\Gridline` and `<folder>\Pixelline` instead of your real ones. `BASELINE_SCREENSHOT=<file.png>` saves a screenshot and quits. Use a separate profile too:

```
npx electron . --user-data-dir=%TEMP%\baseline-test
```

Installing apps is real by default. To try it without installing anything:

- `BASELINE_INSTALL_DRYRUN=1` downloads the installer as usual but doesn't run it (it waits a moment and reports success).
- `BASELINE_INSTALL_KIND=installed` (or `portable`, `dev`) makes Baseline behave like an installed copy, which sets the apps up by itself the first time it starts.
