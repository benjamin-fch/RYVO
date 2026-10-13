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
