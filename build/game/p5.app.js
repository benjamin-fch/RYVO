
/* ========================= render & routing ========================= */
function render(){
  document.body.dataset.skin=S.data.account.skin;document.documentElement.lang=LANG;
  $('#side').innerHTML=sideHTML();$('#top').innerHTML=topHTML();$('#mnav').innerHTML=mnavHTML();$('#foot').innerHTML=footHTML();
  if(!(S.route==='game'&&S.ctrl)){$('#view').innerHTML=(VIEWS[S.route]||VIEWS.home)();afterRender();}
  renderLayer();
}
function afterRender(){
  if(S._seen){S.data.seen[S._seen[0]]=S._seen[1];S._seen=null;save();}
  if(S.route==='game'&&!S.ctrl){
    const mount=$('#gameMount'),g=S.game;
    try{S.ctrl=MOUNT[g.id](mount,makeCtx(g),finishGame);}
    catch(err){mount.innerHTML=`<div class="note err">${ic('info')}<span>${L('This game couldn’t start in your browser','Ce jeu n’a pas pu démarrer dans ton navigateur')} (${esc(err.message)}). ${L('Try another game or a newer browser.','Essaie un autre jeu ou un navigateur plus récent.')}</span></div>`;S.ctrl={destroy(){}};}
  }
  if(S.route==='result'&&S.result&&S.result.fresh){
    S.result.fresh=false;const r=S.result;
    if(r.better||r.outcome==='win'){setTimeout(()=>FX.confetti(r.outcome==='win'||!r.first?120:60),120);SFX.play('win');}
    const el=$('#resScore');
    if(el&&!GAME[r.g].lower&&!REDUCED){const to=r.score,t0=performance.now();const f=now=>{const k=Math.min(1,(now-t0)/700),e=1-Math.pow(1-k,3);el.textContent=fmtScore(r.sk,Math.round(to*e));if(k<1&&el.isConnected)requestAnimationFrame(f);};requestAnimationFrame(f);}
  }
}
function go(route,arg){
  if(S.ctrl){S.ctrl.destroy();S.ctrl=null;}
  SFX.engineStop();
  S.route=route;S.ui.sheet=null;S.ui.notif=false;
  if(route==='lobby'){if(S.ui.lobby.game!==arg){S.ui.lobby.game=arg;}if(!S.ui.lobby.oppId)S.ui.lobby.oppId=pickOpponent();}
  render();
  try{window.scrollTo({top:0});}catch(e){}
  const v=$('#view');if(v&&route!=='game'){try{v.focus({preventScroll:true});}catch(e){}}
}
function startGame(id,mode,oppId,opt={}){
  rollDaily();SFX.init();
  if(mode==='daily'&&attLeft(id)<1){toast(L('No Daily attempts left for this game today.','Plus d’essais du jour pour ce jeu.'));return;}
  if(mode==='school'&&!SCH[S.data.school.id]){toast(L('Link a school in Campus first.','Lie d’abord une école dans Campus.'));go('campus');return;}
  if(mode==='duel'&&!oppId)oppId=pickOpponent();
  const Lb=S.ui.lobby,lv=levelInfo(S.data.xp).L;
  let track=opt.track!=null?opt.track:(Lb.game===id?Lb.track:0);if(TRACKS[track].lv>lv)track=0;if(mode==='daily')track=dailyTrack();
  const cat=mode==='daily'?'mix':(opt.cat||(Lb.game===id?Lb.cat:'mix'));
  const sk=id==='sprint'?'sprint@'+track:id;
  S.game={id,mode,sk,track,cat,oppId:mode==='duel'?oppId:null};
  Object.assign(S.ui.lobby,{game:id,mode,oppId:mode==='duel'?oppId:Lb.oppId,track:id==='sprint'&&mode!=='daily'?track:Lb.track,cat:id==='brain'&&mode!=='daily'?cat:Lb.cat});
  go('game');
}
function makeCtx(g){
  const o=g.oppId?DEMO_BY[g.oppId]:null;
  const ctx={mode:g.mode,opp:o,sk:g.sk,track:g.track,cat:g.cat,rand:g.mode==='daily'?rng(hashStr(dayKey()+g.sk+(g.id==='words'?LANG:''))):Math.random};
  if(g.id==='sprint'&&o)ctx.oppTime=+((o.best[g.sk]||TRACKS[g.track].par*1.3)*(1+Math.random()*0.05)).toFixed(2);
  if(g.id==='reflex'&&o)ctx.oppBase=o.best.reflex||285;
  if(o&&['stack','grid','words','aim'].includes(g.id)){const def={stack:350,grid:3500,words:3000,aim:7000}[g.id];ctx.oppScore=Math.round((o.best[g.sk]||def)*(0.82+Math.random()*0.22));}
  return ctx;
}

