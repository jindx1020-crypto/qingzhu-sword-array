/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';import assert from 'node:assert/strict';
import {prepareQuietChapterFixture} from '../scripts/browser-save-fixtures.mjs';
import {createRun,restoreRun} from '../gameplay/run-factory.js';
import {initialSave} from '../gameplay/data.js';
import {normalizeSave,SaveVault,SAVE_KEY} from '../gameplay/save-store.js';
const memory=save=>{const map=new Map([[SAVE_KEY,JSON.stringify(save)]]),writes=[];return {map,writes,getItem:key=>map.get(key)??null,setItem:(key,value)=>{writes.push(key);map.set(key,String(value));},removeItem:key=>map.delete(key)};};
const ledgerAmounts=b=>{const l=b.growth.ledger;return {allocated:l.baseAllocated,collected:l.baseCollected,uncollected:b.drops.reduce((sum,drop)=>sum+drop.xpBase,0),bonusAllocated:l.bonusAllocated,bonusCollected:l.bonusCollected,bonusUncollected:b.drops.reduce((sum,drop)=>sum+drop.xpBonus,0)};};
void test('quiet browser fixture is legal and paused before native frames without creating or deleting earned rewards',()=>{
 for(const path of [0,1,2,3,4,5]){const f=prepareQuietChapterFixture({path,seed:'quiet-fixture-'+path}),b=restoreRun(f.checkpoint);assert.equal(b.modeState,'pause');assert.equal(b.time,0);assert.equal(b.kills,0);assert.equal(b.totalXP,0);assert.equal(b.drops.length,0);assert.deepEqual(ledgerAmounts(b),{allocated:0,collected:0,uncollected:0,bonusAllocated:0,bonusCollected:0,bonusUncollected:0});assert.equal(f.setup.synthetic,true);assert.equal(f.setup.noNativeFrames,true);assert.equal(f.setup.extraRewardsGranted,false);assert.equal(f.setup.droppedRewards,false);assert.equal(b.enemies.length,1);assert.equal(b.enemies[0].hp,100000);assert.equal(b.enemies[0].dmg,0);assert.equal(b.enemies[0].noDrop,true);assert.equal(b.player.mana,100);assert.equal(b.player.hp,b.player.maxHp-10);assert.equal(b.player.shield,5);assert.doesNotThrow(()=>normalizeSave(f.save));}
});
void test('fixture save, returned checkpoint and setup are detached; repeated restore never grants rewards',()=>{
 const f=prepareQuietChapterFixture(),raw=JSON.stringify(f.save);f.checkpoint.player.mana=0;f.setup.resourceFixture.mana=0;assert.equal(JSON.stringify(f.save),raw);let b=restoreRun(f.save.checkpoint);const reward={gold:b.gold,totalXP:b.totalXP,kills:b.kills,consumables:structuredClone(b.consumables),research:b.research};for(let i=0;i<5;i++){b=restoreRun(b.serialize());assert.deepEqual({gold:b.gold,totalXP:b.totalXP,kills:b.kills,consumables:b.consumables,research:b.research},reward);}assert.equal(JSON.stringify(f.save),raw);
});
void test('quiet fixture remains saveable across simulated scheduling delays without resetting any live field or XP ledger',()=>{
 for(const delay of [0,16,50,100,250,500,2000]){
  const f=prepareQuietChapterFixture({runId:'quiet-delay-'+delay}),storage=memory(f.save),vault=new SaveVault(storage);vault.load();const b=restoreRun(f.checkpoint);b.resume();let remaining=delay/1000;while(remaining>0){const dt=Math.min(1/60,remaining);b.update(dt);remaining-=dt;}
  b.pause();const before=JSON.stringify(b.serialize()),saved=vault.commit({...f.save,checkpoint:b.serialize()}),restored=restoreRun(saved.checkpoint);assert.equal(JSON.stringify(restored.serialize()),before);const values=ledgerAmounts(restored);assert.ok(Math.abs(values.allocated-values.collected-values.uncollected)<1e-6);assert.ok(Math.abs(values.bonusAllocated-values.bonusCollected-values.bonusUncollected)<1e-6);assert.equal(new SaveVault(storage).load().checkpoint.time,b.time);
 }
});
void test('late clearField on a genuinely allocated drop is deterministically rejected and keeps the prior valid save',()=>{
 const b=createRun({mode:'story',path:1,seed:'late-clear-invalid',runId:'late-clear-invalid'});b.cinematicSeen=['bamboo'];b.beginNode();const storage=memory({...initialSave(),checkpoint:b.serialize()}),vault=new SaveVault(storage);vault.load();const oldRaw=storage.getItem(SAVE_KEY),oldWrites=storage.writes.length,enemy=b.enemies[0];enemy.spawn=0;b.hit(enemy,1e6,'thunder',false);assert.ok(b.drops.some(drop=>drop.xpBase>0));const before=ledgerAmounts(b);assert.ok(before.allocated>before.collected);assert.ok(before.uncollected>0);assert.doesNotThrow(()=>normalizeSave({...initialSave(),checkpoint:b.serialize()}));
  b.clearField();assert.equal(b.drops.length,0);assert.equal(b.growth.ledger.baseAllocated,before.allocated);assert.equal(b.growth.ledger.baseCollected,before.collected);assert.throws(()=>vault.commit({...initialSave(),checkpoint:b.serialize()}),/基础经验待拾取/);assert.equal(storage.getItem(SAVE_KEY),oldRaw);assert.equal(storage.writes.length,oldWrites);const reloaded=new SaveVault(storage).load();assert.ok(reloaded.checkpoint);assert.equal(reloaded.checkpoint.time,0);
});
void test('guard fixture overrides are separate from run options and a real dash yields exactly its actual counter gain',()=>{
 const f=prepareQuietChapterFixture({path:5,seed:'quiet-guard'},{resourcePreset:'initial',resources:{shield:0},targetOffset:{x:55,y:0}}),b=restoreRun(f.checkpoint);assert.equal(b.player.hp,b.player.maxHp);assert.equal(b.player.mana,0);assert.equal(b.player.shield,0);for(const key of ['resources','resourcePreset','targetOffset'])assert.equal(Object.hasOwn(b.options,key),false);b.resume();b.input={x:0,y:1};assert.equal(b.dash(),true);const target=b.enemies[0],hp=target.hp;b.hitPlayer(25);b.hitPlayer(25);assert.equal(b.defenseStats.deflections,1);assert.equal(b.defenseStats.counters,1);assert.equal(b.defenseStats.counterShield,3);assert.ok(hp>target.hp);assert.ok(Math.abs(b.defenseStats.counterDamage-(hp-target.hp))<1e-6);assert.doesNotThrow(()=>normalizeSave({...f.save,checkpoint:b.serialize()}));
});
void test('puppet fixture keeps initial resources and records actual firing after normal engine advancement',()=>{
 const f=prepareQuietChapterFixture({path:2,seed:'quiet-puppet'},{resourcePreset:'initial',targetOffset:{x:100,y:0}}),b=restoreRun(f.checkpoint);assert.equal(b.player.hp,b.player.maxHp);assert.equal(b.player.mana,0);assert.equal(b.player.shield,b.player.maxShield);b.resume();for(let i=0;i<90;i++)b.update(1/60);assert.ok(b.defenseStats.setupActive>0);assert.ok(b.defenseStats.puppetShots>0);assert.equal(b.totalXP,0);assert.equal(b.kills,0);assert.doesNotThrow(()=>normalizeSave({...f.save,checkpoint:b.serialize()}));
});
void test('fixture override names and values are validated without accepting arbitrary runtime fields',()=>{
 for(const input of [{resourcePreset:'unknown'},{resources:{checkpoint:null}},{resources:{mana:Infinity}},{targetOffset:{x:NaN,y:0}},{resources:{hp:-1}}])assert.throws(()=>prepareQuietChapterFixture({},input));
});
