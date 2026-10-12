/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Historical balance/cultivation assertions stay on their original rule versions. Phase 3 is tested separately.
import test from 'node:test';import assert from 'node:assert/strict';
import {Expedition} from '../gameplay/expedition.js';import {Battle} from '../gameplay/engine.js';import {META,CONSUMABLES} from '../gameplay/data.js';import {damageRows,shieldReward,unfinishedObjective,defeatReview} from '../gameplay/combat-feedback.js';
import {emptySigilStats} from '../gameplay/sigil-metrics.js';
import {hasSigilReview,sigilReview,splitComparison} from '../gameplay/review-display.js';
const copy=x=>JSON.parse(JSON.stringify(x)),own=p=>META.filter(m=>m.path===p).map(m=>m.id);
function arena(path=0){const b=new Expedition({balanceVersion:2,metaRulesVersion:2,seed:'player-feedback',path,difficulty:1,meta:own(path)});b.cinematicSeen=['bamboo'];b.beginNode();b.clearField();b.updateDirector=()=>{};b.updateEnvironment=()=>{};b.player.invuln=0;return b;}
function target(b,extra={}){const e=b.spawn(4,{x:850,y:400,hp:10000,spawn:0,...extra});b.rebuildHash();return e;}
void test('shield recovery never reduces existing extra shields across boundary values',()=>{for(const shield of [0,25,33,50,57,63,78,195,10000]){const p={maxShield:33,shield},gain=shieldReward(p,30,30);assert.ok(gain>=0&&gain<=30);assert.equal(p.shield,shield);assert.equal(gain,Math.max(0,Math.min(30,63-shield)));}});
void test('both chain rewards preview the actual gain and settle exactly once without removing extra shields',()=>{for(const id of [1,6])for(const prior of [0,1])for(const shield of [0,55,78,195]){const b=arena(5);b.completeNode();b.queuedChoices=0;b.player.shield=shield;const c=b.chains[0];c.chain='chain-'+id;c.choice=prior;c.state='active';b.rest.event={type:'chain',id:c.chain,stage:'end',choice:null};b.rest.eventDone=false;b.rest.eventApplied=false;b.rest.coreOffers=[];b.rest.coreDone=true;b.rest.coreApplied=true;const amount=shieldReward(b.player,prior===0?30:24,30);assert.match(b.eventText().choices[0],new RegExp('当前可恢复 '+amount+' 护盾'));assert.equal(b.chooseInteraction(0),true);assert.equal(b.player.shield,shield);b.chooseRoute(0);assert.equal(b.commitRestSelections(),true);assert.equal(b.player.shield,shield+amount);b.commitRestSelections();assert.equal(b.player.shield,shield+amount);}});
// Round-2 C-1 moved this announcement from the single toast slot to the cue channel; the four semantics below are unchanged.
void test('guard counter preserves excess shields and announces only a real gain',()=>{for(const shield of [0,195]){const b=arena(5);const opening=b.toastText;b.player.shield=shield;b.dash();b.hitPlayer(10);assert.equal(b.hitCount,0);assert.equal(b.recentHits.length,0);assert.equal(b.player.shield,shield+(shield===0?6:0));const cue=b.combatCues.find(c=>c.key==='counter');assert.ok(cue,'guard counter announces on the cue channel');assert.match(cue.text,shield===0?/回盾 \+6/:/额外护盾保留/);assert.equal(b.toastText,opening,'the counter confirmation no longer takes the single battle toast slot');assert.ok(b.player.buffs.metaGuardSwift>b.time);}});
void test('pure healing and mana consumables cannot be wasted at full and remain usable near full',()=>{for(const c of CONSUMABLES.filter(c=>['heal','mana'].includes(c.effect))){const b=arena();b.consumables=[{id:c.id,count:2}];b.player.hp=b.player.maxHp;b.player.mana=100;assert.equal(b.consume(0),false);assert.equal(b.consumables[0].count,2);const field=c.effect==='heal'?'hp':'mana';b.player[field]-=.6;assert.ok(Math.abs(b.itemReadiness(0).gain-.6)<1e-10);assert.equal(b.consume(0),true);assert.equal(b.consumables[0].count,1);assert.equal(b.player[field],100);assert.equal(b.consume(0),false);}});
void test('shield, timed recovery and mixed-effect consumables still work at full health',()=>{for(const id of ['shield','recovery','blink','guard','shield2','sword','puppet','insect']){const b=arena();b.consumables=[{id,count:1}];assert.equal(b.consume(0),true,id);assert.equal(b.consumables[0].count,0,id);}});
void test('old bonus medicine is retained at full health while the underlying item remains usable',()=>{const b=arena();b.consumables=[{id:'shield',count:1,bonusHeal:1}];assert.equal(b.itemReadiness(0).item.id,'shield');assert.equal(b.consume(0),true);assert.equal(b.consumables[0].bonusHeal,1);assert.equal(b.consume(0),false);b.player.hp=50;assert.equal(b.itemReadiness(0).bonus,true);assert.equal(b.consume(0),true);assert.equal(b.player.hp,85);assert.equal(b.consumables[0].bonusHeal,0);b.consumables=[{id:'mana',count:1,bonusHeal:1}];b.player.hp=100;b.player.mana=100;assert.equal(b.consume(0),false);assert.deepEqual(b.consumables[0],{id:'mana',count:1,bonusHeal:1});});
void test('legacy very large but valid accumulated damage stays readable after adding classification',()=>{const b=arena(4),d=copy(b.serialize());delete d.fireBreakdown;d.damageSources.fire=1e180;const r=Expedition.restore(d);assert.equal(Expedition.restore(copy(r.serialize())).fireBreakdown.history,1e180);});
void test('new fire damage splits actual damage and sums to the retained aggregate',()=>{const b=arena(4),e=target(b);for(const k of ['burn','sigil','echo','ember','line','other'])b.hit(e,10,'fire',false,k);assert.ok(Math.abs(Object.values(b.fireBreakdown).reduce((a,v)=>a+v,0)-b.damageSources.fire)<1e-6);assert.equal(b.fireBreakdown.history,0);assert.equal(damageRows(b).filter(r=>r.key.startsWith('fire-')).length,6);e.untargetable=true;const before=copy(b.fireBreakdown);b.hit(e,100,'fire',false,'sigil');assert.deepEqual(b.fireBreakdown,before);e.untargetable=false;e.hp=2;b.hit(e,1000,'fire',false,'echo');assert.equal(b.fireBreakdown.echo,before.echo+2);});
void test('old unclassified fire survives restore without inventing a historical breakdown',()=>{for(const rulesVersion of [1,2,3]){const b=rulesVersion===3?arena(4):new Battle({rulesVersion,path:4});const d=copy(b.serialize());delete d.fireBreakdown;delete d.recentHits;d.damageSources.fire=123;const restore=d=>rulesVersion===3?Expedition.restore(d):Battle.restore(d),r=restore(d);assert.equal(r.fireBreakdown.history,123);assert.equal(r.fireBreakdown.burn,0);assert.deepEqual(r.recentHits,[]);assert.equal(restore(copy(r.serialize())).fireBreakdown.history,123);assert.equal(r.rulesVersion,rulesVersion);}});
void test('sigil, echo, ember and line hooks attribute their own real effects',()=>{const b=arena(4);b.relics=['K09'];b.recalc();const e=target(b);b.player.x=e.x;b.player.y=e.y;b.updateSwords=()=>{};b.updateAllies=()=>{};b.updateEnemy=()=>{};b.input={x:1,y:0};b.dash();const origin={x:e.x,y:e.y};b.update(.05);assert.equal(b.zones[0].x,origin.x);assert.ok(b.player.x>origin.x);for(let i=0;i<28;i++)b.update(.05);assert.ok(b.fireBreakdown.sigil>0);assert.ok(b.fireBreakdown.echo>0);assert.ok(b.fireBreakdown.ember>0);b.onSigilDetonate({x:e.x+10,y:e.y,line:{x:e.x-10,y:e.y,damage:10}});assert.ok(b.fireBreakdown.line>0);assert.ok(Math.abs(Object.values(b.fireBreakdown).reduce((a,v)=>a+v,0)-b.damageSources.fire)<1e-6);assert.equal(b.damageSources.fire>0,true);});
void test('recent hits keep the last five actual losses, survive pause and restore, and identify a fatal source',()=>{let b=arena();b.player.shield=15;for(let i=0;i<5;i++){b.time=i;b.player.invuln=0;b.hitPlayer(4,false,{name:'邪修弩手',x:900,y:300,kind:'弹幕'});}assert.equal(b.recentHits[0].shield,4);assert.equal(b.recentHits.at(-1).hp,4);b.pause();const d=copy(b.serialize());b.update(.05);assert.deepEqual(b.recentHits,d.recentHits);b=Expedition.restore(d);assert.deepEqual(b.recentHits,d.recentHits);b.resume();b.player.invuln=0;b.hitPlayer(1000,true,{name:'毒雾',x:600,y:400,kind:'险地'});assert.equal(b.recentHits.length,5);assert.equal(b.recentHits[0].time,1);assert.equal(b.recentHits.at(-1).remaining,0);assert.equal(b.summary().recentHits.at(-1).name,'毒雾');assert.equal(b.failureReason,'生命耗尽');});
void test('new projectile provenance survives save and reaches the hit report',()=>{const b=arena(),e=target(b);b.attackOrigin={name:e.name,x:e.x,y:e.y};b.shoot(b.player.x-15,b.player.y,0,10,100);b.attackOrigin=null;const r=Expedition.restore(copy(b.serialize()));r.updateDirector=()=>{};r.updateEnemy=()=>{};r.updateSwords=()=>{};r.updateAllies=()=>{};r.player.invuln=0;r.update(.01);assert.equal(r.recentHits[0].name,e.name);assert.equal(r.recentHits[0].kind,'弹幕');});
void test('defense objective failures identify the array separately from player deaths',()=>{const b=arena();b.objective={kind:'defend',x:500,y:400,hp:20,maxHp:20,invuln:0};b.hitObjective(25,{name:'妖兽',x:600,y:400,kind:'近身'});assert.equal(b.failureReason,'阵盘失守');assert.equal(b.recentHits[0].target,'阵盘');assert.equal(b.recentHits[0].hp,20);assert.equal(b.player.hp,100);});
void test('malformed telemetry is refused and missing old fields are accepted',()=>{for(const mutate of [d=>d.fireBreakdown.sigil=1,d=>d.fireBreakdown.history=-1,d=>d.recentHits=Array(6).fill({}),d=>d.recentHits=[{time:99999}],d=>d.expedition.shots[0].origin={name:'bad',x:Infinity,y:0},d=>d.expedition.zones[0].fireKind='history']){const b=arena();b.shoot(400,300,0,5);b.danger(700,400,30,5);const d=copy(b.serialize());mutate(d);assert.throws(()=>Expedition.restore(d),/反馈|来源/);}});
void test('feedback remains bounded without drawing ordinary damage numbers',()=>{const b=arena(4),e=target(b,{hp:1e9});b.options.settings={numbers:false};const rng=b.rng.state();for(let i=0;i<500;i++){b.hit(e,1,'fire',false,'sigil');b.cue('sigil','符阵爆发');}assert.equal(b.combatCues.length,1);assert.ok(b.fx.filter(f=>f.kind==='number').length<=1);assert.equal(b.rng.state(),rng);assert.ok(b.fx.some(f=>f.key));});
void test('defeat objective uses actual fixed timers, including the 75-second swarm and unlocked exits',()=>{
 const b={isExpedition:true,mode:'story',encounter:{kind:'survival',seconds:999},waveTime:64,receipts:[],node:{id:'0:0'}};
 assert.match(unfinishedObjective(b),/64 \/ 65 秒 · 还差 1 秒/);
 b.encounter.kind='swarm';b.waveTime=39.515;assert.match(unfinishedObjective(b),/39.5 \/ 75 秒 · 还差 35.5 秒/);
 b.encounter.kind='ice';b.waveTime=45;assert.match(unfinishedObjective(b),/40 \/ 40 秒.*撤离尚未完成/);
 b.encounter.kind='escape';b.objective={done:2,total:2};assert.match(unfinishedObjective(b),/2 \/ 2.*撤离尚未完成/);
 b.objective.done=1;assert.match(unfinishedObjective(b),/1 \/ 2.*解封后仍须/);
 b.receipts=['0:0'];assert.equal(unfinishedObjective(b),null);
});
void test('defeat objective reads stored mechanism progress and never invents old-engine progress',()=>{
 const b={isExpedition:true,mode:'story',encounter:{kind:'treasure'},mechanism:{step:1,progress:18.25,goal:42}};
 assert.match(unfinishedObjective(b),/18.2 \/ 42 秒 · 阵位 2 \/ 3 · 还差 23.8 秒/);
 b.encounter.kind='illusion';b.objective={done:2};assert.match(unfinishedObjective(b),/2 \/ 3 · 还差 1 处/);
 b.encounter.kind='xuangu';b.bossEnding=5.26;b.boss={hp:1,maxHp:100000};assert.match(unfinishedObjective(b),/圣火危机.*5.3 秒后脱身/);
 b.isExpedition=false;assert.equal(unfinishedObjective(b),null);
});
void test('defeat review separates fatal hazard from the bounded recent main damage type without mutating state',()=>{
 const b=arena();b.player.shield=0;for(let i=0;i<4;i++){b.time=i;b.player.invuln=0;b.hitPlayer(20,true,{name:'追兵',kind:'近身'});}b.time=4;b.player.invuln=0;b.hitPlayer(1000,true,{name:'毒雾',kind:'险地'});
 const snapshot=copy(b.serialize()),rng=b.rng.state(),r=defeatReview(b);
 assert.equal(r.fatal.name,'毒雾');assert.deepEqual(r.dominant,['近身']);assert.equal(r.count,5);assert.equal(r.loss,80);assert.equal(r.target,'韩立');
 assert.deepEqual(copy(b.serialize()),snapshot);assert.equal(b.rng.state(),rng);
});
void test('array defeat review excludes player damage from its recent main damage type',()=>{
 const b=arena();b.player.shield=0;b.hitPlayer(40,true,{name:'毒雾',kind:'险地'});b.objective={kind:'defend',x:500,y:400,hp:20,maxHp:20,invuln:0};b.hitObjective(25,{name:'妖兽',kind:'近身'});
 const r=defeatReview(b);assert.equal(r.fatal.name,'妖兽');assert.equal(r.target,'阵盘');assert.equal(r.count,1);assert.deepEqual(r.dominant,['近身']);assert.equal(r.loss,20);
});
void test('revival, missing historical outcomes and stale defeated hits are never guessed to be fatal',()=>{
 const b={finished:true,won:false,time:5,recentHits:[{time:1,target:'韩立',name:'旧伤',kind:'近身',shield:0,hp:20,remaining:0},{time:2,target:'韩立',name:'守心',kind:'弹幕',shield:0,hp:20,remaining:30,outcome:'revived'},{time:3,target:'韩立',name:'过期',kind:'险地',shield:0,hp:20,remaining:0,outcome:'defeated'}]};
 assert.equal(defeatReview(b).fatal,null);assert.deepEqual(defeatReview(b).dominant,['近身','弹幕','险地']);b.recentHits=[];assert.equal(defeatReview(b).count,0);
 b.won=true;assert.equal(defeatReview(b),null);b.won=false;b.failureReason='前两章对照体验完成';assert.equal(defeatReview(b),null);
});

