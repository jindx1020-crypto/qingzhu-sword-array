/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {clearing} from './director-rules.js';
import {battleCamera,offscreenDirection} from './camera.js';
import {gnawTargets} from './targeting.js';
import {afterThunderWindow} from './balance.js';
import {ENEMY_ROLES} from './content-rules.js';
import ASSETS from './assets.generated.js';
import {drawHealthBar,healthFraction} from './meters.js';
import {sigilFuse} from './sigil-metrics.js';
import {WORLD} from './engine.js';
import {layoutFor} from './encounters.js';
import {seeded} from './data.js';
import {placeObjectiveLabel} from './progress-display.js';
export {ASSETS};
const TAU=Math.PI*2;
function load(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('素材未能加载'));i.src=src;});}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
// Runtime sprite extraction removes only edge-connected near-white atlas background.
// It preserves enclosed light clothing, eyes, and the original reference identity.
function crop(image,x,y,w,h,key=false){
 const c=canvas(Math.ceil(w),Math.ceil(h)),ctx=c.getContext('2d');ctx.drawImage(image,x,y,w,h,0,0,c.width,c.height);
 const im=ctx.getImageData(0,0,c.width,c.height),d=im.data;
 if(key){
  const seen=new Uint8Array(c.width*c.height),q=new Int32Array(seen.length);let tail=0,head=0;
  const push=(i)=>{if(i<0||i>=seen.length||seen[i])return;seen[i]=1;const a=i*4,r=d[a],g=d[a+1],b=d[a+2];if(Math.min(r,g,b)>230&&Math.max(r,g,b)-Math.min(r,g,b)<14){q[tail++]=i;d[a+3]=0;}};
  for(let xx=0;xx<c.width;xx++){push(xx);push((c.height-1)*c.width+xx);}for(let yy=0;yy<c.height;yy++){push(yy*c.width);push(yy*c.width+c.width-1);}
  while(head<tail){const i=q[head++],xx=i%c.width;push(i-c.width);push(i+c.width);if(xx>0)push(i-1);if(xx<c.width-1)push(i+1);}
  ctx.putImageData(im,0,0);
 }
 let left=c.width,top=c.height,right=0,bottom=0;
 for(let yy=0;yy<c.height;yy++)for(let xx=0;xx<c.width;xx++)if(d[(yy*c.width+xx)*4+3]>40){left=Math.min(left,xx);top=Math.min(top,yy);right=Math.max(right,xx);bottom=Math.max(bottom,yy);}
 if(right<=left||bottom<=top)return c;
 const out=canvas(right-left+3,bottom-top+3);out.getContext('2d').drawImage(c,left,top,right-left+1,bottom-top+1,1,1,right-left+1,bottom-top+1);return out;
}
export async function loadArt(sources=ASSETS){
 const [hero,enemies,maps,gold,menu,portraits,icons,props,hanliPortrait]=await Promise.all([load(sources.hero),load(sources.enemies),load(sources.maps),load(sources.golden),load(sources.menu),load(sources.portraits),load(sources.icons),load(sources.props),load(sources.hanliPortrait)]);
 const heroes=Array.from({length:8},(_,i)=>crop(hero,(i%4)*hero.width/4,Math.floor(i/4)*hero.height/2,hero.width/4,hero.height/2,true));
 const foes=Array.from({length:16},(_,i)=>crop(enemies,(i%4)*enemies.width/4,Math.floor(i/4)*enemies.height/4,enemies.width/4,enemies.height/4));
 const grounds=Array.from({length:6},(_,i)=>crop(maps,(i%3)*maps.width/3,Math.floor(i/3)*maps.height/2,maps.width/3,maps.height/2));
 const grid=(img,cols,rows)=>Array.from({length:cols*rows},(_,i)=>crop(img,i%cols*img.width/cols,Math.floor(i/cols)*img.height/rows,img.width/cols,img.height/rows));
 return {heroes,foes,grounds,hanliPortrait,portraits:grid(portraits,3,2),icons:grid(icons,6,3),props:grid(props,3,3),golden:crop(gold,0,0,gold.width,gold.height,true),menu};
}
export function sprite(ctx,img,x,y,height,alpha=1,flip=false){
 if(!img)return;const w=height*img.width/img.height;ctx.save();ctx.globalAlpha*=alpha;ctx.translate(Math.round(x),Math.round(y));if(flip)ctx.scale(-1,1);ctx.drawImage(img,-w/2,-height,w,height);ctx.restore();
}
export class Renderer{
 constructor(canvas,art){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.art=art;this.shake=0;this.camera={x:0,y:0,scale:1};this.resize();}
 showFormationReady(battle){if(battle)this.formationMoment={battle,started:null};}
 drawFormationMoment(b,seconds){const moment=this.formationMoment;if(!moment)return;if(moment.battle!==b){this.formationMoment=null;return;}if(b.modeState!=='battle')return;if(moment.started===null)moment.started=seconds;const t=(seconds-moment.started)/2.4;if(t>=1){this.formationMoment=null;return;}const ctx=this.ctx,p=b.player;ctx.save();ctx.globalAlpha=Math.min(1,(1-t)*3)*.6;ctx.strokeStyle='#d3e9ac';ctx.lineWidth=1.6;for(let i=0;i<72;i++){const ring=Math.floor(i/24),angle=i%24*TAU/24-Math.PI/2+ring*.06,r=56+ring*18+t*10,x=p.x+Math.cos(angle)*r,y=p.y-12+Math.sin(angle)*r;ctx.save();ctx.translate(x,y);ctx.rotate(angle+Math.PI/2);ctx.beginPath();ctx.moveTo(0,5);ctx.lineTo(0,-7);ctx.lineTo(-2,-4);ctx.moveTo(0,-7);ctx.lineTo(2,-4);ctx.moveTo(-3,2);ctx.lineTo(3,2);ctx.stroke();ctx.restore();}ctx.restore();}
 showBossDefeat(effect){this.bossDeath={...effect,started:performance.now()};}
 clearBossDefeat(){this.bossDeath=null;}
 drawBossDefeat(){const f=this.bossDeath;if(!f)return;const t=(performance.now()-f.started)/900;if(t>=1){this.bossDeath=null;return;}const ctx=this.ctx,{x,y,scale}=this.camera;ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha=1-t;ctx.strokeStyle=f.color;ctx.fillStyle=f.color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(f.x,f.y-24,20+t*100,0,TAU);ctx.stroke();sprite(ctx,this.art.foes[f.sprite],f.x,f.y+10-t*22,110*(1-t*.18),(1-t)*.65);for(let i=0;i<18;i++){const a=i*2.39996,d=24+t*(55+i%4*15),size=Math.max(1,5*(1-t));ctx.fillRect(f.x+Math.cos(a)*d-size/2,f.y-35+Math.sin(a)*d-size/2-t*20,size,size);}ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.fillText(f.name+' · 消散',f.x,f.y-120-t*15);ctx.restore();}
 drawObjective(b,_time){const q=b.objective,ctx=this.ctx;if(!q)return;ctx.save();ctx.textAlign='center';ctx.font='bold 17px sans-serif';ctx.lineWidth=3;
  if(q.kind==='defend'){sprite(ctx,this.art.props[0],q.x,q.y+20,110);drawHealthBar(ctx,q.x-55,q.y-112,110,8,q.hp,q.maxHp,'#a2e7c3');ctx.fillStyle='#a2e7c3';ctx.fillText('护持阵盘',q.x,q.y-130);}
  if(q.kind==='illusion'){
   const camera=this.camera,scale=camera.scale,font=Math.max(17,12/scale),occupied=[...(this.hudAvoid||[])];ctx.font='bold '+font+'px sans-serif';
   q.gates.forEach((g,i)=>{const real=i===q.trueGate,open=b.waveTime>=q.next;sprite(ctx,this.art.props[open?2:1],g.x,g.y+40,125,real?1:.6);ctx.strokeStyle=real?'#dfd3a2':'#91a5b0';ctx.lineWidth=3;ctx.beginPath();ctx.arc(g.x,g.y,72,0,TAU);ctx.stroke();if(real){ctx.beginPath();ctx.arc(g.x,g.y,79,0,TAU);ctx.stroke();}
    const text=real?(open?'真 · 可通行':'真 · '+Math.max(0,Math.ceil(q.next-b.waveTime))+'秒后通行'):'幻 · 勿入',label=placeObjectiveLabel(camera,{x:g.x,y:g.y-103},{width:ctx.measureText(text).width*scale+10,height:font*scale+8},occupied),x=(label.x-camera.x)/scale,y=(label.y-camera.y)/scale;
    if(label.moved){ctx.strokeStyle=real?'#dfd3a288':'#91a5b077';ctx.lineWidth=1/scale;ctx.beginPath();ctx.moveTo(g.x,g.y-79);ctx.lineTo(x,y-font*.5);ctx.stroke();}
    ctx.fillStyle='#081c17e8';ctx.fillRect((label.left-camera.x)/scale,(label.top-camera.y)/scale,label.width/scale,label.height/scale);ctx.fillStyle=real?'#ffe4aa':'#b5c1c5';ctx.fillText(text,x,y-4/scale,Math.max(1,(label.width-10)/scale));occupied.push(label);
   });
  }
  if(q.kind==='ice'){ctx.fillStyle='#a2c8ed44';ctx.strokeStyle='#dcecff';ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#dbedff';ctx.fillText('乾蓝冰焰 · 后撤',q.x,q.y-15);}
  if(q.exit){const open=q.kind==='ice'?b.waveTime>=40:q.done>=q.total;sprite(ctx,this.art.props[open?2:1],q.exit.x,q.exit.y+35,125);ctx.strokeStyle=open?'#a4edc7':'#9dada7';ctx.beginPath();ctx.arc(q.exit.x,q.exit.y,q.exit.r,0,TAU);ctx.stroke();ctx.fillStyle='#e9e1b8';ctx.fillText(open?'退路已开 · 靠近离场':'退路待开',q.exit.x,q.exit.y-106);}
 ctx.restore();}

 resize(){const rect=this.canvas.getBoundingClientRect();this.canvas.width=Math.max(1,Math.round(rect.width));this.canvas.height=Math.max(1,Math.round(rect.height));this.ctx.imageSmoothingEnabled=false;}
 toWorld(x,y){const r=this.canvas.getBoundingClientRect();return {x:(x-r.left-this.camera.x)/this.camera.scale,y:(y-r.top-this.camera.y)/this.camera.scale};}
 draw(battle,seconds,settings={}){
  const ctx=this.ctx,c=this.canvas,w=c.width,h=c.height;
  ctx.fillStyle='#081412';ctx.fillRect(0,0,w,h);
  const b=battle,p=b?.player||{x:955,y:555,dx:0,dy:1,moving:false,invuln:0,dash:0};
  const gnawSelected=b?.path===3?new Map(gnawTargets(b).map((t,i)=>[t.id,String.fromCharCode(65+i)])):new Map(),afterThunder=b&&seconds-b.thunderTime<afterThunderWindow(b)&&((b.stats.afterThunder||0)>0||b.rulesVersion>=2&&b.path===1);
  let scale=settings.preview?Math.max(w/680,h/400):Math.max(w/WORLD.w,h/WORLD.h)*1.04;
  const view=b&&!settings.preview?battleCamera(w,h,p,{top:this.hudTop||0,bottom:this.hudBottom||0,left:this.hudLeft||0,right:this.hudRight||0}):{x:b?Math.min(0,Math.max(w-WORLD.w*scale,w/2-p.x*scale)):(w-WORLD.w*scale)/2,y:b?Math.min(0,Math.max(h-WORLD.h*scale,h/2-p.y*scale)):(h-WORLD.h*scale)/2,scale};
  scale=view.scale;const ox=view.x,oy=view.y;
  this.camera=view;
  this.shake*=.85;const sx=settings.shake?Math.sin(seconds*83)*this.shake:0,sy=settings.shake?Math.cos(seconds*109)*this.shake:0;
  this.camera={...view,x:ox+sx,y:oy+sy};ctx.save();ctx.translate(ox+sx,oy+sy);ctx.scale(scale,scale);
  ctx.drawImage(b?this.art.grounds[layoutFor(b).map]:this.art.menu,0,0,WORLD.w,WORLD.h);
  ctx.fillStyle=b?'#05131530':'#07171308';ctx.fillRect(0,0,WORLD.w,WORLD.h);if(b)this.drawFormationMoment(b,seconds);else this.formationMoment=null;
  // Arena boundary and faint tactical grid are UI, not decorative artwork.
  ctx.strokeStyle='#86c5ab35';ctx.lineWidth=1;if(b)ctx.strokeRect(27,35,WORLD.w-54,WORLD.h-63);
  if(b){
   for(const z of b.zones){
    if(z.sigil){ctx.save();const color=z.metaEcho?'#d4afff':z.arming>0?'#91bbca':'#ffbd78';ctx.fillStyle=z.metaEcho?'#8a52bb35':'#d176383d';ctx.strokeStyle=color;ctx.lineWidth=z.metaEcho?2:3;ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,TAU);ctx.fill();ctx.stroke();ctx.setLineDash(z.metaEcho?[4,7]:z.arming>0?[3,5]:[]);ctx.beginPath();ctx.arc(z.x,z.y,z.r*.74,0,TAU);ctx.stroke();ctx.translate(z.x,z.y);ctx.rotate(Math.PI/4);ctx.strokeRect(-17,-17,34,34);ctx.rotate(-Math.PI/4);ctx.fillStyle=color;ctx.font='bold 17px sans-serif';ctx.textAlign='center';ctx.fillText(z.metaEcho?'回':'符',0,6);ctx.font='12px sans-serif';ctx.fillText(z.metaEcho?'复燃回响':z.twin&&!z.pair?'合符待配':z.twin?'合符同燃':z.arming>0?'布符中':z.arming===0?'踏入即爆':'起点留符',0,z.r+18);if(z.warn>0){ctx.lineWidth=5;ctx.beginPath();ctx.arc(0,0,z.r+5,-Math.PI/2,-Math.PI/2+TAU*Math.min(1,z.warn/(sigilFuse(z,b.stats))));ctx.stroke();}ctx.restore();continue;}

    ctx.save();ctx.globalAlpha=z.warn>0?.6:.33;ctx.fillStyle=z.friendly?(z.kind==='ward'?'#79c4ae':z.fireKind==='ember'?'#bd783f':'#dc8b46'):(z.kind==='poison'?'#85a653':z.kind==='frost'?'#85d8ef':z.kind==='web'?'#b5bbcc':z.kind==='sacred'?'#e1d1dc':'#bf563e');
    ctx.beginPath();ctx.arc(z.x,z.y,z.r,0,TAU);ctx.fill();ctx.globalAlpha=.9;ctx.strokeStyle=z.friendly?(z.fireKind==='ember'?'#dfa268':'#a2eacb'):z.kind==='frost'?'#a4e8f6':z.kind==='sacred'?'#efdaf0':'#f39a78';ctx.lineWidth=2;ctx.setLineDash(z.warn>0?[6,6]:[]);ctx.stroke();
    if(z.warn>0){ctx.beginPath();ctx.moveTo(z.x-7,z.y);ctx.lineTo(z.x+7,z.y);ctx.moveTo(z.x,z.y-7);ctx.lineTo(z.x,z.y+7);ctx.stroke();}
    // C-9: residual poison mist telegraphs its first 0.4 s with a bright dashed outer ring, a shrinking inner ring and a label (display only; damage and i-frames unchanged).
    if(z.kind==='poison'&&!z.friendly&&z.warn>0){const k=Math.max(0,Math.min(1,z.warn/.4));ctx.globalAlpha=1;ctx.strokeStyle='#e4f7a0';ctx.lineWidth=4;ctx.setLineDash([5,4]);ctx.beginPath();ctx.arc(z.x,z.y,z.r+6,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=2;ctx.beginPath();ctx.arc(z.x,z.y,Math.max(4,z.r*(1-k)),0,TAU);ctx.stroke();ctx.fillStyle='#eef9c2';ctx.font='bold 12px sans-serif';ctx.textAlign='center';ctx.fillText('毒雾 · 即将扩散',z.x,z.y-z.r-10);}ctx.restore();
   }
   const objective=b.mechanism||(b.midEncounter&&!b.midEncounter.done?b.midEncounter:null);
   if(objective){const q=objective;ctx.save();ctx.fillStyle='#7be8c229';ctx.strokeStyle='#99efc9';ctx.lineWidth=3;ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,TAU);ctx.fill();ctx.stroke();ctx.lineWidth=7;ctx.strokeStyle='#e6d29a';ctx.beginPath();ctx.arc(q.x,q.y,q.r+7,-Math.PI/2,-Math.PI/2+TAU*Math.min(1,q.progress/q.goal));ctx.stroke();ctx.fillStyle='#d5eed7';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText((b.encounter?.kind==='treasure'?'阵位 '+(q.step+1)+' / 3 · ':'')+Math.floor(q.progress)+' / '+q.goal+' 秒',q.x,q.y-q.r-18);if(b.encounter?.kind==='treasure'){const dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy);if(d>q.r){const angle=Math.atan2(dy,dx);ctx.save();ctx.translate(p.x+Math.cos(angle)*42,p.y+Math.sin(angle)*42);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-6,-6);ctx.lineTo(-6,6);ctx.closePath();ctx.fill();ctx.restore();}}ctx.restore();}
   if(b.isExpedition)this.drawObjective(b,seconds);
   for(const d of b.drops){ctx.save();ctx.translate(d.x,d.y);ctx.rotate(Math.PI/4);ctx.fillStyle=d.heal?'#dc8a79':d.xpBonus>0?'#e6bc76':d.value>8?'#e4c67d':'#81d4b0';const size=d.heal?5:d.value>8?5:3;ctx.fillRect(-size,-size,size*2,size*2);ctx.restore();}
   for(const e of b.enemies){
    if(e.hp<=0)continue;const ghost=e.family==='阴魂',bob=ghost?Math.sin(seconds*3+e.id)*3:Math.sin(e.age*9)*1.5;
    const height=e.boss?110:e.elite?76:e.ai==='swarm'||e.ai==='trail'?31:52;
    ctx.fillStyle='#00000050';ctx.beginPath();ctx.ellipse(e.x,e.y+3,e.r,7,0,0,TAU);ctx.fill();
    if(b.isExpedition&&clearing(b)&&e.mission&&!e.untargetable){ctx.save();ctx.strokeStyle='#fff1a8';ctx.lineWidth=3/scale;ctx.beginPath();ctx.arc(e.x,e.y,e.r+12,0,TAU);ctx.stroke();ctx.restore();}
    if(e.boss){ctx.save();ctx.strokeStyle=e.bossType==='xuangu'?'#b9e3c6':'#f0ce92';ctx.lineWidth=3/scale;ctx.beginPath();ctx.ellipse(e.x,e.y+7,e.r+16,13,0,0,TAU);ctx.stroke();ctx.translate(e.x,e.y-height-22);ctx.beginPath();ctx.moveTo(-9,4);ctx.lineTo(-11,-6);ctx.lineTo(-4,-1);ctx.lineTo(0,-10);ctx.lineTo(4,-1);ctx.lineTo(11,-6);ctx.lineTo(9,4);ctx.closePath();ctx.stroke();ctx.restore();}
    if(b.touchLockId===e.id){ctx.save();ctx.strokeStyle='#a5f4d6';ctx.lineWidth=2/scale;ctx.setLineDash([6/scale,3/scale]);ctx.strokeRect(e.x-e.r-8,e.y-e.r-8,(e.r+8)*2,(e.r+8)*2);ctx.restore();}
    if(e.spawn>0){ctx.strokeStyle='#d1987855';ctx.beginPath();ctx.arc(e.x,e.y,20,0,TAU);ctx.stroke();}
    if(e.mission==='rune'){sprite(ctx,this.art.props[0],e.x,e.y+10,80,e.untargetable?.4:1);ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.fillStyle=e.untargetable?'#b1b5b1':'#ffdfa6';ctx.fillText((e.untargetable?'封闭 ':'击破 ')+(e.runeIndex+1)+' · '+Math.ceil(healthFraction(e.hp,e.maxHp)*100)+'%',e.x,e.y-80);drawHealthBar(ctx,e.x-32,e.y-69,64,6,e.hp,e.maxHp,e.untargetable?'#8c9d94':'#e5c582');}else sprite(ctx,this.art.foes[e.sprite],e.x,e.y+10+bob,height,e.spawn>0?.5:e.flash>0?.65:1,e.a>Math.PI/2||e.a<-Math.PI/2);
    if(b.practice?.step===2&&e.practiceAnchor){ctx.save();ctx.font='bold 22px sans-serif';ctx.fillStyle=e.name.startsWith('B')?'#ffdf90':'#a8e6eb';ctx.textAlign='center';ctx.fillText(e.name[0],e.x,e.y-height-28);ctx.restore();}
    if(['marked','carrier'].includes(e.mission)){ctx.save();ctx.strokeStyle=e.untargetable?'#91a6b4':'#ffdfa0';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,32,0,TAU);ctx.stroke();ctx.font='bold 14px sans-serif';ctx.fillStyle='#ffdfa0';ctx.textAlign='center';ctx.fillText(e.name,e.x,e.y-height-30);drawHealthBar(ctx,e.x-40,e.y-height-19,80,7,e.hp,e.maxHp,e.untargetable?'#91a6b4':'#dcaa5a');ctx.font='12px sans-serif';ctx.fillText(e.untargetable?'护卫未清 · 暂不可伤':Math.ceil(Math.max(0,e.hp))+' / '+Math.ceil(e.maxHp)+' 生命',e.x,e.y-height+5);ctx.restore();}
    const role=ENEMY_ROLES[e.index];if(role&&!e.boss){ctx.save();ctx.fillStyle='#0a172bdd';const font=Math.max(12,10/scale);ctx.fillRect(e.x-font*1.5,e.y-height-font-4,font*3,font+3);ctx.fillStyle=role.color;ctx.font='bold '+font+'px sans-serif';ctx.textAlign='center';ctx.fillText(role.label,e.x,e.y-height-4);if(e.ai==='bulwark'&&e.timer>1.6){ctx.strokeStyle=role.color;ctx.lineWidth=5;ctx.beginPath();ctx.arc(e.x,e.y-12,29,e.a-1,e.a+1);ctx.stroke();}ctx.restore();}
    if(e.phaseShield>0){ctx.strokeStyle='#ebcf9bbc';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(e.x,e.y-38,54,70,0,0,TAU);ctx.stroke();}
    if(e.elite&&!['marked','carrier','rune'].includes(e.mission))drawHealthBar(ctx,e.x-24,e.y-height+7,48,5,e.hp,e.maxHp);
    if(b.path===0&&e.focusHits>0&&e.focusUntil>seconds){ctx.save();ctx.strokeStyle='#c6f9e1';ctx.lineWidth=3/scale;ctx.beginPath();ctx.arc(e.x,e.y,e.r+10,-Math.PI/2,-Math.PI/2+TAU*e.focusHits/4);ctx.stroke();ctx.restore();}
    if(gnawSelected.has(e.id)){ctx.save();ctx.strokeStyle='#d5a5f2';ctx.lineWidth=Math.max(2,1.5/scale);ctx.setLineDash([5,4]);ctx.beginPath();ctx.ellipse(e.x,e.y+7,e.r+9,8,0,0,TAU);ctx.stroke();ctx.fillStyle='#e3b9fc';ctx.font='bold '+Math.max(12,10/scale)+'px sans-serif';ctx.textAlign='center';ctx.fillText(gnawSelected.get(e.id),e.x,e.y-height-20);ctx.restore();}
    if(e.gnawUntil>seconds){ctx.save();ctx.strokeStyle='#d5a5f2';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(e.x+18,e.y-height-8);ctx.lineTo(e.x+27,e.y-height-5);ctx.lineTo(e.x+25,e.y-height+3);ctx.lineTo(e.x+18,e.y-height+9);ctx.lineTo(e.x+13,e.y-height+3);ctx.stroke();ctx.beginPath();ctx.moveTo(e.x+20,e.y-height-5);ctx.lineTo(e.x+16,e.y-height);ctx.lineTo(e.x+21,e.y-height+2);ctx.stroke();ctx.fillStyle='#d5a5f2';ctx.fillRect(e.x+12,e.y-height+12,18*(e.gnaw/.12),3);ctx.restore();}
    if(e.stun>0&&e.mission!=='rune'){ctx.save();ctx.strokeStyle='#fff1ac';ctx.lineWidth=2;for(const off of [-10,10]){ctx.beginPath();ctx.moveTo(e.x+off,e.y-height-17);ctx.lineTo(e.x+off+4,e.y-height-11);ctx.lineTo(e.x+off,e.y-height-5);ctx.lineTo(e.x+off-4,e.y-height-11);ctx.closePath();ctx.stroke();}ctx.restore();}
    if(e.slow>0){ctx.save();ctx.strokeStyle='#8bdbff';ctx.lineWidth=2;for(const off of [0,6]){ctx.beginPath();ctx.ellipse(e.x,e.y+7+off,e.r+7,5,0,.1,Math.PI-.1);ctx.stroke();}ctx.restore();}
    if(e.mark){ctx.fillStyle='#f0d48f';ctx.fillRect(e.x-2,e.y-height-3,4,7);}
    if(e.burn>0){ctx.fillStyle='#ffaf69';ctx.fillRect(e.x-12,e.y-8,3,6);ctx.fillRect(e.x+9,e.y-13,3,9);}
    if(e.charge>0){ctx.save();ctx.strokeStyle='#ffb08c';ctx.lineWidth=e.boss?12:5;ctx.globalAlpha=.55;ctx.setLineDash([10,6]);ctx.beginPath();ctx.moveTo(e.x,e.y);const a=e.chargeA??e.shotAngle??e.a;const rays=e.ai==='fanbow'?[-.28,0,.28]:[0];if(role)ctx.strokeStyle=role.color;for(const offset of rays){ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(a+offset)*450,e.y+Math.sin(a+offset)*450);}ctx.stroke();ctx.restore();}
   }
   for(const [puppetIndex,a] of b.puppets.entries()){ctx.save();ctx.fillStyle='#5acfee44';ctx.strokeStyle='#8eeaff';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(a.x,a.y+10,23,9,0,0,TAU);ctx.fill();ctx.stroke();sprite(ctx,this.art.foes[10],a.x,a.y+10,42,1);ctx.strokeStyle='#8eeaff';ctx.beginPath();ctx.moveTo(a.x-21,a.y-21);ctx.lineTo(a.x-21,a.y-35);ctx.lineTo(a.x-10,a.y-35);ctx.moveTo(a.x+21,a.y-21);ctx.lineTo(a.x+21,a.y-35);ctx.lineTo(a.x+10,a.y-35);ctx.stroke();ctx.fillStyle='#092b3a';ctx.fillRect(a.x-11,a.y-55,22,18);ctx.fillStyle='#a9eeff';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('友',a.x,a.y-41);ctx.font='bold '+Math.max(12,10/scale)+'px sans-serif';ctx.fillText(String(puppetIndex+1)+'号',a.x,a.y+24);ctx.restore();}
   for(const bug of b.insects)sprite(ctx,this.art.golden,bug.x,bug.y+7,22,1);
   for(const shot of b.shots){ctx.strokeStyle=shot.color||(shot.friendly?'#bfd3e5':'#e28d72');ctx.lineWidth=shot.friendly?3:5;ctx.beginPath();ctx.moveTo(shot.px,shot.py);ctx.lineTo(shot.x,shot.y);ctx.stroke();ctx.fillStyle='#f1e2c4';ctx.fillRect(shot.x-2,shot.y-2,4,4);}
   for(const f of b.fx)if(f.kind==='afterimage')sprite(ctx,this.art.heroes[0],f.x,f.y+8,58,f.ttl/f.max*.25);
  }
  ctx.fillStyle='#00000060';ctx.beginPath();ctx.ellipse(p.x,p.y+4,18,7,0,0,TAU);ctx.fill();
  if(b?.player.shield>0){ctx.strokeStyle='#9bbceb70';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y-20,29,39,0,0,TAU);ctx.stroke();}
  let frame=0;if(p.moving){frame=Math.abs(p.dx)>.45?(p.dx<0?2:3):p.dy<0?1:4+Math.floor(seconds*8)%2;}if(b&&seconds-b.thunderTime<.5)frame=6;
  ctx.save();if(b){ctx.shadowColor=p.hp/p.maxHp<.3?'#ffd0b0':'#c9fff0';ctx.shadowBlur=5;}
  sprite(ctx,this.art.heroes[frame],p.x,p.y+9+(p.moving?Math.sin(seconds*15)*1.8:0),b?60:175,p.invuln>0&&Math.floor(seconds*15)%2===0?.55:1);
  ctx.restore();
  ctx.strokeStyle='#c8e5cd70';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x,p.y+9,14,4,0,0,TAU);ctx.stroke();
  const swords=b?.swords||Array.from({length:18},(_,i)=>{const a=i*TAU/18+seconds*.24;return {x:955+Math.cos(a)*145,y:488+Math.sin(a)*110,a:a+Math.PI/2,px:955+Math.cos(a-.1)*145,py:488+Math.sin(a-.1)*110};});
  for(let i=0;i<swords.length;i++){const s=swords[i];if(afterThunder){ctx.save();ctx.strokeStyle='#91d9ffba';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(s.px,s.py);ctx.lineTo(s.x,s.y);ctx.stroke();ctx.fillStyle='#c5efff';ctx.fillRect(s.x-2,s.y-2,4,4);ctx.restore();}if(settings.quality!==0&&(i%2===0||swords.length<24)){ctx.strokeStyle=b?.stats.metaSwordPierce&&i%3===2?'#eadd9ca0':'#9ddba744';ctx.lineWidth=b?.stats.metaSwordPierce&&i%3===2?3:2;ctx.beginPath();ctx.moveTo(s.px,s.py);ctx.lineTo(s.x,s.y);ctx.stroke();}
   ctx.save();ctx.translate(s.x,s.y);ctx.rotate(s.a+Math.PI/2);const img=this.art.heroes[7],height=b?28:34,width=height*img.width/img.height;ctx.drawImage(img,-width/2,-height/2,width,height);ctx.restore();
  }
  if(b?.input.focus&&b.input.aim){const a=b.input.aim,r=16/scale,arm=22/scale;ctx.strokeStyle='#f1e5b5';ctx.lineWidth=2/scale;ctx.beginPath();ctx.arc(a.x,a.y,r,0,TAU);ctx.stroke();ctx.beginPath();ctx.moveTo(a.x-arm,a.y);ctx.lineTo(a.x+arm,a.y);ctx.moveTo(a.x,a.y-arm);ctx.lineTo(a.x,a.y+arm);ctx.stroke();}
  if(b)for(const f of b.fx){
   const alpha=Math.max(0,f.ttl/f.max);ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=f.color||'#f4daa0';ctx.fillStyle=f.color||'#e5d4a3';
   if(f.kind==='ring'){ctx.lineWidth=2;ctx.beginPath();ctx.arc(f.x,f.y,f.r*(1-alpha*.6),0,TAU);ctx.stroke();}
   if(f.kind==='incoming'){ctx.translate(f.x,f.y-12);ctx.rotate(f.angle);ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(43,-9);ctx.lineTo(34,0);ctx.lineTo(43,9);ctx.stroke();}
   if(f.kind==='practice-warning'){const p=b.player,progress=1-alpha;ctx.globalAlpha=.55+progress*.45;ctx.strokeStyle='#ffb39c';ctx.lineWidth=3;ctx.setLineDash([9,6]);ctx.beginPath();ctx.moveTo(f.fromX,f.fromY);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,110-progress*70,0,TAU);ctx.stroke();ctx.fillStyle='#ffd7c4';ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.fillText('来袭 '+Math.max(0,f.ttl).toFixed(1)+' 秒',p.x,p.y-52);}
   if(f.kind==='sigilBurst'){ctx.lineWidth=4;ctx.setLineDash([12,7]);ctx.beginPath();ctx.arc(f.x,f.y,f.r*(1.1-alpha*.35),0,TAU);ctx.stroke();for(let i=0;i<8;i++){const a=i*TAU/8;ctx.fillRect(f.x+Math.cos(a)*f.r*(1-alpha*.5)-3,f.y+Math.sin(a)*f.r*(1-alpha*.5)-3,6,6);}}
   if(f.kind==='number'){ctx.font=f.key?'bold '+Math.max(17,12/scale)+'px sans-serif':'bold '+Math.max(13,11/scale)+'px monospace';ctx.textAlign='center';ctx.fillText(f.text,f.x,f.y-(1-alpha)*22);}
   if(f.kind==='line'){ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.tx,f.ty);ctx.stroke();}
   if(f.kind==='bolt'){const r=seeded(Math.floor((f.seed||.4)*999999));ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(f.x,f.y-210);for(let j=1;j<8;j++)ctx.lineTo(f.x+(r()-.5)*28,f.y-210+j*30);ctx.stroke();}
   if(f.kind==='thunder'){ctx.lineWidth=4;ctx.strokeStyle='#f2dba6';ctx.beginPath();ctx.arc(f.x,f.y,(1-alpha)*900,0,TAU);ctx.stroke();}
   ctx.restore();
  }
  ctx.restore();
  const vignette=ctx.createRadialGradient(w/2,h/2,h*.2,w/2,h/2,w*.65);vignette.addColorStop(0,'#030c1000');vignette.addColorStop(1,b?'#030c1099':'#030c1044');ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
  if(b){
   const x=Math.max(24,Math.min(w-24,ox+p.x*scale+sx)),y=Math.max(view.top+8,Math.min(view.bottom-9,oy+p.y*scale+sy+12)),low=p.hp/p.maxHp<.3;
   ctx.save();ctx.fillStyle='#051a19';ctx.fillRect(x-22,y-1,44,7);drawHealthBar(ctx,x-20,y,40,4,p.hp,p.maxHp,low?'#ff9b78':'#b1f1c9');
   ctx.strokeStyle=p.dashCD>0?'#8298a3':'#d8fff0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-12,8,-Math.PI/2,p.dashCD>0?Math.PI/2:Math.PI*1.5);ctx.stroke();if(low){ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillStyle='#ffd4bf';ctx.fillText('!',x+29,y+4);}ctx.restore();
   if(b.practice?.goal){const g=b.practice.goal;ctx.save();ctx.strokeStyle='#a5f5d3';ctx.lineWidth=3;ctx.beginPath();ctx.arc(ox+g.x*scale,oy+g.y*scale,g.r*scale,0,TAU);ctx.stroke();ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.fillStyle='#e1ffee';ctx.fillText('移动到这里',ox+g.x*scale,oy+g.y*scale-10);ctx.restore();}
  }
  this.bossDirection=b?offscreenDirection(this.camera,b.boss?.hp>0?b.boss:null,this.hudAvoid||[]):null;
  if(this.bossDirection){const m=this.bossDirection;ctx.save();ctx.translate(m.x,m.y);ctx.fillStyle='#10221fee';ctx.beginPath();ctx.arc(0,0,21,0,TAU);ctx.fill();ctx.strokeStyle='#f0ce92';ctx.lineWidth=2;ctx.stroke();ctx.rotate(m.angle);ctx.fillStyle='#f0ce92';ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-6,-8);ctx.lineTo(-6,8);ctx.closePath();ctx.fill();ctx.restore();ctx.save();ctx.font='bold 12px sans-serif';const labelLeft=m.x>(this.camera.left+this.camera.right)/2;ctx.textAlign=labelLeft?'right':'left';ctx.fillStyle='#10221fee';ctx.fillRect(m.x+(labelLeft?-58:26),m.y-10,32,20);ctx.fillStyle='#ffe3ac';ctx.fillText('首领',m.x+(labelLeft?-29:29),m.y+4);ctx.restore();}
  this.drawBossDefeat();
  if(b&&settings.flash&&b.time-b.thunderTime<.12){ctx.fillStyle='#f7e9b82a';ctx.fillRect(0,0,w,h);}
 }
}
