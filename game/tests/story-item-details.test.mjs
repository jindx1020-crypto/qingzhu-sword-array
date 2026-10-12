/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {storyItemDetails,storyItemDetailsList} from '../gameplay/item-details.js';
import {RELICS,relicDescription} from '../gameplay/data.js';
import {STORY_ITEMS} from '../gameplay/journal.js';
import {Expedition} from '../gameplay/expedition.js';
import {Battle} from '../gameplay/engine.js';

const configurable=RELICS.filter(r=>r.story).map(r=>r.id);
const run=(extra={})=>({options:{rulesVersion:3},storyInventory:[],relics:[],...extra});
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}

void test('nine item explanations reuse catalog names and real relic effects',()=>{
 const list=storyItemDetailsList(run());assert.deepEqual(list.map(x=>x.id),STORY_ITEMS.map(x=>x.id));assert.equal(list.length,9);
 for(const item of list){assert.equal(item.name,STORY_ITEMS.find(i=>i.id===item.id).name);if(item.configurable){assert.equal(item.effect,relicDescription(RELICS.find(r=>r.id===item.id)));assert.match(item.effectNote,/基础加成.*核心倍率.*另算/);}}
 assert.equal(storyItemDetails('unrecognized',run()),null);
});
for(const id of configurable)void test(id+' keeps possession and actual configuration independent',()=>{
 const none=storyItemDetails(id,run());assert.equal(none.held,false);assert.equal(none.equipped,false);assert.equal(none.inventory,'尚未取得');
 const held=storyItemDetails(id,run({storyInventory:[id]}));assert.equal(held.held,true);assert.equal(held.equipped,false);assert.match(held.state,/已持有/);assert.match(held.configuration,id==='weeping'?/未启用协战/:/未配置/);
 const active=storyItemDetails(id,run({storyInventory:[id],relics:[id]}));assert.equal(active.held,true);assert.equal(active.equipped,true);assert.equal(active.configuration,id==='weeping'?'协战配置生效':'携行效果生效');
 const missing=storyItemDetails(id,run({storyInventory:undefined,relics:[id]}));assert.equal(missing.held,null);assert.equal(missing.equipped,true);assert.match(missing.inventory,/未记录持有情况/);assert.doesNotMatch(missing.inventory,/已持有/);
 const inconsistent=storyItemDetails(id,run({relics:[id]}));assert.equal(inconsistent.held,false);assert.equal(inconsistent.inventory,'尚未取得');assert.equal(inconsistent.equipped,true);
 const noConfiguration=storyItemDetails(id,run({storyInventory:[id],relics:undefined}));assert.equal(noConfiguration.equipped,null);assert.match(noConfiguration.configuration,/未记录配置/);
});
void test('no run or missing fields never infer from wins, current chapter, receipts or won',()=>{
 for(const b of [null,undefined,{}, {wins:1,unlocked:5,won:true,chapter:5,receipts:['3:0']},run({chapter:5,won:true,accountCleared:true})]){
  for(const id of configurable){const item=storyItemDetails(id,b);assert.notEqual(item.held,true);assert.notEqual(item.equipped,true);assert.doesNotMatch(item.inventory,/已持有/);}
 }
});
void test('sealed narrative items never become inventory or usable equipment, even with fabricated arrays',()=>{
 for(const id of ['crystal','cauldron','iceflame']){const d=storyItemDetails(id,run({won:true,chapter:5,storyInventory:[id],relics:[id]}));assert.equal(d.configurable,false);assert.equal(d.held,null);assert.equal(d.equipped,null);assert.match(d.inventory,/无独立持有记录/);assert.match(d.configuration,/不开放装备或协战/);assert.match(d.configurationPath,/没有购买或装配入口/);assert.doesNotMatch(d.state,/已持有|生效/);}
 assert.match(storyItemDetails('crystal',run()).canonNote,/游戏化设定/);assert.match(storyItemDetails('lingxi',run()).canonNote,/游戏化设定/);assert.equal(storyItemDetails('cauldron',run()).canonNote,null);
});
void test('acquisition paths distinguish current treasure node from frozen old chapter preparation',()=>{
 for(const id of ['five-rings','cape']){assert.match(storyItemDetails(id,run()).acquisition,/完成第四章.*取宝节点后/);assert.match(storyItemDetails(id,null).acquisition,/取宝节点后/);for(const b of [{},{rulesVersion:1},{options:{rulesVersion:2}},{options:{rulesVersion:1},rulesVersion:3}]){const text=storyItemDetails(id,b).acquisition;assert.match(text,/本局旧规则.*进入第五章/);assert.doesNotMatch(text,/取宝节点后/);}}
 assert.match(storyItemDetails('weeping',run()).acquisition,/第三章.*元瑶/);assert.match(storyItemDetails('weeping',{options:{rulesVersion:2}}).acquisition,/进入第四章/);
 for(const id of ['lingxi','icepearl'])assert.match(storyItemDetails(id,run()).acquisition,/进入第三章/);
});
void test('configuration instructions describe paid random offers, shared slots and unchanged possession',()=>{
 for(const id of configurable){const d=storyItemDetails(id,run());assert.match(d.configurationPath,/随机货架候选，不保证下一次出现/);assert.match(d.configurationPath,/支付货架标价/);assert.match(d.configurationPath,/携行六格之一/);assert.match(d.configurationPath,/卸下配置不会删除本局持有/);}
 assert.match(storyItemDetails('weeping',run()).boundary,/不会新增.*独立.*友方实体/);assert.match(storyItemDetails('swords',run()).boundary,/不占携行格/);
});
void test('pure explanations cannot call game actions and preserve deeply frozen snapshot fields',()=>{
 const b=run({storyInventory:['lingxi','weeping'],relics:['weeping','K11'],chapter:5,rng:123,expedition:{receipts:['3:0'],rest:{coreSelection:{id:'K12'}}}});
 for(const name of ['recalc','buy','grantStoryItems','serialize','makeShop','rng'])b[name]=()=>{throw Error('display called '+name);};
 const withMethods=JSON.stringify(b);freeze(b);for(let i=0;i<3;i++)storyItemDetailsList(b);assert.equal(JSON.stringify(b),withMethods);
});
void test('real current and legacy battles keep serialized snapshots and both RNG streams unchanged',()=>{
 for(const b of [new Expedition({seed:'item-detail-current',runId:'item-detail-current',chapter:3}),new Battle({seed:'item-detail-old',chapter:4,rulesVersion:2})]){
  const before=JSON.stringify(b.serialize()),rng=b.rng.state(),content=b.contentRng?.state();storyItemDetailsList(b);assert.equal(JSON.stringify(b.serialize()),before);assert.equal(b.rng.state(),rng);assert.equal(b.contentRng?.state(),content);
 }
});
