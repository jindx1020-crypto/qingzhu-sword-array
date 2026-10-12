/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Declared isolated engine fixtures, not natural playthroughs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,restoreRun} from '../gameplay/run-factory.js';
import {initialSave} from '../gameplay/data.js';
import {normalizeSave} from '../gameplay/save-store.js';
import {CONSUMABLES} from '../gameplay/data.js';
import {validateDefenseStats} from '../gameplay/defense-telemetry.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function arena(path=5,options={}){const b=createRun({seed:'defense-events',runId:'defense-events',path,...options});if(b.isExpedition)b.beginNode();else b.start();b.enemies=[];b.shots=[];b.zones=[];b.drops=[];b.player.invuln=0;b.rebuildHash();return b;}
function target(b,hp=100000){const e=b.spawn(0,{hp,noDrop:true});e.x=b.player.x+45;e.y=b.player.y;e.maxHp=hp;b.rebuildHash();return e;}
function armorless(b){Object.assign(b.stats,{armor:0,dashGuard:0,puppetGuard:0,hazardGuard:0});}
function quietTicks(b,n,dt=.05){b.enemies=[];b.shots=[];b.zones=[];b.updateDirector=()=>{};b.updateEnvironment=()=>{};for(let i=0;i<n;i++)b.update(dt);}

void test('T13 empty and rejected dashes do not become deflections; actual guard contact is once per dash with capped counter damage',()=>{
 const b=arena();target(b,7);b.player.shield=0;assert.equal(b.dash(),true);assert.equal(b.defenseStats.dashes,1);assert.equal(b.dash(),false);assert.equal(b.defenseStats.dashes,1);assert.equal(b.defenseStats.deflections,0);assert.equal(b.defenseStats.counterShield,0);
 b.hitPlayer(100);assert.equal(b.defenseStats.deflections,1);assert.equal(b.defenseStats.counters,1);assert.equal(b.defenseStats.counterShield,3);assert.equal(b.defenseStats.counterDamage,7);assert.equal(b.defenseStats.shieldAbsorbed,0);
 b.hitPlayer(100);assert.equal(b.defenseStats.deflections,1);assert.equal(b.defenseStats.counters,1);validateDefenseStats(b.defenseStats,b);
});

void test('T13 legacy counter cooldown and reward remain distinct from a successfully blocked dash',()=>{
 for(const [balanceVersion,gain]of [[1,6],[2,6],[3,3],[4,3]]){
  const b=arena(5,{balanceVersion});b.time=10;b.player.shield=0;b.dash();b.hitPlayer(20);assert.equal(b.defenseStats.counterShield,gain);
  b.time=11;b.player.dashCD=0;b.dash();b.hitPlayer(20);assert.equal(b.defenseStats.deflections,2);assert.equal(b.defenseStats.counters,balanceVersion<3?1:2);
  validateDefenseStats(b.defenseStats,b);
 }
 const old=arena(5,{rulesVersion:1});old.dash();old.hitPlayer(20);assert.equal(old.defenseStats.dashes,1);assert.equal(old.defenseStats.counters,0);assert.equal(old.defenseStats.deflections,0);
 const other=arena(0);other.dash();other.hitPlayer(20);assert.equal(other.defenseStats.dashes,1);assert.equal(other.defenseStats.deflections,0,'other starters evading damage do not become guard-window events');
});

void test('T13 extra shield cap, K12 shield spending, consumables and invincibility are not counter recovery or shield absorption',()=>{
 const b=arena();b.relics=['K12'];b.recalc();b.player.shield=b.player.maxShield+100;const before=b.player.shield;b.dash();assert.equal(b.player.shield,before-5);assert.equal(b.defenseStats.shieldAbsorbed,0);b.hitPlayer(50);assert.equal(b.defenseStats.counterShield,0);assert.equal(b.defenseStats.counterDamage,0);
 b.time+=5;b.player.invuln=2;b.hitPlayer(100);assert.equal(b.defenseStats.deflections,1);assert.equal(b.defenseStats.shieldAbsorbed,0);
 const shieldItem=CONSUMABLES.find(c=>c.effect==='shield');assert.ok(shieldItem);b.consumables=[{id:shieldItem.id,count:1}];assert.equal(b.consume(0),true);assert.equal(b.defenseStats.regenShield,0);assert.equal(b.defenseStats.counterShield,0);b.player.mana=100;b.stats.thunderShield=20;assert.equal(b.thunder(),true);assert.equal(b.defenseStats.regenShield,0);assert.equal(b.defenseStats.counterShield,0);
});

void test('T13 shield break uses its actual branch and effective damage, separate from shield absorption and a fatal hit',()=>{
 const b=arena(0);b.relics=['K11'];b.recalc();armorless(b);b.player.shield=20;b.player.hp=100;target(b,4);b.hitPlayer(30);assert.equal(b.defenseStats.shieldAbsorbed,20);assert.equal(b.defenseStats.breaks,1);assert.equal(b.defenseStats.breakDamage,4);assert.equal(b.defenseStats.counterDamage,0);assert.equal(b.shieldAbsorbed,0,'old K11 threshold still clears');
 b.player.invuln=0;b.player.shield=12;b.hitPlayer(14);assert.equal(b.defenseStats.shieldAbsorbed,32);assert.equal(b.defenseStats.breaks,1,'the original cooldown still applies');
 const fatal=arena(0);fatal.relics=['K11'];fatal.recalc();armorless(fatal);fatal.player.shield=12;fatal.player.hp=1;let result;fatal.emit=e=>{if(e.type==='finish')result=e.summary;};fatal.hitPlayer(100);assert.equal(result.defenseStats.shieldAbsorbed,12);assert.equal(result.defenseStats.breaks,0,'fatal early return retains original K11 behavior');
});

