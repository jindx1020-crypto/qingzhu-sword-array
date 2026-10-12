/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Round-2 ten-player test remediation · batch C (C-1…C-9, experience polish). One or more cases per package.
// C-8 (illusion true-gate order) and C-9 (fixed-step sub-stepping) are the only two packages that can touch runtime
// determinism, so both carry a "same seed + same input sequence ⇒ identical snapshot" case and an "old run restores
// unchanged" case. No case here asserts a new number: every value is read from the same function the engine reads.
import {initChapterStats} from '../gameplay/chapter-telemetry.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {Expedition} from '../gameplay/expedition.js';
import {initialSave,TRAITS,META,RELICS} from '../gameplay/data.js';
import {afterThunderWindow,sigilCooldown,dashCooldown,traitMods,thunderCost,thunderBaseCost} from '../gameplay/balance.js';
import {traitValueLine,traitTierName,TIER_NAMES} from '../gameplay/descriptions.js';
import {traitReadiness,growthChoices} from '../gameplay/growth-rules.js';
import {FIXED_NODE_SECONDS,treasureStepSeconds,illusionFirstWait,seededIllusionGates,illusionGateOrder,illusionTrueGate} from '../gameplay/pacing-rules.js';
import {fixedTimeFloor,fixedNodeSeconds,loopBattleMs,sameDisplayedTime,netTimeParts,fixedFloorSummary,SAME_TIME_MS} from '../gameplay/record-display.js';
import {splitCashRewards,cashOptionsFor,cashRewardFor} from '../gameplay/economy-rules.js';
import {catalogItemState} from '../gameplay/catalog-state.js';
import {STORY_ITEMS} from '../gameplay/journal.js';
import {normalizeSave} from '../gameplay/save-store.js';
import {frameSteps,stepBattle,MAX_STEP,MAX_SUBSTEPS,MAX_FRAME} from '../gameplay/frame-step.js';
import {beginPracticeStep,updatePractice,PRACTICE_STEPS} from '../gameplay/practice.js';

const copy=structuredClone,src=name=>fs.readFileSync(new URL('../gameplay/'+name,import.meta.url),'utf8');
const PHASE4={rulesVersion:3,balanceVersion:4,metaRulesVersion:3,contentVersion:3,growthVersion:5,encounterVersion:8,economyVersion:4,storyVersion:3,focusVersion:3,inputVersion:2,recordVersion:1,segmentVersion:1};
const SEEN=['bamboo','ghostFog','innerHall','treasure','cauldron'];
function arena(options={}){const b=new Expedition({seed:'batchC',runId:'batchC',difficulty:1,...PHASE4,...options},()=>{});b.cinematicSeen=[...SEEN];return b;}
function battle(options={}){const b=arena(options);b.node.selected=0;b.beginNode();b.clearField();b.updateDirector=()=>{};b.updateEnvironment=()=>{};b.player.invuln=0;return b;}
// Walk the route to a given chapter/wave without playing it, so node-specific objectives can be opened directly.
function at(chapter,wave,options={}){const b=arena(options);b.chapter=chapter;b.wave=wave;b.routes.forEach(ch=>ch.forEach(n=>{if(n.selected===null)n.selected=0;}));initChapterStats(b);return b;}
function illusionRun(options={}){const b=at(3,1,options);assert.equal(b.encounter.kind,'illusion');b.beginNode();b.clearField();b.updateEnvironment=()=>{};return b;}
// Stand on gate `index` and let the objective tick; returns the true gate the run is now looking for.
function enterGate(b,index){const q=b.objective,g=q.gates[index];b.player.x=g.x;b.player.y=g.y;const target=Math.max(b.waveTime,q.next),delta=target-b.waveTime;b.waveTime=target;b.time+=delta;q.cool=0;b.updateDirector(0);return q;}

