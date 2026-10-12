/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {Expedition} from '../gameplay/expedition.js';
import {summonCounts,swordTargetRows,insectTargetRows,fullGnawRows,combatReadout,visibleCombatCues,defendAssignment} from '../gameplay/combat-readouts.js';
import {insectOrderHint} from '../gameplay/experience-hints.js';
function battle(path=3){const b=new Expedition({path,seed:'readout-only'});b.beginNode();b.clearField();b.time=10;return b;}
function enemy(b,name,extras={}){return b.spawn(0,{x:b.player.x+100,y:b.player.y,hp:1000,maxHp:1000,name,...extras});}
void test('unit count, per-target gnaw layers and K07/K08 target multipliers remain distinct and read-only',()=>{
 const b=battle(),a=enemy(b,'近处符弩游修',{gnaw:.08,gnawUntil:12.5}),z=enemy(b,'远处精英符弩游修',{x:b.player.x+200,elite:true,gnaw:.12,gnawUntil:13});
 b.stats.insects=4;b.insects=Array.from({length:16},()=>({x:b.player.x,y:b.player.y,cool:1}));b.puppets=Array.from({length:6},()=>({x:b.player.x,y:b.player.y,cool:1}));b.relics=['K07'];b.insectPursuits=[a.id,a.id,z.id];b.targetCache={bug0:{id:a.id,until:11},bug1:{id:z.id,until:11}};
 const before=JSON.stringify(b.serialize()),cache=JSON.stringify(b.targetCache),rng=b.rng.state();b.allyTarget=b.nearest=b.near=()=>{throw Error('readout called a targeting method');};
 for(let i=0;i<10;i++){const rows=insectTargetRows(b);assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.layers),[4,6]);assert.deepEqual(rows.map(r=>r.groups),[['A组指令'],['B组指令']]);assert.match(rows[0].metrics,/噬甲 4\/6 层 · 易伤 8% · 剩余 2.5 秒 · 核心虫伤 ×0.88/);assert.equal(combatReadout(b).main[1].name,z.name);assert.match(insectOrderHint(b),/两群分攻.*最多 1.4 秒后重新选择/);}
 assert.deepEqual(summonCounts(b),{puppets:6,insects:16,text:'在场：傀儡 6 具 · 噬金虫 16 只'});assert.equal(JSON.stringify(b.serialize()),before);assert.equal(JSON.stringify(b.targetCache),cache);assert.equal(b.rng.state(),rng);
 b.relics=['K08'];assert.deepEqual(insectTargetRows(b).map(r=>r.coreMultiplier),[.8,1.3]);assert.doesNotMatch(insectOrderHint(b),/K08|缓存/);assert.match(insectOrderHint(b),/凝群穿甲.*精英优先/);
});
void test('expired/dead command targets are not treated as current pursuits; live residue stays explicit',()=>{
 const b=battle(),a=enemy(b,'失效指令',{gnaw:.08,gnawUntil:12}),z=enemy(b,'已死亡目标',{hp:0,gnaw:.12,gnawUntil:20}),far=enemy(b,'超出指令距离',{x:b.player.x+500});b.stats.insects=4;b.relics=['K07'];b.insectPursuits=[z.id];b.targetCache={bug0:{id:a.id,until:10},bug1:{id:far.id,until:20}};
 assert.deepEqual(insectTargetRows(b).map(r=>[r.name,r.source]),[['失效指令','易伤残留']]);b.time=12;assert.deepEqual(insectTargetRows(b),[]);
});
void test('full gnaw display names live current records instead of assigning an anonymous old cue',()=>{
 const b=battle(),old=enemy(b,'刚才的目标',{hp:0,gnaw:.12,gnawUntil:14}),now=enemy(b,'当前追击目标',{gnaw:0,gnawUntil:0}),other=enemy(b,'仍留有易伤的目标',{gnaw:.12,gnawUntil:11});b.insectPursuits=[now.id];b.combatCues=[{key:'gnaw',text:'噬甲已满 · 受伤 +12%',until:12,color:'#fff'}];
 assert.deepEqual(fullGnawRows(b).map(r=>r.name),[other.name]);assert.deepEqual(visibleCombatCues(b),[]);assert.equal(b.combatCues.length,1);b.time=11;assert.deepEqual(fullGnawRows(b),[]);assert.equal(old.hp,0);
});
void test('focus progress belongs to named enemies, expires independently, and never moves to a new aim',()=>{
 const b=battle(0),a=enemy(b,'三击目标',{focusHits:3,focusUntil:11}),z=enemy(b,'一击目标',{focusHits:1,focusUntil:12}),next=enemy(b,'新准心对象');b.input.aim={x:next.x,y:next.y};
 assert.deepEqual(swordTargetRows(b).map(r=>[r.id,r.hits]),[[z.id,1],[a.id,3]]);assert.match(swordTargetRows(b)[0].metrics,/聚锋 1\/4 击.*2.0 秒/);b.time=11.1;assert.deepEqual(swordTargetRows(b).map(r=>r.id),[z.id]);b.time=12.1;assert.deepEqual(swordTargetRows(b),[]);
});
void test('duplicate visible focus confirmations merge without rewriting source cues or counting total triggers',()=>{
 const b=battle(0);b.combatCues=[{key:'focus',text:'四击聚锋',color:'#fff',until:11},{key:'focus',text:'四击聚锋',color:'#fff',until:12},{key:'focus',text:'聚锋触发 · 飞剑攻速 +12%',color:'#fff',until:12},{key:'thunder-cast',text:'神雷已施放',until:9}];const before=JSON.stringify(b.combatCues),cues=visibleCombatCues(b);assert.equal(cues.length,2);assert.match(cues[0].text,/合并 2 条确认/);assert.equal(cues[0].until,12);assert.equal(JSON.stringify(b.combatCues),before);
});
void test('defend assignment describes the real formation and focus rule; K07 inactive does not claim two active groups',()=>{
 const b=battle();b.objective={kind:'defend'};delete b.formation;assert.match(defendAssignment(b),/分守中/);b.formation=0;assert.match(defendAssignment(b),/分守中/);b.formation=2;assert.match(defendAssignment(b),/定向穿刺.*切回分组/);b.input.focus=true;b.input.aim={x:1,y:1};assert.match(defendAssignment(b,'touch'),/单点集火.*点“解除”/);b.options.focusVersion=1;assert.match(defendAssignment(b,'mouse'),/目标指引.*松开左键/);b.relics=['K07'];b.stats.insects=3;b.insects=[{}];assert.match(insectOrderHint(b),/常驻不足 4 只/);assert.doesNotMatch(insectOrderHint(b),/两群分攻/);
});
