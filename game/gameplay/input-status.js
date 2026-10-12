/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {directFocus} from './targeting.js';
// Ephemeral UI observations only. A restored run starts without an invented release history.
const releases=new WeakMap();
export const AIM_RELEASE_LABELS=Object.freeze({
 'target-missing':'目标已消失',
 'target-dead':'目标生命已耗尽',
 'target-untargetable':'目标当前不可攻击',
 'target-protected':'目标进入护势',
 'target-ending':'玄骨进入圣火危机阶段',
 'target-range':'目标已离开本局锁敌射程',
 'drag':'拖动改为定点瞄准',
 'point-change':'重新点按改为定点瞄准',
 'manual':'主动解除瞄准',
 'mouse-aim':'鼠标接管瞄准',
 'pause':'暂停时清除瞄准',
 'choice':'悟道时清除瞄准',
 'help':'打开帮助时清除瞄准',
 'settings':'打开设置时清除瞄准',
 'confirm':'打开确认窗口时清除瞄准',
 'details':'打开战况时清除瞄准',
 'blur':'失去焦点时清除瞄准',
 'finish':'历练结束时清除瞄准',
 'node-change':'离开节点时清除瞄准',
 'lock-disabled':'锁敌当前已停用',
 'left-battle':'离开战斗时清除瞄准',
 'input-cleared':'瞄准输入已清除'
});
export function rememberAimRelease(b,clearPoint,reason='input-cleared'){
 const locked=b.touchLockId!=null,hasPoint=!!b.input?.aim;
 if(!locked&&!(clearPoint&&(hasPoint||b.input?.focus||b.input?.touchAim)))return;
 const target=locked?b.enemies?.find(e=>e.id===b.touchLockId):null;
 const code=Object.hasOwn(AIM_RELEASE_LABELS,reason)?reason:'input-cleared';
 releases.set(b,Object.freeze({reason:code,label:AIM_RELEASE_LABELS[code],at:b.time,from:locked?'follow':b.input?.touchAim?'fixed':b.input?.focus?'mouse-focus':'mouse-aim',targetId:locked?b.touchLockId:null,targetName:target?.name||null,clearedPoint:!!clearPoint}));
}
export function forgetAimRelease(b){releases.delete(b);}
export function aimReleaseInfo(b){const release=releases.get(b);return release?{...release}:null;}
// Read the actual current input and sticky saved flag. Do not run target validation here: it
// belongs to updateTouchLock, and a rendering read must not release or retarget anything.
export function currentAimState(b){
 const supported=b.rulesVersion===3&&b.options.focusVersion===3,enabled=supported?b.options.touchLockEnabled===true:null,everEnabled=supported?b.options.touchLockUsed===true:null;
 const target=b.touchLockId!=null?b.enemies.find(e=>e.id===b.touchLockId):null,point=b.input?.aim;
 const mode=b.touchLockId!=null?'follow':point&&b.input?.touchAim?'fixed':point&&b.input?.focus?'mouse-focus':point?'mouse-aim':'free';
 const label=mode==='follow'?'跟随锁敌 · '+(target?.name||'目标信息暂缺'):mode==='fixed'?'定点瞄准 · 松手后保留':mode==='mouse-focus'?(directFocus(b)?'鼠标集火 · 跟随指针':'鼠标指引 · 按本局剑式分配'):mode==='mouse-aim'?'鼠标瞄准点 · 未按住集火':'自动选敌 · 无手动瞄准';
 return {mode,label,supported,enabled,everEnabled,settingLabel:supported?'触屏锁敌开关：'+(enabled?'开':'关'):'旧集火规则 · 不支持触屏锁敌',historyLabel:supported?'本局曾开启锁敌：'+(everEnabled?'是':'否'):'旧集火规则 · 无锁敌历史标记',targetId:b.touchLockId??null,targetName:target?.name||null,point:point?{x:point.x,y:point.y}:null,release:aimReleaseInfo(b),releaseNote:'解除原因只保留本页最近一次实际事件；读档不补造。'};
}
