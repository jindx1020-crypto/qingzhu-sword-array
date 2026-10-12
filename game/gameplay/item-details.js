/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {RELICS,relicDescription} from './data.js';
import {STORY_ITEMS} from './journal.js';
import {chapterName} from './chapter-names.js';

const chapter=(index)=>'第'+['一','二','三','四','五','六'][index]+'章「'+chapterName(index)+'」';
const rules=run=>run?(run.options?.rulesVersion??run.rulesVersion??1):3;

// These are acquisition instructions, never evidence that this run owns an item.
function acquisition(id,run){
 if(id==='swords')return '本篇开篇已经炼成整套七十二剑；战斗中逐级增加的是上场剑数。';
 if(id==='lingxi'||id==='icepearl')return '主篇／定种从头历练：进入'+chapter(2)+'时记入剧情行囊。';
 if(id==='weeping')return rules(run)===3?'主篇／定种从头历练：'+chapter(2)+'章末的元瑶相关事件将啼魂记入行囊；下一章进入行囊整备后，可留意协战配置货架。':'本局旧规则：进入'+chapter(3)+'时，按原章节准备记入剧情行囊。';
 if(id==='five-rings'||id==='cape')return rules(run)===3?'主篇／定种从头历练：完成'+chapter(3)+'的宝光阁取宝节点后记入行囊；仅到达本章不代表已经取得。':'本局旧规则：完成第四章并进入'+chapter(4)+'时，按原章节准备记入剧情行囊。';
 if(id==='crystal')return '元瑶相关纪事中的封存材料说明；本篇没有独立取得凭据，也不开放后续飞剑炼制。';
 if(id==='cauldron')return '主篇终章纪事交代取鼎与携宝而归；本篇没有独立取得凭据，也不开放完整炼化或装备入口。';
 return '主篇终章纪事交代冰焰的危险与封存；本篇没有独立取得凭据，后续炼化神通不在本篇开放。';
}

export function storyItemDetails(id,run){
 const item=STORY_ITEMS.find(i=>i.id===id);if(!item)return null;
 const relic=RELICS.find(r=>r.id===id&&r.story),configurable=!!relic;
 const inventoryKnown=!!run&&Array.isArray(run.storyInventory),configurationKnown=!!run&&Array.isArray(run.relics);
 const held=configurable&&inventoryKnown?run.storyInventory.includes(id):null;
 const equipped=configurable&&configurationKnown?run.relics.includes(id):null;
 const inventory=!run?'暂无本局记录':id==='swords'?'基础御剑已炼成；不使用剧情行囊持有字段':!configurable?'无独立持有记录；不据通关或账号历史判断本局取得':!inventoryKnown?'当前记录未记录持有情况，无法判断':held?'已持有':'尚未取得';
 const configuration=!configurable?(id==='swords'?'基础御剑，随等级逐步上场':'本篇不开放装备或协战'):!run?'暂无本局记录':!configurationKnown?'当前记录未记录配置，无法判断':equipped?(id==='weeping'?'协战配置生效':'携行效果生效'):(id==='weeping'?'未启用协战':'未配置');
 const state=equipped===true?configuration:held===true?'已持有 · '+configuration:inventory;
 return {id,name:item.name,configurable,held,equipped,inventory,configuration,state,
  effect:relic?relicDescription(relic):item.desc,
  effectNote:relic?'以上为单件配置的基础加成；本局核心倍率与其他加成另算，请以当前属性为准。':'',
  source:relic?.source||item.desc,canonNote:item.canon===false?(item.canonNote||'游戏化设定'):null,
  acquisition:acquisition(id,run),
  configurationPath:configurable?'本局持有后才进入行囊整备的随机货架候选，不保证下一次出现。遇到对应配置并支付货架标价后，占用携行六格之一；满格需选定替换位置。卸下配置不会删除本局持有记录。':'本篇没有购买或装配入口。',
  boundary:id==='weeping'?'啼魂协战在本篇表现为对阴魂的伤害加成，不会新增一只独立的战场友方实体。':id==='swords'?'基础御剑不占携行格；不把等级增加当作重新炼成或取得飞剑。':configurable?'新开主篇／定种不继承上一局的剧情行囊或携行配置；章回重温沿用其既有章节预置。':'此条仅作纪事说明，不代表当前行囊拥有此物，也不会给新局补发。'};
}

export const storyItemDetailsList=run=>STORY_ITEMS.map(item=>storyItemDetails(item.id,run));
