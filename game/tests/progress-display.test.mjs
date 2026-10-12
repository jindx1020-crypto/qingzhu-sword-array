/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from '../gameplay/run-factory.js';
import {TRAITS} from '../gameplay/data.js';
import {xpCostFor,goalTimeLimits} from '../gameplay/growth-rules.js';
import {growthGuidance} from '../gameplay/player-guidance.js';
import {cultivationProgress,bossHealthReadout,placeObjectiveLabel} from '../gameplay/progress-display.js';
import {battleCamera} from '../gameplay/camera.js';
import {Renderer} from '../gameplay/art.js';
const run=(options={})=>createRun({seed:'progress-display',runId:'progress-display',...options});
const copy=structuredClone;
const freeze=(v,seen=new WeakSet())=>{if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);Object.values(v).forEach(x=>freeze(x,seen));Object.freeze(v);};
void test('T28 the displayed XP distance reaches the real next four-level choice under every saved growth/rules branch',()=>{
 for(const rulesVersion of [1,2,3])for(const growthVersion of [1,2,3,4,5])for(const level of [72,75,83,159]){
  const b=run({rulesVersion,growthVersion});b.level=level;b.swords=[];b.syncSwords();b.xp=xpCostFor(b,level)*.25;b.queuedChoices=0;
  const before=JSON.stringify(b.serialize()),p=cultivationProgress(b);assert.equal(JSON.stringify(b.serialize()),before);assert.equal(p.nextLevel,Math.min(160,(Math.floor(level/4)+1)*4));assert.ok(p.xpNeeded>0&&p.progress>0&&p.progress<1);
  b.addXP(p.xpNeeded);assert.equal(b.level,p.nextLevel);assert.equal(b.xp,0);assert.equal(b.queuedChoices,1);assert.equal(b.swords.length,72,'post-cap growth never adds a 73rd sword');assert.match(cultivationProgress(b).label,/待悟道 1 次/);
 }
});
void test('T28 queued choices and the level160 ceiling take precedence over a future promise',()=>{
 const b=run();b.level=160;b.swords=[];b.syncSwords();b.xp=1e6;b.queuedChoices=2;
 let p=cultivationProgress(b);assert.equal(p.capped,true);assert.equal(p.nextLevel,null);assert.equal(p.xpNeeded,null);assert.equal(p.progress,null);assert.match(p.label,/待悟道 2 次/);assert.doesNotMatch(p.detail,/164/);
 b.queuedChoices=0;p=cultivationProgress(b);assert.match(p.label,/160.*上限/);const before=b.queuedChoices;b.addXP(100000);assert.equal(b.level,160);assert.equal(b.queuedChoices,before);
 for(const t of TRAITS)b.traits[t.id]=t.max;b.recalc();b.queuedChoices=3;p=cultivationProgress(b);assert.equal(p.eligible,false);assert.match(p.label,/待悟道 3 次.*无可用强化/);assert.match(p.detail,/不承诺出现候选/);
 b.openChoices();assert.equal(b.queuedChoices,0);assert.equal(b.modeState,'battle');assert.match(cultivationProgress(b).label,/上限/);
});
void test('T28 empty pools are detected without drawing, and tiny remaining XP is not displayed as zero',()=>{
 for(const rulesVersion of [1,3]){const b=run({rulesVersion});b.level=83;for(const t of TRAITS)b.traits[t.id]=t.max;b.recalc();b.traitChoices=()=>assert.fail('display must not draw choices');b.queuedChoices=2;assert.match(cultivationProgress(b).label,/当前无可用强化/);b.queuedChoices=0;assert.match(cultivationProgress(b).label,/当前可用强化已修满/);}
 const b=run();b.level=83;b.xp=xpCostFor(b,83)-.001;assert.match(cultivationProgress(b).detail,/还需 不足 0.1 经验/);
});
void test('T27 deadlines describe performance XP only, retain exact inclusive limits and omit the window for old growth',()=>{
 for(const growthVersion of [1,2,3,4,5]){
  const b=run({growthVersion});for(let chapter=0;chapter<6;chapter++)for(let wave=0;wave<b.routes[chapter].length;wave++){
   b.chapter=chapter;b.wave=wave;b.node.selected??=0;b.beginNode();const limit=goalTimeLimits[b.encounter.kind];b.waveTime=limit;const before=JSON.stringify(b.serialize()),at=growthGuidance(b);
   if(growthVersion>=4){assert.match(at.detail,new RegExp('表现经验判定期限 '+limit+' 秒'));assert.match(at.detail,/剩余 0 秒/);assert.match(at.detail,/不是通关等待时间或失败倒计时/);b.waveTime=limit+.001;assert.match(growthGuidance(b).detail,/表现期限已过/);b.waveTime=limit;}
   else if(at)assert.doesNotMatch(at.detail,/判定期限|失败倒计时/);
   assert.equal(JSON.stringify(b.serialize()),before);
  }
 }
});
void test('T27 boss HP is distinct from objective bars and terminal survival, including near-zero and near-full values',()=>{
 const b={boss:{hp:66,maxHp:100,phaseShield:2},bossEnding:0};assert.deepEqual(bossHealthReadout(b),{percent:66,label:'生命 66%',hp:66,maxHp:100});
 for(const type of ['swarm','seal'])assert.equal(bossHealthReadout({...b,boss:{...b.boss,type}}),null);
 assert.equal(bossHealthReadout({...b,bossEnding:.1}),null);assert.equal(bossHealthReadout({boss:null}),null);assert.equal(bossHealthReadout({boss:{hp:20,maxHp:0}}),null);
 b.boss.hp=.0001;assert.match(bossHealthReadout(b).label,/不足 0.1%/);b.boss.hp=99.999;assert.match(bossHealthReadout(b).label,/高于 99.9%/);b.boss.hp=100;assert.equal(bossHealthReadout(b).label,'生命 100%');b.boss.hp=0;assert.equal(bossHealthReadout(b).label,'生命 0%');
});
const intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
void test('T27 gate labels avoid the HUD and one another in narrow, short and desktop projections without moving the view',()=>{
 for(const [w,h,top,bottom,left] of [[320,568,149,139,0],[568,320,108,72,0],[1024,768,100,160,208]])for(const player of [{x:320,y:300},{x:640,y:560},{x:960,y:260}]){
  const camera=battleCamera(w,h,player,{top,bottom,left}),original=copy(camera);freeze(camera);
  const occupied=[{left:camera.left,right:camera.left+80,top:camera.top,bottom:camera.top+24}];
  for(const [i,x] of [320,640,960].entries()){
   const label=placeObjectiveLabel(camera,{x,y:147},{width:i===1?120:64,height:20},occupied);
   assert.ok(label.left>=camera.left&&label.right<=camera.right&&label.top>=camera.top&&label.bottom<=camera.bottom);assert.equal(label.occluded,false,JSON.stringify({w,h,player,label}));assert.ok(occupied.every(r=>!intersects(label,r)));occupied.push(label);
  }
  assert.deepEqual(camera,original);
 }
});
void test('T27 placement is bounded when an overlay covers the entire available band',()=>{
 const camera={x:0,y:0,scale:1,left:0,right:40,top:0,bottom:32},label=placeObjectiveLabel(camera,{x:10,y:-500},{width:200,height:20},[{left:0,right:40,top:0,bottom:32}]);assert.equal(label.occluded,true);assert.ok(label.left>=0&&label.right<=40&&label.top>=0&&label.bottom<=32);
});
void test('T27 actual objective drawing retains gate circles/open-state text while placing text inside the existing camera safe band',()=>{
 const arcs=[],rects=[],texts=[],stack=[],camera=battleCamera(568,320,{x:640,y:560},{top:108,bottom:72}),ctx={font:'',save(){stack.push({font:this.font,lineWidth:this.lineWidth});},restore(){Object.assign(this,stack.pop());},beginPath(){},stroke(){},moveTo(){},lineTo(){},arc(...v){arcs.push(v);},measureText(text){return {width:text.length*parseFloat(this.font.replace('bold ',''))*.8};},fillRect(x,y,w,h){rects.push({left:camera.x+x*camera.scale,right:camera.x+(x+w)*camera.scale,top:camera.y+y*camera.scale,bottom:camera.y+(y+h)*camera.scale});},fillText(text,x,y){texts.push({text,x:camera.x+x*camera.scale,y:camera.y+y*camera.scale});}};
 const q={kind:'illusion',gates:[{x:320,y:250},{x:640,y:250},{x:960,y:250}],trueGate:1,next:7},b={objective:q,waveTime:0,rng:()=>assert.fail('drawing may not draw battle RNG')},before=JSON.stringify(b);freeze(b);
 Renderer.prototype.drawObjective.call({ctx,camera,art:{props:[]},hudAvoid:[]},b,0);
 assert.equal(JSON.stringify(b),before);assert.deepEqual(arcs.map(a=>a.slice(0,3)),[[320,250,72],[640,250,72],[640,250,79],[960,250,72]]);assert.ok(texts.some(t=>t.text==='真 · 7秒后通行'));assert.equal(texts.filter(t=>t.text==='幻 · 勿入').length,2);assert.ok(rects.every(r=>r.left>=camera.left&&r.right<=camera.right&&r.top>=camera.top&&r.bottom<=camera.bottom));
 texts.length=0;Renderer.prototype.drawObjective.call({ctx,camera,art:{props:[]},hudAvoid:[]},{...b,waveTime:7},7);assert.ok(texts.some(t=>t.text==='真 · 可通行'));
});
void test('T27/T28 status reads tolerate a frozen real run and preserve complete snapshots and both random streams',()=>{
 const b=run();b.beginNode();b.level=83;b.swords=[];b.syncSwords();b.xp=32;b.waveTime=30;
 const before=JSON.stringify(b.serialize()),rng=b.rng.state(),content=b.contentRng.state(),fail=()=>assert.fail('pure display attempted a live action');
 b.rng=Object.assign(()=>fail(),{state:()=>rng});b.contentRng=Object.assign(()=>fail(),{state:()=>content});for(const key of ['traitChoices','addXP','recalc','emit','hit'])b[key]=fail;freeze(b);
 for(let i=0;i<5;i++){cultivationProgress(b);bossHealthReadout(b);growthGuidance(b);}assert.equal(JSON.stringify(b.serialize()),before);
});
