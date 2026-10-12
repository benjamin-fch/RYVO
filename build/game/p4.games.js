
/* =========================================================
   Shared game helpers
   ========================================================= */
function Parts(){const P=[];return {
  add(x,y,cols,n=12,spd=180,o={}){if(REDUCED)n=Math.min(n,4);for(let i=0;i<n;i++){const a=(o.dir!=null?o.dir+(Math.random()-.5)*(o.spread||1):Math.random()*Math.PI*2),s=spd*(.3+Math.random()*.9);P.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,g:o.g!=null?o.g:300,life:o.life||.7,t:0,c:cols[i%cols.length],r:(o.r||4)*(.6+Math.random()*.8),sq:o.sq});}},
  step(dt){for(let i=P.length-1;i>=0;i--){const p=P[i];p.t+=dt;if(p.t>=p.life){P.splice(i,1);continue;}p.vy+=p.g*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.985;}},
  draw(cx){for(const p of P){const k=1-p.t/p.life;cx.globalAlpha=Math.max(0,k);cx.fillStyle=p.c;cx.strokeStyle=INK;cx.lineWidth=1.2;cx.beginPath();if(p.sq)cx.rect(p.x-p.r,p.y-p.r,p.r*2,p.r*2);else cx.arc(p.x,p.y,p.r*(.5+k*.5),0,Math.PI*2);cx.fill();if(p.r>3)cx.stroke();}cx.globalAlpha=1;},
  get n(){return P.length;}
};}
function setupCanvas(cv,W,H){
  const st={sc:1,dpr:1};
  const size=()=>{const w=cv.clientWidth||W;st.dpr=Math.min(2,window.devicePixelRatio||1);cv.width=Math.round(w*st.dpr);cv.height=Math.round(w*H/W*st.dpr);st.sc=w/W;};
  size();let ro=null;if(window.ResizeObserver){ro=new ResizeObserver(size);ro.observe(cv);}else window.addEventListener('resize',size);
  st.stop=()=>{if(ro)ro.disconnect();else window.removeEventListener('resize',size);};
  st.toCanvas=(e)=>{const r=cv.getBoundingClientRect();return [(e.clientX-r.left)/r.width*W,(e.clientY-r.top)/r.height*H];};
  return st;
}
function brandHex(){const v=(getComputedStyle(document.body).getPropertyValue('--brand')||'').trim();return /^#/.test(v)?v:'#5B4BFF';}
function rivalHTML(ctx){return ctx.opp?`<div class="rivalbar">${avP(ctx.opp,26)}<span><b>${esc(ctx.opp.name)}</b> · ${L('simulated','simulé')}</span><span style="margin-left:auto" class="mono" data-rival>0</span></div>`:'';}
function rivalTick(el,ctx,frac){const n=el.querySelector('[data-rival]');if(n&&ctx.oppScore!=null)n.textContent=fmt(ctx.oppScore*clamp(frac,0,1));}
function duelOutcome(ctx,score){if(ctx.mode!=='duel'||ctx.oppScore==null)return null;return score===ctx.oppScore?'draw':score>ctx.oppScore?'win':'loss';}
function countdown(el,over,cb){let n=3;const tick=()=>{if(!el.isConnected)return;if(n>0){over.textContent=n;over.className='over show pop';SFX.play('tick');n--;setTimeout(tick,650);}else{over.textContent=L('GO!','GO !');over.className='over show pop';SFX.play('go');setTimeout(()=>{if(over.textContent!==L('GO!','GO !'))return;over.className='over';},500);cb();}};tick();}

/* =========================================================
   GAME 1 — Neon Sprint (canvas, top-down)
   ========================================================= */
function mountSprint(el,ctx,done){
  const T=TRACKS[ctx.track],N=T.N,st=S.data;
  el.innerHTML=`<div class="stack" style="gap:12px">
    <div class="hud">
      <div class="gfill"><span class="lab">${L('Lap','Tour')}</span><b data-h="lap">1/3</b></div>
      <div><span class="lab">${L('Time','Temps')}</span><b data-h="time">0.00</b></div>
      <div><span class="lab">${L('Speed','Vitesse')}</span><b data-h="spd">0</b><small>km/h</small></div>
      <div><span class="lab" data-h="rlab">${L('Ghost','Fantôme')}</span><b data-h="delta">—</b></div>
      <div><span class="lab">Boost</span><div class="bar thin" style="margin-top:6px"><i data-h="boost" style="width:0;background:#FFC93C"></i></div></div>
    </div>
    <div class="cv-wrap"><canvas role="img" aria-label="${T.name}" style="aspect-ratio:1000/680"></canvas><div class="over"></div></div>
    <div class="touchpad"><button type="button" data-k="left" aria-label="${L('Steer left','Tourner à gauche')}">◀</button><button type="button" data-k="brake">${L('Brake','Frein')}</button><button type="button" data-k="right" aria-label="${L('Steer right','Tourner à droite')}">▶</button></div>
    <p class="hint"><kbd>↑</kbd>/<kbd>W</kbd>/<kbd>Z</kbd> ${L('accelerate','accélérer')} · <kbd>←</kbd><kbd>→</kbd> ${L('steer','tourner')} · <kbd>↓</kbd>/<kbd>S</kbd> ${L('brake','freiner')}. ${L('On touch screens the car accelerates on its own.','Sur écran tactile, la voiture accélère seule.')}</p>
  </div>`;
  const cv=el.querySelector('canvas'),cx=cv.getContext&&cv.getContext('2d');if(!cx)throw new Error('canvas');
  const over=el.querySelector('.over'),H=k=>el.querySelector(`[data-h="${k}"]`);
  const CS=setupCanvas(cv,T.W,T.H),BR=brandHex(),parts=Parts();
  const at=(i,o)=>{const p=T.pts[i%N],a=T.tan[i%N]+Math.PI/2;return {x:p[0]+Math.cos(a)*o,y:p[1]+Math.sin(a)*o,a:T.tan[i%N]};};
  const pads=T.pads.map(([i,o])=>Object.assign(at(i,o),{cd:0})),oils=T.oils.map(([i,o])=>Object.assign(at(i,o),{inn:false})),cones=T.cones.map(([i,o])=>Object.assign(at(i,o),{cd:0}));
  const tr=rng(hashStr(T.name)),trees=[];
  for(let k=0;k<400&&trees.length<26;k++){const x=30+tr()*(T.W-60),y=30+tr()*(T.H-60);let md=1e9;for(let i=0;i<N;i+=3){const p=T.pts[i];md=Math.min(md,Math.hypot(p[0]-x,p[1]-y));}if(md>T.half+38&&trees.every(t=>Math.hypot(t.x-x,t.y-y)>44))trees.push({x,y,r:12+tr()*10});}
  let off=null;
  function drawTrack(){
    off=document.createElement('canvas');off.width=cv.width;off.height=cv.height;const o=off.getContext('2d');if(!o){off=null;return;}
    o.setTransform(CS.sc*CS.dpr,0,0,CS.sc*CS.dpr,0,0);
    o.fillStyle=T.ground;o.fillRect(0,0,T.W,T.H);
    o.fillStyle='rgba(23,20,42,.07)';for(let x=12;x<T.W;x+=24)for(let y=12;y<T.H;y+=24){o.beginPath();o.arc(x,y,1.4,0,Math.PI*2);o.fill();}
    const path=new Path2D();T.pts.forEach((p,i)=>i?path.lineTo(p[0],p[1]):path.moveTo(p[0],p[1]));path.closePath();
    o.lineJoin='round';o.lineCap='round';
    o.strokeStyle=INK;o.lineWidth=T.half*2+18;o.stroke(path);
    o.strokeStyle='#fff';o.lineWidth=T.half*2+13;o.stroke(path);
    o.setLineDash([18,18]);o.strokeStyle='#F23F55';o.stroke(path);o.setLineDash([]);
    o.strokeStyle='#2E2A45';o.lineWidth=T.half*2;o.stroke(path);
    o.setLineDash([14,18]);o.strokeStyle='rgba(255,255,255,.35)';o.lineWidth=2.5;o.stroke(path);o.setLineDash([]);
    const p=T.pts[0],sq=T.half*2/8;o.save();o.translate(p[0],p[1]);o.rotate(T.tan[0]);for(let r=0;r<2;r++)for(let k=0;k<8;k++){o.fillStyle=(r+k)%2?'#fff':INK;o.fillRect(-sq+r*sq,-T.half+k*sq,sq,sq);}o.restore();
    trees.forEach(t=>{o.fillStyle='rgba(23,20,42,.15)';o.beginPath();o.arc(t.x+4,t.y+5,t.r,0,Math.PI*2);o.fill();o.fillStyle='#4CC38A';o.strokeStyle=INK;o.lineWidth=2;o.beginPath();o.arc(t.x,t.y,t.r,0,Math.PI*2);o.fill();o.stroke();o.fillStyle='rgba(255,255,255,.35)';o.beginPath();o.arc(t.x-t.r*.35,t.y-t.r*.35,t.r*.3,0,Math.PI*2);o.fill();});
  }
  const s0=N-6,car={x:T.pts[s0][0],y:T.pts[s0][1],a:T.tan[s0],v:0};
  let lastIdx=s0,prog=-6,lapsDone=0,splits=[],raceT=0,phase='count',boostT=0,spin=0,spinDir=1,boosts=0,hits=0,alive=true,raf=0,last=performance.now(),recNext=0,frames=[],wasOff=false,shakeT=0,lapFlash=0;
  const keys={gas:false,brake:false,left:false,right:false};let auto=mm('(pointer:coarse)');
  const gh=st.ghosts[ctx.sk];
  const replay=ctx.mode!=='duel'&&gh&&Array.isArray(gh.frames)&&gh.frames.length>5?gh:null;
  const rivalT=ctx.mode==='duel'?ctx.oppTime:(replay?replay.time:+(T.par*1.45).toFixed(2));
  const rivalName=ctx.mode==='duel'?ctx.opp.name:replay?'PB':L('Rookie ghost','Fantôme débutant');
  H('rlab').textContent=ctx.mode==='duel'?ctx.opp.name:replay?L('PB ghost','Fantôme record'):L('Ghost','Fantôme');
  const sampleAt=pr=>{const q=((pr%N)+N)%N,i=Math.floor(q),f=q-i,a=T.pts[i],b=T.pts[(i+1)%N];return {x:a[0]+(b[0]-a[0])*f,y:a[1]+(b[1]-a[1])*f,a:T.tan[i]};};
  function rivalAt(t){
    if(replay){const fr=replay.frames,k=t/0.1,i=Math.min(fr.length-1,Math.floor(k)),j=Math.min(fr.length-1,i+1),f=Math.min(1,k-i),A=fr[i],B=fr[j];return {x:A[0]+(B[0]-A[0])*f,y:A[1]+(B[1]-A[1])*f,a:A[2]/100,pr:A[3]+(B[3]-A[3])*f};}
    const pr=Math.min(1,t/rivalT)*3*N-6,p=sampleAt(pr),n=p.a+Math.PI/2,lat=Math.sin(t*0.9)*7;return {x:p.x+Math.cos(n)*lat,y:p.y+Math.sin(n)*lat,a:p.a,pr};
  }
  function nearest(x,y,from){let best=1e12,bi=from;for(let k=-28;k<=28;k++){const i=(from+k+N)%N,p=T.pts[i],d=(p[0]-x)**2+(p[1]-y)**2;if(d<best){best=d;bi=i;}}if(best>90*90){for(let i=0;i<N;i++){const p=T.pts[i],d=(p[0]-x)**2+(p[1]-y)**2;if(d<best){best=d;bi=i;}}}return {i:bi,d:Math.sqrt(best)};}
  function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
  function drawCar(x,y,a,col,alpha,boost){
    cx.save();cx.translate(x,y);cx.rotate(a);cx.globalAlpha=alpha;
    if(boost){cx.fillStyle='#FFC93C';cx.strokeStyle=INK;cx.lineWidth=1.5;cx.beginPath();cx.moveTo(-12,-5);cx.lineTo(-24-Math.random()*10,0);cx.lineTo(-12,5);cx.closePath();cx.fill();cx.stroke();}
    cx.fillStyle='rgba(23,20,42,.25)';rr(cx,-11,-5,24,13,4);cx.fill();
    cx.fillStyle=col;cx.strokeStyle=INK;cx.lineWidth=2;rr(cx,-13,-7,26,14,4.5);cx.fill();cx.stroke();
    cx.fillStyle=INK;rr(cx,-1,-5,8,10,2);cx.fill();cx.fillStyle='#fff';cx.fillRect(10,-6,2.5,3);cx.fillRect(10,3,2.5,3);
    cx.restore();cx.globalAlpha=1;
  }
  function draw(){
    if(!off||off.width!==cv.width)drawTrack();
    cx.setTransform(1,0,0,1,0,0);cx.clearRect(0,0,cv.width,cv.height);
    let sx=0,sy=0;if(shakeT>0&&!REDUCED){sx=(Math.random()-.5)*10*CS.dpr;sy=(Math.random()-.5)*10*CS.dpr;}
    if(off)cx.drawImage(off,sx,sy);
    cx.setTransform(CS.sc*CS.dpr,0,0,CS.sc*CS.dpr,sx,sy);
    const tt=performance.now()/1000;
    pads.forEach(p=>{cx.save();cx.translate(p.x,p.y);cx.rotate(p.a);cx.globalAlpha=p.cd>0?0.3:1;const k=1+0.08*Math.sin(tt*8);cx.scale(k,k);cx.strokeStyle=INK;cx.lineWidth=7;cx.lineCap='round';cx.lineJoin='round';for(let j=-1;j<=1;j++){cx.beginPath();cx.moveTo(j*8-4,-9);cx.lineTo(j*8+4,0);cx.lineTo(j*8-4,9);cx.stroke();}cx.strokeStyle='#FFC93C';cx.lineWidth=3.5;for(let j=-1;j<=1;j++){cx.beginPath();cx.moveTo(j*8-4,-9);cx.lineTo(j*8+4,0);cx.lineTo(j*8-4,9);cx.stroke();}cx.restore();});
    oils.forEach(o=>{cx.save();cx.translate(o.x,o.y);cx.rotate(o.a);cx.fillStyle='#0E0C1A';cx.beginPath();cx.ellipse(0,0,18,12,0,0,Math.PI*2);cx.ellipse(10,6,7,5,0,0,Math.PI*2);cx.fill();cx.fillStyle='rgba(143,211,255,.7)';cx.beginPath();cx.ellipse(-5,-3,6,2.5,.3,0,Math.PI*2);cx.fill();cx.restore();});
    cones.forEach(c=>{cx.fillStyle='#FF6B3D';cx.strokeStyle=INK;cx.lineWidth=2;cx.beginPath();cx.arc(c.x,c.y,8,0,Math.PI*2);cx.fill();cx.stroke();cx.strokeStyle='#fff';cx.lineWidth=2.5;cx.beginPath();cx.arc(c.x,c.y,4,0,Math.PI*2);cx.stroke();});
    const rv=rivalAt(phase==='count'?0:raceT);drawCar(rv.x,rv.y,rv.a,'#fff',0.55,false);
    parts.draw(cx);
    drawCar(car.x,car.y,car.a,BR,1,boostT>0);
  }
  function step(dt){
    raceT+=dt;if(boostT>0)boostT-=dt;if(shakeT>0)shakeT-=dt;
    const gas=keys.gas||(auto&&!keys.brake),steer=(keys.right?1:0)-(keys.left?1:0);
    const vmax=(boostT>0?390:300)*(wasOff?0.42:1);
    if(gas)car.v+=(boostT>0?560:340)*dt;else if(car.v!==0)car.v-=Math.sign(car.v)*Math.min(Math.abs(car.v),110*dt);
    if(keys.brake)car.v-=560*dt;
    if(car.v>vmax)car.v=Math.max(vmax,car.v-700*dt);
    car.v=clamp(car.v,-80,460);
    const grip=clamp(Math.abs(car.v)/120,0,1);car.a+=steer*3.2*dt*grip*(car.v<0?-1:1);
    if(spin>0){car.a+=spinDir*8*dt;spin-=dt;}
    car.x+=Math.cos(car.a)*car.v*dt;car.y+=Math.sin(car.a)*car.v*dt;
    if(car.x<12||car.x>T.W-12||car.y<12||car.y>T.H-12){car.x=clamp(car.x,12,T.W-12);car.y=clamp(car.y,12,T.H-12);car.v*=0.4;}
    const nr=nearest(car.x,car.y,lastIdx);wasOff=nr.d>T.half+3;
    let d=nr.i-lastIdx;if(d>N/2)d-=N;if(d<-N/2)d+=N;if(Math.abs(d)<=14)prog+=d;lastIdx=nr.i;
    const back=car.a+Math.PI,bx=car.x+Math.cos(back)*12,by=car.y+Math.sin(back)*12;
    if(wasOff&&car.v>60&&Math.random()<.5)parts.add(bx,by,['#C9A27A','#E6CFAE'],1,40,{g:0,life:.5,r:5});
    if(boostT>0&&Math.random()<.7)parts.add(bx,by,['#FFC93C','#FF6B3D'],1,90,{dir:back,spread:.5,g:0,life:.3,r:3});
    if(Math.abs(steer)&&car.v>230&&!wasOff&&Math.random()<.35)parts.add(bx,by,['#D8D4E6'],1,30,{g:0,life:.45,r:4});
    for(const p of pads){if(p.cd>0)p.cd-=dt;else if(Math.hypot(car.x-p.x,car.y-p.y)<22){boostT=1.5;p.cd=1.5;boosts++;SFX.play('coin');parts.add(p.x,p.y,['#FFC93C','#fff'],12,160,{g:0,life:.4,sq:true,r:3});}}
    for(const o of oils){const inn=Math.hypot(car.x-o.x,car.y-o.y)<18;if(inn&&!o.inn){spin=0.42;spinDir=Math.random()<.5?-1:1;car.v*=0.62;SFX.play('whoosh');}o.inn=inn;}
    for(const c of cones){if(c.cd>0){c.cd-=dt;continue;}const dd=Math.hypot(car.x-c.x,car.y-c.y);if(dd<15){car.v*=0.3;hits++;c.cd=0.9;shakeT=.25;SFX.play('crash');FX.buzz(40);parts.add(c.x,c.y,['#FF6B3D','#FFC93C','#fff'],14,220,{g:200,life:.5,r:3});const k=(15-dd)/(dd||1);car.x+=(car.x-c.x)*k;car.y+=(car.y-c.y)*k;}}
    while(raceT>=recNext){frames.push([Math.round(car.x),Math.round(car.y),Math.round(car.a*100),prog]);recNext+=0.1;}
    parts.step(dt);
    const Lp=Math.floor(prog/N);
    if(prog>0&&Lp>lapsDone){lapsDone=Lp;splits.push(+raceT.toFixed(2));if(lapsDone>=3)finish();else{SFX.play('good');over.textContent=L('LAP','TOUR')+' '+(lapsDone+1);over.className='over show pop';lapFlash=1.1;}}
    if(lapFlash>0){lapFlash-=dt;if(lapFlash<=0&&phase==='race')over.className='over';}
    SFX.engineSet(Math.max(0,car.v));
  }
  function hud(){
    H('lap').textContent=Math.min(3,Math.max(1,Math.floor(Math.max(0,prog)/N)+1))+'/3';
    H('time').textContent=raceT.toFixed(2);H('spd').textContent=Math.round(Math.max(0,car.v)*0.72);
    H('boost').style.width=Math.max(0,boostT/1.5*100)+'%';
    if(phase!=='count'){const rv=rivalAt(raceT),diff=(prog-rv.pr)*T.len/N/10;const dl=H('delta');dl.textContent=(diff>=0?'▲ ':'▼ ')+Math.abs(diff).toFixed(0)+' m';dl.style.color=diff>=0?'var(--good)':'var(--bad)';}
  }
  function finish(){
    phase='done';SFX.engineStop();
    const time=+raceT.toFixed(2),perf=clamp((T.slow-time)/(T.slow-T.par),0,1);
    let outcome=null;if(ctx.mode==='duel')outcome=Math.abs(time-rivalT)<0.005?'draw':time<rivalT?'win':'loss';
    over.innerHTML=`<span>${L('Finish','Arrivée')}</span><b>${time.toFixed(2)} s</b>`;over.className='over show fin pop';SFX.play(outcome==='loss'?'lose':'win');
    setTimeout(()=>{if(alive)done({score:time,perf,outcome,oppName:rivalName,oppScore:rivalT,ghost:frames,details:{splits,boosts,hits},payload:{time,splits,boosts,hits},flags:{clean:hits===0,ghostBeat:!!replay&&time<replay.time}});},1500);
  }
  function frame(now){if(!alive)return;const dt=Math.min(0.05,(now-last)/1000);last=now;if(phase==='race')step(dt);else parts.step(dt);draw();hud();raf=requestAnimationFrame(frame);}
  const KM={ArrowUp:'gas',KeyW:'gas',KeyZ:'gas',ArrowDown:'brake',KeyS:'brake',ArrowLeft:'left',KeyA:'left',KeyQ:'left',ArrowRight:'right',KeyD:'right'};
  const kd=e=>{const k=KM[e.code];if(k){keys[k]=true;e.preventDefault();}};const ku=e=>{const k=KM[e.code];if(k)keys[k]=false;};
  window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);
  el.querySelectorAll('.touchpad button').forEach(b=>{const k=b.dataset.k;const on=e=>{e.preventDefault();auto=true;keys[k]=true;b.classList.add('on');try{b.setPointerCapture(e.pointerId);}catch(_){}};const offF=()=>{keys[k]=false;b.classList.remove('on');};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',offF);b.addEventListener('pointercancel',offF);b.addEventListener('lostpointercapture',offF);});
  countdown(el,over,()=>{phase='race';SFX.engineStart();});
  raf=requestAnimationFrame(frame);
  return {destroy(){alive=false;cancelAnimationFrame(raf);SFX.engineStop();window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);CS.stop();}};
}

/* =========================================================
   GAME 2 — Reflex Arena (with decoys from round 3)
   ========================================================= */
const reflexLabel=ms=>ms<200?L('Elite','Élite'):ms<240?L('Sharp','Affûté'):ms<290?L('Solid','Solide'):ms<350?L('Warming up','En rodage'):L('Keep training','Continue l’entraînement');
function mountReflex(el,ctx,done){
  const NR=5,rand=ctx.rand,opp=ctx.opp,oppTimes=opp?Array.from({length:NR},()=>Math.round(ctx.oppBase+12+(Math.random()-.5)*46)):null;
  let round=0,times=[],fs=0,state='idle',t0=0,timers=[],raf=0,alive=true;
  el.innerHTML=`<div class="rx">
    <div class="rx-top"><div class="rounds" data-r></div>${opp?`<div class="rx-opp">${avP(opp,32)}<span><b>${esc(opp.name)}</b> <span class="tiny" data-o>${L('waiting','en attente')}</span><br><span class="pill sim">${L('Simulated','Simulé')}</span></span></div>`:''}</div>
    <button type="button" class="rx-pad" data-pad><span class="rx-big">${L('Tap to start','Touche pour démarrer')}</span><span class="rx-small">${L('Wait for orange, then hit. Blue is a decoy. Space works too.','Attends l’orange, puis frappe. Le bleu est un leurre. Espace fonctionne aussi.')}</span></button>
  </div>`;
  const pad=el.querySelector('[data-pad]'),big=pad.querySelector('.rx-big'),small=pad.querySelector('.rx-small'),R=el.querySelector('[data-r]'),oEl=el.querySelector('[data-o]');
  const later=(f,ms)=>{const id=setTimeout(()=>{if(alive)f();},ms);timers.push(id);return id;};
  const clearAll=()=>{timers.forEach(clearTimeout);timers=[];cancelAnimationFrame(raf);};
  function paint(){
    R.innerHTML=Array.from({length:NR},(_,i)=>`<span class="${i<times.length?'done':i===round&&state!=='idle'?'cur':''}">${i<times.length?times[i]+' ms':'R'+(i+1)}</span>`).join('');
    if(oEl){const d=oppTimes.slice(0,times.length);oEl.textContent=d.length?`${L('avg','moy.')} ${Math.round(d.reduce((a,b)=>a+b,0)/d.length)} ms`:L('waiting','en attente');}
  }
  function arm(){
    clearAll();state='wait';pad.className='rx-pad wait';big.textContent=L('Wait…','Attends…');small.textContent=L(`Round ${round+1} of ${NR}`,`Manche ${round+1} sur ${NR}`);paint();
    const wait=1300+rand()*2300;
    if(round>=2&&rand()<0.65){const dt=500+rand()*(wait-900);later(()=>{state='decoy';pad.className='rx-pad decoy';big.textContent=L('Not yet!','Pas encore !');SFX.play('flip',2);later(()=>{if(state==='decoy'){state='wait';pad.className='rx-pad wait';big.textContent=L('Wait…','Attends…');}},340);},dt);}
    later(()=>{pad.className='rx-pad go';big.textContent=L('NOW!','MAINTENANT !');small.textContent='';SFX.play('go');raf=requestAnimationFrame(()=>{t0=performance.now();state='go';});},wait+(round>=2?250:0));
  }
  function hit(e){
    if(!alive)return;
    if(state==='idle'){SFX.play('tap');arm();return;}
    if(state==='wait'||state==='decoy'){
      clearAll();fs++;state='false';pad.className='rx-pad false';big.textContent=L('False start','Faux départ');small.textContent=L('Too early. Round restarts, +10 ms.','Trop tôt. La manche recommence, +10 ms.');SFX.play('bad');FX.shake(pad);FX.buzz(80);
      later(arm,1200);return;
    }
    if(state==='go'){
      const ms=Math.round(performance.now()-t0);times.push(ms);state='between';round++;pad.className='rx-pad done';big.textContent=ms+' ms';small.textContent=reflexLabel(ms);paint();
      SFX.play('combo',ms<200?16:ms<250?12:ms<300?7:2);
      const [x,y]=e&&e.clientX?[e.clientX,e.clientY]:FX.at(pad);FX.burst(x,y,ms<250?['#FFC93C','#FF6B3D','#fff']:['#FF6B3D','#fff'],ms<220?26:14,ms<220?9:6);
      if(round>=NR)later(finish,1000);else later(arm,1000);
    }
  }
  function finish(){
    const avg=Math.round(times.reduce((a,b)=>a+b,0)/NR),score=avg+fs*10,perf=clamp((420-score)/220,0,1);
    let outcome=null,oppScore=null;if(opp){oppScore=ctx.oppScore!=null?Math.round(ctx.oppScore):Math.round(oppTimes.reduce((a,b)=>a+b,0)/NR);outcome=score===oppScore?'draw':score<oppScore?'win':'loss';}
    done({score,perf,outcome,oppName:opp?opp.name:null,oppScore,details:{times,fs,avg,label:reflexLabel(score)},payload:{times,fs},flags:{flash:times.some(x=>x<200)}});
  }
  const pd=e=>{e.preventDefault();hit(e);};
  const kd=e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();if(!e.repeat)hit();}};
  pad.addEventListener('pointerdown',pd);window.addEventListener('keydown',kd);
  paint();try{pad.focus({preventScroll:true});}catch(e){}
  return {destroy(){alive=false;clearAll();window.removeEventListener('keydown',kd);}};
}

