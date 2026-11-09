-- ============================================================================
-- ENCORE — Live Song Request platform schema
-- Guests are anonymous: they can only write through SECURITY DEFINER RPCs that
-- validate every rule server-side. Admins (Supabase Auth users) own events and
-- manage them directly under Row Level Security.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables ----
create table if not exists public.events (
  id            text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  owner_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name          text not null check (char_length(name) between 1 and 80),
  logo_url      text,
  event_date    date,
  theme_config  jsonb not null default '{"primary":"#8B5CF6","secondary":"#3B82F6","magenta":"#EC4899","cyan":"#22D3EE","background":"aurora"}',
  status        text not null default 'live' check (status in ('live','ended')),
  created_at    timestamptz not null default now()
);
create index if not exists events_owner_idx on public.events(owner_id);

create table if not exists public.event_settings (
  id                      uuid primary key default gen_random_uuid(),
  event_id                text not null unique references public.events(id) on delete cascade,
  voting_enabled          boolean not null default true,
  submissions_enabled     boolean not null default true,
  max_requests_per_guest  int not null default 3 check (max_requests_per_guest between 1 and 50),
  max_queue_size          int not null default 150 check (max_queue_size between 1 and 2000),
  countdown_duration      int not null default 3 check (countdown_duration between 1 and 10),
  auto_approve            boolean not null default false,
  display_mode            text not null default 'main' check (display_mode in ('main','wall','leaderboard','nowplaying')),
  sound_enabled           boolean not null default false,
  volume                  real not null default 0.6 check (volume between 0 and 1),
  animation_intensity     text not null default 'normal' check (animation_intensity in ('low','normal','high')),
  show_requester_names    boolean not null default true,
  qr_url                  text,
  voting_round            int not null default 1,
  total_votes             int not null default 0,
  guest_count             int not null default 0,
  demo                    jsonb not null default '{"enabled":false,"running":false,"speed":1,"autoDj":true}',
  updated_at              timestamptz not null default now()
);

create table if not exists public.song_requests (
  id              uuid primary key default gen_random_uuid(),
  event_id        text not null references public.events(id) on delete cascade,
  guest_id        text not null check (char_length(guest_id) between 4 and 80),
  guest_name      text not null check (char_length(guest_name) between 1 and 40),
  song_title      text not null check (char_length(song_title) between 1 and 120),
  artist          text not null check (char_length(artist) between 1 and 100),
  artwork_url     text check (artwork_url is null or artwork_url like 'https://%'),
  status          text not null default 'pending'
                  check (status in ('pending','approved','rejected','playing','played','skipped')),
  vote_count      int not null default 0 check (vote_count >= 0),
  queue_position  int not null default 0,
  requested_at    timestamptz not null default now(),
  played_at       timestamptz,
  dedicated_to    text check (dedicated_to is null or char_length(dedicated_to) <= 40),
  message         text check (message is null or char_length(message) <= 200),
  is_demo         boolean not null default false,
  client_id       text,
  song_key        text generated always as (
                    regexp_replace(lower(song_title || '|' || artist), '[^a-z0-9|]', '', 'g')) stored
);
create index if not exists song_requests_event_status_idx on public.song_requests(event_id, status);
create index if not exists song_requests_event_queue_idx on public.song_requests(event_id, queue_position);
create index if not exists song_requests_guest_idx on public.song_requests(event_id, guest_id);
create unique index if not exists song_requests_client_uidx on public.song_requests(event_id, client_id) where client_id is not null;

create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null references public.events(id) on delete cascade,
  request_id  uuid not null references public.song_requests(id) on delete cascade,
  voter_id    text not null check (char_length(voter_id) between 4 and 80),
  context     text not null, -- 'round:<n>' or 'battle:<moment id>'
  created_at  timestamptz not null default now()
);
-- one vote per song per round, one pick per battle
create unique index if not exists votes_round_uidx on public.votes(event_id, voter_id, request_id, context) where context like 'round:%';
create unique index if not exists votes_battle_uidx on public.votes(event_id, voter_id, context) where context like 'battle:%';
create index if not exists votes_request_idx on public.votes(request_id);

create table if not exists public.event_moments (
  id             uuid primary key default gen_random_uuid(),
  event_id       text not null references public.events(id) on delete cascade,
  moment_type    text not null, -- countdown|fame|hype|dedication|birthday|surprise|clear|battle
  message        text,
  configuration  jsonb not null default '{}',
  triggered_at   timestamptz not null default now()
);
create index if not exists event_moments_event_idx on public.event_moments(event_id, moment_type, triggered_at desc);