/* ========================= scoring & progression ========================= */
const both=fn=>{const k=LANG;LANG='en';const en=fn();LANG='fr';const fr=fn();LANG=k;return [en,fr];};
function finishGame(res){
  const st=S.data,g=S.game,G=GAME[g.id],sk=g.sk;rollDaily();
  if(S.ctrl){S.ctrl.destroy();S.ctrl=null;}
  const prev=st.bests[sk],isBetter=better(sk,res.score,prev),lastSame=st.history.find(h=>(h.sk||h.g)===sk);
  if(isBetter)st.bests[sk]=res.score;
  if(g.id==='sprint'&&res.ghost&&res.ghost.length>5){const gh=st.ghosts[sk];if(!gh||res.score<gh.time)st.ghosts[sk]={time:res.score,frames:res.ghost};}
  let xp=30+Math.round(res.perf*60);if(isBetter&&prev!=null)xp+=25;
  let dr=0;const o=g.oppId?DEMO_BY[g.oppId]:null;
  if(g.mode==='duel'&&o){
    const s=res.outcome==='win'?1:res.outcome==='draw'?.5:0,exp=1/(1+10**((o.rating-st.rating)/400));dr=Math.round(32*(s-exp));
    if(res.outcome==='win'){dr=Math.max(dr,4);st.stats.duelWins++;xp+=30;}else if(res.outcome==='loss'){dr=Math.min(dr,-4);st.stats.duelLosses++;}
    const before=league(st.rating);st.rating=Math.max(0,st.rating+dr);
    if(league(st.rating)!==before){const [en,fr]=both(league(st.rating).n);notify(`You moved to the ${en} league.`,`Tu passes en ligue ${fr}.`);}
  }
  if(g.id==='cards'&&res.outcome==='win')st.stats.cardWins++;
  if(g.mode==='daily'){st.daily.att[g.id]=attLeft(g.id)-1;xp+=20;const db=st.daily.best[g.id];if(better(sk,res.score,db))st.daily.best[g.id]=res.score;}
  let schoolGain=0;if(g.mode==='school'&&SCH[st.school.id]){schoolGain=Math.round(50+res.perf*150);st.schoolPts+=schoolGain;st.stats.schoolRuns++;xp+=10;}
  const today=dayKey();if(st.lastDay!==today){const y=dayKey(new Date(Date.now()-864e5));st.streak=st.lastDay===y?st.streak+1:1;st.lastDay=today;}
  const f=res.flags||{};['flash','scholar','clean','ghostBeat','grid5','word8','combo20'].forEach(k=>{if(f[k])st.stats[k]=true;});
  if(f.maxFloors)st.stats.maxFloors=Math.max(st.stats.maxFloors||0,f.maxFloors);
  const lvBefore=levelInfo(st.xp).L;st.xp+=xp;const lvAfter=levelInfo(st.xp).L;
  const w=20+Math.round(res.perf*100)+(res.outcome==='win'&&g.mode==='duel'?30:0);
  st.history.unshift({g:g.id,sk,m:g.mode,s:res.score,p:+res.perf.toFixed(3),o:res.outcome||null,opp:o?o.name:null,xp,dr,w,t:Date.now(),x:res.x!=null?res.x:undefined});
  st.history=st.history.slice(0,100);
  const newAch=checkAch();newAch.forEach(a=>{const [en,fr]=both(a.n);notify(`Achievement unlocked: ${en}.`,`Succès débloqué : ${fr}.`);});
  if(lvAfter>lvBefore){
    notify(`Level up: you reached level ${lvAfter}.`,`Niveau supérieur : tu passes niveau ${lvAfter}.`);
    TRACKS.forEach(T=>{if(T.lv>lvBefore&&T.lv<=lvAfter)notify(`New track unlocked: ${T.name}.`,`Nouveau circuit débloqué : ${T.name}.`);});
    FRAMES.forEach(fr=>{if(!fr.premium&&fr.lv>lvBefore&&fr.lv<=lvAfter)notify('New profile frame unlocked.','Nouveau cadre de profil débloqué.');});
    SKINS.forEach(k=>{if(k.lv>lvBefore&&k.lv<=lvAfter)notify('New theme colour unlocked.','Nouvelle couleur de thème débloquée.');});
  }
  if(isBetter&&prev!=null)notify(`New personal best in ${skName(sk)}: ${fmtScore(sk,res.score)}.`,`Nouveau record sur ${skName(sk)} : ${fmtScore(sk,res.score)}.`);
  save();
  S.result={g:g.id,sk,mode:g.mode,score:res.score,prev,better:isBetter,first:prev==null,perf:res.perf,outcome:res.outcome||null,oppName:res.oppName||(o&&o.name)||null,oppScore:res.oppScore!=null?res.oppScore:null,
    xp,lvBefore,lvAfter,dr,schoolGain,ach:newAch,details:res.details||{},dailyLeft:g.mode==='daily'?attLeft(g.id):null,lastPrev:lastSame?lastSame.s:null,fresh:true};
  go('result');
}
function checkAch(){const st=S.data,out=[];ACH.forEach(a=>{if(!st.ach.includes(a.id)&&a.t(st)){st.ach.push(a.id);out.push(a);}});return out;}

