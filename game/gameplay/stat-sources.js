/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {PATHS,TRAITS,RELICS,COMBOS} from './data.js';
import {cultivationMods} from './cultivation.js';
import {starterExtras,reserveFor,traitMods,levelHpBonus,fireGuardShield,thunderCost} from './balance.js';
export {STARTER_EXTRAS} from './balance.js';
const sum=(out,mods,factor=1)=>{for(const [k,v] of Object.entries(mods||{}))out[k]=(out[k]||0)+v*factor;return out;};
// Shared with recalc: preserve source order and repeated additions for legacy floating-point parity.
const addMods=(out,mods)=>{for(const [k,v] of Object.entries(mods))out[k]=(out[k]||0)+v;};
export function additiveStats(b){
 const s={};addMods(s,PATHS[b.path].perk);if(b.rulesVersion>=2)addMods(s,starterExtras(b));
 addMods(s,cultivationMods(b.options,b.path));
 for(const [id,count] of Object.entries(b.traits)){const t=TRAITS.find(x=>x.id===id);if(t)for(let i=0;i<count;i++)addMods(s,traitMods(b,t));}
 for(const id of b.relics){const r=RELICS.find(x=>x.id===id);if(r)addMods(s,r.mods);}
 return s;
}
export const traitPathCounts=traits=>PATHS.map(p=>Object.keys(traits).filter(id=>id.startsWith(p.id+'-')).length);
export const statCombos=counts=>COMBOS.filter(c=>counts[PATHS.findIndex(p=>p.id===c.a)]>=3&&counts[PATHS.findIndex(p=>p.id===c.b)]>=3);
export function derivedStats(b,base){
 const s={...base};
 if(b.comboSet.has('puppetInsect')){s.puppets=(s.puppets||0)+1;s.insects=(s.insects||0)+1;}
 if(b.comboSet.has('puppetGuard'))s.armor=(s.armor||0)+(s.puppets||0)*3;
 s.armor=(s.armor||0)+Math.floor((s.insects||0)/4)*(s.insectGuard||0);
 s.shield=(s.shield||0)+(s.puppets||0)*(s.puppetShield||0);
 const fireGuard=fireGuardShield(b);if(fireGuard)s.shield=(s.shield||0)+fireGuard;
 return s;
}
export const shieldCoreMultiplier=b=>b.hasCore?.('K11')?.85:b.hasCore?.('K12')?.75:1;
export const maxReserveForStats=(b,s)=>reserveFor(b)+(s.reserve||0);
export const reserveAfterStats=(reserve,old,s,maxReserve)=>Math.max(0,Math.min(maxReserve,reserve+Math.max(0,(s.reserve||0)-(old.reserve||0))));
// No run construction, recalc, RNG, resource grant or live-state writes. Temporary summons
// deliberately stay out: recalc derives shield from the permanent stats.puppets count.
export function traitEffectivePreview(trait,b){
 if(!trait||!b?.player)return null;
 const next={path:b.path,rulesVersion:b.rulesVersion,options:b.options,difficulty:b.difficulty,level:b.level,relics:b.relics,traits:{...b.traits,[trait.id]:(b.traits[trait.id]||0)+1},hasCore:b.hasCore,extraThunderCost:b.extraThunderCost};
 next.comboSet=new Set(statCombos(traitPathCounts(next.traits)).map(c=>c.effect));
 next.stats=derivedStats(next,additiveStats(next));
 const maxReserve=maxReserveForStats(next,next.stats),reserve=reserveAfterStats(b.player.reserve,b.stats,next.stats,maxReserve);
 const beforeCost=thunderCost(b),afterCost=thunderCost(next);
 return {before:{shield:b.player.maxShield,puppets:b.stats.puppets||0,reserve:b.player.reserve,maxReserve:b.player.maxReserve,cost:beforeCost,budget:Math.floor(b.player.reserve/beforeCost)},after:{shield:(next.stats.shield||0)*shieldCoreMultiplier(next),puppets:next.stats.puppets||0,reserve,maxReserve,cost:afterCost,budget:Math.floor(reserve/afterCost)}};
}
export function statSources(b){
 const traits={},equipment={};for(const [id,n] of Object.entries(b.traits)){const t=TRAITS.find(t=>t.id===id);sum(traits,t?traitMods(b,t):undefined,n);}for(const id of b.relics)sum(equipment,RELICS.find(r=>r.id===id)?.mods);
 const oldHp=(b.options.metaRulesVersion<2?b.options.meta||[]:[]).filter(id=>id.endsWith('-meta-2')).length*2;
 const rows=[{name:'基础与起手',mods:{hp:100,reserve:reserveFor(b),...PATHS[b.path].perk}},{name:'起手规则额外值',mods:starterExtras(b)},{name:'出发修持',mods:{...cultivationMods(b.options,b.path),...(oldHp?{hp:oldHp}:{})}},{name:'悟道与章节预置',mods:traits},{name:'装备',mods:equipment}];
 // Attribute nonlinear conversions to their actual conditions, separate from source additions.
 const derived={};if(b.comboSet.has('puppetInsect'))sum(derived,{puppets:1,insects:1});if(b.comboSet.has('puppetGuard'))derived.armor=(b.stats.puppets||0)*3;
 derived.armor=(derived.armor||0)+Math.floor((b.stats.insects||0)/4)*(b.stats.insectGuard||0);derived.shield=(b.stats.puppets||0)*(b.stats.puppetShield||0)+fireGuardShield(b);const levelHp=levelHpBonus(b);if(levelHp)derived.hp=levelHp;rows.push({name:'联动与数量换算',mods:derived});
 const keys=['hp','shield','armor','reserve','shieldRegen','puppets','insects'];return {rows,totals:Object.fromEntries(keys.map(k=>[k,rows.reduce((n,r)=>n+(r.mods[k]||0),0)])),keys};
}
