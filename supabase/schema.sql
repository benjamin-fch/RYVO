-- =====================================================================
--  RYVO · base de données Supabase
--  À coller en une fois dans Supabase > SQL Editor > New query > Run.
--  Le script peut être relancé : il remplace les fonctions sans perdre les données.
--
--  Principe de sécurité : toutes les tables sont verrouillées (RLS activé,
--  aucune règle d'accès direct). Le jeu et l'admin passent uniquement par
--  les fonctions ci-dessous, qui vérifient l'identité, le rôle et la 2FA.
-- =====================================================================

-- ---------- tables ----------
create table if not exists public.schools(
  id text primary key default substr(md5(random()::text),1,8),
  name text not null check (length(name) between 3 and 80),
  short text not null unique check (short ~ '^[A-Z0-9]{2,5}$'),
  city text not null,
  country text not null default 'France',
  domain text not null unique check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  col text not null default '#5B4BFF',
  status text not null default 'none' check (status in ('paid','free','none')),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9._]{3,16}$'),
  avatar int not null default 0 check (avatar between 0 and 9),
  frame text not null default 'basic',
  skin text not null default 'violet',
  lang text not null default 'fr' check (lang in ('fr','en')),
  school_id text references public.schools(id) on delete set null,
  program text,
  xp int not null default 0,
  rating int not null default 1000,
  streak int not null default 0,
  last_day date,
  status text not null default 'active' check (status in ('active','suspended','banned')),
  suspended_until timestamptz,
  verified boolean not null default false,
  plus boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));

create table if not exists public.admins(
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('super','mod','content','partner')),
  created_at timestamptz not null default now()
);
create table if not exists public.admin_invites(
  email text primary key,
  role text not null check (role in ('super','mod','content','partner')),
  invited_by uuid,
  created_at timestamptz not null default now()
);
create table if not exists public.audit_log(
  id bigserial primary key,
  at timestamptz not null default now(),
  admin_id uuid,
  admin_name text,
  role text,
  action text not null,
  target text,
  detail text
);
create table if not exists public.settings(key text primary key, value jsonb not null);

create table if not exists public.games(
  id text primary key,
  name text not null,
  is_on boolean not null default true,
  featured boolean not null default false,
  daily boolean not null default true,
  dev boolean not null default false,
  sort int not null default 0
);
create table if not exists public.questions(
  id uuid primary key default gen_random_uuid(),
  cat text not null check (cat in ('sci','geo','his','spo','tec','bus','cul')),
  q_fr text not null, q_en text not null,
  answers jsonb not null,
  correct int not null check (correct between 0 and 3),
  status text not null default 'draft' check (status in ('draft','published')),
  plays int not null default 0,
  correct_count int not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.words(
  lang text not null check (lang in ('fr','en')),
  word text not null check (word ~ '^[A-Z]{4,8}$'),
  cat text not null,
  primary key (lang, word)
);
create table if not exists public.daily_schedule(
  day date primary key,
  game text not null references public.games(id),
  track int not null default 0 check (track between 0 and 2)
);
create table if not exists public.runs(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null,
  sk text not null,
  mode text not null check (mode in ('trial','duel','daily','school')),
  seed bigint not null,
  started_at timestamptz not null default now(),
  secret jsonb not null default '{}',
  submitted_at timestamptz,
  score numeric,
  perf numeric,
  outcome text,
  opp_name text,
  opp_score numeric,
  xp int not null default 0,
  dr int not null default 0,
  status text not null default 'open' check (status in ('open','valid','flagged','void','archived')),
  flag_rule text, flag_detail text, flag_conf int,
  extra jsonb not null default '{}'
);
create index if not exists runs_board on public.runs (sk, status, score);
create index if not exists runs_user on public.runs (user_id, submitted_at desc);
create index if not exists runs_submitted on public.runs (submitted_at desc);

create table if not exists public.reports(
  id uuid primary key default gen_random_uuid(),
  reporter uuid references public.profiles(id) on delete set null,
  target uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  text text not null default '',
  status text not null default 'open' check (status in ('open','resolved')),
  resolution text,
  created_at timestamptz not null default now()
);
create table if not exists public.verifications(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  school_id text not null references public.schools(id) on delete cascade,
  email text not null,
  method text not null default 'Adresse de l’école',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create table if not exists public.campus_managers(
  id uuid primary key default gen_random_uuid(),
  name text not null, email text not null, school_id text references public.schools(id) on delete cascade,
  role text not null, created_at timestamptz not null default now()
);
create table if not exists public.sponsors(
  id uuid primary key default gen_random_uuid(),
  name text not null, contract text not null default '', period text not null default '',
  amount numeric not null default 0, status text not null default 'En négociation'
);
create table if not exists public.competitions(
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  game text not null references public.games(id),
  format text not null check (format in ('ranking','bracket','school')),
  starts_at timestamptz not null, ends_at timestamptz not null,
  visibility text not null default 'private' check (visibility in ('private','public')),
  school_id text references public.schools(id) on delete set null,
  reward text not null,
  sponsor_id uuid references public.sponsors(id) on delete set null,
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.invoices(
  id text primary key,
  client text not null, type text not null, amount numeric not null check (amount >= 0),
  due date not null, status text not null default 'pending' check (status in ('paid','pending','late')),
  paid_at timestamptz
);
create table if not exists public.seasons(
  n int primary key, ends_at timestamptz not null, closed_at timestamptz, players int
);
create table if not exists public.missions_claimed(
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null, mission text not null,
  primary key (user_id, day, mission)
);

-- ---------- verrouillage : aucun accès direct aux tables ----------
do $$ declare t text; begin
  foreach t in array array['schools','profiles','admins','admin_invites','audit_log','settings','games','questions','words','daily_schedule','runs','reports','verifications','campus_managers','sponsors','competitions','invoices','seasons','missions_claimed'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on all sequences in schema public from anon, authenticated;

-- ---------- réglages par défaut ----------
insert into public.settings(key,value) values
  ('rules','{"reflex_min":{"on":true,"val":120},"sprint_min":{"on":true,"val":85},"zscore":{"on":true,"val":3.5},"rate":{"on":true,"val":40},"words_speed":{"on":false,"val":1.2},"autoVoid":false}'),
  ('security','{"require_mfa":true}'),
  ('tracks','[{"name":"City Loop","par":41.72,"slow":83.44,"lv":1},{"name":"Canyon Run","par":35.65,"slow":71.31,"lv":3},{"name":"Harbor Hairpin","par":40.13,"slow":80.25,"lv":5}]'),
  ('business','{"plus_price":3.99}')
on conflict (key) do nothing;
insert into public.seasons(n, ends_at) select 1, now() + interval '90 days' where not exists (select 1 from public.seasons);
insert into public.games(id,name,is_on,featured,daily,dev,sort) values
  ('sprint','Neon Sprint',true,false,true,false,1),('reflex','Reflex Arena',true,false,true,false,2),('brain','Brain Battle',true,false,true,false,3),
  ('cards','Card Clash',true,false,true,false,4),('stack','Skyline Stack',true,true,true,false,5),('grid','Grid Lock',true,false,true,false,6),
  ('words','Word Rush',true,true,true,false,7),('aim','Pop Shot',true,true,true,false,8),('party','Pulse Party',false,false,false,true,9)
on conflict (id) do nothing;

-- ---------- petits utilitaires ----------
create or replace function public.ms(t timestamptz) returns bigint language sql immutable as $$ select (extract(epoch from t)*1000)::bigint $$;
create or replace function public.today_fr() returns date language sql stable as $$ select (now() at time zone 'Europe/Paris')::date $$;
create or replace function public.week_start() returns timestamptz language sql stable as $$ select (date_trunc('week', now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris' $$;
create or replace function public.month_start() returns timestamptz language sql stable as $$ select (date_trunc('month', now() at time zone 'Europe/Paris')) at time zone 'Europe/Paris' $$;
create or replace function public.level_of(x int) returns int language plpgsql immutable as $$
declare lv int := 1; need int := 200; rem int := greatest(x,0);
begin while rem >= need loop rem := rem - need; lv := lv + 1; need := 200 + 100*(lv-1); end loop; return lv; end $$;
create or replace function public.game_lower(g text) returns boolean language sql immutable as $$ select g in ('sprint','reflex') $$;
create or replace function public.rnd(seed bigint, k text) returns double precision language sql immutable as $$
  select ('x' || lpad(substr(md5(seed::text || ':' || k), 1, 8), 16, '0'))::bit(64)::bigint / 4294967296.0 $$;
create or replace function public.mask_email(e text) returns text language sql immutable as $$
  select case when e is null then null else left(split_part(e,'@',1),1) || '***@' || split_part(e,'@',2) end $$;
create or replace function public.setting(k text) returns jsonb language sql stable security definer set search_path = public as $$ select value from settings where key = k $$;

-- ---------- création automatique du profil à l'inscription ----------
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare u text := coalesce(new.raw_user_meta_data->>'username',''); s text := new.raw_user_meta_data->>'school'; a int := 0;
begin
  if u !~ '^[A-Za-z0-9._]{3,16}$' or exists(select 1 from profiles where lower(username)=lower(u)) or u ~* '(admin|ryvo|moderat|support)' then
    u := 'joueur_' || substr(replace(new.id::text,'-',''),1,8);
  end if;
  begin a := least(7, greatest(0, coalesce((new.raw_user_meta_data->>'avatar')::int,0))); exception when others then a := 0; end;
  if s is not null and not exists(select 1 from schools where id = s) then s := null; end if;
  insert into profiles(id, username, avatar, school_id, lang)
  values (new.id, u, a, s, case when new.raw_user_meta_data->>'lang' = 'en' then 'en' else 'fr' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
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
    'schools', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'short',short,'city',city,'country',country,'domain',domain,'col',col) order by name),'[]') from schools),
    'season', (select jsonb_build_object('n', n, 'ends', ms(ends_at)) from seasons where closed_at is null order by n desc limit 1),
    'tracks', setting('tracks'),
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
    'school_id', v_p.school_id, 'program', v_p.program, 'xp', v_p.xp, 'level', level_of(v_p.xp), 'rating', v_p.rating, 'streak', v_p.streak,
    'status', v_p.status, 'until', ms(v_p.suspended_until), 'verified', v_p.verified, 'plus', v_p.plus,
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
    if (p->>'avatar')::int not between 0 and 7 then raise exception 'locked_item'; end if;
    update profiles set avatar = (p->>'avatar')::int where id = v_uid;
  end if;
  if p ? 'frame' then
    if (p->>'frame') not in ('basic','gold','brand','candy','mint') or v_lv < (case p->>'frame' when 'gold' then 2 when 'brand' then 3 when 'candy' then 5 when 'mint' then 7 else 1 end) then raise exception 'locked_item'; end if;
    update profiles set frame = p->>'frame' where id = v_uid;
  end if;
  if p ? 'skin' then
    if (p->>'skin') not in ('violet','coral','mint','berry') or v_lv < (case p->>'skin' when 'coral' then 3 when 'mint' then 5 when 'berry' then 7 else 1 end) then raise exception 'locked_item'; end if;
    update profiles set skin = p->>'skin' where id = v_uid;
  end if;
  if p ? 'lang' and p->>'lang' in ('fr','en') then update profiles set lang = p->>'lang' where id = v_uid; end if;
  if p ? 'school_id' then
    if p->>'school_id' is not null and not exists(select 1 from schools where id = p->>'school_id') then raise exception 'unknown_school'; end if;
    if p->>'school_id' is distinct from v_p.school_id then
      update profiles set school_id = p->>'school_id', verified = false where id = v_uid;
      update verifications set status = 'rejected', decided_at = now() where user_id = v_uid and status = 'pending';
    end if;
  end if;
  if p ? 'program' then
    if p->>'program' is not null and p->>'program' not in ('bus1','bus2','eng1','eng2','log1','des3','cs2','law1') then raise exception 'unknown_program'; end if;
    update profiles set program = p->>'program' where id = v_uid;
  end if;
  return me();
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
      or (p_scope = 'class' and p.school_id = v_sch.id and p.program is not distinct from v_me.program)
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
                where p.school_id = sc.id and p.verified and r.status = 'valid' and r.mode = 'school' and r.submitted_at >= week_start()), 0) pts
    from schools sc
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'short',short,'city',city,'col',col,'members',members,'pts',pts,'pos',pos,
    'mine', id = (select school_id from profiles where id = auth.uid()),
    'you', case when id = (select school_id from profiles where id = auth.uid()) then
      (select coalesce(sum((extra->>'school_pts')::int),0) from runs where user_id = auth.uid() and status = 'valid' and mode = 'school' and submitted_at >= week_start()) else 0 end) order by pos), '[]')
  from (select s.*, row_number() over (order by pts desc, name) pos from s) x $$;

