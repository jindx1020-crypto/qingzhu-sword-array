/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {afterThunderWindow,stationaryActive,puppetReady} from './balance.js';
import {challengeBlocks} from './experience-rules.js';
import {COMBOS} from './data.js';
import {shieldCoreMultiplier} from './stat-sources.js';

const number=n=>Number(n.toFixed(1)),seconds=n=>n>0&&n<.1?'不足 0.1 秒':Math.max(0,n).toFixed(1)+' 秒',percent=n=>number(n*100)+'%';
const row=(id,name,active,status,detail)=>({id,name,active,status,detail});
const formation=b=>['分组追击','环绕护身','定向穿刺'][b.formation||0];

// Presentation only: never call targeting/attack methods (some maintain caches), construct a run,
// consume RNG, or infer past triggers. These predicates mirror the live engine's strict boundaries.
export function thunderCondition(b){
 const ready=b.thunderReadiness(),blocked=!!b.isExpedition&&challengeBlocks(b,'thunder');
 return {...ready,ready:ready.ready&&!blocked,blocked,label:blocked?'本圈挑战限制神雷':ready.label};
}
export function conditionRows(b){
 const p=b.player,s=b.stats,rows=[row('formation','当前剑式',true,formation(b),'剑式只影响当前调度；在途飞剑按原有规则继续。')];
 if(s.safeMana){const active=b.time-p.lastHit>6;rows.push(row('safeMana','静养',active,active?'条件已满足':'等待连续超过 6 秒未受击','灵力回复加成 +'+percent(s.safeMana)+(active?'':'；距 6 秒门槛还需 '+seconds(6-b.time+p.lastHit))+(p.mana>=100?'；灵力已满，暂不增加。':'。')));}
 if(s.fullMana)rows.push(row('fullMana','蓄势',p.mana>=100,p.mana>=100?'生效':'未生效 · 须满 100 灵力','飞剑伤害加成 +'+percent(s.fullMana)+'；当前灵力 '+Math.floor(p.mana*10)/10+' / 100。'));
 if(s.lowDamage)rows.push(row('lowDamage','险境',p.hp/p.maxHp<.35,p.hp/p.maxHp<.35?'生效':'未生效 · 须生命低于 35%','飞剑伤害加成 +'+percent(s.lowDamage)+'；当前生命约 '+percent(p.hp/p.maxHp)+'，护盾不计入生命比例。'));
 if(s.healthyDamage)rows.push(row('healthyDamage','满锋',p.hp/p.maxHp>.7,p.hp/p.maxHp>.7?'生效':'未生效 · 须生命高于 70%','飞剑伤害加成 +'+percent(s.healthyDamage)+'。'));
 const bonus=(s.afterThunder||0)+(b.rulesVersion>=2&&b.path===1?.25:0),left=afterThunderWindow(b)-b.time+b.thunderTime;
 if(bonus)rows.push(row('afterThunder','施雷追击',left>0,left>0?'飞剑增伤窗口 · 剩余 '+seconds(left):'等待施放神雷','窗口内飞剑伤害加成 +'+percent(bonus)+'；本局窗口 '+afterThunderWindow(b)+' 秒，与核心的余雷牵引雷击分别计算。'));
 if(s.stationary)rows.push(row('stationary','停驻加伤',stationaryActive(b),stationaryActive(b)?'生效':'未生效 · 当前移动输入','傀儡伤害加成 +'+percent(s.stationary)+'；停驻加伤与连续停稳 0.6 秒的架设加速分别判定。'));
 if(b.comboSet.has('swordGuard')){const left=3-b.time+p.lastDash;rows.push(row('swordGuard','进退有据',left>0,left>0?'生效 · 剩余 '+seconds(left):'等待闪避','联动已成型；闪避后 3 秒飞剑伤害加成 +30%。'));}
 if(b.comboSet.has('thunderPuppet')){const left=6-b.time+b.thunderTime;rows.push(row('thunderPuppet','雷机共振',left>0,left>0?'弩速窗口 · 剩余 '+seconds(left):'等待施放神雷','联动已成型；神雷后 6 秒傀儡攻速加成 +65%。'));}
 const thunderCombos=[['thunderFire','施雷时在韩立周围留下三处符火区，各持续 4 秒。'],['thunderInsect','施雷时按当时在场虫数恢复韩立生命。'],['thunderGuard','施雷时提供无敌保护。']];
 for(const [id,detail] of thunderCombos)if(b.comboSet.has(id)){const state=thunderCondition(b);rows.push(row(id,COMBOS.find(c=>c.effect===id).name,state.ready,'联动已成型 · '+state.label,detail+' 此处只判断下次施放条件，不倒推上次命中或收益。'));}
 return rows;
}

