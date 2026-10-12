
/* ========================= actions ========================= */
const openLayer=l=>{S.ui.layer=l;renderLayer();const f=$('#layer .modal input:not([type=radio]),#layer .drawer button.x');if(f)setTimeout(()=>{try{f.focus();}catch(e){}},30);};
const closeLayer=()=>{S.ui.layer=null;renderLayer();};
const confirmBox=o=>openLayer(Object.assign({},o,{type:'confirm'}));
async function openPlayer(id){S.d.player=null;openLayer({type:'player',id});try{S.d.player=await rpc('admin_player',{p_id:id});}catch(e){toast(errText(e));}if(S.ui.layer&&S.ui.layer.type==='player')renderLayer();}
async function playerAction(action,args){
  const id=S.ui.layer.id;
  try{S.d.player=await rpc('admin_player_action',{p_id:id,p_action:action,p_args:args||{}});renderLayer();refreshCounts();if(S.ui.sec==='players'){await loadPlayers();render();}return true;}
  catch(e){toast(errText(e));return false;}
}
let plTimer=0;
const ACT={
  sec:a=>{if(!can(a))return;S.ui.sec=a;S.ui.layer=null;loadSection();try{window.scrollTo({top:0});}catch(e){}},
  gate:a=>{S.auth={stage:a};render();},
  logout:async()=>{await sb.auth.signOut();S.role=null;S.d={};S.auth={stage:'login'};render();},
  player:a=>openPlayer(a),
  close:closeLayer,scrim:closeLayer,
  reveal:async a=>{try{S.ui.reveal[a]=await rpc('admin_reveal_email',{p_id:a});renderLayer();}catch(e){toast(errText(e));}},
  pAct:async a=>{
    if(a==='rename'){const v=($('#dRename').value||'').trim();if(await playerAction('rename',{name:v}))toast('Pseudo modifié.');}
    if(a==='suspend'){if(await playerAction('suspend',{days:+$('#dDur').value,motif:$('#dMot').value}))toast('Joueur suspendu.');}
    if(a==='lift'){if(await playerAction('lift'))toast('Sanction levée.');}
    if(a==='note'){if(await playerAction('note',{text:$('#dNotes').value}))toast('Note enregistrée.');}
    if(a==='verify'||a==='unverify'){if(await playerAction('verify',{value:a==='verify'}))toast(a==='verify'?'Étudiant vérifié.':'Vérification retirée.');}
  },
  askBan:()=>{const p=S.d.player;confirmBox({kind:'ban',pid:p.id,title:`Bannir ${p.name} ?`,body:'Le compte ne pourra plus jouer ni apparaître dans les classements.',ok:'Bannir',danger:true,reason:true});},
  askResetScores:()=>{const p=S.d.player;confirmBox({kind:'resetScores',pid:p.id,title:`Réinitialiser les scores de ${p.name} ?`,body:'Ses parties sont archivées et retirées des classements. Son niveau et son XP restent.',ok:'Réinitialiser',danger:true});},
  sort:a=>{const f=S.ui.pl;if(f.sort===a)f.dir*=-1;else{f.sort=a;f.dir=a==='name'?1:-1;}f.page=0;loadPlayers().then(render).catch(e=>toast(errText(e)));},
  page:a=>{S.ui.pl.page+=+a;loadPlayers().then(render).catch(e=>toast(errText(e)));},
  plReset:()=>{S.ui.pl={q:'',status:'all',school:'all',ver:'all',sort:'last',dir:-1,page:0};loadSection();},
  modTab:a=>{S.ui.mod=a;S.d.reports=null;loadSection();},acTab:a=>{S.ui.ac=a;S.d.flags=null;loadSection();},
  ctTab:a=>{S.ui.ct=a;loadSection();},wlTab:a=>{S.ui.wl=a;S.d.words=null;loadSection();},scTab:a=>{S.ui.sc=a;render();},cpTab:a=>{S.ui.cp=a;render();},
  rep:async a=>{const [id,w]=a.split(':');try{await act('admin_report_action',{p_id:id,p_action:w},w==='ignore'?'Signalement classé.':w==='warn'?'Avertissement enregistré. Préviens le joueur si besoin.':'Joueur suspendu 7 jours.');loadSection();}catch(e){}},
  flag:async a=>{const [id,w]=a.split(':');try{await act('admin_flag_action',{p_id:id,p_action:w},w==='valid'?'Score validé : il rejoint les classements.':w==='void'?'Score annulé.':'Score annulé et joueur suspendu 30 jours.');loadSection();}catch(e){}},
  ruleOn:(a,el)=>{S.d.rules[a].on=el.checked;},
  autoVoid:(a,el)=>{S.d.rules.autoVoid=el.checked;},
  saveRules:async()=>{const p={autoVoid:!!S.d.rules.autoVoid};Object.keys(RULES_META).forEach(k=>{p[k]={on:!!S.d.rules[k].on,val:parseFloat($('#rule_'+k).value)};});
    try{S.d.rules=await act('admin_set_rules',{p},'Règles enregistrées.');render();}catch(e){}},
  askLbReset:()=>{const sel=$('#lbReset');confirmBox({kind:'lbReset',board:sel.value,title:`Réinitialiser « ${sel.options[sel.selectedIndex].text} » ?`,body:'Le classement repart de zéro pour tous les joueurs.',ok:'Réinitialiser',danger:true,word:'réinitialiser'});},
  qEdit:a=>openLayer({type:'q',id:a||null}),
  qAct:async a=>{const [id,w]=a.split(':');try{await act('admin_question_action',{p_id:id,p_action:w});loadSection();}catch(e){}},
  askQDel:a=>{const q=S.d.questions.find(x=>x.id===a);confirmBox({kind:'qDel',qid:a,title:'Supprimer cette question ?',body:`« ${q.q.fr} » sera retirée du jeu.`,ok:'Supprimer',danger:true});},
  wDel:async a=>{try{await act('admin_word',{p_lang:S.ui.wl,p_word:a,p_cat:null,p_action:'delete'},`${a} supprimé.`);loadSection();}catch(e){}},
  gSet:async(a,el)=>{const [id,field]=a.split(':');try{await act('admin_set_game',{p_id:id,p_field:field,p_val:el.checked});}catch(e){el.checked=!el.checked;}loadSection();},
  compNew:()=>openLayer({type:'comp'}),
  askCompCancel:a=>{const c=S.d.comps.comps.find(x=>x.id===a);confirmBox({kind:'compCancel',cid:a,title:`Annuler « ${c.name} » ?`,body:'La compétition reste visible comme annulée.',ok:'Annuler la compétition',danger:true});},
  compAct:async a=>{const [id,w]=a.split(':');try{await act('admin_comp_action',{p_id:id,p_action:w},'Copie créée, une semaine plus tard.');loadSection();}catch(e){}},
  saveDaily:async()=>{const p=S.d.comps.daily.map((x,i)=>({date:x.date,game:$('#dg'+i).value,track:$('#dt'+i)?+$('#dt'+i).value:0}));try{await act('admin_set_daily',{p},'Planning enregistré.');loadSection();}catch(e){}},
  seasonDate:async()=>{const v=$('#seasonEnd').value;if(!v){toast('Choisis une date.');return;}try{await act('admin_season_action',{p_action:'set_end',p_end:new Date(v+'T23:00:00').toISOString()},'Date de fin enregistrée.');loadSection();}catch(e){}},
  askSeasonClose:()=>confirmBox({kind:'seasonClose',title:'Clôturer la saison maintenant ?',body:'La saison est figée, chaque cote revient à mi-chemin de 1 000 et une nouvelle saison de 90 jours commence.',ok:'Clôturer la saison',danger:true,word:'clôturer'}),
  verif:async a=>{const [id,w]=a.split(':');try{await act('admin_verif_action',{p_id:id,p_action:w},w==='ok'?'Étudiant vérifié.':'Demande refusée.');loadSection();}catch(e){}},
  mgrDel:async a=>{try{await act('admin_manager',{p_action:'remove',p:{id:a}},'Responsable retiré.');loadSection();}catch(e){}},
  schoolEdit:a=>openLayer({type:'school',id:a||null}),
  inv:async a=>{const [w,id]=a.split(/:(.+)/);try{await act('admin_invoice',{p_action:w,p:{id}},w==='paid'?'Facture marquée payée.':'Relance notée au journal.');loadSection();}catch(e){}},
  askRemove:(a,el)=>confirmBox({kind:'removeAdmin',uid:a,title:`Retirer ${el.dataset.n} de l’équipe ?`,body:'Son compte joueur reste actif, mais il perd l’accès à la console.',ok:'Retirer',danger:true}),
  cancelInvite:async a=>{try{S.d.team=await act('admin_team_action',{p_action:'cancel_invite',p:{mail:a}},'Invitation annulée.');render();}catch(e){}},
  confirmYes:async()=>{
    const c=S.ui.layer;if(!c||c.type!=='confirm')return;
    if(c.word){const v=($('#cfType').value||'').trim().toLowerCase();if(v!==c.word){$('#cfErr').textContent=`Tape exactement « ${c.word} ».`;return;}}
    try{
      if(c.kind==='ban'){S.ui.layer={type:'player',id:c.pid};await playerAction('ban',{motif:$('#cfReason')?$('#cfReason').value:'',note:''});toast('Joueur banni.');return;}
      if(c.kind==='resetScores'){S.ui.layer={type:'player',id:c.pid};await playerAction('reset_scores');toast('Scores réinitialisés.');return;}
      if(c.kind==='lbReset')await act('admin_reset_board',{p_board:c.board},'Classement réinitialisé.');
      if(c.kind==='qDel')await act('admin_question_action',{p_id:c.qid,p_action:'delete'},'Question supprimée.');
      if(c.kind==='compCancel')await act('admin_comp_action',{p_id:c.cid,p_action:'cancel'},'Compétition annulée.');
      if(c.kind==='seasonClose')await act('admin_season_action',{p_action:'close'},'Nouvelle saison lancée.');
      if(c.kind==='removeAdmin')S.d.team=await act('admin_team_action',{p_action:'remove',p:{id:c.uid}},'Membre retiré.');
      closeLayer();loadSection();
    }catch(e){}
  }
};

