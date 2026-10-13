-- =====================================================================
--  Fonctions côté joueur (appelées par le jeu)
-- =====================================================================

create or replace function public.day_start() returns timestamptz language sql stable as $$ select (today_fr()::timestamp) at time zone 'Europe/Paris' $$;

create or replace function public.ensure_active(p_uid uuid) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare v_p profiles;
begin
  select * into v_p from profiles where id = p_uid;
  if v_p.id is null then
    insert into profiles(id, username) values (p_uid, 'joueur_' || substr(replace(p_uid::text,'-',''),1,8)) on conflict do nothing;
    select * into v_p from profiles where id = p_uid;
  end if;
  if v_p.status = 'suspended' and v_p.suspended_until is not null and v_p.suspended_until < now() then
    update profiles set status = 'active', suspended_until = null where id = p_uid returning * into v_p;
  end if;
  if v_p.status = 'banned' then raise exception 'banned'; end if;
  if v_p.status = 'suspended' then raise exception 'suspended:%', ms(v_p.suspended_until); end if;
  return v_p;
end $$;

create or replace function public.daily_today(out game text, out track int)
language plpgsql stable security definer set search_path = public as $$
begin
  select d.game, d.track into game, track from daily_schedule d join games g on g.id = d.game where d.day = today_fr() and g.is_on;
  if game is null then
    select g.id into game from games g where g.is_on and g.daily and not g.dev order by md5(today_fr()::text || g.id) limit 1;
    track := abs(hashtext(today_fr()::text || 't')) % 3;
  end if;
end $$;

create or replace function public.mission_defs() returns jsonb language sql immutable as $$
  select '{"play3":[3,80],"variety":[3,90],"duel":[1,100],"rx":[1,70],"bb":[1,80],"cc":[1,70],"sp":[1,90],"st":[1,80],"gl":[1,80],"wr":[1,80],"am":[1,80],"sc":[1,60],"dl":[1,50]}'::jsonb $$;
create or replace function public.missions_today() returns text[] language sql stable as $$
  select array['play3'] || (select (array_agg(m order by md5(today_fr()::text || m)))[1:2]
    from unnest(array['variety','duel','rx','bb','cc','sp','st','gl','wr','am','sc','dl']) m) $$;
create or replace function public.mission_prog(p_uid uuid, p_m text) returns int
language sql stable security definer set search_path = public as $$
  with t as (select * from runs where user_id = p_uid and submitted_at >= day_start() and status in ('valid','flagged'))
  select case p_m
    when 'play3' then (select count(*) from t)::int
    when 'variety' then (select count(distinct game) from t)::int
    when 'duel' then (select count(*) from t where mode = 'duel' and outcome = 'win')::int
    when 'rx' then (select count(*) from t where game = 'reflex' and score < 290)::int
    when 'bb' then (select count(*) from t where game = 'brain' and score >= 5000)::int
    when 'cc' then (select count(*) from t where game = 'cards' and outcome = 'win')::int
    when 'sp' then (select count(*) from t where sk = 'sprint@0' and score < 54.2)::int
    when 'st' then (select count(*) from t where game = 'stack' and coalesce((extra->>'x')::int,0) >= 20)::int
    when 'gl' then (select count(*) from t where game = 'grid' and coalesce((extra->>'x')::int,0) >= 4)::int
    when 'wr' then (select count(*) from t where game = 'words' and coalesce((extra->>'x')::int,0) >= 6)::int
    when 'am' then (select count(*) from t where game = 'aim' and score >= 8000)::int
    when 'sc' then (select count(*) from t where mode = 'school')::int
    when 'dl' then (select count(*) from t where mode = 'daily')::int
    else 0 end $$;

create or replace function public.user_bests(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(sk, best), '{}') from (
    select sk, case when game_lower(min(game)) then min(score) else max(score) end best
    from runs where user_id = p_uid and status = 'valid' group by sk) b $$;

-- ---------- informations publiques ----------
create or replace function public.public_info() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_d record; v_uid uuid := auth.uid(); v_sch text;
begin
  select * into v_d from daily_today();
  if v_uid is not null then select school_id into v_sch from profiles where id = v_uid; end if;
  return jsonb_build_object(
    'games', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'on',is_on,'featured',featured,'daily',daily) order by sort),'[]') from games),
    'daily', jsonb_build_object('game', v_d.game, 'track', v_d.track, 'day', today_fr()),
    'schools', (select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'short',s.short,'city',s.city,'country',s.country,'domain',s.domain,'col',s.col,
                 'members',(select count(*) from profiles p where p.school_id = s.id and p.status <> 'banned')) order by s.name),'[]') from schools s),
    'season', (select jsonb_build_object('n', n, 'ends', ms(ends_at)) from seasons where closed_at is null order by n desc limit 1),
    'tracks', setting('tracks'),
    'shop', shop_public(),
    'comps', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'game',game,'format',format,'starts',ms(starts_at),'ends',ms(ends_at),'reward',reward,'school',school_id) order by starts_at),'[]')
              from competitions where not cancelled and ends_at > now() and (visibility = 'public' or school_id is null or school_id = v_sch))
  );
end $$;

