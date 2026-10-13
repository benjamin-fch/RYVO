
/* ========================= chrome ========================= */
const NAV0=[['home','home',()=>L('Home','Accueil')],['play','play',()=>L('Play','Jouer')],['ranks','trophy',()=>L('Rankings','Classements')],['leagues','flag',()=>L('Leagues','Ligues')],['campus','campus',()=>'Campus'],['social','users',()=>L('Social','Social')],['profile','user',()=>L('Profile','Profil')],null,['shop','gem',()=>L('Shop','Boutique')],['tech','code',()=>L('Build notes','Notes techniques')]];
const NAV=LIVE?NAV0.filter(n=>!n||n[0]!=='tech'):NAV0;
const routeGroup=r=>({lobby:'play',game:'play',result:'play'})[r]||r;
function sideHTML(){
  const st=S.data,lv=levelInfo(st.xp),cur=routeGroup(S.route);
  return `<button class="logo" type="button" data-act="go" data-a="home" aria-label="RYVO">${LOGO}<span>RYVO<small>${L('PLAY FAST · RANK UP','JOUE VITE · GRIMPE')}</small></span></button>
  <nav class="nav" aria-label="${L('Main navigation','Navigation principale')}">${NAV.map(n=>n?`<button type="button" data-act="go" data-a="${n[0]}" ${cur===n[0]?'aria-current="page"':''}>${ic(n[1])}${n[2]()}</button>`:'<div class="sep"></div>').join('')}</nav>
  <div class="side-card">
    <div class="row" style="flex-wrap:nowrap">${avMe(38)}<div style="min-width:0"><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(st.account.username)}</b><span class="tiny">${L('Level','Niveau')} ${lv.L} · ${leagueBadge(st.rating)}</span></div></div>
    <div class="bar"><i style="width:${Math.round(lv.into/lv.need*100)}%"></i></div>
    ${LIVE?(NET.user?'':`<span class="pill sim">${L('Guest · scores not saved','Invité · scores non enregistrés')}</span>`):`<span class="pill sim">${L('Demo · saved on this device','Démo · enregistré ici')}</span>`}
  </div>`;
}
function topHTML(){
  const st=S.data,unread=st.notifs.filter(n=>!n.read).length+st.invites.length;
  return `<button class="logo top-logo" type="button" data-act="go" data-a="home" aria-label="RYVO">${LOGO}</button>
  <div class="grow"></div>
  <span class="stat-chip hide-m" title="${L('Day streak','Série de jours')}">${ic('flame',16)}${st.streak} ${plural(st.streak,'day','days','jour','jours')}</span>
  <span class="stat-chip hide-m">${leagueBadge(st.rating)} · ${st.rating} SR</span>
  ${!LIVE||NET.user?`<button class="gems-chip" type="button" data-act="go" data-a="shop" aria-label="${L('Gems','Gemmes')} : ${fmt(st.gems||0)}">${ic('gem',15)}${fmt(st.gems||0)}</button>`:''}
  <div class="lang hide-m" role="group" aria-label="${L('Language','Langue')}"><button type="button" data-act="lang" data-a="fr" aria-pressed="${LANG==='fr'}">FR</button><button type="button" data-act="lang" data-a="en" aria-pressed="${LANG==='en'}">EN</button></div>
  <button class="iconbtn" type="button" data-act="sound" aria-pressed="${st.sound}" aria-label="${st.sound?L('Sound on','Son activé'):L('Sound off','Son coupé')}">${ic(st.sound?'sound':'mute')}</button>
  <button class="iconbtn" type="button" data-act="notif" aria-label="${L('Notifications','Notifications')}${unread?` (${unread})`:''}">${ic('bell')}${unread?`<span class="dot">${unread>9?'9+':unread}</span>`:''}</button>
  ${st.account.signedIn?`<button class="me-btn hide-m" type="button" data-act="go" data-a="profile">${avMe(32)}<span class="t">${esc(st.account.username)}</span></button>`:`<button class="btn sm primary hide-m" type="button" data-act="auth" data-a="signup">${L('Sign in','Connexion')}</button>`}`;
}
function mnavHTML(){
  const cur=routeGroup(S.route);
  const items=[['home','home',()=>L('Home','Accueil')],['play','play',()=>L('Play','Jouer')],['ranks','trophy',()=>L('Ranks','Classements')],['leagues','flag',()=>L('Leagues','Ligues')]];
  const inMore=['campus','profile','shop','social','tech'].includes(cur);
  return items.map(n=>`<button type="button" data-act="go" data-a="${n[0]}" ${cur===n[0]?'aria-current="page"':''}>${ic(n[1],20)}${n[2]()}</button>`).join('')+`<button type="button" data-act="more" ${inMore?'aria-current="page"':''}>${ic('dots',20)}${L('More','Plus')}</button>`;
}
const footHTML=()=>LIVE?`<span>RYVO · ${new Date().getFullYear()}</span><span>${L('Scores are checked by the server. Pages marked “demo” show fictional examples.','Les scores sont vérifiés par le serveur. Les pages marquées « démo » montrent des exemples fictifs.')}</span><span>${L('Questions or data requests:','Questions ou demandes sur tes données :')} ${esc(CFG.contact||'')}</span>`:`<span>RYVO · ${L('prototype build 0.5','prototype version 0.5')} · ${new Date().toLocaleDateString(LOC(),{month:'long',year:'numeric'})}</span><span>${L('Frontend-only demo. Players, schools and figures marked “simulated” or “demo” are fictional.','Démo sans serveur. Les joueurs, écoles et chiffres marqués « simulé » ou « démo » sont fictifs.')}</span>`;

