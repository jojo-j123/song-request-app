# ENCORE — The Interactive Event Music Experience

Guests scan a QR code, request songs and vote from their phones. The DJ runs everything from a control center. The LED wall reacts in real time with cinematic reveals, crowd battles and event moments.

**Four connected interfaces, synced in real time:**

| Route | What it is | Built for |
|---|---|---|
| `/guest/:eventId` | Request + vote (mobile) | iOS / Android browsers |
| `/display/:eventId` | Main LED screen (follows the DJ's chosen mode) | 1920×1080, 4K, projectors |
| `/request-wall/:eventId` | Floating request wall (always) | Second screen |
| `/leaderboard/:eventId` | Rankings + Wall of Fame (always) | Second screen |
| `/admin/:eventId` | Full DJ Control Center | Laptop / tablet |
| `/dj/:eventId` | Simplified booth view | Tablet, big touch targets |
| `/` and `/login` | Event setup + organizer sign-in | — |

Stack: React 18 + TypeScript + Vite, Tailwind, Framer Motion, Lucide, Canvas 2D effects, Supabase (Postgres + Auth + Realtime + RLS).

---

## 1. Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm run build        # typecheck + production build to dist/
npm test             # business-rule unit tests (submissions, votes, battles, queue)
npm run e2e          # full browser run across every screen (needs `npx vite preview --port 4173` running)
```

## 2. Environment variables

Copy `.env.example` to `.env`:

| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | for live events | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | for live events | The **anon/publishable** key. Never put the service-role key in the frontend. |
| `VITE_PUBLIC_URL` | optional | Public base URL baked into QR codes (e.g. `https://encore.yourdomain.com`). Defaults to the current origin. |

**No Supabase vars = LOCAL mode.** Data lives in `localStorage` and syncs instantly between tabs on the *same device* (BroadcastChannel + Web Locks). It's perfect for demos and design reviews. **It does not work for a real event**, because guests' phones can't reach your laptop's storage. The admin dashboard shows a warning banner while you're in local mode.

## 3. Configure Supabase (production)

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, paste and run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). It creates:
   - Tables: `events`, `event_settings`, `song_requests`, `votes`, `event_moments`, `guest_sessions`, with foreign keys, indexes and check constraints.
   - **RLS** on every table. Guests are anonymous: they can read public event data, and they can write **only** through `SECURITY DEFINER` RPCs that validate everything server-side:
     - `submit_request`: submissions open, event live, length limits, per-guest limit, queue size, duplicate-song detection, and an idempotency key so retries never create duplicates.
     - `cast_vote`: voting open, song approved, one vote per guest per song per round (enforced by a unique index), one pick per battle, and battle time windows.
   - Organizers (Supabase Auth users) own their events. All admin writes go through RLS `is_event_owner()` checks.
   - Realtime publication for the four tables the UI listens to.
   - With the CLI instead: `supabase link` then `supabase db push`.
