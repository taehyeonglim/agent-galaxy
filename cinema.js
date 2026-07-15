import { validateData, applyDefaults } from './schema.mjs';
(async function(){
/* ════════ DATA — data.json ════════ */
let D;
try{
  const raw=await fetch('data.json?ts='+Date.now()).then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); });
  const errs=validateData(raw);
  if(errs.length) throw new Error('invalid data.json:\n· '+errs.join('\n· '));
  D=applyDefaults(raw);
}catch(e){
  document.body.innerHTML='<pre style="color:#9fb2cf;font:13px monospace;padding:48px;white-space:pre-wrap">⚠ failed to load data.json\n\n'+String(e.message||e)+'\n\nTip: run  node galaxy.mjs --serve</pre>';
  return;
}
function initials(name){const w=String(name).trim().split(/[\s_-]+/).filter(Boolean);
  return ((w[0]?.[0]||'?')+(w[1]?.[0]||w[0]?.[1]||'')).toUpperCase();}
const IMGC={}; function IMG(src){ if(!src) return null; if(!IMGC[src]){IMGC[src]=new Image();IMGC[src].src=src;} return IMGC[src]; }
const TEAMS={}; const ORDER=D.teams.map(t=>t.key);
D.teams.forEach(t=>{ TEAMS[t.key]={ name:t.name, role:t.role||'', color:t.color, stage:t.stage||'',
  node:{initials:initials(t.name), emoji:t.emoji||null, image:t.image||null},
  agents:t.agents.map(a=>a.name), _run:new Set(t.agents.filter(a=>a.running).map(a=>a.name)) }; });
const ANG={}; ORDER.forEach((k,i)=>{ ANG[k]=i*360/ORDER.length; });
const LINKS=D.links;
const totalAgents=D.teams.reduce((n,t)=>n+t.agents.length,0);

/* ════════ 3D 월드 구축 ════════ */
const PR=360;
const planets={};
function hash(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;}
ORDER.forEach(k=>{
  const t=TEAMS[k], a=(ANG[k]-90)*Math.PI/180, n=t.agents.length;
  const pos=[PR*Math.cos(a), 0, PR*Math.sin(a)];
  const pr=20+Math.sqrt(n)*7;
  const moons=t.agents.map((ag,i)=>{
    const h=hash(ag);
    return { name:ag, rr:pr+22+i*10, incl:(((h>>5)%34)-17)/100, phase:(h%628)/100,
      spd:0.09+((h>>9)%50)/360, dir:(h&1)?1:-1, ms:2.4+((h>>3)%3), run:TEAMS[k]._run.has(ag) };
  });
  planets[k]={key:k, pos, r:pr+4, color:t.color, name:t.name, stage:t.stage, role:t.role, agents:t.agents, node:t.node, moons, screen:null};
});
const SUN={pos:[0,0,0], r:54};

/* ════════ Outposts — 링 밖 관조 노드 (above/below/outer) ════════ */
function outPos(o, arr){
  const sibs=arr.filter(x=>x.placement===o.placement), j=sibs.indexOf(o), off=(j-(sibs.length-1)/2)*180;
  if(o.placement==='above') return [off,300,-60];
  if(o.placement==='below') return [off,-200,0];
  const a=2.5+j*1.1; return [Math.cos(a)*470,0,Math.sin(a)*470];
}
const OUTPOSTS=D.outposts.map((o,_,arr)=>({ ...o, pos:outPos(o,arr), r:o.placement==='outer'?22:28,
  node:{initials:initials(o.name), emoji:o.emoji||null, image:o.image||null} }));

/* ════════ Cores — 중앙 허브 0~N (1=중앙, 2=대칭, ≥3=다각 전력망) ════════ */
const CORE_R=50, POLY_R=92, ACCENT=D.meta.accent;
const CORES=D.cores.map((c,i)=>({ ...c,
  ang: D.cores.length===1?0:(-Math.PI/2 + i*2*Math.PI/D.cores.length),
  rad: D.cores.length===1?0:CORE_R }));

/* ════════ 카메라 + 투영 (manual 3D projection) ════════ */
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

