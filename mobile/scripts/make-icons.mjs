// Draws the app icons and splash screens from the website's drop logo (src/app/icon.svg).
// Run from mobile/ after `npx cap add`: node scripts/make-icons.mjs
// Uses Playwright and Chrome from the website's own dev dependencies.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const RED = '#a71930';
const ANDROID = 'android/app/src/main/res';
const IOS = 'ios/App/App/Assets.xcassets';

/** The drop, framed so its centre is the centre of the image. */
const drop = (fill, highlight) =>
  `<svg viewBox="2 2.25 28 28" xmlns="http://www.w3.org/2000/svg"><path d="M16 2.5c-.4 0-.8.2-1 .6C12.3 7.6 6 15.2 6 20.5 6 26 10.5 30 16 30s10-4 10-9.5C26 15.2 19.7 7.6 17 3.1c-.2-.4-.6-.6-1-.6Z" fill="${fill}"/><path d="M11.5 20.5c0 2.6 2 4.6 4.5 4.6" stroke="${highlight}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".85"/></svg>`;

/** A canvas of w×h with a shape (background) and the drop scaled to `scale` of the shorter side. */
function html(w, h, { background = 'transparent', radius = '0', inset = 0, scale }) {
  const d = Math.round(Math.min(w, h) * scale);
  return `<!doctype html><html><body style="margin:0;background:transparent">
    <div style="position:relative;width:${w}px;height:${h}px;overflow:hidden">
      <div style="position:absolute;inset:${inset}px;background:${background};border-radius:${radius}"></div>
      <div style="position:absolute;left:${(w - d) / 2}px;top:${(h - d) / 2}px;width:${d}px;height:${d}px">${drop('#fff', RED)}</div>
    </div></body></html>`;
}

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(file, w, h, opts, { opaque = false } = {}) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html(w, h, opts));
  if (opaque) {
    // App Store icons must not have an alpha channel: render as JPEG, then convert to PNG.
    const jpg = `${file}.jpg`;
    await page.screenshot({ path: jpg, type: 'jpeg', quality: 100 });
    execFileSync('sips', ['-s', 'format', 'png', jpg, '--out', file], { stdio: 'ignore' });
    fs.rmSync(jpg);
  } else {
    await page.screenshot({ path: file, omitBackground: true });
  }
}

// iOS: one 1024 px icon (iOS rounds the corners itself) and the launch image.
await render(`${IOS}/AppIcon.appiconset/AppIcon-512@2x.png`, 1024, 1024, { background: RED, scale: 0.56 }, { opaque: true });
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  await render(`${IOS}/Splash.imageset/${name}`, 2732, 2732, { background: RED, scale: 0.15 }, { opaque: true });
}

// Android launcher icons: legacy square and round, plus the adaptive foreground (on a red background colour).
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [density, k] of Object.entries(densities)) {
  const s = Math.round(48 * k);
  await render(`${ANDROID}/mipmap-${density}/ic_launcher.png`, s, s, { background: RED, radius: '22%', inset: Math.round(2 * k), scale: 0.5 });
  await render(`${ANDROID}/mipmap-${density}/ic_launcher_round.png`, s, s, { background: RED, radius: '50%', inset: Math.round(2 * k), scale: 0.5 });
  const f = Math.round(108 * k);
  await render(`${ANDROID}/mipmap-${density}/ic_launcher_foreground.png`, f, f, { scale: 0.4 });
}

// Android launch images (before Android 12; newer versions use the theme's icon and colour).
for (const dir of fs.readdirSync(ANDROID).filter((d) => d.startsWith('drawable'))) {
  const file = `${ANDROID}/${dir}/splash.png`;
  if (!fs.existsSync(file)) continue;
  const size = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]).toString();
  const [w, h] = [...size.matchAll(/pixel\w+: (\d+)/g)].map((m) => Number(m[1]));
  await render(file, w, h, { background: RED, scale: 0.22 }, { opaque: true });
}

await browser.close();
console.log('Icons and splash screens written.');
