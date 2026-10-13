-- =====================================================================
--  Droits d'exécution : seules ces fonctions sont accessibles depuis le web.
-- =====================================================================
revoke execute on all functions in schema public from public, anon, authenticated;

-- lisibles sans compte (classements publics)
grant execute on function public.public_info(), public.leaderboard(text,text,int), public.daily_board(text), public.school_cup(), public.recent_activity() to anon, authenticated;

-- joueurs connectés
grant execute on function public.me(), public.update_profile(jsonb), public.start_run(text,text,int,text,text), public.answer_question(uuid,int,int,numeric),
  public.word_event(uuid,int,text,text), public.submit_run(uuid,jsonb), public.class_cup(), public.report_player(uuid,text,text),
  public.request_verification(text,text), public.add_school(text,text,text), public.export_my_data(), public.delete_my_account(), public.claim_admin_invite() to authenticated;

-- console admin (chaque fonction vérifie elle-même le rôle et la double authentification)
grant execute on function public.admin_me(), public.admin_counts(), public.admin_overview(),
  public.admin_players(text,text,text,text,text,int,int,int), public.admin_player(uuid), public.admin_reveal_email(uuid), public.admin_player_action(uuid,text,jsonb),
  public.admin_reports(text), public.admin_report_action(uuid,text), public.admin_flags(text), public.admin_flag_action(uuid,text),
  public.admin_rules(), public.admin_set_rules(jsonb), public.admin_reset_board(text),
  public.admin_questions(), public.admin_save_question(jsonb), public.admin_question_action(uuid,text), public.admin_words(text), public.admin_word(text,text,text,text),
  public.admin_games(), public.admin_set_game(text,text,boolean),
  public.admin_comps(), public.admin_save_comp(jsonb), public.admin_comp_action(uuid,text), public.admin_set_daily(jsonb), public.admin_season_action(text,timestamptz),
  public.admin_schools(), public.admin_save_school(jsonb), public.admin_merge_school(text,text), public.admin_delete_school(text), public.admin_verif_action(uuid,text), public.admin_manager(text,jsonb),
  public.admin_business(), public.admin_invoice(text,jsonb), public.admin_sponsor(jsonb),
  public.admin_team(), public.admin_team_action(text,jsonb), public.admin_log(text,int) to authenticated;
