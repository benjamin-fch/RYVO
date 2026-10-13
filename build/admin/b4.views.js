
/* ========================= chrome ========================= */
function railHTML(){
  if(S.auth.stage!=='ready')return `<div class="logo">${LOGO}<span>RYVO<small>CONSOLE ADMIN</small></span></div>`;
  const c=S.counts||{},cnt={moderation:c.reports,anticheat:c.flags,schools:c.verifs,business:c.late,content:c.drafts};
  let grp=null,h=`<div class="logo">${LOGO}<span>RYVO<small>CONSOLE ADMIN</small></span></div><nav class="nav" aria-label="Sections">`;
  SECTIONS.forEach(s=>{if(!can(s[0]))return;if(s[4]!==grp){grp=s[4];if(grp)h+=`<div class="grp">${grp}</div>`;}
    h+=`<button type="button" data-act="sec" data-a="${s[0]}" ${S.ui.sec===s[0]?'aria-current="page"':''}>${ic(s[2])}${s[1]}${cnt[s[0]]?`<span class="cnt">${cnt[s[0]]}</span>`:''}</button>`;});
  return h+`</nav><p class="rail-foot">Chaque action est vérifiée par le serveur et inscrite au journal d’audit.</p>`;
}
function topHTML(){
  if(S.auth.stage!=='ready')return '';
  const me=S.me||{};
  return `<div class="grow"></div><a class="btn sm ghost" href="../" target="_blank" rel="noopener">Ouvrir le jeu</a>
  <span class="who"><span class="av">${esc(String(me.name||'?')[0].toUpperCase())}</span><span class="tiny" style="font-weight:700">${esc(me.name||'')} · ${ROLES[S.role]}</span></span>
  <button class="btn sm" type="button" data-act="logout">Se déconnecter</button>`;
}
const head=(eyebrow,title,sub,right='')=>`<div class="page-h"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${sub?`<p>${sub}</p>`:''}</div><div class="row">${right}</div></div>`;
const tabs=(cur,act,items)=>`<div class="tabs" role="tablist">${items.map(([k,l,n])=>`<button type="button" role="tab" aria-selected="${cur===k}" data-act="${act}" data-a="${k}">${l}${n!=null?`<span class="n">${n}</span>`:''}</button>`).join('')}</div>`;
const sw=(act,a,on,label)=>`<span class="switch"><input type="checkbox" data-act="${act}" data-a="${a}" ${on?'checked':''} aria-label="${esc(label)}"><i></i></span>`;
const V={};

