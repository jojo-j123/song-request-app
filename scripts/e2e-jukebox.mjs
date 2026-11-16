// End-to-end check of jukebox mode (LOCAL mode): import audio files, guest requests from the
// library, the player laptop plays the file, then keeps the music going on its own.
// Usage: npm run build && npx vite preview --port 4173 &  node scripts/e2e-jukebox.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (cond, msg) => {
  if (!cond) throw new Error('ASSERT: ' + msg);
  console.log('  ✓', msg);
};

// tiny valid WAV files (sine tone) named like real songs
function wav(seconds, hz) {
  const rate = 8000;
  const n = rate * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((i / rate) * hz * 2 * Math.PI) * 9000), 44 + i * 2);
  return buf;
}
const dir = join(tmpdir(), 'encore-jukebox-e2e');
mkdirSync(dir, { recursive: true });
const files = [
  ['Daft Punk - One More Time.wav', 4, 440],
  ['01 - Beyonce - Halo.wav', 4, 520],
  ['Queen - Don\'t Stop Me Now.wav', 4, 660],
].map(([name, s, hz]) => {
  const p = join(dir, name);
  writeFileSync(p, wav(s, hz));
  return p;
});
const notAudio = join(dir, 'cover.txt');
writeFileSync(notAudio, 'not a song');

const errors = [];
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const track = (p) => {
  p.on('pageerror', (e) => errors.push(`${p.url()}: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && !/fonts\.g|itunes|ERR_|net::/.test(m.text()) && errors.push(`${p.url()}: ${m.text()}`));
  return p;
};

console.log('1. Create event and import songs');
const player = track(await ctx.newPage());
await player.goto(BASE + '/');
await player.getByPlaceholder(/Event name/).fill('Jukebox Night');
await player.getByPlaceholder('Admin PIN').fill('1234');
await player.getByRole('button', { name: /Create event/ }).click();
await player.waitForURL(/\/admin\//);
const eventId = player.url().split('/admin/')[1];
await player.goto(`${BASE}/player/${eventId}`);
await player.locator('input[type=file]').first().setInputFiles([...files, notAudio]);
await player.getByText('One More Time').first().waitFor({ timeout: 20000 });
const lib = await player.evaluate((id) => JSON.parse(localStorage.getItem('encore:event:' + id)).library, eventId);
ok(lib.length === 3, 'three audio files imported, text file skipped');
ok(lib.some((t) => t.title === 'Halo' && t.artist === 'Beyonce'), 'title/artist parsed from "01 - Artist - Title"');
ok(lib.every((t) => t.durationSec === 4), 'durations read from the files');

console.log('2. Jukebox mode: guest can only pick from the library');
await player.getByRole('switch', { name: 'Jukebox mode' }).click();
await wait(400);
const g = track(await ctx.newPage());
await g.setViewportSize({ width: 390, height: 844 });
await g.goto(`${BASE}/guest/${eventId}`);
await g.getByLabel('Your name').fill('Shady');
await g.getByText("Pick from tonight's songs").waitFor();
ok((await g.getByText("Can't find it? Type it in").count()) === 0, 'manual entry is hidden');
await g.getByPlaceholder('Search 3 songs').fill('one more');
await g.getByRole('button', { name: /One More Time/ }).click();
await g.getByRole('button', { name: 'MAKE YOUR REQUEST' }).click();
await g.getByText('ON THE LIST!').waitFor();
await g.getByText(/Approved/).waitFor();
ok(true, 'request accepted and auto-approved');

console.log('3. Player plays the requested file after the countdown');
await player.bringToFront();
await player.getByRole('button', { name: /START JUKEBOX/ }).click();
await player.getByText('requested by').waitFor({ timeout: 15000 });
ok(await player.getByText('One More Time').first().isVisible(), 'now playing shows the request');
const t0 = Date.now();
let heard = false;
while (Date.now() - t0 < 15000 && !heard) {
  heard = await player.evaluate(() => /0:0[1-9]/.test(document.body.innerText));
  await wait(300);
}
ok(heard, 'audio is actually playing (position advancing)');

console.log('4. Never go silent: a house pick follows');
await player.getByText('House pick', { exact: true }).waitFor({ timeout: 25000 });
const st = await player.evaluate((id) => JSON.parse(localStorage.getItem('encore:event:' + id)).requests.map((r) => [r.songTitle, r.status, r.guestName]), eventId);
ok(st.some((r) => r[0] === 'One More Time' && r[1] === 'played'), 'requested song marked as played');
ok(st.filter((r) => r[1] === 'playing').length === 1, 'exactly one song playing');
await player.screenshot({ path: 'screenshots/jukebox-player.png' });
await g.bringToFront();
await g.getByRole('button', { name: 'REQUEST ANOTHER SONG' }).click();
await wait(600);
await g.screenshot({ path: 'screenshots/jukebox-guest.png' });

console.log('5. Reload keeps the files');
await player.reload();
await player.getByText('Halo').first().waitFor();
ok((await player.getByText('missing', { exact: true }).count()) === 0, 'files still on this device after reload');

await browser.close();
if (errors.length) {
  console.log('\nRuntime errors:\n' + [...new Set(errors)].join('\n'));
  process.exit(1);
}
console.log('\nJukebox E2E passed.');
