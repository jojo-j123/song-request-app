/**
 * SUPABASE backend — production mode (multi-device, realtime, RLS-secured).
 * Strategy: one full fetch on (re)connect, then apply row-level realtime deltas.
 * This keeps load flat even with hundreds of phones voting at once.
 */
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Backend } from './types';
import type {
  ActionResult,
  AdminAction,
  Battle,
  DisplayCommand,
  EventInfo,
  EventSettings,
  EventSnapshot,
  SongRequest,
} from '../types';
import { DEFAULT_SETTINGS, DEFAULT_THEME, slugify, uid } from '../utils';
import { battleWinner, queueOf } from '../engine';

const mapEvent = (r: any): EventInfo => ({
  id: r.id,
  name: r.name,
  logoUrl: r.logo_url,
  date: r.event_date,
  theme: { ...DEFAULT_THEME, ...(r.theme_config ?? {}) },
  status: r.status,
  createdAt: r.created_at,
});

const mapSettings = (r: any): EventSettings => ({
  votingEnabled: r.voting_enabled,
  submissionsEnabled: r.submissions_enabled,
  maxRequestsPerGuest: r.max_requests_per_guest,
  maxQueueSize: r.max_queue_size,
  countdownDuration: r.countdown_duration,
  autoApprove: r.auto_approve,
  displayMode: r.display_mode,
  soundEnabled: r.sound_enabled,
  volume: r.volume,
  animationIntensity: r.animation_intensity,
  showRequesterNames: r.show_requester_names,
  qrUrl: r.qr_url,
  votingRound: r.voting_round,
  totalVotes: r.total_votes,
  guestCount: r.guest_count,
  demo: { ...DEFAULT_SETTINGS.demo, ...(r.demo ?? {}) },
});

const settingsToRow = (p: Partial<EventSettings>) => {
  const m: Record<keyof EventSettings, string> = {
    votingEnabled: 'voting_enabled',
    submissionsEnabled: 'submissions_enabled',
    maxRequestsPerGuest: 'max_requests_per_guest',
    maxQueueSize: 'max_queue_size',
    countdownDuration: 'countdown_duration',
    autoApprove: 'auto_approve',
    displayMode: 'display_mode',
    soundEnabled: 'sound_enabled',
    volume: 'volume',
    animationIntensity: 'animation_intensity',
    showRequesterNames: 'show_requester_names',
    qrUrl: 'qr_url',
    votingRound: 'voting_round',
    totalVotes: 'total_votes',
    guestCount: 'guest_count',
    demo: 'demo',
  };
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(p)) row[m[k as keyof EventSettings]] = v;
  return row;
};

const mapRequest = (r: any): SongRequest => ({
  id: r.id,
  eventId: r.event_id,
  guestId: r.guest_id,
  guestName: r.guest_name,
  songTitle: r.song_title,
  artist: r.artist,
  artworkUrl: r.artwork_url,
  status: r.status,
  voteCount: r.vote_count,
  queuePosition: r.queue_position,
  requestedAt: r.requested_at,
  playedAt: r.played_at,
  dedicatedTo: r.dedicated_to,
  message: r.message,
  isDemo: r.is_demo,
});

const mapCommand = (r: any): DisplayCommand => ({
  id: r.id,
  type: r.moment_type,
  payload: { ...(r.configuration ?? {}), message: r.message ?? r.configuration?.message },
  triggeredAt: r.triggered_at,
});

const mapBattle = (r: any): Battle | null => {
  const c = r?.configuration;
  if (!c || c.status === 'cleared') return null;
  return {
    id: r.id,
    requestIds: c.requestIds,
    tallies: c.tallies ?? {},
    endsAt: c.endsAt,
    status: c.status,
    winnerId: c.winnerId ?? null,
    startedAt: c.startedAt ?? r.triggered_at,
  };
};

interface Cache {
  event: EventInfo | null;
  settings: EventSettings | null;
  requests: Map<string, SongRequest>;
  command: DisplayCommand | null;
  battle: Battle | null;
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const sb: SupabaseClient = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  const caches = new Map<string, Cache>();

  const err = (e: any, code: ActionResult['code'] = 'error'): ActionResult => ({
    ok: false,
    code: e?.message?.includes('Failed to fetch') ? 'network' : code,
    message: e?.message ?? String(e),
  });

