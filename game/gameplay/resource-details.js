/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {statSources,shieldCoreMultiplier} from './stat-sources.js';
import {thunderCost} from './balance.js';
// The same deployment totals previously shown by RunStats. Reading never spawns a unit.
export function allyDeployment(b){const p=b.player,s=b.stats;return {puppets:Math.min(12,(s.puppets||0)+(p.buffs.puppet>b.time?1:0)),insects:Math.min(30,(s.insects||0)+(s.breed?Math.min(6,Math.floor(b.kills/25)):0)+(p.buffs.insect>b.time?4:0))};}
export function resourceOverview(b){
 const p=b.player,s=b.stats,deployed=allyDeployment(b),cost=thunderCost(b),puppets=Math.min(12,s.puppets||0),insects=Math.min(30,s.insects||0),brood=s.breed?Math.min(6,Math.floor(b.kills/25)):0,withBrood=Math.min(30,insects+brood);
 return {sources:statSources(b),shield:{current:p.shield,maximum:p.maxShield,extra:Math.max(0,p.shield-p.maxShield),gap:Math.max(0,p.maxShield-p.shield),core:shieldCoreMultiplier(b)},reserve:{current:p.reserve,maximum:p.maxReserve,cost,budget:Math.floor(p.reserve/cost),mana:p.mana},allies:{deployed,puppets:b.puppets.length,insects:b.insects.length,permanentPuppets:puppets,permanentInsects:insects,brood:withBrood-insects,temporaryPuppets:deployed.puppets-puppets,temporaryInsects:deployed.insects-withBrood}};
}