create table if not exists public.guest_sessions (
  id                uuid primary key default gen_random_uuid(),
  event_id          text not null references public.events(id) on delete cascade,
  guest_identifier  text not null,
  created_at        timestamptz not null default now(),
  unique (event_id, guest_identifier)
);

-- create settings row automatically
create or replace function public.tg_events_settings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_settings(event_id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists events_settings on public.events;
create trigger events_settings after insert on public.events for each row execute function public.tg_events_settings();

-- ------------------------------------------------------------------ RLS ----
alter table public.events          enable row level security;
alter table public.event_settings  enable row level security;
alter table public.song_requests   enable row level security;
alter table public.votes           enable row level security;
alter table public.event_moments   enable row level security;
alter table public.guest_sessions  enable row level security;

create or replace function public.is_event_owner(p_event_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.events e where e.id = p_event_id and e.owner_id = auth.uid());
$$;

-- events: public read (guests & displays need name/theme), owner write
drop policy if exists events_read on public.events;
create policy events_read on public.events for select using (true);
drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists events_owner_update on public.events;
create policy events_owner_update on public.events for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists events_owner_delete on public.events;
create policy events_owner_delete on public.events for delete to authenticated using (owner_id = auth.uid());

-- settings: public read, owner update
drop policy if exists settings_read on public.event_settings;
create policy settings_read on public.event_settings for select using (true);
drop policy if exists settings_owner_update on public.event_settings;
create policy settings_owner_update on public.event_settings for update to authenticated
  using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));

-- requests: everyone reads non-rejected; owner reads all & writes. Guests insert ONLY via submit_request().
drop policy if exists requests_public_read on public.song_requests;
create policy requests_public_read on public.song_requests for select using (status <> 'rejected' or public.is_event_owner(event_id));
drop policy if exists requests_owner_insert on public.song_requests;
create policy requests_owner_insert on public.song_requests for insert to authenticated with check (public.is_event_owner(event_id));
drop policy if exists requests_owner_update on public.song_requests;
create policy requests_owner_update on public.song_requests for update to authenticated
  using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));
drop policy if exists requests_owner_delete on public.song_requests;
create policy requests_owner_delete on public.song_requests for delete to authenticated using (public.is_event_owner(event_id));

-- votes: owner only (guests vote via cast_vote())
drop policy if exists votes_owner_all on public.votes;
create policy votes_owner_all on public.votes for all to authenticated
  using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));

-- moments: public read, owner write
drop policy if exists moments_read on public.event_moments;
create policy moments_read on public.event_moments for select using (true);
drop policy if exists moments_owner_write on public.event_moments;
create policy moments_owner_write on public.event_moments for all to authenticated
  using (public.is_event_owner(event_id)) with check (public.is_event_owner(event_id));

-- guest sessions: owner read only
drop policy if exists guests_owner_read on public.guest_sessions;
create policy guests_owner_read on public.guest_sessions for select to authenticated using (public.is_event_owner(event_id));
drop policy if exists guests_owner_delete on public.guest_sessions;
create policy guests_owner_delete on public.guest_sessions for delete to authenticated using (public.is_event_owner(event_id));

-- ------------------------------------------------------- guest RPCs -------
create or replace function public.register_guest(p_event_id text, p_guest_id text) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_guest_id is null or char_length(p_guest_id) not between 4 and 80 then return; end if;
  insert into guest_sessions(event_id, guest_identifier) values (p_event_id, p_guest_id) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update event_settings set guest_count = guest_count + 1 where event_id = p_event_id; end if;
end $$;