create or replace function public.class_cup() returns jsonb
language sql stable security definer set search_path = public as $$
  with me as (select school_id, program from profiles where id = auth.uid()),
  c as (
    select p.program, count(*) members,
      coalesce(sum((select sum((r.extra->>'school_pts')::int) from runs r where r.user_id = p.id and r.status = 'valid' and r.mode = 'school' and r.submitted_at >= week_start())), 0) pts
    from profiles p, me where p.school_id = me.school_id and p.program is not null and p.status <> 'banned' group by p.program
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',program,'members',members,'pts',pts,'pos',pos,'mine', program = (select program from me)) order by pos), '[]')
  from (select c.*, row_number() over (order by pts desc, program) pos from c) x $$;

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
    'verifications', (select coalesce(jsonb_agg(jsonb_build_object('school',school_id,'email',email,'status',status,'at',created_at)), '[]') from verifications where user_id = auth.uid())
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
-- =====================================================================
--  Fonctions de la console admin.
--  Chaque fonction vérifie : compte admin + rôle autorisé + double authentification (aal2).
--  Chaque action qui modifie quelque chose est inscrite dans audit_log.
-- =====================================================================

create or replace function public.admin_role() returns text
language sql stable security definer set search_path = public as $$
  select a.role from admins a
  where a.user_id = auth.uid()
    and (coalesce((setting('security')->>'require_mfa')::boolean, true) = false or coalesce(auth.jwt()->>'aal', '') = 'aal2') $$;

create or replace function public.admin_require(variadic p_roles text[]) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_role text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from admins where user_id = auth.uid()) then raise exception 'forbidden'; end if;
  v_role := admin_role();
  if v_role is null then raise exception 'mfa_required'; end if;
  if v_role <> 'super' and not (v_role = any(p_roles)) then raise exception 'forbidden'; end if;
  return v_role;
end $$;

create or replace function public.audit(p_action text, p_target text default null, p_detail text default null) returns void
language sql security definer set search_path = public as $$
  insert into audit_log(admin_id, admin_name, role, action, target, detail)
  values (auth.uid(), (select username from profiles where id = auth.uid()), (select role from admins where user_id = auth.uid()), p_action, p_target, p_detail) $$;

create or replace function public.admin_me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_role text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform claim_admin_invite();
  select role into v_role from admins where user_id = v_uid;
  return jsonb_build_object('role', v_role, 'mfa_ok', admin_role() is not null,
    'require_mfa', coalesce((setting('security')->>'require_mfa')::boolean, true),
    'name', (select username from profiles where id = v_uid), 'email', (select email from auth.users where id = v_uid));
end $$;

create or replace function public.admin_counts() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_require('mod','content','partner');
  return jsonb_build_object(
    'reports', (select count(*) from reports where status = 'open'),
    'flags', (select count(*) from runs where status = 'flagged'),
    'verifs', (select count(*) from verifications where status = 'pending'),
    'late', (select count(*) from invoices where status = 'late' or (status = 'pending' and due < current_date)),
    'drafts', (select count(*) from questions where status = 'draft'));
end $$;

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_require('mod','content','partner');
  return jsonb_build_object(
    'players', (select count(*) from profiles),
    'new7', (select count(*) from profiles where created_at > now() - interval '7 days'),
    'active7', (select count(*) from profiles where last_seen > now() - interval '7 days'),
    'active30', (select count(*) from profiles where last_seen > now() - interval '30 days'),
    'verified', (select count(*) from profiles where verified),
    'plus', (select count(*) from profiles where plus),
    'plus_price', (setting('business')->>'plus_price')::numeric,
    'counts', admin_counts(),
    'series', (select jsonb_agg(jsonb_build_array(ms(d), coalesce(n,0)) order by d) from (
        select gs::timestamptz d, (select count(distinct user_id) from runs r where r.submitted_at >= gs and r.submitted_at < gs + interval '1 day') n
        from generate_series(day_start() - interval '29 days', day_start(), interval '1 day') gs) s),
    'plays', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'plays', (select count(*) from runs r where r.game = g.id and r.submitted_at > now() - interval '7 days')) order by g.sort), '[]') from games g where not g.dev),
    'log', (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('t',ms(at),'who',admin_name,'role',role,'txt',action,'target',target,'detail',detail) x from audit_log order by at desc limit 7) l));
end $$;

-- ---------- joueurs ----------
create or replace function public.admin_player_row(p profiles) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'name', p.username, 'school', p.school_id, 'program', p.program, 'level', level_of(p.xp), 'xp', p.xp, 'rating', p.rating,
    'matches', (select count(*) from runs r where r.user_id = p.id and r.submitted_at is not null),
    'joined', ms(p.created_at), 'last', ms(p.last_seen), 'status', p.status, 'until', ms(p.suspended_until), 'verified', p.verified, 'plus', p.plus,
    'mail', mask_email((select email from auth.users u where u.id = p.id)),
    'reports', (select count(*) from reports r where r.target = p.id and r.status = 'open'), 'notes', p.notes) $$;

create or replace function public.admin_players(p_q text default '', p_status text default 'all', p_school text default 'all', p_ver text default 'all',
  p_sort text default 'last', p_dir int default -1, p_offset int default 0, p_limit int default 20) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_q text := lower(trim(coalesce(p_q,''))); v_res jsonb;
begin
  perform admin_require('mod');
  with f as (
    select p.*, (select count(*) from runs r where r.user_id = p.id and r.submitted_at is not null) m,
      (select count(*) from reports r where r.target = p.id and r.status = 'open') rp
    from profiles p left join auth.users u on u.id = p.id
    where (v_q = '' or lower(p.username) like '%' || v_q || '%' or p.id::text like v_q || '%' or lower(u.email) like '%' || v_q || '%')
      and (p_status = 'all' or p.status = p_status) and (p_school = 'all' or p.school_id = p_school)
      and (p_ver = 'all' or (p_ver = 'yes') = p.verified)
  )
  , o as (
    select f.id, row_number() over (order by
        case when p_sort = 'name' and p_dir > 0 then lower(f.username) end asc, case when p_sort = 'name' and p_dir < 0 then lower(f.username) end desc,
        case when p_sort = 'level' and p_dir > 0 then f.xp end asc, case when p_sort = 'level' and p_dir < 0 then f.xp end desc,
        case when p_sort = 'rating' and p_dir > 0 then f.rating end asc, case when p_sort = 'rating' and p_dir < 0 then f.rating end desc,
        case when p_sort = 'matches' and p_dir > 0 then f.m end asc, case when p_sort = 'matches' and p_dir < 0 then f.m end desc,
        case when p_sort = 'reports' and p_dir > 0 then f.rp end asc, case when p_sort = 'reports' and p_dir < 0 then f.rp end desc,
        case when p_sort = 'last' and p_dir > 0 then f.last_seen end asc, case when p_sort = 'last' and p_dir < 0 then f.last_seen end desc, f.username) ord
    from f)
  select jsonb_build_object('total', (select count(*) from f),
    'rows', coalesce((select jsonb_agg(admin_player_row(pp) order by o.ord) from o join profiles pp on pp.id = o.id
                      where o.ord > greatest(0, p_offset) and o.ord <= greatest(0, p_offset) + least(100, greatest(1, p_limit))), '[]')) into v_res;
  return v_res;