-- ---------- mon profil ----------
create or replace function public.me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_p profiles; v_m text; v_ms jsonb := '[]'; v_defs jsonb := mission_defs();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_p from profiles where id = v_uid;
  if v_p.id is null then
    insert into profiles(id, username) values (v_uid, 'joueur_' || substr(replace(v_uid::text,'-',''),1,8)) on conflict do nothing;
    select * into v_p from profiles where id = v_uid;
  end if;
  if v_p.status = 'suspended' and v_p.suspended_until < now() then update profiles set status='active', suspended_until=null where id=v_uid returning * into v_p; end if;
  update profiles set last_seen = now() where id = v_uid;
  foreach v_m in array missions_today() loop
    v_ms := v_ms || jsonb_build_object('id', v_m, 'prog', mission_prog(v_uid, v_m), 'goal', (v_defs->v_m->>0)::int, 'xp', (v_defs->v_m->>1)::int,
      'claimed', exists(select 1 from missions_claimed where user_id = v_uid and day = today_fr() and mission = v_m));
  end loop;
  return jsonb_build_object(
    'id', v_p.id, 'username', v_p.username, 'avatar', v_p.avatar, 'frame', v_p.frame, 'skin', v_p.skin, 'lang', v_p.lang,
    'school_id', v_p.school_id, 'program', v_p.program, 'study_year', v_p.study_year,
    'school_lock_until', case when v_p.school_set_at between now() - interval '30 days' and now() - interval '24 hours' then ms(v_p.school_set_at + interval '30 days') end, 'xp', v_p.xp, 'level', level_of(v_p.xp), 'rating', v_p.rating, 'streak', v_p.streak,
    'status', v_p.status, 'until', ms(v_p.suspended_until), 'verified', v_p.verified, 'plus', v_p.plus,
    'gems', v_p.gems, 'owned', (select coalesce(jsonb_agg(item_id), '[]') from owned_items where user_id = v_uid),
    'ads_today', (select count(*) from gem_ledger where user_id = v_uid and reason = 'ad' and at >= day_start()),
    'ad_last', (select ms(max(at)) from gem_ledger where user_id = v_uid and reason = 'ad'),
    'admin', (select role from admins where user_id = v_uid),
    'bests', user_bests(v_uid),
    'runs', (select coalesce(jsonb_agg(x order by x->>'t' desc),'[]') from (
        select jsonb_build_object('id',id,'g',game,'sk',sk,'m',mode,'s',score,'o',outcome,'opp',opp_name,'xp',xp,'dr',dr,'t',ms(submitted_at),'x',extra->'x','w',extra->'w','st',status) x
        from runs where user_id = v_uid and submitted_at is not null and status <> 'archived' order by submitted_at desc limit 80) r),
    'daily', (select jsonb_build_object(
        'used', (select coalesce(jsonb_object_agg(game, n),'{}') from (select game, count(*) n from runs where user_id=v_uid and mode='daily' and submitted_at >= day_start() group by game) a),
        'best', (select coalesce(jsonb_object_agg(game, b),'{}') from (select game, case when game_lower(game) then min(score) else max(score) end b from runs where user_id=v_uid and mode='daily' and status='valid' and submitted_at >= day_start() group by game) c))),
    'missions', v_ms,
    'verification', (select jsonb_build_object('status', status, 'school', school_id, 'domain', split_part(email,'@',2)) from verifications where user_id = v_uid order by created_at desc limit 1),
    'school_pts', (select coalesce(sum((extra->>'school_pts')::int),0) from runs where user_id = v_uid and status = 'valid' and mode = 'school' and submitted_at >= week_start()),
    'week_pts', (select coalesce(sum((extra->>'w')::int),0) from runs where user_id = v_uid and status = 'valid' and submitted_at >= week_start()),
    'month_pts', (select coalesce(sum((extra->>'w')::int),0) from runs where user_id = v_uid and status = 'valid' and submitted_at >= month_start())
  );
end $$;

create or replace function public.update_profile(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_p profiles; v_lv int; v_u text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_p from profiles where id = v_uid; if v_p.id is null then raise exception 'no_profile'; end if;
  v_lv := level_of(v_p.xp);
  if p ? 'username' then
    v_u := trim(p->>'username');
    if v_u !~ '^[A-Za-z0-9._]{3,16}$' then raise exception 'bad_username'; end if;
    if v_u ~* '(admin|ryvo|moderat|support)' then raise exception 'reserved_username'; end if;
    if exists(select 1 from profiles where lower(username) = lower(v_u) and id <> v_uid) then raise exception 'username_taken'; end if;
    update profiles set username = v_u where id = v_uid;
  end if;
  if p ? 'avatar' then
    if not ((p->>'avatar')::int between 0 and 7 or owns(v_uid, 'avatar', p->>'avatar')) then raise exception 'locked_item'; end if;
    update profiles set avatar = (p->>'avatar')::int where id = v_uid;
  end if;
  if p ? 'frame' then
    if not owns(v_uid, 'frame', p->>'frame') and ((p->>'frame') not in ('basic','gold','brand','candy','mint') or v_lv < (case p->>'frame' when 'gold' then 2 when 'brand' then 3 when 'candy' then 5 when 'mint' then 7 else 1 end)) then raise exception 'locked_item'; end if;
    update profiles set frame = p->>'frame' where id = v_uid;
  end if;
  if p ? 'skin' then
    if not owns(v_uid, 'skin', p->>'skin') and ((p->>'skin') not in ('violet','coral','mint','berry') or v_lv < (case p->>'skin' when 'coral' then 3 when 'mint' then 5 when 'berry' then 7 else 1 end)) then raise exception 'locked_item'; end if;
    update profiles set skin = p->>'skin' where id = v_uid;
  end if;
  if p ? 'lang' and p->>'lang' in ('fr','en') then update profiles set lang = p->>'lang' where id = v_uid; end if;
  if p ? 'school_id' then
    if p->>'school_id' is not null and not exists(select 1 from schools where id = p->>'school_id') then raise exception 'unknown_school'; end if;
    if p->>'school_id' is distinct from v_p.school_id then
      -- on peut corriger son choix pendant 24 h, puis l'école est fixée 30 jours (évite de changer d'équipe en cours de Coupe)
      if p->>'school_id' is not null and v_p.school_set_at between now() - interval '30 days' and now() - interval '24 hours' then
        raise exception 'school_locked:%', ms(v_p.school_set_at + interval '30 days');
      end if;
      update profiles set school_id = p->>'school_id', verified = false,
        school_set_at = case when p->>'school_id' is null then school_set_at when school_set_at is null or school_set_at < now() - interval '24 hours' then now() else school_set_at end
        where id = v_uid;
      update verifications set status = 'rejected', decided_at = now() where user_id = v_uid and status = 'pending';
    end if;
  end if;
  if p ? 'study_year' then
    if p->>'study_year' is not null and p->>'study_year' not in ('1','2','3','4','5','6') then raise exception 'bad_year'; end if;
    update profiles set study_year = p->>'study_year' where id = v_uid;
  end if;
  if p ? 'program' then
    if p->>'program' is not null and p->>'program' not in ('bus1','bus2','eng1','eng2','log1','des3','cs2','law1') then raise exception 'unknown_program'; end if;
    update profiles set program = p->>'program' where id = v_uid;
  end if;
  return me();
end $$;

