/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {revisedBalance,sigilWarn,sigilCooldown,traitText,traitMods,afterThunderWindow} from './balance.js';
import {traitEffectivePreview} from './stat-sources.js';
import {STAT_NAMES,EFFECTS,number,valueText} from './stat-text.js';
export {modText,STAT_NAMES} from './stat-text.js';
// Actual limits and budget after the candidate, alongside the existing additive-source line.
export function traitEffectiveValueLine(trait,battle){
 const preview=traitEffectivePreview(trait,battle);if(!preview)return '';
 const {before,after}=preview,parts=[],mods=traitMods(battle,trait);
 if(before.puppets!==after.puppets)parts.push('常驻傀儡 '+number(before.puppets)+' → '+number(after.puppets));
 else if(mods.puppetShield)parts.push('常驻傀儡 '+number(after.puppets)+' 具');
 if(before.shield!==after.shield||mods.shield||mods.puppetShield)parts.push('本局护盾上限 '+number(before.shield)+' → '+number(after.shield));
 if(mods.thunderSave||mods.reserve){
  parts.push('本局每次神雷耗用 '+number(before.cost)+' → '+number(after.cost));
  if(mods.reserve)parts.push('雷源储量 '+number(before.reserve)+' / '+number(before.maxReserve)+' → '+number(after.reserve)+' / '+number(after.maxReserve));
  parts.push('雷源可支撑 '+before.budget+' → '+after.budget+' 次（仅储量预算，实际施放仍需灵力与本局规则允许）');
 }
 return parts.join(' · ');
}
export const TIER_NAMES=['一阶','二阶','三阶'];
// Round-2 C-3: card line "current → after" read from the same mods the engine sums in recalc (traitMods) and the live stats.
export function traitValueLine(trait,battle){
 if(!trait||!battle)return '';const mods=traitMods(battle,trait),s=battle.stats||{},parts=[];
 for(const [key,value] of Object.entries(mods||{})){if(!Number.isFinite(value))continue;
  if(EFFECTS[key]&&value>0){parts.push(((s[key]||0)>0?'已具备 · ':'新效果 · ')+EFFECTS[key]);continue;}
  const now=s[key]||0;let text=(STAT_NAMES[key]||'未识别效果')+' '+valueText(key,now)+' → '+valueText(key,now+value);
  if(key==='afterThunder')text+='（神雷后 '+afterThunderWindow(battle)+' 秒内）';parts.push(text);}
 return parts.join(' · ');
}
export const traitTierName=trait=>TIER_NAMES[(trait?.tier||1)-1]||'';
export function traitDescription(trait,battle){if(!trait)return '';if(trait.id==='talisman-10'&&battle?.rulesVersion>=2&&battle.path===4){const radius=Number((100*(1+(battle.stats.metaSigilRadius||0))).toFixed(1));return '起手符火伤害 +35%，本局半径增至 '+radius+(revisedBalance(battle)?'，布符缩短到 '+Number(Math.max(.1,.2-(battle.stats.metaSigilArming||0)).toFixed(2))+' 秒，敌人踏入即爆，最多留存 '+Number(sigilWarn(battle).toFixed(1))+' 秒；留符仍独立冷却 ':'，延时缩短到 0.55 秒；留符仍独立冷却 ')+Number(sigilCooldown(battle).toFixed(1))+' 秒。';}if(trait.id==='talisman-10')return trait.desc+'；非符阵起手每次闪避留火，沿用闪避冷却，不使用起手符的独立冷却。';return battle?traitText(battle,trait):trait.desc;}
