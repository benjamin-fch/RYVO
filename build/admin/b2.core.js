<script>
(function(){
'use strict';
/* ========================= utils ========================= */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Math.round(n).toLocaleString('fr-FR');
const eur=n=>Math.round(n).toLocaleString('fr-FR')+' €';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rng(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let x=Math.imul(a^a>>>15,1|a);x=x+Math.imul(x^x>>>7,61|x)^x;return((x^x>>>14)>>>0)/4294967296;};}
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
const DAY=864e5;let NOW=Date.now();
const dShort=ts=>new Date(ts).toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
const dLong=ts=>new Date(ts).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
const dTime=ts=>new Date(ts).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
function ago(ts){const s=Math.max(1,Math.round((Date.now()-ts)/1000));if(s<60)return 'il y a '+s+' s';const m=Math.round(s/60);if(m<60)return 'il y a '+m+' min';const h=Math.round(m/60);if(h<24)return 'il y a '+h+' h';const d=Math.round(h/24);return 'il y a '+d+' j';}
const norm=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z]/g,'');
const sorted=s=>s.split('').sort().join('');

const ICONS={
  home:'<path d="M3 9.5 10 4l7 5.5V17a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1z"/>',
  users:'<circle cx="7.5" cy="7" r="3"/><path d="M2 17c.5-3 2.7-5 5.5-5s5 2 5.5 5M13 4.2a3 3 0 0 1 0 5.6M15 12c1.8.6 3 2.4 3.3 5"/>',
  flag:'<path d="M4 18V3M4 3h10l-2 4 2 4H4"/>',
  shield:'<path d="M10 2.5 16 5v5c0 4-2.8 6.5-6 7.5-3.2-1-6-3.5-6-7.5V5z"/>',
  book:'<path d="M3 4h5a2 2 0 0 1 2 2v11a2 2 0 0 0-2-2H3zM17 4h-5a2 2 0 0 0-2 2v11a2 2 0 0 1 2-2h5z"/>',
  campus:'<path d="M2 8l8-4 8 4-8 4zM5 9.5V14c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5V9.5M18 8v5"/>',
  trophy:'<path d="M6 3h8v4.5a4 4 0 0 1-8 0zM6 5H3v1a3 3 0 0 0 3 3M14 5h3v1a3 3 0 0 1-3 3M10 11.5V14M7 17.5h6M8 14h4v3.5H8z"/>',
  euro:'<path d="M15 5.5A6 6 0 1 0 15 14.5M3 8.5h8M3 11.5h8"/>',
  key:'<circle cx="7" cy="12" r="4"/><path d="M10 9l7-7M14 5l2 2M12 7l2 2"/>',
  search:'<circle cx="9" cy="9" r="5.5"/><path d="M13 13l4.5 4.5"/>',
  x:'<path d="M5 5l10 10M15 5 5 15"/>',
  check:'<path d="M4 10.5 8 14.5 16 5.5"/>',
  plus:'<path d="M10 4v12M4 10h12"/>',
  lock:'<rect x="4" y="9" width="12" height="9" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>',
  info:'<circle cx="10" cy="10" r="8"/><path d="M10 9v5M10 6.2v.1"/>',
  alert:'<path d="M10 3 2 17h16zM10 8v4M10 14.5v.1"/>',
  cal:'<rect x="3" y="4.5" width="14" height="13" rx="2"/><path d="M3 8.5h14M7 3v3M13 3v3"/>',
  edit:'<path d="M4 16l1-4 8-8 3 3-8 8zM12 5l3 3"/>',
  trash:'<path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11"/>',
  copy:'<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M13 7V4H4v9h3"/>',
  eye:'<path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z"/><circle cx="10" cy="10" r="2.5"/>',
  doc:'<path d="M5 2.5h7l3 3V17.5H5zM12 2.5v3h3M8 10h5M8 13h5"/>',
  refresh:'<path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v3.5h-3.5"/>',
  bolt:'<path d="M11 2 4 11h5l-1 7 7-9h-5z"/>'
};
const ic=(n,s=17)=>`<svg class="ic" width="${s}" height="${s}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]||''}</svg>`;
const LOGO=`<svg width="32" height="32" viewBox="0 0 34 34" aria-hidden="true"><rect x="1" y="1" width="32" height="32" rx="10" fill="#5B4BFF" stroke="#fff" stroke-width="2"/><path d="M8 9h6l5 8-5 8H8l5-8z" fill="#fff" stroke="#17142A" stroke-width="1.6" stroke-linejoin="round"/><path d="M27 9h-5l-5 8 5 8h5l-5-8z" fill="#FFC93C" stroke="#17142A" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

/* ========================= reference data ========================= */
const SCH0=[
  {id:'nbu',name:'Northbridge University',short:'NBU',city:'Lyon',country:'France',domain:'northbridge.demo',col:'#3D7BFF',status:'paid'},
  {id:'lys',name:'Université de Lysière',short:'UdL',city:'Lyon',country:'France',domain:'lysiere.demo',col:'#8B5CF6',status:'free'},
  {id:'cbs',name:'Coastal Business School',short:'CBS',city:'Le Havre',country:'France',domain:'coastal-bs.demo',col:'#FF6B3D',status:'paid'},
  {id:'hit',name:'Halvorsen Institute of Technology',short:'HIT',city:'Oslo',country:'Norvège',domain:'halvorsen.demo',col:'#00A6C8',status:'none'},
  {id:'evc',name:'Eastvale College',short:'EVC',city:'Manchester',country:'Royaume-Uni',domain:'eastvale.demo',col:'#FF4FA0',status:'free'},
  {id:'mir',name:'Mirandel Academy',short:'MIR',city:'Madrid',country:'Espagne',domain:'mirandel.demo',col:'#E0A100',status:'none'},
  {id:'ksu',name:'Kestrel State University',short:'KSU',city:'Toronto',country:'Canada',domain:'kestrel.demo',col:'#14B37A',status:'none'},
  {id:'ari',name:'Arisaka Institute',short:'ARI',city:'Osaka',country:'Japon',domain:'arisaka.demo',col:'#F23F55',status:'none'}
];
const SCH_STATUS={paid:['Partenaire payant','good'],free:['Partenaire gratuit','brand'],none:['Non partenaire','']};
const PROGRAMS={bus1:'Commerce · 1re année',bus2:'Commerce · 2e année',eng1:'Ingénierie · 1re année',eng2:'Ingénierie · 2e année',log1:'Logistique · Master 1',des3:'Design · 3e année',cs2:'Informatique · 2e année',law1:'Droit · 1re année'};
const PROG_IDS=Object.keys(PROGRAMS);
const YEARS={'1':'1re année (Bac+1)','2':'2e année (Bac+2)','3':'3e année (Bac+3)','4':'4e année (Bac+4)','5':'5e année (Bac+5)','6':'6e année et plus'};
const GAMES0=[
  {id:'sprint',name:'Neon Sprint',col:'#3D7BFF'},{id:'reflex',name:'Reflex Arena',col:'#FF6B3D'},{id:'brain',name:'Brain Battle',col:'#8B5CF6'},{id:'cards',name:'Card Clash',col:'#FFB800'},
  {id:'stack',name:'Skyline Stack',col:'#FF4FA0'},{id:'grid',name:'Grid Lock',col:'#14B37A'},{id:'words',name:'Word Rush',col:'#00A6C8'},{id:'aim',name:'Pop Shot',col:'#F23F55'},{id:'party',name:'Pulse Party',col:'#B5B0C7',dev:true}
];
const TRACKS=['City Loop','Canyon Run','Harbor Hairpin'];
const QCATS={sci:'Sciences',geo:'Géographie',his:'Histoire',spo:'Sport',tec:'Tech',bus:'Business',cul:'Culture'};
const ROLES={super:'Super admin',mod:'Modération',content:'Contenu',partner:'Partenariats'};
const SECTIONS=[
  ['overview','Vue d’ensemble','home',['super','mod','content','partner'],null],
  ['players','Joueurs','users',['super','mod'],'Communauté'],
  ['moderation','Signalements','flag',['super','mod'],'Communauté'],
  ['anticheat','Anti-triche','shield',['super','mod'],'Communauté'],
  ['content','Contenu des jeux','book',['super','content'],'Produit'],
  ['competitions','Compétitions','trophy',['super','content','partner'],'Produit'],
  ['schools','Écoles','campus',['super','partner'],'Partenaires'],
  ['business','Revenus','euro',['super','partner'],'Partenaires'],
  ['team','Équipe & journal','key',['super'],'Administration']
];
const SEC=Object.fromEntries(SECTIONS.map(s=>[s[0],s]));
const RULES_META={
  reflex_min:{n:'Réflexe sous le seuil humain',d:'Signale une moyenne Reflex Arena plus rapide que le seuil.',unit:'ms'},
  sprint_min:{n:'Temps sous la limite physique',d:'Signale une course Neon Sprint plus rapide que ce % du par.',unit:'% du par'},
  zscore:{n:'Bond anormal par rapport à l’historique',d:'Écart au score moyen du joueur, en écarts-types.',unit:'σ'},
  rate:{n:'Cadence de parties anormale',d:'Nombre de parties soumises par heure.',unit:'parties/h'},
  words_speed:{n:'Mots trouvés trop vite',d:'Temps moyen par mot dans Word Rush.',unit:'s/mot'}
};
const MOTIFS=['Pseudo inapproprié','Triche ou score falsifié','Comportement toxique','Usurpation d’identité','Spam'];

