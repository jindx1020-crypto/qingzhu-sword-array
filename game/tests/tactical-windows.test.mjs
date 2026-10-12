/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';import assert from 'node:assert/strict';
import {Expedition} from '../gameplay/expedition.js';import {Battle} from '../gameplay/engine.js';
import {setupWindow,afterThunderWindowReadout,deflectionWindow,tacticalWindow} from '../gameplay/tactical-windows.js';
function arena(path,options={}){const b=new Expedition({path,seed:'tactical-display',...options});b.beginNode();b.clearField();b.time=100;return b;}
void test('setup reads exact stationary threshold, balance-gated linger, and K06 replacement',()=>{
 const b=arena(2);b.stillTime=.599;assert.equal(setupWindow(b).active,false);assert.equal(setupWindow(b).state,'building');b.stillTime=.6;assert.equal(setupWindow(b).state,'ready');assert.equal(b.puppetHasteBonus(),.25);
 b.stillTime=0;b.player.moving=true;b.setupUntil=100.3;assert.equal(setupWindow(b).state,'linger');assert.equal(setupWindow(b).active,true);b.player.moving=false;b.stillTime=.1;assert.equal(setupWindow(b).state,'linger','stopping again still reads the existing linger until a new 0.6-second setup');b.player.moving=true;b.stillTime=0;b.time=100.3;assert.equal(setupWindow(b).state,'moving-unready');assert.equal(b.puppetHasteBonus(),0);
 b.time=100;b.options.balanceVersion=2;assert.equal(setupWindow(b).active,false,'old balance has no imported 0.3-second linger');
 b.relics=['K06'];assert.equal(setupWindow(b).state,'moving');assert.equal(setupWindow(b).fraction,null);assert.match(setupWindow(b).title,/替代.*35%/);assert.equal(b.puppetHasteBonus(),.35);b.player.moving=false;assert.equal(setupWindow(b).state,'waiting-move');assert.equal(b.puppetHasteBonus(),0);
 assert.equal(setupWindow(new Battle({path:2,rulesVersion:1})),null);
});
void test('after-thunder display follows actual 5/7-second gate and real additive bonus',()=>{
 for(const version of [1,2,3,4]){const b=arena(1,{balanceVersion:version}),duration=version===4?7:5;b.thunderTime=100-duration+.001;const before=b.swordDamage();let w=afterThunderWindowReadout(b);assert.equal(w.active,true);assert.equal(w.duration,duration);assert.match(w.label,/<0.1s/);b.time+=.001001;w=afterThunderWindowReadout(b);assert.equal(w.show,false);assert.ok(b.swordDamage()<before);}
 const cross=arena(0);assert.equal(afterThunderWindowReadout(cross),null);cross.stats.afterThunder=.35;cross.thunderTime=99;assert.match(afterThunderWindowReadout(cross).title,/\+35%/);cross.thunderTime=101;assert.equal(afterThunderWindowReadout(cross).show,false,'future timestamps do not invent a current window');
});
void test('deflection display expires exactly at real window or invulnerability boundary and never causes a counter',()=>{
 const b=arena(5);b.player.lastDash=100;b.player.invuln=.24;b.lastCounter=90;b.player.shield=0;const before=JSON.stringify(b.serialize()),rng=b.rng.state();const w=deflectionWindow(b);assert.equal(w.state,'open');assert.match(w.label,/0.24s/);for(let i=0;i<100;i++)deflectionWindow(b);assert.equal(JSON.stringify(b.serialize()),before);assert.equal(b.rng.state(),rng);assert.equal(b.lastCounter,90);assert.equal(b.player.shield,0);
 b.time=100.24;assert.equal(deflectionWindow(b).show,b.time-b.player.lastDash<.24,'use the same floating-point predicate as the engine');b.time=100.240001;assert.equal(deflectionWindow(b).show,false);b.time=100.1;b.player.invuln=0;assert.equal(deflectionWindow(b).show,false);b.player.invuln=.1;b.hitPlayer(1);assert.equal(b.lastCounter,100.1);assert.equal(deflectionWindow(b).state,'spent');assert.match(deflectionWindow(b).label,/本闪已反击/);assert.equal(deflectionWindow(b).active,false);
});
void test('legacy guard counter interval is not shown as a fresh deflection opportunity',()=>{
 const b=arena(5,{balanceVersion:2});b.player.lastDash=100;b.time=100.1;b.player.invuln=.14;b.lastCounter=99;assert.equal(deflectionWindow(b).state,'counter-cooldown');const last=b.lastCounter;b.hitPlayer(1);assert.equal(b.lastCounter,last);b.lastCounter=96;assert.equal(deflectionWindow(b).state,'open');b.hitPlayer(1);assert.equal(deflectionWindow(b).state,'spent');
 const old=new Battle({path:5,rulesVersion:1});assert.equal(deflectionWindow(old),null);
});
void test('other invulnerability sources and future lastDash do not create a deflection window',()=>{
 const b=arena(5);b.player.invuln=3;b.player.lastDash=90;assert.equal(deflectionWindow(b).show,false);b.player.lastDash=101;assert.equal(deflectionWindow(b).show,false);b.player.lastDash=100;b.stats.iframes=.06;b.time=100.29;assert.equal(deflectionWindow(b).show,true);b.time=100.3;assert.equal(deflectionWindow(b).show,b.time-b.player.lastDash<.24+b.stats.iframes);b.time=100.300001;assert.equal(deflectionWindow(b).show,false);
});
void test('all window reads remain frozen with battle time and never write snapshots/cues/RNG',()=>{
 for(const path of [1,2,5]){const b=arena(path);b.thunderTime=99;b.stillTime=.3;b.player.lastDash=100;b.player.invuln=.24;b.modeState='pause';const before=JSON.stringify(b.serialize()),rng=b.rng.state(),cues=JSON.stringify(b.combatCues),timers=JSON.stringify(b.cueTimers),initial=['setup','afterThunder','deflection'].map(k=>tacticalWindow(b,k));
 for(let i=0;i<100;i++)assert.deepEqual(['setup','afterThunder','deflection'].map(k=>tacticalWindow(b,k)),initial);assert.equal(JSON.stringify(b.serialize()),before);assert.equal(b.rng.state(),rng);assert.equal(JSON.stringify(b.combatCues),cues);assert.equal(JSON.stringify(b.cueTimers),timers);}
});