/* =========================================================
   GAME 3 — Brain Battle (categories + streak multiplier)
   ========================================================= */
function pickQs(n,r,cat){
  let pool=shuffle(QBANK.filter(q=>cat==='mix'||q.c===cat).slice(),r);
  if(pool.length<n)pool=pool.concat(shuffle(QBANK.filter(q=>!pool.includes(q)),r));
  const out=[],seen=new Set();
  if(cat==='mix'){pool.forEach(q=>{if(out.length<n&&!seen.has(q.c)){out.push(q);seen.add(q.c);}});}
  pool.forEach(q=>{if(out.length<n&&!out.includes(q))out.push(q);});
  return out.map(q=>({c:q.c,q:q.q,o:q.o,order:shuffle([0,1,2,3],r)}));
}
function mountBrain(el,ctx,done){
  const LIM=10,NQ=8,qs=ctx.questions?ctx.questions.map(x=>({c:x.c,q:[x.q.en,x.q.fr],o:x.o.map(a=>[a.en,a.fr]),order:[0,1,2,3]})):pickQs(NQ,ctx.rand,ctx.cat||'mix');
  const opp=ctx.opp?{name:ctx.opp.name,skill:ctx.opp.skill,p:ctx.opp}:{name:L('Field average','Moyenne des joueurs'),skill:0.45,p:null};
  let i=0,mine=0,theirs=0,ok=0,streak=0,bestStreak=0,times=[],t0=0,raf=0,lock=false,alive=true,plan=null,shown=false,nextT=0,lastTick=99;
  el.innerHTML=`<div class="bb">
    <div class="bb-score"><div class="side">${avMe(40)}<div style="min-width:0"><small>${L('You','Toi')}</small><b data-b="me">0</b></div></div><span class="bb-q mono" data-b="n">1 / ${NQ}</span>
      <div class="side op"><div style="min-width:0"><small>${esc(opp.name)} · ${L('simulated','simulé')}</small><b data-b="op">0</b></div>${opp.p?avP(opp.p,40):'<span class="avw">'+face({col:'#D3CCBF',eyes:1,mouth:1,shape:0},40)+'</span>'}</div></div>
    <div class="row"><div class="bb-timer" style="flex:1" role="progressbar" aria-label="${L('Time left','Temps restant')}"><i data-b="bar"></i></div><span class="combo off" data-b="combo">${ic('flame',14)}×1</span></div>
    <div class="bb-card"><span class="pill" data-b="cat" style="align-self:flex-start"></span><h2 data-b="q"></h2><div class="bb-opts" data-b="o"></div><p class="bb-os" data-b="os" aria-live="polite"></p></div>
  </div>`;
  const E=k=>el.querySelector(`[data-b="${k}"]`),bar=E('bar');
  const mult=()=>streak>=5?1.5:streak>=3?1.2:1;
  function setCombo(bump){const c=E('combo'),m=mult();c.className='combo'+(streak>=3?'':' off')+(bump?' bump':'');c.innerHTML=`${ic('flame',14)}${streak} · ×${String(m).replace('.',LANG==='fr'?',':'.')}`;}
  function show(){
    const q=qs[i];lock=false;shown=false;lastTick=99;
    E('cat').textContent=QCATS[q.c]();E('q').textContent=tr(q.q);E('n').textContent=`${i+1} / ${NQ}`;
    E('o').innerHTML=q.order.map((k,j)=>`<button type="button" class="bb-opt" data-k="${k}"><span class="key mono">${j+1}</span><span>${esc(tr(q.o[k]))}</span></button>`).join('');
    plan={ok:Math.random()<0.45+opp.skill*0.42,t:1.6+(1-opp.skill)*4.6+Math.random()*2.6};
    E('os').textContent=L(`${opp.name} is thinking…`,`${opp.name} réfléchit…`);
    bar.classList.remove('warn');t0=performance.now();tick();
  }
  function tick(){
    if(!alive||lock)return;const e=(performance.now()-t0)/1000,left=LIM-e;
    bar.style.width=Math.max(0,100-e/LIM*100)+'%';if(left<3)bar.classList.add('warn');
    if(left<3&&Math.ceil(left)<lastTick){lastTick=Math.ceil(left);SFX.play('tick');}
    if(!shown&&e>=plan.t&&plan.t<LIM){shown=true;E('os').textContent=L(`${opp.name} locked in an answer.`,`${opp.name} a validé sa réponse.`);}
    if(e>=LIM){answer(-1);return;}raf=requestAnimationFrame(tick);
  }
  function answer(k,btn){
    if(lock)return;lock=true;cancelAnimationFrame(raf);
    const tt=Math.min(LIM,(performance.now()-t0)/1000);times.push(tt);
    const reveal=ci=>{
      if(!alive)return;
      const good=k>=0&&k===ci;
      let pts=0;if(good){ok++;streak++;bestStreak=Math.max(bestStreak,streak);pts=Math.round((500+500*(LIM-tt)/LIM)*mult());}else streak=0;
      mine+=pts;let op=0;
      if(ctx.oppScore!=null){const tg=Math.round(ctx.oppScore*(i+1)/NQ);op=tg-theirs;theirs=tg;}
      else{if(plan.t<LIM&&plan.ok)op=500+Math.round(500*(LIM-plan.t)/LIM);theirs+=op;}
      el.querySelectorAll('.bb-opt').forEach(b=>{const kk=+b.dataset.k;b.disabled=true;if(kk===ci)b.classList.add('right');else if(kk===k)b.classList.add('wrong');});
      E('me').textContent=fmt(mine);E('op').textContent=fmt(theirs);setCombo(good&&streak>=3);
      const target=btn||el.querySelector('.bb-opt.right')||el.querySelector('.bb-opt');const [x,y]=FX.at(target);
      if(good){SFX.play(streak>=3?'perfect':'good');FX.burst(x,y,['#B8F2D9','#14B37A','#FFC93C'],streak>=3?24:14,7);FX.pop('+'+fmt(pts),x,y-20,'#FFC93C');}
      else{SFX.play('bad');FX.shake(el.querySelector('.bb-card'));FX.buzz(60);}
      const oppTxt=ctx.oppScore!=null?`${opp.name} : ${fmt(theirs)}`:`${opp.name} : ${plan.t>=LIM?L('ran out of time','hors délai'):plan.ok?L('correct','juste'):L('wrong','faux')}${op?` (+${fmt(op)})`:''}`;
      E('os').textContent=`${k===-1?L('Time’s up. ','Temps écoulé. '):good?L('Correct! ','Bonne réponse ! '):L('Wrong. ','Raté. ')}${oppTxt}.`;
      nextT=setTimeout(()=>{if(!alive)return;i++;if(i<NQ)show();else end();},1500);
    };
    if(ctx.answer){el.querySelectorAll('.bb-opt').forEach(b=>b.disabled=true);ctx.answer(i,k,tt).then(r=>reveal(r.correct)).catch(e=>{toast(errText(e));reveal(-2);});}
    else reveal(0);
  }
  function end(){
    const avgT=times.reduce((a,b)=>a+b,0)/times.length;let outcome=null;if(ctx.mode==='duel')outcome=mine===theirs?'draw':mine>theirs?'win':'loss';
    done({score:mine,perf:clamp(mine/9000,0,1),outcome,oppName:opp.name,oppScore:theirs,details:{correct:ok,total:NQ,avgT,bestStreak,cat:ctx.cat},payload:{},flags:{scholar:ok===NQ}});
  }
  const ck=e=>{const b=e.target.closest('.bb-opt');if(b&&!b.disabled)answer(+b.dataset.k,b);};
  const kd=e=>{const n=+e.key;if(n>=1&&n<=4&&!lock){const q=qs[i],b=el.querySelectorAll('.bb-opt')[n-1];answer(q.order[n-1],b);}};
  el.addEventListener('click',ck);window.addEventListener('keydown',kd);
  setCombo();show();
  return {destroy(){alive=false;cancelAnimationFrame(raf);clearTimeout(nextT);window.removeEventListener('keydown',kd);}};
}

