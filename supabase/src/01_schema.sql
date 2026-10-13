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

-- évolutions d'une base existante (sans perte de données)
-- les joueurs ajoutent eux-mêmes leur école : le domaine e-mail devient facultatif
alter table public.schools alter column domain drop not null;
alter table public.schools add column if not exists created_by uuid references auth.users(id) on delete set null;
-- année d'études déclarée par le joueur (1 = 1re année / Bac+1 … 6 = Bac+6 et plus)
alter table public.profiles add column if not exists study_year text;
alter table public.profiles add column if not exists school_set_at timestamptz;
do $$ begin
  alter table public.profiles add constraint profiles_study_year_check check (study_year in ('1','2','3','4','5','6'));
exception when duplicate_object then null; end $$;

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
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.admin_invites enable row level security;
alter table public.audit_log enable row level security;
alter table public.settings enable row level security;
alter table public.games enable row level security;
alter table public.questions enable row level security;
alter table public.words enable row level security;
alter table public.daily_schedule enable row level security;
alter table public.runs enable row level security;
alter table public.reports enable row level security;
alter table public.verifications enable row level security;
alter table public.campus_managers enable row level security;
alter table public.sponsors enable row level security;
alter table public.competitions enable row level security;
alter table public.invoices enable row level security;
alter table public.seasons enable row level security;
alter table public.missions_claimed enable row level security;
revoke all on public.schools from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.admins from anon, authenticated;
revoke all on public.admin_invites from anon, authenticated;
revoke all on public.audit_log from anon, authenticated;
revoke all on public.settings from anon, authenticated;
revoke all on public.games from anon, authenticated;
revoke all on public.questions from anon, authenticated;
revoke all on public.words from anon, authenticated;
revoke all on public.daily_schedule from anon, authenticated;
revoke all on public.runs from anon, authenticated;
revoke all on public.reports from anon, authenticated;
revoke all on public.verifications from anon, authenticated;
revoke all on public.campus_managers from anon, authenticated;
revoke all on public.sponsors from anon, authenticated;
revoke all on public.competitions from anon, authenticated;
revoke all on public.invoices from anon, authenticated;
revoke all on public.seasons from anon, authenticated;
revoke all on public.missions_claimed from anon, authenticated;
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
-- comparaison de noms d'écoles sans accents, majuscules ni ponctuation (« École Polytechnique » = « ecole polytechnique »)
create or replace function public.deaccent(t text) returns text language sql immutable as $$
  select translate(lower(coalesce(t,'')), 'àáâãäåāçćčèéêëēėęîïíīįìłñńôöòóœøōõßśšûüùúūÿýžźż',
    'aaaaaaa' || 'ccc' || 'eeeeeee' || 'iiiiii' || 'l' || 'nn' || 'oooooooo' || 's' || 'ss' || 'uuuuu' || 'yy' || 'zzz') $$;
create or replace function public.school_norm(t text) returns text language sql immutable as $$ select regexp_replace(deaccent(t), '[^a-z0-9]+', '', 'g') $$;
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

-- ---------- boutique (gemmes, cosmétiques, achats) — voir 06_shop.sql ----------
alter table public.profiles add column if not exists gems int not null default 0;
-- plus d'avatars possibles (les avatars de la boutique ont les numéros 8 à 15)
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check check (avatar between 0 and 15);

