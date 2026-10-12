/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {initChapterStats} from '../gameplay/chapter-telemetry.js';
// These fixtures jump directly to historical scenes; start optional observation at that arranged state.
import test from 'node:test';
import assert from 'node:assert/strict';
import {battleCamera} from '../gameplay/camera.js';
import {bindingError,invalidBindings,DEFAULT_KEYS} from '../gameplay/keybindings.js';
import {Expedition} from '../gameplay/expedition.js';
import {initialSave} from '../gameplay/data.js';
import {SaveVault,SAVE_KEY,normalizeSave} from '../gameplay/save-store.js';
import {parseHelp,findHelpBlocks} from '../gameplay/help-document.js';

function fixture(kind) {
 for(let n=0;n<100;n++){
  const b=new Expedition({path:1,seed:'usability-'+n,difficulty:1});
  for(let c=0;c<6;c++)for(let w=0;w<b.routes[c].length;w++){
   const choice=b.routes[c][w].choices.findIndex(e=>e.kind===kind);
   if(choice<0)continue;
   b.chapter=c;b.wave=w;b.routes[c][w].selected=choice;initChapterStats(b,true);b.beginNode();return b;
  }
 }
 throw Error('Missing encounter '+kind);
}
const normalize = b => normalizeSave({...initialSave(),checkpoint:b.serialize()});

void test('desktop sidebar space stays outside the player sprite at the north-west and other corners',()=>{
 for(const x of [30,1250])for(const y of [55,770]){
  const c=battleCamera(1440,1000,{x,y},{top:136,bottom:194,left:208}),px=c.x+x*c.scale,py=c.y+y*c.scale;
  assert.ok(px-24*c.scale>208);assert.ok(px+24*c.scale<1440);assert.ok(py-60*c.scale>=c.top);assert.ok(py<c.bottom);
 }
});

void test('help navigation retains every block and searches literal text across headings, lists and table cells',()=>{
 const text='# 游戏说明\n\n## 神雷\n消耗 [.*] 与 **雷源**。\n\n### 雷法\n- mana 已满\n- 雷源不足\n\n| 物资 | 作用 |\n|---|---|\n| 药包 | 回复 MANA |\n';
 const {blocks,sections}=parseHelp(text);assert.deepEqual(sections.map(s=>s.text),['神雷','雷法']);assert.equal(blocks.length,5);
 assert.equal(findHelpBlocks(blocks,'mana').length,2);assert.equal(findHelpBlocks(blocks,'[.*]').length,1);assert.deepEqual(findHelpBlocks(blocks,'不存在'),[]);assert.deepEqual(findHelpBlocks(blocks,' '),[]);assert.equal(new Set(blocks.map(b=>b.id)).size,blocks.length);
});

void test('training labels describe indefinite practice while formal nodes keep their actual objective',()=>{
 const training=new Expedition({mode:'training',path:1});training.cinematicSeen=['bamboo'];training.start();training.waveTime=75;
 assert.match(training.objectiveText(),/持续练习.*不结算/);assert.match(training.toastText,/暂停可补满/);assert.equal(training.modeState,'battle');assert.deepEqual(training.receipts,[]);
 const regular=fixture('survival');assert.match(regular.objectiveText(),/65/);
});

void test('all screen sizes keep the character inside the HUD-free vertical area at every corner',()=>{
 for(const [w,h,top,bottom] of [[1440,1000,140,194],[1280,720,130,180],[390,844,200,249],[360,640,190,249],[320,568,190,249],[844,390,95,135],[600,420,70,160],[420,340,66,129],[320,280,66,129]]){
  for(const x of [30,640,1250])for(const y of [55,400,770]){
   const view=battleCamera(w,h,{x,y},{top,bottom}),sx=view.x+x*view.scale,sy=view.y+y*view.scale;
   assert.ok(sx>=0&&sx<=w,JSON.stringify({w,h,sx}));
   assert.ok(sy-Math.min(60*view.scale,(view.bottom-view.top)*.6)>=view.top-1e-6,JSON.stringify({w,h,y,view}));
   assert.ok(sy+7*view.scale<=view.bottom+1e-6,JSON.stringify({w,h,y,view}));
   assert.ok(Math.abs((sx-view.x)/view.scale-x)<1e-6);
   assert.ok(Math.abs((sy-view.y)/view.scale-y)<1e-6);
  }
 }
});