-- ---------- ajouter son école (les joueurs créent eux-mêmes les établissements manquants) ----------
create or replace function public.add_school(p_name text, p_city text, p_country text default 'France') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_p profiles; v_s schools; v_short text := ''; v_base text; v_i int := 1; v_w text;
  v_n text := regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g');
  v_c text := regexp_replace(trim(coalesce(p_city,'')), '\s+', ' ', 'g');
  v_co text := coalesce(nullif(regexp_replace(trim(coalesce(p_country,'')), '\s+', ' ', 'g'), ''), 'France');
  v_cols text[] := array['#5B4BFF','#FF6B3D','#3D7BFF','#14B37A','#FF4FA0','#E0A100','#00A6C8','#8B5CF6','#F23F55'];
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_p := ensure_active(v_uid);
  if length(v_n) not between 3 and 80 or length(school_norm(v_n)) < 2 or v_n ~* '(https?:|www\.|@|<|>)' then raise exception 'bad_school_name'; end if;
  if length(v_c) not between 2 and 60 or v_c !~ '[[:alpha:]]' or v_c ~ '[<>@]' then raise exception 'bad_city'; end if;
  if length(v_co) not between 2 and 40 or v_co ~ '[<>@]' then raise exception 'bad_country'; end if;
  -- déjà présente ? (même nom, ou même sigle, dans la même ville) → on renvoie l'existante
  select * into v_s from schools
    where school_norm(city) = school_norm(v_c) and (school_norm(name) = school_norm(v_n) or school_norm(short) = school_norm(v_n))
    order by (school_norm(name) = school_norm(v_n)) desc limit 1;
  if v_s.id is not null then
    return jsonb_build_object('id', v_s.id, 'name', v_s.name, 'short', v_s.short, 'city', v_s.city, 'country', v_s.country, 'domain', v_s.domain, 'col', v_s.col,
      'members', (select count(*) from profiles where school_id = v_s.id and status <> 'banned'), 'existed', true);
  end if;
  if (select count(*) from schools where created_by = v_uid and created_at > now() - interval '1 day') >= 3
     or (select count(*) from schools where created_by = v_uid) >= 10 then raise exception 'rate_limited'; end if;
  -- sigle : on garde les sigles tapés en majuscules (« EM », « HEC »), sinon l'initiale de chaque mot
  for v_w in select w from regexp_split_to_table(v_n, '[^[:alnum:]]+') with ordinality t(w, i) where w <> '' order by i loop
    continue when deaccent(v_w) in ('de','du','des','la','le','les','l','d','et','en','of','the','and','a','au','aux','for','at');
    v_short := v_short || case when v_w ~ '^[[:upper:][:digit:]]{2,5}$' then upper(deaccent(v_w)) else upper(left(deaccent(v_w), 1)) end;
  end loop;
  v_short := left(regexp_replace(v_short, '[^A-Z0-9]', '', 'g'), 5);
  if length(v_short) < 2 then v_short := upper(left(school_norm(v_n), 3)); end if;
  v_base := v_short;
  while exists(select 1 from schools where short = v_short) loop
    v_short := left(v_base, 5 - length(v_i::text)) || v_i; v_i := v_i + 1;
  end loop;
  insert into schools(name, short, city, country, domain, col, status, created_by)
  values (v_n, v_short, v_c, v_co, null, v_cols[1 + ((hashtext(school_norm(v_n))::bigint % 9) + 9) % 9], 'none', v_uid)
  returning * into v_s;
  return jsonb_build_object('id', v_s.id, 'name', v_s.name, 'short', v_s.short, 'city', v_s.city, 'country', v_s.country, 'domain', v_s.domain, 'col', v_s.col, 'members', 0, 'existed', false);
end $$;

-- ---------- lancer une partie ----------
create or replace function public.start_run(p_game text, p_mode text default 'trial', p_track int default 0, p_cat text default 'mix', p_lang text default 'fr') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_p profiles; v_g games; v_sk text; v_seed bigint; v_tr jsonb := setting('tracks'); v_lv int;
  v_id uuid; v_sec jsonb := '{}'; v_out jsonb; v_d record; v_opp record; v_oppj jsonb; v_base numeric; v_os numeric; v_skill numeric;
  v_rec record; v_perm int[]; v_opts jsonb; v_ci int; v_pub jsonb := '[]'; v_secq jsonb := '[]'; v_i int; v_len int; v_w record; v_used text[] := '{}'; v_scr text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  v_p := ensure_active(v_uid);
  select * into v_g from games where id = p_game;
  if v_g.id is null or not v_g.is_on or v_g.dev then raise exception 'game_unavailable'; end if;
  if p_mode not in ('trial','duel','daily','school') then raise exception 'bad_mode'; end if;
  if p_mode = 'school' and v_p.school_id is null then raise exception 'no_school'; end if;
  if (select count(*) from runs where user_id = v_uid and started_at > now() - interval '1 hour') >= 80 then raise exception 'rate_limited'; end if;
  v_lv := level_of(v_p.xp);
  update runs set status = 'void', flag_detail = 'Partie abandonnée' where user_id = v_uid and status = 'open' and started_at < now() - interval '30 minutes';
  if p_mode = 'daily' then
    select * into v_d from daily_today();
    if v_d.game is distinct from p_game then raise exception 'not_daily_game'; end if;
    if (select count(*) from runs where user_id = v_uid and mode = 'daily' and game = p_game and submitted_at >= day_start()) >= 3 then raise exception 'daily_limit'; end if;
    if (select count(*) from runs where user_id = v_uid and mode = 'daily' and started_at >= day_start()) >= 12 then raise exception 'daily_limit'; end if;
    p_track := v_d.track; p_cat := 'mix';
    v_seed := abs(hashtext(today_fr()::text || p_game));
  else
    v_seed := floor(random() * 2147483646)::bigint + 1;
  end if;
  if p_game = 'sprint' then
    p_track := greatest(0, least(2, coalesce(p_track, 0)));
    if p_mode <> 'daily' and (v_tr->p_track->>'lv')::int > v_lv then p_track := 0; end if;
    v_sk := 'sprint@' || p_track;
  else v_sk := p_game; end if;
  if p_lang not in ('fr','en') then p_lang := 'fr'; end if;

  -- adversaire de duel : un vrai joueur proche en cote, sinon le bot RYVO
  if p_mode = 'duel' then
    select p.id, p.username, p.rating, p.avatar, p.frame, s.short, b.best into v_opp
    from profiles p left join schools s on s.id = p.school_id
    join lateral (select case when game_lower(p_game) then min(r.score) else max(r.score) end best from runs r where r.user_id = p.id and r.sk = v_sk and r.status = 'valid') b on b.best is not null
    where p.id <> v_uid and p.status = 'active' and abs(p.rating - v_p.rating) < 300
    order by random() limit 1;
    v_base := coalesce(v_opp.best, case p_game when 'sprint' then round(((v_tr->p_track->>'par')::numeric) * 1.3, 2) when 'reflex' then 285 when 'brain' then 4500 when 'stack' then 350 when 'grid' then 3500 when 'words' then 3000 when 'aim' then 7000 else 0 end);
    if game_lower(p_game) then v_os := v_base * (1 + random() * 0.05); else v_os := v_base * (0.82 + random() * 0.22); end if;
    v_os := case when p_game = 'sprint' then round(v_os, 2) else round(v_os) end;
    v_skill := greatest(0, least(1, (coalesce(v_opp.rating, v_p.rating) - 860) / 800.0));
    if p_game = 'cards' then v_os := null; end if;
    v_oppj := jsonb_build_object('id', v_opp.id, 'name', coalesce(v_opp.username, 'RYVO Bot'), 'rating', coalesce(v_opp.rating, v_p.rating), 'avatar', coalesce(v_opp.avatar, 6),
      'frame', coalesce(v_opp.frame, 'basic'), 'school', v_opp.short, 'score', v_os, 'skill', round(v_skill, 2), 'bot', v_opp.id is null);
    v_sec := v_sec || jsonb_build_object('opp', jsonb_build_object('id', v_opp.id, 'rating', coalesce(v_opp.rating, v_p.rating), 'score', v_os, 'name', coalesce(v_opp.username, 'RYVO Bot')));
  end if;

  -- contenu servi par le serveur
  if p_game = 'brain' then
    if (select count(*) from questions where status = 'published') < 8 then raise exception 'not_enough_questions'; end if;
    for v_rec in select q.* from questions q where q.status = 'published'
        order by (case when p_cat = 'mix' or q.cat = p_cat then 0 else 1 end), md5(v_seed::text || q.id::text) limit 8 loop
      select array_agg(k order by md5(v_seed::text || v_rec.id::text || k::text)) into v_perm from generate_series(0,3) k;
      v_opts := '[]'; v_ci := 0;
      for v_i in 1..4 loop
        v_opts := v_opts || jsonb_build_array(v_rec.answers->v_perm[v_i]);
        if v_perm[v_i] = v_rec.correct then v_ci := v_i - 1; end if;
      end loop;
      v_pub := v_pub || jsonb_build_object('c', v_rec.cat, 'q', jsonb_build_object('fr', v_rec.q_fr, 'en', v_rec.q_en), 'o', v_opts);
      v_secq := v_secq || jsonb_build_object('id', v_rec.id, 'ci', v_ci);
    end loop;
    v_sec := v_sec || jsonb_build_object('q', v_secq, 'ans', '[]'::jsonb);
  elsif p_game = 'words' then
    if (select count(*) from words where lang = p_lang) < 20 then raise exception 'not_enough_words'; end if;
    for v_i in 0..24 loop
      v_len := case when v_i < 2 then 4 when v_i < 4 then 5 when v_i < 7 then 6 when v_i < 10 then 7 else 8 end;
      select w.word, w.cat into v_w from words w where w.lang = p_lang and not (w.word = any(v_used))
        order by (case when length(w.word) = v_len then 0 else 1 end), md5(v_seed::text || v_i || w.word) limit 1;
      exit when v_w.word is null;
      v_used := v_used || v_w.word;
      select string_agg(c, '' order by md5(v_seed::text || v_i || ':' || n)) into v_scr from unnest(string_to_array(v_w.word, null)) with ordinality t(c, n);
      if v_scr = v_w.word then v_scr := reverse(v_w.word); end if;
      v_pub := v_pub || jsonb_build_object('len', length(v_w.word), 'cat', v_w.cat, 'letters', v_scr);
    end loop;
    v_sec := v_sec || jsonb_build_object('w', to_jsonb(v_used), 'cur', 0, 'ev', '[]'::jsonb);
  end if;

  insert into runs(user_id, game, sk, mode, seed, secret, opp_name, extra)
  values (v_uid, p_game, v_sk, p_mode, v_seed, v_sec, v_oppj->>'name', jsonb_build_object('lang', p_lang, 'track', p_track, 'cat', p_cat))
  returning id into v_id;
  v_out := jsonb_build_object('run', v_id, 'seed', v_seed, 'sk', v_sk, 'track', p_track, 'mode', p_mode, 'cat', p_cat, 'opp', v_oppj);
  if p_game = 'brain' then v_out := v_out || jsonb_build_object('questions', v_pub); end if;
  if p_game = 'words' then v_out := v_out || jsonb_build_object('words', v_pub); end if;
  return v_out;
