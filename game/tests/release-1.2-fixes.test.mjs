/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// 1.2 review fixes: engine, expedition and vault regressions on the real modules, plus source markers for UI-only flows.
// The UI flows are also exercised with real pointer, touch and keyboard input in scripts/qa-release-1.2-browser.mjs.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {Expedition} from '../gameplay/expedition.js';import {restoreRun} from '../gameplay/run-factory.js';import {beginPracticeStep} from '../gameplay/practice.js';
import {choiceChain} from '../gameplay/experience-hints.js';import {TRAITS,RELICS} from '../gameplay/data.js';import {STORY_ITEMS} from '../gameplay/journal.js';import {supplyState} from '../gameplay/late-supply.js';
import {SaveVault,SAVE_KEY} from '../gameplay/save-store.js';
const src=name=>fs.readFileSync(new URL('../gameplay/'+name,import.meta.url),'utf8');
const memory=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
const copy=x=>JSON.parse(JSON.stringify(x));
const quiet=b=>{b.cinematicSeen=['bamboo'];b.start();if(b.cinematic)b.advanceCinematic(true);b.clearField();b.updateDirector=()=>{};b.updateEnvironment=()=>{};b.swords=[];b.syncSwords=()=>{};return b;};
// Drives a run to the named intermission: battles settle at once, other rests take a fixed policy.
function toRest(b,node,choose){
 for(let guard=0;guard<300000&&!(b.scene==='intermission'&&b.rest?.node===node);guard++){
  if(b.scene==='intermission'&&b.rest){choose(b.rest);if(!b.rest.coreDone)b.skipCore();if(!b.rest.routeDone)b.chooseRoute(0);b.continueRest();continue;}
  if(b.modeState==='battle'){b.completeNode();continue;}
  if(b.scene==='cinematic'){b.advanceCinematic(true);continue;}
  if(b.modeState==='intro'){b.start();continue;}
  if(b.modeState==='choice'){b.chooseTrait(b.choices[0].id);continue;}
  if(b.modeState==='pause'){b.resume();continue;}
  b.update(1/60);
 }
 assert.equal(b.rest?.node,node);
}

void test('practice step 3 puts target B left of Han Li, farther than A and inside sword range, clear of the right-docked panel',()=>{
 const b=new Expedition({mode:'training',guidedPractice:true,path:0,seed:'p12',runId:'p12'});b.beginNode();beginPracticeStep(b,2);
 const A=b.enemies.find(e=>e.name.startsWith('A ·')),B=b.enemies.find(e=>e.name.startsWith('B ·')),p=b.player,d=e=>Math.hypot(e.x-p.x,e.y-p.y);
 assert.deepEqual([B.x,B.y],[430,560]);assert.ok(A.x<p.x&&B.x<p.x,'both targets sit on the side away from the instruction panel');
 assert.ok(d(A)<d(B),'A stays the near target');assert.ok(d(B)<320,'B is inside the sword acquisition radius');
 assert.ok(Math.hypot(A.x-B.x,A.y-B.y)>A.r+B.r+28,'aiming at B cannot also satisfy A');
});

void test('a chain cash ending pays exactly the amount its choice shows, and the opening choices name their immediate effect',()=>{
 const b=new Expedition({seed:'h4',runId:'audit-run',path:0,difficulty:0});
 const play=r=>{if(r.event?.type==='chain'&&r.event.stage==='start'&&!r.eventDone)b.chooseInteraction(0);else if(r.event&&!r.eventDone)b.chooseInteraction(2);};
 toRest(b,'0:0',play);assert.equal(b.rest.event.type,'chain');const opening=b.eventText().choices;
 assert.match(opening[0],/本次回复 8% 生命/);assert.match(opening[1],/本次回复 15 灵力/);
 b.chooseInteraction(0);b.skipCore();b.chooseRoute(0);b.continueRest();
 toRest(b,'1:0',play);assert.equal(b.rest.event.stage,'end');const shown=Number(b.eventText().choices[1].match(/领取 (\d+) 灵石/)[1]);
 assert.equal(shown,Math.floor(b.rest.cashReserve*.8),'a rest-leaning opening pays 80% and says so');
 const before=b.gold;b.chooseInteraction(1);b.skipCore();if(!b.rest.routeDone)b.chooseRoute(0);assert.equal(b.commitRestSelections(),true);assert.equal(b.gold-before,shown);
});

