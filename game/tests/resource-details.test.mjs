/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';import assert from 'node:assert/strict';
import {Expedition} from '../gameplay/expedition.js';
import {Battle} from '../gameplay/engine.js';
import {resourceOverview,allyDeployment} from '../gameplay/resource-details.js';

void test('resource details reuse the live shield cap and preserve excess shield without inventing an acquisition history',()=>{
 for(const relics of [[],['K11'],['K12']]){const b=new Expedition({path:5,seed:'resource-shield'});b.relics=relics;b.recalc();b.player.shield=50;
  const before=JSON.stringify(b.serialize()),rng=b.rng.state(),content=b.contentRng.state(),r=resourceOverview(b);
  assert.equal(r.shield.maximum,b.player.maxShield);assert.equal(r.shield.extra,50-b.player.maxShield);assert.equal(r.shield.gap,0);assert.equal(r.sources.totals.shield*r.shield.core,b.player.maxShield);assert.equal(r.shield.current,50);
  assert.equal(JSON.stringify(b.serialize()),before);assert.equal(b.rng.state(),rng);assert.equal(b.contentRng.state(),content);assert.equal('history' in r.shield,false);
 }
});
void test('resource detail separates actual units, permanent deployment, breeding and temporary additions at caps',()=>{
 const b=new Expedition({seed:'resource-allies',path:2});b.stats.puppets=11;b.stats.insects=28;b.stats.breed=1;b.kills=150;b.player.buffs.puppet=b.time+5;b.player.buffs.insect=b.time+5;b.puppets=[{id:1}];b.insects=[{id:2},{id:3}];
 const before=JSON.stringify(b.serialize()),r=resourceOverview(b).allies;
 assert.deepEqual(allyDeployment(b),{puppets:12,insects:30});assert.equal(r.puppets,1);assert.equal(r.insects,2);assert.equal(r.permanentPuppets,11);assert.equal(r.temporaryPuppets,1);assert.equal(r.permanentInsects,28);assert.equal(r.brood,2);assert.equal(r.temporaryInsects,0);
 assert.equal(JSON.stringify(b.serialize()),before);b.time=5;assert.deepEqual(allyDeployment(b),{puppets:11,insects:30});
});
void test('resource budgets match each current or old battle cost without spending mana, reserve or RNG',()=>{
 for(const rulesVersion of [1,2,3])for(const balanceVersion of [1,2,3,4])for(const path of [0,1]){
  const b=rulesVersion===3?new Expedition({seed:'resource-budget',path,balanceVersion}):new Battle({seed:'resource-budget',rulesVersion,path,balanceVersion});
  b.traits={'thunder-2':2};if(rulesVersion===3)b.relics=['K03'];b.recalc();b.player.reserve=19.99;b.player.mana=0;
  const before=JSON.stringify(b.serialize()),cost=b.thunderReadiness().cost,rng=b.rng.state(),r=resourceOverview(b).reserve;
  assert.equal(r.cost,cost);assert.equal(r.budget,Math.floor(19.99/cost));assert.equal(r.mana,0);assert.equal(JSON.stringify(b.serialize()),before);assert.equal(b.rng.state(),rng);
 }
});
