// End-to-end smoke test across all interfaces (LOCAL mode, single browser context = shared "device").
// Usage: npm run build && npx vite preview --port 4173 & npm run e2e
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright'); // pre-installed globally, or: npm i -D playwright
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4173';
const OUT = process.env.SHOTS || 'screenshots';
mkdirSync(OUT, { recursive: true });
const errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (cond, msg) => {
  if (!cond) throw new Error('ASSERT: ' + msg);
  console.log('  ✓', msg);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
ctx.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
const track = (p) => {
  p.on('pageerror', (e) => errors.push(`${p.url()}: ${e.message}`));
  p.on('console', (m) => m.type() === 'error' && !/fonts\.g|itunes|ERR_|net::/.test(m.text()) && errors.push(`${p.url()}: ${m.text()}`));
  return p;
};

console.log('1. Create event');
const admin = track(await ctx.newPage());
await admin.goto(BASE + '/');
await admin.getByPlaceholder(/Event name/).fill('E2E Party');
await admin.getByPlaceholder('Admin PIN').fill('1234');
await admin.getByRole('button', { name: /Create event/ }).click();
await admin.waitForURL(/\/admin\//);
const eventId = admin.url().split('/admin/')[1];
ok(eventId === 'e2e-party', 'event created: ' + eventId);

console.log('2. Guest submits (mobile)');
// Local mode = one device, so the "phone" is a mobile-sized tab in the same browser context.
const g = track(await ctx.newPage());
await g.setViewportSize({ width: 390, height: 844 });
await g.goto(`${BASE}/guest/${eventId}`);
await g.getByText('TONIGHT').first().waitFor();
await g.screenshot({ path: `${OUT}/guest-welcome.png` });
await g.getByLabel('Your name').fill('Shady');
await g.getByText("Can't find it? Type it in").click();
await g.getByLabel('Song title').fill('Blinding Lights');
await g.getByLabel('Artist').fill('The Weeknd');
await g.getByRole('button', { name: 'MAKE YOUR REQUEST' }).click();
await g.getByText('ON THE LIST!').waitFor();
ok(true, 'success screen shown');
await wait(800);
await g.screenshot({ path: `${OUT}/guest-success.png` });

console.log('3. Duplicate detection');
await g.getByRole('button', { name: 'REQUEST ANOTHER SONG' }).click();
await g.getByText("Can't find it? Type it in").click();
await g.getByLabel('Song title').fill('blinding lights');
await g.getByLabel('Artist').fill('the weeknd');
await g.getByRole('button', { name: 'MAKE YOUR REQUEST' }).click();
await g.getByText('is already on the list').waitFor();
ok(true, 'duplicate song detected');

console.log('4. Admin approves');
await admin.bringToFront();
await admin.getByRole('button', { name: /^Requests/ }).first().click();
await admin.getByText('Blinding Lights').first().waitFor();
await admin.getByRole('button', { name: 'Approve', exact: true }).first().click();
await wait(400);

console.log('5. Guest votes');
await g.bringToFront();
await g.getByRole('button', { name: /^Vote/ }).first().click();
await g.getByRole('button', { name: 'Vote', exact: true }).first().click();
await g.getByRole('button', { name: 'Voted' }).first().waitFor();
ok(true, 'vote registered');
await wait(1000);
await g.reload();
await g.getByRole('button', { name: /^Vote/ }).first().click();
await g.getByRole('button', { name: 'Voted' }).first().waitFor();
ok(true, 'vote persisted after reload (no double vote)');
await g.screenshot({ path: `${OUT}/guest-vote.png` });

console.log('6. Display shows it');
const d = track(await ctx.newPage());
await d.setViewportSize({ width: 1920, height: 1080 });
await d.goto(`${BASE}/display/${eventId}`);
await d.getByText('UP NEXT').waitFor();
await d.getByText('Blinding Lights').first().waitFor();
ok(true, 'display shows approved request');
await wait(1500);
await d.screenshot({ path: `${OUT}/display-main-1080p.png` });

console.log('7. Reveal countdown');
await admin.bringToFront();
await admin.getByRole('button', { name: /Screen & Moments/ }).first().click();
await admin.getByRole('button', { name: /Reveal next/ }).click();
await d.bringToFront();
await wait(2300);
await d.screenshot({ path: `${OUT}/display-countdown.png` });
await d.getByText('THIS ONE IS FROM').waitFor({ timeout: 12000 });
await wait(1500);
await d.screenshot({ path: `${OUT}/display-reveal.png` });
ok(true, 'cinematic reveal with guest name');

console.log('8. Demo mode');
await admin.bringToFront();
await admin.getByRole('button', { name: /Demo mode/ }).first().click();
await admin.getByRole('button', { name: /^Start$/ }).click();
await admin.getByRole('button', { name: '4×' }).click();
await wait(9000);
// turn off the simulated DJ so screenshots aren't hijacked by auto reveals
await admin.getByRole('switch').nth(1).click();
const demoCount = await admin.evaluate((id) => JSON.parse(localStorage.getItem('encore:event:' + id)).requests.filter((r) => r.isDemo).length, eventId);
ok(demoCount >= 30, 'demo seeded requests: ' + demoCount);
await admin.screenshot({ path: `${OUT}/admin-demo.png` });

console.log('9. Display modes');
await admin.getByRole('button', { name: /Screen & Moments/ }).first().click();
await admin.getByRole('button', { name: 'Clear overlay' }).click();
for (const m of ['Request Wall', 'Leaderboard', 'Now Playing', 'Main']) {
  await admin.getByRole('button', { name: m, exact: true }).first().click();
  await wait(2500);
  await d.screenshot({ path: `${OUT}/display-${m.toLowerCase().replace(/ /g, '-')}.png` });
}
ok(true, 'all display modes rendered');

console.log('10. Moments');
for (const [label, fill] of [['Hype', null], ['Birthday', ['Birthday star\'s name', 'Lina']], ['Surprise', ['The reveal message', 'FREE SHOTS AT THE BAR']]]) {
  await admin.getByRole('button', { name: label, exact: true }).click();
  if (fill) await admin.getByPlaceholder(fill[0]).fill(fill[1]);
  await admin.getByRole('button', { name: new RegExp(`Launch ${label.toLowerCase()} moment`) }).click();
  await wait(label === 'Surprise' ? 4500 : 2500);
  await d.screenshot({ path: `${OUT}/moment-${label.toLowerCase()}.png` });
}
await admin.getByRole('button', { name: 'Clear overlay' }).click();

console.log('11. Crowd vote battle');
await admin.getByRole('button', { name: /^Voting$/ }).first().click();
await admin.getByText('Use top 2').click();
await admin.locator('input[aria-label="Seconds"]').fill('12');
await admin.getByRole('button', { name: /^Start$/ }).click();
await wait(4000);
await d.screenshot({ path: `${OUT}/display-battle.png` });
await wait(10000);
await d.getByText('THE CROWD HAS SPOKEN').waitFor({ timeout: 8000 });
await d.screenshot({ path: `${OUT}/display-battle-winner.png` });
ok(true, 'battle ended with winner');

console.log('12. 4K + DJ mode + standalone routes');
const k = track(await ctx.newPage());
await k.setViewportSize({ width: 3840, height: 2160 });
await k.goto(`${BASE}/request-wall/${eventId}`);
await wait(3000);
await k.screenshot({ path: `${OUT}/request-wall-4k.png` });
await k.goto(`${BASE}/leaderboard/${eventId}`);
await wait(2500);
await k.screenshot({ path: `${OUT}/leaderboard-4k.png` });
const dj = track(await ctx.newPage());
await dj.setViewportSize({ width: 1280, height: 800 });
await dj.goto(`${BASE}/dj/${eventId}`);
await dj.getByText('REVEAL NEXT').waitFor();
await dj.screenshot({ path: `${OUT}/dj-mode.png` });
await dj.setViewportSize({ width: 820, height: 1180 });
await wait(500);
await dj.screenshot({ path: `${OUT}/dj-tablet.png` });

console.log('13. Pause submissions blocks guests');
await admin.getByRole('button', { name: /^Settings$/ }).first().click();
await admin.getByRole('switch').first().click();
await wait(500);
await g.bringToFront();
await g.getByRole('button', { name: /^Request/ }).first().click();
await g.getByText('Requests are paused').waitFor();
ok(true, 'guest sees paused state');

await admin.getByRole('button', { name: /Demo mode/ }).first().click();
await admin.getByRole('button', { name: /^Pause$/ }).click();

await browser.close();
if (errors.length) {
  console.log('\nRuntime errors:\n' + [...new Set(errors)].join('\n'));
  process.exit(1);
}
console.log('\nAll E2E checks passed. Screenshots in ./' + OUT);