void test('new bindings reject pure modifiers, navigation and unsupported system keys; old bindings remain inspectable',()=>{
 for(const key of ['ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight','Escape','KeyW','ArrowUp','F5','Tab','Unidentified'])assert.ok(bindingError(key),key);
 for(const key of ['Space','KeyF','ShiftLeft','ShiftRight','Enter','Digit3','Numpad1','Comma'])assert.equal(bindingError(key),'',key);
 assert.deepEqual(invalidBindings(DEFAULT_KEYS),[]);
 assert.deepEqual(invalidBindings({...DEFAULT_KEYS,dash:'ControlLeft'}),['dash']);
 const old={...initialSave(),keymap:{...DEFAULT_KEYS,dash:'ControlLeft'}};
 assert.equal(normalizeSave(old).keymap.dash,'ControlLeft');
 assert.equal(old.keymap.dash,'ControlLeft');
});

for(const kind of ['hunt','defend','break','pursuit','escape','treasure','illusion','ice','serpent','ghost','puppet','xuangu','swarm'])void test(kind+': required encounter objects survive battle/pause/choice and corrupted inputs are rejected',()=>{
 const b=fixture(kind);normalize(b);
 for(const mode of ['battle','pause','choice']){
  if(mode==='pause')b.pause();
  if(mode==='choice'){b.modeState='battle';b.queuedChoices=1;b.openChoices();}
  const data=b.serialize();normalizeSave({...initialSave(),checkpoint:data});
  const fields=['serpent','ghost','puppet','xuangu','swarm'].includes(kind)?['boss']:kind==='treasure'?['mechanism','objective']:['objective'];
  for(const field of fields){const bad=structuredClone(data);bad.expedition[field]=null;const before=JSON.stringify(bad);assert.throws(()=>normalizeSave({...initialSave(),checkpoint:bad}),/缺失|不一致/);assert.equal(JSON.stringify(bad),before);}
 }
});

void test('valid cleared intermission, rest choices and pre-battle cinematics do not need combat objects',()=>{
 const b=fixture('treasure');b.completeNode();assert.equal(b.objective,null);normalize(b);
 b.queuedChoices=1;b.choiceReturn='intermission';b.openChoices();normalize(b);
 const intro=new Expedition({path:1,seed:'intro-usability'});normalize(intro);intro.start();assert.equal(intro.scene,'cinematic');normalize(intro);
});

void test('missing objective fields fail before NaN or stalled progression, while legal counters still restore',()=>{
 for(const [kind,field] of [['hunt','spawned'],['defend','invuln'],['break','unlockAt'],['escape','exit'],['illusion','cool'],['ice','r']]){
  const b=fixture(kind);normalize(b);const bad=b.serialize();delete bad.expedition.objective[field];assert.throws(()=>normalizeSave({...initialSave(),checkpoint:bad}),/无效|缺失|不一致/);
 }
});

void test('loading an old structurally corrupt checkpoint exposes profile-only recovery and retains the original raw record',()=>{
 const b=fixture('treasure'),bad={...initialSave(),insight:79,checkpoint:b.serialize()};bad.checkpoint.expedition.mechanism=null;
 const raw=JSON.stringify(bad),map=new Map([[SAVE_KEY,raw]]),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const vault=new SaveVault(storage);assert.throws(()=>vault.load(),/旧存档/);assert.equal(vault.corrupt,true);
 assert.equal(vault.profileOnly().insight,79);assert.equal(vault.profileOnly().checkpoint,null);assert.equal(map.get(SAVE_KEY),raw);
 assert.throws(()=>vault.commit(bad,{backup:true,allowCorrupt:true}));assert.equal(map.get(SAVE_KEY),raw);
 const recovered=vault.commit(vault.profileOnly(),{backup:true,allowCorrupt:true});assert.equal(recovered.insight,79);assert.equal(recovered.checkpoint,null);assert.ok(vault.rawRecords().some(r=>r.raw===raw));
});
