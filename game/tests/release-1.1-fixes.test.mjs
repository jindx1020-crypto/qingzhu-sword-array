/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// 1.1 review fixes: engine/save regressions plus source markers for UI-only flows.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {Expedition} from '../gameplay/expedition.js';import {initialSave,seeded} from '../gameplay/data.js';
import {SaveVault,SAVE_KEY,normalizeSave} from '../gameplay/save-store.js';
import {settleRunResult,printableSeed,printableText} from '../gameplay/records.js';import {RULE_KEYS} from '../gameplay/record-rules.js';
import {compatibilityEntry,OFFLINE_ENTRY,OFFLINE_PNG_ENTRY,PLAYER_ENTRY,PLAYER_PNG_ENTRY,githubEntry} from '../gameplay/delivery-names.js';
const src=name=>fs.readFileSync(new URL('../gameplay/'+name,import.meta.url),'utf8');
const memory=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};

// Reaches the second node (a pursuit carrying the objective) with the K10 sigil-line core equipped.
function pursuitWithLine(){
 let seed=null;for(let i=0;i<500&&!seed;i++){const t=new Expedition({seed:'s'+i,path:4});if(t.routes[0][1].choices.some(c=>c.kind==='pursuit'))seed='s'+i;}
 const b=new Expedition({seed,path:4,difficulty:0});b.start();if(b.cinematic)b.advanceCinematic(true);b.completeNode();
 const route=b.routes[0][1].choices.findIndex(c=>c.kind==='pursuit');
 for(let i=0;i<3&&!b.restReadiness().event;i++)b.chooseInteraction(i);if(!b.rest.coreDone)b.skipCore();b.chooseRoute(route);
 for(let g=0;g<20&&b.modeState!=='battle';g++){if(b.cinematic)b.advanceCinematic(true);else if(b.modeState==='choice')b.chooseTrait(b.choices[0].id);else b.continueRest();}
 b.relics.push('K10');b.recalc();const carrier=b.enemies.find(e=>e.mission==='carrier');b.enemies=[carrier];
 Object.assign(carrier,{x:500,y:300,hp:1,stun:10});return {b,carrier};
}
const lineZone={x:760,y:300,r:10,ttl:5,warn:.001,kind:'sigil',friendly:true,sigil:true,twin:true,pair:1,damage:0,line:{x:440,y:300,damage:100},fuseDuration:.8};

void test('K10 line stops at node completion: no later kills in the same sweep and no hazard damage in the intermission',()=>{
 const first=pursuitWithLine(),b=first.b;for(let i=0;i<5;i++){const e=b.spawn(17,{x:560+i*40,y:300,hp:5});Object.assign(e,{x:560+i*40,y:300,stun:10});}
 b.rebuildHash();const kills=b.kills;b.onSigilDetonate({...lineZone,warn:0});
 assert.equal(b.modeState,'rest');assert.equal(b.kills-kills,1,'only the objective carrier falls before the node settles');
 assert.equal(b.enemies.length,0,'no enemy leaks into the intermission snapshot');
 const second=pursuitWithLine(),c=second.b,p=c.player;Object.assign(p,{x:900,y:500,invuln:0,shield:0,hp:10});c.input.x=0;c.input.y=0;
 c.zones=[{...lineZone},{x:900,y:500,r:60,ttl:1,warn:-.1,kind:'blast',damage:50,origin:{name:'test blast',x:900,y:500}}];
 c.update(1/60);
 assert.deepEqual(c.receipts,['0:0','0:1']);assert.equal(c.finished,false);assert.equal(c.modeState,'rest');assert.ok(p.hp>0,'a settled node cannot end the run');
});

