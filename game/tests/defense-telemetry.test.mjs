/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';import assert from 'node:assert/strict';
import {emptyDefenseStats,restoreDefenseStats,validateDefenseStats,recordDash,recordDeflection,recordCounter,recordShieldAbsorption,recordShieldRegen,recordShieldBreak,withDefenseDamage,observeDefenseDamage,recordDefenseTime,recordPuppetTime,recordPuppetShot,defenseReview} from '../gameplay/defense-telemetry.js';
import {restoreFeedback,validateFeedback} from '../gameplay/combat-feedback.js';
import {Battle} from '../gameplay/engine.js';
import {Expedition} from '../gameplay/expedition.js';
import {initialSave} from '../gameplay/data.js';
import {normalizeSave,SaveVault,SAVE_KEY,recoveryPreview} from '../gameplay/save-store.js';
import {settleRunResult} from '../gameplay/records.js';
import {studyOptions,observationPacket,restoreStudyPacket} from '../gameplay/observation.js';
const copy=structuredClone;
const run=(fromTime=0,complete=true)=>({time:fromTime,player:{lastDash:-100},defenseStats:emptyDefenseStats(fromTime,complete)});
const active={setupEligible:true,setupActive:true,stationaryEligible:true,stationaryActive:true,mobileEligible:false,mobileActive:false};
const step=(b,dt,conditions=active)=>{b.time+=dt;recordDefenseTime(b,dt);recordPuppetTime(b,dt,conditions);};