3. **Authentication → Providers:** keep Email enabled. For fast setup, turn off "Confirm email", or leave it on and confirm via inbox.
4. Put the URL and anon key in `.env` (or your host's env settings) and restart.

**How realtime works:** each screen does one full fetch on (re)connect, then applies row-level deltas from Supabase Realtime. Votes update `song_requests.vote_count`, so phones never refetch the whole event on every vote. Load stays flat with hundreds of guests. Reconnects, `online` events and tab-visibility changes trigger a resync, and a 60-second safety resync catches anything missed.

## 4. Create an event

1. Open `/`. In Supabase mode, sign in or create an organizer account first.
2. Enter the event name and date (plus an admin PIN in local mode), then click **Create event**.
3. You land in `/admin/<event-id>`. Go to **Settings** to set the logo, brand colours, background theme, request limits, countdown length and an optional custom QR destination.

You can run multiple events side by side. Each has its own queue, votes, settings and branding.

## 5. Put it on the LED screen

1. On the machine connected to the screen, open `/display/<event-id>` in Chrome or Edge.
2. Press **F** (or move the mouse and click ⤢) for fullscreen. The cursor hides itself, and the page requests a screen wake-lock.
3. The layout is a fixed 1920×1080 stage scaled to fit, so it's pixel-identical on 1080p, 4K and projectors.
4. If you turned on sound effects, click **Enable sound** once on the display. Browsers block audio until a click.
5. Optional second screens: `/request-wall/<id>` and `/leaderboard/<id>`.

## 6. How guests get in

The display shows a large QR code ("GOT A SONG IN MIND? SCAN. REQUEST. VIBE."). It opens `/guest/<event-id>` directly. The same QR code and a copyable link are in the admin sidebar, so you can print them on table cards. Guests type a name once (it's remembered), search the song (iTunes metadata + artwork, no API key needed), tap it and hit **MAKE YOUR REQUEST**. That takes about 5 seconds. Manual entry is the fallback if search is unavailable.

## 7. Run the night (DJ)

**`/dj/<id>`, booth view:**
- **Now playing:** end the song, or spotlight the guest on the Wall of Fame.
- **Next up:** shows the crowd favourite (or the top of the queue). **REVEAL NEXT** runs the cinematic countdown → reveal → "THIS ONE IS FROM [NAME]!". You can also play without a reveal, or skip.
- **Incoming:** one-tap approve / reject.
- **Up next queue:** sort by votes, or reveal any song.
- Switch display modes, fire a Hype moment, clear the screen, and toggle requests or voting.

**`/admin/<id>`, full control:**
- **Requests:** filter, search, approve, reject, delete, restore, show dedications.
- **Queue:** drag to reorder, move up/down, sort by votes, skip, reveal.
- **Screen & Moments:** Main / Now Playing / Request Wall / Leaderboard. Moments: Hype, Dedication, Birthday, Surprise.
- **Voting:** open or close voting, start a new round, reset rounds. **Crowd Vote battle:** pick two songs and a timer. The screen shows a live head-to-head and reveals the winner automatically.
- **Settings:** branding, limits, auto-approve, sound + volume, animation intensity, pause/resume requests, clear queue, reset event. Destructive actions ask for confirmation.

## 8. Demo mode

Click **LAUNCH INSTANT DEMO** on `/`. It opens the display and the dashboard, starts 100 simulated guests, and seeds ~35 requests with votes. In local mode the PIN is `0000`.

Or go to **Admin → Demo mode**: Start / Pause / Reset, speed 0.5×–4×, and toggle the **Simulated DJ** (auto-approves requests and reveals the crowd favourite about once a minute). Simulated data is tagged and **Reset** removes only that data. Real guest requests are kept. Every screen shows a **DEMO** badge while demo mode is on. Keep the dashboard tab open, because it drives the simulation.

## 9. Deploy

It's a static SPA, so any static host works.

- **Vercel:** import the repo, framework "Vite", add the env vars, deploy. `vercel.json` already rewrites all routes to `index.html`.
- **Netlify:** build `npm run build`, publish `dist`. `public/_redirects` handles SPA routing.
- Set `VITE_PUBLIC_URL` to your final domain so printed QR codes stay valid.

**Pre-event checklist:** run the SQL; set the env vars; create the event; open the display on the venue screen; scan the QR with your own phone; submit, approve and vote once end to end; check venue Wi-Fi or 4G coverage where guests stand.

---

## Architecture notes

```
src/
  lib/engine.ts          pure business rules (local mode) — mirrored 1:1 by the SQL RPCs
  lib/backend/           Backend interface + local (localStorage/BroadcastChannel) and Supabase adapters
  lib/demo/              100-guest simulator with leader election (one tab drives it)
  lib/sound.ts           WebAudio-synthesised SFX (no audio files, nothing copyrighted)
  components/fx/         canvas particles, visualizers, confetti, atmosphere (DPR-capped for 4K)
  components/display/    LED screens + cinematic overlays
  components/admin/      DJ control panels
  pages/                 route entry points (lazy-loaded)
supabase/migrations/     schema, RLS, RPCs, realtime
```

**Known limits, stated plainly:**
- Duplicate-vote protection uses an anonymous device ID stored in the browser, plus server-side unique constraints. A guest who clears their browser data or switches browsers can vote again. Locking it down further means requiring sign-in (e.g. SMS), which adds friction and costs submissions. Not worth it for most events.
- The visualizers are synthesized, not driven by live audio. The app never touches the DJ's audio chain, by design. It manages requests and metadata only; music playback stays with the DJ.
- Battle auto-finish and the demo simulator run in an open admin/DJ tab. If none is open, the display still shows the result when the timer ends, and the DB record is finalised the next time an admin tab is open.
