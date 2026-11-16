-- ============================================================================
-- ENCORE — Jukebox mode
-- The organizer imports audio files on the player laptop. Only the metadata below
-- is stored here; the files themselves never leave that laptop.
-- Safe to run more than once.
-- ============================================================================

create table if not exists public.library_tracks (
  id            uuid primary key default gen_random_uuid(),
  event_id      text not null references public.events(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 120),
  artist        text not null check (char_length(artist) between 1 and 100),
  duration_sec  int not null default 0 check (duration_sec >= 0),
  artwork_url   text check (artwork_url is null or artwork_url like 'https://%'),
  file_key      text not null check (char_length(file_key) between 1 and 400),
  created_at    timestamptz not null default now(),
  unique (event_id, file_key)
);
create index if not exists library_tracks_event_idx on public.library_tracks(event_id);

alter table public.library_tracks enable row level security;
drop policy if exists library_read on public.library_tracks;
create policy library_read on public.library_tracks for select using (true);
drop policy if exists library_owner_write on public.library_tracks;
create policy library_owner_write on public.library_tracks for all to authenticated
  using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));

alter table public.song_requests
  add column if not exists track_id uuid references public.library_tracks(id) on delete set null;

alter table public.event_settings
  add column if not exists jukebox jsonb not null default '{"enabled":false,"order":"votes","reveal":true,"fill":true}';

-- submit_request gains p_track_id. In jukebox mode the song must be a library track and its
-- title/artist/artwork are taken from the library, not from the guest.
drop function if exists public.submit_request(text,text,text,text,text,text,text,text,text);

create or replace function public.submit_request(
  p_event_id text, p_guest_id text, p_guest_name text, p_song_title text, p_artist text,
  p_artwork_url text default null, p_client_id text default null,
  p_dedicated_to text default null, p_message text default null, p_track_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s event_settings;
  e events;
  t library_tracks;
  v_name text := left(regexp_replace(btrim(coalesce(p_guest_name,'')), '\s+', ' ', 'g'), 40);
  v_title text := left(regexp_replace(btrim(coalesce(p_song_title,'')), '\s+', ' ', 'g'), 120);
  v_artist text := left(regexp_replace(btrim(coalesce(p_artist,'')), '\s+', ' ', 'g'), 100);
  v_artwork text := p_artwork_url;
  v_track uuid := null;
  v_key text;
  v_row song_requests;
  v_count int;
begin
  if p_client_id is not null then
    select * into v_row from song_requests where event_id = p_event_id and client_id = p_client_id;
    if found then return jsonb_build_object('ok', true, 'code', 'ok', 'data', to_jsonb(v_row)); end if;
  end if;

  select * into e from events where id = p_event_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Event not found.'); end if;
  if e.status = 'ended' then return jsonb_build_object('ok', false, 'code', 'event_ended', 'message', 'This event has ended.'); end if;

  select * into s from event_settings where event_id = p_event_id for update;
  if not s.submissions_enabled then
    return jsonb_build_object('ok', false, 'code', 'submissions_closed', 'message', 'Requests are paused right now.');
  end if;

  if p_track_id is not null then
    select * into t from library_tracks where id = p_track_id and event_id = p_event_id;
    if found then
      v_track := t.id; v_title := t.title; v_artist := t.artist; v_artwork := t.artwork_url;
    end if;
  end if;
  if coalesce((s.jukebox->>'enabled')::boolean, false) and v_track is null then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'Pick a song from the list.');
  end if;

  if v_name = '' or v_title = '' or v_artist = '' or p_guest_id is null or char_length(p_guest_id) < 4 then
    return jsonb_build_object('ok', false, 'code', 'invalid', 'message', 'Name, song and artist are required.');
  end if;

  select count(*) into v_count from song_requests
    where event_id = p_event_id and guest_id = p_guest_id and status <> 'rejected' and not is_demo;
  if v_count >= s.max_requests_per_guest then
    return jsonb_build_object('ok', false, 'code', 'guest_limit',
      'message', format('You''ve reached the limit of %s requests.', s.max_requests_per_guest));
  end if;

  v_key := regexp_replace(lower(v_title || '|' || v_artist), '[^a-z0-9|]', '', 'g');
  select * into v_row from song_requests
    where event_id = p_event_id and status in ('pending','approved')
      and (song_key = v_key or (v_track is not null and track_id = v_track)) limit 1;
  if found then
    return jsonb_build_object('ok', false, 'code', 'duplicate_song', 'message', 'Already on the list — vote for it instead!', 'data', to_jsonb(v_row));
  end if;

  select count(*) into v_count from song_requests where event_id = p_event_id and status in ('pending','approved');
  if v_count >= s.max_queue_size then
    return jsonb_build_object('ok', false, 'code', 'queue_full', 'message', 'The queue is full. Try again soon!');
  end if;

  perform register_guest(p_event_id, p_guest_id);

  insert into song_requests(event_id, guest_id, guest_name, song_title, artist, artwork_url, status,
                            queue_position, dedicated_to, message, client_id, track_id)
  values (p_event_id, p_guest_id, v_name, v_title, v_artist,
          case when v_artwork like 'https://%' then left(v_artwork, 500) end,
          case when s.auto_approve then 'approved' else 'pending' end,
          coalesce((select max(queue_position) from song_requests where event_id = p_event_id), 0) + 1,
          nullif(left(btrim(coalesce(p_dedicated_to,'')), 40), ''),
          nullif(left(btrim(coalesce(p_message,'')), 200), ''),
          p_client_id, v_track)
  returning * into v_row;

  return jsonb_build_object('ok', true, 'code', 'ok', 'data', to_jsonb(v_row));
end $$;

grant execute on function public.submit_request(text,text,text,text,text,text,text,text,text,uuid) to anon, authenticated;

do $$
begin
  begin alter publication supabase_realtime add table public.library_tracks; exception when others then null; end;
end $$;
