/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {emptySigilStats,validateSigilStats} from './sigil-metrics.js';
import {restoreDefenseStats,validateDefenseStats} from './defense-telemetry.js';
import {validateChapterStats} from './chapter-telemetry.js';
import {CONSUMABLES} from './data.js';
import {FIXED_NODE_SECONDS} from './pacing-rules.js';
export const FIRE_KINDS=['burn','sigil','echo','ember','line','other','history'];
export const FIRE_LABELS={burn:'附焰灼烧',sigil:'主符爆发',echo:'复燃回响',ember:'续焰地火',line:'合符连线',other:'其他符火',history:'旧记录·未分类符火'};
export const emptyFire=()=>Object.fromEntries(FIRE_KINDS.map(k=>[k,0]));
export const shieldReward=(player,amount,extraCap)=>Math.max(0,Math.min(player.maxShield+extraCap,player.shield+amount)-player.shield);
const shown=n=>Number(n.toFixed(1));
export function summonState(b,item){
 if(!['puppet','insect'].includes(item?.effect))return null;const puppet=item.effect==='puppet',cap=puppet?12:30,bonus=puppet?1:4,unit=puppet?'具':'只',base=puppet?(b.stats.puppets||0):(b.stats.insects||0)+(b.stats.breed?Math.min(6,Math.floor(b.kills/25)):0),active=b.player.buffs[item.effect]>b.time,current=Math.min(cap,base+(active?bonus:0)),total=Math.min(cap,base+bonus),gain=total-current;
 const text=base>=cap?'数量已达 '+cap+' '+unit+'上限；仅刷新 '+item.value+' 秒计时':active?'剩余时间刷新为 '+item.value+' 秒 · 数量不变（'+total+' '+unit+'）':'临时增加 '+gain+' '+unit+' · 持续 '+item.value+' 秒';return {active,cap,total,gain,text,label:base>=cap?'数量上限':active?'仅续时':''};
}
export function consumableState(b,index){
 const slot=b.consumables[index],p=b.player,original=CONSUMABLES.find(c=>c.id===slot?.id);
 const bonus=!!slot?.bonusHeal&&(p.hp<p.maxHp||!slot.count);
 const item=bonus?{id:'bonusHeal',name:'回元药包·加赠',effect:'heal',value:.35,desc:'恢复 35% 最大生命；满血保留加赠药包，可先用原物资。'}:original;
 const count=bonus?slot.bonusHeal:slot?.count||0,summon=summonState(b,item);
 const gain=item?.effect==='heal'?Math.min(p.maxHp-p.hp,p.maxHp*item.value):item?.effect==='mana'?Math.min(100-p.mana,item.value):null;
 const blocked=count>0&&gain===0,reason=blocked?(item.effect==='heal'?'生命已满 · 未消耗':'灵力已满 · 未消耗'):count===0?'物资已用尽':'';
 return {item,count,bonus,blocked,gain,reason,summon,label:reason||summon?.text||(gain!==null?'可恢复 '+shown(gain)+(item.effect==='heal'?' 生命':' 灵力'):'可使用'),pendingBonus:!bonus&&!!slot?.bonusHeal};
}
export function restoreFeedback(b,data){
 b.defenseStats=restoreDefenseStats(data.defenseStats,data.time);
 b.fireBreakdown=data.fireBreakdown?structuredClone(data.fireBreakdown):{...emptyFire(),history:data.damageSources?.fire||0};
 b.sigilStats=data.sigilStats?structuredClone(data.sigilStats):emptySigilStats(data.time);b.recentHits=structuredClone(data.recentHits||[]);b.combatCues=[];b.cueTimers={};b.numberTimers={};
}
export function recordHit(b,{name='未知来袭',x,y,kind='近身',target='韩立',shield=0,hp=0,remaining=0,outcome='hurt',recovered=0}){
 const p=target==='阵盘'?b.objective:b.player;
 const angle=Number.isFinite(x)&&Number.isFinite(y)?Math.atan2(y-p.y,x-p.x):null;
 const hit={time:b.time,name,kind,target,shield,hp,remaining,angle,outcome,recovered};
 b.recentHits.push(hit);if(b.recentHits.length>5)b.recentHits.shift();
 if(target==='韩立'&&angle!==null)b.fx.push({kind:'incoming',x:p.x,y:p.y,angle,ttl:.75,max:.75,color:'#ffb39c'});
}
export function cue(b,key,text,color='#e5d4a3',duration=2.2){
 if(b.time<(b.cueTimers[key]??-1))return;b.cueTimers[key]=b.time+1.5;
 b.combatCues=b.combatCues.filter(c=>c.until>b.time).slice(-1);b.combatCues.push({key,text,color,until:b.time+duration});
}
export function damageRows(b){return [...Object.entries(b.damageSources).filter(([k])=>k!=='fire').map(([k,value])=>({key:k,label:{sword:'飞剑',thunder:'雷法',puppet:'傀儡',insect:'虫群',guard:'反击／震退',return:'回程斩',arc:'余雷牵引雷击'}[k],value})),...FIRE_KINDS.filter(k=>b.fireBreakdown?.[k]>0||k==='sigil'&&b.path===4).map(k=>({key:'fire-'+k,label:FIRE_LABELS[k],value:b.fireBreakdown?.[k]||0}))];}
export function damageSourceNote(b,key,value){
 const core={return:'K01',arc:'K03'}[key];
 if(core&&value>0&&b.isExpedition)return b.relics.includes(core)?'当前携带对应核心；数值仍为历练累计。':'曾用核心产生的累计伤害；当前未携带。';
 if(key==='arc')return '余雷牵引产生的独立雷击；飞剑增伤窗口计入飞剑伤害。';
 if(key==='guard')return '反击与盾破震退等同类伤害合计；未记录细项占比。';
 if(key==='fire-other')return '此类别可含反震等爆发；记录只有合计，不能按当前配置反推细项。';
 if(key==='fire-history')return '旧记录只有符火总量；不补造历史来源分类。';
 return '';
}
// Read the final live state only. This review adds no receipts, save fields or reconstructed history.
export function unfinishedObjective(b){
 if(!b.isExpedition||b.mode==='training'||b.receipts?.includes(b.node?.id))return null;
 const k=b.encounter?.kind,q=b.objective,m=b.mechanism,t=b.waveTime,seconds=FIXED_NODE_SECONDS[k];
 const elapsed=n=>Math.floor(Math.max(0,n)*10)/10,remaining=n=>Math.ceil(Math.max(0,n)*10)/10;
 if(seconds&&Number.isFinite(t)){
  const progress=elapsed(Math.min(seconds,t))+' / '+seconds+' 秒';
  if(k==='ice')return '冰焰退避 '+progress+' · '+(t>=seconds?'退路已开放，撤离尚未完成':'距退路开放还差 '+remaining(seconds-t)+' 秒');
  return (k==='defend'?'守护阵盘':k==='swarm'?'抵御虫潮':'坚持生存')+' '+progress+' · 还差 '+remaining(seconds-t)+' 秒'+(k==='defend'&&Number.isFinite(q?.hp)?' · 阵盘剩余 '+shown(q.hp)+' / '+shown(q.maxHp):'');
 }
 if(['hunt','break','escape','illusion'].includes(k)&&Number.isFinite(q?.done)){
  const total=k==='illusion'||k==='hunt'?3:q.total;if(!Number.isFinite(total))return null;
  return ({hunt:'围猎目标',break:'破除阵眼',escape:'解封阵眼',illusion:'神识辨真'}[k])+' '+q.done+' / '+total+(k==='escape'?' · '+(q.done>=total?'出口已解封，撤离尚未完成':'解封后仍须抵达出口'):' · 还差 '+Math.max(0,total-q.done)+' 处');
 }
 if(k==='treasure'&&Number.isFinite(m?.progress)&&Number.isFinite(m?.goal))return '敛息取宝 '+elapsed(m.progress)+' / '+m.goal+' 秒 · 阵位 '+Math.min(3,m.step+1)+' / 3 · 还差 '+remaining(m.goal-m.progress)+' 秒敛息';
 if(k==='xuangu'&&b.bossEnding>0)return '圣火危机 · 仍需坚持 '+remaining(b.bossEnding)+' 秒后脱身';
 const enemy=k==='pursuit'?b.enemies?.find(e=>e.id===q?.target):b.boss;
 if(enemy&&Number.isFinite(enemy.hp)&&Number.isFinite(enemy.maxHp))return (k==='pursuit'?'携物目标':enemy.name||'首领')+'剩余生命 '+shown(enemy.hp)+' / '+shown(enemy.maxHp);
 return null;
}
export function defeatReview(b){
 if(!b.finished||b.won||b.mode==='training'||b.failureReason==='前两章对照体验完成')return null;
 const hits=(b.recentHits||[]).slice(-5),fatal=[...hits].reverse().find(h=>h.outcome==='defeated'&&Math.abs(h.time-b.time)<1e-6)||null;
 const target=fatal?.target||(b.failureReason==='阵盘失守'?'阵盘':'韩立'),relevant=hits.filter(h=>h.target===target),byKind=new Map();
 for(const h of relevant)byKind.set(h.kind,(byKind.get(h.kind)||0)+h.shield+h.hp);
 const sorted=[...byKind].sort((a,z)=>z[1]-a[1]),max=sorted[0]?.[1];
 return {objective:unfinishedObjective(b),fatal,target,count:relevant.length,dominant:sorted.filter(([,loss])=>loss===max).map(([kind])=>kind),loss:max||0};
}
export function validateFeedback(d){
 validateChapterStats(d.chapterStats,d);
 validateDefenseStats(d.defenseStats,d);
 validateSigilStats(d.sigilStats,d);
 const fail=()=>{throw Error('战斗反馈记录无效');},num=(v,max=1e200)=>Number.isFinite(v)&&v>=0&&v<=max;
 if(d.fireBreakdown!==undefined){const f=d.fireBreakdown;if(!f||typeof f!=='object'||Array.isArray(f)||Object.keys(f).length!==FIRE_KINDS.length||!FIRE_KINDS.every(k=>num(f[k])))fail();const total=Object.values(f).reduce((a,b)=>a+b,0),aggregate=d.damageSources?.fire||0;if(Math.abs(total-aggregate)>Math.max(1e-5,aggregate*1e-9))fail();}
 if(d.recentHits!==undefined){if(!Array.isArray(d.recentHits)||d.recentHits.length>5)fail();let last=-1;for(const h of d.recentHits){if(!h||!num(h.time,d.time+1e-6)||h.time<last||!['韩立','阵盘'].includes(h.target)||typeof h.name!=='string'||!h.name.length||h.name.length>200||!['近身','弹幕','险地'].includes(h.kind)||!num(h.shield)||!num(h.hp)||!num(h.remaining)||(h.angle!==null&&(!Number.isFinite(h.angle)||Math.abs(h.angle)>Math.PI)))fail();if(h.outcome!==undefined){if(!['hurt','revived','defeated'].includes(h.outcome)||!num(h.recovered)||h.outcome==='revived'&&(h.target!=='韩立'||h.recovered<=0||h.remaining!==h.recovered)||h.outcome==='defeated'&&h.remaining!==0||h.outcome==='hurt'&&h.remaining<=0||h.outcome!=='revived'&&h.recovered!==0)fail();}last=h.time;}}
}
export function validateOrigin(origin){if(origin===undefined)return;if(!origin||typeof origin.name!=='string'||origin.name.length>200||!origin.name.length||!Number.isFinite(origin.x)||!Number.isFinite(origin.y)||Math.abs(origin.x)>1e5||Math.abs(origin.y)>1e5)throw Error('来袭来源记录无效');}
