-- =====================================================================
--  Choisir son adversaire
--   · défi direct : je choisis un joueur, je cours contre son record ; il reçoit mon score à battre
--   · duel en direct : avec un joueur connecté, invitation + départ synchronisé, même tirage pour les deux
--  Les scores restent calculés et vérifiés par submit_run, comme pour toute partie.
-- =====================================================================

-- ---------- trouver des joueurs (recherche par pseudo, ou liste des connectés) ----------
create or replace function public.find_players(p_q text default '', p_ids uuid[] default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_q text := replace(replace(trim(coalesce(p_q,'')), '%', ''), '\', '');
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_ids is null and length(v_q) < 2 then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(x order by (x->>'seen')::bigint desc), '[]') from (
    select jsonb_build_object('id', p.id, 'name', p.username, 'avatar', p.avatar, 'frame', p.frame, 'rating', p.rating, 'school', s.short,
      'seen', ms(p.last_seen), 'bests', user_bests(p.id)) x
    from profiles p left join schools s on s.id = p.school_id
    where p.status = 'active' and p.id <> v_uid
      and ((p_ids is not null and p.id = any(p_ids[1:50])) or (p_ids is null and p.username ilike v_q || '%'))
    order by p.last_seen desc limit 30) z);
end $$;

-- ---------- fin d'une partie : créer ou régler défis et duels en direct ----------
create or replace function public.live_settle(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m live_matches; v_low boolean; v_w uuid;
begin
  select * into m from live_matches where id = p_id for update;
  if m.id is null then return; end if;
  if m.status = 'invited' and m.created_at < now() - interval '45 seconds' then
    update live_matches set status = 'expired', updated_at = now() where id = p_id; return;
  end if;
  if m.status <> 'ready' then return; end if;
  v_low := game_lower(split_part(m.sk, '@', 1));
  if m.a_done and m.b_done then
    v_w := case when m.a_score is null and m.b_score is null then null when m.a_score is null then m.b when m.b_score is null then m.a
                when m.a_score = m.b_score then null when (v_low and m.a_score < m.b_score) or (not v_low and m.a_score > m.b_score) then m.a else m.b end;
    update live_matches set status = 'done', winner = v_w, updated_at = now() where id = p_id;
  elsif (m.a_done or m.b_done) and m.updated_at < now() - interval '5 minutes' then
    -- l'autre n'a jamais terminé : victoire de celui qui a fini (s'il a un score valable)
    v_w := case when m.a_done and m.a_score is not null then m.a when m.b_done and m.b_score is not null then m.b end;
    update live_matches set status = 'done', winner = v_w, a_done = true, b_done = true, updated_at = now() where id = p_id;
  elsif not m.a_done and not m.b_done and m.start_at < now() - interval '4 minutes' then
    update live_matches set status = 'expired', updated_at = now() where id = p_id;
  end if;
end $$;

create or replace function public.live_json(p_id uuid, p_uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', m.id, 'sk', m.sk, 'status', m.status, 'start', ms(m.start_at), 'now', ms(clock_timestamp()), 'created', ms(m.created_at),
    'role', case when m.a = p_uid then 'a' else 'b' end,
    'opp', (select jsonb_build_object('id', p.id, 'name', p.username, 'avatar', p.avatar, 'frame', p.frame, 'rating', p.rating, 'gear', p.gear) from profiles p where p.id = case when m.a = p_uid then m.b else m.a end),
    'my_score', case when m.a = p_uid then m.a_score else m.b_score end, 'opp_score', case when m.a = p_uid then m.b_score else m.a_score end,
    'my_done', case when m.a = p_uid then m.a_done else m.b_done end, 'opp_done', case when m.a = p_uid then m.b_done else m.a_done end,
    'opp_started', (case when m.a = p_uid then m.b_run else m.a_run end) is not null,
    'result', case when m.status <> 'done' then null when m.winner is null then 'draw' when m.winner = p_uid then 'win' else 'loss' end)
  from live_matches m where m.id = p_id and p_uid in (m.a, m.b) $$;

create or replace function public.run_closed_hooks(p_r runs, p_score numeric, p_status text, p_out text, out chid uuid, out live jsonb)
language plpgsql security definer set search_path = public as $$
declare v_t uuid := nullif(p_r.secret->'opp'->>'target', '')::uuid; v_c uuid := nullif(p_r.secret->'opp'->>'challenge', '')::uuid;
  v_l uuid := nullif(p_r.secret->>'live', '')::uuid; v_ok boolean := p_status in ('valid','flagged');
begin
  -- défi direct envoyé : l'adversaire choisi reçoit ton score à battre (seulement si ta partie est valide)
  if v_t is not null and p_status = 'valid' then
    insert into challenges(from_user, to_user, sk, seed, cat, from_score, from_run)
    values (p_r.user_id, v_t, p_r.sk, p_r.seed, coalesce(p_r.extra->>'cat', 'mix'), p_score, p_r.id) returning id into chid;
  end if;
  -- défi relevé : on désigne le gagnant
  if v_c is not null then
    update challenges set to_score = case when v_ok then p_score end, status = 'done', done_at = now(),
      winner = case when not v_ok then from_user when p_out = 'win' then to_user when p_out = 'loss' then from_user else null end
    where id = v_c and status = 'playing';
  end if;
  -- duel en direct : on note ton score, et on désigne le gagnant quand les deux ont fini
  if v_l is not null then
    update live_matches set
      a_score = case when a = p_r.user_id then (case when v_ok then p_score end) else a_score end,
      b_score = case when b = p_r.user_id then (case when v_ok then p_score end) else b_score end,
      a_done = a_done or a = p_r.user_id, b_done = b_done or b = p_r.user_id, updated_at = now()
    where id = v_l and status = 'ready';
    perform live_settle(v_l);
    live := live_json(v_l, p_r.user_id);
  end if;
end $$;

-- ---------- défis directs ----------
create or replace function public.challenge_json(c challenges, p_uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', c.id, 'sk', c.sk, 'status', c.status, 'mine', c.from_user = p_uid, 'from_score', c.from_score, 'to_score', c.to_score,
    'created', ms(c.created_at), 'expires', ms(c.expires_at), 'done', ms(c.done_at),
    'result', case when c.status <> 'done' then null when c.winner is null then 'draw' when c.winner = p_uid then 'win' else 'loss' end,
    'opp', (select jsonb_build_object('id', p.id, 'name', p.username, 'avatar', p.avatar, 'frame', p.frame, 'rating', p.rating) from profiles p
            where p.id = case when c.from_user = p_uid then c.to_user else c.from_user end)) $$;

create or replace function public.my_challenges() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  -- partie de défi jamais terminée : défi perdu ; défi non relevé à temps : expiré
  update challenges set status = 'done', winner = from_user, done_at = now() where status = 'playing' and played_at < now() - interval '35 minutes' and v_uid in (from_user, to_user);
  update challenges set status = 'expired' where status = 'open' and expires_at < now() and v_uid in (from_user, to_user);
  return jsonb_build_object(
    'received', (select coalesce(jsonb_agg(challenge_json(c, v_uid) order by c.created_at desc), '[]') from challenges c where c.to_user = v_uid and c.status = 'open'),
    'history', (select coalesce(jsonb_agg(challenge_json(c, v_uid) order by coalesce(c.done_at, c.created_at) desc), '[]') from (
        select * from challenges c where v_uid in (c.from_user, c.to_user) and not (c.to_user = v_uid and c.status = 'open')
        order by coalesce(c.done_at, c.created_at) desc limit 25) c));
end $$;

create or replace function public.decline_challenge(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update challenges set status = 'declined', done_at = now() where id = p_id and to_user = auth.uid() and status = 'open';
  if not found then raise exception 'challenge_closed'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- duels en direct ----------
create or replace function public.live_invite(p_to uuid, p_sk text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform ensure_active(v_uid);
  if p_to is null or p_to = v_uid or not exists(select 1 from profiles where id = p_to and status = 'active') then raise exception 'bad_target'; end if;
  if not league_sk_ok(p_sk) or p_sk = 'cards' then raise exception 'bad_board'; end if;
  if (select count(*) from live_matches where a = v_uid and created_at > now() - interval '1 hour') >= 30 then raise exception 'rate_limited'; end if;
  update live_matches set status = 'cancelled', updated_at = now() where a = v_uid and status = 'invited';
  insert into live_matches(a, b, sk, seed) values (v_uid, p_to, p_sk, floor(random() * 2147483646)::bigint + 1) returning id into v_id;
  return live_json(v_id, v_uid);
end $$;

create or replace function public.live_answer(p_id uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform ensure_active(v_uid);
  perform live_settle(p_id);
  update live_matches set status = case when p_accept then 'ready' else 'declined' end,
    start_at = case when p_accept then now() + interval '5 seconds' end, updated_at = now()
  where id = p_id and b = v_uid and status = 'invited';
  if not found then raise exception 'live_closed'; end if;
  return live_json(p_id, v_uid);
end $$;

create or replace function public.live_cancel(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); m live_matches;
begin
  select * into m from live_matches where id = p_id and v_uid in (a, b) for update;
  if m.id is null then raise exception 'live_closed'; end if;
  if m.status = 'invited' or (m.status = 'ready' and m.a_run is null and m.b_run is null) then
    update live_matches set status = 'cancelled', updated_at = now() where id = p_id;
  elsif m.status = 'ready' then
    -- abandon en cours de duel : ta partie compte comme non terminée
    update live_matches set a_done = a_done or a = v_uid, b_done = b_done or b = v_uid, updated_at = now() where id = p_id;
    perform live_settle(p_id);
  end if;
  return live_json(p_id, v_uid);
end $$;

create or replace function public.live_get(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform live_settle(p_id);
  return live_json(p_id, auth.uid());
end $$;

create or replace function public.live_pending() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  update live_matches set status = 'expired', updated_at = now() where b = v_uid and status = 'invited' and created_at < now() - interval '45 seconds';
  return (select coalesce(jsonb_agg(live_json(id, v_uid) order by created_at desc), '[]') from live_matches where b = v_uid and status = 'invited');
end $$;