end $$;

-- ---------- Brain Battle : une réponse à la fois, corrigée par le serveur ----------
create or replace function public.answer_question(p_run uuid, p_i int, p_k int, p_t numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_r runs; v_ci int; v_n int;
begin
  select * into v_r from runs where id = p_run and user_id = auth.uid() for update;
  if v_r.id is null or v_r.status <> 'open' or v_r.game <> 'brain' then raise exception 'bad_run'; end if;
  v_n := jsonb_array_length(v_r.secret->'ans');
  if p_i <> v_n or p_i > 7 then raise exception 'bad_index'; end if;
  if p_k not between -1 and 3 then p_k := -1; end if;
  v_ci := (v_r.secret->'q'->p_i->>'ci')::int;
  update runs set secret = jsonb_set(secret, '{ans}', (secret->'ans') || jsonb_build_object('k', p_k, 't', greatest(0, least(10, coalesce(p_t, 10))), 'at', ms(clock_timestamp())))
  where id = p_run;
  update questions set plays = plays + 1, correct_count = correct_count + (case when p_k = v_ci then 1 else 0 end) where id = (v_r.secret->'q'->p_i->>'id')::uuid;
  return jsonb_build_object('correct', v_ci);
end $$;

-- ---------- Word Rush : chaque proposition est vérifiée par le serveur ----------
create or replace function public.sorted_letters(s text) returns text language sql immutable as $$ select string_agg(c, '' order by c) from unnest(string_to_array(s, null)) c $$;
create or replace function public.word_event(p_run uuid, p_i int, p_kind text, p_guess text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_r runs; v_cur int; v_word text; v_ok boolean := false; v_h int; v_g text;
begin
  select * into v_r from runs where id = p_run and user_id = auth.uid() for update;
  if v_r.id is null or v_r.status <> 'open' or v_r.game <> 'words' then raise exception 'bad_run'; end if;
  if now() > v_r.started_at + interval '80 seconds' then raise exception 'time_over'; end if;
  v_cur := (v_r.secret->>'cur')::int;
  if p_i <> v_cur or v_cur >= jsonb_array_length(v_r.secret->'w') then raise exception 'bad_index'; end if;
  v_word := v_r.secret->'w'->>v_cur;
  if p_kind = 'guess' then
    v_g := upper(regexp_replace(coalesce(p_guess,''), '[^A-Za-z]', '', 'g'));
    v_ok := v_g = v_word or (sorted_letters(v_g) = sorted_letters(v_word) and exists(select 1 from words where lang = v_r.extra->>'lang' and word = v_g));
    update runs set secret = secret || jsonb_build_object('ev', (secret->'ev') || jsonb_build_object('i', v_cur, 'k', case when v_ok then 'ok' else 'bad' end, 'at', ms(clock_timestamp()), 'len', length(v_word)),
                                                         'cur', v_cur + (case when v_ok then 1 else 0 end))
    where id = p_run;
    return jsonb_build_object('ok', v_ok);
  elsif p_kind = 'hint' then
    select count(*) into v_h from jsonb_array_elements(v_r.secret->'ev') e where (e->>'i')::int = v_cur and e->>'k' = 'hint';
    if v_h + 1 >= length(v_word) then raise exception 'no_more_hints'; end if;
    update runs set secret = jsonb_set(secret, '{ev}', (secret->'ev') || jsonb_build_object('i', v_cur, 'k', 'hint', 'at', ms(clock_timestamp()))) where id = p_run;
    return jsonb_build_object('letters', left(v_word, v_h + 1));
  elsif p_kind = 'skip' then
    update runs set secret = secret || jsonb_build_object('ev', (secret->'ev') || jsonb_build_object('i', v_cur, 'k', 'skip', 'at', ms(clock_timestamp())), 'cur', v_cur + 1) where id = p_run;
    return jsonb_build_object('word', v_word);
  end if;
  raise exception 'bad_kind';
end $$;

-- ---------- fin de partie : le serveur calcule et valide le score ----------
create or replace function public.submit_run(p_run uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_r runs; v_p profiles; v_el numeric; v_rules jsonb := setting('rules'); v_tr jsonb := setting('tracks');
  v_bad text; v_rule text; v_detail text; v_conf int := 0; v_score numeric; v_perf numeric := 0; v_out text; v_os numeric; v_x int; v_det jsonb := '{}';
  v_par numeric; v_slow numeric; v_t numeric; v_arr numeric[]; v_i int; v_sum numeric; v_avg numeric; v_min numeric; v_fs int;
  v_e jsonb; v_prev bigint; v_streak int; v_best int; v_ok int; v_tt numeric; v_delta numeric; v_pts numeric; v_mult numeric; v_hints int; v_found int; v_skip int; v_dts numeric := 0;
  v_yw int; v_aw int; v_mg int; v_am int; v_fl int; v_pf int; v_bd int; v_hits int; v_shots int;
  v_lower boolean; v_stat record; v_z numeric; v_status text; v_prevbest numeric; v_xp int := 0; v_dr int := 0; v_exp numeric; v_s numeric;
  v_school int := 0; v_w int := 0; v_today date := today_fr(); v_newstreak int; v_m text; v_defs jsonb := mission_defs(); v_award jsonb := '[]'; v_mx int := 0;
  v_rw record; v_rs record;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_r from runs where id = p_run and user_id = v_uid for update;
  if v_r.id is null or v_r.status <> 'open' then raise exception 'bad_run'; end if;
  select * into v_p from profiles where id = v_uid;
  v_el := extract(epoch from (now() - v_r.started_at));
  if v_el > 1800 then update runs set status = 'void', flag_detail = 'Partie expirée', submitted_at = now() where id = p_run; raise exception 'expired'; end if;
  v_lower := game_lower(v_r.game);

  begin
  case v_r.game
  when 'sprint' then
    v_par := (v_tr->((v_r.extra->>'track')::int)->>'par')::numeric; v_slow := (v_tr->((v_r.extra->>'track')::int)->>'slow')::numeric;
    v_t := round((p->>'time')::numeric, 2);
    select array_agg(x::numeric) into v_arr from jsonb_array_elements_text(p->'splits') x;
    if v_t is null or v_t < 5 or v_t > 900 or v_t > v_el + 1 then v_bad := 'temps'; end if;
    if coalesce(array_length(v_arr,1),0) <> 3 or v_arr[1] >= v_arr[2] or v_arr[2] >= v_arr[3] or abs(v_arr[3] - v_t) > 0.2 then v_bad := 'tours'; end if;
    v_score := v_t; v_perf := greatest(0, least(1, (v_slow - v_t) / (v_slow - v_par)));
    v_det := jsonb_build_object('boosts', (p->>'boosts')::int, 'hits', (p->>'hits')::int);
    if (v_rules->'sprint_min'->>'on')::boolean and v_t < v_par * (v_rules->'sprint_min'->>'val')::numeric / 100 then
      v_rule := 'sprint_min'; v_detail := round(v_t / v_par * 100) || ' % du par (seuil ' || (v_rules->'sprint_min'->>'val') || ' %)';
      v_conf := least(99, 70 + round(((v_rules->'sprint_min'->>'val')::numeric - v_t / v_par * 100) * 2)::int);
    end if;
  when 'reflex' then
    select array_agg(x::numeric) into v_arr from jsonb_array_elements_text(p->'times') x;
    v_fs := coalesce((p->>'fs')::int, 0);
    if coalesce(array_length(v_arr,1),0) <> 5 or v_fs not between 0 and 50 then v_bad := 'manches'; else
      select sum(x), min(x) into v_sum, v_min from unnest(v_arr) x;
      if v_min < 0 or (select max(x) from unnest(v_arr) x) > 5000 then v_bad := 'temps'; end if;
      if v_el < v_sum / 1000 + 4 then v_bad := 'durée'; end if;
      v_avg := round(v_sum / 5); v_score := v_avg + v_fs * 10; v_perf := greatest(0, least(1, (420 - v_score) / 220));
      if v_min < 80 then v_rule := 'reflex_min'; v_detail := 'Une manche à ' || v_min || ' ms'; v_conf := 97;
      elsif (v_rules->'reflex_min'->>'on')::boolean and v_avg < (v_rules->'reflex_min'->>'val')::numeric then
        v_rule := 'reflex_min'; v_detail := 'Moyenne ' || v_avg || ' ms (seuil ' || (v_rules->'reflex_min'->>'val') || ' ms)'; v_conf := least(97, 70 + ((v_rules->'reflex_min'->>'val')::numeric - v_avg)::int);
      end if;
      v_det := jsonb_build_object('times', to_jsonb(v_arr), 'fs', v_fs);
    end if;
  when 'brain' then
    if jsonb_array_length(v_r.secret->'ans') <> 8 then v_bad := 'réponses'; else
      v_score := 0; v_streak := 0; v_best := 0; v_ok := 0; v_prev := ms(v_r.started_at); v_sum := 0;
      for v_i in 0..7 loop
        v_e := v_r.secret->'ans'->v_i;
        v_delta := ((v_e->>'at')::bigint - v_prev) / 1000.0; v_prev := (v_e->>'at')::bigint;
        v_tt := greatest(least(greatest((v_e->>'t')::numeric, 0.3), 10), least(10, v_delta - 2.5));
        v_sum := v_sum + v_tt;
        if (v_e->>'k')::int = (v_r.secret->'q'->v_i->>'ci')::int then
          v_ok := v_ok + 1; v_streak := v_streak + 1; v_best := greatest(v_best, v_streak);
          v_mult := case when v_streak >= 5 then 1.5 when v_streak >= 3 then 1.2 else 1 end;
          v_score := v_score + round((500 + 500 * (10 - v_tt) / 10) * v_mult);
        else v_streak := 0; end if;
      end loop;
      v_perf := least(1, v_score / 9000);
      v_det := jsonb_build_object('correct', v_ok, 'total', 8, 'avgT', round(v_sum / 8, 2), 'bestStreak', v_best);
      if v_ok = 8 and v_sum / 8 < 1.2 then v_rule := 'zscore'; v_detail := '8/8 en ' || round(v_sum/8,1) || ' s de moyenne'; v_conf := 80; end if;
    end if;
  when 'words' then
    if v_el < 50 then v_bad := 'durée'; else
      v_score := 0; v_streak := 0; v_best := 0; v_found := 0; v_skip := 0; v_hints := 0; v_prev := ms(v_r.started_at);
      for v_e in select * from jsonb_array_elements(v_r.secret->'ev') loop
        if (v_e->>'at')::bigint > ms(v_r.started_at) + 65000 then exit; end if;
        if v_e->>'k' = 'hint' then v_hints := v_hints + 1; v_streak := 0;
        elsif v_e->>'k' = 'bad' then v_streak := 0;
        elsif v_e->>'k' = 'skip' then v_skip := v_skip + 1; v_streak := 0; v_hints := 0; v_prev := (v_e->>'at')::bigint;
        elsif v_e->>'k' = 'ok' then
          v_delta := ((v_e->>'at')::bigint - v_prev) / 1000.0; v_prev := (v_e->>'at')::bigint; v_dts := v_dts + v_delta;
          v_mult := 1 + least(v_streak, 5) * 0.1; v_streak := v_streak + 1; v_best := greatest(v_best, v_streak);
          v_pts := greatest(50, round(((v_e->>'len')::int * 100 + (case when v_delta < 4 then 200 when v_delta < 8 then 100 else 0 end)) * v_mult) - v_hints * 100);
          v_score := v_score + v_pts; v_found := v_found + 1; v_hints := 0;
        end if;
      end loop;
      v_perf := least(1, v_score / 6500); v_x := v_found;
      v_det := jsonb_build_object('found', v_found, 'skipped', v_skip, 'bestStreak', v_best);
      if (v_rules->'words_speed'->>'on')::boolean and v_found >= 5 and v_dts / v_found < (v_rules->'words_speed'->>'val')::numeric then
        v_rule := 'words_speed'; v_detail := round(v_dts / v_found, 1) || ' s par mot (seuil ' || (v_rules->'words_speed'->>'val') || ' s)'; v_conf := 83;
      end if;
    end if;
  when 'cards' then
    v_yw := (p->>'yw')::int; v_aw := (p->>'aw')::int; v_mg := (p->>'margin')::int; v_am := coalesce((p->>'am')::int, 0);
    if v_yw < 0 or v_aw < 0 or v_yw + v_aw > 5 or v_mg < 0 or v_mg > v_yw * 14 or v_am < 0 or v_am > v_aw * 14 or v_el < 8 then v_bad := 'manches'; end if;
    v_score := v_yw * 200 + v_mg * 10; v_os := v_aw * 200 + v_am * 10; v_perf := v_yw / 5.0;
    v_out := case when v_yw > v_aw then 'win' when v_yw < v_aw then 'loss' else 'draw' end;
    v_det := jsonb_build_object('yw', v_yw, 'aw', v_aw, 'margin', v_mg);
  when 'stack' then
    v_fl := (p->>'floors')::int; v_pf := (p->>'perfects')::int; v_score := (p->>'score')::int;
    if v_fl < 0 or v_fl > 500 or v_pf < 0 or v_pf > v_fl or v_score < v_fl * 10 or v_score > v_fl * 10 + v_pf * 70 or v_el < v_fl * 0.25 + 2 then v_bad := 'tour'; end if;
    v_perf := least(1, v_score / 800.0); v_x := v_fl;
    v_det := jsonb_build_object('floors', v_fl, 'perfects', v_pf, 'maxCombo', (p->>'maxCombo')::int);
  when 'grid' then
    v_bd := (p->>'boards')::int; v_score := (p->>'score')::int;
    if v_bd < 0 or v_bd > 40 or v_score < 0 or v_score > v_bd * 1700 or v_el < 88 then v_bad := 'grilles'; end if;
    v_perf := least(1, v_score / 7000.0); v_x := v_bd;
    v_det := jsonb_build_object('boards', v_bd, 'moves', (p->>'moves')::int, 'maxN', (p->>'maxN')::int);
  when 'aim' then
    v_hits := (p->>'hits')::int; v_shots := (p->>'shots')::int; v_score := (p->>'score')::int;
    if v_hits < 0 or v_hits > v_shots or v_hits > 300 or v_score < 0 or v_score > v_hits * 900 or v_el < 31 then v_bad := 'tirs'; end if;
    v_perf := least(1, v_score / 12000.0); v_x := v_hits;
    v_det := jsonb_build_object('hits', v_hits, 'shots', v_shots, 'maxCombo', (p->>'maxCombo')::int);
  else v_bad := 'jeu';
  end case;
  exception when others then v_bad := 'format';
  end;

  if v_bad is not null or v_score is null then
    update runs set status = 'void', submitted_at = now(), flag_detail = 'Rejetée : données incohérentes (' || coalesce(v_bad,'score') || ')' where id = p_run;
    return jsonb_build_object('rejected', true);
  end if;

  -- règle : bond anormal par rapport à l'historique du joueur
  if (v_rules->'zscore'->>'on')::boolean then
    select avg(score) a, stddev_samp(score) s, count(*) n into v_stat from (select score from runs where user_id = v_uid and sk = v_r.sk and status = 'valid' order by submitted_at desc limit 30) h;
    if v_stat.n >= 10 and v_stat.s > 0 then
      v_z := case when v_lower then (v_stat.a - v_score) / v_stat.s else (v_score - v_stat.a) / v_stat.s end;
      if v_z > (v_rules->'zscore'->>'val')::numeric and v_conf < least(95, 50 + round(v_z * 8)) then
        v_rule := 'zscore'; v_detail := '+' || round(v_z, 1) || ' σ par rapport à ses ' || v_stat.n || ' dernières parties'; v_conf := least(95, 50 + round(v_z * 8));
      end if;
    end if;
  end if;
  -- règle : cadence anormale
  if (v_rules->'rate'->>'on')::boolean and v_rule is null and
     (select count(*) from runs where user_id = v_uid and submitted_at > now() - interval '1 hour') >= (v_rules->'rate'->>'val')::int then
    v_rule := 'rate'; v_detail := 'Plus de ' || (v_rules->'rate'->>'val') || ' parties en 1 heure'; v_conf := 60;
  end if;
  v_status := case when v_rule is null then 'valid' when (v_rules->>'autoVoid')::boolean and v_conf >= 95 then 'void' else 'flagged' end;

  -- résultat du duel
  if v_r.mode = 'duel' and v_r.game <> 'cards' then
    v_os := (v_r.secret->'opp'->>'score')::numeric;
    v_out := case when v_score = v_os then 'draw' when (v_lower and v_score < v_os) or (not v_lower and v_score > v_os) then 'win' else 'loss' end;
  elsif v_r.game <> 'cards' then v_out := null; v_os := null;
  end if;
  if v_r.game = 'cards' and v_r.mode <> 'duel' then null; end if;

  select case when v_lower then min(score) else max(score) end into v_prevbest from runs where user_id = v_uid and sk = v_r.sk and status = 'valid' and id <> p_run;
  if v_status = 'valid' then
    v_xp := 30 + round(v_perf * 60)::int;
    if v_prevbest is not null and ((v_lower and v_score < v_prevbest) or (not v_lower and v_score > v_prevbest)) then v_xp := v_xp + 25; end if;
    if v_r.mode = 'daily' then v_xp := v_xp + 20; end if;
    if v_r.mode = 'school' and v_p.school_id is not null then v_xp := v_xp + 10; v_school := round(50 + v_perf * 150); end if;
    if v_r.mode = 'duel' then
      v_s := case v_out when 'win' then 1 when 'draw' then 0.5 else 0 end;
      v_exp := 1 / (1 + power(10, ((v_r.secret->'opp'->>'rating')::numeric - v_p.rating) / 400.0));
      v_dr := round(32 * (v_s - v_exp));
      if v_out = 'win' then v_dr := greatest(v_dr, 4); v_xp := v_xp + 30; elsif v_out = 'loss' then v_dr := least(v_dr, -4); end if;
    end if;
    v_w := 20 + round(v_perf * 100)::int + (case when v_r.mode = 'duel' and v_out = 'win' then 30 else 0 end);
  else
    v_xp := 10;
  end if;
  v_newstreak := case when v_p.last_day = v_today then v_p.streak when v_p.last_day = v_today - 1 then v_p.streak + 1 else 1 end;

  update runs set submitted_at = now(), score = v_score, perf = round(v_perf, 3), outcome = v_out, opp_score = v_os, xp = v_xp, dr = v_dr, status = v_status,
    flag_rule = v_rule, flag_detail = v_detail, flag_conf = case when v_rule is null then null else v_conf end,
    extra = extra || jsonb_build_object('x', v_x, 'w', v_w, 'school_pts', v_school, 'd', v_det)
  where id = p_run;
  update profiles set xp = xp + v_xp, rating = greatest(0, rating + v_dr), streak = v_newstreak, last_day = v_today, last_seen = now() where id = v_uid;

  foreach v_m in array missions_today() loop
    if not exists(select 1 from missions_claimed where user_id = v_uid and day = v_today and mission = v_m) and mission_prog(v_uid, v_m) >= (v_defs->v_m->>0)::int then
      insert into missions_claimed values (v_uid, v_today, v_m);
      update profiles set xp = xp + (v_defs->v_m->>1)::int where id = v_uid;
      v_mx := v_mx + (v_defs->v_m->>1)::int; v_award := v_award || to_jsonb(v_m);
    end if;
  end loop;

  select * into v_p from profiles where id = v_uid;
  select (l->'me'->>'pos')::int pos, (l->>'total')::int total into v_rw from (select leaderboard(v_r.sk, 'world', 1) l) z;
  select (l->'me'->>'pos')::int pos, (l->>'total')::int total into v_rs from (select leaderboard(v_r.sk, 'school', 1) l) z;
  return jsonb_build_object('score', v_score, 'status', v_status, 'outcome', v_out, 'opp_score', v_os, 'prev', v_prevbest, 'xp', v_xp, 'mission_xp', v_mx, 'missions', v_award,
    'dr', v_dr, 'rating', v_p.rating, 'xp_total', v_p.xp, 'level', level_of(v_p.xp), 'streak', v_p.streak, 'school_gain', v_school,
    'rank_world', v_rw.pos, 'total_world', v_rw.total, 'rank_school', v_rs.pos, 'total_school', v_rs.total, 'details', v_det);
end $$;

-- ---------- classements ----------
create or replace function public.leaderboard(p_board text, p_scope text default 'world', p_limit int default 10) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_me profiles; v_sch schools; v_lower boolean; v_res jsonb;
begin
  if p_board not in ('rating','weekly','monthly','reflex','brain','cards','stack','grid','words','aim','sprint@0','sprint@1','sprint@2') then raise exception 'bad_board'; end if;
  p_limit := greatest(1, least(coalesce(p_limit, 10), 100));
  if v_uid is not null then select * into v_me from profiles where id = v_uid; select * into v_sch from schools where id = v_me.school_id; end if;
  if p_scope = 'friends' then return jsonb_build_object('rows', '[]'::jsonb, 'me', null, 'total', 0, 'unsupported', true); end if;
  if p_scope in ('school','class','city','country') and v_sch.id is null then return jsonb_build_object('rows', '[]'::jsonb, 'me', null, 'total', 0, 'need_school', true); end if;
  if p_scope = 'class' and v_me.study_year is null then return jsonb_build_object('rows', '[]'::jsonb, 'me', null, 'total', 0, 'need_year', true); end if;
  v_lower := p_board not in ('rating','weekly','monthly') and game_lower(split_part(p_board, '@', 1));
  with cand as (
    select p.id, p.username, p.avatar, p.frame, p.school_id,
      case
        when p_board = 'rating' then (case when exists(select 1 from runs r where r.user_id = p.id and r.status = 'valid') then p.rating end)::numeric
        when p_board = 'weekly' then (select nullif(sum((r.extra->>'w')::int), 0) from runs r where r.user_id = p.id and r.status = 'valid' and r.submitted_at >= week_start())::numeric
        when p_board = 'monthly' then (select nullif(sum((r.extra->>'w')::int), 0) from runs r where r.user_id = p.id and r.status = 'valid' and r.submitted_at >= month_start())::numeric
        else (select case when v_lower then min(r.score) else max(r.score) end from runs r where r.user_id = p.id and r.sk = p_board and r.status = 'valid')
      end as val
    from profiles p left join schools s on s.id = p.school_id
    where p.status <> 'banned' and (p_scope = 'world'
      or (p_scope = 'school' and p.school_id = v_sch.id)
      or (p_scope = 'class' and p.school_id = v_sch.id and p.study_year = v_me.study_year)
      or (p_scope = 'city' and s.city = v_sch.city)
      or (p_scope = 'country' and s.country = v_sch.country))
  ), ranked as (
    select *, row_number() over (order by case when v_lower then val end asc, case when not v_lower then val end desc, username) pos from cand where val is not null
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('pos',pos,'id',id,'name',username,'avatar',avatar,'frame',frame,'school',school_id,'val',val) order by pos) from ranked where pos <= p_limit), '[]'),
    'me', (select jsonb_build_object('pos',pos,'id',id,'name',username,'avatar',avatar,'frame',frame,'school',school_id,'val',val) from ranked where id = v_uid),
    'total', (select count(*) from ranked)) into v_res;
  return v_res;
