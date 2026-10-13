<script>
(function(){
'use strict';

/* =========================================================
   i18n — L(en, fr). Every visible string goes through L().
   To add a language: add a third argument / swap L for a keyed table.
   ========================================================= */
let LANG='en';
const CFG=window.RYVO_CONFIG||{};
const LIVE=!!(CFG.url&&CFG.anonKey&&window.supabase&&window.supabase.createClient);
const L=(en,fr)=>LANG==='fr'&&fr!=null?fr:en;
const LOC=()=>LANG==='fr'?'fr-FR':'en-GB';

/* ========================= utils ========================= */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=n=>Math.round(n).toLocaleString(LOC());
function rng(seed){let a=seed>>>0;return function(){a|=0;a=a+0x6D2B79F5|0;let x=Math.imul(a^a>>>15,1|a);x=x+Math.imul(x^x>>>7,61|x)^x;return((x^x>>>14)>>>0)/4294967296;};}
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function shuffle(arr,r=Math.random){for(let i=arr.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}
function dayKey(d=new Date()){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function weekStart(d=new Date()){const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x.getTime();}
function monthStart(d=new Date()){return new Date(d.getFullYear(),d.getMonth(),1).getTime();}
function ago(ts){const s=Math.max(1,Math.round((Date.now()-ts)/1000));if(s<60)return L(s+' s ago','il y a '+s+' s');const m=Math.round(s/60);if(m<60)return L(m+' min ago','il y a '+m+' min');const h=Math.round(m/60);if(h<24)return L(h+' h ago','il y a '+h+' h');const d=Math.round(h/24);return L(d+' d ago','il y a '+d+' j');}
function dateLabel(ts){return new Date(ts).toLocaleDateString(LOC(),{weekday:'short',day:'numeric',month:'short'});}
const mm=q=>!!(window.matchMedia&&window.matchMedia(q).matches);
const REDUCED=mm('(prefers-reduced-motion: reduce)');
const plural=(n,en1,enN,fr1,frN)=>L(n===1?en1:enN,n<=1?fr1:frN);

/* ========================= icons ========================= */
const ICONS={
  home:'<path d="M3 9.5 10 4l7 5.5V17a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1z"/>',
  play:'<path d="M6.5 4.2v11.6a.6.6 0 0 0 .9.5l9.2-5.8a.6.6 0 0 0 0-1L7.4 3.7a.6.6 0 0 0-.9.5z"/>',
  trophy:'<path d="M6 3h8v4.5a4 4 0 0 1-8 0zM6 5H3v1a3 3 0 0 0 3 3M14 5h3v1a3 3 0 0 1-3 3M10 11.5V14M7 17.5h6M8 14h4v3.5H8z"/>',
  campus:'<path d="M2 8l8-4 8 4-8 4zM5 9.5V14c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5V9.5M18 8v5"/>',
  users:'<circle cx="7.5" cy="7" r="3"/><path d="M2 17c.5-3 2.7-5 5.5-5s5 2 5.5 5M13 4.2a3 3 0 0 1 0 5.6M15 12c1.8.6 3 2.4 3.3 5"/>',
  user:'<circle cx="10" cy="6.5" r="3.5"/><path d="M3 18c.8-3.6 3.6-6 7-6s6.2 2.4 7 6"/>',
  gem:'<path d="M5 3h10l3 5-8 9-8-9zM2 8h16M8 3 7 8l3 9 3-9-1-5"/>',
  flag:'<path d="M4.5 18V2.5M4.5 3.5h10.5l-2.2 3.7 2.2 3.8H4.5"/>',
  copy:'<rect x="7" y="7" width="10.5" height="10.5" rx="2"/><path d="M4 13V4a1.2 1.2 0 0 1 1.2-1.2H13"/>',
  tv:'<rect x="2.5" y="4" width="15" height="10.5" rx="2"/><path d="M8.5 7v4.5l3.8-2.25zM7 17.5h6"/>',
  bag:'<path d="M4 7h12l-1 10.5H5zM7 7V5.5a3 3 0 0 1 6 0V7"/>',
  download:'<path d="M10 3v10M6 9.2l4 4 4-4M4 17h12"/>',
  building:'<path d="M3 18V5l7-3 7 3v13M1 18h18M7 8h1M12 8h1M7 11h1M12 11h1M8.5 18v-4h3v4"/>',
  code:'<path d="M7 5 2 10l5 5M13 5l5 5-5 5M11.5 3l-3 14"/>',
  bell:'<path d="M5 8a5 5 0 0 1 10 0c0 5 2 6 2 6H3s2-1 2-6M8 17a2 2 0 0 0 4 0"/>',
  flame:'<path d="M10 2c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 0 2 1 3 2 3 0-3-1-5.5.5-8z"/>',
  bolt:'<path d="M11 2 4 11h5l-1 7 7-9h-5z"/>',
  x:'<path d="M5 5l10 10M15 5 5 15"/>',
  dots:'<circle cx="4" cy="10" r="1.3"/><circle cx="10" cy="10" r="1.3"/><circle cx="16" cy="10" r="1.3"/>',
  check:'<path d="M4 10.5 8 14.5 16 5.5"/>',
  info:'<circle cx="10" cy="10" r="8"/><path d="M10 9v5M10 6.2v.1"/>',
  lock:'<rect x="4" y="9" width="12" height="9" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>',
  swords:'<path d="M3 3l9 9M3 3h4M3 3v4M17 3 8 12M17 3h-4M17 3v4M6 14l-3 3M14 14l3 3M5 12l3 3M15 12l-3 3"/>',
  share:'<path d="M10 3v10M6 7l4-4 4 4M4 12v4a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-4"/>',
  back:'<path d="M12 4 6 10l6 6"/>',
  refresh:'<path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v3.5h-3.5"/>',
  cal:'<rect x="3" y="4.5" width="14" height="13" rx="2"/><path d="M3 8.5h14M7 3v3M13 3v3"/>',
  target:'<circle cx="10" cy="10" r="7.5"/><circle cx="10" cy="10" r="4"/><circle cx="10" cy="10" r=".8"/>',
  shield:'<path d="M10 2.5 16 5v5c0 4-2.8 6.5-6 7.5-3.2-1-6-3.5-6-7.5V5z"/>',
  sound:'<path d="M3 8h3l4-3.5v11L6 12H3zM13 7.5a3.5 3.5 0 0 1 0 5M15 5a7 7 0 0 1 0 10"/>',
  mute:'<path d="M3 8h3l4-3.5v11L6 12H3zM13 8l4 4M17 8l-4 4"/>',
  layers:'<path d="M10 3 2 7l8 4 8-4zM2 11l8 4 8-4M2 14.5l8 4 8-4"/>',
  grid:'<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/>',
  type:'<path d="M4 5h12M10 5v11M7 16h6"/>',
  cross:'<circle cx="10" cy="10" r="6.5"/><path d="M10 1.5v5M10 13.5v5M1.5 10h5M13.5 10h5"/>',
  car:'<path d="M3 13v-3l2-4h10l2 4v3zM3 13v2h3v-2M14 13v2h3v-2M6 10h8"/>',
  cards:'<rect x="2.5" y="5" width="9" height="12" rx="2"/><path d="M8.5 3.5 15 2l2.5 11.5-5 1.1"/>',
  bulb:'<path d="M7 14h6M8 17h4M10 2.5a5.5 5.5 0 0 0-3 10.1V14h6v-1.4A5.5 5.5 0 0 0 10 2.5z"/>'
};
const ic=(n,s=18)=>`<svg class="ic" width="${s}" height="${s}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]||''}</svg>`;
const LOGO=`<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><rect x="1" y="1" width="32" height="32" rx="10" fill="var(--brand)" stroke="#17142A" stroke-width="2"/><path d="M8 9h6l5 8-5 8H8l5-8z" fill="#fff" stroke="#17142A" stroke-width="1.6" stroke-linejoin="round"/><path d="M27 9h-5l-5 8 5 8h5l-5-8z" fill="#FFC93C" stroke="#17142A" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

/* ========================= sound (Web Audio, synthesised) ========================= */
const SFX={ctx:null,engine:null,
  ok(){return S&&S.data&&S.data.sound;},
  init(){if(!this.ctx){try{this.ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){this.ctx=null;}}if(this.ctx&&this.ctx.state==='suspended'){try{this.ctx.resume();}catch(e){}}return this.ctx;},
  tone(f,d,type='sine',v=.14,slide=0,delay=0){if(!this.ok())return;const c=this.init();if(!c)return;const t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,f+slide),t+d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+d+.03);},
  noise(d=.2,v=.12,freq=900,delay=0){if(!this.ok())return;const c=this.init();if(!c)return;const t=c.currentTime+delay,len=Math.floor(c.sampleRate*d),b=c.createBuffer(1,len,c.sampleRate),ch=b.getChannelData(0);for(let i=0;i<len;i++)ch[i]=(Math.random()*2-1)*(1-i/len);const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=b;f.type='lowpass';f.frequency.value=freq;g.gain.value=v;s.connect(f);f.connect(g);g.connect(c.destination);s.start(t);},
  play(n,a=0){
    switch(n){
      case 'tap':this.tone(520,.06,'triangle',.08);break;
      case 'tick':this.tone(660,.09,'square',.06);break;
      case 'go':this.tone(990,.25,'square',.08);this.tone(1320,.25,'triangle',.06,0,.02);break;
      case 'good':this.tone(660,.1,'triangle',.12);this.tone(990,.16,'triangle',.12,0,.08);break;
      case 'bad':this.tone(180,.28,'sawtooth',.09,-80);break;
      case 'coin':[0,4,7,12].forEach((s,i)=>this.tone(880*Math.pow(2,s/12),.09,'square',.05,0,i*.05));break;
      case 'combo':this.tone(440*Math.pow(2,Math.min(a,18)/12),.12,'triangle',.12);break;
      case 'crash':this.noise(.25,.2,700);this.tone(120,.2,'sawtooth',.07,-60);break;
      case 'perfect':[0,7,12,16].forEach((s,i)=>this.tone(660*Math.pow(2,s/12),.14,'triangle',.09,0,i*.045));break;
      case 'win':[0,4,7,12,16].forEach((s,i)=>this.tone(523*Math.pow(2,s/12),.18,'triangle',.11,0,i*.09));break;
      case 'lose':[0,-3,-7].forEach((s,i)=>this.tone(392*Math.pow(2,s/12),.22,'triangle',.1,0,i*.13));break;
      case 'place':this.tone(220+a*14,.12,'square',.07,-40);this.noise(.05,.08,1600);break;
      case 'whoosh':this.noise(.22,.09,2400);break;
      case 'pop':this.tone(500+a*30,.08,'sine',.16,400);break;
      case 'flip':this.tone(380+a*40,.05,'triangle',.07);break;
    }
  },
  engineStart(){if(!this.ok())return;const c=this.init();if(!c||this.engine)return;const o=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();o.type='sawtooth';o.frequency.value=60;f.type='lowpass';f.frequency.value=520;g.gain.value=.025;o.connect(f);f.connect(g);g.connect(c.destination);o.start();this.engine={o,g};},
  engineSet(v){if(this.engine&&this.ctx){this.engine.o.frequency.setTargetAtTime(55+v*0.42,this.ctx.currentTime,.05);}},
  engineStop(){if(this.engine){try{this.engine.g.gain.setTargetAtTime(.0001,this.ctx.currentTime,.05);this.engine.o.stop(this.ctx.currentTime+.2);}catch(e){}this.engine=null;}}
};

/* ========================= visual effects layer ========================= */
const FX={cv:null,cx:null,P:[],raf:0,
  ensure(){if(!this.cv){this.cv=$('#fx');this.cx=this.cv&&this.cv.getContext?this.cv.getContext('2d'):null;}return !!this.cx;},
  at(el){const r=el.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];},
  burst(x,y,cols,n=18,spd=6){if(!this.ensure())return;if(REDUCED)n=Math.min(n,5);for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=spd*(.4+Math.random()*.8);this.P.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,g:.22,life:1,d:.02+Math.random()*.02,c:cols[i%cols.length],r:3+Math.random()*4,sq:Math.random()<.5,rot:Math.random()*6});}this.loop();},
  confetti(n=110){if(!this.ensure())return;if(REDUCED)n=20;const W=window.innerWidth;const cols=['#5B4BFF','#FFC93C','#FF4FA0','#14B37A','#00A6C8','#FF6B3D'];for(let i=0;i<n;i++){this.P.push({x:Math.random()*W,y:-20-Math.random()*200,vx:(Math.random()-.5)*3,vy:2+Math.random()*3,g:.06,life:1,d:.006+Math.random()*.004,c:cols[i%cols.length],r:4+Math.random()*4,sq:true,rot:Math.random()*6,spin:(Math.random()-.5)*.3});}this.loop();},
  loop(){if(this.raf)return;const step=()=>{const c=this.cv,cx=this.cx,dpr=Math.min(2,window.devicePixelRatio||1),W=window.innerWidth,H=window.innerHeight;if(c.width!==Math.round(W*dpr)||c.height!==Math.round(H*dpr)){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr);}cx.setTransform(dpr,0,0,dpr,0,0);cx.clearRect(0,0,W,H);
      this.P=this.P.filter(p=>p.life>0&&p.y<H+40);
      for(const p of this.P){p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.vx*=.99;p.life-=p.d;p.rot+=p.spin||.1;cx.globalAlpha=Math.max(0,Math.min(1,p.life*1.5));cx.fillStyle=p.c;cx.strokeStyle='#17142A';cx.lineWidth=1.2;cx.save();cx.translate(p.x,p.y);cx.rotate(p.rot);if(p.sq){cx.fillRect(-p.r,-p.r*.6,p.r*2,p.r*1.2);cx.strokeRect(-p.r,-p.r*.6,p.r*2,p.r*1.2);}else{cx.beginPath();cx.arc(0,0,p.r,0,Math.PI*2);cx.fill();cx.stroke();}cx.restore();}
      cx.globalAlpha=1;
      if(this.P.length)this.raf=requestAnimationFrame(step);else{this.raf=0;cx.clearRect(0,0,W,H);}};
    this.raf=requestAnimationFrame(step);},
  pop(text,x,y,col){const el=document.createElement('div');el.className='floaty';el.textContent=text;el.style.left=x+'px';el.style.top=y+'px';if(col)el.style.setProperty('--fc',col);document.body.appendChild(el);setTimeout(()=>el.remove(),950);},
  shake(el){if(!el||REDUCED)return;el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');},
  buzz(ms){try{if(navigator.vibrate)navigator.vibrate(ms);}catch(e){}},
  clear(){this.P=[];}
};

/* ========================= world data ========================= */
const SCHOOLS=[
  {id:'nbu',name:'Northbridge University',short:'NBU',city:'Lyon',country:['France','France'],domain:'northbridge.demo',col:'#3D7BFF'},
  {id:'lys',name:'Université de Lysière',short:'UdL',city:'Lyon',country:['France','France'],domain:'lysiere.demo',col:'#8B5CF6'},
  {id:'cbs',name:'Coastal Business School',short:'CBS',city:'Le Havre',country:['France','France'],domain:'coastal-bs.demo',col:'#FF6B3D'},
  {id:'hit',name:'Halvorsen Institute of Technology',short:'HIT',city:'Oslo',country:['Norway','Norvège'],domain:'halvorsen.demo',col:'#00A6C8'},
  {id:'evc',name:'Eastvale College',short:'EVC',city:'Manchester',country:['United Kingdom','Royaume-Uni'],domain:'eastvale.demo',col:'#FF4FA0'},
  {id:'mir',name:'Mirandel Academy',short:'MIR',city:'Madrid',country:['Spain','Espagne'],domain:'mirandel.demo',col:'#E0A100'},
  {id:'ksu',name:'Kestrel State University',short:'KSU',city:'Toronto',country:['Canada','Canada'],domain:'kestrel.demo',col:'#14B37A'},
  {id:'ari',name:'Arisaka Institute',short:'ARI',city:'Osaka',country:['Japan','Japon'],domain:'arisaka.demo',col:'#F23F55'}
];
const SCH=Object.fromEntries(SCHOOLS.map(s=>[s.id,s]));
const ctry=s=>L(s.country[0],s.country[1]);
const PROGRAMS={bus1:['Business · Year 1','Commerce · 1re année'],bus2:['Business · Year 2','Commerce · 2e année'],eng1:['Engineering · Year 1','Ingénierie · 1re année'],eng2:['Engineering · Year 2','Ingénierie · 2e année'],log1:['Logistics · Master 1','Logistique · Master 1'],des3:['Design · Year 3','Design · 3e année'],cs2:['Computer Science · Year 2','Informatique · 2e année'],law1:['Law · Year 1','Droit · 1re année']};
const PROG_IDS=Object.keys(PROGRAMS);
const prog=id=>PROGRAMS[id]?L(PROGRAMS[id][0],PROGRAMS[id][1]):'—';
/* Année d'études déclarée par le joueur. « Promo » = même école + même année. */
const YEARS={'1':['Year 1','1re année'],'2':['Year 2','2e année'],'3':['Year 3','3e année'],'4':['Year 4','4e année'],'5':['Year 5','5e année'],'6':['Year 6 or more','6e année et plus']};
const YEAR_IDS=Object.keys(YEARS);
const yearName=y=>YEARS[y]?L(YEARS[y][0],YEARS[y][1]):'—';
const yearLong=y=>YEARS[y]?yearName(y)+' · Bac+'+(y==='6'?'6+':y):'—';
const P2Y={bus1:'1',bus2:'2',eng1:'1',eng2:'2',log1:'4',des3:'3',cs2:'2',law1:'1'};
const normTxt=t=>String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe').replace(/æ/g,'ae').replace(/[^a-z0-9]+/g,'');

/* Neon Sprint tracks: closed Catmull-Rom loops, resampled to 360 even steps. */
function buildTrack(P){
  const n=P.length,dense=[];
  for(let i=0;i<n;i++){const p0=P[(i-1+n)%n],p1=P[i],p2=P[(i+1)%n],p3=P[(i+2)%n];
    for(let s=0;s<40;s++){const u=s/40,u2=u*u,u3=u2*u;const f=(a,b,c,d)=>0.5*((2*b)+(-a+c)*u+(2*a-5*b+4*c-d)*u2+(-a+3*b-3*c+d)*u3);dense.push([f(p0[0],p1[0],p2[0],p3[0]),f(p0[1],p1[1],p2[1],p3[1])]);}}
  const Ls=[0];for(let i=1;i<=dense.length;i++){const a=dense[i-1],b=dense[i%dense.length];Ls.push(Ls[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1]));}
  const total=Ls[Ls.length-1],N=360,pts=[];let j=0;
  for(let k=0;k<N;k++){const tg=k*total/N;while(Ls[j+1]<tg)j++;const a=dense[j],b=dense[(j+1)%dense.length],f=(tg-Ls[j])/((Ls[j+1]-Ls[j])||1);pts.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);}
  const tan=pts.map((p,i)=>{const q=pts[(i+1)%N],o=pts[(i-1+N)%N];return Math.atan2(q[1]-o[1],q[0]-o[0]);});
  return {pts,tan,N,len:total,half:34,W:1000,H:680,par:+(total*3/250).toFixed(2),slow:+(total*3/125).toFixed(2)};
}
const TRACKS=[
  Object.assign(buildTrack([[160,100],[500,80],[820,110],[920,240],[840,350],[660,330],[520,250],[380,320],[420,470],[620,500],[860,490],[910,575],[700,615],[300,600],[120,500],[90,280]]),{name:'City Loop',lv:1,ground:'#E4F4EA',pads:[[40,-12],[150,14],[268,0]],oils:[[105,12],[215,-13]],cones:[[75,17],[185,-17],[322,13]]}),
  Object.assign(buildTrack([[110,560],[110,150],[250,85],[380,160],[410,330],[520,430],[640,330],[660,170],[790,90],[905,160],[910,340],[850,470],[900,585],[700,615],[480,600],[260,615]]),{name:'Canyon Run',lv:3,ground:'#FBE7D2',pads:[[30,0],[130,-14],[250,12]],oils:[[90,-10],[200,14],[300,-6]],cones:[[60,16],[170,-16],[230,16],[335,-14]]}),
  Object.assign(buildTrack([[200,110],[800,105],[910,210],[880,320],[700,345],[560,295],[440,360],[560,445],[760,455],[905,520],[860,610],[500,620],[150,600],[90,480],[165,360],[95,225]]),{name:'Harbor Hairpin',lv:5,ground:'#DDF0FA',pads:[[20,10],[160,0],[290,-12]],oils:[[70,-12],[140,14],[250,10]],cones:[[45,-16],[120,16],[205,-15],[330,15]]})
];
const SKS=['sprint@0','sprint@1','sprint@2','reflex','brain','cards','stack','grid','words','aim'];
const gameOf=sk=>String(sk).split('@')[0];
const trackOf=sk=>+(String(sk).split('@')[1]||0);

const GAMES=[
  {id:'sprint',name:'Neon Sprint',cats:['racing','arcade'],dur:'~45 s',diff:2,pop:96,lower:true,col:'var(--c-sprint)',hex:'#3D7BFF',icon:'car',playable:true,
   tag:()=>L('Three laps, three tracks, one ghost. Grab boosts, dodge the oil.','Trois tours, trois circuits, un fantôme. Prends les boosts, évite l’huile.'),
   rules:()=>[L('Drive three laps as fast as you can.','Fais trois tours le plus vite possible.'),L('Yellow chevrons give a 1.5 s speed boost.','Les chevrons jaunes donnent 1,5 s de boost.'),L('Oil spins you out, cones cut your speed.','L’huile te fait partir en tête-à-queue, les plots te ralentissent.'),L('Off the asphalt you slow down. Shortcuts don’t count.','Hors piste tu ralentis. Les raccourcis ne comptent pas.'),L('New tracks unlock at levels 3 and 5.','Nouveaux circuits débloqués aux niveaux 3 et 5.')]},
  {id:'reflex',name:'Reflex Arena',cats:['reflex','arcade'],dur:'~30 s',diff:1,pop:91,lower:true,col:'var(--c-reflex)',hex:'#FF6B3D',icon:'bolt',playable:true,
   tag:()=>L('Five signals, decoys included. Your fastest nerves win.','Cinq signaux, leurres compris. Les nerfs les plus rapides gagnent.'),
   rules:()=>[L('Tap the pad or press Space to arm a round.','Touche le pad ou appuie sur Espace pour lancer une manche.'),L('When it turns orange, hit it as fast as you can.','Quand il devient orange, frappe le plus vite possible.'),L('From round 3, blue decoy flashes appear. Don’t touch them.','Dès la manche 3, des leurres bleus apparaissent. N’y touche pas.'),L('A false start restarts the round and adds 10 ms.','Un faux départ relance la manche et ajoute 10 ms.'),L('Your score is the average of five rounds.','Ton score est la moyenne des cinq manches.')]},
  {id:'brain',name:'Brain Battle',cats:['trivia','party'],dur:'~1.5 min',diff:2,pop:88,lower:false,col:'var(--c-brain)',hex:'#8B5CF6',icon:'bulb',playable:true,
   tag:()=>L('Eight questions. Right scores, fast scores more, streaks multiply.','Huit questions. Juste rapporte, vite rapporte plus, les séries multiplient.'),
   rules:()=>[L('Eight multiple-choice questions, 10 seconds each.','Huit QCM, 10 secondes chacun.'),L('Correct: 500 points plus up to 500 for speed.','Bonne réponse : 500 points plus jusqu’à 500 de vitesse.'),L('3 correct in a row: ×1.2. 5 in a row: ×1.5.','3 bonnes d’affilée : ×1,2. 5 d’affilée : ×1,5.'),L('Pick a category or play Mixed. Keys 1–4 answer.','Choisis une catégorie ou joue en Mixte. Touches 1–4 pour répondre.')]},
  {id:'cards',name:'Card Clash',cats:['cards','strategy'],dur:'~2 min',diff:2,pop:84,lower:false,col:'var(--c-cards)',hex:'#FFB800',icon:'cards',playable:true,
   tag:()=>L('Five cards each. Read the elements, time your Overcharge.','Cinq cartes chacun. Lis les éléments, place ta Surcharge.'),
   rules:()=>[L('You and the rival hold five cards: an element and a power from 1 to 9.','Toi et ton rival avez cinq cartes : un élément et une puissance de 1 à 9.'),L('Both play one card at once. Higher power wins the round.','Vous jouez une carte en même temps. La plus forte gagne la manche.'),L('Element edge +3: Volt beats Tide, Tide beats Flare, Flare beats Volt.','Avantage d’élément +3 : Volt bat Marée, Marée bat Flamme, Flamme bat Volt.'),L('Once per match, Overcharge adds +2 to your card. The rival has one too.','Une fois par match, la Surcharge ajoute +2 à ta carte. Le rival en a une aussi.'),L('You see the rival’s elements, not their powers.','Tu vois les éléments du rival, pas leur puissance.')]},
  {id:'stack',name:'Skyline Stack',cats:['arcade'],dur:'~1 min',diff:2,pop:93,lower:false,col:'var(--c-stack)',hex:'#FF4FA0',icon:'layers',playable:true,
   tag:()=>L('Drop each floor on the last one. Perfects keep it wide.','Pose chaque étage sur le précédent. Les parfaits gardent la largeur.'),
   rules:()=>[L('A block slides across. Tap, click or press Space to drop it.','Un bloc glisse. Touche, clique ou appuie sur Espace pour le lâcher.'),L('Whatever hangs over the edge is cut off.','Ce qui dépasse est coupé.'),L('A perfect drop keeps the full width. Three perfects in a row widen the block.','Un lâcher parfait garde toute la largeur. Trois parfaits d’affilée élargissent le bloc.'),L('Miss completely and the tower is done. It speeds up as you climb.','Si tu rates complètement, c’est fini. Ça accélère en montant.')]},
  {id:'grid',name:'Grid Lock',cats:['logic','strategy'],dur:'90 s',diff:3,pop:79,lower:false,col:'var(--c-grid)',hex:'#14B37A',icon:'grid',playable:true,
   tag:()=>L('Light every tile. Each tap flips a cross. Solve as many as you can.','Allume toutes les cases. Chaque tap inverse une croix. Résous-en un max.'),
   rules:()=>[L('Tapping a tile flips it and its four neighbours.','Toucher une case l’inverse, ainsi que ses quatre voisines.'),L('Turn every tile green to solve the board.','Rends toutes les cases vertes pour résoudre la grille.'),L('90 seconds. Boards grow from 3×3 to 5×5.','90 secondes. Les grilles passent de 3×3 à 5×5.'),L('Fewer moves earn an efficiency bonus. Arrow keys + Space work too.','Moins de coups = bonus d’efficacité. Flèches + Espace fonctionnent aussi.')]},
  {id:'words',name:'Word Rush',cats:['words','trivia'],dur:'60 s',diff:2,pop:86,lower:false,col:'var(--c-words)',hex:'#00A6C8',icon:'type',playable:true,
   tag:()=>L('Unscramble words against the clock. Longer words, bigger points.','Remets les lettres dans l’ordre. Mots longs, gros points.'),
   rules:()=>[L('Tap letters (or type) to rebuild the hidden word. The category is your clue.','Touche les lettres (ou tape) pour reformer le mot. La catégorie est ton indice.'),L('Each letter is worth 100 points, plus a speed bonus.','Chaque lettre vaut 100 points, plus un bonus de vitesse.'),L('Streaks multiply your points. Hint reveals a letter for −100.','Les séries multiplient tes points. L’indice révèle une lettre pour −100.'),L('Words get longer as you go. 60 seconds.','Les mots s’allongent. 60 secondes.')]},
  {id:'aim',name:'Pop Shot',cats:['reflex','arcade'],dur:'30 s',diff:1,pop:90,lower:false,col:'var(--c-aim)',hex:'#F23F55',icon:'cross',playable:true,
   tag:()=>L('Pop targets before they shrink away. Centre hits and combos pay most.','Éclate les cibles avant qu’elles disparaissent. Centre et combos rapportent gros.'),
   rules:()=>[L('Click or tap targets before they shrink to nothing.','Clique ou touche les cibles avant qu’elles disparaissent.'),L('Centre ring 150, middle 100, outer 60 points.','Centre 150, milieu 100, extérieur 60 points.'),L('Every 5 hits in a row raises the multiplier, up to ×3.','Toutes les 5 touches d’affilée, le multiplicateur monte, jusqu’à ×3.'),L('A miss or an escaped target resets the combo. Gold targets are worth double.','Un raté ou une cible ratée remet le combo à zéro. Les cibles dorées valent double.')]},
  {id:'party',name:'Pulse Party',cats:['party'],dur:'~3 min',diff:1,pop:0,col:'var(--c-party)',hex:'#B5B0C7',icon:'users',playable:false,
   tag:()=>L('Rhythm rounds for 4 to 8 players at once.','Manches de rythme de 4 à 8 joueurs en même temps.'),eta:()=>L('Needs real-time servers','Nécessite des serveurs temps réel')}
];
const GAME=Object.fromEntries(GAMES.map(g=>[g.id,g]));
const PLAYABLE=GAMES.filter(g=>g.playable);
const CATS=[['racing',()=>L('Racing','Course')],['arcade',()=>L('Arcade','Arcade')],['strategy',()=>L('Strategy','Stratégie')],['cards',()=>L('Card games','Cartes')],['trivia',()=>L('Trivia','Culture G')],['reflex',()=>L('Reflexes','Réflexes')],['logic',()=>L('Logic & puzzles','Logique')],['words',()=>L('Words','Mots')],['party',()=>L('Party','Multijoueur')]];
const catName=id=>{const c=CATS.find(x=>x[0]===id);return c?c[1]():id;};
const diffName=d=>[null,L('Easy','Facile'),L('Medium','Moyen'),L('Hard','Difficile')][d];
const MODES={
  trial:{n:()=>L('Time Trial','Contre-la-montre'),d:()=>L('Solo run. Beat your best and climb this game’s leaderboard.','En solo. Bats ton record et grimpe au classement.')},
  duel:{n:()=>L('1v1 Duel','Duel 1v1'),d:()=>L('Face a simulated rival who plays from their stats. Moves your rating.','Affronte un rival simulé qui joue selon ses stats. Fait bouger ta cote.')},
  daily:{n:()=>L('Daily Challenge','Défi du jour'),d:()=>L('Same seed for everyone today. 3 attempts, best one counts.','Même tirage pour tous aujourd’hui. 3 essais, le meilleur compte.')},
  school:{n:()=>L('School Cup','Coupe des écoles'),d:()=>L('Your result adds points to your university this week.','Ton résultat rapporte des points à ton école cette semaine.')}
};
const MODE_IDS=Object.keys(MODES);

const INK='#17142A';
const ART={
  sprint:`<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice"><path d="M-10 70C30 10 60 90 95 45S150 15 175 55" fill="none" stroke="${INK}" stroke-width="24" stroke-linecap="round"/><path d="M-10 70C30 10 60 90 95 45S150 15 175 55" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="6 7"/><path d="M28 34l7 6-7 6M37 34l7 6-7 6" stroke="#FFC93C" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><g transform="rotate(-36 100 40)"><rect x="88" y="33" width="26" height="14" rx="4" fill="#fff" stroke="${INK}" stroke-width="2.5"/><rect x="100" y="36" width="7" height="8" rx="1.5" fill="${INK}"/></g><circle cx="140" cy="20" r="8" fill="#FFC93C" stroke="${INK}" stroke-width="2.5"/></svg>`,
  reflex:`<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice"><circle cx="80" cy="45" r="38" fill="none" stroke="#fff" stroke-width="3" opacity=".5"/><circle cx="80" cy="45" r="26" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/><circle cx="80" cy="45" r="15" fill="#FFC93C" stroke="${INK}" stroke-width="3"/><path d="M83 33 74 47h7l-3 11 10-15h-7z" fill="${INK}"/><rect x="18" y="64" width="34" height="14" rx="7" fill="#fff" stroke="${INK}" stroke-width="2.5"/><text x="35" y="74.5" text-anchor="middle" font-family="JetBrains Mono,monospace" font-weight="700" font-size="9" fill="${INK}">214ms</text></svg>`,
  brain:`<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice"><rect x="30" y="10" width="100" height="30" rx="8" fill="#fff" stroke="${INK}" stroke-width="2.5"/><text x="80" y="32" text-anchor="middle" font-family="Bricolage Grotesque,sans-serif" font-weight="800" font-size="20" fill="${INK}">?</text><rect x="30" y="47" width="47" height="15" rx="6" fill="#fff" stroke="${INK}" stroke-width="2.5"/><rect x="83" y="47" width="47" height="15" rx="6" fill="#B8F2D9" stroke="${INK}" stroke-width="2.5"/><rect x="30" y="67" width="47" height="15" rx="6" fill="#fff" stroke="${INK}" stroke-width="2.5"/><rect x="83" y="67" width="47" height="15" rx="6" fill="#fff" stroke="${INK}" stroke-width="2.5"/></svg>`,
  cards:`<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice"><g transform="rotate(-14 56 52)"><rect x="38" y="20" width="36" height="52" rx="7" fill="#3D7BFF" stroke="${INK}" stroke-width="2.5"/><text x="56" y="54" text-anchor="middle" font-family="Bricolage Grotesque,sans-serif" font-weight="800" font-size="20" fill="#fff" stroke="${INK}" stroke-width="1">7</text></g><g transform="rotate(14 104 52)"><rect x="86" y="20" width="36" height="52" rx="7" fill="#8B5CF6" stroke="${INK}" stroke-width="2.5"/><text x="104" y="54" text-anchor="middle" font-family="Bricolage Grotesque,sans-serif" font-weight="800" font-size="20" fill="#fff" stroke="${INK}" stroke-width="1">9</text></g><rect x="62" y="12" width="36" height="52" rx="7" fill="#FF6B3D" stroke="${INK}" stroke-width="2.5"/><text x="80" y="46" text-anchor="middle" font-family="Bricolage Grotesque,sans-serif" font-weight="800" font-size="20" fill="#fff" stroke="${INK}" stroke-width="1">4</text></svg>`,
  stack:`<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice"><g stroke="${INK}" stroke-width="2.5"><rect x="40" y="72" width="80" height="14" rx="3" fill="#FFC93C"/><rect x="44" y="58" width="74" height="14" rx="3" fill="#fff"/><rect x="48" y="44" width="66" height="14" rx="3" fill="#8FD3FF"/><rect x="50" y="30" width="62" height="14" rx="3" fill="#fff"/><rect x="74" y="12" width="62" height="14" rx="3" fill="#B8F2D9"/></g><path d="M64 20h-14M60 14h-8" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`,
  grid:`<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice"><g stroke="${INK}" stroke-width="2.5">${[0,1,2,3].map(r=>[0,1,2,3].map(c=>`<rect x="${42+c*20}" y="${7+r*20}" width="16" height="16" rx="4" fill="${[5,6,9,10,1,14].includes(r*4+c)?'#fff':'#0C7F57'}"/>`).join('')).join('')}</g></svg>`,
  words:`<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice"><g font-family="Bricolage Grotesque,sans-serif" font-weight="800" font-size="20" text-anchor="middle">${[['R',22,26,-8],['U',58,20,6],['S',94,28,-4],['H',130,22,8]].map(([ch,x,y,r])=>`<g transform="rotate(${r} ${x+14} ${y+14})"><rect x="${x}" y="${y}" width="28" height="28" rx="7" fill="#fff" stroke="${INK}" stroke-width="2.5"/><text x="${x+14}" y="${y+21}" fill="${INK}">${ch}</text></g>`).join('')}</g><rect x="34" y="66" width="92" height="12" rx="6" fill="#FFC93C" stroke="${INK}" stroke-width="2.5"/></svg>`,
  aim:`<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice"><circle cx="70" cy="46" r="30" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="70" cy="46" r="20" fill="#FFC2CA" stroke="${INK}" stroke-width="2.5"/><circle cx="70" cy="46" r="9" fill="#FFC93C" stroke="${INK}" stroke-width="2.5"/><circle cx="128" cy="24" r="10" fill="#fff" stroke="${INK}" stroke-width="2.5"/><path d="M78 38l30 -10M112 18v12M106 24h12" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/><circle cx="32" cy="72" r="6" fill="#FFC93C" stroke="${INK}" stroke-width="2"/></svg>`,
  party:`<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice"><g stroke="${INK}" stroke-width="2" fill="#fff">${[18,34,50,30,60,40,22,50,36,18].map((h,i)=>`<rect x="${28+i*11}" y="${45-h/2}" width="7" height="${h}" rx="3.5"/>`).join('')}</g></svg>`
};
const ELEM={volt:{n:()=>'Volt',c:'var(--c-sprint)',g:'<path d="M9 1 3 9h5l-2 6 7-9H8z" fill="currentColor"/>'},flare:{n:()=>L('Flare','Flamme'),c:'var(--c-reflex)',g:'<path d="M8 1c3 4 5 6 5 9a5 5 0 0 1-10 0c0-3 3-4 5-9z" fill="currentColor"/>'},tide:{n:()=>L('Tide','Marée'),c:'var(--c-brain)',g:'<path d="M1 9c2-3 4-3 6 0s4 3 8-1v7H1z" fill="currentColor"/>'}};
const BEATS={volt:'tide',tide:'flare',flare:'volt'};
const eg=(e,s=14)=>`<svg width="${s}" height="${s}" viewBox="0 0 16 16" aria-hidden="true">${ELEM[e].g}</svg>`;

/* Brain Battle question bank. Correct answer first; shuffled at runtime. [en, fr] pairs, plain string when identical. */
const QCATS={sci:()=>L('Science','Sciences'),geo:()=>L('Geography','Géographie'),his:()=>L('History','Histoire'),spo:()=>'Sport',tec:()=>'Tech',bus:()=>L('Business','Business'),cul:()=>'Culture'};
const QBANK=[
  {c:'sci',q:['Which gas do plants take in for photosynthesis?','Quel gaz les plantes absorbent-elles pour la photosynthèse ?'],o:[['Carbon dioxide','Dioxyde de carbone'],['Oxygen','Oxygène'],['Nitrogen','Azote'],['Helium','Hélium']]},
  {c:'sci',q:['How many bones does a typical adult human skeleton have?','Combien d’os compte le squelette d’un adulte ?'],o:['206','186','230','312']},
  {c:'sci',q:['What is the chemical symbol for sodium?','Quel est le symbole chimique du sodium ?'],o:['Na','So','Sd','Sn']},
  {c:'sci',q:['Which planet takes the least time to orbit the Sun?','Quelle planète fait le tour du Soleil le plus vite ?'],o:[['Mercury','Mercure'],['Venus','Vénus'],'Mars',['Earth','Terre']]},
  {c:'sci',q:['Roughly how fast does light travel in a vacuum?','À quelle vitesse environ la lumière voyage-t-elle dans le vide ?'],o:[['300,000 km/s','300 000 km/s'],['30,000 km/s','30 000 km/s'],['3,000 km/s','3 000 km/s'],['3 million km/s','3 millions de km/s']]},
  {c:'sci',q:['What is the hardest natural material?','Quel est le matériau naturel le plus dur ?'],o:[['Diamond','Diamant'],'Quartz','Granite',['Iron','Fer']]},
  {c:'sci',q:['At sea level, at what temperature does water boil?','Au niveau de la mer, à quelle température l’eau bout-elle ?'],o:['100 °C','90 °C','120 °C','80 °C']},
  {c:'geo',q:['What is the capital of Canada?','Quelle est la capitale du Canada ?'],o:['Ottawa','Toronto',['Montreal','Montréal'],'Vancouver']},
  {c:'geo',q:['Which strait separates Spain from Morocco?','Quel détroit sépare l’Espagne du Maroc ?'],o:[['Strait of Gibraltar','Détroit de Gibraltar'],['Bosphorus','Bosphore'],['Strait of Hormuz','Détroit d’Ormuz'],['Bering Strait','Détroit de Béring']]},
  {c:'geo',q:['Which is the largest hot desert on Earth?','Quel est le plus grand désert chaud du monde ?'],o:['Sahara','Gobi','Kalahari','Atacama']},
  {c:'geo',q:['Which river discharges the most water into the ocean?','Quel fleuve rejette le plus d’eau dans l’océan ?'],o:[['Amazon','Amazone'],['Nile','Nil'],['Yangtze','Yangzi'],'Mississippi']},
  {c:'geo',q:['Which is the largest ocean?','Quel est le plus grand océan ?'],o:[['Pacific','Pacifique'],['Atlantic','Atlantique'],['Indian','Indien'],['Arctic','Arctique']]},
  {c:'geo',q:['Counting overseas territories, which country spans the most time zones?','En comptant l’outre-mer, quel pays couvre le plus de fuseaux horaires ?'],o:['France',['Russia','Russie'],['United States','États-Unis'],['China','Chine']]},
  {c:'geo',q:['What is the capital of Australia?','Quelle est la capitale de l’Australie ?'],o:['Canberra','Sydney','Melbourne','Perth']},
  {c:'his',q:['In which year did the Berlin Wall fall?','En quelle année le mur de Berlin est-il tombé ?'],o:['1989','1991','1985','1979']},
  {c:'his',q:['Who brought movable-type printing to Europe around 1450?','Qui a introduit l’imprimerie à caractères mobiles en Europe vers 1450 ?'],o:['Johannes Gutenberg',['Leonardo da Vinci','Léonard de Vinci'],['Martin Luther','Martin Luther'],['Galileo Galilei','Galilée']]},
  {c:'his',q:['Which civilisation built Machu Picchu?','Quelle civilisation a construit le Machu Picchu ?'],o:[['Inca','Les Incas'],['Aztec','Les Aztèques'],['Maya','Les Mayas'],['Olmec','Les Olmèques']]},
  {c:'his',q:['Who was the first person to travel into space?','Qui a été le premier humain dans l’espace ?'],o:['Yuri Gagarin','Neil Armstrong','Alan Shepard','Valentina Tereshkova']},
  {c:'his',q:['In which year did the French Revolution begin?','En quelle année la Révolution française a-t-elle commencé ?'],o:['1789','1799','1776','1815']},
  {c:'his',q:['Which city was the capital of the Byzantine Empire?','Quelle ville était la capitale de l’Empire byzantin ?'],o:['Constantinople','Rome',['Athens','Athènes'],['Alexandria','Alexandrie']]},
  {c:'his',q:['Who was the first woman to win a Nobel Prize?','Quelle femme a reçu la première un prix Nobel ?'],o:['Marie Curie','Ada Lovelace','Rosalind Franklin','Florence Nightingale']},
  {c:'spo',q:['In 11-a-side football, how many players per team are on the pitch?','Au football à 11, combien de joueurs par équipe sont sur le terrain ?'],o:['11','10','9','12']},
  {c:'spo',q:['How many sets must a man win to take a Grand Slam match?','Combien de sets un homme doit-il gagner pour remporter un match de Grand Chelem ?'],o:['3','2','4','5']},
  {c:'spo',q:['How long is an Olympic marathon?','Quelle est la longueur d’un marathon olympique ?'],o:[['42.195 km','42,195 km'],'40 km',['45.5 km','45,5 km'],['39.2 km','39,2 km']]},
  {c:'spo',q:['What does a referee show to send a player off in football?','Que montre l’arbitre pour expulser un joueur au football ?'],o:[['A red card','Un carton rouge'],['A yellow card','Un carton jaune'],['A white card','Un carton blanc'],['A green card','Un carton vert']]},
  {c:'spo',q:['How many players per team are on a basketball court?','Combien de joueurs par équipe sur un terrain de basket ?'],o:['5','6','7','4']},
  {c:'spo',q:['Which country hosted the 2024 Summer Olympics?','Quel pays a accueilli les Jeux olympiques d’été 2024 ?'],o:['France',['Japan','Japon'],['United States','États-Unis'],['Australia','Australie']]},
  {c:'spo',q:['In rugby union, how many points is a try worth?','Au rugby à XV, combien de points vaut un essai ?'],o:['5','3','4','7']},
  {c:'tec',q:['What does CPU stand for?','Que signifie CPU ?'],o:['Central Processing Unit','Computer Power Unit','Core Program Utility','Central Peripheral Unit']},
  {c:'tec',q:['How is the decimal number 5 written in binary?','Comment s’écrit le nombre 5 en binaire ?'],o:['101','110','011','111']},
  {c:'tec',q:['Which HTTP status code means “Not Found”?','Quel code HTTP signifie « Not Found » ?'],o:['404','500','301','200']},
  {c:'tec',q:['Who started the Linux kernel in 1991?','Qui a lancé le noyau Linux en 1991 ?'],o:['Linus Torvalds','Richard Stallman','Bill Gates','Tim Berners-Lee']},
  {c:'tec',q:['How many bits are in a byte?','Combien de bits dans un octet ?'],o:['8','4','16','10']},
  {c:'tec',q:['Which company bought Android in 2005?','Quelle entreprise a racheté Android en 2005 ?'],o:['Google','Apple','Microsoft','Samsung']},
  {c:'tec',q:['What does the “www” in web addresses stand for?','Que signifie le « www » des adresses web ?'],o:['World Wide Web','World Web Window','Wide WebWorldwide','Web World Wire']},
  {c:'bus',q:['In shipping, what does TEU stand for?','En transport maritime, que signifie EVP (TEU) ?'],o:[['Twenty-foot Equivalent Unit','Équivalent vingt pieds'],['Total Export Unit','Unité totale d’export'],['Transport Exchange Unit','Unité d’échange transport'],['Ton Equivalent Unit','Équivalent tonne']]},
  {c:'bus',q:['In the Incoterm “FOB”, what does the B stand for?','Dans l’Incoterm « FOB », que veut dire le B ?'],o:['Board','Bill','Border','Bond']},
  {c:'bus',q:['What does “B2B” mean?','Que signifie « B2B » ?'],o:[['Business to business','Entre entreprises'],['Back to basics','Retour aux bases'],['Buyer to buyer','D’acheteur à acheteur'],['Brand to brand','De marque à marque']]},
  {c:'bus',q:['What does KPI stand for?','Que signifie KPI ?'],o:['Key Performance Indicator','Key Product Index','Known Profit Increase','Key Process Input']},
  {c:'bus',q:['Which is the world’s busiest container port?','Quel est le premier port à conteneurs du monde ?'],o:['Shanghai','Rotterdam',['Singapore','Singapour'],'Los Angeles']},
  {c:'bus',q:['In warehousing, what does FIFO mean?','En entrepôt, que signifie FIFO ?'],o:[['First In, First Out','Premier entré, premier sorti'],['Fast In, Fast Out','Entrée rapide, sortie rapide'],['Freight In, Freight Out','Fret entrant, fret sortant'],['First Invoice, First Order','Première facture, première commande']]},
  {c:'bus',q:['Which currency is used in Japan?','Quelle est la monnaie du Japon ?'],o:['Yen','Won','Yuan','Ringgit']},
  {c:'cul',q:['Which language has the most native speakers?','Quelle langue compte le plus de locuteurs natifs ?'],o:[['Mandarin Chinese','Chinois mandarin'],['English','Anglais'],['Spanish','Espagnol'],'Hindi']},
  {c:'cul',q:['How many lines does a traditional sonnet have?','Combien de vers compte un sonnet classique ?'],o:['14','12','16','10']},
  {c:'cul',q:['Which colour do you mix with yellow to make green paint?','Quelle couleur mélanger au jaune pour obtenir du vert ?'],o:[['Blue','Bleu'],['Red','Rouge'],['White','Blanc'],['Black','Noir']]},
  {c:'cul',q:['Who painted the Mona Lisa?','Qui a peint La Joconde ?'],o:[['Leonardo da Vinci','Léonard de Vinci'],['Michelangelo','Michel-Ange'],['Raphael','Raphaël'],'Botticelli']},
  {c:'cul',q:['How many strings does a standard guitar have?','Combien de cordes a une guitare classique ?'],o:['6','4','5','7']},
  {c:'cul',q:['In which city is the Louvre museum?','Dans quelle ville se trouve le musée du Louvre ?'],o:['Paris','Lyon',['Brussels','Bruxelles'],'Rome']},
  {c:'cul',q:['Which instrument usually has 88 keys?','Quel instrument a généralement 88 touches ?'],o:['Piano',['Organ','Orgue'],['Accordion','Accordéon'],['Harpsichord','Clavecin']]}
];
const tr=v=>Array.isArray(v)?L(v[0],v[1]):v;

/* Word Rush lists, no accents. [WORD, category]. Add freely. */
const WORDS={
  en:[['FROG','Animal'],['SOFA','Object'],['HAIL','Weather'],['DRUM','Music'],['KITE','Toy'],['CAKE','Food'],['JUDO','Sport'],['BOAT','Transport'],['FISH','Animal'],['MILK','Drink'],['HAND','Body'],['SOCK','Clothing'],
      ['TIGER','Animal'],['PIANO','Music'],['PASTA','Food'],['STORM','Weather'],['TRAIN','Transport'],['RIVER','Nature'],['CHAIR','Object'],['PIZZA','Food'],['SKIRT','Clothing'],['JUDGE','Job'],['BEACH','Place'],['MOUSE','Animal'],['PLANT','Nature'],['SHIRT','Clothing'],['EAGLE','Animal'],
      ['GUITAR','Music'],['PLANET','Space'],['ROCKET','Space'],['PALACE','Place'],['DOCTOR','Job'],['SOCCER','Sport'],['TENNIS','Sport'],['BANANA','Food'],['JACKET','Clothing'],['ISLAND','Nature'],['RABBIT','Animal'],['BRIDGE','Place'],['MUSEUM','Place'],['WINTER','Season'],['POTATO','Food'],
      ['DOLPHIN','Animal'],['AIRPORT','Place'],['VOLCANO','Nature'],['PENGUIN','Animal'],['CHICKEN','Food'],['TRUMPET','Music'],['LIBRARY','Place'],['DENTIST','Job'],['CYCLING','Sport'],['RAINBOW','Weather'],['BICYCLE','Transport'],['KITCHEN','Place'],['PYRAMID','Place'],
      ['ELEPHANT','Animal'],['SANDWICH','Food'],['BASEBALL','Sport'],['MOUNTAIN','Nature'],['HOSPITAL','Place'],['DINOSAUR','Animal'],['UMBRELLA','Object'],['KEYBOARD','Object'],['NOTEBOOK','Object'],['AIRPLANE','Transport']],
  fr:[['CHAT','Animal'],['LAIT','Boisson'],['VELO','Transport'],['PAIN','Aliment'],['JUDO','Sport'],['LUNE','Espace'],['ROBE','Vêtement'],['MAIN','Corps'],['CERF','Animal'],['GOLF','Sport'],['THON','Animal'],['TAXI','Transport'],
      ['TIGRE','Animal'],['PIANO','Musique'],['POMME','Fruit'],['PLAGE','Lieu'],['NUAGE','Météo'],['TRAIN','Transport'],['ZEBRE','Animal'],['SAPIN','Nature'],['TENTE','Objet'],['AVION','Transport'],['NEIGE','Météo'],['RUGBY','Sport'],['ORAGE','Météo'],['LAPIN','Animal'],['FUSEE','Espace'],
      ['TENNIS','Sport'],['BANANE','Fruit'],['MOUTON','Animal'],['CAMION','Transport'],['CERISE','Fruit'],['JARDIN','Lieu'],['VOLCAN','Nature'],['TOMATE','Légume'],['CRAYON','Objet'],['BATEAU','Transport'],['CHEVAL','Animal'],['CINEMA','Lieu'],['REQUIN','Animal'],['SOLEIL','Espace'],
      ['GUITARE','Musique'],['PLANETE','Espace'],['CHATEAU','Lieu'],['MEDECIN','Métier'],['POMPIER','Métier'],['FROMAGE','Aliment'],['MANTEAU','Vêtement'],['DAUPHIN','Animal'],['CUISINE','Lieu'],['VOITURE','Transport'],['HOPITAL','Lieu'],['CAROTTE','Légume'],
      ['ELEPHANT','Animal'],['PINGOUIN','Animal'],['ECUREUIL','Animal'],['AEROPORT','Lieu'],['CYCLISME','Sport'],['TRACTEUR','Transport'],['MONTAGNE','Nature'],['SANDWICH','Aliment'],['HANDBALL','Sport'],['PAPILLON','Animal']]
};

/* Sticker avatars: colour + eyes + mouth + shape (+ accessory). */
const AVC=['#5B4BFF','#FF6B3D','#14B37A','#FFC93C','#FF4FA0','#00A6C8','#8B5CF6','#F23F55','#17142A','#3D7BFF','#9BE15D','#FF9F1C'];
const DARKC=new Set(['#5B4BFF','#14B37A','#8B5CF6','#F23F55','#17142A','#3D7BFF','#00A6C8','#FF4FA0','#FF6B3D']);
function face(p,size=36){
  const col=p.col,dark=DARKC.has(col),ln=dark?'#fff':INK,rx=[12,19,8][p.shape%3];
  const eyes=[`<circle cx="14" cy="17" r="4.2" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="26" cy="17" r="4.2" fill="#fff" stroke="${INK}" stroke-width="1.6"/><circle cx="15" cy="18" r="1.9" fill="${INK}"/><circle cx="27" cy="18" r="1.9" fill="${INK}"/>`,
    `<rect x="12" y="13" width="4" height="8" rx="2" fill="${ln}"/><rect x="24" y="13" width="4" height="8" rx="2" fill="${ln}"/>`,
    `<path d="M10 17h7" stroke="${ln}" stroke-width="2.4" stroke-linecap="round"/><circle cx="26" cy="17" r="3" fill="${ln}"/>`,
    `<rect x="9" y="13" width="22" height="7" rx="3.5" fill="${INK}"/><rect x="11" y="14.5" width="7" height="2" rx="1" fill="#fff" opacity=".6"/>`][p.eyes%4];
  const mouth=[`<path d="M14 26q6 6 12 0" fill="none" stroke="${ln}" stroke-width="2.4" stroke-linecap="round"/>`,`<path d="M15 27h10" stroke="${ln}" stroke-width="2.4" stroke-linecap="round"/>`,`<circle cx="20" cy="27.5" r="2.6" fill="${ln}"/>`,`<path d="M13 25h14q-1 6-7 6t-7-6z" fill="#fff" stroke="${ln}" stroke-width="1.8" stroke-linejoin="round"/>`][p.mouth%4];
  const acc=p.acc===1?`<path d="M11 4l4 5 5-6 5 6 4-5v6H11z" fill="#FFC93C" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`:p.acc===2?`<rect x="3" y="8" width="34" height="5" rx="2.5" fill="#fff" stroke="${INK}" stroke-width="1.5"/>`
    :p.acc===3?`<path d="M5 9.5 7.5 1.5l7 5.2M35 9.5l-2.5-8-7 5.2" fill="${col}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M7.6 4.6 8.4 7.4M32.4 4.6l-.8 2.8" stroke="#FF8FB1" stroke-width="2" stroke-linecap="round"/>`
    :p.acc===4?`<ellipse cx="20" cy="2.8" rx="9.5" ry="2.2" fill="none" stroke="#FFC93C" stroke-width="2.4"/>`
    :p.acc===5?`<ellipse cx="8.5" cy="23" rx="3.2" ry="2" fill="#FF8FB1" opacity=".9"/><ellipse cx="31.5" cy="23" rx="3.2" ry="2" fill="#FF8FB1" opacity=".9"/>`:'';
  const top=p.acc===1||p.acc===3||p.acc===4;
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><rect x="1.5" y="${top?4.5:1.5}" width="37" height="${top?34:37}" rx="${rx}" fill="${col}" stroke="${INK}" stroke-width="2.2"/><g transform="translate(0 ${top?1.5:0})">${eyes}${mouth}${top?'':acc}</g>${top?acc:''}</svg>`;
}
const AV_PRESETS=[{col:'#5B4BFF',eyes:0,mouth:0,shape:0},{col:'#FFC93C',eyes:1,mouth:3,shape:1},{col:'#14B37A',eyes:0,mouth:2,shape:2},{col:'#FF4FA0',eyes:2,mouth:0,shape:0},{col:'#00A6C8',eyes:3,mouth:1,shape:1},{col:'#FF6B3D',eyes:1,mouth:0,shape:2},{col:'#9BE15D',eyes:0,mouth:3,shape:1},{col:'#8B5CF6',eyes:2,mouth:2,shape:0},{col:'#17142A',eyes:3,mouth:0,shape:2,acc:1,premium:true},{col:'#FF9F1C',eyes:0,mouth:3,shape:0,acc:2,premium:true},
  {col:'#F23F55',eyes:0,mouth:3,shape:1,acc:3,premium:true},{col:'#FFFFFF',eyes:2,mouth:0,shape:0,acc:4,premium:true},{col:'#00A6C8',eyes:3,mouth:2,shape:2,acc:1,premium:true},{col:'#9BE15D',eyes:0,mouth:0,shape:1,acc:5,premium:true}];
function demoFace(id){const h=hashStr(id+'face');return {col:AVC[h%AVC.length],eyes:(h>>>5)%4,mouth:(h>>>9)%4,shape:(h>>>13)%3,acc:(h>>>17)%11===0?2:0};}

/* Demo roster: fictional players, seeded so every page shows the same people. */
const DEMO=(()=>{
  const A=['Kai','Lumi','Rex','Zara','Odin','Mika','Juno','Sora','Vex','Ilya','Nadia','Teo','Yuki','Max','Lea','Omar','Ines','Finn','Aya','Leon','Remy','Tara','Hugo','Noor','Elio','Saga','Bram','Cleo','Dax','Iris'];
  const B=['_rx','.gg','Dash','99','_volt','Prime','_lx','Byte','_k','Zero','Flux','_07','Nova','_hz','Rush'];
  const r=rng(20261010),used=new Set(),out=[];
  for(let i=0;i<84;i++){
    let name;do{name=A[Math.floor(r()*A.length)]+B[Math.floor(r()*B.length)];}while(used.has(name));used.add(name);
    let school,program;
    if(i<9){school='nbu';program='bus2';}
    else if(i<24){school='nbu';program=PROG_IDS[Math.floor(r()*PROG_IDS.length)];}
    else{school=SCHOOLS[1+Math.floor(r()*(SCHOOLS.length-1))].id;program=PROG_IDS[Math.floor(r()*PROG_IDS.length)];}
    const s=r(),miss=()=>r()<0.12,best={};
    TRACKS.forEach((T,ti)=>{best['sprint@'+ti]=miss()?null:+(T.par*(1+(1-s)*0.55+r()*0.08)).toFixed(2);});
    best.reflex=miss()?null:Math.round(188+(1-s)*135+r()*24);
    best.brain=miss()?null:Math.round(2500+s*6200+r()*700);
    best.cards=miss()?null:Math.round(380+s*920+r()*180);
    best.stack=miss()?null:Math.round(160+s*560+r()*110);
    best.grid=miss()?null:Math.round(1800+s*5600+r()*800);
    best.words=miss()?null:Math.round(1200+s*5200+r()*700);
    best.aim=miss()?null:Math.round(3200+s*8800+r()*1500);
    out.push({id:'p'+i,name,face:demoFace('p'+i),school,program,year:P2Y[program],skill:s,rating:Math.round(860+s*800+(r()-.5)*140),best,weekly:Math.round(80+s*900+r()*420),monthly:Math.round(400+s*3200+r()*1300)});
  }
  return out;
})();
const DEMO_BY=Object.fromEntries(DEMO.map(p=>[p.id,p]));
const FRIENDS=['p1','p3','p5','p14','p27','p33','p48','p60'];
const demoMv=(p,k)=>{const h=hashStr(p.id+k+weekStart());return h%5<2?0:(h%7)-3;};
const online=p=>(hashStr(p.id+Math.floor(Date.now()/300000))%3)!==0;

const LEAGUES=[{n:()=>'Bronze',min:0,c:'#C27A4A'},{n:()=>L('Silver','Argent'),min:1000,c:'#8D93AE'},{n:()=>L('Gold','Or'),min:1200,c:'#E0A100'},{n:()=>L('Platinum','Platine'),min:1400,c:'#14B3A0'},{n:()=>L('Diamond','Diamant'),min:1600,c:'#3D7BFF'}];
const league=r=>{let x=LEAGUES[0];LEAGUES.forEach(l=>{if(r>=l.min)x=l;});return x;};
const leagueBadge=r=>{const x=league(r);return `<span class="league"><svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1l5 3v6l-5 3-5-3V4z" fill="${x.c}" stroke="${INK}" stroke-width="1.3"/></svg>${x.n()}</span>`;};
const FRAMES=[{id:'basic',n:()=>L('None','Aucun'),lv:1},{id:'gold',n:()=>L('Gold','Or'),lv:2},{id:'brand',n:()=>L('Brand','Marque'),lv:3},{id:'candy',n:()=>'Candy',lv:5},{id:'mint',n:()=>'Mint',lv:7},{id:'holo',n:()=>'Holo',premium:true},{id:'neon',n:()=>L('Neon','Néon'),premium:true},{id:'flame',n:()=>L('Flame','Flamme'),premium:true},{id:'ice',n:()=>L('Ice','Glace'),premium:true},{id:'royal',n:()=>'Royal',premium:true}];
const SKINS=[{id:'violet',n:()=>'Violet',lv:1,c:'#5B4BFF'},{id:'coral',n:()=>L('Coral','Corail'),lv:3,c:'#F2542D'},{id:'mint',n:()=>'Mint',lv:5,c:'#0E9F78'},{id:'berry',n:()=>L('Berry','Framboise'),lv:7,c:'#D6336C'},
  {id:'night',n:()=>L('Night','Nuit'),premium:true,c:'#3B2F99'},{id:'ocean',n:()=>L('Ocean','Océan'),premium:true,c:'#0069A8'},{id:'grape',n:()=>L('Grape','Raisin'),premium:true,c:'#7B2CBF'},{id:'gold',n:()=>L('Gold','Or'),premium:true,c:'#9C6510'}];
/* Boutique : catalogue de démonstration (en ligne, il vient du serveur et ses prix font foi). */
const SHOP0={items:[['avatar','8','Le Roi','The King',200],['avatar','9','Bandeau','Headband',150],['avatar','10','Chaton','Kitty',200],['avatar','11','Ange','Angel',250],['avatar','12','Roi cool','Cool King',300],['avatar','13','Timide','Shy',150],
  ['frame','neon','Néon','Neon',300],['frame','flame','Flamme','Flame',300],['frame','ice','Glace','Ice',250],['frame','holo','Holo','Holo',400],['frame','royal','Royal','Royal',500],
  ['skin','night','Nuit','Night',250],['skin','ocean','Océan','Ocean',250],['skin','grape','Raisin','Grape',250],['skin','gold','Or','Gold',400]].map(([kind,ref,fr,en,price])=>({id:kind+':'+ref,kind,ref,fr,en,price})),
  packs:[{id:'s',gems:100,cents:99},{id:'m',gems:550,cents:499},{id:'l',gems:1200,cents:999}],ad_gems:10,ad_per_day:5,ad_gap_s:45,league_plus:300};
const shopCfg=()=>(LIVE&&typeof NET!=='undefined'&&NET.info&&NET.info.shop)||SHOP0;
const itemOf=(kind,ref)=>shopCfg().items.find(i=>i.kind===kind&&i.ref===String(ref));
const ownsItem=(kind,ref)=>(S.data.owned||[]).includes(kind+':'+ref);
const eur=c=>(c/100).toLocaleString(LOC(),{style:'currency',currency:'EUR'});
const gemTxt=n=>`${fmt(n)} ${plural(n,'gem','gems','gemme','gemmes')}`;

const ACH=[
  {id:'first',n:()=>L('First Run','Premier essai'),d:()=>L('Finish any match.','Termine un match.'),t:s=>s.history.length>0},
  {id:'explorer',n:()=>L('Explorer','Explorateur'),d:()=>L('Play all 8 games.','Joue aux 8 jeux.'),t:s=>new Set(s.history.map(h=>h.g)).size>=8},
  {id:'duelist',n:()=>L('Duelist','Duelliste'),d:()=>L('Win 3 duels.','Gagne 3 duels.'),t:s=>s.stats.duelWins>=3},
  {id:'flash',n:()=>'Flash',d:()=>L('React under 200 ms once.','Réagis en moins de 200 ms.'),t:s=>s.stats.flash},
  {id:'sharp',n:()=>L('Sharp Eye','Œil de lynx'),d:()=>L('Average under 250 ms in Reflex Arena.','Moyenne sous 250 ms à Reflex Arena.'),t:s=>s.bests.reflex!=null&&s.bests.reflex<250},
  {id:'scholar',n:()=>L('Scholar','Érudit'),d:()=>L('8 of 8 in Brain Battle.','8 sur 8 à Brain Battle.'),t:s=>s.stats.scholar},
  {id:'shark',n:()=>L('Card Shark','Requin des cartes'),d:()=>L('Win 3 Card Clash matches.','Gagne 3 matchs de Card Clash.'),t:s=>s.stats.cardWins>=3},
  {id:'clean',n:()=>L('Clean Line','Trajectoire propre'),d:()=>L('Finish Neon Sprint without hitting a cone.','Finis Neon Sprint sans toucher de plot.'),t:s=>s.stats.clean},
  {id:'ghost',n:()=>L('Ghost Hunter','Chasseur de fantôme'),d:()=>L('Beat your own Neon Sprint ghost.','Bats ton propre fantôme à Neon Sprint.'),t:s=>s.stats.ghostBeat},
  {id:'sky',n:()=>L('Skyscraper','Gratte-ciel'),d:()=>L('Reach 30 floors in Skyline Stack.','Atteins 30 étages à Skyline Stack.'),t:s=>s.stats.maxFloors>=30},
  {id:'gridm',n:()=>L('Grid Master','Maître de la grille'),d:()=>L('Solve a 5×5 Grid Lock board.','Résous une grille 5×5.'),t:s=>s.stats.grid5},
  {id:'wordsmith',n:()=>L('Wordsmith','Plume d’or'),d:()=>L('Find an 8-letter word.','Trouve un mot de 8 lettres.'),t:s=>s.stats.word8},
  {id:'sniper',n:()=>L('Sharpshooter','Tireur d’élite'),d:()=>L('Reach a 20-hit combo in Pop Shot.','Fais un combo de 20 à Pop Shot.'),t:s=>s.stats.combo20},
  {id:'streak3',n:()=>L('On a Roll','Sur la lancée'),d:()=>L('Play 3 days in a row.','Joue 3 jours d’affilée.'),t:s=>s.streak>=3},
  {id:'lvl5',n:()=>L('Rising','En pleine ascension'),d:()=>L('Reach level 5.','Atteins le niveau 5.'),t:s=>levelInfo(s.xp).L>=5},
  {id:'campus',n:()=>L('Campus Hero','Héros du campus'),d:()=>L('Play 3 School Cup runs.','Joue 3 parties de Coupe des écoles.'),t:s=>s.stats.schoolRuns>=3},
  {id:'rival',n:()=>L('Rival Wanted','Rival recherché'),d:()=>L('Challenge a friend or classmate.','Défie un ami ou un camarade.'),t:s=>s.stats.challenges>=1}
];
const MISSIONS=[
  {id:'play3',txt:()=>L('Play 3 matches','Joue 3 matchs'),goal:3,xp:80,prog:h=>h.length},
  {id:'variety',txt:()=>L('Play 3 different games','Joue à 3 jeux différents'),goal:3,xp:90,prog:h=>new Set(h.map(x=>x.g)).size},
  {id:'duel',txt:()=>L('Win a 1v1 duel','Gagne un duel 1v1'),goal:1,xp:100,prog:h=>h.filter(x=>x.m==='duel'&&x.o==='win').length},
  {id:'rx',txt:()=>L('Average under 290 ms in Reflex Arena','Moyenne sous 290 ms à Reflex Arena'),goal:1,xp:70,prog:h=>h.some(x=>x.g==='reflex'&&x.s<290)?1:0},
  {id:'bb',txt:()=>L('Score 5,000+ in Brain Battle','Marque 5 000+ à Brain Battle'),goal:1,xp:80,prog:h=>h.some(x=>x.g==='brain'&&x.s>=5000)?1:0},
  {id:'cc',txt:()=>L('Win a Card Clash match','Gagne un match de Card Clash'),goal:1,xp:70,prog:h=>h.some(x=>x.g==='cards'&&x.o==='win')?1:0},
  {id:'sp',txt:()=>L(`Finish City Loop under ${Math.round(TRACKS[0].par*1.3)} s`,`Finis City Loop en moins de ${Math.round(TRACKS[0].par*1.3)} s`),goal:1,xp:90,prog:h=>h.some(x=>x.sk==='sprint@0'&&x.s<TRACKS[0].par*1.3)?1:0},
  {id:'st',txt:()=>L('Reach 20 floors in Skyline Stack','Atteins 20 étages à Skyline Stack'),goal:1,xp:80,prog:h=>h.some(x=>x.g==='stack'&&(x.x||0)>=20)?1:0},
  {id:'gl',txt:()=>L('Solve 4 boards in one Grid Lock run','Résous 4 grilles en une partie de Grid Lock'),goal:1,xp:80,prog:h=>h.some(x=>x.g==='grid'&&(x.x||0)>=4)?1:0},
  {id:'wr',txt:()=>L('Find 6 words in one Word Rush run','Trouve 6 mots en une partie de Word Rush'),goal:1,xp:80,prog:h=>h.some(x=>x.g==='words'&&(x.x||0)>=6)?1:0},
  {id:'am',txt:()=>L('Score 8,000+ in Pop Shot','Marque 8 000+ à Pop Shot'),goal:1,xp:80,prog:h=>h.some(x=>x.g==='aim'&&x.s>=8000)?1:0},
  {id:'sc',txt:()=>L('Play a School Cup run','Joue une partie de Coupe des écoles'),goal:1,xp:60,prog:h=>h.some(x=>x.m==='school')?1:0},
  {id:'dl',txt:()=>L('Use a Daily Challenge attempt','Utilise un essai du Défi du jour'),goal:1,xp:50,prog:h=>h.some(x=>x.m==='daily')?1:0}
];

/* ========================= state & persistence ========================= */
const KEY=LIVE?'ryvo.live.v1':'ryvo.demo.v2',KEY_OLD=LIVE?'ryvo.none':'ryvo.demo.v1';
let STORAGE_OK=true;
function addDays(n){const d=new Date();d.setHours(18,0,0,0);d.setDate(d.getDate()+n);return d.getTime();}
const DEF=()=>({v:2,lang:null,sound:true,
  account:{signedIn:false,username:LIVE?'invite':'ace_rookie',avatar:0,frame:'basic',skin:'violet'},
  gems:0,owned:[],ads:{day:null,n:0,last:0},
  school:{id:LIVE?null:'nbu',program:'bus2',year:LIVE?null:'2',status:'unverified',domain:null},
  xp:0,rating:1000,streak:0,lastDay:null,
  bests:{},ghosts:{},history:[],
  daily:{day:dayKey(),att:{},best:{}},missions:{day:dayKey(),claimed:[]},ach:[],schoolPts:0,
  stats:{duelWins:0,duelLosses:0,cardWins:0,schoolRuns:0,flash:false,scholar:false,clean:false,ghostBeat:false,challenges:0,maxFloors:0,grid5:false,word8:false,combo20:false},
  notifs:[{id:1,text:LIVE?['Welcome to RYVO. Create an account to save your scores and climb the rankings.','Bienvenue sur RYVO. Crée un compte pour enregistrer tes scores et grimper au classement.']:['Welcome to RYVO. Your progress stays on this device and other players are simulated.','Bienvenue sur RYVO. Ta progression reste sur cet appareil et les autres joueurs sont simulés.'],t:Date.now(),read:false}],
  invites:LIVE?[]:[{id:'i1',from:'p3',game:'reflex',t:Date.now()-3600e3},{id:'i2',from:'p14',game:'words',t:Date.now()-7.2e6}],
  seen:{},notify:[],
  events:[{id:'e1',name:'Freshers Reflex Cup',game:'reflex',date:addDays(4),vis:'private',elig:'all',seed:true},{id:'e2',name:'NBU vs Lysière · Word Rush',game:'words',date:addDays(11),vis:'public',elig:'all',seed:true}]
});
function load(){
  let d=null;
  try{const raw=localStorage.getItem(KEY);if(raw)d=JSON.parse(raw);}catch(e){STORAGE_OK=false;}
  const base=DEF();
  if(d&&d.v===2){return Object.assign(base,d,{stats:Object.assign(base.stats,d.stats||{}),account:Object.assign(base.account,d.account||{})});}
  try{const old=JSON.parse(localStorage.getItem(KEY_OLD)||'null');if(old&&old.v===1){
    base.xp=old.xp||0;base.rating=old.rating||1000;base.streak=old.streak||0;base.lastDay=old.lastDay||null;
    if(old.account){base.account.username=old.account.username||base.account.username;base.account.signedIn=!!old.account.signedIn;}
    base.notifs.unshift({id:2,text:['Your level, XP and rating carried over from the previous version.','Ton niveau, ton XP et ta cote ont été repris de la version précédente.'],t:Date.now(),read:false});
  }}catch(e){}
  try{localStorage.setItem(KEY+'.probe','1');localStorage.removeItem(KEY+'.probe');}catch(e){STORAGE_OK=false;}
  return base;
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S.data));}catch(e){STORAGE_OK=false;}}

const S={route:'home',data:null,game:null,result:null,ctrl:null,
  ui:{lib:{cat:'all',mode:'all',diff:'all',sort:'pop'},rank:{view:'players',scope:'world',board:'rating',loading:false},
      lobby:{game:null,mode:'trial',oppId:null,track:0,cat:'mix'},sheet:null,notif:false,campus:{edit:false,q:'',pick:null,year:null,err:null,adding:false,nn:'',nc:'',nco:''},shop:{tab:'avatar'},lg:{id:null,err:null,busy:false},
      admin:{err:null},calc:{mau:20000,conv:2,price:3.99,inst:5,instPrice:2400,spons:4,sponsPrice:1500}}};
S.data=load();
/* écoles ajoutées par le joueur en mode démo (en ligne, elles viennent du serveur) */
if(!LIVE)(S.data.customSchools||[]).forEach(x=>{if(!SCH[x.id]){SCHOOLS.push(x);SCH[x.id]=x;}});
LANG=S.data.lang||((navigator.language||'en').toLowerCase().startsWith('fr')?'fr':'en');
document.documentElement.lang=LANG;

/* ========================= derived ========================= */
function levelInfo(xp){let lv=1,need=200,rem=xp;while(rem>=need){rem-=need;lv++;need=200+100*(lv-1);}return {L:lv,into:rem,need};}
const me=()=>({me:true,id:'me',name:S.data.account.username,school:S.data.school.id});
function avP(p,size=36,frame){
  if(p.me){const pr=AV_PRESETS[S.data.account.avatar]||AV_PRESETS[0];return `<span class="avw fr-${frame||S.data.account.frame}">${face(pr,size)}</span>`;}
  return `<span class="avw${p.frame&&p.frame!=='basic'?' fr-'+p.frame:''}">${face(p.face||demoFace(p.id),size)}</span>`;
}
const avMe=(s=36)=>avP(me(),s);
function rollDaily(){const st=S.data,d=dayKey();if(st.daily.day!==d)st.daily={day:d,att:{},best:{}};if(st.missions.day!==d)st.missions={day:d,claimed:[]};}
let dailyGame=()=>PLAYABLE.length?PLAYABLE[hashStr(dayKey()+'g')%PLAYABLE.length]:GAME.reflex;
let dailyTrack=()=>hashStr(dayKey()+'t')%3;
const dailySK=g=>g==='sprint'?'sprint@'+dailyTrack():g;
const attLeft=g=>{rollDaily();const v=S.data.daily.att[g];return v==null?3:v;};
const todayHist=()=>{const d=dayKey();return S.data.history.filter(h=>dayKey(new Date(h.t))===d);};
function todayMissions(){const r=rng(hashStr(dayKey()+'missions'));const rest=shuffle(MISSIONS.slice(1),r);return [MISSIONS[0],rest[0],rest[1]];}
let myPts=since=>S.data.history.filter(h=>h.t>=since).reduce((s,h)=>s+(h.w||0),0);
function fmtScore(sk,v){if(v==null)return '—';const g=gameOf(sk);if(g==='sprint')return Number(v).toLocaleString(LOC(),{minimumFractionDigits:2,maximumFractionDigits:2})+' s';if(g==='reflex')return Math.round(v)+' ms';return fmt(v)+' pts';}
const skName=sk=>{const g=GAME[gameOf(sk)];return g.id==='sprint'?g.name+' · '+TRACKS[trackOf(sk)].name:g.name;};
const lower=sk=>!!GAME[gameOf(sk)].lower;
const better=(sk,a,b)=>b==null||(lower(sk)?a<b:a>b);
const gameSKbest=g=>{if(g!=='sprint')return [g,S.data.bests[g]];for(let i=0;i<TRACKS.length;i++)if(S.data.bests['sprint@'+i]!=null)return ['sprint@'+i,S.data.bests['sprint@'+i]];return ['sprint@0',null];};

function BOARD(b){
  if(b==='rating')return {n:L('Competitive rating','Cote compétitive'),lower:false,f:v=>fmt(v)+' SR'};
  if(b==='weekly')return {n:L('This week','Cette semaine'),lower:false,f:v=>fmt(v)+' pts'};
  if(b==='monthly')return {n:L('This month','Ce mois-ci'),lower:false,f:v=>fmt(v)+' pts'};
  return {n:skName(b),lower:lower(b),f:v=>fmtScore(b,v)};
}
const BOARD_IDS=['rating',...SKS,'weekly','monthly'];
const SCOPES=[['friends',()=>L('Friends','Amis')],['class',()=>L('Class','Promo')],['school',()=>L('School','École')],['city',()=>L('City','Ville')],['country',()=>L('Country','Pays')],['world',()=>L('World','Monde')]];
function inScope(p,scope){
  const st=S.data,my=SCH[st.school.id],s=SCH[p.school];
  switch(scope){
    case 'friends':return FRIENDS.includes(p.id);
    case 'class':return !!my&&!!st.school.year&&p.school===st.school.id&&p.year===st.school.year;
    case 'school':return !!my&&p.school===st.school.id;
    case 'city':return !!my&&s.city===my.city;
    case 'country':return !!my&&s.country[0]===my.country[0];
    default:return true;
  }
}
function demoVal(p,b){if(b==='rating')return p.rating;if(b==='weekly')return p.weekly;if(b==='monthly')return p.monthly;return p.best[b];}
function myVal(b){const st=S.data;if(b==='rating')return st.rating;if(b==='weekly')return myPts(weekStart());if(b==='monthly')return myPts(monthStart());return st.bests[b];}
function boardRows(b,scope){
  const B=BOARD(b);
  const rows=DEMO.filter(p=>inScope(p,scope)).map(p=>({id:p.id,name:p.name,face:p.face,school:p.school,val:demoVal(p,b),mv:demoMv(p,b)})).filter(r=>r.val!=null);
  const v=myVal(b);let m=null;
  if(v!=null&&((b!=='weekly'&&b!=='monthly')||v>0)){m=Object.assign(me(),{val:v,mv:0});rows.push(m);}
  rows.sort((a,c)=>B.lower?a.val-c.val:c.val-a.val);
  rows.forEach((r,i)=>r.pos=i+1);
  return {rows,me:m};
}
function dailyRows(sk){
  const g=gameOf(sk),lw=lower(sk),r=rng(hashStr(dayKey()+'daily'+sk)),rows=[];
  DEMO.forEach(p=>{if(r()<0.45&&p.best[sk]!=null){const v=lw?p.best[sk]*(1+r()*0.12):p.best[sk]*(1-r()*0.2);rows.push({id:p.id,name:p.name,face:p.face,school:p.school,val:g==='sprint'?+v.toFixed(2):Math.round(v),mv:0});}});
  const v=S.data.daily.best[g];let m=null;
  if(S.data.daily.day===dayKey()&&v!=null){m=Object.assign(me(),{val:v,mv:0});rows.push(m);}
  rows.sort((a,c)=>lw?a.val-c.val:c.val-a.val);rows.forEach((x,i)=>x.pos=i+1);
  return {rows,me:m};
}
function uniRows(){
  const st=S.data;
  const agg=SCHOOLS.map(s=>({id:s.id,name:s.name,short:s.short,city:s.city,col:s.col,members:0,pts:4000+hashStr(s.id+weekStart())%5200,mv:0,mine:false,you:0}));
  DEMO.forEach(p=>{const a=agg.find(x=>x.id===p.school);a.members++;a.pts+=p.weekly;});
  const mine=agg.find(a=>a.id===st.school.id);
  if(mine){mine.mine=true;mine.you=st.schoolPts;mine.pts+=st.schoolPts;mine.members++;}
  agg.forEach(a=>{const h=hashStr(a.id+'mv'+weekStart());a.mv=h%3===0?0:(h%5)-2;});
  agg.sort((a,b)=>b.pts-a.pts);agg.forEach((a,i)=>a.pos=i+1);
  return agg;
}
function classRows(){
  const st=S.data;if(!SCH[st.school.id])return [];
  const map={};YEAR_IDS.slice(0,5).forEach(y=>map[y]={id:y,pts:900+hashStr(y+st.school.id+weekStart())%1800,members:0,mine:y===st.school.year});
  DEMO.filter(p=>p.school===st.school.id).forEach(p=>{if(map[p.year]){map[p.year].pts+=p.weekly;map[p.year].members++;}});
  if(map[st.school.year]){map[st.school.year].pts+=st.schoolPts;map[st.school.year].members++;}
  const rows=Object.values(map).sort((a,b)=>b.pts-a.pts);
  rows.forEach((r,i)=>{r.pos=i+1;const h=hashStr(r.id+'cmv'+weekStart());r.mv=h%3===0?0:(h%5)-2;});
  return rows;
}
function pickOpponent(exclude){
  const r=S.data.rating;
  const pool=DEMO.filter(p=>Math.abs(p.rating-r)<170&&p.id!==exclude);
  const list=pool.length?pool:DEMO.slice().sort((a,b)=>Math.abs(a.rating-r)-Math.abs(b.rating-r)).slice(0,8);
  return list[Math.floor(Math.random()*list.length)].id;
}
function notify(en,fr){S.data.notifs.unshift({id:Date.now()+Math.random(),text:[en,fr],t:Date.now(),read:false});S.data.notifs=S.data.notifs.slice(0,40);}
const ntext=n=>Array.isArray(n.text)?L(n.text[0],n.text[1]):n.text;
let toastTimer=0;
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200);}
