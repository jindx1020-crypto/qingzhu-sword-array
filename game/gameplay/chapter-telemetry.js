/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {COMBOS,CONSUMABLES,TRAITS} from './data.js';
import {DAMAGE_SOURCES} from './combat-values.js';
export const CHAPTER_STATS_LIMIT=12;
const comboIds=new Set(COMBOS.map(c=>c.effect)),itemIds=new Set(CONSUMABLES.map(c=>c.id)),traitIds=new Set(TRAITS.map(t=>t.id));
const thunderKeys=['casts','spent','restGained','restClipped','chapterGained','statsGained','capLost'];
const survivalKeys=['minHp','minHpMax','hits','hpLost','shieldLost','revives','consumablesUsed'];
const resourceKeys=['gold','reserve','maxReserve','rerolls','consumables'];
const rowKeys=['index','loop','chapter','partial','closed','battleCompleted','fromTime','elapsed','damageStart','damage','resourcesStart','resourcesEnd','thunder','survival','nodes'];
const finite=n=>Number.isFinite(n)&&n>=0,count=n=>Number.isSafeInteger(n)&&n>=0;
const within=(value,max)=>value<=max+Math.max(1e-7,Math.abs(value)*1e-9,Math.abs(max)*1e-9);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const zeroDamage=()=>Object.fromEntries(DAMAGE_SOURCES.map(key=>[key,0]));
const damageAt=b=>Object.fromEntries(DAMAGE_SOURCES.map(key=>[key,b.damageSources?.[key]??0]));
const resourcesAt=b=>({gold:b.gold,reserve:b.player.reserve,maxReserve:b.player.maxReserve,rerolls:b.rerolls,consumables:(b.consumables||[]).map(slot=>({id:slot.id,count:slot.count,bonusHeal:Number.isSafeInteger(slot.bonusHeal)&&slot.bonusHeal>0?slot.bonusHeal:0}))});
const existingCombos=b=>[...(b.comboSet||[])].filter(id=>comboIds.has(id));
const indexOf=b=>(b.endlessLoop||0)*6+b.chapter;
const currentRow=b=>{const row=b.chapterStats?.rows.at(-1);return row&&row.index===indexOf(b)&&!row.closed?row:null;};
function newRow(b,partial){const resources=resourcesAt(b);return {index:indexOf(b),loop:b.endlessLoop||0,chapter:b.chapter,partial,closed:false,battleCompleted:false,fromTime:b.time,elapsed:0,damageStart:damageAt(b),damage:zeroDamage(),resourcesStart:resources,resourcesEnd:structuredClone(resources),thunder:Object.fromEntries(thunderKeys.map(key=>[key,0])),survival:{minHp:null,minHpMax:null,hits:0,hpLost:0,shieldLost:0,revives:0,consumablesUsed:0},nodes:[]};}
function refreshRow(row,b){row.resourcesEnd=resourcesAt(b);const current=damageAt(b);row.damage=Object.fromEntries(DAMAGE_SOURCES.map(key=>[key,Math.max(0,current[key]-row.damageStart[key])]));}
function ensureNode(row,b,partial=false){let node=row.nodes.find(n=>n.wave===b.wave);if(!node){node={wave:b.wave,elapsed:0,complete:false,partial};row.nodes.push(node);}return node;}
function completedChapterState(b,data=b){
 const last=b.routes?.[b.chapter]?.length-1;
 if(Number.isInteger(last)&&last>=0)return b.wave===last&&(b.receipts||data.expedition?.receipts||[]).includes(b.chapter+':'+b.wave);
 return data.modeState==='chapterEnd'||data.scene==='chapterEnd';
}
export function initChapterStats(b,partial=false){
 b.chapterStats={schema:1,fromTime:b.time,partial,omitted:0,rows:[newRow(b,partial)],firstCombos:[],baselineCombos:existingCombos(b)};
 b.chapterStats.rows[0].battleCompleted=completedChapterState(b);
 if(['battle','pause'].includes(b.modeState)||b.modeState==='choice'&&b.choiceReturn!=='intermission'){ensureNode(b.chapterStats.rows[0],b,partial);if(b.modeState==='battle')recordChapterHp(b);}
 return b.chapterStats;
}
export function restoreChapterStats(b,data){
 if(data.chapterStats===undefined){initChapterStats(b,true);b.chapterStats.rows[0].battleCompleted=completedChapterState(b,data);return b.chapterStats;}
 validateChapterStats(data.chapterStats,data);b.chapterStats=structuredClone(data.chapterStats);return b.chapterStats;
}
export function chapterStatsSnapshot(b){
 if(b?.chapterStats===undefined)return undefined;
 const stats=structuredClone(b.chapterStats),row=stats.rows?.at(-1);
 if(row&&!row.closed&&row.index===indexOf(b)&&b.player&&b.damageSources)refreshRow(row,b);
 return stats;
}
export function beginChapterNode(b){const row=currentRow(b);if(!row)return;ensureNode(row,b,false);recordChapterHp(b);}
export function recordChapterTime(b,delta){const row=currentRow(b),node=row?.nodes.find(n=>n.wave===b.wave);if(!row||!node||node.complete||!finite(delta)||delta===0)return;row.elapsed+=delta;node.elapsed+=delta;}
export function recordChapterHp(b,hp=b.player.hp,maxHp=b.player.maxHp){const row=currentRow(b);if(!row||b.modeState!=='battle'||!finite(hp)||!finite(maxHp)||maxHp<=0)return;const s=row.survival;if(s.minHp===null||hp<s.minHp){s.minHp=hp;s.minHpMax=maxHp;}}
export function recordChapterHit(b,{hp,hpLost,shieldLost,maxHp,revived=false}){const row=currentRow(b);if(!row)return;recordChapterHp(b,hp,maxHp);row.survival.hits++;if(finite(hpLost))row.survival.hpLost+=hpLost;if(finite(shieldLost))row.survival.shieldLost+=shieldLost;if(revived)row.survival.revives++;}
export function recordChapterConsumable(b){const row=currentRow(b);if(row)row.survival.consumablesUsed++;}
export function recordChapterThunder(b,cost){const row=currentRow(b);if(!row||!finite(cost))return;row.thunder.casts++;row.thunder.spent+=cost;}
export function recordChapterReserve(b,kind,gain,clipped=0){
 const row=currentRow(b),key={rest:'restGained',chapter:'chapterGained',stats:'statsGained',cap:'capLost'}[kind];if(!row||!key||!Number.isFinite(gain))return;
 if(gain<0)row.thunder.capLost-=gain;else row.thunder[key]+=gain;
 if(kind==='rest'&&finite(clipped))row.thunder.restClipped+=clipped;
}
export function completeChapterNode(b,last=false){const row=currentRow(b);if(!row)return;const node=row.nodes.find(n=>n.wave===b.wave);if(node)node.complete=true;if(last)row.battleCompleted=true;refreshRow(row,b);}
export function advanceChapterStats(b){
 const stats=b.chapterStats;if(!stats)return;const prior=stats.rows.at(-1);if(prior.index===indexOf(b))return;
 if(!prior.closed){refreshRow(prior,b);prior.closed=true;}stats.rows.push(newRow(b,false));
 if(stats.rows.length>CHAPTER_STATS_LIMIT){stats.rows.shift();stats.omitted++;}
}
export function closeChapterStats(b){const row=currentRow(b);if(row){refreshRow(row,b);row.closed=true;}}
export function recordChapterCombos(b,beforeEffects,traitId){
 const stats=b.chapterStats;if(!stats||!traitIds.has(traitId))return;const known=new Set([...stats.baselineCombos,...stats.firstCombos.map(c=>c.effect),...(beforeEffects||[])]);
 for(const effect of existingCombos(b))if(!known.has(effect)){stats.firstCombos.push({effect,chapter:b.chapter,loop:b.endlessLoop||0,wave:b.wave,level:b.level,time:b.time,traitId});known.add(effect);}
}
export function validateChapterStats(stats,data){
 if(stats===undefined)return;const fail=()=>{throw Error('逐章历练统计无效');},time=data?.time;
 if(!exact(stats,['schema','fromTime','partial','omitted','rows','firstCombos','baselineCombos'])||stats.schema!==1||!finite(time)||!finite(stats.fromTime)||stats.fromTime>time||typeof stats.partial!=='boolean'||!count(stats.omitted)||!Array.isArray(stats.rows)||stats.rows.length<1||stats.rows.length>CHAPTER_STATS_LIMIT||!Array.isArray(stats.firstCombos)||!Array.isArray(stats.baselineCombos)||stats.firstCombos.length+stats.baselineCombos.length>COMBOS.length)fail();
 const known=new Set();for(const effect of stats.baselineCombos){if(!comboIds.has(effect)||known.has(effect))fail();known.add(effect);}
 let comboTime=stats.fromTime;for(const event of stats.firstCombos){if(!exact(event,['effect','chapter','loop','wave','level','time','traitId'])||!comboIds.has(event.effect)||known.has(event.effect)||!traitIds.has(event.traitId)||!count(event.chapter)||event.chapter>5||!count(event.loop)||event.loop>1000||!count(event.wave)||event.wave>3||!count(event.level)||event.level<1||event.level>160||!finite(event.time)||event.time<comboTime||event.time>time)fail();known.add(event.effect);comboTime=event.time;}
 const validDamage=values=>exact(values,DAMAGE_SOURCES)&&DAMAGE_SOURCES.every(key=>finite(values[key]));
 const validResources=r=>exact(r,resourceKeys)&&['gold','reserve','maxReserve','rerolls'].every(key=>finite(r[key]))&&count(r.gold)&&count(r.rerolls)&&Array.isArray(r.consumables)&&r.consumables.length<=2&&r.consumables.every(slot=>exact(slot,['id','count','bonusHeal'])&&itemIds.has(slot.id)&&count(slot.count)&&count(slot.bonusHeal));
 let previousIndex=-1,previousTime=stats.fromTime;for(const [i,row] of stats.rows.entries()){
  if(!exact(row,rowKeys)||!count(row.chapter)||row.chapter>5||!count(row.loop)||row.loop>1000||row.index!==row.loop*6+row.chapter||i>0&&row.index!==previousIndex+1||!['partial','closed','battleCompleted'].every(key=>typeof row[key]==='boolean')||i<stats.rows.length-1&&!row.closed||!finite(row.fromTime)||row.fromTime<previousTime||row.fromTime>time||!finite(row.elapsed)||!within(row.elapsed,time-row.fromTime)||!validDamage(row.damageStart)||!validDamage(row.damage)||!validResources(row.resourcesStart)||!validResources(row.resourcesEnd)||!exact(row.thunder,thunderKeys)||!thunderKeys.every(key=>finite(row.thunder[key]))||!count(row.thunder.casts)||!exact(row.survival,survivalKeys)||!['hits','revives','consumablesUsed'].every(key=>count(row.survival[key]))||!finite(row.survival.hpLost)||!finite(row.survival.shieldLost)||row.survival.revives>row.survival.hits||!Array.isArray(row.nodes)||row.nodes.length>4)fail();
  const s=row.survival;if((s.minHp===null)!==(s.minHpMax===null)||s.minHp!==null&&(!finite(s.minHp)||!finite(s.minHpMax)||s.minHpMax<=0||!within(s.minHp,s.minHpMax)))fail();
  let wave=-1,nodeTime=0;for(const node of row.nodes){if(!exact(node,['wave','elapsed','complete','partial'])||!count(node.wave)||node.wave>3||node.wave<=wave||!finite(node.elapsed)||typeof node.complete!=='boolean'||typeof node.partial!=='boolean')fail();wave=node.wave;nodeTime+=node.elapsed;}
  if(!within(nodeTime,row.elapsed)||!within(row.elapsed,nodeTime))fail();
  if(i<stats.rows.length-1&&!within(row.elapsed,stats.rows[i+1].fromTime-row.fromTime))fail();
  previousIndex=row.index;previousTime=row.fromTime;
 }
 const last=stats.rows.at(-1);if(Number.isInteger(data.chapter)&&last.chapter!==data.chapter||Number.isInteger(data.endlessLoop)&&last.loop!==data.endlessLoop)fail();
 if(data.damageSources)for(const key of DAMAGE_SOURCES){const current=data.damageSources[key]??0;if(!finite(current)||!within(last.damageStart[key]+last.damage[key],current))fail();}
}
export function chapterReview(b){
 if(b?.chapterStats===undefined)return {available:false,reason:'missing',message:'本记录没有逐章资源、伤害与生存统计，不倒推此前明细。'};
 try{validateChapterStats(b.chapterStats,b);const stats=chapterStatsSnapshot(b);validateChapterStats(stats,b);return {available:true,partial:stats.partial,fromTime:stats.fromTime,omitted:stats.omitted,rows:stats.rows,firstCombos:stats.firstCombos,baselineCombos:stats.baselineCombos};}catch{return {available:false,reason:'invalid',message:'本记录的逐章统计无效，不将异常或缺失数值显示为零。'};}
}
