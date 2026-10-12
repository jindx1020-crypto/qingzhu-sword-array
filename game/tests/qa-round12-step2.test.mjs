/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';import assert from 'node:assert/strict';
import {createRun,restoreRun} from '../gameplay/run-factory.js';
import {PATHS,TRAITS,RELICS,COMBOS} from '../gameplay/data.js';
import {starterExtras,traitMods,fireGuardShield,levelHpBonus,reserveFor,thunderCost} from '../gameplay/balance.js';
import {cultivationMods} from '../gameplay/cultivation.js';
import {traitEffectivePreview,shieldCoreMultiplier} from '../gameplay/stat-sources.js';
import {traitEffectiveValueLine,traitValueLine} from '../gameplay/descriptions.js';
import {execFileSync} from 'node:child_process';
import {growthGuidance,reserveRestGuidance,objectiveGuidance,routeCompletion,storyItemStates} from '../gameplay/player-guidance.js';
import {CURRENT_RECORD_RULES,browseRecordEntries,recordRuleKey} from '../gameplay/record-browser.js';
const run=(options={})=>{const b=createRun({seed:'r12-guidance',mode:'story',...options});b.beginNode();return b;};
await test('guidance is read-only across all 22 nodes and growth rules, with fixed goal deadline separate from remaining time',()=>{for(const growthVersion of [1,2,3,4]){const b=run({growthVersion});for(let chapter=0;chapter<6;chapter++)for(let wave=0;wave<b.routes[chapter].length;wave++){b.chapter=chapter;b.wave=wave;b.node.selected??=0;b.beginNode();b.waveTime=10;const before=JSON.stringify(b.serialize());const first=growthGuidance(b);if(growthVersion===4){assert.match(first.detail,/表现经验判定期限 \d+ 秒 · 剩余 \d+ 秒/);b.waveTime=20;const next=growthGuidance(b);assert.equal(first.detail.match(/表现经验判定期限 \d+/)[0],next.detail.match(/表现经验判定期限 \d+/)[0]);b.waveTime=10;}else if(first)assert.doesNotMatch(first.detail,/期限/);objectiveGuidance(b);routeCompletion(b.encounter);storyItemStates(b);assert.equal(JSON.stringify(b.serialize()),before);}}});
await test('reserve display splits actual receipt under capacity and does not claim rest on old balance1',()=>{for(const extra of [0,5])for(const room of [0,3,15,18,40]){const b=run({path:1,balanceVersion:3,metaRulesVersion:3,meta:extra?['thunder-meta-3']:[]});b.player.reserve=b.player.maxReserve-room;b.completeNode();const before=JSON.stringify(b.serialize()),text=reserveRestGuidance(b);assert.match(text,new RegExp('实际到账 '+Math.min(room,15+extra)));assert.match(text,/受储量上限限制/);assert.equal(JSON.stringify(b.serialize()),before);}const b=run({path:1,balanceVersion:1});b.player.reserve=0;b.completeNode();assert.equal(reserveRestGuidance(b),'');});
await test('current and historical browsing never mutates or merges original record groups',()=>{const entries=[{segmentVersion:1,mode:'story',difficulty:0,path:1,timeMs:5,touchLockUsed:false,rules:{...CURRENT_RECORD_RULES}},{mode:'story',difficulty:0,path:1,timeMs:2,touchLockUsed:false,rules:{...CURRENT_RECORD_RULES,growthVersion:3}},{mode:'story',difficulty:0,path:1,timeMs:1,touchLockUsed:true,rules:{...CURRENT_RECORD_RULES,growthVersion:3}}],before=JSON.stringify(entries);assert.equal(browseRecordEntries(entries,{rules:'current'}).length,1);assert.equal(browseRecordEntries(entries,{rules:'historical'}).length,2);assert.equal(browseRecordEntries(entries,{rules:recordRuleKey(entries[1].rules),lock:'used'}).length,1);assert.equal(browseRecordEntries(entries,{rules:'all'}).length,3);assert.equal(JSON.stringify(entries),before);});
await test('objective and item text keeps fixed conditions and possession separate from active effects',()=>{const b=run();b.chapter=5;b.wave=2;b.beginNode();b.waveTime=39;assert.match(objectiveGuidance(b),/39 \/ 40/);b.waveTime=40;assert.equal(objectiveGuidance(b),'退路已开 · 前往右侧出口');b.waveTime=88;assert.doesNotMatch(objectiveGuidance(b),/88 \/ 40/);b.storyInventory=['weeping','five-rings'];b.relics=[];assert.match(storyItemStates(b)[0].state,/未启用协战/);b.relics=['weeping'];assert.equal(storyItemStates(b)[0].state,'协战配置生效');assert.match(storyItemStates(b)[1].state,/未配置/);assert.doesNotMatch(routeCompletion({kind:'treasure',goal:'每阵14秒'}),/14/);assert.doesNotMatch(routeCompletion({kind:'illusion',goal:'每10秒'}),/10/);});

