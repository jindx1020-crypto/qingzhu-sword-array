/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {PATHS,DIFFICULTIES,CONSUMABLES,TRAITS,RELICS} from './data.js';
import {CORES,SUPPLIES} from './expedition-data.js';
import {thunderCost} from './balance.js';
import {RULE_KEYS} from './record-rules.js';
import {activeCultivation} from './cultivation.js';
export const MODE_LABELS={story:'原著主篇',seed:'定种历练',endless:'无尽挑战',replay:'章回重温',training:'试剑台'};
const number=n=>Number(n.toFixed(1));
const lockLabel=value=>typeof value==='boolean'?(value?'曾开启锁敌':'未开启锁敌'):'锁敌历史未记录';
// Current resources only: draft choices, shopping and departure rewards are never projected here.
export function restOverview(b,readiness=b.restReadiness()){
 const r=b.rest,p=b.player,cost=thunderCost(b),tasks=r.ending?[]:[
  {label:'机缘',target:'event',done:readiness.event,state:!r.event?'无需选择':r.eventApplied||r.selectionMode!=='draft'&&r.eventDone?'已生效':readiness.event?'已暂选 · 待提交':readiness.eventReason?'暂选已失效':'待选择'},
  {label:'核心',target:'core',done:readiness.core,state:!r.coreOffers.length?'无需选择':r.coreApplied||r.selectionMode!=='draft'&&r.coreDone?'已生效':readiness.core?'已暂选 · 待提交':'待选择'},
  {label:'路线',target:'route',done:readiness.route,state:readiness.route?'已确定':'待选择'}
 ],missing=tasks.filter(t=>!t.done),bags=(b.consumables||[]).map(s=>(CONSUMABLES.find(c=>c.id===s.id)?.name||'旧物资')+' ×'+s.count+(s.bonusHeal?' · 加赠回元药包 ×'+s.bonusHeal:''));
 const doses=(b.consumables||[]).reduce((n,s)=>n+s.count+(s.bonusHeal||0),0);
 return {tasks,missing,ready:readiness.ready,queued:b.queuedChoices||0,next:missing.length?'先选择'+missing[0].label:b.queuedChoices?'接下来处理 '+b.queuedChoices+' 次悟道':r.ending?'接下来收拢所得':'选择齐全 · 核对后出发',identity:(PATHS[b.path]?.name||'未知起手')+' · '+(DIFFICULTIES[b.options.difficulty??0]?.name||'未知难度'),resources:'灵石 '+b.gold+' · 生命 '+number(p.hp)+' / '+number(p.maxHp)+' · 护盾 '+number(p.shield)+' / '+number(p.maxShield)+' · 雷源 '+number(p.reserve)+' / '+number(p.maxReserve)+'（可支撑 '+Math.floor(p.reserve/cost)+' 次，每次 '+number(cost)+'）',departure:'当前生命 '+number(p.hp)+' / '+number(p.maxHp)+' · 药囊 '+doses+' 份 · 雷源可支撑 '+Math.floor(p.reserve/cost)+' 次',bags:bags.length?bags.join('；'):'无药囊物资',emptyBags:!doses,lowHp:p.hp<p.maxHp*.3};
}
// Historical records never receive defaults from the current account or a new run.
export function resultIdentity(summary,current=null){
 const d=summary.recordDetails,difficulty=summary.difficulty??current?.options?.difficulty,seed=summary.seed??current?.seed;
 const used=typeof d?.touchLockUsed==='boolean'?d.touchLockUsed:current?.options?.touchLockUsed;
 return {mode:Object.prototype.hasOwnProperty.call(MODE_LABELS,summary.mode)?MODE_LABELS[summary.mode]:'旧历练',starter:PATHS[summary.path]?.name||'起手未记录',difficulty:Number.isInteger(difficulty)&&DIFFICULTIES[difficulty]?DIFFICULTIES[difficulty].name:current?.difficulty?.name||'难度未记录',seed:typeof seed==='string'?seed:null,lock:lockLabel(used),completedLock:summary.mode==='endless'&&d?.completedLoops>0?lockLabel(d.lastLoopLockUsed):null};
}
export function resultSaveState(b,feedback,saveStatus){
 if(b.options?.studyVersion===1)return {saved:false,label:'对照体验 · 不写入正式记录',detail:''};
 if(b.mode==='training')return {saved:false,label:'试剑台 · 不写入结算记录',detail:''};
 const saved=feedback.saved===true,storage={error:'最近一次本地写入失败，仍需处理保存提示。',conflict:'检测到另一窗口记录变化，仍需处理冲突。',recovery:'存在待处理的恢复资料。',loading:'本地保存状态仍在读取。'}[saveStatus]||'';
 return {saved,label:saved?(feedback.restored?'此局此前已保存 · 未重复发奖':'本次结算已保存'):'本次结算未保存成功',detail:(saved?'':'当前成绩比较仅为预览；可重试保存或导出待保存记录。')+storage};
}
export function runConfigurationText(b,summary=b.summary()){
 const i=resultIdentity(summary,b),d=summary.recordDetails,options=b.options||{},rules=d?.rules||Object.fromEntries(RULE_KEYS.map(k=>[k,options[k]??'未记录']));
 const traits=Object.entries(b.traits||{}).map(([id,rank])=>({id,name:TRAITS.find(t=>t.id===id)?.name||id,rank})),equipment=(b.relics||[]).map(id=>({id,name:[...RELICS,...CORES].find(r=>r.id===id)?.name||id}));
 return JSON.stringify({说明:'只读构筑记录；复制不会向新局补发资源，也不自动重现操作。种子不单独决定成绩分组。',模式:i.mode,难度:i.difficulty,起手:i.starter,原始种子:i.seed??'未记录',本局锁敌历史:i.lock,...(i.completedLock?{已完成圈成绩锁敌:i.completedLock}:{}),规则:rules,分段:options.segmentVersion??'未记录',挑战:options.challengeVersion??'未记录',已完成圈挑战选择:d?.challengeChoices??'未记录',启用修持:(options.metaRulesVersion??1)>=2?activeCultivation(options,b.path).map(m=>m.id):[...(options.meta||[])],出发补给:SUPPLIES.find(s=>s.id===(b.selectedSupply||options.supply))?.name||'未记录',悟道:traits,携行:equipment,联动:(b.combos||[]).map(c=>c.name)},null,2);
}
// Clipboard fulfillment is the only success signal; denial/unavailability always exposes selectable text.
export async function copyReadonlyText(text,clipboard){try{if(!clipboard?.writeText)return false;await clipboard.writeText(text);return true;}catch{return false;}}