void test('the choice summary starts from the same balance-gated value the engine summed, and names a first choice plainly',()=>{
 const b=new Expedition({path:1,difficulty:1,seed:'h7-thunder-1',runId:'h7'});b.start();if(b.cinematic)b.advanceCinematic(true);
 assert.equal(choiceChain(b).last,'本局首次悟道');
 b.queuedChoices=1;b.openChoices();b.choices[2]=TRAITS.find(t=>t.id==='thunder-1');b.chooseTrait('thunder-1');
 assert.equal(b.options.balanceVersion,4);assert.equal(b.stats.thunderDamage,.4);assert.match(choiceChain(b).gain,/神雷伤害 \+0% → 神雷伤害 \+40%/);
});

void test('a late supply that would restore less than one point counts as full and charges nothing',()=>{
 const stub=(hp,shield=0)=>({options:{economyVersion:4},rest:{node:'4:0'},scene:'intermission',economy:{supplyPurchases:[]},endlessLoop:0,gold:200,player:{hp,maxHp:152,shield,maxShield:20}});
 assert.equal(supplyState(stub(151.97),'hp').reason,'full');assert.equal(supplyState(stub(151),'hp').ready,true);
 assert.equal(supplyState(stub(152,31.5),'shield').reason,'full');assert.equal(supplyState(stub(152,31),'shield').ready,true);
});

void test('a restored endless run multiplies loop difficulty exactly like continuous play',()=>{
 const b=new Expedition({mode:'endless',difficulty:2,seed:'h3b',runId:'h3b',recordVersion:0});
 for(let i=0;i<5;i++){b.chapter=5;b.wave=3;b.nextChapter();b.chooseChallenge('none');b.start();if(b.cinematic)b.advanceCinematic(true);b.clearField();b.showScene('intro','intro');b.growth.ledger=null;b.directorState=null;b.pursuitState=null;b.objective=null;b.mechanism=null;b.boss=null;b.waveTime=0;}
 const c=restoreRun(copy(b.serialize()));assert.equal(c.endlessLoop,5);assert.equal(c.difficulty.hp,b.difficulty.hp);assert.equal(c.difficulty.damage,b.difficulty.damage);
});

void test('after a hostile zone ends the run, later zones in the same sweep settle no kill or drop',()=>{
 const b=quiet(new Expedition({seed:'postdeath',runId:'pd',path:4,difficulty:1}));Object.assign(b.player,{x:300,y:300,hp:1,shield:0,invuln:0,revived:true});b.stats.revive=0;
 const e=b.spawn(0,{x:900,y:500,hp:.5,spawn:0,stun:10});Object.assign(e,{x:900,y:500});
 b.zones=[{x:300,y:300,r:60,ttl:1,warn:-.1,kind:'blast',damage:50,origin:{name:'test blast',x:300,y:300}},{x:900,y:500,r:60,ttl:1,warn:0,kind:'fire',friendly:true,damage:100}];
 const kills=b.kills;b.update(1/60);assert.equal(b.finished,true);assert.equal(b.kills,kills);assert.ok(e.hp>0);assert.equal(b.drops.length,0);
});