end $$;

create or replace function public.admin_player(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_p profiles;
begin
  perform admin_require('mod');
  select * into v_p from profiles where id = p_id;
  if v_p.id is null then raise exception 'not_found'; end if;
  return admin_player_row(v_p) || jsonb_build_object(
    'reports_list', (select coalesce(jsonb_agg(jsonb_build_object('type',type,'text',text,'status',status,'res',resolution,'t',ms(created_at)) order by created_at desc), '[]') from reports where target = p_id),
    'log', (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('t',ms(at),'who',admin_name,'role',role,'txt',action,'target',target,'detail',detail) x
             from audit_log where target = p_id::text or target = v_p.username order by at desc limit 10) l),
    'runs', (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('sk',sk,'m',mode,'s',score,'st',status,'t',ms(submitted_at)) x from runs where user_id = p_id and submitted_at is not null order by submitted_at desc limit 8) r));
end $$;

create or replace function public.admin_reveal_email(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_e text;
begin
  perform admin_require('mod');
  select email into v_e from auth.users where id = p_id;
  perform audit('a consulté l’e-mail de', (select username from profiles where id = p_id));
  return v_e;
end $$;

create or replace function public.admin_player_action(p_id uuid, p_action text, p_args jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_p profiles; v_new text; v_days int;
begin
  perform admin_require('mod');
  select * into v_p from profiles where id = p_id; if v_p.id is null then raise exception 'not_found'; end if;
  if p_id = auth.uid() and p_action in ('suspend','ban') then raise exception 'cannot_sanction_self'; end if;
  if p_action = 'rename' then
    v_new := trim(p_args->>'name');
    if v_new !~ '^[A-Za-z0-9._]{3,16}$' then raise exception 'bad_username'; end if;
    if exists(select 1 from profiles where lower(username) = lower(v_new) and id <> p_id) then raise exception 'username_taken'; end if;
    update profiles set username = v_new where id = p_id;
    update reports set status = 'resolved', resolution = 'Renommé' where target = p_id and status = 'open' and (type like 'Pseudo%' or type like 'Usurpation%');
    perform audit('a renommé', v_new, 'ancien pseudo : ' || v_p.username);
  elsif p_action = 'suspend' then
    v_days := least(365, greatest(1, coalesce((p_args->>'days')::int, 7)));
    update profiles set status = 'suspended', suspended_until = now() + make_interval(days => v_days) where id = p_id;
    perform audit('a suspendu', v_p.username, v_days || ' j · ' || coalesce(p_args->>'motif', ''));
  elsif p_action = 'ban' then
    if coalesce(p_args->>'motif','') = '' then raise exception 'reason_required'; end if;
    update profiles set status = 'banned', suspended_until = null where id = p_id;
    update reports set status = 'resolved', resolution = 'Banni' where target = p_id and status = 'open';
    perform audit('a banni', v_p.username, (p_args->>'motif') || coalesce(' · ' || nullif(p_args->>'note',''), ''));
  elsif p_action = 'lift' then
    update profiles set status = 'active', suspended_until = null where id = p_id;
    perform audit(case when v_p.status = 'banned' then 'a levé le bannissement de' else 'a levé la suspension de' end, v_p.username);
  elsif p_action = 'reset_scores' then
    update runs set status = 'archived' where user_id = p_id and status in ('valid','flagged');
    perform audit('a réinitialisé les scores de', v_p.username);
  elsif p_action = 'note' then
    update profiles set notes = left(coalesce(p_args->>'text',''), 1000) where id = p_id;
    perform audit('a modifié la note interne de', v_p.username);
  elsif p_action = 'verify' then
    update profiles set verified = coalesce((p_args->>'value')::boolean, true) where id = p_id;
    perform audit(case when coalesce((p_args->>'value')::boolean, true) then 'a vérifié l’étudiant' else 'a retiré la vérification de' end, v_p.username);
  else raise exception 'bad_action'; end if;
  return admin_player(p_id);
end $$;

-- ---------- signalements ----------
create or replace function public.admin_reports(p_status text default 'open') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_require('mod');
  return (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'type', r.type, 'text', r.text, 'status', r.status, 'res', r.resolution, 't', ms(r.created_at),
      'target', jsonb_build_object('id', t.id, 'name', t.username, 'status', t.status, 'until', ms(t.suspended_until), 'open', (select count(*) from reports x where x.target = t.id and x.status = 'open')),
      'reporter', coalesce((select username from profiles where id = r.reporter), '—')) order by r.created_at desc), '[]')
    from reports r join profiles t on t.id = r.target where r.status = case when p_status = 'open' then 'open' else 'resolved' end);
end $$;

create or replace function public.admin_report_action(p_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_r reports; v_t profiles;
begin
  perform admin_require('mod');
  select * into v_r from reports where id = p_id; if v_r.id is null then raise exception 'not_found'; end if;
  select * into v_t from profiles where id = v_r.target;
  if p_action = 'ignore' then update reports set status = 'resolved', resolution = 'Ignoré' where id = p_id; perform audit('a classé sans suite un signalement contre', v_t.username, v_r.type);
  elsif p_action = 'warn' then update reports set status = 'resolved', resolution = 'Averti' where id = p_id; perform audit('a averti', v_t.username, v_r.type);
  elsif p_action = 'suspend' then
    update reports set status = 'resolved', resolution = 'Suspendu 7 j' where id = p_id;
    if v_t.status = 'active' then update profiles set status = 'suspended', suspended_until = now() + interval '7 days' where id = v_t.id; perform audit('a suspendu', v_t.username, '7 j · ' || v_r.type);
    else perform audit('a traité un signalement contre', v_t.username, 'déjà sanctionné'); end if;
  else raise exception 'bad_action'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- anti-triche ----------
create or replace function public.admin_flags(p_status text default 'pending') returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_require('mod');
  return (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'player', jsonb_build_object('id', p.id, 'name', p.username), 'game', r.game, 'sk', r.sk, 'score', r.score,
      'rule', r.flag_rule, 'detail', r.flag_detail, 'conf', r.flag_conf, 't', ms(r.submitted_at), 'status', case when r.status = 'flagged' then 'pending' else r.status end)
      order by case when p_status = 'pending' then r.flag_conf end desc nulls last, r.submitted_at desc), '[]')
    from runs r join profiles p on p.id = r.user_id
    where r.flag_rule is not null and ((p_status = 'pending' and r.status = 'flagged') or (p_status <> 'pending' and r.status in ('valid','void') and (r.extra ? 'reviewed' or r.status = 'void')))
    limit 200);
end $$;

create or replace function public.admin_flag_action(p_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_r runs; v_p profiles; v_lbl text;
begin
  perform admin_require('mod');
  select * into v_r from runs where id = p_id; if v_r.id is null or v_r.status <> 'flagged' then raise exception 'not_pending'; end if;
  select * into v_p from profiles where id = v_r.user_id;
  v_lbl := v_r.sk || ' · ' || v_r.score;
  if p_action = 'valid' then
    update runs set status = 'valid', extra = extra || '{"reviewed":true}' where id = p_id; perform audit('a validé le score de', v_p.username, v_lbl);
  elsif p_action in ('void','voidban') then
    update runs set status = 'void', extra = extra || '{"reviewed":true}' where id = p_id; perform audit('a annulé le score de', v_p.username, v_lbl);
    if p_action = 'voidban' and v_p.status = 'active' then
      update profiles set status = 'suspended', suspended_until = now() + interval '30 days' where id = v_p.id; perform audit('a suspendu', v_p.username, '30 j · Triche ou score falsifié');
    end if;
  else raise exception 'bad_action'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_rules() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin perform admin_require('mod'); return setting('rules'); end $$;

create or replace function public.admin_set_rules(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_cur jsonb := setting('rules'); v_k text;
begin
  perform admin_require('mod');
  foreach v_k in array array['reflex_min','sprint_min','zscore','rate','words_speed'] loop
    if p ? v_k then
      if (p->v_k->>'val')::numeric <= 0 then raise exception 'bad_threshold'; end if;
      v_cur := jsonb_set(v_cur, array[v_k], jsonb_build_object('on', coalesce((p->v_k->>'on')::boolean, true), 'val', (p->v_k->>'val')::numeric));
    end if;
  end loop;
  if p ? 'autoVoid' then v_cur := jsonb_set(v_cur, '{autoVoid}', to_jsonb((p->>'autoVoid')::boolean)); end if;
  update settings set value = v_cur where key = 'rules';
  perform audit('a modifié les règles anti-triche');
  return v_cur;
end $$;

create or replace function public.admin_reset_board(p_board text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform admin_require('mod');
  if p_board = 'rating' then update profiles set rating = 1000;
  elsif p_board in ('reflex','brain','cards','stack','grid','words','aim','sprint@0','sprint@1','sprint@2') then update runs set status = 'archived' where sk = p_board and status in ('valid','flagged');
  else raise exception 'bad_board'; end if;
  perform audit('a réinitialisé le classement', p_board);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- contenu ----------
create or replace function public.admin_questions() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_require('content');
  return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'cat', cat, 'q', jsonb_build_object('fr', q_fr, 'en', q_en), 'a', answers, 'correct', correct, 'status', status,
    'plays', plays, 'rate', case when plays > 0 then round(correct_count * 100.0 / plays) else 0 end) order by created_at desc), '[]') from questions);
end $$;

