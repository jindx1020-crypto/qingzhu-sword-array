/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';import assert from 'node:assert/strict';
import {createBattleFooterExample,battleFooterActions,BATTLE_FOOTER_EXAMPLE_LABEL} from '../gameplay/battle-footer-view.js';
import {cultivationProgress} from '../gameplay/progress-display.js';
void test('preview callbacks remain no-ops even if live gameplay callbacks are accidentally passed',()=>{
 const calls=[],supplied=Object.fromEntries(['onDetails','onFormation','onDash','onThunder','onItem'].map(k=>[k,(...args)=>{calls.push([k,...args]);return k;}]));
 const preview=battleFooterActions(supplied,true);for(const fn of Object.values(preview))assert.equal(fn('items',1),undefined);assert.deepEqual(calls,[]);
 const live=battleFooterActions(supplied,false);assert.equal(live.onDetails('resources'),'onDetails');assert.equal(live.onItem(1),'onItem');live.onDash();live.onThunder();live.onFormation();assert.deepEqual(calls,[['onDetails','resources'],['onItem',1],['onDash'],['onThunder'],['onFormation']]);
});
void test('plain footer examples are isolated display data and feed all footer read-only formulas',()=>{
 assert.match(BATTLE_FOOTER_EXAMPLE_LABEL,/样例数字/);
 for(let path=0;path<6;path++){const b=createBattleFooterExample({path}),before=JSON.stringify(b);assert.equal(b.isLayoutExample,true);assert.equal(b.path,path);assert.equal(b.rng,undefined);assert.equal(b.serialize,undefined);assert.equal(b.update,undefined);assert.equal(b.consume,undefined);assert.equal(b.thunder,undefined);assert.equal(b.start,undefined);assert.equal(b.thunderReadiness().ready,false);assert.equal(b.itemReadiness(0).gain,25);assert.equal(b.itemReadiness(1).gain,40);assert.equal(cultivationProgress(b).nextLevel,16);assert.equal(JSON.stringify(b),before);}
 const a=createBattleFooterExample(),z=createBattleFooterExample();a.player.hp=1;a.consumables[0].count=0;a.pathCounts[0]=3;assert.equal(z.player.hp,75);assert.equal(z.consumables[0].count,2);assert.equal(z.pathCounts[0],1);assert.equal(createBattleFooterExample({path:NaN}).path,0);
});