// Frozen pre-extraction recalc: this intentionally does not call the new shared stat helpers.
// Compare exact IEEE-754 values, key order, resource deltas and the state visible to combo toasts.
function originalRecalc(){
 const sumMods=(o,mods)=>{for(const [k,v]of Object.entries(mods))o[k]=(o[k]||0)+v;},clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const old=this.stats||{},s={};sumMods(s,PATHS[this.path].perk);if(this.rulesVersion>=2)sumMods(s,starterExtras(this));
 sumMods(s,cultivationMods(this.options,this.path));
 for(const [id,count]of Object.entries(this.traits)){const t=TRAITS.find(x=>x.id===id);if(t)for(let i=0;i<count;i++)sumMods(s,traitMods(this,t));}
 for(const id of this.relics){const r=RELICS.find(x=>x.id===id);if(r)sumMods(s,r.mods);}
 this.pathCounts=PATHS.map(p=>Object.keys(this.traits).filter(id=>id.startsWith(p.id+'-')).length);
 const combos=COMBOS.filter(c=>this.pathCounts[PATHS.findIndex(p=>p.id===c.a)]>=3&&this.pathCounts[PATHS.findIndex(p=>p.id===c.b)]>=3);
 for(const c of combos)if(!this.comboSet.has(c.effect)){this.newCombos.push(c.name);this.toast('联动成型 · '+c.name);}
 this.comboSet=new Set(combos.map(c=>c.effect));this.combos=combos;
 if(this.comboSet.has('puppetInsect')){s.puppets=(s.puppets||0)+1;s.insects=(s.insects||0)+1;}
 if(this.comboSet.has('puppetGuard'))s.armor=(s.armor||0)+(s.puppets||0)*3;
 s.armor=(s.armor||0)+Math.floor((s.insects||0)/4)*(s.insectGuard||0);
 s.shield=(s.shield||0)+(s.puppets||0)*(s.puppetShield||0);
 const fireGuard=fireGuardShield(this);if(fireGuard)s.shield=(s.shield||0)+fireGuard;
 this.stats=s;
 if(this.player){const p=this.player;const bonus=(this.options.metaRulesVersion<2?this.options.meta||[]:[]).filter(x=>x.endsWith('-meta-2')).length*2;
  const levelHp=levelHpBonus(this);this.levelHpApplied=levelHp;p.maxHp=100+(s.hp||0)+bonus+levelHp;p.maxShield=s.shield||0;p.maxReserve=reserveFor(this)+(s.reserve||0);
  p.hp=clamp(p.hp+Math.max(0,(s.hp||0)-(old.hp||0)),0,p.maxHp);
  p.shield=clamp(p.shield+Math.max(0,(s.shield||0)-(old.shield||0)),0,Math.max(p.maxShield,p.shield));
  p.reserve=clamp(p.reserve+Math.max(0,(s.reserve||0)-(old.reserve||0)),0,p.maxReserve);
 }
 if(this.isExpedition&&this.player){const factor=this.hasCore('K11')?.85:this.hasCore('K12')?.75:1;this.player.maxShield=(this.stats.shield||0)*factor;this.player.shield=Math.max(0,this.player.shield);}
}
const recalcFixture=b=>Object.assign(Object.create(Object.getPrototypeOf(b)),structuredClone({path:b.path,options:b.options,difficulty:b.difficulty,rulesVersion:b.rulesVersion,isExpedition:b.isExpedition,traits:b.traits,relics:b.relics,level:80,stats:b.stats,player:{...b.player,hp:61.25,shield:500.75,reserve:17.25},newCombos:[],comboSet:new Set(),trace:[]}),{toast(text){this.trace.push({text,stats:structuredClone(this.stats),pathCounts:[...this.pathCounts],comboSet:[...this.comboSet],newCombos:[...this.newCombos]});}});
const recalcState=b=>({stats:b.stats,pathCounts:b.pathCounts,combos:b.combos,comboSet:[...b.comboSet],player:b.player,levelHpApplied:b.levelHpApplied,newCombos:b.newCombos,trace:b.trace});
await test('extracted recalc is bit-for-bit identical to frozen original across all starters, rules 1–3, balance 1–4 and cultivation 1–3',()=>{
 let comparisons=0;
 for(const rulesVersion of [1,2,3])for(const balanceVersion of [1,2,3,4])for(const metaRulesVersion of [1,2,3])for(let path=0;path<6;path++){
  const meta=PATHS.flatMap(p=>Array.from({length:6},(_,i)=>p.id+'-meta-'+i)),b=createRun({seed:'preview-parity',rulesVersion,balanceVersion,metaRulesVersion,path,meta});
  for(let stage=0;stage<3;stage++){
   const actual=recalcFixture(b),expected=recalcFixture(b);
   const traits=stage===0?{}:stage===1?Object.fromEntries(TRAITS.filter((_,i)=>i%12<3).map(t=>[t.id,1])):Object.fromEntries([...TRAITS].reverse().map(t=>[t.id,3]));
   const relics=stage===0?[]:stage===1?['K11',...RELICS.filter(r=>!r.story).slice(0,4).map(r=>r.id)]:['K12','kit-1-2',...RELICS.filter(r=>!r.story).slice(-3).map(r=>r.id)];
   actual.traits={...traits};expected.traits={...traits};actual.relics=[...relics];expected.relics=[...relics];
   actual.recalc();originalRecalc.call(expected);
   assert.deepEqual(recalcState(actual),recalcState(expected),JSON.stringify({rulesVersion,balanceVersion,metaRulesVersion,path,stage}));
   assert.equal(JSON.stringify(recalcState(actual)),JSON.stringify(recalcState(expected)),'property and event order stay unchanged');comparisons++;
  }
 }
 assert.equal(comparisons,648);
});