create table if not exists public.shop_items(
  id text primary key,                                  -- ex. 'frame:neon'
  kind text not null check (kind in ('avatar','frame','skin')),
  ref text not null,                                    -- valeur côté jeu : numéro d'avatar, cadre ou thème
  name_fr text not null, name_en text not null,
  price int not null check (price between 1 and 100000),
  active boolean not null default true,
  sort int not null default 0,
  unique (kind, ref)
);
create table if not exists public.owned_items(
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.shop_items(id) on delete cascade,
  source text not null default 'shop',
  at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create table if not exists public.gem_packs(
  id text primary key,
  gems int not null check (gems > 0),
  price_cents int not null check (price_cents >= 50),
  active boolean not null default true,
  sort int not null default 0
);
create table if not exists public.purchases(
  id uuid primary key default gen_random_uuid(),
  session_id text not null unique,
  payment_intent text,
  user_id uuid references public.profiles(id) on delete set null,
  pack_id text,
  gems int not null default 0,
  amount_cents int not null,
  currency text not null,
  status text not null check (status in ('paid','mismatch','refunded')),
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  refunded_at timestamptz
);
create table if not exists public.gem_ledger(
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta int not null,
  balance int not null,
  reason text not null check (reason in ('purchase','item','ad','refund','admin','league')),
  ref text,
  at timestamptz not null default now()
);
create index if not exists gem_ledger_user on public.gem_ledger (user_id, reason, at desc);

alter table public.shop_items enable row level security;
alter table public.owned_items enable row level security;
alter table public.gem_packs enable row level security;
alter table public.purchases enable row level security;
alter table public.gem_ledger enable row level security;
revoke all on public.shop_items from anon, authenticated;
revoke all on public.owned_items from anon, authenticated;
revoke all on public.gem_packs from anon, authenticated;
revoke all on public.purchases from anon, authenticated;
revoke all on public.gem_ledger from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- catalogue de départ (modifiable ensuite depuis la console : prix, actif/inactif)
insert into public.gem_packs(id, gems, price_cents, sort) values
  ('s', 100, 99, 1), ('m', 550, 499, 2), ('l', 1200, 999, 3)
on conflict (id) do nothing;
insert into public.shop_items(id, kind, ref, name_fr, name_en, price, sort) values
  ('avatar:8',  'avatar', '8',  'Le Roi',        'The King',      200, 10),
  ('avatar:9',  'avatar', '9',  'Bandeau',       'Headband',      150, 11),
  ('avatar:10', 'avatar', '10', 'Chaton',        'Kitty',         200, 12),
  ('avatar:11', 'avatar', '11', 'Ange',          'Angel',         250, 13),
  ('avatar:12', 'avatar', '12', 'Roi cool',      'Cool King',     300, 14),
  ('avatar:13', 'avatar', '13', 'Timide',        'Shy',           150, 15),
  ('frame:neon',  'frame', 'neon',  'Néon',      'Neon',          300, 20),
  ('frame:flame', 'frame', 'flame', 'Flamme',    'Flame',         300, 21),
  ('frame:ice',   'frame', 'ice',   'Glace',     'Ice',           250, 22),
  ('frame:holo',  'frame', 'holo',  'Holo',      'Holo',          400, 23),
  ('frame:royal', 'frame', 'royal', 'Royal',     'Royal',         500, 24),
  ('skin:night',  'skin',  'night', 'Nuit',      'Night',         250, 30),
  ('skin:ocean',  'skin',  'ocean', 'Océan',     'Ocean',         250, 31),
  ('skin:grape',  'skin',  'grape', 'Raisin',    'Grape',         250, 32),
  ('skin:gold',   'skin',  'gold',  'Or',        'Gold',          400, 33)
on conflict (id) do nothing;
insert into public.settings(key, value) values
  ('shop', '{"ad_gems":10,"ad_per_day":5,"ad_gap_s":45,"league_plus_gems":300}')
on conflict (key) do nothing;

-- ---------- ligues privées — voir 07_leagues.sql ----------
create table if not exists public.leagues(
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name text not null check (length(name) between 3 and 40),
  owner uuid not null references public.profiles(id) on delete cascade,
  sk text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  plus boolean not null default false,
  max_members int not null default 20,
  col text not null default '#5B4BFF',
  created_at timestamptz not null default now()
);
create table if not exists public.league_members(
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists league_members_user on public.league_members (user_id);
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
revoke all on public.leagues from anon, authenticated;
revoke all on public.league_members from anon, authenticated;

-- ---------- objets de jeu (voitures, blocs, cibles) ----------
alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check check (kind in ('avatar','frame','skin','car_model','car_paint','car_trail','stack','aim'));
-- équipement de jeu choisi par le joueur, ex. {"car_model":"kart","car_paint":"flames","stack":"candy"}
alter table public.profiles add column if not exists gear jsonb not null default '{}';
insert into public.shop_items(id, kind, ref, name_fr, name_en, price, sort) values
  ('car_model:kart',   'car_model', 'kart',   'Kart',            'Kart',            250, 40),
  ('car_model:f1',     'car_model', 'f1',     'Formule',         'Formula',         400, 41),
  ('car_model:pickup', 'car_model', 'pickup', 'Pick-up',         'Pickup',          300, 42),
  ('car_model:rally',  'car_model', 'rally',  'Rallye',          'Rally',           300, 43),
  ('car_model:muscle', 'car_model', 'muscle', 'Muscle car',      'Muscle car',      350, 44),
  ('car_paint:flames', 'car_paint', 'flames', 'Flammes',         'Flames',          200, 50),
  ('car_paint:checker','car_paint', 'checker','Damier',          'Checkered',       200, 51),
  ('car_paint:stripes','car_paint', 'stripes','Bandes de course','Racing stripes',  150, 52),
  ('car_paint:camo',   'car_paint', 'camo',   'Camouflage',      'Camo',            150, 53),
  ('car_paint:chrome', 'car_paint', 'chrome', 'Chrome',          'Chrome',          300, 54),
  ('car_paint:galaxy', 'car_paint', 'galaxy', 'Galaxie',         'Galaxy',          350, 55),
  ('car_trail:neon',   'car_trail', 'neon',   'Traînée néon',    'Neon trail',      250, 60),
  ('car_trail:rainbow','car_trail', 'rainbow','Arc-en-ciel',     'Rainbow',         350, 61),
  ('car_trail:smoke',  'car_trail', 'smoke',  'Fumée rose',      'Pink smoke',      150, 62),
  ('car_trail:sparks', 'car_trail', 'sparks', 'Étincelles',      'Sparks',          200, 63),
  ('car_trail:hearts', 'car_trail', 'hearts', 'Cœurs',           'Hearts',          200, 64),
  ('stack:candy',      'stack',     'candy',  'Blocs bonbons',   'Candy blocks',    200, 70),
  ('stack:glass',      'stack',     'glass',  'Blocs de verre',  'Glass blocks',    250, 71),
  ('stack:neon',       'stack',     'neon',   'Blocs néon',      'Neon blocks',     300, 72),
  ('stack:gold',       'stack',     'gold',   'Lingots d’or',    'Gold bars',       400, 73),
  ('aim:ocean',        'aim',       'ocean',  'Bulles océan',    'Ocean bubbles',   200, 80),
  ('aim:melon',        'aim',       'melon',  'Pastèques',       'Watermelons',     200, 81),
  ('aim:donut',        'aim',       'donut',  'Donuts',          'Donuts',          250, 82),
  ('aim:planet',       'aim',       'planet', 'Planètes',        'Planets',         300, 83)
on conflict (id) do nothing;

-- ---------- défis directs : je choisis mon adversaire ----------
create table if not exists public.challenges(
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  sk text not null,
  seed bigint not null,
  cat text not null default 'mix',
  from_score numeric not null,
  from_run uuid,
  to_score numeric,
  to_run uuid,
  status text not null default 'open' check (status in ('open','playing','done','declined','expired')),
  winner uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  played_at timestamptz,
  done_at timestamptz
);
create index if not exists challenges_to on public.challenges (to_user, status);
create index if not exists challenges_from on public.challenges (from_user, created_at desc);

-- ---------- duels en direct (les deux joueurs connectés en même temps) ----------
create table if not exists public.live_matches(
  id uuid primary key default gen_random_uuid(),
  a uuid not null references public.profiles(id) on delete cascade,   -- celui qui invite
  b uuid not null references public.profiles(id) on delete cascade,   -- l'invité
  sk text not null,
  seed bigint not null,
  status text not null default 'invited' check (status in ('invited','ready','done','declined','cancelled','expired')),
  start_at timestamptz,
  a_run uuid, b_run uuid,
  a_score numeric, b_score numeric,
  a_done boolean not null default false, b_done boolean not null default false,
  winner uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_matches_b on public.live_matches (b, status);
create index if not exists live_matches_a on public.live_matches (a, status);
alter table public.challenges enable row level security;
alter table public.live_matches enable row level security;
revoke all on public.challenges from anon, authenticated;
revoke all on public.live_matches from anon, authenticated;
