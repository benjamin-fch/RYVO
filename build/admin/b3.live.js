
/* =========================================================
   Console connectée à Supabase
   ========================================================= */
const CFG=window.RYVO_CONFIG||{};
const CONFIGURED=!!(CFG.url&&CFG.anonKey&&window.supabase);
const sb=CONFIGURED?window.supabase.createClient(CFG.url,CFG.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const FORMATS={ranking:'Classement sur la période',bracket:'Duels à élimination directe',school:'Coupe des écoles'};
const ERR={forbidden:'Ton rôle ne permet pas cette action.',mfa_required:'Double authentification requise.',not_authenticated:'Session expirée. Reconnecte-toi.',
  username_taken:'Ce pseudo est déjà pris.',bad_username:'Pseudo invalide : 3 à 16 lettres, chiffres, point ou tiret bas.',reason_required:'Un motif est obligatoire.',cannot_sanction_self:'Tu ne peux pas te sanctionner toi-même.',
  not_pending:'Cet élément a déjà été traité.',bad_threshold:'Seuil invalide : saisis un nombre positif.',question_too_short:'Les questions doivent faire au moins 10 caractères dans les deux langues.',
  four_answers:'Il faut exactement 4 réponses.',empty_answer:'Chaque réponse doit être remplie en français et en anglais.',duplicate_answers:'Les quatre réponses en français doivent être différentes.',
  duplicate_question:'Cette question existe déjà.',word_length:'Le mot doit faire entre 4 et 8 lettres.',category_required:'Ajoute une catégorie : c’est l’indice affiché au joueur.',word_exists:'Ce mot est déjà dans la liste.',
  game_off:'Active d’abord le jeu.',name_too_short:'Le nom doit faire au moins 3 caractères.',name_taken:'Une compétition porte déjà ce nom.',start_in_past:'Choisis une date de début à partir d’aujourd’hui.',
  end_before_start:'La fin doit être après le début.',reward_required:'Indique ce que gagnent les joueurs.',already_started:'Cette compétition a déjà commencé.',end_in_past:'Choisis une date dans le futur.',
  bad_short:'Sigle : 2 à 5 lettres ou chiffres.',bad_domain:'Domaine attendu : ecole.fr',short_taken:'Sigle déjà utilisé.',domain_taken:'Domaine déjà attribué à une autre école.',city_required:'Indique la ville.',
  domain_mismatch:'Le domaine ne correspond pas à l’école. Refuse ou demande une autre preuve.',bad_fields:'Vérifie les champs du formulaire.',already_admin:'Cette personne fait déjà partie de l’équipe.',
  last_super_admin:'Il faut garder au moins un Super admin.',cannot_remove_self:'Tu ne peux pas te retirer toi-même.',game_unavailable:'Ce jeu est désactivé.'};
function errText(e){const m=String(e&&e.message||e||'');for(const k in ERR)if(m===k||m.startsWith(k))return ERR[k];if(/fetch|network/i.test(m))return 'Problème de connexion. Réessaie.';return m;}
async function rpc(fn,args){const {data,error}=await sb.rpc(fn,args||{});if(error){if(/mfa_required/.test(error.message)){mfaFlow();}throw new Error(error.message);}return data;}
async function act(fn,args,okMsg){try{const r=await rpc(fn,args);if(okMsg)toast(okMsg);refreshCounts();return r;}catch(e){toast(errText(e));throw e;}}

const S={auth:{stage:'loading',err:null},role:null,me:null,schools:[],counts:{},d:{},
  ui:{sec:'overview',pl:{q:'',status:'all',school:'all',ver:'all',sort:'last',dir:-1,page:0},mod:'open',ac:'pending',ct:'questions',qf:{q:'',cat:'all',status:'all'},wl:'fr',sc:'list',cp:'list',logq:'',layer:null,reveal:{}}};
const can=sec=>!!S.role&&(S.role==='super'||SEC[sec][3].includes(S.role));
const SC=id=>S.schools.find(s=>s.id===id);
const GM=id=>GAMES0.find(g=>g.id===id)||{name:id,col:'#999'};
const COLS=['#5B4BFF','#FF6B3D','#14B37A','#E0A100','#FF4FA0','#00A6C8','#8B5CF6','#F23F55','#3D7BFF'];
const colOf=id=>COLS[hashStr(String(id))%COLS.length];
const pav=(p,s=32)=>`<span class="pav" style="background:${colOf(p.id||p.name)};width:${s}px;height:${s}px">${esc(String(p.name||'?')[0].toUpperCase())}</span>`;
const statusBadge=p=>p.status==='banned'?'<span class="badge bad">Banni</span>':p.status==='suspended'?`<span class="badge warn">Suspendu${p.until?' · '+dShort(p.until):''}</span>`:'<span class="badge good">Actif</span>';
const skLabel=sk=>{const g=String(sk).split('@');return g[0]==='sprint'?'Neon Sprint · '+TRACKS[+g[1]||0]:GM(g[0]).name;};
const fmtScore=(sk,v)=>{if(v==null)return '—';const g=String(sk).split('@')[0];if(g==='sprint')return Number(v).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' s';if(g==='reflex')return Math.round(v)+' ms';return fmt(v)+' pts';};
let toastT=0;function toast(m){const el=$('#toast');el.textContent=m;el.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),3400);}
function logList(items){
  if(!items||!items.length)return `<div class="empty"><b>Aucune action pour l’instant</b>Chaque action de l’équipe apparaîtra ici.</div>`;
  return `<ul class="log">${items.map(l=>`<li><time datetime="${new Date(l.t).toISOString()}">${dTime(l.t)}</time><span><b>${esc(l.who||'—')}</b> ${l.role?`<span class="badge">${ROLES[l.role]||esc(l.role)}</span>`:''} ${esc(l.txt)} <b>${esc(l.target||'')}</b>${l.detail?` <span class="tiny">· ${esc(l.detail)}</span>`:''}</span></li>`).join('')}</ul>`;
}
const loading=()=>`<div class="stack">${'<div class="kpi" style="height:70px;background:var(--wash)"></div>'.repeat(3)}</div>`;

