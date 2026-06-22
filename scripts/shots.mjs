// Capture README screenshots from the built app (EPIC-25). Drives the solo flow + the
// pre-game screens in a real browser (system Chrome via playwright-core) and writes PNGs
// to docs/images/. Usage: `npm run preview` in one shell, then `node scripts/shots.mjs`.
// Regenerate when the UI changes.
import { chromium } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SHOT_URL ?? 'http://localhost:4173/';
const outDir = fileURLToPath(new URL('../docs/images/', import.meta.url));
mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 2 });
const shot = async (name) => {
  await page.screenshot({ path: `${outDir}${name}.png` });
  console.log(`wrote docs/images/${name}.png`);
};
const lobby = () => page.waitForSelector('#lobby', { state: 'visible' });

await page.goto(BASE, { waitUntil: 'networkidle' });
await sleep(500);
await shot('01-mode-menu'); // entry: Solo / Network

// Network connect screen (Server + Room + Rooms), then back to the menu.
await page.click('button[data-mode="network"]');
await sleep(400);
await shot('02-connect');
await page.click('#con-back');
await sleep(300);

// Solo → ready (the "press P" main screen) → preferences lobby (default 1/1/1 drones).
await page.click('button[data-mode="solo"]');
await sleep(500);
await shot('03-ready');
await page.keyboard.press('p');
await lobby();
await sleep(300);
await shot('04-lobby');

// --- Game 1: a stable first-person view (zero the drones → solo wander never ends) ---
for (const d of ['0', '1', '2']) await page.click(`[data-drone-dn="${d}"]`); // 1 → 0 each
await page.click('#lobby-start');
await sleep(700);
await shot('05-preview'); // 5s start-map preview
await sleep(5600); // past the 5s preview, now playing
// Spawn facing is random (the seed increments each game), so rotate until the view
// actually looks down a corridor — detected by blue sky (rgb 73,73,255) filling the top
// band of the 160x100 view window (a wall pressed to the lens shows no sky). If a full
// turn finds none, step forward and try again.
const seesSky = () =>
  page.evaluate(() => {
    const c = document.querySelector('#screen');
    const g = c.getContext('2d').getImageData(26, 52, 140, 12).data; // top of the view
    let blue = 0;
    for (let p = 0; p < g.length; p += 4)
      if (g[p] < 120 && g[p + 1] < 120 && g[p + 2] > 180) blue++;
    return blue > (g.length / 4) * 0.3; // ≥30% sky → looking down a corridor
  });
let framed = false;
for (let attempt = 0; attempt < 2 && !framed; attempt++) {
  for (let i = 0; i < 24 && !framed; i++) {
    framed = await seesSky();
    if (!framed) {
      await page.keyboard.press('ArrowLeft');
      await sleep(110);
    }
  }
  if (!framed) {
    await page.keyboard.down('ArrowUp'); // boxed in: step forward and sweep again
    await sleep(300);
    await page.keyboard.up('ArrowUp');
  }
}
await sleep(150);
await shot('06-playing'); // first-person 3D view + HUD (crosshair, health face, scoreboard)

await page.keyboard.press('m'); // 2D overhead map
await sleep(300);
await shot('07-map');
await page.keyboard.press('m');
await sleep(200);

await page.keyboard.press('Escape'); // pause menu
await sleep(300);
await shot('08-menu');
await page.keyboard.press('Escape'); // close the menu before the debug overlay
await sleep(200);

await page.keyboard.press('d'); // hidden debug / interop overlay
await sleep(300);
await shot('09-debug');
await page.keyboard.press('d');

await browser.close();
console.log('done');