/* ========================= actions ========================= */
const ACT={
  go:a=>go(a),
  lobby:a=>{if(S.ui.lobby.game!==a)Object.assign(S.ui.lobby,{mode:'trial'});go('lobby',a);},
  mode:a=>{S.ui.lobby.mode=a;if(a==='duel'&&!S.ui.lobby.oppId)S.ui.lobby.oppId=pickOpponent();SFX.play('tap');render();},
  track:a=>{S.ui.lobby.track=+a;SFX.play('tap');render();},
  qcat:a=>{S.ui.lobby.cat=a;SFX.play('tap');render();},
  reroll:()=>{S.ui.lobby.oppId=pickOpponent(S.ui.lobby.oppId);render();},
  start:()=>{const Lb=S.ui.lobby;startGame(Lb.game,Lb.mode,Lb.oppId,{track:Lb.track,cat:Lb.cat});},
  quick:a=>{const [g,m]=a.split(':');startGame(g,m);},
  playnow:()=>{S.ui.sheet={type:'pick',purpose:'quick'};renderLayer();},
  schoolRun:()=>{S.ui.sheet={type:'pick',purpose:'school'};renderLayer();},
  pick:a=>{const sh=S.ui.sheet;S.ui.sheet=null;if(sh.purpose==='challenge'){S.data.stats.challenges++;save();startGame(a,'duel',sh.opp);}else startGame(a,sh.purpose==='school'?'school':sh.purpose==='duel'?'duel':'trial');},
  classmate:()=>{S.ui.sheet={type:'classmates'};S.ui.notif=false;renderLayer();},
  challenge:a=>{S.ui.sheet={type:'pick',purpose:'challenge',opp:a};renderLayer();},
  invAccept:a=>{const st=S.data,inv=st.invites.find(i=>i.id===a);if(!inv)return;st.invites=st.invites.filter(i=>i.id!==a);st.stats.challenges++;save();startGame(inv.game,'duel',inv.from);},
  invDecline:a=>{S.data.invites=S.data.invites.filter(i=>i.id!==a);save();toast(L('Invitation declined.','Invitation refusée.'));render();},
  again:()=>{const r=S.result;if(!r)return;if(r.mode==='daily'&&attLeft(r.g)<1){toast(L('No Daily attempts left. Try a Time Trial.','Plus d’essais du jour. Essaie le contre-la-montre.'));return;}startGame(r.g,r.mode,r.mode==='duel'?S.game.oppId:null,{track:S.game.track,cat:S.game.cat});},
  share:()=>{
    const r=S.result;
    const txt=L(`RYVO · ${skName(r.sk)} (${MODES[r.mode].n()}): ${fmtScore(r.sk,r.score)}${r.better?' — personal best':''}${r.outcome&&r.mode==='duel'?` · ${r.outcome==='win'?'won':r.outcome==='loss'?'lost':'drew'} vs ${r.oppName}`:''}. Think you can beat it? (prototype)`,
      `RYVO · ${skName(r.sk)} (${MODES[r.mode].n()}) : ${fmtScore(r.sk,r.score)}${r.better?' — record perso':''}${r.outcome&&r.mode==='duel'?` · ${r.outcome==='win'?'victoire':r.outcome==='loss'?'défaite':'égalité'} contre ${r.oppName}`:''}. Tu peux faire mieux ? (prototype)`);
    S.ui.sheet={type:'share',text:txt};renderLayer();
  },
  copyShare:()=>{const ta=$('#shareTxt');if(!ta)return;const fb=()=>{ta.focus();ta.select();toast(L('Selected. Press Ctrl+C or ⌘C to copy.','Sélectionné. Fais Ctrl+C ou ⌘C pour copier.'));};try{navigator.clipboard.writeText(ta.value).then(()=>toast(L('Copied.','Copié.')),fb);}catch(e){fb();}},
  close:()=>{S.ui.sheet=null;S.ui.notif=false;renderLayer();},
  scrim:(a,el,e)=>{if(e.target===el){S.ui.sheet=null;renderLayer();}},
  notif:()=>{S.ui.notif=!S.ui.notif;S.ui.sheet=null;renderLayer();},
  readall:()=>{S.data.notifs.forEach(n=>n.read=true);save();render();},
  more:()=>{S.ui.sheet={type:'more'};renderLayer();},
  lang:a=>{LANG=a;S.data.lang=a;save();render();if(S.route==='game')toast(L('Language changes apply from the next match.','La langue s’appliquera au prochain match.'));},
  sound:()=>{S.data.sound=!S.data.sound;if(!S.data.sound)SFX.engineStop();else{SFX.init();SFX.play('good');}save();$('#top').innerHTML=topHTML();},
  claim:a=>{const st=S.data,m=MISSIONS.find(x=>x.id===a);rollDaily();if(!m||st.missions.claimed.includes(a)||m.prog(todayHist())<m.goal)return;
    const lb=levelInfo(st.xp).L;st.missions.claimed.push(a);st.xp+=m.xp;notify(`Mission complete (+${m.xp} XP).`,`Mission accomplie (+${m.xp} XP).`);const la=levelInfo(st.xp).L;if(la>lb)notify(`Level up: you reached level ${la}.`,`Niveau supérieur : niveau ${la}.`);checkAch();save();
    const b=document.querySelector(`[data-act="claim"][data-a="${a}"]`);if(b){const [x,y]=FX.at(b);FX.burst(x,y,['#FFC93C','#5B4BFF','#fff'],20,7);FX.pop('+'+m.xp+' XP',x,y-20,'#FFC93C');}SFX.play('coin');render();},
  cat:a=>{S.ui.lib.cat=a;render();},
  libReset:()=>{S.ui.lib={cat:'all',mode:'all',diff:'all',sort:'pop'};render();},
  notifyGame:a=>{const n=S.data.notify,i=n.indexOf(a);if(i>=0)n.splice(i,1);else{n.push(a);toast(L(`We’ll tell you when ${GAME[a].name} launches.`,`On te prévient au lancement de ${GAME[a].name}.`));}save();render();},
  rankgo:a=>{const R=S.ui.rank;R.view='players';R.board=BOARD_IDS.includes(a)?a:'rating';R.scope='world';go('ranks');},
  rview:a=>{S.ui.rank.view=a;render();},
  rscope:a=>{const R=S.ui.rank;R.scope=a;R.loading=true;render();setTimeout(()=>{R.loading=false;if(S.route==='ranks')render();},260);},
  campusEdit:()=>{Object.assign(S.ui.campus,{edit:true,q:'',pick:S.data.school.id||null,program:S.data.school.program,err:null});render();},
  campusCancel:()=>{S.ui.campus.edit=false;S.ui.campus.err=null;render();},
  campusPick:a=>{S.ui.campus.pick=a;S.ui.campus.err=null;const l=$('#schoolList');if(l)l.innerHTML=schoolListHTML(schoolFilter(S.ui.campus.q));},
  campusSave:()=>{const c=S.ui.campus,st=S.data,pick=c.pick||(SCH[st.school.id]?st.school.id:null);if(!pick){c.err=L('Select an institution from the list first.','Choisis d’abord un établissement dans la liste.');render();return;}
    const changed=pick!==st.school.id;st.school={id:pick,program:c.program||st.school.program,status:changed?'unverified':st.school.status,domain:changed?null:st.school.domain};if(changed)st.schoolPts=0;
    c.edit=false;c.err=null;save();toast(L(`Linked to ${SCH[pick].name}.`,`Lié à ${SCH[pick].name}.`));render();},
  campusRemove:()=>{const st=S.data;st.school={id:null,program:st.school.program,status:'unverified',domain:null};st.schoolPts=0;S.ui.campus.edit=false;save();toast(L('School unlinked.','École déliée.'));render();},
  verifyReset:()=>{S.data.school.status='unverified';S.data.school.domain=null;save();render();},
  avatar:a=>{S.data.account.avatar=+a;SFX.play('tap');save();render();},
  frame:a=>{S.data.account.frame=a;SFX.play('tap');save();render();},
  skin:a=>{S.data.account.skin=a;SFX.play('tap');save();render();},
  auth:a=>{const sh=S.ui.sheet&&S.ui.sheet.type==='auth'?S.ui.sheet:{};S.ui.sheet={type:'auth',tab:a,av:sh.av,vals:sh.vals};S.ui.notif=false;renderLayer();},
  authAv:a=>{const sh=S.ui.sheet,f=$('#layer form');if(f)sh.vals={email:f.elements.email.value,user:f.elements.user.value,school:f.elements.school.value};sh.av=+a;renderLayer();},
  signout:()=>{S.data.account.signedIn=false;save();toast(L('Signed out. Your local progress stays on this device.','Déconnecté. Ta progression reste sur cet appareil.'));render();},
  export:()=>{S.ui.sheet={type:'export'};renderLayer();},
  reset:()=>{S.ui.sheet={type:'confirm',what:'reset'};renderLayer();},
  quit:()=>{S.ui.sheet={type:'confirm',what:'quit'};renderLayer();},
  confirmYes:()=>{const w=S.ui.sheet.what;S.ui.sheet=null;
    if(w==='reset'){try{localStorage.removeItem(KEY);localStorage.removeItem(KEY_OLD);}catch(e){}const keepLang=S.data.lang;S.data=DEF();S.data.lang=keepLang;S.result=null;save();toast(L('Local data deleted.','Données locales supprimées.'));go('home');}
    else go('lobby',S.game.id);},
  evDel:a=>{S.data.events=S.data.events.filter(e=>e.id!==a);save();toast(L('Competition cancelled.','Compétition annulée.'));render();}
};
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el)return;const fn=ACT[el.dataset.act];if(fn)fn(el.dataset.a,el,e);});
document.addEventListener('pointerdown',()=>{if(S.data.sound)SFX.init();},{once:true});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&(S.ui.sheet||S.ui.notif)){S.ui.sheet=null;S.ui.notif=false;renderLayer();}
  if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('li[data-act]')){e.preventDefault();e.target.click();}
});
document.addEventListener('change',e=>{
  const k=e.target.dataset&&e.target.dataset.ch;if(!k)return;const v=e.target.value;
  if(k==='libMode'){S.ui.lib.mode=v;render();}if(k==='libDiff'){S.ui.lib.diff=v;render();}if(k==='libSort'){S.ui.lib.sort=v;render();}
  if(k==='rboard'){S.ui.rank.board=v;render();}if(k==='campusProg'){S.ui.campus.program=v;}
});
document.addEventListener('input',e=>{
  const k=e.target.dataset&&e.target.dataset.in;if(!k)return;
  if(k==='schoolQ'){S.ui.campus.q=e.target.value;$('#schoolList').innerHTML=schoolListHTML(schoolFilter(e.target.value));}
  if(k==='calc'){S.ui.calc[e.target.dataset.k]=e.target.value;$('#calcOut').innerHTML=calcOut();}
});
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
document.addEventListener('submit',e=>{
  const f=e.target,k=f.dataset.form;if(!k)return;e.preventDefault();
  const st=S.data,F=n=>f.elements[n]?f.elements[n].value:'';
  if(k==='signup'){
    const email=F('email').trim(),pw=F('pw'),user=F('user').trim(),school=F('school'),err={};
    if(!EMAIL_RE.test(email))err.email=L('Enter a valid email address, like name@example.com.','Saisis une adresse valide, comme nom@exemple.com.');
    if(pw.length<8||!/\d/.test(pw))err.pw=L('Use at least 8 characters, including a number.','Au moins 8 caractères, dont un chiffre.');
    if(!/^[A-Za-z0-9._]{3,16}$/.test(user))err.user=L('Use 3–16 letters, numbers, dots or underscores.','3 à 16 lettres, chiffres, points ou tirets bas.');
    else if(DEMO.some(p=>p.name.toLowerCase()===user.toLowerCase()))err.user=L('That name is taken. Try adding a number.','Ce pseudo est pris. Ajoute un chiffre.');
    f.elements.pw.value='';
    if(Object.keys(err).length){S.ui.sheet=Object.assign(S.ui.sheet,{err,vals:{email,user,school}});renderLayer();return;}
    st.account.signedIn=true;st.account.username=user;if(S.ui.sheet.av!=null)st.account.avatar=S.ui.sheet.av;
    if(school&&school!==st.school.id){st.school={id:school,program:st.school.program,status:'unverified',domain:null};st.schoolPts=0;}
    if(!school)st.school.id=null;
    notify('Demo profile created on this device. No email was sent and nothing was verified.','Profil démo créé sur cet appareil. Aucun e-mail envoyé, rien n’a été vérifié.');
    save();S.ui.sheet=null;SFX.play('good');toast(L('Demo profile ready.','Profil démo prêt.'));render();
  }
  if(k==='login'){
    const email=F('email').trim(),pw=F('pw'),err={};
    if(!EMAIL_RE.test(email))err.email=L('Enter the email you signed up with.','Saisis l’e-mail utilisé à l’inscription.');
    if(!pw)err.pw=L('Enter your password.','Saisis ton mot de passe.');
    f.elements.pw.value='';
    if(Object.keys(err).length){S.ui.sheet=Object.assign(S.ui.sheet,{err});renderLayer();return;}
    st.account.signedIn=true;save();S.ui.sheet=null;toast(L('Demo sign-in: this device’s profile is loaded. No server was contacted.','Connexion démo : profil de cet appareil chargé. Aucun serveur contacté.'));render();
  }
  if(k==='recover'){const email=F('email').trim();if(!EMAIL_RE.test(email)){S.ui.sheet=Object.assign(S.ui.sheet,{err:{email:L('Enter a valid email address.','Saisis une adresse valide.')}});renderLayer();return;}S.ui.sheet=Object.assign(S.ui.sheet,{sent:true,err:{}});renderLayer();}
  if(k==='verify'){
    const s=SCH[st.school.id],email=F('email').trim().toLowerCase();
    if(!EMAIL_RE.test(email)){S.ui.campus.err='v:'+L('Enter a full email address.','Saisis une adresse complète.');render();return;}
    const dom=email.split('@')[1];
    if(dom!==s.domain){S.ui.campus.err='v:'+L(`That address isn’t from ${s.name}. Use one ending in @${s.domain}.`,`Cette adresse n’est pas de ${s.name}. Utilise une adresse en @${s.domain}.`);render();return;}
    st.school.status='pending';st.school.domain=dom;S.ui.campus.err=null;save();toast(L('Verification started (demo). No code was sent.','Vérification lancée (démo). Aucun code envoyé.'));render();
  }
  if(k==='tour'){
    const name=F('name').trim(),date=F('date'),ts=date?new Date(date+'T18:00:00').getTime():NaN;
    if(name.length<3){S.ui.admin.err=L('Give the competition a name of at least 3 characters.','Donne un nom d’au moins 3 caractères.');render();return;}
    if(!date||isNaN(ts)||ts<Date.now()-864e5){S.ui.admin.err=L('Pick a date from today onward.','Choisis une date à partir d’aujourd’hui.');render();return;}
    st.events.push({id:'e'+Date.now(),name,game:F('game'),date:ts,vis:F('vis'),elig:F('elig')});
    S.ui.admin.err=null;save();toast(L('Scheduled. No one was notified (demo).','Programmé. Personne n’a été prévenu (démo).'));render();
  }
});

setInterval(()=>{const el=$('#liveFeed');if(!el||document.hidden||LIVE)return;FEED.unshift(newDuel());FEED=FEED.slice(0,5);el.innerHTML=feedHTML(true);},4500);

