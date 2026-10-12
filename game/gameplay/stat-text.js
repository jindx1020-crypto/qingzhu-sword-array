/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Formatting has no data or battle dependencies, so catalog initialization stays acyclic.
export const STAT_NAMES={damage:'御剑伤害',regen:'生命恢复',thunderDamage:'神雷伤害',manaRegen:'灵力恢复',puppetDamage:'傀儡伤害',puppets:'傀儡数',insectDamage:'虫群伤害',insects:'协战虫数',burn:'符火层数',burnDamage:'符火伤害',armor:'护甲',hp:'生命上限',haste:'攻击速度',speed:'移动速度',puppetHaste:'傀儡攻速',insectSpeed:'虫群速度',metaInsectRange:'虫群索敌范围',slow:'命中减速',dashHaste:'闪避冷却缩减',crit:'暴击率',critPower:'暴击伤害',reserve:'雷源上限',thunderSave:'每次神雷节省雷源',puppetPierce:'弩矢穿透',range:'飞剑索敌范围',insectBreak:'虫群破甲',insectMark:'虫群标记增伤',burnTime:'灼烧时间',burnBonus:'对灼烧目标增伤',shield:'护盾上限',shieldRegen:'护盾恢复',pierce:'飞剑穿透',safeMana:'未受击时回灵',thunderShield:'神雷恢复护盾',puppetGuard:'靠近傀儡时减伤',killHeal:'每十二次击杀恢复生命',ward:'减速阵',wardShield:'阵内回盾',dashGuard:'闪避后减伤',bossDamage:'对首领增伤',evilDamage:'驱邪雷伤',insectBoss:'虫群精英与首领增伤',insectHaste:'虫群攻速',deathFire:'死亡符火',killBlast:'连杀符爆',thorns:'反震',lowDamage:'低血增伤',hazardGuard:'环境减伤',ghostDamage:'阴魂增伤',knock:'飞剑击退',puppetRange:'傀儡索敌范围',armorBreak:'剑击破甲',swordSpeed:'飞剑飞行速度',killHaste:'击杀后攻速',healthyDamage:'高生命时增伤',swordScale:'每十二剑增伤',afterThunder:'神雷后飞剑增伤',mark:'雷印',chain:'跳跃电弧',fullMana:'满灵力时增伤',killMana:'击杀回灵概率',stationary:'停驻时傀儡增伤',puppetSlow:'弩矢减速',puppetKnock:'弩矢击退',puppetShield:'每具傀儡提供护盾',puppetMark:'弩矢对雷印目标增伤',breed:'虫潮孵化',insectGuard:'每四虫提供护甲',magnet:'经验拾取范围',insectMana:'虫击回灵概率',dashFire:'遁步留符',burnThunder:'对灼烧目标雷伤',iframes:'闪避无敌时间',revive:'守心保命'};
const UNITS={regen:' / 秒',shieldRegen:' / 秒',wardShield:' / 秒',burnTime:' 秒',iframes:' 秒'};
const FLAT=new Set(['hp','armor','shield','reserve','thunderSave','puppets','insects','pierce','puppetPierce','burn','killHeal','thunderShield','puppetShield','insectGuard']);
export const EFFECTS={ward:'每 7 秒在脚下生成减速阵',deathFire:'灼烧敌人死亡时留下符火',killBlast:'每 8 次击杀触发符火爆炸',thorns:'受击时反震附近敌人',mark:'暴击附加雷印',chain:'每 3 秒触发跳跃电弧',breed:'每 25 次击杀增加一虫，最多增加六虫',dashFire:'遁步起点留下符火',revive:'每章可抵挡一次致命伤并回复生命'};
export const number=n=>String(Number(n.toFixed(3)));
export function modText(mods={}){return Object.entries(mods||{}).filter(([,v])=>Number.isFinite(v)).map(([key,value])=>{
 if(EFFECTS[key]&&value>0)return EFFECTS[key];const sign=value<0?'−':'+',v=Math.abs(value),name=STAT_NAMES[key]||'未识别效果';return name+' '+sign+(UNITS[key]?number(v)+UNITS[key]:FLAT.has(key)?number(v):number(v*100)+'%');
}).join(' · ');}
export const valueText=(key,v)=>(v<0?'−':'+')+(UNITS[key]?number(Math.abs(v))+UNITS[key]:FLAT.has(key)?number(Math.abs(v)):number(Math.abs(v)*100)+'%');
