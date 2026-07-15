(async function(){
/* ════════ DATA — data.json (라이브 config) ════════ */
let D;
try{ D = await fetch('data.json?ts='+Date.now()).then(r=>{ if(!r.ok) throw 0; return r.json(); }); }
catch(e){ document.body.innerHTML='<div style="color:#9fb2cf;font:13px monospace;padding:48px;letter-spacing:1px">⚠ data.json 로드 실패 — 대시보드 빌드 후 다시 시도</div>'; return; }
const TEAMS={}; const ORDER=D.teams.map(t=>t.key);
D.teams.forEach(t=>{ TEAMS[t.key]={ name:t.name, role:t.role, color:t.color, stage:t.stage,
  agents:t.agents.map(a=>a.name), _run:new Set(t.agents.filter(a=>a.running).map(a=>a.name)) }; });
const ANG={ritsuko:0,misato:51,kaoru:103,rei:154,mari:206,asuka:257,shinji:309};
const EDGES=D.handoffs.filter(h=>h[1]!=='vault');      // 행성간 핸드오프 (18)
const KM=D.handoffs.filter(h=>h[1]==='vault');          // rei→vault (KM 브로드캐스트)
const ECOL={pipeline:"#3ef0a0",cross:"#aab4d8",revision:"#ff69b4",expert:"#2fd0ff",km:"#DA70D6"};

/* ════════ 3D 월드 구축 ════════ */
const PR=360;                 // 행성 궤도 반경
const planets={};             // key → {pos:[x,y,z], r, color, moons:[...]}
function hash(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;}
const PTYPE={ritsuko:'rocky',misato:'rocky',kaoru:'gas',rei:'gas',mari:'rocky',asuka:'gas',shinji:'gas'};
const PRING={shinji:true,kaoru:true};
ORDER.forEach(k=>{
  const t=TEAMS[k], a=(ANG[k]-90)*Math.PI/180, n=t.agents.length;
  const pos=[PR*Math.cos(a), 0, PR*Math.sin(a)];
  const pr=20+Math.sqrt(n)*7;
  const moons=t.agents.map((ag,i)=>{
    const h=hash(ag);
    return {
      name:ag,
      rr: pr+22+i*10,                       // 위성 궤도 반경
      incl: (((h>>5)%34)-17)/100,           // ±0.17rad 궤도 경사
      phase: (h%628)/100,                   // 시작 위상
      spd: 0.09+((h>>9)%50)/360,            // 각속도 (느리게)
      dir: (h&1)?1:-1,
      ms: 2.4+((h>>3)%3),                   // 위성 크기
      run: TEAMS[k]._run.has(ag),           // 실시간 running (data.json)
    };
  });
  planets[k]={key:k, pos, r:pr+4, color:t.color, name:t.name, stage:t.stage, role:t.role, agents:t.agents, moons, screen:null};
});
const SUN={pos:[0,0,0], r:54};
const _mg=(D.meta&&D.meta.gendo)||{}, _ms=(D.meta&&D.meta.seele)||{};
const GENDO={key:'gendo', pos:[0,-200,0], r:28, color:"#95a5a6", name:_mg.name||"이카리 겐도", label:_mg.label||"PI · OBSERVER"};   // 하단 축 — yaw 무관 안정
const SEELE={key:'seele', pos:[0,300,-60], r:30, color:"#c8102e", name:_ms.name||"SEELE", label:_ms.label||"SHADOW COUNCIL"};        // 최상단 단독 관조
const VAULT=D.vault?{key:'vault', pos:[Math.cos(2.5)*470,0,Math.sin(2.5)*470], r:22, color:"#DA70D6", name:D.vault.name||"Vault", label:"OBSIDIAN KM"}:null;  // KM 보관 (외곽)

/* 캐릭터 얼굴 프리로드 — seele-cinema와 동일 static/avatars (풀해상도) */
const AV={}; [...ORDER,'gendo','seele','magi'].forEach(k=>{const im=new Image(); im.src='../avatars/'+k+'.jpg'; AV[k]=im;});
AV.vault=new Image(); AV.vault.src='vault.png';   // 옵시디언 크리스탈 (시네마 디렉토리 로컬, 3D 렌더 아이콘)

/* MAGI 3코어 삼위일체 (seele-cinema 그대로): 벤더색 + 아이콘 + CASPER/BALTHASAR/MELCHIOR */
const MAGI_ICONS={}; ['claude','codex','gemini'].forEach(k=>{const im=new Image(); im.src='../seele-cinema/icons/'+k+'.svg'; MAGI_ICONS[k]=im;});
const _MA=[-Math.PI/2, Math.PI/6, Math.PI*5/6];
const MAGI_CORES=D.magi.map((c,i)=>({id:c.id, llm:c.llm, vendor:c.vendor, ang:_MA[i]||0}));
const MAGI_VCOL={claude:'#ff9a5a', gemini:'#5ad6ff', codex:'#6fe0a0'};
const MAGI_R=50, TRI_R=92, NERV_TRI='#a01e4a';

/* ════════ 카메라 + 투영 (seele-cinema 컨벤션) ════════ */
const FOV=720, CAM_DIST=900, TILT=27*Math.PI/180;
const cam={yaw:0, pitch:0, scale:1, zoom:1, w:0, h:0, dragging:false};
const PITCH_MIN=-46*Math.PI/180, PITCH_MAX=24*Math.PI/180;
function project(x,y,z){
  const cy=Math.cos(cam.yaw), sy=Math.sin(cam.yaw);
  let rx=x*cy+z*sy, rz=-x*sy+z*cy, ry=y;
  const tl=TILT+cam.pitch, cT=Math.cos(tl), sT=Math.sin(tl);
  let ty=ry*cT-rz*sT, tz=ry*sT+rz*cT;
  const depth=CAM_DIST-tz;
  const s=FOV/Math.max(60,depth)*cam.scale*cam.zoom;
  return {sx:cam.w/2+rx*s, sy:cam.h*0.47-ty*s, z:tz, s, depth, vis:depth>60};
}

/* ════════ 렌더 헬퍼 ════════ */
const gx=document.getElementById('gx'), g=gx.getContext('2d');
let DPR=1;
function withA(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;}
function lighten(hex,f){const n=parseInt(hex.slice(1),16);let r=(n>>16)&255,gg=(n>>8)&255,b=n&255;
  r=Math.round(r+(255-r)*f);gg=Math.round(gg+(255-gg)*f);b=Math.round(b+(255-b)*f);return `rgb(${r},${gg},${b})`;}
function darken(hex,f){const n=parseInt(hex.slice(1),16);let r=(n>>16)&255,gg=(n>>8)&255,b=n&255;
  r=Math.round(r*(1-f));gg=Math.round(gg*(1-f));b=Math.round(b*(1-f));return `rgb(${r},${gg},${b})`;}

/* 행성 표면 텍스처 1회 생성 (오프스크린 256² 정사각, 가로 tileable) */
function makeTex(color,type,seed){
  let rs=seed||1; const rnd=()=>{rs=(rs*1103515245+12345)&0x7fffffff;return rs/0x7fffffff;};
  const S=256, c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');
  x.fillStyle=color;x.fillRect(0,0,S,S);
  if(type==='gas'){
    const bands=11+Math.floor(rnd()*5);
    for(let i=0;i<bands;i++){const y0=i/bands*S, h=S/bands+1, sh=rnd()-0.5;
      x.fillStyle= sh>0 ? withA(lighten(color,0.16+sh*0.34),0.72) : withA(darken(color,0.18-sh*0.42),0.6);
      x.fillRect(0,y0,S,h);}
    for(let i=0;i<3;i++){const cxp=rnd()*S, cyp=S*(0.28+rnd()*0.44), rr=S*(0.045+rnd()*0.06);
      const gg2=x.createRadialGradient(cxp,cyp,0,cxp,cyp,rr*1.7);
      gg2.addColorStop(0,withA(lighten(color,0.55),0.85));gg2.addColorStop(1,withA(color,0));
      x.fillStyle=gg2;x.beginPath();x.ellipse(cxp,cyp,rr*1.7,rr,0,0,7);x.fill();}
  } else {
    for(let i=0;i<80;i++){const bx=rnd()*S, by=rnd()*S, rr=S*(0.03+rnd()*0.085), up=rnd()<0.5;
      x.fillStyle=withA(up?lighten(color,0.32):darken(color,0.38),0.16+rnd()*0.24);
      x.beginPath();x.ellipse(bx,by,rr*(0.7+rnd()*0.9),rr,rnd()*7,0,7);x.fill();
      if(bx<rr*2){x.beginPath();x.ellipse(bx+S,by,rr,rr,0,0,7);x.fill();}        // 가로 wrap 이음새 보정
      if(bx>S-rr*2){x.beginPath();x.ellipse(bx-S,by,rr,rr,0,0,7);x.fill();}}
    x.fillStyle=withA(lighten(color,0.55),0.5);x.fillRect(0,0,S,S*0.07);x.fillRect(0,S*0.93,S,S*0.07);  // 극관
  }
  return c;
}

function drawSphere(p, worldR, color, opt={}){
  const r=Math.max(2, worldR*p.s);
  // 헤일로
  const halo=g.createRadialGradient(p.sx,p.sy,0,p.sx,p.sy,r*(opt.haloK||2.4));
  halo.addColorStop(0, withA(color, opt.haloA||0.28));
  halo.addColorStop(1, withA(color,0));
  g.fillStyle=halo;g.beginPath();g.arc(p.sx,p.sy,r*(opt.haloK||2.4),0,7);g.fill();
  // 본체 (구면 음영 + 하이라이트 오프셋)
  const lx=p.sx-r*0.32, ly=p.sy-r*0.34;
  const body=g.createRadialGradient(lx,ly,r*0.08, p.sx,p.sy,r);
  body.addColorStop(0, lighten(color,0.55));
  body.addColorStop(0.45, color);
  body.addColorStop(1, withA(color,0.18));
  g.fillStyle=body;g.beginPath();g.arc(p.sx,p.sy,r,0,7);g.fill();
  // 림 라이트
  g.lineWidth=Math.max(0.6,r*0.05);g.strokeStyle=withA(lighten(color,0.5),0.6);
  g.beginPath();g.arc(p.sx,p.sy,r,0,7);g.stroke();
  if(opt.dark){ // 음영측 살짝 어둡게
    const sh=g.createRadialGradient(p.sx+r*0.4,p.sy+r*0.42,r*0.1,p.sx,p.sy,r*1.05);
    sh.addColorStop(0,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(0,0,0,0.45)');
    g.fillStyle=sh;g.beginPath();g.arc(p.sx,p.sy,r,0,7);g.fill();
  }
  return r;
}

function ringArc(sx,sy,r,color,a0,a1){
  const rx=r*2.05, ry=r*0.52;
  g.lineWidth=r*0.30;
  const grad=g.createLinearGradient(sx-rx,sy,sx+rx,sy);
  grad.addColorStop(0,withA(color,0.05));grad.addColorStop(0.5,withA(lighten(color,0.4),0.55));grad.addColorStop(1,withA(color,0.05));
  g.strokeStyle=grad;g.beginPath();g.ellipse(sx,sy,rx,ry,0,a0,a1);g.stroke();
  g.lineWidth=r*0.10;g.strokeStyle=withA(darken(color,0.2),0.4);g.beginPath();g.ellipse(sx,sy,rx*0.86,ry*0.86,0,a0,a1);g.stroke();
}

/* 캐릭터 얼굴 포트레이트 (seele-cinema 빌보드: 원형 아바타 + 팀틴트 + 글로우링 + 배지 + 3D 림 비네트) */
function drawFace(pp, color, key, worldR, label, sub, sun, opt){
  const r=Math.max(6, worldR*pp.s), sx=pp.sx, sy=pp.sy;
  let lx=0,ly=0; if(sun){lx=sun.sx-sx;ly=sun.sy-sy;const ll=Math.hypot(lx,ly)||1;lx/=ll;ly/=ll;}
  const active=opt&&opt.active;
  // 외곽 글로우
  const halo=g.createRadialGradient(sx,sy,r*0.8,sx,sy,r*1.95);
  halo.addColorStop(0,withA(color,active?0.32:0.20));halo.addColorStop(1,withA(color,0));
  g.fillStyle=halo;g.beginPath();g.arc(sx,sy,r*1.95,0,7);g.fill();
  // 얼굴 (원형 클립)
  g.save();g.beginPath();g.arc(sx,sy,r,0,7);g.clip();
  const img=AV[key];
  if(img&&img.complete&&img.naturalWidth){
    g.drawImage(img, sx-r, sy-r, 2*r, 2*r);
    g.globalCompositeOperation='overlay';g.globalAlpha=0.22;g.fillStyle=color;
    g.beginPath();g.arc(sx,sy,r,0,7);g.fill();
    g.globalAlpha=1;g.globalCompositeOperation='source-over';
  } else { g.fillStyle=color;g.beginPath();g.arc(sx,sy,r,0,7);g.fill(); }
  // 림 비네트 (구면 착시)
  const vg=g.createRadialGradient(sx,sy,r*0.5,sx,sy,r);
  vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,0.5)');
  g.fillStyle=vg;g.beginPath();g.arc(sx,sy,r,0,7);g.fill();
  // 항성쪽 명암
  if(sun){const tg=g.createRadialGradient(sx+lx*r*0.55,sy+ly*r*0.55,r*0.15,sx-lx*r*0.4,sy-ly*r*0.5,r*1.3);
    tg.addColorStop(0,'rgba(0,0,0,0)');tg.addColorStop(0.6,'rgba(0,0,0,0.04)');tg.addColorStop(1,'rgba(0,0,0,0.5)');
    g.fillStyle=tg;g.beginPath();g.arc(sx,sy,r,0,7);g.fill();}
  g.restore();
  // 글로우 링
  g.lineWidth=Math.max(1.2,r*0.07);g.strokeStyle=color;g.shadowColor=color;g.shadowBlur=active?16:9;
  g.beginPath();g.arc(sx,sy,r,0,7);g.stroke();g.shadowBlur=0;
  // 카운트 배지 (우상단)
  if(opt&&opt.count!=null){const bx=sx+r*0.71, by=sy-r*0.71, br=Math.max(7,r*0.27);
    g.fillStyle=color;g.beginPath();g.arc(bx,by,br,0,7);g.fill();
    g.fillStyle='#0a0614';g.font='700 '+Math.max(8,Math.round(br*1.05))+'px "IBM Plex Mono",monospace';
    g.textAlign='center';g.textBaseline='middle';g.fillText(''+opt.count,bx,by+0.5);g.textBaseline='alphabetic';}
  // 라벨
  if(label){g.font='700 '+Math.max(11,Math.round(13*pp.s))+'px "IBM Plex Sans","NanumGothic",sans-serif';
    g.textAlign='center';g.fillStyle=color;g.shadowColor=color;g.shadowBlur=10;
    g.fillText(label,sx,sy+r+15);g.shadowBlur=0;}
  if(sub){g.font='600 9px "IBM Plex Mono",monospace';g.fillStyle=withA(color,0.7);g.textAlign='center';g.fillText(sub,sx,sy+r+27);}
}
function drawPlanet(pp, P, t, sun){
  const runc=P.moons.filter(m=>m.run).length;
  drawFace(pp, P.color, P.key, P.r, P.name, P.stage+' · '+P.agents.length, sun, {count:P.agents.length, active:runc>0});
}

/* MAGI 3코어 삼위일체 — seele-cinema 그대로 (depth-sort 항목으로 push) */
function pushMagi(items, t){
  const cen=project(0,0,0);
  const cores=MAGI_CORES.map(c=>({...c, p:project(Math.cos(c.ang)*MAGI_R,0,Math.sin(c.ang)*MAGI_R), vcol:MAGI_VCOL[c.vendor]}));
  // NERV 역삼각형 발광 베이스
  const tang=[Math.PI/2,-Math.PI/6,Math.PI*7/6];
  const tv=tang.map(a=>project(Math.cos(a)*TRI_R,0,Math.sin(a)*TRI_R));
  items.push({z:(tv[0].z+tv[1].z+tv[2].z)/3-3, draw:()=>{
    const cp=project(0,0,0);
    const grad=g.createRadialGradient(cp.sx,cp.sy,2,cp.sx,cp.sy,150*cam.scale*cam.zoom);
    grad.addColorStop(0,withA(NERV_TRI,0.5));grad.addColorStop(0.4,withA(NERV_TRI,0.28));grad.addColorStop(1,withA(NERV_TRI,0));
    g.beginPath();g.moveTo(tv[0].sx,tv[0].sy);g.lineTo(tv[1].sx,tv[1].sy);g.lineTo(tv[2].sx,tv[2].sy);g.closePath();
    g.fillStyle=grad;g.fill();
    g.strokeStyle=NERV_TRI;g.lineWidth=3.2;g.shadowColor=withA(NERV_TRI,0.95);g.shadowBlur=12;g.stroke();g.shadowBlur=0;
  }});
  // 코어간 전력망 아크 + 중앙 수렴선
  for(let i=0;i<3;i++){
    const m1=cores[i], m2=cores[(i+1)%3], a=m1.p, b=m2.p, c1=m1.vcol, c2=m2.vcol;
    items.push({z:(a.z+b.z)/2-2, draw:()=>{
      const lg=g.createLinearGradient(a.sx,a.sy,b.sx,b.sy);lg.addColorStop(0,withA(c1,0.4));lg.addColorStop(1,withA(c2,0.4));
      g.strokeStyle=lg;g.lineWidth=1.4;g.beginPath();g.moveTo(a.sx,a.sy);g.lineTo(b.sx,b.sy);g.stroke();
      g.save();g.globalCompositeOperation='lighter';
      for(let k=0;k<4;k++){const ph=((t*0.45)+k/4+i*0.21)%1, ex=a.sx+(b.sx-a.sx)*ph, ey=a.sy+(b.sy-a.sy)*ph;
        g.fillStyle=ph<0.5?c1:c2;g.beginPath();g.arc(ex,ey,1.7*(a.s+b.s)/2+0.6,0,7);g.fill();}
      g.restore();
    }});
    items.push({z:(m1.p.z+cen.z)/2-2.5, draw:()=>{
      const lg=g.createLinearGradient(m1.p.sx,m1.p.sy,cen.sx,cen.sy);
      lg.addColorStop(0,withA(m1.vcol,0.3));lg.addColorStop(1,withA('#d94a9a',0.05));
      g.save();g.globalCompositeOperation='lighter';g.strokeStyle=lg;g.lineWidth=1;
      g.beginPath();g.moveTo(m1.p.sx,m1.p.sy);g.lineTo(cen.sx,cen.sy);g.stroke();g.restore();
    }});
  }
  // 코어 3개 (회전 육각 홀로프레임 + 아이콘 + 라벨)
  cores.forEach((c,i)=>{
    const p=c.p, vcol=c.vcol, vglow=lighten(vcol,0.4), rad=Math.max(11,24*p.s);
    items.push({z:p.z, draw:()=>{
      const spin=t/3+i*0.7, cs=Math.cos(spin), sn=Math.sin(spin);
      const grad=g.createRadialGradient(p.sx,p.sy,1,p.sx,p.sy,rad*1.7);
      grad.addColorStop(0,withA(vglow,0.9));grad.addColorStop(0.5,withA(vcol,0.6));grad.addColorStop(1,withA(vcol,0));
      g.fillStyle=grad;g.beginPath();g.arc(p.sx,p.sy,rad*1.7,0,7);g.fill();
      // 육각
      g.beginPath();
      for(let k=0;k<=6;k++){const a=(k%6)/6*Math.PI*2-Math.PI/2, vx=Math.cos(a), vy=Math.sin(a),
        qx=p.sx+(vx*cs-vy*sn)*rad, qy=p.sy+(vx*sn+vy*cs)*rad; k===0?g.moveTo(qx,qy):g.lineTo(qx,qy);}
      g.closePath();g.fillStyle=withA(vcol,0.5);g.strokeStyle=vglow;g.lineWidth=2;
      g.shadowColor=vglow;g.shadowBlur=12;g.fill();g.shadowBlur=0;g.stroke();
      // 내부 패싯
      g.strokeStyle=withA(vglow,0.25);g.lineWidth=1;
      for(let k=0;k<6;k++){const a=k/6*Math.PI*2-Math.PI/2, vx=Math.cos(a), vy=Math.sin(a),
        qx=p.sx+(vx*cs-vy*sn)*rad, qy=p.sy+(vx*sn+vy*cs)*rad; g.beginPath();g.moveTo(p.sx,p.sy);g.lineTo(qx,qy);g.stroke();}
      // 코너 브래킷
      const br=rad*1.35, tk=rad*0.34; g.strokeStyle=withA(vglow,0.6);g.lineWidth=1.4;
      for(let cc=0;cc<4;cc++){const qx=(cc&1)?1:-1, qy=(cc&2)?1:-1, cxp=p.sx+qx*br, cyp=p.sy+qy*br;
        g.beginPath();g.moveTo(cxp-qx*tk,cyp);g.lineTo(cxp,cyp);g.lineTo(cxp,cyp-qy*tk);g.stroke();}
      // 벤더 아이콘
      const icon=MAGI_ICONS[c.vendor];
      if(icon&&icon.complete&&icon.naturalWidth){const isz=rad*1.7;g.save();g.shadowColor=withA(vglow,0.85);g.shadowBlur=8;
        g.drawImage(icon,p.sx-isz/2,p.sy-isz/2,isz,isz);g.restore();}
      // 라벨 (id 위 / llm 아래)
      g.fillStyle=withA(vcol,0.92);g.textAlign='center';
      g.font='700 '+Math.round(7.5*p.s+3)+'px "IBM Plex Mono",monospace';g.fillText(c.id,p.sx,p.sy-rad-7);
      g.fillStyle=withA(vglow,0.9);g.font='600 '+Math.round(8*p.s+2)+'px "IBM Plex Mono",monospace';
      g.fillText(c.llm,p.sx,p.sy+rad+12);
    }});
  });
  // MAGI 라벨 (중심 위 부양)
  const top=project(0,95,0);
  items.push({z:top.z+5, draw:()=>{
    g.textAlign='center';g.fillStyle='#d94a9a';g.shadowColor='#d94a9a';g.shadowBlur=14;
    g.font='700 '+Math.max(14,Math.round(18*top.s))+'px "IBM Plex Mono",monospace';g.fillText('MAGI',top.sx,top.sy);g.shadowBlur=0;
    g.fillStyle='rgba(217,74,154,0.65)';g.font='600 9px "IBM Plex Mono",monospace';
    g.fillText('SYSTEM CORE · 3 SAGES · 45 AGENTS',top.sx,top.sy+13);
  }});
}

/* ════════ 메인 렌더 ════════ */
let t0=0, picks=[];
function frame(now){
  if(!t0)t0=now;const t=(now-t0)/1000;
  // 카메라 자동 공전 (느리게)
  if(spin && !cam.dragging) cam.yaw+=0.0006;
  const w=cam.w, h=cam.h;
  g.setTransform(DPR,0,0,DPR,0,0);
  g.clearRect(0,0,w,h);

  const items=[];   // {z, draw}
  picks=[];
  const sunScreen=project(...SUN.pos);   // 항성 광원 화면좌표 (모든 행성 명암 기준)

  // 행성 + 위성 월드 위치
  for(const k of ORDER){
    const P=planets[k], pp=project(...P.pos);
    P.screen={sx:pp.sx, sy:pp.sy, r:Math.max(6,P.r*pp.s), z:pp.z, vis:pp.vis};
    picks.push({key:k, sx:pp.sx, sy:pp.sy, r:Math.max(14,P.r*pp.s*1.15)});

    // 위성: 3D 경사궤도
    for(const m of P.moons){
      const ci=Math.cos(m.incl), si=Math.sin(m.incl);
      // 궤도 표시 (반드시) — 3D 경사궤도를 타원 폴리라인으로
      items.push({z:pp.z-3, draw:()=>{
        g.beginPath();
        for(let s=0;s<=36;s++){const aa=s/36*Math.PI*2, ox=m.rr*Math.cos(aa), oz=m.rr*Math.sin(aa);
          const op=project(P.pos[0]+ox, P.pos[1]-oz*si, P.pos[2]+oz*ci);
          s===0?g.moveTo(op.sx,op.sy):g.lineTo(op.sx,op.sy);}
        g.closePath();g.strokeStyle=withA(P.color,0.20);g.lineWidth=1;g.stroke();
      }});
      const ang=m.phase + t*m.spd*m.dir;
      let lx=m.rr*Math.cos(ang), lz=m.rr*Math.sin(ang), ly=0;
      const iy=ly*ci - lz*si, iz=ly*si + lz*ci;
      const mp=project(P.pos[0]+lx, P.pos[1]+iy, P.pos[2]+iz);
      const mr=Math.max(1.3, m.ms*mp.s);
      const col=m.run?"#3ef0a0":P.color;
      items.push({z:mp.z, draw:()=>{
        const halo=g.createRadialGradient(mp.sx,mp.sy,0,mp.sx,mp.sy,mr*3.4);
        halo.addColorStop(0,withA(col,m.run?0.5:0.34));halo.addColorStop(1,withA(col,0));
        g.fillStyle=halo;g.beginPath();g.arc(mp.sx,mp.sy,mr*3.4,0,7);g.fill();
        g.fillStyle=m.run?"#eafff4":lighten(col,0.3);
        g.beginPath();g.arc(mp.sx,mp.sy,mr,0,7);g.fill();
      }});
    }
    // 행성 본체 (진짜 행성 렌더)
    items.push({z:pp.z, draw:()=>drawPlanet(pp, P, t, sunScreen)});
  }
  // 메타 천체 (겐도/SEELE/Vault) + MAGI 코어 연결선 (수직 명령 축)
  for(const M of [GENDO,SEELE,VAULT].filter(Boolean)){
    const mp=project(...M.pos), cc=project(0,0,0);
    items.push({z:Math.min(mp.z,cc.z)-1, draw:()=>{
      g.save();g.setLineDash([3,8]);g.strokeStyle=withA(M.color,0.26);g.lineWidth=1;
      g.beginPath();g.moveTo(cc.sx,cc.sy);g.lineTo(mp.sx,mp.sy);g.stroke();g.setLineDash([]);g.restore();
    }});
    items.push({z:mp.z, draw:()=>drawFace(mp, M.color, M.key, M.r, M.name, M.label||'', sunScreen, {})});
  }
  // MAGI 3코어 삼위일체 (seele-cinema 그대로)
  pushMagi(items, t);

  // ── 핸드오프 빔 (구체 아래 레이어, 3D 곡선) ──
  drawBeams(t);

  // ── 깊이정렬 후 그리기 (뒤→앞) ──
  items.sort((a,b)=>a.z-b.z);
  for(const it of items) it.draw();

  // 호버 팝업 위치 갱신
  updatePopup();
  requestAnimationFrame(frame);
}

function drawBeams(t){
  for(const [s,d,type] of [...EDGES, ...(VAULT?KM:[])]){
    const A=planets[s] && planets[s].pos; if(!A) continue;
    const B=(d==='vault') ? (VAULT && VAULT.pos) : (planets[d] && planets[d].pos); if(!B) continue;
    const pipe=type==='pipeline', col=ECOL[type]||'#aab4d8';
    // 중심에서 바깥으로 부풀린 제어점(중앙 엉킴 회피) + 살짝 위
    const mid=[(A[0]+B[0])/2,(A[1]+B[1])/2,(A[2]+B[2])/2];
    let dx=mid[0], dz=mid[2]; const L=Math.hypot(dx,dz)||1;
    const M=[mid[0]+dx/L*72, mid[1]+30, mid[2]+dz/L*72];
    const N=24, pts=[];
    for(let i=0;i<=N;i++){const b=bez3(A,M,B,i/N); pts.push(project(b[0],b[1],b[2]));}
    // 은은한 베이스 (코어 또렷 · 보조 흐릿 — 위계로 난잡 완화)
    g.beginPath();g.moveTo(pts[0].sx,pts[0].sy);for(let i=1;i<=N;i++)g.lineTo(pts[i].sx,pts[i].sy);
    g.strokeStyle=withA(col,pipe?0.16:0.075);g.lineWidth=pipe?1.5:1;g.stroke();
    // 단일 코멧 + 짧은 꼬리 (깔끔한 방향 흐름) — 빔별 위상 분산
    const u=((t*0.12)+(hash(s+d)%100)/100)%1;
    for(let q=4;q>=0;q--){const uu=u-q*0.022; if(uu<0)continue;
      const b=bez3(A,M,B,uu), pr=project(b[0],b[1],b[2]), head=q===0;
      g.fillStyle=withA(head?lighten(col,0.5):col, (1-q/5)*(pipe?0.85:0.5));
      if(head){g.shadowColor=col;g.shadowBlur=pipe?8:4;}
      g.beginPath();g.arc(pr.sx,pr.sy,Math.max(0.6,(pipe?2.4:1.7)*(1-q/7)),0,7);g.fill();if(head)g.shadowBlur=0;}
  }
}
function bez3(A,M,B,u){const iu=1-u;return [iu*iu*A[0]+2*iu*u*M[0]+u*u*B[0], iu*iu*A[1]+2*iu*u*M[1]+u*u*B[1], iu*iu*A[2]+2*iu*u*M[2]+u*u*B[2]];}

/* ════════ 호버 팝업 (화면공간 별도 카드) ════════ */
const pop=document.getElementById('pop');
let hoverKey=null, mouse={x:-999,y:-999};
function updatePopup(){
  if(cam.dragging){pop.classList.remove('show');hoverKey=null;return;}
  let best=null,bd=1e9;
  for(const pk of picks){const dx=pk.sx-mouse.x, dy=pk.sy-mouse.y, dd=dx*dx+dy*dy;
    if(dd<pk.r*pk.r && dd<bd){bd=dd;best=pk;}}
  if(!best){pop.classList.remove('show');hoverKey=null;return;}
  if(best.key!==hoverKey){hoverKey=best.key;renderPopup(best.key);}
  // 위치: 행성 오른쪽, 화면 안으로 clamp
  const pw=pop.offsetWidth||220, ph=pop.offsetHeight||200;
  let px=best.sx+best.r+14, py=best.sy-ph/2;
  if(px+pw>cam.w-12) px=best.sx-best.r-14-pw;
  py=Math.max(72, Math.min(py, cam.h-ph-24));
  pop.style.left=px+'px';pop.style.top=py+'px';
  pop.classList.add('show');
}
function renderPopup(k){
  const t=TEAMS[k];
  pop.style.setProperty('--cc',t.color);
  const rows=t.agents.map(a=>`<div class="pa${t._run.has(a)?' run':''}"><span class="d"></span>${a}</div>`).join('');
  pop.innerHTML=`<div class="ph"><span class="pdot"></span><div><div class="pnm">${t.name}</div><div class="prl">${t.role}</div></div><span class="pct">${t.agents.length}</span></div>
    <div class="pstg">${t.stage}</div><div class="pl">${rows}</div>`;
}

/* ════════ 인터랙션 ════════ */
function resize(){DPR=Math.min(2,window.devicePixelRatio||1);cam.w=innerWidth;cam.h=innerHeight;
  gx.width=cam.w*DPR;gx.height=cam.h*DPR;gx.style.width=cam.w+'px';gx.style.height=cam.h+'px';
  cam.scale=Math.min(cam.w/1180, cam.h/760);}
addEventListener('resize',resize);resize();

let lastX=0,lastY=0;
gx.addEventListener('pointerdown',e=>{cam.dragging=true;lastX=e.clientX;lastY=e.clientY;document.body.classList.add('dragging');gx.setPointerCapture(e.pointerId);});
gx.addEventListener('pointermove',e=>{
  mouse.x=e.clientX;mouse.y=e.clientY;
  if(cam.dragging){const dx=e.clientX-lastX, dy=e.clientY-lastY;lastX=e.clientX;lastY=e.clientY;
    cam.yaw+=dx*0.006; cam.pitch=Math.max(PITCH_MIN,Math.min(PITCH_MAX,cam.pitch+dy*0.005));}
});
addEventListener('pointerup',()=>{cam.dragging=false;document.body.classList.remove('dragging');});
gx.addEventListener('wheel',e=>{e.preventDefault();cam.zoom=Math.max(0.55,Math.min(2.6,cam.zoom*(e.deltaY<0?1.08:0.93)));},{passive:false});

/* 별필드 */
const bg=document.getElementById('bg'),bx=bg.getContext('2d');let stars=[];
function initStars(){bg.width=innerWidth;bg.height=innerHeight;stars=[];const n=Math.min(240,innerWidth/7);
  for(let i=0;i<n;i++)stars.push({x:Math.random()*bg.width,y:Math.random()*bg.height,z:Math.random(),s:Math.random()*1.5+0.3,t:Math.random()*6});}
function bgLoop(){bx.clearRect(0,0,bg.width,bg.height);for(const s of stars){s.t+=0.02;const tw=0.6+0.4*Math.sin(s.t);
  s.y-=0.03+s.z*0.12;if(s.y<0){s.y=bg.height;s.x=Math.random()*bg.width;}
  bx.fillStyle=`rgba(${180+s.z*40},${200+s.z*30},255,${(0.1+s.z*0.5)*tw})`;bx.beginPath();bx.arc(s.x,s.y,s.s,0,7);bx.fill();}
  requestAnimationFrame(bgLoop);}
addEventListener('resize',initStars);initStars();bgLoop();

/* 시계 + 라이브 토글 */
setInterval(()=>document.getElementById('clock').textContent=new Date().toTimeString().slice(0,8)+' KST',1000);

/* 부팅 */
let spin=true;
const lines=["> MAGI CORE IGNITION ......... OK","> SPAWNING 7 PLANETARY SYSTEMS","> 45 AGENT SATELLITES IN ORBIT","> HANDOFF STREAMS ......... 18 LINKS","> 3D GALACTIC PROJECTION ONLINE","> WORKFLOW COSMOS READY"];
const bl=document.getElementById('boot-lines');
lines.forEach((tx,i)=>{const d=document.createElement('div');d.textContent=tx;d.style.animationDelay=(.35+i*.42)+'s';bl.appendChild(d);});
function boot(){const bo=document.getElementById('boot');bo.classList.remove('done');
  bl.querySelectorAll('div').forEach((d,i)=>{d.style.animation='none';void d.offsetWidth;d.style.animation='';d.style.animationDelay=(.35+i*.42)+'s';});
  setTimeout(()=>bo.classList.add('done'),3200);}
boot();

document.getElementById('btn-fs').onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen();else document.exitFullscreen();};
document.getElementById('btn-replay').onclick=boot;
document.getElementById('btn-spin').onclick=e=>{spin=!spin;e.target.classList.toggle('on',spin);};
addEventListener('keydown',e=>{if(e.key==='f'||e.key==='F')document.getElementById('btn-fs').click();if(e.key==='r'||e.key==='R')boot();});

requestAnimationFrame(frame);
})();
