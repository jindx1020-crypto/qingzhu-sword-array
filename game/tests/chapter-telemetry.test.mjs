/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';import assert from 'node:assert/strict';
import {COMBOS,EVENTS} from '../gameplay/data.js';
import {DAMAGE_SOURCES} from '../gameplay/combat-values.js';
import {CHAPTER_STATS_LIMIT,initChapterStats,restoreChapterStats,chapterStatsSnapshot,chapterReview,validateChapterStats,beginChapterNode,recordChapterTime,recordChapterHp,recordChapterHit,recordChapterConsumable,recordChapterThunder,recordChapterReserve,completeChapterNode,advanceChapterStats,closeChapterStats,recordChapterCombos} from '../gameplay/chapter-telemetry.js';
import {validateFeedback} from '../gameplay/combat-feedback.js';
import {Battle} from '../gameplay/engine.js';
import {Expedition} from '../gameplay/expedition.js';
import {initialSave} from '../gameplay/data.js';
import {normalizeSave,SaveVault,SAVE_KEY,recoveryPreview} from '../gameplay/save-store.js';
import {studyOptions,observationPacket,restoreStudyPacket} from '../gameplay/observation.js';
const copy=structuredClone;
const fixture=(extra={})=>({time:0,chapter:0,endlessLoop:0,wave:0,level:1,modeState:'intro',gold:45,rerolls:2,player:{hp:100,maxHp:100,reserve:120,maxReserve:120},consumables:[{id:'heal',count:2},{id:'mana',count:1,bonusHeal:1}],damageSources:Object.fromEntries(DAMAGE_SOURCES.map(key=>[key,0])),comboSet:new Set(),...extra});
const enter=b=>{b.modeState='battle';beginChapterNode(b);};
const advance=(b,dt)=>{b.time+=dt;recordChapterTime(b,dt);recordChapterHp(b);};
const nextChapter=b=>{b.chapter=(b.chapter+1)%6;if(b.chapter===0)b.endlessLoop++;advanceChapterStats(b);b.wave=0;b.modeState='intro';};
void test('new and resumed chapters have explicit coverage, and no battle means no manufactured minimum HP',()=>{
 const b=fixture({time:555,chapter:3});initChapterStats(b);let r=chapterReview(b);assert.equal(r.available,true);assert.equal(r.partial,false);assert.equal(r.fromTime,555);assert.equal(r.rows[0].survival.minHp,null);assert.equal(r.rows[0].survival.minHpMax,null);assert.equal(r.rows[0].index,3);
 const pause=fixture({time:37,chapter:2,wave:1,modeState:'pause'});restoreChapterStats(pause,{});r=chapterReview(pause);assert.equal(r.partial,true);assert.equal(r.rows[0].partial,true);assert.deepEqual(r.rows[0].nodes,[{wave:1,elapsed:0,complete:false,partial:true}]);assert.equal(r.rows[0].survival.minHp,null);enter(pause);advance(pause,.2);assert.equal(chapterReview(pause).rows[0].survival.minHp,100);
});
void test('chapter damage starts from a witnessed aggregate and read-only snapshots refresh actual endpoints',()=>{
 const b=fixture();b.damageSources.sword=1000;initChapterStats(b,true);enter(b);advance(b,1);b.damageSources.sword+=17;b.damageSources.guard=4;b.gold=60;b.player.reserve=88;const original=JSON.stringify(b.chapterStats),view=chapterStatsSnapshot(b);assert.equal(view.rows[0].damage.sword,17);assert.equal(view.rows[0].damage.guard,4);assert.equal(view.rows[0].resourcesEnd.gold,60);assert.equal(view.rows[0].resourcesEnd.reserve,88);assert.equal(JSON.stringify(b.chapterStats),original,'readers do not mutate their baseline');view.rows[0].resourcesEnd.consumables[0].count=0;assert.equal(b.consumables[0].count,2);
});
void test('resource balances are not classified as income, and bags keep their bonus separately from normal slots',()=>{
 const b=fixture();initChapterStats(b);const initial=chapterStatsSnapshot(b).rows[0].resourcesStart;assert.deepEqual(initial.consumables,[{id:'heal',count:2,bonusHeal:0},{id:'mana',count:1,bonusHeal:1}]);b.gold-=25;b.rerolls++;b.consumables[0].count++;const r=chapterReview(b).rows[0];assert.equal(r.resourcesEnd.gold,20);assert.equal(r.resourcesEnd.rerolls,3);assert.equal(r.survival.consumablesUsed,0,'purchase and changes in slots never imply a use');assert.equal(Object.hasOwn(r,'goldIncome'),false);
});
void test('reserve transactions record actual casts, recovery kinds, clipping and legacy negative clamping independently',()=>{
 const b=fixture();initChapterStats(b);recordChapterThunder(b,22);recordChapterThunder(b,18);recordChapterReserve(b,'rest',7,13);recordChapterReserve(b,'chapter',40);recordChapterReserve(b,'stats',20);recordChapterReserve(b,'stats',-8);recordChapterReserve(b,'rest',-2,20);recordChapterReserve(b,'cap',3);const t=b.chapterStats.rows[0].thunder;
 assert.deepEqual(t,{casts:2,spent:40,restGained:7,restClipped:33,chapterGained:40,statsGained:20,capLost:13});assert.doesNotThrow(()=>validateChapterStats(b.chapterStats,b));
});
void test('a chapter remains open through its final rest and changes only after the actual chapter index advances',()=>{
 const b=fixture();initChapterStats(b);enter(b);advance(b,4);b.damageSources.thunder=55;completeChapterNode(b,true);b.modeState='rest';b.gold+=20;b.player.reserve=30;let r=chapterReview(b).rows[0];assert.equal(r.battleCompleted,true);assert.equal(r.closed,false);assert.equal(r.elapsed,4);assert.equal(r.resourcesEnd.gold,65);
 nextChapter(b);recordChapterReserve(b,'chapter',90);b.player.reserve=120;r=chapterReview(b);assert.equal(r.rows[0].closed,true);assert.equal(r.rows[0].resourcesEnd.reserve,30);assert.equal(r.rows[1].resourcesStart.reserve,30);assert.equal(r.rows[1].resourcesEnd.reserve,120);assert.equal(r.rows[1].thunder.chapterGained,90);assert.equal(r.rows[1].survival.minHp,null);assert.equal(r.rows[0].damage.thunder,55);assert.equal(r.rows[1].damage.thunder,0);
});
void test('unfinished node and chapter remain unfinished at defeat; stopping never fabricates a chapter split',()=>{
 const b=fixture();initChapterStats(b);enter(b);advance(b,7);completeChapterNode(b);b.wave=1;enter(b);advance(b,3);closeChapterStats(b);const r=chapterReview(b).rows[0];assert.equal(r.closed,true);assert.equal(r.battleCompleted,false);assert.deepEqual(r.nodes.map(n=>[n.wave,n.elapsed,n.complete]),[[0,7,true],[1,3,false]]);assert.equal(r.elapsed,10);assert.equal(Object.hasOwn(b,'chapterSplits'),false);assert.equal(Object.hasOwn(b,'recordDetails'),false);
});
void test('minimum combat life observes the pre-revival zero while actual hits and successful bag uses stay explicit',()=>{
 const b=fixture();initChapterStats(b);b.player.hp=40;recordChapterHp(b);assert.equal(b.chapterStats.rows[0].survival.minHp,null,'out-of-combat sacrifice is not sampled');enter(b);recordChapterHit(b,{hp:0,maxHp:100,hpLost:40,shieldLost:7,revived:true});b.player.hp=25;recordChapterHp(b);recordChapterConsumable(b);recordChapterConsumable(b);const s=b.chapterStats.rows[0].survival;assert.deepEqual(s,{minHp:0,minHpMax:100,hits:1,hpLost:40,shieldLost:7,revives:1,consumablesUsed:2});assert.equal(Object.hasOwn(s,'defeated'),false,'zero plus revival is not a fabricated death');
});
void test('the maximum life accompanying the minimum is retained rather than replaced by a later raised cap',()=>{
 const b=fixture();initChapterStats(b);enter(b);recordChapterHp(b,44.5,104);recordChapterHp(b,80,140);assert.equal(b.chapterStats.rows[0].survival.minHp,44.5);assert.equal(b.chapterStats.rows[0].survival.minHpMax,104);
});
void test('only a real newly gained combo receives a timestamp; baseline and repeated recalculation are never reconstructed',()=>{
 const first=COMBOS[0].effect,second=COMBOS[1].effect,third=COMBOS[2].effect,b=fixture({comboSet:new Set([first])});initChapterStats(b);b.comboSet.add(second);recordChapterCombos(b,[first],'sword-0');recordChapterCombos(b,[first],'sword-0');assert.deepEqual(b.chapterStats.baselineCombos,[first]);assert.equal(b.chapterStats.firstCombos.length,1);assert.equal(b.chapterStats.firstCombos[0].effect,second);b.comboSet.add(third);recordChapterCombos(b,[first,second,third],'sword-0');assert.equal(b.chapterStats.firstCombos.length,1,'already present before the choice is not new');
 const restored=fixture({time:20,comboSet:new Set([first,second,third])});restoreChapterStats(restored,{});recordChapterCombos(restored,[first,second,third],'sword-0');assert.equal(restored.chapterStats.firstCombos.length,0);assert.deepEqual(restored.chapterStats.baselineCombos,[first,second,third]);
});
void test('endless rollover keeps distinct chapter indexes and discards only the earliest bounded observation rows',()=>{
 const b=fixture();initChapterStats(b);for(let i=0;i<15;i++){enter(b);advance(b,1);completeChapterNode(b,true);nextChapter(b);}const s=b.chapterStats;assert.equal(s.rows.length,CHAPTER_STATS_LIMIT);assert.equal(s.omitted,4);assert.equal(s.rows[0].index,4);assert.equal(s.rows.at(-1).index,15);assert.equal(s.rows.at(-1).loop,2);assert.equal(s.rows.at(-1).chapter,3);assert.doesNotThrow(()=>validateChapterStats(s,b));assert.equal(Object.hasOwn(b,'receipts'),false,'observation retention does not alter reward receipts');
});
void test('candidate and quote snapshots stay isolated; only an explicit successful transfer adopts the observations',()=>{
 const b=fixture();initChapterStats(b);const saved={...b,chapterStats:chapterStatsSnapshot(b)},candidate=fixture();restoreChapterStats(candidate,saved);candidate.player.reserve+=10;recordChapterReserve(candidate,'stats',10);recordChapterConsumable(candidate);assert.equal(b.chapterStats.rows[0].thunder.statsGained,0);assert.equal(b.chapterStats.rows[0].survival.consumablesUsed,0);b.chapterStats=candidate.chapterStats;assert.equal(b.chapterStats.rows[0].thunder.statsGained,10);const snapshot=chapterStatsSnapshot(b);snapshot.rows[0].thunder.statsGained=0;assert.equal(b.chapterStats.rows[0].thunder.statsGained,10);
});
void test('old summaries stay unknown and valid frozen historical rows can be read without a live player',()=>{
 for(const b of [null,{}, {time:30,chapter:2}])assert.equal(chapterReview(b).reason,'missing');const b=fixture();initChapterStats(b);enter(b);advance(b,2);closeChapterStats(b);const history={time:b.time,chapter:0,chapterStats:copy(b.chapterStats)};Object.freeze(history.chapterStats.rows[0]);Object.freeze(history.chapterStats.rows);Object.freeze(history.chapterStats);Object.freeze(history);assert.equal(chapterReview(history).available,true);assert.equal(chapterReview(history).rows[0].resourcesEnd.reserve,120);assert.equal(chapterStatsSnapshot({}),undefined);
});
void test('strict optional validation rejects malformed schema, chronology, shapes and scalar types without mutating raw data',()=>{
 const b=fixture();initChapterStats(b);enter(b);advance(b,2);const tests=[s=>{s.schema=2;},s=>{s.fromTime=3;},s=>{s.rows=[];},s=>{s.omitted=-1;},s=>{s.extra=0;},s=>{s.rows[0].index=1;},s=>{s.rows[0].elapsed=3;},s=>{s.rows[0].nodes[0].elapsed=1;},s=>{s.rows[0].damage.fire=NaN;},s=>{s.rows[0].resourcesEnd.reserve=-1;},s=>{s.rows[0].survival.minHp=null;},s=>{s.rows[0].survival.revives=1;},s=>{s.rows[0].thunder.casts=.5;},s=>{s.rows[0].resourcesStart.consumables[0].id='unknown';},s=>{s.baselineCombos=['unknown'];}];
 for(const mutate of tests){const bad=copy(b.chapterStats);mutate(bad);const before=JSON.stringify(bad);assert.throws(()=>validateChapterStats(bad,b),/^Error: 逐章历练统计无效$/);assert.equal(chapterReview({...b,chapterStats:bad}).reason,'invalid');assert.equal(JSON.stringify(bad),before);}
 const raw={...b,chapterStats:{schema:1}};assert.throws(()=>validateFeedback(raw),/逐章历练统计无效/);assert.doesNotThrow(()=>validateChapterStats(undefined,b));
});
void test('all collection is inert when the optional field is deliberately absent',()=>{
 const b=fixture(),before=JSON.stringify(b);beginChapterNode(b);recordChapterTime(b,1);recordChapterHp(b);recordChapterHit(b,{hp:0,hpLost:5,shieldLost:1,maxHp:100});recordChapterThunder(b,22);recordChapterReserve(b,'rest',20);recordChapterConsumable(b);completeChapterNode(b,true);advanceChapterStats(b);closeChapterStats(b);recordChapterCombos(b,[],'sword-0');assert.equal(JSON.stringify(b),before);
});
void test('an old rest has no reconstructed node time and its genuinely new next node is fully observed',()=>{
 const b=fixture({time:40,wave:0,modeState:'rest',routes:[[{},{}]],receipts:['0:0']});restoreChapterStats(b,{});assert.equal(b.chapterStats.rows[0].partial,true);assert.deepEqual(b.chapterStats.rows[0].nodes,[]);assert.equal(b.chapterStats.rows[0].battleCompleted,false);
 b.wave=1;enter(b);advance(b,2);const node=b.chapterStats.rows[0].nodes[0];assert.deepEqual(node,{wave:1,elapsed:2,complete:false,partial:false});
});
void test('a restored in-battle choice keeps a partial node when choosing resumes battle without beginNode',()=>{
 const b=fixture({time:40,wave:1,modeState:'choice',choiceReturn:null});restoreChapterStats(b,{});assert.deepEqual(b.chapterStats.rows[0].nodes,[{wave:1,elapsed:0,complete:false,partial:true}]);assert.equal(b.chapterStats.rows[0].survival.minHp,null);
 b.modeState='battle';advance(b,.5);assert.equal(b.chapterStats.rows[0].elapsed,.5);assert.equal(b.chapterStats.rows[0].nodes[0].elapsed,.5);assert.equal(b.chapterStats.rows[0].nodes[0].partial,true);
 const restChoice=fixture({time:40,wave:1,modeState:'choice',choiceReturn:'intermission'});restoreChapterStats(restChoice,{});assert.deepEqual(restChoice.chapterStats.rows[0].nodes,[]);
});
void test('old final-rest and legacy chapterEnd evidence marks completion without fabricating elapsed time',()=>{
 const modern=fixture({time:80,wave:1,modeState:'rest',routes:[[{},{}]],receipts:['0:0','0:1']});restoreChapterStats(modern,{});assert.equal(modern.chapterStats.rows[0].battleCompleted,true);assert.equal(modern.chapterStats.rows[0].elapsed,0);assert.deepEqual(modern.chapterStats.rows[0].nodes,[]);
 const legacy=fixture({time:80,wave:3});restoreChapterStats(legacy,{time:80,modeState:'chapterEnd',scene:'chapterEnd'});assert.equal(legacy.chapterStats.rows[0].battleCompleted,true);assert.equal(legacy.chapterStats.rows[0].elapsed,0);assert.deepEqual(legacy.chapterStats.rows[0].nodes,[]);
});
const arena=options=>{const b=new Expedition({path:1,seed:'chapter-telemetry-real',runId:'chapter-telemetry-real',...options});b.cinematicSeen=['bamboo'];b.beginNode();b.clearField();b.updateDirector=()=>{};b.updateEnvironment=()=>{};return b;};
void test('actual current and old run snapshots deep copy the new field and restore missing data only after live state is ready',()=>{
 for(const b of [new Battle({rulesVersion:1,chapter:3}),new Battle({rulesVersion:2,chapter:2}),new Expedition({mode:'replay',chapter:3,seed:'chapter-old'})]){
  const raw=b.serialize(),summary=b.summary(),original=JSON.stringify(b.chapterStats);assert.deepEqual(raw.chapterStats,summary.chapterStats);raw.chapterStats.rows[0].resourcesStart.gold=999;summary.chapterStats.baselineCombos.push('invalid');assert.equal(JSON.stringify(b.chapterStats),original);
  const restore=data=>b.rulesVersion===3?Expedition.restore(copy(data)):Battle.restore(copy(data)),live=b.serialize();assert.deepEqual(restore(live).chapterStats,live.chapterStats);delete live.chapterStats;const old=restore(live);assert.equal(old.chapterStats.partial,true);assert.equal(old.chapterStats.fromTime,live.time);assert.equal(old.chapterStats.rows[0].chapter,live.chapter);assert.equal(old.chapterStats.rows[0].resourcesStart.reserve,old.player.reserve);assert.deepEqual(old.chapterStats.rows[0].damageStart,damageAtForTest(old));assert.doesNotThrow(()=>normalizeSave({...initialSave(),checkpoint:old.serialize()}));
 }
});
const damageAtForTest=b=>Object.fromEntries(DAMAGE_SOURCES.map(key=>[key,b.damageSources[key]??0]));
void test('actual cast and rest credit survive saving without treating preview reads as more transactions',()=>{
 const b=arena();b.player.mana=100;const before=b.player.reserve;assert.equal(b.thunder(),true);assert.equal(b.chapterStats.rows[0].thunder.casts,1);assert.equal(b.chapterStats.rows[0].thunder.spent,before-b.player.reserve);b.update(.05);b.completeNode();const rest=b.rest.reserveGain,view=chapterStatsSnapshot(b);assert.equal(view.rows[0].thunder.restGained,rest);assert.equal(view.rows[0].nodes[0].complete,true);const preserved=JSON.stringify(b.chapterStats);chapterReview(b);chapterStatsSnapshot(b);b.supplyQuote('hp');assert.equal(JSON.stringify(b.chapterStats),preserved);
 const snapshot=b.serialize(),restored=Expedition.restore(copy(snapshot));assert.deepEqual(restored.chapterStats,snapshot.chapterStats);assert.equal(restored.chapterStats.rows[0].thunder.casts,1);assert.doesNotThrow(()=>normalizeSave({...initialSave(),checkpoint:restored.serialize()}));
});
void test('actual in-battle choice restore without the new field resumes partial node observation',()=>{
 const b=arena();b.queuedChoices=1;b.openChoices();const raw=b.serialize();delete raw.chapterStats;const restored=Expedition.restore(raw);assert.equal(restored.modeState,'choice');assert.equal(restored.chapterStats.rows[0].nodes[0].partial,true);restored.chooseTrait(restored.choices[0].id);assert.equal(restored.modeState,'battle');restored.update(.05);const row=chapterStatsSnapshot(restored).rows[0];assert.ok(row.elapsed>0);assert.equal(row.nodes[0].partial,true);assert.doesNotThrow(()=>normalizeSave({...initialSave(),checkpoint:restored.serialize()}));
});
void test('invalid checkpoint statistics refuse writes while recovery preview preserves the original text and profile',()=>{
 const b=arena(),save={...initialSave(),insight:13,checkpoint:b.serialize()},map=new Map([[SAVE_KEY,JSON.stringify(save)]]),storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)},vault=new SaveVault(storage);vault.load();const original=storage.getItem(SAVE_KEY),bad=copy(save);bad.checkpoint.chapterStats.rows[0].elapsed=100;
 assert.throws(()=>vault.commit(bad),/逐章历练统计无效/);assert.equal(storage.getItem(SAVE_KEY),original);const raw=JSON.stringify(bad),preview=recoveryPreview(raw);assert.equal(preview.raw,raw);assert.deepEqual(preview.discarded,['checkpoint']);assert.equal(preview.save.insight,13);assert.equal(preview.save.checkpoint,null);assert.equal(storage.getItem(SAVE_KEY),original);
});
void test('observation packet restores its snapshot ledger and never imports the separate result into formal state',()=>{
 const b=new Expedition(studyOptions(1)),packet=observationPacket(b),expected=copy(packet.snapshot.chapterStats);packet.result.chapterStats.rows[0].resourcesEnd.gold+=100;const restored=restoreStudyPacket(packet);assert.deepEqual(restored.chapterStats,expected);assert.throws(()=>normalizeSave({...initialSave(),checkpoint:packet.snapshot}),/观察包/);assert.deepEqual(packet.snapshot.chapterStats,expected);
});
void test('usable supply projections and failed rest drafts remain isolated while successful rest commit adopts a deep-copied ledger',()=>{
 const lateRest=()=>{const b=arena({chapter:4,mode:'replay'});b.player.hp=b.player.maxHp-20;b.completeNode();if(b.cinematic)b.advanceCinematic(true);b.gold=500;initChapterStats(b,true);return b;};
 const b=lateRest();b.chooseInteraction(b.eventText().choices.length-1);if(!b.rest.coreDone)b.skipCore();if(!b.rest.routeDone)b.chooseRoute(0);assert.equal(b.restReadiness().ready,true);const before=JSON.stringify(b.serialize()),original=b.chapterStats,quote=b.supplyQuote('hp');assert.equal(quote.ready,true);assert.equal(quote.retainedGain,20,'both paid and unpaid projections reached the original candidate commit path');assert.equal(JSON.stringify(b.serialize()),before,'candidate predictions cannot leak resources, stats or RNG');assert.equal(b.commitRestSelections(),true);assert.notEqual(b.chapterStats,original);const committed=chapterStatsSnapshot(b);assert.equal(committed.rows[0].resourcesEnd.gold,b.gold);original.rows[0].survival.consumablesUsed=99;assert.equal(b.chapterStats.rows[0].survival.consumablesUsed,0,'successful adoption is detached from the former live ledger');assert.doesNotThrow(()=>normalizeSave({...initialSave(),checkpoint:b.serialize()}));
 const bad=lateRest(),event=EVENTS.find(e=>e.choices.some(c=>c.effect==='buyHeal'));bad.rest.event={type:'single',index:event.id,choice:event.choices.findIndex(c=>c.effect==='buyHeal')};bad.rest.eventDone=true;bad.rest.eventApplied=false;bad.gold=0;initChapterStats(bad,true);const failedBefore=JSON.stringify(bad.serialize());assert.equal(bad.commitRestSelections(),false);assert.equal(JSON.stringify(bad.serialize()),failedBefore,'an unaffordable candidate does not partly adopt its chapter ledger');
});
void test('old HP within the original upper-bound tolerance remains unchanged through entry checkpoint observation and restore',()=>{
 const raw=new Expedition({path:0,seed:'chapter-hp-tolerance',runId:'chapter-hp-tolerance'}).serialize();delete raw.chapterStats;raw.player.hp=raw.player.maxHp+5e-7;const original=JSON.stringify(raw),expectedHp=raw.player.hp;
 const accepted=normalizeSave({...initialSave(),checkpoint:copy(raw)}),b=Expedition.restore(accepted.checkpoint);assert.equal(b.player.hp,expectedHp);let savedCheckpoint;
 b.emit=event=>{if(event.type==='checkpoint')savedCheckpoint=normalizeSave({...initialSave(),checkpoint:event.checkpoint}).checkpoint;};b.beginNode();assert.ok(savedCheckpoint,'the actual beginNode checkpoint was validated before any update could clamp HP');assert.equal(savedCheckpoint.player.hp,expectedHp);assert.equal(savedCheckpoint.chapterStats.rows[0].survival.minHp,expectedHp);assert.equal(savedCheckpoint.chapterStats.rows[0].survival.minHpMax,raw.player.maxHp);const restored=Expedition.restore(savedCheckpoint);assert.equal(restored.player.hp,expectedHp);assert.equal(chapterReview(restored).available,true);assert.equal(JSON.stringify(raw),original);
 const excessive=copy(raw);excessive.player.hp=excessive.player.maxHp+2e-6;assert.equal(Object.hasOwn(excessive,'chapterStats'),false);assert.throws(()=>normalizeSave({...initialSave(),checkpoint:excessive}),/生命与上限/,'the original player validator must still reject excess beyond its existing tolerance');
});
