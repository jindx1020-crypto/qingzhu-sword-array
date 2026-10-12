/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {PATHS,TRAITS,RELICS} from './data.js';
import {additiveStats,derivedStats,traitPathCounts,statCombos} from './stat-sources.js';
import {cultivationMods} from './cultivation.js';
import {starterExtrasFor,swordPuppetInherit,phase4Options,BALANCE4} from './balance.js';
const percent=n=>'+'+Number((n*100).toFixed(3))+'%';
// Live combat uses the exact stat read by updateAllies. Codex reads the saved
// additive sources without restoring an engine or advancing any run state.
export function swordPuppetBonus(b){
 if(b.stats)return swordPuppetInherit(b,b.stats.damage||0);
 const path=b.options.path??0,mods=t=>phase4Options(b.options)&&BALANCE4.traitMods[t.id]||t.mods;
 const additive=(PATHS[path].perk.damage||0)+(starterExtrasFor(b.options,path).damage||0)+(cultivationMods(b.options,path).damage||0)
  +Object.entries(b.traits||{}).reduce((n,[id,count])=>{const t=TRAITS.find(t=>t.id===id);return n+(t?mods(t).damage||0:0)*count;},0)
  +(b.relics||[]).reduce((n,id)=>n+(RELICS.find(r=>r.id===id)?.mods.damage||0),0);
 return phase4Options(b.options)?Math.max(additive,BALANCE4.swordPuppetFloor):additive;
}
const count=(b,path)=>Object.keys(b.traits||{}).filter(id=>id.startsWith(path+'-')).length;
export function comboDescription(combo,b){
 if(!b)return combo.desc;
 if(combo.effect==='fireGuard')return phase4Options(b.options)?combo.desc+'；另固定提高护盾上限 '+BALANCE4.fireGuardShield+'（无需减速阵或生命恢复前提）':combo.desc;
 if(combo.effect!=='swordPuppet')return combo.desc;
 const active=count(b,'sword')>=3&&count(b,'puppet')>=3,floor=phase4Options(b.options)?'，平衡 4 最低按 '+percent(BALANCE4.swordPuppetFloor)+' 计':'';
 return '傀儡额外继承基础飞剑伤害加成（'+(active?'当前 '+percent(swordPuppetBonus(b)):'本局未成型；按当前配置成型后 '+percent(swordPuppetBonus(b)))+floor+'；不含群锋及条件增伤）。';
}
export function newlyFormedCombos(trait,b){
 if(!trait||!b?.traits||b.traits[trait.id])return [];
 const before=new Set(statCombos(traitPathCounts(b.traits)).map(c=>c.effect));
 const next={path:b.path,rulesVersion:b.rulesVersion,options:b.options,level:b.level,relics:b.relics,traits:{...b.traits,[trait.id]:1}};
 const combos=statCombos(traitPathCounts(next.traits)),fresh=combos.filter(c=>!before.has(c.effect));if(!fresh.length)return [];
 next.comboSet=new Set(combos.map(c=>c.effect));next.stats=derivedStats(next,additiveStats(next));
 return fresh.map(combo=>{
  let description=comboDescription(combo,next);
  if(combo.effect==='swordPuppet')description='每箭因本联动额外 '+percent(swordPuppetBonus(next))+'；仅继承基础飞剑伤害加成，不含群锋及条件增伤'+(phase4Options(b.options)?'，平衡 4 最低按 '+percent(BALANCE4.swordPuppetFloor)+' 计':'')+'。';
  if(combo.effect==='puppetGuard')description+='；按本次配置的 '+(next.stats.puppets||0)+' 具常驻傀儡，本联动提供 '+(next.stats.puppets||0)*3+' 护甲。';
  if(combo.effect==='thunderInsect')description='施雷时按当时出战虫数恢复生命，每只 0.8，受生命上限限制；成型时不立即治疗。';
  return {effect:combo.effect,name:combo.name,description};
 });
}
export const traitComboBenefit=(trait,b)=>newlyFormedCombos(trait,b).map(c=>'本次形成'+c.name+'：'+c.description).join(' ');
export function traitSpeciesLine(trait,b){return b.traits[trait.id]?'强化已有战术 · '+PATHS[trait.path].name+'种类不变':'新增一种战术 · '+PATHS[trait.path].name+'种类 +1';}