create or replace function public.admin_save_question(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p->>'id','')::uuid; v_a jsonb := p->'a'; v_i int;
begin
  perform admin_require('content');
  if length(trim(p->'q'->>'fr')) < 10 or length(trim(p->'q'->>'en')) < 10 then raise exception 'question_too_short'; end if;
  if jsonb_array_length(v_a) <> 4 then raise exception 'four_answers'; end if;
  for v_i in 0..3 loop if coalesce(trim(v_a->v_i->>'fr'),'') = '' or coalesce(trim(v_a->v_i->>'en'),'') = '' then raise exception 'empty_answer'; end if; end loop;
  if (select count(distinct lower(trim(x->>'fr'))) from jsonb_array_elements(v_a) x) < 4 then raise exception 'duplicate_answers'; end if;
  if (p->>'correct')::int not between 0 and 3 or p->>'cat' not in ('sci','geo','his','spo','tec','bus','cul') or p->>'status' not in ('draft','published') then raise exception 'bad_fields'; end if;
  if exists(select 1 from questions where lower(q_fr) = lower(trim(p->'q'->>'fr')) and id is distinct from v_id) then raise exception 'duplicate_question'; end if;
  if v_id is null then
    insert into questions(cat, q_fr, q_en, answers, correct, status) values (p->>'cat', trim(p->'q'->>'fr'), trim(p->'q'->>'en'), v_a, (p->>'correct')::int, p->>'status') returning id into v_id;
    perform audit(case when p->>'status' = 'published' then 'a publié une question' else 'a créé une question en brouillon' end, '« ' || trim(p->'q'->>'fr') || ' »');
  else
    update questions set cat = p->>'cat', q_fr = trim(p->'q'->>'fr'), q_en = trim(p->'q'->>'en'), answers = v_a, correct = (p->>'correct')::int, status = p->>'status' where id = v_id;
    perform audit('a modifié une question', '« ' || trim(p->'q'->>'fr') || ' »');
  end if;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.admin_question_action(p_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_q questions;
begin
  perform admin_require('content');
  select * into v_q from questions where id = p_id; if v_q.id is null then raise exception 'not_found'; end if;
  if p_action = 'toggle' then
    update questions set status = case when status = 'published' then 'draft' else 'published' end where id = p_id;
    perform audit(case when v_q.status = 'published' then 'a dépublié une question' else 'a publié une question' end, '« ' || v_q.q_fr || ' »');
  elsif p_action = 'delete' then
    delete from questions where id = p_id; perform audit('a supprimé une question', '« ' || v_q.q_fr || ' »');
  else raise exception 'bad_action'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_words(p_lang text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_require('content');
  return jsonb_build_object('fr', (select count(*) from words where lang = 'fr'), 'en', (select count(*) from words where lang = 'en'),
    'list', (select coalesce(jsonb_agg(jsonb_build_object('w', word, 'c', cat) order by length(word), word), '[]') from words where lang = p_lang));
end $$;

create or replace function public.admin_word(p_lang text, p_word text, p_cat text, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_w text := upper(translate(coalesce(p_word,''), 'àâäáãéèêëíìîïóòôöõúùûüçñÀÂÄÁÃÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')); v_ana text;
begin
  perform admin_require('content');
  if p_lang not in ('fr','en') then raise exception 'bad_lang'; end if;
  v_w := regexp_replace(v_w, '[^A-Z]', '', 'g');
  if p_action = 'add' then
    if v_w !~ '^[A-Z]{4,8}$' then raise exception 'word_length'; end if;
    if coalesce(trim(p_cat),'') = '' then raise exception 'category_required'; end if;
    if exists(select 1 from words where lang = p_lang and word = v_w) then raise exception 'word_exists'; end if;
    select word into v_ana from words where lang = p_lang and sorted_letters(word) = sorted_letters(v_w) limit 1;
    insert into words values (p_lang, v_w, left(trim(p_cat), 20));
    perform audit('a ajouté le mot', v_w, upper(p_lang) || ' · ' || trim(p_cat));
    return jsonb_build_object('word', v_w, 'anagram', v_ana);
  elsif p_action = 'delete' then
    delete from words where lang = p_lang and word = v_w; perform audit('a supprimé le mot', v_w, upper(p_lang));
    return jsonb_build_object('ok', true);
  end if;
  raise exception 'bad_action';
end $$;

create or replace function public.admin_games() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_require('content');
  return (select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'on', is_on, 'feat', featured, 'daily', daily, 'dev', dev,
    'plays', (select count(*) from runs r where r.game = g.id and r.submitted_at > now() - interval '7 days')) order by sort) from games g);
end $$;

create or replace function public.admin_set_game(p_id text, p_field text, p_val boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_g games;
begin
  perform admin_require('content');
  select * into v_g from games where id = p_id; if v_g.id is null or v_g.dev then raise exception 'not_found'; end if;
  if p_field = 'on' then update games set is_on = p_val, daily = case when p_val then daily else false end where id = p_id;
  elsif p_field = 'featured' then update games set featured = p_val where id = p_id;
  elsif p_field = 'daily' then
    if p_val and not v_g.is_on then raise exception 'game_off'; end if;
    update games set daily = p_val where id = p_id;
  else raise exception 'bad_field'; end if;
  perform audit(case p_field when 'on' then case when p_val then 'a activé le jeu' else 'a désactivé le jeu' end
                  when 'featured' then case when p_val then 'a mis en vedette' else 'a retiré de la vedette' end
                  else case when p_val then 'a ajouté au Défi du jour' else 'a retiré du Défi du jour' end end, v_g.name);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- compétitions, Défi du jour, saisons ----------
create or replace function public.admin_comps() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_require('content','partner');
  return jsonb_build_object(
    'comps', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'game', c.game, 'format', c.format, 'start', ms(c.starts_at), 'end', ms(c.ends_at),
        'vis', c.visibility, 'school', coalesce(c.school_id, 'all'), 'reward', c.reward, 'sponsor', c.sponsor_id, 'cancelled', c.cancelled,
        'players', (select count(distinct r.user_id) from runs r join profiles p on p.id = r.user_id where r.game = c.game and r.submitted_at between c.starts_at and c.ends_at and (c.school_id is null or p.school_id = c.school_id))
      ) order by c.starts_at desc), '[]') from competitions c),
    'sponsors', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name)), '[]') from sponsors),
    'schools', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'short', short) order by name), '[]') from schools),
    'daily', (select jsonb_agg(jsonb_build_object('day', ms(d::timestamp at time zone 'Europe/Paris'), 'date', d,
        'game', coalesce(s.game, (select g.id from games g where g.is_on and g.daily and not g.dev order by md5(d::text || g.id) limit 1)),
        'track', coalesce(s.track, abs(hashtext(d::text || 't')) % 3), 'set', s.day is not null) order by d)
      from generate_series(today_fr()::timestamp, (today_fr() + 6)::timestamp, interval '1 day') gs(d0) cross join lateral (select gs.d0::date d) dd left join daily_schedule s on s.day = dd.d),
    'season', (select jsonb_build_object('n', n, 'end', ms(ends_at)) from seasons where closed_at is null order by n desc limit 1),
    'past', (select coalesce(jsonb_agg(jsonb_build_object('n', n, 'end', ms(closed_at), 'players', players) order by n), '[]') from seasons where closed_at is not null));
end $$;

create or replace function public.admin_save_comp(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_s timestamptz := (p->>'start')::timestamptz; v_e timestamptz := (p->>'end')::timestamptz; v_id uuid;
begin
  perform admin_require('content','partner');
  if length(trim(coalesce(p->>'name',''))) < 3 then raise exception 'name_too_short'; end if;
  if exists(select 1 from competitions where lower(name) = lower(trim(p->>'name'))) then raise exception 'name_taken'; end if;
  if v_s < day_start() then raise exception 'start_in_past'; end if;
  if v_e < v_s then raise exception 'end_before_start'; end if;
  if coalesce(trim(p->>'reward'),'') = '' then raise exception 'reward_required'; end if;
  insert into competitions(name, game, format, starts_at, ends_at, visibility, school_id, reward, sponsor_id)
  values (trim(p->>'name'), p->>'game', p->>'format', v_s, v_e, coalesce(p->>'vis','private'), nullif(nullif(p->>'school',''),'all'), trim(p->>'reward'), nullif(p->>'sponsor','')::uuid)
  returning id into v_id;
  perform audit('a créé la compétition', trim(p->>'name'), (p->>'game') || ' · ' || to_char(v_s, 'DD/MM'));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.admin_comp_action(p_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_c competitions; v_n text;
begin
  perform admin_require('content','partner');
  select * into v_c from competitions where id = p_id; if v_c.id is null then raise exception 'not_found'; end if;
  if p_action = 'cancel' then
    if v_c.starts_at <= now() then raise exception 'already_started'; end if;
    update competitions set cancelled = true where id = p_id; perform audit('a annulé la compétition', v_c.name);
  elsif p_action = 'dup' then
    v_n := v_c.name || ' (copie)'; while exists(select 1 from competitions where name = v_n) loop v_n := v_n || '+'; end loop;
    insert into competitions(name, game, format, starts_at, ends_at, visibility, school_id, reward, sponsor_id)
    values (v_n, v_c.game, v_c.format, greatest(v_c.starts_at, now()) + interval '7 days', greatest(v_c.ends_at, now()) + interval '7 days', v_c.visibility, v_c.school_id, v_c.reward, v_c.sponsor_id);
    perform audit('a dupliqué la compétition', v_c.name);
  else raise exception 'bad_action'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_set_daily(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_x jsonb;
begin
  perform admin_require('content','partner');
  for v_x in select * from jsonb_array_elements(p) loop
    if not exists(select 1 from games where id = v_x->>'game' and is_on and not dev) then raise exception 'game_unavailable'; end if;
    insert into daily_schedule(day, game, track) values ((v_x->>'date')::date, v_x->>'game', coalesce((v_x->>'track')::int, 0))
    on conflict (day) do update set game = excluded.game, track = excluded.track;
  end loop;
  perform audit('a modifié le planning du Défi du jour');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_season_action(p_action text, p_end timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_s seasons;
begin
  perform admin_require('content','partner');
  select * into v_s from seasons where closed_at is null order by n desc limit 1;
  if p_action = 'set_end' then
    if p_end is null or p_end <= now() then raise exception 'end_in_past'; end if;
    update seasons set ends_at = p_end where n = v_s.n; perform audit('a modifié la fin de la saison', v_s.n::text, to_char(p_end, 'DD/MM/YYYY'));
  elsif p_action = 'close' then
    update seasons set closed_at = now(), players = (select count(*) from profiles where status = 'active' and exists(select 1 from runs r where r.user_id = profiles.id and r.status = 'valid')) where n = v_s.n;
    update profiles set rating = round((rating + 1000) / 2.0);
    insert into seasons(n, ends_at) values (v_s.n + 1, now() + interval '90 days');
    perform audit('a clôturé la saison', v_s.n::text);
  else raise exception 'bad_action'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- écoles ----------
create or replace function public.admin_schools() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_require('partner');
  return jsonb_build_object(
    'schools', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'short', s.short, 'city', s.city, 'country', s.country, 'domain', s.domain, 'col', s.col, 'status', s.status,
        'players', (select count(*) from profiles p where p.school_id = s.id), 'verified', (select count(*) from profiles p where p.school_id = s.id and p.verified)) order by s.name), '[]') from schools s),
    'verifs', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'player', jsonb_build_object('id', p.id, 'name', p.username), 'school', v.school_id,
        'local', left(split_part(v.email,'@',1),1) || '***', 'domain', split_part(v.email,'@',2), 'match', split_part(v.email,'@',2) = s.domain, 'method', v.method, 't', ms(v.created_at)) order by v.created_at), '[]')
      from verifications v join profiles p on p.id = v.user_id join schools s on s.id = v.school_id where v.status = 'pending'),
    'managers', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'email', email, 'school', school_id, 'role', role, 't', ms(created_at)) order by created_at), '[]') from campus_managers));