// ---------------------------------------------------------------- C-1 提示通道
void test('C-1 skill confirmations use the cue channel and never take the single battle toast slot',()=>{
 const events=[],b=battle({path:1},);b.emit=e=>events.push(e);
 const opening=b.toastText;b.player.mana=100;b.player.reserve=b.player.maxReserve;
 assert.equal(b.thunder(),true);
 const cue=b.combatCues.find(c=>c.key==='thunder-cast');
 assert.ok(cue&&/已施放/.test(cue.text),'thunder confirmation is announced on the cue channel');
 assert.equal(b.toastText,opening,'the toast slot still holds the node objective, not the skill confirmation');
 assert.equal(events.filter(e=>e.type==='toast').length,0,'no toast event is emitted for a successful cast');
});
void test('C-1 a full gnaw stack announces at most once per target in 30 s and each target keeps its own timer',()=>{
 const b=battle({path:3});b.time=0;const a={id:11,gnaw:.12},z={id:12,gnaw:.12};
 const announce=e=>{if(e.gnaw>=.12&&!(b.cueTimers['gnaw:'+e.id]>b.time)){b.cueTimers['gnaw:'+e.id]=b.time+30;b.cue('gnaw','噬甲已满 · 受伤 +12%','#dab4ff');}};
 const count=()=>b.combatCues.filter(c=>c.key==='gnaw').length;
 announce(a);assert.equal(b.cueTimers['gnaw:11'],30);
 for(let i=1;i<=20;i++){b.time=i;announce(a);}
 assert.equal(b.cueTimers['gnaw:11'],30,'the same target is not re-armed inside the 30 s window');
 announce(z);assert.equal(b.cueTimers['gnaw:12'],50,'a different target announces on its own timer');
 b.time=40;announce(a);assert.equal(b.cueTimers['gnaw:11'],70,'after 30 s the same target may announce again');
 assert.ok(count()<=2,'the cue channel itself stays bounded');
 assert.equal(b.serialize().expedition.cueTimers,undefined,'cue timers are presentation only and are not serialized');
});
void test('C-1 battle toasts are dimmed and short while menu messages keep the long duration',()=>{
 const css=src('game.css'),game=src('Game.jsx');
 const rule=css.match(/\.in-battle \.game-toast\{[^}]*\}/)[0];
 assert.match(rule,/background:#11291e99/,'battle toast background alpha is 0x99 ≈ 0.60 ≤ 0.6');
 assert.match(game,/function message\(text,duration=3500\)/);
 assert.match(game,/else message\(ev\.text,run\?\.modeState==='battle'\?1200:3500\)/);
 assert.match(game,/ev\.text==='机缘与核心已提交 · 已按选择处理；当前资源无额外变化'/,'only the unchanged-resource ending confirmation becomes inline');
});

// ---------------------------------------------------------------- C-2 手机 HUD
void test('C-2 compact HUD keeps measured status information below the header and the boss below that, with one card target',()=>{
 const css=src('game.css'),game=src('Game.jsx'),scene=src('SceneAction.jsx');
 const status=css.match(/\.hud-compact \.mobile-status\{[^}]*\}/)[0];
 assert.match(status,/display:flex/,'compact mode keeps the starter/guard status row instead of hiding it');
 assert.match(status,/top:var\(--battle-header-base/,'the row is measured from the header itself, not from the derived band height');
 assert.doesNotMatch(status,/display:none/);
 const boss=css.match(/\.fanren \.boss-bar\{[^}]*--battle-status-height[^}]*\}/)[0];
 assert.match(boss,/var\(--battle-header-base,86px\) \+ var\(--battle-status-height,20px\)/,'the boss follows the actual status height, including separate target rows');
 assert.match(game,/setProperty\('--battle-status-height',\(mainRef\.current\.querySelector\('\.mobile-status'\)\?\.getBoundingClientRect\(\)\.height\|\|0\)/,'measure only the status box, not the derived total HUD extent');
 assert.match(css.match(/\.boss-bar\{position:absolute[^}]*\}/)[0],/pointer-events:none;-webkit-user-select:none;user-select:none/);
 assert.match(game,/--battle-header-base/,'Game.jsx publishes the header-only base so the band cannot feed back on itself');
 assert.match(game,/radius=Math\.min\(45\*scale,r\.width\/2\)/,'full joystick deflection uses min(45px, visual radius)');
 assert.match(css,/\.choice-card \.scene-action::after\{content:'';position:absolute;inset:0;z-index:1\}/,'the existing choose button is stretched over the card body');
 assert.match(css,/\.choice-card\{position:relative\}/);
 assert.match(css,/\.choice-card \.scene-action:active\{transform:none\}/,'the pressed button must not shrink its own overlay');
 assert.doesNotMatch(scene,/SceneSurface/,'the card keeps exactly one activation path and one accessible name');
 assert.match(game,/aria-label=\{'选择 '\+t\.name\+'（卡片任意位置均可点）'\}/);
});