create or replace function public.submit_request(
  p_event_id text, p_guest_id text, p_guest_name text, p_song_title text, p_artist text,
  p_artwork_url text default null, p_client_id text default null,
  p_dedicated_to text default null, p_message text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s event_settings;
  e events;
  v_name text := left(regexp_replace(btrim(coalesce(p_guest_name,'')), '\s+', ' ', 'g'), 40);
  v_title text := left(regexp_replace(btrim(coalesce(p_song_title,'')), '\s+', ' ', 'g'), 120);
  v_artist text := left(regexp_replace(btrim(coalesce(p_artist,'')), '\s+', ' ', 'g'), 100);
  v_key text;
  v_row song_requests;
  v_count int;
begin
  -- idempotency: retried submission returns the original row
  if p_client_id is not null then
    select * into v_row from song_requests where event_id = p_event_id and client_id = p_client_id;
    if found then return jsonb_build_object('ok', true, 'code', 'ok', 'data', to_jsonb(v_row)); end if;
  end if;

  select * into e from events where id = p_event_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Event not found.'); end if;
  if e.status = 'ended' then return jsonb_build_object('ok', false, 'code', 'event_ended', 'message', 'This event has ended.'); end if;

  select * into s from event_settings where event_id = p_event_id for update; -- serialises concurrent submits per event
  if not s.submissions_enabled then
    return jsonb_build_object('ok', false, 'code', 'submissions_closed', 'message', 'Requests are paused right now.');
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
    where event_id = p_event_id and song_key = v_key and status in ('pending','approved') limit 1;
  if found then
    return jsonb_build_object('ok', false, 'code', 'duplicate_song', 'message', 'Already on the list — vote for it instead!', 'data', to_jsonb(v_row));
  end if;

  select count(*) into v_count from song_requests where event_id = p_event_id and status in ('pending','approved');
  if v_count >= s.max_queue_size then
    return jsonb_build_object('ok', false, 'code', 'queue_full', 'message', 'The queue is full. Try again soon!');
  end if;

  perform register_guest(p_event_id, p_guest_id);

  insert into song_requests(event_id, guest_id, guest_name, song_title, artist, artwork_url, status,
                            queue_position, dedicated_to, message, client_id)
  values (p_event_id, p_guest_id, v_name, v_title, v_artist,
          case when p_artwork_url like 'https://%' then left(p_artwork_url, 500) end,
          case when s.auto_approve then 'approved' else 'pending' end,
          coalesce((select max(queue_position) from song_requests where event_id = p_event_id), 0) + 1,
          nullif(left(btrim(coalesce(p_dedicated_to,'')), 40), ''),
          nullif(left(btrim(coalesce(p_message,'')), 200), ''),
          p_client_id)
  returning * into v_row;

  return jsonb_build_object('ok', true, 'code', 'ok', 'data', to_jsonb(v_row));
end $$;

create or replace function public.cast_vote(
  p_event_id text, p_request_id uuid, p_voter_id text, p_battle_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s event_settings;
  r song_requests;
  b event_moments;
  v_ctx text;
  v_count int;
begin
  if p_voter_id is null or char_length(p_voter_id) not between 4 and 80 then
    return jsonb_build_object('ok', false, 'code', 'invalid');
  end if;
  select * into r from song_requests where id = p_request_id and event_id = p_event_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'That song is no longer in the queue.'); end if;

  if p_battle_id is not null then
    select * into b from event_moments where id = p_battle_id and event_id = p_event_id and moment_type = 'battle' for update;
    if not found or b.configuration->>'status' <> 'live' or (b.configuration->>'endsAt')::timestamptz < now() then
      return jsonb_build_object('ok', false, 'code', 'battle_closed', 'message', 'This battle is over.');
    end if;
    if not (b.configuration->'requestIds') ? p_request_id::text then
      return jsonb_build_object('ok', false, 'code', 'invalid');
    end if;
    v_ctx := 'battle:' || p_battle_id::text;
    begin
      insert into votes(event_id, request_id, voter_id, context) values (p_event_id, p_request_id, p_voter_id, v_ctx);
    exception when unique_violation then
      return jsonb_build_object('ok', false, 'code', 'already_voted', 'message', 'You already picked a side!');
    end;
    v_count := coalesce((b.configuration->'tallies'->>p_request_id::text)::int, 0) + 1;
    update event_moments
      set configuration = jsonb_set(configuration, array['tallies', p_request_id::text], to_jsonb(v_count))
      where id = p_battle_id;
    update event_settings set total_votes = total_votes + 1 where event_id = p_event_id;
    return jsonb_build_object('ok', true, 'code', 'ok', 'data', jsonb_build_object('voteCount', v_count));
  end if;

  select * into s from event_settings where event_id = p_event_id;
  if not s.voting_enabled then return jsonb_build_object('ok', false, 'code', 'voting_closed', 'message', 'Voting is closed right now.'); end if;
  if r.status <> 'approved' then return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Voting is closed for this song.'); end if;

  v_ctx := 'round:' || s.voting_round;
  begin
    insert into votes(event_id, request_id, voter_id, context) values (p_event_id, p_request_id, p_voter_id, v_ctx);
  exception when unique_violation then
    return jsonb_build_object('ok', false, 'code', 'already_voted', 'message', 'You already voted for this one.');
  end;
  update song_requests set vote_count = vote_count + 1 where id = p_request_id returning vote_count into v_count;
  update event_settings set total_votes = total_votes + 1 where event_id = p_event_id;
  perform register_guest(p_event_id, p_voter_id);
  return jsonb_build_object('ok', true, 'code', 'ok', 'data', jsonb_build_object('voteCount', v_count));
end $$;

-- Atomic queue helpers for admins (owner checked inside)
create or replace function public.admin_reorder(p_event_id text, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_event_owner(p_event_id) then raise exception 'unauthorized'; end if;
  update song_requests r set queue_position = x.ord
    from unnest(p_ids) with ordinality as x(id, ord)
    where r.id = x.id and r.event_id = p_event_id;
  update song_requests set queue_position = queue_position + coalesce(array_length(p_ids,1),0) + 1
    where event_id = p_event_id and not (id = any(p_ids));
end $$;

create or replace function public.admin_set_playing(p_event_id text, p_request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_event_owner(p_event_id) then raise exception 'unauthorized'; end if;
  update song_requests set status = 'played' where event_id = p_event_id and status = 'playing';
  update song_requests set status = 'playing', played_at = now() where id = p_request_id and event_id = p_event_id;
end $$;

create or replace function public.admin_reset_event(p_event_id text, p_demo_only boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_event_owner(p_event_id) then raise exception 'unauthorized'; end if;
  if p_demo_only then
    delete from song_requests where event_id = p_event_id and is_demo;
    delete from votes where event_id = p_event_id and voter_id like 'demo-%';
    delete from guest_sessions where event_id = p_event_id and guest_identifier like 'demo-%';
    update event_settings set
      total_votes = (select count(*) from votes where event_id = p_event_id),
      guest_count = (select count(*) from guest_sessions where event_id = p_event_id)
      where event_id = p_event_id;
    delete from event_moments where event_id = p_event_id and moment_type = 'battle';
  else
    delete from song_requests where event_id = p_event_id;
    delete from votes where event_id = p_event_id;
    delete from guest_sessions where event_id = p_event_id;
    delete from event_moments where event_id = p_event_id;
    update event_settings set voting_round = 1, total_votes = 0, guest_count = 0,
      demo = jsonb_set(demo, '{running}', 'false') where event_id = p_event_id;
  end if;
end $$;

create or replace function public.admin_reset_rounds(p_event_id text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_event_owner(p_event_id) then raise exception 'unauthorized'; end if;
  delete from votes where event_id = p_event_id and context like 'round:%';
  update song_requests set vote_count = 0 where event_id = p_event_id;
  update event_settings set voting_round = 1 where event_id = p_event_id;
end $$;

-- Postgres grants EXECUTE to PUBLIC by default: lock admin helpers to signed-in users only
revoke all on function public.admin_reorder(text, uuid[]) from public, anon;
revoke all on function public.admin_set_playing(text, uuid) from public, anon;
revoke all on function public.admin_reset_event(text, boolean) from public, anon;
revoke all on function public.admin_reset_rounds(text) from public, anon;
grant execute on function public.admin_reorder(text, uuid[]) to authenticated;
grant execute on function public.admin_set_playing(text, uuid) to authenticated;
grant execute on function public.admin_reset_event(text, boolean) to authenticated;
grant execute on function public.admin_reset_rounds(text) to authenticated;
revoke all on function public.tg_events_settings() from public, anon, authenticated;
grant execute on function public.submit_request(text,text,text,text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.cast_vote(text,uuid,text,uuid) to anon, authenticated;
grant execute on function public.register_guest(text,text) to anon, authenticated;

-- -------------------------------------------------------------- realtime ---
do $$
begin
  begin alter publication supabase_realtime add table public.events; exception when others then null; end;
  begin alter publication supabase_realtime add table public.event_settings; exception when others then null; end;
  begin alter publication supabase_realtime add table public.song_requests; exception when others then null; end;
  begin alter publication supabase_realtime add table public.event_moments; exception when others then null; end;
end $$;
