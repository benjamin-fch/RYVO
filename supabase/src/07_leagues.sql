-- =====================================================================
--  Ligues privées en libre-service : n'importe quel joueur crée une ligue
--  pour son groupe (amis, promo, asso, club), partage un code, et le classement
--  se fait sur les vraies parties vérifiées par le serveur pendant la période.
--  Gratuit jusqu'à 20 joueurs et 14 jours ; « Ligue+ » (payée en gemmes) : 200 joueurs, 60 jours, couleur.
-- =====================================================================

create or replace function public.league_sk_ok(p_sk text) returns boolean language sql immutable as $$
  select p_sk in ('reflex','brain','cards','stack','grid','words','aim','sprint@0','sprint@1','sprint@2') $$;
create or replace function public.league_cols() returns text[] language sql immutable as $$
  select array['#5B4BFF','#FF6B3D','#3D7BFF','#14B37A','#FF4FA0','#E0A100','#00A6C8','#8B5CF6','#F23F55','#17142A'] $$;
create or replace function public.clean_title(t text) returns text language sql immutable as $$ select regexp_replace(trim(coalesce(t,'')), '\s+', ' ', 'g') $$;

-- meilleur score de chaque membre sur le jeu de la ligue, pendant la période
create or replace function public.league_ranked(p_id uuid) returns table(user_id uuid, username text, avatar int, frame text, val numeric, runs bigint, pos bigint)
language sql stable security definer set search_path = public as $$
  with l as (select * from leagues where id = p_id),
  b as (
    select m.user_id,
      (select case when game_lower(split_part(l.sk,'@',1)) then min(r.score) else max(r.score) end from runs r
        where r.user_id = m.user_id and r.sk = l.sk and r.status = 'valid' and r.submitted_at between l.starts_at and l.ends_at) val,
      (select count(*) from runs r where r.user_id = m.user_id and r.sk = l.sk and r.status = 'valid' and r.submitted_at between l.starts_at and l.ends_at) runs
    from league_members m, l where m.league_id = l.id
  )
  select b.user_id, p.username, p.avatar, p.frame, b.val, b.runs,
    case when b.val is null then null else rank() over (order by case when b.val is null then 1 else 0 end,
      case when game_lower(split_part((select sk from l),'@',1)) then b.val end asc, case when not game_lower(split_part((select sk from l),'@',1)) then b.val end desc) end pos
  from b join profiles p on p.id = b.user_id where p.status <> 'banned' $$;

create or replace function public.league_json(p_id uuid, p_uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', l.id, 'code', l.code, 'name', l.name, 'sk', l.sk, 'starts', ms(l.starts_at), 'ends', ms(l.ends_at), 'plus', l.plus,
    'max', l.max_members, 'col', l.col, 'owner', (select username from profiles where id = l.owner), 'mine', l.owner = p_uid,
    'members', (select count(*) from league_members where league_id = l.id),
    'me', (select jsonb_build_object('pos', pos, 'val', val) from league_ranked(l.id) where user_id = p_uid))
  from leagues l where l.id = p_id $$;

