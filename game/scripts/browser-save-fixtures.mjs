/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Node-only browser fixture preparation. Production modules must never import this helper.
import assert from 'node:assert/strict';
import {initialSave} from '../gameplay/data.js';
import {createRun,restoreRun} from '../gameplay/run-factory.js';
import {normalizeSave} from '../gameplay/save-store.js';

export function prepareQuietChapterFixture(options={}, {resourcePreset='chapter-actions',resources={},targetOffset={x:80,y:0}}={}){
 assert.ok(['chapter-actions','initial'].includes(resourcePreset),'Unknown synthetic resource preset');
 const resourceKeys=['hp','mana','shield','invuln','dash','dashCD','lastDash'];
 assert.ok(resources&&typeof resources==='object'&&!Array.isArray(resources)&&Object.keys(resources).every(key=>resourceKeys.includes(key)&&Number.isFinite(resources[key])),'Only declared finite player fixture values are supported');
 assert.ok(targetOffset&&Number.isFinite(targetOffset.x)&&Number.isFinite(targetOffset.y),'Target fixture offset must be finite');
 const b=createRun({mode:'story',path:1,seed:'batch8-current',...options});
 assert.ok(b.isExpedition&&b.chapter===0&&b.wave===0,'Quiet fixture starts at the first current-rule chapter node');
 b.cinematicSeen=['bamboo'];b.beginNode();
 const before={time:b.time,totalXP:b.totalXP,kills:b.kills,drops:b.drops.length,baseAllocated:b.growth?.ledger?.baseAllocated??null,baseCollected:b.growth?.ledger?.baseCollected??null};
 assert.equal(before.time,0);assert.equal(before.totalXP,0);assert.equal(before.kills,0);assert.equal(before.drops,0);
 if(b.growth?.ledger){assert.equal(before.baseAllocated,0);assert.equal(before.baseCollected,0);}
 // Clear only the synchronously created opening enemies, before a native frame can allocate any drops.
 b.clearField();b.spawnBudget=0;b.nextElite=1e8;b.nextHazard=1e8;
 b.player.invuln=0;b.player.dash=0;b.player.dashCD=0;b.player.lastDash=-100;b.player.lastHit=b.time;
 if(resourcePreset==='chapter-actions'){b.player.mana=100;b.player.hp=b.player.maxHp-10;b.player.shield=5;}
 Object.assign(b.player,resources);
 const enemy=b.spawn(0,{hp:100000,maxHp:100000,speed:0,dmg:0,spawn:0,noDrop:true});
 enemy.x=b.player.x+targetOffset.x;enemy.y=b.player.y+targetOffset.y;b.rebuildHash();b.pause();
 const checkpoint=b.serialize();
 const save=normalizeSave({...initialSave(),guidesSeen:['practice-v1',0,1,2,3,4,5],checkpoint:structuredClone(checkpoint)});
 const restored=restoreRun(structuredClone(checkpoint));
 assert.equal(restored.modeState,'pause');assert.equal(restored.time,before.time);assert.equal(restored.totalXP,before.totalXP);assert.equal(restored.kills,before.kills);assert.equal(restored.drops.length,0);
 const setup={synthetic:true,method:'Node-side current-rule first-node fixture, prepared synchronously before any update/RAF, then validated by normalizeSave and restoreRun. Not natural gameplay or naturally earned resources.',noNativeFrames:true,seed:b.seed,path:b.path,mode:b.mode,resourcePreset,resourceFixture:{mana:b.player.mana,hp:b.player.hp,maxHp:b.player.maxHp,shield:b.player.shield,reserve:b.player.reserve,invuln:b.player.invuln,dash:b.player.dash,dashCD:b.player.dashCD,lastDash:b.player.lastDash},target:{id:enemy.id,hp:100000,speed:0,damage:0,noDrop:true,offset:{...targetOffset}},before,after:{time:restored.time,totalXP:restored.totalXP,kills:restored.kills,drops:restored.drops.length},droppedRewards:false,extraRewardsGranted:false};
 return {save,checkpoint:structuredClone(checkpoint),setup};
}
