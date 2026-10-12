/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {CONSUMABLES} from './data.js';
import {challengeBlocks} from './experience-rules.js';
import {SUPPLY_PRICES} from './late-supply.js';
// A pure medicine may legally restore a tiny positive amount; never round it to a false zero.
const number=n=>n>0&&n<.001?'不足 0.001':Number(n.toFixed(3));
const splitShield=(player,gain)=>{const restored=Math.min(gain,Math.max(0,player.maxShield-player.shield));return {restored,extra:gain-restored};};
// Read existing readiness/quotes. No consume, purchase, recalc, projection run or random draw.
export function consumableDetails(b,index,state=b.itemReadiness(index)){
 const slot=b.consumables[index],p=b.player,item=state.item;if(!slot||!item)return null;
 const challenge=!!b.isExpedition&&challengeBlocks(b,'items'),available=state.count>0&&!state.blocked&&!challenge,notes=[];
 const reason=challenge?'本圈惜物挑战：普通节点禁用药囊；实体首领与取宝、幻境、冰焰节点仍可用。':state.reason||'';
 if(challenge&&state.reason)notes.push(state.reason+'。');
 let effect=item.desc,instantGain=null;
 if(state.gain!==null){instantGain=state.gain;effect='按当前状态，'+(available?'使用后可恢复 ':'解除不可用条件前不会恢复；当前恢复空间为 ')+number(state.gain)+(item.effect==='heal'?' 生命':' 灵力')+'。';if(item.effect==='mana')notes.push('回灵不补雷源。');}
 else if(item.effect==='shield'){const s=splitShield(p,item.value);instantGain=item.value;effect=(available?'使用后获得 ':'有库存且本局允许时，使用后获得 ')+number(item.value)+' 护盾：补足常驻缺口 '+number(s.restored)+' + 额外护盾 '+number(s.extra)+'；当前 '+number(p.shield)+' → '+number(p.shield+item.value)+'（常驻上限 '+number(p.maxShield)+'）。';notes.push('已有额外护盾仍保留；不增加常驻上限。');}
 else if(state.summon){effect=state.summon.text+'。';const left=Math.max(0,(p.buffs[item.effect]||0)-b.time);if(left>0)notes.push('当前临时增员剩余 '+number(left)+' 秒；重复使用刷新到 '+item.value+' 秒，不叠加数量。');notes.push('属于临时增员；不增加按常驻编制换算的护甲或护盾。');}
 else if(['regen','speed','armor','damage'].includes(item.effect)){const left=Math.max(0,(p.buffs[item.effect]||0)-b.time);notes.push('使用后计时重设为 '+item.value+' 秒'+(left>0?'；当前剩余 '+number(left)+' 秒':'')+'，同类效果不叠加。');if(item.effect==='regen')notes.push('随战斗时间逐步回复，受生命上限与本局恢复加成影响；没有即时回血，不把整段持续量当作即得。');}
 else if(item.effect==='dash')notes.push('同时刷新闪避与恢复生命；回血受当前缺口限制。满血且闪避已就绪时仍会消耗，不保证得到完整的标称回复量。');
 else if(item.effect==='invincible')notes.push('不缩短当前更长的无敌时间；重复使用仍会消耗。');
 else if(['fire','shock','seal','slow','magnet'].includes(item.effect))notes.push('实际命中、掉落收取或控制效果取决于当前战场；场上没有有效目标时也可消耗。');
 if(state.bonus)notes.push('本次优先使用加赠药包；原药囊「'+(CONSUMABLES.find(c=>c.id===slot.id)?.name||slot.id)+'」仍有 '+slot.count+' 份。');
 else if(state.pendingBonus)notes.push('另有加赠回元药包 '+slot.bonusHeal+' 份；满血时保留，受伤后优先使用。');
 if(!['heal','mana'].includes(item.effect))notes.push('这不是纯生命／灵力恢复物资，满状态不会自动阻止消耗。');
 return {index,name:item.name,count:state.count,description:item.desc,effect,notes,potentialGain:instantGain,actualGain:available?instantGain:0,available,reason,availability:reason||(b.modeState==='battle'?'当前可使用':'继续战斗后可使用')};
}
export function supplyDetails(b,quote){
 const p=b.player,hp=quote.type==='hp',gain=quote.ready?quote.gain:0,split=hp?null:splitShield(p,gain),limit=SUPPLY_PRICES.length;
 const nodeUsed=(b.economy?.supplyPurchases||[]).some(r=>r.loop===(b.endlessLoop||0)&&r.node===b.rest?.node);
 const reasons={unavailable:'本节点或旧经济规则不开放有限补养。','wrong-scene':'需在本处整备中购买。','node-used':'本处整备已购买过补养。','global-limit':'本局有限补养额度已用尽；无尽换轮不重置。','invalid-type':'此类补养不可用。',unaffordable:'灵石不足，还缺 '+Math.max(0,(quote.price||0)-b.gold)+' 灵石。',full:quote.gain>0?(hp?'生命':'护盾')+'可恢复量不足 1 点，按已满处理，不收费。':hp?'生命已满，不收费。':'护盾已达到本补养上限，不收费。'};
 return {actualGain:gain,restored:split?.restored??gain,extra:split?.extra??0,reason:quote.reason?reasons[quote.reason]||'当前不可购买，未扣款。':'',effect:quote.ready?(hp?'购买后立即恢复 '+number(gain)+' 生命。':'购买后立即获得 '+number(gain)+' 护盾：补足常驻缺口 '+number(split.restored)+' + 额外护盾 '+number(split.extra)+'。'):'当前不可购买：不扣款、不恢复。',capacity:hp?'当前生命 '+number(p.hp)+' / '+number(p.maxHp):'当前护盾 '+number(p.shield)+' / 常驻上限 '+number(p.maxShield),quota:'本局剩余 '+Math.max(0,limit-quote.count)+' / '+limit+' 次 · 本处剩余 '+(nodeUsed?0:1)+' / 1 次',potential:!quote.ready&&quote.gain>=1?'若其余购买条件满足，当前可恢复 '+number(quote.gain)+(hp?' 生命。':' 护盾。'):''};
}
