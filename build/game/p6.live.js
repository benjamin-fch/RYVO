
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
  if(/^suspended:(\d+)/.test(m)){const d=new Date(+m.split(':')[1]);return L(`Your account is suspended until ${d.toLocaleDateString(LOC())}.`,`Ton compte est suspendu jusqu’au ${d.toLocaleDateString(LOC())}.`);}
  const T={not_authenticated:['Sign in to continue.','Connecte-toi pour continuer.'],banned:['This account is banned.','Ce compte est banni.'],game_unavailable:['This game is unavailable right now.','Ce jeu est indisponible pour le moment.'],
    daily_limit:['No Daily attempts left for this game today.','Plus d’essais du jour pour ce jeu.'],not_daily_game:['Today’s Daily changed. Reload the page.','Le Défi du jour a changé. Recharge la page.'],
    no_school:['Link a school in Campus first.','Lie d’abord une école dans Campus.'],rate_limited:['Too many actions in a short time. Try again in a few minutes.','Trop d’actions en peu de temps. Réessaie dans quelques minutes.'],
    username_taken:['That username is taken.','Ce pseudo est déjà pris.'],bad_username:['Use 3–16 letters, numbers, dots or underscores.','3 à 16 lettres, chiffres, points ou tirets bas.'],reserved_username:['That username is reserved.','Ce pseudo est réservé.'],
    locked_item:['Unlock this item by levelling up.','Débloque cet élément en montant de niveau.'],domain_mismatch:['That address isn’t from this school.','Cette adresse n’est pas celle de l’école.'],bad_email:['Enter a valid email address.','Saisis une adresse e-mail valide.'],
    unknown_school:['Unknown school.','École inconnue.'],bad_target:['You can’t report this player.','Tu ne peux pas signaler ce joueur.'],expired:['This match took too long and expired.','Ce match a expiré.'],bad_run:['This match is already closed.','Ce match est déjà clos.'],
    time_over:['Time’s up.','Temps écoulé.'],not_enough_questions:['Not enough questions yet. Try another game.','Pas encore assez de questions. Essaie un autre jeu.'],not_enough_words:['Not enough words yet. Try another game.','Pas encore assez de mots. Essaie un autre jeu.'],
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
const faceOf=r=>{const p=AV_PRESETS[r.avatar];return p&&!p.premium?p:demoFace(String(r.id||r.name));};
function mapBoard(d){
  if(!d)return null;
  const uid=NET.user&&NET.user.id,mk=x=>({id:x.id,name:x.name,face:faceOf(x),school:x.school,val:Number(x.val),mv:0,pos:x.pos,me:x.id===uid});
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
    ${NET.user?'':`<p class="tiny">${L('Sign in to play duels and move your rating.','Connecte-toi pour jouer des duels et faire bouger ta cote.')}</p>`}`;
}
function liveOthers(r){
  const s=r.server||{},st=S.data,sc=SCH[st.school.id];
  return `<section class="card c4"><h2>${L('Against others','Face aux autres')}</h2><dl class="cmp">
    <dt>${L('World rank','Rang mondial')}</dt><dd>${s.rank_world?`#${s.rank_world} / ${s.total_world}`:'—'}</dd>
    ${s.rank_world&&s.total_world>1?`<dt>${L('Ahead of','Devant')}</dt><dd>${Math.round((1-(s.rank_world-1)/(s.total_world-1))*100)} % ${L('of players','des joueurs')}</dd>`:''}
    ${s.rank_school?`<dt>${L('School rank','Rang dans l’école')}</dt><dd>#${s.rank_school} / ${s.total_school}</dd>`:''}
    ${r.schoolGain?`<dt>${L('School Cup','Coupe des écoles')}</dt><dd class="good">+${r.schoolGain}${sc?' '+L('for','pour')+' '+esc(sc.short):''}</dd>`:''}
  </dl>${s.status==='flagged'?`<p class="tiny">${L('Unusual result: a moderator checks it before it counts.','Résultat inhabituel : un modérateur le vérifie avant qu’il compte.')}</p>`:`<p class="tiny">${L('Checked by the server.','Vérifié par le serveur.')}</p>`}</section>`;
}
function practiceResult(r){
  const G=GAME[r.g];
  if(r.rejected)return `<div class="stack"><section class="res-hero" style="--rbg:#fff"><span class="outcome">${L('Run rejected','Partie rejetée')}</span><p class="mu" style="max-width:50ch">${L('The server found inconsistent data in this run, so it doesn’t count. If you think this is a mistake, play again normally.','Le serveur a trouvé des données incohérentes dans cette partie : elle ne compte pas. Si c’est une erreur, rejoue normalement.')}</p><div class="res-actions"><button class="btn hot" type="button" data-act="lobby" data-a="${r.g}">${ic('refresh',16)}${L('Back to the game','Retour au jeu')}</button></div></section></div>`;
  return `<div class="stack"><section class="res-hero" style="--rbg:${G.hex};--rfg:${r.g==='cards'?INK:'#fff'}"><span class="outcome">${L('Practice','Entraînement')}</span><p class="eyebrow">${esc(skName(r.sk))}</p><div class="big">${fmtScore(r.sk,r.score)}</div>
    <p class="mu" style="max-width:46ch">${L('Not saved: create an account to keep your scores, earn XP and appear in the rankings.','Non enregistré : crée un compte pour garder tes scores, gagner de l’XP et apparaître au classement.')}</p>
    <div class="res-actions"><button class="btn hot" type="button" data-act="auth" data-a="signup">${L('Create an account','Créer un compte')}</button><button class="btn" type="button" data-act="auth" data-a="login">${L('Sign in','Connexion')}</button><button class="btn" type="button" data-act="again">${ic('refresh',16)}${L('Play again','Rejouer')}</button></div></section></div>`;
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
    <dl class="cmp"><dt>E-mail</dt><dd>${esc(NET.user.email||'')}</dd><dt>${L('School','École')}</dt><dd>${SCH[st.school.id]?esc(SCH[st.school.id].short)+(st.school.status==='verified'?' ✓':''):L('None','Aucune')}</dd><dt>${L('Language','Langue')}</dt><dd>${LANG==='fr'?'Français':'English'}</dd></dl>
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
  const head=`<div class="modal-h"><div><h2>${tab==='signup'?L('Create your player account','Crée ton compte joueur'):tab==='login'?L('Welcome back','Content de te revoir'):L('Reset your password','Réinitialise ton mot de passe')}</h2></div>${close}</div>${tabs}`;
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
    <div class="field"><label for="aSchool">${L('School (optional)','École (optionnel)')}</label><select class="input" id="aSchool" name="school"><option value="">${L('Skip for now','Plus tard')}</option>${SCHOOLS.map(x=>`<option value="${x.id}" ${v.school===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
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
  d.school={id:m.school_id,program:m.program||'bus2',status:m.verified?'verified':(m.verification&&m.verification.status==='pending'&&m.verification.school===m.school_id?'pending':'unverified'),domain:m.verification?m.verification.domain:null};
  d.xp=m.xp;d.rating=m.rating;d.streak=m.streak;
  d.bests={};Object.entries(m.bests||{}).forEach(([k,v])=>d.bests[k]=Number(v));
  d.history=(m.runs||[]).map(r=>({g:r.g,sk:r.sk,m:r.m,s:Number(r.s),o:r.o,opp:r.opp,xp:r.xp,dr:r.dr,t:r.t,x:r.x==null?undefined:Number(r.x),w:r.w,st:r.st}));
  d.daily={day:dayKey(),att:Object.fromEntries(GAMES.map(g=>[g.id,Math.max(0,3-((m.daily&&m.daily.used&&m.daily.used[g.id])||0))])),best:Object.fromEntries(Object.entries((m.daily&&m.daily.best)||{}).map(([k,v])=>[k,Number(v)]))};
  d.schoolPts=m.school_pts||0;
  if(m.status==='suspended')toast(errText('suspended:'+m.until));
  checkAch();save();
}
function applyInfo(info){
  NET.info=info;
  SCHOOLS.length=0;Object.keys(SCH).forEach(k=>delete SCH[k]);
  (info.schools||[]).forEach(x=>{const s={id:x.id,name:x.name,short:x.short,city:x.city,country:[x.country,x.country],domain:x.domain,col:x.col};SCHOOLS.push(s);SCH[s.id]=s;});
  const on=new Set((info.games||[]).filter(g=>g.on).map(g=>g.id));
  GAMES.forEach(g=>{if(g.id!=='party'){g.playable=on.has(g.id);if(!g.playable)g.eta=()=>L('Temporarily unavailable','Indisponible pour le moment');}});
  PLAYABLE.length=0;GAMES.filter(g=>g.playable).forEach(g=>PLAYABLE.push(g));
}
async function loadMe(){if(!NET.user)return;try{applyMe(await rpc('me'));}catch(e){toast(errText(e));}softRender();}
async function loadInfo(){try{applyInfo(await rpc('public_info'));}catch(e){NET.infoErr=errText(e);}softRender();}
function toGuest(){const keep={lang:S.data.lang,sound:S.data.sound};S.data=Object.assign(DEF(),keep);NET.me=null;save();}

/* ---------- partie : lancement, contexte, envoi ---------- */
const startGameLocal=startGame,makeCtxLocal=makeCtx,finishGameLocal=finishGame;
if(LIVE){
  startGame=async function(id,mode,oppId,opt={}){
    SFX.init();
    if(!NET.user){
      if(mode!=='trial'){toast(L('Sign in to play this mode.','Connecte-toi pour jouer ce mode.'));ACT.auth('login');return;}
      startGameLocal(id,'trial',null,opt);if(S.game)S.game.practice=true;return;
    }
    if(NET.starting)return;NET.starting=true;
    const Lb=S.ui.lobby,lv=levelInfo(S.data.xp).L;
    let track=opt.track!=null?opt.track:(Lb.game===id?Lb.track:0);if(TRACKS[track].lv>lv)track=0;
    const cat=opt.cat||(Lb.game===id?Lb.cat:'mix');
    try{
      const run=await rpc('start_run',{p_game:id,p_mode:mode,p_track:track,p_cat:cat,p_lang:LANG});
      S.game={id,mode,sk:run.sk,track:run.track,cat:run.cat||cat,oppId:null,run};
      Object.assign(S.ui.lobby,{game:id,mode,track:id==='sprint'&&mode!=='daily'?track:Lb.track,cat:id==='brain'&&mode!=='daily'?cat:Lb.cat});
      go('game');
    }catch(e){toast(errText(e));if(/daily|not_daily/.test(e.message))loadMe();}
    finally{NET.starting=false;}
  };
  makeCtx=function(g){
    if(!g.run)return makeCtxLocal(g);
    const run=g.run,o=run.opp?{id:run.opp.id||'bot',name:run.opp.name,face:faceOf({avatar:run.opp.avatar,id:run.opp.name}),school:null,rating:run.opp.rating,skill:Number(run.opp.skill)||0.5,best:{}}:null;
    const ctx={mode:g.mode,opp:o,sk:run.sk,track:run.track,cat:run.cat,rand:rng(Number(run.seed))};
    if(o&&run.opp.score!=null){ctx.oppScore=Number(run.opp.score);if(g.id==='sprint')ctx.oppTime=ctx.oppScore;if(g.id==='reflex')ctx.oppBase=ctx.oppScore-12;}
    if(g.id==='brain'&&run.questions){ctx.questions=run.questions;ctx.answer=(i,k,t)=>rpc('answer_question',{p_run:run.run,p_i:i,p_k:k,p_t:Math.round(t*100)/100});}
    if(g.id==='words'&&run.words){ctx.words=run.words;ctx.wordEvent=(i,kind,guess)=>rpc('word_event',{p_run:run.run,p_i:i,p_kind:kind,p_guess:guess||null});}
    return ctx;
  };
  finishGame=function(res){
    const g=S.game;
    if(S.ctrl){S.ctrl.destroy();S.ctrl=null;}
    if(g.practice||!g.run){S.result={practice:true,g:g.id,sk:g.sk,mode:'trial',score:res.score,details:res.details,fresh:false};go('result');return;}
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
    campusSave:()=>{const c=S.ui.campus,pick=c.pick||S.data.school.id;if(!pick){c.err=L('Select an institution from the list first.','Choisis d’abord un établissement dans la liste.');render();return;}
      if(!NET.user){toast(L('Sign in to link a school.','Connecte-toi pour lier une école.'));ACT.auth('login');return;}
      upd({school_id:pick,program:c.program||S.data.school.program},()=>{c.edit=false;c.err=null;invalidate();toast(L('School saved.','École enregistrée.'));render();});},
    campusRemove:()=>upd({school_id:null},()=>{S.ui.campus.edit=false;invalidate();render();}),
    verifyReset:()=>{S.data.school.status='unverified';render();},
    signout:async()=>{await sb.auth.signOut();toast(L('Signed out.','Déconnecté.'));},
    export:async()=>{try{const d=await rpc('export_my_data');S.ui.sheet={type:'export',text:JSON.stringify(d,null,2)};renderLayer();}catch(e){toast(errText(e));}},
    reset:()=>{if(!NET.user)return;S.ui.sheet={type:'confirm',what:'delete'};renderLayer();},
    confirmYes:async()=>{const w=S.ui.sheet&&S.ui.sheet.what;
      if(w==='delete'){S.ui.sheet=null;renderLayer();try{await rpc('delete_my_account');await sb.auth.signOut();toast(L('Your account has been deleted.','Ton compte a été supprimé.'));}catch(e){toast(errText(e));}return;}
      A0.confirmYes();},
    report:(a,el)=>{if(!NET.user){ACT.auth('login');return;}S.ui.sheet={type:'report',id:a,name:el.dataset.n||''};renderLayer();},
    claim:()=>{},
    again:()=>{const r=S.result;if(!r)return;startGame(r.g,r.practice?'trial':r.mode,null,{track:S.game&&S.game.track,cat:S.game&&S.game.cat});}
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
    const email=F('email'),pw=f.elements.pw.value,user=F('user'),school=F('school'),age=f.elements.age.checked,err={};
    if(!EMAIL_RE2.test(email))err.email=L('Enter a valid email address.','Saisis une adresse e-mail valide.');
    if(pw.length<8||!/\d/.test(pw))err.pw=L('Use at least 8 characters, including a number.','Au moins 8 caractères, dont un chiffre.');
    if(!/^[A-Za-z0-9._]{3,16}$/.test(user))err.user=L('Use 3–16 letters, numbers, dots or underscores.','3 à 16 lettres, chiffres, points ou tirets bas.');
    if(!age)err.age=L('Please confirm this to continue.','Merci de confirmer pour continuer.');
    if(Object.keys(err).length)return fail(err,{email,user,school,age});
    busy(true);
    const {data,error}=await sb.auth.signUp({email,password:pw,options:{data:{username:user,avatar:sh&&sh.av!=null?sh.av:0,school:school||null,lang:LANG},emailRedirectTo:redirect}});
    if(error){busy(false);return fail({form:/registered|exists/i.test(error.message)?L('An account already exists with this email. Sign in instead.','Un compte existe déjà avec cet e-mail. Connecte-toi.'):/password/i.test(error.message)?L('This password is too weak. Pick a longer one.','Ce mot de passe est trop faible. Choisis-en un plus long.'):errText(error)},{email,user,school,age});}
    if(data.session){S.ui.sheet=null;renderLayer();toast(L('Account created.','Compte créé.'));}
    else{S.ui.sheet={type:'auth',tab:'sent',email};renderLayer();}
  }
  if(k==='login'){
    const email=F('email'),pw=f.elements.pw.value;
    if(!EMAIL_RE2.test(email)||!pw)return fail({email:!EMAIL_RE2.test(email)?L('Enter your email.','Saisis ton e-mail.'):'',pw:!pw?L('Enter your password.','Saisis ton mot de passe.'):''},{email});
    busy(true);const {error}=await sb.auth.signInWithPassword({email,password:pw});
    if(error){busy(false);return fail({form:/confirm/i.test(error.message)?L('Confirm your email first (link sent when you signed up).','Confirme d’abord ton e-mail (lien reçu à l’inscription).'):/invalid/i.test(error.message)?L('Wrong email or password.','E-mail ou mot de passe incorrect.'):errText(error)},{email});}
    S.ui.sheet=null;renderLayer();toast(L('Signed in.','Connecté.'));
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

/* ---------- démarrage ---------- */
if(LIVE){
  const css=document.createElement('style');css.textContent='.rep{border:0;background:none;color:var(--mute);cursor:pointer;font-size:12px;padding:0 4px;margin-left:4px;border-radius:6px}.rep:hover{color:var(--bad);background:var(--bad-soft)}';document.head.appendChild(css);
  sb.auth.onAuthStateChange((ev,session)=>{
    const u=session?session.user:null,changed=(u&&u.id)!==(NET.user&&NET.user.id);NET.user=u;
    if(ev==='PASSWORD_RECOVERY'){S.ui.sheet={type:'auth',tab:'newpw'};renderLayer();}
    if(changed){invalidate();if(u){loadMe();}else{toGuest();softRender();}loadInfo();}
  });
  sb.auth.getSession().then(({data})=>{const u=data&&data.session?data.session.user:null;if(u&&!NET.user){NET.user=u;loadMe();}if(!u&&S.data.uid)toGuest();loadInfo();});
}
rollDaily();
render();
})();
</script>