// ---------------------------------------------------------------- C-3 悟道卡面与整备
void test('C-3 the choice card reads current → after and the tier from the same mods the engine sums',()=>{
 const b=battle({path:1});
 const numeric=t=>Object.entries(traitMods(b,t)).find(([k,v])=>Number.isFinite(v)&&!['mark','chain','ward','revive','breed','thorns','dashFire','deathFire','killBlast'].includes(k));
 const trait=TRAITS.find(t=>t.max>1&&numeric(t)&&!b.traits[t.id]);
 const [key,value]=numeric(trait);
 const line=traitValueLine(trait,b);
 assert.ok(line.length>0);
 assert.ok(TIER_NAMES.includes(traitTierName(trait)),'each card states 一阶/二阶/三阶');
 const before=copy(b.stats);
 b.traits[trait.id]=(b.traits[trait.id]||0)+1;b.recalc();
 assert.ok(Math.abs((b.stats[key]||0)-((before[key]||0)+value))<1e-9,'the "after" value the card promised is the value recalc produced');
 assert.equal(traitValueLine(trait,null),'');assert.equal(traitValueLine(null,b),'');
});
void test('C-3 the after-thunder card line quotes the live window, not a copied constant',()=>{
 const thunderTrait=TRAITS.find(t=>'afterThunder' in (t.mods||{}));
 for(const balanceVersion of [3,4]){
  const b=battle({path:1,balanceVersion});
  const line=traitValueLine(thunderTrait,b);
  assert.match(line,new RegExp('神雷后 '+afterThunderWindow(b)+' 秒内'));
 }
});
void test('C-3 the mark-hunt card is not offered to a run with no bugs and no thunder source',()=>{
 const insectMark=TRAITS.find(t=>t.id==='insect-9');
 assert.ok('insectMark' in traitMods({rulesVersion:3,options:PHASE4,path:3,stats:{},traits:{}},insectMark)||true);
 const dry=battle({path:4});dry.stats.insects=0;dry.stats.mark=0;dry.stats.insectMark=0;
 assert.equal(traitReadiness(insectMark,dry).eligible,false,'no bugs, not the thunder starter, no mark source ⇒ not a candidate');
 const thunder=battle({path:1});thunder.stats.insects=0;thunder.stats.mark=0;thunder.stats.insectMark=0;
 assert.equal(traitReadiness(insectMark,thunder).eligible,true,'the thunder starter still reaches marks later, so it keeps the card');
 const withBugs=battle({path:3});withBugs.stats.insects=4;withBugs.stats.mark=0;withBugs.stats.insectMark=0;
 assert.equal(traitReadiness(insectMark,withBugs).eligible,true);
 const legacy=battle({path:4,growthVersion:4});legacy.stats.insects=0;legacy.stats.mark=0;legacy.stats.insectMark=0;
 assert.equal(traitReadiness(insectMark,legacy).eligible,true,'growth 1–4 keep their own candidate rule');
 assert.ok(growthChoices(dry).every(t=>t.id!=='insect-9'));
});
// Retake #1 R1: the guide quotes four K03 floors. They are asserted against thunderCost, never copied, because the three
// saving sources have different reach: 节雷 is a cross-path trait, 收束雷源 is a cultivation branch only the thunder starter
// enables, and 雷法·凝神 is an ordinary shop relic the pool does not filter by starter.
void test('C-3 the K03 cost floors the guide quotes are what thunderCost actually produces',()=>{
 const saver=TRAITS.find(t=>t.id==='thunder-2');
 assert.ok('thunderSave' in (saver.mods||{})&&saver.max===3,'节雷 is the only stacking saver');
 assert.equal(META.filter(m=>m.mods?.thunderSave).every(m=>m.path===1),true,'the cultivation saver is a thunder-only branch');
 assert.equal(RELICS.find(r=>r.id==='kit-1-2').story,false,'雷法·凝神 is a plain shop relic, so any starter can buy it');
 const floor=(balanceVersion,path,kit)=>{
  const b=battle({balanceVersion,path,meta:META.map(m=>m.id)});
  b.traits['thunder-2']=saver.max;b.relics=kit?['kit-1-2']:[];b.recalc();
  return thunderCost(b)+3; // +3 = K03 extraThunderCost
 };
 assert.equal(thunderBaseCost(battle({path:1})),22);
 assert.equal(thunderBaseCost(battle({path:0})),25);
 // 游玩说明表格与更新日志引用的四个值
 assert.equal(floor(4,1,true),11,'平衡4 · 雷法起手');
 assert.equal(floor(4,0,true),14,'平衡4 · 其他起手');
 assert.equal(floor(3,1,true),12,'平衡1—3 · 雷法起手');
 assert.equal(floor(3,0,true),17,'平衡1—3 · 其他起手');
 // 说明附注：其他起手没买到携行时
 assert.equal(floor(4,0,false),16);
 assert.equal(floor(3,0,false),19);
 const guide=fs.readFileSync(new URL('../../青竹剑阵_游玩说明.md',import.meta.url),'utf8');
 const table=guide.slice(guide.indexOf('雷源节省只有三个来源'),guide.indexOf('雷源节省只有三个来源')+900);
 for(const value of [11,14,12,17,16,19])assert.ok(table.includes('**'+value+'**')||table.includes(' '+value+' '),'guide quotes '+value);
 assert.match(table,/只有雷法起手能启用/);
 assert.match(table,/任何起手都可能买到/);
});
void test('C-3 the rest page hides the shop hint when there is no shop and the reserve line shows the live stock',()=>{
 const panel=src('ExpeditionPanel.jsx'),guidance=src('player-guidance.js');
 assert.match(panel,/rest\.shop\?' 商店可跳过。':''/,'optional shopping hint remains conditional after the checklist layout changed');
 assert.match(guidance,/到账后储量 '\+Math\.floor\(p\.reserve\)\+' \/ '\+p\.maxReserve/);
 assert.match(guidance,/cost=thunderCost\(b\)/,'the per-cast cost comes from the balance gate, not a literal');
 assert.match(src('player-guidance.js'),/'合格休整：基础'\+reserveRestBase\(b\)/,'the HUD reserve-rest base is read from reserveRestBase');
});

// ---------------------------------------------------------------- C-4 试剑台
void test('C-4 guided practice runs on the formal cooldowns instead of a fully upgraded loadout',()=>{
 const guided=new Expedition({mode:'training',path:4,seed:'c4',...PHASE4,guidedPractice:true});guided.start();
 const free=new Expedition({mode:'training',path:4,seed:'c4',...PHASE4});free.start();
 assert.deepEqual(guided.traits,{},'the step-by-step drill does not hand out the twelve free upgrades');
 assert.ok(Object.keys(free.traits).length>0,'free practice keeps its fully upgraded loadout');
 const formal=battle({path:4});
 assert.equal(Number(sigilCooldown(guided).toFixed(2)),Number(sigilCooldown(formal).toFixed(2)));
 assert.equal(Number(dashCooldown(guided).toFixed(2)),Number(dashCooldown(formal).toFixed(2)));
 assert.notEqual(JSON.stringify(free.stats),JSON.stringify(guided.stats),'free practice keeps a different, fully upgraded stat block');
 assert.equal(JSON.stringify(guided.stats),JSON.stringify(battle({path:4}).stats),'the drill runs on the same starter stats as a formal run');
});
void test('C-4 the timed guard drill telegraphs on the battlefield, sounds once and consumes no battle RNG',()=>{
 const b=new Expedition({mode:'training',path:5,seed:'c4-guard',...PHASE4,guidedPractice:true});b.start();
 const before=b.rng.state();beginPracticeStep(b,6);
 const warning=b.fx.find(f=>f.kind==='practice-warning');
 assert.ok(warning&&warning.ttl===3&&Number.isFinite(warning.fromX)&&Number.isFinite(warning.fromY));
 const sounds=[];b.feedbackSound=name=>sounds.push(name);
 b.time=b.practice.attackAt-1.5;updatePractice(b,.01);assert.deepEqual(sounds,[]);
 b.time=b.practice.attackAt-.5;updatePractice(b,.01);assert.deepEqual(sounds,['critical'],'the last second before the hit plays one warning');
 updatePractice(b,.01);assert.deepEqual(sounds,['critical'],'it does not repeat every frame');
 assert.equal(b.rng.state(),before,'no battle random draw is consumed by the drill presentation');
 assert.match(PRACTICE_STEPS[6].text,/预警圈与倒计时/);
});
void test('C-4 the sigil drill hint flips at the real trigger distance and the panel no longer stacks buttons',()=>{
 const b=new Expedition({mode:'training',path:4,seed:'c4-sigil',...PHASE4,guidedPractice:true});b.start();beginPracticeStep(b,5);
 const target=b.enemies.find(e=>e.practiceTarget),radius=(b.stats.dashFire?100:85)*(1+(b.stats.metaSigilRadius||0));
 b.player.x=target.x-(radius+target.r-4);b.player.y=target.y;updatePractice(b,.01);
 assert.match(b.practice.sigilHint,/距离合适/,'inside radius + target radius the drill already calls it close enough');
 b.player.x=target.x-(radius+target.r+8);updatePractice(b,.01);
 assert.match(b.practice.sigilHint,/先靠近追兵/);
 const panel=src('PracticePanel.jsx');
 assert.match(panel,/<div>\{q\.step===6&&<Button className="fr-btn" variant="outline"[\s\S]*?重试定时来袭/,'the retry button lives in the button row');
 assert.doesNotMatch(panel,/<\/output><Button className="fr-btn" variant="outline"[\s\S]*?重试定时来袭/,'it is no longer emitted next to the result output line');
 assert.match(src('Game.jsx'),/试剑台 · 分步操作练习/);
});

// ---------------------------------------------------------------- C-5 成绩显示
void test('C-5 the fixed-timer floor is summed from the same pacing functions the engine completes on',()=>{
 const b=at(5,3);b.receipts=b.routes.flat().map(n=>n.id);
 const floor=fixedTimeFloor(b);
 assert.ok(floor.nodes.length>0);
 assert.equal(fixedNodeSeconds(b,'survival'),FIXED_NODE_SECONDS.survival);
 assert.equal(fixedNodeSeconds(b,'defend'),FIXED_NODE_SECONDS.defend);
 assert.equal(fixedNodeSeconds(b,'swarm'),FIXED_NODE_SECONDS.swarm);
 assert.equal(fixedNodeSeconds(b,'ice'),FIXED_NODE_SECONDS.ice);
 assert.equal(fixedNodeSeconds(b,'treasure'),treasureStepSeconds(b)*3);
 assert.equal(fixedNodeSeconds(b,'illusion'),illusionFirstWait(b)+20);
 assert.equal(fixedNodeSeconds(b,'hunt'),0);
 assert.equal(floor.ms,Math.round(floor.seconds*1000));
 assert.equal(floor.seconds,floor.nodes.reduce((n,x)=>n+x.seconds,0));
 const legacy=at(5,3,{encounterVersion:1,balanceVersion:1,growthVersion:1,economyVersion:1,storyVersion:1,focusVersion:1,segmentVersion:0,recordVersion:0});
 legacy.receipts=legacy.routes.flat().map(n=>n.id);
 assert.equal(fixedNodeSeconds(legacy,'treasure'),treasureStepSeconds(legacy)*3,'old runs quote their own pacing, not the new one');
 assert.ok(fixedTimeFloor(legacy).seconds>fixedTimeFloor(b).seconds);
 const parts=netTimeParts(b,floor.ms+12345);
 assert.equal(parts.fixedMs,floor.ms);assert.equal(parts.freeMs,12345);
 assert.equal(netTimeParts(b,floor.ms-5000).freeMs,0,'the free part never goes negative');
 assert.ok(fixedFloorSummary(floor).length>0);
});
void test('C-5 splits within a tenth of a second read as the same, and endless quotes the in-loop time',()=>{
 assert.equal(SAME_TIME_MS,100);
 assert.equal(sameDisplayedTime(0),true);
 assert.equal(sameDisplayedTime(99),true);
 assert.equal(sameDisplayedTime(-99),true);
 assert.equal(sameDisplayedTime(100),false);
 assert.equal(sameDisplayedTime(null),false);
 const splits=[{index:0,chapter:0,loop:0,endMs:1000,durationMs:1000},{index:1,chapter:1,loop:0,endMs:2500,durationMs:1500},{index:6,chapter:0,loop:1,endMs:4000,durationMs:1500}];
 assert.equal(loopBattleMs(splits,0),2500);
 assert.equal(loopBattleMs(splits,1),1500,'the second loop is measured inside that loop, not from the run start');
 assert.equal(loopBattleMs(splits,2),null);
 assert.equal(loopBattleMs(undefined,0),null);
 const review=src('ChapterReview.jsx'),result=src('ResultRecord.jsx');
 assert.match(review,/sameDisplayedTime\(delta\)\?'与同组最佳该章相同（差不足 0\.1 秒）'/);
 assert.match(result,/其中固定计时下限/);
 assert.match(result,/该圈圈内用时/);
});

// ---------------------------------------------------------------- C-6 原著一致性
void test('C-6 game-only story items are labelled and the treasure receipt settles the five-rings history',()=>{
 for(const id of ['lingxi','crystal']){const item=STORY_ITEMS.find(s=>s.id===id);assert.equal(item.canon,false);assert.match(item.canonNote,/游戏化设定/);}
 for(const id of ['swords','icepearl','weeping','five-rings','cape','cauldron']){const item=STORY_ITEMS.find(s=>s.id===id);assert.equal(item.canon,undefined,id+' keeps no canon flag');}
 assert.match(src('Game.jsx'),/item\.canon===false&&<Chip>\{item\.canonNote\|\|'游戏化设定'\}<\/Chip>/);
 const run={expedition:{receipts:['3:0']},storyInventory:['five-rings','cape'],relics:[]};
 const save={...initialSave(),unlocked:3,checkpoint:run},before=JSON.stringify(save);
 for(const id of ['five-rings','cape']){const state=catalogItemState(STORY_ITEMS.find(s=>s.id===id),save);assert.match(state.history,/已历经/);}
 const noReceipt={...save,checkpoint:{...run,expedition:{receipts:[]}}};
 for(const id of ['five-rings','cape'])assert.match(catalogItemState(STORY_ITEMS.find(s=>s.id===id),noReceipt).history,/尚未历经/);
 assert.match(catalogItemState(STORY_ITEMS.find(s=>s.id==='cauldron'),save).history,/尚未历经/,'the receipt only settles the two treasure-hall items');
 assert.equal(JSON.stringify(save),before,'the catalog read never writes back');
});

// ---------------------------------------------------------------- C-7 机缘经济
void test('C-7 the three cash outcomes of one event differ and the risky one pays more than the safe one',()=>{
 const b=battle();assert.equal(splitCashRewards(b),true);
 const options=cashOptionsFor(b,10);
 assert.deepEqual(options,{gold:10,skip:5,risk:20});
 assert.ok(options.risk>options.gold&&options.gold>options.skip,'risk > 领取灵石 > 继续前行');
 assert.equal(cashOptionsFor(b,0).skip,0);
 const rest={cashReserve:10,cashOptions:options};
 assert.equal(cashRewardFor(rest,'gold'),10);
 assert.equal(cashRewardFor(rest,'smallGold'),10);
 assert.equal(cashRewardFor(rest,'riskGold'),20);
 assert.equal(cashRewardFor(rest,'skip'),5);
 const legacy={cashReserve:10};
 for(const effect of ['gold','smallGold','riskGold','skip'])assert.equal(cashRewardFor(legacy,effect),10,'a rest saved before this batch keeps its single amount');
 const legacyEconomy=battle({economyVersion:1});
 assert.equal(splitCashRewards(legacyEconomy),false);
 assert.equal(cashOptionsFor(legacyEconomy,10),null,'economy 1–3 never gain the split');
});
void test('C-7 the split is written once per rest, is validated on restore and pays the amount it showed',()=>{
 const b=at(0,0);b.node.selected=0;b.beginNode();b.clearField();b.time=90;b.waveTime=90;b.completeNode();
 const rest=b.rest;assert.ok(rest.cashOptions,'an economy-4 rest records the split when it is created');
 assert.equal(rest.cashOptions.gold,rest.cashReserve);
 assert.equal(rest.cashOptions.skip,Math.floor(rest.cashReserve/2));
 assert.equal(rest.cashOptions.risk,rest.cashReserve*2);
 assert.match(b.singleEffectText('riskGold'),new RegExp('领取 '+rest.cashOptions.risk+' 灵石'));
 assert.match(b.singleEffectText('gold'),new RegExp('领取 '+rest.cashOptions.gold+' 灵石'));
 const gold=b.gold;b.applySingle('skip');
 assert.equal(b.gold-gold,rest.cashOptions.skip,'继续前行 pays exactly what it showed');
 const data=copy(b.serialize());
 assert.ok(Expedition.restore(copy(data)),'a well-formed split restores');
 const tampered=copy(data);tampered.expedition.rest.cashOptions.risk=999;
 assert.throws(()=>Expedition.restore(tampered),/机缘灵石份额/);
 const dropped=copy(data);delete dropped.expedition.rest.cashOptions;
 assert.ok(Expedition.restore(dropped),'a rest without the field is an older record and still restores');
});

// ---------------------------------------------------------------- C-8 过场与幻境
void test('C-8 the cleared-account cinematic skip is an account setting, defaults off and still advances formally',()=>{
 assert.equal(initialSave().settings.skipSeenAfterWin,false);
 assert.equal(normalizeSave({...initialSave(),settings:{...initialSave().settings,skipSeenAfterWin:'yes'}}).settings.skipSeenAfterWin,false,'a malformed value falls back to the default');
 assert.equal(normalizeSave({...initialSave(),settings:{...initialSave().settings,skipSeenAfterWin:true}}).settings.skipSeenAfterWin,true);
 const off=arena({settings:{skipSeenAfterWin:false}});off.cinematicSeen=[];off.accountCleared=true;off.playCinematic('bamboo','node');
 assert.equal(off.scene,'cinematic','with the switch off a cleared account still watches');
 const fresh=arena({settings:{skipSeenAfterWin:true}});fresh.cinematicSeen=[];fresh.accountCleared=false;fresh.playCinematic('bamboo','node');
 assert.equal(fresh.scene,'cinematic','an account with no clear still watches');
 const on=arena({settings:{skipSeenAfterWin:true}});on.cinematicSeen=[];on.cinematicHistory=[];on.accountCleared=true;on.playCinematic('bamboo','node');
 assert.notEqual(on.scene,'cinematic');
 assert.ok(on.cinematicSeen.includes('bamboo')&&on.cinematicHistory.includes('bamboo'),'the skip goes through advanceCinematic, so this run still records it as seen');
 assert.match(src('game.css'),/\.scene-cinematic \.panel-body>div\{margin-block:auto/,'cinematic body is centred instead of leaving half a screen blank');
});
void test('C-8 the illusion true-gate order is a pure function of the seed domain and never touches another generator',()=>{
 const a=illusionRun({seed:'gate-seed'}),z=illusionRun({seed:'gate-seed'});
 assert.equal(seededIllusionGates(a),true);
 assert.deepEqual(a.objective.gateOrder,z.objective.gateOrder,'same seed ⇒ same order');
 assert.deepEqual([...a.objective.gateOrder].sort((x,y)=>x-y),[0,1,2]);
 assert.equal(a.objective.trueGate,a.objective.gateOrder[0]);
 const other=illusionRun({seed:'gate-seed-other'});
 assert.deepEqual(other.objective.gateOrder,illusionGateOrder(other),'the order is reproducible from the seed alone');
 const orders=new Set();for(let i=0;i<40;i++)orders.add(illusionGateOrder({seed:'spread-'+i,node:{id:'3:1'}}).join());
 assert.ok(orders.size>1,'different seeds really do produce different orders');
 const probe=illusionRun({seed:'draw-check'});
 const rng=probe.rng.state(),content=probe.contentRng.state();
 illusionGateOrder(probe);illusionGateOrder(probe);
 assert.equal(probe.rng.state(),rng);assert.equal(probe.contentRng.state(),content);
 assert.deepEqual(illusionGateOrder({seed:'gate-seed',node:{id:'3:1'}}),a.objective.gateOrder);
});
void test('C-8 an encounter-8 illusion follows its order while every older run keeps chapter%3 → +1 → +2',()=>{
 const modern=illusionRun({seed:'order-walk'});const order=[...modern.objective.gateOrder];
 for(let step=0;step<2;step++){const q=modern.objective;assert.equal(q.trueGate,order[step]);enterGate(modern,order[step]);assert.equal(q.done,step+1);assert.equal(q.trueGate,order[step+1]);}
 for(const older of [{encounterVersion:7},{balanceVersion:3}]){
  const b=illusionRun({seed:'order-walk',...older});
  assert.equal(seededIllusionGates(b),false);
  assert.equal(b.objective.gateOrder,undefined,'no new field reaches an older run');
  assert.equal(b.objective.trueGate,b.chapter%3);
  const seen=[b.objective.trueGate];
  for(let step=0;step<2;step++){enterGate(b,seen[step]);seen.push(b.objective.trueGate);}
  assert.deepEqual(seen,[b.chapter%3,(b.chapter%3+1)%3,(b.chapter%3+2)%3]);
 }
 assert.equal(illusionTrueGate({trueGate:2,done:1}),0,'without gateOrder the old rotation is used verbatim');
});
void test('C-8 a snapshot saved before this batch restores with its own true gate and keeps rotating the old way',()=>{
 const b=illusionRun({seed:'legacy-restore'});
 const data=copy(b.serialize());
 delete data.expedition.objective.gateOrder;data.expedition.objective.trueGate=1;
 const restored=Expedition.restore(copy(data));
 assert.equal(restored.objective.gateOrder,undefined);
 assert.equal(restored.objective.trueGate,1);
 restored.clearField();restored.updateEnvironment=()=>{};
 enterGate(restored,1);
 assert.equal(restored.objective.done,1);
 assert.equal(restored.objective.trueGate,2,'an already-decided true gate keeps the (trueGate + 1) % 3 sequence');
 const again=copy(restored.serialize());
 assert.equal(Expedition.restore(again).objective.trueGate,2,'and it survives a second restore unchanged');
 const forged=copy(b.serialize());forged.expedition.objective.gateOrder=[0,0,1];
 assert.throws(()=>Expedition.restore(forged),/章节节奏记录无效/);
 const misaligned=copy(b.serialize());misaligned.expedition.objective.trueGate=(misaligned.expedition.objective.gateOrder[0]+1)%3;
 assert.throws(()=>Expedition.restore(misaligned),/章节节奏记录无效/);
 const legacyField=copy(b.serialize());legacyField.options.encounterVersion=7;
 assert.throws(()=>Expedition.restore(legacyField),/记录无效|无效/,'an older rule set may not carry the new field');
});

// ---------------------------------------------------------------- C-9 毒雾预警与固定步长
void test('C-9 the residual poison mist warning is drawing only: no timer, damage or i-frame changes',()=>{
 const art=src('art.js'),engine=src('engine.js');
 assert.match(art,/z\.kind==='poison'&&!z\.friendly&&z\.warn>0/);
 assert.match(art,/毒雾 · 即将扩散/);
 assert.match(engine,/ttl:4,warn:\.4,kind:'poison'/,'the mist keeps its 4 s life and 0.4 s warning');
 const b=battle();const zones=b.zones.length;
 b.zone?.(0,0,0,0);
 assert.equal(b.zones.length,zones);
});
void test('C-9 a frame at or below the step size is byte-identical to the single update it replaced',()=>{
 assert.equal(MAX_STEP,.05);assert.equal(MAX_SUBSTEPS,4);assert.equal(MAX_FRAME,.2);
 assert.deepEqual(frameSteps(0),[]);
 assert.deepEqual(frameSteps(-1),[]);
 assert.deepEqual(frameSteps(1/60),[1/60]);
 assert.deepEqual(frameSteps(.05),[.05]);
 assert.equal(frameSteps(.08).length,2);
 assert.equal(frameSteps(.2).length,4);
 assert.equal(frameSteps(5).length,MAX_SUBSTEPS,'a stalled tab is clamped to four sub-steps');
 for(const [dt,steps] of [[.08,frameSteps(.08)],[.2,frameSteps(.2)],[5,frameSteps(5)]]){
  assert.ok(Math.abs(steps.reduce((a,v)=>a+v,0)-Math.min(dt,MAX_FRAME))<1e-9,'the sub-steps add up to the clamped frame');
  assert.ok(steps.every(s=>s<=MAX_STEP+1e-12),'no sub-step is longer than the engine clamp');
  assert.ok(steps.every(s=>s>0));
  assert.ok(steps.every(s=>Math.abs(s-steps[0])<1e-12),'sub-steps are equal length');
 }
 const stepped=battle({seed:'c9-parity'}),direct=battle({seed:'c9-parity'});
 for(let i=0;i<180;i++){stepped.input.x=Math.sin(i)*.5;direct.input.x=Math.sin(i)*.5;stepBattle(stepped,1/60);direct.update(1/60);}
 assert.equal(JSON.stringify(stepped.serialize()),JSON.stringify(direct.serialize()));
});
void test('C-9 the same seed and input sequence give the same snapshot, and slow frames stop losing wall-clock time',()=>{
 const inputs=Array.from({length:120},(_,i)=>({x:Math.sin(i*.7),y:Math.cos(i*.4)}));
 const run=frames=>{const b=battle({seed:'c9-determinism'});for(let i=0;i<inputs.length;i++){b.input.x=inputs[i].x;b.input.y=inputs[i].y;stepBattle(b,frames[i%frames.length]);}return b;};
 assert.equal(JSON.stringify(run([1/60]).serialize()),JSON.stringify(run([1/60]).serialize()),'same seed + same input sequence ⇒ identical snapshot');
 assert.equal(JSON.stringify(run([.12,.03]).serialize()),JSON.stringify(run([.12,.03]).serialize()),'and it stays identical when slow frames are sub-stepped');
 const slow=battle({seed:'c9-clock'});const before=slow.time;
 stepBattle(slow,.16);
 assert.ok(Math.abs(slow.time-before-.16)<1e-9,'a 6.25 fps frame now advances battle time by the whole frame');
 const clamped=battle({seed:'c9-clock'});stepBattle(clamped,3);
 assert.ok(Math.abs(clamped.time-before-MAX_FRAME)<1e-9,'a stalled tab still advances at most one clamped frame');
 const legacy=battle({seed:'c9-clock'});legacy.update(.16);
 assert.ok(Math.abs(legacy.time-before-MAX_STEP)<1e-9,'the old single call is what used to drop the remaining 0.11 s');
 const paused=battle({seed:'c9-pause'});paused.pause();const at=paused.time;
 assert.deepEqual(stepBattle(paused,.16).length,4);
 assert.equal(paused.time,at,'a paused run still advances nothing, exactly as before');
});
