/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {directFocus} from './targeting.js';
import {starterStatus} from './starters.js';

const core=(b,id)=>!!b.hasCore?.(id),name=e=>e.name||'未命名目标';
const live=e=>e.hp>0;
const canTarget=e=>live(e)&&!e.untargetable;
const remaining=(until,time)=>Math.max(0,until-time);
const sec=n=>n>0?Math.max(.1,Math.ceil(n*10)/10).toFixed(1):'0.0';
const forms=['分组追击','环绕护身','定向穿刺'];
export function summonCounts(b){const puppets=b.puppets?.length||0,insects=b.insects?.length||0;return {puppets,insects,text:'在场：傀儡 '+puppets+' 具 · 噬金虫 '+insects+' 只'};}

// These are existing per-enemy progress records, not a newly predicted sword
// target. Never call nearest/allyTarget, which can modify command caches.
export function swordTargetRows(b){
 if(b.rulesVersion<2||b.path!==0)return [];
 return b.enemies.filter(e=>live(e)&&e.focusHits>0&&e.focusUntil>=b.time).sort((a,z)=>z.focusUntil-a.focusUntil||a.id-z.id).map(e=>({id:e.id,name:name(e),hits:e.focusHits,seconds:remaining(e.focusUntil,b.time),source:'聚锋对象',metrics:'聚锋 '+e.focusHits+'/4 击 · 剩余 '+sec(remaining(e.focusUntil,b.time))+' 秒'}));
}
function gnawRecord(b,e){const active=e.gnawUntil>b.time,percent=active?Math.round((e.gnaw||0)*100):0,seconds=active?remaining(e.gnawUntil,b.time):0;return {layers:Math.round(percent/2),percent,seconds,full:active&&(e.gnaw||0)>=.12};}
function insectCoreMultiplier(b,e){let value=1;if(core(b,'K07')&&(b.stats.insects||0)>=4)value*=.88;if(core(b,'K08'))value*=e.elite||e.boss?1.3:.8;return Number(value.toFixed(3));}
export function insectTargetRows(b){
 const alive=b.enemies.filter(canTarget),pursuits=new Set(b.insectPursuits||[]),double=core(b,'K07')&&(b.stats.insects||0)>=4&&!core(b,'K08');
 const keys=double?['bug0','bug1']:core(b,'K08')&&(!core(b,'K07')||(b.stats.insects||0)>=4)?['bug0']:[];
 const commands=keys.map((key,i)=>{const cache=b.targetCache?.[key],e=cache?.until>b.time?alive.find(e=>e.id===cache.id):null;return e&&Math.hypot(e.x-b.player.x,e.y-b.player.y)<440*(1+(b.stats.metaInsectRange||0))?{id:e.id,label:double?(i===0?'A组指令':'B组指令'):'凝群指令'}:null;}).filter(Boolean);
 const ordered=[...commands.map(c=>alive.find(e=>e.id===c.id)),...alive.filter(e=>pursuits.has(e.id)),...alive.filter(e=>e.gnaw>0&&e.gnawUntil>b.time).sort((a,z)=>z.gnawUntil-a.gnawUntil||a.id-z.id)];
 return [...new Map(ordered.map(e=>[e.id,e])).values()].map(e=>{const gnaw=gnawRecord(b,e),groups=commands.filter(c=>c.id===e.id).map(c=>c.label),pursuing=pursuits.has(e.id),hasGnaw=b.rulesVersion>=2&&b.path===3,multiplier=insectCoreMultiplier(b,e),source=groups.length?groups.join(' / ')+(pursuing?' · 正在追击':' · 等待追击'):pursuing?'正在追击':'易伤残留';return {id:e.id,name:name(e),source,pursuing,groups,hasGnaw,...gnaw,coreMultiplier:multiplier,metrics:(hasGnaw?'噬甲 '+gnaw.layers+'/6 层 · 易伤 '+gnaw.percent+'% · 剩余 '+sec(gnaw.seconds)+' 秒':'虫群追击对象')+(multiplier!==1?' · 核心虫伤 ×'+multiplier:'')};});
}
export function fullGnawRows(b){
 if(b.rulesVersion<2||b.path!==3)return [];
 return b.enemies.filter(e=>live(e)&&gnawRecord(b,e).full).map(e=>({id:e.id,name:name(e),...gnawRecord(b,e),unavailable:!!e.untargetable||e.phaseShield>0||e.bossType==='xuangu'&&b.bossEnding>0}));
}
export function defendAssignment(b,inputDevice){
 if(b.objective?.kind!=='defend')return '';const formation=b.formation||0;
 if(b.input.focus){const action=b.input.touchAim||inputDevice==='touch'?'点“解除”恢复剑式分配':inputDevice==='keyboard'?'解除集火恢复剑式分配':'松开左键恢复剑式分配';return '守阵 · '+(directFocus(b)?'单点集火':'目标指引')+' · '+action;}
 return '守阵 · '+(formation===0?'分守中 · 分组追击':forms[formation]+' · '+(formation===2?'切回分组可分守':'环绕韩立迎敌'));
}
export function combatReadout(b){
 const sword=swordTargetRows(b),insect=insectTargetRows(b),targets=b.path===0?sword:insect,main=targets.slice(0,2);
 const starter=b.rulesVersion<2?'旧局起手 · 原规则':b.path===0?forms[b.formation||0]+' · '+(sword.length?'聚锋按目标累计':'聚锋等待有效剑击'):b.path===3?(insect.some(t=>t.pursuing)?'虫群追击中':'虫群等待接战'):starterStatus(b)?.replace(/^余雷 /,'飞剑增伤窗口 ');
 return {starter,counts:summonCounts(b),sword,insect,main,remaining:Math.max(0,targets.length-main.length),full:fullGnawRows(b)};
}
export function statusSummary(b){const r=combatReadout(b);return [r.starter,...r.main.map(t=>t.name+' · '+t.metrics),r.remaining?'其余 '+r.remaining+' 个目标见战况':''].filter(Boolean).join('；');}
// A gnaw cue contains no target identity. Never attach it to a current pursuit.
// Show current full-stack records separately, and only merge identical visible
// focus confirmations (their count is not a lifetime trigger statistic).
export function visibleCombatCues(b){
 const out=[];
 for(const cue of b.combatCues.filter(c=>c.until>b.time&&c.key!=='gnaw')){const old=cue.key==='focus'?out.find(c=>c.key==='focus'&&c.text===cue.text):null;if(old){old.count++;old.until=Math.max(old.until,cue.until);}else out.push({...cue,count:1});}
 return out.map(c=>({...c,text:c.text+(c.count>1?' · 合并 '+c.count+' 条确认':'')}));
}
