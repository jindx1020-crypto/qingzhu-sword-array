/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Expedition} from '../gameplay/expedition.js';
import {clearDashInput} from '../gameplay/battle-input.js';
import {clearTouchLock,setTouchAim,updateTouchLock,touchLockRange} from '../gameplay/touch-controls.js';
import {currentAimState,aimReleaseInfo} from '../gameplay/input-status.js';
import {revisedGrowth} from '../gameplay/growth-rules.js';
const copy=structuredClone;
function arena(options={}){const b=new Expedition({seed:'touch-status-parity',runId:'touch-status-parity',segmentVersion:0,recordVersion:0,challengeVersion:0,...((options.focusVersion??3)===3?{touchLockEnabled:true}:{}),...options});b.beginNode();b.clearField();return b;}
function foe(b,extra={}){const e=b.spawn(4,{x:b.player.x+220,y:b.player.y,hp:100000,speed:0,spawn:0,...extra});b.rebuildHash();return e;}
// Frozen pre-T22 implementations. Exact persisted snapshots are compared separately from the
// intentionally changed cue text and the new WeakMap-only UI observations.
const oldSupported=b=>b.rulesVersion===3&&b.options.focusVersion===3;
const oldAvailable=b=>oldSupported(b)&&b.options.touchLockEnabled===true;
const oldRange=b=>!b.swords.length?0:b.formation===1?(180+Math.floor((b.swords.length-1)/18)*24)*(b.orbitMultiplier?.()??1):320*(1+(b.stats.range||0));
const oldLegal=(b,e)=>!!e&&e.hp>0&&!e.untargetable&&!(e.phaseShield>0)&&!(e.bossType==='xuangu'&&b.bossEnding>0)&&Math.hypot(e.x-b.player.x,e.y-b.player.y)<oldRange(b);
function oldClear(b,clearPoint=false){b.touchLockId=null;if(b.combatCues)b.combatCues=b.combatCues.filter(c=>!['touch-lock','touch-lock-release'].includes(c.key));if(clearPoint&&b.input){b.input.aim=null;b.input.focus=false;b.input.touchAim=false;}}
function oldAim(b,point,{allowLock=true,scale=1}={}){
 if(b.modeState!=='battle'||!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;
 b.input.aim={x:point.x,y:point.y};b.input.focus=true;b.input.touchAim=true;oldClear(b);
 if(allowLock&&oldAvailable(b)){const hit=b.enemies.filter(e=>oldLegal(b,e)&&Math.hypot(e.x-point.x,e.y-point.y)<=Math.max(e.r+8,18/Math.max(.1,scale))).sort((a,z)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(z.x-point.x,z.y-point.y)||a.id-z.id)[0];if(hit){b.touchLockId=hit.id;b.options.touchLockUsed=true;b.input.aim={x:hit.x,y:hit.y};b.cue('touch-lock','锁定 '+hit.name+' · 解除键可取消','#c9e8bd',2);}}
 return true;
}
function oldUpdate(b){if(b.touchLockId==null)return;const e=b.enemies.find(e=>e.id===b.touchLockId);if(!oldAvailable(b)||b.modeState!=='battle'){oldClear(b,true);return;}if(!oldLegal(b,e)){oldClear(b);b.cue('touch-lock-release','目标已失效或离开射程 · 已退回定点瞄准','#e3d2ab',2);return;}b.input.aim={x:e.x,y:e.y};b.input.focus=true;b.input.touchAim=true;}
function same(a,z){
 // The frozen methods predate optional chapter observations; compare every pre-existing saved field.
 const existing=b=>{const snapshot=b.serialize();delete snapshot.chapterStats;return JSON.stringify(snapshot);};
 assert.equal(existing(a),existing(z),'pre-existing saved snapshot, rule markers and both RNG states stay identical');
 assert.deepEqual(a.input,z.input);assert.deepEqual([a.dashIntent,a.dashFeedback],[z.dashIntent,z.dashFeedback]);
 assert.deepEqual(a.combatCues.map(({text:_text,...c})=>c),z.combatCues.map(({text:_text,...c})=>c),'cue keys, colours, lifetimes and throttling unchanged');assert.deepEqual(a.cueTimers,z.cueTimers);
}
const releases=[
 ['target-missing',(b,e)=>b.enemies.splice(b.enemies.indexOf(e),1)],
 ['target-dead',(_b,e)=>e.hp=0],
 ['target-untargetable',(_b,e)=>e.untargetable=true],
 ['target-protected',(_b,e)=>e.phaseShield=.8],
 ['target-ending',(b,e)=>{e.bossType='xuangu';b.bossEnding=13;}],
 ['target-range',(b,e)=>e.x=b.player.x+touchLockRange(b)]
];
void test('T22 actual invalidation reasons preserve the old predicate, fixed fallback, full snapshots and RNG',()=>{
 for(const [reason,mutate] of releases)for(const formation of [0,1,2]){
  const a=arena(),z=arena();for(const b of [a,z]){b.formation=formation;b.level=72;b.swords=[];b.syncSwords();}
  const ea=foe(a),ez=foe(z);foe(a,{x:850,name:'不要转锁的目标'});foe(z,{x:850,name:'不要转锁的目标'});
  assert.equal(setTouchAim(a,ea),oldAim(z,ez));same(a,z);const point=copy(a.input.aim);
  mutate(a,ea);mutate(z,ez);updateTouchLock(a);oldUpdate(z);same(a,z);
  assert.equal(aimReleaseInfo(a).reason,reason);assert.deepEqual(a.input.aim,point);assert.equal(currentAimState(a).mode,'fixed');
  assert.equal(a.options.touchLockUsed,true);const release=aimReleaseInfo(a);updateTouchLock(a);oldUpdate(z);same(a,z);assert.deepEqual(aimReleaseInfo(a),release,'no repeated release without a current lock');
 }
});
void test('T22 validation short-circuit and orbit-range method call count remain the original ones',()=>{
 for(const [reason,mutate] of releases){const a=arena(),z=arena(),calls=[0,0];for(const [i,b] of [a,z].entries()){b.formation=1;b.level=72;b.swords=[];b.syncSwords();b.orbitMultiplier=()=>{calls[i]++;return 1;};}
  const ea=foe(a),ez=foe(z);setTouchAim(a,ea);oldAim(z,ez);mutate(a,ea);mutate(z,ez);calls.fill(0);updateTouchLock(a);oldUpdate(z);
  assert.deepEqual(calls,reason==='target-range'?[1,1]:[0,0]);same(a,z);
 }
});
void test('T22 drag and point-change reasons come from real input routes and do not reset the historical flag',()=>{
 for(const allowLock of [false,true]){const a=arena(),z=arena(),ea=foe(a),ez=foe(z);setTouchAim(a,ea);oldAim(z,ez);setTouchAim(a,{x:300,y:300},{allowLock});oldAim(z,{x:300,y:300},{allowLock});same(a,z);assert.equal(aimReleaseInfo(a).reason,allowLock?'point-change':'drag');assert.equal(currentAimState(a).mode,'fixed');assert.equal(currentAimState(a).everEnabled,true);setTouchAim(a,ea);oldAim(z,ez);same(a,z);assert.equal(aimReleaseInfo(a),null,'a new lock does not display a stale reason');}
});
void test('T22 disabled locking, explicit clears and duplicate cleanup preserve sticky history and never guess a cause',()=>{
 const a=arena(),z=arena(),ea=foe(a),ez=foe(z);setTouchAim(a,ea);oldAim(z,ez);a.options.touchLockEnabled=z.options.touchLockEnabled=false;updateTouchLock(a);oldUpdate(z);same(a,z);
 assert.equal(currentAimState(a).enabled,false);assert.equal(currentAimState(a).everEnabled,true);assert.equal(aimReleaseInfo(a).reason,'lock-disabled');
 const event=aimReleaseInfo(a);clearTouchLock(a,true,'pause');oldClear(z,true);same(a,z);assert.deepEqual(aimReleaseInfo(a),event,'empty duplicate cleanup cannot replace the actual cause');
 setTouchAim(a,{x:500,y:400});oldAim(z,{x:500,y:400});clearTouchLock(a,true,'manual');oldClear(z,true);same(a,z);assert.equal(aimReleaseInfo(a).reason,'manual');assert.equal(aimReleaseInfo(a).from,'fixed');
 setTouchAim(a,{x:500,y:400});oldAim(z,{x:500,y:400});clearTouchLock(a,true);oldClear(z,true);same(a,z);assert.equal(aimReleaseInfo(a).reason,'input-cleared');
});
void test('T22 focus1/2 keep point aiming without lock support, history markers or schema additions',()=>{
 for(const focusVersion of [1,2]){const a=arena({focusVersion,settings:{touchLock:true}}),z=arena({focusVersion,settings:{touchLock:true}}),ea=foe(a),ez=foe(z);setTouchAim(a,ea);oldAim(z,ez);same(a,z);const state=currentAimState(a);assert.equal(state.mode,'fixed');assert.equal(state.supported,false);assert.equal(state.enabled,null);assert.equal(state.everEnabled,null);assert.equal(a.options.touchLockUsed,undefined);assert.equal(a.serialize().expedition.touchLockId,undefined);setTouchAim(a,{x:450,y:400},{allowLock:false});oldAim(z,{x:450,y:400},{allowLock:false});same(a,z);assert.equal(aimReleaseInfo(a),null,'dragging an unlocked point is not a fabricated lock-release');}
});
void test('T22 mouse wording follows the original directFocus gate without changing input',()=>{
 for(const rulesVersion of [1,2,3])for(const focusVersion of [1,2,3]){const b={rulesVersion,options:{focusVersion},enemies:[],input:{focus:true,touchAim:false,aim:{x:2,y:3}}},before=JSON.stringify(b);assert.match(currentAimState(b).label,rulesVersion===3&&focusVersion>=2?/鼠标集火/:/鼠标指引.*按本局剑式分配/);assert.equal(JSON.stringify(b),before);}
});
void test('T22 pause and clearDashInput wrappers preserve old cleanup order, scene behavior, buffered input and snapshots',()=>{
 for(const focusVersion of [1,2,3])for(const reason of [undefined,'help','settings','confirm','details','blur'])for(const action of ['pause','clearDashInput']){
  const a=arena({focusVersion}),z=arena({focusVersion}),ea=foe(a),ez=foe(z);setTouchAim(a,ea);oldAim(z,ez);for(const b of [a,z]){b.dashIntent={until:b.time+.12,readyAt:b.time+.05};b.dashFeedback={kind:'buffer',until:b.time+.25};}
  a[action](reason);clearDashInput(z);oldClear(z,true);if(action==='pause'&&z.modeState==='battle'){z.modeState='pause';z.scene='pause';z.emit({type:'scene',scene:'pause'});}same(a,z);
  assert.equal(aimReleaseInfo(a).reason,reason??(action==='pause'?'pause':'input-cleared'));assert.equal(a.dashIntent,null);assert.equal(a.dashFeedback,null);
 }
});
void test('T22 choice and finish differ from the frozen old methods only in transient reason text',()=>{
 for(const action of ['choice','finish']){const a=arena(),z=arena(),ea=foe(a),ez=foe(z);setTouchAim(a,ea);oldAim(z,ez);
  if(action==='choice'){a.openChoices();clearDashInput(z);oldClear(z,true);z.modeState='choice';z.scene='choice';z.choices=z.traitChoices();z.emit({type:'scene',scene:'choice'});if(revisedGrowth(z)){z.growth.firstOfferUsed=true;if(!z.choices.length)z.finishEmptyChoices();}z.checkpoint();}
  else {a.finish(false,'测试');oldClear(z,true);z.finished=true;z.modeState='result';z.scene='result';z.won=false;z.failureReason='测试';z.emit({type:'finish',won:false,summary:z.summary()});}
  same(a,z);assert.equal(aimReleaseInfo(a).reason,action);
 }
});
void test('T22 observations never enter saves; restore and pure display reads cannot fabricate history or target changes',()=>{
 const a=arena(),e=foe(a);setTouchAim(a,e);a.pause();assert.equal(aimReleaseInfo(a).reason,'pause');const snapshot=copy(a.serialize()),r=Expedition.restore(snapshot);assert.equal(aimReleaseInfo(r),null);assert.equal(r.options.touchLockUsed,true);
 const before=JSON.stringify(r.serialize()),input=copy(r.input),rng=r.rng.state(),content=r.contentRng.state();const fail=()=>{throw Error('display called a battle operation');};for(const name of ['rng','contentRng','orbitMultiplier','cue','hit','updateSwords'])r[name]=name==='rng'?Object.assign(()=>fail(),{state:()=>rng}):name==='contentRng'?Object.assign(()=>fail(),{state:()=>content}):fail;
 for(let i=0;i<5;i++){const state=currentAimState(r);state.point={x:0,y:0};state.release={reason:'fabricated'};}
 assert.deepEqual(r.input,input);assert.equal(JSON.stringify(r.serialize()),before);assert.equal(aimReleaseInfo(r),null);
 const event=aimReleaseInfo(a);event.reason='fabricated';assert.equal(aimReleaseInfo(a).reason,'pause','consumers receive copies, not the WeakMap record');
});