function reviewFixture(total=14){
 const stats=emptySigilStats(0),records=[];
 for(let i=0;i<total;i++){const kind=i===12||i===13?'echo':'sigil',hits=([2,3,1,1,2][i]||0)+(i===12?3:0),blocked=i===5?2:i===0?1:0,r={id:i+1,time:i+1,kind,x:640,y:420,hits,kills:0,damage:hits*10,blocked,...(i===0||i===6?{cleared:true}:{})};records.push(r);const g=stats[kind];g.casts++;g.hits+=hits;g.damage+=r.damage;g.blocked+=blocked;if(!hits)g.empty++;}
 stats.recent=records.slice(-40);return {path:4,sigilStats:stats};
}
void test('review counts effective bursts as casts minus empty, separately from target hits and blocking',()=>{
 const b=reviewFixture(),before=JSON.stringify(b),r=sigilReview(b);assert.equal(r.groups[0].casts,12);assert.equal(r.groups[0].effective,5);assert.equal(r.groups[0].hits,9);assert.equal(r.groups[0].blocked,3);assert.equal(r.groups[1].effective,1);assert.equal(r.groups[1].hits,3);assert.equal(JSON.stringify(b),before);
 const mixed=r.recent.find(n=>n.id===1);assert.equal(mixed.status,'有效爆发');assert.equal(mixed.blocked,1);assert.equal(mixed.cleared,true,'an earlier heuristic mark is retained even when the final burst hits');
 assert.equal(r.recent.find(n=>n.id===6).status,'无有效命中 · 有阻挡');assert.equal(r.recent.find(n=>n.id===7).status,'无有效命中 · 提前清场推断标记');assert.equal(r.recent.find(n=>n.id===8).status,'无有效命中 · 未记录具体原因');
});
void test('review retains only saved recent rows and never merges simultaneous sigils into inferred pairs',()=>{
 const b=reviewFixture(44),before=JSON.stringify(b),r=sigilReview(b);assert.equal(r.recorded,40);assert.equal(r.total,44);assert.equal(r.recent[0].id,44);assert.equal(r.recent.at(-1).id,5);assert.equal(JSON.stringify(b),before);
 const two=b.sigilStats.recent.slice(-2);two[0].time=two[1].time;const same=JSON.stringify(b),next=sigilReview(b);assert.equal(next.recent.length,40);assert.equal(next.recent[0].time,next.recent[1].time);assert.equal(next.recent[0].x,next.recent[1].x);assert.notEqual(next.recent[0].id,next.recent[1].id);assert.ok(next.recent.every(n=>!Object.hasOwn(n,'pairId')));assert.equal(JSON.stringify(b),same);
 next.recent[0].damage=999;next.groups[0].casts=999;assert.equal(JSON.stringify(b),same,'display objects do not alias the source records or counters');
});
void test('review does not invent old missing telemetry and works with frozen saved data',()=>{
 assert.equal(hasSigilReview({path:4}),false);assert.equal(sigilReview({path:4}),null);assert.equal(sigilReview({path:0,sigilStats:emptySigilStats(100)}),null);
 const blank=sigilReview({path:4,sigilStats:emptySigilStats(100)});assert.equal(blank.total,0);assert.equal(blank.recorded,0);assert.equal(blank.fromTime,100);
 const b=reviewFixture(),freeze=x=>{if(!x||typeof x!=='object')return;Object.values(x).forEach(freeze);Object.freeze(x);};freeze(b);const before=JSON.stringify(b);for(let i=0;i<8;i++)sigilReview(b);assert.equal(JSON.stringify(b),before);
});
void test('chapter review emits one all-missing state while retaining exact real split values and partial comparisons',()=>{
 const rows=[{index:0,chapter:0,durationMs:60123},{index:1,chapter:1,durationMs:71234}],before=JSON.stringify(rows);
 const first=splitComparison(rows);assert.equal(first.missingAll,true);assert.deepEqual(first.rows.map(r=>r.row.durationMs),[60123,71234]);assert.deepEqual(first.rows.map(r=>r.delta),[null,null]);
 const partial=splitComparison(rows,[{index:0,durationMs:60000}]);assert.equal(partial.missingAll,false);assert.deepEqual(partial.rows.map(r=>r.delta),[123,null]);assert.equal(splitComparison(rows,[{index:0,durationMs:NaN}]).missingAll,true);assert.deepEqual(splitComparison(undefined),{rows:[],missingAll:false});assert.equal(JSON.stringify(rows),before);
});
