/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Isolated engine-event fixtures; direct node completion here is not natural-play evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Battle} from '../gameplay/engine.js';
import {Expedition} from '../gameplay/expedition.js';
import {TRAITS,EVENTS} from '../gameplay/data.js';
import {SUPPLIES} from '../gameplay/expedition-data.js';
import {currentChallenge,chooseChallenge} from '../gameplay/experience-rules.js';
import {eligibleEvents} from '../gameplay/story-rules.js';
import {chapterStatsSnapshot,validateChapterStats} from '../gameplay/chapter-telemetry.js';

const copy=structuredClone;
function make(options={}){const events=[],b=new Expedition({seed:'chapter-events',runId:'chapter-events',recordVersion:0,segmentVersion:0,...options},event=>{if(['checkpoint','finish'].includes(event.type))events.push(copy(event));});return {b,events};}
const row=b=>chapterStatsSnapshot(b).rows.at(-1);
function enter(b){b.start();while(b.scene==='cinematic')b.advanceCinematic(true);assert.equal(b.modeState,'battle');return b;}
function target(b,hp=1,extra={}){const e=b.spawn(4,{x:b.player.x+20,y:b.player.y,hp,noDrop:true,...extra});b.rebuildHash();return e;}
function readyRest(b){if(!b.rest.eventDone)b.chooseInteraction(b.eventText().choices.length-1);if(!b.rest.coreDone)b.skipCore();if(!b.rest.routeDone)b.chooseRoute(0);}
function drive(b,done){for(let i=0;i<3000;i++){if(done(b))return;assert.equal(b.finished,false,'fixture stopped before its intended state');if(b.scene==='cinematic')b.advanceCinematic(true);else if(b.modeState==='intro'){if(currentChallenge(b)?.choice===null)chooseChallenge(b,'none');b.start();}else if(b.modeState==='battle')b.completeNode();else if(b.modeState==='choice')b.chooseTrait(b.choices[0].id);else if(b.scene==='intermission'){readyRest(b);b.continueRest();}else assert.fail('Unhandled fixture state '+b.scene);}assert.fail('Fixture did not reach target');}

