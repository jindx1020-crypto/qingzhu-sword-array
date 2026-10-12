/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {afterThunderWindow,phase3Balance,puppetReady} from './balance.js';
const clamp=n=>Math.max(0,Math.min(1,n));
const seconds=(n,digits=1)=>n>0&&n<10**-digits?'<'+(10**-digits).toFixed(digits):Math.max(0,n).toFixed(digits);
const percent=n=>Number((n*100).toFixed(1))+'%';

// Display only: do not advance time, start an action, add cues, or store a
// separate countdown. These values share the current run's actual predicates.
export function setupWindow(b){
 if(b.rulesVersion<2||b.path!==2)return null;
 if(b.hasCore?.('K06')){const active=!!b.player.moving;return {kind:'setup',state:active?'moving':'waiting-move',show:true,active,remaining:null,duration:null,fraction:null,label:active?'移动策应':'待移动策应',title:'移动策应替代起手驻定加速；'+(active?'当前移动输入使傀儡攻速 +35%。':'当前没有移动输入，移动弩速加成未生效。')+' 不显示架设倒计时。'};}
 const ready=puppetReady(b),elapsed=Math.max(0,Math.min(.6,b.stillTime||0));
 if(ready){const linger=phase3Balance(b)&&elapsed<.6&&b.setupUntil>b.time,remaining=linger?b.setupUntil-b.time:null;return {kind:'setup',state:linger?'linger':'ready',show:true,active:true,remaining,duration:linger?.3:null,fraction:linger?clamp(remaining/.3):1,label:linger?'架设余'+seconds(remaining)+'s':'架设就绪',title:linger?'移动后的真实架设衔接还剩 '+seconds(remaining,2)+' 秒；傀儡攻速 +25%。到期后不延长窗口。':'已达到连续停稳 0.6 秒条件，起手架设使傀儡攻速 +25%；并非命中保证。'};}
 return {kind:'setup',state:b.player.moving?'moving-unready':'building',show:true,active:false,remaining:.6-elapsed,duration:.6,fraction:clamp(elapsed/.6),label:b.player.moving?'待驻定':'驻定需'+seconds(.6-elapsed)+'s',title:'连续停稳 '+seconds(elapsed,2)+' / 0.60 秒；达到现有 0.6 秒门槛才获得起手架设攻速。移动会重置驻定计时。'};
}
export function afterThunderWindowReadout(b){
 const bonus=(b.stats.afterThunder||0)+(b.rulesVersion>=2&&b.path===1?.25:0);if(!bonus)return null;
 const duration=afterThunderWindow(b),elapsed=b.time-b.thunderTime,active=elapsed>=0&&elapsed<duration,remaining=active?duration-elapsed:0;
 return {kind:'afterThunder',state:active?'active':'waiting',show:active,active,remaining,duration,fraction:active?clamp(remaining/duration):0,label:active?'余雷'+seconds(remaining)+'s':'余雷未生效',title:'神雷后飞剑增伤窗口 '+duration+' 秒；'+(active?'当前剩余 '+seconds(remaining,2)+' 秒，飞剑伤害加成 +'+percent(bonus)+'（加成层）。':'当前窗口未生效。')+' 与神雷就绪/资源条件、余雷牵引雷击次数分别计算。'};
}
export function deflectionWindow(b){
 if(b.rulesVersion<2||b.path!==5)return null;
 const duration=.24+(b.stats.iframes||0),elapsed=b.time-b.player.lastDash,remaining=elapsed>=0?Math.max(0,Math.min(b.player.invuln,duration-elapsed)):0,within=remaining>0;
 const modern=phase3Balance(b),spent=b.lastCounter>=b.player.lastDash,legacyCooldown=Math.max(0,4-b.time+b.lastCounter),ready=modern?!spent:legacyCooldown===0;
 const state=!within?'closed':spent?'spent':ready?'open':'counter-cooldown',active=within&&ready;
 const label=state==='open'?'化解'+seconds(remaining,2)+'s':state==='spent'?'本闪已反击':state==='counter-cooldown'?'反击冷却':'化解窗已结束';
 const title=state==='open'?'当前闪避化解窗口剩余 '+seconds(remaining,2)+' 秒；仍须在窗口内实际挡下来袭，空闪不会触发反击或回盾。':state==='spent'?'本次闪避已经实际触发反击；剩余无敌时间不是第二次反击机会。':state==='counter-cooldown'?'当前仍处闪避保护窗口，但旧规则的反击间隔还剩 '+seconds(legacyCooldown,2)+' 秒；不把避伤能力显示为可再次反击。':'当前没有仍可用的闪避开始窗口；不从其他无敌来源补造化解窗口。';
 return {kind:'deflection',state,show:within,active,remaining,duration,fraction:active?clamp(remaining/duration):0,label,title};
}
export function tacticalWindow(b,kind){return kind==='setup'?setupWindow(b):kind==='afterThunder'?afterThunderWindowReadout(b):kind==='deflection'?deflectionWindow(b):null;}