void test('optional damage numbers stop at 120 effects so key tactical labels keep their slots',()=>{
 const b=quiet(new Expedition({seed:'numbers',runId:'n12',path:4,difficulty:1,settings:{numbers:true}}));b.player.invuln=1e9;
 for(let i=0;i<14;i++){const x=500+(i%7)*30,y=380+Math.floor(i/7)*30,e=b.spawn(4,{x,y,hp:1e7,spawn:0,speed:0});Object.assign(e,{x,y,stun:1e3});}
 b.zones.push({x:590,y:395,r:140,ttl:30,warn:0,kind:'fire',friendly:true,damage:40});for(let i=0;i<60;i++)b.update(1/60);assert.ok(b.fx.length<=120);
 b.zones.push({x:590,y:395,r:85,ttl:.5,warn:.0001,fuseDuration:1.8,kind:'sigil',friendly:true,sigil:true,damage:300});b.update(1/60);
 assert.ok(b.fx.some(f=>f.key&&/主符爆发/.test(f.text)),'the main-sigil label still appears');
});

void test('a recovery preview older than a later write by this page is stale, a write by another window is a conflict, and neither touches storage',()=>{
 const storage=memory(),vault=new SaveVault(storage);let save=vault.load();save=vault.commit({...save,insight:3},{backup:true});
 const preview=vault.snapshot();save=vault.commit({...save,settings:{...save.settings,music:.2}});
 let before=JSON.stringify(vault.snapshot());assert.throws(()=>vault.adoptRecovery({...save,insight:9},{expectedSnapshot:preview}),e=>e.code==='stale-preview');assert.equal(JSON.stringify(vault.snapshot()),before);
 storage.setItem(SAVE_KEY,JSON.stringify({...JSON.parse(storage.getItem(SAVE_KEY)),insight:50}));const later=vault.snapshot();before=JSON.stringify(later);
 assert.throws(()=>vault.adoptRecovery({...save,insight:9},{expectedSnapshot:later}),e=>e.code==='conflict');assert.equal(JSON.stringify(vault.snapshot()),before);
});

void test('the save revision wraps inside the bound normalizeSave enforces, so an imported edge value never yields an unloadable save',()=>{
 const storage=memory(),vault=new SaveVault(storage),out=vault.commit({...vault.load(),revision:1e15});
 assert.equal(out.revision,1);assert.doesNotThrow(()=>new SaveVault(storage).load());
});

