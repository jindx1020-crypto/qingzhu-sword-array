/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Round-2 ten-player remediation, batch A (A-1…A-10). Engine/save-level regressions plus source markers for UI-only packages.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {Expedition} from '../gameplay/expedition.js';import {initialSave} from '../gameplay/data.js';
import {beginPracticeStep,practiceFocusRelease,practiceFocusCleared} from '../gameplay/practice.js';
import {ENCOUNTER_VERSION,mechanismProfile,mechanismLimit,ordinaryCount,clearingCheckpoint} from '../gameplay/director-rules.js';
import {SaveVault,SaveError,SAVE_KEY,RAW_RECORD_LIMIT,appendRawRecord,rawHash,normalizeSave,recoveryPreview,historyDropCount} from '../gameplay/save-store.js';
import {withProgressRecord,recordGroup} from '../gameplay/records.js';import {CURRENT_RECORD_RULES} from '../gameplay/record-browser.js';
import {currentChallenge} from '../gameplay/experience-rules.js';import {emptySigilStreak} from '../gameplay/sigil-metrics.js';
const copy=structuredClone,src=name=>fs.readFileSync(new URL('../gameplay/'+name,import.meta.url),'utf8');
const DT=1/60;
function mechanism(kind,version=ENCOUNTER_VERSION,difficulty=0){const [chapter,wave,deadline]={treasure:[3,0,65],illusion:[3,1,65],ice:[5,2,40]}[kind];const events=[];const b=new Expedition({chapter,difficulty,seed:'batchA-'+kind,runId:'batchA-'+kind,encounterVersion:version,segmentVersion:0},e=>{if(e.type==='checkpoint')events.push({waveTime:b.waveTime,checkpoint:e.checkpoint});if(e.type==='toast')events.push({toast:e.text});});b.wave=wave;b.node.selected=0;b.beginNode();b.hitPlayer=()=>{};b.hit=()=>0;assert.equal(b.encounter.kind,kind);return {b,events,deadline};}
const runTo=(b,seconds)=>{while(b.waveTime<seconds&&b.modeState==='battle'){b.input={x:0,y:0,focus:false,aim:null};b.update(DT);}};
function drive(b,{stop=()=>b.finished,choice='none',onStep=()=>{}}={}){for(let i=0;i<2500&&!stop();i++){if(b.scene==='cinematic')b.advanceCinematic(true);else if(b.modeState==='intro'){const p=currentChallenge(b);if(p&&!p.started)b.chooseChallenge(choice==='offered'?p.offer:choice);b.start();}else if(b.modeState==='battle'){b.time+=10;b.waveTime+=10;b.completeNode();}else if(b.modeState==='choice')b.chooseTrait(b.choices[0].id);else if(b.scene==='intermission'){if(!b.rest.eventDone)b.chooseInteraction(b.eventText().choices.length-1);if(!b.rest.coreDone)b.skipCore();if(!b.rest.routeDone)b.chooseRoute(0);b.continueRest();}else throw Error('unexpected '+b.scene);onStep(b);}assert.ok(stop());return b;}

// ---------- A-1 serialize() no longer shares live statistics ----------
void test('A-1 serialize() detaches damage/fire/sigil/hit statistics; later battle changes leave the snapshot valid and unchanged',()=>{
 const b=new Expedition({seed:'a1-snapshot',path:4,difficulty:1});b.beginNode();b.clearField();b.player.invuln=0;b.hitPlayer(3,false,{name:'来袭',kind:'近身'});assert.equal(b.recentHits.length,1);
 const snap=b.serialize(),json=JSON.stringify(snap);
 for(const key of ['damageSources','fireBreakdown','sigilStats','recentHits','traits','relics','consumables','storyInventory'])assert.notEqual(snap[key],b[key],key+' must not share a reference');
 assert.notEqual(snap.sigilStats.recent,b.sigilStats.recent);assert.notEqual(snap.player.buffs,b.player.buffs);
 for(let i=0;i<120;i++){if(i%30===0){b.player.invuln=0;b.hitPlayer(2,false,{name:'复核受击',kind:'近身'});}b.input={x:1,y:0,focus:false,aim:null};b.update(DT);}
 b.damageSources.sword+=50;b.fireBreakdown.sigil+=5;b.sigilStats.sigil.casts++;b.recentHits[0].name='改写';b.player.buffs.speed=99;b.traits['sword-0']=3;
 assert.equal(JSON.stringify(snap),json);assert.equal(snap.recentHits.length,1);
 assert.doesNotThrow(()=>normalizeSave({...initialSave(),checkpoint:copy(snap)}));
});

