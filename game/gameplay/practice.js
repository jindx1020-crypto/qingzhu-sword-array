/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
export const PRACTICE_STEPS=[
 {title:'移动避险',text:'用 WASD／方向键或左下摇杆，走入青色圆圈；观察训练敌人的扑击预警。'},
 {title:'闪避脱身',text:'朝空旷方向移动，再按闪避键或点闪避按钮。冷却未结束时会显示原因。'},
 {title:'集中火力',text:'鼠标按住战场，或触屏点按靶子附近，先观察近处 A 靶，再明确瞄准 B 靶；只有新出击剑选中 B 才完成，在途剑保持原目标。'},
 {title:'施放神雷',text:'灵力和雷源都足够时，按神雷键或点辟邪神雷；本步骤已补足训练资源。'},
 {title:'护阵分守',text:'先开启集火，再松开左键；触屏点右上角解除集火。阵盘也需要保护，集中处理威胁后可恢复分守。'},
 {title:'留符引敌',text:'靠近追兵，等提示“距离合适”后向外闪避。符留在起点，闪后停在符旁引敌；布好后自动引爆，主符命中即完成。'},
 {title:'定时挡招（可选）',text:'预警结束时有一次来袭。看准战场的预警圈与倒计时（最后 1 秒有提示音）后闪避，只有实际化解才算成功；空闪或窗口外不会回盾，可重试或结束。'}
];
// The timed guard drill (step 7) telegraphs from a fixed point so the warning ring, incoming marker and sound match a real attack; no battle RNG is consumed.
export const PRACTICE_ATTACK_ORIGIN={x:820,y:520};
export function beginPracticeStep(b,step=0){
 if(b.mode!=='training')return;
 b.clearField();b.clearDashInput();b.input.focus=false;b.input.aim=null;b.input.touchAim=false;
 b.input.x=0;b.input.y=0;b.player.dash=0;b.player.moving=false;
 b.player.x=640;b.player.y=520;b.player.dashCD=0;b.player.mana=100;b.player.reserve=b.player.maxReserve;
 b.practice={step,sigilHits:b.sigilStats.sigil.hits,started:b.time,ready:false,sawFocus:false,focusReleased:false,thunders:b.thunders,dashBefore:b.player.lastDash,nextSpawn:b.time};
 b.objective=step===4?{kind:'defend',x:640,y:410,hp:360,maxHp:360,invuln:0,done:0}:null;
 if(step===0)b.practice.goal={x:530,y:470,r:55};
 if(step===5){b.lastSigil=b.time-6;const target=b.spawn(4,{x:640,y:380,hp:100000,speed:50,practiceTarget:true,noDrop:true,name:'留符追兵练习靶'});if(target){target.x=640;target.y=410;}}
 // B sits left of Han Li: the instruction panel docks on the right and covered the old right-hand B at 844×390 and 1024×768.
 if(step===2){for(const [label,x,y] of [['A',560,450],['B',430,560]]){const e=b.spawn(4,{x,y,hp:10000000,speed:0,noDrop:true,name:label+' · 集火练习靶',practiceAnchor:true});e.x=x;e.y=y;e.practiceAnchor=true;}b.practice.focusLaunch=false;}
 if(step===6){b.player.shield=0;b.player.invuln=0;b.practice.attackAt=b.time+3;b.practice.counterBefore=b.lastCounter;b.practice.guardResult='来袭预警 · 3.0 秒';b.practice.warnSounded=false;b.fx.push({kind:'practice-warning',x:b.player.x,y:b.player.y,fromX:PRACTICE_ATTACK_ORIGIN.x,fromY:PRACTICE_ATTACK_ORIGIN.y,ttl:3,max:3});}
 b.emit({type:'update'});
}
export function updatePractice(b,dt){
 const q=b.practice;if(!q)return;
 if(![2,5,6].includes(q.step)&&b.time>=q.nextSpawn&&b.enemies.length<5){q.nextSpawn=b.time+3;b.spawn(4,{x:q.step===4?440:1000,y:300,hp:300,speed:80});}
 if(b.objective)b.objective.invuln=Math.max(0,b.objective.invuln-dt);
 q.sawFocus||=!!b.input.focus;
 if(q.step===6&&!q.ready){const left=q.attackAt-b.time;if(left>0){q.guardResult='来袭预警 · '+left.toFixed(1)+' 秒后挡招';if(left<=1&&!q.warnSounded){q.warnSounded=true;b.feedbackSound('critical');}}else if(!q.attackDone){q.attackDone=true;const shield=b.player.shield,counter=b.lastCounter;b.hitPlayer(30,false,{name:'试剑台定时来袭',kind:'近身',x:PRACTICE_ATTACK_ORIGIN.x,y:PRACTICE_ATTACK_ORIGIN.y});q.ready=b.lastCounter!==counter;q.guardGain=b.player.shield-shield;q.guardResult=q.ready?'实际化解成功 · 本次回盾 '+Number(q.guardGain.toFixed(1))+'；同次来袭只结算一次':'未化解 · 空闪或不在窗口内；点击重试';b.emit({type:'update'});}}
 if(q.step===5){const z=b.zones.find(z=>z.sigil&&!z.metaEcho&&!z.fired),target=b.enemies.find(e=>e.practiceTarget&&e.hp>0),radius=(b.stats.dashFire?100:85)*(1+(b.stats.metaSigilRadius||0)),distance=target?Math.hypot(target.x-b.player.x,target.y-b.player.y):Infinity;q.sigilHint=z?(z.arming>0?'留符已落下 · 布好还需 '+z.arming.toFixed(1)+' 秒':'符已布好 · 把追兵引入圈内，别继续跑远'):b.player.lastDash!==q.dashBefore?'未命中时，等留符冷却结束再试；先靠近再向外闪避':distance>radius+(target?.r||0)?'先靠近追兵 · 进入约一个符圈的距离':'距离合适 · 朝远离追兵的方向闪避';}
 const complete=q.step===6?q.ready:q.step===5?b.sigilStats.sigil.hits>q.sigilHits:q.step===0?Math.hypot(b.player.x-q.goal.x,b.player.y-q.goal.y)<q.goal.r:q.step===1?b.player.lastDash!==q.dashBefore:q.step===2?q.focusLaunch:q.step===3?b.thunders>q.thunders:q.focusReleased;
 if(complete&&!q.ready){q.ready=true;b.feedbackSound('choose');b.emit({type:'update'});}
}

export function practiceSwordLaunch(b,e){const q=b.practice;if(q?.step!==2||!b.input.focus||!b.input.aim||!e.name.startsWith('B ·'))return;const a=b.enemies.find(v=>v.name.startsWith('A ·'));if(Math.hypot(e.x-b.input.aim.x,e.y-b.input.aim.y)<=e.r+28&&(!a||Math.hypot(a.x-b.input.aim.x,a.y-b.input.aim.y)>Math.hypot(e.x-b.input.aim.x,e.y-b.input.aim.y)))q.focusLaunch=true;}

// Step 5 completes only on the player's own release (canvas pointerup or the touch clear buttons), never when the system clears aim.
export function practiceFocusRelease(b){const q=b.practice;if(q?.step===4&&q.sawFocus&&b.input.focus)q.focusReleased=true;}
export function practiceFocusCleared(b){const q=b.practice;if(q&&q.step===4&&!q.ready)q.sawFocus=false;}
