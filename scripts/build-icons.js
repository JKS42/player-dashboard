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
    const sizes = [16, 32, 64, 128, 256];
    const pngBuffers = await Promise.all(
      sizes.map((size) => sharp(appSvg).resize(size, size).png().toBuffer())
    );

    // Main PNG (largest) for window icon on macOS/Linux.
    fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), pngBuffers[pngBuffers.length - 1]);
    console.log('[build-icons] wrote icon.png');

    // ICO bundle for Windows (non-fatal if it fails).
    try {
      if (typeof pngToIco === 'function') {
        const ico = await pngToIco(pngBuffers);
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
