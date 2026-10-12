/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {AIM_RELEASE_LABELS,rememberAimRelease,forgetAimRelease} from './input-status.js';
import {normalizeLayoutPreferences} from './touch-layout.js';
// Layout is device-local. Locking is opt-in and available only to saved focus rule 3.
export const TOUCH_DEFAULTS={...normalizeLayoutPreferences(),touchLock:false};
export function touchSettings(settings={}){return {...normalizeLayoutPreferences(settings),touchLock:settings?.touchLock===true};}
export const supportsTouchLock=b=>b.rulesVersion===3&&b.options.focusVersion===3;
export const touchLockAvailable=b=>supportsTouchLock(b)&&b.options.touchLockEnabled===true;
// At least one sword must actually be able to acquire the target. Inner orbit groups keep their shorter range.
export function touchLockRange(b){if(!b.swords.length)return 0;return b.formation===1?(180+Math.floor((b.swords.length-1)/18)*24)*(b.orbitMultiplier?.()??1):320*(1+(b.stats.range||0));}
export const legalTouchTarget=(b,e)=>!!e&&e.hp>0&&!e.untargetable&&!(e.phaseShield>0)&&!(e.bossType==='xuangu'&&b.bossEnding>0)&&Math.hypot(e.x-b.player.x,e.y-b.player.y)<touchLockRange(b);
export function clearTouchLock(b,clearPoint=false,reason='input-cleared'){rememberAimRelease(b,clearPoint,reason);b.touchLockId=null;if(b.combatCues)b.combatCues=b.combatCues.filter(c=>!['touch-lock','touch-lock-release'].includes(c.key));if(clearPoint&&b.input){b.input.aim=null;b.input.focus=false;b.input.touchAim=false;}}
export function setTouchAim(b,point,{allowLock=true,scale=1}={}){
 if(b.modeState!=='battle'||!point||!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;
 b.input.aim={x:point.x,y:point.y};b.input.focus=true;b.input.touchAim=true;clearTouchLock(b,false,allowLock?'point-change':'drag');
 if(allowLock&&touchLockAvailable(b)){const hit=b.enemies.filter(e=>legalTouchTarget(b,e)&&Math.hypot(e.x-point.x,e.y-point.y)<=Math.max(e.r+8,18/Math.max(.1,scale))).sort((a,z)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(z.x-point.x,z.y-point.y)||a.id-z.id)[0];if(hit){b.touchLockId=hit.id;b.options.touchLockUsed=true;b.input.aim={x:hit.x,y:hit.y};forgetAimRelease(b);b.cue('touch-lock','锁定 '+hit.name+' · 解除键可取消','#c9e8bd',2);}}
 return true;
}
export function updateTouchLock(b){
 if(b.touchLockId==null)return;
 const e=b.enemies.find(e=>e.id===b.touchLockId);
 const available=touchLockAvailable(b);if(!available||b.modeState!=='battle'){clearTouchLock(b,true,available?'left-battle':'lock-disabled');return;}
 if(!legalTouchTarget(b,e)){
  // The original predicate already rejected this target. Classify its first failing condition
  // in the same order; do not call range/targeting methods again or choose another enemy.
  const reason=!e?'target-missing':e.hp<=0?'target-dead':e.untargetable?'target-untargetable':e.phaseShield>0?'target-protected':e.bossType==='xuangu'&&b.bossEnding>0?'target-ending':'target-range';
  clearTouchLock(b,false,reason);b.cue('touch-lock-release',AIM_RELEASE_LABELS[reason]+' · 已退回定点瞄准','#e3d2ab',2);return;
 }
 b.input.aim={x:e.x,y:e.y};b.input.focus=true;b.input.touchAim=true;
}
export function savedTouchLock(b){return supportsTouchLock(b)&&b.modeState==='battle'&&touchLockAvailable(b)&&legalTouchTarget(b,b.enemies.find(e=>e.id===b.touchLockId))?b.touchLockId:null;}
export function validateTouchSnapshot(data,b){const ex=data.expedition,o=data.options;
 const fail=()=>{throw Error('触屏锁敌记录无效，原记录未被修改');};
 if(!supportsTouchLock(b)){if(ex.touchLockId!==undefined||o.touchLockEnabled!==undefined||o.touchLockUsed!==undefined)fail();return;}
 if(typeof o.touchLockEnabled!=='boolean'||typeof o.touchLockUsed!=='boolean'||o.touchLockEnabled&&!o.touchLockUsed||!Object.hasOwn(ex,'touchLockId'))fail();
 const id=ex.touchLockId;if(id!==null&&(!Number.isSafeInteger(id)||data.modeState!=='battle'||!o.touchLockEnabled||!o.touchLockUsed||!legalTouchTarget(b,b.enemies.find(e=>e.id===id))))fail();
}