/* =========================================================
   GAME 4 — Card Clash (with Overcharge)
   ========================================================= */
const effPow=(a,b,oc)=>a.p+(BEATS[a.e]===b.e?3:0)+(oc?2:0);
function cardHTML(c,o={}){
  const E=ELEM[c.e],inner=`<span class="el">${eg(c.e)}${E.n()}</span><span class="pw">${o.hide?'?':c.p}</span><span class="ft"></span>${o.oc?'<span class="oc">+2</span>':''}`;
  const cls=`ccard${o.hide?' back':''}${o.win?' win':''}${o.flip?' flip':''}${o.land?' land':''}`;
  return o.btn?`<button type="button" class="${cls}" style="--c:${E.c}" data-i="${o.i}" aria-label="${E.n()} ${c.p}" ${o.dis?'disabled':''}>${inner}</button>`:`<div class="${cls}" style="--c:${E.c}">${inner}</div>`;
}
function mountCards(el,ctx,done){
  const rand=ctx.rand,skill=ctx.opp?ctx.opp.skill:0.5,oppName=ctx.opp?ctx.opp.name:L('Practice AI','IA d’entraînement');
  let you=[],ai=[];
  for(let tries=0;tries<40;tries++){const deck=[];['volt','flare','tide'].forEach(e=>{for(let p=1;p<=9;p++)deck.push({e,p});});shuffle(deck,rand);you=deck.slice(0,5);ai=deck.slice(5,10);if(Math.abs(you.reduce((s,c)=>s+c.p,0)-ai.reduce((s,c)=>s+c.p,0))<=3)break;}
  const order={volt:0,flare:1,tide:2};you.sort((a,b)=>order[a.e]-order[b.e]||a.p-b.p);ai.sort((a,b)=>order[a.e]-order[b.e]||a.p-b.p);
  let round=0,yw=0,aw=0,ym=0,am=0,busy=false,alive=true,tm=[],ocArmed=false,ocUsed=false,aiOcUsed=false;
  const first=!S.data.history.some(h=>h.g==='cards');
  el.innerHTML=`<div class="cc">
    <details class="cc-rules" ${first?'open':''}><summary>${L('How to play (30 seconds)','Comment jouer (30 secondes)')}</summary><ul class="rules" style="--g:var(--c-cards)">${GAME.cards.rules().map(r=>`<li>${r}</li>`).join('')}</ul>
      <div class="cycle"><span style="background:var(--c-sprint)">${eg('volt')}Volt</span>›<span style="background:var(--c-brain)">${eg('tide')}${ELEM.tide.n()}</span>›<span style="background:var(--c-reflex)">${eg('flare')}${ELEM.flare.n()}</span>›<span style="background:var(--c-sprint)">${eg('volt')}Volt</span></div></details>
    <div class="cc-bar"><div><small>${L('You','Toi')}</small><b data-c="y">0</b></div><span class="pill ink" data-c="r">${L('Round','Manche')} 1 / 5</span><div><small>${esc(oppName)}${ctx.opp?' · '+L('simulated','simulé'):''}</small><b data-c="a">0</b></div></div>
    <div class="cc-hand" data-c="ah"></div>
    <div class="cc-table"><div class="slot" data-c="sy">${L('Your card','Ta carte')}</div><div class="cc-msg" data-c="m" aria-live="polite">${L('Pick a card','Choisis une carte')}<small>${L('You see the rival’s elements. Use your edge.','Tu vois les éléments du rival. Joue l’avantage.')}</small></div><div class="slot" data-c="sa">${L('Rival card','Carte du rival')}</div></div>
    <div class="cc-ctrl"><button class="btn sm" type="button" data-c="oc" aria-pressed="false">${ic('bolt',16)}Overcharge +2</button><span class="tiny" data-c="aoc">${L('Rival Overcharge: available','Surcharge du rival : disponible')}</span></div>
    <div class="cc-hand" data-c="yh"></div>
  </div>`;
  const E=k=>el.querySelector(`[data-c="${k}"]`);
  function paint(){
    E('ah').innerHTML=ai.map(c=>cardHTML(c,{hide:true})).join('');
    E('yh').innerHTML=you.map((c,i)=>cardHTML(c,{btn:true,i,dis:busy,oc:ocArmed})).join('');
    E('y').textContent=yw;E('a').textContent=aw;E('r').textContent=`${L('Round','Manche')} ${Math.min(5,round+1)} / 5`;
    const ob=E('oc');ob.disabled=ocUsed||busy;ob.setAttribute('aria-pressed',ocArmed);ob.className='btn sm'+(ocArmed?' hot':'');ob.innerHTML=`${ic('bolt',16)}${ocUsed?L('Overcharge used','Surcharge utilisée'):ocArmed?L('Overcharge armed','Surcharge armée'):'Overcharge +2'}`;
    E('aoc').textContent=aiOcUsed?L('Rival Overcharge: used','Surcharge du rival : utilisée'):L('Rival Overcharge: available','Surcharge du rival : disponible');
  }
  function aiChoose(){
    if(Math.random()<(1-skill)*0.45)return Math.floor(Math.random()*ai.length);
    let best=-1,bi=0;ai.forEach((c,i)=>{let w=0,n=0;you.forEach(y=>{for(let p=1;p<=9;p++){const yc={e:y.e,p},a=effPow(c,yc),b=effPow(yc,c);w+=a>b?1:a===b?.5:0;n++;}});const s=(n?w/n:.5)-c.p*0.025;if(s>best){best=s;bi=i;}});return bi;
  }
  function aiWantsOC(c){if(aiOcUsed)return false;if(round===4)return true;if(aw<yw&&round>=2)return Math.random()<.7;return c.p>=4&&c.p<=7&&Math.random()<.22;}
  function play(idx){
    if(busy||!alive||idx<0||idx>=you.length)return;busy=true;SFX.play('flip',3);
    const ai_i=aiChoose(),mineC=you.splice(idx,1)[0],theirC=ai.splice(ai_i,1)[0],myOC=ocArmed,aiOC=aiWantsOC(theirC);
    if(myOC){ocUsed=true;ocArmed=false;}if(aiOC)aiOcUsed=true;
    paint();E('sy').innerHTML=cardHTML(mineC,{oc:myOC,land:true});E('sa').innerHTML=cardHTML(theirC,{hide:true,land:true});E('m').innerHTML=L('Revealing…','Révélation…');
    tm.push(setTimeout(()=>{
      if(!alive)return;
      const ey=effPow(mineC,theirC,myOC),ea=effPow(theirC,mineC,aiOC);let msg;
      const why=(c,o,oc)=>[BEATS[c.e]===o.e?L('element +3','élément +3'):'',oc?'Overcharge +2':''].filter(Boolean).join(' · ');
      if(ey>ea){yw++;ym+=ey-ea;msg=`${L('You win the round','Tu gagnes la manche')}<small>${ey} vs ${ea}${why(mineC,theirC,myOC)?' · '+why(mineC,theirC,myOC):''}</small>`;SFX.play('good');const [x,y]=FX.at(E('sy'));FX.burst(x,y,['#FFC93C','#14B37A','#fff'],18,6);}
      else if(ea>ey){aw++;am+=ea-ey;msg=`${L('Rival takes it','Le rival l’emporte')}<small>${ea} vs ${ey}${why(theirC,mineC,aiOC)?' · '+why(theirC,mineC,aiOC):''}</small>`;SFX.play('bad');FX.shake(E('sy'));}
      else{msg=`${L('Tie, no point','Égalité, aucun point')}<small>${ey} vs ${ea}</small>`;SFX.play('tap');}
      E('sy').innerHTML=cardHTML(mineC,{win:ey>ea,oc:myOC});E('sa').innerHTML=cardHTML(theirC,{win:ea>ey,flip:true,oc:aiOC});E('m').innerHTML=msg;
      round++;E('y').textContent=yw;E('a').textContent=aw;
      tm.push(setTimeout(()=>{if(!alive)return;if(round>=5){finish();return;}busy=false;E('sy').innerHTML=L('Your card','Ta carte');E('sa').innerHTML=L('Rival card','Carte du rival');E('m').innerHTML=`${L('Round','Manche')} ${round+1}<small>${yw} – ${aw}</small>`;paint();},1500));
    },600));
  }
  function finish(){const outcome=yw===aw?'draw':yw>aw?'win':'loss';done({score:yw*200+ym*10,perf:yw/5,outcome,oppName,oppScore:aw*200+am*10,details:{yw,aw,margin:ym,oc:ocUsed},payload:{yw,aw,margin:ym,am}});}
  const ck=e=>{if(e.target.closest('[data-c="oc"]')){if(!ocUsed&&!busy){ocArmed=!ocArmed;SFX.play(ocArmed?'coin':'tap');paint();}return;}const b=e.target.closest('button.ccard');if(b&&!b.disabled)play(+b.dataset.i);};
  const kd=e=>{if(e.key==='o'||e.key==='O'){if(!ocUsed&&!busy){ocArmed=!ocArmed;SFX.play(ocArmed?'coin':'tap');paint();}return;}const n=+e.key;if(n>=1&&n<=5)play(n-1);};
  el.addEventListener('click',ck);window.addEventListener('keydown',kd);paint();
  return {destroy(){alive=false;tm.forEach(clearTimeout);window.removeEventListener('keydown',kd);}};
}