/* ========================= events ========================= */
document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el||el.disabled)return;const fn=ACT[el.dataset.act];if(fn)fn(el.dataset.a,el,e);});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&S.ui.layer)closeLayer();
  if((e.key==='Enter'||e.key===' ')&&e.target.matches&&e.target.matches('tr[data-act]')){e.preventDefault();e.target.click();}
});
document.addEventListener('change',e=>{
  const k=e.target.dataset&&e.target.dataset.ch;if(!k)return;const v=e.target.value,f=S.ui.pl;
  if(['pls','plsc','plv'].includes(k)){if(k==='pls')f.status=v;if(k==='plsc')f.school=v;if(k==='plv')f.ver=v;f.page=0;loadPlayers().then(render).catch(err=>toast(errText(err)));}
  if(k==='qcat'){S.ui.qf.cat=v;render();}if(k==='qst'){S.ui.qf.status=v;render();}
  if(k==='dailyGame'){S.d.comps.daily[+e.target.dataset.i].game=v;render();}
  if(k==='adminRole'){act('admin_team_action',{p_action:'role',p:{id:e.target.dataset.id,role:v}},'Rôle modifié.').then(t=>{S.d.team=t;render();}).catch(()=>loadSection());}
});
document.addEventListener('input',e=>{
  const k=e.target.dataset&&e.target.dataset.in;if(!k)return;const v=e.target.value;
  if(k==='plq'){S.ui.pl.q=v;S.ui.pl.page=0;clearTimeout(plTimer);plTimer=setTimeout(()=>loadPlayers().then(()=>{$('#plTable').innerHTML=playersTable();}).catch(err=>toast(errText(err))),300);}
  if(k==='qq'){S.ui.qf.q=v;render();}
  if(k==='logq'){S.ui.logq=v;clearTimeout(plTimer);plTimer=setTimeout(async()=>{try{S.d.log=await rpc('admin_log',{p_q:v,p_limit:100});$('#logBox').innerHTML=logList(S.d.log);}catch(err){toast(errText(err));}},300);}
});
document.addEventListener('submit',async e=>{
  const f=e.target,k=f.dataset.form;if(!k)return;e.preventDefault();
  const F=n=>(f.elements[n]?String(f.elements[n].value):'').trim(),btn=f.querySelector('button[type=submit]');
  const gateErr=m=>{S.auth.err=m;render();};
  if(k==='login'){btn.disabled=true;const {error}=await sb.auth.signInWithPassword({email:F('email'),password:f.elements.pw.value});
    if(error){S.auth={stage:'login',err:/confirm/i.test(error.message)?'Confirme d’abord ton e-mail.':/invalid/i.test(error.message)?'E-mail ou mot de passe incorrect.':errText(error)};render();return;}
    afterLogin();return;}
  if(k==='recover'){await sb.auth.resetPasswordForEmail(F('email'),{redirectTo:location.origin+location.pathname});S.auth={stage:'login',err:'Si un compte existe, un lien de réinitialisation a été envoyé.'};render();return;}
  if(k==='newpw'){const pw=f.elements.pw.value;if(pw.length<12){gateErr('Utilise au moins 12 caractères pour un compte d’équipe.');return;}const {error}=await sb.auth.updateUser({password:pw});if(error){gateErr(errText(error));return;}afterLogin();return;}
  if(k==='mfa'){const code=F('code').replace(/\s/g,'');if(!/^\d{6}$/.test(code)){gateErr('Saisis les 6 chiffres affichés dans ton application.');return;}btn.disabled=true;
    const {error}=await sb.auth.mfa.challengeAndVerify({factorId:S.auth.factorId,code});
    if(error){S.auth.err='Code incorrect ou expiré. Réessaie avec le code suivant.';render();return;}
    afterLogin();return;}
  const d=S.d;
  try{
    if(k==='question'){
      const a=[0,1,2,3].map(i=>({fr:F('a'+i+'fr'),en:F('a'+i+'en')})),corr=+(f.querySelector('input[name=correct]:checked')||{value:0}).value;
      const p={id:f.dataset.id||null,cat:F('cat'),status:F('status'),q:{fr:F('qfr'),en:F('qen')},a,correct:corr};
      try{await rpc('admin_save_question',{p});}catch(err){S.ui.layer.err=errText(err);S.ui.layer.draft=p;renderLayer();return;}
      closeLayer();toast('Question enregistrée.');refreshCounts();loadSection();
    }
    if(k==='word'){const r=await act('admin_word',{p_lang:S.ui.wl,p_word:F('w'),p_cat:F('c'),p_action:'add'});toast(r.anagram?`${r.word} ajouté. Anagramme de ${r.anagram} : les deux sont acceptés.`:`${r.word} ajouté.`);loadSection();}
    if(k==='comp'){
      const v={name:F('name'),game:F('game'),format:F('format'),start:F('start'),end:F('end'),vis:F('vis'),school:F('school'),sponsor:F('sponsor'),reward:F('reward')};
      if(!v.start||!v.end){S.ui.layer.err='Choisis les dates.';S.ui.layer.vals=v;renderLayer();return;}
      try{await rpc('admin_save_comp',{p:Object.assign({},v,{start:new Date(v.start+'T09:00:00').toISOString(),end:new Date(v.end+'T23:00:00').toISOString()})});}
      catch(err){S.ui.layer.err=errText(err);S.ui.layer.vals=v;renderLayer();return;}
      closeLayer();S.ui.cp='list';toast('Compétition créée.');loadSection();
    }
    if(k==='school'){
      const v={id:f.dataset.id||null,name:F('name'),short:F('short').toUpperCase(),domain:F('domain').toLowerCase(),city:F('city'),country:F('country'),status:F('status'),col:(f.querySelector('input[name=col]:checked')||{value:'#5B4BFF'}).value};
      try{await rpc('admin_save_school',{p:v});}catch(err){S.ui.layer.err=errText(err);S.ui.layer.vals=v;renderLayer();return;}
      closeLayer();toast('Établissement enregistré.');loadSection();
    }
    if(k==='mgr'){await act('admin_manager',{p_action:'add',p:{name:F('name'),email:F('mail'),school:F('school'),role:F('role')}},'Responsable ajouté.');loadSection();}
    if(k==='invoice'){await act('admin_invoice',{p_action:'add',p:{client:F('client'),type:F('type'),amount:+F('amount'),due:F('due')}},'Facture créée.');loadSection();}
    if(k==='sponsor'){await act('admin_sponsor',{p:{name:F('name'),contract:F('contract'),period:F('period'),amount:+F('amount')||0,status:F('status')}},'Sponsor ajouté.');loadSection();}
    if(k==='admin'){S.d.team=await act('admin_team_action',{p_action:'invite',p:{mail:F('mail'),role:F('role')}},'Invitation créée. Préviens la personne.');loadSection();}
  }catch(err){}
});

/* ========================= démarrage ========================= */
if(CONFIGURED){
  sb.auth.onAuthStateChange((ev)=>{if(ev==='PASSWORD_RECOVERY'){S.auth={stage:'newpw'};render();}if(ev==='SIGNED_OUT'){S.role=null;S.auth={stage:'login'};render();}});
  sb.auth.getSession().then(({data})=>{if(data&&data.session)afterLogin();else{S.auth={stage:'login'};render();}});
}else{S.auth={stage:'config'};render();}
})();
</script>