void test('new departure may begin at a nonzero chapter offset; missing restored data is partial even at zero',()=>{
 const full=emptyDefenseStats(555,true);assert.doesNotThrow(()=>validateDefenseStats(full,{time:555}));assert.equal(defenseReview({time:555,defenseStats:full}).scope,'complete');
 for(const time of [0,42,555]){const restored=restoreDefenseStats(undefined,time);assert.equal(restored.fromTime,time);assert.equal(restored.complete,false);assert.equal(restored.elapsed,0);assert.equal(defenseReview({time,defenseStats:restored}).scope,'partial');}
 assert.doesNotThrow(()=>validateDefenseStats(undefined,{time:20}));
});
void test('a carried-over dash can deflect after restore without a locally recorded dash, once per actual lastDash',()=>{
 const b=run(10,false);b.time=10.1;b.player.lastDash=9.95;recordDeflection(b);recordDeflection(b);assert.equal(b.defenseStats.dashes,0);assert.equal(b.defenseStats.deflections,1);assert.equal(b.defenseStats.lastDeflectionDash,9.95);assert.doesNotThrow(()=>validateDefenseStats(b.defenseStats,b));
 b.player.lastDash=10.1;recordDash(b);recordDeflection(b);assert.equal(b.defenseStats.dashes,1);assert.equal(b.defenseStats.deflections,2);assert.doesNotThrow(()=>validateDefenseStats(b.defenseStats,b));
 const restored={time:10.15,player:{lastDash:10.1},defenseStats:restoreDefenseStats(b.defenseStats,10.15)};recordDeflection(restored);assert.equal(restored.defenseStats.deflections,2,'restoring inside the same dash cannot count it twice');
});
void test('real shield gains and absorptions are accumulated independently from counter and shield-break trigger counts',()=>{
 const b=run();recordCounter(b,0);recordCounter(b,.125);recordShieldAbsorption(b,8);recordShieldAbsorption(b,2.5);recordShieldRegen(b,.035);recordShieldRegen(b,0);recordShieldBreak(b);
 assert.equal(b.defenseStats.counters,2);assert.equal(b.defenseStats.counterShield,.125);assert.equal(b.defenseStats.shieldAbsorbed,10.5);assert.equal(b.defenseStats.regenShield,.035);assert.equal(b.defenseStats.breaks,1);assert.equal(b.defenseStats.breakDamage,0,'a successful break with no effective hit stays zero damage');
});
void test('counter/break damage scopes clamp overkill, exclude other sources and preserve nested return values',()=>{
 const b=run();observeDefenseDamage(b,'guard',30,100);assert.equal(b.defenseStats.counterDamage,0);
 const result=withDefenseDamage(b,'counter',()=>{observeDefenseDamage(b,'guard',30,7);observeDefenseDamage(b,'fire',100,100);observeDefenseDamage(b,'guard',0,10);assert.equal(withDefenseDamage(b,'break',()=>{observeDefenseDamage(b,'guard',20,12);return 7;}),7);observeDefenseDamage(b,'guard',3,9);return 'original-result';});
 assert.equal(result,'original-result');assert.equal(b.defenseStats.counterDamage,10);assert.equal(b.defenseStats.breakDamage,12);observeDefenseDamage(b,'guard',40,100);assert.equal(b.defenseStats.counterDamage,10,'scope ends before a later unrelated guard event');
});
void test('throwing and cross-run damage observers never leak the counter scope',()=>{
 const a=run(),b=run();assert.throws(()=>withDefenseDamage(a,'counter',()=>{observeDefenseDamage(b,'guard',9,9);throw Error('original failure');}),/original failure/);observeDefenseDamage(a,'guard',5,5);assert.equal(a.defenseStats.counterDamage,0);assert.equal(b.defenseStats.counterDamage,0);
 withDefenseDamage(a,'counter',()=>{assert.throws(()=>withDefenseDamage(a,'break',()=>{throw Error('inner');}),/inner/);observeDefenseDamage(a,'guard',4,10);});assert.equal(a.defenseStats.counterDamage,4);assert.equal(a.defenseStats.breakDamage,0);
});
void test('puppet uptime uses eligible denominators; actual generated arrows include extra shots once in the total',()=>{
 const b=run();step(b,1);recordPuppetShot(b,1,active);recordPuppetShot(b,2,active,{extra:true});
 const mobile={setupEligible:false,setupActive:true,stationaryEligible:true,stationaryActive:false,mobileEligible:true,mobileActive:true};step(b,.5,mobile);recordPuppetShot(b,1,mobile);
 b.time+=.25;recordDefenseTime(b,.25);const s=b.defenseStats;assert.equal(s.elapsed,1.75);assert.equal(s.puppetSeconds,1.5);assert.equal(s.setupPossible,1);assert.equal(s.setupActive,1);assert.equal(s.setupShots,3);assert.equal(s.stationaryPossible,1.5);assert.equal(s.stationaryActive,1);assert.equal(s.stationaryShots,3);assert.equal(s.mobilePossible,.5);assert.equal(s.mobileActive,.5);assert.equal(s.mobileShots,1);assert.equal(s.puppetShots,4);assert.equal(s.extraShots,2);
 const r=defenseReview(b);assert.equal(r.setupRate,1);assert.equal(r.stationaryRate,2/3);assert.equal(r.mobileRate,1);assert.doesNotThrow(()=>validateDefenseStats(s,b));
});
void test('zero opportunity is unavailable rate, distinct from an eligible window that was never active',()=>{
 const b=run();let r=defenseReview(b);assert.equal(r.setupRate,null);assert.equal(r.stationaryRate,null);assert.equal(r.mobileRate,null);
 step(b,1,{setupEligible:true,setupActive:false});r=defenseReview(b);assert.equal(r.setupRate,0);assert.equal(r.stationaryRate,null);
});
void test('restore and review deep copy statistics, preserving full/partial coverage without mutating source snapshots',()=>{
 const b=run(12,false);step(b,.3);recordPuppetShot(b,2,active);const data=copy(b),text=JSON.stringify(data);Object.freeze(data.defenseStats);Object.freeze(data);const restored=restoreDefenseStats(data.defenseStats,data.time),view=defenseReview(data);restored.counterShield=77;view.stats.puppetShots=99;assert.equal(JSON.stringify(data),text);assert.equal(defenseReview(data).stats.puppetShots,2);
});
void test('optional strict validation rejects malformed scalars, incomplete shapes, extra keys and impossible denominators',()=>{
 const b=run(10,false);step(b,2);recordPuppetShot(b,1,active);const mutations=[s=>{s.schema=2;},s=>{s.complete=1;},s=>{delete s.counterDamage;},s=>{s.events=[];},s=>{s.fromTime=12.1;},s=>{s.elapsed=2.01;},s=>{s.elapsed=-1;},s=>{s.regenShield=Infinity;},s=>{s.counterDamage=NaN;},s=>{s.dashes=.5;},s=>{s.counters=Number.MAX_SAFE_INTEGER+1;},s=>{s.puppetSeconds=3;},s=>{s.setupPossible=3;},s=>{s.stationaryActive=3;},s=>{s.extraShots=2;},s=>{s.mobileShots=2;},s=>{s.lastDeflectionDash=1e8+1;}];
 for(const mutate of mutations){const bad=copy(b.defenseStats);mutate(bad);assert.throws(()=>validateDefenseStats(bad,b),/^Error: 防守与驻定统计无效$/);assert.throws(()=>restoreDefenseStats(bad,b.time),/^Error: 防守与驻定统计无效$/);const view=defenseReview({time:b.time,defenseStats:bad});assert.equal(view.available,false);assert.equal(view.reason,'invalid');assert.equal(Object.hasOwn(view,'stats'),false);}
 for(const bad of [null,[],1,'bad'])assert.throws(()=>validateDefenseStats(bad,b),/防守与驻定统计无效/);
});
void test('time validation allows accumulation roundoff and unrecorded gaps but rejects material excess',()=>{
 const b=run(100);for(let i=0;i<200;i++)step(b,.05);assert.doesNotThrow(()=>validateDefenseStats(b.defenseStats,b));b.time+=10;assert.doesNotThrow(()=>validateDefenseStats(b.defenseStats,b),'unobserved time need not be manufactured');
 const bad=copy(b.defenseStats);bad.elapsed=b.time-bad.fromTime+.01;assert.throws(()=>validateDefenseStats(bad,b),/防守与驻定统计无效/);
});
void test('deflection, trigger and actual damage totals remain internally consistent without requiring local dash history',()=>{
 const b=run(10,false);b.player.lastDash=9.95;recordDeflection(b);recordCounter(b,6);withDefenseDamage(b,'counter',()=>observeDefenseDamage(b,'guard',3,3));recordShieldBreak(b);withDefenseDamage(b,'break',()=>observeDefenseDamage(b,'guard',2,2));b.damageSources={guard:5};assert.equal(b.defenseStats.dashes,0);assert.doesNotThrow(()=>validateDefenseStats(b.defenseStats,b));
 const mutations=[s=>{s.lastDeflectionDash=null;},s=>{s.deflections=0;},s=>{s.counters=0;},s=>{s.counterShield=6.1;},s=>{s.breaks=0;},s=>{s.breakDamage=2.1;}];
 for(const mutate of mutations){const bad=copy(b.defenseStats);mutate(bad);assert.throws(()=>validateDefenseStats(bad,b),/防守与驻定统计无效/);}
 const empty=emptyDefenseStats();empty.lastDeflectionDash=0;assert.throws(()=>validateDefenseStats(empty,{time:0}),/防守与驻定统计无效/);
 assert.doesNotThrow(()=>validateDefenseStats(b.defenseStats,{time:10}),'old/missing damage aggregate must not be fabricated');
});
void test('feedback restore accepts absent old telemetry as partial and rejects an invalid present field without silently resetting',()=>{
 const old={time:18,damageSources:{fire:7}},b={};restoreFeedback(b,old);assert.equal(b.defenseStats.complete,false);assert.equal(b.defenseStats.fromTime,18);assert.equal(b.fireBreakdown.history,7);assert.doesNotThrow(()=>validateFeedback(old));
 const bad={...old,defenseStats:{...emptyDefenseStats(),elapsed:100}};assert.throws(()=>validateFeedback(bad),/防守与驻定统计无效/);assert.throws(()=>restoreFeedback({},bad),/防守与驻定统计无效/);
});
void test('read-only unknown states and absent collectors cannot manufacture history or touch gameplay/random inputs',()=>{
 for(const b of [{},{time:1},null]){const r=defenseReview(b);assert.equal(r.available,false);assert.equal(r.reason,'missing');assert.equal(Object.hasOwn(r,'stats'),false);}
 const b={time:1,player:{lastDash:1},rng:()=>{throw Error('random');},contentRng:()=>{throw Error('content random');}};const before=JSON.stringify(b);recordDash(b);recordDeflection(b);recordCounter(b,3);recordShieldAbsorption(b,2);recordShieldRegen(b,1);recordShieldBreak(b);recordDefenseTime(b,.1);recordPuppetTime(b,.1,active);recordPuppetShot(b,2,active,{extra:true});assert.equal(withDefenseDamage(b,'counter',()=>{observeDefenseDamage(b,'guard',8,8);return 12;}),12);assert.equal(JSON.stringify(b),before);
});
const memory=save=>{const map=new Map([[SAVE_KEY,JSON.stringify(save)]]);return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};};
const recordFixture=b=>{b.player.lastDash=b.time;recordDash(b);recordDeflection(b);recordCounter(b,.25);recordShieldAbsorption(b,2);recordShieldRegen(b,.125);return b;};
void test('real legacy/current snapshots and summaries carry independent copies, and absent restored data remains partial',()=>{
 for(const b of [new Battle({rulesVersion:1,chapter:2}),new Battle({rulesVersion:2}),new Expedition({seed:'defense-persist',runId:'defense-persist'})]){
  recordFixture(b);const restore=(data,emit)=>b.rulesVersion===3?Expedition.restore(data,emit):Battle.restore(data,emit),snapshot=b.serialize(),summary=b.summary(),rng=b.rng.state(),content=b.contentRng?.state();assert.equal(snapshot.defenseStats.complete,true);assert.equal(snapshot.defenseStats.fromTime,b.time);assert.deepEqual(summary.defenseStats,snapshot.defenseStats);
  snapshot.defenseStats.counterShield=1;summary.defenseStats.counterShield=2;assert.equal(b.defenseStats.counterShield,.25);const real=b.serialize(),restored=restore(copy(real),()=>{});assert.deepEqual(restored.defenseStats,b.defenseStats);assert.equal(restored.rng.state(),rng);if(content!==undefined)assert.equal(restored.contentRng.state(),content);
  delete real.defenseStats;const old=restore(real,()=>{});assert.equal(old.defenseStats.complete,false);assert.equal(old.defenseStats.fromTime,real.time);assert.equal(old.defenseStats.deflections,0);assert.deepEqual(restore(old.serialize(),()=>{}).defenseStats,old.defenseStats);
 }
});
void test('invalid optional checkpoint statistics stop writes and existing recovery preview preserves original text',()=>{
 const b=recordFixture(new Expedition({seed:'defense-bad-save',runId:'defense-bad-save'})),save=initialSave(),storage=memory(save),vault=new SaveVault(storage);vault.load();const checkpoint=b.serialize(),valid={...save,checkpoint,insight:17};const saved=vault.commit(valid),disk=storage.getItem(SAVE_KEY);assert.deepEqual(saved.checkpoint.defenseStats,b.defenseStats);
 const bad=copy(valid);bad.checkpoint.defenseStats.elapsed=99;assert.throws(()=>normalizeSave(bad),/防守与驻定统计无效/);assert.throws(()=>vault.commit(bad),/防守与驻定统计无效/);assert.equal(storage.getItem(SAVE_KEY),disk);
 const raw=JSON.stringify(bad),preview=recoveryPreview(raw);assert.equal(preview.raw,raw);assert.equal(preview.status,'可恢复长期进度');assert.deepEqual(preview.discarded,['checkpoint']);assert.equal(preview.save.insight,17);assert.equal(preview.save.checkpoint,null);assert.equal(storage.getItem(SAVE_KEY),disk,'preview never adopts or overwrites');
});
void test('settlement history retains observed values without duplicate awards; absent or invalid historical telemetry stays unknown',()=>{
 const b=recordFixture(new Expedition({seed:'defense-history',runId:'defense-history'}));b.finished=true;b.won=true;b.chapter=5;b.wave=3;b.receipts=b.routes.flat().map(n=>n.id);const summary=b.summary(),base=initialSave(),next=settleRunResult(base,summary);assert.deepEqual(next.history[0].defenseStats,b.defenseStats);assert.equal(settleRunResult(next,summary),next);assert.ok(next.records.entries.every(row=>!Object.hasOwn(row,'defenseStats')),'best-time entries keep their original fixed schema');
 const history={time:1,kills:0,path:0,defenseStats:{schema:1}};const old=normalizeSave({...initialSave(),history:[history,{time:1,kills:0,path:0}]});assert.equal(defenseReview(old.history[0]).reason,'invalid');assert.equal(defenseReview(old.history[1]).reason,'missing');
});
void test('observation packets carry only their own snapshot statistics and remain rejected by formal persistence',()=>{
 const b=recordFixture(new Expedition(studyOptions(1))),packet=observationPacket(b),before=copy(packet.snapshot.defenseStats);packet.result.defenseStats.counterShield=5;const restored=restoreStudyPacket(packet,()=>{});assert.deepEqual(restored.defenseStats,before,'restoration must use snapshot, never inject result statistics');
 assert.throws(()=>normalizeSave({...initialSave(),checkpoint:packet.snapshot}),/观察包/);const save=initialSave();assert.equal(settleRunResult(save,b.summary()),save);assert.equal(b.defenseStats.counterShield,.25);assert.deepEqual(packet.snapshot.defenseStats,before);
});
const arena=(path=5,options={})=>{const b=new Expedition({seed:'defense-events',runId:'defense-events',path,...options});b.cinematicSeen=['bamboo'];b.beginNode();b.clearField();b.updateDirector=()=>{};b.updateEnvironment=()=>{};b.player.invuln=0;return b;};
void test('real guard contacts record one deflection and counter before lethal target settlement under old and current balance',()=>{
 for(const balanceVersion of [1,2,3,4]){const b=arena(5,{balanceVersion}),p=b.player,e=b.spawn(4,{x:p.x+25,y:p.y,hp:2,spawn:0});b.rebuildHash();b.input={x:1,y:0};const before=p.shield;assert.equal(b.dash(),true);b.hitPlayer(10);b.hitPlayer(10);
  assert.equal(b.defenseStats.dashes,1);assert.equal(b.defenseStats.deflections,1);assert.equal(b.defenseStats.counters,1);assert.equal(b.defenseStats.counterShield,p.shield-before);assert.equal(b.defenseStats.counterDamage,2);assert.ok(e.hp<=0);assert.ok(b.defenseStats.counterShield<=6);assert.doesNotThrow(()=>normalizeSave({...initialSave(),checkpoint:b.serialize()}));
 }
});
void test('actual K11 shield break, natural regen and fatal absorption survive their original branch order',()=>{
 const b=arena(),p=b.player;b.relics=['K11'];b.recalc();p.shield=10;const e=b.spawn(4,{x:p.x+25,y:p.y,hp:3,spawn:0});b.rebuildHash();b.hitPlayer(50);assert.equal(b.defenseStats.shieldAbsorbed,10);assert.equal(b.defenseStats.breaks,1);assert.equal(b.defenseStats.breakDamage,3);assert.equal(b.defenseStats.counterDamage,0);assert.ok(e.hp<=0);assert.doesNotThrow(()=>validateDefenseStats(b.defenseStats,b));
 p.lastHit=-100;p.shield=Math.max(0,p.maxShield-.125);const shield=p.shield;b.update(.05);assert.equal(b.defenseStats.regenShield,p.shield-shield);assert.ok(b.defenseStats.regenShield>0);assert.doesNotThrow(()=>normalizeSave({...initialSave(),checkpoint:b.serialize()}));
 const fatal=arena();fatal.player.hp=1;fatal.player.shield=2;let finalSummary;fatal.emit=event=>{if(event.type==='finish')finalSummary=event.summary;};fatal.hitPlayer(1e5);assert.equal(fatal.finished,true);assert.equal(finalSummary.defenseStats.shieldAbsorbed,2);assert.equal(finalSummary.defenseStats.breaks,0);assert.doesNotThrow(()=>validateDefenseStats(finalSummary.defenseStats,finalSummary));
});
void test('accepted legacy future lastDash markers preserve two-contact behavior and remain saveable after telemetry starts',()=>{
 for(const options of [{rulesVersion:1},{rulesVersion:2}]){
  const expedition=options.rulesVersion===3,initial=expedition?arena(5,options):new Battle({path:5,seed:'future-dash',...options}),raw=initial.serialize();delete raw.defenseStats;raw.player.lastDash=raw.time+1;raw.player.invuln=1;
  assert.doesNotThrow(()=>normalizeSave({...initialSave(),checkpoint:copy(raw)}),'old valid timer values must remain readable');
  const restore=data=>expedition?Expedition.restore(copy(data),()=>{}):Battle.restore(copy(data),()=>{}),b=restore(raw),reference=restore(raw);delete reference.defenseStats;
  b.hitPlayer(10);reference.hitPlayer(10);b.hitPlayer(10);reference.hitPlayer(10);
  const expected=options.rulesVersion===1?0:expedition&&options.balanceVersion>=3?2:1;
  assert.equal(b.defenseStats.complete,false);assert.equal(b.defenseStats.dashes,0);assert.equal(b.defenseStats.deflections,options.rulesVersion===1?0:1);assert.equal(b.defenseStats.counters,expected);assert.equal(b.defenseStats.counterShield,b.player.shield-raw.player.shield);
  if(expected)assert.equal(b.defenseStats.lastDeflectionDash,raw.player.lastDash);
  const observed=b.serialize(),plain=copy(observed);delete plain.defenseStats;assert.deepEqual(plain,reference.serialize(),'all original saved gameplay and random state matches the no-telemetry reference');
  const saved=normalizeSave({...initialSave(),checkpoint:observed}),again=restore(saved.checkpoint);assert.deepEqual(again.defenseStats,b.defenseStats);assert.equal(defenseReview(again).available,true);
 }
});
void test('deflection deduplication marker accepts exactly the existing finite timer range, including future values',()=>{
 for(const marker of [-1e8,-.5,0,1e8]){const b=run();b.player.lastDash=marker;recordDeflection(b);recordDeflection(b);assert.equal(b.defenseStats.deflections,1);assert.equal(b.defenseStats.lastDeflectionDash,marker);assert.doesNotThrow(()=>validateDefenseStats(b.defenseStats,b));}
 for(const marker of [-1e8-1,1e8+1,Infinity,NaN]){const s=emptyDefenseStats();s.deflections=1;s.lastDeflectionDash=marker;assert.throws(()=>validateDefenseStats(s,{time:0}),/防守与驻定统计无效/);}
});
void test('a synthetic live phase3 future marker can trigger twice without telemetry changing the frozen snapshot guard',()=>{
 for(const balanceVersion of [3,4]){
  const b=arena(5,{balanceVersion}),p=b.player;p.lastDash=b.time+1;p.invuln=1;const initialShield=p.shield;
  assert.throws(()=>normalizeSave({...initialSave(),checkpoint:b.serialize()}),/角色动作时刻不一致/,'Expedition already rejected a future action time before this telemetry feature');
  b.hitPlayer(10);b.hitPlayer(10);assert.equal(b.defenseStats.deflections,1);assert.equal(b.defenseStats.counters,2);assert.equal(b.defenseStats.counterShield,p.shield-initialShield);assert.equal(b.defenseStats.counterShield,6);assert.doesNotThrow(()=>validateDefenseStats(b.defenseStats,b));
  for(let i=0;i<21;i++)b.update(.05);assert.ok(b.time>p.lastDash);const saved=normalizeSave({...initialSave(),checkpoint:b.serialize()}),restored=Expedition.restore(saved.checkpoint);assert.deepEqual(restored.defenseStats,b.defenseStats);assert.equal(defenseReview(restored).available,true);
 }
});