/* 노드 배지 포트레이트 (원형 아바타 + 팀틴트 + 글로우링 + 배지 + 3D 림 비네트) */
function drawBadge(pp, color, node, worldR, label, sub, sun, opt){
  const r=Math.max(6, worldR*pp.s), sx=pp.sx, sy=pp.sy;
  let lx=0,ly=0; if(sun){lx=sun.sx-sx;ly=sun.sy-sy;const ll=Math.hypot(lx,ly)||1;lx/=ll;ly/=ll;}
  const active=opt&&opt.active;
  // 외곽 글로우
  const halo=g.createRadialGradient(sx,sy,r*0.8,sx,sy,r*1.95);
  halo.addColorStop(0,withA(color,active?0.32:0.20));halo.addColorStop(1,withA(color,0));
  g.fillStyle=halo;g.beginPath();g.arc(sx,sy,r*1.95,0,7);g.fill();
  // 얼굴 (원형 클립)
  g.save();g.beginPath();g.arc(sx,sy,r,0,7);g.clip();
  const img=IMG(node.image);
  if(img&&img.complete&&img.naturalWidth){
    g.drawImage(img, sx-r, sy-r, 2*r, 2*r);
    g.globalCompositeOperation='overlay';g.globalAlpha=0.22;g.fillStyle=color;
    g.beginPath();g.arc(sx,sy,r,0,7);g.fill();
    g.globalAlpha=1;g.globalCompositeOperation='source-over';
  } else {
    const body=g.createRadialGradient(sx-r*0.32,sy-r*0.34,r*0.08,sx,sy,r);
    body.addColorStop(0,lighten(color,0.5));body.addColorStop(0.5,color);body.addColorStop(1,darken(color,0.45));
    g.fillStyle=body;g.fillRect(sx-r,sy-r,2*r,2*r);
    g.textAlign='center';g.textBaseline='middle';
    if(node.emoji){ g.font=Math.round(r*1.1)+'px sans-serif';g.fillText(node.emoji,sx,sy+r*0.06); }
    else { g.fillStyle='rgba(6,4,12,0.82)';g.font='700 '+Math.round(r*0.72)+'px "IBM Plex Mono",monospace';g.fillText(node.initials,sx,sy+r*0.04); }
    g.textBaseline='alphabetic';
  }
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
  drawBadge(pp, P.color, P.node, P.r, P.name, (P.stage?P.stage+' · ':'')+P.agents.length, sun, {count:P.agents.length, active:runc>0});
}

