-- =====================================================================
--  Boutique : gemmes, cosmétiques, achats par carte (Stripe), pubs récompensées
--  Règle d'or : tout ce qui s'achète est esthétique. Rien ne change un score,
--  un chrono, un nombre d'essais ou la cote.
-- =====================================================================

-- ---------- outils internes (jamais appelables depuis le site) ----------
create or replace function public.gem_move(p_uid uuid, p_delta int, p_reason text, p_ref text default null, p_allow_negative boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare v_bal int;
begin
  update profiles set gems = gems + p_delta where id = p_uid returning gems into v_bal;
  if v_bal is null then raise exception 'no_profile'; end if;
  if p_delta < 0 and v_bal < 0 and not p_allow_negative then raise exception 'not_enough_gems'; end if;
  insert into gem_ledger(user_id, delta, balance, reason, ref) values (p_uid, p_delta, v_bal, p_reason, p_ref);
  return v_bal;
end $$;

create or replace function public.owns(p_uid uuid, p_kind text, p_ref text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from owned_items o join shop_items i on i.id = o.item_id where o.user_id = p_uid and i.kind = p_kind and i.ref = p_ref) $$;

create or replace function public.shop_public() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'ref',ref,'fr',name_fr,'en',name_en,'price',price) order by sort, id), '[]') from shop_items where active),
    'packs', (select coalesce(jsonb_agg(jsonb_build_object('id',id,'gems',gems,'cents',price_cents) order by sort, id), '[]') from gem_packs where active),
    'ad_gems', (setting('shop')->>'ad_gems')::int, 'ad_per_day', (setting('shop')->>'ad_per_day')::int, 'ad_gap_s', (setting('shop')->>'ad_gap_s')::int,
    'league_plus', (setting('shop')->>'league_plus_gems')::int) $$;

-- ---------- joueur ----------
create or replace function public.buy_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_i shop_items;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform ensure_active(v_uid);
  select * into v_i from shop_items where id = p_item and active;
  if v_i.id is null then raise exception 'unknown_item'; end if;
  if exists(select 1 from owned_items where user_id = v_uid and item_id = v_i.id) then raise exception 'already_owned'; end if;
  perform gem_move(v_uid, -v_i.price, 'item', v_i.id);
  insert into owned_items(user_id, item_id) values (v_uid, v_i.id);
  return me();
end $$;

-- Pub récompensée : on ne peut pas prouver côté serveur qu'une pub a été vue (limite de toutes
-- les pubs web). D'où : récompense uniquement en gemmes (cosmétiques), plafond par jour et délai minimum.
create or replace function public.ad_reward() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cfg jsonb := setting('shop'); v_n int; v_last timestamptz; v_bal int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  perform ensure_active(v_uid);
  perform 1 from profiles where id = v_uid for update;   -- une seule récompense à la fois par joueur
  select count(*), max(at) into v_n, v_last from gem_ledger where user_id = v_uid and reason = 'ad' and at >= day_start();
  if v_n >= (v_cfg->>'ad_per_day')::int then raise exception 'ad_limit'; end if;
  if v_last > now() - make_interval(secs => (v_cfg->>'ad_gap_s')::int) then raise exception 'ad_too_soon'; end if;
  v_bal := gem_move(v_uid, (v_cfg->>'ad_gems')::int, 'ad');
  return jsonb_build_object('gems', v_bal, 'reward', (v_cfg->>'ad_gems')::int, 'left', (v_cfg->>'ad_per_day')::int - v_n - 1);
end $$;

-- ---------- paiement : appelé uniquement par la fonction Stripe (clé service, côté serveur) ----------
create or replace function public.shop_pack(p_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'gems', gems, 'cents', price_cents) from gem_packs where id = p_id and active $$;