end $$;

create or replace function public.admin_save_school(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id text := nullif(p->>'id',''); v_short text := upper(trim(p->>'short')); v_dom text := lower(regexp_replace(trim(p->>'domain'), '^@', ''));
begin
  perform admin_require('partner');
  if length(trim(coalesce(p->>'name',''))) < 3 then raise exception 'name_too_short'; end if;
  if v_short !~ '^[A-Z0-9]{2,5}$' then raise exception 'bad_short'; end if;
  if v_dom !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' then raise exception 'bad_domain'; end if;
  if exists(select 1 from schools where short = v_short and id is distinct from v_id) then raise exception 'short_taken'; end if;
  if exists(select 1 from schools where domain = v_dom and id is distinct from v_id) then raise exception 'domain_taken'; end if;
  if coalesce(trim(p->>'city'),'') = '' then raise exception 'city_required'; end if;
  if v_id is null then
    insert into schools(name, short, city, country, domain, col, status) values (trim(p->>'name'), v_short, trim(p->>'city'), coalesce(nullif(trim(p->>'country'),''),'France'), v_dom, coalesce(p->>'col','#5B4BFF'), coalesce(p->>'status','none'));
    perform audit('a ajouté l’établissement', trim(p->>'name'));
  else
    update schools set name = trim(p->>'name'), short = v_short, city = trim(p->>'city'), country = coalesce(nullif(trim(p->>'country'),''),'France'), domain = v_dom, col = coalesce(p->>'col', col), status = coalesce(p->>'status', status) where id = v_id;
    perform audit('a modifié l’établissement', trim(p->>'name'));
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_verif_action(p_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_v verifications; v_s schools; v_p profiles;
begin
  perform admin_require('partner');
  select * into v_v from verifications where id = p_id and status = 'pending'; if v_v.id is null then raise exception 'not_pending'; end if;
  select * into v_s from schools where id = v_v.school_id; select * into v_p from profiles where id = v_v.user_id;
  if p_action = 'ok' then
    if split_part(v_v.email,'@',2) <> v_s.domain then raise exception 'domain_mismatch'; end if;
    update verifications set status = 'approved', decided_at = now() where id = p_id;
    update profiles set verified = true, school_id = v_v.school_id where id = v_v.user_id;
    perform audit('a vérifié l’étudiant', v_p.username, v_s.short);
  elsif p_action = 'no' then
    update verifications set status = 'rejected', decided_at = now() where id = p_id;
    perform audit('a refusé la vérification de', v_p.username, v_s.short);
  else raise exception 'bad_action'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_manager(p_action text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m campus_managers;
begin
  perform admin_require('partner');
  if p_action = 'add' then
    if coalesce(trim(p->>'name'),'') = '' or coalesce(trim(p->>'role'),'') = '' or (p->>'email') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_fields'; end if;
    insert into campus_managers(name, email, school_id, role) values (trim(p->>'name'), lower(trim(p->>'email')), p->>'school', trim(p->>'role'));
    perform audit('a ajouté un responsable de campus', trim(p->>'name'), (select short from schools where id = p->>'school'));
  elsif p_action = 'remove' then
    delete from campus_managers where id = (p->>'id')::uuid returning * into v_m;
    perform audit('a retiré l’accès de', v_m.name);
  else raise exception 'bad_action'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- revenus ----------
create or replace function public.admin_business() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_require('partner');
  return jsonb_build_object(
    'subs', (select count(*) from profiles where plus), 'plus_price', (setting('business')->>'plus_price')::numeric,
    'invoices', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'client', client, 'type', type, 'amount', amount, 'due', ms(due::timestamptz),
        'status', case when status = 'pending' and due < current_date then 'late' else status end) order by due), '[]') from invoices),
    'sponsors', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'contract', contract, 'period', period, 'amount', amount, 'status', status) order by name), '[]') from sponsors),
    'rev', (select jsonb_agg(jsonb_build_object('m', ms(m), 'plus', (select count(*) from profiles where plus) * (setting('business')->>'plus_price')::numeric,
        'campus', coalesce((select sum(amount) from invoices where status = 'paid' and type = 'Licence campus' and date_trunc('month', paid_at) = m), 0),
        'events', coalesce((select sum(amount) from invoices where status = 'paid' and type in ('Événement BDE','Team building') and date_trunc('month', paid_at) = m), 0),
        'sponsors', coalesce((select sum(amount) from invoices where status = 'paid' and type = 'Sponsoring' and date_trunc('month', paid_at) = m), 0)) order by m)
      from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m));
end $$;