end $$;

create or replace function public.daily_board(p_game text) returns jsonb
language sql stable security definer set search_path = public as $$
  with b as (
    select r.user_id, case when game_lower(p_game) then min(r.score) else max(r.score) end val
    from runs r join profiles p on p.id = r.user_id
    where r.game = p_game and r.mode = 'daily' and r.status = 'valid' and r.submitted_at >= day_start() and p.status <> 'banned' group by r.user_id
  ), ranked as (
    select b.*, p.username, p.avatar, p.frame, p.school_id, row_number() over (order by case when game_lower(p_game) then val end asc, case when not game_lower(p_game) then val end desc) pos
    from b join profiles p on p.id = b.user_id
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('pos',pos,'id',user_id,'name',username,'avatar',avatar,'frame',frame,'school',school_id,'val',val) order by pos) from ranked where pos <= 5), '[]'),
    'me', (select jsonb_build_object('pos',pos,'id',user_id,'name',username,'avatar',avatar,'frame',frame,'school',school_id,'val',val) from ranked where user_id = auth.uid()),
    'total', (select count(*) from ranked)) $$;

create or replace function public.school_cup() returns jsonb
language sql stable security definer set search_path = public as $$
  with s as (
    select sc.id, sc.name, sc.short, sc.city, sc.col,
      (select count(*) from profiles p where p.school_id = sc.id and p.status <> 'banned') members,
      coalesce((select sum((r.extra->>'school_pts')::int) from runs r join profiles p on p.id = r.user_id
                where p.school_id = sc.id and p.status <> 'banned' and r.status = 'valid' and r.mode = 'school' and r.submitted_at >= week_start()), 0) pts
    from schools sc
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'short',short,'city',city,'col',col,'members',members,'pts',pts,'pos',pos,
    'mine', id = (select school_id from profiles where id = auth.uid()),
    'you', case when id = (select school_id from profiles where id = auth.uid()) then
      (select coalesce(sum((extra->>'school_pts')::int),0) from runs where user_id = auth.uid() and status = 'valid' and mode = 'school' and submitted_at >= week_start()) else 0 end) order by pos), '[]')
  from (select s.*, row_number() over (order by pts desc, name) pos from s where members > 0) x $$;

