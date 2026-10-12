/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';import assert from 'node:assert/strict';
import {Expedition} from '../gameplay/expedition.js';
import {initialSave} from '../gameplay/data.js';
import {SUPPLIES} from '../gameplay/expedition-data.js';
import {settleRunResult,resultAlreadyClaimed,recordReceipt} from '../gameplay/records.js';
import {normalizeSave,SaveVault,SAVE_KEY} from '../gameplay/save-store.js';
import {rememberAttempt,confirmSettlement,settlementDisplay} from '../gameplay/settlement-display.js';
const save=()=>normalizeSave(initialSave());
function result(options={}){const b=new Expedition({seed:'settlement-display',runId:'settlement-display',mode:'story',recordVersion:0,segmentVersion:0,challengeVersion:0,...options});b.chapter=5;b.wave=3;b.receipts=b.routes.flat().map(n=>n.id);b.time=100;b.kills=120;b.research=6;b.finished=true;b.won=true;b.scene=b.modeState='result';return b;}
const memory=value=>{const map=new Map([[SAVE_KEY,JSON.stringify(value)]]);return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
void test('first story/seed victory is captured from actual before/next values and announced only after its saved receipt',()=>{
 for(const mode of ['story','seed']){const before=save(),b=result({mode});before.insight=12;before.garden.points=1;const summary=b.summary(),next=settleRunResult(before,summary),raw=JSON.stringify({before,next,summary,b:b.serialize()});rememberAttempt(b,before,next,summary);let view=settlementDisplay(b,before);
  assert.equal(view.kind,'pending');assert.equal(view.firstVictory,false);assert.equal(view.insight,summary.insight);assert.equal(view.research,6);assert.deepEqual(view.balance,{insight:12,research:1,wins:0});assert.equal(JSON.stringify({before,next,summary,b:b.serialize()}),raw);
  const storage=memory(before),vault=new SaveVault(storage);vault.load();const committed=vault.commit(next);assert.equal(confirmSettlement(b,committed),true);view=settlementDisplay(b,committed);assert.equal(view.kind,'saved');assert.equal(view.firstVictory,true);assert.equal(view.endlessAvailable,true);assert.equal(view.balance.insight,12+summary.insight);assert.equal(view.balance.research,7);assert.equal(view.researchCapacity,2);assert.equal(confirmSettlement(b,committed),false,'repeated writes cannot create a second first-save event');
 }
});
void test('failed writes stay pending, then a successful retry confirms once without awarding twice',()=>{
 const before=save(),b=result(),summary=b.summary(),next=settleRunResult(before,summary),storage=memory(before),vault=new SaveVault(storage);vault.load();rememberAttempt(b,before,next,summary);const original=storage.setItem,raw=storage.getItem(SAVE_KEY);storage.setItem=()=>{throw Error('quota');};assert.throws(()=>vault.commit(next));assert.equal(storage.getItem(SAVE_KEY),raw);assert.equal(confirmSettlement(b,before),false);assert.equal(settlementDisplay(b,before).kind,'pending');assert.equal(settlementDisplay(b,before).firstVictory,false);
 storage.setItem=original;const committed=vault.commit(next);assert.equal(confirmSettlement(b,committed),true);assert.equal(settleRunResult(committed,summary),committed);assert.equal(committed.runs,1);assert.equal(committed.wins,1);assert.equal(committed.garden.points,6);
});
void test('a competing window blocks the original settlement without replacing disk state or confirming an unlock',()=>{
 const before=save(),b=result(),summary=b.summary(),next=settleRunResult(before,summary),storage=memory(before),vault=new SaveVault(storage),other=new SaveVault(storage);vault.load();other.load();rememberAttempt(b,before,next,summary);
 const latest=other.commit({...before,insight:7}),disk=storage.getItem(SAVE_KEY);assert.throws(()=>vault.commit(next),error=>error.code==='conflict');assert.equal(storage.getItem(SAVE_KEY),disk);assert.equal(confirmSettlement(b,latest),false);assert.equal(settlementDisplay(b,before).kind,'pending');assert.equal(settlementDisplay(b,before).firstVictory,false);assert.equal(latest.wins,0);assert.equal(resultAlreadyClaimed(latest,summary),false);
});
void test('a lost formal run reports its earned insight and research without claiming victory or unlocking endless',()=>{
 const before=save(),b=result();b.won=false;b.chapter=2;b.wave=1;b.receipts=b.routes.flat().slice(0,8).map(n=>n.id);b.research=2;const summary=b.summary(),next=settleRunResult(before,summary);rememberAttempt(b,before,next,summary);const storage=memory(before),vault=new SaveVault(storage);vault.load();const committed=vault.commit(next);assert.equal(confirmSettlement(b,committed),true);
 const view=settlementDisplay(b,committed);assert.equal(view.kind,'saved');assert.equal(view.insight,summary.insight);assert.equal(view.research,2);assert.equal(view.firstVictory,false);assert.equal(view.endlessAvailable,false);assert.equal(committed.wins,0);
});
void test('a duplicate finish on the pending base cannot overwrite the first captured delta with zero',()=>{
 const before=save(),b=result(),summary=b.summary(),pending=settleRunResult(before,summary);rememberAttempt(b,before,pending,summary);assert.equal(settleRunResult(pending,summary),pending);rememberAttempt(b,pending,pending,summary);assert.equal(settlementDisplay(b,before).research,6);assert.equal(settlementDisplay(b,before).insight,summary.insight);
 const storage=memory(before),vault=new SaveVault(storage);vault.load();const committed=vault.commit(pending);confirmSettlement(b,committed);rememberAttempt(b,committed,committed,summary);assert.equal(settlementDisplay(b,committed).research,6);assert.equal(settlementDisplay(b,committed).firstVictory,true);
});
void test('later functional writes may spend a pending balance while preserving the observed award and actual saved balance',()=>{
 const before=save(),b=result(),summary=b.summary(),pending=settleRunResult(before,summary);rememberAttempt(b,before,pending,summary);
 const combined={...pending,insight:pending.insight-3,garden:{...pending.garden,points:pending.garden.points-3},settings:{...pending.settings,music:.4}},storage=memory(before),vault=new SaveVault(storage);vault.load();const committed=vault.commit(combined);assert.equal(confirmSettlement(b,committed),true);
 const view=settlementDisplay(b,committed);assert.equal(view.insight,summary.insight);assert.equal(view.research,6);assert.equal(view.balance.insight,summary.insight-3);assert.equal(view.balance.research,3);assert.equal(view.researchCapacity,1);
});
void test('receipt, history and garden duplicate guards all remain prior results rather than new first-victory observations',()=>{
 for(const source of ['receipt','history','garden']){const before=save(),b=result(),summary=b.summary();before.wins=1;if(source==='receipt')before.records.receipts.push(recordReceipt(b.runId,'finish'));if(source==='history')before.history.push(summary);if(source==='garden')before.garden.receipts.push(b.runId);
  assert.equal(resultAlreadyClaimed(before,summary),true);assert.equal(settleRunResult(before,summary),before);rememberAttempt(b,before,before,summary);assert.equal(confirmSettlement(b,before),false);const view=settlementDisplay(b,before);assert.equal(view.kind,'prior');assert.equal(view.saved,true);assert.equal(view.firstVictory,false);assert.equal(view.endlessAvailable,true);assert.equal(view.insight,null);assert.equal(view.research,null);
 }
});
void test('old results without local before-state or a stable runId never fabricate first victory or claim a saved result is unsaved',()=>{
 const b=result(),committed=settleRunResult(save(),b.summary()),restored=result();assert.equal(confirmSettlement(restored,committed),false);assert.equal(settlementDisplay(restored,committed).firstVictory,false);assert.equal(settlementDisplay(restored,committed).insight,null);
 const legacy=result();legacy.runId=undefined;const before=save(),summary=legacy.summary(),next=settleRunResult(before,summary);rememberAttempt(legacy,before,next,summary);legacy.resultFeedback={saved:true};const view=settlementDisplay(legacy,next);assert.equal(view.kind,'untracked-saved');assert.equal(view.saved,true);assert.match(view.label,/已保存.*对照未记录/);assert.equal(view.firstVictory,false);assert.equal(view.endlessAvailable,true);assert.equal(view.insight,null);
});
void test('study and training never show formal outcomes; replay/endless retain actual insight but gain no garden research or first win',()=>{
 for(const options of [{studyVersion:1},{mode:'training'}]){const b=result(options),before=save(),next=settleRunResult(before,b.summary());assert.equal(next,before);rememberAttempt(b,before,next,b.summary());assert.equal(confirmSettlement(b,next),false);assert.equal(settlementDisplay(b,next).kind,'excluded');}
 for(const mode of ['replay','endless']){const b=result({mode}),before=save(),summary=b.summary(),next=settleRunResult(before,summary);rememberAttempt(b,before,next,summary);confirmSettlement(b,next);const view=settlementDisplay(b,next);assert.equal(view.insight,summary.insight);assert.equal(view.research,0);assert.equal(view.researchApplies,false);assert.equal(view.firstVictory,false);assert.equal(next.wins,0);}
});
void test('normalization rejects capped insight instead of silently clipping it, and garden deltas use actual arithmetic',()=>{
 const before=save(),b=result();before.insight=1e12;const summary=b.summary(),next=settleRunResult(before,summary);rememberAttempt(b,before,next,summary);const storage=memory(before),vault=new SaveVault(storage);vault.load();assert.throws(()=>vault.commit(next));assert.equal(confirmSettlement(b,before),false);assert.equal(settlementDisplay(b,before).firstVictory,false);
 const huge=save(),other=result({runId:'large-garden'});huge.garden.points=1e20;const after=settleRunResult(huge,other.summary());assert.equal(after.garden.points,huge.garden.points,'the existing Number arithmetic cannot represent an extra six at this magnitude');rememberAttempt(other,huge,after,other.summary());const stored=normalizeSave(after);confirmSettlement(other,stored);assert.equal(settlementDisplay(other,stored).research,0,'do not print summary.research as an actual credit');
});
void test('recovery adoption, a different run and a rolled-back win balance cannot confirm a captured first-victory event',()=>{
 const before=save(),b=result(),next=settleRunResult(before,b.summary());rememberAttempt(b,before,next,b.summary());assert.equal(confirmSettlement(b,next,{allowOutcome:false}),false);assert.equal(settlementDisplay(b,next).firstVictory,false);
 assert.equal(confirmSettlement(b,{...next,wins:0}),false);b.runId='another-run';assert.equal(confirmSettlement(b,next),false);b.runId='settlement-display';assert.equal(confirmSettlement(b,next),true);
});
void test('research guidance respects remaining alternatives and the display cannot mutate the reward or save',()=>{
 const before=save(),b=result(),summary=b.summary(),next=settleRunResult(before,summary);rememberAttempt(b,before,next,summary);confirmSettlement(b,next);next.garden.unlocked=SUPPLIES.map(s=>s.id);const raw=JSON.stringify({before,next,summary,run:b.serialize()}),view=settlementDisplay(b,next);assert.equal(view.remainingSupplies,0);assert.equal(view.researchCapacity,0);view.balance.insight=-999;
 assert.equal(JSON.stringify({before,next,summary,run:b.serialize()}),raw);assert.equal(settlementDisplay(b,next).balance.insight,next.insight);assert.equal(settlementDisplay(b,next).research,6);
});
