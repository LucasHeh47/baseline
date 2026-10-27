# Baseline

**The home for your apps.** Start a spreadsheet, an image, a video or a beat, and pick up any file you worked on recently, from one window. Baseline opens [Gridline](https://github.com/LucasHeh47/gridline) (spreadsheets), [Pixelline](https://github.com/LucasHeh47/pixelline) (images and pixel art), [Frameline](https://github.com/LucasHeh47/frameline) (video editing) and [Beatline](https://github.com/LucasHeh47/beatline) (music). It's like the Microsoft 365 app, for this family of apps.

![Baseline's Home](docs/images/home.png)

## What it does

- **Start something new** in one click: a blank spreadsheet, image or video, or a preset. There are Gridline's budget, loan, portfolio and sports presets, Pixelline sizes for Minecraft textures, skins, sprites, icons and photos, Frameline projects for YouTube, Shorts and Reels, square posts and 4K, and Beatline beats (hip-hop, trap, house, lo-fi, pop) and setups to record a band or a singer-songwriter. **Create** lists them all.
- **Recent files from all the apps** in one list, with pictures of your images. Filter by spreadsheets, images, videos or pinned files, search with **Ctrl+K**, and pin the ones you use often. Click a file and it opens in the right app.
- **Open a file** (**Ctrl+O**): spreadsheets go to Gridline, images to Pixelline, video projects to Frameline, music projects to Beatline.
- **Installs and updates the other apps.** The first time Baseline starts, it installs Gridline, Pixelline, Frameline and Beatline for you. Afterwards it checks them for updates when it starts and every few hours; Home tells you when one is ready, with what's new, and updates it in one click (or automatically, if you turn that on).
- **Apps** shows what's installed and its version, and opens, installs or updates each app. Portable copies work too: tell Baseline where they are in **Settings → Apps**.
- Dark and light themes, optional start with Windows, and automatic updates (with a Developer branch for early builds), like the other apps.

Each app also has a switcher (the dotted button at the top left) to jump to the others.

## Download and install

1. Go to the **[releases](https://github.com/LucasHeh47/baseline/releases)**.
2. Download **`Baseline-Setup-x.y.z.exe`** (or the portable `Baseline-Portable-x.y.z.exe`) and run it.
3. That's it: when Baseline starts the first time, it downloads and installs **Gridline**, **Pixelline**, **Frameline** and **Beatline** too (for your Windows user, no admin rights needed), and shows the progress on Home.

The portable Baseline doesn't install anything by itself; it offers to. You can turn the automatic setup off in **Settings → Apps**, and install or update each app from **Apps** any time. A development build of Baseline sets the apps up with their development builds too (change it with **Settings → Apps → Development builds of the apps**).

> **"Windows protected your PC"?** Baseline isn't signed with a paid code-signing certificate, so Windows SmartScreen may warn you the first time. Click **More info**, then **Run anyway**.

## How it finds things

- **Apps:** each app notes where it runs from in a small shared file (`%APPDATA%\Baseline\suite.json`), and Baseline also looks where the installers put them (`%LOCALAPPDATA%\Programs\<App>\<App>.exe`).
- **Recent files:** Baseline reads the recent-file lists Gridline, Pixelline, Frameline and Beatline already keep. Pinning or removing a file in Baseline changes the same list, so the apps' own start pages agree.
- **Installing and updating:** Baseline looks at each app's GitHub releases ([Gridline](https://github.com/LucasHeh47/gridline/releases), [Pixelline](https://github.com/LucasHeh47/pixelline/releases), [Frameline](https://github.com/LucasHeh47/frameline/releases), [Beatline](https://github.com/LucasHeh47/beatline/releases)), downloads only `…-Setup-….exe` installers from those pages, and runs them silently. An app that's open isn't touched; close it and try again. Portable copies of the apps can't be updated by an installer, so Baseline links to the new download instead.

Baseline doesn't collect analytics or send anything anywhere; it only checks the apps' GitHub releases for updates.

## Developing

See **[docs/development.md](docs/development.md)**.

## License

[MIT](LICENSE)