/* ---------- authentification + double authentification ---------- */
async function afterLogin(){
  S.auth={stage:'loading'};render();
  try{
    const me=await rpc('admin_me');S.me=me;
    if(!me.role){S.auth={stage:'forbidden'};render();return;}
    if(me.require_mfa&&!me.mfa_ok){await mfaFlow();return;}
    S.role=me.role;S.auth={stage:'ready'};
    try{S.schools=(await rpc('public_info')).schools||[];}catch(e){}
    if(!can(S.ui.sec))S.ui.sec='overview';
    refreshCounts();loadSection();
  }catch(e){S.auth={stage:'login',err:errText(e)};render();}
}
async function mfaFlow(){
  try{
    const {data,error}=await sb.auth.mfa.listFactors();if(error)throw error;
    const ok=(data.totp||[]).filter(f=>f.status==='verified');
    if(ok.length){S.auth={stage:'challenge',factorId:ok[0].id};render();return;}
    for(const f of (data.all||[]).filter(f=>f.status!=='verified'))await sb.auth.mfa.unenroll({factorId:f.id});
    const en=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'RYVO Admin '+new Date().toISOString().slice(0,10)});if(en.error)throw en.error;
    S.auth={stage:'enroll',factorId:en.data.id,qr:en.data.totp.qr_code,secret:en.data.totp.secret};render();
  }catch(e){S.auth={stage:'login',err:'Double authentification : '+errText(e)};render();}
}
function gateHTML(){
  const a=S.auth,err=a.err?`<div class="empty" style="border-color:var(--bad);background:var(--bad-soft);padding:12px">${esc(a.err)}</div>`:'';
  const card=(t,p,body)=>`<div style="max-width:440px;margin:8vh auto 0" class="card"><div class="logo" style="color:var(--ink)">${LOGO}<span>RYVO<small style="color:var(--mute)">CONSOLE ADMIN</small></span></div><h1 style="font-size:24px">${t}</h1>${p?`<p class="tiny">${p}</p>`:''}${body}</div>`;
  if(!CONFIGURED)return card('Configuration manquante','Renseigne l’adresse du projet et la clé publique dans <code>config.js</code> à la racine du site.','');
  if(a.stage==='loading')return card('Connexion…','','<div class="kpi" style="height:46px;background:var(--wash)"></div>');
  if(a.stage==='forbidden')return card('Accès refusé','Ce compte n’a pas de rôle dans l’équipe RYVO. Si tu as reçu une invitation, connecte-toi avec l’adresse invitée et confirme d’abord ton e-mail.',`<button class="btn" type="button" data-act="logout">Se déconnecter</button>`);
  if(a.stage==='enroll')return card('Active la double authentification','Obligatoire pour l’équipe. Scanne ce QR code avec Google Authenticator, Microsoft Authenticator ou 1Password, puis saisis le code à 6 chiffres.',
    `<div style="display:flex;justify-content:center"><img src="${esc(a.qr)}" alt="QR code de double authentification" width="180" height="180" style="border:2px solid var(--ink);border-radius:14px;background:#fff"></div>
    <p class="tiny">Impossible de scanner ? Saisis cette clé dans l’application : <code class="mono" style="word-break:break-all">${esc(a.secret)}</code></p>
    <form data-form="mfa" class="stack" novalidate><div class="field"><label for="mfaCode">Code à 6 chiffres</label><input class="input mono" id="mfaCode" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div>${err}<button class="btn primary" type="submit">Activer et continuer</button></form>
    <button class="btn ghost sm" type="button" data-act="logout">Se déconnecter</button>`);
  if(a.stage==='challenge')return card('Double authentification','Saisis le code à 6 chiffres affiché dans ton application.',
    `<form data-form="mfa" class="stack" novalidate><div class="field"><label for="mfaCode">Code</label><input class="input mono" id="mfaCode" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div>${err}<button class="btn primary" type="submit">Vérifier</button></form>
    <button class="btn ghost sm" type="button" data-act="logout">Se déconnecter</button>`);
  if(a.stage==='newpw')return card('Nouveau mot de passe','',`<form data-form="newpw" class="stack" novalidate><div class="field"><label for="npw">Mot de passe (12 caractères minimum)</label><input class="input" id="npw" name="pw" type="password" autocomplete="new-password"></div>${err}<button class="btn primary" type="submit">Enregistrer</button></form>`);
  if(a.stage==='recover')return card('Mot de passe oublié','Un lien de réinitialisation sera envoyé si un compte existe.',`<form data-form="recover" class="stack" novalidate><div class="field"><label for="rcMail">E-mail</label><input class="input" id="rcMail" name="email" type="email" autocomplete="email"></div>${err}<button class="btn primary" type="submit">Envoyer le lien</button></form><button class="btn ghost sm" type="button" data-act="gate" data-a="login">Retour</button>`);
  return card('Connexion équipe','Accès réservé à l’équipe RYVO. Double authentification obligatoire.',
    `<form data-form="login" class="stack" novalidate><div class="field"><label for="lgMail">E-mail</label><input class="input" id="lgMail" name="email" type="email" autocomplete="username"></div>
    <div class="field"><label for="lgPw">Mot de passe</label><input class="input" id="lgPw" name="pw" type="password" autocomplete="current-password"></div>${err}<button class="btn primary" type="submit">Se connecter</button></form>
    <button class="btn ghost sm" type="button" data-act="gate" data-a="recover">Mot de passe oublié ?</button>`);
}

