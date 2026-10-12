/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Read-only presentation of the current run. Never advances a timer or reward ledger.
import {goalGrowth,goalTimeLimits,growthPerformance} from './growth-rules.js';
import {hasReserveRest,reserveRestBase,thunderCost} from './balance.js';
import {treasureStepSeconds,illusionFirstWait} from './pacing-rules.js';
import {RELICS} from './data.js';
export const DIFFICULTY_GUIDANCE=['首次游玩 · 熟悉走位与目标','熟悉操作后 · 兼顾目标与构筑','挑战历练 · 更看重走位与资源规划'];
const number=value=>Number(value.toFixed(1));
export function growthGuidance(b){
 const l=b.growth?.ledger;if(!l)return null;
 const cap=number(b.node.xp*.25),picked=number(l.bonusCollected),earned=number(growthPerformance(l));
 const state={picked,earned,cap,text:l.settled?'已结算表现 '+earned+' / '+cap:'已拾取表现 '+picked+' / '+cap};
 if(!goalGrowth(b))return {...state,detail:l.settled?'表现独立保留，不抵扣基础保底。':'完成节点补足基础经验；表现按实际拾取另计。'};
 if(l.settled)return {...state,detail:'其中完成目标补足 +'+number(l.goalXP||0)+'；表现不抵扣基础保底。'};
 const limit=goalTimeLimits[b.encounter.kind],remaining=Math.max(0,Math.ceil(limit-b.waveTime));
 const task=b.encounter.kind==='defend'?'完成保护目标': ['survival','swarm'].includes(b.encounter.kind)?'完成存活目标':'完成节点目标';
 return {...state,detail:'表现经验判定期限 '+limit+' 秒 · '+(b.waveTime<=limit?'剩余 '+remaining+' 秒；'+task+'后，表现补足至 '+cap+'。':'表现期限已过，保留击杀表现；完成节点仍补足基础经验。')+' 这是表现奖励窗口，不是通关等待时间或失败倒计时。'};
}
export function routeCompletion(e){
 return {survival:'完成条件：存活 65 秒',defend:'完成条件：阵盘存续 65 秒；阵盘归零即失败',hunt:'完成条件：击败全部 3 名标记目标',break:'完成条件：击破全部 3 座阵眼',pursuit:'完成条件：击败携物目标',escape:'完成条件：击破 2 处锁点，再抵达出口',treasure:'完成条件：依次在三处阵位敛息取宝',illusion:'完成条件：依次辨认三次真实出口'}[e.kind]||'完成条件：'+e.goal;
}
export function routeTactics(e,b){
 if([5,6,7,8].includes(b.options.encounterVersion)&&['treasure','illusion','ice'].includes(e.kind))return e.goal;
 if(e.kind==='treasure')return '依次进入三处敛息阵位，各累计 '+treasureStepSeconds(b)+' 秒；取得古宝的结果固定。';
 if(e.kind==='illusion')return '辨认带有「真」字与双环的出口；首次等待 '+illusionFirstWait(b)+' 秒，后续每次等待 10 秒，共辨真三次。';
 return e.goal;
}
export function objectiveGuidance(b){
 if(b.mode!=='training'&&b.isExpedition&&b.encounter.kind==='ice'&&b.waveTime>=40)return '退路已开 · 前往右侧出口';
 const text=b.objectiveText();return b.objective?.kind==='defend'?text+' · 阵盘归零即失败':text;
}
export const reserveRestText=b=>'合格休整：基础'+reserveRestBase(b)+(b.stats.metaReserveRest?' + 修持'+b.stats.metaReserveRest:'')+'（上限内）';
export function reserveRestGuidance(b){
 if(!b.rest||b.rest.preparation||!hasReserveRest(b))return '';
 const gain=b.rest.reserveGain;if(!Number.isFinite(gain))return '本次旧记录未保存雷源到账明细，不补造数值。';
 const base=reserveRestBase(b),extra=b.stats.metaReserveRest||0,basePaid=Math.min(base,gain),extraPaid=Math.max(0,gain-basePaid);
 const p=b.player,cost=thunderCost(b);
 return '雷源休整 · 基础最多 '+base+(extra?' + 修持最多 '+extra:'；本局无额外休整修持')+'；实际到账 '+number(gain)+'（基础 '+number(basePaid)+(extra?' + 修持 '+number(extraPaid):'')+'）。到账后储量 '+Math.floor(p.reserve)+' / '+p.maxReserve+'，按每次 '+cost+' 计，雷源可支撑 '+Math.floor(p.reserve/cost)+' 次；实际施放仍需灵力与本局规则允许。受储量上限限制，本节点只结算一次。';
}
export function storyItemStates(b){
 return (b.storyInventory||[]).map(id=>RELICS.find(r=>r.id===id)).filter(r=>r?.story).map(r=>({id:r.id,name:r.id==='weeping'?'啼魂':r.name,state:b.relics.includes(r.id)?r.id==='weeping'?'协战配置生效':'携行效果生效':r.id==='weeping'?'已持有 · 未启用协战':'已持有 · 未配置'}));
}