create or replace function public.admin_invoice(p_action text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_i invoices;
begin
  perform admin_require('partner');
  if p_action = 'add' then
    if coalesce(trim(p->>'client'),'') = '' or (p->>'amount')::numeric <= 0 or p->>'type' not in ('Licence campus','Événement BDE','Team building','Sponsoring') then raise exception 'bad_fields'; end if;
    insert into invoices(id, client, type, amount, due) values ('F-' || to_char(now(),'YYYY') || '-' || lpad(((select count(*) from invoices) + 1)::text, 3, '0'), trim(p->>'client'), p->>'type', (p->>'amount')::numeric, (p->>'due')::date) returning * into v_i;
    perform audit('a créé la facture', v_i.id, v_i.client || ' · ' || v_i.amount || ' €');
  elsif p_action = 'paid' then
    update invoices set status = 'paid', paid_at = now() where id = p->>'id' returning * into v_i;
    perform audit('a marqué payée la facture', v_i.id, v_i.amount || ' €');
  elsif p_action = 'remind' then
    perform audit('a relancé la facture', p->>'id');
  else raise exception 'bad_action'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_sponsor(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform admin_require('partner');
  if coalesce(trim(p->>'name'),'') = '' then raise exception 'bad_fields'; end if;
  insert into sponsors(name, contract, period, amount, status) values (trim(p->>'name'), coalesce(p->>'contract',''), coalesce(p->>'period',''), coalesce((p->>'amount')::numeric, 0), coalesce(p->>'status','En négociation'));
  perform audit('a ajouté le sponsor', trim(p->>'name'));
  return jsonb_build_object('ok', true);
end $$;

-- ---------- équipe & journal ----------
create or replace function public.admin_team() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_require(variadic '{}'::text[]);
  return jsonb_build_object(
    'admins', (select coalesce(jsonb_agg(jsonb_build_object('id', a.user_id, 'name', coalesce(p.username, u.email), 'mail', u.email, 'role', a.role,
        'tfa', exists(select 1 from auth.mfa_factors f where f.user_id = a.user_id and f.status = 'verified'), 'last', ms(u.last_sign_in_at), 'me', a.user_id = auth.uid()) order by a.created_at), '[]')
      from admins a join auth.users u on u.id = a.user_id left join profiles p on p.id = a.user_id),
    'invites', (select coalesce(jsonb_agg(jsonb_build_object('mail', email, 'role', role, 't', ms(created_at))), '[]') from admin_invites));
end $$;

create or replace function public.admin_team_action(p_action text, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := nullif(p->>'id','')::uuid; v_old text;
begin
  perform admin_require(variadic '{}'::text[]);
  if p_action = 'role' then
    if p->>'role' not in ('super','mod','content','partner') then raise exception 'bad_role'; end if;
    select role into v_old from admins where user_id = v_uid;
    if v_old = 'super' and p->>'role' <> 'super' and (select count(*) from admins where role = 'super') <= 1 then raise exception 'last_super_admin'; end if;
    update admins set role = p->>'role' where user_id = v_uid;
    perform audit('a changé le rôle de', (select username from profiles where id = v_uid), p->>'role');
  elsif p_action = 'invite' then
    if (p->>'mail') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or p->>'role' not in ('mod','content','partner','super') then raise exception 'bad_fields'; end if;
    if exists(select 1 from admins a join auth.users u on u.id = a.user_id where lower(u.email) = lower(p->>'mail')) then raise exception 'already_admin'; end if;
    insert into admin_invites(email, role, invited_by) values (lower(trim(p->>'mail')), p->>'role', auth.uid()) on conflict (email) do update set role = excluded.role;
    perform audit('a invité un membre', lower(trim(p->>'mail')), p->>'role');
  elsif p_action = 'cancel_invite' then
    delete from admin_invites where email = lower(p->>'mail'); perform audit('a annulé l’invitation de', lower(p->>'mail'));
  elsif p_action = 'remove' then
    if v_uid = auth.uid() then raise exception 'cannot_remove_self'; end if;
    delete from admins where user_id = v_uid; perform audit('a retiré de l’équipe', (select username from profiles where id = v_uid));
  else raise exception 'bad_action'; end if;
  return admin_team();
end $$;

create or replace function public.admin_log(p_q text default '', p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_require(variadic '{}'::text[]);
  return (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('t', ms(at), 'who', admin_name, 'role', role, 'txt', action, 'target', target, 'detail', detail) x
    from audit_log where coalesce(p_q,'') = '' or lower(concat_ws(' ', admin_name, action, target, detail)) like '%' || lower(p_q) || '%'
    order by at desc limit least(500, greatest(1, p_limit))) l);
end $$;
-- =====================================================================
--  Contenu de départ : questions Brain Battle et mots Word Rush (modifiables dans l'admin)
-- =====================================================================
insert into public.questions(cat,q_fr,q_en,answers,correct,status)
select * from (values
  ('sci',$q$Quel gaz les plantes absorbent-elles pour la photosynthèse ?$q$,$q$Which gas do plants take in for photosynthesis?$q$,$q$[{"fr":"Dioxyde de carbone","en":"Carbon dioxide"},{"fr":"Oxygène","en":"Oxygen"},{"fr":"Azote","en":"Nitrogen"},{"fr":"Hélium","en":"Helium"}]$q$::jsonb,0,'published'),
  ('sci',$q$Combien d’os compte le squelette d’un adulte ?$q$,$q$How many bones does a typical adult human skeleton have?$q$,$q$[{"fr":"206","en":"206"},{"fr":"186","en":"186"},{"fr":"230","en":"230"},{"fr":"312","en":"312"}]$q$::jsonb,0,'published'),
  ('sci',$q$Quel est le symbole chimique du sodium ?$q$,$q$What is the chemical symbol for sodium?$q$,$q$[{"fr":"Na","en":"Na"},{"fr":"So","en":"So"},{"fr":"Sd","en":"Sd"},{"fr":"Sn","en":"Sn"}]$q$::jsonb,0,'published'),
  ('sci',$q$Quelle planète fait le tour du Soleil le plus vite ?$q$,$q$Which planet takes the least time to orbit the Sun?$q$,$q$[{"fr":"Mercure","en":"Mercury"},{"fr":"Vénus","en":"Venus"},{"fr":"Mars","en":"Mars"},{"fr":"Terre","en":"Earth"}]$q$::jsonb,0,'published'),
  ('sci',$q$À quelle vitesse environ la lumière voyage-t-elle dans le vide ?$q$,$q$Roughly how fast does light travel in a vacuum?$q$,$q$[{"fr":"300 000 km/s","en":"300,000 km/s"},{"fr":"30 000 km/s","en":"30,000 km/s"},{"fr":"3 000 km/s","en":"3,000 km/s"},{"fr":"3 millions de km/s","en":"3 million km/s"}]$q$::jsonb,0,'published'),
  ('sci',$q$Quel est le matériau naturel le plus dur ?$q$,$q$What is the hardest natural material?$q$,$q$[{"fr":"Diamant","en":"Diamond"},{"fr":"Quartz","en":"Quartz"},{"fr":"Granite","en":"Granite"},{"fr":"Fer","en":"Iron"}]$q$::jsonb,0,'published'),
  ('sci',$q$Au niveau de la mer, à quelle température l’eau bout-elle ?$q$,$q$At sea level, at what temperature does water boil?$q$,$q$[{"fr":"100 °C","en":"100 °C"},{"fr":"90 °C","en":"90 °C"},{"fr":"120 °C","en":"120 °C"},{"fr":"80 °C","en":"80 °C"}]$q$::jsonb,0,'published'),
  ('geo',$q$Quelle est la capitale du Canada ?$q$,$q$What is the capital of Canada?$q$,$q$[{"fr":"Ottawa","en":"Ottawa"},{"fr":"Toronto","en":"Toronto"},{"fr":"Montréal","en":"Montreal"},{"fr":"Vancouver","en":"Vancouver"}]$q$::jsonb,0,'published'),
  ('geo',$q$Quel détroit sépare l’Espagne du Maroc ?$q$,$q$Which strait separates Spain from Morocco?$q$,$q$[{"fr":"Détroit de Gibraltar","en":"Strait of Gibraltar"},{"fr":"Bosphore","en":"Bosphorus"},{"fr":"Détroit d’Ormuz","en":"Strait of Hormuz"},{"fr":"Détroit de Béring","en":"Bering Strait"}]$q$::jsonb,0,'published'),
  ('geo',$q$Quel est le plus grand désert chaud du monde ?$q$,$q$Which is the largest hot desert on Earth?$q$,$q$[{"fr":"Sahara","en":"Sahara"},{"fr":"Gobi","en":"Gobi"},{"fr":"Kalahari","en":"Kalahari"},{"fr":"Atacama","en":"Atacama"}]$q$::jsonb,0,'published'),
  ('geo',$q$Quel fleuve rejette le plus d’eau dans l’océan ?$q$,$q$Which river discharges the most water into the ocean?$q$,$q$[{"fr":"Amazone","en":"Amazon"},{"fr":"Nil","en":"Nile"},{"fr":"Yangzi","en":"Yangtze"},{"fr":"Mississippi","en":"Mississippi"}]$q$::jsonb,0,'published'),
  ('geo',$q$Quel est le plus grand océan ?$q$,$q$Which is the largest ocean?$q$,$q$[{"fr":"Pacifique","en":"Pacific"},{"fr":"Atlantique","en":"Atlantic"},{"fr":"Indien","en":"Indian"},{"fr":"Arctique","en":"Arctic"}]$q$::jsonb,0,'published'),
  ('geo',$q$En comptant l’outre-mer, quel pays couvre le plus de fuseaux horaires ?$q$,$q$Counting overseas territories, which country spans the most time zones?$q$,$q$[{"fr":"France","en":"France"},{"fr":"Russie","en":"Russia"},{"fr":"États-Unis","en":"United States"},{"fr":"Chine","en":"China"}]$q$::jsonb,0,'published'),
  ('geo',$q$Quelle est la capitale de l’Australie ?$q$,$q$What is the capital of Australia?$q$,$q$[{"fr":"Canberra","en":"Canberra"},{"fr":"Sydney","en":"Sydney"},{"fr":"Melbourne","en":"Melbourne"},{"fr":"Perth","en":"Perth"}]$q$::jsonb,0,'published'),
  ('his',$q$En quelle année le mur de Berlin est-il tombé ?$q$,$q$In which year did the Berlin Wall fall?$q$,$q$[{"fr":"1989","en":"1989"},{"fr":"1991","en":"1991"},{"fr":"1985","en":"1985"},{"fr":"1979","en":"1979"}]$q$::jsonb,0,'published'),
  ('his',$q$Qui a introduit l’imprimerie à caractères mobiles en Europe vers 1450 ?$q$,$q$Who brought movable-type printing to Europe around 1450?$q$,$q$[{"fr":"Johannes Gutenberg","en":"Johannes Gutenberg"},{"fr":"Léonard de Vinci","en":"Leonardo da Vinci"},{"fr":"Martin Luther","en":"Martin Luther"},{"fr":"Galilée","en":"Galileo Galilei"}]$q$::jsonb,0,'published'),
  ('his',$q$Quelle civilisation a construit le Machu Picchu ?$q$,$q$Which civilisation built Machu Picchu?$q$,$q$[{"fr":"Les Incas","en":"Inca"},{"fr":"Les Aztèques","en":"Aztec"},{"fr":"Les Mayas","en":"Maya"},{"fr":"Les Olmèques","en":"Olmec"}]$q$::jsonb,0,'published'),
  ('his',$q$Qui a été le premier humain dans l’espace ?$q$,$q$Who was the first person to travel into space?$q$,$q$[{"fr":"Yuri Gagarin","en":"Yuri Gagarin"},{"fr":"Neil Armstrong","en":"Neil Armstrong"},{"fr":"Alan Shepard","en":"Alan Shepard"},{"fr":"Valentina Tereshkova","en":"Valentina Tereshkova"}]$q$::jsonb,0,'published'),
  ('his',$q$En quelle année la Révolution française a-t-elle commencé ?$q$,$q$In which year did the French Revolution begin?$q$,$q$[{"fr":"1789","en":"1789"},{"fr":"1799","en":"1799"},{"fr":"1776","en":"1776"},{"fr":"1815","en":"1815"}]$q$::jsonb,0,'published'),
  ('his',$q$Quelle ville était la capitale de l’Empire byzantin ?$q$,$q$Which city was the capital of the Byzantine Empire?$q$,$q$[{"fr":"Constantinople","en":"Constantinople"},{"fr":"Rome","en":"Rome"},{"fr":"Athènes","en":"Athens"},{"fr":"Alexandrie","en":"Alexandria"}]$q$::jsonb,0,'published'),
  ('his',$q$Quelle femme a reçu la première un prix Nobel ?$q$,$q$Who was the first woman to win a Nobel Prize?$q$,$q$[{"fr":"Marie Curie","en":"Marie Curie"},{"fr":"Ada Lovelace","en":"Ada Lovelace"},{"fr":"Rosalind Franklin","en":"Rosalind Franklin"},{"fr":"Florence Nightingale","en":"Florence Nightingale"}]$q$::jsonb,0,'published'),
  ('spo',$q$Au football à 11, combien de joueurs par équipe sont sur le terrain ?$q$,$q$In 11-a-side football, how many players per team are on the pitch?$q$,$q$[{"fr":"11","en":"11"},{"fr":"10","en":"10"},{"fr":"9","en":"9"},{"fr":"12","en":"12"}]$q$::jsonb,0,'published'),
  ('spo',$q$Combien de sets un homme doit-il gagner pour remporter un match de Grand Chelem ?$q$,$q$How many sets must a man win to take a Grand Slam match?$q$,$q$[{"fr":"3","en":"3"},{"fr":"2","en":"2"},{"fr":"4","en":"4"},{"fr":"5","en":"5"}]$q$::jsonb,0,'published'),
  ('spo',$q$Quelle est la longueur d’un marathon olympique ?$q$,$q$How long is an Olympic marathon?$q$,$q$[{"fr":"42,195 km","en":"42.195 km"},{"fr":"40 km","en":"40 km"},{"fr":"45,5 km","en":"45.5 km"},{"fr":"39,2 km","en":"39.2 km"}]$q$::jsonb,0,'published'),
  ('spo',$q$Que montre l’arbitre pour expulser un joueur au football ?$q$,$q$What does a referee show to send a player off in football?$q$,$q$[{"fr":"Un carton rouge","en":"A red card"},{"fr":"Un carton jaune","en":"A yellow card"},{"fr":"Un carton blanc","en":"A white card"},{"fr":"Un carton vert","en":"A green card"}]$q$::jsonb,0,'published'),
  ('spo',$q$Combien de joueurs par équipe sur un terrain de basket ?$q$,$q$How many players per team are on a basketball court?$q$,$q$[{"fr":"5","en":"5"},{"fr":"6","en":"6"},{"fr":"7","en":"7"},{"fr":"4","en":"4"}]$q$::jsonb,0,'published'),
  ('spo',$q$Quel pays a accueilli les Jeux olympiques d’été 2024 ?$q$,$q$Which country hosted the 2024 Summer Olympics?$q$,$q$[{"fr":"France","en":"France"},{"fr":"Japon","en":"Japan"},{"fr":"États-Unis","en":"United States"},{"fr":"Australie","en":"Australia"}]$q$::jsonb,0,'published'),
  ('spo',$q$Au rugby à XV, combien de points vaut un essai ?$q$,$q$In rugby union, how many points is a try worth?$q$,$q$[{"fr":"5","en":"5"},{"fr":"3","en":"3"},{"fr":"4","en":"4"},{"fr":"7","en":"7"}]$q$::jsonb,0,'published'),
  ('tec',$q$Que signifie CPU ?$q$,$q$What does CPU stand for?$q$,$q$[{"fr":"Central Processing Unit","en":"Central Processing Unit"},{"fr":"Computer Power Unit","en":"Computer Power Unit"},{"fr":"Core Program Utility","en":"Core Program Utility"},{"fr":"Central Peripheral Unit","en":"Central Peripheral Unit"}]$q$::jsonb,0,'published'),
  ('tec',$q$Comment s’écrit le nombre 5 en binaire ?$q$,$q$How is the decimal number 5 written in binary?$q$,$q$[{"fr":"101","en":"101"},{"fr":"110","en":"110"},{"fr":"011","en":"011"},{"fr":"111","en":"111"}]$q$::jsonb,0,'published'),
  ('tec',$q$Quel code HTTP signifie « Not Found » ?$q$,$q$Which HTTP status code means “Not Found”?$q$,$q$[{"fr":"404","en":"404"},{"fr":"500","en":"500"},{"fr":"301","en":"301"},{"fr":"200","en":"200"}]$q$::jsonb,0,'published'),
  ('tec',$q$Qui a lancé le noyau Linux en 1991 ?$q$,$q$Who started the Linux kernel in 1991?$q$,$q$[{"fr":"Linus Torvalds","en":"Linus Torvalds"},{"fr":"Richard Stallman","en":"Richard Stallman"},{"fr":"Bill Gates","en":"Bill Gates"},{"fr":"Tim Berners-Lee","en":"Tim Berners-Lee"}]$q$::jsonb,0,'published'),
  ('tec',$q$Combien de bits dans un octet ?$q$,$q$How many bits are in a byte?$q$,$q$[{"fr":"8","en":"8"},{"fr":"4","en":"4"},{"fr":"16","en":"16"},{"fr":"10","en":"10"}]$q$::jsonb,0,'published'),
  ('tec',$q$Quelle entreprise a racheté Android en 2005 ?$q$,$q$Which company bought Android in 2005?$q$,$q$[{"fr":"Google","en":"Google"},{"fr":"Apple","en":"Apple"},{"fr":"Microsoft","en":"Microsoft"},{"fr":"Samsung","en":"Samsung"}]$q$::jsonb,0,'published'),
  ('tec',$q$Que signifie le « www » des adresses web ?$q$,$q$What does the “www” in web addresses stand for?$q$,$q$[{"fr":"World Wide Web","en":"World Wide Web"},{"fr":"World Web Window","en":"World Web Window"},{"fr":"Wide WebWorldwide","en":"Wide WebWorldwide"},{"fr":"Web World Wire","en":"Web World Wire"}]$q$::jsonb,0,'published'),
  ('bus',$q$En transport maritime, que signifie EVP (TEU) ?$q$,$q$In shipping, what does TEU stand for?$q$,$q$[{"fr":"Équivalent vingt pieds","en":"Twenty-foot Equivalent Unit"},{"fr":"Unité totale d’export","en":"Total Export Unit"},{"fr":"Unité d’échange transport","en":"Transport Exchange Unit"},{"fr":"Équivalent tonne","en":"Ton Equivalent Unit"}]$q$::jsonb,0,'published'),
  ('bus',$q$Dans l’Incoterm « FOB », que veut dire le B ?$q$,$q$In the Incoterm “FOB”, what does the B stand for?$q$,$q$[{"fr":"Board","en":"Board"},{"fr":"Bill","en":"Bill"},{"fr":"Border","en":"Border"},{"fr":"Bond","en":"Bond"}]$q$::jsonb,0,'published'),
  ('bus',$q$Que signifie « B2B » ?$q$,$q$What does “B2B” mean?$q$,$q$[{"fr":"Entre entreprises","en":"Business to business"},{"fr":"Retour aux bases","en":"Back to basics"},{"fr":"D’acheteur à acheteur","en":"Buyer to buyer"},{"fr":"De marque à marque","en":"Brand to brand"}]$q$::jsonb,0,'published'),
  ('bus',$q$Que signifie KPI ?$q$,$q$What does KPI stand for?$q$,$q$[{"fr":"Key Performance Indicator","en":"Key Performance Indicator"},{"fr":"Key Product Index","en":"Key Product Index"},{"fr":"Known Profit Increase","en":"Known Profit Increase"},{"fr":"Key Process Input","en":"Key Process Input"}]$q$::jsonb,0,'published'),
  ('bus',$q$Quel est le premier port à conteneurs du monde ?$q$,$q$Which is the world’s busiest container port?$q$,$q$[{"fr":"Shanghai","en":"Shanghai"},{"fr":"Rotterdam","en":"Rotterdam"},{"fr":"Singapour","en":"Singapore"},{"fr":"Los Angeles","en":"Los Angeles"}]$q$::jsonb,0,'published'),
  ('bus',$q$En entrepôt, que signifie FIFO ?$q$,$q$In warehousing, what does FIFO mean?$q$,$q$[{"fr":"Premier entré, premier sorti","en":"First In, First Out"},{"fr":"Entrée rapide, sortie rapide","en":"Fast In, Fast Out"},{"fr":"Fret entrant, fret sortant","en":"Freight In, Freight Out"},{"fr":"Première facture, première commande","en":"First Invoice, First Order"}]$q$::jsonb,0,'published'),
  ('bus',$q$Quelle est la monnaie du Japon ?$q$,$q$Which currency is used in Japan?$q$,$q$[{"fr":"Yen","en":"Yen"},{"fr":"Won","en":"Won"},{"fr":"Yuan","en":"Yuan"},{"fr":"Ringgit","en":"Ringgit"}]$q$::jsonb,0,'published'),
  ('cul',$q$Quelle langue compte le plus de locuteurs natifs ?$q$,$q$Which language has the most native speakers?$q$,$q$[{"fr":"Chinois mandarin","en":"Mandarin Chinese"},{"fr":"Anglais","en":"English"},{"fr":"Espagnol","en":"Spanish"},{"fr":"Hindi","en":"Hindi"}]$q$::jsonb,0,'published'),
  ('cul',$q$Combien de vers compte un sonnet classique ?$q$,$q$How many lines does a traditional sonnet have?$q$,$q$[{"fr":"14","en":"14"},{"fr":"12","en":"12"},{"fr":"16","en":"16"},{"fr":"10","en":"10"}]$q$::jsonb,0,'published'),
  ('cul',$q$Quelle couleur mélanger au jaune pour obtenir du vert ?$q$,$q$Which colour do you mix with yellow to make green paint?$q$,$q$[{"fr":"Bleu","en":"Blue"},{"fr":"Rouge","en":"Red"},{"fr":"Blanc","en":"White"},{"fr":"Noir","en":"Black"}]$q$::jsonb,0,'published'),
  ('cul',$q$Qui a peint La Joconde ?$q$,$q$Who painted the Mona Lisa?$q$,$q$[{"fr":"Léonard de Vinci","en":"Leonardo da Vinci"},{"fr":"Michel-Ange","en":"Michelangelo"},{"fr":"Raphaël","en":"Raphael"},{"fr":"Botticelli","en":"Botticelli"}]$q$::jsonb,0,'published'),
  ('cul',$q$Combien de cordes a une guitare classique ?$q$,$q$How many strings does a standard guitar have?$q$,$q$[{"fr":"6","en":"6"},{"fr":"4","en":"4"},{"fr":"5","en":"5"},{"fr":"7","en":"7"}]$q$::jsonb,0,'published'),
  ('cul',$q$Dans quelle ville se trouve le musée du Louvre ?$q$,$q$In which city is the Louvre museum?$q$,$q$[{"fr":"Paris","en":"Paris"},{"fr":"Lyon","en":"Lyon"},{"fr":"Bruxelles","en":"Brussels"},{"fr":"Rome","en":"Rome"}]$q$::jsonb,0,'published'),
  ('cul',$q$Quel instrument a généralement 88 touches ?$q$,$q$Which instrument usually has 88 keys?$q$,$q$[{"fr":"Piano","en":"Piano"},{"fr":"Orgue","en":"Organ"},{"fr":"Accordéon","en":"Accordion"},{"fr":"Clavecin","en":"Harpsichord"}]$q$::jsonb,0,'published')
) v(cat,q_fr,q_en,answers,correct,status)
where not exists (select 1 from public.questions q where q.q_fr = v.q_fr);

insert into public.words(lang,word,cat) values
  ('fr','CHAT',$q$Animal$q$),
  ('fr','LAIT',$q$Boisson$q$),
  ('fr','VELO',$q$Transport$q$),
  ('fr','PAIN',$q$Aliment$q$),
  ('fr','JUDO',$q$Sport$q$),
  ('fr','LUNE',$q$Espace$q$),
  ('fr','ROBE',$q$Vêtement$q$),
  ('fr','MAIN',$q$Corps$q$),
  ('fr','CERF',$q$Animal$q$),
  ('fr','GOLF',$q$Sport$q$),
  ('fr','THON',$q$Animal$q$),
  ('fr','TAXI',$q$Transport$q$),
  ('fr','TIGRE',$q$Animal$q$),
  ('fr','PIANO',$q$Musique$q$),
  ('fr','POMME',$q$Fruit$q$),
  ('fr','PLAGE',$q$Lieu$q$),
  ('fr','NUAGE',$q$Météo$q$),
  ('fr','TRAIN',$q$Transport$q$),
  ('fr','ZEBRE',$q$Animal$q$),
  ('fr','SAPIN',$q$Nature$q$),
  ('fr','TENTE',$q$Objet$q$),
  ('fr','AVION',$q$Transport$q$),
  ('fr','NEIGE',$q$Météo$q$),
  ('fr','RUGBY',$q$Sport$q$),
  ('fr','ORAGE',$q$Météo$q$),
  ('fr','LAPIN',$q$Animal$q$),
  ('fr','FUSEE',$q$Espace$q$),
  ('fr','TENNIS',$q$Sport$q$),
  ('fr','BANANE',$q$Fruit$q$),
  ('fr','MOUTON',$q$Animal$q$),
  ('fr','CAMION',$q$Transport$q$),
  ('fr','CERISE',$q$Fruit$q$),
  ('fr','JARDIN',$q$Lieu$q$),
  ('fr','VOLCAN',$q$Nature$q$),
  ('fr','TOMATE',$q$Légume$q$),
  ('fr','CRAYON',$q$Objet$q$),
  ('fr','BATEAU',$q$Transport$q$),
  ('fr','CHEVAL',$q$Animal$q$),
  ('fr','CINEMA',$q$Lieu$q$),
  ('fr','REQUIN',$q$Animal$q$),
  ('fr','SOLEIL',$q$Espace$q$),
  ('fr','GUITARE',$q$Musique$q$),
  ('fr','PLANETE',$q$Espace$q$),
  ('fr','CHATEAU',$q$Lieu$q$),
  ('fr','MEDECIN',$q$Métier$q$),
  ('fr','POMPIER',$q$Métier$q$),
  ('fr','FROMAGE',$q$Aliment$q$),
  ('fr','MANTEAU',$q$Vêtement$q$),
  ('fr','DAUPHIN',$q$Animal$q$),
  ('fr','CUISINE',$q$Lieu$q$),
  ('fr','VOITURE',$q$Transport$q$),
  ('fr','HOPITAL',$q$Lieu$q$),
  ('fr','CAROTTE',$q$Légume$q$),
  ('fr','ELEPHANT',$q$Animal$q$),
  ('fr','PINGOUIN',$q$Animal$q$),
  ('fr','ECUREUIL',$q$Animal$q$),
  ('fr','AEROPORT',$q$Lieu$q$),
  ('fr','CYCLISME',$q$Sport$q$),
  ('fr','TRACTEUR',$q$Transport$q$),
  ('fr','MONTAGNE',$q$Nature$q$),
  ('fr','SANDWICH',$q$Aliment$q$),
  ('fr','HANDBALL',$q$Sport$q$),
  ('fr','PAPILLON',$q$Animal$q$),
  ('en','FROG',$q$Animal$q$),
  ('en','SOFA',$q$Object$q$),
  ('en','HAIL',$q$Weather$q$),
  ('en','DRUM',$q$Music$q$),
  ('en','KITE',$q$Toy$q$),
  ('en','CAKE',$q$Food$q$),
  ('en','JUDO',$q$Sport$q$),
  ('en','BOAT',$q$Transport$q$),
  ('en','FISH',$q$Animal$q$),
  ('en','MILK',$q$Drink$q$),
  ('en','HAND',$q$Body$q$),
  ('en','SOCK',$q$Clothing$q$),
  ('en','TIGER',$q$Animal$q$),
  ('en','PIANO',$q$Music$q$),
  ('en','PASTA',$q$Food$q$),
  ('en','STORM',$q$Weather$q$),
  ('en','TRAIN',$q$Transport$q$),
  ('en','RIVER',$q$Nature$q$),
  ('en','CHAIR',$q$Object$q$),
  ('en','PIZZA',$q$Food$q$),
  ('en','SKIRT',$q$Clothing$q$),
  ('en','JUDGE',$q$Job$q$),
  ('en','BEACH',$q$Place$q$),
  ('en','MOUSE',$q$Animal$q$),
  ('en','PLANT',$q$Nature$q$),
  ('en','SHIRT',$q$Clothing$q$),
  ('en','EAGLE',$q$Animal$q$),
  ('en','GUITAR',$q$Music$q$),
  ('en','PLANET',$q$Space$q$),
  ('en','ROCKET',$q$Space$q$),
  ('en','PALACE',$q$Place$q$),
  ('en','DOCTOR',$q$Job$q$),
  ('en','SOCCER',$q$Sport$q$),
  ('en','TENNIS',$q$Sport$q$),
  ('en','BANANA',$q$Food$q$),
  ('en','JACKET',$q$Clothing$q$),
  ('en','ISLAND',$q$Nature$q$),
  ('en','RABBIT',$q$Animal$q$),
  ('en','BRIDGE',$q$Place$q$),
  ('en','MUSEUM',$q$Place$q$),
  ('en','WINTER',$q$Season$q$),
  ('en','POTATO',$q$Food$q$),
  ('en','DOLPHIN',$q$Animal$q$),
  ('en','AIRPORT',$q$Place$q$),
  ('en','VOLCANO',$q$Nature$q$),
  ('en','PENGUIN',$q$Animal$q$),
  ('en','CHICKEN',$q$Food$q$),
  ('en','TRUMPET',$q$Music$q$),
  ('en','LIBRARY',$q$Place$q$),
  ('en','DENTIST',$q$Job$q$),
  ('en','CYCLING',$q$Sport$q$),
  ('en','RAINBOW',$q$Weather$q$),
  ('en','BICYCLE',$q$Transport$q$),
  ('en','KITCHEN',$q$Place$q$),
  ('en','PYRAMID',$q$Place$q$),
  ('en','ELEPHANT',$q$Animal$q$),
  ('en','SANDWICH',$q$Food$q$),
  ('en','BASEBALL',$q$Sport$q$),
  ('en','MOUNTAIN',$q$Nature$q$),
  ('en','HOSPITAL',$q$Place$q$),
  ('en','DINOSAUR',$q$Animal$q$),
  ('en','UMBRELLA',$q$Object$q$),
  ('en','KEYBOARD',$q$Object$q$),
  ('en','NOTEBOOK',$q$Object$q$),
  ('en','AIRPLANE',$q$Transport$q$)
on conflict do nothing;
-- =====================================================================
--  Droits d'exécution : seules ces fonctions sont accessibles depuis le web.
-- =====================================================================
revoke execute on all functions in schema public from public, anon, authenticated;

-- lisibles sans compte (classements publics)
grant execute on function public.public_info(), public.leaderboard(text,text,int), public.daily_board(text), public.school_cup(), public.recent_activity() to anon, authenticated;

-- joueurs connectés
grant execute on function public.me(), public.update_profile(jsonb), public.start_run(text,text,int,text,text), public.answer_question(uuid,int,int,numeric),
  public.word_event(uuid,int,text,text), public.submit_run(uuid,jsonb), public.class_cup(), public.report_player(uuid,text,text),
  public.request_verification(text,text), public.export_my_data(), public.delete_my_account(), public.claim_admin_invite() to authenticated;

-- console admin (chaque fonction vérifie elle-même le rôle et la double authentification)
grant execute on function public.admin_me(), public.admin_counts(), public.admin_overview(),
  public.admin_players(text,text,text,text,text,int,int,int), public.admin_player(uuid), public.admin_reveal_email(uuid), public.admin_player_action(uuid,text,jsonb),
  public.admin_reports(text), public.admin_report_action(uuid,text), public.admin_flags(text), public.admin_flag_action(uuid,text),
  public.admin_rules(), public.admin_set_rules(jsonb), public.admin_reset_board(text),
  public.admin_questions(), public.admin_save_question(jsonb), public.admin_question_action(uuid,text), public.admin_words(text), public.admin_word(text,text,text,text),
  public.admin_games(), public.admin_set_game(text,text,boolean),
  public.admin_comps(), public.admin_save_comp(jsonb), public.admin_comp_action(uuid,text), public.admin_set_daily(jsonb), public.admin_season_action(text,timestamptz),
  public.admin_schools(), public.admin_save_school(jsonb), public.admin_verif_action(uuid,text), public.admin_manager(text,jsonb),
  public.admin_business(), public.admin_invoice(text,jsonb), public.admin_sponsor(jsonb),
  public.admin_team(), public.admin_team_action(text,jsonb), public.admin_log(text,int) to authenticated;