const previewRun=(options={},traits={},relics=[])=>{const b=createRun({seed:'effective-preview',...options});b.traits={...traits};b.relics=[...relics];b.recalc();return b;};
const trait=id=>TRAITS.find(t=>t.id===id);
function matchesSelection(b,id){
 const before=JSON.stringify(b.serialize()),rng=b.rng.state(),content=b.contentRng?.state(),preview=traitEffectivePreview(trait(id),b);
 for(let i=0;i<5;i++)assert.deepEqual(traitEffectivePreview(trait(id),b),preview);
 assert.equal(JSON.stringify(b.serialize()),before);assert.equal(b.rng.state(),rng);assert.equal(b.contentRng?.state(),content);
 b.traits[id]=(b.traits[id]||0)+1;b.recalc();
 assert.deepEqual(preview.after,{shield:b.player.maxShield,puppets:b.stats.puppets||0,reserve:b.player.reserve,maxReserve:b.player.maxReserve,cost:thunderCost(b),budget:Math.floor(b.player.reserve/thunderCost(b))});
 return preview;
}
await test('effective shield preview includes K11/K12, per-permanent-puppet conversion and newly formed combos',()=>{
 for(const [relic,multiplier] of [['K11',.85],['K12',.75]]){
  const b=previewRun({path:5},{},[relic]);assert.equal(shieldCoreMultiplier(b),multiplier);
  assert.match(traitValueLine(trait('guard-1'),b),/护盾上限 \+25 → \+41/);
  const p=matchesSelection(b,'guard-1');assert.equal(p.before.shield,25*multiplier);assert.equal(p.after.shield,41*multiplier);
 }
 const both=previewRun({path:5},{},['K11','K12']);assert.equal(shieldCoreMultiplier(both),.85,'preserve original K11 priority even in synthetic dual-core fixture');
 const noPuppet=previewRun({path:0});assert.equal(traitEffectiveValueLine(trait('puppet-10'),noPuppet),'常驻傀儡 0 具 · 本局护盾上限 0 → 0');matchesSelection(noPuppet,'puppet-10');
 const perPuppet=previewRun({path:2},{'puppet-0':2});perPuppet.player.buffs.puppet=100;perPuppet.puppets=Array.from({length:9},()=>({temporary:true}));
 const p=matchesSelection(perPuppet,'puppet-10');assert.equal(p.after.puppets,4);assert.equal(p.after.shield,16,'temporary summons and deployed-array length do not enter the permanent conversion');
 const addPuppet=previewRun({path:2},{'puppet-10':1});assert.equal(traitEffectiveValueLine(trait('puppet-0'),addPuppet),'常驻傀儡 2 → 3 · 本局护盾上限 8 → 12');matchesSelection(addPuppet,'puppet-0');
 const combo=previewRun({path:2},{'puppet-0':1,'puppet-1':1,'puppet-10':1,'insect-0':1,'insect-1':1});const c=matchesSelection(combo,'insect-2');assert.equal(c.after.puppets,c.before.puppets+1);assert.equal(c.after.shield,c.before.shield+4);
 for(const balanceVersion of [1,2,3,4]){const b=previewRun({path:5,balanceVersion},{'guard-0':1,'guard-1':1,'guard-2':1,'talisman-0':1,'talisman-1':1}),p=matchesSelection(b,'talisman-2');assert.equal(p.after.shield-p.before.shield,balanceVersion===4?8:0);}
});
await test('effective thunder preview uses current and old costs, K03 surcharge after floor, and actual reserve gain',()=>{
 for(const balanceVersion of [1,2,3,4])for(const rulesVersion of [1,2,3]){
  const b=previewRun({path:1,rulesVersion,balanceVersion},{'thunder-2':1},rulesVersion===3?['K03']:[]),p=matchesSelection(b,'thunder-2');
  assert.equal(p.before.cost-p.after.cost,rulesVersion===3&&balanceVersion===4?4:3);
 }
 const floor=previewRun({path:1,metaRulesVersion:3,meta:['thunder-meta-2']},{'thunder-2':2},['K03','kit-1-2']);floor.player.reserve=26;
 assert.match(traitEffectiveValueLine(trait('thunder-2'),floor),/神雷耗用 13 → 11/);
 assert.match(traitEffectiveValueLine(trait('thunder-2'),floor),/雷源可支撑 2 → 2 次/);assert.match(traitEffectiveValueLine(trait('thunder-2'),floor),/实际施放仍需灵力与本局规则允许/);
 const p=matchesSelection(floor,'thunder-2');assert.equal(p.after.cost,11,'floor of 8 then K03 surcharge of 3');
 const reserve=previewRun({path:1},{'thunder-2':1},['K03']);reserve.player.reserve=12.5;const r=matchesSelection(reserve,'thunder-11');assert.equal(r.after.reserve,32.5);assert.equal(r.after.maxReserve-r.before.maxReserve,20);assert.equal(r.after.budget,1);
});
await test('missing saved balance/cultivation markers keep old preview and restored selection results',()=>{
 const b=previewRun({path:1,balanceVersion:1,metaRulesVersion:1},{'thunder-2':1}),snapshot=b.serialize();delete snapshot.options.balanceVersion;delete snapshot.options.metaRulesVersion;
 const restored=restoreRun(snapshot);assert.equal(restored.options.balanceVersion,1);assert.equal(restored.options.metaRulesVersion,1);
 assert.match(traitEffectiveValueLine(trait('thunder-2'),restored),/神雷耗用 22 → 19/);matchesSelection(restored,'thunder-2');
 const legacy=previewRun({path:5,rulesVersion:1},{'guard-1':1}),old=legacy.serialize();delete old.options.rulesVersion;delete old.options.metaRulesVersion;
 const oldest=restoreRun(old);assert.equal(oldest.rulesVersion,1);assert.equal(traitEffectiveValueLine(trait('guard-1'),oldest),'本局护盾上限 31 → 47');matchesSelection(oldest,'guard-1');
});
await test('preview tolerates frozen state and cannot call recalc, events, either RNG or resource methods',()=>{
 const b=previewRun({path:2},{'puppet-10':1},['K11']);const fail=()=>{throw Error('preview attempted a live action');};
 b.recalc=fail;b.emit=fail;b.rng=Object.assign(fail,{state:b.rng.state});b.contentRng=Object.assign(()=>fail(),{state:b.contentRng.state});
 const freeze=(x,seen=new WeakSet())=>{if(!x||typeof x!=='object'||seen.has(x))return;seen.add(x);Object.values(x).forEach(v=>freeze(v,seen));Object.freeze(x);};freeze(b);
 const before=JSON.stringify(b.serialize());for(let i=0;i<10;i++){traitEffectivePreview(trait('puppet-0'),b);traitEffectiveValueLine(trait('thunder-2'),b);traitValueLine(trait('puppet-10'),b);}
 assert.equal(JSON.stringify(b.serialize()),before);assert.equal(traitEffectiveValueLine(null,b),'');
});
await test('rest budget is qualified and description/data entry modules initialize independently',()=>{
 const b=run({path:1});b.player.reserve=0;b.completeNode();const text=reserveRestGuidance(b);assert.match(text,/雷源可支撑/);assert.doesNotMatch(text,/可施放/);assert.match(text,/仍需灵力与本局规则允许/);
 for(const file of ['descriptions','data','stat-sources','stat-text'])execFileSync(process.execPath,['--input-type=module','-e','await import('+JSON.stringify(new URL('../gameplay/'+file+'.js',import.meta.url).href)+')']);
});