void test('T13 counter final-hit observation is present in the synchronous finish summary and remains detached',()=>{
 const b=arena();target(b,5);let result;const original=b.kill.bind(b);b.kill=e=>{original(e);b.finish(false,'fixture finish');};b.emit=e=>{if(e.type==='finish')result=e.summary;};b.player.shield=0;b.dash();b.hitPlayer(30);assert.equal(result.defenseStats.counterDamage,5);assert.equal(result.defenseStats.counters,1);assert.equal(result.defenseStats.counterShield,3);b.defenseStats.counterDamage+=1;assert.equal(result.defenseStats.counterDamage,5);
});

void test('T13 natural recovery uses actual capped gain and pause, choice, rest and intro add no observed time',()=>{
 const b=arena();b.stats.shieldRegen=10;b.player.shield=b.player.maxShield-.125;b.player.lastHit=b.time;quietTicks(b,80);assert.equal(b.defenseStats.regenShield,0,'strict >4 seconds keeps the boundary');quietTicks(b,1);close(b.defenseStats.regenShield,.125);close(b.defenseStats.elapsed,4.05);
 const before=structuredClone(b.defenseStats);for(const mode of ['pause','choice','rest','intro','result']){b.modeState=mode;b.update(.05);}assert.deepEqual(b.defenseStats,before);
});

void test('T13 stationary damage, starter setup and mobile core use their distinct real time gates, not physical displacement',()=>{
 for(const balanceVersion of [2,3,4]){
  const b=arena(2,{balanceVersion});b.stats.stationary=.35;quietTicks(b,20);close(b.defenseStats.puppetSeconds,1);close(b.defenseStats.stationaryActive,1);assert.ok(b.defenseStats.setupActive>0&&b.defenseStats.setupActive<1);
  const setup=b.defenseStats.setupActive,stationary=b.defenseStats.stationaryActive;b.input={x:1,y:0};quietTicks(b,2);if(balanceVersion>=3){close(b.defenseStats.setupActive-setup,.1);close(b.defenseStats.stationaryActive-stationary,.1);}else{close(b.defenseStats.setupActive,setup);close(b.defenseStats.stationaryActive,stationary);}
  b.relics=['K06'];b.recalc();b.stats.stationary=.35;const prior=structuredClone(b.defenseStats);quietTicks(b,2);close(b.defenseStats.setupPossible,prior.setupPossible);close(b.defenseStats.stationaryActive,prior.stationaryActive);close(b.defenseStats.mobileActive-prior.mobileActive,.1);
  b.input={x:0,y:0};const next=structuredClone(b.defenseStats);quietTicks(b,2);close(b.defenseStats.mobileActive,next.mobileActive);close(b.defenseStats.stationaryActive-next.stationaryActive,.1);validateDefenseStats(b.defenseStats,b);
 }
});

void test('T13 puppet emission counts actual created arrows, includes K05 extras once and respects the existing cap',()=>{
 const b=arena(2);b.relics=['K05'];b.recalc();b.stats.puppets=2;b.stillTime=1;b.player.moving=false;b.puppets=[{x:640,y:400,cool:0},{x:640,y:400,cool:0}];target(b);
 b.updateAllies(0);assert.equal(b.defenseStats.puppetShots,2);assert.equal(b.defenseStats.extraShots,0);
 for(const p of b.puppets)p.cool=0;b.updateAllies(0);assert.equal(b.defenseStats.puppetShots,8);assert.equal(b.defenseStats.extraShots,4);assert.equal(b.defenseStats.setupShots,8);
 const count=b.defenseStats.puppetShots;b.shots=Array.from({length:451},()=>({}));for(const p of b.puppets)p.cool=0;b.updateAllies(0);assert.equal(b.defenseStats.puppetShots,count);
 b.shots=Array.from({length:450},()=>({}));for(const p of b.puppets)p.cool=0;b.updateAllies(0);assert.equal(b.defenseStats.puppetShots,count+1);assert.equal(b.shots.length,451);validateDefenseStats(b.defenseStats,b);
});

void test('T13 long accepted legacy clocks use the actual clock increment and stay saveable after resumed combat',()=>{
 for(const rulesVersion of [1,2,3])for(const time of [1e6,5e7]){
  const b=arena(2,{rulesVersion}),data=b.serialize();delete data.defenseStats;data.time=time;
  const r=restoreRun(data);if(r.modeState!=='battle')r.start();r.stats.stationary=.35;quietTicks(r,600,1/60);
  close(r.defenseStats.elapsed,r.time-time);assert.ok(r.defenseStats.puppetSeconds<=r.defenseStats.elapsed+1e-7);validateDefenseStats(r.defenseStats,r);
  const checkpoint=r.serialize();assert.doesNotThrow(()=>normalizeSave({...initialSave(),checkpoint}));const again=restoreRun(checkpoint);assert.deepEqual(again.defenseStats,r.defenseStats);
 }
});
