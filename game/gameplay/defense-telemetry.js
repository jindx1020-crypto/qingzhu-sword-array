/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Fixed, optional observations of actual combat events. Never a source of gameplay state.
const counts=['dashes','deflections','counters','breaks','setupShots','stationaryShots','mobileShots','puppetShots','extraShots'];
const amounts=['elapsed','counterShield','counterDamage','shieldAbsorbed','breakDamage','regenShield','puppetSeconds','setupPossible','setupActive','stationaryPossible','stationaryActive','mobilePossible','mobileActive'];
const fields=['schema','fromTime','complete',...counts,...amounts,'lastDeflectionDash'];
const damageScopes=new WeakMap();
const finite=n=>Number.isFinite(n)&&n>=0;
const tolerance=(...values)=>Math.max(1e-7,...values.map(n=>Math.abs(n)*1e-9));
const within=(value,max)=>value<=max+tolerance(value,max);

export function emptyDefenseStats(fromTime=0,complete=true){
 return {schema:1,fromTime,complete,elapsed:0,dashes:0,deflections:0,counters:0,counterShield:0,counterDamage:0,shieldAbsorbed:0,breaks:0,breakDamage:0,regenShield:0,lastDeflectionDash:null,puppetSeconds:0,setupPossible:0,setupActive:0,setupShots:0,stationaryPossible:0,stationaryActive:0,stationaryShots:0,mobilePossible:0,mobileActive:0,mobileShots:0,puppetShots:0,extraShots:0};
}
export function validateDefenseStats(stats,snapshot){
 if(stats===undefined)return;
 const fail=()=>{throw Error('防守与驻定统计无效');},time=snapshot?.time;
 if(!stats||typeof stats!=='object'||Array.isArray(stats)||Object.keys(stats).length!==fields.length||fields.some(key=>!Object.hasOwn(stats,key))||stats.schema!==1||typeof stats.complete!=='boolean'||!finite(time)||!finite(stats.fromTime)||stats.fromTime>time)fail();
 if(counts.some(key=>!Number.isSafeInteger(stats[key])||stats[key]<0)||amounts.some(key=>!finite(stats[key])))fail();
 if(!within(stats.elapsed,time-stats.fromTime)||!within(stats.puppetSeconds,stats.elapsed))fail();
 for(const group of ['setup','stationary','mobile'])if(!within(stats[group+'Possible'],stats.puppetSeconds)||!within(stats[group+'Active'],stats[group+'Possible'])||stats[group+'Shots']>stats.puppetShots)fail();
 if(stats.extraShots>stats.puppetShots)fail();
 // This is the existing player timer's deduplication marker, not an observed event timestamp.
 // Frozen old snapshots allow negative or future lastDash values within the original timer range.
 if(stats.lastDeflectionDash!==null&&(!Number.isFinite(stats.lastDeflectionDash)||Math.abs(stats.lastDeflectionDash)>1e8))fail();
 if(stats.counters>0&&stats.deflections===0||(stats.deflections===0)!==(stats.lastDeflectionDash===null)||stats.counters===0&&(stats.counterShield>0||stats.counterDamage>0)||stats.breaks===0&&stats.breakDamage>0||!within(stats.counterShield,stats.counters*6))fail();
 if(snapshot.damageSources&&Object.hasOwn(snapshot.damageSources,'guard')){const guard=snapshot.damageSources.guard;if(!finite(guard)||!within(stats.counterDamage+stats.breakDamage,guard))fail();}
}
export function restoreDefenseStats(dataDefense,time){
 if(dataDefense===undefined)return emptyDefenseStats(time,false);
 validateDefenseStats(dataDefense,{time});return structuredClone(dataDefense);
}
const add=(stats,key,value)=>{if(finite(value)&&value>0)stats[key]+=value;};
const addCount=(stats,key,value=1)=>{if(Number.isSafeInteger(value)&&value>0)stats[key]+=value;};
export function recordDash(b){const s=b.defenseStats;if(s)addCount(s,'dashes');}
export function recordDeflection(b){
 const s=b.defenseStats,dash=b.player?.lastDash;if(!s||!Number.isFinite(dash)||Math.abs(dash)>1e8||s.lastDeflectionDash===dash)return;
 s.lastDeflectionDash=dash;addCount(s,'deflections');
}
export function recordCounter(b,gain){const s=b.defenseStats;if(s){addCount(s,'counters');add(s,'counterShield',gain);}}
export function recordShieldAbsorption(b,absorbed){const s=b.defenseStats;if(s)add(s,'shieldAbsorbed',absorbed);}
export function recordShieldRegen(b,gain){const s=b.defenseStats;if(s)add(s,'regenShield',gain);}
export function recordShieldBreak(b){const s=b.defenseStats;if(s)addCount(s,'breaks');}
export function withDefenseDamage(b,kind,fn){
 const previous=damageScopes.get(b);damageScopes.set(b,kind);
 try{return fn();}finally{if(previous===undefined)damageScopes.delete(b);else damageScopes.set(b,previous);}
}
export function observeDefenseDamage(b,source,effective,hpBefore){
 const s=b.defenseStats,kind=damageScopes.get(b);if(!s||source!=='guard'||!['counter','break'].includes(kind)||!finite(effective)||!finite(hpBefore))return;
 add(s,kind==='counter'?'counterDamage':'breakDamage',Math.min(effective,hpBefore));
}
export function recordDefenseTime(b,dt){const s=b.defenseStats;if(s)add(s,'elapsed',dt);}
export function recordPuppetTime(b,dt,conditions){
 const s=b.defenseStats;if(!s||!finite(dt)||dt===0)return;
 add(s,'puppetSeconds',dt);
 for(const group of ['setup','stationary','mobile'])if(conditions?.[group+'Eligible']===true){add(s,group+'Possible',dt);if(conditions[group+'Active']===true)add(s,group+'Active',dt);}
}
export function recordPuppetShot(b,count,conditions,{extra=false}={}){
 const s=b.defenseStats;if(!s||!Number.isSafeInteger(count)||count<=0)return;
 addCount(s,'puppetShots',count);if(extra)addCount(s,'extraShots',count);
 for(const group of ['setup','stationary','mobile'])if(conditions?.[group+'Eligible']===true&&conditions[group+'Active']===true)addCount(s,group+'Shots',count);
}
export function defenseReview(b){
 if(b?.defenseStats===undefined)return {available:false,scope:'unknown',reason:'missing',message:'本记录没有防守与驻定统计，不推算此前收益。'};
 try{validateDefenseStats(b.defenseStats,b);}catch{return {available:false,scope:'unknown',reason:'invalid',message:'本记录的防守与驻定统计无效；不将异常或缺失数值显示为零。'};}
 const stats=structuredClone(b.defenseStats),ratio=group=>stats[group+'Possible']>0?Math.min(1,stats[group+'Active']/stats[group+'Possible']):null;
 return {available:true,scope:stats.complete?'complete':'partial',complete:stats.complete,fromTime:stats.fromTime,stats,setupRate:ratio('setup'),stationaryRate:ratio('stationary'),mobileRate:ratio('mobile')};
}