void test('UI-only 1.2 flows keep their source markers',()=>{
 const game=src('Game.jsx'),panel=src('ExpeditionPanel.jsx'),css=src('game.css'),help=src('HelpReader.jsx');
 // Pending chain: checks read the record persist() builds on; garden and supply hand over updaters; a retried result is marked saved.
 assert.match(game,/function baseSave\(\)\{return pendingSaveRef\.current\?\.next\|\|saveRef\.current;\}/);assert.match(game,/function unlockMeta\(m\)\{const s=baseSave\(\);/);
 assert.equal(game.split('onChange={update=>persist(s=>({...s,garden:update(s.garden||defaultGarden())}))}').length-1,2);assert.match(panel,/onChange\(base=>base\.unlocked\.includes\(s\.id\)\?\{\.\.\.base,selected:s\.id\}:base\)/);
 assert.match(game,/try\{next\.achievements=achievementList\(next\)/);assert.match(game,/pendingSaveRef\.current=null;markResultSaved\(value\);options\.onSuccess/);
 // Dialog and input hygiene.
 assert.match(game,/function confirmRestDeparture\(\)\{const run=battleRef\.current;if\(!run\?\.rest\|\|!run\.restReadiness\(\)\.ready\|\|riskRef\.current\)return;if\(conflictRef\.current\)\{previewLatest\(\);return;\}/);
 assert.ok(game.split('earlyOutsidePress(details)').length-1>=5);assert.match(game,/repeatPress\(closeGesture\.current,e,400\)\|\|!capturePointer\(e\)/);assert.match(game,/repeatPress\(openGesture\.current,details\.event,450\)/);
 assert.match(game,/createPortal\(<div className="toast-layer" aria-live="polite">/);assert.match(game,/startAgain\(b\)/);
 assert.ok(game.indexOf("if(riskRef.current){if(e.code==='Escape')")<game.indexOf("if(hudSummaryRef.current){if(e.code==='Escape')"),'a visible confirmation answers Esc before hidden layers');
 assert.match(game,/\['choice','pause','result'\]\.includes\(scene\)\?choiceFocusRef/);assert.doesNotMatch(game,/toLocale(Time)?String\((\[\])?\)/);
 // Layout: hover/press keep the stretched card target; toasts float above dialogs; short screens keep a usable body.
 assert.match(css,/\.choice-card \.scene-action:hover,\.choice-card \.scene-action:active\{filter:none;translate:none\}/);assert.match(css,/\.toast-layer\{position:fixed;inset:0;z-index:200/);
 assert.match(css,/@media\(max-height:600px\),\(max-width:420px\)\{\.page-journey \.journey-launch\{gap:6px;padding:6px 0\}/);assert.match(css,/\.page-journey \.journey-launch>\.fr-btn:not\(\.primary-start\),\.page-journey \.journey-launch>\.study-entry\{flex:1 1 0;/);
 assert.match(css,/\.rest-action-dock \.rest-missing\{display:flex;flex-wrap:nowrap;/);assert.doesNotMatch(css,/\.page-journey \.launch-selection\{display:none\}/,'the pinned dock keeps its difficulty select');
 assert.match(help,/else target\.scrollIntoView\(\{block:'start'\}\)/);
 assert.match(panel,/进入第 '\+\(\(b\.endlessLoop\|\|0\)\+2\)\+' 圈/);assert.match(panel,/onClick=\{\(\)=>\{setReplace\(null\);b\.refreshShop\(\);\}\}/);
});

// 2026-10-08 thirty-player playtest, first batch (G01 / G02 / G31). Geometry is measured with real input in scripts/qa-release-1.2-browser.mjs.
void test('story relics marked non-canon in their source are flagged canon:false, so codex and shop labels cannot contradict them',()=>{
 const nonCanon=RELICS.filter(r=>r.story&&/非原著/.test(r.source));assert.deepEqual(nonCanon.map(r=>r.id),['lingxi']);
 for(const r of RELICS.filter(r=>r.story))assert.equal(STORY_ITEMS.find(i=>i.id===r.id)?.canon===false,/非原著/.test(r.source),r.id);
 const game=src('Game.jsx');assert.match(game,/const NON_CANON_ITEMS=new Set\(STORY_ITEMS\.filter\(i=>i\.canon===false\)\.map\(i=>i\.id\)\);/);
 assert.match(game,/r\.story\?\(NON_CANON_ITEMS\.has\(r\.id\)\?'游戏化器物':'原著器物 \/ 协战'\):'携行战术'/);assert.match(game,/r\.story\?\(NON_CANON_ITEMS\.has\(r\.id\)\?'游戏化器物':'原著器物'\):'携行配置'/);
 assert.doesNotMatch(game,/r\.story\?'原著器物/,'no label reads the story flag alone');
});

void test('result dialogs keep one shrinkable column and the compact HUD keeps the rest hint in the 战况 summary',()=>{
 const css=src('game.css'),game=src('Game.jsx');
 assert.match(css,/\.game-dialog\.scene-result\{grid-template-columns:minmax\(0,1fr\)\}\.game-dialog\.scene-result>\*\{min-width:0;max-width:100%\}/);
 assert.match(css,/@media\(max-width:600px\)\{\.sigil-report \.reader-table th,\.sigil-report \.reader-table td\{min-width:0;/);
 assert.match(css,/\.hud-compact \.skill-controls \.reserve-label>\.reserve-rest-hint:last-child\{display:none\}/);
 assert.ok(css.lastIndexOf('.hud-compact .skill-controls .reserve-label>.reserve-rest-hint:last-child{display:none}')>css.lastIndexOf('.skill-controls .reserve-label>.reserve-rest-hint:last-child{display:inline'),'the compact rule comes after the rule that shows the hint again');
 assert.match(game,/每次神雷耗用 \{thunder\.cost\} 雷源\{b\.isExpedition&&hasReserveRest\(b\)&&<> · \{reserveRestText\(b\)\}<\/>\}/);
 assert.equal(game.split('reserveRestText(b)').length-1,2,'HUD and summary share one hint text');
});