  async function fetchAll(eventId: string): Promise<Cache> {
    const [ev, st, rq, cmd, bt] = await Promise.all([
      sb.from('events').select('*').eq('id', eventId).maybeSingle(),
      sb.from('event_settings').select('*').eq('event_id', eventId).maybeSingle(),
      sb.from('song_requests').select('*').eq('event_id', eventId).order('queue_position').limit(2000),
      sb.from('event_moments').select('*').eq('event_id', eventId).neq('moment_type', 'battle')
        .order('triggered_at', { ascending: false }).limit(1),
      sb.from('event_moments').select('*').eq('event_id', eventId).eq('moment_type', 'battle')
        .order('triggered_at', { ascending: false }).limit(1),
    ]);
    const firstErr = ev.error || st.error || rq.error || cmd.error || bt.error;
    if (firstErr) throw firstErr;
    const c: Cache = {
      event: ev.data ? mapEvent(ev.data) : null,
      settings: st.data ? mapSettings(st.data) : null,
      requests: new Map((rq.data ?? []).map((r) => [r.id, mapRequest(r)])),
      command: cmd.data?.[0] ? mapCommand(cmd.data[0]) : null,
      battle: bt.data?.[0] ? mapBattle(bt.data[0]) : null,
    };
    caches.set(eventId, c);
    return c;
  }

  const snap = (c: Cache): EventSnapshot | null =>
    c.event && c.settings
      ? { event: c.event, settings: c.settings, requests: [...c.requests.values()], command: c.command, battle: c.battle }
      : null;

  async function cache(eventId: string) {
    return caches.get(eventId) ?? (await fetchAll(eventId));
  }

  const ok: ActionResult = { ok: true, code: 'ok' };
  const run = async (p: PromiseLike<{ error: any }>) => {
    const { error } = await p;
    if (error) throw error;
  };

  async function reorder(eventId: string, ids: string[]) {
    await run(sb.rpc('admin_reorder', { p_event_id: eventId, p_ids: ids }));
  }

  async function latestBattleRow(eventId: string) {
    const { data, error } = await sb.from('event_moments').select('*').eq('event_id', eventId)
      .eq('moment_type', 'battle').order('triggered_at', { ascending: false }).limit(1);
    if (error) throw error;
    return data?.[0] ?? null;
  }

  return {
    mode: 'supabase',

    async getAdmin() {
      const { data } = await sb.auth.getUser();
      return data.user ? { id: data.user.id, email: data.user.email } : null;
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return error ? err(error, 'unauthorized') : ok;
    },
    async signUp(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) return err(error);
      return data.session ? ok : { ok: true, code: 'ok', message: 'Check your inbox to confirm your email, then sign in.' };
    },
    async signOut() {
      await sb.auth.signOut();
    },
    async unlockEvent() {
      return { ok: false, code: 'unauthorized', message: 'Sign in with your organizer account.' };
    },
    async canAdmin(eventId) {
      const u = await this.getAdmin();
      if (!u) return false;
      const { data } = await sb.from('events').select('id').eq('id', eventId).eq('owner_id', u.id).maybeSingle();
      return !!data;
    },

    async listEvents() {
      const u = await this.getAdmin();
      if (!u) return [];
      const { data } = await sb.from('events').select('*').eq('owner_id', u.id).order('created_at', { ascending: false });
      return (data ?? []).map(mapEvent);
    },
    async createEvent(input) {
      const base = slugify(input.id || input.name) || 'event';
      for (let i = 0; i < 5; i++) {
        const id = i === 0 ? base : `${base}-${uid().slice(0, 4)}`;
        const { data, error } = await sb
          .from('events')
          .insert({ id, name: input.name.trim() || 'Untitled Event', event_date: input.date || null })
          .select()
          .single();
        if (!error) return { ok: true, code: 'ok', data: mapEvent(data) };
        if (error.code !== '23505') return err(error) as ActionResult<EventInfo>;
      }
      return { ok: false, code: 'error', message: 'Could not allocate an event id.' };
    },
    async deleteEvent(eventId) {
      const { error } = await sb.from('events').delete().eq('id', eventId);
      return error ? err(error) : ok;
    },