create or replace function public.class_cup() returns jsonb
language sql stable security definer set search_path = public as $$
  with me as (select school_id, study_year from profiles where id = auth.uid()),
  c as (
    select p.study_year, count(*) members,
      coalesce(sum((select sum((r.extra->>'school_pts')::int) from runs r where r.user_id = p.id and r.status = 'valid' and r.mode = 'school' and r.submitted_at >= week_start())), 0) pts
    from profiles p, me where p.school_id = me.school_id and p.study_year is not null and p.status <> 'banned' group by p.study_year
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',study_year,'members',members,'pts',pts,'pos',pos,'mine', study_year = (select study_year from me)) order by pos), '[]')
  from (select c.*, row_number() over (order by pts desc, study_year) pos from c) x $$;

create or replace function public.recent_activity() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'t')::bigint desc), '[]') from (
    select jsonb_build_object('name', p.username, 'avatar', p.avatar, 'sk', r.sk, 's', r.score, 'opp', r.opp_name, 'os', r.opp_score, 'o', r.outcome, 't', ms(r.submitted_at)) x
    from runs r join profiles p on p.id = r.user_id
    where r.status = 'valid' and r.mode = 'duel' and r.game <> 'cards' and p.status <> 'banned' order by r.submitted_at desc limit 6) z $$;