// ---------- A-2 help reader on small screens (UI markers; measured in browser-results.json) ----------
void test('A-2 quick reference collapses below 700x480 and the help body takes the remaining dialog height',()=>{
 const reader=src('HelpReader.jsx'),css=src('game.css');
 assert.match(reader,/matchMedia\('\(min-height:700px\) and \(min-width:480px\)'\)\.matches/);assert.match(reader,/<details className="help-quick" open=\{quickOpen\} onToggle=/);
 assert.match(css,/@media\(max-width:480px\),\(max-height:700px\)\{\.help-dialog\{overflow:auto!important\}[^\n]*\.help-layout\{height:auto;flex:1 1 auto;min-height:0\}/);
 assert.match(css,/\.help-quick\{flex-shrink:0;max-height:22dvh;overflow:auto\}/);
});

// ---------- A-3 practice step 5 completes only on a real release ----------
void test('A-3 system clearAim/pause never completes step 5; only the player release after focusing does',()=>{
 const b=new Expedition({mode:'training',path:5,seed:'a3-practice',guidedPractice:true});b.start();while(b.scene==='cinematic')b.advanceCinematic(true);beginPracticeStep(b,4);
 for(let i=0;i<30;i++){b.input={x:0,y:0,focus:true,aim:{x:640,y:300}};b.update(DT);}
 assert.equal(b.practice.sawFocus,true);assert.equal(b.practice.ready,false);
 b.pause();practiceFocusCleared(b);b.input.focus=false;b.input.aim=null;b.resume();for(let i=0;i<10;i++)b.update(DT);
 assert.equal(b.practice.ready,false);assert.equal(b.practice.sawFocus,false);
 practiceFocusRelease(b);for(let i=0;i<5;i++)b.update(DT);assert.equal(b.practice.ready,false,'release without a new focus does not count');
 for(let i=0;i<10;i++){b.input={x:0,y:0,focus:true,aim:{x:640,y:300}};b.update(DT);}practiceFocusRelease(b);b.input.focus=false;b.update(DT);
 assert.equal(b.practice.focusReleased,true);assert.equal(b.practice.ready,true);
 const game=src('Game.jsx');assert.match(game,/practiceFocusCleared\(run\);run\.input\.focus=false/);assert.match(game,/practiceFocusRelease\(b\);b\.input\.focus=false/);assert.match(game,/function releaseAim\(\)/);
});

// ---------- A-4 pause and summary buttons use the pointer path ----------
void test('A-4 pause and summary buttons are CombatButtons; CombatButton keeps the styled element',()=>{
 const game=src('Game.jsx'),button=src('CombatButton.jsx');
 assert.match(game,/<CombatButton as=\{Btn\} trigger="up" variant="outline" onAction=\{\(\)=>b\.pause\(\)\} aria-label="暂停">Ⅱ<\/CombatButton>/);
 assert.match(game,/<CombatButton className="hud-summary-button" trigger="up" onAction=/);assert.match(button,/const releaseAndAct=e=>\{if\(!pressed\.current\.delete\(e\.pointerId\)\|\|trigger!=='up'/);assert.doesNotMatch(game,/<Btn variant="outline" onClick=\{\(\)=>b\.pause\(\)\} aria-label="暂停">/);
 assert.match(button,/as:Tag='button'/);assert.match(button,/<Tag \{\.\.\.props\} disabled=\{disabled\} onPointerDown=/);
});

// ---------- A-5 fault dialogs keep the browser error name; unreadable primary offers a visible new-run path ----------
void test('A-5 storage failures keep the original error as cause; home and dialogs expose context-specific actions',()=>{
 const map=new Map([[SAVE_KEY,JSON.stringify({...initialSave(),insight:5})]]);let quota=false;const storage={getItem:k=>map.get(k)??null,setItem(k,v){if(quota&&k===SAVE_KEY){const e=new Error('quota');e.name='QuotaExceededError';throw e;}map.set(k,v);},removeItem:k=>map.delete(k)};
 const vault=new SaveVault(storage);const save=vault.load();quota=true;
 try{vault.commit({...save,insight:6});assert.fail('commit must fail');}catch(error){assert.ok(error instanceof SaveError);assert.equal(error.code,'storage');assert.equal(error.cause?.name,'QuotaExceededError');}
 assert.equal(JSON.parse(map.get(SAVE_KEY)).insight,5);
 const game=src('Game.jsx');
 assert.match(game,/recoveryInfo\.issue\?<><Btn className="primary-start" onClick=\{openSettings\}>处理待恢复记录 →<\/Btn><Btn className="new-journey" variant="outline" onClick=\{preserveAndStart\}>保留原文并开启新历练/);
 assert.match(game,/function preserveAndStart\(\)\{[^\n]*recovery:true[^\n]*run:\(\)=>\{exportRecovery\(\);setPage\('journey'\);\}/);
 assert.match(game,/description:error\.message\+\(name\?'（浏览器报告：'\+name\+'）':''\)/);assert.match(game,/exportLabel:frozen\?'导出本次待保存记录':undefined,onExport:frozen\?\(\)=>exportRecord\(frozen\):undefined/);
 assert.match(game,/const idle=!battleRef\.current&&!pendingSaveRef\.current;/);assert.match(game,/\{risk\?\.footnote\|\|\(risk\?\.kind==='equipment'/);assert.match(game,/onClick=\{risk\?\.onExport\|\|\(risk\?\.recovery\?exportRecovery:exportSave\)\}>\{risk\?\.exportLabel\|\|/);
 assert.match(game,/const frozen=next\?structuredClone\(next\):null;/);
 // restoreProfileOnly now adopts the readable long-term part of a corrupt primary.
 const broken={...initialSave(),insight:9,checkpoint:{version:1,options:{rulesVersion:3},chapter:'bad'}};const map2=new Map([[SAVE_KEY,JSON.stringify(broken)]]);const vault2=new SaveVault({getItem:k=>map2.get(k)??null,setItem:(k,v)=>map2.set(k,v),removeItem:k=>map2.delete(k)});
 assert.throws(()=>vault2.load(),e=>e.code==='invalid');assert.equal(vault2.corrupt,true);const candidate=vault2.recoveryCandidates().find(c=>c.id==='primary'&&c.save);assert.ok(candidate);assert.deepEqual(candidate.discarded,['checkpoint']);assert.equal(candidate.save.insight,9);
 assert.match(game,/function restoreProfileOnly\(\)\{refreshRecovery\(\);const candidate=vaultRef\.current\?\.recoveryCandidates\(\)\.find\(c=>c\.id==='primary'&&c\.save\);if\(candidate\)\{adoptRecovery\(candidate\);return;\}/);
});

// ---------- A-6 isolated raw records are bounded, deduplicated, clearable with confirmation ----------
function recoveryVault(){const map=new Map([[SAVE_KEY,JSON.stringify({...initialSave(),insight:1})]]);let failRemove=false;const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem(k){if(failRemove){const e=new Error('remove');e.name='QuotaExceededError';throw e;}map.delete(k);}};const vault=new SaveVault(storage);vault.load();return {map,vault,setFailRemove:v=>{failRemove=v;}};}
void test('A-6 isolation is deduplicated and stops recovery before evicting any of its 12 raw records',()=>{
 const {map,vault,setFailRemove}=recoveryVault();let blocked=false;
 for(let n=0;n<20;n++){
  const sourceRaw=JSON.stringify({...initialSave(),insight:100+n}),before=vault.snapshot();
  try{vault.adoptRecovery(JSON.parse(sourceRaw),{expectedSnapshot:before,sourceRaw});}
  catch(error){assert.equal(error.code,'raw-capacity');assert.deepEqual(vault.snapshot(),before);blocked=true;break;}
  const records=vault.rawRecords();assert.ok(records.length<=RAW_RECORD_LIMIT);assert.equal(new Set(records.map(r=>r.raw)).size,records.length);for(const r of records)assert.equal(r.hash,rawHash(r.raw));
 }
 assert.equal(blocked,true);assert.equal(vault.rawRecords().length,RAW_RECORD_LIMIT);
 const same=vault.rawRecords(),bytes=JSON.stringify(same);assert.equal(appendRawRecord(same,same[0].raw).length,RAW_RECORD_LIMIT);
 assert.throws(()=>appendRawRecord(same,'new distinct raw'),e=>e.code==='raw-capacity');assert.equal(JSON.stringify(same),bytes);
 const before=vault.snapshot();setFailRemove(true);assert.throws(()=>vault.clearRawRecords(before),e=>e.code==='storage'&&e.cause?.name==='QuotaExceededError');assert.deepEqual(vault.snapshot(),before);
 setFailRemove(false);assert.equal(vault.clearRawRecords(before),RAW_RECORD_LIMIT);assert.equal(vault.rawRecords().length,0);assert.equal(map.get(SAVE_KEY),before.primary);
 const game=src('Game.jsx');assert.match(game,/function clearIsolated\(\)[\s\S]*?showRisk\(\{recovery:true,title:'清理 '\+records\.length\+' 份隔离原文？'/);assert.match(game,/<Btn variant="outline" onClick=\{clearIsolated\}>清理隔离原文/);
});

// ---------- A-7 encounter 8: one checkpoint when mechanism reinforcements stop ----------
for(const kind of ['treasure','illusion','ice'])void test('A-7 '+kind+': encounter 8 saves once at the deadline, restore keeps the timer and adds no enemies; 7 keeps its old behaviour',()=>{
 const {b,events,deadline}=mechanism(kind,8);assert.equal(b.options.encounterVersion,8);assert.equal(b.objective.clearingSaved,false);
 runTo(b,deadline+3);const saves=events.filter(e=>e.checkpoint&&e.waveTime>0);assert.equal(saves.length,1);assert.ok(saves[0].waveTime>=deadline&&saves[0].waveTime<deadline+.1);assert.equal(saves[0].checkpoint.expedition.objective.clearingSaved,true);assert.ok(events.some(e=>e.toast==='增援已止 · 完成机关目标后离开'));assert.match(b.objectiveText(),/增援已止/);
 const restored=Expedition.restore(copy(saves[0].checkpoint));restored.hitPlayer=()=>{};restored.hit=()=>0;const restoredEvents=[];restored.emit=e=>{if(e.type==='checkpoint'||e.type==='toast')restoredEvents.push(e);};
 const waveTime=restored.waveTime,count=ordinaryCount(restored);assert.ok(waveTime>=deadline);runTo(restored,waveTime+5);assert.equal(ordinaryCount(restored)<=count,true,'no new enemies after restore');assert.ok(restored.waveTime>=waveTime+5-1e-6,'timer continues instead of restarting');assert.equal(restoredEvents.length,0,'neither a second checkpoint nor a repeated toast');
 const bad=copy(saves[0].checkpoint);bad.expedition.waveTime=deadline-5;assert.throws(()=>Expedition.restore(bad),/节奏/);const missing=copy(saves[0].checkpoint);delete missing.expedition.objective.clearingSaved;assert.throws(()=>Expedition.restore(missing),/节奏/);
 const old=mechanism(kind,7);runTo(old.b,deadline+3);assert.equal(old.events.filter(e=>e.checkpoint&&e.waveTime>0).length,0);assert.equal(old.b.objective.clearingSaved,undefined);assert.match(old.b.objectiveText(),/增援已止/);const stale=copy(old.b.serialize());stale.expedition.objective.clearingSaved=true;assert.throws(()=>Expedition.restore(stale),/节奏/);
});
void test('A-7 encounter 8 inherits 7 entirely: routes, RNG, profile 6, illusion return protection; old markers restore unchanged and records group by version',()=>{
 // Batch A semantics: on balance 3 an encounter-8 run keeps profile 6 exactly (batch B extends encounter 8 only for balance-4 runs).
 const a=new Expedition({seed:'inherit',chapter:3,encounterVersion:7,recordVersion:0,balanceVersion:3}),b=new Expedition({seed:'inherit',chapter:3,encounterVersion:8,recordVersion:0,balanceVersion:3});
 assert.deepEqual(a.routes,b.routes);assert.equal(a.contentRng.state(),b.contentRng.state());for(const e of [a,b]){e.wave=1;e.node.selected=0;e.beginNode();}assert.deepEqual(mechanismProfile(a),mechanismProfile(b));assert.equal(mechanismLimit(a),mechanismLimit(b));assert.equal(a.spawnBudget,b.spawnBudget);assert.equal(a.nextElite,b.nextElite);
 b.clearField();b.waveTime=7;b.time+=7;b.player.invuln=0;b.player.shield=0;const g=b.objective.gates[b.objective.trueGate];b.player.x=g.x;b.player.y=g.y;const e=b.spawn(4,{x:640,y:560,hp:100000,speed:0});e.x=640;e.y=560;e.spawn=0;const hp=b.player.hp;b.update(DT);assert.equal(b.objective.done,1);assert.equal(b.player.hp,hp,'0.45s return protection kept under 8');assert.ok(b.objective.returnProtectedUntil>b.time);
 assert.equal(clearingCheckpoint(b),true);assert.equal(clearingCheckpoint(a),false);assert.equal(new Expedition().options.encounterVersion,8);assert.equal(ENCOUNTER_VERSION,8);assert.equal(CURRENT_RECORD_RULES.encounterVersion,8);
 for(const version of [1,5,6,7]){const old=new Expedition({encounterVersion:version}).serialize();assert.equal(Expedition.restore(old).options.encounterVersion,version);}const legacy=new Expedition({encounterVersion:1}).serialize();delete legacy.options.encounterVersion;assert.equal(Expedition.restore(legacy).options.encounterVersion,1);const unknown=new Expedition().serialize();unknown.options.encounterVersion=99;assert.throws(()=>Expedition.restore(unknown),/版本/);
 const entry=r=>({mode:'story',difficulty:1,path:0,rules:{...CURRENT_RECORD_RULES,encounterVersion:r},touchLockUsed:false,segmentVersion:1,challengeVersion:0,challengeChoices:[]});assert.notEqual(recordGroup(entry(7)),recordGroup(entry(8)));
});

// ---------- A-8 targets killed during arming are 'cleared', not a pure miss ----------
function sigilRun(){const b=new Expedition({seed:'a8-cleared',path:4,difficulty:1,segmentVersion:0});b.beginNode();b.clearField();b.enemies.length=0;b.zones.length=0;b.shots.length=0;b.player.x=640;b.player.y=400;return b;}
function placeSigil(b){b.player.x=640;b.player.y=400;b.player.dashCD=0;b.player.dash=0;b.input={x:1,y:0,focus:false,aim:null};const before=b.zones.length;b.dash();b.player.dash=0;b.player.x=640;b.player.y=400;const z=b.zones.slice(before).find(z=>z.sigil);assert.ok(z,'sigil placed');return z;}
function dummy(b,x,y){const e=b.spawn(4,{x,y,hp:1e6,speed:0,noDrop:true});e.x=x;e.y=y;e.speed=0;e.ai='idle';b.rebuildHash();return e;}
const step=(b,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++){b.input={x:0,y:0,focus:false,aim:null};b.update(DT);}};
void test('A-8 armed targets killed by swords before arming ends mark the burst cleared; three in a row never raise the teaching cue and do not reset a real streak',()=>{
 const b=sigilRun();b.updateSwords=()=>{};b.updateAllies=()=>{};b.updateDirector=()=>{};
 for(let n=0;n<3;n++){const e=dummy(b,640,400);const z=placeSigil(b);assert.equal(z.armedTargets,1);assert.equal(z.arming,.35);step(b,.1);b.hit(e,1e9,'sword');assert.ok(e.hp<=0);b.enemies=b.enemies.filter(v=>v.hp>0);b.rebuildHash();step(b,.3);assert.equal(z.cleared,true);step(b,2.6);assert.equal(z.fired,true);const record=b.sigilStats.recent.at(-1);assert.equal(record.cleared,true);assert.equal(record.hits,0);assert.equal(emptySigilStreak(b.sigilStats),0);assert.ok(!b.combatCues.some(c=>c.key==='sigil-tip'));assert.ok(b.combatCues.some(c=>c.key==='sigil-cleared'));b.lastSigil=b.time-7;}
 const tips=()=>b.combatCues.filter(c=>c.key==='sigil-tip').length;for(let n=0;n<3;n++){const z=placeSigil(b);assert.equal(z.armedTargets,0);step(b,3);assert.equal(z.fired,true);assert.equal(z.cleared,undefined);b.lastSigil=b.time-7;}assert.equal(emptySigilStreak(b.sigilStats),3);assert.equal(tips(),1,'a real third miss still teaches once');
 const snap=copy(b.serialize());assert.doesNotThrow(()=>Expedition.restore(snap));assert.doesNotThrow(()=>normalizeSave({...initialSave(),checkpoint:copy(snap)}));const cleared=snap.sigilStats.recent.filter(r=>r.cleared).length;assert.equal(cleared,3);assert.equal(Expedition.restore(copy(snap)).sigilStats.recent.filter(r=>r.cleared).length,3);
 for(const mutate of [s=>{s.sigilStats.recent[0].cleared=false;},s=>{s.sigilStats.recent[0].cleared=1;},s=>{s.sigilStats.recent[3].kind='echo';s.sigilStats.echo.casts++;s.sigilStats.echo.empty++;s.sigilStats.sigil.casts--;s.sigilStats.sigil.empty--;s.sigilStats.recent[3].cleared=true;}]){const bad=copy(snap);mutate(bad);assert.throws(()=>Expedition.restore(bad),/符阵/);}
 // A target that walks out alive (no kill) is still a plain miss.
 const c=sigilRun();c.updateSwords=()=>{};c.updateAllies=()=>{};c.updateDirector=()=>{};const e=dummy(c,640,400);const z=placeSigil(c);assert.equal(z.armedTargets,1);step(c,.1);e.x=1200;e.y=700;c.rebuildHash();step(c,3);assert.equal(z.fired,true);assert.equal(z.cleared,undefined);assert.equal(emptySigilStreak(c.sigilStats),1);
});

// ---------- A-9 elite timer keeps moving while the live cap holds (8 only); ice text never exceeds 40 ----------
void test('A-9 under 8 a capped elite is deferred so lifting the cap never spawns it in the same frame and the next one waits at least half an interval; 7 keeps the immediate pay-out',()=>{
 const results={};
 for(const version of [7,8]){const {b}=mechanism('treasure',version,0);b.updateEnvironment=()=>{};const limit=mechanismLimit(b),interval=mechanismProfile(b).eliteInterval;runTo(b,12);
  while(ordinaryCount(b)<limit){const e=b.spawn(0,{x:100+Math.random()*1000,y:100+Math.random()*500});if(!e)break;}assert.equal(ordinaryCount(b),limit);b.enemies=b.enemies.filter(e=>!e.elite);b.rebuildHash();
  const due=b.nextElite;b.waveTime=due-1;b.time=due-1;const before=b.enemies.filter(e=>e.elite).length;let minGap=Infinity;runTo(b,due+20);for(let i=0;i<5;i++){b.update(DT);minGap=Math.min(minGap,b.nextElite-b.waveTime);}
  const elitesWhileCapped=b.enemies.filter(e=>e.elite).length-before;
  for(const e of b.enemies)if(!e.elite&&!e.mission){e.hp=0;e.dead=true;}b.enemies=b.enemies.filter(e=>e.hp>0);b.rebuildHash();const lifted=b.waveTime;b.update(DT);const sameFrame=b.enemies.filter(e=>e.elite).length-before;
  let spawnedAt=null;while(b.waveTime<lifted+interval+1&&spawnedAt===null){for(const e of b.enemies)if(!e.elite&&!e.mission){e.hp=0;e.dead=true;}b.enemies=b.enemies.filter(e=>e.hp>0);b.rebuildHash();b.update(DT);if(b.enemies.filter(e=>e.elite).length>before)spawnedAt=b.waveTime;}
  results[version]={elitesWhileCapped,sameFrame,gap:spawnedAt===null?null:spawnedAt-lifted,minGap};}
 assert.equal(results[8].elitesWhileCapped,0);assert.equal(results[8].sameFrame,0);assert.ok(results[8].gap!==null&&results[8].gap>=mechanismProfile({options:{encounterVersion:8}}).eliteInterval/2-2*DT,JSON.stringify(results));assert.ok(results[8].minGap>=mechanismProfile({options:{encounterVersion:8}}).eliteInterval/2-2*DT);
 assert.equal(results[7].elitesWhileCapped,0);assert.equal(results[7].sameFrame,1,'7 still pays the deferred elite in the frame the cap lifts');
 const ice=mechanism('ice',8);runTo(ice.b,45);assert.match(ice.b.baseObjectiveText(),/^40 \/ 40 秒/);const oldIce=mechanism('ice',7);runTo(oldIce.b,45);assert.match(oldIce.b.baseObjectiveText(),/^40 \/ 40 秒/);
});

// ---------- A-10 history drops are reported; completed-loop choice tampering is rejected and isolated ----------
void test('A-10 recovery preview reports dropped history entries instead of silently filtering them',()=>{
 const good={...initialSave(),insight:3,history:[{time:5,kills:1,path:0,mode:'story',won:false},{bad:true},null,{time:'x',kills:1,path:0}]};
 assert.equal(historyDropCount(good),3);const preview=recoveryPreview(JSON.stringify(good));assert.equal(preview.status,'完整可读');assert.equal(preview.historyDropped,3);assert.equal(preview.save.history.length,1);
 const many={...initialSave(),history:Array.from({length:34},(_,i)=>({time:i,kills:i,path:0,mode:'story'}))};assert.equal(recoveryPreview(JSON.stringify(many)).historyDropped,4);assert.equal(recoveryPreview(JSON.stringify(initialSave())).historyDropped,0);
 assert.match(src('RecoveryPanel.jsx'),/历史丢弃 \{c\.historyDropped\} 条/);assert.match(src('Game.jsx'),/candidate\.historyDropped\?'历史记录丢弃 '\+candidate\.historyDropped\+' 条无效条目/);
});
void test('A-10 a continuing endless run whose completed-loop challenge choice was rewritten is rejected by normalizeSave and isolated by the preview',()=>{
 let save=initialSave();const b=new Expedition({mode:'endless',seed:'a10-tamper',difficulty:1});b.emit=e=>{if(e.type==='checkpoint')save=normalizeSave({...withProgressRecord(save,b.summary()),checkpoint:e.checkpoint});};
 drive(b,{stop:()=>b.endlessLoop===2,choice:'offered'});const witness=save.records.entries.find(r=>r.loops===2);assert.ok(witness);assert.equal(witness.runId,b.runId);assert.notEqual(witness.challengeChoices[1],'none');
 assert.doesNotThrow(()=>normalizeSave(copy(save)));assert.equal(recoveryPreview(JSON.stringify(save)).status,'完整可读');
 for(const loop of [1]){const bad=copy(save);const p=bad.checkpoint.expedition.challenges[loop];p.choice=p.choice==='none'?p.offer:'none';assert.throws(()=>normalizeSave(copy(bad)),/挑战选择与本机成绩不符/);const preview=recoveryPreview(JSON.stringify(bad));assert.equal(preview.status,'可恢复长期进度');assert.ok(preview.discarded.includes('checkpoint'));assert.equal(preview.save.records.entries.length,save.records.entries.length,'long-term records are kept intact');}
 const swapped=copy(save);swapped.checkpoint.expedition.challenges[0].choice='none';assert.doesNotThrow(()=>normalizeSave(copy(swapped)),'loop 0 is always none and unchanged');
});