create or replace function public.credit_purchase(p_session text, p_user uuid, p_pack text, p_amount int, p_currency text, p_intent text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_k gem_packs; v_id uuid; v_bal int;
begin
  if exists(select 1 from purchases where session_id = p_session) then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  select * into v_k from gem_packs where id = p_pack;
  if v_k.id is null or v_k.price_cents <> p_amount or lower(p_currency) <> 'eur' or not exists(select 1 from profiles where id = p_user) then
    -- montant inattendu (prix modifié entre-temps, code promo…) : rien n'est crédité, l'équipe tranche depuis la console
    insert into purchases(session_id, payment_intent, user_id, pack_id, gems, amount_cents, currency, status)
    values (p_session, p_intent, (select id from profiles where id = p_user), p_pack, 0, p_amount, lower(p_currency), 'mismatch')
    on conflict (session_id) do nothing;
    return jsonb_build_object('ok', false, 'mismatch', true);
  end if;
  insert into purchases(session_id, payment_intent, user_id, pack_id, gems, amount_cents, currency, status)
  values (p_session, p_intent, p_user, v_k.id, v_k.gems, p_amount, lower(p_currency), 'paid')
  on conflict (session_id) do nothing returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', true, 'duplicate', true); end if;
  v_bal := gem_move(p_user, v_k.gems, 'purchase', p_session);
  return jsonb_build_object('ok', true, 'gems', v_k.gems, 'balance', v_bal);
end $$;

create or replace function public.refund_purchase(p_intent text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_p purchases;
begin
  update purchases set status = 'refunded', refunded_at = now() where payment_intent = p_intent and status = 'paid' returning * into v_p;
  if v_p.id is null then return jsonb_build_object('ok', true, 'nothing', true); end if;
  if v_p.user_id is not null and v_p.gems > 0 then perform gem_move(v_p.user_id, -v_p.gems, 'refund', v_p.session_id, true); end if;
  return jsonb_build_object('ok', true, 'removed', v_p.gems);
end $$;

-- ---------- console ----------
create or replace function public.admin_shop() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_require('partner');
  return jsonb_build_object(
    'kpi', jsonb_build_object(
      'month_cents', (select coalesce(sum(amount_cents),0) from purchases where status = 'paid' and created_at >= month_start()),
      'total_cents', (select coalesce(sum(amount_cents),0) from purchases where status = 'paid'),
      'buyers', (select count(distinct user_id) from purchases where status = 'paid'),
      'orders', (select count(*) from purchases where status = 'paid'),
      'refunds', (select count(*) from purchases where status = 'refunded'),
      'gems_out', (select coalesce(sum(gems),0) from profiles),
      'items_sold', (select count(*) from owned_items),
      'ads_today', (select count(*) from gem_ledger where reason = 'ad' and at >= day_start()),
      'ads_7d', (select count(*) from gem_ledger where reason = 'ad' and at >= now() - interval '7 days'),
      'leagues_plus', (select count(*) from gem_ledger where reason = 'league')),
    'months', (select coalesce(jsonb_agg(jsonb_build_object('m', ms(m), 'cents', (select coalesce(sum(amount_cents),0) from purchases where status = 'paid' and created_at >= m and created_at < m + interval '1 month')) order by m), '[]')
      from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m),
    'purchases', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'player', jsonb_build_object('id', pr.id, 'name', pr.username), 'pack', p.pack_id, 'gems', p.gems, 'cents', p.amount_cents,
        'cur', p.currency, 'status', p.status, 'resolved', p.resolved, 't', ms(p.created_at)) order by p.created_at desc), '[]')
      from (select * from purchases order by created_at desc limit 60) p left join profiles pr on pr.id = p.user_id),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'kind', i.kind, 'ref', i.ref, 'fr', i.name_fr, 'price', i.price, 'active', i.active,
        'owners', (select count(*) from owned_items o where o.item_id = i.id)) order by i.sort, i.id), '[]') from shop_items i),
    'packs', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'gems', gems, 'cents', price_cents, 'active', active) order by sort, id), '[]') from gem_packs),
    'settings', setting('shop'));
end $$;

create or replace function public.admin_save_item(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_i shop_items;
begin
  perform admin_require('partner');
  select * into v_i from shop_items where id = p->>'id'; if v_i.id is null then raise exception 'not_found'; end if;
  if (p->>'price')::int not between 1 and 100000 then raise exception 'bad_price'; end if;
  update shop_items set price = (p->>'price')::int, active = coalesce((p->>'active')::boolean, active) where id = v_i.id;
  perform audit('a modifié l’article', v_i.name_fr, (p->>'price') || ' gemmes' || case when (p->>'active')::boolean is false then ' · retiré de la vente' else '' end);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_save_pack(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_k gem_packs;
begin
  perform admin_require('super');
  select * into v_k from gem_packs where id = p->>'id'; if v_k.id is null then raise exception 'not_found'; end if;
  if (p->>'gems')::int not between 1 and 100000 or (p->>'cents')::int not between 50 and 100000 then raise exception 'bad_price'; end if;
  update gem_packs set gems = (p->>'gems')::int, price_cents = (p->>'cents')::int, active = coalesce((p->>'active')::boolean, active) where id = v_k.id;
  perform audit('a modifié le pack de gemmes', v_k.id, (p->>'gems') || ' gemmes pour ' || to_char((p->>'cents')::int / 100.0, 'FM990D00') || ' €');
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_shop_settings(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  perform admin_require('super');
  v := jsonb_build_object('ad_gems', (p->>'ad_gems')::int, 'ad_per_day', (p->>'ad_per_day')::int, 'ad_gap_s', (p->>'ad_gap_s')::int, 'league_plus_gems', (p->>'league_plus_gems')::int);
  if (v->>'ad_gems')::int not between 0 and 100 or (v->>'ad_per_day')::int not between 0 and 20 or (v->>'ad_gap_s')::int not between 15 and 3600
     or (v->>'league_plus_gems')::int not between 1 and 10000 then raise exception 'bad_threshold'; end if;
  update settings set value = v where key = 'shop';
  perform audit('a modifié les réglages boutique', null, v::text);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_grant_gems(p_user text, p_delta int, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_p profiles; v_bal int;
begin
  perform admin_require('super');
  select * into v_p from profiles where lower(username) = lower(trim(p_user)); if v_p.id is null then raise exception 'not_found'; end if;
  if p_delta = 0 or abs(p_delta) > 10000 then raise exception 'bad_price'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'reason_required'; end if;
  v_bal := gem_move(v_p.id, p_delta, 'admin', left(trim(p_reason), 120), true);
  perform audit(case when p_delta > 0 then 'a crédité des gemmes à' else 'a retiré des gemmes à' end, v_p.username, abs(p_delta) || ' · ' || trim(p_reason));
  return jsonb_build_object('ok', true, 'balance', v_bal);
end $$;

create or replace function public.admin_purchase_resolve(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform admin_require('partner');
  update purchases set resolved = true where id = p_id;
  perform audit('a traité un paiement à vérifier', p_id::text);
  return jsonb_build_object('ok', true);
end $$;
