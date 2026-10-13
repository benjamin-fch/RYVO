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
  select jsonb_build_object('id', p.id, 'name', p.username, 'school', p.school_id, 'program', p.program, 'year', p.study_year, 'level', level_of(p.xp), 'xp', p.xp, 'rating', p.rating,
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
        'by_player', s.created_by is not null, 'creator', (select username from profiles where id = s.created_by), 't', ms(s.created_at),
        'players', (select count(*) from profiles p where p.school_id = s.id), 'verified', (select count(*) from profiles p where p.school_id = s.id and p.verified)) order by s.name), '[]') from schools s),
    'verifs', (select coalesce(jsonb_agg(jsonb_build_object('id', v.id, 'player', jsonb_build_object('id', p.id, 'name', p.username), 'school', v.school_id,
        'local', left(split_part(v.email,'@',1),1) || '***', 'domain', split_part(v.email,'@',2), 'match', split_part(v.email,'@',2) = s.domain, 'method', v.method, 't', ms(v.created_at)) order by v.created_at), '[]')
      from verifications v join profiles p on p.id = v.user_id join schools s on s.id = v.school_id where v.status = 'pending'),
    'managers', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'email', email, 'school', school_id, 'role', role, 't', ms(created_at)) order by created_at), '[]') from campus_managers));
end $$;

create or replace function public.admin_save_school(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id text := nullif(p->>'id',''); v_short text := upper(trim(p->>'short')); v_dom text := nullif(lower(regexp_replace(trim(coalesce(p->>'domain','')), '^@', '')), '');
begin
  perform admin_require('partner');
  if length(trim(coalesce(p->>'name',''))) < 3 then raise exception 'name_too_short'; end if;
  if v_short !~ '^[A-Z0-9]{2,5}$' then raise exception 'bad_short'; end if;
  if v_dom is not null and v_dom !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' then raise exception 'bad_domain'; end if;
  if exists(select 1 from schools where short = v_short and id is distinct from v_id) then raise exception 'short_taken'; end if;
  if v_dom is not null and exists(select 1 from schools where domain = v_dom and id is distinct from v_id) then raise exception 'domain_taken'; end if;
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

-- fusionner un doublon (ex. « EM Normandie » ajoutée deux fois) : joueurs, demandes et compétitions passent sur l'école gardée
create or replace function public.admin_merge_school(p_from text, p_into text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_f schools; v_t schools; v_n int;
begin
  perform admin_require('partner');
  select * into v_f from schools where id = p_from; select * into v_t from schools where id = p_into;
  if v_f.id is null or v_t.id is null or v_f.id = v_t.id then raise exception 'bad_target'; end if;
  update profiles set school_id = v_t.id where school_id = v_f.id; get diagnostics v_n = row_count;
  update verifications set school_id = v_t.id where school_id = v_f.id;
  update competitions set school_id = v_t.id where school_id = v_f.id;
  update campus_managers set school_id = v_t.id where school_id = v_f.id;
  delete from schools where id = v_f.id;
  perform audit('a fusionné l’établissement', v_f.name || ' (' || v_f.short || ') → ' || v_t.name || ' (' || v_t.short || ')', v_n || ' joueur(s)');
  return jsonb_build_object('ok', true, 'moved', v_n);
end $$;

-- supprimer un établissement (nom inapproprié, faux établissement) : ses joueurs n'ont plus d'école
create or replace function public.admin_delete_school(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_s schools; v_n int;
begin
  perform admin_require('partner');
  select * into v_s from schools where id = p_id; if v_s.id is null then raise exception 'not_found'; end if;
  select count(*) into v_n from profiles where school_id = v_s.id;
  update profiles set school_id = null, verified = false, school_set_at = null where school_id = v_s.id;
  delete from schools where id = v_s.id;
  perform audit('a supprimé l’établissement', v_s.name, v_n || ' joueur(s) détaché(s)');
  return jsonb_build_object('ok', true, 'detached', v_n);
end $$;

create or replace function public.admin_verif_action(p_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_v verifications; v_s schools; v_p profiles;
begin
  perform admin_require('partner');
  select * into v_v from verifications where id = p_id and status = 'pending'; if v_v.id is null then raise exception 'not_pending'; end if;
  select * into v_s from schools where id = v_v.school_id; select * into v_p from profiles where id = v_v.user_id;
  if p_action = 'ok' then
    if v_s.domain is null or split_part(v_v.email,'@',2) <> v_s.domain then raise exception 'domain_mismatch'; end if;
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
