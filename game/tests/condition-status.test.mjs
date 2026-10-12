/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun} from '../gameplay/run-factory.js';
import {conditionRows,coreStatus,dashSigilStatus,thunderCondition,thunderTargetPreview} from '../gameplay/condition-status.js';
import {sigilCooldown,sigilPairFuse} from '../gameplay/balance.js';
const run=(options={})=>{const b=createRun({seed:'condition-status',...options});if(b.isExpedition)b.beginNode();else b.start();b.clearField?.();b.modeState='battle';b.scene=null;return b;};
const condition=(b,id)=>conditionRows(b).find(c=>c.id===id);

void test('condition display uses strict HP, mana and safe-regeneration boundaries across old and current rules',()=>{
 for(const rulesVersion of [1,2,3])for(const balanceVersion of [1,4]){
  const b=run({rulesVersion,balanceVersion,path:0});Object.assign(b.stats,{safeMana:.35,fullMana:.18,lowDamage:.3,healthyDamage:.2});b.time=10;b.player.maxHp=100;
  for(const [hp,low,healthy] of [[34.999,true,false],[35,false,false],[70,false,false],[70.001,false,true]]){
   b.player.hp=hp;assert.equal(condition(b,'lowDamage').active,low);assert.equal(condition(b,'healthyDamage').active,healthy);
  }
  b.player.mana=99.9;assert.equal(thunderCondition(b).ready,true);assert.equal(condition(b,'fullMana').active,false);
  b.player.mana=100;assert.equal(condition(b,'fullMana').active,true);
  b.player.lastHit=4;assert.equal(condition(b,'safeMana').active,false);b.player.lastHit=3.999;assert.equal(condition(b,'safeMana').active,true);assert.match(condition(b,'safeMana').detail,/灵力已满/);
 }
});
void test('post-thunder and post-dash windows use their own exact duration and do not imply a permanent bonus',()=>{
 for(const balanceVersion of [1,2,3,4]){
  const b=run({path:1,balanceVersion});b.stats.afterThunder=.35;b.thunderTime=10;b.comboSet.add('swordGuard');b.comboSet.add('thunderPuppet');b.player.lastDash=10;
  const window=balanceVersion===4?7:5;b.time=10+window-.001;assert.equal(condition(b,'afterThunder').active,true);assert.match(condition(b,'afterThunder').detail,/\+60%/);
  b.time=10+window;assert.equal(condition(b,'afterThunder').active,false);
  b.time=13;assert.equal(condition(b,'swordGuard').active,false);b.time=12.999;assert.equal(condition(b,'swordGuard').active,true);
  b.time=16;assert.equal(condition(b,'thunderPuppet').active,false);b.time=15.999;assert.equal(condition(b,'thunderPuppet').active,true);
 }
 const old=run({rulesVersion:1,path:1});assert.equal(condition(old,'afterThunder'),undefined,'old thunder starter has no extra 25%');
});
void test('stationary and equipped core conditions distinguish live input, setup linger and permanent costs',()=>{
 for(const balanceVersion of [1,3,4]){
  const b=run({path:2,balanceVersion});b.stats.stationary=.35;b.player.moving=true;b.stillTime=0;b.time=5;b.setupUntil=5.2;
  assert.equal(condition(b,'stationary').active,balanceVersion>=3);
  b.relics=['K06'];assert.equal(condition(b,'stationary').active,false);assert.match(coreStatus(b,'K06'),/移动弩速 \+35% 生效/);
  b.player.moving=false;assert.equal(condition(b,'stationary').active,true);assert.match(coreStatus(b,'K06'),/未生效/);
  b.relics=['K02'];b.formation=2;assert.match(coreStatus(b,'K02'),/范围收益未生效.*−12%.*仍生效/);b.formation=1;assert.match(coreStatus(b,'K02'),/范围 \+40% 生效/);
  assert.equal(coreStatus(b,'K11'),null,'not equipped means no active core claim');
 }
 const b=run({path:3});b.relics=['K07'];b.stats.insects=3;b.insects=Array(7).fill({});assert.match(coreStatus(b,'K07'),/均未生效/);b.stats.insects=4;assert.match(coreStatus(b,'K07'),/−12% 生效/);
});
void test('formed thunder combos separate resource readiness from endless challenge permission',()=>{
 const b=run({path:1,mode:'endless',challengeVersion:2});b.comboSet.add('thunderFire');b.player.mana=100;b.player.reserve=0;
 assert.equal(condition(b,'thunderFire').active,false);assert.match(condition(b,'thunderFire').status,/联动已成型.*雷源不足/);
 b.player.reserve=100;b.challenges[0].choice='thunder';b.challenges[0].started=true;
 assert.equal(b.thunderReadiness().ready,true);assert.equal(thunderCondition(b).ready,false);assert.match(condition(b,'thunderFire').status,/挑战限制/);
 b.chapter=0;b.wave=3;b.beginNode();assert.equal(thunderCondition(b).ready,true,'entity boss remains permitted by the original challenge');
});
void test('K04 current aim preview matches actual pre-cast selection, preserves ties and does not hide protected targets',()=>{
 const b=run({path:1});b.relics=['K04'];b.player.mana=100;
 const first=b.spawn(4,{x:600,y:300,hp:100000,name:'前目标'}),second=b.spawn(4,{x:800,y:300,hp:100000,name:'后目标'});b.rebuildHash();
 b.input.aim={x:700,y:300};first.phaseShield=2;assert.equal(thunderTargetPreview(b).id,first.id);assert.match(coreStatus(b,'K04'),/前目标.*正处护势/);
 const before=b.enemies.map(e=>e.id);b.thunder();assert.equal(b.mainThunderTarget,first.id);assert.deepEqual(b.enemies.map(e=>e.id),before);
 b.input.aim={x:800,y:300};assert.equal(thunderTargetPreview(b).id,second.id,'previous mainThunderTarget is not reused');
 second.untargetable=true;assert.equal(thunderTargetPreview(b).id,first.id);first.hp=0;assert.equal(thunderTargetPreview(b),null);
});
void test('shield core states retain absorb threshold, strict shield conditions and independent cooldown',()=>{
 const b=run({path:5});b.relics=['K11'];b.time=20;b.lastShieldBreak=13;b.shieldAbsorbed=9.9;b.player.shield=3;
 assert.match(coreStatus(b,'K11'),/9.9 \/ 10.*冷却 1.0 秒.*仍须/);
 b.time=21;b.shieldAbsorbed=10;b.player.shield=0;assert.match(coreStatus(b,'K11'),/冷却已就绪.*须先获得护盾/);
 b.relics=['K12'];b.player.shield=4.99;assert.match(coreStatus(b,'K12'),/移速 \+12% 生效.*不足 5/);
 b.player.shield=5;assert.match(coreStatus(b,'K12'),/消耗 5 护盾/);b.player.shield=0;assert.match(coreStatus(b,'K12'),/移速收益未生效/);
});
void test('sigil status follows real dash and independent cooldowns across balance/cultivation versions, with no sigil on rules1',()=>{
 const old=run({rulesVersion:1,path:4});assert.equal(dashSigilStatus(old).enabled,false);
 for(const rulesVersion of [2,3])for(const balanceVersion of [1,2,3,4])for(const metaRulesVersion of [2,3]){
  const b=run({path:4,rulesVersion,balanceVersion,metaRulesVersion,meta:['talisman-meta-1']});b.dash();
  const state=dashSigilStatus(b);assert.equal(state.dashLeft,b.player.dashCD);assert.equal(state.sigilLeft,sigilCooldown(b));assert.equal(state.sigilReady,false);
  b.player.dashCD=0;assert.match(dashSigilStatus(b).dashLabel,/已就绪/);assert.match(dashSigilStatus(b).sigilLabel,/留符冷却/);
  b.time=b.lastSigil+sigilCooldown(b);b.player.dashCD=.5;assert.match(dashSigilStatus(b).sigilLabel,/等待闪避/);assert.equal(dashSigilStatus(b).nextLeft,.5);
 }
});
void test('K10 reads the existing first-sigil lifetime and then the real paired fuse, not a reconstructed eight-second timer',()=>{
 for(const balanceVersion of [1,4])for(const metaRulesVersion of [2,3]){
  const b=run({path:4,balanceVersion,metaRulesVersion,meta:['talisman-meta-1']});b.relics=['K10'];b.dash();
  const first=b.zones.find(z=>z.twin);assert.equal(dashSigilStatus(b).pendingLeft,8);assert.equal(dashSigilStatus(b).pairLeft,null);
  first.warn=6.18;first.fuseDuration=8;b.time=1.82;b.player.dashCD=.6;
  const state=dashSigilStatus(b);assert.equal(state.pendingLeft,6.18);assert.equal(state.sigilLeft,Math.max(0,sigilCooldown(b)-1.82));assert.match(state.pendingLabel,/6.2 秒/);
  b.time=sigilCooldown(b);b.player.dashCD=0;b.dash();assert.ok(first.pair);assert.equal(dashSigilStatus(b).pendingLeft,null);assert.equal(dashSigilStatus(b).pairLeft,sigilPairFuse(b));
  assert.match(coreStatus(b,'K10'),/同燃预警剩余/);assert.doesNotMatch(dashSigilStatus(b).pairLabel,/8.0/);
  first.fired=true;for(const z of b.zones)z.fired=true;assert.equal(dashSigilStatus(b).pairLeft,null);
 }
});
void test('all status helpers tolerate frozen run state and leave snapshots, RNG, caches, cues and metrics unchanged',()=>{
 for(const rulesVersion of [1,2,3]){
  const b=run({rulesVersion,path:4});if(b.isExpedition)b.relics=Array.from({length:12},(_,i)=>'K'+String(i+1).padStart(2,'0'));
  b.comboSet=new Set(['swordGuard','thunderPuppet','thunderFire','thunderInsect','thunderGuard']);Object.assign(b.stats,{safeMana:.35,fullMana:.18,lowDamage:.3,stationary:.35});
  const before=JSON.stringify(b.serialize()),rng=b.rng.state(),content=b.contentRng?.state(),aux=JSON.stringify([b.targetCache,b.combatCues,b.cueTimers,b.sigilStats]);
  const fail=()=>{throw Error('status attempted a live action');};for(const name of ['recalc','emit','hit','swordDamage','allyTarget','near','dash','thunder','cue'])b[name]=fail;
  b.rng=Object.assign(()=>fail(),{state:()=>rng});if(b.contentRng)b.contentRng=Object.assign(()=>fail(),{state:()=>content});
  const freeze=(v,seen=new WeakSet())=>{if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);Object.values(v).forEach(x=>freeze(x,seen));Object.freeze(v);};freeze(b);
  for(let i=0;i<3;i++){conditionRows(b);dashSigilStatus(b);thunderTargetPreview(b);for(const id of b.relics)coreStatus(b,id);}
  assert.equal(JSON.stringify(b.serialize()),before);assert.equal(JSON.stringify([b.targetCache,b.combatCues,b.cueTimers,b.sigilStats]),aux);assert.equal(b.rng.state(),rng);assert.equal(b.contentRng?.state(),content);
 }
});