/* =========================================================
   GAME 5 — Skyline Stack (canvas)
   ========================================================= */
function mountStack(el,ctx,done){
  const W=480,Hh=640,BH=26,BASE_Y=Hh-70,MAXW=200;
  const pbFloors=Math.max(0,...S.data.history.filter(h=>h.g==='stack').map(h=>h.x||0));
  const rivalFloors=ctx.mode==='duel'&&ctx.oppScore?Math.max(3,Math.round(ctx.oppScore/14)):0;
  el.innerHTML=`<div class="st-wrap">
    <div class="hud" style="width:min(100%,460px)"><div class="gfill"><span class="lab">${L('Floors','Étages')}</span><b data-s="f">0</b></div><div><span class="lab">Score</span><b data-s="s">0</b></div><div><span class="lab">${L('Perfect streak','Série parfaite')}</span><b data-s="c">0</b></div></div>
    ${ctx.opp?`<div style="width:min(100%,460px)">${rivalHTML(ctx)}</div>`:''}
    <div class="cv-wrap"><canvas role="img" aria-label="Skyline Stack" style="aspect-ratio:${W}/${Hh}"></canvas><div class="over"></div></div>
    <p class="hint">${L('Tap, click or press','Touche, clique ou appuie sur')} <kbd>${L('Space','Espace')}</kbd> ${L('to drop the block.','pour lâcher le bloc.')}</p>
  </div>`;
  const cv=el.querySelector('canvas'),cx=cv.getContext&&cv.getContext('2d');if(!cx)throw new Error('canvas');
  const over=el.querySelector('.over'),CS=setupCanvas(cv,W,Hh),parts=Parts(),Hs=k=>el.querySelector(`[data-s="${k}"]`);
  if(ctx.opp){const n=el.querySelector('[data-rival]');if(n)n.textContent=fmt(ctx.oppScore)+' pts';}
  const hue=i=>(250+i*13)%360,col=(i,l=64)=>`hsl(${hue(i)} 85% ${l}%)`;
  const blocks=[{x:(W-MAXW)/2,w:MAXW}];
  let cur=null,score=0,combo=0,maxCombo=0,perfects=0,falling=[],camY=0,camT=0,scale=1,scaleT=1,phase='count',alive=true,raf=0,last=performance.now(),flash=0,clouds=Array.from({length:6},(_,i)=>({x:Math.random()*W,y:40+i*110,r:22+Math.random()*18,v:6+Math.random()*10}));
  function spawn(){const n=blocks.length,top=blocks[n-1],sp=Math.min(560,165+n*8),fromLeft=n%2===1;cur={x:fromLeft?-top.w*0.2:W-top.w*0.8,w:top.w,dir:fromLeft?1:-1,sp};}
  const yOf=i=>BASE_Y-i*BH;
  function drop(){
    if(phase!=='play'||!cur)return;
    const n=blocks.length,top=blocks[n-1],l=Math.max(cur.x,top.x),r=Math.min(cur.x+cur.w,top.x+top.w),ov=r-l,d=cur.x-top.x;
    if(ov<=0){falling.push({x:cur.x,w:cur.w,y:yOf(n),vy:0,rot:0,vr:(cur.dir)*1.5,i:n});cur=null;SFX.play('crash');FX.shake(el.querySelector('.cv-wrap'));FX.buzz(120);gameOver();return;}
    let w=ov,x=l,perfect=Math.abs(d)<=5;
    if(perfect){x=top.x;w=top.w;combo++;perfects++;maxCombo=Math.max(maxCombo,combo);if(combo%3===0&&w<MAXW){const g=Math.min(12,MAXW-w);w+=g;x-=g/2;}score+=10+20+10*Math.min(combo,5);
      SFX.play('perfect');parts.add(x+w/2,yOf(n),['#FFC93C','#fff',col(n)],22,220,{g:120,life:.6,sq:true,r:3});const r2=cv.getBoundingClientRect();FX.pop(L('PERFECT','PARFAIT')+(combo>1?' ×'+combo:''),r2.left+(x+w/2)/W*r2.width,r2.top+(yOf(n)-camY)/Hh*r2.height*scale,'#FFC93C');flash=.15;}
    else{combo=0;score+=10;if(d>0)falling.push({x:r,w:cur.x+cur.w-r,y:yOf(n),vy:0,rot:0,vr:2,i:n});else falling.push({x:cur.x,w:l-cur.x,y:yOf(n),vy:0,rot:0,vr:-2,i:n});SFX.play('place',Math.min(n,20));parts.add(d>0?r:l,yOf(n)+BH/2,['#fff',col(n)],8,120,{g:300,life:.5,r:3});}
    blocks.push({x,w});cur=null;
    Hs('f').textContent=blocks.length-1;Hs('s').textContent=fmt(score);Hs('c').textContent=combo;
    if(rivalFloors&&blocks.length-1===rivalFloors+1)FX.pop(L('Rival passed!','Rival dépassé !'),...FX.at(cv),'#14B37A');
    camT=Math.max(0,(blocks.length-13)*BH);spawn();
  }
  function gameOver(){
    phase='over';const floors=blocks.length-1,total=floors*BH+120;scaleT=Math.min(1,(Hh-60)/total);camT=0;
    setTimeout(()=>{if(!alive)return;over.innerHTML=`<span>${floors} ${L('floors','étages')}</span><b>${fmt(score)}</b>`;over.className='over show fin pop';SFX.play(duelOutcome(ctx,score)==='loss'?'lose':'win');},700);
    setTimeout(()=>{if(alive)done({score,perf:clamp(score/800,0,1),outcome:duelOutcome(ctx,score),oppName:ctx.opp?ctx.opp.name:null,oppScore:ctx.oppScore??null,x:floors,details:{floors,perfects,maxCombo},payload:{floors,perfects,maxCombo,score},flags:{maxFloors:floors}});},2200);
  }
  function rr(x,y,w,h,r){cx.beginPath();cx.moveTo(x+r,y);cx.arcTo(x+w,y,x+w,y+h,r);cx.arcTo(x+w,y+h,x,y+h,r);cx.arcTo(x,y+h,x,y,r);cx.arcTo(x,y,x+w,y,r);cx.closePath();}
  function drawBlock(x,y,w,i){cx.fillStyle=col(i);cx.strokeStyle=INK;cx.lineWidth=2;rr(x,y,w,BH,4);cx.fill();cx.stroke();cx.fillStyle='rgba(255,255,255,.45)';cx.fillRect(x+3,y+3,Math.max(0,w-6),4);}
  function lineAt(f,label,c){const y=yOf(f)+BH;cx.setLineDash([8,6]);cx.strokeStyle=c;cx.lineWidth=2;cx.beginPath();cx.moveTo(0,y);cx.lineTo(W,y);cx.stroke();cx.setLineDash([]);cx.font='700 12px JetBrains Mono, monospace';const tw=cx.measureText(label).width;cx.fillStyle=c;rr(W-tw-18,y-22,tw+12,18,5);cx.fill();cx.fillStyle='#fff';cx.fillText(label,W-tw-12,y-9);}
  function draw(dt){
    cx.setTransform(1,0,0,1,0,0);
    const n=blocks.length,g=cx.createLinearGradient(0,0,0,cv.height);g.addColorStop(0,`hsl(${(hue(n)+20)%360} 80% 90%)`);g.addColorStop(1,'#FBF8F3');cx.fillStyle=g;cx.fillRect(0,0,cv.width,cv.height);
    const k=CS.sc*CS.dpr;cx.setTransform(k,0,0,k,0,0);
    clouds.forEach(c=>{c.x+=c.v*dt;if(c.x-c.r*2>W)c.x=-c.r*2;const cy=((c.y+camY*0.3)%(Hh+80))-40;cx.fillStyle='#fff';cx.strokeStyle='rgba(23,20,42,.25)';cx.lineWidth=1.5;cx.beginPath();cx.arc(c.x,cy,c.r,0,Math.PI*2);cx.arc(c.x+c.r,cy+4,c.r*.8,0,Math.PI*2);cx.arc(c.x-c.r,cy+6,c.r*.7,0,Math.PI*2);cx.fill();cx.stroke();});
    cx.save();cx.translate(W/2,Hh);cx.scale(scale,scale);cx.translate(-W/2,-Hh+camY);
    cx.fillStyle=INK;cx.fillRect(-W,BASE_Y+BH,W*3,400);cx.fillStyle='#2E2A45';cx.fillRect(-W,BASE_Y+BH,W*3,6);
    if(pbFloors>2&&phase!=='over')lineAt(pbFloors,'PB '+pbFloors,'#5B4BFF');
    if(rivalFloors&&phase!=='over')lineAt(rivalFloors,(ctx.opp?ctx.opp.name:'')+' ~'+rivalFloors,'#F23F55');
    blocks.forEach((b,i)=>drawBlock(b.x,yOf(i),b.w,i));
    if(cur)drawBlock(cur.x,yOf(n),cur.w,n);
    falling.forEach(f=>{cx.save();cx.translate(f.x+f.w/2,f.y+BH/2);cx.rotate(f.rot);cx.globalAlpha=.9;drawBlock(-f.w/2,-BH/2,f.w,f.i);cx.restore();});
    parts.draw(cx);cx.restore();
    if(flash>0){cx.setTransform(1,0,0,1,0,0);cx.fillStyle=`rgba(255,201,60,${flash})`;cx.fillRect(0,0,cv.width,cv.height);}
  }
  function frame(now){
    if(!alive)return;const dt=Math.min(.05,(now-last)/1000);last=now;
    if(cur&&phase==='play'){cur.x+=cur.dir*cur.sp*dt;if(cur.x+cur.w>W+cur.w*0.3){cur.x=W+cur.w*0.3-cur.w;cur.dir=-1;}if(cur.x<-cur.w*0.3){cur.x=-cur.w*0.3;cur.dir=1;}}
    falling.forEach(f=>{f.vy+=900*dt;f.y+=f.vy*dt;f.rot+=f.vr*dt;});falling=falling.filter(f=>f.y<BASE_Y+800);
    camY+=(camT-camY)*Math.min(1,dt*6);scale+=(scaleT-scale)*Math.min(1,dt*3);if(flash>0)flash-=dt;
    parts.step(dt);draw(dt);
    if(ctx.opp){const nn=el.querySelector('[data-rival]');if(nn)nn.textContent=fmt(ctx.oppScore)+' pts';}
    raf=requestAnimationFrame(frame);
  }
  const pd=e=>{e.preventDefault();drop();};
  const kd=e=>{if((e.code==='Space'||e.code==='Enter')&&!e.repeat){e.preventDefault();drop();}};
  cv.addEventListener('pointerdown',pd);window.addEventListener('keydown',kd);
  countdown(el,over,()=>{phase='play';spawn();});
  raf=requestAnimationFrame(frame);
  return {destroy(){alive=false;cancelAnimationFrame(raf);window.removeEventListener('keydown',kd);CS.stop();}};
}