void test('seeded RNG keeps its exact stream and restores identically beyond 2^53/0x6D2B79F5 draws',()=>{
 const live=seeded(7);for(let i=0;i<5_200_000;i++)live();const restored=seeded(0);restored.set(live.state());
 for(let i=0;i<200;i++)assert.equal(live(),restored());
 const a=seeded(123456789);const reference=[];let x=123456789;for(let i=0;i<5;i++){x+=0x6D2B79F5;let t=x;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);reference.push(((t^t>>>14)>>>0)/4294967296);}
 assert.deepEqual(Array.from({length:5},()=>a()),reference,'the first outputs are unchanged');
});

void test('a won seeded run whose seed contains control characters is still recorded',()=>{
 const rules=Object.fromEntries(RULE_KEYS.map(k=>[k,1]));
 const summary=seed=>({mode:'seed',won:true,nodes:22,runId:'run-tab',path:0,difficulty:0,seed,kills:500,level:30,insight:60,time:1500,thunders:1,seen:[],recordDetails:{version:1,gameVersion:'1.1',rules,touchLockUsed:false,eligibleStart:true,battleMs:1500000,completedLoops:0,lastLoopMs:null,lastLoopLockUsed:false,metaCount:0,supply:'steady'}});
 const storage=memory(),vault=new SaveVault(storage),save=vault.load(),out=vault.commit(settleRunResult(save,summary('a\tb\n')));
 assert.equal(out.records.entries.length,1);assert.equal(out.records.entries[0].seed,'ab');assert.equal(out.wins,1);
 assert.equal(printableSeed('\t\n'),'（空）');assert.equal(printableText('种 子\u0007'),'种 子');
 assert.match(src('Game.jsx'),/seed:chosenMode==='seed'\?printableText\(seed\)\.trim\(\)\|\|day/);assert.match(src('Game.jsx'),/onChange=\{e=>setSeed\(printableText\(e\.target\.value\)\)\}/);
});