/* ========================= overview ========================= */
V.overview=()=>{
  const o=S.d.overview;if(!o)return head('Vue d’ensemble','Bonjour '+esc((S.me||{}).name||''),'')+loading();
  const c=o.counts||{},series=o.series||[];
  const W=640,H=200,pl=36,pr=12,pt=14,pb=26,max=Math.max(5,Math.ceil(Math.max(...series.map(s=>s[1]),0)/5)*5);
  const x=i=>pl+i*(W-pl-pr)/Math.max(1,series.length-1),y=v=>pt+(H-pt-pb)*(1-v/max);
  const path=series.map((s,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(s[1]).toFixed(1)).join(' '),last=series[series.length-1]||[Date.now(),0];
  const chart=series.length?`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Joueurs actifs par jour sur 30 jours, dernier jour ${last[1]}" style="width:100%;height:auto">
    <g class="gl">${[0,max/2,max].map(t=>`<line x1="${pl}" x2="${W-pr}" y1="${y(t)}" y2="${y(t)}"/><text x="${pl-6}" y="${y(t)+3}" text-anchor="end">${fmt(t)}</text>`).join('')}</g>
    <path d="${path} L${x(series.length-1)} ${y(0)} L${x(0)} ${y(0)}Z" fill="#ECEAFF"/><path d="${path}" fill="none" stroke="#17142A" stroke-width="2.5" stroke-linejoin="round"/>
    ${series.map((s,i)=>(i%7===0&&i<series.length-4)||i===series.length-1?`<text x="${x(i)}" y="${H-8}" text-anchor="${i===series.length-1?'end':'middle'}">${dShort(s[0])}</text>`:'').join('')}
    <circle cx="${x(series.length-1)}" cy="${y(last[1])}" r="5" fill="#FFC93C" stroke="#17142A" stroke-width="2"/><text x="${x(series.length-1)-8}" y="${y(last[1])-10}" text-anchor="end" style="fill:#17142A;font-weight:700">${last[1]}</text></svg>`:'';
  const games=(o.plays||[]).slice().sort((a,b)=>b.plays-a.plays),gmax=Math.max(1,...games.map(g=>g.plays));
  const q=[];
  if(c.reports)q.push(['flag','bad',`${c.reports} signalement${c.reports>1?'s':''} ouvert${c.reports>1?'s':''}`,'Pseudos, triche, usurpation','moderation']);
  if(c.flags)q.push(['shield','',`${c.flags} score${c.flags>1?'s':''} suspect${c.flags>1?'s':''}`,'Détectés par les règles anti-triche','anticheat']);
  if(c.verifs)q.push(['campus','brand',`${c.verifs} vérification${c.verifs>1?'s':''} d’école`,'Étudiants en attente de badge','schools']);
  if(c.late)q.push(['euro','bad',`${c.late} facture${c.late>1?'s':''} en retard`,'À relancer','business']);
  if(c.drafts)q.push(['book','good',`${c.drafts} question${c.drafts>1?'s':''} en brouillon`,'À relire et publier','content']);
  const vq=q.filter(x=>can(x[4]));
  return head('Vue d’ensemble','Bonjour '+esc((S.me||{}).name||''),'Ce qui demande une décision, puis l’état de la plateforme. Données réelles.')+`
  <div class="kpis" style="margin-bottom:16px">
    <div class="kpi"><small>Joueurs inscrits</small><b>${fmt(o.players)}</b><span class="d">${o.new7} cette semaine</span></div>
    <div class="kpi"><small>Actifs · 7 jours</small><b>${fmt(o.active7)}</b><span class="d">${o.players?Math.round(o.active7/o.players*100):0} % des inscrits</span></div>
    <div class="kpi"><small>Actifs · 30 jours</small><b>${fmt(o.active30)}</b><span class="d">${o.verified} étudiants vérifiés</span></div>
    <div class="kpi"><small>Abonnés Plus</small><b>${fmt(o.plus)}</b><span class="d">${eur(o.plus*(o.plus_price||0))} / mois</span></div>
    <div class="kpi ${vq.length?'alert':''}"><small>Décisions en attente</small><b>${(c.reports||0)+(c.flags||0)+(c.verifs||0)}</b><span class="d">modération, triche, écoles</span></div>
  </div>
  <div class="grid">
    <section class="card c5"><div class="card-h"><h2>À traiter</h2></div>
      ${vq.length?`<ul class="queue">${vq.map(x=>`<li><span class="qico ${x[1]}">${ic(x[0])}</span><span><b>${x[2]}</b><span class="tiny" style="display:block">${x[3]}</span></span><button class="btn sm" type="button" data-act="sec" data-a="${x[4]}">Ouvrir</button></li>`).join('')}</ul>`:`<div class="empty"><b>Rien en attente</b>Toutes les files sont vides.</div>`}
    </section>
    <section class="card c7"><div class="card-h"><h2>Joueurs actifs par jour</h2><span class="tiny">30 derniers jours</span></div>${chart||'<div class="empty"><b>Pas encore de données</b></div>'}</section>
    <section class="card c5"><div class="card-h"><h2>Jeux les plus joués</h2><span class="tiny">Parties sur 7 jours</span></div>
      ${games.map(g=>{const G=GM(g.id);return `<div class="hbar"><span>${G.name}</span><div class="bar"><i style="width:${g.plays/gmax*100}%;background:${G.col}"></i></div><span class="mono tiny" style="text-align:right">${fmt(g.plays)}</span></div>`;}).join('')}
    </section>
    <section class="card c7"><div class="card-h"><h2>Activité récente de l’équipe</h2>${can('team')?'<button class="btn sm ghost" type="button" data-act="sec" data-a="team">Journal complet</button>':''}</div>${logList(o.log)}</section>
  </div>`;
};

/* ========================= players ========================= */
V.players=()=>{
  const f=S.ui.pl;
  return head('Communauté','Joueurs','Cherche un compte, ouvre sa fiche pour agir. Chaque action est inscrite au journal d’audit.')+`
  <div class="filters" style="margin-bottom:12px">
    <div class="search">${ic('search',16)}<input class="input" id="plq" data-in="plq" value="${esc(f.q)}" placeholder="Pseudo, identifiant ou e-mail" autocomplete="off" aria-label="Rechercher un joueur"></div>
    <div class="field"><label for="pls">Statut</label><select class="input" id="pls" data-ch="pls"><option value="all">Tous</option><option value="active" ${f.status==='active'?'selected':''}>Actifs</option><option value="suspended" ${f.status==='suspended'?'selected':''}>Suspendus</option><option value="banned" ${f.status==='banned'?'selected':''}>Bannis</option></select></div>
    <div class="field"><label for="plsc">École</label><select class="input" id="plsc" data-ch="plsc"><option value="all">Toutes</option>${S.schools.map(s=>`<option value="${s.id}" ${f.school===s.id?'selected':''}>${esc(s.short)}</option>`).join('')}</select></div>
    <div class="field"><label for="plv">Vérifié</label><select class="input" id="plv" data-ch="plv"><option value="all">Tous</option><option value="yes" ${f.ver==='yes'?'selected':''}>Oui</option><option value="no" ${f.ver==='no'?'selected':''}>Non</option></select></div>
  </div><div id="plTable">${playersTable()}</div>`;
};
function playersTable(){
  const f=S.ui.pl,d=S.d.plist;if(!d)return loading();
  const th=(k,l,cls='')=>`<th class="${cls}"><button type="button" data-act="sort" data-a="${k}">${l}${f.sort===k?(f.dir>0?' ↑':' ↓'):''}</button></th>`;
  if(!d.total)return `<div class="empty"><b>${f.q||f.status!=='all'||f.school!=='all'||f.ver!=='all'?'Aucun joueur ne correspond':'Aucun joueur inscrit pour l’instant'}</b>${f.q||f.status!=='all'||f.school!=='all'||f.ver!=='all'?'<button class="btn sm" type="button" data-act="plReset">Réinitialiser les filtres</button>':'Les comptes apparaîtront ici dès les premières inscriptions.'}</div>`;
  const pages=Math.max(1,Math.ceil(d.total/20));
  return `<div class="tblw"><table class="tbl"><thead><tr>${th('name','Joueur')}<th>École</th>${th('level','Niveau','num')}${th('rating','Cote','num')}${th('matches','Parties','num')}${th('last','Dernière activité')}<th>Statut</th>${th('reports','Signal.','num')}</tr></thead><tbody>
    ${d.rows.map(p=>{const s=SC(p.school);return `<tr class="click" data-act="player" data-a="${p.id}" tabindex="0"><td><span class="player">${pav(p)}<span style="min-width:0"><b>${esc(p.name)}</b>${p.plus?' <span class="badge brand">Plus</span>':''}<span class="sub">${esc(p.mail||'')}</span></span></span></td>
      <td>${s?esc(s.short):'—'}${p.verified?' <span class="badge good">vérifié</span>':''}</td><td class="num">${p.level}</td><td class="num">${fmt(p.rating)}</td><td class="num">${fmt(p.matches)}</td><td>${ago(p.last)}</td><td>${statusBadge(p)}</td><td class="num">${p.reports?`<span class="badge bad">${p.reports}</span>`:'0'}</td></tr>`;}).join('')}
  </tbody></table></div>
  <div class="pager"><span class="tiny">${fmt(d.total)} joueur${d.total>1?'s':''} · page ${f.page+1} / ${pages}</span><span class="row"><button class="btn sm" type="button" data-act="page" data-a="-1" ${f.page<=0?'disabled':''}>Précédent</button><button class="btn sm" type="button" data-act="page" data-a="1" ${f.page>=pages-1?'disabled':''}>Suivant</button></span></div>`;
}
function playerDrawer(){
  const p=S.d.player;
  if(!p)return `<div class="m-h"><h2>Chargement…</h2><button class="x" type="button" data-act="close" aria-label="Fermer">${ic('x')}</button></div>${loading()}`;
  const s=SC(p.school),ro=!['super','mod'].includes(S.role),rev=S.ui.reveal[p.id];
  return `<div class="m-h"><div class="player">${pav(p,48)}<div><h2>${esc(p.name)}</h2><div class="row" style="margin-top:6px">${statusBadge(p)}${p.verified?'<span class="badge good">Étudiant vérifié</span>':'<span class="badge">Non vérifié</span>'}${p.plus?'<span class="badge brand">Plus</span>':''}</div></div></div><button class="x" type="button" data-act="close" aria-label="Fermer">${ic('x')}</button></div>
  <dl class="kv">
    <dt>Identifiant</dt><dd>${esc(String(p.id).slice(0,8))}…</dd>
    <dt>E-mail</dt><dd>${esc(rev||p.mail||'')} ${rev?'':`<button class="btn sm ghost" type="button" data-act="reveal" data-a="${p.id}">${ic('eye',14)}Afficher</button>`}</dd>
    <dt>École</dt><dd>${s?esc(s.name):'—'}</dd><dt>Année</dt><dd>${esc(YEARS[p.year]||'—')}</dd>
    <dt>Inscrit le</dt><dd>${dLong(p.joined)}</dd><dt>Dernière activité</dt><dd>${ago(p.last)}</dd>
    <dt>Niveau · cote</dt><dd>${p.level} · ${fmt(p.rating)} SR</dd><dt>Parties</dt><dd>${fmt(p.matches)}</dd>
  </dl>
  <p class="tiny">${ic('info',14)} L’adresse complète est masquée par défaut. L’afficher est inscrit au journal.</p>
  ${p.runs&&p.runs.length?`<div class="section"><h3>Dernières parties</h3><div class="tblw"><table class="tbl"><tbody>${p.runs.map(r=>`<tr><td>${esc(skLabel(r.sk))}</td><td class="num">${fmtScore(r.sk,r.s)}</td><td><span class="badge ${r.st==='valid'?'good':r.st==='flagged'?'warn':r.st==='void'?'bad':''}">${r.st}</span></td><td>${ago(r.t)}</td></tr>`).join('')}</tbody></table></div></div>`:''}
  ${p.reports_list&&p.reports_list.length?`<div class="section"><h3>Signalements (${p.reports_list.length})</h3>${p.reports_list.map(r=>`<p class="tiny"><span class="badge ${r.status==='open'?'bad':''}">${r.status==='open'?'ouvert':esc(r.res||'traité')}</span> ${esc(r.type)} · ${ago(r.t)} : « ${esc(r.text)} »</p>`).join('')}</div>`:''}
  ${ro?'<div class="section"><p class="tiny">Ce rôle peut consulter mais pas sanctionner.</p></div>':`
  <div class="section"><h3>Renommer</h3><p class="tiny">À utiliser pour un pseudo inapproprié ou une usurpation.</p>
    <div class="row"><input class="input" id="dRename" maxlength="16" value="${esc(p.name)}" style="flex:1;min-width:160px" aria-label="Nouveau pseudo"><button class="btn" type="button" data-act="pAct" data-a="rename">Renommer</button></div></div>
  <div class="section"><h3>Sanction</h3>
    ${p.status==='active'?`<div class="fgrid"><div class="field"><label for="dDur">Durée</label><select class="input" id="dDur"><option value="1">24 heures</option><option value="7" selected>7 jours</option><option value="30">30 jours</option></select></div>
      <div class="field"><label for="dMot">Motif</label><select class="input" id="dMot">${MOTIFS.map(m=>`<option>${m}</option>`).join('')}</select></div></div>
      <div class="row"><button class="btn sun" type="button" data-act="pAct" data-a="suspend">Suspendre</button><button class="btn danger" type="button" data-act="askBan">Bannir…</button></div>`
     :`<div class="row"><button class="btn good" type="button" data-act="pAct" data-a="lift">${p.status==='banned'?'Lever le bannissement':'Lever la suspension'}</button></div>`}
  </div>
  <div class="section"><h3>Vérification école</h3><div class="row"><button class="btn sm" type="button" data-act="pAct" data-a="${p.verified?'unverify':'verify'}">${p.verified?'Retirer la vérification':'Marquer comme vérifié'}</button></div></div>
  <div class="section"><h3>Scores</h3><div class="row"><button class="btn" type="button" data-act="askResetScores">${ic('refresh',15)}Réinitialiser ses scores…</button></div></div>`}
  <div class="section"><h3>Notes internes</h3><textarea class="input" id="dNotes" placeholder="Visible uniquement par l’équipe" ${ro?'readonly':''}>${esc(p.notes||'')}</textarea>${ro?'':`<div class="row"><button class="btn sm" type="button" data-act="pAct" data-a="note">Enregistrer la note</button></div>`}</div>
  <div class="section"><h3>Historique des actions</h3>${logList(p.log)}</div>`;
}

/* ========================= moderation ========================= */
V.moderation=()=>{
  const list=S.d.reports,c=S.counts||{};
  return head('Communauté','Signalements','Les joueurs signalent un pseudo, une triche ou un comportement.',tabs(S.ui.mod,'modTab',[['open','Ouverts',c.reports],['done','Traités',null]]))+
  (!list?loading():list.length?`<div class="stack">${list.map(r=>{const t=r.target;return `<article class="report ${r.status!=='open'?'done':''}"><div style="min-width:0">
      <div class="row"><span class="badge ${/Triche/.test(r.type)?'bad':/Usurpation/.test(r.type)?'warn':''}">${esc(r.type)}</span><span class="tiny">${ago(r.t)} · signalé par ${esc(r.reporter)}</span>${r.status!=='open'?`<span class="badge good">${esc(r.res||'')}</span>`:''}</div>
      <p style="margin-top:8px"><button class="btn sm ghost" type="button" data-act="player" data-a="${t.id}" style="padding:0 6px">${pav(t,22)} <b>${esc(t.name)}</b></button> ${statusBadge(t)} <span class="tiny">${t.open} signalement(s) ouvert(s)</span></p>
      ${r.text?`<blockquote>${esc(r.text)}</blockquote>`:''}</div>
      ${r.status==='open'?`<div class="acts"><button class="btn sm" type="button" data-act="rep" data-a="${r.id}:ignore">Ignorer</button><button class="btn sm" type="button" data-act="rep" data-a="${r.id}:warn">Avertir</button><button class="btn sm" type="button" data-act="player" data-a="${t.id}">Ouvrir la fiche…</button><button class="btn sm sun" type="button" data-act="rep" data-a="${r.id}:suspend">Suspendre 7 j</button></div>`:''}
    </article>`;}).join('')}</div>`:`<div class="empty"><b>${S.ui.mod==='open'?'Aucun signalement ouvert':'Aucun signalement traité'}</b></div>`);
};

/* ========================= anti-cheat ========================= */
V.anticheat=()=>{
  const list=S.d.flags,R=S.d.rules,c=S.counts||{};
  return head('Communauté','Anti-triche','Les scores qui déclenchent une règle restent hors des classements jusqu’à ta décision. Le serveur recalcule déjà chaque score : ces règles sont un deuxième filet.',tabs(S.ui.ac,'acTab',[['pending','À examiner',c.flags],['done','Traités',null]]))+`
  <div class="grid">
    <section class="c12">${!list?loading():list.length?`<div class="tblw"><table class="tbl"><thead><tr><th>Joueur</th><th>Jeu</th><th class="num">Résultat</th><th>Règle</th><th>Détail</th><th class="num">Confiance</th><th>Date</th><th></th></tr></thead><tbody>
      ${list.map(f=>`<tr><td><button class="btn sm ghost" type="button" data-act="player" data-a="${f.player.id}" style="padding:0 4px">${pav(f.player,24)} ${esc(f.player.name)}</button></td><td><span class="dot" style="background:${GM(f.game).col};border:1.5px solid #17142A"></span> ${esc(skLabel(f.sk))}</td><td class="num">${fmtScore(f.sk,f.score)}</td><td>${esc((RULES_META[f.rule]||{n:f.rule}).n)}</td><td class="tiny">${esc(f.detail||'')}</td>
        <td class="num"><span class="badge ${f.conf>=85?'bad':f.conf>=60?'warn':''}">${f.conf??'—'} %</span></td><td>${ago(f.t)}</td>
        <td class="act">${f.status==='pending'?`<button class="btn sm" type="button" data-act="flag" data-a="${f.id}:valid">Valider</button> <button class="btn sm sun" type="button" data-act="flag" data-a="${f.id}:void">Annuler le score</button> <button class="btn sm danger" type="button" data-act="flag" data-a="${f.id}:voidban">Annuler + suspendre</button>`:`<span class="badge ${f.status==='valid'?'good':'bad'}">${f.status==='valid'?'Validé':'Annulé'}</span>`}</td></tr>`).join('')}
    </tbody></table></div>`:`<div class="empty"><b>${S.ui.ac==='pending'?'Aucun score à examiner':'Rien de traité pour l’instant'}</b></div>`}</section>
    <section class="card c7"><div class="card-h"><h2>Règles de détection</h2><button class="btn sm primary" type="button" data-act="saveRules" ${R?'':'disabled'}>Enregistrer les règles</button></div>
      ${R?`<div>${Object.entries(RULES_META).map(([k,m])=>`<div class="rule">${sw('ruleOn',k,R[k].on,m.n)}<span><b>${m.n}</b><span class="tiny">${m.d}</span></span><span class="row" style="flex-wrap:nowrap"><input class="input mono" type="number" step="any" min="0" id="rule_${k}" value="${R[k].val}" aria-label="Seuil ${esc(m.n)}" style="width:76px"><span class="tiny">${m.unit}</span></span></div>`).join('')}
      <div class="rule">${sw('autoVoid','x',R.autoVoid,'Annulation automatique')}<span><b>Annulation automatique au-dessus de 95 % de confiance</b><span class="tiny">Sinon, tout passe par une décision humaine.</span></span><span></span></div></div>`:loading()}
    </section>
    <section class="card c5"><div class="card-h"><h2>Classements</h2></div>
      <p class="tiny">Remet à zéro un classement après une faille ou un changement de règles. Les parties sont archivées, pas supprimées.</p>
      <div class="field"><label for="lbReset">Classement</label><select class="input" id="lbReset"><option value="rating">Cote compétitive (retour à 1 000)</option>${GAMES0.filter(g=>!g.dev).flatMap(g=>g.id==='sprint'?TRACKS.map((t,i)=>`<option value="sprint@${i}">Neon Sprint · ${t}</option>`):[`<option value="${g.id}">${g.name}</option>`]).join('')}</select></div>
      <button class="btn danger" type="button" data-act="askLbReset">Réinitialiser…</button>
    </section>
  </div>`;
};

/* ========================= content ========================= */
V.content=()=>{
  const t=S.ui.ct,d=S.d;
  const top=head('Produit','Contenu des jeux','Questions, mots et réglages des jeux. Les changements sont visibles dans le jeu immédiatement.',tabs(t,'ctTab',[['questions','Questions Brain Battle',d.questions?d.questions.length:null],['words','Mots Word Rush',null],['games','Jeux',null]]));
  if(t==='words')return top+wordsView();
  if(t==='games')return top+gamesView();
  if(!d.questions)return top+loading();
  const f=S.ui.qf,q=f.q.trim().toLowerCase();
  const list=d.questions.filter(x=>(!q||x.q.fr.toLowerCase().includes(q)||x.q.en.toLowerCase().includes(q))&&(f.cat==='all'||x.cat===f.cat)&&(f.status==='all'||x.status===f.status));
  const pub=d.questions.filter(x=>x.status==='published').length;
  return top+`${pub<8?`<div class="empty" style="border-color:var(--bad);background:var(--bad-soft);margin-bottom:12px"><b>Moins de 8 questions publiées</b>Brain Battle ne peut pas démarrer tant qu’il n’y en a pas au moins 8.</div>`:''}
  <div class="filters" style="margin-bottom:12px">
    <div class="search">${ic('search',16)}<input class="input" id="qq" data-in="qq" value="${esc(f.q)}" placeholder="Rechercher une question" aria-label="Rechercher une question"></div>
    <div class="field"><label for="qcat">Catégorie</label><select class="input" id="qcat" data-ch="qcat"><option value="all">Toutes</option>${Object.entries(QCATS).map(([k,v])=>`<option value="${k}" ${f.cat===k?'selected':''}>${v}</option>`).join('')}</select></div>
    <div class="field"><label for="qst">Statut</label><select class="input" id="qst" data-ch="qst"><option value="all">Tous</option><option value="published" ${f.status==='published'?'selected':''}>Publiées</option><option value="draft" ${f.status==='draft'?'selected':''}>Brouillons</option></select></div>
    <button class="btn primary" type="button" data-act="qEdit" data-a="">${ic('plus',15)}Nouvelle question</button>
  </div>
  ${list.length?`<div class="tblw"><table class="tbl"><thead><tr><th>Question</th><th>Catégorie</th><th>Statut</th><th class="num">Réponses</th><th class="num">Réussite</th><th></th></tr></thead><tbody>
    ${list.map(x=>{const hard=x.plays>100&&x.rate<20,easy=x.plays>100&&x.rate>95;return `<tr><td style="min-width:260px"><b>${esc(x.q.fr)}</b><span class="sub">${esc(x.q.en)}</span><span class="sub">✓ ${esc(x.a[x.correct].fr)}</span></td><td>${QCATS[x.cat]}</td>
      <td>${x.status==='published'?'<span class="badge good">Publiée</span>':'<span class="badge warn">Brouillon</span>'}</td><td class="num">${fmt(x.plays)}</td>
      <td class="num">${x.plays?x.rate+' %':'—'}${hard?'<br><span class="badge bad">Trop dure ?</span>':easy?'<br><span class="badge warn">Trop facile ?</span>':''}</td>
      <td class="act"><button class="btn sm ghost" type="button" data-act="qEdit" data-a="${x.id}" aria-label="Modifier">${ic('edit',15)}</button><button class="btn sm ghost" type="button" data-act="qAct" data-a="${x.id}:toggle">${x.status==='published'?'Dépublier':'Publier'}</button><button class="btn sm ghost" type="button" data-act="askQDel" data-a="${x.id}" aria-label="Supprimer">${ic('trash',15)}</button></td></tr>`;}).join('')}
  </tbody></table></div><p class="tiny" style="margin-top:8px">Une question réussie par moins de 20 % ou plus de 95 % des joueurs (après 100 réponses) est signalée pour relecture.</p>`:`<div class="empty"><b>Aucune question ne correspond</b><button class="btn sm primary" type="button" data-act="qEdit" data-a="">Créer une question</button></div>`}`;
};
function qEditor(id){
  const x=S.ui.layer.draft||(id&&S.d.questions?S.d.questions.find(q=>q.id===id):null)||{cat:'cul',q:{fr:'',en:''},a:[{fr:'',en:''},{fr:'',en:''},{fr:'',en:''},{fr:'',en:''}],correct:0,status:'draft'};
  const e=S.ui.layer.err;
  return `<div class="m-h"><div><h2>${id?'Modifier la question':'Nouvelle question'}</h2><p>Chaque question existe en français et en anglais. Coche la bonne réponse : elle n’est jamais envoyée au navigateur des joueurs.</p></div><button class="x" type="button" data-act="close" aria-label="Fermer">${ic('x')}</button></div>
  <form data-form="question" data-id="${id||''}" class="stack" novalidate>
    <div class="fgrid"><div class="field"><label for="qeCat">Catégorie</label><select class="input" id="qeCat" name="cat">${Object.entries(QCATS).map(([k,v])=>`<option value="${k}" ${x.cat===k?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label for="qeSt">Statut</label><select class="input" id="qeSt" name="status"><option value="draft" ${x.status==='draft'?'selected':''}>Brouillon</option><option value="published" ${x.status==='published'?'selected':''}>Publiée</option></select></div>
      <div class="field full"><label for="qeFr">Question (FR)</label><input class="input" id="qeFr" name="qfr" value="${esc(x.q.fr)}" maxlength="160"></div>
      <div class="field full"><label for="qeEn">Question (EN)</label><input class="input" id="qeEn" name="qen" value="${esc(x.q.en)}" maxlength="160"></div></div>
    ${x.a.map((a,i)=>`<fieldset style="border:1.5px solid var(--line2);border-radius:12px;padding:10px 12px;margin:0"><legend class="tiny" style="padding:0 4px"><label><input type="radio" name="correct" value="${i}" ${x.correct===i?'checked':''}> Réponse ${i+1}${x.correct===i?' · bonne réponse':''}</label></legend>
      <div class="fgrid"><input class="input" name="a${i}fr" value="${esc(a.fr)}" placeholder="Français" aria-label="Réponse ${i+1} en français" maxlength="70"><input class="input" name="a${i}en" value="${esc(a.en)}" placeholder="English" aria-label="Réponse ${i+1} en anglais" maxlength="70"></div></fieldset>`).join('')}
    ${e?`<div class="empty" style="align-items:flex-start;text-align:left;border-color:var(--bad);background:var(--bad-soft)">${esc(e)}</div>`:''}
    <div class="row"><button class="btn primary" type="submit">Enregistrer</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div>
  </form>`;
}
function wordsView(){
  const L=S.ui.wl,w=S.d.words;
  const top=`<div class="card-h" style="margin:4px 0 12px">${tabs(L,'wlTab',[['fr','Français',w&&w.fr],['en','English',w&&w.en]])}</div>`;
  if(!w)return top+loading();
  const by={};w.list.forEach(x=>{(by[x.w.length]=by[x.w.length]||[]).push(x);});
  const sig={};w.list.forEach(x=>{const k=sorted(x.w);sig[k]=(sig[k]||0)+1;});
  return top+`<div class="card">
    <form data-form="word" class="filters" novalidate><div class="field" style="flex:1;min-width:160px"><label for="wNew">Nouveau mot</label><input class="input mono" id="wNew" name="w" placeholder="ex. ${L==='fr'?'TORTUE':'TURTLE'}" maxlength="12" autocomplete="off"></div>
      <div class="field" style="flex:1;min-width:140px"><label for="wCat">Catégorie (indice affiché)</label><input class="input" id="wCat" name="c" placeholder="Animal" maxlength="20"></div><button class="btn primary" type="submit">${ic('plus',15)}Ajouter</button></form>
    <p class="tiny">4 à 8 lettres, sans accents (retirés automatiquement). Un mot qui a une anagramme dans la liste est surligné : les deux sont acceptés.${w.list.length<25?` <b style="color:var(--bad)">Il faut au moins 25 mots pour une partie complète.</b>`:''}</p>
    ${Object.keys(by).sort().map(n=>`<div class="stack" style="gap:6px"><h3>${n} lettres <span class="tiny">· ${by[n].length}</span></h3><div class="chips">${by[n].map(x=>`<span class="wchip ${sig[sorted(x.w)]>1?'warn':''}">${x.w} <small>${esc(x.c)}</small><button type="button" data-act="wDel" data-a="${x.w}" aria-label="Supprimer ${x.w}">${ic('x',13)}</button></span>`).join('')}</div></div>`).join('')}
  </div>`;
}
function gamesView(){
  const g=S.d.games;if(!g)return loading();
  return `<div class="tblw" style="margin-top:4px"><table class="tbl"><thead><tr><th>Jeu</th><th>Actif</th><th>En vedette</th><th>Rotation Défi du jour</th><th class="num">Parties · 7 j</th></tr></thead><tbody>
    ${g.map(x=>{const G=GM(x.id);return `<tr><td><span class="row" style="flex-wrap:nowrap"><span class="pav" style="background:${G.col};width:26px;height:26px"></span><b>${esc(x.name)}</b>${x.dev?' <span class="badge">En développement</span>':''}</span></td>
      <td>${x.dev?'—':sw('gSet',x.id+':on',x.on,'Actif '+x.name)}</td><td>${x.dev?'—':sw('gSet',x.id+':featured',x.feat,'En vedette '+x.name)}</td><td>${x.dev?'—':sw('gSet',x.id+':daily',x.daily,'Défi du jour '+x.name)}</td><td class="num">${fmt(x.plays)}</td></tr>`;}).join('')}
  </tbody></table></div><p class="tiny" style="margin-top:8px">Désactiver un jeu le retire de la ludothèque et des Défis du jour. Les scores sont conservés.</p>`;
}

/* ========================= competitions ========================= */
const compStatus=c=>c.cancelled?['Annulée','']:Date.now()<c.start?['À venir','brand']:Date.now()>c.end?['Terminée','']:['En cours','good'];
V.competitions=()=>{
  const t=S.ui.cp,d=S.d.comps;
  const top=head('Produit','Compétitions','Tournois, Défis du jour et saisons.',tabs(t,'cpTab',[['list','Tournois',d?d.comps.length:null],['daily','Défi du jour',null],['season','Saison',null]]));
  if(!d)return top+loading();
  if(t==='daily')return top+`<section class="card"><div class="card-h"><h2>7 prochains jours</h2><button class="btn sm primary" type="button" data-act="saveDaily">Enregistrer le planning</button></div>
    <div class="days">${d.daily.map((x,i)=>`<div class="day"><b>${new Date(x.day).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'short'})}</b>${x.set?'':'<span class="tiny">automatique</span>'}
      <select class="input" id="dg${i}" data-ch="dailyGame" data-i="${i}" aria-label="Jeu du jour">${GAMES0.filter(g=>!g.dev).map(g=>`<option value="${g.id}" ${x.game===g.id?'selected':''}>${g.name}</option>`).join('')}</select>
      ${x.game==='sprint'?`<select class="input" id="dt${i}" aria-label="Circuit">${TRACKS.map((tn,j)=>`<option value="${j}" ${x.track===j?'selected':''}>${tn}</option>`).join('')}</select>`:''}</div>`).join('')}</div>
    <p class="tiny">Tous les joueurs ont le même tirage le même jour. Sans planning, le serveur choisit un jeu automatiquement.</p></section>`;
  if(t==='season'){const s=d.season||{n:1,end:Date.now()};return top+`<div class="grid"><section class="card c6"><div class="card-h"><h2>Saison ${s.n}</h2><span class="badge good">En cours</span></div>
    <dl class="kv"><dt>Fin prévue</dt><dd>${dLong(s.end)}</dd><dt>Jours restants</dt><dd>${Math.max(0,Math.ceil((s.end-Date.now())/DAY))}</dd></dl>
    <div class="field"><label for="seasonEnd">Modifier la date de fin</label><input class="input" type="date" id="seasonEnd" value="${new Date(s.end).toISOString().slice(0,10)}"></div>
    <div class="row"><button class="btn" type="button" data-act="seasonDate">Enregistrer la date</button><button class="btn danger" type="button" data-act="askSeasonClose">Clôturer maintenant…</button></div>
    <p class="tiny">Clôturer fige la saison et ramène chaque cote à mi-chemin de 1 000.</p></section>
    <section class="card c6"><h2>Saisons passées</h2>${d.past.length?`<div class="tblw"><table class="tbl"><thead><tr><th>Saison</th><th>Clôturée le</th><th class="num">Joueurs classés</th></tr></thead><tbody>${d.past.slice().reverse().map(p=>`<tr><td>Saison ${p.n}</td><td>${dLong(p.end)}</td><td class="num">${fmt(p.players||0)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><b>Aucune saison clôturée</b></div>'}</section></div>`;}
  return top+`<div class="row" style="justify-content:flex-end;margin-bottom:12px"><button class="btn primary" type="button" data-act="compNew">${ic('plus',15)}Créer une compétition</button></div>
  ${d.comps.length?`<div class="tblw"><table class="tbl"><thead><tr><th>Compétition</th><th>Jeu</th><th>Format</th><th>Dates</th><th>Ouverte à</th><th>Sponsor</th><th class="num">Participants</th><th>Statut</th><th></th></tr></thead><tbody>
  ${d.comps.map(c=>{const st=compStatus(c),sp=d.sponsors.find(s=>s.id===c.sponsor),sch=c.school==='all'?'Toutes les écoles':((d.schools.find(s=>s.id===c.school)||{}).short||'—');return `<tr><td><b>${esc(c.name)}</b><span class="sub">${esc(c.reward)}</span></td><td>${GM(c.game).name}</td><td>${FORMATS[c.format]}</td><td>${dShort(c.start)} → ${dShort(c.end)}</td>
    <td>${c.vis==='public'?'Publique':'Privée'} · ${esc(sch)}</td><td>${sp?esc(sp.name)+' <span class="badge">sponsorisé</span>':'—'}</td><td class="num">${fmt(c.players)}</td><td><span class="badge ${st[1]}">${st[0]}</span></td>
    <td class="act">${st[0]==='À venir'?`<button class="btn sm ghost" type="button" data-act="askCompCancel" data-a="${c.id}">Annuler</button>`:''}<button class="btn sm ghost" type="button" data-act="compAct" data-a="${c.id}:dup" aria-label="Dupliquer">${ic('copy',15)}</button></td></tr>`;}).join('')}
  </tbody></table></div>`:'<div class="empty"><b>Aucune compétition</b>Crée la première pour un campus ou un sponsor.</div>'}`;
};
function compForm(){
  const e=S.ui.layer.err,v=S.ui.layer.vals||{},d=S.d.comps,in7=new Date(Date.now()+7*DAY).toISOString().slice(0,10),in8=new Date(Date.now()+8*DAY).toISOString().slice(0,10);
  return `<div class="m-h"><div><h2>Créer une compétition</h2><p>Les lots sont offerts par RYVO ou un sponsor. Pas d’inscription payante avec gains en argent.</p></div><button class="x" type="button" data-act="close" aria-label="Fermer">${ic('x')}</button></div>
  <form data-form="comp" class="stack" novalidate><div class="fgrid">
    <div class="field full"><label for="cfName">Nom</label><input class="input" id="cfName" name="name" maxlength="60" value="${esc(v.name||'')}" placeholder="ex. Coupe Skyline du BDE"></div>
    <div class="field"><label for="cfGame">Jeu</label><select class="input" id="cfGame" name="game">${GAMES0.filter(g=>!g.dev).map(g=>`<option value="${g.id}" ${v.game===g.id?'selected':''}>${g.name}</option>`).join('')}</select></div>
    <div class="field"><label for="cfFmt">Format</label><select class="input" id="cfFmt" name="format">${Object.entries(FORMATS).map(([k,l])=>`<option value="${k}" ${v.format===k?'selected':''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label for="cfStart">Début</label><input class="input" type="date" id="cfStart" name="start" value="${v.start||in7}"></div>
    <div class="field"><label for="cfEnd">Fin</label><input class="input" type="date" id="cfEnd" name="end" value="${v.end||in8}"></div>
    <div class="field"><label for="cfVis">Visibilité</label><select class="input" id="cfVis" name="vis"><option value="private">Privée</option><option value="public" ${v.vis==='public'?'selected':''}>Publique</option></select></div>
    <div class="field"><label for="cfSch">Écoles</label><select class="input" id="cfSch" name="school"><option value="all">Toutes les écoles</option>${d.schools.map(s=>`<option value="${s.id}" ${v.school===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="cfSp">Sponsor</label><select class="input" id="cfSp" name="sponsor"><option value="">Aucun</option>${d.sponsors.map(s=>`<option value="${s.id}" ${v.sponsor===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="cfRw">Récompense</label><input class="input" id="cfRw" name="reward" maxlength="80" value="${esc(v.reward||'')}" placeholder="ex. Cadre exclusif + goodies"></div>
  </div>${e?`<div class="empty" style="border-color:var(--bad);background:var(--bad-soft);padding:12px">${esc(e)}</div>`:''}<div class="row"><button class="btn primary" type="submit">Créer</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div></form>`;
}

/* ========================= schools ========================= */
V.schools=()=>{
  const t=S.ui.sc,d=S.d.schools,c=S.counts||{};
  const top=head('Partenaires','Écoles','Établissements, demandes de vérification et responsables de campus.',tabs(t,'scTab',[['list','Établissements',d?d.schools.length:null],['verifs','Vérifications',c.verifs],['managers','Responsables',d?d.managers.length:null]]));
  if(!d)return top+loading();
  if(t==='verifs')return top+`<p class="tiny" style="margin-bottom:10px">${ic('info',14)} Une adresse de l’école ne prouve pas à elle seule l’inscription (anciens élèves, personnel). En cas de doute, demande une confirmation à l’école avant d’approuver.</p>`+(d.verifs.length?`<div class="tblw"><table class="tbl"><thead><tr><th>Étudiant</th><th>École</th><th>Adresse</th><th>Domaine</th><th>Envoyée</th><th></th></tr></thead><tbody>
    ${d.verifs.map(v=>{const s=d.schools.find(x=>x.id===v.school);return `<tr><td><button class="btn sm ghost" type="button" data-act="player" data-a="${v.player.id}" style="padding:0 4px">${pav(v.player,24)} ${esc(v.player.name)}</button></td><td>${esc(s?s.short:'—')}</td><td class="mono">${esc(v.local)}@${esc(v.domain)}</td>
      <td>${v.match?'<span class="badge good">Correspond</span>':'<span class="badge bad">Ne correspond pas</span>'}</td><td>${ago(v.t)}</td>
      <td class="act"><button class="btn sm good" type="button" data-act="verif" data-a="${v.id}:ok">Approuver</button> <button class="btn sm" type="button" data-act="verif" data-a="${v.id}:no">Refuser</button></td></tr>`;}).join('')}</tbody></table></div>`:`<div class="empty"><b>Aucune demande en attente</b></div>`);
  if(t==='managers')return top+`<div class="grid"><section class="c8">${d.managers.length?`<div class="tblw"><table class="tbl"><thead><tr><th>Nom</th><th>École</th><th>Fonction</th><th>Ajouté</th><th></th></tr></thead><tbody>
    ${d.managers.map(m=>`<tr><td><b>${esc(m.name)}</b><span class="sub">${esc(m.email)}</span></td><td>${esc((d.schools.find(s=>s.id===m.school)||{}).short||'—')}</td><td>${esc(m.role)}</td><td>${ago(m.t)}</td><td class="act"><button class="btn sm ghost" type="button" data-act="mgrDel" data-a="${m.id}">Retirer</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty"><b>Aucun responsable</b>Ajoute le contact de chaque école partenaire.</div>'}</section>
    <section class="card c4"><h2>Ajouter un responsable</h2><form data-form="mgr" class="stack" novalidate>
      <div class="field"><label for="mgName">Nom</label><input class="input" id="mgName" name="name" maxlength="40"></div>
      <div class="field"><label for="mgMail">E-mail professionnel</label><input class="input" id="mgMail" name="mail" type="email"></div>
      <div class="field"><label for="mgSch">École</label><select class="input" id="mgSch" name="school">${d.schools.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
      <div class="field"><label for="mgRole">Fonction</label><input class="input" id="mgRole" name="role" maxlength="40" placeholder="ex. Président du BDE"></div>
      <button class="btn primary" type="submit" ${d.schools.length?'':'disabled'}>Ajouter</button><p class="tiny">Fiche de contact pour l’équipe. L’accès des écoles à un tableau de bord viendra plus tard.</p></form></section></div>`;
  const np=d.schools.filter(s=>s.by_player).length;
  return top+`<div class="row" style="justify-content:space-between;margin-bottom:12px"><p class="tiny" style="max-width:62ch">Les joueurs ajoutent eux-mêmes leur école depuis Campus (nom, ville, pays ; doublons évités automatiquement). ${np?`<b>${np} ajoutée${np>1?'s':''} par des joueurs.</b> `:''}Renomme, fusionne les doublons ou supprime les faux établissements. Le domaine e-mail est facultatif : il sert seulement au badge « vérifié ».</p><button class="btn primary" type="button" data-act="schoolEdit" data-a="">${ic('plus',15)}Ajouter un établissement</button></div>
  ${d.schools.length?`<div class="tblw"><table class="tbl"><thead><tr><th>Établissement</th><th>Ville</th><th>Domaine e-mail</th><th>Statut</th><th class="num">Joueurs</th><th class="num">Vérifiés</th><th></th></tr></thead><tbody>
  ${d.schools.map(s=>{const st=SCH_STATUS[s.status]||SCH_STATUS.none;return `<tr><td><span class="row" style="flex-wrap:nowrap"><span class="pav" style="background:${s.col};font-size:9px;width:34px">${esc(s.short)}</span><span style="min-width:0"><b>${esc(s.name)}</b>${s.by_player?`<span class="sub">Ajoutée par ${esc(s.creator||'un joueur supprimé')} · ${ago(s.t)}</span>`:''}</span></span></td><td>${esc(s.city)}, ${esc(s.country)}</td><td class="mono">${s.domain?'@'+esc(s.domain):'<span class="sub">—</span>'}</td><td><span class="badge ${st[1]}">${st[0]}</span></td><td class="num">${s.players}</td><td class="num">${s.verified}</td><td class="act"><button class="btn sm ghost" type="button" data-act="schoolEdit" data-a="${s.id}" aria-label="Modifier">${ic('edit',15)}</button>${d.schools.length>1?`<button class="btn sm ghost" type="button" data-act="askSchoolMerge" data-a="${s.id}">Fusionner</button>`:''}<button class="btn sm ghost" type="button" data-act="askSchoolDel" data-a="${s.id}" style="color:var(--bad)">Supprimer</button></td></tr>`;}).join('')}
  </tbody></table></div>`:'<div class="empty"><b>Aucun établissement</b>Les joueurs ajoutent leur école depuis Campus. Tu peux aussi en créer ici.</div>'}`;
};
function schoolForm(id){
  const s=(id&&S.d.schools?S.d.schools.schools.find(x=>x.id===id):null)||{name:'',short:'',city:'',country:'France',domain:'',status:'none',col:'#5B4BFF'},e=S.ui.layer.err,v=Object.assign({},s,S.ui.layer.vals||{});
  const PAL=['#5B4BFF','#3D7BFF','#8B5CF6','#FF6B3D','#FF4FA0','#00A6C8','#14B37A','#E0A100','#F23F55'];
  return `<div class="m-h"><div><h2>${id?'Modifier l’établissement':'Ajouter un établissement'}</h2></div><button class="x" type="button" data-act="close" aria-label="Fermer">${ic('x')}</button></div>
  <form data-form="school" data-id="${id||''}" class="stack" novalidate><div class="fgrid">
    <div class="field full"><label for="sfName">Nom complet</label><input class="input" id="sfName" name="name" value="${esc(v.name)}" maxlength="80"></div>
    <div class="field"><label for="sfShort">Sigle</label><input class="input" id="sfShort" name="short" value="${esc(v.short)}" maxlength="5"></div>
    <div class="field"><label for="sfDom">Domaine e-mail (facultatif)</label><input class="input mono" id="sfDom" name="domain" value="${esc(v.domain||'')}" placeholder="ecole.fr"><span class="help">Sans le @. Active le badge « vérifié » : les étudiants demandent le badge avec une adresse de ce domaine.</span></div>
    <div class="field"><label for="sfCity">Ville</label><input class="input" id="sfCity" name="city" value="${esc(v.city)}" maxlength="40"></div>
    <div class="field"><label for="sfCountry">Pays</label><input class="input" id="sfCountry" name="country" value="${esc(v.country)}" maxlength="40"></div>
    <div class="field"><label for="sfSt">Statut</label><select class="input" id="sfSt" name="status">${Object.entries(SCH_STATUS).map(([k,l])=>`<option value="${k}" ${v.status===k?'selected':''}>${l[0]}</option>`).join('')}</select></div>
    <div class="field"><span class="lab">Couleur</span><div class="row">${PAL.map(c=>`<label style="cursor:pointer"><input type="radio" name="col" value="${c}" ${v.col===c?'checked':''} style="position:absolute;opacity:0"><span class="pav" style="background:${c};width:28px;height:28px;${v.col===c?'box-shadow:0 0 0 3px #FFC93C':''}"></span></label>`).join('')}</div></div>
  </div>${e?`<div class="empty" style="border-color:var(--bad);background:var(--bad-soft);padding:12px">${esc(e)}</div>`:''}<div class="row"><button class="btn primary" type="submit">Enregistrer</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div></form>`;
}

/* ========================= business ========================= */
V.business=()=>{
  const d=S.d.biz;if(!d)return head('Partenaires','Revenus','')+loading();
  const mrr=d.subs*d.plus_price,inv=d.invoices,paid=inv.filter(i=>i.status==='paid').reduce((s,i)=>s+Number(i.amount),0),due=inv.filter(i=>i.status!=='paid').reduce((s,i)=>s+Number(i.amount),0);
  const SER=[['plus','Abonnements Plus','#5B4BFF'],['campus','Licences campus','#FFC93C'],['events','Événements & team building','#14B37A'],['sponsors','Sponsors','#FF6B3D']];
  const rev=d.rev||[],tot=rev.map(r=>SER.reduce((s,x)=>s+Number(r[x[0]]||0),0)),max=Math.max(100,Math.ceil(Math.max(...tot,0)/100)*100);
  const W=640,H=220,pl=56,pr=10,pt=12,pb=26,y=v=>pt+(H-pt-pb)*(1-v/max),bw=(W-pl-pr)/Math.max(1,rev.length);
  const chart=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenus par mois et par source, sur 6 mois" style="width:100%;height:auto">
    <g class="gl">${[0,max/2,max].map(t=>`<line x1="${pl}" x2="${W-pr}" y1="${y(t)}" y2="${y(t)}"/><text x="${pl-6}" y="${y(t)+3}" text-anchor="end">${fmt(t)} €</text>`).join('')}</g>
    ${rev.map((r,i)=>{let acc=0;return SER.map(([k,,c])=>{const v=Number(r[k]||0);if(!v)return '';const y0=y(acc),y1=y(acc+v);acc+=v;return `<rect x="${pl+i*bw+10}" y="${y1}" width="${bw-20}" height="${y0-y1}" fill="${c}" stroke="#17142A" stroke-width="1.5"/>`;}).join('')+`<text x="${pl+i*bw+bw/2}" y="${H-8}" text-anchor="middle">${new Date(r.m).toLocaleDateString('fr-FR',{month:'short'})}</text>${tot[i]?`<text x="${pl+i*bw+bw/2}" y="${y(tot[i])-5}" text-anchor="middle" style="fill:#17142A;font-weight:700">${fmt(tot[i])}</text>`:''}`;}).join('')}</svg>`;
  const ist={paid:['Payée','good'],pending:['En attente',''],late:['En retard','bad']};
  return head('Partenaires','Revenus','Encaissements par source. Les abonnements Plus apparaîtront quand le paiement sera branché.')+`
  <div class="kpis" style="margin-bottom:16px">
    <div class="kpi"><small>Abonnements Plus / mois</small><b>${eur(mrr)}</b><span class="d">${d.subs} abonnés</span></div>
    <div class="kpi"><small>Encaissé (factures)</small><b>${eur(paid)}</b><span class="d">${inv.filter(i=>i.status==='paid').length} factures payées</span></div>
    <div class="kpi ${inv.some(i=>i.status==='late')?'alert':''}"><small>À encaisser</small><b>${eur(due)}</b><span class="d">${inv.filter(i=>i.status==='late').length} en retard</span></div>
    <div class="kpi"><small>Sponsors</small><b>${d.sponsors.length}</b><span class="d">${d.sponsors.filter(s=>s.status==='Signé').length} signés</span></div>
  </div>
  <div class="grid">
    <section class="card c12"><div class="card-h"><h2>Revenus par mois</h2><div class="legend">${SER.map(s=>`<span><i style="background:${s[2]}"></i>${s[1]}</span>`).join('')}</div></div>${chart}</section>
    <section class="c8"><div class="card-h" style="margin-bottom:10px"><h2>Factures</h2></div>${inv.length?`<div class="tblw"><table class="tbl"><thead><tr><th>N°</th><th>Client</th><th>Type</th><th class="num">Montant</th><th>Échéance</th><th>Statut</th><th></th></tr></thead><tbody>
      ${inv.map(i=>`<tr><td class="mono">${esc(i.id)}</td><td><b>${esc(i.client)}</b></td><td>${esc(i.type)}</td><td class="num">${eur(i.amount)}</td><td>${dShort(i.due)}</td><td><span class="badge ${ist[i.status][1]}">${ist[i.status][0]}</span></td>
        <td class="act">${i.status!=='paid'?`<button class="btn sm" type="button" data-act="inv" data-a="paid:${i.id}">Marquer payée</button>${i.status==='late'?` <button class="btn sm sun" type="button" data-act="inv" data-a="remind:${i.id}">Noter une relance</button>`:''}`:''}</td></tr>`).join('')}
    </tbody></table></div>`:'<div class="empty"><b>Aucune facture</b></div>'}</section>
    <section class="card c4"><h2>Nouvelle facture</h2><form data-form="invoice" class="stack" novalidate>
      <div class="field"><label for="ivC">Client</label><input class="input" id="ivC" name="client" maxlength="80"></div>
      <div class="field"><label for="ivT">Type</label><select class="input" id="ivT" name="type"><option>Licence campus</option><option>Événement BDE</option><option>Team building</option><option>Sponsoring</option></select></div>
      <div class="fgrid"><div class="field"><label for="ivA">Montant (€)</label><input class="input" id="ivA" name="amount" type="number" min="1" step="1"></div><div class="field"><label for="ivD">Échéance</label><input class="input" id="ivD" name="due" type="date" value="${new Date(Date.now()+30*DAY).toISOString().slice(0,10)}"></div></div>
      <button class="btn primary" type="submit">Créer</button><p class="tiny">Suivi interne. La facture légale reste à émettre depuis ton outil de facturation.</p></form></section>
    <section class="c8"><div class="card-h" style="margin-bottom:10px"><h2>Sponsors</h2></div>${d.sponsors.length?`<div class="tblw"><table class="tbl"><thead><tr><th>Marque</th><th>Contrat</th><th>Période</th><th class="num">Montant</th><th>Statut</th></tr></thead><tbody>
      ${d.sponsors.map(s=>`<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.contract)}</td><td>${esc(s.period)}</td><td class="num">${eur(s.amount)}</td><td><span class="badge ${s.status==='Signé'?'good':'warn'}">${esc(s.status)}</span></td></tr>`).join('')}
    </tbody></table></div>`:'<div class="empty"><b>Aucun sponsor</b></div>'}</section>
    <section class="card c4"><h2>Nouveau sponsor</h2><form data-form="sponsor" class="stack" novalidate>
      <div class="field"><label for="spN">Marque</label><input class="input" id="spN" name="name" maxlength="60"></div>
      <div class="field"><label for="spC">Contrat</label><input class="input" id="spC" name="contract" maxlength="80" placeholder="ex. Tournoi de rentrée"></div>
      <div class="fgrid"><div class="field"><label for="spP">Période</label><input class="input" id="spP" name="period" maxlength="40"></div><div class="field"><label for="spA">Montant (€)</label><input class="input" id="spA" name="amount" type="number" min="0" step="1"></div></div>
      <div class="field"><label for="spS">Statut</label><select class="input" id="spS" name="status"><option>En négociation</option><option>Signé</option></select></div>
      <button class="btn primary" type="submit">Ajouter</button></form></section>
  </div>`;
};

/* ========================= team & audit ========================= */
V.team=()=>{
  const t=S.d.team,log=S.d.log;if(!t)return head('Administration','Équipe & journal','')+loading();
  return head('Administration','Équipe & journal','Qui peut faire quoi, et la trace de chaque action.')+`
  <div class="grid">
    <section class="c8"><div class="tblw"><table class="tbl"><thead><tr><th>Membre</th><th>Rôle</th><th>Double authentification</th><th>Dernière connexion</th><th></th></tr></thead><tbody>
      ${t.admins.map(a=>`<tr><td><b>${esc(a.name)}</b>${a.me?' <span class="badge ink">toi</span>':''}<span class="sub">${esc(a.mail)}</span></td>
        <td><select class="input" style="height:32px" data-ch="adminRole" data-id="${a.id}" aria-label="Rôle de ${esc(a.name)}" ${a.me?'disabled':''}>${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${a.role===k?'selected':''}>${v}</option>`).join('')}</select></td>
        <td>${a.tfa?'<span class="badge good">Activée</span>':'<span class="badge warn">À activer</span>'}</td><td>${a.last?ago(a.last):'—'}</td><td class="act">${a.me?'':`<button class="btn sm ghost" type="button" data-act="askRemove" data-a="${a.id}" data-n="${esc(a.name)}">Retirer</button>`}</td></tr>`).join('')}
      ${t.invites.map(i=>`<tr><td><b>${esc(i.mail)}</b><span class="sub">Invitation en attente</span></td><td>${ROLES[i.role]}</td><td>—</td><td>—</td><td class="act"><button class="btn sm ghost" type="button" data-act="cancelInvite" data-a="${esc(i.mail)}">Annuler</button></td></tr>`).join('')}
    </tbody></table></div><p class="tiny" style="margin-top:8px">La console impose la double authentification à chaque connexion : un membre sans application d’authentification ne peut rien faire.</p></section>
    <section class="card c4"><h2>Inviter un membre</h2><form data-form="admin" class="stack" novalidate>
      <div class="field"><label for="adMail">E-mail</label><input class="input" id="adMail" name="mail" type="email"></div>
      <div class="field"><label for="adRole">Rôle</label><select class="input" id="adRole" name="role">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${k==='mod'?'selected':''}>${v}</option>`).join('')}</select></div>
      <button class="btn primary" type="submit">Créer l’invitation</button>
      <p class="tiny">La personne crée un compte joueur avec cette adresse (ou utilise le sien), confirme son e-mail, puis se connecte ici : le rôle s’applique automatiquement. Aucun e-mail n’est envoyé par la console, préviens-la toi-même.</p></form></section>
    <section class="card c12"><div class="card-h"><h2>Droits par rôle</h2></div><div class="tblw"><table class="tbl perm"><thead><tr><th>Section</th>${Object.values(ROLES).map(r=>`<th style="text-align:center">${r}</th>`).join('')}</tr></thead><tbody>
      ${SECTIONS.map(s=>`<tr><td>${s[1]}</td>${Object.keys(ROLES).map(k=>`<td>${k==='super'||s[3].includes(k)?'<span style="color:var(--good)">'+ic('check',16)+'</span>':'<span class="mute">—</span>'}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div></section>
    <section class="card c12"><div class="card-h"><h2>Journal d’audit</h2><div class="row"><div class="search" style="min-width:220px">${ic('search',16)}<input class="input" id="logq" data-in="logq" value="${esc(S.ui.logq)}" placeholder="Filtrer le journal" aria-label="Filtrer le journal"></div></div></div>
      <div id="logBox">${logList(log)}</div><p class="tiny">Le journal ne peut être ni modifié ni effacé depuis le web, même par un Super admin.</p></section>
  </div>`;
};

/* ========================= layer ========================= */
function confirmHTML(c){
  return `<div class="m-h"><div><h2>${esc(c.title)}</h2><p>${esc(c.body)}</p></div><button class="x" type="button" data-act="close" aria-label="Fermer">${ic('x')}</button></div>
  ${c.reason?`<div class="field"><label for="cfReason">Motif (obligatoire)</label><select class="input" id="cfReason">${MOTIFS.map(m=>`<option>${m}</option>`).join('')}</select></div><div class="field"><label for="cfNote">Précisions</label><textarea class="input" id="cfNote" placeholder="Ce que l’équipe doit savoir"></textarea></div>`:''}
  ${c.kind==='schoolMerge'?`<div class="field"><label for="cfInto">École à garder</label><select class="input" id="cfInto">${(S.d.schools?S.d.schools.schools:[]).filter(s=>s.id!==c.sid).map(s=>`<option value="${s.id}">${esc(s.name)} · ${esc(s.city)} (${esc(s.short)}, ${s.players} joueur${s.players>1?'s':''})</option>`).join('')}</select></div>`:''}
  ${c.word?`<div class="field"><label for="cfType">Tape <b>${esc(c.word)}</b> pour confirmer</label><input class="input mono" id="cfType" autocomplete="off"></div><p class="tiny" id="cfErr" style="color:var(--bad);font-weight:600"></p>`:''}
  <div class="row"><button class="btn ${c.danger?'danger':'primary'}" type="button" data-act="confirmYes">${esc(c.ok)}</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div>`;
}
function renderLayer(){
  const Lr=S.ui.layer,el=$('#layer');
  if(!Lr){el.innerHTML='';return;}
  let body='',cls='modal';
  if(Lr.type==='player'){cls='drawer';body=playerDrawer();}
  else if(Lr.type==='q')body=qEditor(Lr.id);
  else if(Lr.type==='comp')body=compForm();
  else if(Lr.type==='school')body=schoolForm(Lr.id);
  else if(Lr.type==='confirm')body=confirmHTML(Lr);
  el.innerHTML=`<div class="scrim" data-act="scrim"></div><div class="${cls}" role="dialog" aria-modal="true">${body}</div>`;
}
function render(){
  const ae=document.activeElement,keep=ae&&ae.id&&$('#main').contains(ae)?{id:ae.id,s:ae.selectionStart,e:ae.selectionEnd}:null;
  $('#rail').innerHTML=railHTML();$('#top').innerHTML=topHTML();
  if(S.auth.stage!=='ready'){$('#main').innerHTML=gateHTML();$('#layer').innerHTML='';return;}
  const sec=S.ui.sec;
  $('#main').innerHTML=(S.d.err?`<div class="empty" style="border-color:var(--bad);background:var(--bad-soft);margin-bottom:14px"><b>Chargement impossible</b>${esc(S.d.err)}<button class="btn sm" type="button" data-act="sec" data-a="${sec}">Réessayer</button></div>`:'')+(can(sec)?V[sec]():`<div class="denied">${ic('lock',28)}<h2>Accès refusé pour le rôle ${ROLES[S.role]}</h2></div>`);
  renderLayer();
  if(keep){const n=document.getElementById(keep.id);if(n){n.focus();try{n.setSelectionRange(keep.s,keep.e);}catch(e){}}}
}