-- ---------- signalement, vérification d'école, données personnelles ----------
create or replace function public.report_player(p_target uuid, p_type text, p_text text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_target = v_uid or not exists(select 1 from profiles where id = p_target) then raise exception 'bad_target'; end if;
  if p_type not in ('Pseudo inapproprié','Triche ou score falsifié','Comportement toxique','Usurpation d’identité','Spam') then raise exception 'bad_type'; end if;
  if (select count(*) from reports where reporter = v_uid and created_at > now() - interval '1 day') >= 5 then raise exception 'rate_limited'; end if;
  insert into reports(reporter, target, type, text) values (v_uid, p_target, p_type, left(coalesce(p_text,''), 500));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.request_verification(p_school text, p_email text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_s schools; v_e text := lower(trim(p_email));
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_s from schools where id = p_school;
  if v_s.id is null then raise exception 'unknown_school'; end if;
  if v_s.domain is null then raise exception 'no_domain'; end if;
  if v_e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email'; end if;
  if split_part(v_e, '@', 2) <> v_s.domain then raise exception 'domain_mismatch'; end if;
  if (select count(*) from verifications where user_id = v_uid and created_at > now() - interval '1 day') >= 3 then raise exception 'rate_limited'; end if;
  update verifications set status = 'rejected', decided_at = now() where user_id = v_uid and status = 'pending';
  insert into verifications(user_id, school_id, email) values (v_uid, p_school, v_e);
  update profiles set school_id = p_school where id = v_uid and school_id is distinct from p_school;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.export_my_data() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) - 'notes' from profiles p where id = auth.uid()),
    'email', (select email from auth.users where id = auth.uid()),
    'runs', (select coalesce(jsonb_agg(jsonb_build_object('game',game,'sk',sk,'mode',mode,'score',score,'status',status,'at',submitted_at) order by submitted_at desc), '[]') from runs where user_id = auth.uid() and submitted_at is not null),
    'reports_sent', (select coalesce(jsonb_agg(jsonb_build_object('type',type,'text',text,'at',created_at)), '[]') from reports where reporter = auth.uid()),
    'verifications', (select coalesce(jsonb_agg(jsonb_build_object('school',school_id,'email',email,'status',status,'at',created_at)), '[]') from verifications where user_id = auth.uid()),
    'purchases', (select coalesce(jsonb_agg(jsonb_build_object('pack',pack_id,'gems',gems,'amount_cents',amount_cents,'currency',currency,'status',status,'at',created_at) order by created_at desc), '[]') from purchases where user_id = auth.uid()),
    'gems', (select coalesce(jsonb_agg(jsonb_build_object('delta',delta,'balance',balance,'reason',reason,'at',at) order by at desc), '[]') from gem_ledger where user_id = auth.uid()),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('item',item_id,'at',at)), '[]') from owned_items where user_id = auth.uid()),
    'leagues_owned', (select coalesce(jsonb_agg(jsonb_build_object('name',name,'code',code,'created',created_at)), '[]') from leagues where owner = auth.uid())
  ) $$;