    subscribe(eventId, onSnapshot, onStatus) {
      let closed = false;
      let channel: RealtimeChannel | null = null;
      let everConnected = false;
      const emit = () => {
        const c = caches.get(eventId);
        if (c && !closed) onSnapshot(snap(c));
      };
      const resync = async () => {
        try {
          await fetchAll(eventId);
          emit();
        } catch {
          onStatus?.('reconnecting');
        }
      };
      const apply = (table: string, p: any) => {
        const c = caches.get(eventId);
        if (!c) return;
        const row = p.new && Object.keys(p.new).length ? p.new : null;
        if (table === 'song_requests') {
          if (p.eventType === 'DELETE') c.requests.delete(p.old.id);
          else if (row) {
            if (row.event_id !== eventId) return;
            c.requests.set(row.id, mapRequest(row));
          }
        } else if (table === 'event_settings' && row) c.settings = mapSettings(row);
        else if (table === 'events' && row) c.event = mapEvent(row);
        else if (table === 'event_moments') {
          if (p.eventType === 'DELETE') {
            if (c.command?.id === p.old.id) c.command = null;
            if (c.battle?.id === p.old.id) c.battle = null;
          } else if (row) {
            if (row.moment_type === 'battle') {
              if (!c.battle || c.battle.id === row.id || row.triggered_at >= (c.battle.startedAt ?? '')) c.battle = mapBattle(row);
            } else c.command = mapCommand(row);
          }
        }
        emit();
      };
      const connect = () => {
        onStatus?.(everConnected ? 'reconnecting' : 'connecting');
        channel = sb.channel(`event:${eventId}:${uid().slice(0, 6)}`);
        for (const table of ['song_requests', 'event_settings', 'event_moments']) {
          channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `event_id=eq.${eventId}` }, (p) =>
            apply(table, p),
          );
        }
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `id=eq.${eventId}` }, (p) =>
          apply('events', p),
        );
        channel.subscribe(async (status) => {
          if (closed) return;
          if (status === 'SUBSCRIBED') {
            everConnected = true;
            await resync(); // catch up anything missed while disconnected
            onStatus?.('live');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            onStatus?.(navigator.onLine ? 'reconnecting' : 'offline');
          }
        });
      };
      connect();
      resync();
      const onOnline = () => resync();
      const onOffline = () => onStatus?.('offline');
      const onVisible = () => document.visibilityState === 'visible' && resync();
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      document.addEventListener('visibilitychange', onVisible);
      const safety = setInterval(resync, 60_000);
      return () => {
        closed = true;
        clearInterval(safety);
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
        document.removeEventListener('visibilitychange', onVisible);
        if (channel) sb.removeChannel(channel);
      };
    },

    async registerGuest(eventId, guestId) {
      await sb.rpc('register_guest', { p_event_id: eventId, p_guest_id: guestId });
    },
    async submitRequest(eventId, i) {
      const { data, error } = await sb.rpc('submit_request', {
        p_event_id: eventId,
        p_guest_id: i.guestId,
        p_guest_name: i.guestName,
        p_song_title: i.songTitle,
        p_artist: i.artist,
        p_artwork_url: i.artworkUrl ?? null,
        p_client_id: i.clientId,
        p_dedicated_to: i.dedicatedTo ?? null,
        p_message: i.message ?? null,
      });
      if (error) return err(error);
      return { ...data, data: data.data ? mapRequest(data.data) : undefined };
    },
    async castVote(eventId, requestId, voterId, battleId) {
      const { data, error } = await sb.rpc('cast_vote', {
        p_event_id: eventId,
        p_request_id: requestId,
        p_voter_id: voterId,
        p_battle_id: battleId ?? null,
      });
      return error ? err(error) : data;
    },

    async admin(eventId, a: AdminAction) {
      try {
        const reqs = sb.from('song_requests');
        const setStatus = (id: string, status: string, extra: Record<string, unknown> = {}) =>
          run(reqs.update({ status, ...extra }).eq('id', id).eq('event_id', eventId));
        const moment = (type: string, configuration: Record<string, unknown>, message?: string) =>
          run(sb.from('event_moments').insert({ event_id: eventId, moment_type: type, configuration, message: message ?? null }));

        switch (a.type) {
          case 'approve':
            await setStatus(a.id, 'approved');
            break;
          case 'reject':
            await setStatus(a.id, 'rejected');
            break;
          case 'restore':
            await setStatus(a.id, 'approved', { played_at: null });
            break;
          case 'skip':
            await setStatus(a.id, 'skipped');
            break;
          case 'delete':
            await run(reqs.delete().eq('id', a.id).eq('event_id', eventId));
            break;
          case 'move': {
            const q = queueOf([...(await cache(eventId)).requests.values()]);
            const i = q.findIndex((r) => r.id === a.id);
            const j = i + a.dir;
            if (i < 0 || j < 0 || j >= q.length) break;
            [q[i], q[j]] = [q[j], q[i]];
            await reorder(eventId, q.map((r) => r.id));
            break;
          }
          case 'reorder':
            await reorder(eventId, a.ids);
            break;
          case 'sortByVotes': {
            const q = queueOf([...(await fetchAll(eventId)).requests.values()]).sort(
              (x, y) => y.voteCount - x.voteCount || x.queuePosition - y.queuePosition,
            );
            await reorder(eventId, q.map((r) => r.id));
            break;
          }
          case 'playNow':
          case 'reveal': {
            await run(sb.rpc('admin_set_playing', { p_event_id: eventId, p_request_id: a.id }));
            if (a.type === 'reveal') {
              const c = await cache(eventId);
              await moment('countdown', { requestId: a.id, duration: c.settings?.countdownDuration ?? 3 });
            }
            break;
          }
          case 'finishCurrent':
            await run(reqs.update({ status: 'played' }).eq('event_id', eventId).eq('status', 'playing'));
            break;
          case 'updateSettings': {
            const patch = { ...a.patch };
            if (patch.demo) patch.demo = { ...((await cache(eventId)).settings?.demo ?? DEFAULT_SETTINGS.demo), ...patch.demo };
            await run(sb.from('event_settings').update(settingsToRow(patch)).eq('event_id', eventId));
            break;
          }
          case 'updateEvent': {
            const row: Record<string, unknown> = {};
            if (a.patch.name !== undefined) row.name = a.patch.name;
            if (a.patch.logoUrl !== undefined) row.logo_url = a.patch.logoUrl;
            if (a.patch.date !== undefined) row.event_date = a.patch.date || null;
            if (a.patch.status !== undefined) row.status = a.patch.status;
            if (a.patch.theme) row.theme_config = { ...((await cache(eventId)).event?.theme ?? DEFAULT_THEME), ...a.patch.theme };
            await run(sb.from('events').update(row).eq('id', eventId));
            break;
          }
          case 'command':
            await moment(a.command.type, a.command.payload ?? {}, a.command.payload?.message);
            break;
          case 'clearQueue':
            await run(reqs.delete().eq('event_id', eventId).in('status', ['pending', 'approved']));
            break;
          case 'resetEvent':
            await run(sb.rpc('admin_reset_event', { p_event_id: eventId, p_demo_only: false }));
            break;
          case 'clearDemo':
            await run(sb.rpc('admin_reset_event', { p_event_id: eventId, p_demo_only: true }));
            break;
          case 'newRound': {
            const c = await fetchAll(eventId);
            await run(reqs.update({ vote_count: 0 }).eq('event_id', eventId));
            await run(
              sb.from('event_settings')
                .update({ voting_round: (c.settings?.votingRound ?? 1) + 1, voting_enabled: true })
                .eq('event_id', eventId),
            );
            break;
          }
          case 'resetRounds':
            await run(sb.rpc('admin_reset_rounds', { p_event_id: eventId }));
            break;
          case 'startBattle': {
            if (a.a === a.b) return { ok: false, code: 'invalid', message: 'Pick two different songs.' };
            const secs = Math.max(10, Math.min(600, a.seconds));
            await moment('battle', {
              requestIds: [a.a, a.b],
              tallies: { [a.a]: 0, [a.b]: 0 },
              status: 'live',
              winnerId: null,
              startedAt: new Date().toISOString(),
              endsAt: new Date(Date.now() + secs * 1000).toISOString(),
            });
            break;
          }
          case 'endBattle':
          case 'clearBattle': {
            const row = await latestBattleRow(eventId);
            if (!row) break;
            const b = mapBattle(row);
            if (a.type === 'endBattle' && (!b || b.status !== 'live')) break;
            const cfg =
              a.type === 'clearBattle'
                ? { ...row.configuration, status: 'cleared' }
                : {
                    ...row.configuration,
                    status: 'ended',
                    winnerId: battleWinner(b!),
                    endsAt: new Date(Math.min(Date.now(), new Date(b!.endsAt).getTime())).toISOString(),
                  };
            await run(sb.from('event_moments').update({ configuration: cfg }).eq('id', row.id));
            break;
          }
          case 'injectRequests': {
            const c = await cache(eventId);
            let pos = Math.max(0, ...[...c.requests.values()].map((r) => r.queuePosition)) + 1;
            const rows = a.requests.map((r) => ({
              event_id: eventId,
              guest_id: r.guestId,
              guest_name: r.guestName,
              song_title: r.songTitle,
              artist: r.artist,
              artwork_url: r.artworkUrl,
              status: r.status,
              vote_count: r.voteCount,
              queue_position: pos++,
              requested_at: r.requestedAt,
              played_at: r.playedAt,
              dedicated_to: r.dedicatedTo,
              message: r.message,
              is_demo: true,
            }));
            await run(reqs.insert(rows));
            break;
          }
        }
        return ok;
      } catch (e) {
        return err(e);
      }
    },
  };
}
