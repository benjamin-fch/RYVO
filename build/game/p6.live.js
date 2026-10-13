
/* =========================================================
   LIVE MODE — connexion à Supabase (actif seulement si config.js est rempli)
   Tout passe par des fonctions serveur : le navigateur ne peut ni écrire un score
   ni lire une table directement.
   ========================================================= */
const NET={user:null,me:null,info:null,cache:{},inflight:{},starting:false};
const sb=LIVE?window.supabase.createClient(CFG.url,CFG.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
async function rpc(fn,args){const {data,error}=await sb.rpc(fn,args||{});if(error)throw new Error(error.message||String(error));return data;}
function errText(e){
  const m=String(e&&e.message||e||'');
  if(/^school_locked:(\d+)/.test(m)){const d=new Date(+m.split(':')[1]);return L(`You changed school recently. You can switch again from ${d.toLocaleDateString(LOC())}.`,`Tu as changé d’école récemment. Tu pourras en changer à nouveau à partir du ${d.toLocaleDateString(LOC())}.`);}
  if(/^suspended:(\d+)/.test(m)){const d=new Date(+m.split(':')[1]);return L(`Your account is suspended until ${d.toLocaleDateString(LOC())}.`,`Ton compte est suspendu jusqu’au ${d.toLocaleDateString(LOC())}.`);}
  const T={not_authenticated:['Sign in to continue.','Connecte-toi pour continuer.'],banned:['This account is banned.','Ce compte est banni.'],game_unavailable:['This game is unavailable right now.','Ce jeu est indisponible pour le moment.'],
    daily_limit:['No Daily attempts left for this game today.','Plus d’essais du jour pour ce jeu.'],not_daily_game:['Today’s Daily changed. Reload the page.','Le Défi du jour a changé. Recharge la page.'],
    no_school:['Link a school in Campus first.','Lie d’abord une école dans Campus.'],rate_limited:['Too many actions in a short time. Try again in a few minutes.','Trop d’actions en peu de temps. Réessaie dans quelques minutes.'],
    username_taken:['That username is taken.','Ce pseudo est déjà pris.'],bad_username:['Use 3–16 letters, numbers, dots or underscores.','3 à 16 lettres, chiffres, points ou tirets bas.'],reserved_username:['That username is reserved.','Ce pseudo est réservé.'],
    locked_item:['Unlock this item by levelling up.','Débloque cet élément en montant de niveau.'],domain_mismatch:['That address isn’t from this school.','Cette adresse n’est pas celle de l’école.'],bad_email:['Enter a valid email address.','Saisis une adresse e-mail valide.'],
    unknown_school:['Unknown school.','École inconnue.'],bad_school_name:['Enter the full name of your school, without links.','Écris le nom complet de ton école, sans lien.'],bad_city:['Enter the city of your campus.','Indique la ville de ton campus.'],
    bad_country:['Check the country.','Vérifie le pays.'],bad_year:['Choose your year of study.','Choisis ton année d’études.'],no_domain:['This school has no email domain yet, so it can’t be verified for now.','Cette école n’a pas encore de domaine e-mail : la vérification n’est pas possible pour l’instant.'],bad_target:['You can’t report this player.','Tu ne peux pas signaler ce joueur.'],expired:['This match took too long and expired.','Ce match a expiré.'],bad_run:['This match is already closed.','Ce match est déjà clos.'],
    time_over:['Time’s up.','Temps écoulé.'],not_enough_questions:['Not enough questions yet. Try another game.','Pas encore assez de questions. Essaie un autre jeu.'],not_enough_words:['Not enough words yet. Try another game.','Pas encore assez de mots. Essaie un autre jeu.'],
    not_enough_gems:['Not enough gems.','Pas assez de gemmes.'],already_owned:['You already have it.','Tu l’as déjà.'],unknown_item:['This item is no longer on sale.','Cet objet n’est plus en vente.'],
    ad_limit:['That’s all the ads for today. Come back tomorrow.','C’est tout pour les pubs aujourd’hui. Reviens demain.'],ad_too_soon:['Wait a little before the next ad.','Attends un peu avant la prochaine pub.'],
    bad_league_name:['Give the league a name of 3 to 40 characters, without links.','Donne à la ligue un nom de 3 à 40 caractères, sans lien.'],bad_days:['Choose a valid duration.','Choisis une durée valide.'],
    league_limit:['You’ve reached the league limit (3 running leagues created, 20 joined).','Tu as atteint la limite (3 ligues en cours créées, 20 rejointes).'],league_full:['This league is full.','Cette ligue est complète.'],
    league_ended:['This league is over.','Cette ligue est terminée.'],league_not_found:['No league with this code. Check it with the person who shared it.','Aucune ligue avec ce code. Vérifie-le avec la personne qui l’a partagé.'],
    not_member:['You’re not in this league.','Tu ne fais pas partie de cette ligue.'],owner_cannot_leave:['You created this league: delete it instead of leaving.','Tu as créé cette ligue : supprime-la plutôt que de la quitter.'],
    plus_only:['Available with League+.','Disponible avec Ligue+.'],forbidden:['Only the league’s creator can do that.','Seul le créateur de la ligue peut faire ça.'],bad_board:['Pick a game.','Choisis un jeu.'],
    waiver_required:['Tick the box to get your gems right away.','Coche la case pour recevoir tes gemmes tout de suite.'],unknown_pack:['This pack is no longer available.','Ce pack n’est plus disponible.'],
    opp_no_score:['This player has no score on this game yet. Pick another game.','Ce joueur n’a pas encore de score sur ce jeu. Choisis-en un autre.'],
    challenge_closed:['This challenge is no longer open.','Ce défi n’est plus ouvert.'],live_closed:['This live duel is no longer available.','Ce duel en direct n’est plus disponible.'],
    server_error:['Payment couldn’t start. Try again in a moment.','Le paiement n’a pas pu démarrer. Réessaie dans un instant.'],
    last_super_admin:['You are the last super admin: hand over the role before deleting your account.','Tu es le dernier super admin : transmets le rôle avant de supprimer ton compte.']};
  for(const k in T)if(m===k||m.startsWith(k))return L(T[k][0],T[k][1]);
  if(/fetch|network|Failed/i.test(m))return L('Connection problem. Check your internet and try again.','Problème de connexion. Vérifie ton internet et réessaie.');
  return m;
}
function cached(key,fn,ttl=20000){
  const c=NET.cache[key];if(c&&Date.now()-c.t<ttl)return c.v;
  if(!NET.inflight[key]){NET.inflight[key]=fn().then(v=>{NET.cache[key]={v,t:Date.now()};}).catch(e=>{NET.cache[key]={v:null,err:errText(e),t:Date.now()};}).finally(()=>{delete NET.inflight[key];softRender();});}
  return c?c.v:undefined;
}
const cacheErr=k=>NET.cache[k]&&NET.cache[k].err;
function invalidate(prefix){Object.keys(NET.cache).forEach(k=>{if(!prefix||k.startsWith(prefix))delete NET.cache[k];});}
let _rt=0;
function softRender(){clearTimeout(_rt);_rt=setTimeout(()=>{
  if(S.route==='game'&&S.ctrl)return;
  document.body.dataset.skin=S.data.account.skin;
  $('#side').innerHTML=sideHTML();$('#top').innerHTML=topHTML();$('#mnav').innerHTML=mnavHTML();$('#foot').innerHTML=footHTML();
  const ae=document.activeElement,keepId=ae&&ae.id&&$('#view').contains(ae)?ae.id:null;
  $('#view').innerHTML=(VIEWS[S.route]||VIEWS.home)();
  if(S._seen){S.data.seen[S._seen[0]]=S._seen[1];S._seen=null;}
  if(keepId){const n=document.getElementById(keepId);if(n)try{n.focus();}catch(e){}}
  if(!S.ui.sheet&&!S.ui.notif)renderLayer();
},40);}
const faceOf=r=>{const p=AV_PRESETS[r.avatar];return p||demoFace(String(r.id||r.name));};
function mapBoard(d){
  if(!d)return null;
  const uid=NET.user&&NET.user.id,mk=x=>({id:x.id,name:x.name,face:faceOf(x),frame:x.frame,school:x.school,val:Number(x.val),mv:0,pos:x.pos,me:x.id===uid});
  const rows=(d.rows||[]).map(mk),me=d.me?mk(d.me):null;
  return {rows,me,total:d.total,need_school:d.need_school,unsupported:d.unsupported};
}

if(LIVE){
  SCHOOLS.length=0;Object.keys(SCH).forEach(k=>delete SCH[k]);
  boardRows=function(b,scope){
    if(scope==='friends')return {rows:[],me:null,unsupported:true};
    const key='lb:'+b+':'+scope,v=cached(key,()=>rpc('leaderboard',{p_board:b,p_scope:scope,p_limit:10}));
    if(v===undefined)return {rows:[],me:null,loading:true};
    if(v===null)return {rows:[],me:null,err:cacheErr(key)};
    return mapBoard(v);
  };
  dailyRows=function(sk){const g=gameOf(sk),key='daily:'+g,v=cached(key,()=>rpc('daily_board',{p_game:g}));
    if(v===undefined)return {rows:[],me:null,loading:true};if(v===null)return {rows:[],me:null,err:cacheErr(key)};return mapBoard(v);};
  uniRows=function(){const v=cached('cup',()=>rpc('school_cup'));return (v||[]).map(u=>({id:u.id,name:u.name,short:u.short,city:u.city,col:u.col,members:u.members,pts:u.pts,mv:0,mine:!!u.mine,you:u.you||0,pos:u.pos}));};
  classRows=function(){if(!NET.user||!SCH[S.data.school.id])return [];const v=cached('class',()=>rpc('class_cup'));return (v||[]).map(c=>({id:c.id,pts:c.pts,members:c.members,mine:!!c.mine,pos:c.pos,mv:0}));};
  dailyGame=()=>{const d=NET.info&&NET.info.daily;return d&&GAME[d.game]&&GAME[d.game].playable?GAME[d.game]:(PLAYABLE[0]||(d&&GAME[d.game])||GAME.reflex);};
  dailyTrack=()=>NET.info&&NET.info.daily?NET.info.daily.track:0;
  todayMissions=function(){return NET.me?NET.me.missions.map(m=>MISSIONS.find(x=>x.id===m.id)).filter(Boolean):[MISSIONS[0]];};
  myPts=since=>NET.me?(since===weekStart()?NET.me.week_pts:NET.me.month_pts):0;
}

function liveFeedHTML(){
  const v=cached('feed',()=>rpc('recent_activity'),30000);
  if(v===undefined)return '<div class="skel"></div>';
  if(!v||!v.length)return `<div class="empty"><b>${L('No duels yet','Aucun duel pour l’instant')}</b>${L('Start the first one.','Lance le premier.')}<button class="btn sm primary" type="button" data-act="classmate">${ic('swords',16)}${L('Start a duel','Lancer un duel')}</button></div>`;
  return `<ul class="feed">${v.map(d=>`<li><span class="vsdot">${avP({id:d.name,name:d.name,face:faceOf(d)},28)}</span><span class="txt"><b>${esc(d.name)}</b> vs <b>${esc(d.opp||'—')}</b><small>${GAME[gameOf(d.sk)].name} · ${fmtScore(d.sk,Number(d.s))} – ${fmtScore(d.sk,Number(d.os))} · ${ago(d.t)}</small></span><span class="pill ${d.o==='win'?'now':''}">${d.o==='win'?esc(d.name):d.o==='draw'?L('Draw','Nul'):esc(d.opp||'')} ${d.o==='draw'?'':L('wins','gagne')}</span></li>`).join('')}</ul>`;
}
function liveDuelPanel(){
  return `<div class="opp"><span class="avw">${face({col:'#17142A',eyes:3,mouth:0,shape:2},48)}</span><div style="min-width:0;flex:1"><b class="num" style="font-size:16px">${L('A real player, picked by the server','Un vrai joueur, choisi par le serveur')}</b>
    <p class="tiny">${L(`RYVO picks a player close to your rating (${S.data.rating} SR) and replays their best run. If nobody qualifies yet, you face the RYVO bot.`,`RYVO choisit un joueur proche de ta cote (${S.data.rating} SR) et rejoue son meilleur résultat. S’il n’y en a pas encore, tu affrontes le bot RYVO.`)}</p></div></div>
    ${NET.user?(S.ui.lobby.game==='cards'?'':`<div class="row" style="margin-top:6px"><button class="btn" type="button" data-act="oppPick">${ic('users',16)}${L('Choose my opponent','Choisir mon adversaire')}</button><span class="tiny">${RT.online.size?`<span class="presence on"></span> ${RT.online.size} ${plural(RT.online.size,'player online','players online','joueur en ligne','joueurs en ligne')}`:''}</span></div>`):`<p class="tiny">${L('As a guest you play a practice run with no opponent. Sign in for real duels and to move your rating.','En invité, tu joues une partie d’essai sans adversaire. Connecte-toi pour de vrais duels et faire bouger ta cote.')}</p>`}`;
}
function liveOthers(r){
  const s=r.server||{},st=S.data,sc=SCH[st.school.id];
  return `<section class="card c4"><h2>${L('Against others','Face aux autres')}</h2><dl class="cmp">
    <dt>${L('World rank','Rang mondial')}</dt><dd>${s.rank_world?`#${s.rank_world} / ${s.total_world}`:'—'}</dd>
    ${s.rank_world&&s.total_world>1?`<dt>${L('Ahead of','Devant')}</dt><dd>${Math.round((1-(s.rank_world-1)/(s.total_world-1))*100)} % ${L('of players','des joueurs')}</dd>`:''}
    ${s.rank_school?`<dt>${L('School rank','Rang dans l’école')}</dt><dd>#${s.rank_school} / ${s.total_school}</dd>`:''}
    ${r.schoolGain?`<dt>${L('School Cup','Coupe des écoles')}</dt><dd class="good">+${r.schoolGain}${sc?' '+L('for','pour')+' '+esc(sc.short):''}</dd>`:''}
  </dl>${r.live?liveResultHTML(r.live):''}${s.challenge_sent?`<div class="note" style="margin-top:10px">${ic('swords')}<span>${L(`Challenge sent to ${esc(r.oppName||'')}: they have 7 days to beat your score.`,`Défi envoyé à ${esc(r.oppName||'')} : il a 7 jours pour battre ton score.`)}</span></div>`:''}${s.status==='flagged'?`<p class="tiny">${L('Unusual result: a moderator checks it before it counts.','Résultat inhabituel : un modérateur le vérifie avant qu’il compte.')}</p>`:`<p class="tiny">${L('Checked by the server.','Vérifié par le serveur.')}</p>`}</section>`;
}
function practiceResult(r){
  const G=GAME[r.g];
  if(r.rejected)return `<div class="stack"><section class="res-hero" style="--rbg:#fff"><span class="outcome">${L('Run rejected','Partie rejetée')}</span><p class="mu" style="max-width:50ch">${L('The server found inconsistent data in this run, so it doesn’t count. If you think this is a mistake, play again normally.','Le serveur a trouvé des données incohérentes dans cette partie : elle ne compte pas. Si c’est une erreur, rejoue normalement.')}</p><div class="res-actions"><button class="btn hot" type="button" data-act="lobby" data-a="${r.g}">${ic('refresh',16)}${L('Back to the game','Retour au jeu')}</button></div></section></div>`;
  const hero=`<section class="res-hero" style="--rbg:${G.hex};--rfg:${r.g==='cards'?INK:'#fff'}"><span class="outcome">${L('Guest run','Partie invité')}</span><p class="eyebrow">${esc(skName(r.sk))}</p><div class="big">${fmtScore(r.sk,r.score)}</div>`;
  if(NET.user)return `<div class="stack">${hero}
    <p class="mu" style="max-width:48ch">${L('You’re signed in. This run was played as a guest so it isn’t saved, but your next one will count: score, XP and rankings.','Tu es connecté. Cette partie a été jouée en invité, elle n’est donc pas enregistrée, mais la prochaine comptera : score, XP et classements.')}</p>
    <div class="res-actions"><button class="btn hot" type="button" data-act="again">${ic('play',16)}${L('Play again, saved','Rejouer (enregistré)')}</button><button class="btn" type="button" data-act="go" data-a="play">${L('Library','Ludothèque')}</button></div></section></div>`;
  return `<div class="stack">${hero}
    <p class="mu" style="max-width:48ch">${L('Not saved. Create an account or sign in so your next runs count for your record, XP and the rankings.','Non enregistré. Crée un compte ou connecte-toi pour que tes prochaines parties comptent pour ton record, ton XP et les classements.')}</p>
    <div class="res-actions"><button class="btn hot" type="button" data-act="auth" data-a="signup">${L('Create an account','Créer un compte')}</button><button class="btn" type="button" data-act="auth" data-a="login">${L('Sign in','Connexion')}</button><button class="btn" type="button" data-act="again">${ic('refresh',16)}${L('Play again as guest','Rejouer en invité')}</button></div></section></div>`;
}
function livePendingHTML(s){
  return `<ol class="steps">
    <li><div><b>${L('School address received','Adresse de l’école reçue')}</b><small>…@${esc(S.data.school.domain||s.domain)}</small></div><span class="pill now">${L('Done','Fait')}</span></li>
    <li><div><b>${L('Review by the RYVO team','Vérification par l’équipe RYVO')}</b><small>${L('Usually within 48 hours. Your Cup points are kept and count once verified.','En général sous 48 h. Tes points de Coupe sont gardés et comptent dès la validation.')}</small></div><span class="pill warn">${L('Pending','En attente')}</span></li>
  </ol><button class="btn sm ghost" type="button" data-act="verifyReset">${L('Use another address','Utiliser une autre adresse')}</button>`;
}
function reportHTML(sh){
  const types=['Pseudo inapproprié','Triche ou score falsifié','Comportement toxique','Usurpation d’identité','Spam'],tl={'Pseudo inapproprié':'Inappropriate username','Triche ou score falsifié':'Cheating or fake score','Comportement toxique':'Toxic behaviour','Usurpation d’identité':'Impersonation','Spam':'Spam'};
  return `<div class="modal-h"><div><h2>${L('Report','Signaler')} ${esc(sh.name)}</h2><p>${L('A moderator reviews every report. False reports can lead to sanctions.','Un modérateur examine chaque signalement. Les faux signalements peuvent être sanctionnés.')}</p></div><button class="iconbtn" type="button" data-act="close" aria-label="${L('Close','Fermer')}">${ic('x')}</button></div>
  <form data-form="report" class="stack" novalidate><div class="field"><label for="rpType">${L('Reason','Motif')}</label><select class="input" id="rpType" name="type">${types.map(t=>`<option value="${t}">${L(tl[t],t)}</option>`).join('')}</select></div>
  <div class="field"><label for="rpText">${L('What happened?','Que s’est-il passé ?')}</label><textarea class="input" id="rpText" name="text" maxlength="500" style="font:inherit;min-height:90px"></textarea></div>
  <button class="btn primary" type="submit">${L('Send report','Envoyer le signalement')}</button></form>`;
}
function accountCardLive(){
  const st=S.data;
  if(!NET.user)return `<section class="card c6"><div class="card-h"><h2>${L('Account','Compte')}</h2></div><p class="tiny">${L('Create an account to save your progress on every device.','Crée un compte pour retrouver ta progression sur tous tes appareils.')}</p><div class="row"><button class="btn primary" type="button" data-act="auth" data-a="signup">${L('Create an account','Créer un compte')}</button><button class="btn" type="button" data-act="auth" data-a="login">${L('Sign in','Connexion')}</button></div></section>`;
  return `<section class="card c6"><div class="card-h"><h2>${L('Account and data','Compte et données')}</h2></div>
    <form data-form="uname" class="row" novalidate style="align-items:flex-end"><div class="field" style="flex:1;min-width:160px"><label for="unInput">${L('Username','Pseudo')}</label><input class="input" id="unInput" name="user" maxlength="16" value="${esc(st.account.username)}"></div><button class="btn" type="submit">${L('Save','Enregistrer')}</button></form>
    <dl class="cmp"><dt>E-mail</dt><dd>${esc(NET.user.email||'')}</dd><dt>${L('School','École')}</dt><dd>${SCH[st.school.id]?esc(SCH[st.school.id].short)+(st.school.status==='verified'?' ✓':'')+(st.school.year?' · '+esc(yearName(st.school.year)):''):L('None','Aucune')}</dd><dt>${L('Language','Langue')}</dt><dd>${LANG==='fr'?'Français':'English'}</dd></dl>
    <p class="tiny">${L('Your password is handled by the sign-in service and never seen by RYVO. You can download or delete your data at any time.','Ton mot de passe est géré par le service de connexion, RYVO ne le voit jamais. Tu peux télécharger ou supprimer tes données à tout moment.')}</p>
    <div class="row"><button class="btn sm" type="button" data-act="export">${L('Download my data','Télécharger mes données')}</button><button class="btn sm" type="button" data-act="signout">${L('Sign out','Se déconnecter')}</button><button class="btn sm ghost" type="button" data-act="reset" style="color:var(--bad)">${L('Delete my account','Supprimer mon compte')}</button></div></section>`;
}
const authHTML_demo=authHTML;
authHTML=function(sh){
  if(!LIVE)return authHTML_demo(sh);
  const tab=sh.tab,e=sh.err||{},v=sh.vals||{},close=`<button class="iconbtn" type="button" data-act="close" aria-label="${L('Close','Fermer')}">${ic('x')}</button>`;
  const tabs=`<div class="seg" role="tablist">${[['signup',L('Create account','Créer un compte')],['login',L('Sign in','Connexion')],['recover',L('Forgot password','Mot de passe oublié')]].map(x=>`<button type="button" role="tab" aria-selected="${tab===x[0]}" data-act="auth" data-a="${x[0]}">${x[1]}</button>`).join('')}</div>`;
  const err=e.form?`<div class="note err">${ic('info')}<span>${esc(e.form)}</span></div>`:'';
  if(tab==='sent')return `<div class="modal-h"><div><h2>${L('Check your inbox','Vérifie ta boîte mail')}</h2><p>${L(`We sent a confirmation link to ${esc(sh.email)}. Open it, then come back here to sign in.`,`On a envoyé un lien de confirmation à ${esc(sh.email)}. Ouvre-le, puis reviens ici pour te connecter.`)}</p></div>${close}</div><button class="btn primary" type="button" data-act="auth" data-a="login">${L('I confirmed, sign in','C’est confirmé, je me connecte')}</button><p class="tiny">${L('Nothing after a few minutes? Check your spam folder.','Rien après quelques minutes ? Regarde dans tes spams.')}</p>`;
  if(tab==='newpw')return `<div class="modal-h"><div><h2>${L('Choose a new password','Choisis un nouveau mot de passe')}</h2></div>${close}</div><form data-form="newpw" class="stack" novalidate><div class="field"><label for="aPw">${L('New password','Nouveau mot de passe')}</label><input class="input" id="aPw" name="pw" type="password" autocomplete="new-password">${e.pw?`<span class="err">${e.pw}</span>`:`<span class="help">${L('At least 8 characters with a number.','Au moins 8 caractères dont un chiffre.')}</span>`}</div>${err}<button class="btn primary" type="submit">${L('Save password','Enregistrer')}</button></form>`;
  const run=sh.run&&tab!=='recover'?`<div class="note">${ic('trophy')}<span>${L(`You scored <b>${esc(fmtScore(sh.run.sk,sh.run.score))}</b> as a guest. Guest runs aren’t saved: sign in and your next runs will count in the rankings.`,`Tu as fait <b>${esc(fmtScore(sh.run.sk,sh.run.score))}</b> en invité. Les parties invité ne sont pas enregistrées : connecte-toi et tes prochaines parties compteront au classement.`)}</span></div>`:'';
  const head=`<div class="modal-h"><div><h2>${sh.run&&tab==='signup'?L('Save your next scores','Enregistre tes prochains scores'):tab==='signup'?L('Create your player account','Crée ton compte joueur'):tab==='login'?L('Welcome back','Content de te revoir'):L('Reset your password','Réinitialise ton mot de passe')}</h2></div>${close}</div>${run}${tabs}`;
  if(tab==='recover'){
    if(sh.sent)return head+`<div class="note">${ic('info')}<span>${L('If an account exists for this address, a reset link is on its way.','Si un compte existe avec cette adresse, un lien de réinitialisation arrive.')}</span></div><button class="btn" type="button" data-act="auth" data-a="login">${L('Back to sign in','Retour à la connexion')}</button>`;
    return head+`<form data-form="recover" class="stack" novalidate><div class="field"><label for="aEmail">E-mail</label><input class="input" id="aEmail" name="email" type="email" autocomplete="email" value="${esc(v.email||'')}">${e.email?`<span class="err">${e.email}</span>`:''}</div>${err}<button class="btn primary" type="submit">${L('Send reset link','Envoyer le lien')}</button></form>`;
  }
  if(tab==='login')return head+`<form data-form="login" class="stack" novalidate>
    <div class="field"><label for="aEmail">E-mail</label><input class="input" id="aEmail" name="email" type="email" autocomplete="email" value="${esc(v.email||'')}">${e.email?`<span class="err">${e.email}</span>`:''}</div>
    <div class="field"><label for="aPw">${L('Password','Mot de passe')}</label><input class="input" id="aPw" name="pw" type="password" autocomplete="current-password">${e.pw?`<span class="err">${e.pw}</span>`:''}</div>${err}
    <button class="btn primary" type="submit">${L('Sign in','Se connecter')}</button></form>`;
  return head+`<form data-form="signup" class="stack" novalidate>
    <div class="field"><label for="aEmail">E-mail</label><input class="input" id="aEmail" name="email" type="email" autocomplete="email" value="${esc(v.email||'')}">${e.email?`<span class="err">${e.email}</span>`:`<span class="help">${L('Used to sign in and reset your password. Never shown to other players.','Sert à te connecter et à récupérer ton mot de passe. Jamais montré aux autres joueurs.')}</span>`}</div>
    <div class="field"><label for="aPw">${L('Password','Mot de passe')}</label><input class="input" id="aPw" name="pw" type="password" autocomplete="new-password">${e.pw?`<span class="err">${e.pw}</span>`:`<span class="help">${L('At least 8 characters with a number.','Au moins 8 caractères dont un chiffre.')}</span>`}</div>
    <div class="field"><label for="aUser">${L('Username','Pseudo')}</label><input class="input" id="aUser" name="user" maxlength="16" autocomplete="nickname" value="${esc(v.user||'')}">${e.user?`<span class="err">${e.user}</span>`:`<span class="help">${L('3–16 letters, numbers, dot or underscore. Shown on leaderboards.','3 à 16 lettres, chiffres, point ou tiret bas. Affiché dans les classements.')}</span>`}</div>
    <div class="field"><span class="lab">Avatar</span><div class="choice">${AV_PRESETS.map((a,i)=>a.premium?'':`<button type="button" data-act="authAv" data-a="${i}" aria-pressed="${(sh.av??0)===i}">${face(a,34)}</button>`).join('')}</div></div>
    <p class="tiny">${ic('campus',14)} ${L('You’ll add your school and your year right after, once signed in.','Tu indiqueras ton école et ton année juste après, une fois connecté.')}</p>
    <label class="tiny" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" name="age" ${v.age?'checked':''} style="margin-top:3px"> <span>${L('I am 15 or older, or I have my parents’ permission.','J’ai 15 ans ou plus, ou l’accord de mes parents.')}</span></label>${e.age?`<span class="err">${e.age}</span>`:''}
    ${err}<button class="btn primary" type="submit">${L('Create my account','Créer mon compte')}</button></form>`;
};
if(LIVE){
  const socialDemo=VIEWS.social;
  VIEWS.social=()=>{
    const st=S.data,duels=st.history.filter(h=>h.m==='duel').slice(0,10);
    return `<div class="page-h"><div><p class="eyebrow">Social</p><h1>${L('Duels and reports','Duels et signalements')}</h1><p>${L('Duels pit you against the best run of a real player close to your rating. Friends lists and direct challenges are coming next.','Les duels t’opposent au meilleur résultat d’un vrai joueur proche de ta cote. Les listes d’amis et les défis directs arrivent ensuite.')}</p></div>
      <button class="btn primary" type="button" data-act="classmate">${ic('swords',16)}${L('Start a duel','Lancer un duel')}</button></div>
    <div class="grid">
      <section class="card c6"><div class="card-h"><h2>${L('Your duels','Tes duels')}</h2></div>${duels.length?`<ul class="hist">${duels.map(histItem).join('')}</ul>`:`<div class="empty"><b>${L('No duels yet','Aucun duel')}</b>${L('Win a duel to climb the rating ladder.','Gagne un duel pour grimper au classement.')}</div>`}</section>
      <section class="card c6"><div class="card-h"><h2>${L('Recent duels','Duels récents')}</h2></div>${liveFeedHTML()}</section>
      <section class="card c12"><div class="card-h"><h2>${L('Report a player','Signaler un joueur')}</h2></div><p class="tiny">${L('Use the ⚑ next to a name in the rankings. Moderators review every report.','Utilise le ⚑ à côté d’un pseudo dans les classements. Les modérateurs examinent chaque signalement.')}</p></section>
    </div>`;
  };
}

/* ---------- profil serveur → état local ---------- */
function applyMe(m){
  const st=S.data;
  if(st.uid!==m.id){const keep={lang:st.lang,sound:st.sound};S.data=Object.assign(DEF(),keep,{uid:m.id});}
  const d=S.data;NET.me=m;
  d.account.signedIn=true;d.account.username=m.username;d.account.avatar=m.avatar;d.account.frame=m.frame;d.account.skin=m.skin;
  d.school={id:m.school_id,program:m.program||'bus2',year:m.study_year||null,status:m.verified?'verified':(m.verification&&m.verification.status==='pending'&&m.verification.school===m.school_id?'pending':'unverified'),domain:m.verification?m.verification.domain:null};
  d.xp=m.xp;d.rating=m.rating;d.streak=m.streak;
  d.bests={};Object.entries(m.bests||{}).forEach(([k,v])=>d.bests[k]=Number(v));
  d.history=(m.runs||[]).map(r=>({g:r.g,sk:r.sk,m:r.m,s:Number(r.s),o:r.o,opp:r.opp,xp:r.xp,dr:r.dr,t:r.t,x:r.x==null?undefined:Number(r.x),w:r.w,st:r.st}));
  d.daily={day:dayKey(),att:Object.fromEntries(GAMES.map(g=>[g.id,Math.max(0,3-((m.daily&&m.daily.used&&m.daily.used[g.id])||0))])),best:Object.fromEntries(Object.entries((m.daily&&m.daily.best)||{}).map(([k,v])=>[k,Number(v)]))};
  d.schoolPts=m.school_pts||0;
  d.gems=m.gems||0;d.owned=m.owned||[];d.gear=m.gear||{};
  if(m.status==='suspended')toast(errText('suspended:'+m.until));
  checkAch();save();
}
function applyInfo(info){
  NET.info=info;
  SCHOOLS.length=0;Object.keys(SCH).forEach(k=>delete SCH[k]);
  (info.schools||[]).forEach(addSchoolLocal);
  const on=new Set((info.games||[]).filter(g=>g.on).map(g=>g.id));
  GAMES.forEach(g=>{if(g.id!=='party'){g.playable=on.has(g.id);if(!g.playable)g.eta=()=>L('Temporarily unavailable','Indisponible pour le moment');}});
  PLAYABLE.length=0;GAMES.filter(g=>g.playable).forEach(g=>PLAYABLE.push(g));
}
function addSchoolLocal(x){const s={id:x.id,name:x.name,short:x.short,city:x.city,country:[x.country,x.country],domain:x.domain,col:x.col,members:Number(x.members)||0};
  const i=SCHOOLS.findIndex(y=>y.id===s.id);if(i>=0)SCHOOLS[i]=s;else SCHOOLS.push(s);SCH[s.id]=s;return s;}
async function loadMe(){if(!NET.user)return;try{applyMe(await rpc('me'));
  if(NET.pendingLeague&&!(S.ui.sheet&&S.ui.sheet.type==='league'&&S.ui.sheet.prev)){openLeagueInvite(NET.pendingLeague);}else maybeOnboard();}catch(e){toast(errText(e));}softRender();}
/* Juste après l'inscription (ou tant que ce n'est pas fait) : demander l'école et l'année, une fois par session, avec « Plus tard ». */
function maybeOnboard(){
  const m=NET.me;if(!m||NET.onb||(m.school_id&&m.study_year))return;
  try{if(localStorage.getItem('ryvo.onb.'+m.id))return;}catch(e){}
  /* pas pendant une partie ni sur l'écran de résultat (on laisse rejouer tout de suite après une connexion) */
  if(S.ui.sheet||S.ui.notif||['game','result','campus'].includes(S.route))return;
  NET.onb=true;Object.assign(S.ui.campus,{edit:true,q:'',pick:m.school_id||null,year:m.study_year||null,err:null,adding:false});
  S.ui.sheet={type:'campus'};renderLayer();
}
async function loadInfo(){try{applyInfo(await rpc('public_info'));}catch(e){NET.infoErr=errText(e);}softRender();}
function toGuest(){const keep={lang:S.data.lang,sound:S.data.sound};S.data=Object.assign(DEF(),keep);NET.me=null;save();}

if(LIVE){const go0=go;go=function(r,a){go0(r,a);if(NET.me&&!NET.onb)setTimeout(maybeOnboard,250);};}

/* ---------- partie : lancement, contexte, envoi ---------- */
const startGameLocal=startGame,makeCtxLocal=makeCtx,finishGameLocal=finishGame;
if(LIVE){
  startGame=async function(id,mode,oppId,opt={}){
    SFX.init();
    if(!NET.user){
      /* Invité : on joue tout de suite, en local, sans ticket serveur. Rien n'est enregistré ;
         la connexion est proposée à la fin de la partie. */
      const o=Object.assign({},opt,{practice:true,want:mode});
      if(mode==='daily')o.track=dailyTrack(),o.cat='mix';
      if(!NET.guestTold){NET.guestTold=true;toast(L('Guest mode: sign in at the end to save your scores.','Mode invité : connecte-toi à la fin pour enregistrer tes scores.'));}
      startGameLocal(id,'trial',null,o);return;
    }
    if(NET.starting)return;NET.starting=true;
    const Lb=S.ui.lobby,lv=levelInfo(S.data.xp).L;
    let track=opt.track!=null?opt.track:(Lb.game===id?Lb.track:0);if(TRACKS[track].lv>lv)track=0;
    const cat=opt.cat||(Lb.game===id?Lb.cat:'mix');
    try{
      const run=await rpc('start_run',{p_game:id,p_mode:mode,p_track:track,p_cat:cat,p_lang:LANG,p_opp:opt.opp||null,p_challenge:opt.challenge||null,p_live:opt.live||null});
      S.game={id,mode:run.mode||mode,sk:run.sk,track:run.track,cat:run.cat||cat,oppId:null,run,live:run.live?liveJoin(run.live,run.opp):null};
      Object.assign(S.ui.lobby,{game:id,mode,track:id==='sprint'&&mode!=='daily'?track:Lb.track,cat:id==='brain'&&mode!=='daily'?cat:Lb.cat});
      go('game');
    }catch(e){toast(errText(e));if(/daily|not_daily/.test(e.message))loadMe();}
    finally{NET.starting=false;}
  };
  makeCtx=function(g){
    if(!g.run)return makeCtxLocal(g);
    const run=g.run,showOpp=run.opp&&(!run.live||g.id==='sprint');
    const o=showOpp?{id:run.opp.id||'bot',name:run.opp.name,face:faceOf({avatar:run.opp.avatar,id:run.opp.name}),frame:run.opp.frame,gear:run.opp.gear||{},school:null,rating:run.opp.rating,skill:Number(run.opp.skill)||0.5,best:{}}:null;
    const ctx={mode:g.mode,opp:o,sk:run.sk,track:run.track,cat:run.cat,rand:rng(Number(run.seed))};
    if(g.live&&g.id==='sprint')ctx.live=g.live.ctx;
    if(o&&run.opp.score!=null){ctx.oppScore=Number(run.opp.score);if(g.id==='sprint')ctx.oppTime=ctx.oppScore;if(g.id==='reflex')ctx.oppBase=ctx.oppScore-12;}
    if(g.id==='brain'&&run.questions){ctx.questions=run.questions;ctx.answer=(i,k,t)=>rpc('answer_question',{p_run:run.run,p_i:i,p_k:k,p_t:Math.round(t*100)/100});}
    if(g.id==='words'&&run.words){ctx.words=run.words;ctx.wordEvent=(i,kind,guess)=>rpc('word_event',{p_run:run.run,p_i:i,p_kind:kind,p_guess:guess||null});}
    return ctx;
  };
  finishGame=function(res){
    const g=S.game;
    if(S.ctrl){S.ctrl.destroy();S.ctrl=null;}
    if(g.practice||!g.run){
      S.result={practice:true,g:g.id,sk:g.sk,mode:'trial',want:g.want||'trial',track:g.track,cat:g.cat,score:res.score,details:res.details,fresh:false};go('result');
      if(!NET.user){S.ui.sheet={type:'auth',tab:'signup',run:{sk:g.sk,score:res.score}};renderLayer();}
      return;
    }
    const mount=$('#gameMount');
    const send=async()=>{
      mount.innerHTML=`<div class="empty" style="min-height:240px;justify-content:center"><div class="skel" style="width:60%"></div><b>${L('Checking your score…','Vérification du score…')}</b>${L('The server recalculates it from your run.','Le serveur le recalcule à partir de ta partie.')}</div>`;
      try{afterSubmit(res,await rpc('submit_run',{p_run:g.run.run,p:res.payload||{}}));}
      catch(e){mount.innerHTML=`<div class="empty" style="min-height:240px;justify-content:center"><b>${L('Your score couldn’t be sent','Ton score n’a pas pu être envoyé')}</b>${esc(errText(e))}<div class="row" style="justify-content:center"><button class="btn primary" type="button" id="retrySend">${L('Try again','Réessayer')}</button><button class="btn" type="button" data-act="go" data-a="play">${L('Leave','Quitter')}</button></div></div>`;
        const b=$('#retrySend');if(b)b.onclick=send;}
    };
    send();
  };
}
function afterSubmit(res,srv){
  const g=S.game,st=S.data,sk=g.sk;
  if(srv.rejected){S.result={rejected:true,g:g.id,sk,mode:g.mode,fresh:false};go('result');return;}
  const score=Number(srv.score),prev=srv.prev!=null?Number(srv.prev):null,valid=srv.status==='valid';
  if(g.id==='sprint'&&res.ghost&&res.ghost.length>5&&valid){const gh=st.ghosts[sk];if(!gh||score<gh.time)st.ghosts[sk]={time:score,frames:res.ghost};}
  const f=res.flags||{};['flash','scholar','clean','ghostBeat','grid5','word8','combo20'].forEach(k=>{if(f[k]&&valid)st.stats[k]=true;});
  if(f.maxFloors&&valid)st.stats.maxFloors=Math.max(st.stats.maxFloors||0,f.maxFloors);
  if(g.mode==='duel'&&srv.outcome==='win')st.stats.duelWins++;else if(g.mode==='duel'&&srv.outcome==='loss')st.stats.duelLosses++;
  if(g.id==='cards'&&srv.outcome==='win')st.stats.cardWins++;
  if(g.mode==='school')st.stats.schoolRuns++;
  const lastSame=st.history.find(h=>h.sk===sk),lvBefore=levelInfo(st.xp).L,isBetter=valid&&better(sk,score,prev);
  st.xp=srv.xp_total;st.rating=srv.rating;st.streak=srv.streak;
  if(isBetter)st.bests[sk]=score;
  st.history.unshift({g:g.id,sk,m:g.mode,s:score,o:srv.outcome,opp:g.run.opp?g.run.opp.name:null,xp:srv.xp,dr:srv.dr,t:Date.now(),x:res.x,st:srv.status});
  if(g.mode==='daily'){st.daily.att[g.id]=Math.max(0,attLeft(g.id)-1);if(valid&&better(sk,score,st.daily.best[g.id]))st.daily.best[g.id]=score;}
  const newAch=checkAch();newAch.forEach(a=>{const [en,fr]=both(a.n);notify(`Achievement unlocked: ${en}.`,`Succès débloqué : ${fr}.`);});
  (srv.missions||[]).forEach(()=>notify('Mission complete.','Mission accomplie.'));
  if(srv.level>lvBefore)notify(`Level up: you reached level ${srv.level}.`,`Niveau supérieur : tu passes niveau ${srv.level}.`);
  if(isBetter&&prev!=null)notify(`New personal best in ${skName(sk)}.`,`Nouveau record sur ${skName(sk)}.`);
  save();
  S.result={g:g.id,sk,mode:g.mode,score,prev,better:isBetter,first:prev==null&&valid,perf:res.perf,outcome:srv.outcome,oppName:g.run.opp?g.run.opp.name:(res.oppName||null),
    oppScore:srv.opp_score!=null?Number(srv.opp_score):(g.mode==='duel'?null:res.oppScore??null),xp:srv.xp+(srv.mission_xp||0),lvBefore,lvAfter:srv.level,dr:srv.dr,schoolGain:srv.school_gain,ach:newAch,
    details:Object.assign({},res.details,g.id==='brain'&&srv.details?{correct:srv.details.correct,avgT:srv.details.avgT,bestStreak:srv.details.bestStreak}:{}),
    dailyLeft:g.mode==='daily'?attLeft(g.id):null,lastPrev:lastSame?lastSame.s:null,fresh:true,server:srv};
  if(srv.live&&g.live){g.live.fin(score);S.result.live=srv.live;livePollResult(srv.live.id);}
  invalidate();go('result');loadMe();
}

/* ---------- actions spécifiques au mode connecté ---------- */
if(LIVE){
  const A0=Object.assign({},ACT);
  const upd=(p,after)=>{if(!NET.user)return;rpc('update_profile',{p}).then(m=>{applyMe(m);softRender();if(after)after();}).catch(e=>{toast(errText(e));loadMe();});};
  Object.assign(ACT,{
    lang:a=>{A0.lang(a);if(NET.user)upd({lang:a});},
    avatar:a=>{A0.avatar(a);upd({avatar:+a});},
    frame:a=>{A0.frame(a);upd({frame:a});},
    skin:a=>{A0.skin(a);upd({skin:a});},
    classmate:()=>{S.ui.sheet={type:'pick',purpose:'duel'};S.ui.notif=false;renderLayer();},
    campusSave:()=>{const c=S.ui.campus,pick=c.pick||S.data.school.id;
      if(!NET.user){toast(L('Sign in to save your school.','Connecte-toi pour enregistrer ton école.'));ACT.auth('login');return;}
      if(c.adding){c.err=L('Finish adding your school first.','Termine d’abord l’ajout de ton école.');campusRefresh();return;}
      if(!pick){c.err=L('Pick your school in the list, or add it.','Choisis ton école dans la liste, ou ajoute-la.');campusRefresh();return;}
      if(!c.year){c.err=L('Choose your year of study.','Choisis ton année d’études.');campusRefresh();return;}
      if(c.busy)return;c.busy=true;
      rpc('update_profile',{p:{school_id:pick,study_year:c.year}}).then(m=>{applyMe(m);c.edit=false;c.err=null;invalidate();loadInfo();
        if(S.ui.sheet&&S.ui.sheet.type==='campus'){S.ui.sheet=null;renderLayer();}
        toast(L(`Saved: ${SCH[pick]?SCH[pick].name:''}, ${yearName(c.year)}.`,`Enregistré : ${SCH[pick]?SCH[pick].name:''}, ${yearName(c.year)}.`));softRender();})
      .catch(e=>{c.err=errText(e);campusRefresh();}).finally(()=>{c.busy=false;});},
    campusAddConfirm:async()=>{const c=S.ui.campus,e=newSchoolErr();if(e){c.err=e;campusRefresh();return;}
      if(!NET.user){toast(L('Sign in to add your school.','Connecte-toi pour ajouter ton école.'));ACT.auth('login');return;}
      if(c.busy)return;c.busy=true;
      try{const x=await rpc('add_school',{p_name:c.nn.trim(),p_city:c.nc.trim(),p_country:(c.nco||'France').trim()||'France'});const sc=addSchoolLocal(x);
        Object.assign(c,{pick:sc.id,adding:false,q:'',err:null});
        toast(x.existed?L('This school was already there: it’s now selected.','Cette école existait déjà : elle est sélectionnée.'):L('School added: everyone can now pick it. Choose your year and save.','École ajoutée : tout le monde peut la choisir. Choisis ton année et enregistre.'));}
      catch(err){c.err=errText(err);}
      finally{c.busy=false;campusRefresh();}},
    campusRemove:()=>upd({school_id:null},()=>{S.ui.campus.edit=false;invalidate();loadInfo();render();}),
    verifyReset:()=>{S.data.school.status='unverified';render();},
    signout:async()=>{await sb.auth.signOut();toast(L('Signed out.','Déconnecté.'));},
    export:async()=>{try{const d=await rpc('export_my_data');S.ui.sheet={type:'export',text:JSON.stringify(d,null,2)};renderLayer();}catch(e){toast(errText(e));}},
    reset:()=>{if(!NET.user)return;S.ui.sheet={type:'confirm',what:'delete'};renderLayer();},
    confirmYes:async()=>{const w=S.ui.sheet&&S.ui.sheet.what;
      if(w==='delete'){S.ui.sheet=null;renderLayer();try{await rpc('delete_my_account');await sb.auth.signOut();toast(L('Your account has been deleted.','Ton compte a été supprimé.'));}catch(e){toast(errText(e));}return;}
      A0.confirmYes();},
    report:(a,el)=>{if(!NET.user){ACT.auth('login');return;}S.ui.sheet={type:'report',id:a,name:el.dataset.n||''};renderLayer();},
    claim:()=>{},
    again:()=>{const r=S.result;if(!r)return;
      if(r.practice){const m=r.want||'trial';startGame(r.g,m,null,m==='daily'?{}:{track:r.track,cat:r.cat});return;}
      startGame(r.g,r.mode,null,{track:S.game&&S.game.track,cat:S.game&&S.game.cat});}
  });
}
const EMAIL_RE2=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if(LIVE)document.addEventListener('submit',async e=>{
  const f=e.target,k=f.dataset&&f.dataset.form;
  if(!['signup','login','recover','newpw','verify','report','uname'].includes(k))return;
  e.preventDefault();e.stopImmediatePropagation();
  const F=n=>f.elements[n]?String(f.elements[n].value).trim():'',sh=S.ui.sheet,btn=f.querySelector('button[type=submit]');
  const busy=b=>{if(btn)btn.disabled=b;};
  const fail=(err,vals)=>{S.ui.sheet=Object.assign(sh||{type:'auth'},{err,vals});renderLayer();};
  const redirect=location.origin+location.pathname;
  if(k==='signup'){
    const email=F('email'),pw=f.elements.pw.value,user=F('user'),school='',age=f.elements.age.checked,err={};
    if(!EMAIL_RE2.test(email))err.email=L('Enter a valid email address.','Saisis une adresse e-mail valide.');
    if(pw.length<8||!/\d/.test(pw))err.pw=L('Use at least 8 characters, including a number.','Au moins 8 caractères, dont un chiffre.');
    if(!/^[A-Za-z0-9._]{3,16}$/.test(user))err.user=L('Use 3–16 letters, numbers, dots or underscores.','3 à 16 lettres, chiffres, points ou tirets bas.');
    if(!age)err.age=L('Please confirm this to continue.','Merci de confirmer pour continuer.');
    if(Object.keys(err).length)return fail(err,{email,user,school,age});
    busy(true);
    const {data,error}=await sb.auth.signUp({email,password:pw,options:{data:{username:user,avatar:sh&&sh.av!=null?sh.av:0,lang:LANG},emailRedirectTo:redirect}});
    if(error){busy(false);return fail({form:/registered|exists/i.test(error.message)?L('An account already exists with this email. Sign in instead.','Un compte existe déjà avec cet e-mail. Connecte-toi.'):/password/i.test(error.message)?L('This password is too weak. Pick a longer one.','Ce mot de passe est trop faible. Choisis-en un plus long.'):errText(error)},{email,user,school,age});}
    if(data.session){S.ui.sheet=null;renderLayer();toast(L('Account created.','Compte créé.'));}
    else{S.ui.sheet={type:'auth',tab:'sent',email};renderLayer();}
  }
  if(k==='login'){
    const email=F('email'),pw=f.elements.pw.value;
    if(!EMAIL_RE2.test(email)||!pw)return fail({email:!EMAIL_RE2.test(email)?L('Enter your email.','Saisis ton e-mail.'):'',pw:!pw?L('Enter your password.','Saisis ton mot de passe.'):''},{email});
    busy(true);const {error}=await sb.auth.signInWithPassword({email,password:pw});
    if(error){busy(false);return fail({form:/confirm/i.test(error.message)?L('Confirm your email first (link sent when you signed up).','Confirme d’abord ton e-mail (lien reçu à l’inscription).'):/invalid/i.test(error.message)?L('Wrong email or password.','E-mail ou mot de passe incorrect.'):errText(error)},{email});}
    const hadRun=sh&&sh.run;S.ui.sheet=null;renderLayer();toast(hadRun?L('Signed in. Your next run will be saved.','Connecté. Ta prochaine partie sera enregistrée.'):L('Signed in.','Connecté.'));
  }
  if(k==='recover'){
    const email=F('email');if(!EMAIL_RE2.test(email))return fail({email:L('Enter a valid email address.','Saisis une adresse e-mail valide.')},{email});
    busy(true);await sb.auth.resetPasswordForEmail(email,{redirectTo:redirect});S.ui.sheet=Object.assign(sh,{sent:true,err:{}});renderLayer();
  }
  if(k==='newpw'){
    const pw=f.elements.pw.value;if(pw.length<8||!/\d/.test(pw))return fail({pw:L('Use at least 8 characters, including a number.','Au moins 8 caractères, dont un chiffre.')});
    busy(true);const {error}=await sb.auth.updateUser({password:pw});if(error){busy(false);return fail({form:errText(error)});}
    S.ui.sheet=null;renderLayer();toast(L('Password updated.','Mot de passe mis à jour.'));
  }
  if(k==='verify'){
    if(!NET.user){ACT.auth('login');return;}
    busy(true);
    try{await rpc('request_verification',{p_school:S.data.school.id,p_email:F('email')});S.ui.campus.err=null;toast(L('Request sent. The team will review it.','Demande envoyée. L’équipe va la vérifier.'));await loadMe();}
    catch(err){S.ui.campus.err='v:'+errText(err);render();}
  }
  if(k==='report'){
    busy(true);
    try{await rpc('report_player',{p_target:sh.id,p_type:F('type'),p_text:F('text')});S.ui.sheet=null;renderLayer();toast(L('Report sent. Thank you.','Signalement envoyé. Merci.'));}
    catch(err){busy(false);toast(errText(err));}
  }
  if(k==='uname'){
    busy(true);try{applyMe(await rpc('update_profile',{p:{username:F('user')}}));toast(L('Username saved.','Pseudo enregistré.'));invalidate();render();}catch(err){busy(false);toast(errText(err));}
  }
},true);

/* ---------- boutique en ligne : achats en gemmes, paiement Stripe, pubs récompensées ---------- */
const ADS={loaded:false,failed:false};
function adsLoad(){
  const c=CFG.ads&&CFG.ads.client;if(!c||ADS.loaded)return;ADS.loaded=true;
  window.adsbygoogle=window.adsbygoogle||[];window.adBreak=window.adConfig=function(o){window.adsbygoogle.push(o);};
  const s=document.createElement('script');s.async=true;s.crossOrigin='anonymous';
  s.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(c);s.setAttribute('data-ad-client',c);
  if(CFG.ads.test)s.setAttribute('data-adbreak-test','on');s.onerror=()=>{ADS.failed=true;};document.head.appendChild(s);
  window.adConfig({preloadAdBreaks:'on',sound:'on'});
}
async function payError(e){let code='';try{code=(await e.context.json()).error;}catch(_){}return new Error(code||e.message||'server_error');}
if(LIVE){
  const A1=Object.assign({},ACT);
  Object.assign(ACT,{
    itemBuyYes:async a=>{if(!NET.user){ACT.auth('signup');return;}const it=shopCfg().items.find(i=>i.id===a);if(!it)return;
      try{applyMe(await rpc('buy_item',{p_item:a}));S.ui.sheet=null;renderLayer();ACT.equip(a);SFX.play('tap');toast(L(`${it.en} unlocked and equipped.`,`${it.fr} débloqué et équipé.`));softRender();}
      catch(e){toast(errText(e));loadMe();}},
    packPay:async a=>{const sh=S.ui.sheet,w=document.getElementById('waiver');
      if(!NET.user){ACT.auth('signup');return;}
      if(!payReady()){toast(L('Card payment isn’t available yet.','Le paiement par carte n’est pas encore disponible.'));return;}
      if(!w||!w.checked){sh.err=errText('waiver_required');renderLayer();return;}
      sh.busy=true;sh.err=null;renderLayer();
      try{const {data,error}=await sb.functions.invoke('payments/checkout',{body:{pack:a,waiver:true,lang:LANG}});
        if(error)throw await payError(error);
        if(!data||!data.url)throw new Error('server_error');
        location.href=data.url;}
      catch(e){sh.busy=false;const t=errText(e);sh.err=t===e.message&&!/[ ’]/.test(t)?errText('server_error'):t;renderLayer();}},
    watchAd:()=>{const a=adState();if(!NET.user){ACT.auth('signup');return;}if(!a.on||!a.left||a.wait)return;
      adsLoad();if(ADS.failed){toast(L('Ads are blocked in this browser (ad blocker?).','Les pubs sont bloquées sur ce navigateur (bloqueur de pub ?).'));return;}
      let done=false,viewed=false;const none=()=>toast(L('No ad available right now. Try again later.','Aucune pub disponible pour le moment. Réessaie plus tard.'));
      const t=setTimeout(()=>{if(!done){done=true;none();}},10000);
      window.adBreak({type:'reward',name:'gemmes',
        beforeReward:show=>show(),
        adDismissed:()=>toast(L('Ad closed before the end: no gems this time.','Pub fermée avant la fin : pas de gemmes cette fois.')),
        adViewed:()=>{viewed=true;rpc('ad_reward').then(r=>{toast(L(`+${r.reward} gems. Thanks!`,`+${r.reward} gemmes. Merci !`));loadMe();}).catch(e=>toast(errText(e)));},
        adBreakDone:i=>{clearTimeout(t);if(done)return;done=true;if(!viewed&&!(i&&i.breakStatus==='dismissed'))none();}});},
    lgOpen:a=>{S.ui.lg.id=a;S.ui.lg.err=null;invalidate('lg:');if(S.route!=='leagues')go('leagues');else render();window.scrollTo(0,0);},
    lgBack:()=>{S.ui.lg.id=null;invalidate('leagues');render();},
    lgPlay:a=>{const g=gameOf(a);ACT.lobby(g);if(g==='sprint'){S.ui.lobby.track=trackOf(a);render();}},
    lgCopy:a=>{const url=leagueLink(a);const done=()=>toast(L('Invite link copied.','Lien d’invitation copié.'));
      if(navigator.share&&matchMedia('(pointer:coarse)').matches)navigator.share({title:'RYVO',text:L('Join my league on RYVO','Rejoins ma ligue sur RYVO'),url}).catch(()=>{});
      else if(navigator.clipboard)navigator.clipboard.writeText(url).then(done,()=>prompt('',url));else prompt('',url);},
    lgAsk:(a,el)=>{S.ui.sheet={type:'league',what:a,id:S.ui.lg.id,user:el&&el.dataset.u,name:el&&el.dataset.n};renderLayer();},
    lgDo:async()=>{const sh=S.ui.sheet;if(!sh||sh.type!=='league')return;
      try{
        if(sh.what==='upgrade'){await rpc('league_upgrade',{p_id:sh.id});toast(L('League+ unlocked.','Ligue+ activée.'));loadMe();}
        if(sh.what==='delete'){await rpc('delete_league',{p_id:sh.id});S.ui.lg.id=null;toast(L('League deleted.','Ligue supprimée.'));}
        if(sh.what==='leave'){await rpc('leave_league',{p_id:sh.id});S.ui.lg.id=null;toast(L('You left the league.','Tu as quitté la ligue.'));}
        if(sh.what==='kick'){await rpc('league_kick',{p_id:sh.id,p_user:sh.user});toast(L('Player removed.','Joueur retiré.'));}
        if(sh.what==='join'){const l=await rpc('join_league',{p_code:sh.code});NET.pendingLeague=null;S.ui.sheet=null;invalidate('leagues');ACT.lgOpen(l.id);toast(L('Welcome to the league!','Bienvenue dans la ligue !'));return;}
        S.ui.sheet=null;invalidate('lg');invalidate('leagues');renderLayer();render();
      }catch(e){sh.err=errText(e);renderLayer();}},
    lgCol:a=>{rpc('league_update',{p_id:S.ui.lg.id,p_col:a}).then(()=>{invalidate('lg:');render();}).catch(e=>toast(errText(e)));},
    lgCsv:()=>{const v=NET.cache['lg:'+S.ui.lg.id]&&NET.cache['lg:'+S.ui.lg.id].v;if(!v)return;
      const q=x=>'"'+String(x).replace(/"/g,'""')+'"',rows=[[L('Position','Position'),L('Player','Joueur'),L('Best','Meilleur score'),L('Runs','Parties')]].concat(v.rows.map(r=>[r.pos||'',r.name,r.val==null?'':fmtScore(v.sk,Number(r.val)),r.runs]));
      const blob=new Blob(['﻿'+rows.map(r=>r.map(q).join(';')).join('\r\n')],{type:'text/csv'}),u=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=u;a.download='ligue-'+v.code+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000);}
  });
}
const leagueLink=code=>location.origin+location.pathname+'?ligue='+encodeURIComponent(code);
const endsTxt=t=>{const d=t-Date.now();if(d<=0)return L('ended','terminée');const h=Math.round(d/36e5);return h<48?L(`ends in ${h} h`,`fin dans ${h} h`):L(`ends in ${Math.round(h/24)} d`,`fin dans ${Math.round(h/24)} j`);};
function lgRowHTML(l){
  return `<button class="lgl" type="button" data-act="lgOpen" data-a="${l.id}"><span class="dotc" style="background:${l.col}"></span><span style="min-width:0;flex:1"><b style="display:block">${esc(l.name)}${l.plus?' <span class="pill now">Ligue+</span>':''}</b>
    <span class="tiny">${esc(skName(l.sk))} · ${l.members}/${l.max} ${plural(l.members,'player','players','joueur','joueurs')} · ${endsTxt(l.ends)}</span></span>
    <span class="num" style="font:800 18px/1 var(--f-d)">${l.me&&l.me.pos?'#'+l.me.pos:'–'}</span></button>`;
}
function leagueDetailHTML(id){
  const key='lg:'+id,v=cached(key,()=>rpc('league_board',{p_id:id}));
  const back=`<button class="btn sm ghost" type="button" data-act="lgBack">${ic('back',16)}${L('My leagues','Mes ligues')}</button>`;
  if(v===undefined)return back+`<div class="lb" aria-busy="true" style="margin-top:14px">${'<div class="skel"></div>'.repeat(5)}</div>`;
  if(v===null)return back+`<div class="empty" style="margin-top:14px"><b>${esc(cacheErr(key)||'')}</b></div>`;
  const ended=v.ends<=Date.now(),uid=NET.user&&NET.user.id,C=shopCfg();
  const rows=v.rows.map(r=>`<div class="lb-row${r.id===uid?' me':''}${r.pos&&r.pos<=3?' top':''}"><span class="pos">${r.pos||'–'}</span><span class="who">${avP({id:r.id,name:r.name,face:faceOf(r),frame:r.frame},32)}<span class="nm"><b>${esc(r.name)}${r.id===uid?`<em>${L('You','Toi')}</em>`:''}</b><small>${r.runs} ${plural(r.runs,'run','runs','partie','parties')}</small></span></span><span class="val">${r.val==null?'—':fmtScore(v.sk,Number(r.val))}</span>${v.mine&&r.id!==uid?`<button class="rep" type="button" data-act="lgAsk" data-a="kick" data-u="${r.id}" data-n="${esc(r.name)}" aria-label="${L('Remove','Retirer')} ${esc(r.name)}">✕</button>`:'<span></span>'}</div>`).join('');
  const owner=v.mine?(v.plus?`<section class="card c5"><div class="card-h"><h2>Ligue+</h2><span class="pill now">${L('Active','Active')}</span></div>
      <p class="tiny">${L(`Up to ${v.max} players and 60 days.`,`Jusqu’à ${v.max} joueurs et 60 jours.`)}</p>
      <span class="lab">${L('Colour','Couleur')}</span><div class="cols">${['#5B4BFF','#FF6B3D','#3D7BFF','#14B37A','#FF4FA0','#E0A100','#00A6C8','#8B5CF6','#F23F55','#17142A'].map(c=>`<button type="button" data-act="lgCol" data-a="${c}" aria-pressed="${v.col===c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>
      <form data-form="lgDays" class="row" novalidate style="align-items:flex-end;margin-top:10px"><div class="field" style="flex:1"><label for="lgD">${L('Total duration','Durée totale')}</label><select class="input" id="lgD" name="days">${[7,14,21,30,45,60].map(d=>`<option value="${d}" ${Math.round((v.ends-v.starts)/864e5)===d?'selected':''}>${d} ${L('days','jours')}</option>`).join('')}</select></div><button class="btn sm" type="submit">${L('Save','Enregistrer')}</button></form>
      <button class="btn sm" type="button" data-act="lgCsv">${ic('download',15)}${L('Export results (CSV)','Exporter les résultats (CSV)')}</button></section>`
    :`<section class="card pop c5"><div class="card-h"><h2>${L('Upgrade to League+','Passe en Ligue+')}</h2></div><ul class="list">${[L('Up to 200 players (instead of 20)','Jusqu’à 200 joueurs (au lieu de 20)'),L('Up to 60 days (instead of 14)','Jusqu’à 60 jours (au lieu de 14)'),L('League colour and results export','Couleur de la ligue et export des résultats')].map(x=>`<li>${ic('check',16)}<span>${x}</span></li>`).join('')}</ul>
      <button class="btn hot" type="button" data-act="lgAsk" data-a="upgrade" ${ended?'disabled':''}>${ic('gem',16)}${L(`Unlock for ${gemTxt(C.league_plus)}`,`Débloquer pour ${gemTxt(C.league_plus)}`)}</button></section>`):'';
  return `${back}<div class="lg-head" style="background:${v.col};margin-top:12px"><div class="row" style="justify-content:space-between;align-items:flex-start"><div style="min-width:0"><p class="eyebrow" style="color:rgba(255,255,255,.8)">${esc(skName(v.sk))}${v.plus?' · Ligue+':''}</p><h2 style="font-size:26px;overflow-wrap:anywhere">${esc(v.name)}</h2>
      <p class="tiny">${L('By','Par')} ${esc(v.owner)} · ${v.members}/${v.max} ${plural(v.members,'player','players','joueur','joueurs')} · ${dateLabel(v.starts)} → ${dateLabel(v.ends)} · ${endsTxt(v.ends)}</p></div>
      <div style="text-align:right"><span class="tiny" style="display:block;margin-bottom:6px">${L('Invite code','Code d’invitation')}</span><span class="code">${esc(v.code)}</span></div></div>
    <div class="row" style="margin-top:14px"><button class="btn hot" type="button" data-act="lgPlay" data-a="${v.sk}" ${ended?'disabled':''}>${ic('play',16)}${L('Play','Jouer')}</button><button class="btn" type="button" data-act="lgCopy" data-a="${esc(v.code)}">${ic('share',16)}${L('Invite','Inviter')}</button></div></div>
  <div class="grid" style="margin-top:16px">
    <section class="card ${v.mine?'c7':'c12'}"><div class="card-h"><h2>${L('Standings','Classement')}</h2><span class="tiny">${ended?L('Final','Final'):L('Live','En direct')}</span></div>
      <div class="lb">${rows}</div>
      <p class="tiny">${L('Every run you finish on this game counts (practice, daily, duel, School Cup) between the start and the end. Scores are checked by the server.','Toutes tes parties sur ce jeu comptent (entraînement, défi du jour, duel, Coupe) entre le début et la fin. Les scores sont vérifiés par le serveur.')}</p>
      <div class="row">${v.mine?`<button class="btn sm ghost" type="button" data-act="lgAsk" data-a="delete" style="color:var(--bad)">${L('Delete the league','Supprimer la ligue')}</button>`:`<button class="btn sm ghost" type="button" data-act="lgAsk" data-a="leave">${L('Leave the league','Quitter la ligue')}</button>`}</div></section>
    ${owner}
  </div>`;
}
function leagueSheetHTML(sh,closeBtn){
  const C=shopCfg(),err=sh.err?`<p class="err" style="color:var(--bad);font-size:13px;font-weight:600">${esc(sh.err)}</p>`:'';
  if(sh.what==='join'){const p=sh.prev;
    if(!p)return `<div class="modal-h"><div><h2>${L('League','Ligue')}</h2></div>${closeBtn}</div><div class="skel"></div>`;
    const info=`<div class="lg-head" style="background:${p.col}"><p class="eyebrow" style="color:rgba(255,255,255,.8)">${esc(skName(p.sk))}</p><h2>${esc(p.name)}</h2><p class="tiny">${L('By','Par')} ${esc(p.owner)} · ${p.members}/${p.max} ${plural(p.members,'player','players','joueur','joueurs')} · ${endsTxt(p.ends)}</p></div>`;
    if(!NET.user)return `<div class="modal-h"><div><h2>${L('You’re invited to a league','Tu es invité dans une ligue')}</h2></div>${closeBtn}</div>${info}<p>${L('Create an account or sign in to join. Your scores will count in the league.','Crée un compte ou connecte-toi pour la rejoindre. Tes scores compteront dans la ligue.')}</p><div class="row"><button class="btn primary" type="button" data-act="auth" data-a="signup">${L('Create an account','Créer un compte')}</button><button class="btn" type="button" data-act="auth" data-a="login">${L('Sign in','Connexion')}</button></div>`;
    return `<div class="modal-h"><div><h2>${L('Join this league?','Rejoindre cette ligue ?')}</h2></div>${closeBtn}</div>${info}${err}<button class="btn primary" type="button" data-act="lgDo" ${p.ended||p.members>=p.max?'disabled':''}>${p.ended?L('This league is over','Cette ligue est terminée'):p.members>=p.max?L('This league is full','Cette ligue est complète'):L('Join','Rejoindre')}</button>`;}
  const T={upgrade:[L('Upgrade to League+?','Passer en Ligue+ ?'),L(`${gemTxt(C.league_plus)} will be taken from your balance (${gemTxt(S.data.gems||0)}).`,`${gemTxt(C.league_plus)} seront retirées de ton solde (${gemTxt(S.data.gems||0)}).`),L('Unlock','Débloquer')],
    delete:[L('Delete this league?','Supprimer cette ligue ?'),L('The league and its standings disappear for everyone. Players keep their scores.','La ligue et son classement disparaissent pour tout le monde. Les joueurs gardent leurs scores.'),L('Delete','Supprimer')],
    leave:[L('Leave this league?','Quitter cette ligue ?'),L('You can join again later with the code if there is room.','Tu pourras revenir avec le code s’il reste de la place.'),L('Leave','Quitter')],
    kick:[L(`Remove ${sh.name}?`,`Retirer ${sh.name} ?`),L('They can join again with the code. Change nothing else.','Il pourra revenir avec le code.'),L('Remove','Retirer')]}[sh.what]||['','',''];
  const lack=sh.what==='upgrade'&&(S.data.gems||0)<C.league_plus;
  return `<div class="modal-h"><div><h2>${esc(T[0])}</h2><p>${esc(T[1])}</p></div>${closeBtn}</div>${err}
    ${lack?`<div class="note">${ic('info')}<span>${L(`You need ${gemTxt(C.league_plus-(S.data.gems||0))} more.`,`Il te manque ${gemTxt(C.league_plus-(S.data.gems||0))}.`)}</span></div><button class="btn primary" type="button" data-act="toPacks">${L('Get gems','Obtenir des gemmes')}</button>`
      :`<div class="row"><button class="btn ${['delete','kick','leave'].includes(sh.what)?'':'primary'}" type="button" data-act="lgDo" style="${['delete','kick'].includes(sh.what)?'background:var(--bad);color:#fff':''}">${esc(T[2])}</button><button class="btn ghost" type="button" data-act="close">${L('Cancel','Annuler')}</button></div>`}`;
}
async function openLeagueInvite(code){
  S.ui.sheet={type:'league',what:'join',code,prev:null};renderLayer();
  try{const p=await rpc('league_preview',{p_code:code});
    if(!p){S.ui.sheet=null;renderLayer();NET.pendingLeague=null;toast(errText('league_not_found'));return;}
    if(p.member&&p.id){S.ui.sheet=null;NET.pendingLeague=null;ACT.lgOpen(p.id);return;}
    if(S.ui.sheet&&S.ui.sheet.type==='league'){S.ui.sheet.prev=p;renderLayer();}}
  catch(e){S.ui.sheet=null;renderLayer();toast(errText(e));}
}
if(LIVE){
  VIEWS.leagues=()=>{
    const head=`<div class="page-h"><div><p class="eyebrow">${L('Leagues','Ligues')}</p><h1>${L('Your own league','Ta propre ligue')}</h1><p>${L('Create a league for your group: friends, class, club. Share the code, everyone plays when they want, and the standings use your real runs, checked by the server.','Crée une ligue pour ton groupe : amis, promo, asso, club. Partage le code, chacun joue quand il veut, et le classement se fait sur vos vraies parties, vérifiées par le serveur.')}</p></div></div>`;
    if(!NET.user)return head+`<div class="empty"><b>${L('Sign in to create or join a league','Connecte-toi pour créer ou rejoindre une ligue')}</b>${L('Everyone in a league needs an account so their scores can be checked.','Chaque membre a besoin d’un compte pour que ses scores soient vérifiés.')}<button class="btn sm primary" type="button" data-act="auth" data-a="signup">${L('Create an account','Créer un compte')}</button></div>`;
    if(S.ui.lg.id)return leagueDetailHTML(S.ui.lg.id);
    const v=cached('leagues',()=>rpc('my_leagues')),C=shopCfg(),e=S.ui.lg.err;
    const list=v===undefined?`<div class="lb" aria-busy="true">${'<div class="skel"></div>'.repeat(3)}</div>`:v&&v.length?`<div class="stack">${v.map(lgRowHTML).join('')}</div>`
      :`<div class="empty"><b>${L('No league yet','Aucune ligue pour l’instant')}</b>${L('Create one and share the code, or join with a code you received.','Crée-en une et partage le code, ou rejoins-en une avec un code reçu.')}</div>`;
    return head+`<div class="grid">
      <section class="card c7"><div class="card-h"><h2>${L('My leagues','Mes ligues')}</h2></div>${list}</section>
      <section class="card pop c5"><div class="card-h"><h2>${L('Join a league','Rejoindre une ligue')}</h2></div>
        <form data-form="lgJoin" class="row" novalidate style="flex-wrap:nowrap"><input class="input" id="lgCode" name="code" maxlength="6" placeholder="${L('6-character code','Code à 6 caractères')}" autocomplete="off" style="flex:1;min-width:0;text-transform:uppercase;font-family:var(--f-m);letter-spacing:.12em"><button class="btn primary" type="submit">${L('Join','Rejoindre')}</button></form>
        ${e&&e.join?`<p class="err" style="color:var(--bad);font-size:13px;font-weight:600">${esc(e.join)}</p>`:''}
        <div class="card-h" style="margin-top:20px"><h2>${L('Create a league','Créer une ligue')}</h2></div>
        <form data-form="lgCreate" class="stack" novalidate>
          <div class="field"><label for="lgName">${L('Name','Nom')}</label><input class="input" id="lgName" name="name" maxlength="40" placeholder="${L('e.g. Reflex kings L3','ex. Les rois du réflexe L3')}"></div>
          <div class="row" style="align-items:flex-end"><div class="field" style="flex:2;min-width:150px"><label for="lgGame">${L('Game','Jeu')}</label><select class="input" id="lgGame" name="sk">${SKS.filter(sk=>GAME[gameOf(sk)]&&GAME[gameOf(sk)].playable).map(sk=>`<option value="${sk}">${esc(skName(sk))}</option>`).join('')}</select></div>
          <div class="field" style="flex:1;min-width:110px"><label for="lgDays">${L('Duration','Durée')}</label><select class="input" id="lgDays" name="days">${[3,7,14].map(d=>`<option value="${d}" ${d===7?'selected':''}>${d} ${L('days','jours')}</option>`).join('')}</select></div></div>
          ${e&&e.create?`<p class="err" style="color:var(--bad);font-size:13px;font-weight:600">${esc(e.create)}</p>`:''}
          <button class="btn hot" type="submit">${ic('flag',16)}${L('Create the league','Créer la ligue')}</button>
          <p class="tiny">${L(`Free up to 20 players and 14 days. League+ (${gemTxt(C.league_plus)}): 200 players, 60 days, colour and export.`,`Gratuit jusqu’à 20 joueurs et 14 jours. Ligue+ (${gemTxt(C.league_plus)}) : 200 joueurs, 60 jours, couleur et export.`)}</p></form></section>
    </div>`;
  };
  document.addEventListener('submit',async e=>{
    const f=e.target,k=f.dataset&&f.dataset.form;if(!['lgJoin','lgCreate','lgDays'].includes(k))return;
    e.preventDefault();e.stopImmediatePropagation();
    const F=n=>f.elements[n]?String(f.elements[n].value).trim():'',btn=f.querySelector('button[type=submit]');if(btn)btn.disabled=true;
    S.ui.lg.err=null;
    try{
      if(k==='lgJoin'){const c=F('code').toUpperCase();if(!/^[A-Z0-9]{6}$/.test(c)){S.ui.lg.err={join:L('A code has 6 letters or digits.','Un code fait 6 lettres ou chiffres.')};render();return;}await openLeagueInvite(c);}
      if(k==='lgCreate'){const l=await rpc('create_league',{p_name:F('name'),p_sk:F('sk'),p_days:+F('days')});invalidate('leagues');ACT.lgOpen(l.id);toast(L('League created. Share the code!','Ligue créée. Partage le code !'));}
      if(k==='lgDays'){await rpc('league_update',{p_id:S.ui.lg.id,p_days:+F('days')});invalidate('lg:');toast(L('Duration saved.','Durée enregistrée.'));render();}
    }catch(err){if(k==='lgDays')toast(errText(err));else{S.ui.lg.err={[k==='lgJoin'?'join':'create']:errText(err)};render();}}
    finally{if(btn&&document.contains(btn))btn.disabled=false;}
  },true);
}

/* ---------- choisir son adversaire : joueurs en ligne, défis directs, duels en direct ---------- */
const RT={pres:null,inbox:null,online:new Map(),shown:new Set(),waiting:null,poll:0};
const rtOK=()=>LIVE&&!!(sb&&sb.channel);
const showOnline=()=>{try{return localStorage.getItem('ryvo.hidden')!=='1';}catch(e){return true;}};
function rtStart(){
  if(!rtOK()||!NET.user||RT.pres)return;const uid=NET.user.id;
  RT.inbox=sb.channel('ryvo-u-'+uid).on('broadcast',{event:'live'},({payload})=>liveSignal(payload||{})).subscribe();
  if(showOnline()){
    RT.pres=sb.channel('ryvo-online',{config:{presence:{key:uid}}});
    RT.pres.on('presence',{event:'sync'},()=>{const st=RT.pres.presenceState();RT.online=new Map();Object.keys(st).forEach(k=>{const m=(st[k]||[])[0];if(k!==uid&&m&&m.id===k)RT.online.set(k,m);});if(!(S.route==='game'&&S.ctrl))softRender();if(S.ui.sheet&&S.ui.sheet.type==='opp')renderLayer();})
      .subscribe(async st=>{if(st==='SUBSCRIBED')try{await RT.pres.track({id:uid,name:S.data.account.username,avatar:S.data.account.avatar,frame:S.data.account.frame,rating:S.data.rating});}catch(e){}});
  }else RT.pres={off:true};
  clearInterval(RT.poll);RT.poll=setInterval(()=>{if(document.visibilityState==='visible'&&NET.user)livePoll();},12000);livePoll();
}
function rtStop(){if(!rtOK())return;[RT.pres,RT.inbox].forEach(c=>{if(c&&!c.off)try{sb.removeChannel(c);}catch(e){}});RT.pres=RT.inbox=null;RT.online=new Map();clearInterval(RT.poll);}
function rtSend(uid,payload){if(!rtOK()||!uid)return;const c=sb.channel('ryvo-u-'+uid);c.subscribe(st=>{if(st==='SUBSCRIBED'){c.send({type:'broadcast',event:'live',payload});setTimeout(()=>{try{sb.removeChannel(c);}catch(e){}},2000);}});}
const isOnline=id=>RT.online.has(id);
const pickSK=()=>{const Lb=S.ui.lobby,g=Lb.game&&Lb.game!=='cards'?Lb.game:'reflex';return g==='sprint'?'sprint@'+(Lb.track||0):g;};
function oppSheetHTML(sh,closeBtn){
  const sk=sh.sk,ids=[...RT.online.keys()],key='opp:'+ids.sort().join(','),onl=ids.length?cached(key,()=>rpc('find_players',{p_q:'',p_ids:ids}),15000):[];
  const row=p=>{const best=p.bests&&p.bests[sk]!=null?Number(p.bests[sk]):null,on=isOnline(p.id);
    return `<li>${avP({id:p.id,name:p.name,face:faceOf(p),frame:p.frame},36)}<span class="t"><b class="row" style="gap:6px;flex-wrap:nowrap"><span class="presence${on?' on':''}"></span>${esc(p.name)}</b>
      <small>${p.rating} SR${p.school?' · '+esc(p.school):''} · ${best!=null?L('best','record')+' '+fmtScore(sk,best):L('no score on this game','pas de score sur ce jeu')}</small></span>
      <span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm" type="button" data-act="oppDuel" data-a="${p.id}" data-n="${esc(p.name)}" ${best==null?'disabled':''}>${L('Challenge','Défier')}</button>${on?`<button class="btn sm primary" type="button" data-act="oppLive" data-a="${p.id}" data-n="${esc(p.name)}">${L('Live','En direct')}</button>`:''}</span></li>`;};
  const games=SKS.filter(k=>gameOf(k)!=='cards'&&GAME[gameOf(k)]&&GAME[gameOf(k)].playable);
  return `<div class="modal-h"><div><h2>${L('Choose your opponent','Choisis ton adversaire')}</h2><p>${L('Challenge: you race their best score now, then they get yours to beat. Live: they accept and you play at the same time.','Défi : tu affrontes son record tout de suite, puis il reçoit ton score à battre. En direct : il accepte et vous jouez en même temps.')}</p></div>${closeBtn}</div>
    <div class="row" style="align-items:flex-end"><div class="field" style="flex:1;min-width:150px"><label for="oppSk">${L('Game','Jeu')}</label><select class="input" id="oppSk" data-ch="oppSk">${games.map(k=>`<option value="${k}" ${k===sk?'selected':''}>${esc(skName(k))}</option>`).join('')}</select></div>
      <div class="field" style="flex:1;min-width:150px"><label for="oppQ">${L('Find a player','Chercher un joueur')}</label><input class="input" id="oppQ" data-in="oppQ" value="${esc(sh.q||'')}" placeholder="${L('Username','Pseudo')}" autocomplete="off"></div></div>
    ${sh.err?`<p class="err" style="color:var(--bad);font-size:13px;font-weight:600">${esc(sh.err)}</p>`:''}
    ${sh.q&&sh.q.length>=2?`<h3 style="margin-top:6px">${L('Results','Résultats')}</h3>${sh.res===undefined?'<div class="skel"></div>':sh.res.length?`<ul class="hist">${sh.res.map(row).join('')}</ul>`:`<p class="tiny">${L('Nobody with that name.','Personne avec ce pseudo.')}</p>`}`:''}
    <h3 style="margin-top:6px"><span class="presence on"></span> ${L('Online now','En ligne maintenant')} (${ids.length})</h3>
    ${!showOnline()?`<p class="tiny">${L('You are hidden: turn “Show me online” back on in Social to see and invite players live.','Tu es masqué : réactive « Me montrer en ligne » dans Social pour voir et inviter des joueurs en direct.')}</p>`:!ids.length?`<p class="tiny">${L('Nobody else is online right now. You can still challenge anyone by name.','Personne d’autre n’est en ligne pour l’instant. Tu peux quand même défier n’importe qui par son pseudo.')}</p>`
      :onl===undefined?'<div class="skel"></div>':`<ul class="hist">${(onl||[]).map(row).join('')}</ul>`}`;
}
function liveSheetHTML(sh,closeBtn){
  const m=sh.m||{},opp=m.opp||{},name=esc(opp.name||''),gameN=esc(m.sk?skName(m.sk):''),av=opp.id?avP({id:opp.id,name:opp.name,face:faceOf(opp),frame:opp.frame},56):'';
  const left=Math.max(0,Math.ceil(((m.created||Date.now())+45000-(Date.now()+(RT.off||0)))/1000));
  const head=t=>`<div class="modal-h"><div><h2>${t}</h2><p>${gameN}</p></div>${sh.what==='go'?'':closeBtn}</div><div class="row" style="justify-content:center;padding:6px 0">${av}<b style="font-size:20px">${name}</b></div>`;
  if(sh.what==='wait')return head(L('Invitation sent','Invitation envoyée'))+`<p class="tiny" style="text-align:center">${L(`Waiting for ${name} to accept…`,`En attente de la réponse de ${name}…`)} (<span data-left>${left}</span> s)</p><button class="btn" type="button" data-act="liveCancel">${L('Cancel','Annuler')}</button>`;
  if(sh.what==='incoming')return head(L('Live duel!','Duel en direct !'))+`<p style="text-align:center">${L(`${name} invites you to a live duel. Same track, same draw, at the same time.`,`${name} t’invite à un duel en direct. Même circuit, même tirage, en même temps.`)} <span class="tiny">(<span data-left>${left}</span> s)</span></p><div class="row" style="justify-content:center"><button class="btn hot" type="button" data-act="liveAccept">${ic('play',16)}${L('Accept','Accepter')}</button><button class="btn" type="button" data-act="liveDecline">${L('Decline','Refuser')}</button></div>`;
  if(sh.what==='go'){const t=Math.max(0,Math.ceil((sh.at-Date.now())/1000));return head(L('Get ready','Prépare-toi'))+`<p style="text-align:center;font:800 54px/1 var(--f-d)" data-go>${t||'GO'}</p><p class="tiny" style="text-align:center">${L('The race starts for both of you at the same moment.','La partie démarre pour vous deux au même moment.')}</p>`;}
  return closeBtn;
}
function liveResultHTML(lv){
  const name=esc(lv.opp&&lv.opp.name||''),sk=lv.sk;
  if(lv.status!=='done')return `<div class="note" style="margin-top:10px">${ic('users')}<span>${lv.opp_done?L('Result coming…','Résultat en cours…'):L(`Live duel: waiting for ${name} to finish…`,`Duel en direct : en attente de l’arrivée de ${name}…`)}</span></div>`;
  const t=lv.result==='win'?L(`You beat ${name}!`,`Tu bats ${name} !`):lv.result==='loss'?L(`${name} wins this one.`,`${name} remporte ce duel.`):L('Draw.','Égalité.');
  return `<div class="note" style="margin-top:10px;border-color:${lv.result==='win'?'var(--good)':lv.result==='loss'?'var(--bad)':'var(--line)'}">${ic('users')}<span><b>${t}</b> ${L('You','Toi')} : ${lv.my_score!=null?fmtScore(sk,Number(lv.my_score)):'—'} · ${name} : ${lv.opp_score!=null?fmtScore(sk,Number(lv.opp_score)):L('did not finish','non terminé')}</span></div>`;
}
function liveSet(sh){S.ui.sheet=sh;renderLayer();clearInterval(RT.tick);RT.tick=setInterval(()=>{if(S.ui.sheet!==sh){clearInterval(RT.tick);return;}
  /* compte à rebours mis à jour sur place (sans redessiner la fenêtre) */
  const m=sh.m||{},left=Math.max(0,Math.ceil(((m.created||Date.now())+45000-(Date.now()+(RT.off||0)))/1000)),a=document.querySelector('#layer [data-left]'),g=document.querySelector('#layer [data-go]');
  if(a)a.textContent=left;if(g){const t=Math.max(0,Math.ceil((sh.at-Date.now())/1000));g.textContent=t||'GO';}
  if(sh.what==='incoming'&&left<=0){S.ui.sheet=null;renderLayer();}},250);}
async function liveSignal(p){
  if(!p.id||!NET.user)return;
  let m;try{m=await rpc('live_get',{p_id:p.id});}catch(e){return;}if(!m)return;
  if(m.status==='invited'&&m.role==='b'&&!RT.shown.has(m.id))liveIncoming(m);
  if(RT.waiting&&RT.waiting===m.id)liveWaitCheck(m);
  if((m.status==='cancelled'||m.status==='expired')&&S.ui.sheet&&S.ui.sheet.type==='live'&&S.ui.sheet.m&&S.ui.sheet.m.id===m.id){S.ui.sheet=null;renderLayer();toast(L('The invitation was cancelled.','L’invitation a été annulée.'));}
}
async function livePoll(){
  try{const list=await rpc('live_pending');(list||[]).forEach(m=>{if(!RT.shown.has(m.id))liveIncoming(m);});}catch(e){}
  if(NET.me&&NET.me.challenges_open&&!NET.chTold){NET.chTold=true;toast(L(`You have ${NET.me.challenges_open} challenge(s) to answer in Social.`,`Tu as ${NET.me.challenges_open} défi(s) à relever dans Social.`));}
}
function liveIncoming(m){
  if(S.route==='game'&&S.ctrl)return;   // pas d'interruption en pleine partie : il reviendra au prochain contrôle
  RT.shown.add(m.id);RT.off=(m.now||Date.now())-Date.now();SFX.play('coin');liveSet({type:'live',what:'incoming',m});
}
async function liveInvite(uid,sk){
  try{const m=await rpc('live_invite',{p_to:uid,p_sk:sk});RT.waiting=m.id;RT.off=(m.now||Date.now())-Date.now();liveSet({type:'live',what:'wait',m});rtSend(uid,{kind:'invite',id:m.id});
    const tick=async()=>{if(RT.waiting!==m.id)return;try{liveWaitCheck(await rpc('live_get',{p_id:m.id}));}catch(e){}if(RT.waiting===m.id)setTimeout(tick,2000);};setTimeout(tick,2000);}
  catch(e){toast(errText(e));}
}
function liveWaitCheck(m){
  if(!m||RT.waiting!==m.id)return;
  if(m.status==='ready'){RT.waiting=null;liveGo(m);}
  else if(m.status==='declined'){RT.waiting=null;S.ui.sheet=null;renderLayer();toast(L(`${m.opp.name} declined.`,`${m.opp.name} a refusé.`));}
  else if(m.status==='expired'||m.status==='cancelled'){RT.waiting=null;S.ui.sheet=null;renderLayer();toast(L('No answer. Try again or send a challenge.','Pas de réponse. Réessaie ou envoie un défi.'));}
}
function liveGo(m){
  RT.off=(m.now||Date.now())-Date.now();const at=(m.start||Date.now()+4000)-RT.off,g=gameOf(m.sk);
  liveSet({type:'live',what:'go',m,at});
  setTimeout(()=>{S.ui.sheet=null;renderLayer();startGame(g,'trial',null,{live:m.id,track:trackOf(m.sk)});},Math.max(0,at-Date.now()-2100));
}
/* canal de la partie : positions (course) et arrivée, envoyés directement entre les deux joueurs */
function liveJoin(id,opp){
  const L0={id,opp,ctx:{pos:null,send:null},oppDone:null};
  if(rtOK()){const ch=sb.channel('ryvo-m-'+id,{config:{broadcast:{self:false}}});L0.ch=ch;
    ch.on('broadcast',{event:'pos'},({payload})=>{L0.ctx.pos=payload;})
      .on('broadcast',{event:'fin'},({payload})=>{L0.oppDone=payload;const b=document.getElementById('liveBar');if(b)b.textContent=L(`${opp.name} finished: ${fmtScore(S.game.sk,Number(payload.score))}`,`${opp.name} a fini : ${fmtScore(S.game.sk,Number(payload.score))}`);if(S.route==='result'&&S.result&&S.result.live)livePollResult(id,true);})
      .subscribe(st=>{if(st==='SUBSCRIBED')L0.ctx.send=p=>ch.send({type:'broadcast',event:'pos',payload:p});});}
  L0.fin=score=>{if(L0.ch)L0.ch.send({type:'broadcast',event:'fin',payload:{score}});setTimeout(()=>{try{sb.removeChannel(L0.ch);}catch(e){}},15000);};
  return L0;
}
function livePollResult(id,once){
  clearTimeout(RT.res);const t0=Date.now();
  const go=async()=>{try{const lv=await rpc('live_get',{p_id:id});if(S.result&&S.result.live&&S.result.live.id===id){S.result.live=lv;if(S.route==='result')softRender();}if(lv.status==='done'){if(lv.result==='win')SFX.play('win');return;}}catch(e){}
    if(!once&&Date.now()-t0<6*60000)RT.res=setTimeout(go,2500);};
  go();
}
function challengesHTML(){
  const v=cached('ch',()=>rpc('my_challenges'),15000);
  if(v===undefined)return {rec:'<div class="skel"></div>',hist:'<div class="skel"></div>'};if(!v)return {rec:'',hist:''};
  const who=c=>avP({id:c.opp.id,name:c.opp.name,face:faceOf(c.opp),frame:c.opp.frame},32);
  const rec=v.received.length?`<ul class="hist">${v.received.map(c=>`<li>${who(c)}<span class="t"><b>${esc(c.opp.name)}</b><small>${esc(skName(c.sk))} · ${L('score to beat','score à battre')} <b>${fmtScore(c.sk,Number(c.from_score))}</b> · ${endsTxt(c.expires)}</small></span>
      <span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm hot" type="button" data-act="chPlay" data-a="${c.id}" data-sk="${c.sk}">${L('Take it on','Relever')}</button><button class="btn sm ghost" type="button" data-act="chDecline" data-a="${c.id}" aria-label="${L('Decline','Refuser')}">✕</button></span></li>`).join('')}</ul>`
    :`<div class="empty"><b>${L('No challenge waiting','Aucun défi en attente')}</b>${L('Challenge a friend: they’ll get your score to beat.','Défie un ami : il recevra ton score à battre.')}</div>`;
  const RES={win:[L('Won','Gagné'),'now'],loss:[L('Lost','Perdu'),''],draw:[L('Draw','Égalité'),'']};
  const hist=v.history.length?`<ul class="hist">${v.history.map(c=>{const r=c.status==='done'?RES[c.result]:c.status==='open'?[L('Waiting','En attente'),'warn']:c.status==='playing'?[L('Playing','En cours'),'warn']:c.status==='declined'?[L('Declined','Refusé'),'']:[L('Expired','Expiré'),''];
      return `<li>${who(c)}<span class="t"><b>${c.mine?L('You challenged','Tu as défié'):L('Challenged by','Défié par')} ${esc(c.opp.name)}</b><small>${esc(skName(c.sk))} · ${fmtScore(c.sk,Number(c.mine?c.from_score:c.to_score))} ${L('vs','contre')} ${c.mine?(c.to_score!=null?fmtScore(c.sk,Number(c.to_score)):'—'):fmtScore(c.sk,Number(c.from_score))}</small></span><span class="pill ${r[1]}">${r[0]}</span></li>`;}).join('')}</ul>`
    :`<p class="tiny">${L('Your challenges will appear here.','Tes défis apparaîtront ici.')}</p>`;
  return {rec,hist};
}
if(LIVE){
  const A2=Object.assign({},ACT);
  Object.assign(ACT,{
    gear:(k,v)=>{A2.gear(k,v);if(NET.user)rpc('update_profile',{p:{gear:{[k]:v||null}}}).then(m=>{applyMe(m);softRender();}).catch(e=>{toast(errText(e));loadMe();});},
    oppPick:()=>{if(!NET.user){ACT.auth('login');return;}S.ui.sheet={type:'opp',sk:pickSK(),q:''};renderLayer();},
    oppDuel:(a,el)=>{const sh=S.ui.sheet,sk=sh&&sh.sk||pickSK();S.ui.sheet=null;renderLayer();startGame(gameOf(sk),'duel',null,{opp:a,track:trackOf(sk)});},
    oppLive:(a,el)=>{const sk=S.ui.sheet&&S.ui.sheet.sk||pickSK();liveInvite(a,sk);},
    liveCancel:()=>{const m=S.ui.sheet&&S.ui.sheet.m;RT.waiting=null;S.ui.sheet=null;renderLayer();if(m){rpc('live_cancel',{p_id:m.id}).catch(()=>{});rtSend(m.opp&&m.opp.id,{kind:'cancel',id:m.id});}},
    liveAccept:async()=>{const m=S.ui.sheet&&S.ui.sheet.m;if(!m)return;try{const r=await rpc('live_answer',{p_id:m.id,p_accept:true});rtSend(m.opp.id,{kind:'answer',id:m.id});liveGo(r);}catch(e){S.ui.sheet=null;renderLayer();toast(errText(e));}},
    liveDecline:()=>{const m=S.ui.sheet&&S.ui.sheet.m;S.ui.sheet=null;renderLayer();if(m){rpc('live_answer',{p_id:m.id,p_accept:false}).then(()=>rtSend(m.opp.id,{kind:'answer',id:m.id})).catch(()=>{});}},
    chPlay:(a,el)=>{const sk=el.dataset.sk;invalidate('ch');startGame(gameOf(sk),'duel',null,{challenge:a,track:trackOf(sk)});},
    chDecline:a=>{rpc('decline_challenge',{p_id:a}).then(()=>{invalidate('ch');loadMe();render();}).catch(e=>toast(errText(e)));},
    onlineToggle:()=>{const on=!showOnline();try{localStorage.setItem('ryvo.hidden',on?'0':'1');}catch(e){}rtStop();rtStart();render();},
    quit:()=>{if(S.game&&S.game.live&&S.route==='game'){S.ui.sheet={type:'confirm',what:'quit'};renderLayer();return;}A2.quit();},
    confirmYes:async()=>{const sh=S.ui.sheet;if(sh&&sh.what==='quit'&&S.game&&S.game.live){rpc('live_cancel',{p_id:S.game.live.id}).catch(()=>{});}return ACT._confirmYes0();}
  });
  ACT._confirmYes0=A2.confirmYes;
  document.addEventListener('input',e=>{if(!(e.target&&e.target.dataset&&e.target.dataset.in==='oppQ'))return;const sh=S.ui.sheet;if(!sh||sh.type!=='opp')return;
    sh.q=e.target.value.trim();sh.res=undefined;clearTimeout(RT.qt);if(sh.q.length<2){renderLayer();return;}
    RT.qt=setTimeout(async()=>{const q=sh.q;try{const r=await rpc('find_players',{p_q:q,p_ids:null});if(S.ui.sheet===sh&&sh.q===q){sh.res=r||[];renderLayer();}}catch(err){sh.err=errText(err);renderLayer();}},300);});
  document.addEventListener('change',e=>{if(!(e.target&&e.target.dataset&&e.target.dataset.ch==='oppSk'))return;const sh=S.ui.sheet;if(sh&&sh.type==='opp'){sh.sk=e.target.value;renderLayer();}});
  VIEWS.social=()=>{
    const st=S.data,duels=st.history.filter(h=>h.m==='duel').slice(0,8),ch=NET.user?challengesHTML():{rec:'',hist:''};
    const online=[...RT.online.values()];
    const head=`<div class="page-h"><div><p class="eyebrow">Social</p><h1>${L('Pick your opponent','Choisis ton adversaire')}</h1><p>${L('Challenge anyone by name, or play live against someone online right now.','Défie n’importe qui par son pseudo, ou joue en direct contre quelqu’un de connecté.')}</p></div>
      <button class="btn primary" type="button" data-act="oppPick">${ic('swords',16)}${L('Choose an opponent','Choisir un adversaire')}</button></div>`;
    if(!NET.user)return head+`<div class="empty"><b>${L('Sign in to challenge players','Connecte-toi pour défier des joueurs')}</b><button class="btn sm primary" type="button" data-act="auth" data-a="signup">${L('Create an account','Créer un compte')}</button></div>`;
    return head+`<div class="grid">
      <section class="card pop c6"><div class="card-h"><h2>${L('Challenges to answer','Défis à relever')}</h2></div>${ch.rec}</section>
      <section class="card c6"><div class="card-h"><h2><span class="presence on"></span> ${L('Online now','En ligne maintenant')}</h2><label class="tiny" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-act="onlineToggle" ${showOnline()?'checked':''}>${L('Show me online','Me montrer en ligne')}</label></div>
        ${!rtOK()?`<p class="tiny">${L('Live presence is unavailable right now.','La présence en direct est indisponible pour le moment.')}</p>`:online.length?`<ul class="hist">${online.slice(0,12).map(p=>`<li>${avP({id:p.id,name:p.name,face:faceOf(p),frame:p.frame},32)}<span class="t"><b>${esc(p.name)}</b><small>${p.rating||'—'} SR</small></span><button class="btn sm primary" type="button" data-act="oppPick">${L('Play','Jouer')}</button></li>`).join('')}</ul>`
          :`<p class="tiny">${L('Nobody else online right now. Send a challenge: they’ll answer when they come back.','Personne d’autre en ligne pour l’instant. Envoie un défi : il répondra en revenant.')}</p>`}</section>
      <section class="card c6"><div class="card-h"><h2>${L('Challenge history','Historique des défis')}</h2></div>${ch.hist}</section>
      <section class="card c6"><div class="card-h"><h2>${L('Your duels','Tes duels')}</h2></div>${duels.length?`<ul class="hist">${duels.map(histItem).join('')}</ul>`:`<div class="empty"><b>${L('No duels yet','Aucun duel')}</b></div>`}</section>
      <section class="card c12"><div class="card-h"><h2>${L('Recent duels','Duels récents')}</h2></div>${liveFeedHTML()}<p class="tiny">${L('To report a player, use the ⚑ next to their name in the rankings.','Pour signaler un joueur, utilise le ⚑ à côté de son pseudo dans les classements.')}</p></section>
    </div>`;
  };
}

/* ---------- démarrage ---------- */
if(LIVE){
  const css=document.createElement('style');css.textContent='.rep{border:0;background:none;color:var(--mute);cursor:pointer;font-size:12px;padding:0 4px;margin-left:4px;border-radius:6px}.rep:hover{color:var(--bad);background:var(--bad-soft)}';document.head.appendChild(css);
  sb.auth.onAuthStateChange((ev,session)=>{
    const u=session?session.user:null,changed=(u&&u.id)!==(NET.user&&NET.user.id);NET.user=u;
    if(ev==='PASSWORD_RECOVERY'){S.ui.sheet={type:'auth',tab:'newpw'};renderLayer();}
    if(changed){invalidate();if(u){loadMe();setTimeout(rtStart,500);}else{rtStop();toGuest();softRender();}loadInfo();}
  });
  /* liens entrants : retour de paiement Stripe, invitation à une ligue */
  const qs=new URLSearchParams(location.search),buy=qs.get('achat'),inv=qs.get('ligue');
  if(buy||inv){qs.delete('achat');qs.delete('ligue');history.replaceState(null,'',location.pathname+(qs.toString()?'?'+qs:'')+location.hash);}
  if(buy==='ok'){setTimeout(()=>toast(L('Payment received. Your gems arrive in a few seconds.','Paiement reçu. Tes gemmes arrivent dans quelques secondes.')),600);[3000,7000,15000].forEach(t=>setTimeout(loadMe,t));go('shop');}
  if(buy==='annule')setTimeout(()=>toast(L('Payment cancelled. Nothing was charged.','Paiement annulé. Rien n’a été débité.')),600);
  if(inv&&/^[A-Za-z0-9]{6}$/.test(inv)){NET.pendingLeague=inv.toUpperCase();setTimeout(()=>openLeagueInvite(NET.pendingLeague),700);}
  sb.auth.getSession().then(({data})=>{const u=data&&data.session?data.session.user:null;if(u&&!NET.user){NET.user=u;loadMe();setTimeout(rtStart,500);}if(!u&&S.data.uid)toGuest();loadInfo();});
}
rollDaily();
render();
})();
</script>