/* =========================================================
   GAME 6 — Grid Lock (lights-on puzzle)
   ========================================================= */
function mountGrid(el,ctx,done){
  const rand=ctx.rand,DUR=90;
  let n=3,board=[],start=[],moves=0,par=0,boards=0,score=0,eff=0,totalMoves=0,maxN=0,solvedN=0,cur=0,t0=0,raf=0,alive=true,ended=false,busy=false,timers=[];
  el.innerHTML=`<div class="gl">
    <div class="hud" style="width:min(100%,560px)"><div class="gfill"><span class="lab">${L('Boards','Grilles')}</span><b data-g="b">0</b></div><div><span class="lab">Score</span><b data-g="s">0</b></div><div><span class="lab">${L('Moves / par','Coups / par')}</span><b data-g="m">0</b></div><div><span class="lab">${L('Time','Temps')}</span><b data-g="t">${DUR}</b></div></div>
    <div class="bar" style="width:min(100%,560px)"><i data-g="bar" style="width:100%;background:var(--c-grid)"></i></div>
    ${ctx.opp?`<div style="width:min(100%,560px)">${rivalHTML(ctx)}</div>`:''}
    <div class="gl-board" data-g="board" role="grid" aria-label="${L('Puzzle board','Grille')}"></div>
    <div class="row" style="justify-content:center"><button class="btn sm" type="button" data-g="reset">${ic('refresh',16)}${L('Reset board','Recommencer la grille')}</button><span class="tiny">${L('Turn every tile green.','Rends toutes les cases vertes.')}</span></div>
  </div>`;
  const E=k=>el.querySelector(`[data-g="${k}"]`),B=E('board');
  const later=(f,ms)=>timers.push(setTimeout(()=>{if(alive)f();},ms));
  const nb=i=>{const r=Math.floor(i/n),c=i%n,o=[i];if(r>0)o.push(i-n);if(r<n-1)o.push(i+n);if(c>0)o.push(i-1);if(c<n-1)o.push(i+1);return o;};
  function gen(){
    n=boards<2?3:boards<4?4:5;const k=n===3?3:n===4?4+Math.floor(rand()*2):5+Math.floor(rand()*3);
    do{board=Array(n*n).fill(true);const picks=shuffle([...Array(n*n).keys()],rand).slice(0,k);picks.forEach(i=>nb(i).forEach(j=>board[j]=!board[j]));par=k;}while(board.every(Boolean));
    start=board.slice();moves=0;cur=Math.floor(n*n/2);maxN=Math.max(maxN,n);render();
  }
  function render(){
    B.style.gridTemplateColumns=`repeat(${n},minmax(0,1fr))`;B.classList.remove('solved');
    B.innerHTML=board.map((on,i)=>`<button type="button" class="gl-cell${on?' on':''}${i===cur?' cur':''}" data-i="${i}" role="gridcell" aria-label="${on?L('on','allumée'):L('off','éteinte')}"></button>`).join('');
    E('m').textContent=`${moves} / ${par}`;E('b').textContent=boards;E('s').textContent=fmt(score);
  }
  function press(i){
    if(busy||ended)return;nb(i).forEach(j=>board[j]=!board[j]);moves++;totalMoves++;cur=i;SFX.play('flip',(i%n)+Math.floor(i/n));
    render();nb(i).forEach(j=>{const c=B.children[j];if(c){c.classList.remove('flip');void c.offsetWidth;c.classList.add('flip');}});
    if(board.every(Boolean)){busy=true;boards++;const e=Math.max(0,(par*2-moves))*40,pts=600+n*100+e;eff+=e;score+=pts;solvedN=Math.max(solvedN,n);if(n===5)S._grid5=true;
      B.classList.add('solved');SFX.play('perfect');const [x,y]=FX.at(B);FX.burst(x,y,['#14B37A','#B8F2D9','#FFC93C','#fff'],30,8);FX.pop('+'+fmt(pts),x,y,'#FFC93C');
      E('b').textContent=boards;E('s').textContent=fmt(score);later(()=>{busy=false;gen();},650);}
  }
  function tick(){
    if(!alive||ended)return;const e=(performance.now()-t0)/1000,left=Math.max(0,DUR-e);
    E('t').textContent=Math.ceil(left);E('bar').style.width=(left/DUR*100)+'%';rivalTick(el,ctx,e/DUR);
    if(left<=0){end();return;}raf=requestAnimationFrame(tick);
  }
  function end(){
    ended=true;SFX.play(duelOutcome(ctx,score)==='loss'?'lose':'win');
    done({score,perf:clamp(score/7000,0,1),outcome:duelOutcome(ctx,score),oppName:ctx.opp?ctx.opp.name:null,oppScore:ctx.oppScore??null,x:boards,details:{boards,maxN:solvedN,moves:totalMoves,eff},payload:{boards,moves:totalMoves,score,maxN:solvedN},flags:{grid5:!!S._grid5}});
    S._grid5=false;
  }
  const ck=e=>{const c=e.target.closest('.gl-cell');if(c)press(+c.dataset.i);if(e.target.closest('[data-g="reset"]')&&!busy){board=start.slice();SFX.play('whoosh');render();}};
  const kd=e=>{if(ended)return;const m={ArrowUp:-n,ArrowDown:n,ArrowLeft:-1,ArrowRight:1}[e.key];if(m!=null){e.preventDefault();const nx=cur+m;if(nx>=0&&nx<n*n&&!(m===-1&&cur%n===0)&&!(m===1&&cur%n===n-1)){cur=nx;render();}}else if(e.code==='Space'||e.code==='Enter'){if(e.target.closest&&e.target.closest('.gl-cell'))return;e.preventDefault();press(cur);}};
  el.addEventListener('click',ck);window.addEventListener('keydown',kd);
  S._grid5=false;gen();t0=performance.now();tick();
  return {destroy(){alive=false;ended=true;cancelAnimationFrame(raf);timers.forEach(clearTimeout);window.removeEventListener('keydown',kd);}};
}