void test('history rows with prototype-named modes load but render as an old run instead of crashing the page',()=>{
 const save=normalizeSave({...initialSave(),history:[{time:1,kills:1,path:0,mode:'__proto__'},{time:1,kills:1,path:0,mode:'constructor'}]});
 assert.equal(save.history.length,2);
 assert.match(src('RecordsPanel.jsx'),/Object\.prototype\.hasOwnProperty\.call\(MODE_NAMES,h\.mode\)\?MODE_NAMES\[h\.mode\]:'旧历练'/);
 const game=src('Game.jsx'),boundary=src('GameErrorBoundary.jsx');
 assert.match(game,/export default function Game\(\)\{return <GameErrorBoundary><GameView\/><\/GameErrorBoundary>;\}/);
 assert.match(boundary,/static getDerivedStateFromError/);assert.doesNotMatch(boundary,/setItem|removeItem|commit\(/,'the fallback never writes storage');
});

void test('pending saves: recovery attempts never become the base of later results, and later writes carry the pending record',()=>{
 const game=src('Game.jsx');
 assert.match(game,/const recovery=!!\(options\.recoveryCandidate\|\|options\.resolveRecovery\),rejected=!!frozen&&!writableRecord\(frozen\);\n\s*if\(frozen&&!recovery&&!rejected\)pendingSaveRef\.current=/);
 assert.match(game,/const pending=typeof fn==='function'&&!options\.discardPending\?pendingSaveRef\.current:null;/);
 assert.match(game,/fn\(pending\?structuredClone\(pending\.next\):saveRef\.current\)/);
 assert.match(game,/persist\(s=>settleRunResult\(s,\{\.\.\.ev\.summary,seen:\[\.\.\.b\.seen\]\}\),\{onSuccess:/);
 assert.doesNotMatch(game,/settleRunResult\(pendingSaveRef\.current\?\.next\|\|saveRef\.current/);
 assert.match(game,/discardPending:true,resolveRecovery:/,'a confirmed new run explicitly drops the abandoned pending record');
 assert.match(game,/if\(!confirmed&&\(pendingSaveRef\.current\|\|checkpointDirty\(battleRef\.current,saveRef\.current\)\)\)\{showRisk\(\{title:'放弃未保存的进度并继续？'/);
 assert.match(game,/function openSettings\(\)\{if\(pageRef\.current!=='settings'\)settingsOrigin\.current=/);
});

void test('a failed adoption leaves disk and backup untouched for the next ordinary write',()=>{
 // The vault-level guarantee the UI now relies on: adoption failure (full isolation) writes nothing,
 // so the next ordinary commit starts from the unchanged primary, not from the rejected candidate.
 const storage=memory(),vault=new SaveVault(storage);storage.setItem(SAVE_KEY,JSON.stringify({...initialSave(),insight:100}));const save=vault.load();
 storage.setItem(SAVE_KEY+'-unreadable',JSON.stringify({records:Array.from({length:12},(_,i)=>({raw:'raw-'+i,savedAt:i}))}));
 const before=JSON.stringify(vault.snapshot());
 assert.throws(()=>vault.adoptRecovery({...initialSave(),insight:11},{sourceRaw:'import'}),e=>e.code==='raw-capacity');
 assert.equal(JSON.stringify(vault.snapshot()),before);
 const out=vault.commit({...save,kills:5});assert.equal(out.insight,100);assert.equal(out.kills,5);
});

void test('keyboard and dialog edge cases: IME, Command, blur, result-record Esc, replaced confirmations, observation size',()=>{
 const game=src('Game.jsx');
 assert.match(game,/if\(e\.isComposing\|\|e\.keyCode===229\)return;/);assert.match(game,/if\(e\.key==='Meta'\|\|e\.metaKey\)keys\.clear\(\);/);
 assert.match(game,/const up=e=>\{if\(e\.key==='Meta'\)keys\.clear\(\);/);assert.match(game,/const blur=\(\)=>\{keys\.clear\(\);blockedChoiceKeys\.current\.clear\(\);/);
 assert.match(game,/if\(resultRecordsRef\.current\)\{if\(e\.code==='Escape'\)\{[^}]*setResultRecords\(false\);\}return;\}/);
 assert.match(game,/function confirmRisk\(\)\{const pending=riskRef\.current;if\(!pending\?\.run\|\|pending\.replaced\)return;/);
 assert.match(game,/onClick=\{confirmRisk\} disabled=\{!!risk\.replaced\}/);
 assert.match(game,/if\(file\.size>MAX_SAVE_IMPORT_BYTES\)throw Error\('观察包超过 8 MiB'\);const b=restoreStudyPacket/);
});

void test('the PNG fallback follows the actual entry name of every delivery layout',()=>{
 assert.equal(compatibilityEntry('/x/'+encodeURIComponent(PLAYER_ENTRY)),'./'+PLAYER_PNG_ENTRY);
 assert.equal(compatibilityEntry('/x/'+OFFLINE_ENTRY),'./'+OFFLINE_PNG_ENTRY);
 assert.equal(compatibilityEntry('/d/'+githubEntry('1.1')),'./'+githubEntry('1.1',true));
 for(const name of [PLAYER_PNG_ENTRY.split('/').pop(),OFFLINE_PNG_ENTRY,githubEntry('1.1',true),'renamed.html','%E0%A4%A.html'])assert.equal(compatibilityEntry('/x/'+name),null,name);
 assert.doesNotMatch(src('Game.jsx'),/new URL\('\.\/凡人修仙传_青竹剑阵_兼容PNG\.html'/);
 const scripts=name=>fs.readFileSync(new URL('../scripts/'+name,import.meta.url),'utf8');
 assert.match(scripts('package-player.mjs'),/\[PLAYER_ENTRY\]:fs\.readFileSync\(path\.join\(root,OFFLINE_ENTRY\)\)/);
 assert.match(scripts('package-player.mjs'),/\[PLAYER_PNG_ENTRY\]:fs\.readFileSync\(path\.join\(root,OFFLINE_PNG_ENTRY\)\)/);
 assert.match(scripts('prepare-github-release.mjs'),/\[OFFLINE_ENTRY,githubEntry\(GAME_VERSION\)/);
});