/* ========================= fragments ========================= */
const simPill=(t)=>`<span class="pill sim">${t||L('Simulated','Simulé')}</span>`;
function gameCard(g,opts={}){
  const st=S.data;
  if(!g.playable){
    const on=st.notify.includes(g.id);
    return `<article class="gcard off" style="--g:${g.col}"><div class="gart">${ART[g.id]}</div>
      <div class="gbody"><h3>${g.name}</h3><p class="tag">${g.tag()}</p>
      <div class="gmeta"><span>${g.cats.map(catName).join(' · ')}</span><span>${g.eta()}</span></div>
      <button class="btn sm ${on?'':'ghost'}" type="button" data-act="notifyGame" data-a="${g.id}" aria-pressed="${on}" style="margin-top:auto">${on?ic('check',16)+L('You’ll be notified','Tu seras prévenu'):ic('bell',16)+L('Notify me at launch','Me prévenir au lancement')}</button></div></article>`;
  }
  const [sk,best]=gameSKbest(g.id);
  const sticker=opts.daily?`<span class="sticker">${L('Daily','Du jour')}</span>`:opts.isNew?`<span class="sticker pink">${L('New','Nouveau')}</span>`:'';
  return `<button class="gcard" type="button" style="--g:${g.col}" data-act="lobby" data-a="${g.id}" aria-label="${L('Open','Ouvrir')} ${g.name}">${sticker}
    <div class="gart">${ART[g.id]}</div>
    <div class="gbody"><h3>${g.name}</h3>${opts.compact?'':`<p class="tag">${g.tag()}</p>`}
      <div class="gmeta"><span>${g.cats.map(catName).join(' · ')}</span><span><b>${g.dur}</b></span><span>${L('Best','Record')} <b>${fmtScore(sk,best)}</b></span></div>
      ${opts.compact?'':`<div class="gmodes">${MODE_IDS.map(m=>`<span>${MODES[m].n()}</span>`).join('')}</div>`}</div></button>`;
}
const NEW_GAMES=['stack','grid','words','aim'];
const mvHTML=m=>m>0?`<span class="mv up" aria-label="+${m}">▲${m}</span>`:m<0?`<span class="mv dn" aria-label="${m}">▼${-m}</span>`:'<span class="mv" aria-label="=">–</span>';
function lbRow(r,B){
  const s=SCH[r.school];
  return `<div class="lb-row${r.me?' me':''}${r.pos<=3?' top':''}"><span class="pos">${r.pos}</span><span class="who">${avP(r,32)}<span class="nm"><b>${esc(r.name)}${r.me?`<em>${L('You','Toi')}</em>`:''}${LIVE&&NET.user&&!r.me&&r.id?`<button class="rep" type="button" data-act="report" data-a="${r.id}" data-n="${esc(r.name)}" aria-label="${L('Report','Signaler')} ${esc(r.name)}" title="${L('Report','Signaler')}">⚑</button>`:''}</b><small>${s?esc(s.name):L('No school linked','Aucune école liée')}</small></span></span><span class="val">${B.f(r.val)}</span>${mvHTML(r.mv)}</div>`;
}
function lbList(data,B,limit=10,emptyMsg){
  if(data.loading)return `<div class="lb" aria-busy="true">${'<div class="skel"></div>'.repeat(4)}</div>`;
  if(data.err)return `<div class="empty"><b>${L('This ranking couldn’t load','Classement indisponible')}</b>${esc(data.err)}</div>`;
  if(data.unsupported)return `<div class="empty"><b>${L('Friends are coming soon','Les amis arrivent bientôt')}</b>${L('For now, compare yourself with your school, city or the world.','En attendant, compare-toi à ton école, ta ville ou au monde.')}</div>`;
  const top=data.rows.slice(0,limit);
  let h=top.map(r=>lbRow(r,B)).join('');
  if(data.me&&data.me.pos>limit)h+=`<div class="lb-gap" aria-hidden="true">· · ·</div>`+lbRow(data.me,B);
  if(!data.me&&!(LIVE&&!NET.user))h+=`<div class="lb-row unranked me"><span class="pos">–</span><span class="who">${avMe(32)}<span class="nm"><b>${esc(S.data.account.username)}<em>${L('You','Toi')}</em></b><small>${emptyMsg||L('Play to get ranked here.','Joue pour apparaître ici.')}</small></span></span><span class="val dim">${L('unranked','non classé')}</span></div>`;
  if(!data.rows.length&&!data.me)h=`<div class="empty"><b>${L('Nobody here yet','Personne pour l’instant')}</b>${L('No results for this ranking.','Aucun résultat pour ce classement.')}</div>`;
  return `<div class="lb">${h}</div>`;
}
function podium(rows,B){
  if(rows.length<3)return '';
  const order=[rows[1],rows[0],rows[2]],cls=['p2','p1','p3'];
  return `<div class="podium" aria-hidden="true">${order.map((r,i)=>`<div class="pod ${cls[i]}${r.me?' me':''}">${avP(r,i===1?54:42)}<span class="nm">${esc(r.name)}</span><span class="val">${B.f(r.val)}</span><div class="blk">${r.pos}</div></div>`).join('')}</div>`;
}
function uniList(rows){
  return `<div class="lb">${rows.map(u=>`<div class="lb-row${u.mine?' me':''}${u.pos<=3?' top':''}"><span class="pos">${u.pos}</span><span class="who"><span class="crest" style="background:${u.col}">${u.short}</span><span class="nm"><b>${esc(u.name)}${u.mine?`<em>${L('Yours','Ton école')}</em>`:''}</b><small>${esc(u.city)} · ${u.members} ${LIVE?plural(u.members,'player','players','joueur','joueurs'):L('demo players','joueurs démo')}${u.mine&&u.you?` · +${fmt(u.you)} ${L('from you','grâce à toi')}`:''}</small></span></span><span class="val">${fmt(u.pts)}</span>${mvHTML(u.mv)}</div>`).join('')}</div>`;
}
function classList(rows){
  return `<div class="lb">${rows.map(r=>`<div class="lb-row${r.mine?' me':''}${r.pos<=3?' top':''}"><span class="pos">${r.pos}</span><span class="who"><span class="nm"><b>${esc(yearLong(r.id))}${r.mine?`<em>${L('Your class','Ta promo')}</em>`:''}</b><small>${r.members} ${LIVE?plural(r.members,'player','players','joueur','joueurs'):L('demo players','joueurs démo')}</small></span></span><span class="val">${fmt(r.pts)}</span>${mvHTML(r.mv)}</div>`).join('')}</div>`;
}
function sparkline(vals,lw){
  if(vals.length<2)return `<p class="tiny">${L('Play twice to see your trend.','Joue deux fois pour voir ta tendance.')}</p>`;
  const W=300,H=60,p=7,min=Math.min(...vals),max=Math.max(...vals),span=(max-min)||1;
  const pts=vals.map((v,i)=>{const x=p+i*(W-2*p)/(vals.length-1);let y=(v-min)/span;if(lw)y=1-y;return [x,H-p-y*(H-2*p)];});
  const d=pts.map((q,i)=>(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)).join(' '),last=pts[pts.length-1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${L('Recent results, higher is better','Résultats récents, plus haut = mieux')}"><path d="${d} L${last[0]} ${H} L${pts[0][0]} ${H}Z" fill="#ECEAFF"/><path d="${d}" fill="none" stroke="${INK}" stroke-width="2.5" vector-effect="non-scaling-stroke"/><circle cx="${last[0]}" cy="${last[1]}" r="5" fill="#FFC93C" stroke="${INK}" stroke-width="2"/></svg>`;
}
function achBadge(a,on){return `<div class="ach${on?'':' locked'}"><svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><path d="M18 2l14 8v16l-14 8-14-8V10z" fill="${on?'#FFC93C':'#F3EEE6'}" stroke="${on?INK:'#D3CCBF'}" stroke-width="2"/><text x="18" y="23" text-anchor="middle" font-family="Bricolage Grotesque,sans-serif" font-weight="800" font-size="13" fill="${on?INK:'#7C7792'}">${esc(a.n()[0])}</text></svg><div style="min-width:0"><b>${a.n()}</b><small>${a.d()}</small></div></div>`;}
function histItem(h){
  const G=GAME[h.g],o=h.o==='win'?`<span class="good">${L('Win','Victoire')}</span>`:h.o==='loss'?`<span class="bad">${L('Loss','Défaite')}</span>`:h.o==='draw'?L('Draw','Nul'):'';
  const sk=h.sk||h.g;
  return `<li style="--g:${G.col}"><span class="gico">${ic(G.icon,18)}</span><span class="t"><b>${esc(skName(sk))} · ${MODES[h.m].n()}</b><small>${h.opp?L('vs ','contre ')+esc(h.opp)+' · ':''}${ago(h.t)}${h.dr?` · ${h.dr>0?'+':''}${h.dr} SR`:''}</small></span><span class="r">${fmtScore(sk,h.s)}<small>${o?o+' · ':''}+${h.xp} XP</small></span></li>`;
}

let FEED=null;
function newDuel(){
  const a=DEMO[Math.floor(Math.random()*DEMO.length)];let b;do{b=DEMO[Math.floor(Math.random()*DEMO.length)];}while(b===a);
  const g=PLAYABLE[Math.floor(Math.random()*PLAYABLE.length)],sk=g.id==='sprint'?'sprint@'+Math.floor(Math.random()*3):g.id;
  const sc=p=>{const v=p.best[sk]||(g.lower?(g.id==='sprint'?TRACKS[trackOf(sk)].par*1.3:280):2000);return g.lower?v*(1+Math.random()*.08):v*(1-Math.random()*.2);};
  return {a,b,sk,sa:sc(a),sb:sc(b),t:Date.now()};
}
function feedHTML(isNew){
  if(!FEED)FEED=Array.from({length:5},newDuel);
  return FEED.map((d,i)=>{const aw=lower(d.sk)?d.sa<d.sb:d.sa>d.sb,w=aw?d.a:d.b;
    return `<li class="${isNew&&i===0?'new':''}"><span class="vsdot">${avP(d.a,28)}${avP(d.b,28)}</span><span class="txt"><b>${esc(d.a.name)}</b> vs <b>${esc(d.b.name)}</b><small>${GAME[gameOf(d.sk)].name} · ${fmtScore(d.sk,gameOf(d.sk)==='sprint'?+d.sa.toFixed(2):d.sa)} – ${fmtScore(d.sk,gameOf(d.sk)==='sprint'?+d.sb.toFixed(2):d.sb)}</small></span><span class="pill">${esc(w.name)} ${L('wins','gagne')}</span></li>`;}).join('');
}

/* ========================= views ========================= */
const VIEWS={};

VIEWS.home=()=>{
  const st=S.data;rollDaily();
  const lv=levelInfo(st.xp),dg=dailyGame(),dsk=dailySK(dg.id),left=attLeft(dg.id);
  const h=new Date().getHours(),greet=h<5?L('Late session','Session nocturne'):h<12?L('Good morning','Bonjour'):h<18?L('Good afternoon','Bon après-midi'):L('Good evening','Bonsoir');
  const world=boardRows('rating','world');
  const pbs=SKS.filter(k=>st.bests[k]!=null).length;
  const missions=todayMissions(),th=todayHist();
  const next=LIVE&&!NET.user?L('<b>Create an account</b> to save your scores and get ranked.','<b>Crée un compte</b> pour enregistrer tes scores et être classé.'):!st.history.length?L('New here? <b>Pop Shot</b> takes 30 seconds.','Nouveau ? <b>Pop Shot</b> prend 30 secondes.'):left>0?L(`Today’s Daily is <b>${dg.name}</b>. ${left} ${left>1?'attempts':'attempt'} left.`,`Le Défi du jour, c’est <b>${dg.name}</b>. ${left} ${left>1?'essais restants':'essai restant'}.`):L(`Win a duel to push toward <b>${league(st.rating+120).n()}</b>.`,`Gagne un duel pour viser <b>${league(st.rating+120).n()}</b>.`);
  const recent=st.history.slice(0,5);
  const wkEnd=weekStart()+7*864e5,ms=wkEnd-Date.now(),dd=Math.floor(ms/864e5),hh=Math.floor(ms%864e5/36e5);
  const wk=boardRows('weekly','world'),dr=dailyRows(dsk);
  return `
  <section class="hero" aria-label="${L('Your progress','Ta progression')}">
    <div class="hero-id">${avMe(76)}<div class="meta"><p class="eyebrow">${greet}</p><h1>${esc(st.account.username)}</h1>
      <p class="tiny">${L('Level','Niveau')} ${lv.L} · ${fmt(st.xp)} XP · ${leagueBadge(st.rating)} · ${st.rating} SR</p>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${lv.need}" aria-valuenow="${lv.into}" aria-label="XP"><i style="width:${Math.round(lv.into/lv.need*100)}%"></i></div>
      <p class="tiny">${lv.need-lv.into} XP ${L('to level','avant le niveau')} ${lv.L+1}</p></div></div>
    <div class="hero-stats">
      <div class="hs"><small>${L('Streak','Série')}</small><b>${st.streak}<span class="tiny"> ${L('d','j')}</span></b></div>
      <div class="hs"><small>${L('World rank','Rang mondial')}</small><b>#${world.me?world.me.pos:'–'}</b></div>
      <div class="hs"><small>${L('Records','Records')}</small><b>${pbs}<span class="tiny">/${SKS.length}</span></b></div>
    </div>
    <div class="hero-cta"><button class="btn big" type="button" data-act="playnow">${ic('play',20)}${L('Play now','Jouer')}</button><p class="next">${next}</p></div>
  </section>

  <div class="grid" style="margin-top:22px">
    <section class="card pop c4" aria-label="${L('Daily challenge','Défi du jour')}" style="--g:${dg.col}">
      <div class="card-h"><div class="l">${ic('cal')}<h2>${L('Daily Challenge','Défi du jour')}</h2></div><span class="pill warn">${left}/3 ${L('left','restants')}</span></div>
      <div class="row" style="gap:14px;flex-wrap:nowrap"><div class="lobby-art" style="width:110px;flex:none">${ART[dg.id]}</div><div style="min-width:0"><b class="num" style="font-size:17px">${dg.name}</b>${dg.id==='sprint'?`<p class="tiny">${TRACKS[dailyTrack()].name}</p>`:''}<p class="tiny">${L('Same seed for everyone today. Your best:','Même tirage pour tous. Ton record :')} <b>${fmtScore(dsk,st.daily.best[dg.id])}</b></p></div></div>
      <p class="tiny">${dr.me?L(`You’re <b>#${dr.me.pos}</b> of ${dr.rows.length} today.`,`Tu es <b>#${dr.me.pos}</b> sur ${dr.rows.length} aujourd’hui.`):L(`${dr.rows.length} players posted a score today.`,`${dr.rows.length} joueurs ont un score aujourd’hui.`)}</p>
      <button class="btn hot" type="button" data-act="quick" data-a="${dg.id}:daily" ${left<1?'disabled':''}>${left<1?L('Come back tomorrow','Reviens demain'):L('Play the Daily','Jouer le défi')}</button>
    </section>

    <section class="card c4" aria-label="${L('Missions','Missions')}">
      <div class="card-h"><div class="l">${ic('target')}<h2>${L('Missions','Missions')}</h2></div><span class="tiny">${L('Reset at midnight','Remise à zéro à minuit')}</span></div>
      <ul>${missions.map(m=>{const sm=LIVE&&NET.me?NET.me.missions.find(x=>x.id===m.id):null,p=Math.min(m.goal,sm?sm.prog:m.prog(th)),done=p>=m.goal,claimed=sm?sm.claimed:st.missions.claimed.includes(m.id);
        return `<li class="mi${done?' done':''}"><div style="min-width:0"><b>${m.txt()}</b><div class="bar sun thin"><i style="width:${p/m.goal*100}%"></i></div></div><span class="mono tiny">+${m.xp}</span>${claimed?`<span class="pill now">${L('Claimed','Récupéré')}</span>`:done&&!LIVE?`<button class="btn sm hot" type="button" data-act="claim" data-a="${m.id}">${L('Claim','Récupérer')}</button>`:`<span class="mono tiny">${p}/${m.goal}</span>`}</li>`;}).join('')}</ul>
    </section>

    <section class="card c4" aria-label="${L('Weekly cup','Coupe hebdo')}">
      <div class="card-h"><div class="l">${ic('trophy')}<h2>${L('Weekly Cup','Coupe hebdo')}</h2></div><span class="pill">${dd}${L('d','j')} ${hh}h</span></div>
      <div class="kpis" style="grid-template-columns:1fr 1fr"><div class="kpi"><small>${L('Your points','Tes points')}</small><b>${fmt(myPts(weekStart()))}</b></div><div class="kpi"><small>${L('Position','Position')}</small><b>${wk.me?'#'+wk.me.pos:'–'}</b></div></div>
      <p class="tiny">${L('Each match earns up to 120 cup points, +30 for a duel win. Top 50 get the season frame.','Chaque match rapporte jusqu’à 120 points, +30 pour un duel gagné. Le top 50 gagne le cadre de saison.')}</p>
      <button class="btn" type="button" data-act="rankgo" data-a="weekly">${L('See standings','Voir le classement')}</button>
    </section>

    <section class="c12" aria-label="${L('Games','Jeux')}">
      <div class="card-h" style="margin-bottom:14px"><h2 style="font-size:24px">${L('Pick a game','Choisis un jeu')}</h2><button class="btn sm" type="button" data-act="go" data-a="play">${L('Full library','Toute la ludothèque')}</button></div>
      <div class="games four">${PLAYABLE.map(g=>gameCard(g,{daily:g.id===dg.id,isNew:NEW_GAMES.includes(g.id),compact:true})).join('')}</div>
    </section>

    <section class="card c5" aria-label="${L('Live duels','Duels en direct')}">
      <div class="card-h"><div class="l">${ic('swords')}<h2>${LIVE?L('Recent duels','Duels récents'):L('Live duels','Duels en direct')}</h2></div>${LIVE?'':simPill(L('Simulated feed','Flux simulé'))}</div>
      ${LIVE?liveFeedHTML():`<ul class="feed" id="liveFeed">${feedHTML()}</ul>`}
    </section>
    <section class="card c7" aria-label="${L('Recent activity','Activité récente')}">
      <div class="card-h"><h2>${L('Recent activity','Activité récente')}</h2><button class="btn sm ghost" type="button" data-act="go" data-a="profile">${L('History','Historique')}</button></div>
      ${recent.length?`<ul class="hist">${recent.map(histItem).join('')}</ul>`:`<div class="empty"><b>${L('No matches yet','Aucun match pour l’instant')}</b>${L('Your results, records and rating changes will show up here.','Tes résultats, records et variations de cote s’afficheront ici.')}<button class="btn sm primary" type="button" data-act="quick" data-a="aim:trial">${L('Try Pop Shot','Essayer Pop Shot')}</button></div>`}
    </section>
    <section class="card c6" aria-label="${L('World ranking','Classement mondial')}">
      <div class="card-h"><h2>${L('World · rating','Monde · cote')}</h2><div class="row">${simPill(L('Demo roster','Joueurs démo'))}<button class="btn sm ghost" type="button" data-act="rankgo" data-a="rating">${L('Open','Ouvrir')}</button></div></div>
      ${lbList(world,BOARD('rating'),5)}
    </section>
    <section class="card c6" aria-label="${L('School cup','Coupe des écoles')}">
      <div class="card-h"><h2>${L('School Cup','Coupe des écoles')}</h2><div class="row">${simPill(L('Fictional schools','Écoles fictives'))}<button class="btn sm ghost" type="button" data-act="go" data-a="campus">${L('Open','Ouvrir')}</button></div></div>
      ${uniList(uniRows().slice(0,5))}
    </section>
  </div>`;
};

VIEWS.play=()=>{
  const f=S.ui.lib;
  let list=GAMES.filter(g=>(f.cat==='all'||g.cats.includes(f.cat))&&(f.diff==='all'||String(g.diff)===f.diff)&&(f.mode==='all'||g.playable));
  list.sort((a,b)=>f.sort==='pop'?(b.pop-a.pop):f.sort==='easy'?(a.diff-b.diff):(b.diff-a.diff));
  return `<div class="page-h"><div><p class="eyebrow">${L('Game library','Ludothèque')}</p><h1>${L('Pick a game, play in two minutes','Choisis un jeu, joue en deux minutes')}</h1><p>${L('Eight games are playable now. Each supports Time Trial, simulated 1v1 Duels, the Daily Challenge and the School Cup.','Huit jeux sont jouables. Chacun propose contre-la-montre, duels 1v1 simulés, Défi du jour et Coupe des écoles.')}</p></div></div>
  <div class="chips scroll" role="group" aria-label="${L('Category','Catégorie')}" style="margin-bottom:14px"><button class="chip" type="button" data-act="cat" data-a="all" aria-pressed="${f.cat==='all'}">${L('All games','Tous les jeux')}</button>${CATS.map(c=>`<button class="chip" type="button" data-act="cat" data-a="${c[0]}" aria-pressed="${f.cat===c[0]}">${c[1]()}</button>`).join('')}</div>
  <div class="filters">
    <div class="field"><label for="fMode">${L('Game mode','Mode de jeu')}</label><select class="input" id="fMode" data-ch="libMode"><option value="all">${L('Any mode','Tous les modes')}</option>${MODE_IDS.map(k=>`<option value="${k}" ${f.mode===k?'selected':''}>${MODES[k].n()}</option>`).join('')}</select></div>
    <div class="field"><label for="fDiff">${L('Difficulty','Difficulté')}</label><select class="input" id="fDiff" data-ch="libDiff"><option value="all">${L('Any','Toutes')}</option>${[1,2,3].map(d=>`<option value="${d}" ${f.diff===String(d)?'selected':''}>${diffName(d)}</option>`).join('')}</select></div>
    <div class="field"><label for="fSort">${L('Sort by','Trier par')}</label><select class="input" id="fSort" data-ch="libSort"><option value="pop" ${f.sort==='pop'?'selected':''}>${L('Popularity','Popularité')}</option><option value="easy" ${f.sort==='easy'?'selected':''}>${L('Easiest first','Plus facile d’abord')}</option><option value="hard" ${f.sort==='hard'?'selected':''}>${L('Hardest first','Plus difficile d’abord')}</option></select></div>
    <span class="tiny" style="margin-left:auto">${list.length} ${plural(list.length,'game','games','jeu','jeux')}</span>
  </div>
  ${list.length?`<div class="games">${list.map(g=>gameCard(g,{daily:g.id===dailyGame().id,isNew:NEW_GAMES.includes(g.id)})).join('')}</div>`:`<div class="empty"><b>${L('No games match these filters','Aucun jeu ne correspond')}</b>${L('Try another category or reset the filters.','Essaie une autre catégorie ou réinitialise les filtres.')}<button class="btn sm" type="button" data-act="libReset">${L('Reset filters','Réinitialiser')}</button></div>`}`;
};

function lobbySK(){const Lb=S.ui.lobby;if(Lb.game!=='sprint')return Lb.game;if(Lb.mode==='daily')return 'sprint@'+dailyTrack();return 'sprint@'+Lb.track;}
VIEWS.lobby=()=>{
  const g=GAME[S.ui.lobby.game],st=S.data,Lb=S.ui.lobby;
  if(!g||!g.playable)return VIEWS.play();
  const lv=levelInfo(st.xp).L,sk=lobbySK(),best=st.bests[sk];
  const mine=st.history.filter(h=>(h.sk||h.g)===sk).slice(0,10).reverse().map(h=>h.s);
  const top=boardRows(sk,'world'),left=attLeft(g.id),o=Lb.oppId?DEMO_BY[Lb.oppId]:null;
  let opts='';
  if(g.id==='sprint'){
    opts=Lb.mode==='daily'?`<p class="tiny">${L('Daily track:','Circuit du jour :')} <b>${TRACKS[dailyTrack()].name}</b></p>`
      :`<div class="field"><span class="lab">${L('Track','Circuit')}</span><div class="opts">${TRACKS.map((T,i)=>{const lock=lv<T.lv;return `<button class="chip" type="button" data-act="track" data-a="${i}" aria-pressed="${Lb.track===i}" ${lock?'disabled':''}>${lock?ic('lock',14):''}${T.name}${lock?` · ${L('Lv','Niv.')} ${T.lv}`:` · ${L('par','par')} ${Math.round(T.par)} s`}</button>`;}).join('')}</div></div>`;
  }
  if(g.id==='brain'){
    opts=Lb.mode==='daily'?`<p class="tiny">${L('Daily set: mixed categories.','Série du jour : catégories mixtes.')}</p>`
      :`<div class="field"><span class="lab">${L('Category','Catégorie')}</span><div class="opts"><button class="chip" type="button" data-act="qcat" data-a="mix" aria-pressed="${Lb.cat==='mix'}">${L('Mixed','Mixte')}</button>${Object.keys(QCATS).map(c=>`<button class="chip" type="button" data-act="qcat" data-a="${c}" aria-pressed="${Lb.cat===c}">${QCATS[c]()}</button>`).join('')}</div></div>`;
  }
  let modePanel='';
  if(Lb.mode==='duel'&&LIVE){modePanel=liveDuelPanel();}
  else if(Lb.mode==='duel'&&o){
    const gain=Math.max(4,Math.round(32*(1-1/(1+10**((o.rating-st.rating)/400)))));
    modePanel=`<div class="opp">${avP(o,52)}<div style="min-width:0;flex:1"><b class="num" style="font-size:17px">${esc(o.name)}</b><p class="tiny">${esc(SCH[o.school].name)} · ${leagueBadge(o.rating)} ${o.rating} SR</p><p class="tiny">${L('Best','Record')} : ${fmtScore(sk,o.best[sk])} · ${online(o)?L('online','en ligne'):L('offline','hors ligne')} (${L('simulated','simulé')})</p></div><button class="btn sm" type="button" data-act="reroll">${ic('refresh',16)}${L('Another','Un autre')}</button></div>
    <p class="tiny">${simPill(L('Simulated rival','Rival simulé'))} ${L(`Real matchmaking needs a server. This rival plays from their stats on your device. A win is worth about +${gain} SR.`,`Le vrai matchmaking demande un serveur. Ce rival joue selon ses stats sur ton appareil. Une victoire vaut environ +${gain} SR.`)}</p>`;
  }else if(Lb.mode==='daily'){
    modePanel=`<div class="row"><span class="pill warn">${left}/3 ${L('attempts left','essais restants')}</span><span class="tiny">${L('Today’s best','Record du jour')} : <b>${fmtScore(sk,st.daily.best[g.id])}</b></span></div>${lbList(dailyRows(sk),BOARD(sk),5,L('Post a Daily score to appear here.','Joue le défi pour apparaître ici.'))}`;
  }else if(Lb.mode==='school'){
    const s=SCH[st.school.id];
    modePanel=s?`<div class="opp"><span class="crest" style="background:${s.col}">${s.short}</span><div><b>${esc(s.name)}</b><p class="tiny">${st.school.year?esc(yearName(st.school.year))+' · ':''}${LIVE?esc(s.city)+(st.school.status==='verified'?' · '+L('verified','vérifié'):''):st.school.status==='pending'?L('verification pending','vérification en cours'):L('unverified (demo)','non vérifié (démo)')}</p><p class="tiny">${L('This run adds 50 to 200 Cup points depending on performance.','Cette partie rapporte 50 à 200 points selon ta performance.')}</p></div></div>`
      :`<div class="empty"><b>${L('No school linked','Aucune école liée')}</b>${L('Link your university to play for it.','Lie ton université pour jouer pour elle.')}<button class="btn sm" type="button" data-act="go" data-a="campus">${L('Link a school','Lier une école')}</button></div>`;
  }else{
    modePanel=`<p class="tiny">${L('Your result is compared with every ranked player. Personal bests replace your leaderboard entry.','Ton résultat est comparé à tous les joueurs classés. Ton record remplace ton entrée au classement.')}${g.id==='sprint'?' '+L('Your fastest race on each track is saved as a ghost.','Ta course la plus rapide sur chaque circuit devient un fantôme.'):''}</p>`;
  }
  const disabled=(Lb.mode==='daily'&&left<1)||(Lb.mode==='school'&&!SCH[st.school.id]);
  const ctl={sprint:L('Arrow keys or WASD. Touch buttons on phones.','Flèches ou ZQSD/WASD. Boutons tactiles sur mobile.'),reflex:L('Space or tap.','Espace ou toucher.'),brain:L('Keys 1–4 or tap.','Touches 1–4 ou toucher.'),cards:L('Keys 1–5, O for Overcharge.','Touches 1–5, O pour la Surcharge.'),stack:L('Space, click or tap.','Espace, clic ou toucher.'),grid:L('Tap tiles, or arrows + Space.','Touche les cases, ou flèches + Espace.'),words:L('Type or tap letters. Enter to check.','Tape ou touche les lettres. Entrée pour valider.'),aim:L('Click or tap.','Clic ou toucher.')}[g.id];
  return `<div class="page-h"><div class="row"><button class="btn sm" type="button" data-act="go" data-a="play">${ic('back',16)}${L('Library','Ludothèque')}</button></div></div>
  <div class="lobby-head" style="--g:${g.col}">
    <section class="card pop">
      <div class="row" style="gap:18px;flex-wrap:nowrap;align-items:flex-start"><div class="lobby-art" style="width:170px;flex:none">${ART[g.id]}</div>
      <div style="min-width:0"><p class="eyebrow">${g.cats.map(catName).join(' · ')} · ${diffName(g.diff)}</p><h1>${g.name}</h1><p class="mu" style="margin-top:8px">${g.tag()}</p></div></div>
      <ul class="rules">${g.rules().map(r=>`<li>${r}</li>`).join('')}</ul>
    </section>
    <section class="card">
      <div class="card-h"><h2>${L('Your record','Ton record')}</h2><span class="mono">${fmtScore(sk,best)}</span></div>
      ${sparkline(mine,g.lower)}
      <h3>${L('World top 5','Top 5 mondial')}${g.id==='sprint'?' · '+TRACKS[trackOf(sk)].name:''}</h3>${lbList(top,BOARD(sk),5)}
    </section>
  </div>
  <section class="card" style="margin-top:18px">
    <div class="card-h"><h2>${L('Choose a mode','Choisis un mode')}</h2></div>
    <div class="modes" role="radiogroup" aria-label="${L('Game mode','Mode de jeu')}">${MODE_IDS.map(k=>`<button type="button" class="mode" role="radio" aria-checked="${Lb.mode===k}" data-act="mode" data-a="${k}"><b>${MODES[k].n()}</b><small>${MODES[k].d()}</small></button>`).join('')}</div>
    ${opts}
    ${modePanel}
    <div class="row"><button class="btn big primary" type="button" data-act="start" ${disabled?'disabled':''}>${ic('play',20)}${Lb.mode==='duel'?L('Start duel','Lancer le duel'):L('Start','Lancer')}</button><span class="tiny">${ctl}</span></div>
  </section>`;
};

VIEWS.game=()=>{
  const g=GAME[S.game.id],o=S.game.oppId?DEMO_BY[S.game.oppId]:(S.game.run&&S.game.run.opp?{name:S.game.run.opp.name}:null);
  return `<div class="gframe" style="--g:${g.col}"><div class="gframe-h"><button class="btn sm" type="button" data-act="quit">${ic('x',16)}${L('Quit','Quitter')}</button><h1>${g.name}</h1><span class="pill ink">${MODES[S.game.mode].n()}</span>${S.game.practice?`<span class="pill warn">${L('Guest · not saved','Invité · non enregistré')}</span>`:''}${g.id==='sprint'?`<span class="pill">${TRACKS[trackOf(S.game.sk)].name}</span>`:''}${o?`<span class="pill sim">${L('vs','contre')} ${esc(o.name)} · ${L('simulated','simulé')}</span>`:''}<div class="grow"></div></div>
  <div class="stage" id="gameMount"></div></div>`;
};

VIEWS.result=()=>{
  const r=S.result;if(!r)return VIEWS.home();
  if(r.practice||r.rejected)return practiceResult(r);
  const G=GAME[r.g],st=S.data,lv=levelInfo(st.xp),sk=r.sk;
  const duelish=r.mode==='duel'||r.g==='cards';
  const title=duelish?(r.outcome==='win'?L('Victory','Victoire'):r.outcome==='loss'?L('Defeat','Défaite'):L('Draw','Égalité')):r.better?(r.first?L('First record','Premier record'):L('New personal best','Nouveau record')):L('Run complete','Partie terminée');
  const dark=r.g!=='cards';
  const dPrev=r.prev!=null?(G.lower?r.prev-r.score:r.score-r.prev):null;
  const sign=v=>v>0?'+':v<0?'−':'±';
  const fdelta=v=>r.g==='sprint'?Math.abs(v).toFixed(2)+' s':r.g==='reflex'?Math.round(Math.abs(v))+' ms':fmt(Math.abs(v))+' pts';
  const world=boardRows(sk,'world'),school=SCH[st.school.id]?boardRows(sk,'school'):null;
  const pct=world.me?Math.round((1-(world.me.pos-1)/Math.max(1,world.rows.length-1))*100):0;
  const d=r.details||{};let detail='';
  if(r.g==='sprint')detail=`<dl class="cmp"><dt>${L('Lap splits','Temps au tour')}</dt><dd>${(d.splits||[]).map((x,i,a)=>(x-(a[i-1]||0)).toFixed(2)).join(' / ')} s</dd><dt>${L('Boosts collected','Boosts ramassés')}</dt><dd>${d.boosts||0}</dd><dt>${L('Cone hits','Plots touchés')}</dt><dd>${d.hits||0}</dd><dt>${L('Track par','Par du circuit')}</dt><dd>${TRACKS[trackOf(sk)].par.toFixed(1)} s</dd></dl>`;
  if(r.g==='reflex'){const mx=Math.max(...(d.times||[1]),350);detail=`<div class="minibars" style="--g:${G.col}">${(d.times||[]).map((x,i)=>`<div><i style="height:${Math.max(10,x/mx*70)}px"></i>${x}<span class="dim">R${i+1}</span></div>`).join('')}</div><dl class="cmp"><dt>${L('False starts','Faux départs')}</dt><dd>${d.fs||0}${d.fs?` (+${d.fs*10} ms)`:''}</dd><dt>${L('Rating','Niveau')}</dt><dd>${d.label||''}</dd></dl>`;}
  if(r.g==='brain')detail=`<dl class="cmp"><dt>${L('Accuracy','Précision')}</dt><dd>${d.correct}/${d.total} · ${Math.round(d.correct/d.total*100)} %</dd><dt>${L('Average response','Temps moyen')}</dt><dd>${(d.avgT||0).toFixed(2)} s</dd><dt>${L('Best streak','Meilleure série')}</dt><dd>${d.bestStreak||0}</dd><dt>${L('Category','Catégorie')}</dt><dd>${d.cat==='mix'||!d.cat?L('Mixed','Mixte'):QCATS[d.cat]()}</dd></dl>`;
  if(r.g==='cards')detail=`<dl class="cmp"><dt>${L('Rounds','Manches')}</dt><dd>${d.yw} – ${d.aw}</dd><dt>${L('Winning margin','Écart cumulé')}</dt><dd>${d.margin}</dd><dt>Overcharge</dt><dd>${d.oc?L('used','utilisée'):L('unused','non utilisée')}</dd></dl>`;
  if(r.g==='stack')detail=`<dl class="cmp"><dt>${L('Floors','Étages')}</dt><dd>${d.floors}</dd><dt>${L('Perfect drops','Lâchers parfaits')}</dt><dd>${d.perfects}</dd><dt>${L('Best perfect streak','Meilleure série parfaite')}</dt><dd>${d.maxCombo}</dd></dl>`;
  if(r.g==='grid')detail=`<dl class="cmp"><dt>${L('Boards solved','Grilles résolues')}</dt><dd>${d.boards}</dd><dt>${L('Largest board','Plus grande grille')}</dt><dd>${d.maxN?d.maxN+'×'+d.maxN:'—'}</dd><dt>${L('Moves','Coups')}</dt><dd>${d.moves}</dd><dt>${L('Efficiency bonus','Bonus d’efficacité')}</dt><dd>${fmt(d.eff||0)}</dd></dl>`;
  if(r.g==='words')detail=`<dl class="cmp"><dt>${L('Words found','Mots trouvés')}</dt><dd>${d.found}</dd><dt>${L('Skipped','Passés')}</dt><dd>${d.skipped}</dd><dt>${L('Best streak','Meilleure série')}</dt><dd>${d.bestStreak}</dd></dl><div class="wr-found" style="justify-content:flex-start">${(d.list||[]).map(w=>`<span class="${w[1]?'':'skip'}">${esc(w[0])}</span>`).join('')}</div>`;
  if(r.g==='aim')detail=`<dl class="cmp"><dt>${L('Hits','Touches')}</dt><dd>${d.hits}</dd><dt>${L('Accuracy','Précision')}</dt><dd>${d.acc} %</dd><dt>${L('Best combo','Meilleur combo')}</dt><dd>${d.maxCombo}</dd><dt>${L('Bullseyes','Centres')}</dt><dd>${d.bulls}</dd></dl>`;
  return `<div class="stack">
  <section class="res-hero" style="--rbg:${G.hex};--rfg:${dark?'#fff':INK}">
    <span class="outcome">${title}</span>
    <p class="eyebrow">${esc(skName(sk))} · ${MODES[r.mode].n()}</p>
    <div class="big" id="resScore" data-to="${r.score}">${fmtScore(sk,r.score)}</div>
    ${r.server&&r.server.status==='flagged'?`<span class="pill warn" style="background:#fff">${L('Under review: this score joins the rankings once checked','En vérification : ce score rejoindra le classement après contrôle')}</span>`:''}
    ${r.oppName?`<p class="mu">${esc(r.oppName)}${r.oppName!=='PB'?` (${L('simulated','simulé')})`:''} : <b>${r.oppScore!=null?fmtScore(sk,r.oppScore):'—'}</b></p>`:''}
    <div class="res-actions">
      <button class="btn hot" type="button" data-act="again">${ic('refresh',16)}${r.mode==='duel'?L('Rematch','Revanche'):L('Play again','Rejouer')}</button>
      <button class="btn" type="button" data-act="share">${ic('share',16)}${L('Share','Partager')}</button>
      <button class="btn" type="button" data-act="classmate">${ic('swords',16)}${L('Challenge a classmate','Défier un camarade')}</button>
      <button class="btn" type="button" data-act="rankgo" data-a="${sk}">${ic('trophy',16)}${L('Rankings','Classements')}</button>
    </div>
  </section>
  <div class="grid">
    <section class="card c4"><h2>${L('Against yourself','Face à toi-même')}</h2><dl class="cmp">
      <dt>${L('Previous best','Ancien record')}</dt><dd>${r.prev!=null?fmtScore(sk,r.prev):L('none','aucun')}</dd>
      ${dPrev!=null?`<dt>${L('vs best','vs record')}</dt><dd class="${dPrev>0?'good':dPrev<0?'bad':''}">${sign(dPrev)}${fdelta(dPrev)}</dd>`:''}
      ${r.lastPrev!=null?`<dt>${L('vs last attempt','vs dernier essai')}</dt><dd>${(()=>{const v=G.lower?r.lastPrev-r.score:r.score-r.lastPrev;return `<span class="${v>0?'good':v<0?'bad':''}">${sign(v)}${fdelta(v)}</span>`;})()}</dd>`:''}
      ${r.dailyLeft!=null?`<dt>${L('Daily attempts left','Essais du jour restants')}</dt><dd>${r.dailyLeft}</dd>`:''}
    </dl></section>
    ${LIVE?liveOthers(r):`<section class="card c4"><h2>${L('Against others','Face aux autres')}</h2><dl class="cmp">
      <dt>${L('World rank','Rang mondial')}</dt><dd>${world.me?`#${world.me.pos} / ${world.rows.length}`:'—'}</dd>
      <dt>${L('Ahead of','Devant')}</dt><dd>${world.me?pct+' % '+L('of players','des joueurs'):'—'}</dd>
      ${school&&school.me?`<dt>${L('School rank','Rang dans l’école')}</dt><dd>#${school.me.pos} / ${school.rows.length}</dd>`:''}
      ${r.schoolGain?`<dt>${L('School Cup','Coupe des écoles')}</dt><dd class="good">+${r.schoolGain} ${L('for','pour')} ${SCH[st.school.id].short}</dd>`:''}
    </dl><p class="tiny">${simPill(L('Demo roster','Joueurs démo'))}</p></section>`}
    <section class="card c4"><h2>${L('Progress','Progression')}</h2><dl class="cmp">
      <dt>${L('XP earned','XP gagnée')}</dt><dd class="good">+${r.xp}</dd>
      <dt>${L('Level','Niveau')}</dt><dd>${r.lvAfter>r.lvBefore?`<b>${r.lvBefore} → ${r.lvAfter}</b>`:r.lvAfter}</dd>
      ${r.mode==='duel'?`<dt>${L('Rating','Cote')}</dt><dd class="${r.dr>0?'good':r.dr<0?'bad':''}">${r.dr>0?'+':''}${r.dr} → ${st.rating} SR</dd>`:''}
    </dl><div class="bar"><i style="width:${Math.round(lv.into/lv.need*100)}%"></i></div><p class="tiny">${lv.need-lv.into} XP ${L('to level','avant le niveau')} ${lv.L+1}</p>
    ${r.ach.length?`<div class="achs">${r.ach.map(a=>achBadge(a,true)).join('')}</div>`:''}</section>
    <section class="card c12" style="--g:${G.col}"><h2>${L('Match details','Détails du match')}</h2>${detail}</section>
  </div></div>`;
};

VIEWS.ranks=()=>{
  const u=S.ui.rank,st=S.data,hasSchool=!!SCH[st.school.id];
  const head=`<div class="page-h"><div><p class="eyebrow">${L('Rankings','Classements')}</p><h1>${L('Where you stand','Où tu te situes')}</h1><p>${L('Switch between friends, class, school, city, country and world. Your row stays visible even outside the top 10.','Passe des amis à ta promo, ton école, ta ville, ton pays et le monde. Ta ligne reste visible même hors du top 10.')}</p></div>${LIVE?'':simPill(L('Demo roster · not verified','Joueurs démo · non vérifié'))}</div>
  <div class="seg" role="tablist" aria-label="${L('Ranking type','Type de classement')}">${[['players',L('Players','Joueurs')],['unis',L('Schools','Écoles')],['classes',L('Classes','Promos')]].map(v=>`<button type="button" role="tab" aria-selected="${u.view===v[0]}" data-act="rview" data-a="${v[0]}">${v[1]}</button>`).join('')}</div>`;
  if(u.view==='unis')return head+`<section class="card" style="margin-top:18px"><div class="card-h"><div class="l"><h2>${L('School Cup · this week','Coupe des écoles · cette semaine')}</h2>${LIVE?'':simPill(L('Fictional institutions','Établissements fictifs'))}</div></div>${(()=>{const u=uniRows();return u.length?uniList(u):`<div class="empty"><b>${L('No school has played yet this week','Aucune école n’a encore joué cette semaine')}</b>${L('Add your school in Campus and play a School Cup run.','Ajoute ton école dans Campus et joue une partie de Coupe.')}<button class="btn sm" type="button" data-act="go" data-a="campus">Campus</button></div>`;})()}<p class="tiny">${LIVE?L('Schools are added by the players themselves. Standings reset every Monday.','Les écoles sont ajoutées par les joueurs eux-mêmes. Remise à zéro chaque lundi.'):L('These universities are invented. In production, only verified students’ results would count.','Ces universités sont inventées. En production, seuls les résultats d’étudiants vérifiés compteraient.')}</p></section>`;
  if(u.view==='classes'){const rows=classRows();return head+`<section class="card" style="margin-top:18px"><div class="card-h"><div class="l"><h2>${L('Classes','Promos')}${hasSchool?' · '+esc(SCH[st.school.id].name):''}</h2>${LIVE?'':simPill()}</div></div>${rows.length?classList(rows):`<div class="empty"><b>${hasSchool?L('No class has played yet this week','Aucune promo n’a encore joué cette semaine'):L('Add your school and year to see class standings','Indique ton école et ton année pour voir les promos')}</b><button class="btn sm" type="button" data-act="go" data-a="campus">${L('Link a school','Lier une école')}</button></div>`}</section>`;}
  const B=BOARD(u.board);let body;
  if(u.loading)body=`<div class="lb" aria-busy="true">${'<div class="skel"></div>'.repeat(6)}</div>`;
  else if(u.scope==='class'&&hasSchool&&!st.school.year)body=`<div class="empty"><b>${L('Add your year of study','Indique ton année d’études')}</b>${L('Your class is everyone in your school and your year.','Ta promo, ce sont les joueurs de ton école et de ton année.')}<button class="btn sm primary" type="button" data-act="campusEdit">${L('Add my year','Indiquer mon année')}</button></div>`;
  else if(['class','school','city','country'].includes(u.scope)&&!hasSchool)body=`<div class="empty"><b>${L('This ranking needs a school','Ce classement nécessite une école')}</b>${L('Link your university to compare with classmates, your campus and your city.','Lie ton université pour te comparer à ta classe, ton campus et ta ville.')}<button class="btn sm primary" type="button" data-act="go" data-a="campus">${L('Link a school','Lier une école')}</button></div>`;
  else{const data=boardRows(u.board,u.scope),key=u.board+':'+u.scope;if(data.me){const prev=st.seen[key];data.me.mv=prev?prev-data.me.pos:0;S._seen=[key,data.me.pos];}body=podium(data.rows,B)+lbList(data,B,10,u.board==='weekly'||u.board==='monthly'?L('Play a match to earn points.','Joue un match pour gagner des points.'):L('Set a score to appear here.','Fais un score pour apparaître ici.'));}
  const scopeName=SCOPES.find(s=>s[0]===u.scope)[1]();
  const my=SCH[st.school.id];
  const sub=u.scope==='class'&&my?my.short+' · '+yearName(st.school.year):u.scope==='school'&&my?my.name:u.scope==='city'&&my?my.city:u.scope==='country'&&my?ctry(my):u.scope==='friends'?FRIENDS.length+' '+L('friends','amis'):L('All players','Tous les joueurs');
  return head+`
  <div class="chips scroll" role="tablist" aria-label="${L('Scope','Portée')}" style="margin-top:16px">${SCOPES.map(s=>`<button class="chip" type="button" role="tab" aria-selected="${u.scope===s[0]}" data-act="rscope" data-a="${s[0]}">${s[1]()}</button>`).join('')}</div>
  <section class="card" style="margin-top:12px">
    <div class="card-h"><div class="l"><h2>${scopeName} · ${esc(B.n)}</h2><span class="tiny">${esc(sub)}</span></div>
    <div class="field" style="width:auto"><label class="tiny" for="rBoard">${L('Leaderboard','Classement')}</label><select class="input" id="rBoard" data-ch="rboard" style="height:40px">${BOARD_IDS.map(k=>`<option value="${k}" ${u.board===k?'selected':''}>${esc(BOARD(k).n)}</option>`).join('')}</select></div></div>
    ${body}
    <p class="tiny">${u.board==='rating'?L('Rating only changes through 1v1 duels. ','La cote ne bouge qu’avec les duels 1v1. '):''}${B.lower?L('Lower is better. ','Plus bas = mieux. '):''}${L('Arrows show movement since your last visit (you) or since Monday (others).','Les flèches montrent l’évolution depuis ta dernière visite (toi) ou depuis lundi (les autres).')}</p>
  </section>`;
};

function schoolFilter(q){const n=normTxt(q);
  return SCHOOLS.filter(x=>!n||normTxt(x.name).includes(n)||normTxt(x.city).includes(n)||normTxt(x.short).includes(n))
    .sort((a,b)=>(n&&normTxt(b.short)===n)-(n&&normTxt(a.short)===n)||(b.members||0)-(a.members||0)||a.name.localeCompare(b.name)).slice(0,n?10:6);}
function schoolListHTML(list){
  const c=S.ui.campus,sel=c.pick||S.data.school.id,q=(c.q||'').trim(),n=normTxt(q);
  const exact=n&&SCHOOLS.some(x=>normTxt(x.name)===n);
  const add=q.length>=3&&!exact?`<li class="addrow" role="option" tabindex="0" aria-selected="false" data-act="campusAdd"><span class="crest" style="background:var(--ink)">+</span><span style="min-width:0"><b>${L('Add','Ajouter')} « ${esc(q)} »</b><span class="tiny" style="display:block">${L('Not in the list? Add your school, everyone will see it.','Pas dans la liste ? Ajoute ton école, tout le monde la verra.')}</span></span></li>`:'';
  if(!list.length)return `<li class="empty" style="cursor:default"><b>${q?L('No school found','Aucune école trouvée'):LIVE?L('No school yet','Aucune école pour l’instant'):L('No institution found','Aucun établissement trouvé')}</b>${q.length>=3?L('Check the spelling, or add it below.','Vérifie l’orthographe, ou ajoute-la ci-dessous.'):L('Type the name of your school or university.','Tape le nom de ton école ou université.')}</li>`+add;
  return list.map(x=>`<li role="option" tabindex="0" aria-selected="${sel===x.id}" data-act="campusPick" data-a="${x.id}"><span class="crest" style="background:${x.col}">${esc(x.short)}</span><span style="min-width:0"><b>${esc(x.name)}</b><span class="tiny" style="display:block">${esc(x.city)}, ${esc(ctry(x))} · ${LIVE?(x.members||0)+' '+plural(x.members||0,'player','players','joueur','joueurs'):x.custom?L('added by you','ajoutée par toi'):L('demo','démo')}</span></span></li>`).join('')+add;
}
function schoolPickerHTML(inSheet){
  const st=S.data,c=S.ui.campus,s=SCH[st.school.id],pick=SCH[c.pick||st.school.id],lock=LIVE&&NET.me&&NET.me.school_lock_until;
  const err=c.err&&!c.err.startsWith('v:')?`<div class="note err">${ic('info')}<span>${esc(c.err)}</span></div>`:'';
  let school;
  if(c.adding)school=`<div class="addbox stack">
      <b>${L('Add your school','Ajoute ton école')}</b>
      <div class="field"><label for="nsName">${L('Full name','Nom complet')}</label><input class="input" id="nsName" data-in="campusNew" data-k="nn" maxlength="80" value="${esc(c.nn)}" placeholder="${L('e.g. EM Normandie','ex. EM Normandie')}" autocomplete="off"><span class="help">${L('Write it as on the school’s website. Use capitals for initials (EM, HEC…).','Écris-le comme sur le site de l’école. Mets les sigles en majuscules (EM, HEC…).')}</span></div>
      <div class="row" style="align-items:flex-start">
        <div class="field" style="flex:1;min-width:140px"><label for="nsCity">${L('City (campus)','Ville (campus)')}</label><input class="input" id="nsCity" data-in="campusNew" data-k="nc" maxlength="60" value="${esc(c.nc)}" autocomplete="address-level2"></div>
        <div class="field" style="flex:1;min-width:120px"><label for="nsCountry">${L('Country','Pays')}</label><input class="input" id="nsCountry" data-in="campusNew" data-k="nco" maxlength="40" value="${esc(c.nco||'France')}" autocomplete="country-name"></div>
      </div>
      <div class="row"><button class="btn primary sm" type="button" data-act="campusAddConfirm">${L('Add this school','Ajouter cette école')}</button><button class="btn ghost sm" type="button" data-act="campusAddCancel">${L('Back to the list','Retour à la liste')}</button></div></div>`;
  else school=`${pick?`<div class="opp picked"><span class="crest" style="background:${pick.col}">${esc(pick.short)}</span><div style="min-width:0;flex:1"><b>${esc(pick.name)}</b><p class="tiny">${esc(pick.city)}, ${esc(ctry(pick))}</p></div><span class="pill now">${ic('check',14)}${L('Selected','Choisie')}</span></div>`:''}
    <div class="field"><label for="schoolQ">${pick?L('Pick another school','Choisir une autre école'):L('Your school or university','Ton école ou université')}</label><input class="input" id="schoolQ" data-in="schoolQ" value="${esc(c.q)}" placeholder="${L('Name, city or initials','Nom, ville ou sigle')}" autocomplete="off"></div>
    <ul class="schools" id="schoolList" role="listbox" aria-label="${L('Schools','Écoles')}">${pick&&!c.q?'':schoolListHTML(schoolFilter(c.q))}</ul>`;
  const year=`<div class="field"><label for="yearSel">${L('Your year of study','Ton année d’études')}</label><select class="input" id="yearSel" data-ch="campusYear"><option value="">${L('Choose…','Choisis…')}</option>${YEAR_IDS.map(y=>`<option value="${y}" ${(c.year||'')===y?'selected':''}>${esc(yearLong(y))}</option>`).join('')}</select><span class="help">${L('Your class (“promo”) is everyone in your school and your year.','Ta promo, ce sont les joueurs de ton école et de ton année.')}</span></div>`;
  const lockNote=lock&&s?`<p class="tiny">${L(`You can switch to another school from ${dateLabel(lock)}. Your year can be changed anytime.`,`Tu pourras changer d’école à partir du ${dateLabel(lock)}. L’année se modifie à tout moment.`)}</p>`:LIVE?`<p class="tiny">${L('You can correct your school for 24 hours, then it stays for 30 days.','Tu peux corriger ton école pendant 24 h, ensuite elle reste 30 jours.')}</p>`:'';
  const btns=inSheet?`<div class="row"><button class="btn primary" type="button" data-act="campusSave">${L('Save','Enregistrer')}</button><button class="btn ghost" type="button" data-act="campusLater">${L('Later','Plus tard')}</button></div>`
    :`<div class="row"><button class="btn primary" type="button" data-act="campusSave">${L('Save','Enregistrer')}</button>${s?`<button class="btn ghost" type="button" data-act="campusCancel">${L('Cancel','Annuler')}</button><button class="btn ghost" type="button" data-act="campusRemove">${L('Leave this school','Quitter cette école')}</button>`:''}</div>`;
  return `<div class="stack">${school}${year}${err}${c.adding?'':btns}${lockNote}</div>`;
}
function campusSheetHTML(){
  return `<div class="modal-h"><div><h2>${L('Your school and year','Ton école et ton année')}</h2><p>${L('Play for your school in the School Cup and compare yourself with your class.','Joue pour ton école dans la Coupe des écoles et compare-toi à ta promo.')}</p></div><button class="iconbtn" type="button" data-act="campusLater" aria-label="${L('Close','Fermer')}">${ic('x')}</button></div>${schoolPickerHTML(true)}`;
}
VIEWS.campus=()=>{
  const st=S.data,c=S.ui.campus,s=SCH[st.school.id];
  const status=st.school.status==='verified'?`<span class="pill now">${L('Verified','Vérifié')}</span>`:st.school.status==='pending'?`<span class="pill warn">${LIVE?L('Badge pending','Badge en attente'):L('Pending · demo','En attente · démo')}</span>`:s&&!LIVE?`<span class="pill">${L('Unverified','Non vérifié')}</span>`:'';
  let assoc;
  const sheetOpen=S.ui.sheet&&S.ui.sheet.type==='campus';
  if(sheetOpen)assoc=`<p class="tiny">${L('Editing in the window above.','Modification en cours dans la fenêtre.')}</p>`;
  else if(c.edit||!s||!st.school.year&&LIVE){
    if(!c.edit)Object.assign(c,{pick:c.pick||st.school.id||null,year:c.year||st.school.year||null});
    assoc=schoolPickerHTML(false);
  }else{
    assoc=`<div class="opp"><span class="crest" style="background:${s.col}">${esc(s.short)}</span><div style="min-width:0;flex:1"><b>${esc(s.name)}</b><p class="tiny">${st.school.year?esc(yearLong(st.school.year)):L('Year not set','Année non renseignée')} · ${esc(s.city)}, ${esc(ctry(s))}</p></div></div>
    <button class="btn sm" type="button" data-act="campusEdit">${L('Change school or year','Changer d’école ou d’année')}</button>`;
  }
  const verify=s?(LIVE&&!s.domain&&st.school.status!=='verified'?`<div class="note">${ic('info')}<span>${L('The verified badge is optional: your points already count for your school. It becomes available once the RYVO team has added your school’s email domain.','Le badge « vérifié » est facultatif : tes points comptent déjà pour ton école. Il sera disponible quand l’équipe RYVO aura ajouté le domaine e-mail de ton école.')}</span></div>`:st.school.status==='verified'?`<div class="note" style="border-color:var(--good);background:var(--good-soft)">${ic('check')}<span>${L('Your enrollment is verified. Your School Cup points count for','Ton inscription est vérifiée. Tes points de Coupe comptent pour')} ${esc(s.short)}.</span></div>`:st.school.status==='pending'&&LIVE?livePendingHTML(s):st.school.status==='pending'?`
    <ol class="steps">
      <li><div><b>${L('Institutional address entered','Adresse institutionnelle saisie')}</b><small>…@${esc(st.school.domain||s.domain)} ${L('matches','correspond à')} ${esc(s.short)}.</small></div><span class="pill now">${L('Done','Fait')}</span></li>
      <li><div><b>${L('Inbox check','Vérification de la boîte mail')}</b><small>${L('In production we email a single-use 6-digit code. This demo has no mail server, so no code was sent.','En production, on envoie un code unique à 6 chiffres. Cette démo n’a pas de serveur mail : aucun code n’a été envoyé.')}</small></div><span class="pill warn">${L('Not sent','Non envoyé')}</span></li>
      <li><div><b>${L('Enrollment check','Vérification d’inscription')}</b><small>${L('An inbox alone doesn’t prove enrollment (alumni and staff keep addresses). Production uses the university’s SSO or a roster match.','Une adresse seule ne prouve pas l’inscription (anciens et personnels la gardent). En production : SSO de l’université ou liste fournie par l’école.')}</small></div><span class="pill future">${L('Needs partner','Partenaire requis')}</span></li>
      <li><div><b>${L('Verified badge','Badge vérifié')}</b><small>${L('Unlocks counted Cup points. Re-checked each academic year.','Débloque les points de Coupe. Revérifié chaque année.')}</small></div><span class="pill">${L('Locked','Verrouillé')}</span></li>
    </ol><button class="btn sm ghost" type="button" data-act="verifyReset">${L('Start over','Recommencer')}</button>`
   :`<form data-form="verify" class="stack" novalidate>
      <div class="field"><label for="vEmail">${L('Institutional email','E-mail institutionnel')}</label><input class="input" id="vEmail" name="email" type="email" inputmode="email" autocomplete="off" placeholder="name@${s.domain}"><span class="help">${LIVE?L(`Use your school address ending in @${s.domain}. A RYVO team member reviews the request.`,`Utilise ton adresse de l’école en @${s.domain}. Un membre de l’équipe RYVO valide la demande.`):L(`Demo institutions use addresses ending in @${s.domain}. Only the domain is kept on this device.`,`Les écoles démo utilisent des adresses en @${s.domain}. Seul le domaine est gardé sur cet appareil.`)}</span></div>
      ${c.err&&c.err.startsWith('v:')?`<p class="err" style="color:var(--bad);font-size:13px;font-weight:600">${esc(c.err.slice(2))}</p>`:''}
      <button class="btn" type="submit">${L('Start verification','Lancer la vérification')}</button></form>`)
    :`<div class="empty"><b>${L('Link a school first','Lie d’abord une école')}</b>${L('Verification starts once you’ve picked your institution.','La vérification commence une fois ton établissement choisi.')}</div>`;
  const unis=uniRows(),mine=unis.find(u=>u.mine);
  return `<div class="page-h"><div><p class="eyebrow">Campus</p><h1>${L('Play for your school','Joue pour ton école')}</h1><p>${L('Every School Cup run adds points to your school and your class. Standings reset every Monday.','Chaque partie de Coupe rapporte des points à ton école et à ta promo. Remise à zéro chaque lundi.')}</p></div>${LIVE?'':simPill(L('Fictional institutions','Établissements fictifs'))}</div>
  <div class="grid">
    <section class="card c7"><div class="card-h"><h2>${L('School Cup standings','Classement de la Coupe')}</h2><span class="tiny">${L('Week of','Semaine du')} ${dateLabel(weekStart())}</span></div>${unis.length?uniList(unis):`<div class="empty"><b>${L('No school has played yet this week','Aucune école n’a encore joué cette semaine')}</b>${L('Be the first to score for yours.','Sois le premier à marquer pour la tienne.')}</div>`}</section>
    <section class="card pop c5"><div class="card-h"><h2>${L('Your contribution','Ta contribution')}</h2></div>
      ${s?`<div class="kpis" style="grid-template-columns:1fr 1fr"><div class="kpi"><small>${s.short} ${L('position','position')}</small><b>${mine?'#'+mine.pos:'–'}</b></div><div class="kpi"><small>${L('Your Cup points','Tes points')}</small><b>${fmt(st.schoolPts)}</b></div></div>
      <p class="tiny">${st.stats.schoolRuns} ${plural(st.stats.schoolRuns,'School Cup run','School Cup runs','partie de Coupe','parties de Coupe')}. ${LIVE?L('Your points count right away for your school.','Tes points comptent tout de suite pour ton école.'):L('Points stay “pending” until enrollment is verified.','Les points restent « en attente » jusqu’à la vérification.')}</p>
      <button class="btn hot" type="button" data-act="schoolRun">${L('Play a School Cup run','Jouer pour mon école')}</button>
      <button class="btn" type="button" data-act="classmate">${ic('swords',16)}${L('Challenge a classmate','Défier un camarade')}</button>`
      :`<div class="empty"><b>${L('No school linked','Aucune école liée')}</b>${L('Pick or add your school below.','Choisis ou ajoute ton école ci-dessous.')}</div>`}
    </section>
    <section class="card c6"><div class="card-h"><h2>${L('Your school and year','Ton école et ton année')}</h2>${status}</div>${assoc}</section>
    <section class="card c6"><div class="card-h"><h2>${LIVE?L('Verified badge','Badge vérifié'):L('Verification','Vérification')}</h2>${LIVE?`<span class="pill">${L('Optional','Facultatif')}</span>`:simPill(L('Proposed flow','Parcours proposé'))}</div>${verify}</section>
    <section class="card c12"><div class="card-h"><h2>${L('Classes at','Promos de')} ${s?esc(s.name):L('your school','ton école')}</h2>${LIVE?'':simPill()}</div>${(()=>{const cr=s?classRows().slice(0,6):[];return cr.length?classList(cr):`<div class="empty"><b>${s?L('No class has played yet this week','Aucune promo n’a encore joué cette semaine'):L('No class standings yet','Pas encore de classement')}</b></div>`;})()}</section>
  </div>`;
};

VIEWS.social=()=>{
  const st=S.data,friends=FRIENDS.map(id=>DEMO_BY[id]),duels=st.history.filter(h=>h.m==='duel').slice(0,8);
  return `<div class="page-h"><div><p class="eyebrow">Social</p><h1>${L('Friends and rivals','Amis et rivaux')}</h1><p>${L('Challenge classmates, answer invitations and track your duels. Presence and invitations are simulated until real-time servers exist.','Défie tes camarades, réponds aux invitations et suis tes duels. Présence et invitations sont simulées en attendant des serveurs temps réel.')}</p></div>
    <button class="btn primary" type="button" data-act="classmate">${ic('swords',16)}${L('Challenge a classmate','Défier un camarade')}</button></div>
  <div class="grid">
    <section class="card pop c6"><div class="card-h"><div class="l"><h2>${L('Invitations','Invitations')}</h2>${simPill()}</div></div>
      ${st.invites.length?`<ul class="hist">${st.invites.map(i=>{const p=DEMO_BY[i.from],G=GAME[i.game];return `<li style="--g:${G.col}">${avP(p,36)}<span class="t"><b>${esc(p.name)} ${L('challenged you','te défie')}</b><small>${G.name} · ${ago(i.t)}</small></span><span class="row" style="flex-wrap:nowrap"><button class="btn sm primary" type="button" data-act="invAccept" data-a="${i.id}">${L('Play','Jouer')}</button><button class="btn sm ghost" type="button" data-act="invDecline" data-a="${i.id}" aria-label="${L('Decline','Refuser')}">${ic('x',14)}</button></span></li>`;}).join('')}</ul>`
      :`<div class="empty"><b>${L('No open invitations','Aucune invitation')}</b>${L('When someone challenges you, it shows up here.','Quand quelqu’un te défie, ça apparaît ici.')}</div>`}
    </section>
    <section class="card c6"><div class="card-h"><div class="l"><h2>${L('Friends','Amis')}</h2><span class="tiny">${friends.filter(online).length} ${L('online','en ligne')}</span></div>${simPill(L('Simulated presence','Présence simulée'))}</div>
      <ul class="hist">${friends.map(p=>`<li>${avP(p,36)}<span class="t"><b class="row" style="gap:8px;flex-wrap:nowrap"><span class="presence${online(p)?' on':''}" aria-label="${online(p)?L('online','en ligne'):L('offline','hors ligne')}"></span>${esc(p.name)}</b><small>${esc(SCH[p.school].short)} · ${p.rating} SR</small></span><button class="btn sm" type="button" data-act="challenge" data-a="${p.id}">${L('Challenge','Défier')}</button></li>`).join('')}</ul>
    </section>
    <section class="card c6"><div class="card-h"><h2>${L('Match history','Historique des matchs')}</h2><span class="tiny">${L('Duels','Duels')}</span></div>
      ${duels.length?`<ul class="hist">${duels.map(histItem).join('')}</ul>`:`<div class="empty"><b>${L('No duels yet','Aucun duel')}</b>${L('Win a duel to start climbing the rating ladder.','Gagne un duel pour grimper au classement.')}</div>`}
    </section>
    <section class="card c6"><div class="card-h"><h2>${L('Notifications','Notifications')}</h2><button class="btn sm ghost" type="button" data-act="readall">${L('Mark all read','Tout marquer comme lu')}</button></div>
      <ul class="ntf">${st.notifs.slice(0,10).map(n=>`<li class="${n.read?'':'unread'}"><div>${esc(ntext(n))}<small>${ago(n.t)}</small></div></li>`).join('')}</ul>
    </section>
  </div>`;
};

VIEWS.profile=()=>{
  const st=S.data,lv=levelInfo(st.xp),s=SCH[st.school.id],H=st.history,dw=st.stats.duelWins,dl=st.stats.duelLosses;
  return `<div class="page-h"><div class="row" style="gap:18px;flex-wrap:nowrap">${avMe(84)}<div style="min-width:0"><p class="eyebrow">${st.account.signedIn?L('Demo account','Compte démo'):L('Guest profile','Profil invité')}</p><h1 style="overflow-wrap:anywhere">${esc(st.account.username)}</h1><p class="tiny" style="margin-top:6px">${L('Level','Niveau')} ${lv.L} · ${leagueBadge(st.rating)} ${st.rating} SR · ${s?esc(s.name)+' · '+esc(prog(st.school.program)):L('No school linked','Aucune école liée')}</p></div></div>
    <div class="row">${st.account.signedIn?`<button class="btn sm" type="button" data-act="signout">${L('Sign out','Se déconnecter')}</button>`:`<button class="btn sm primary" type="button" data-act="auth" data-a="signup">${L('Create demo account','Créer un compte démo')}</button><button class="btn sm" type="button" data-act="auth" data-a="login">${L('Sign in','Connexion')}</button>`}</div></div>
  ${STORAGE_OK?'':`<div class="note err" style="margin-bottom:16px">${ic('info')}<span>${L('This browser blocks storage, so progress resets when you close the page.','Ce navigateur bloque le stockage : ta progression sera perdue à la fermeture.')}</span></div>`}
  <div class="grid">
    <section class="card c12"><div class="kpis">
      <div class="kpi"><small>${L('Matches','Matchs')}</small><b>${H.length}</b></div>
      <div class="kpi"><small>${L('Duels W–L','Duels V–D')}</small><b>${dw}–${dl}</b></div>
      <div class="kpi"><small>${L('Duel win rate','Taux de victoire')}</small><b>${dw+dl?Math.round(dw/(dw+dl)*100)+' %':'—'}</b></div>
      <div class="kpi"><small>${L('Total XP','XP totale')}</small><b>${fmt(st.xp)}</b></div>
      <div class="kpi"><small>${L('Streak','Série')}</small><b>${st.streak} ${L('d','j')}</b></div>
      <div class="kpi"><small>${L('Season 3 · ends 20 Dec','Saison 3 · fin le 20 déc.')}</small><b>${league(st.rating).n()}</b></div>
    </div></section>
    <section class="card c5"><div class="card-h"><h2>${L('Personal records','Records personnels')}</h2></div>
      <ul class="hist">${SKS.map(sk=>{const g=GAME[gameOf(sk)];return `<li style="--g:${g.col}"><span class="gico">${ic(g.icon,18)}</span><span class="t"><b>${esc(skName(sk))}</b><small>${H.filter(h=>(h.sk||h.g)===sk).length} ${L('runs','parties')}</small></span><span class="r">${fmtScore(sk,st.bests[sk])}</span></li>`;}).join('')}</ul>
    </section>
    <section class="card c7"><div class="card-h"><h2>${L('Game history','Historique')}</h2><span class="tiny">${Math.min(12,H.length)}</span></div>
      ${H.length?`<ul class="hist">${H.slice(0,12).map(histItem).join('')}</ul>`:`<div class="empty"><b>${L('No games played','Aucune partie')}</b>${L('Finish a match and it will be logged here.','Termine un match pour le voir ici.')}</div>`}
    </section>
    <section class="card c12"><div class="card-h"><h2>${L('Achievements','Succès')}</h2><span class="tiny">${st.ach.length}/${ACH.length}</span></div>
      <div class="achs">${ACH.map(a=>achBadge(a,st.ach.includes(a.id))).join('')}</div></section>
    <section class="card c6"><div class="card-h"><h2>${L('Look','Apparence')}</h2><span class="tiny">${L('Cosmetic only. Never affects scoring.','Purement esthétique. N’influence jamais le score.')}</span></div>
      <h3>Avatar</h3><div class="choice">${AV_PRESETS.map((a,i)=>{const own=!a.premium||ownsItem('avatar',i),it=itemOf('avatar',i);if(a.premium&&!own&&!it)return '';return `<button type="button" data-act="${own?'avatar':'shopGo'}" data-a="${own?i:'avatar'}" aria-pressed="${st.account.avatar===i}">${face(a,38)}${own?(a.premium?L('Yours','À toi'):L('Free','Gratuit')):`<span class="mono" style="font-size:9.5px">${ic('gem',11)} ${it.price}</span>`}</button>`;}).join('')}</div>
      <h3>${L('Profile frame','Cadre de profil')}</h3><div class="choice">${FRAMES.map(f=>{const it=f.premium?itemOf('frame',f.id):null,own=f.premium&&ownsItem('frame',f.id),ok=f.premium?own:lv.L>=f.lv;if(f.premium&&!own&&!it)return '';return `<button type="button" data-act="${f.premium&&!own?'shopGo':'frame'}" data-a="${f.premium&&!own?'frame':f.id}" aria-pressed="${st.account.frame===f.id}" ${ok||f.premium?'':'disabled'}>${avP(me(),34,f.id)}${f.n()}<span class="mono" style="font-size:9.5px">${f.premium?(own?L('Yours','À toi'):`${ic('gem',11)} ${it.price}`):ok?L('Owned','Débloqué'):L('Lv','Niv.')+' '+f.lv}</span></button>`;}).join('')}</div>
      <h3>${L('Theme colour','Couleur du thème')}</h3><div class="choice">${SKINS.map(k=>{const it=k.premium?itemOf('skin',k.id):null,own=k.premium&&ownsItem('skin',k.id),ok=k.premium?own:lv.L>=k.lv;if(k.premium&&!own&&!it)return '';return `<button type="button" data-act="${k.premium&&!own?'shopGo':'skin'}" data-a="${k.premium&&!own?'skin':k.id}" aria-pressed="${st.account.skin===k.id}" ${ok||k.premium?'':'disabled'}><span style="width:34px;height:34px;border-radius:11px;background:${k.c};border:2px solid ${INK}"></span>${k.n()}<span class="mono" style="font-size:9.5px">${k.premium?(own?L('Yours','À toi'):`${ic('gem',11)} ${it.price}`):ok?L('Owned','Débloqué'):L('Lv','Niv.')+' '+k.lv}</span></button>`;}).join('')}</div>
      <p class="tiny">${L('More avatars, frames and themes in the Shop.','D’autres avatars, cadres et thèmes dans la Boutique.')} <button class="btn sm ghost" type="button" data-act="go" data-a="shop">${ic('gem',14)}${L('Shop','Boutique')}</button></p>
    </section>
    ${LIVE?accountCardLive():`<section class="card c6"><div class="card-h"><h2>${L('Account and data','Compte et données')}</h2>${simPill(L('Local demo','Démo locale'))}</div>
      <div class="note">${ic('info')}<span>${L('No real account exists. Your username, cosmetics and scores live in this browser only. Passwords and emails are never stored.','Aucun vrai compte n’existe. Ton pseudo, tes cosmétiques et tes scores restent dans ce navigateur. Mots de passe et e-mails ne sont jamais enregistrés.')}</span></div>
      <dl class="cmp"><dt>${L('Status','Statut')}</dt><dd>${st.account.signedIn?L('Demo account','Compte démo'):L('Guest','Invité')}</dd><dt>${L('Region','Région')}</dt><dd>${s?esc(s.city+', '+ctry(s)):L('Not set','Non défini')}</dd><dt>${L('Language','Langue')}</dt><dd>${LANG==='fr'?'Français':'English'}</dd><dt>${L('Sound','Son')}</dt><dd>${st.sound?L('On','Activé'):L('Off','Coupé')}</dd></dl>
      <div class="row"><button class="btn sm" type="button" data-act="export">${L('Export my data','Exporter mes données')}</button><button class="btn sm ghost" type="button" data-act="reset" style="color:var(--bad)">${L('Delete local data','Supprimer les données')}</button></div>
    </section>`}
  </div>`;
};

/* ========================= boutique ========================= */
function adState(){
  const C=shopCfg(),st=S.data;
  if(LIVE){const on=!!(CFG.ads&&CFG.ads.client),m=NET.me||{},used=m.ads_today||0,last=m.ad_last||0;
    return {on,left:Math.max(0,C.ad_per_day-used),wait:Math.max(0,Math.ceil((last+C.ad_gap_s*1000-Date.now())/1000))};}
  const d=dayKey(),a=st.ads||{},used=a.day===d?a.n:0;
  return {on:true,sim:true,left:Math.max(0,C.ad_per_day-used),wait:Math.max(0,Math.ceil(((a.last||0)+C.ad_gap_s*1000-Date.now())/1000))};
}
const payReady=()=>!LIVE||!!(CFG.payments&&CFG.seller);
function itemPreview(it,size=56){
  if(it.kind==='avatar')return `<span class="avw">${face(AV_PRESETS[+it.ref]||AV_PRESETS[0],size)}</span>`;
  if(it.kind==='frame')return avP(me(),size-8,it.ref);
  const k=SKINS.find(x=>x.id===it.ref)||{c:'#ccc'};return `<span class="sw" style="background:${k.c}"><i></i><i style="background:var(--sun);flex:.6"></i></span>`;
}
const isEquipped=it=>{const a=S.data.account;return it.kind==='avatar'?a.avatar===+it.ref:it.kind==='frame'?a.frame===it.ref:a.skin===it.ref;};
VIEWS.shop=()=>{
  const st=S.data,C=shopCfg(),signed=!LIVE||!!NET.user,tab=S.ui.shop.tab,ad=adState();
  const rate=C.packs.length?Math.min(...C.packs.map(p=>p.cents/p.gems)):0,base=C.packs.length?Math.max(...C.packs.map(p=>p.cents/p.gems)):0;
  const packs=C.packs.map((p,i)=>{const bonus=base?Math.round((base/(p.cents/p.gems)-1)*100):0;
    return `<div class="pack">${bonus>=5?`<span class="sticker${i===C.packs.length-1?' pink':''} bonus">+${bonus} %</span>`:''}<span class="g">${ic('gem',24)}${fmt(p.gems)}</span><span class="tiny">${L('gems','gemmes')}</span>
      <button class="btn ${i===1?'hot':'primary'}" type="button" data-act="packBuy" data-a="${p.id}" ${payReady()?'':'disabled'}>${eur(p.cents)}</button></div>`;}).join('');
  const items=C.items.filter(i=>i.kind===tab);
  const card=it=>{const own=ownsItem(it.kind,it.ref),eq=own&&isEquipped(it);
    return `<div class="sitem${own?' own':''}"><span class="prev">${itemPreview(it)}</span><b>${esc(L(it.en,it.fr))}</b>
      ${own?(eq?`<span class="pill now">${ic('check',13)}${L('Equipped','Équipé')}</span>`:`<button class="btn sm" type="button" data-act="equip" data-a="${it.id}">${L('Equip','Équiper')}</button>`)
        :`<button class="btn sm primary" type="button" data-act="itemBuy" data-a="${it.id}">${ic('gem',14)}${fmt(it.price)}</button>`}</div>`;};
  return `<div class="page-h"><div><p class="eyebrow">${L('Shop','Boutique')}</p><h1>${L('Stand out. Never pay to win.','Démarque-toi. Sans jamais payer pour gagner.')}</h1>
    <p>${L('Avatars, frames and themes that everyone sees in the rankings. Nothing here changes a score, a timer or a rating.','Des avatars, cadres et thèmes que tout le monde voit dans les classements. Rien ici ne change un score, un chrono ou une cote.')}</p></div>
    ${signed?`<div class="kpi" style="min-width:150px"><small>${L('Your gems','Tes gemmes')}</small><b class="row" style="gap:6px;flex-wrap:nowrap">${ic('gem',20)}${fmt(st.gems||0)}</b></div>`:''}</div>
  ${LIVE&&!NET.user?`<div class="note" style="margin-bottom:16px">${ic('info')}<span>${L('Sign in to buy and keep your items on every device.','Connecte-toi pour acheter et retrouver tes objets sur tous tes appareils.')}</span><button class="btn sm primary" type="button" data-act="auth" data-a="signup">${L('Create an account','Créer un compte')}</button></div>`:''}
  <div class="grid">
    <section class="card c12"><div class="card-h"><h2>${L('Cosmetics','Cosmétiques')}</h2>${!LIVE?simPill(L('Demo · nothing is charged','Démo · rien n’est facturé')):''}</div>
      <div class="seg" role="tablist" aria-label="${L('Category','Catégorie')}" style="margin-bottom:14px">${[['avatar',L('Avatars','Avatars')],['frame',L('Frames','Cadres')],['skin',L('Themes','Thèmes')]].map(x=>`<button type="button" role="tab" aria-selected="${tab===x[0]}" data-act="shopTab" data-a="${x[0]}">${x[1]}</button>`).join('')}</div>
      ${items.length?`<div class="shop-grid">${items.map(card).join('')}</div>`:`<div class="empty"><b>${L('Nothing on sale here right now','Rien en vente ici pour le moment')}</b></div>`}</section>
    <section class="card c8" id="packs"><div class="card-h"><h2>${L('Gems','Gemmes')}</h2>${payReady()?`<span class="tiny">${L('Card payment by Stripe','Paiement par carte via Stripe')}</span>`:`<span class="pill">${L('Card payment coming soon','Paiement par carte bientôt')}</span>`}</div>
      <div class="packs">${packs}</div>
      <p class="tiny" style="margin-top:12px">${L('Prices include VAT. RYVO never sees your card. Gems are only used for cosmetics, can’t be exchanged for money and give no in-game advantage. Under 18: ask a parent before buying.','Prix TTC. RYVO ne voit jamais ta carte. Les gemmes servent uniquement aux cosmétiques, ne s’échangent pas contre de l’argent et ne donnent aucun avantage en jeu. Moins de 18 ans : demande l’accord d’un parent avant d’acheter.')}
      <button class="btn sm ghost" type="button" data-act="cgv">${L('Terms of sale','Conditions de vente')}</button></p></section>
    <section class="card c4"><div class="card-h"><h2>${L('Free gems','Gemmes gratuites')}</h2>${ad.sim?simPill():''}</div>
      ${ad.on?`<p class="tiny">${L(`Watch a short ad and get ${C.ad_gems} gems. Up to ${C.ad_per_day} a day.`,`Regarde une courte pub et gagne ${C.ad_gems} gemmes. Jusqu’à ${C.ad_per_day} par jour.`)}</p>
        <button class="btn" type="button" data-act="watchAd" ${signed&&ad.left&&!ad.wait?'':'disabled'}>${ic('tv',16)}${!signed?L('Sign in first','Connecte-toi d’abord'):!ad.left?L('Come back tomorrow','Reviens demain'):ad.wait?L(`Next in ${ad.wait} s`,`Prochaine dans ${ad.wait} s`):L(`Watch · +${C.ad_gems}`,`Regarder · +${C.ad_gems}`)}</button>
        <p class="tiny">${ad.left} ${plural(ad.left,'left today','left today','restante aujourd’hui','restantes aujourd’hui')}. ${L('Ads only appear when you ask, never during a game.','Les pubs n’apparaissent que si tu le demandes, jamais pendant une partie.')}</p>`
      :`<p class="tiny">${L('Coming soon: watch a short ad to earn gems. Ads will only play when you ask, never during a game.','Bientôt : regarde une courte pub pour gagner des gemmes. Les pubs ne passeront que si tu le demandes, jamais pendant une partie.')}</p>`}
      <p class="tiny">${L('Leagues: owners can upgrade to League+ with gems.','Ligues : le créateur peut passer en Ligue+ avec des gemmes.')} <button class="btn sm ghost" type="button" data-act="go" data-a="leagues">${ic('flag',14)}${L('Leagues','Ligues')}</button></p></section>
  </div>`;
};
function shopSheetHTML(sh,closeBtn){
  const st=S.data,C=shopCfg();
  if(sh.type==='itemBuy'){
    const it=C.items.find(i=>i.id===sh.id);if(!it)return closeBtn;const miss=it.price-(st.gems||0);
    return `<div class="modal-h"><div><h2>${esc(L(it.en,it.fr))}</h2><p>${it.kind==='avatar'?'Avatar':it.kind==='frame'?L('Profile frame','Cadre de profil'):L('Theme colour','Couleur du thème')} · ${L('cosmetic only','purement esthétique')}</p></div>${closeBtn}</div>
      <div class="row" style="justify-content:center;padding:8px 0 4px">${itemPreview(it,80)}</div>
      <dl class="cmp"><dt>${L('Price','Prix')}</dt><dd>${gemTxt(it.price)}</dd><dt>${L('Your balance','Ton solde')}</dt><dd>${gemTxt(st.gems||0)}</dd></dl>
      ${miss>0?`<div class="note">${ic('info')}<span>${L(`You need ${gemTxt(miss)} more.`,`Il te manque ${gemTxt(miss)}.`)}</span></div><button class="btn primary" type="button" data-act="toPacks">${L('Get gems','Obtenir des gemmes')}</button>`
        :`<button class="btn primary" type="button" data-act="itemBuyYes" data-a="${it.id}">${L(`Buy for ${gemTxt(it.price)}`,`Acheter pour ${gemTxt(it.price)}`)}</button><p class="tiny">${L('Equipped right away. Yours for good.','Équipé tout de suite. À toi pour de bon.')}</p>`}`;
  }
  if(sh.type==='packBuy'){
    const p=C.packs.find(x=>x.id===sh.id);if(!p)return closeBtn;
    if(LIVE&&!NET.user)return `<div class="modal-h"><div><h2>${gemTxt(p.gems)} · ${eur(p.cents)}</h2></div>${closeBtn}</div><p>${L('Sign in to buy gems: they are saved on your account.','Connecte-toi pour acheter des gemmes : elles sont enregistrées sur ton compte.')}</p><button class="btn primary" type="button" data-act="auth" data-a="signup">${L('Create an account','Créer un compte')}</button>`;
    return `<div class="modal-h"><div><h2>${gemTxt(p.gems)} · ${eur(p.cents)}</h2><p>${LIVE?L('You’ll pay on Stripe’s secure page, then come back here.','Tu paies sur la page sécurisée de Stripe, puis tu reviens ici.'):L('Demo: nothing is charged, gems are simulated.','Démo : rien n’est facturé, les gemmes sont simulées.')}</p></div>${closeBtn}</div>
      <label class="tiny" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="waiver" style="margin-top:3px"><span>${L('I want the gems delivered immediately and I waive my 14-day right of withdrawal.','Je veux recevoir les gemmes tout de suite et je renonce à mon droit de rétractation de 14 jours.')}</span></label>
      ${sh.err?`<p class="err" style="color:var(--bad);font-size:13px;font-weight:600">${esc(sh.err)}</p>`:''}
      <button class="btn hot" type="button" data-act="packPay" data-a="${p.id}" ${sh.busy?'disabled':''}>${sh.busy?L('Opening payment…','Ouverture du paiement…'):L(`Pay ${eur(p.cents)}`,`Payer ${eur(p.cents)}`)}</button>
      <p class="tiny">${L('By paying you accept the','En payant, tu acceptes les')} <button class="btn sm ghost" type="button" data-act="cgv" style="padding:0 4px">${L('terms of sale','conditions de vente')}</button>.</p>`;
  }
  if(sh.type==='cgv'){
    const seller=CFG.seller||L('[to complete: name, legal status, SIRET, address]','[à compléter : nom, statut, SIRET, adresse]'),mail=CFG.contact||'—';
    const li=a=>a.map(([t,d])=>`<li style="margin:0 0 8px"><b>${t}</b> ${d}</li>`).join('');
    return `<div class="modal-h"><div><h2>${L('Terms of sale','Conditions de vente')}</h2><p>${L('Gems and cosmetics in RYVO.','Gemmes et cosmétiques RYVO.')}</p></div>${closeBtn}</div>
      <ol class="tiny" style="padding-left:18px;max-height:52vh;overflow:auto">${li([
        [L('Seller.','Vendeur.'),esc(seller)+' · '+esc(mail)],
        [L('What you buy.','Ce que tu achètes.'),L('Gems: a virtual currency usable only in RYVO to unlock cosmetic items (avatars, frames, themes) or League+. They give no in-game advantage, cannot be exchanged for money, resold or transferred.','Des gemmes : une monnaie virtuelle utilisable uniquement dans RYVO pour débloquer des objets esthétiques (avatars, cadres, thèmes) ou une Ligue+. Elles ne donnent aucun avantage en jeu et ne peuvent être ni échangées contre de l’argent, ni revendues, ni transférées.')],
        [L('Prices.','Prix.'),L('In euros, VAT included, shown before payment. Card payment handled by Stripe; RYVO never receives your card details.','En euros TTC, affichés avant le paiement. Paiement par carte géré par Stripe ; RYVO ne reçoit jamais tes données de carte.')],
        [L('Delivery.','Livraison.'),L('Immediately after payment is confirmed, usually within seconds, on the account used to buy.','Immédiatement après la confirmation du paiement, en général en quelques secondes, sur le compte qui a acheté.')],
        [L('Withdrawal.','Rétractation.'),L('Because delivery is immediate at your express request, you waive your right of withdrawal (French Consumer Code, art. L221-28 13°).','La livraison étant immédiate à ta demande expresse, tu renonces à ton droit de rétractation (Code de la consommation, art. L221-28 13°).')],
        [L('Minors.','Mineurs.'),L('If you are under 18, you need a parent’s permission to buy.','Si tu as moins de 18 ans, il te faut l’accord d’un parent pour acheter.')],
        [L('Problems.','Problème.'),L('Gems not received or a charge you don’t recognise: write to the contact address with the payment date.','Gemmes non reçues ou paiement inconnu : écris à l’adresse de contact avec la date du paiement.')],
        [L('Account.','Compte.'),L('Unused gems and items are lost if you delete your account or if it is banned for cheating.','Les gemmes et objets non utilisés sont perdus si tu supprimes ton compte ou s’il est banni pour triche.')]])}</ol>`;
  }
  return closeBtn;
}
/* ========================= ligues (version démo) ========================= */
VIEWS.leagues=()=>`<div class="page-h"><div><p class="eyebrow">${L('Leagues','Ligues')}</p><h1>${L('Your own league','Ta propre ligue')}</h1><p>${L('Create a league for your group: friends, class, club. Rankings use your real runs.','Crée une ligue pour ton groupe : amis, promo, asso, club. Le classement se fait sur vos vraies parties.')}</p></div></div>
  <div class="empty"><b>${L('Leagues need the online version','Les ligues demandent la version en ligne')}</b>${L('Everyone in a league must have an account so the server can check the scores.','Chaque membre doit avoir un compte pour que le serveur vérifie les scores.')}</div>`;

VIEWS.tech=()=>{
  const li=(a,i)=>a.map(x=>`<li>${ic(i,16)}<span>${x}</span></li>`).join('');
  return `
  <div class="page-h"><div><p class="eyebrow">${L('Build notes','Notes techniques')}</p><h1>${L('What’s real in this prototype','Ce qui est réel dans ce prototype')}</h1><p>${L('A frontend-only build: everything runs in your browser. Nothing talks to a server, and the app never claims otherwise.','Une version sans serveur : tout tourne dans ton navigateur. Rien ne communique avec un serveur, et l’app ne prétend jamais le contraire.')}</p></div></div>
  <div class="grid">
    <section class="card pop c4"><div class="card-h"><h2>${L('Works now','Fonctionne')}</h2><span class="pill now">${L('Real','Réel')}</span></div><ul class="list">${li([L('8 playable games with their own scoring','8 jeux jouables avec leur propre score'),L('3 Neon Sprint tracks with ghost replays','3 circuits Neon Sprint avec fantômes'),L('Synthesised sound, particles, combos, screen shake','Son synthétisé, particules, combos, secousses'),L('XP, levels, streaks, missions, achievements','XP, niveaux, séries, missions, succès'),L('Duel rating (Elo) and live leaderboards','Cote de duel (Elo) et classements à jour'),L('French and English everywhere','Français et anglais partout'),L('Local saving, export and deletion','Sauvegarde locale, export et suppression')],'check')}</ul></section>
    <section class="card c4"><div class="card-h"><h2>${L('Simulated','Simulé')}</h2>${simPill()}</div><ul class="list">${li([L('84 demo players and their scores','84 joueurs démo et leurs scores'),L('8 fictional universities','8 universités fictives'),L('Duel rivals (they play from stored stats)','Rivaux de duel (jouent selon leurs stats)'),L('Friends’ presence, invitations, live feed','Présence, invitations, flux en direct'),L('Sign-up, sign-in, reset and school verification screens','Écrans d’inscription, connexion, réinitialisation et vérification'),L('Institution dashboard figures','Chiffres du tableau de bord établissement')],'info')}</ul></section>
    <section class="card c4"><div class="card-h"><h2>${L('Needs a backend','Nécessite un serveur')}</h2><span class="pill future">${L('Next','Ensuite')}</span></div><ul class="list">${li([L('Secure authentication and email verification','Authentification sécurisée et vérification d’e-mail'),L('Profiles, institution links, enrollment checks','Profils, liens établissement, vérification d’inscription'),L('Database for scores and match history','Base de données des scores et matchs'),L('Server-side score validation and anti-cheat','Validation des scores côté serveur et anti-triche'),L('Real-time matchmaking and WebSocket duels','Matchmaking temps réel et duels WebSocket'),L('Tournaments, payments, privacy tooling, rate limits','Tournois, paiements, outils RGPD, limitation de débit')],'lock')}</ul></section>
    <section class="card c12"><div class="card-h"><h2>${L('Target architecture','Architecture cible')}</h2><div class="row"><span class="pill now">${L('Exists','Existe')}</span><span class="pill future">${L('To build','À construire')}</span></div></div>
      <div class="arch">
        <div class="box real"><b>${L('Web client (this build)','Client web (cette version)')}</b>${L('Game logic, scoring, UI, FR/EN strings. One data layer to swap for an API.','Logique de jeu, score, interface, textes FR/EN. Une couche de données à remplacer par une API.')}</div>
        <div class="box fut"><b>${L('Auth provider','Fournisseur d’authentification')}</b>${L('Email + OAuth, password hashing, sessions, account deletion.','E-mail + OAuth, hachage des mots de passe, sessions, suppression de compte.')}</div>
        <div class="box fut"><b>${L('Institution verification','Vérification établissement')}</b>${L('Domain code, then SSO or roster match per partner school.','Code par domaine, puis SSO ou liste par école partenaire.')}</div>
        <div class="box fut"><b>${L('Game API + Postgres','API de jeu + Postgres')}</b>${L('Profiles, runs, history; Redis sorted sets for hot leaderboards.','Profils, parties, historique ; Redis pour les classements chauds.')}</div>
        <div class="box fut"><b>${L('Run validator','Validateur de parties')}</b>${L('Replays submitted inputs against the seed to recompute the score.','Rejoue les entrées envoyées avec le tirage pour recalculer le score.')}</div>
        <div class="box fut"><b>${L('Realtime service','Service temps réel')}</b>${L('Matchmaking queue and WebSocket rooms for duels and party games.','File de matchmaking et salons WebSocket pour duels et jeux de groupe.')}</div>
        <div class="box fut"><b>${L('Tournament engine','Moteur de tournois')}</b>${L('Brackets, schedules, eligibility, institution scoping.','Tableaux, calendriers, éligibilité, périmètre établissement.')}</div>
        <div class="box fut"><b>${L('Payments','Paiements')}</b>${L('Subscriptions and invoicing via a payment provider.','Abonnements et facturation via un prestataire de paiement.')}</div>
        <div class="box fut"><b>${L('Trust & safety','Confiance et sécurité')}</b>${L('Rate limits, anomaly detection, reports, data export and deletion.','Limites de débit, détection d’anomalies, signalements, export et suppression.')}</div>
      </div></section>
    <section class="card c7"><div class="card-h"><h2>${L('Why scores must be validated on a server','Pourquoi valider les scores côté serveur')}</h2></div>
      <div class="prose"><p>${L('Today the browser computes every score, so anyone can edit the page and submit a 12-second race or a 90 ms reaction. Fine for a demo, fatal for a ranking.','Aujourd’hui le navigateur calcule chaque score : n’importe qui peut modifier la page et envoyer une course en 12 secondes ou un réflexe à 90 ms. Acceptable pour une démo, fatal pour un classement.')}</p>
      <p><b>${L('Time trials are the most exposed:','Les contre-la-montre sont les plus exposés :')}</b> ${L('the result is a single number, so a forged one looks exactly like a real one. In production the client sends an input log plus the run’s seed, and the server replays it with the same deterministic physics, accepting only the score it computes itself.','le résultat est un seul nombre, donc un faux ressemble exactement à un vrai. En production, le client envoie le journal de ses actions et le tirage ; le serveur rejoue la partie avec la même physique déterministe et n’accepte que le score qu’il calcule lui-même.')}</p>
      <p>${L('Add signed one-time run tokens, reject reaction times below human limits, flag statistical outliers and rate-limit submissions.','Ajouter des jetons de partie signés à usage unique, rejeter les réflexes sous les limites humaines, signaler les valeurs aberrantes et limiter les envois.')}</p></div></section>
    <section class="card c5"><div class="card-h"><h2>${L('Recommended next step','Prochaine étape recommandée')}</h2></div>
      <div class="prose"><p><b>${L('Ship accounts plus validated Reflex Arena, Grid Lock and Word Rush runs first.','Livrer d’abord les comptes et la validation de Reflex Arena, Grid Lock et Word Rush.')}</b> ${L('They’re the easiest to replay on a server, so the first real leaderboards can be trusted.','Ce sont les plus simples à rejouer côté serveur : les premiers vrais classements seront fiables.')}</p>
      <p>${L('Then pilot one School Cup with a single student association before building real-time duels.','Puis lancer un pilote de Coupe avec un seul BDE avant de construire les duels temps réel.')}</p></div></section>
  </div>`;
};

/* ========================= overlays ========================= */
function renderLayer(){
  const Ly=$('#layer'),sh=S.ui.sheet,keep=[],key=i=>i.id||(i.name&&'n:'+i.name),find=k=>k.startsWith('n:')?Ly.querySelector('[name="'+k.slice(2)+'"]'):document.getElementById(k);
  if(sh&&Ly._sh===sh)Ly.querySelectorAll('input,textarea,select').forEach(i=>{const k=key(i);if(k&&i.type!=='file'&&i.type!=='hidden')keep.push([k,/checkbox|radio/.test(i.type)?i.checked:i.value,i.type]);});
  const ae=document.activeElement,fk=ae&&Ly.contains(ae)&&/INPUT|TEXTAREA|SELECT/.test(ae.tagName)?key(ae):null;
  Ly._fresh=!(sh&&Ly._sh===sh);renderLayer0();Ly._sh=sh;
  keep.forEach(([k,v,t])=>{const n=find(k);if(n&&Ly.contains(n)&&n.type===t){if(/checkbox|radio/.test(t))n.checked=v;else n.value=v;}});
  if(fk){const n=find(fk);if(n&&Ly.contains(n))try{n.focus();}catch(e){}}
}
function renderLayer0(){
  const Ly=$('#layer'),sh=S.ui.sheet;
  if(S.ui.notif){
    const st=S.data;
    Ly.innerHTML=`<div class="scrim" data-act="close"></div><div class="panel" role="dialog" aria-label="Notifications"><div class="card-h"><h2>Notifications</h2><button class="btn sm ghost" type="button" data-act="readall">${L('Mark all read','Tout lire')}</button></div>
      ${st.invites.length?`<p class="tiny">${st.invites.length} ${plural(st.invites.length,'open challenge','open challenges','défi en attente','défis en attente')} · <button class="btn sm ghost" type="button" data-act="go" data-a="social">${L('View','Voir')}</button></p>`:''}
      <ul class="ntf">${st.notifs.slice(0,12).map(n=>`<li class="${n.read?'':'unread'}"><div>${esc(ntext(n))}<small>${ago(n.t)}</small></div></li>`).join('')}</ul></div>`;
    return;
  }
  if(!sh){Ly.innerHTML='';return;}
  const closeBtn=`<button class="iconbtn" type="button" data-act="close" aria-label="${L('Close','Fermer')}">${ic('x')}</button>`;
  let body='';
  if(sh.type==='pick'){
    const titles={duel:[L('1v1 Duel','Duel 1v1'),L('You face the record of a real player close to your rating.','Tu affrontes le record d’un vrai joueur proche de ta cote.')],quick:[L('Play now','Jouer'),L('Starts a Time Trial right away.','Lance un contre-la-montre tout de suite.')],school:[L('School Cup run','Partie de Coupe'),L('Your result adds points for your university.','Ton résultat rapporte des points à ton école.')],challenge:[L('Challenge','Défier')+' '+(sh.opp?esc(DEMO_BY[sh.opp].name):''),L('Real invitations need a server. You’ll play their simulated run now.','Les vraies invitations demandent un serveur. Tu joues contre leur partie simulée.')]};
    const tt=titles[sh.purpose];
    body=`<div class="modal-h"><div><h2>${tt[0]}</h2><p>${tt[1]}</p></div>${closeBtn}</div>
      <div class="games four" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">${PLAYABLE.map(g=>`<button class="gcard" type="button" style="--g:${g.col}" data-act="pick" data-a="${g.id}"><div class="gart">${ART[g.id]}</div><div class="gbody" style="padding:10px 12px"><h3 style="font-size:15px">${g.name}</h3><p class="tag">${g.dur}</p></div></button>`).join('')}</div>`;
  }else if(sh.type==='classmates'){
    const st=S.data,mates=DEMO.filter(p=>SCH[st.school.id]&&p.school===st.school.id&&p.year===st.school.year),list=mates.length?mates:FRIENDS.map(id=>DEMO_BY[id]);
    body=`<div class="modal-h"><div><h2>${L('Challenge a classmate','Défier un camarade')}</h2><p>${mates.length?esc(yearName(st.school.year))+' · '+esc(SCH[st.school.id].short):L('No class linked, showing friends.','Aucune promo liée, voici tes amis.')} ${simPill(L('Simulated presence','Présence simulée'))}</p></div>${closeBtn}</div>
      <ul class="hist">${list.map(p=>`<li>${avP(p,36)}<span class="t"><b class="row" style="gap:8px;flex-wrap:nowrap"><span class="presence${online(p)?' on':''}"></span>${esc(p.name)}</b><small>${p.rating} SR · ${online(p)?L('online','en ligne'):L('offline','hors ligne')}</small></span><button class="btn sm primary" type="button" data-act="challenge" data-a="${p.id}">${L('Pick','Choisir')}</button></li>`).join('')}</ul>`;
  }else if(sh.type==='more'){
    body=`<div class="modal-h"><h2>${L('More','Plus')}</h2>${closeBtn}</div>
      <nav class="nav">${NAV.filter(n=>n&&['shop','social','campus','profile','tech'].includes(n[0])).map(n=>`<button type="button" data-act="go" data-a="${n[0]}">${ic(n[1])}${n[2]()}</button>`).join('')}</nav>
      <div class="row"><div class="lang" role="group" aria-label="${L('Language','Langue')}"><button type="button" data-act="lang" data-a="fr" aria-pressed="${LANG==='fr'}">Français</button><button type="button" data-act="lang" data-a="en" aria-pressed="${LANG==='en'}">English</button></div>
      ${S.data.account.signedIn?'':`<button class="btn sm primary" type="button" data-act="auth" data-a="signup">${L('Sign in','Connexion')}</button>`}</div>`;
  }else if(sh.type==='share'){
    body=`<div class="modal-h"><div><h2>${L('Share result','Partager le résultat')}</h2><p>${L('Copy this into any chat. Share links need a server, so this demo shares text.','Copie ce texte dans n’importe quelle conversation. Les liens de partage demandent un serveur.')}</p></div>${closeBtn}</div>
      <textarea class="input" id="shareTxt" readonly>${esc(sh.text)}</textarea><button class="btn primary" type="button" data-act="copyShare">${L('Copy text','Copier')}</button>`;
  }else if(sh.type==='export'){
    const data=sh.text?null:JSON.parse(JSON.stringify(S.data));if(data)Object.keys(data.ghosts||{}).forEach(k=>{data.ghosts[k]={time:data.ghosts[k].time,frames:data.ghosts[k].frames.length+' frames'};});
    body=`<div class="modal-h"><div><h2>${L('Your data','Tes données')}</h2><p>${L('Everything this demo stores about you, as JSON.','Tout ce que cette démo enregistre sur toi, en JSON.')}</p></div>${closeBtn}</div>
      <textarea class="input" id="shareTxt" readonly style="min-height:260px">${esc(sh.text||JSON.stringify(data,null,2))}</textarea><button class="btn" type="button" data-act="copyShare">${L('Copy JSON','Copier le JSON')}</button>`;
  }else if(sh.type==='confirm'){
    const m={delete:[L('Delete your account?','Supprimer ton compte ?'),L('Your profile, scores and verification requests are deleted for good. This can’t be undone.','Ton profil, tes scores et tes demandes de vérification sont supprimés définitivement. Action irréversible.'),L('Delete my account','Supprimer mon compte')],reset:[L('Delete all local data?','Supprimer toutes les données locales ?'),L('Profile, scores, ghosts, achievements and settings will be erased from this browser. This can’t be undone.','Profil, scores, fantômes, succès et réglages seront effacés de ce navigateur. Action irréversible.'),L('Delete data','Supprimer')],quit:[L('Leave this match?','Quitter ce match ?'),L('It won’t count, and no Daily attempt is used.','Il ne comptera pas et aucun essai du jour ne sera utilisé.'),L('Leave match','Quitter')]}[sh.what];
    body=`<div class="modal-h"><div><h2>${m[0]}</h2><p>${m[1]}</p></div></div><div class="row"><button class="btn ${['reset','delete'].includes(sh.what)?'':'primary'}" type="button" data-act="confirmYes" style="${['reset','delete'].includes(sh.what)?'background:var(--bad);color:#fff':''}">${m[2]}</button><button class="btn ghost" type="button" data-act="close">${L('Cancel','Annuler')}</button></div>`;
  }else if(sh.type==='report')body=reportHTML(sh);
  else if(sh.type==='auth')body=authHTML(sh);
  else if(sh.type==='campus')body=campusSheetHTML();
  else if(['itemBuy','packBuy','cgv'].includes(sh.type))body=shopSheetHTML(sh,closeBtn);
  else if(sh.type==='league'&&typeof leagueSheetHTML==='function')body=leagueSheetHTML(sh,closeBtn);
  Ly.innerHTML=`<div class="layer" data-act="scrim"><div class="modal" role="dialog" aria-modal="true">${body}</div></div>`;
  const f=Ly.querySelector('input:not([readonly]),.modal button.btn.primary');if(f&&Ly._fresh)setTimeout(()=>{const ae=document.activeElement;if(Ly.contains(f)&&!(ae&&ae!==f&&Ly.contains(ae)&&/INPUT|TEXTAREA|SELECT/.test(ae.tagName)))try{f.focus();}catch(e){}},30);
}
function authHTML(sh){
  const tab=sh.tab,e=sh.err||{};
  const tabs=`<div class="seg" role="tablist">${[['signup',L('Create account','Créer un compte')],['login',L('Sign in','Connexion')],['recover',L('Reset password','Mot de passe oublié')]].map(x=>`<button type="button" role="tab" aria-selected="${tab===x[0]}" data-act="auth" data-a="${x[0]}">${x[1]}</button>`).join('')}</div>`;
  const head=`<div class="modal-h"><div><h2>${tab==='signup'?L('Create your player profile','Crée ton profil joueur'):tab==='login'?L('Welcome back','Content de te revoir'):L('Reset your password','Réinitialise ton mot de passe')}</h2></div><button class="iconbtn" type="button" data-act="close" aria-label="${L('Close','Fermer')}">${ic('x')}</button></div>
  <div class="note">${ic('info')}<span><b>${L('Demo only.','Démo uniquement.')}</b> ${L('No server: no account is created, no email is sent or verified, and your password is never saved.','Pas de serveur : aucun compte n’est créé, aucun e-mail envoyé ni vérifié, et ton mot de passe n’est jamais enregistré.')}</span></div>${tabs}`;
  if(tab==='recover'){
    if(sh.sent)return head+`<div class="note">${ic('info')}<span>${L('Nothing was sent. In production we’d email a single-use reset link, valid 30 minutes, if an account exists.','Rien n’a été envoyé. En production, on enverrait un lien unique valable 30 minutes, si un compte existe.')}</span></div><button class="btn" type="button" data-act="auth" data-a="login">${L('Back to sign in','Retour à la connexion')}</button>`;
    return head+`<form data-form="recover" class="stack" novalidate><div class="field"><label for="aEmail">E-mail</label><input class="input" id="aEmail" name="email" type="email" autocomplete="email">${e.email?`<span class="err">${e.email}</span>`:''}</div><button class="btn primary" type="submit">${L('Send reset link','Envoyer le lien')}</button></form>`;
  }
  if(tab==='login'){
    return head+`<form data-form="login" class="stack" novalidate>
      <div class="field"><label for="aEmail">E-mail</label><input class="input" id="aEmail" name="email" type="email" autocomplete="email">${e.email?`<span class="err">${e.email}</span>`:''}</div>
      <div class="field"><label for="aPw">${L('Password','Mot de passe')}</label><input class="input" id="aPw" name="pw" type="password" autocomplete="current-password">${e.pw?`<span class="err">${e.pw}</span>`:''}</div>
      <button class="btn primary" type="submit">${L('Sign in','Se connecter')}</button><button class="btn ghost sm" type="button" data-act="auth" data-a="recover">${L('Forgot password?','Mot de passe oublié ?')}</button></form>`;
  }
  const st=S.data,v=sh.vals||{};
  return head+`<form data-form="signup" class="stack" novalidate>
    <div class="field"><label for="aEmail">E-mail</label><input class="input" id="aEmail" name="email" type="email" autocomplete="email" value="${esc(v.email||'')}">${e.email?`<span class="err">${e.email}</span>`:`<span class="help">${L('Used to sign in. Not stored by this demo.','Sert à te connecter. Non enregistré par cette démo.')}</span>`}</div>
    <div class="field"><label for="aPw">${L('Password','Mot de passe')}</label><input class="input" id="aPw" name="pw" type="password" autocomplete="new-password">${e.pw?`<span class="err">${e.pw}</span>`:`<span class="help">${L('At least 8 characters with a number.','Au moins 8 caractères dont un chiffre.')}</span>`}</div>
    <div class="field"><label for="aUser">${L('Username','Pseudo')}</label><input class="input" id="aUser" name="user" maxlength="16" autocomplete="nickname" value="${esc(v.user||st.account.username)}">${e.user?`<span class="err">${e.user}</span>`:`<span class="help">${L('3–16 letters, numbers, dot or underscore. Shown on leaderboards.','3 à 16 lettres, chiffres, point ou tiret bas. Affiché dans les classements.')}</span>`}</div>
    <div class="field"><span class="lab">Avatar</span><div class="choice">${AV_PRESETS.map((a,i)=>a.premium?'':`<button type="button" data-act="authAv" data-a="${i}" aria-pressed="${(sh.av??st.account.avatar)===i}">${face(a,34)}</button>`).join('')}</div></div>
    <div class="field"><label for="aSchool">${L('School (optional)','École (optionnel)')}</label><select class="input" id="aSchool" name="school"><option value="">${L('Skip for now','Plus tard')}</option>${SCHOOLS.map(x=>`<option value="${x.id}" ${(v.school??st.school.id)===x.id?'selected':''}>${x.name} (${L('demo','démo')})</option>`).join('')}</select><span class="help">${L('You can verify enrollment later from Campus.','Tu pourras vérifier ton inscription depuis Campus.')}</span></div>
    <button class="btn primary" type="submit">${L('Create demo profile','Créer le profil démo')}</button></form>`;
}