/* =========================================================
   GAME 7 — Word Rush
   ========================================================= */
const norm=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
function mountWords(el,ctx,done){
  const rand=ctx.rand,DUR=60,list=WORDS[LANG]||WORDS.en,byLen={};list.forEach(w=>{(byLen[w[0].length]=byLen[w[0].length]||[]).push(w);});
  const sorted=s=>s.split('').sort().join(''),valid=new Set(list.map(w=>w[0]));
  let idx=0,word=null,cat='',tiles=[],ans=[],locked=0,score=0,streak=0,bestStreak=0,found=0,skipped=0,log=[],t0=0,wt0=0,raf=0,alive=true,ended=false,busy=false,timers=[],used=new Set(),hintCost=0,w8=false;
  el.innerHTML=`<div class="wr">
    <div class="hud" style="width:min(100%,600px)"><div class="gfill"><span class="lab">Score</span><b data-w="s">0</b></div><div><span class="lab">${L('Words','Mots')}</span><b data-w="f">0</b></div><div><span class="lab">${L('Time','Temps')}</span><b data-w="t">${DUR}</b></div><div><span class="lab">${L('Streak','Série')}</span><b data-w="k">0</b></div></div>
    <div class="bar" style="width:min(100%,600px)"><i data-w="bar" style="width:100%;background:var(--c-words)"></i></div>
    ${ctx.opp?`<div style="width:min(100%,600px)">${rivalHTML(ctx)}</div>`:''}
    <span class="wr-cat" data-w="cat"></span>
    <div class="wr-slots" data-w="slots" aria-live="polite"></div>
    <div class="wr-tiles" data-w="tiles"></div>
    <div class="wr-ctrl"><button class="btn sm" type="button" data-w="hint">${ic('bulb',16)}${L('Hint −100','Indice −100')}</button><button class="btn sm" type="button" data-w="clear">${ic('back',16)}${L('Clear','Effacer')}</button><button class="btn sm" type="button" data-w="skip">${L('Skip','Passer')} ›</button></div>
    <div class="wr-found" data-w="log"></div>
  </div>`;
  const E=k=>el.querySelector(`[data-w="${k}"]`);
  const later=(f,ms)=>timers.push(setTimeout(()=>{if(alive)f();},ms));
  let wlen=0;
  const live=!!ctx.words;
  function next(){
    let letters;
    if(live){const it=ctx.words[idx];if(!it){end();return;}word=null;wlen=it.len;cat=it.cat;letters=it.letters.split('');idx++;}
    else{
      const len=idx<2?4:idx<4?5:idx<7?6:idx<10?7:8;let pool=(byLen[len]||[]).filter(w=>!used.has(w[0]));if(!pool.length)pool=list.filter(w=>!used.has(w[0]));if(!pool.length){used.clear();pool=list;}
      const w=pool[Math.floor(rand()*pool.length)];used.add(w[0]);word=w[0];wlen=word.length;cat=w[1];idx++;
      let guard=0;do{letters=shuffle(word.split(''),rand);guard++;}while((letters.join('')===word||valid.has(letters.join('')))&&guard<30);
    }
    tiles=letters.map(ch=>({ch,used:false}));ans=[];locked=0;hintCost=0;wt0=performance.now();busy=false;paint();
  }
  function paint(){
    E('cat').textContent=cat;
    E('slots').className='wr-slots';
    E('slots').innerHTML=Array.from({length:wlen}).map((_,i)=>{const t=ans[i]!=null?tiles[ans[i]]:null;return `<button type="button" class="wr-slot${t?' fill':''}${i<locked?' lock':''}" data-si="${i}" ${t&&i>=locked?'':'tabindex="-1"'}>${t?t.ch:''}</button>`;}).join('');
    E('tiles').innerHTML=tiles.map((t,i)=>`<button type="button" class="wr-tile${t.used?' used':''}" data-ti="${i}" ${t.used?'tabindex="-1" aria-hidden="true"':''}>${t.ch}</button>`).join('');
    E('s').textContent=fmt(score);E('f').textContent=found;E('k').textContent=streak;
    E('hint').disabled=locked>=wlen-1;
  }
  function add(ti){if(busy||ended||tiles[ti].used||ans.length>=wlen)return;tiles[ti].used=true;ans.push(ti);SFX.play('flip',ans.length);paint();if(ans.length===wlen)check();}
  function removeAt(si){if(busy||si<locked||si>=ans.length)return;const ti=ans.splice(si,1)[0];tiles[ti].used=false;SFX.play('tap');paint();}
  function success(guess){
    const dt=(performance.now()-wt0)/1000,bonus=dt<4?200:dt<8?100:0,mult=1+Math.min(streak,5)*0.1;streak++;bestStreak=Math.max(bestStreak,streak);
    const pts=Math.max(50,Math.round((wlen*100+bonus)*mult)-hintCost);score+=pts;found++;if(wlen>=8)w8=true;log.push([guess,true]);
    E('slots').classList.add('good');SFX.play(streak>=3?'perfect':'good');const [x,y]=FX.at(E('slots'));FX.burst(x,y,['#00A6C8','#B8F2D9','#FFC93C','#fff'],22,7);FX.pop('+'+fmt(pts),x,y-30,'#FFC93C');
    E('log').innerHTML=log.map(w=>`<span class="${w[1]?'':'skip'}">${w[0]}</span>`).join('');E('s').textContent=fmt(score);
    later(next,520);
  }
  function failure(){
    streak=0;E('slots').classList.add('badw');SFX.play('bad');FX.shake(E('slots'));FX.buzz(50);
    later(()=>{ans.slice(locked).forEach(i=>tiles[i].used=false);ans=ans.slice(0,locked);busy=false;paint();},380);
  }
  function check(){
    const guess=ans.map(i=>tiles[i].ch).join('');busy=true;
    if(live){ctx.wordEvent(idx-1,'guess',guess).then(r=>{if(ended||!alive)return;r.ok?success(guess):failure();}).catch(e=>{toast(errText(e));failure();});return;}
    if(guess===word||(valid.has(guess)&&sorted(guess)===sorted(word)))success(guess);else failure();
  }
  function lockPrefix(prefix){
    ans.forEach(i=>tiles[i].used=false);ans=[];locked=prefix.length;
    for(let k=0;k<locked;k++){const ti=tiles.findIndex(t=>!t.used&&t.ch===prefix[k]);if(ti>=0){tiles[ti].used=true;ans.push(ti);}}
    streak=0;SFX.play('coin');paint();
  }
  function hint(){
    if(busy||ended||locked>=wlen-1)return;
    hintCost+=100;
    if(live){busy=true;ctx.wordEvent(idx-1,'hint').then(r=>{busy=false;lockPrefix(r.letters);}).catch(e=>{busy=false;toast(errText(e));});return;}
    lockPrefix(word.slice(0,locked+1));
  }
  function skip(){
    if(busy||ended)return;streak=0;skipped++;SFX.play('whoosh');
    const fin=w=>{log.push([w,false]);E('log').innerHTML=log.map(x=>`<span class="${x[1]?'':'skip'}">${x[0]}</span>`).join('');next();};
    if(live){busy=true;ctx.wordEvent(idx-1,'skip').then(r=>fin(r.word)).catch(e=>{busy=false;toast(errText(e));});return;}
    fin(word);
  }
  function tick(){if(!alive||ended)return;const e=(performance.now()-t0)/1000,left=Math.max(0,DUR-e);E('t').textContent=Math.ceil(left);E('bar').style.width=(left/DUR*100)+'%';rivalTick(el,ctx,e/DUR);if(left<=0){end();return;}raf=requestAnimationFrame(tick);}
  function end(){ended=true;SFX.play(duelOutcome(ctx,score)==='loss'?'lose':'win');done({score,perf:clamp(score/6500,0,1),outcome:duelOutcome(ctx,score),oppName:ctx.opp?ctx.opp.name:null,oppScore:ctx.oppScore??null,x:found,details:{found,skipped,bestStreak,list:log},payload:{},flags:{word8:w8}});}
  const ck=e=>{const t=e.target.closest('[data-ti]');if(t){add(+t.dataset.ti);return;}const s=e.target.closest('[data-si]');if(s){removeAt(+s.dataset.si);return;}
    if(e.target.closest('[data-w="hint"]'))hint();else if(e.target.closest('[data-w="skip"]'))skip();else if(e.target.closest('[data-w="clear"]')&&!busy){ans.slice(locked).forEach(i=>tiles[i].used=false);ans=ans.slice(0,locked);paint();}};
  const kd=e=>{if(ended||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='Backspace'){e.preventDefault();removeAt(ans.length-1);return;}if(e.key==='Enter'){e.preventDefault();if(ans.length===wlen&&!busy)check();return;}
    const ch=norm(e.key||'');if(/^[A-Z]$/.test(ch)){const ti=tiles.findIndex(t=>!t.used&&t.ch===ch);if(ti>=0){e.preventDefault();add(ti);}}};
  el.addEventListener('click',ck);window.addEventListener('keydown',kd);
  next();t0=performance.now();tick();
  return {destroy(){alive=false;ended=true;cancelAnimationFrame(raf);timers.forEach(clearTimeout);window.removeEventListener('keydown',kd);}};
}

