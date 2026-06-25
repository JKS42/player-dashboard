# Player Dashboard

> Gamify your life. A desktop "player dashboard" that turns your real-world goals into RPG-style stats, quests, XP, levels, streaks, and achievements, with daily check-ins and desktop notifications.

Built with [Electron](https://www.electronjs.org/) and styled with CSS variables (plus optional Tailwind CSS v4 utilities). All progress is stored locally on your machine, so your data never leaves your computer.

---

## Table of contents

- [Features](#features)
- [Designs / Themes](#designs--themes)
- [Screenshots](#screenshots)
- [Getting started](#getting-started)
- [Usage](#usage)
- [Project structure](#project-structure)
- [Custom icons](#custom-icons)
- [How it works](#how-it-works)
- [Data & persistence](#data--persistence)
- [Configuration](#configuration)
- [Roadmap](#roadmap)
- [License](#license)

---

## Features

- **Local accounts & login** — multi-user sign-up/login, fully local (no server). Each account has its own saved data; passwords are hashed, never stored in plaintext.
- **Wallet / salary budget** — set a monthly salary that is auto-credited each month, track your balance, log income/expense transactions by category, see a monthly summary, and earn XP for staying under budget and saving.
- **Player profile** — avatar, name, class/title, overall **Level** and a global **XP** bar.
- **Profile / customization tab** — a dedicated settings hub to edit your identity, pick your **theme** and **layout** independently, and **export / import / reset** all your data.
- **Attributes / Stats** — track real-life categories as RPG stats (e.g. Strength = fitness, Intellect = study, Discipline, Social, Health). Each stat has its own level and XP bar.
- **Quests / Tasks** — add daily, weekly, or one-off quests with XP rewards. Completing a quest awards XP to a chosen stat and your global level.
- **Daily check-in & streaks** — one-click daily check-in with a streak counter and bonus XP for consistency.
- **Daily goals** — a focused set of goals that auto-reset at midnight; finishing them all grants a "Daily Complete" bonus.
- **Long-term goals** — aspirational goals with milestones, an optional target date, and a progress bar fed by your quests/daily goals.
- **Daily reminders** — configurable reminders (label, time, days) that fire desktop notifications to pull you back into the loop.
- **Achievements / Badges** — unlock badges for milestones (first quest, 7-day streak, reach Level 5, and more).
- **Activity log** — a running history of recent XP gains and completed quests.
- **Desktop notifications** — daily check-in reminders and level-up celebrations via native OS notifications.
- **Live theme switcher** — change the entire look instantly without reloading.
- **Local persistence** — everything is saved to a local JSON file and restored on startup.

## Designs / Themes

The dashboard ships with four switchable themes and four layouts, chosen independently from the **Profile tab** at runtime:

Themes:

- **RPG / Game HUD** *(default)* — dark, neon accents, glowing XP bars.
- **Sleek Modern** — clean cards, soft shadows, productivity feel.
- **Cyberpunk** — black with magenta/cyan glow, animated borders, monospace numerics.
- **Minimal** — calm, whitespace-heavy, single accent color, text-first.

Layouts (independent of theme):

- **Grid** *(default)* — multi-column card grid.
- **Compact** — denser cards, more on screen.
- **Sidebar** — left rail navigation + main content.
- **Single-column** — one centered, stacked column.

Themes and layouts are driven by CSS custom properties/classes on the `<html data-theme="..." data-layout="...">` element, so switching is instant.

## Screenshots

> _Add screenshots/GIFs here once the UI is built._

```
docs/images/rpg.png
docs/images/modern.png
docs/images/cyberpunk.png
docs/images/minimal.png
```

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- npm (bundled with Node.js)

### Installation

```bash
git clone https://github.com/JKS42/player-dashboard.git
cd player-dashboard
npm install
```

### Run

```bash
npm start
```

This launches the Electron app (configured via `start` in [package.json](package.json)).

## Usage

1. **Launch** the app with `npm start`, then **sign up** (first run) or **log in** to your local account.
2. **Check in** each day with the check-in button to grow your streak and earn bonus XP.
3. **Add quests** with the "+ Add Quest" button, assign an XP reward and a target stat.
4. **Complete quests** to gain XP; reaching an XP threshold triggers a **level-up**.
5. **Track your money** in the **Wallet tab**: set your salary, log transactions, and watch your savings earn XP.
6. **Customize** from the **Profile tab**: edit your identity, switch theme and layout, back up your data, and log out.
7. **Unlock achievements** as you hit milestones; review progress in the activity log.

## Project structure

```
player-dashboard/
├── main.js              # Electron main process (window, IPC, notifications, persistence)
├── preload.js           # Secure bridge exposing window.api to the renderer
├── scripts/
│   └── build-icons.js   # Converts your SVGs to the PNG/ICO the OS needs
├── htmlFiles/
│   ├── index.html       # Dashboard markup (top bar + panels + modal)
│   ├── styles.css       # CSS-variable theming + components
│   └── dashboard.js     # Renderer logic (state, XP/levels, quests, themes)
├── assets/
│   ├── icons/           # YOUR custom SVGs (app, notify, tabs) — edit these
│   └── generated/       # Auto-generated PNG/ICO (git-ignored)
├── package.json
└── README.md
```

> Note: `preload.js`, `scripts/build-icons.js`, and `htmlFiles/dashboard.js` are part of the planned build. See [docs/PROCESS.md](docs/PROCESS.md) for the full architecture and build plan.

## Custom icons

You can use your own SVGs everywhere in the app. Drop them into `assets/icons/` using these fixed filenames and the app picks them up automatically:

- `app.svg` — the application and window icon.
- `notify.svg` — the desktop-notification icon.
- `tab-stats.svg`, `tab-quests.svg`, `tab-checkin.svg`, `tab-goals.svg`, `tab-wallet.svg`, `tab-reminders.svg`, `tab-achievements.svg`, `tab-activity.svg`, `tab-profile.svg` — one per tab/panel.

How they're used:

- **Tabs** render your SVGs inline in the UI, so they inherit the active theme's colors (via `currentColor`). If a `tab-*.svg` is missing, a built-in default is used.
- **App icon & notifications** can't use SVG directly (the OS needs raster images), so a build step converts `app.svg` and `notify.svg` into `assets/generated/icon.ico`, `icon.png`, and `notify.png`.

The conversion runs automatically before the app starts. You can also run it manually:

```bash
npm run build:icons
```

After editing any SVG, just run the app again (or `npm run build:icons`) to regenerate the raster icons.

## How it works

The app uses Electron's two-process model with a secure `preload` bridge:

- **Main process** ([main.js](main.js)) creates the window, handles local accounts/login, owns the per-account data files, sends desktop notifications, and schedules daily reminders.
- **Renderer** ([htmlFiles/index.html](htmlFiles/index.html) + `dashboard.js`) renders the UI and game logic.
- **Preload** (`preload.js`) exposes a minimal, safe `window.api` (load/save state, notify) via `contextBridge` with `contextIsolation` enabled.

For a deep dive into the data flow, XP math, and module responsibilities, see **[docs/PROCESS.md](docs/PROCESS.md)**. For how all the features connect into one gamification loop, see **[docs/FEATURES.md](docs/FEATURES.md)**. For a step-by-step build guide for each feature, see **[docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md)**.

## Data & persistence

- Accounts and progress are stored as JSON in Electron's app data directory (`app.getPath('userData')`):
  - `accounts.json` — the list of local accounts (username, salt, password hash). No plaintext passwords.
  - `player-data-<id>.json` — one game-state file per account, loaded after login.
  - Locations: Windows `%APPDATA%/player-dashboard/`, macOS `~/Library/Application Support/player-dashboard/`, Linux `~/.config/player-dashboard/`.
- A user's file is loaded after they log in and written whenever their state changes.
- Deleting a `player-data-<id>.json` resets that account's progress; deleting `accounts.json` removes all accounts.

### Accounts & login (local-only)

- On launch you sign up or log in; there is no server and nothing leaves your machine.
- Multiple people can keep separate accounts on the same computer, each with its own data.
- Passwords are hashed with Node's `crypto.scrypt` and a per-account salt. Note this is a local organizer/deterrent, not encrypted-at-rest storage; the data files are still readable by anyone with access to the machine.

### Backup & restore

From the **Profile tab** you can manage your data explicitly:

- **Export** — save your entire state to a `.json` file of your choosing.
- **Import** — load a previously exported `.json` backup (replaces current data).
- **Reset** — clear progress back to first-run defaults (asks for confirmation).

## Configuration

- **Default stats and starter quests** are seeded on first run and can be edited in `dashboard.js`.
- **XP curve** uses a level formula (e.g. `xpForLevel = 100 * level^1.5`) defined in `dashboard.js`.
- **Reminder time** for the daily check-in notification is configured in `main.js`.

## Roadmap

- [ ] Editable stats and custom categories from the UI
- [ ] Weekly/monthly summaries and charts
- [ ] Configurable notification schedule from settings
- [ ] Cloud sync / backup (optional)
- [ ] Packaged installers (Windows/macOS/Linux) via electron-builder

## License

ISC © Kian Smith
