/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {TRAITS} from './data.js';
import {revisedGrowth,traitReadiness,xpCostFor} from './growth-rules.js';
import {healthFraction} from './meters.js';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const number=n=>Number(n.toFixed(1));
// Eligibility is a pure filter. Never call traitChoices: that would consume the saved RNG.
export function cultivationProgress(b){
 const level=b.level,pending=Math.max(0,b.queuedChoices||0),capped=level>=160;
 const eligible=TRAITS.some(t=>revisedGrowth(b)?traitReadiness(t,b).eligible:(b.traits[t.id]||0)<t.max);
 const nextLevel=capped?null:Math.min(160,(Math.floor(level/4)+1)*4),start=Math.max(1,Math.floor(level/4)*4);
 let total=0,earned=b.xp,needed=-b.xp;
 if(nextLevel!==null){for(let l=start;l<nextLevel;l++){const cost=xpCostFor(b,l);total+=cost;if(l<level)earned+=cost;else needed+=cost;}}
 const xpNeeded=nextLevel===null?null:Math.max(0,needed),progress=nextLevel===null?null:clamp(earned/total,0,1);
 const label=pending>0?(eligible?'待悟道 '+pending+' 次':'待悟道 '+pending+' 次 · 当前无可用强化'):capped?'进阶 160 · 已达等级上限':!eligible?'当前可用强化已修满':'下一次悟道：'+nextLevel+' 级';
 const detail=(capped?'已达进阶 160 上限，不再由升级增加悟道机会。':'按本局经验曲线，到 '+nextLevel+' 级还需 '+(xpNeeded>0&&xpNeeded<.1?'不足 0.1':number(xpNeeded))+' 经验；每 4 级获得一次悟道机会。')+(pending>0?' 当前已排队 '+pending+' 次'+(eligible?'，按既有流程处理。':'；当前无可用强化，进入悟道时按原规则处理，不承诺出现候选。'):!eligible?' 当前没有可选强化，不把等级门槛当作必定出现候选。':'')+(level>=72?' 飞剑保持 72 把，进阶等级继续单独显示。':'');
 return {level,swords:Math.min(72,level),pending,capped,eligible,nextLevel,xpNeeded,progress,label,detail};
}
// Swarm/seal bars represent objectives, and Xuangu's last phase represents survival time.
export function bossHealthReadout(b){
 const e=b.boss;if(!e||['swarm','seal'].includes(e.type)||b.bossEnding>0||!Number.isFinite(e.hp)||!Number.isFinite(e.maxHp)||e.maxHp<=0)return null;
 const percent=healthFraction(e.hp,e.maxHp)*100,label=percent>0&&percent<.1?'生命不足 0.1%':percent<100&&percent>99.9?'生命高于 99.9%':'生命 '+number(percent)+'%';
 return {percent,label,hp:e.hp,maxHp:e.maxHp};
}
const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
// anchor is a world-space text baseline. size and occlusions are CSS pixels, like battleCamera.
// Only the text rectangle moves; the camera, objective positions and collision circles are inputs.
export function placeObjectiveLabel(camera,anchor,size,occlusions=[]){
 const pad=4,left=camera.left+pad,right=camera.right-pad,top=camera.top+pad,bottom=camera.bottom-pad;
 const width=Math.min(size.width,Math.max(1,right-left)),height=Math.min(size.height,Math.max(1,bottom-top));
 const desired={x:camera.x+anchor.x*camera.scale,y:camera.y+anchor.y*camera.scale};
 const box=(x,y)=>{x=clamp(x,left+width/2,right-width/2);y=clamp(y,top+height,bottom);return {x,y,left:x-width/2,right:x+width/2,top:y-height,bottom:y,width,height};};
 const first=box(desired.x,desired.y),candidates=[first];
 for(let step=1;step<=8;step++)for(const direction of [-1,1])candidates.push(box(first.x,first.y+direction*step*(height+6)));
 for(const blocked of occlusions){candidates.push(box(first.x,blocked.top-6),box(first.x,blocked.bottom+height+6),box(blocked.left-width/2-6,first.y),box(blocked.right+width/2+6,first.y));}
 const score=p=>occlusions.reduce((n,r)=>n+overlap(p,r),0),distance=p=>Math.hypot(p.x-desired.x,p.y-desired.y);
 candidates.sort((a,b)=>score(a)-score(b)||distance(a)-distance(b));const chosen=candidates[0];
 return {...chosen,moved:Math.hypot(chosen.x-desired.x,chosen.y-desired.y)>.5,occluded:score(chosen)>0};
}
