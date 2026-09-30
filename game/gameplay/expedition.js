/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {SEGMENT_VERSION,CHALLENGE_VERSION,segmented,challenged,appendChapterSplit,prepareChallenge,chooseChallenge,commitChallenge,challengeBlocks,validateExperienceSnapshot,loopScale,endlessAutoSkip} from './experience-rules.js';
import {validateLastChoice} from './experience-hints.js';
import {supplyState,buySupply} from './late-supply.js';
import {createRoutes,plannedRoutes,serializeRoutePlan,restoreRoutePlan} from './route-plans.js';
import {RECORD_VERSION,rankedRun,initialRecordState,completeRecordLoop,recordDetails,validateRecordSnapshot} from './record-rules.js';
import {supportsTouchLock,savedTouchLock,validateTouchSnapshot,clearTouchLock,updateTouchLock} from './touch-controls.js';
import {STORY_VERSION,revisedStory,persistentStory,eligibleEvents,chapterEventText,validateStory} from './story-rules.js';
import {treasureStepSeconds,illusionFirstWait,validatePacing,FIXED_NODE_SECONDS,seededIllusionGates,illusionGateOrder,illusionTrueGate} from './pacing-rules.js';
import {ECONOMY_VERSION,endingCleanup,revisedEconomy,emptyEconomy,variedCoreOffers,rerollPurchaseReadiness,buyReroll,validatePhase3,cashOptionsFor,cashRewardFor} from './economy-rules.js';
import {CULTIVATION_VERSION} from './cultivation.js';
import {validatePhase2} from './phase2-validation.js';
import {GROWTH_VERSION,growthPerformance,revisedGrowth,nodeGrowth,emptyGrowth,growthChoices,beginGrowthNode,allocateKillXP,creditGrowthDrop,creditRuneXP,settleGrowthNode} from './growth-rules.js';
import {ENCOUNTER_VERSION,latePressure,mechanismPressure,mechanismProfile,mechanismLimit,mechanismDeadline,mechanismClearing,clearingCheckpoint,revisedDirector,finitePursuit,ordinaryCount,ordinaryLimit,clearing,beginDirectorNode,updatePursuit,budgetSpawns,defendHP,defendLocked,bossHP} from './director-rules.js';
import {CONTENT_VERSION,expandedContent,NEW_ENEMIES_BY_CHAPTER,RANGED_ENEMIES} from './content-rules.js';
import {FOCUS_VERSION} from './targeting.js';
import {INPUT_VERSION} from './battle-input.js';
import {beginPracticeStep,updatePractice} from './practice.js';
import {sigilFuse} from './sigil-metrics.js';
import {BALANCE_VERSION,reserveRestoration,phase3Balance,puppetReady,sigilPairFuse,enemyDamageScale} from './balance.js';
import {shieldReward,restoreFeedback,recordHit} from './combat-feedback.js';
import {validateCommonSnapshot,validateWorldSnapshot} from './snapshot-validation.js';
import {validateEncounterState} from './encounter-validation.js';
import {validateSnapshotRelations} from './snapshot-relations.js';
import {copyAllies} from './snapshot-fields.js';
import {tickSlow} from './slow.js';
import {Battle} from './engine.js';
import {CHAPTERS,PATHS,TRAITS,RELICS,CONSUMABLES,ENEMIES,EVENTS,seeded,hashSeed} from './data.js';
import {EXPEDITIONS,CORES,CHAINS,CINEMATICS,SUPPLIES,coreEligible} from './expedition-data.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),copy=x=>structuredClone(x);
export const EQUIPMENT=[...RELICS,...CORES];
const segmentDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);};
export class Expedition extends Battle{
 constructor(options={},emit=()=>{}){
  super({...options,segmentVersion:options.segmentVersion??SEGMENT_VERSION,challengeVersion:options.challengeVersion??(options.mode==='endless'?CHALLENGE_VERSION:0),rulesVersion:3,metaRulesVersion:options.metaRulesVersion??CULTIVATION_VERSION,balanceVersion:options.balanceVersion??BALANCE_VERSION,contentVersion:options.contentVersion??CONTENT_VERSION,focusVersion:options.focusVersion??FOCUS_VERSION,inputVersion:options.inputVersion??INPUT_VERSION,growthVersion:options.growthVersion??GROWTH_VERSION,economyVersion:options.economyVersion??ECONOMY_VERSION,recordVersion:options.recordVersion??RECORD_VERSION,storyVersion:options.storyVersion??STORY_VERSION,encounterVersion:options.encounterVersion??ENCOUNTER_VERSION},emit);this.isExpedition=true;if(supportsTouchLock(this)){this.options.touchLockEnabled=options.touchLockEnabled??(options.settings?.touchLock===true);this.options.touchLockUsed=options.touchLockUsed??this.options.touchLockEnabled;}this.touchLockId=null;this.recordState=rankedRun(this)?initialRecordState(this):null;this.runId=options.runId||'run-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);this.revision=0;
  if(segmented(this))this.chapterSplits=[];if(challenged(this)){this.challenges=[];prepareChallenge(this);}
  this.contentRng=seeded(hashSeed(this.seed+':expedition'));this.routes=createRoutes(this.options,this.seed,this.contentRng);
  const chainPool=[...CHAINS];this.chains=[{chain:chainPool.splice(Math.floor(this.contentRng()*chainPool.length),1)[0].id,start:'0:0',end:'1:0',state:'waiting'},{chain:chainPool.splice(Math.floor(this.contentRng()*chainPool.length),1)[0].id,start:'2:0',end:'4:0',state:'waiting'}];
  this.receipts=[];this.cinematicSeen=[];if(persistentStory(this))this.cinematicHistory=[];this.cinematic=null;this.research=0;this.rest=null;this.paidPrices={};this.nodeDropXP=0;this.nodeStartXP=this.totalXP;this.targetCache={};this.shieldAbsorbed=0;this.lastShieldBreak=-100;this.coreArcs=0;this.coreArcUntil=0;this.corePair=0;this.selectedSupply=options.supply||'steady';
  this.economy=revisedEconomy(this)?emptyEconomy(this):null;this.growth=revisedGrowth(this)?emptyGrowth():null;this.directorState=null;this.pursuitState=null;
  if(this.mode!=='training'){const scheme=SUPPLIES.find(s=>s.id===this.selectedSupply)||SUPPLIES[0];this.consumables=scheme.items.map(([id,count])=>({id,count}));if(this.options.metaRulesVersion<2&&(options.meta||[]).includes(PATHS[this.path].id+'-meta-1')&&!this.addConsumable('heal'))this.consumables[0].bonusHeal=1;}
 }
 enemyPool(){const base=CHAPTERS[this.chapter].enemies;return expandedContent(this)?[...base,...NEW_ENEMIES_BY_CHAPTER[this.chapter]]:base;}
 get chapterInfo(){const original=CHAPTERS[this.chapter];return {...original,name:EXPEDITIONS[this.chapter].name,objective:this.routes?this.encounter.goal:original.objective,intro:this.chapter===5?['虚天殿 · 取鼎与终局','众人深入取鼎之处，各方心思难测。先穿过余下险路，再从扩散的冰焰前撤离。','其后与玄骨的对峙将消耗最后的底牌。当前选择不会改写正史因果。']:this.chapter===3?['虚天殿 · 宝光阁与幻境','虫甲遮蔽灵息，依次进入三处阵位敛息取宝。','得到五行环与血色披风后，再以神识辨清幻境中的真实出口。']:original.intro};}
 get node(){return this.routes[this.chapter][this.wave];}
 get encounter(){const n=this.node;return n.choices[n.selected??0];}
 hasCore(id){return this.relics.includes(id);}
 checkpoint(){this.revision++;this.emit({type:'checkpoint',checkpoint:this.serialize()});this.emit({type:'update'});}
 showScene(scene,state='rest'){if(scene)this.clearDashInput();this.scene=scene;this.modeState=state;this.emit({type:'scene',scene});}
 chooseChallenge(choice){return chooseChallenge(this,choice);}
 start(){
  if(!commitChallenge(this))return;
  if(this.growth?.ledger&&this.growth.ledger.node!==this.node.id)this.growth.ledger=null;
  if(this.directorState?.node!==this.node.id)this.directorState=null;if(this.pursuitState?.node!==this.node.id)this.pursuitState=null;
  if(this.mode==='training'&&this.options.guidedPractice){this.beginNode();return;}
  const story=this.chapter===0&&this.wave===0?'bamboo':revisedStory(this)&&this.chapter===1&&this.wave===0?'ghostFog':revisedStory(this)&&this.chapter===4&&this.wave===0?'innerHall':this.chapter===3&&this.wave===0?'treasure':this.chapter===5&&this.wave===2?'cauldron':null;
  if(story&&!this.cinematicSeen.includes(story)){this.playCinematic(story,'node');return;}this.beginNode();
 }
 playCinematic(id,after='rest',replay=false){this.cinematic={id,panel:0,after,replay,returnScene:this.scene,returnState:this.modeState};if(!replay&&persistentStory(this)&&((this.options.settings?.skipSeenCinematics||endlessAutoSkip(this))&&this.cinematicHistory.includes(id)||this.options.settings?.skipSeenAfterWin===true&&this.accountCleared===true)){this.advanceCinematic(true);return;}this.showScene('cinematic','rest');if(!replay)this.checkpoint();}
 advanceCinematic(skip=false){if(!this.cinematic)return;const story=CINEMATICS.find(s=>s.id===this.cinematic.id);if(!skip&&this.cinematic.panel<story.panels.length-1){this.cinematic.panel++;this.checkpoint();return;}
  const c=this.cinematic;this.cinematic=null;if(c.replay){this.showScene(c.returnScene,c.returnState);return;}this.cinematicSeen=[...new Set([...this.cinematicSeen,c.id])];if(persistentStory(this))this.cinematicHistory=[...new Set([...this.cinematicHistory,c.id])];
  if(c.after==='node')this.beginNode();else if(c.after==='finish')this.finish(true);else this.showScene('intermission');if(!this.finished)this.checkpoint();
 }
 beginNode(){
  if(this.node.selected===null){this.toast('请先选择下一条路线');return;}
  this.rest=null;this.waveTime=0;this.nodeStartXP=this.totalXP;this.nodeDropXP=0;this.nodeStartHits=this.hitCount;this.nodeStartThunder=this.thunders;this.spawnBudget=0;this.nextElite=32;this.nextEscort=15;this.nextHazard=12;this.midEncounter=null;this.mechanism=null;this.boss=null;this.bossEnding=0;this.objective=null;this.targetCache={};this.clearField();
  beginGrowthNode(this);beginDirectorNode(this);
  const e=this.encounter,k=e.kind;if(latePressure(this)&&!['serpent','ghost','puppet','xuangu'].includes(k)){const profile=mechanismPressure(this)?mechanismProfile(this):null;this.spawnBudget=profile?.opening??6;this.nextElite=profile?.firstElite??22;}this.player.x=k==='escape'?210:640;this.player.y=520;this.player.invuln=Math.max(this.player.invuln,1);
  this.showScene(null,'battle');
  if(['serpent','ghost','puppet','xuangu'].includes(k)){super.spawnBoss();this.boss.hp=this.boss.maxHp=bossHP(this,k);}
  else if(k==='swarm')this.boss={type:'swarm',name:e.name,hp:FIXED_NODE_SECONDS.swarm,maxHp:FIXED_NODE_SECONDS.swarm,timer:FIXED_NODE_SECONDS.swarm};
  else if(k==='treasure'){this.mechanism={x:430,y:400,r:90,progress:0,goal:treasureStepSeconds(this)*3,step:0};this.objective={...(clearingCheckpoint(this)?{clearingSaved:false}:{}),kind:k,done:0};}
  else if(k==='illusion')this.objective={...(this.options.encounterVersion>=7?{returnProtectedUntil:0}:{}),...(clearingCheckpoint(this)?{clearingSaved:false}:{}),kind:k,done:0,next:illusionFirstWait(this),cool:0,gates:[{x:320,y:250},{x:640,y:250},{x:960,y:250}],...(seededIllusionGates(this)?{gateOrder:illusionGateOrder(this)}:{}),trueGate:seededIllusionGates(this)?illusionGateOrder(this)[0]:this.chapter%3};
  else if(k==='ice')this.objective={...(clearingCheckpoint(this)?{clearingSaved:false}:{}),kind:k,x:640,y:260,r:40,exit:{x:1130,y:640,r:80}};
  else if(k==='defend'){const hp=defendHP(this);this.objective={kind:k,x:640,y:360,hp,maxHp:hp,invuln:0,done:0};}
  else if(k==='hunt'){this.objective={kind:k,done:0,spawned:0};this.spawnMarked();}
  else if(k==='pursuit'){const target=this.spawn(CHAPTERS[this.chapter].enemies[0],{x:900,y:270,elite:true,mission:'carrier',name:'携物目标',hp:this.missionHP()*3,waypoint:0});this.objective={kind:k,done:0,target:target?.id};}
  else if(k==='break'||k==='escape'){this.objective={kind:k,done:0,unlockAt:0,total:k==='break'?3:2,exit:{x:1130,y:410,r:75}};for(let j=0;j<this.objective.total;j++)this.spawn(23,{x:k==='break'?[340,900,640][j]:[480,850][j],y:k==='break'?[300,340,600][j]:[300,520][j],hp:this.missionHP(),mission:'rune',r:30,speed:0,runeIndex:j,name:'阵眼 '+(j+1),untargetable:j>0});if(e.variant===1)this.spawnRuneGuard();}
  if(this.chapter===0&&this.wave===0&&this.mode!=='training')for(let i=0;i<3;i++)this.spawn(4,{x:440+i*180,y:330,hp:12,...(nodeGrowth(this)?{introReward:true}:{})});
  if(this.mode==='training'&&this.options.guidedPractice)beginPracticeStep(this);
  if(k==='defend'&&!this.notices.has('defend-guide')){this.notices.add('defend-guide');this.cue('defend-guide','阵盘破碎会结束历练；集中处理威胁后，解除集火恢复分守','#ffe2a2',6);}
  this.toast(this.mode==='training'?'试剑台 · 持续练习，不结算节点；暂停可补满资源':e.name+' · '+e.goal);this.checkpoint();
 }
 clearField(){clearTouchLock(this,true);if(this.directorState)this.directorState.pendingType=null;this.enemies=[];this.shots=[];this.zones=[];this.drops=[];this.fx=[];this.hash.clear();for(const sw of this.swords){sw.target=null;sw.cool=.15;sw.returnReady=false;}}
 missionHP(){return [420,2100,6500,9000,15000,21000][this.chapter]*this.difficulty.hp;}
 spawn(type,opts={}){
  if(!this.isExpedition)return super.spawn(type,opts);if(mechanismPressure(this)&&!opts.mission&&!opts.boss&&(mechanismClearing(this)||ordinaryCount(this)>=mechanismLimit(this)))return null;if(finitePursuit(this)&&this.pursuitState&&!opts.mission&&!opts.boss&&(clearing(this)||ordinaryCount(this)>=ordinaryLimit(this)))return null;const e=super.spawn(type,opts);if(!e)return e;const base=ENEMIES[type]||ENEMIES[0],tier=[1,2.2,4.5,7,8.5,11][this.chapter]*(1+this.wave*.12),pressure=this.waveTime>=40?1.3:this.waveTime>=20?1.15:1;
  if(opts.hp===undefined)e.hp=e.maxHp=base.hp*tier*this.difficulty.hp*(e.elite?3:1)*pressure;
  e.speed=opts.speed??base.speed*(1+this.chapter*.035);e.dmg=opts.dmg??base.damage*enemyDamageScale(this)*this.difficulty.damage;
  if(this.objective?.kind==='defend'&&!e.boss&&defendLocked(this,e))e.focusObject=this.objective;return e;
 }
 spawnMarked(){const q=this.objective;if(!q||q.spawned>=3)return;const v=this.encounter.variant,type=CHAPTERS[this.chapter].enemies[(q.spawned+v)%CHAPTERS[this.chapter].enemies.length];const e=this.spawn(type,{elite:true,mission:'marked',hp:this.missionHP()*1.1,name:'围猎目标 '+(q.spawned+1)});if(e){q.spawned++;if(v===0){e.untargetable=true;for(let n=0;n<2;n++)this.spawn(CHAPTERS[this.chapter].enemies[0],{mission:'huntGuard',guarded:e.id});}if(v===2)this.spawn(14,{x:e.x+70,y:e.y+30});}}
 spawnRuneGuard(){const q=this.objective;if(!q)return;const e=this.spawn(CHAPTERS[this.chapter].enemies[0],{elite:true,mission:'runeGuard',hp:this.missionHP()*.35});q.guard=e?.id;}
 hitObjective(dmg,origin=null){const q=this.objective;if(!q||q.kind!=='defend'||q.invuln>0)return;const before=q.hp;q.hp=Math.max(this.practice?1:0,q.hp-dmg);recordHit(this,{...(origin||this.attackOrigin||{name:'阵盘来袭'}),kind:origin?.kind||'近身',target:'阵盘',hp:before-q.hp,remaining:q.hp,outcome:q.hp<=0?'defeated':'hurt'});q.invuln=.7;this.pulse(q.x,q.y,'#e19b7d',45);if(this.input.focus&&this.time>=(this.defendHintAt??-1)){this.defendHintAt=this.time+8;this.defendAlertUntil=this.time+3;this.cue('defend-alert',this.input.touchAim?'阵盘受袭 · 点右上角解除集火恢复分守':'阵盘受袭 · 松开左键可恢复分守','#ffe2a2',3);}if(q.hp<=0){this.toast('阵盘失守 · 本节点未完成');this.finish(false,'阵盘失守');}}
 update(dt){const revision=this.revision;super.update(dt);if(this.phaseCheckpointPending){this.phaseCheckpointPending=false;if(!this.finished&&this.revision===revision)this.checkpoint();}}
 // Encounter 8 only: while the live-enemy cap holds, a due elite keeps its timer moving so lifting the cap never pays the elite in the same frame; the next one arrives at least half an interval later.
 deferElite(){if(!clearingCheckpoint(this)||!latePressure(this))return;const profile=mechanismPressure(this)?mechanismProfile(this):null;this.nextElite=Math.max(this.nextElite,this.waveTime+(profile?.eliteInterval??35)/2);}
 updateDirector(dt){
  if(this.practice){updatePractice(this,dt);return;}
  if(this.mode==='training'){this.spawnBudget+=dt*7;while(this.spawnBudget>=1){this.spawnBudget--;const pool=this.enemyPool();this.spawn(pool[Math.floor(this.rng()*pool.length)]);}return;}
  updatePursuit(this);
  const k=this.encounter.kind,q=this.objective,p=this.player;
  if(k==='treasure'){const m=this.mechanism,stepSeconds=treasureStepSeconds(this);if(distance(p,m)<m.r){m.progress+=dt;if(Math.floor(m.progress/stepSeconds)>m.step&&m.progress<m.goal){m.step++;m.x=[430,850,640][m.step];m.y=[400,430,260][m.step];this.toast('敛息 '+m.step+' / 3 已成 · 前往下一阵位');this.cue('treasure-step','阵位 '+(m.step+1)+' / 3 · 顺着指引转移','#b8e8d0',3);}}if(m.progress>=m.goal){this.completeNode();return;}if(!mechanismPressure(this))return;}
  if(k==='illusion'){q.cool=Math.max(0,q.cool-dt);if(this.waveTime>=q.next&&q.cool===0){const at=q.gates.findIndex(g=>distance(p,g)<65);if(at>=0){if(this.options.encounterVersion>=7){q.returnProtectedUntil=this.time+.45;this.cue('illusion-return','落点保护 · 0.45秒','#a9e6ef',.45);}if(at===q.trueGate){q.done++;q.next=Math.max(q.next+10,this.waveTime+2);q.trueGate=illusionTrueGate(q);this.player.x=640;this.player.y=560;this.toast('神识辨真 · '+q.done+' / 3');this.cue('illusion-true','已辨真 '+q.done+' / 3 · 寻找下一道双环','#c7edd0',3);if(q.done===3){this.completeNode();return;}}else{q.cool=2;this.player.y=560;this.toast('虚妄之门 · 观察「真」字与双环');this.cue('illusion-false','此门为虚 · 已退回，观察真字与双环','#ecc3ac',2);}}}if(!mechanismPressure(this))return;}
  if(k==='ice'){q.r=Math.min(380,40+this.waveTime*8.5);if(distance(p,q)<q.r)this.hitPlayer((14+this.chapter*2)*this.difficulty.damage,true,{name:'乾蓝冰焰',x:q.x,y:q.y,kind:'险地'});if(this.waveTime>=FIXED_NODE_SECONDS.ice&&distance(p,q.exit)<q.exit.r){this.completeNode();return;}if(!mechanismPressure(this))return;}
  if(k==='defend'){q.invuln=Math.max(0,q.invuln-dt);if(this.encounter.variant===2){q.x=640+Math.sin(this.waveTime*.045)*220;q.y=360+Math.cos(this.waveTime*.045)*80;}if(this.waveTime>=FIXED_NODE_SECONDS.defend){this.completeNode();return;}}
  if(k==='hunt'&&this.encounter.variant===0)for(const e of this.enemies.filter(e=>e.mission==='marked'))e.untargetable=this.enemies.some(g=>g.hp>0&&g.guarded===e.id);
  if(k==='hunt'&&q.spawned<3&&this.waveTime>=q.spawned*18)this.spawnMarked();
  if(k==='escape'&&q.done>=q.total&&distance(p,q.exit)<q.exit.r){this.completeNode();return;}
  if(k==='break'||k==='escape')for(const e of this.enemies.filter(e=>e.mission==='rune'))e.untargetable=e.runeIndex!==q.done||this.waveTime<q.unlockAt||(this.encounter.variant===1&&this.enemies.some(e=>e.id===q.guard&&e.hp>0))||(this.encounter.variant===2&&this.waveTime%8<2);
  if(k==='survival'&&this.waveTime>=FIXED_NODE_SECONDS.survival){this.completeNode();return;}
  if(k==='swarm'){this.boss.timer=Math.max(0,FIXED_NODE_SECONDS.swarm-this.waveTime);this.boss.hp=this.boss.timer;if(this.waveTime>=FIXED_NODE_SECONDS.swarm){this.completeNode();return;}}
  if(this.modeState!=='battle'||this.finished)return;
  // Encounter 8: the first frame reinforcements stop saves once, like the waiting-node clearing checkpoint; the flag rides in objective so a restore neither re-times nor re-saves.
  if(mechanismClearing(this)){this.spawnBudget=0;if(this.directorState)this.directorState.pendingType=null;if(clearingCheckpoint(this)&&this.objective&&this.objective.clearingSaved===false){this.objective.clearingSaved=true;this.phaseCheckpointPending=true;this.toast('增援已止 · 完成机关目标后离开');}return;}
  if(mechanismPressure(this)&&ordinaryCount(this)>=mechanismLimit(this)){this.spawnBudget=Math.min(this.spawnBudget,5);this.deferElite();return;}
  if(clearing(this))return;
  if(finitePursuit(this)&&ordinaryCount(this)>=ordinaryLimit(this)){this.spawnBudget=Math.min(this.spawnBudget,5);this.deferElite();return;}
  const boss=['serpent','ghost','puppet','xuangu'].includes(k),profile=mechanismPressure(this)?mechanismProfile(this):null,rate=profile?profile.rates[k]:(boss?.8:k==='swarm'?6:2.7+this.chapter*.45)*(latePressure(this)&&!boss?1.35:1),pressure=profile?.flatPressure?1:this.waveTime>=40?1.3:this.waveTime>=20?1.15:1;
  if(k==='pursuit'&&this.encounter.variant===1&&this.waveTime>=(this.nextEscort??15)){this.spawn(CHAPTERS[this.chapter].enemies[0],{elite:true});this.nextEscort=(Math.floor(this.waveTime/15)+1)*15;}
  const limit=mechanismPressure(this)?mechanismLimit(this):boss?35:180;
  if(revisedDirector(this))budgetSpawns(this,rate*pressure*(this.encounter.risk?1.18:1),dt,limit,()=>{let opts={};const v=this.encounter.variant;if(k==='defend'&&v===0){const side=Math.floor(this.waveTime/10)%4;opts={x:[50,1230,640,640][side],y:[400,400,60,740][side]};}if(k==='defend'&&v===1)opts={x:Math.floor(this.waveTime/16)%2?70:1210,y:120+this.rng()*560};if(k==='survival'&&v===0)opts={x:this.rng()<.5?40:1240,y:100+this.rng()*600};if(k==='survival'&&v===2)opts={x:80,y:100+this.rng()*600};return opts;});
  else {this.spawnBudget+=dt*rate*pressure*(this.encounter.risk?1.18:1);
  while(this.spawnBudget>=1&&this.enemies.length<limit){const list=this.enemyPool(),type=k==='swarm'?(this.rng()<.7?6:21):list[Math.floor(this.rng()*list.length)],cost=Math.max(1,ENEMIES[type].cost);if(this.spawnBudget<cost)break;this.spawnBudget-=cost;let opts={};const v=this.encounter.variant;if(k==='defend'&&v===0){const side=Math.floor(this.waveTime/10)%4;opts={x:[50,1230,640,640][side],y:[400,400,60,740][side]};}if(k==='defend'&&v===1)opts={x:Math.floor(this.waveTime/16)%2?70:1210,y:120+this.rng()*560};if(k==='survival'&&v===0)opts={x:this.rng()<.5?40:1240,y:100+this.rng()*600};if(k==='survival'&&v===2)opts={x:80,y:100+this.rng()*600};const ranged=RANGED_ENEMIES;if(ranged.includes(ENEMIES[type].ai)&&this.enemies.filter(e=>ranged.includes(e.ai)).length>=Math.min(10,Math.max(3,this.enemies.length*.25)))this.spawn(list.find(i=>!ranged.includes(ENEMIES[i].ai))??list[0],opts);else this.spawn(type,opts);}
  }
  if(!boss&&this.waveTime>=this.nextElite){const profile=mechanismPressure(this)?mechanismProfile(this):null;this.nextElite=latePressure(this)?this.waveTime+(profile?.eliteInterval??35):this.nextElite+35;if(!profile||this.enemies.filter(e=>e.hp>0&&e.elite).length<profile.eliteLimit)this.spawn(CHAPTERS[this.chapter].enemies[this.chapter%CHAPTERS[this.chapter].enemies.length],{elite:true});}
 }
 updateEnemy(e,dt){if(this.practice?.step===2&&e.practiceAnchor)return;
  if(this.modeState!=='battle')return;
  if(e.mission==='rune'){tickSlow(e,dt);e.spawn-=dt;e.flash-=dt;if(e.burn>0){e.burn-=dt;e.burnTick-=dt;if(e.burnTick<=0){e.burnTick=.45;this.hit(e,(e.burnDamage||0)*.45,'fire',false,'burn');}}return;}
  if(e.mission==='carrier'){
   e.age+=dt;e.spawn-=dt;e.flash-=dt;e.stun-=dt;tickSlow(e,dt);if(e.burn>0){e.burn-=dt;this.hit(e,(e.burnDamage||0)*dt,'fire',false,'burn');}if(e.hp<=0||e.stun>0)return;
   const paths=[[[1000,220],[1050,600],[400,600],[400,220]],[[1050,220],[900,620],[300,520],[580,210]],[[980,260],[950,570],[430,570],[430,260]]],path=paths[this.encounter.variant],point=path[e.waypoint%path.length],dx=point[0]-e.x,dy=point[1]-e.y,d=Math.hypot(dx,dy)||1;e.a=Math.atan2(dy,dx);if(d<25)e.waypoint++;else{e.x+=dx/d*105*(1-e.slow)*dt;e.y+=dy/d*105*(1-e.slow)*dt;}return;
  }super.updateEnemy(e,dt);if(e.mission==='marked'&&e.hp<=0)this.recordMarked(e);
 }
 updateEnvironment(_dt){if(this.practice?.step===6||this.encounter.special)return;if(this.waveTime>=this.nextHazard){this.nextHazard+=this.chapter===2?7:11;const variant=this.encounter.variant;const x=variant===0?this.player.x:variant===1?400:880,y=variant===0?this.player.y:480;this.danger(x,y,55,(8+this.chapter*2)*this.difficulty.damage,1.3,1.3,this.chapter===2?'fire':'blast');}}
 kill(e){
  if(e.dead)return;if(e.boss)this.bossDefeat(e);const boss=e.boss,mission=e.mission,before=this.drops.length;e.boss=false;super.kill(e);e.boss=boss;
  if(nodeGrowth(this)){for(const d of this.drops.slice(before)){d.gold=0;if(d.value)allocateKillXP(this,e,d);else{d.xpBase=0;d.xpBonus=0;}if(this.chapter===0&&this.wave===0&&this.level<4)d.pull=true;}this.drops=this.drops.filter(d=>d.value>0||d.gold>0||d.heal>0);}
  else {const allowance=this.node.xp*.72,unit=this.node.xp/100*Math.max(1,e.cost)*(e.elite?3:1)*(this.level===1?3:1);for(const d of this.drops.slice(before)){d.gold=0;if(this.chapter===0&&this.wave===0&&this.level<4)d.pull=true;if(d.value){d.value=Math.max(0,Math.min(unit,allowance-this.nodeDropXP));this.nodeDropXP+=d.value;}}}
  if(mission==='marked'){this.recordMarked(e);if(this.modeState!=='battle')return;}
  if(mission==='carrier'){this.completeNode();return;}
  if(mission==='rune'){this.objective.done++;this.objective.unlockAt=this.waveTime+7;const progress=Math.min(this.node.xp*.1,this.node.xp*.72-this.nodeDropXP);if(progress>0){if(nodeGrowth(this))creditRuneXP(this,progress);else{this.nodeDropXP+=progress;this.addXP(progress);}}if(this.encounter.kind==='break'&&this.objective.done>=3){this.completeNode();return;}if(this.encounter.variant===1&&this.objective.done<this.objective.total)this.spawnRuneGuard();}
  if(boss){this.boss=null;this.completeNode();}
 }
 recordMarked(e){if(e.missionCounted||this.objective?.kind!=='hunt')return;e.missionCounted=true;this.objective.done++;if(this.objective.done>=3)this.completeNode();}
 endChapter(){if(this.isExpedition)this.completeNode();else super.endChapter();}
 completeNode(){
  if(this.modeState!=='battle'||this.receipts.includes(this.node.id)||this.mode==='training')return;
  this.collectAll();const n=this.node,earned=this.totalXP-this.nodeStartXP,bonus=this.encounter.risk&&this.contractMet()?Math.floor(n.xp*.08):0;if(nodeGrowth(this))settleGrowthNode(this,bonus);else this.addXP(Math.max(0,n.xp-earned)+bonus);this.receipts.push(n.id);if(this.encounter.kind==='treasure')this.storyInventory=[...new Set([...(this.storyInventory||[]),'five-rings','cape'])];
  const cashReserve=Math.min(10,Math.floor(n.gold*.25)),riskGold=this.encounter.risk?Math.floor(EXPEDITIONS[this.chapter].gold.reduce((a,b)=>a+b,0)*.25/EXPEDITIONS[this.chapter].forks.length):0;
  this.gold+=n.gold-cashReserve+riskGold;this.clearField();this.boss=null;this.mechanism=null;this.objective=null;
  const ch=EXPEDITIONS[this.chapter],last=this.wave===ch.xp.length-1;if(last)appendChapterSplit(this);if(last&&this.chapter===5)completeRecordLoop(this);
  const reserveGain=reserveRestoration(this);this.player.reserve+=reserveGain;
  if(last){if(this.chapter!==3&&['story','seed'].includes(this.mode))this.research+=this.chapter===5?2:1;this.emit({type:'chapter',chapter:this.chapter});if(this.chapter===3){this.grantStoryItems();this.storyInventory=[...new Set([...(this.storyInventory||[]),'five-rings','cape'])];}}
  const ending=endingCleanup(this);if(ending)this.gold+=cashReserve;
  this.rest={selectionMode:'draft',...(ending?{ending:true}:{}),eventApplied:ending,coreApplied:false,coreSelection:null,node:n.id,last,event:ending?null:this.makeEvent(),eventDone:ending,cashReserve,...(cashOptionsFor(this,cashReserve)?{cashOptions:cashOptionsFor(this,cashReserve)}:{}),bonus,riskGold,xp:n.xp,coreOffers:last&&[0,2].includes(this.chapter)?this.makeCoreOffers():[],coreDone:!last||![0,2].includes(this.chapter),shop:(!last&&this.wave===1&&this.chapter!==3),routeDone:last||this.routes[this.chapter][this.wave+1].selected!==null};
  if(nodeGrowth(this))this.rest.growthReward={base:n.xp,performance:growthPerformance(this.growth.ledger),contract:bonus,total:n.xp+growthPerformance(this.growth.ledger)+bonus};
  this.rest.reserveGain=reserveGain;this.shopRolls=0;this.purchased=[];if(this.rest.shop)this.makeShop();this.showScene('intermission');
  if(last&&this.chapter===0&&!this.cinematicSeen.includes('ruins'))this.playCinematic('ruins');
  if(last&&this.chapter===2&&!this.cinematicSeen.includes('yuanyao')){this.storyInventory=[...new Set([...(this.storyInventory||[]),'weeping'])];this.playCinematic('yuanyao');}
  this.checkpoint();if(this.options.studyVersion===1&&last&&this.chapter===1)this.finish(false,'前两章对照体验完成');
 }
 contractMet(){const c=this.encounter.contract||'hits';return c==='hits'?this.hitCount-this.nodeStartHits<=5:c==='thunder'?this.thunders===this.nodeStartThunder:this.waveTime<=70;}
 contractText(e=this.encounter){return {hits:'受击不超过 5 次',thunder:'本节点不施放神雷',time:'70 秒内完成'}[e.contract||'hits'];}
 makeEvent(){const id=this.node.id;const c=this.chains.find(c=>(c.start===id&&c.state==='waiting')||(c.end===id&&c.state==='active'));if(c)return {type:'chain',id:c.chain,stage:c.start===id?'start':'end',choice:null};const pool=revisedStory(this)?eligibleEvents(this):EVENTS;return {type:'single',index:pool[Math.floor(this.contentRng()*pool.length)].id,choice:null};}
 eventText(){const e=this.rest?.event;if(!e)return null;if(e.type==='chain'){const c=CHAINS.find(c=>c.id===e.id);return {name:c.name+(e.stage==='start'?' · 留下线索':' · 前因后果'),desc:e.stage==='start'?c.start:c.finish,choices:e.stage==='start'?[c.choices[0]+'：下次收获侧重休整',c.choices[1]+'：下次收获侧重灵石','不介入：本次领取 '+this.rest.cashReserve+' 灵石']:[c.ends[0]+'：'+this.chainBenefit(c.id),c.ends[1]+'：领取 '+this.rest.cashReserve+' 灵石']};}
  const old=revisedStory(this)?{...EVENTS[e.index],...chapterEventText(this,e.index)}:EVENTS[e.index];return {name:old.name,desc:old.desc+' 本次收益占用节点预留份额。',choices:old.choices.map(c=>c.name+'：'+this.singleEffectText(c.effect))};

 }
 singleEffectText(effect){const gold=cashRewardFor(this.rest,'gold'),p=this.player,n=v=>Number(v.toFixed(1));return {xp:'参悟心得，获得 1 次悟道重选',riskTrait:'舍去 12% 当前生命，获得 2 次悟道重选',shield:'获得 20 额外护盾',gold:'领取 '+gold+' 灵石',smallGold:'领取 '+gold+' 灵石',riskGold:'舍去 8% 当前生命，另恢复 25 灵力并领取 '+cashRewardFor(this.rest,'riskGold')+' 灵石',heal:'恢复 18% 最大生命（当前可恢复 '+n(Math.min(p.maxHp-p.hp,p.maxHp*.18))+' 生命）',mana:'恢复 40 灵力，不补雷源（当前可恢复 '+n(Math.min(100-p.mana,40))+' 灵力）',reroll:'获得 1 次悟道重选',escape:'恢复遁步并获得 15 额外护盾',riskRelic:'舍去 10% 当前生命，获得 1 次悟道重选与 25 灵力',buyHeal:'支付 25 灵石，恢复 45% 最大生命（当前可恢复 '+n(Math.min(p.maxHp-p.hp,p.maxHp*.45))+' 生命）',buyGuard:'支付 15 灵石，取得金光符（需药囊空位）',medicine:'取得回元药包（需药囊空位）',sparePuppet:'取得备用傀儡（需药囊空位）',fireItem:'取得火球符（需药囊空位）',insectItem:'取得灵虫诱饵（需药囊空位）',magnetItem:'取得收摄符（需药囊空位）',skip:cashRewardFor(this.rest,'skip')>0?'整理预留物资，领取 '+cashRewardFor(this.rest,'skip')+' 灵石':'不作停留'}[effect]||'继续前行';}
 applySingle(effect){const p=this.player,items={medicine:'heal',sparePuppet:'puppet',fireItem:'fire',insectItem:'insect',magnetItem:'magnet',buyGuard:'guard'};
  if((effect==='buyHeal'&&this.gold<25)||(effect==='buyGuard'&&this.gold<15)){this.toast('灵石不足');return false;}
  if(items[effect]&&!this.addConsumable(items[effect])){this.toast('药囊已满，可选择另一项收获');return false;}
  if(['gold','smallGold','riskGold','skip'].includes(effect))this.gold+=cashRewardFor(this.rest,effect);
  if(['xp','reroll','riskRelic'].includes(effect))this.rerolls++;
  if(effect==='riskTrait'){p.hp=Math.max(1,p.hp*.88);this.rerolls+=2;}
  if(effect==='riskGold'){p.hp=Math.max(1,p.hp*.92);p.mana=Math.min(100,p.mana+25);}
  if(effect==='riskRelic'){p.hp=Math.max(1,p.hp*.9);p.mana=Math.min(100,p.mana+25);}
  if(effect==='shield')p.shield+=20;
  if(effect==='heal')p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.18);
  if(effect==='mana')p.mana=Math.min(100,p.mana+40);
  if(effect==='escape'){p.dashCD=0;p.shield+=15;}
  if(effect==='buyHeal'){this.gold-=25;p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.45);}
  if(effect==='buyGuard')this.gold-=15;return true;
 }
 chainBenefit(id){const n=Number(id.split('-')[1]),factor=this.chains.find(c=>c.chain===id)?.choice===0?1:.8,p=this.player;const value=[1,6].includes(n)?shieldReward(p,30*factor,30):[2,7].includes(n)?Math.min(100-p.mana,50*factor):Math.min(p.maxHp-p.hp,p.maxHp*([.22,0,0,.2,.22,.25][n]||.2)*factor);return '当前可恢复 '+Number(value.toFixed(1))+([1,6].includes(n)?' 护盾（可补至常规上限 +30 额外护盾，保留已有额外护盾）':[2,7].includes(n)?' 灵力':' 生命');}
 chooseInteraction(index){const rest=this.rest;if(this.scene!=='intermission'||!rest||(rest.selectionMode==='draft'?rest.eventApplied:rest.eventDone)||!Number.isInteger(index)||index<0||index>=this.eventText().choices.length)return false;const e=rest.event,p=this.player;
  if(rest.selectionMode==='draft'){if(!this.canSelectInteraction(index))return false;rest.eventDone=true;e.choice=index;this.checkpoint();if(this.interactionReadiness(index).noBenefit)this.toast('已暂选 · 当前已满，无恢复收益；出发前可改选');return true;}
  if(e.type==='single'){if(!this.applySingle(EVENTS[e.index].choices[index].effect))return false;}
  else{const c=this.chains.find(c=>c.chain===e.id);if(e.stage==='start'){c.state=index===2?'declined':'active';c.choice=index;if(index===2)this.gold+=rest.cashReserve;else if(index===0)p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.08);else p.mana=Math.min(100,p.mana+15);}else{c.state='done';if(index===1)this.gold+=Math.floor(rest.cashReserve*(c.choice===1?1:.8));else{const id=Number(c.chain.split('-')[1]),factor=c.choice===0?1:0.8;if([1,6].includes(id))p.shield+=shieldReward(p,30*factor,30);else if([2,7].includes(id))p.mana=Math.min(100,p.mana+50*factor);else p.hp=Math.min(p.maxHp,p.hp+p.maxHp*([.22,0,0,.2,.22,.25][id]||.2)*factor);}}}
  rest.eventDone=true;e.choice=index;this.checkpoint();return true;
 }
 chooseRoute(index){const next=this.routes[this.chapter][this.wave+1];if(this.scene!=='intermission'||!this.rest||!next||!Number.isInteger(index)||!next.choices[index])return false;next.selected=index;this.rest.routeDone=true;this.checkpoint();return true;}
 interactionReadiness(index){
  const e=this.rest?.event;if(!e)return {blocked:true,reason:'没有待选机缘',noBenefit:false};
  if(e.type!=='single')return {blocked:false,reason:'',noBenefit:/当前可恢复 0 /.test(this.eventText().choices[index]||'')};
  const effect=EVENTS[e.index].choices[index]?.effect,items={medicine:'heal',sparePuppet:'puppet',fireItem:'fire',insectItem:'insect',magnetItem:'magnet',buyGuard:'guard'},price=effect==='buyHeal'?25:effect==='buyGuard'?15:0,id=items[effect];
  const reason=this.gold<price?'还缺 '+(price-this.gold)+' 灵石':id&&!this.consumables.some(c=>c.id===id||c.count<=0)&&this.consumables.length>=2?'药囊已满，需空位或同类物资可叠加':'';
  const noBenefit=['heal','buyHeal'].includes(effect)?this.player.hp>=this.player.maxHp:effect==='mana'?this.player.mana>=100:false;
  return {blocked:!!reason,reason,noBenefit};
 }
 restReadiness(){const r=this.rest;if(!r)return {event:false,core:false,route:false,ready:false,eventReason:''};const selected=r.eventDone&&(!r.event||r.eventApplied||!this.interactionReadiness(r.event.choice).blocked),reason=r.eventDone&&r.event&&!r.eventApplied&&!selected?this.interactionReadiness(r.event.choice).reason:'';return {event:!!selected,core:!!r.coreDone,route:!!r.routeDone,ready:!!selected&&!!r.coreDone&&!!r.routeDone,eventReason:reason};}
 canSelectInteraction(index){const state=this.interactionReadiness(index);if(state.blocked){this.toast(state.reason+'；可调整行囊或改选机缘');return false;}return true;}
 coreReplacement(id,replace=-1){const c=CORES.find(c=>c.id===id);if(!c||!this.rest?.coreOffers.includes(id)||!coreEligible(c,this)||this.relics.includes(id))return false;
  const existing=this.relics.findIndex(id=>CORES.some(x=>x.id===id&&x.path===c.path));if(existing>=0)replace=existing;
  if(this.relics.filter(id=>CORES.some(c=>c.id===id)).length>=2&&(replace<0||!CORES.some(c=>c.id===this.relics[replace])))return 'coreSlots';
  if(this.relics.length>=6&&replace<0)return 'replace';if(!Number.isInteger(replace)||replace>=this.relics.length||replace< -1)return false;return {id,replaceId:this.relics[replace]||null};
 }
 selectCore(id,replace=-1){if(this.scene!=='intermission'||this.rest?.coreApplied)return false;const result=this.coreReplacement(id,replace);if(!result||typeof result==='string')return result;this.rest.coreSelection=result;this.rest.coreDone=true;this.checkpoint();return true;}
 commitRestSelections(){
  if(this.rest?.selectionMode!=='draft')return true;
  // Apply to an isolated copy so a failed price/slot check cannot partially grant a reward.
  const candidate=Expedition.restore(copy(this.serialize()),()=>{}),r=candidate.rest;r.selectionMode='applying';
  if(!r.eventApplied&&r.event){r.eventDone=false;if(!candidate.chooseInteraction(r.event.choice)){this.toast(candidate.toastText||'请重新选择可领取的机缘');return false;}r.eventApplied=true;}
  if(!r.coreApplied&&r.coreOffers.length){const choice=r.coreSelection;if(!choice){this.toast('请先选择核心或暂不装配');return false;}r.coreDone=false;if(choice.id===null)candidate.skipCore();else{const slot=choice.replaceId?candidate.relics.indexOf(choice.replaceId):-1;if(choice.replaceId&&slot<0){this.toast('原替换位置已变化，请重新选择核心位置');return false;}const result=candidate.equipCore(choice.id,slot);if(result!==true){this.toast('核心条件或位置已变化，请重新选择核心');return false;}}r.coreApplied=true;}
  const changes=[];for(const [key,label] of [['gold','灵石'],['rerolls','悟道重选']]){const delta=candidate[key]-this[key];if(delta)changes.push(label+' '+(delta>0?'+':'')+delta);}for(const [key,label] of [['hp','生命'],['shield','护盾'],['mana','灵力']]){const delta=candidate.player[key]-this.player[key];if(Math.abs(delta)>.001)changes.push(label+' '+(delta>0?'+':'')+Number(delta.toFixed(1)));}for(const slot of candidate.consumables){const delta=slot.count-(this.consumables.find(c=>c.id===slot.id)?.count||0);if(delta>0)changes.push((CONSUMABLES.find(c=>c.id===slot.id)?.name||slot.id)+' +'+delta);}this.restResultText='机缘与核心已提交 · '+(changes.join('、')||'已按选择处理；当前资源无额外变化');r.selectionMode='committed';for(const key of ['gold','rerolls','consumables','relics','paidPrices','chains','player','stats','pathCounts','comboSet','combos','rest'])this[key]=candidate[key];return true;
 }
 supplyReadiness(type='hp'){return supplyState(this,type);}
 supplyQuote(type='hp'){
  const state=supplyState(this,type),snapshot=this.serialize(),quote={...state,snapshot:JSON.stringify(snapshot),retainedGain:null,projectionNote:'',draftImpact:''};
  if(!state.ready)return quote;
  if(!this.restReadiness().ready){quote.projectionNote='请先暂选机缘、核心和路线，才能计算出发时的保留增量；当前仅显示即时恢复。';return quote;}
  try{const project=paid=>{const c=Expedition.restore(copy(snapshot),()=>{});if(paid)buySupply(c,type,state.price);const invalid=c.restReadiness().eventReason;if(invalid)return {invalid};if(!c.commitRestSelections())return {invalid:'当前暂选尚不能提交'};if(c.rest.last&&c.chapter<5)c.nextChapter();return {value:c.player[type]};};const without=project(false),withSupply=project(true);
   if(withSupply.invalid)quote.draftImpact='付款后原暂选「'+(this.eventText()?.name||'机缘')+'」不可提交：'+withSupply.invalid+'；出发前需重新改选。';
   else if(without.invalid)quote.projectionNote='当前暂选尚不能提交，暂不能计算保留增量。';
   else{quote.retainedGain=Math.max(0,withSupply.value-without.value);quote.projectionNote='按当前暂选与保证的换章回复计算；后续悟道与战斗未计。';}
  }catch{quote.projectionNote='暂不能准确计算出发时增量；当前仅显示即时恢复，请核对暂选与换章回复。';}
  return quote;
 }
 buySupply(type,quote){if(!quote||quote.type!==type||quote.price!==supplyState(this,type).price||quote.snapshot!==JSON.stringify(this.serialize())){this.toast('补养报价已变化 · 请重新查看本次恢复与机缘');this.emit({type:'update'});return false;}return buySupply(this,type,quote.price);}

 makeCoreOffers(){if(revisedEconomy(this))return variedCoreOffers(this);const eligible=CORES.filter(c=>coreEligible(c,this)&&!this.relics.includes(c.id));const preferred=eligible.filter(c=>c.path===this.path),rest=eligible.filter(c=>c.path!==this.path);const result=preferred.slice(0,2);while(result.length<3&&rest.length)result.push(rest.splice(Math.floor(this.contentRng()*rest.length),1)[0]);return result.map(c=>c.id);}
 equipCore(id,replace=-1){if(this.rest?.selectionMode==='draft'&&!this.rest.coreApplied)return this.selectCore(id,replace);const c=CORES.find(c=>c.id===id);if(this.scene!=='intermission'||!this.rest?.coreOffers.includes(id)||this.rest.coreDone||!coreEligible(c,this))return false;const existing=this.relics.findIndex(id=>CORES.some(x=>x.id===id&&x.path===c.path));if(existing>=0)replace=existing;const count=this.relics.filter(id=>CORES.some(c=>c.id===id)).length;
  if(count>=2&&(replace<0||!CORES.some(c=>c.id===this.relics[replace])))return 'coreSlots';if(this.relics.length>=6&&replace<0)return 'replace';if(replace>=this.relics.length||replace< -1)return false;
  const hp=this.player.hp/this.player.maxHp,shield=this.player.shield;if(replace>=0){delete this.paidPrices[this.relics[replace]];this.relics.splice(replace,1);}this.relics.push(id);this.recalc();this.player.hp=this.player.maxHp*hp;this.player.shield=shield;this.rest.coreDone=true;this.checkpoint();return true;
 }
 skipCore(){if(this.scene==='intermission'&&this.rest?.selectionMode==='draft'&&!this.rest.coreApplied){this.rest.coreDone=true;this.rest.coreSelection={id:null,replaceId:null};this.checkpoint();return;}if(this.scene!=='intermission'||!this.rest||this.rest.coreDone)return;this.rest.coreDone=true;this.rerolls++;this.checkpoint();}
 continueRest(){if(this.options.studyVersion===1&&this.receipts.includes(this.routes[1].at(-1).id)){this.finish(false,'前两章对照体验完成');return;}if(this.scene!=='intermission'||!this.rest)return;if(!this.restReadiness().ready){const state=this.restReadiness();this.toast(state.eventReason?'暂选机缘已失效：'+state.eventReason+'，请重新选择机缘':'请处理机缘、核心与下一步路线');return;}if(this.queuedChoices){this.choiceReturn='intermission';this.openChoices();return;}
  if(!this.commitRestSelections())return;
  const result=this.restResultText;this.restResultText=null;if(this.rest.preparation){this.rest=null;this.showScene('intro','intro');this.checkpoint();}else if(this.rest.last)this.nextChapter();else{this.wave++;this.start();}if(result)this.toast(result);
 }
 nextChapter(){if(this.chapter>=5){if(this.mode==='endless'){this.chapter=0;this.wave=0;this.endlessLoop=(this.endlessLoop||0)+1;prepareChallenge(this);this.receipts=[];if(this.growth)this.growth.settlements=[];this.cinematicSeen=[];this.routes.forEach(ch=>ch.forEach(n=>n.selected=n.choices.length===1?0:null));const scale=loopScale(this);this.difficulty={...this.difficulty,hp:this.difficulty.hp*scale.hp,damage:this.difficulty.damage*scale.dmg};}else{this.playCinematic('ending','finish');return;}}else{this.chapter++;this.wave=0;}
  this.rest=null;if(this.growth)this.growth.ledger=null;this.directorState=null;this.pursuitState=null;this.player.hp=Math.min(this.player.maxHp,this.player.hp+this.player.maxHp*.3);this.player.reserve=this.player.maxReserve;this.player.revived=false;this.grantStoryItems();if(this.chapter===3){this.rest={selectionMode:'draft',eventApplied:true,coreApplied:true,coreSelection:null,preparation:true,node:'3:prep',last:false,event:null,eventDone:true,cashReserve:0,bonus:0,riskGold:0,xp:0,coreOffers:[],coreDone:true,shop:true,routeDone:true};this.shopRolls=0;this.purchased=[];this.makeShop();this.showScene('intermission');}else this.showScene('intro','intro');this.checkpoint();
 }
 traitChoices(){return revisedGrowth(this)?growthChoices(this):super.traitChoices();}
 finishEmptyChoices(){this.queuedChoices=0;const target=this.choiceReturn;this.choiceReturn=null;this.showScene(target||null,target?'rest':'battle');this.toast('当前可用强化已修满 · 继续历练');}
 openChoices(){super.openChoices();if(revisedGrowth(this)){this.growth.firstOfferUsed=true;if(!this.choices.length)this.finishEmptyChoices();}this.checkpoint();}
 collectDrop(d){if(nodeGrowth(this))creditGrowthDrop(this,d);else super.collectDrop(d);}
 collectAll(){if(!nodeGrowth(this)){super.collectAll();return;}for(const d of this.drops)this.collectDrop(d);this.drops=[];}
 mergeDrops(extra){if(!nodeGrowth(this))return super.mergeDrops(extra);return {...extra[0],done:false,value:extra.reduce((s,d)=>s+d.value,0),gold:extra.reduce((s,d)=>s+d.gold,0),heal:extra.reduce((s,d)=>s+(d.heal||0),0),xpBase:extra.reduce((s,d)=>s+(d.xpBase||0),0),xpBonus:extra.reduce((s,d)=>s+(d.xpBonus||0),0)};}
 chooseTrait(id){const was=this.modeState;if(was!=='choice')return;const t=this.choices.find(t=>t.id===id);if(t&&(this.traits[id]||0)<t.max)this.lastChoice={id,rank:(this.traits[id]||0)+1};super.chooseTrait(id);if(this.modeState==='battle'&&this.choiceReturn){const scene=this.choiceReturn;this.choiceReturn=null;this.showScene(scene);}this.checkpoint();}
 reroll(){const before=this.rerolls;super.reroll();if(revisedGrowth(this)&&this.modeState==='choice'&&!this.choices.length){this.rerolls=before;this.finishEmptyChoices();}this.checkpoint();}
 rerollPurchaseReadiness(){return rerollPurchaseReadiness(this);}
 buyReroll(quotedPrice){return buyReroll(this,quotedPrice);}
 makeShop(){super.makeShop();this.shop=this.shop.map((r,i)=>({...r,price:r.kind==='consumable'?clamp(r.price,25,45):35+this.chapter*11+(i%3)*10}));}
 buy(index,replace=-1){const p=this.player,hp=p.hp/p.maxHp,shield=p.shield,r=this.shop?.[index],replaced=r?.kind==='relic'&&this.relics.length>=6?this.relics[replace]:null;const result=super.buy(index,replace);if(result===true){if(replaced)delete this.paidPrices[replaced];this.paidPrices[r.id]=r.price;p.hp=p.maxHp*hp;p.shield=shield;this.checkpoint();}return result;}
 sell(index){if(this.modeState!=='rest'||!Number.isInteger(index)||!this.relics[index])return;const id=this.relics[index],p=this.player,hp=p.hp/p.maxHp,shield=p.shield;this.relics.splice(index,1);this.gold+=Math.floor((this.paidPrices[id]||0)*.4);delete this.paidPrices[id];this.recalc();p.hp=p.maxHp*hp;p.shield=shield;this.checkpoint();}
 refreshShop(){const ok=super.refreshShop();if(ok)this.checkpoint();return ok;}
 toggleLock(i){super.toggleLock(i);this.checkpoint();}
 recalc(){super.recalc();if(!this.player)return;const factor=this.hasCore('K11')?.85:this.hasCore('K12')?.75:1;this.player.maxShield=(this.stats.shield||0)*factor;this.player.shield=Math.max(0,this.player.shield);}
 orbitMultiplier(){return this.hasCore('K02')?1.4:1;}
 swordDamage(e){return super.swordDamage(e)*(this.hasCore('K01')?.9:this.hasCore('K02')?.88:1);}
 onSwordLaunch(sw){sw.returnReady=true;}
 onSwordReturn(sw,arrived){
  if(!this.hasCore('K01')||!sw.returnReady)return;
  const target=this.near(sw.x,sw.y,60).find(e=>!(e.phaseShield>0)&&segmentDistance(e,{x:sw.px,y:sw.py},sw)<e.r+8);
  if(target){const hp=target.hp;this.hit(target,super.swordDamage(target)*.35,'return',false);if(target.hp<hp)sw.returnReady=false;}
  if(arrived)sw.returnReady=false;
 }
 extraThunderCost(){return this.hasCore('K03')?3:0;}
 thunderMultiplier(e){return this.hasCore('K04')?(e.id===this.mainThunderTarget?1.3:.8):1;}
 onThunderCast(){if(this.hasCore('K03')){this.coreArcs=10;this.coreArcUntil=this.time+8;}}
 thunder(){if(challengeBlocks(this,'thunder')){this.toast('本圈挑战：普通节点节雷；首领与三机关可用');return false;}this.mainThunderTarget=this.enemies.filter(e=>e.hp>0&&!e.untargetable).sort((a,b)=>distance(a,this.input.aim||this.player)-distance(b,this.input.aim||this.player))[0]?.id;return super.thunder();}
 hit(e,d,source='sword',crit=true,fireKind='other'){if(source==='insect'){if(this.hasCore('K07')&&(this.stats.insects||0)>=4)d*=.88;if(this.hasCore('K08'))d*=e?.elite||e?.boss?1.3:.8;}const hp=e?.hp,result=super.hit(e,d,source,crit,fireKind);if(source==='sword'&&this.hasCore('K03')&&this.coreArcs>0&&this.coreArcUntil>this.time&&e&&hp>e.hp){const next=this.near(e.x,e.y,150).find(x=>x.id!==e.id&&!x.untargetable&&!(x.phaseShield>0));if(next){const before=next.hp;super.hit(next,super.swordDamage(next)*.3,'arc',false);if(next.hp<before){this.coreArcs--;this.fx.push({kind:'line',x:e.x,y:e.y,tx:next.x,ty:next.y,color:'#ffe29c',ttl:.25,max:.25});}}}return result;}
 puppetDamageMultiplier(){return this.hasCore('K05')?.85:this.hasCore('K06')?.9:1;}
 puppetHasteBonus(){if(this.hasCore('K06'))return this.player.moving?.35:0;return this.path===2&&puppetReady(this)?.25:0;}
 onPuppetShot(a,e,dmg){if(!this.hasCore('K05')||this.puppets.length<2||!puppetReady(this))return;a.coreShots=(a.coreShots||0)+1;if(a.coreShots%2===0){const ang=Math.atan2(e.y-a.y,e.x-a.x);for(const off of [-.16,.16])this.shoot(a.x,a.y,ang+off,dmg,520,true,{color:'#ddd6a0',pierce:0});}}
 allyTarget(x,y,r,meta={}){
  if(meta.kind!=='insect'||(!this.hasCore('K07')&&!this.hasCore('K08'))||(this.hasCore('K07')&&(this.stats.insects||0)<4))return super.allyTarget(x,y,r);
  const group=this.hasCore('K08')?0:meta.index%2,key='bug'+group,old=this.targetCache?.[key];if(old&&old.until>this.time){const e=this.enemies.find(e=>e.id===old.id&&e.hp>0&&!e.untargetable);if(e&&distance(e,this.player)<440*(1+(this.stats.metaInsectRange||0)))return e;}
  const list=this.near(this.player.x,this.player.y,400*(1+(this.stats.metaInsectRange||0))).sort((a,b)=>(this.hasCore('K08')?Number(!!(b.boss||b.elite))-Number(!!(a.boss||a.elite)):0)||distance(a,this.input.focus&&this.input.aim?this.input.aim:this.player)-distance(b,this.input.focus&&this.input.aim?this.input.aim:this.player));const target=list[this.hasCore('K08')?0:Math.min(group,list.length-1)];if(target)this.targetCache[key]={id:target.id,until:this.time+1.4};return target;
 }
 movementBonus(){return (this.hasCore('K12')&&this.player.shield>0?.12:0)+(this.player.buffs.metaGuardSwift>this.time?.12:0);}
 dash(){const before=this.zones.length,light=this.hasCore('K12')&&this.player.shield>=5,ok=super.dash();if(!ok)return false;if(light){this.player.shield-=5;this.player.dashCD*=.85;}const sigil=this.zones.slice(before).find(z=>z.sigil);if(sigil){sigil.originalDamage=sigil.damage;if(this.hasCore('K09')){sigil.damage*=.8;sigil.ember=true;}if(this.hasCore('K10')){delete sigil.arming;sigil.damage*=.7;const first=this.zones.find(z=>z!==sigil&&z.twin&&!z.fired&&!z.pair);sigil.twin=true;if(first){const pair=++this.corePair;first.warn=sigil.warn=sigilPairFuse(this);first.fuseDuration=sigil.fuseDuration=sigilPairFuse(this);first.ttl=sigil.ttl=sigilPairFuse(this)+.3;first.pair=sigil.pair=pair;sigil.line={x:first.x,y:first.y,damage:sigil.originalDamage};}else{sigil.warn=8;sigil.fuseDuration=8;sigil.ttl=8.3;}}}return true;}
 onSigilDetonate(z){if(this.stats.metaSigilEcho&&!z.twin&&!z.metaEcho)this.zones.push({x:z.x,y:z.y,r:z.r*.8,ttl:.7,warn:.4,fuseDuration:.4,kind:'sigil',friendly:true,sigil:true,metaEcho:true,damage:z.damage*.25});if(z.ember)this.zones.push({x:z.x,y:z.y,r:z.r,ttl:3,warn:0,kind:'fire',friendly:true,fireKind:'ember',slow:.3,damage:z.originalDamage*.1});if(z.line){const from=z.line,d=distance(from,z)||1,to={x:from.x+(z.x-from.x)/d*Math.min(360,d),y:from.y+(z.y-from.y)/d*Math.min(360,d)};for(const e of this.enemies){if(this.modeState!=='battle')break;if(e.hp>0&&segmentDistance(e,from,to)<e.r+20)this.hit(e,from.damage,'fire',false,'line');}this.fx.push({kind:'line',x:from.x,y:from.y,tx:to.x,ty:to.y,color:'#f6a564',ttl:.6,max:.6});}}
 consume(index){if(challengeBlocks(this,'items')){this.toast('本圈挑战：普通节点惜物；首领与三机关可用');return false;}if(this.modeState!=='battle')return false;const state=this.itemReadiness(index),slot=this.consumables[index];if(state.bonus){if(state.blocked){this.toast(state.reason);return false;}slot.bonusHeal--;this.player.hp+=state.gain;this.toast('洞府加赠回元药包 · 恢复 '+Number(state.gain.toFixed(1))+' 生命');this.emit({type:'sound',name:'item'});return true;}return super.consume(index);}
 hitPlayer(d,hazard=false,origin=null){if(this.options.encounterVersion>=7&&this.objective?.kind==='illusion'&&this.time<this.objective.returnProtectedUntil)return;const before=this.player.shield,hits=this.hitCount;super.hitPlayer(d,hazard,origin);if(this.finished||this.modeState!=='battle'||!this.hasCore('K11')||this.hitCount===hits)return;this.shieldAbsorbed+=Math.max(0,before-this.player.shield);if(before>0&&this.player.shield<=0&&this.shieldAbsorbed>=10&&this.time-this.lastShieldBreak>=8){this.lastShieldBreak=this.time;this.shieldAbsorbed=0;this.explode(this.player.x,this.player.y,150,35+this.level*.6,'guard');for(const e of this.near(this.player.x,this.player.y,150)){if(e.boss||e.mission==='rune')continue;const d=distance(e,this.player)||1;e.x=clamp(e.x+(e.x-this.player.x)/d*90,30,1250);e.y=clamp(e.y+(e.y-this.player.y)/d*90,40,770);}}}
 objectiveText(){const text=this.baseObjectiveText();if(mechanismPressure(this))return text+(mechanismClearing(this)?' · 增援已止':' · 增援剩余 '+Math.max(0,Math.ceil(mechanismDeadline(this)-this.waveTime))+'秒');return finitePursuit(this)&&this.pursuitState?text+(clearing(this)?' · 追兵已尽': ' · 追兵 '+Math.max(0,Math.ceil(this.pursuitState.deadline-this.waveTime))+'秒'):text;}
 baseObjectiveText(){if(this.mode==='training')return '持续练习 · 不结算节点';const e=this.encounter,q=this.objective,k=e.kind;if(k==='defend')return '阵盘 '+Math.ceil(q?.hp||0)+' / '+(q?.maxHp||0)+' · '+Math.min(65,Math.floor(this.waveTime))+'/65 秒';if(['hunt','break','escape'].includes(k))return '目标 '+(q?.done||0)+' / '+(q?.total||3)+(k==='escape'?' · 解锁后抵达出口':'');if(k==='treasure')return '敛息 '+Math.floor(this.mechanism?.progress||0)+' / '+(this.mechanism?.goal||treasureStepSeconds(this)*3)+' 秒 · 阵位 '+((this.mechanism?.step||0)+1)+' / 3';if(k==='illusion')return '辨真 '+(q?.done||0)+' / 3 · '+(this.waveTime>=(q?.next||0)?'出口已开启':'观察阵纹');if(k==='ice')return Math.min(40,Math.floor(this.waveTime))+' / 40 秒 · '+(this.waveTime>=40?'前往右侧退路':'避开中央冰焰');if(k==='pursuit')return '集火携物目标 · 路线可截击';return e.special?e.goal:Math.min(65,Math.floor(this.waveTime))+' / 65 秒';}
 summary(){return {...super.summary(),recordDetails:recordDetails(this),difficulty:this.options.difficulty??0,seen:[...this.seen],rulesVersion:3,runId:this.runId,research:this.research,nodes:this.receipts.length,cores:this.relics.filter(id=>CORES.some(c=>c.id===id)),chains:this.chains.filter(c=>c.state==='done').map(c=>c.chain)};}
 serialize(){const base=super.serialize();if(!this.isExpedition)return base;return {...base,expedition:{schema:1,...(segmented(this)?{chapterSplits:copy(this.chapterSplits)}:{}),...(challenged(this)?{challenges:copy(this.challenges)}:{}),...(this.lastChoice?{lastChoice:copy(this.lastChoice)}:{}),...(plannedRoutes(this)?{routePlan:serializeRoutePlan(this)}:{}),...(persistentStory(this)?{cinematicHistory:[...new Set([...this.cinematicHistory,...this.cinematicSeen])]}:{}),...(rankedRun(this)?{recordState:copy(this.recordState)}:{}),...(supportsTouchLock(this)?{touchLockId:savedTouchLock(this)}:{}),...(revisedEconomy(this)?{economy:copy(this.economy)}:{}),...(phase3Balance(this)?{setupUntil:this.setupUntil}:{}),...(revisedGrowth(this)?{growth:copy(this.growth)}:{}),...(this.options.contentVersion===3?{directorState:copy(this.directorState)}:{}),...(this.options.encounterVersion>=2?{pursuitState:copy(this.pursuitState)}:{}),nextEntityId:this.id,lastChain:this.lastChain,lastWard:this.lastWard,maxEnemies:this.maxEnemies,runId:this.runId,revision:this.revision,routes:this.routes.map(ch=>ch.map(n=>n.selected)),receipts:this.receipts,chains:this.chains,cinematicSeen:this.cinematicSeen,cinematic:this.cinematic,rest:this.rest,research:this.research,paidPrices:this.paidPrices,selectedSupply:this.selectedSupply,nodeDropXP:this.nodeDropXP,nodeStartXP:this.nodeStartXP,nodeStartHits:this.nodeStartHits||0,nodeStartThunder:this.nodeStartThunder||0,contentRng:this.contentRng.state(),choiceReturn:this.choiceReturn||null,choices:this.choices||[],waveTime:this.waveTime,spawnBudget:this.spawnBudget,nextElite:this.nextElite,nextEscort:this.nextEscort??15,nextHazard:this.nextHazard,objective:this.objective,mechanism:this.mechanism,boss:this.boss?.id?{id:this.boss.id}:this.boss,bossEnding:this.bossEnding,shop:this.shop||[],purchased:this.purchased,shopRolls:this.shopRolls,enemies:this.enemies.map(({focusObject:_focusObject,...e})=>e),shots:this.shots,drops:this.drops,zones:this.zones,swords:this.swords.map(({target,...s})=>({...s,targetId:target?.id??null})),insects:copyAllies(this.insects,'insect'),puppets:copyAllies(this.puppets,'puppet'),seen:[...this.seen],coreArcs:this.coreArcs,coreArcUntil:this.coreArcUntil,corePair:this.corePair,shieldAbsorbed:this.shieldAbsorbed,lastShieldBreak:this.lastShieldBreak,thunderTime:this.thunderTime,stillTime:this.stillTime}};}
 static restore(data,emit=()=>{}){
  validateCommonSnapshot(data);validateWorldSnapshot(data.expedition,data.options);
  const ex=data?.expedition;if(!ex||ex.schema!==1||typeof ex.runId!=='string'||ex.runId.length>120)throw Error('秘境记录格式无效');
  const coreIds=(data.relics||[]).filter(id=>CORES.some(c=>c.id===id));if(coreIds.length>2||new Set(coreIds.map(id=>CORES.find(c=>c.id===id).path)).size!==coreIds.length)throw Error('核心配置无效');
  Battle.restore({...data,options:{...data.options,rulesVersion:2,metaRulesVersion:data.options.metaRulesVersion??1},relics:data.relics.filter(id=>!CORES.some(c=>c.id===id))},()=>{});
  const b=new Expedition({...data.options,segmentVersion:data.options.segmentVersion??0,challengeVersion:data.options.challengeVersion??0,seed:data.seed??data.options.seed,chapter:0,runId:ex.runId,metaRulesVersion:data.options.metaRulesVersion??1,balanceVersion:data.options.balanceVersion??1,contentVersion:data.options.contentVersion??1,focusVersion:data.options.focusVersion??1,inputVersion:data.options.inputVersion??1,growthVersion:data.options.growthVersion??1,economyVersion:data.options.economyVersion??1,recordVersion:data.options.recordVersion??0,storyVersion:data.options.storyVersion??1,encounterVersion:data.options.encounterVersion??1},()=>{});restoreRoutePlan(b,ex);if(!Array.isArray(ex.routes)||ex.routes.length!==6||ex.routes.some((ch,c)=>!Array.isArray(ch)||ch.length!==b.routes[c].length||ch.some((v,n)=>v!==null&&(!Number.isInteger(v)||!b.routes[c][n].choices[v]))))throw Error('路线记录无效');
  if(!Array.isArray(ex.receipts)||new Set(ex.receipts).size!==ex.receipts.length||ex.receipts.some(id=>!b.routes.flat().some(n=>n.id===id)))throw Error('奖励凭据无效');
  for(const key of ['research','revision','nodeDropXP','nodeStartXP','waveTime','spawnBudget','nodeStartHits','nodeStartThunder','shopRolls'])if(!Number.isFinite(ex[key])||ex[key]<0)throw Error('秘境数值无效');
  for(const key of ['lastChain','lastWard'])if(ex[key]!==undefined&&!Number.isFinite(ex[key]))throw Error('技能计时记录无效');
  if(ex.nextEntityId!==undefined&&(!Number.isSafeInteger(ex.nextEntityId)||ex.nextEntityId<1))throw Error('敌人编号记录无效');
  if(ex.nextEscort!==undefined&&(!Number.isFinite(ex.nextEscort)||ex.nextEscort<0))throw Error('增援计时无效');
  if(ex.maxEnemies!==undefined&&(!Number.isFinite(ex.maxEnemies)||ex.maxEnemies<0))throw Error('敌群统计无效');
  if(data.consumables.some(c=>c.bonusHeal!==undefined&&(!Number.isInteger(c.bonusHeal)||c.bonusHeal<0||c.bonusHeal>1)))throw Error('额外药包记录无效');
  if(ex.research>6||!Array.isArray(ex.chains)||ex.chains.length>2||ex.chains.some(c=>!CHAINS.some(x=>x.id===c.chain)||!['waiting','active','declined','done'].includes(c.state)))throw Error('机缘记录无效');
  for(const key of ['enemies','shots','drops','zones','swords','insects','puppets'])if(!Array.isArray(ex[key])||ex[key].length>1000||ex[key].some(e=>!e||!Number.isFinite(e.x)||!Number.isFinite(e.y)))throw Error('战场记录无效');
  if(ex.swords.length>72||ex.insects.length>30||ex.puppets.length>12||ex.enemies.some(e=>!Number.isFinite(e.hp)||!Number.isFinite(e.maxHp)||!Number.isSafeInteger(e.id)||e.id<1))throw Error('战场单位无效');
  if(!['intro','battle','choice','rest','pause'].includes(data.modeState)||!['intro','intermission','cinematic','choice','pause',null].includes(data.scene))throw Error('节点状态无效');
  if(ex.rest&&((!ex.receipts.includes(ex.rest.node)&&!(ex.rest.preparation&&ex.rest.node==='3:prep'&&data.chapter===3&&data.wave===0))||!Array.isArray(ex.rest.coreOffers)||ex.rest.coreOffers.some(id=>!CORES.some(c=>c.id===id))||(!ex.rest.preparation&&!ex.rest.ending&&(!ex.rest.event||!['single','chain'].includes(ex.rest.event.type)))))throw Error('结算记录无效');
  if(ex.rest?.ending!==undefined&&(ex.rest.ending!==true||!endingCleanup(b,data.chapter,data.wave)||ex.rest.node!=='5:3'||!ex.rest.last||ex.rest.event!==null||!ex.rest.eventDone||!ex.rest.eventApplied||ex.rest.shop||!ex.rest.routeDone))throw Error('结局整理记录无效');
  if(ex.rest?.selectionMode!==undefined&&!['draft','committed','applying'].includes(ex.rest.selectionMode))throw Error('整备选择状态无效');
  if(ex.rest?.selectionMode==='draft'){
   const r=ex.rest,c=r.coreSelection;if(typeof r.eventApplied!=='boolean'||typeof r.coreApplied!=='boolean')throw Error('整备结算标记无效');
   if(r.eventDone&&r.event){const max=r.event.type==='single'?3:r.event.stage==='start'?3:2;if(!Number.isInteger(r.event.choice)||r.event.choice<0||r.event.choice>=max)throw Error('机缘暂选无效');}
   if(c&&((c.id!==null&&!r.coreOffers.includes(c.id))||(c.replaceId!==null&&!EQUIPMENT.some(e=>e.id===c.replaceId))))throw Error('核心暂选无效');
   if(r.coreOffers.length&&r.coreDone&&!r.coreApplied&&!c)throw Error('核心暂选缺失');
  }
  if(ex.cinematic&&!CINEMATICS.some(c=>c.id===ex.cinematic.id&&Number.isInteger(ex.cinematic.panel)&&c.panels[ex.cinematic.panel]))throw Error('过场记录无效');
  if(!Array.isArray(ex.choices)||ex.choices.length>3||ex.choices.some(t=>!TRAITS.some(v=>v.id===t.id)))throw Error('悟道记录无效');
  if(!Array.isArray(ex.shop)||ex.shop.length>6||ex.shop.some(r=>!['relic','consumable'].includes(r.kind)||!(r.kind==='relic'?RELICS:CONSUMABLES).some(v=>v.id===r.id)||!Number.isFinite(r.price)||r.price<0))throw Error('货架记录无效');
  if(!Array.isArray(ex.purchased)||ex.purchased.some(id=>typeof id!=='string')||!ex.paidPrices||typeof ex.paidPrices!=='object'||Array.isArray(ex.paidPrices)||Object.values(ex.paidPrices).some(n=>!Number.isFinite(n)||n<0))throw Error('购置记录无效');
  if(!Array.isArray(ex.cinematicSeen)||ex.cinematicSeen.some(id=>!CINEMATICS.some(c=>c.id===id))||!Array.isArray(ex.seen)||ex.seen.some(id=>typeof id!=='string'))throw Error('纪事记录无效');
  if(ex.rest?.event){const e=ex.rest.event;if((e.type==='single'&&(!Number.isInteger(e.index)||!EVENTS[e.index]))||(e.type==='chain'&&(!CHAINS.some(c=>c.id===e.id)||!['start','end'].includes(e.stage))))throw Error('机缘选项无效');}
  for(const z of ex.zones)if(!Number.isFinite(z.r)||z.r<0||!Number.isFinite(z.damage)||!Number.isFinite(z.ttl)||!Number.isFinite(z.warn))throw Error('场景危险区无效');
  for(const z of ex.shots)if(!Number.isFinite(z.vx)||!Number.isFinite(z.vy)||!Number.isFinite(z.damage)||!Number.isFinite(z.ttl)||!Array.isArray(z.hits))throw Error('弹幕记录无效');
  for(const z of ex.drops)if(!Number.isFinite(z.value)||z.value<0||!Number.isFinite(z.gold)||z.gold<0)throw Error('掉落记录无效');
  if(ex.objective){const q=ex.objective;if(!['hunt','defend','break','pursuit','escape','treasure','illusion','ice'].includes(q.kind))throw Error('机关目标无效');if(q.kind==='illusion'&&(!Array.isArray(q.gates)||q.gates.length!==3||q.gates.some(g=>!Number.isFinite(g.x)||!Number.isFinite(g.y))||!Number.isInteger(q.trueGate)||q.trueGate<0||q.trueGate>2))throw Error('幻境阵位无效');if(q.kind==='defend'&&(!Number.isFinite(q.hp)||!Number.isFinite(q.maxHp)||q.maxHp<=0))throw Error('阵盘耐久无效');if(q.exit&&(!Number.isFinite(q.exit.x)||!Number.isFinite(q.exit.y)||!Number.isFinite(q.exit.r)||q.exit.r<0))throw Error('退路记录无效');}
  restoreFeedback(b,data);
  for(const key of ['chapter','wave','time','level','xp','totalXP','gold','kills','thunders','hitCount','traits','relics','consumables','rerolls','queuedChoices','damageSources','storyInventory','endlessLoop','layoutOffset','formation','locked','risk','lastSigil','lastCounter','scene','modeState'])if(data[key]!==undefined)b[key]=copy(data[key]);
  for(const key of ['chapterSplits','challenges','lastChoice','cinematicHistory','recordState','economy','growth','directorState','pursuitState','revision','receipts','chains','cinematicSeen','cinematic','rest','research','paidPrices','selectedSupply','nodeDropXP','nodeStartXP','nodeStartHits','nodeStartThunder','choiceReturn','choices','waveTime','spawnBudget','nextElite','nextEscort','nextHazard','objective','mechanism','bossEnding','shop','purchased','shopRolls','enemies','shots','drops','zones','insects','puppets','coreArcs','coreArcUntil','corePair','shieldAbsorbed','lastShieldBreak','thunderTime','stillTime','setupUntil'])if(ex[key]!==undefined)b[key]=copy(ex[key]);
  b.insects=copyAllies(b.insects,'insect');b.puppets=copyAllies(b.puppets,'puppet');
  b.shots=b.shots.map(s=>({...s,source:s.source??(s.friendly?'puppet':'enemy')}));
  b.choices=(b.choices||[]).map(t=>TRAITS.find(v=>v.id===t.id));b.shop=b.shop.map(r=>({...((r.kind==='relic'?RELICS:CONSUMABLES).find(v=>v.id===r.id)),kind:r.kind,price:r.price}));b.locked=(b.locked||[]).map(r=>({...RELICS.find(v=>v.id===r.id),kind:'relic',price:r.price}));
  if(!b.routes[b.chapter][b.wave])throw Error('节点位置无效');b.routes.forEach((ch,c)=>ch.forEach((n,i)=>n.selected=ex.routes[c][i]));b.swords=copy(ex.swords).map(s=>({...s,target:b.enemies.find(e=>e.id===s.targetId)||null}));b.boss=ex.boss?.id?b.enemies.find(e=>e.id===ex.boss.id):copy(ex.boss);if(b.objective?.kind==='defend')for(const e of b.enemies)if(!e.boss&&defendLocked(b,e))e.focusObject=b.objective;
  if(b.endlessLoop){const scale=loopScale(b);b.difficulty={...b.difficulty,hp:b.difficulty.hp*scale.hp**b.endlessLoop,damage:b.difficulty.damage*scale.dmg**b.endlessLoop};}b.player={...b.player,...copy(data.player),buffs:copy(data.player.buffs||{})};b.stats={};b.recalc();validateSnapshotRelations(data,b);validateEncounterState(data,b);validatePhase2(data,b);validatePhase3(data,b);validatePacing(data,b);validateStory(data,b);validateTouchSnapshot(data,b);validateRecordSnapshot(data,b);validateLastChoice(ex,b);validateExperienceSnapshot(data,b);b.player={...b.player,...copy(data.player),buffs:copy(data.player.buffs||{})};b.rng.set(data.rng);b.contentRng.set(ex.contentRng);const referencedIds=[...b.enemies.map(e=>e.id),...b.shots.flatMap(s=>s.hits||[]),...b.swords.flatMap(s=>[...(s.hits||[]),s.targetId])].filter(Number.isSafeInteger);b.id=Math.max(ex.nextEntityId||1,...referencedIds.map(id=>id+1));b.nextEscort=ex.nextEscort??(Math.floor(b.waveTime/15)+1)*15;b.lastChain=ex.lastChain??b.lastChain;b.lastWard=ex.lastWard??b.lastWard;b.maxEnemies=Math.max(ex.maxEnemies||0,b.enemies.length);if(b.rest&&b.rest.selectionMode===undefined){const r=b.rest;r.selectionMode='draft';r.eventApplied=!!r.eventDone;r.coreApplied=!r.coreOffers.length||!!r.coreDone;r.coreSelection=null;r.legacyClaimed=r.eventApplied&&!!r.event||r.coreApplied&&r.coreOffers.length>0;}b.seen=new Set(ex.seen||[]);b.notices=new Set(data.notices||[]);for(const z of b.zones)if(z.sigil&&z.fuseDuration===undefined)z.fuseDuration=sigilFuse(z,b.stats);b.rebuildHash();b.touchLockId=ex.touchLockId??null;if(b.touchLockId!==null)updateTouchLock(b);b.restored=true;b.emit=emit;return b;
 }
}
