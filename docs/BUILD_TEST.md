# Build Smoke Test - Unpacked Windows Build

Record of a manual smoke test of the packaged application produced by
`npm run dist:win`.

## Test environment

| Item | Value |
| --- | --- |
| Date | 2026-06-25 |
| OS | Windows 10.0.26200 (x64) |
| electron-builder | 26.15.3 |
| Electron | 42.5.0 |
| App version | 1.0.0 |
| Build under test | `dist/win-unpacked/Player Dashboard.exe` |

## Artifacts produced by the build

| File | Notes |
| --- | --- |
| `dist/Player Dashboard Setup 1.0.0.exe` | NSIS installer (~102 MB) |
| `dist/Player Dashboard Setup 1.0.0.exe.blockmap` | Differential-update map |
| `dist/win-unpacked/` | Portable, unpacked app (tested here) |
| `dist/latest.yml` | Auto-update metadata |

## Procedure

1. Launched `dist/win-unpacked/Player Dashboard.exe` via `Start-Process`.
2. Waited ~6s and inspected running processes.
3. Verified the main window and the per-user data directory.
4. Verified the first-run auto-launch behavior (marker file + Windows startup entry).
5. Stopped the app and reverted the test-created startup entry.

## Results

### Process / window

- App started with **4 processes** (Electron main + renderer + GPU + utility), as expected.
- A visible main window was present with title **"Player Dashboard"** (PID 14104).
- Approx. working-set memory across processes: ~327 MB total at idle on the login screen.

PASS - the app boots and shows its window.

### Per-user data directory

Location: `%APPDATA%\player-dashboard` (`C:\Users\<user>\AppData\Roaming\player-dashboard`)

Created on launch and contained the expected app files alongside the standard
Chromium cache folders:

- `accounts.json` - local account registry
- `app-meta.json` - first-run / auto-launch marker
- `player-data-<uuid>.json` - per-account save data
- Chromium runtime: `Cache`, `Code Cache`, `GPUCache`, `Local Storage`, `Network`, `Session Storage`, `Preferences`, `Local State`, etc.

PASS - persistence paths resolve correctly in the packaged app.

### First-run auto-launch (packaged-only feature)

- `app-meta.json` contained `{ "autoLaunchInitialized": true }`.
- Windows startup entry was registered under
  `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`:

  ```
  com.kiansmith.playerdashboard =
    "C:\Users\shadk\PersonalProjects\player-dashboard\dist\win-unpacked\Player Dashboard.exe"
  ```

PASS - `app.isPackaged` gating works; the installed/packaged build registers
itself to launch at login on first run (this is skipped during `npm start`).

## Cleanup

- All `Player Dashboard` processes terminated (count after stop: `0`).
- The test-created `Run` registry entry was removed so the dev-folder build does
  not auto-start at login. (A real installed build keeps this entry by design.)

## Observations / follow-ups

- The build is **unsigned**: end users will see SmartScreen "Unknown publisher"
  prompts until a code-signing certificate is configured.
- Installer size (~102 MB) is normal for a bundled Electron runtime.
- Auto-launch points at whatever path the build runs from. For distribution this
  is correct because the NSIS installer installs to a stable location; running
  the unpacked build from the project folder is only appropriate for testing.

## Verdict

Smoke test PASSED. The packaged app launches, renders its UI, creates its
per-user data store, and the first-run auto-launch behavior works as designed in
a packaged build.
