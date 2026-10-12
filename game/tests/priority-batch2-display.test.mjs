/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';import assert from 'node:assert/strict';
import {Expedition} from '../gameplay/expedition.js';
import {TRAITS,COMBOS,PATHS} from '../gameplay/data.js';
import {newlyFormedCombos,traitComboBenefit,traitSpeciesLine} from '../gameplay/combo-description.js';
import {choiceChain} from '../gameplay/experience-hints.js';
import {damageRows,damageSourceNote} from '../gameplay/combat-feedback.js';
const trait=id=>TRAITS.find(t=>t.id===id),snapshot=b=>JSON.stringify(b.serialize());

void test('mixed-build candidate can preview two newly formed combos without granting their conditional benefits',()=>{
 const b=new Expedition({seed:'mixed-preview',path:2});b.traits={'sword-0':1,'sword-1':1,'sword-2':1,'puppet-0':1,'puppet-1':1,'puppet-2':1,'guard-0':1,'guard-1':1};b.recalc();
 const before=snapshot(b),a=b.rng.state(),c=b.contentRng.state(),candidate=trait('guard-2'),rows=newlyFormedCombos(candidate,b);
 assert.deepEqual(rows.map(c=>c.name),['进退有据','护阵傀儡']);assert.match(rows[0].description,/闪避后 3 秒/);assert.match(rows[1].description,/3 具常驻傀儡.*9 护甲/);
 assert.match(traitSpeciesLine(candidate,b),/新增一种战术.*种类 \+1/);assert.equal(snapshot(b),before);assert.equal(b.rng.state(),a);assert.equal(b.contentRng.state(),c);
 const active=new Set(b.combos.map(c=>c.effect));b.traits[candidate.id]=1;b.recalc();assert.deepEqual(b.combos.filter(c=>!active.has(c.effect)).map(c=>c.effect),rows.map(c=>c.effect));
 assert.deepEqual(newlyFormedCombos(candidate,b),[]);assert.match(traitSpeciesLine(candidate,b),/强化已有战术.*种类不变/);
});
void test('all twelve combo predictions agree with actual recalc, including historical balance branches',()=>{
 for(const balanceVersion of [1,3,4])for(const combo of COMBOS){
  const b=new Expedition({seed:'every-combo',path:PATHS.findIndex(p=>p.id===combo.a),balanceVersion});
  b.traits=Object.fromEntries([0,1,2].map(i=>[combo.a+'-'+i,1]).concat([0,1].map(i=>[combo.b+'-'+i,1])));b.recalc();
  const candidate=trait(combo.b+'-2'),before=snapshot(b),rows=newlyFormedCombos(candidate,b);
  assert.deepEqual(rows.map(r=>r.effect),[combo.effect],combo.name);assert.ok(rows[0].description.length>5);assert.doesNotMatch(rows[0].description,/NaN|undefined/);
  assert.equal(snapshot(b),before);b.traits[candidate.id]=1;b.recalc();assert.deepEqual(b.combos.map(c=>c.effect),rows.map(r=>r.effect));
  if(combo.effect==='fireGuard')assert.equal(rows[0].description.includes('固定提高护盾上限 8'),balanceVersion===4);
 }
});
void test('combo tracking can show a non-starter pairing, stays read-only and never counts repeated ranks as species',()=>{
 const b=new Expedition({seed:'track-combos',path:2});b.traits={'sword-0':3,'sword-1':1,'sword-2':1,'guard-0':2,'guard-1':1};b.recalc();
 const before=snapshot(b);assert.ok(!choiceChain(b).links.some(x=>x.startsWith('进退有据')));assert.equal(choiceChain(b,'all').links.length,12);
 const tracked=choiceChain(b,'swordGuard').links;assert.equal(tracked.length,1);assert.match(tracked[0],/御剑还差 0 种.*护身还差 1 种/);
 assert.equal(traitComboBenefit(trait('sword-0'),b),'');assert.equal(snapshot(b),before);
});
void test('historical damage labels preserve every total, distinguish core arcs and never guess fire subcategories',()=>{
 const b=new Expedition({seed:'damage-history'});b.damageSources.return=23439;b.damageSources.arc=720;b.damageSources.guard=16187;b.damageSources.fire=24370;b.fireBreakdown.other=24370;
 const before=snapshot(b),rows=damageRows(b);assert.equal(rows.find(r=>r.key==='arc').label,'余雷牵引雷击');assert.equal(rows.find(r=>r.key==='arc').value,720);
 assert.match(damageSourceNote(b,'return',23439),/曾用核心.*当前未携带/);assert.match(damageSourceNote(b,'arc',720),/曾用核心/);
 assert.match(damageSourceNote(b,'fire-other',24370),/可含反震.*不能.*反推/);assert.match(damageSourceNote(b,'fire-history',1),/不补造/);
 assert.equal(snapshot(b),before);b.relics=['K03'];assert.match(damageSourceNote(b,'arc',720),/当前携带.*历练累计/);assert.equal(damageRows(b).find(r=>r.key==='arc').value,720);
 const old={isExpedition:false,relics:b.relics};assert.doesNotMatch(damageSourceNote(old,'return',23439),/曾用核心/);
});