/* ---------- chargement des données par section ---------- */
async function refreshCounts(){try{S.counts=await rpc('admin_counts');$('#rail').innerHTML=railHTML();}catch(e){}}
async function loadSection(){
  const sec=S.ui.sec,d=S.d;render();
  try{
    if(sec==='overview')d.overview=await rpc('admin_overview');
    if(sec==='players')await loadPlayers();
    if(sec==='moderation')d.reports=await rpc('admin_reports',{p_status:S.ui.mod});
    if(sec==='anticheat'){const [f,r]=await Promise.all([rpc('admin_flags',{p_status:S.ui.ac}),rpc('admin_rules')]);d.flags=f;d.rules=r;}
    if(sec==='content'){if(S.ui.ct==='questions')d.questions=await rpc('admin_questions');if(S.ui.ct==='words')d.words=await rpc('admin_words',{p_lang:S.ui.wl});if(S.ui.ct==='games')d.games=await rpc('admin_games');}
    if(sec==='competitions')d.comps=await rpc('admin_comps');
    if(sec==='schools'){d.schools=await rpc('admin_schools');S.schools=d.schools.schools;}
    if(sec==='business')d.biz=await rpc('admin_business');
    if(sec==='team'){const [t,l]=await Promise.all([rpc('admin_team'),rpc('admin_log',{p_q:S.ui.logq,p_limit:100})]);d.team=t;d.log=l;}
    d.err=null;
  }catch(e){d.err=errText(e);}
  if(S.ui.sec===sec)render();
}
async function loadPlayers(){const f=S.ui.pl;S.d.plist=await rpc('admin_players',{p_q:f.q,p_status:f.status,p_school:f.school,p_ver:f.ver,p_sort:f.sort,p_dir:f.dir,p_offset:f.page*20,p_limit:20});}