/* ════════ 중앙 코어 허브 — 0~N 데이터 주도 ════════ */
function pushCores(items, t){
  if(!CORES.length) return;
  const cen=project(0,0,0);
  const cores=CORES.map(c=>({ ...c, p:project(Math.cos(c.ang)*c.rad,0,Math.sin(c.ang)*c.rad), vcol:c.color||ACCENT }));
  // N각 발광 베이스 (N>=3)
  if(cores.length>=3){
    const off=Math.PI/cores.length;
    const tv=cores.map(c=>project(Math.cos(c.ang+off)*POLY_R,0,Math.sin(c.ang+off)*POLY_R));
    items.push({z:tv.reduce((s,v)=>s+v.z,0)/tv.length-3, draw:()=>{
      const grad=g.createRadialGradient(cen.sx,cen.sy,2,cen.sx,cen.sy,150*cam.scale*cam.zoom);
      grad.addColorStop(0,withA(ACCENT,0.5));grad.addColorStop(0.4,withA(ACCENT,0.28));grad.addColorStop(1,withA(ACCENT,0));
      g.beginPath();tv.forEach((v,i)=>i===0?g.moveTo(v.sx,v.sy):g.lineTo(v.sx,v.sy));g.closePath();
      g.fillStyle=grad;g.fill();
      g.strokeStyle=ACCENT;g.lineWidth=3.2;g.shadowColor=withA(ACCENT,0.95);g.shadowBlur=12;g.stroke();g.shadowBlur=0;
    }});
  }
  // 인접 코어간 전력망 아크 + 중앙 수렴선 (N>=2)
  if(cores.length>=2){
    const pairs=cores.length===2?1:cores.length;
    for(let i=0;i<pairs;i++){
      const m1=cores[i], m2=cores[(i+1)%cores.length], a=m1.p, b=m2.p, c1=m1.vcol, c2=m2.vcol;
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
        lg.addColorStop(0,withA(m1.vcol,0.3));lg.addColorStop(1,withA(ACCENT,0.05));
        g.save();g.globalCompositeOperation='lighter';g.strokeStyle=lg;g.lineWidth=1;
        g.beginPath();g.moveTo(m1.p.sx,m1.p.sy);g.lineTo(cen.sx,cen.sy);g.stroke();g.restore();
      }});
    }
  }
  // 코어 (회전 육각 홀로프레임 + 라벨 — 로고 없음, image 필드는 옵션)
  cores.forEach((c,i)=>{
    const p=c.p, vcol=c.vcol, vglow=lighten(vcol,0.4), rad=Math.max(11,24*p.s);
    items.push({z:p.z, draw:()=>{
      const spin=t/3+i*0.7, cs=Math.cos(spin), sn=Math.sin(spin);
      const grad=g.createRadialGradient(p.sx,p.sy,1,p.sx,p.sy,rad*1.7);
      grad.addColorStop(0,withA(vglow,0.9));grad.addColorStop(0.5,withA(vcol,0.6));grad.addColorStop(1,withA(vcol,0));
      g.fillStyle=grad;g.beginPath();g.arc(p.sx,p.sy,rad*1.7,0,7);g.fill();
      g.beginPath();
      for(let k=0;k<=6;k++){const a=(k%6)/6*Math.PI*2-Math.PI/2, vx=Math.cos(a), vy=Math.sin(a),
        qx=p.sx+(vx*cs-vy*sn)*rad, qy=p.sy+(vx*sn+vy*cs)*rad; k===0?g.moveTo(qx,qy):g.lineTo(qx,qy);}
      g.closePath();g.fillStyle=withA(vcol,0.5);g.strokeStyle=vglow;g.lineWidth=2;
      g.shadowColor=vglow;g.shadowBlur=12;g.fill();g.shadowBlur=0;g.stroke();
      g.strokeStyle=withA(vglow,0.25);g.lineWidth=1;
      for(let k=0;k<6;k++){const a=k/6*Math.PI*2-Math.PI/2, vx=Math.cos(a), vy=Math.sin(a),
        qx=p.sx+(vx*cs-vy*sn)*rad, qy=p.sy+(vx*sn+vy*cs)*rad; g.beginPath();g.moveTo(p.sx,p.sy);g.lineTo(qx,qy);g.stroke();}
      const br=rad*1.35, tk=rad*0.34; g.strokeStyle=withA(vglow,0.6);g.lineWidth=1.4;
      for(let cc=0;cc<4;cc++){const qx=(cc&1)?1:-1, qy=(cc&2)?1:-1, cxp=p.sx+qx*br, cyp=p.sy+qy*br;
        g.beginPath();g.moveTo(cxp-qx*tk,cyp);g.lineTo(cxp,cyp);g.lineTo(cxp,cyp-qy*tk);g.stroke();}
      const icon=IMG(c.image);
      if(icon&&icon.complete&&icon.naturalWidth){const isz=rad*1.7;g.save();g.shadowColor=withA(vglow,0.85);g.shadowBlur=8;
        g.drawImage(icon,p.sx-isz/2,p.sy-isz/2,isz,isz);g.restore();}
      g.fillStyle=withA(vcol,0.92);g.textAlign='center';
      g.font='700 '+Math.round(7.5*p.s+3)+'px "IBM Plex Mono",monospace';g.fillText(c.id,p.sx,p.sy-rad-7);
      if(c.label){g.fillStyle=withA(vglow,0.9);g.font='600 '+Math.round(8*p.s+2)+'px "IBM Plex Mono",monospace';
        g.fillText(c.label,p.sx,p.sy+rad+12);}
    }});
  });
  // 허브 라벨 (N>=2일 때 중앙 위 부양; N==1은 코어 자체가 중앙)
  if(cores.length>=2){
    const top=project(0,95,0);
    items.push({z:top.z+5, draw:()=>{
      g.textAlign='center';g.fillStyle=ACCENT;g.shadowColor=ACCENT;g.shadowBlur=14;
      g.font='700 '+Math.max(14,Math.round(18*top.s))+'px "IBM Plex Mono",monospace';g.fillText(D.meta.coreLabel,top.sx,top.sy);g.shadowBlur=0;
      g.fillStyle=withA(ACCENT,0.65);g.font='600 9px "IBM Plex Mono",monospace';
      g.fillText(CORES.length+' CORES · '+totalAgents+' AGENTS',top.sx,top.sy+13);
    }});
  }
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
  // Outposts + 중앙 연결 점선 (코어 있을 때만)
  for(const O of OUTPOSTS){
    const mp=project(...O.pos), cc=project(0,0,0);
    if(CORES.length){
      items.push({z:Math.min(mp.z,cc.z)-1, draw:()=>{
        g.save();g.setLineDash([3,8]);g.strokeStyle=withA(O.color||'#95a5a6',0.26);g.lineWidth=1;
        g.beginPath();g.moveTo(cc.sx,cc.sy);g.lineTo(mp.sx,mp.sy);g.stroke();g.setLineDash([]);g.restore();
      }});
    }
    items.push({z:mp.z, draw:()=>drawBadge(mp, O.color||'#95a5a6', O.node, O.r, O.name, O.label||'', sunScreen, {})});
  }
  pushCores(items, t);

  // ── 핸드오프 빔 (구체 아래 레이어, 3D 곡선) ──
  drawBeams(t);

  // ── 깊이정렬 후 그리기 (뒤→앞) ──
  items.sort((a,b)=>a.z-b.z);
  for(const it of items) it.draw();

  // 호버 팝업 위치 갱신
  updatePopup();
  requestAnimationFrame(frame);
}