// Same live selection as Expedition.thunder, including stable tie order and phase-shield targets.
// Read it anew for a preview; mainThunderTarget is a previous attempt, not a reliable current aim.
export function thunderTargetPreview(b){
 const aim=b.input.aim||b.player;
 return b.enemies.filter(e=>e.hp>0&&!e.untargetable).sort((a,z)=>Math.hypot(a.x-aim.x,a.y-aim.y)-Math.hypot(z.x-aim.x,z.y-aim.y))[0]||null;
}
export function dashSigilStatus(b){
 const dashLeft=Math.max(0,b.player.dashCD),enabled=b.rulesVersion>=2&&b.path===4;
 const out={dashLeft,dashReady:dashLeft===0,dashLabel:dashLeft>0?'闪避冷却 '+seconds(dashLeft):'闪避已就绪',enabled};
 if(!enabled)return out;
 const ready=b.sigilReadiness(),pending=b.zones.find(z=>z.twin&&!z.pair&&!z.fired),pairs=b.zones.filter(z=>z.twin&&z.pair&&!z.fired);
 const nextLeft=Math.max(dashLeft,ready.left),sigilLabel=ready.left>0?(pending?'次符冷却 ':'留符冷却 ')+seconds(ready.left):dashLeft>0?'留符冷却已好 · 等待闪避':'下次闪避可留符';
 return {...out,sigilLeft:ready.left,nextLeft,sigilReady:nextLeft===0,sigilLabel,pendingLeft:pending?Math.max(0,pending.warn):null,pendingLabel:pending?(pending.warn>0?'首符待配 · 到期剩余 '+seconds(pending.warn):'首符已到期 · 等待结算'):null,pairLeft:pairs.length?Math.max(0,...pairs.map(z=>z.warn)):null,pairLabel:pairs.length?'已配对 · 同燃预警剩余 '+seconds(Math.max(...pairs.map(z=>z.warn))):null};
}
export function coreStatus(b,id){
 if(!b.isExpedition||!b.relics.includes(id))return null;
 const p=b.player;
 switch(id){
  case 'K01':return '去程剑伤代价持续生效；回程斩等待飞剑实际返回并经过目标，每次出击最多再命中一次。当前尚有回程命中资格 '+b.swords.filter(s=>s.returnReady).length+' 把，不代表已经命中。';
  case 'K02':return '当前 '+formation(b)+'：'+(b.formation===1?'环绕范围 +40% 生效':'环绕范围收益未生效')+'；剑伤 −12% 代价仍生效。';
  case 'K03':return (b.coreArcs>0&&b.coreArcUntil>b.time?'余雷牵引雷击可用 '+b.coreArcs+' 次 · 窗口剩余 '+seconds(b.coreArcUntil-b.time):'余雷牵引雷击等待下次神雷')+'；仍须剑击实际扣血且附近有可命中的另一目标，每次神雷额外消耗 3 雷源。';
  case 'K04':{const target=thunderTargetPreview(b),state=thunderCondition(b);return state.label+'；当前预览：'+(target?target.name+'（+30%）'+(target.phaseShield>0?'，正处护势，倍率不保证造成伤害':''):'无可选主目标')+'，其余目标 −20%。'+(b.input.aim?'按当前瞄准点最近目标选择':'未设瞄准点，当前按韩立位置选择')+'；施放时重新选取，清弹范围不变。';}
  case 'K05':return (b.puppets.length>=2&&puppetReady(b)?'追加双弩条件已满足':'等待'+(b.puppets.length<2?'至少两具在场傀儡':'连续停稳 0.6 秒'))+'；当前在场 '+b.puppets.length+' 具，各自按合格普通射击次数触发；单箭伤害 −15% 代价仍生效。';
  case 'K06':return (p.moving?'移动弩速 +35% 生效':'移动弩速未生效 · 等待移动输入')+'；傀儡伤害 −10% 代价仍生效，替代起手驻定加速。';
  case 'K07':return (b.stats.insects>=4?'双群分击与虫伤 −12% 生效':'常驻编制不足 4 只，双群分击与虫伤代价均未生效')+'；常驻编制 '+(b.stats.insects||0)+' 只，在场 '+b.insects.length+' 只；目标缓存最多 1.4 秒后更新。';
  case 'K08':return '目标取舍已启用：精英／首领虫伤 +30%，普通目标 −20%；当前在场 '+b.insects.length+' 只。优先共同追猎精英／首领，缓存最多 1.4 秒后更新，实际命中目标决定倍率。';
  case 'K09':return '新留主符爆伤 ×0.8，爆后产生续焰；当前未爆续焰符 '+b.zones.filter(z=>z.ember&&!z.fired).length+' 枚，续焰区域 '+b.zones.filter(z=>z.fireKind==='ember'&&z.ttl>0).length+' 处。已有符按各自保存的状态继续。';
  case 'K10':{const timing=dashSigilStatus(b);return [timing.pendingLabel||'当前无待配首符',timing.sigilLabel,timing.pairLabel].filter(Boolean).join('；')+'。首符到期倒计时来自当前符的 warn；配对后的短预警另计，不是新的 8 秒。';}
  case 'K11':{const left=Math.max(0,8-b.time+b.lastShieldBreak);return '累计实际吸收 '+number(b.shieldAbsorbed)+' / 10；'+(left>0?'震退冷却 '+seconds(left):'震退冷却已就绪')+'；'+(p.shield>0?'仍须一次受击破盾且累计达到门槛':'当前无盾，须先获得护盾再被击破')+'，且韩立存活、战斗继续才触发。当前护盾上限核心倍率 ×'+shieldCoreMultiplier(b)+'。';}
  case 'K12':return (p.shield>0?'有盾移速 +12% 生效':'无盾，移速收益未生效')+'；'+(p.shield>=5?'下次成功闪避会消耗 5 护盾，令该次冷却 ×0.85':'不足 5 护盾，仍可正常闪避，不享减冷却')+'。当前护盾上限核心倍率 ×'+shieldCoreMultiplier(b)+'。';
  default:return null;
 }
}