void test('chapter opening is after supplies and prebuilt traits, with no invented battle minimum or first-combo time',()=>{
 for(const supply of SUPPLIES){const {b}=make({chapter:5,path:2,supply:supply.id});const s=chapterStatsSnapshot(b);assert.equal(s.rows.length,1);assert.equal(s.rows[0].chapter,5);assert.equal(s.fromTime,b.time);assert.deepEqual(s.rows[0].resourcesStart.consumables,b.consumables.map(x=>({...x,bonusHeal:0})));assert.equal(s.rows[0].survival.minHp,null);assert.equal(s.rows[0].nodes.length,0);assert.equal(s.firstCombos.length,0);assert.deepEqual(s.baselineCombos,[...b.comboSet]);}
});
void test('real battle entry and resumed update sample HP, while intro and pause do not invent battle damage or time',()=>{
 const {b}=make();b.player.hp=17;assert.equal(row(b).survival.minHp,null);enter(b);assert.equal(row(b).survival.minHp,17);b.clearField();b.updateDirector=()=>{};b.pause();b.player.hp=3;const elapsed=row(b).elapsed;b.update(1);assert.equal(row(b).survival.minHp,17);assert.equal(row(b).elapsed,elapsed);b.resume();b.update(0);assert.equal(row(b).survival.minHp,3);assert.equal(row(b).survival.hits,0);
});
void test('high-clock restored battle uses exact clock deltas for both chapter and node and survives another restore',()=>{
 const original=new Battle({rulesVersion:2,path:2,seed:'chapter-clock'}),raw=original.serialize();raw.time=5e7;delete raw.chapterStats;delete raw.defenseStats;const b=Battle.restore(raw);b.updateDirector=()=>{};b.start();b.enemies=[];b.rebuildHash();const start=b.time;for(let i=0;i<600;i++)b.update(1/60);const stats=chapterStatsSnapshot(b);assert.equal(stats.partial,true);assert.equal(stats.rows[0].elapsed,b.time-start);assert.equal(stats.rows[0].nodes[0].elapsed,b.time-start);assert.doesNotThrow(()=>Battle.restore(b.serialize()));
});
void test('actual hurt records clamped HP/shield loss and pre-revival zero before the fatal summary is emitted',()=>{
 const {b,events}=make();enter(b);b.clearField();b.traits['guard-11']=1;b.recalc();b.player.hp=10;b.player.shield=5;b.player.invuln=0;b.hitPlayer(10000);let s=row(b).survival;assert.deepEqual([s.minHp,s.hits,s.hpLost,s.shieldLost,s.revives],[0,1,10,5,1]);const restoredHp=b.player.hp;b.player.invuln=0;b.hitPlayer(10000);const finish=events.find(e=>e.type==='finish');assert.ok(finish);s=finish.summary.chapterStats.rows.at(-1).survival;assert.equal(s.hits,2);assert.equal(s.hpLost,10+restoredHp);assert.equal(s.revives,1);assert.equal(s.minHp,0);assert.equal(finish.summary.chapterStats.rows.at(-1).closed,true);const count=events.length;b.finish(false);assert.equal(events.length,count);
});
void test('chapter damage is the existing counter delta, retaining old overkill and current clamping without mutating reads',()=>{
 for(const rulesVersion of [1,2]){const b=new Battle({rulesVersion,seed:'chapter-damage'});b.start();b.enemies=[];const e=target(b,5);b.hit(e,100,'puppet',false);assert.equal(row(b).damage.puppet,b.damageSources.puppet);assert.equal(row(b).damage.puppet,rulesVersion===1?100:5);const before=JSON.stringify(b.chapterStats),rng=b.rng.state();for(let n=0;n<3;n++){b.summary();b.serialize();}assert.equal(JSON.stringify(b.chapterStats),before);assert.equal(b.rng.state(),rng);}
});
void test('a node-ending thunder has its real spend and cast count in the synchronous checkpoint',()=>{
 const {b,events}=make({path:1});enter(b);b.clearField();b.player.mana=100;const cost=b.thunderReadiness().cost;target(b,1,{mission:'carrier'});assert.equal(b.thunder(),true);const cp=events.findLast(e=>e.type==='checkpoint').checkpoint,r=cp.chapterStats.rows.at(-1);assert.equal(r.thunder.casts,1);assert.equal(r.thunder.spent,cost);assert.equal(r.damage.thunder,b.damageSources.thunder);assert.equal(r.nodes[0].complete,true);assert.equal(b.thunder(),false);assert.equal(row(b).thunder.casts,1);
});
void test('a node-ending consumable is counted before its damage, while bonus medicine has its own real decrement path',()=>{
 const {b,events}=make();enter(b);b.clearField();b.consumables=[{id:'fire',count:1}];target(b,1,{mission:'carrier'});assert.equal(b.consume(0),true);const cp=events.findLast(e=>e.type==='checkpoint').checkpoint;assert.equal(cp.chapterStats.rows.at(-1).survival.consumablesUsed,1);assert.equal(cp.consumables[0].count,0);assert.ok(cp.chapterStats.rows.at(-1).damage.fire>0);
 const {b:bonus}=make();enter(bonus);bonus.clearField();bonus.consumables=[{id:'heal',count:0,bonusHeal:1}];assert.equal(bonus.consume(0),false);assert.equal(row(bonus).survival.consumablesUsed,0);bonus.player.hp=50;assert.equal(bonus.consume(0),true);assert.equal(row(bonus).survival.consumablesUsed,1);assert.equal(bonus.consumables[0].bonusHeal,0);assert.equal(bonus.consume(0),false);assert.equal(row(bonus).survival.consumablesUsed,1);
});
void test('full pure medicine, missing inventory and challenge-blocked skills do not count consumption',()=>{
 const {b}=make({mode:'endless',path:1});enter(b);b.clearField();assert.equal(b.consume(0),false);assert.equal(b.consume(99),false);b.challenges[0].choice='items';b.player.hp=1;assert.equal(b.consume(0),false);assert.equal(row(b).survival.consumablesUsed,0);b.challenges[0].choice='thunder';b.player.mana=100;assert.equal(b.thunder(),false);assert.equal(row(b).thunder.casts,0);assert.equal(row(b).thunder.spent,0);
});
void test('rest restoration records actual gain and clipped capacity exactly once, while old balance has no invented allowance',()=>{
 for(const balanceVersion of [1,4]){const {b}=make({path:1,balanceVersion});enter(b);b.player.reserve=b.player.maxReserve-4;b.completeNode();const ledger=copy(row(b).thunder);assert.equal(ledger.restGained,balanceVersion===4?4:0);assert.equal(ledger.restClipped,balanceVersion===4?16:0);b.completeNode();assert.deepEqual(row(b).thunder,ledger);}
});
void test('real reserve-stat gains and cap loss remain unchanged by full or missing-field restoration',()=>{
 const {b}=make({path:1});b.relics=['kit-1-2'];b.recalc();assert.equal(row(b).thunder.statsGained,20);b.recalc();assert.equal(row(b).thunder.statsGained,20);b.relics=[];b.recalc();assert.equal(row(b).thunder.capLost,20);const raw=b.serialize(),expected=copy(raw.chapterStats);assert.deepEqual(Expedition.restore(raw).serialize().chapterStats,expected);delete raw.chapterStats;const old=Expedition.restore(raw);assert.equal(old.chapterStats.partial,true);assert.equal(row(old).thunder.statsGained,0);assert.equal(row(old).thunder.capLost,0);assert.deepEqual(row(old).resourcesStart.reserve,old.player.reserve);
});
void test('only a successful actual trait choice records each newly formed combo once',()=>{
 const {b}=make();enter(b);b.traits={'sword-0':1,'sword-1':1,'sword-2':1,'thunder-0':1,'thunder-1':1};b.recalc();assert.equal(b.chapterStats.firstCombos.length,0);const candidate=TRAITS.find(t=>t.id==='thunder-2');b.scene='choice';b.modeState='choice';b.queuedChoices=1;b.choices=[candidate];b.chooseTrait('not-an-offer');assert.equal(b.chapterStats.firstCombos.length,0);b.chooseTrait(candidate.id);assert.equal(b.chapterStats.firstCombos.length,1);const first=copy(b.chapterStats.firstCombos[0]);assert.equal(first.effect,'swordThunder');assert.equal(first.traitId,candidate.id);assert.deepEqual([first.chapter,first.wave,first.level,first.time],[b.chapter,b.wave,b.level,b.time]);b.scene='choice';b.modeState='choice';b.queuedChoices=1;b.choices=[candidate];b.chooseTrait(candidate.id);assert.deepEqual(b.chapterStats.firstCombos,[first]);
});
void test('rest previews and failed candidate commits preserve the original chapter ledger; successful commit is applied once',()=>{
 const {b}=make({chapter:4});enter(b);b.completeNode();readyRest(b);b.player.hp=b.player.maxHp-20;const before=JSON.stringify(b.serialize()),rng=b.rng.state(),contentRng=b.contentRng.state();b.supplyQuote('hp');b.supplyQuote('shield');assert.equal(JSON.stringify(b.serialize()),before);assert.equal(b.rng.state(),rng);assert.equal(b.contentRng.state(),contentRng);assert.equal(b.commitRestSelections(),true);const committed=JSON.stringify(b.serialize());assert.equal(b.commitRestSelections(),true);assert.equal(JSON.stringify(b.serialize()),committed);
 const {b:failed}=make({chapter:4});enter(failed);failed.completeNode();const allowed=new Set(eligibleEvents(failed).map(e=>e.id)),event=EVENTS.find(e=>allowed.has(e.id)&&e.choices.some(c=>c.effect==='buyHeal')),choice=event.choices.findIndex(c=>c.effect==='buyHeal');failed.rest.event={type:'single',index:event.id,choice:null};failed.rest.eventDone=false;failed.chooseInteraction(choice);failed.gold=0;const rejected=JSON.stringify(failed.serialize());assert.equal(failed.commitRestSelections(),false);assert.equal(JSON.stringify(failed.serialize()),rejected);
});
void test('chapter battle completion leaves end-rest resources live until the real transition, whose refill belongs to the new row',()=>{
 const {b}=make({path:1});drive(b,x=>x.chapter===0&&x.wave===3&&x.scene==='intermission');assert.equal(row(b).battleCompleted,true);assert.equal(row(b).closed,false);readyRest(b);while(b.queuedChoices){b.continueRest();while(b.modeState==='choice')b.chooseTrait(b.choices[0].id);}assert.equal(b.commitRestSelections(),true);b.player.reserve=7;const endResources=copy(row(b).resourcesEnd);b.continueRest();assert.equal(b.chapter,1);const rows=chapterStatsSnapshot(b).rows;assert.equal(rows[0].closed,true);assert.deepEqual(rows[0].resourcesEnd,endResources);assert.deepEqual(rows[1].resourcesStart,endResources);assert.equal(rows[1].thunder.chapterGained,b.player.maxReserve-7);assert.equal(rows[1].survival.minHp,null);assert.equal(rows[1].nodes.length,0);validateChapterStats(b.serialize().chapterStats,b.serialize());
});
void test('endless rows use loop/chapter keys, keep only the declared 12 observed chapters and remain restorable',()=>{
 const {b}=make({mode:'endless'});drive(b,x=>x.endlessLoop===2&&x.chapter===1&&x.modeState==='intro');const stats=chapterStatsSnapshot(b);assert.equal(stats.rows.length,12);assert.equal(stats.omitted,2);assert.equal(stats.rows.at(-1).index,13);assert.equal(stats.rows.at(-1).loop,2);assert.equal(stats.rows.at(-1).chapter,1);assert.ok(stats.rows.every(r=>r.nodes.length<=4));assert.deepEqual(Expedition.restore(b.serialize()).serialize().chapterStats,stats);
});
