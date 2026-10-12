/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {consumableState} from './combat-feedback.js';
import {thunderCost} from './balance.js';
export const BATTLE_FOOTER_EXAMPLE_LABEL='样例数字，仅预览控件布局';
const noop=()=>{};
// A second barrier in addition to inert: even accidentally supplied production
// callbacks cannot run when a preview is activated programmatically.
export function battleFooterActions(actions={},preview=false){return Object.fromEntries(['onDetails','onFormation','onDash','onThunder','onItem'].map(key=>[key,preview?noop:actions[key]||noop]));}
// Display data only. No constructor, RNG, storage, engine update or action API.
// Every call owns its data, so preview edits cannot leak into another surface.
export function createBattleFooterExample({path=0}={}){
 const b={isLayoutExample:true,rulesVersion:3,options:{rulesVersion:3,balanceVersion:4,growthVersion:5,inputVersion:2},path:Number.isInteger(path)&&path>=0&&path<6?path:0,chapter:0,level:12,xp:17,queuedChoices:0,time:0,thunderTime:-100,lastSigil:-100,stillTime:0,setupUntil:-1,formation:0,scene:null,mode:'story',isExpedition:false,traits:{},stats:{},pathCounts:[0,0,0,0,0,0],kills:0,zones:[],relics:[],puppets:[],insects:[],consumables:[{id:'heal',count:2},{id:'mana',count:1}],player:{hp:75,maxHp:100,shield:10,maxShield:25,mana:60,reserve:125,maxReserve:150,dashCD:0,invuln:0,lastDash:-100,moving:false,buffs:{}}};
 b.pathCounts[b.path]=1;if(b.path===2){b.stats.puppets=2;b.puppets=[{},{}];}if(b.path===3){b.stats.insects=4;b.insects=[{},{},{},{}];}
 b.hasCore=()=>false;b.itemReadiness=index=>consumableState(b,index);b.thunderReadiness=()=>{const cost=thunderCost(b);return {cost,ready:b.player.mana>=99.9&&b.player.reserve>=cost,label:b.player.reserve<cost?'雷源不足':b.player.mana>=99.9?'可以施放':'灵力 '+Math.floor(b.player.mana)+' / 100'};};b.sigilReadiness=()=>({left:0,label:'起点留符已就绪'});
 return b;
}
