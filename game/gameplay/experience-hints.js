/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {TRAITS,COMBOS,PATHS} from './data.js';
import {traitDescription,modText} from './descriptions.js';
import {traitMods} from './balance.js';
// Read-only: uses targets chosen by the real update, never calls the targeting engine.
export function insectOrderHint(b){
 if(!b.insects.length)return '';
 const targets=[...new Set(b.insectPursuits||[])].map(id=>b.enemies.find(e=>e.id===id&&e.hp>0&&!e.untargetable)).filter(Boolean);
 const state=targets.length?'当前追击：'+targets.slice(0,2).map(e=>e.name).join('、')+(targets.length>2?' 等 '+targets.length+' 个目标':''):'当前等待可接战目标';
 const dual=b.hasCore?.('K07'),condense=b.hasCore?.('K08'),policy=dual&&(b.stats.insects||0)<4?'双群巡猎 · 常驻不足 4 只，仍按原寻敌':condense?'凝群穿甲 · 精英优先；目标最多 1.4 秒后重新选择':dual?'双群巡猎 · 两群分攻；目标最多 1.4 秒后重新选择':'虫旁先寻近敌，韩立旁后备；靠近准心目标可接战';
 return state+'。'+policy;
}
export function choiceChain(b,tracking='starter'){
 const t=TRAITS.find(t=>t.id===b.lastChoice?.id),remaining=b.queuedChoices||0;
 const links=COMBOS.map(c=>({...c,paths:[c.a,c.b].map(id=>PATHS.findIndex(p=>p.id===id))})).filter(c=>tracking==='all'||(tracking==='starter'?c.paths.includes(b.path):c.effect===tracking)).map(c=>{const gaps=c.paths.map(p=>Math.max(0,3-(b.pathCounts[p]||0))),prior=c.paths.map((p,i)=>gaps[i]+(t?.path===p&&b.lastChoice.rank===1&&(b.pathCounts[p]||0)<=3?1:0));return c.name+'：'+(gaps.every(n=>n===0)?'已成型 · ':'')+c.paths.map((p,i)=>PATHS[p].name+'还差 '+gaps[i]+' 种'+(prior[i]!==gaps[i]?'（上次 '+prior[i]+'）':'')).join(' / ');});
 // Same balance-gated mods the engine sums in recalc, so balance-4 values (e.g. 雷威 +40%) start from the real prior total.
 const gain=t?Object.entries(traitMods(b,t)).filter(([key])=>['damage','haste','range','puppetDamage','insectDamage','thunderDamage','burnDamage','speed','crit','pierce','puppetPierce','thunderSave'].includes(key)).map(([key,value])=>modText({[key]:(b.stats[key]||0)-value})+' → '+modText({[key]:b.stats[key]||0})).join('；'):'';
 return {gain,remaining,last:t?t.name+' · '+traitDescription(t,b):Object.keys(b.traits||{}).length?'旧存档未记录上次选择':'本局首次悟道',links};
}
export function validateLastChoice(ex,b){const q=ex.lastChoice;if(q===undefined)return;if(!q||!TRAITS.some(t=>t.id===q.id)||!Number.isInteger(q.rank)||q.rank<1||q.rank!==(b.traits[q.id]||0))throw Error('上次悟道记录无效，原记录未被修改');}
