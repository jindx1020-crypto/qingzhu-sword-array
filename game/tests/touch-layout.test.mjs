/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {LAYOUT_KEYS,normalizeLayoutPreferences,layoutPreset,applyLayoutPatch} from '../gameplay/touch-layout.js';
import {TOUCH_DEFAULTS,touchSettings} from '../gameplay/touch-controls.js';
import {initialSave} from '../gameplay/data.js';
import {createRun} from '../gameplay/run-factory.js';
import {normalizeSave,SaveVault,SAVE_KEY,BACKUP_KEY,JOURNAL_KEY,RAW_BACKUP_KEY} from '../gameplay/save-store.js';
const defaults={joystickSide:'left',joystickSize:'standard',skillSide:'right',suppliesFollowSkills:false};
const memory=initial=>{const map=new Map([[SAVE_KEY,JSON.stringify(initial)]]),writes=[];return {map,writes,getItem:k=>map.get(k)??null,setItem(k,v){writes.push([k,String(v)]);map.set(k,String(v));},removeItem:k=>map.delete(k)};};
const slots=storage=>[SAVE_KEY,BACKUP_KEY,JOURNAL_KEY,RAW_BACKUP_KEY].map(k=>storage.getItem(k));
void test('layout defaults keep every old placement and opt out of following unless the new boolean is exactly true',()=>{
 assert.deepEqual(LAYOUT_KEYS,Object.keys(defaults));assert.equal(Object.isFrozen(LAYOUT_KEYS),true);
 for(const value of [undefined,null,{},[],false,'legacy'])assert.deepEqual(normalizeLayoutPreferences(value),defaults);
 for(const value of [undefined,null,false,0,1,'true','false','yes',{},[]])assert.equal(normalizeLayoutPreferences({suppliesFollowSkills:value}).suppliesFollowSkills,false);
 assert.equal(normalizeLayoutPreferences({suppliesFollowSkills:true}).suppliesFollowSkills,true);
 assert.deepEqual(normalizeLayoutPreferences({joystickSide:'up',joystickSize:2,skillSide:'rightish'}),defaults);
 assert.deepEqual(TOUCH_DEFAULTS,{...defaults,touchLock:false});assert.deepEqual(touchSettings(),TOUCH_DEFAULTS);
 assert.equal(initialSave().settings.suppliesFollowSkills,undefined,'data.js and the existing initial save remain unchanged');
});
void test('left and right presets are single patches for the casting hand, with size and lock intentionally absent',()=>{
 assert.deepEqual(layoutPreset('left'),{joystickSide:'right',skillSide:'left',suppliesFollowSkills:true});
 assert.deepEqual(layoutPreset('right'),{joystickSide:'left',skillSide:'right',suppliesFollowSkills:true});
 assert.equal(layoutPreset('up'),null);assert.equal(layoutPreset(null),null);
 for(const side of ['left','right']){const patch=layoutPreset(side);assert.equal(Object.hasOwn(patch,'joystickSize'),false);assert.equal(Object.hasOwn(patch,'touchLock'),false);patch.skillSide='modified';assert.equal(layoutPreset(side).skillSide,side);}
});
void test('layout patch accepts only its own keys and leaves unrelated settings and keymap values intact',()=>{
 const keymap={dash:'ControlLeft'},opaque={custom:true},settings={joystickSide:'left',joystickSize:'large',skillSide:'right',suppliesFollowSkills:false,touchLock:true,music:.15,quality:0,keymap,opaque};
 const patch={...layoutPreset('left'),touchLock:false,music:1,quality:1,keymap:{dash:'Space'},records:{schema:2}};
 const result=applyLayoutPatch(settings,patch);assert.deepEqual(normalizeLayoutPreferences(result),{joystickSide:'right',joystickSize:'large',skillSide:'left',suppliesFollowSkills:true});
 assert.equal(result.touchLock,true);assert.equal(result.music,.15);assert.equal(result.quality,0);assert.equal(result.keymap,keymap);assert.equal(result.opaque,opaque);assert.equal(Object.hasOwn(result,'records'),false);
 const inherited=Object.create({skillSide:'left',touchLock:false});assert.equal(applyLayoutPatch(settings,inherited).skillSide,'right','only own patch keys are accepted');
});
void test('normalization and patching neither mutate frozen inputs nor return a reusable mutable preset',()=>{
 const settings=Object.freeze({joystickSide:'right',joystickSize:'large',skillSide:'left',touchLock:true,suppliesFollowSkills:true}),patch=Object.freeze({skillSide:'invalid',suppliesFollowSkills:'yes'}),before=JSON.stringify({settings,patch});
 const result=applyLayoutPatch(settings,patch);assert.deepEqual(result,{joystickSide:'right',joystickSize:'large',skillSide:'right',touchLock:true,suppliesFollowSkills:false});result.joystickSide='left';assert.equal(settings.joystickSide,'right');assert.equal(JSON.stringify({settings,patch}),before);
 assert.deepEqual(applyLayoutPatch(null,null),defaults);assert.deepEqual(applyLayoutPatch(settings,[]),{...settings});
});
void test('normalizeSave supplies the old fallback without rewriting format, key bindings, scores or the input object',()=>{
 const original=initialSave();original.keymap={dash:'ControlLeft'};original.settings={...original.settings,joystickSide:'right',joystickSize:'large',skillSide:'left',touchLock:true};const before=JSON.stringify(original),normalized=normalizeSave(original);
 assert.equal(normalized.version,1);assert.equal(normalized.records.schema,1);assert.equal(normalized.keymap.dash,'ControlLeft');assert.equal(normalized.settings.suppliesFollowSkills,false);assert.equal(normalized.settings.touchLock,true);assert.equal(JSON.stringify(original),before);
 for(const invalid of ['yes',1,null,{}])assert.equal(normalizeSave({...original,settings:{...original.settings,suppliesFollowSkills:invalid}}).settings.suppliesFollowSkills,false);
 assert.equal(normalizeSave({...original,settings:applyLayoutPatch(original.settings,layoutPreset('left'))}).settings.suppliesFollowSkills,true);
});
void test('an atomic preset commit preserves every saved battle rule, lock-history flag, input key and RNG state',()=>{
 for(const focusVersion of [1,2,3]){
  const battle=createRun({seed:'layout-save-parity',runId:'layout-save-parity',focusVersion,settings:{touchLock:focusVersion===3}}),save={...initialSave(),checkpoint:battle.serialize(),keymap:{dash:'ControlLeft'}};
  const disk=memory(save),vault=new SaveVault(disk),loaded=vault.load(),checkpoint=JSON.stringify(loaded.checkpoint),rawBefore=disk.getItem(SAVE_KEY);assert.equal(disk.getItem(SAVE_KEY),rawBefore);assert.equal(disk.writes.length,0,'loading a missing preference never writes a migration');
  const next={...loaded,settings:applyLayoutPatch(loaded.settings,layoutPreset('left'))},saved=vault.commit(next);
  assert.equal(disk.writes.filter(([key])=>key===SAVE_KEY).length,1,'the complete preset reaches the primary record in one write');assert.equal(JSON.stringify(saved.checkpoint),checkpoint);assert.equal(saved.checkpoint.options.focusVersion,focusVersion);assert.equal(saved.keymap.dash,'ControlLeft');assert.equal(saved.version,1);assert.equal(saved.records.schema,1);assert.equal(saved.settings.suppliesFollowSkills,true);assert.equal(saved.settings.joystickSide,'right');assert.equal(saved.settings.skillSide,'left');
 }
});
void test('quota failure preserves all storage slots and retry publishes the full preset without a half layout',()=>{
 const initial=initialSave(),disk=memory(initial);disk.map.set(BACKUP_KEY,JSON.stringify({raw:JSON.stringify(initial),savedAt:1}));const vault=new SaveVault(disk),loaded=vault.load(),before=slots(disk),expected=vault.expectedRaw,next={...loaded,settings:applyLayoutPatch(loaded.settings,layoutPreset('left'))},nextBefore=JSON.stringify(next);
 const write=disk.setItem.bind(disk);let fail=true;disk.setItem=(key,value)=>{if(fail&&key===SAVE_KEY)throw Object.assign(Error('quota'),{name:'QuotaExceededError'});write(key,value);};
 assert.throws(()=>vault.commit(next),e=>e.code==='storage');assert.deepEqual(slots(disk),before);assert.equal(vault.expectedRaw,expected);assert.equal(JSON.stringify(next),nextBefore);
 fail=false;const saved=vault.commit(next);assert.equal(saved.settings.joystickSide,'right');assert.equal(saved.settings.skillSide,'left');assert.equal(saved.settings.suppliesFollowSkills,true);assert.equal(disk.getItem(BACKUP_KEY),before[1]);
});
void test('a second window blocks a stale layout preset and preserves the other window and protected slots',()=>{
 const disk=memory(initialSave()),first=new SaveVault(disk),second=new SaveVault(disk),a=first.load(),b=second.load();
 const next={...a,settings:applyLayoutPatch(a.settings,layoutPreset('left'))};second.commit({...b,settings:{...b.settings,music:.7}});const before=slots(disk),writes=disk.writes.length;
 assert.throws(()=>first.commit(next),e=>e.code==='conflict');assert.deepEqual(slots(disk),before);assert.equal(disk.writes.length,writes);const actual=JSON.parse(disk.getItem(SAVE_KEY));assert.equal(actual.settings.music,.7);assert.equal(actual.settings.suppliesFollowSkills,false);assert.equal(actual.settings.skillSide,'right');
});