create or replace function public.create_league(p_name text, p_sk text, p_days int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n text := clean_title(p_name); v_code text; v_id uuid; v_a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform ensure_active(v_uid);
  if length(v_n) not between 3 and 40 or v_n ~* '(https?:|www\.|@|<|>)' then raise exception 'bad_league_name'; end if;
  if not league_sk_ok(p_sk) then raise exception 'bad_board'; end if;
  if coalesce(p_days, 0) not between 1 and 14 then raise exception 'bad_days'; end if;
  if (select count(*) from leagues where owner = v_uid and ends_at > now()) >= 3 then raise exception 'league_limit'; end if;
  if (select count(*) from leagues where owner = v_uid and created_at > now() - interval '1 day') >= 5 then raise exception 'rate_limited'; end if;
  loop
    v_code := (select string_agg(substr(v_a, 1 + floor(random() * length(v_a))::int, 1), '') from generate_series(1, 6));
    exit when not exists(select 1 from leagues where code = v_code);
  end loop;
  insert into leagues(code, name, owner, sk, ends_at, col) values (v_code, v_n, v_uid, p_sk, now() + make_interval(days => p_days), (league_cols())[1 + floor(random() * 9)::int])
  returning id into v_id;
  insert into league_members(league_id, user_id) values (v_id, v_uid);
  return league_json(v_id, v_uid);
end $$;

-- aperçu avant de rejoindre (lien partagé) : visible sans compte, sans la liste des joueurs
create or replace function public.league_preview(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('name', l.name, 'sk', l.sk, 'ends', ms(l.ends_at), 'col', l.col, 'owner', (select username from profiles where id = l.owner),
    'members', (select count(*) from league_members where league_id = l.id), 'max', l.max_members, 'ended', l.ends_at <= now(),
    'member', exists(select 1 from league_members where league_id = l.id and user_id = auth.uid()), 'id', case when exists(select 1 from league_members where league_id = l.id and user_id = auth.uid()) then l.id end)
  from leagues l where l.code = upper(trim(p_code)) $$;

create or replace function public.join_league(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_l leagues;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform ensure_active(v_uid);
  select * into v_l from leagues where code = upper(trim(p_code)) for update;
  if v_l.id is null then raise exception 'league_not_found'; end if;
  if exists(select 1 from league_members where league_id = v_l.id and user_id = v_uid) then return league_json(v_l.id, v_uid); end if;
  if v_l.ends_at <= now() then raise exception 'league_ended'; end if;
  if (select count(*) from league_members where league_id = v_l.id) >= v_l.max_members then raise exception 'league_full'; end if;
  if (select count(*) from league_members m join leagues l on l.id = m.league_id where m.user_id = v_uid and l.ends_at > now()) >= 20 then raise exception 'league_limit'; end if;
  insert into league_members(league_id, user_id) values (v_l.id, v_uid);
  return league_json(v_l.id, v_uid);
end $$;

create or replace function public.my_leagues() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(league_json(l.id, auth.uid()) order by (l.ends_at > now()) desc, l.ends_at desc), '[]')
  from leagues l join league_members m on m.league_id = l.id and m.user_id = auth.uid() $$;

create or replace function public.league_board(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from league_members where league_id = p_id and user_id = v_uid) then raise exception 'not_member'; end if;
  return league_json(p_id, v_uid) || jsonb_build_object('rows', (select coalesce(jsonb_agg(jsonb_build_object('id', user_id, 'name', username, 'avatar', avatar, 'frame', frame,
      'val', val, 'runs', runs, 'pos', pos) order by pos nulls last, username), '[]') from league_ranked(p_id)));
end $$;

create or replace function public.league_update(p_id uuid, p_name text default null, p_days int default null, p_col text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_l leagues; v_n text := clean_title(p_name);
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform ensure_active(v_uid);
  select * into v_l from leagues where id = p_id; if v_l.id is null or v_l.owner <> v_uid then raise exception 'forbidden'; end if;
  if p_name is not null then
    if length(v_n) not between 3 and 40 or v_n ~* '(https?:|www\.|@|<|>)' then raise exception 'bad_league_name'; end if;
    update leagues set name = v_n where id = p_id;
  end if;
  if p_days is not null then
    if p_days not between 1 and (case when v_l.plus then 60 else 14 end) or v_l.starts_at + make_interval(days => p_days) <= now() then raise exception 'bad_days'; end if;
    update leagues set ends_at = starts_at + make_interval(days => p_days) where id = p_id;
  end if;
  if p_col is not null then
    if not v_l.plus then raise exception 'plus_only'; end if;
    if not (p_col = any(league_cols())) then raise exception 'bad_fields'; end if;
    update leagues set col = p_col where id = p_id;
  end if;
  return league_json(p_id, v_uid);
end $$;

create or replace function public.league_upgrade(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_l leagues; v_cost int := (setting('shop')->>'league_plus_gems')::int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform ensure_active(v_uid);
  select * into v_l from leagues where id = p_id for update; if v_l.id is null or v_l.owner <> v_uid then raise exception 'forbidden'; end if;
  if v_l.plus then raise exception 'already_owned'; end if;
  if v_l.ends_at <= now() then raise exception 'league_ended'; end if;
  perform gem_move(v_uid, -v_cost, 'league', v_l.id::text);
  update leagues set plus = true, max_members = 200 where id = p_id;
  return league_json(p_id, v_uid);
end $$;

create or replace function public.leave_league(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists(select 1 from leagues where id = p_id and owner = v_uid) then raise exception 'owner_cannot_leave'; end if;
  delete from league_members where league_id = p_id and user_id = v_uid;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.league_kick(p_id uuid, p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from leagues where id = p_id and owner = v_uid) then raise exception 'forbidden'; end if;
  if p_user = v_uid then raise exception 'owner_cannot_leave'; end if;
  delete from league_members where league_id = p_id and user_id = p_user;
  return league_board(p_id);
end $$;

create or replace function public.delete_league(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  delete from leagues where id = p_id and owner = v_uid;
  if not found then raise exception 'forbidden'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- console : modération des ligues (noms) ----------
create or replace function public.admin_leagues(p_q text default '') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_require('mod');
  return jsonb_build_object(
    'active', (select count(*) from leagues where ends_at > now()),
    'plus', (select count(*) from leagues where plus),
    'members', (select count(*) from league_members m join leagues l on l.id = m.league_id where l.ends_at > now()),
    'rows', (select coalesce(jsonb_agg(x order by (x->>'t')::bigint desc), '[]') from (
      select jsonb_build_object('id', l.id, 'code', l.code, 'name', l.name, 'sk', l.sk, 'owner', jsonb_build_object('id', p.id, 'name', p.username),
        'members', (select count(*) from league_members where league_id = l.id), 'max', l.max_members, 'plus', l.plus, 't', ms(l.created_at), 'ends', ms(l.ends_at)) x
      from leagues l join profiles p on p.id = l.owner
      where coalesce(p_q,'') = '' or l.name ilike '%' || p_q || '%' or l.code = upper(p_q) or p.username ilike '%' || p_q || '%'
      order by l.created_at desc limit 200) z));
end $$;

create or replace function public.admin_delete_league(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_l leagues;
begin
  perform admin_require('mod');
  delete from leagues where id = p_id returning * into v_l;
  if v_l.id is null then raise exception 'not_found'; end if;
  perform audit('a supprimé la ligue', v_l.name, v_l.code);
  return jsonb_build_object('ok', true);
end $$;