/* =========================================================
   GAME 8 — Pop Shot (canvas aim trainer)
   ========================================================= */
function mountAim(el,ctx,done){
  const W=1000,Hh=600,DUR=30,rand=ctx.rand;
  el.innerHTML=`<div class="stack" style="gap:12px">
    <div class="hud"><div class="gfill"><span class="lab">Score</span><b data-a="s">0</b></div><div><span class="lab">${L('Time','Temps')}</span><b data-a="t">${DUR}</b></div><div><span class="lab">Combo</span><b data-a="c">0</b><small data-a="m">×1</small></div><div><span class="lab">${L('Accuracy','Précision')}</span><b data-a="acc">—</b></div></div>
    ${rivalHTML(ctx)}
    <div class="cv-wrap" style="cursor:crosshair"><canvas role="img" aria-label="Pop Shot" style="aspect-ratio:${W}/${Hh}"></canvas><div class="over"></div></div>
    <p class="hint">${L('Hit targets before they shrink away. Gold targets are worth double.','Touche les cibles avant qu’elles disparaissent. Les dorées valent double.')}</p>
  </div>`;
  const cv=el.querySelector('canvas'),cx=cv.getContext&&cv.getContext('2d');if(!cx)throw new Error('canvas');
  const over=el.querySelector('.over'),CS=setupCanvas(cv,W,Hh),parts=Parts(),E=k=>el.querySelector(`[data-a="${k}"]`);
  let T=[],texts=[],score=0,combo=0,maxCombo=0,hits=0,shots=0,bulls=0,el0=0,phase='count',alive=true,raf=0,last=performance.now(),spawnCd=0,marks=[];
  const mult=()=>Math.min(3,1+Math.floor(combo/5)*0.5);
  function spawn(p){
    const r0=46-12*p,gold=rand()<0.1,R=gold?r0*0.72:r0;let x,y,tries=0;
    do{x=R+20+rand()*(W-2*R-40);y=R+20+rand()*(Hh-2*R-40);tries++;}while(tries<20&&T.some(t=>Math.hypot(t.x-x,t.y-y)<t.r0+R+20));
    T.push({x,y,r0:R,born:el0,life:(1.9-0.7*p)*(gold?0.75:1),gold});
  }
  const rOf=t=>{const a=(el0-t.born)/t.life;return a<0.12?t.r0*(a/0.12):t.r0*(1-(a-0.12)/0.88);};
  function shoot(e){
    if(phase!=='play')return;const [x,y]=CS.toCanvas(e);shots++;
    let hit=null;for(let i=T.length-1;i>=0;i--){const t=T[i],r=rOf(t);if(Math.hypot(x-t.x,y-t.y)<=r+4){hit=i;break;}}
    if(hit!=null){const t=T[hit],r=rOf(t),d=Math.hypot(x-t.x,y-t.y),ring=d<r*0.34?150:d<r*0.67?100:60;if(ring===150)bulls++;
      combo++;hits++;maxCombo=Math.max(maxCombo,combo);const pts=Math.round(ring*mult()*(t.gold?2:1));score+=pts;T.splice(hit,1);
      parts.add(t.x,t.y,t.gold?['#FFC93C','#fff','#FF9F1C']:['#F23F55','#fff','#FFC2CA'],ring===150?22:14,ring===150?320:220,{g:300,life:.6,r:4});
      texts.push({x:t.x,y:t.y,txt:'+'+pts,life:.8,t:0,c:ring===150?'#FFC93C':'#fff'});SFX.play('pop',Math.min(combo,18));if(combo%5===0){SFX.play('combo',combo);E('c').parentElement.classList.remove('bump');}}
    else{if(combo>=5)SFX.play('bad');else SFX.play('tap');combo=0;score=Math.max(0,score-30);marks.push({x,y,t:0});}
    hud();
  }
  function hud(){E('s').textContent=fmt(score);E('c').textContent=combo;E('m').textContent='×'+String(mult()).replace('.',LANG==='fr'?',':'.');E('acc').textContent=shots?Math.round(hits/shots*100)+' %':'—';}
  function step(dt){
    el0+=dt;const p=clamp(el0/DUR,0,1),want=2+(el0>10?1:0)+(el0>20?1:0);
    for(let i=T.length-1;i>=0;i--){if(el0-T[i].born>=T[i].life){parts.add(T[i].x,T[i].y,['#D3CCBF'],6,80,{g:0,life:.35,r:3});T.splice(i,1);if(combo>0){combo=0;hud();}}}
    spawnCd-=dt;if(T.length<want&&spawnCd<=0){spawn(p);spawnCd=0.18;}
    parts.step(dt);texts.forEach(t=>{t.t+=dt;t.y-=50*dt;});texts=texts.filter(t=>t.t<t.life);marks.forEach(m=>m.t+=dt);marks=marks.filter(m=>m.t<.4);
    const left=Math.max(0,DUR-el0);E('t').textContent=Math.ceil(left);rivalTick(el,ctx,el0/DUR);
    if(left<=0)finish();
  }
  function draw(){
    cx.setTransform(1,0,0,1,0,0);cx.fillStyle='#FFF3F4';cx.fillRect(0,0,cv.width,cv.height);
    const k=CS.sc*CS.dpr;cx.setTransform(k,0,0,k,0,0);
    cx.fillStyle='rgba(23,20,42,.07)';for(let x=20;x<W;x+=40)for(let y=20;y<Hh;y+=40){cx.beginPath();cx.arc(x,y,1.6,0,Math.PI*2);cx.fill();}
    if(phase==='play'){const p=el0/DUR;cx.fillStyle='#F23F55';cx.fillRect(0,Hh-6,W*(1-p),6);}
    T.forEach(t=>{const r=Math.max(0,rOf(t));if(r<1)return;const a=(el0-t.born)/t.life;
      cx.fillStyle='rgba(23,20,42,.18)';cx.beginPath();cx.arc(t.x+4,t.y+5,r,0,Math.PI*2);cx.fill();
      const rings=t.gold?['#FFC93C','#fff','#FF9F1C']:['#fff','#FFC2CA','#F23F55'];
      [[1,rings[0]],[0.67,rings[1]],[0.34,rings[2]]].forEach(([f,c])=>{cx.fillStyle=c;cx.strokeStyle=INK;cx.lineWidth=2.2;cx.beginPath();cx.arc(t.x,t.y,r*f,0,Math.PI*2);cx.fill();cx.stroke();});
      cx.strokeStyle=INK;cx.lineWidth=3;cx.beginPath();cx.arc(t.x,t.y,r+6,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-a));cx.stroke();});
    marks.forEach(m=>{cx.globalAlpha=1-m.t/.4;cx.strokeStyle='#F23F55';cx.lineWidth=4;cx.lineCap='round';cx.beginPath();cx.moveTo(m.x-8,m.y-8);cx.lineTo(m.x+8,m.y+8);cx.moveTo(m.x+8,m.y-8);cx.lineTo(m.x-8,m.y+8);cx.stroke();cx.globalAlpha=1;});
    parts.draw(cx);
    texts.forEach(t=>{cx.globalAlpha=1-t.t/t.life;cx.font='800 26px Bricolage Grotesque, sans-serif';cx.textAlign='center';cx.lineWidth=5;cx.strokeStyle=INK;cx.strokeText(t.txt,t.x,t.y);cx.fillStyle=t.c;cx.fillText(t.txt,t.x,t.y);cx.globalAlpha=1;});
    if(combo>=5){cx.font='800 22px Bricolage Grotesque, sans-serif';cx.textAlign='left';cx.lineWidth=5;cx.strokeStyle=INK;const s=`COMBO ×${mult()}`;cx.strokeText(s,18,36);cx.fillStyle='#FFC93C';cx.fillText(s,18,36);}
  }
  function finish(){
    phase='over';T=[];const acc=shots?Math.round(hits/shots*100):0;
    over.innerHTML=`<span>${hits} ${L('hits','touches')} · ${acc} %</span><b>${fmt(score)}</b>`;over.className='over show fin pop';SFX.play(duelOutcome(ctx,score)==='loss'?'lose':'win');
    setTimeout(()=>{if(alive)done({score,perf:clamp(score/12000,0,1),outcome:duelOutcome(ctx,score),oppName:ctx.opp?ctx.opp.name:null,oppScore:ctx.oppScore??null,x:hits,details:{hits,acc,maxCombo,bulls},payload:{hits,shots,maxCombo,score},flags:{combo20:maxCombo>=20}});},1500);
  }
  function frame(now){if(!alive)return;const dt=Math.min(.05,(now-last)/1000);last=now;if(phase==='play')step(dt);else parts.step(dt);draw();raf=requestAnimationFrame(frame);}
  const pd=e=>{e.preventDefault();shoot(e);};cv.addEventListener('pointerdown',pd);
  countdown(el,over,()=>{phase='play';});raf=requestAnimationFrame(frame);hud();
  return {destroy(){alive=false;cancelAnimationFrame(raf);CS.stop();}};
}
const MOUNT={sprint:mountSprint,reflex:mountReflex,brain:mountBrain,cards:mountCards,stack:mountStack,grid:mountGrid,words:mountWords,aim:mountAim};
