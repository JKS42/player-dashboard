// Converts user-provided SVGs in assets/icons/ into the raster icons the OS
// needs (app icon + notification icon). Tabs use the SVGs directly, so they are
// not processed here. Safe to run repeatedly; skips gracefully if the optional
// conversion dependencies are not installed.

const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'assets', 'icons');
const OUT_DIR = path.join(__dirname, '..', 'assets', 'generated');

async function main() {
  let sharp;
  let pngToIco;
  try {
    sharp = require('sharp');
    const pti = require('png-to-ico');
    // png-to-ico may expose the function as the module itself or as `.default`.
    pngToIco = typeof pti === 'function' ? pti : pti.default;
  } catch (err) {
    console.warn(
      '[build-icons] sharp/png-to-ico not installed; skipping icon generation.\n' +
        '             Run "npm i -D sharp png-to-ico" to enable custom app/notification icons.'
    );
    return;
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const appSvg = path.join(ICONS_DIR, 'app.svg');
  const notifySvg = path.join(ICONS_DIR, 'notify.svg');

  if (fs.existsSync(appSvg)) {
    // Main PNG for macOS/Linux. electron-builder requires the source icon to be
    // at least 512x512 (it converts to .icns on macOS); 1024 gives crisp output.
    await sharp(appSvg).resize(1024, 1024).png().toFile(path.join(OUT_DIR, 'icon.png'));
    console.log('[build-icons] wrote icon.png');

    // ICO bundle for Windows (non-fatal if it fails). ICO frames max out at
    // 256x256, so build that set separately from the large PNG above.
    try {
      if (typeof pngToIco === 'function') {
        const icoSizes = [16, 32, 48, 64, 128, 256];
        const icoBuffers = await Promise.all(
          icoSizes.map((size) => sharp(appSvg).resize(size, size).png().toBuffer())
        );
        const ico = await pngToIco(icoBuffers);
        fs.writeFileSync(path.join(OUT_DIR, 'icon.ico'), ico);
        console.log('[build-icons] wrote icon.ico');
      }
    } catch (err) {
      console.warn('[build-icons] could not write icon.ico:', err.message);
    }
  } else {
    console.warn('[build-icons] assets/icons/app.svg not found; skipping app icon.');
  }

  if (fs.existsSync(notifySvg)) {
    await sharp(notifySvg).resize(128, 128).png().toFile(path.join(OUT_DIR, 'notify.png'));
    console.log('[build-icons] wrote notify.png');
  } else {
    console.warn('[build-icons] assets/icons/notify.svg not found; skipping notification icon.');
  }
}

main().catch((err) => {
  console.error('[build-icons] failed:', err.message);
  // Do not fail the build/start if icon generation has an issue.
  process.exit(0);
});