create or replace function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if exists(select 1 from admins where user_id = v_uid and role = 'super') and (select count(*) from admins where role = 'super') = 1 then raise exception 'last_super_admin'; end if;
  begin
    delete from auth.users where id = v_uid;
  exception when others then
    -- si la suppression du compte d'authentification est refusée, on anonymise le profil
    update profiles set username = 'supprime_' || substr(replace(v_uid::text,'-',''),1,8), status = 'banned', notes = 'Compte supprimé à la demande du joueur', school_id = null where id = v_uid;
    delete from runs where user_id = v_uid; delete from verifications where user_id = v_uid;
  end;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.claim_admin_invite() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_email text; v_conf timestamptz; v_inv admin_invites;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select lower(email), email_confirmed_at into v_email, v_conf from auth.users where id = v_uid;
  select * into v_inv from admin_invites where email = v_email;
  if v_inv.email is null then return jsonb_build_object('ok', false); end if;
  if v_conf is null then raise exception 'email_not_confirmed'; end if;
  insert into admins(user_id, role) values (v_uid, v_inv.role) on conflict (user_id) do update set role = excluded.role;
  delete from admin_invites where email = v_email;
  insert into audit_log(admin_id, admin_name, role, action, target) values (v_uid, (select username from profiles where id = v_uid), v_inv.role, 'a rejoint l’équipe', v_email);
  return jsonb_build_object('ok', true, 'role', v_inv.role);
end $$;