function nodePos(k){ if(planets[k]) return planets[k].pos; const o=OUTPOSTS.find(x=>x.key===k); return o&&o.pos; }
function drawBeams(t){
  for(const [s,d,type] of LINKS){
    const A=nodePos(s); if(!A) continue;
    const B=nodePos(d); if(!B) continue;
    const lt=D.linkTypes[type]||{color:'#aab4d8'};
    const pipe=!!lt.emphasis, col=lt.color;
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

/* ════════ HUD 주입 + 시계 ════════ */
document.getElementById('t-logo').textContent=D.meta.title;
document.getElementById('t-sub').textContent=D.meta.subtitle;
const verEl=document.getElementById('t-ver');
if(D.meta.version) verEl.textContent=D.meta.version; else verEl.style.display='none';
setInterval(()=>document.getElementById('clock').textContent=new Date().toTimeString().slice(0,8),1000);

/* 범례 — 실제 사용된 링크 타입에서 생성 */
const legend=document.getElementById('legend');
const usedTypes=[...new Set(LINKS.map(l=>l[2]))];
if(usedTypes.length||D.teams.some(t=>t.agents.some(a=>a.running))){
  legend.innerHTML='<b>LINKS</b>'
    +usedTypes.map(k=>{const v=D.linkTypes[k]||{color:'#aab4d8'};return '<div class="lg"><i style="border-color:'+v.color+'"></i>'+(v.label||k)+'</div>';}).join('')
    +'<div class="lg s"><i style="background:#3ef0a0;box-shadow:0 0 8px #3ef0a0"></i>running agent</div>';
}else legend.style.display='none';

/* ════════ 부팅 시퀀스 ════════ */
let spin=true;
document.getElementById('boot-logo').textContent=D.meta.title;
const lines=[
  '> CORE IGNITION ......... OK',
  '> SPAWNING '+ORDER.length+' PLANETARY SYSTEMS',
  '> '+totalAgents+' AGENT SATELLITES IN ORBIT',
  '> HANDOFF STREAMS ......... '+LINKS.length+' LINKS',
  '> 3D GALACTIC PROJECTION ONLINE',
  '> GALAXY READY'];
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
