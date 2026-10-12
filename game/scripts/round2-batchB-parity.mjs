/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Round-2 batch B (B-0) old-rules parity driver. Pure helper: it takes an Expedition class so the same
// deterministic drive can run against the batch-A source snapshot (to generate the fixture) and against the
// current tree (in tests/round2-batchB.test.mjs). It never changes game state outside the run it drives.
import {createHash} from 'node:crypto';
export const OLD_COMBOS=[];
for(const balanceVersion of [1,2,3])for(const growthVersion of [1,3,4])for(const encounterVersion of [1,3,5,6,7,8])OLD_COMBOS.push({balanceVersion,growthVersion,encounterVersion});
export const STATIONS=[[0,0],[1,1],[2,1],[3,0],[4,1],[5,0]];
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0,24);
// Batch A left presentation-only sigil fields (armedTargets/killsAtArming/cleared) ungated; they never change damage, RNG or timers.
// Optional observation metadata is outside this historical fixture; pre-existing gameplay fields stay in the comparison.
const normalize=d=>{const o=JSON.parse(JSON.stringify(d));delete o.defenseStats;delete o.chapterStats;delete o.runId;if(o.expedition){delete o.expedition.runId;for(const z of o.expedition.zones||[]){delete z.armedTargets;delete z.killsAtArming;delete z.cleared;}if(o.expedition.sigilStats?.recent)for(const r of o.expedition.sigilStats.recent)delete r.cleared;}return o;};
export function drive(b,seconds){
 const t0=b.time;let stalls=0,frames=0;
 while(b.time-t0<seconds&&!b.finished&&frames<seconds*60+600){
  if(b.scene==='cinematic')b.advanceCinematic(true);else if(b.modeState==='intro')b.start();else if(b.modeState==='choice'){b.chooseTrait(b.choices[0].id);}
  else if(b.scene==='intermission'){if(!b.rest.eventDone)b.chooseInteraction(0);if(!b.rest.coreDone)b.skipCore();if(!b.rest.routeDone)b.chooseRoute(0);b.continueRest();}
  if(b.modeState!=='battle'){if(stalls++>300)break;continue;}stalls=0;
  const k=Math.floor(b.time*2)%8,angle=k*Math.PI/4;b.input={x:Math.cos(angle),y:Math.sin(angle),aim:{x:640,y:360},focus:k%3===0};
  if(frames%240===120)b.dash();if(b.player.mana>=100&&frames%90===0)b.thunder();
  b.update(1/60);frames++;
 }
}
export function comboRow(Expedition,c,path,station,difficulty,mode='seed',challengeVersion=0,seconds=[15,10]){
 const [chapter,wave]=station;
 const b=new Expedition({seed:'parity-'+path+'-'+chapter,runId:'parity',path,chapter,difficulty,mode,recordVersion:0,segmentVersion:0,challengeVersion,balanceVersion:c.balanceVersion,growthVersion:c.growthVersion,encounterVersion:c.encounterVersion,metaRulesVersion:3,meta:[]},()=>{});
 b.wave=wave;b.node.selected=0;b.cinematicSeen=['bamboo','ghostFog','innerHall','treasure','cauldron'];b.beginNode();
 const derived={defendHP:b.objective?.kind==='defend'?b.objective.maxHp:null,boss:b.boss?.maxHp??null,maxHp:b.player.maxHp,maxReserve:b.player.maxReserve,stats:b.stats,enemyDmg:b.enemies.slice(0,3).map(e=>e.dmg),nodeXP:b.node.xp,routesXP:b.routes.map(ch=>ch.map(n=>n.xp)),dashCD:(b.dash(),b.player.dashCD),sigilLeft:b.sigilReadiness().left};
 drive(b,seconds[0]);const first=b.serialize();
 let second=null;if(!b.finished){const r=Expedition.restore(JSON.parse(JSON.stringify(first)),()=>{});drive(r,seconds[1]);second=r.serialize();}
 return {combo:c,path,station,difficulty,mode,challengeVersion,derived:hash(derived),first:hash(normalize(first)),second:second?hash(normalize(second)):null};
}
export function fixtureRows(Expedition){
 return OLD_COMBOS.map((c,i)=>{const path=i%6,station=STATIONS[(i+c.encounterVersion)%STATIONS.length];return comboRow(Expedition,c,path,station,(i+c.balanceVersion)%3);});
}
