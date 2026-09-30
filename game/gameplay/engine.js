/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {practiceSwordLaunch} from './practice.js';
import {clearTouchLock,updateTouchLock} from './touch-controls.js';
import {PATHS,TRAITS,COMBOS,RELICS,CONSUMABLES,ENEMIES,CHAPTERS,EVENTS,DIFFICULTIES,seeded,hashSeed} from './data.js';
import {layoutFor,hazardPoints,MID_ENCOUNTERS} from './encounters.js';
import {validateCommonSnapshot} from './snapshot-validation.js';
import {emptySigilStats,beginSigil,observeSigil,emptySigilStreak} from './sigil-metrics.js';
import {emptyFire,shieldReward,consumableState,restoreFeedback,recordHit,cue,FIRE_LABELS} from './combat-feedback.js';
import {applySlow,tickSlow} from './slow.js';
import {directFocus} from './targeting.js';
import {expandedContent} from './content-rules.js';
import {revisedBalance,phase3Balance,dashCooldown,thunderCost,sigilGrowth,sigilArming,sigilTargets,sigilWarn,sigilCooldown,stationaryActive,puppetReady,starterExtras,reserveFor,traitMods,afterThunderWindow,levelHpBonus,allyBaseScale,insectLeash,insectFocusFirst,guardCounterScale,swordPuppetInherit,fireGuardShield} from './balance.js';
import {xpCostFor} from './growth-rules.js';
import {cultivationMods} from './cultivation.js';
import {DAMAGE_SOURCES,WORLD} from './combat-values.js';
import {clearDashInput,requestDash,tickDashInput} from './battle-input.js';
import {feedbackSound} from './presentation-feedback.js';
export {WORLD} from './combat-values.js';
const TAU=Math.PI*2,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const sumMods=(o,mods)=>{for(const [k,v]of Object.entries(mods))o[k]=(o[k]||0)+v;};
export class Battle {
 constructor(options={},emit=()=>{}){
  this.emit=emit;this.seed=options.seed||String(Date.now());this.rng=seeded(hashSeed(this.seed));this.rulesVersion=options.rulesVersion??2;this.options={...options,rulesVersion:this.rulesVersion,metaRulesVersion:options.metaRulesVersion??1};this.stillTime=0;this.setupUntil=-1;this.lastSigil=-100;this.lastCounter=-100;this.notices=new Set();
  this.difficulty=DIFFICULTIES[options.difficulty||0];this.mode=options.mode||'story';this.chapter=options.chapter||0;
  this.wave=0;this.waveTime=0;this.time=0;this.level=1;this.xp=0;this.totalXP=0;this.gold=45;
  this.kills=0;this.thunders=0;this.hitCount=0;this.maxEnemies=0;this.traits={};this.relics=[];
  this.path=options.path||0;this.queuedChoices=0;this.rerolls=2;this.shopRolls=0;this.purchased=[];this.locked=[];
  this.consumables=[{id:'heal',count:2},{id:'mana',count:1}];this.modeState='intro';this.scene='intro';this.finished=false;this.layoutOffset=Math.floor(this.rng()*4);this.hazardTick=0;this.nextHazard=12;this.midEncounter=null;this.mechanism=null;
  this.enemies=[];this.shots=[];this.drops=[];this.fx=[];this.zones=[];this.swords=[];this.insects=[];this.puppets=[];
  this.hash=new Map();this.id=1;this.spawnBudget=0;this.nextElite=40;this.lastChain=-10;this.lastWard=-10;
  this.boss=null;this.bossEnding=0;this.thunderTime=-100;this.damageSources={sword:0,thunder:0,puppet:0,insect:0,fire:0,guard:0};
  this.sigilStats=emptySigilStats();this.fireBreakdown=emptyFire();this.recentHits=[];this.combatCues=[];this.cueTimers={};this.numberTimers={};
  this.player={x:WORLD.w/2,y:WORLD.h/2,hp:100,maxHp:100,shield:0,maxShield:0,mana:0,reserve:reserveFor(this),maxReserve:reserveFor(this),invuln:0,dash:0,dashCD:0,lastHit:-100,lastDash:-100,lastKill:-100,dx:0,dy:1,moving:false,buffs:{},revived:false};
  this.input={x:0,y:0,aim:null,focus:false};this.seen=new Set();this.newCombos=[];this.comboSet=new Set();this.toastText='';this.toastUntil=0;
  this.stats={};this.recalc();this.player.hp=this.player.maxHp;this.player.shield=this.player.maxShield;if(this.rulesVersion>=2&&this.path===1)this.player.mana=50;
  const meta=(this.options.metaRulesVersion<2?options.meta:[])||[];if(this.options.metaRulesVersion>=2)this.player.mana=Math.min(100,this.player.mana+(this.stats.metaStartMana||0));
  this.gold+=meta.includes(PATHS[this.path].id+'-meta-0')?15:0;
  if(meta.includes(PATHS[this.path].id+'-meta-1'))this.consumables[0].count++;
  this.rerolls+=meta.filter(x=>x.endsWith('-meta-3')).length;
  if(this.mode==='training'){this.chapter=0;this.level=meta.includes(PATHS[this.path].id+'-meta-5')?72:36;this.gold=500;if(!this.options.guidedPractice)for(let j=0;j<12;j++)this.traits[PATHS[this.path].id+'-'+j]=1;this.recalc();}
  if(this.chapter>0){this.level=1+this.chapter*11;this.time=this.chapter*185;this.waveTime=0;for(let j=0;j<this.chapter*3;j++){const t=TRAITS[(this.path*12+j)%TRAITS.length];this.traits[t.id]=Math.min(3,(this.traits[t.id]||0)+1);}this.gold+=this.chapter*40;this.grantStoryItems();this.recalc();this.player.hp=this.player.maxHp;}
  this.syncSwords();this.uiTimer=0;
 }
 toastLimited(key,text){this.messageLimits??={};const old=this.messageLimits[key];if(old?.text===text&&old.until>this.time)return;this.messageLimits[key]={text,until:this.time+2.5};this.toast(text);}
 toast(text){this.toastText=text;this.toastUntil=this.time+3;this.emit({type:'toast',text});}
 recalc(){
  const old=this.stats||{},s={};sumMods(s,PATHS[this.path].perk);if(this.rulesVersion>=2)sumMods(s,starterExtras(this));
  sumMods(s,cultivationMods(this.options,this.path));
  for(const [id,count]of Object.entries(this.traits)){const t=TRAITS.find(x=>x.id===id);if(t)for(let i=0;i<count;i++)sumMods(s,traitMods(this,t));}
  for(const id of this.relics){const r=RELICS.find(x=>x.id===id);if(r)sumMods(s,r.mods);}
  this.pathCounts=PATHS.map(p=>Object.keys(this.traits).filter(id=>id.startsWith(p.id+'-')).length);
  const combos=COMBOS.filter(c=>this.pathCounts[PATHS.findIndex(p=>p.id===c.a)]>=3&&this.pathCounts[PATHS.findIndex(p=>p.id===c.b)]>=3);
  for(const c of combos)if(!this.comboSet.has(c.effect)){this.newCombos.push(c.name);this.toast('联动成型 · '+c.name);}
  this.comboSet=new Set(combos.map(c=>c.effect));this.combos=combos;
  if(this.comboSet.has('puppetInsect')){s.puppets=(s.puppets||0)+1;s.insects=(s.insects||0)+1;}
  if(this.comboSet.has('puppetGuard'))s.armor=(s.armor||0)+(s.puppets||0)*3;
  s.armor=(s.armor||0)+Math.floor((s.insects||0)/4)*(s.insectGuard||0);
  s.shield=(s.shield||0)+(s.puppets||0)*(s.puppetShield||0);
  const fireGuard=fireGuardShield(this);if(fireGuard)s.shield=(s.shield||0)+fireGuard;
  this.stats=s;
  if(this.player){const p=this.player;const bonus=(this.options.metaRulesVersion<2?this.options.meta||[]:[]).filter(x=>x.endsWith('-meta-2')).length*2;
   const levelHp=levelHpBonus(this);this.levelHpApplied=levelHp;p.maxHp=100+(s.hp||0)+bonus+levelHp;p.maxShield=s.shield||0;p.maxReserve=reserveFor(this)+(s.reserve||0);
   p.hp=clamp(p.hp+Math.max(0,(s.hp||0)-(old.hp||0)),0,p.maxHp);
   p.shield=clamp(p.shield+Math.max(0,(s.shield||0)-(old.shield||0)),0,Math.max(p.maxShield,p.shield));
   p.reserve=clamp(p.reserve+Math.max(0,(s.reserve||0)-(old.reserve||0)),0,p.maxReserve);
  }
 }
 // Level-derived state has one sync hook: the sword count and, under balance 4, the max-HP bonus (+4 per 8 levels). A level change
 // that has not been recalculated yet is reconciled here; the gained maximum is also added to current HP once.
 syncSwords(){if(this.player&&this.stats&&levelHpBonus(this)!==(this.levelHpApplied||0)){const before=this.player.maxHp;this.recalc();this.player.hp=Math.min(this.player.maxHp,this.player.hp+Math.max(0,this.player.maxHp-before));}const n=Math.min(72,this.level);while(this.swords.length<n)this.swords.push({x:this.player.x,y:this.player.y,px:this.player.x,py:this.player.y,a:0,cool:this.swords.length*.012,target:null,hits:[],life:0});}
 start(){this.scene=null;this.modeState='battle';this.waveTime=0;if(this.wave===3&&!this.boss)this.spawnBoss();this.emit({type:'scene',scene:null});if(this.time===0){this.spawn(4,{x:790,y:430});this.spawn(4,{x:440,y:400});this.spawn(5,{x:640,y:210});}this.toast(CHAPTERS[this.chapter].name+' · 第 '+(this.wave+1)+' 波');}
 pause(){clearDashInput(this);clearTouchLock(this,true);if(this.modeState==='battle'){this.modeState='pause';this.scene='pause';this.emit({type:'scene',scene:'pause'});}}
 requestDash(){return requestDash(this);}
 clearDashInput(){clearDashInput(this);clearTouchLock(this,true);}
 feedbackSound(name,interval){feedbackSound(this,name,interval);}
 resume(){if(this.modeState==='pause'){this.modeState='battle';this.scene=null;this.emit({type:'scene',scene:null});}}
 changeFormation(){if(this.stats.metaSwordRecall&&this.time-(this.player.metaSwitchAt??-100)>=8&&this.swords.some(sw=>sw.cool>.25)){this.player.metaSwitchAt=this.time;for(const sw of this.swords)sw.cool=Math.min(sw.cool,.25);}this.formation=((this.formation||0)+1)%3;this.toast(['御剑 · 分组追击','御剑 · 环绕护身','御剑 · 定向穿刺'][this.formation]);}
 addXP(value){
  const previousLevel=this.level;this.xp+=value;this.totalXP+=value;let gained=0;
  while(this.xp>=xpCostFor(this,this.level)&&this.level<160){this.xp-=xpCostFor(this,this.level);this.level++;gained++;if(this.level%4===0)this.queuedChoices++;}
  if(gained){this.syncSwords();this.pulse(this.player.x,this.player.y,'#b7f2c4',40);this.emit({type:'sound',name:'level'});if(previousLevel<72&&this.level>=72){this.toast('七十二剑齐出 · 调度已成');this.cue('formation-ready','七十二剑齐出 · 调度已成','#d7eeb4',2.4);this.emit({type:'formation-ready'});}}
 }
 chooseTrait(id){
  const t=TRAITS.find(x=>x.id===id);if(!t||this.modeState!=='choice'||!this.choices?.some(x=>x.id===id)||(this.traits[id]||0)>=t.max)return;
  this.traits[id]=(this.traits[id]||0)+1;this.recalc();this.queuedChoices=Math.max(0,this.queuedChoices-1);
  this.emit({type:'sound',name:'choose'});
  if(this.queuedChoices)this.openChoices();else{this.scene=null;this.modeState='battle';this.emit({type:'scene',scene:null});}
 }
 traitChoices(){
  const pool=TRAITS.filter(t=>(this.traits[t.id]||0)<t.max);
  const picked=[];while(picked.length<3&&pool.length){const weights=pool.map(t=>t.path===this.path?(this.options.metaRulesVersion<2&&(this.options.meta||[]).includes(PATHS[this.path].id+'-meta-4')?5:3):1);let v=this.rng()*weights.reduce((a,b)=>a+b,0),idx=0;for(;idx<weights.length-1;idx++){v-=weights[idx];if(v<=0)break;}picked.push(pool.splice(idx,1)[0]);}
  return picked;
 }
 openChoices(){clearDashInput(this);clearTouchLock(this,true);this.modeState='choice';this.scene='choice';this.choices=this.traitChoices();this.emit({type:'scene',scene:'choice'});}
 reroll(){if(this.modeState!=='choice'||this.rerolls<=0)return;this.rerolls--;this.choices=this.traitChoices();this.emit({type:'scene',scene:'choice'});}
 dash(){
  const p=this.player,s=this.stats;if(this.modeState!=='battle'||p.dashCD>0)return false;
  let x=this.input.x,y=this.input.y;if(Math.hypot(x,y)<.1){x=p.dx;y=p.dy;}
  const d=Math.hypot(x,y)||1;p.dx=x/d;p.dy=y/d;p.dash=.2;p.dashCD=dashCooldown(this);p.invuln=Math.max(p.invuln,.24+(s.iframes||0));p.lastDash=this.time;
  if(this.rulesVersion>=2&&this.path===4&&this.time-this.lastSigil>=sigilCooldown(this)){this.lastSigil=this.time;this.cue('sigil-place','闪避起点 · 留符','#ffbd78');const r=(s.dashFire?100:85)*(1+(s.metaSigilRadius||0)),modern=revisedBalance(this),fuse=sigilWarn(this);const zone={x:modern?clamp(p.x,r,WORLD.w-r):p.x,y:modern?clamp(p.y,r,WORLD.h-r):p.y,r,ttl:modern?fuse+.35:1.15,warn:modern?fuse:s.dashFire?.55:.8,fuseDuration:modern?fuse:s.dashFire?.55:.8,...(modern?{arming:sigilArming(this)}:{}),kind:'sigil',friendly:true,sigil:true,damage:(55+this.level*1.2)*(s.dashFire?1.35:1)*(1+(s.burnDamage||0))*sigilGrowth(this)};
   // Targets inside the circle at placement; if swords clear them before arming ends, the burst is 'cleared', not a pure miss.
   if(modern){zone.armedTargets=this.sigilLiveTargets(zone).length;zone.killsAtArming=this.kills;}this.zones.push(zone);}
  if(s.dashFire&&!(this.rulesVersion>=2&&this.path===4))this.zones.push({x:p.x,y:p.y,r:75,ttl:2.5,warn:.35,kind:'fire',friendly:true,damage:25*(1+(s.burnDamage||0))});
  if(phase3Balance(this)&&this.path===5){delete this.cueTimers['guard-window'];this.cue('guard-window','化解窗口 · 待挡招','#9bddfa',.24+(s.iframes||0));}
  this.emit({type:'sound',name:'dash'});return true;
 }
 thunderReadiness(){const cost=thunderCost(this),p=this.player;return {cost,ready:p.mana>=99.9&&p.reserve>=cost,label:p.reserve<cost?'雷源不足':p.mana>=99.9?'可以施放':'灵力 '+Math.floor(p.mana)+' / 100'};}
 thunder(){
  const p=this.player,s=this.stats,{cost}=this.thunderReadiness();
  if(this.modeState!=='battle')return false;
  if(p.mana<99.9){this.toastLimited('mana-short','灵力尚未蓄满');return false;}
  if(p.reserve<cost){this.toastLimited('reserve-short','雷源不足 · 回灵无法补充雷源');return false;}
  p.mana=0;p.reserve-=cost;this.thunders++;this.thunderTime=this.time;this.cue('thunder-cast','辟邪神雷 · 已施放，耗用 '+cost+' 雷源','#fff0aa',1.5);
  this.shots=this.shots.filter(b=>b.friendly);p.shield=Math.max(p.shield,Math.min(p.maxShield+25,p.shield+(s.thunderShield||0)));
  if(this.comboSet.has('thunderInsect'))p.hp=Math.min(p.maxHp,p.hp+this.insects.length*.8);
  if(s.metaThunderVeil){p.invuln=Math.max(p.invuln,1);this.cue('veil','金雷护窍 · 已触发','#fff0aa',1);}
  if(this.comboSet.has('thunderGuard'))p.invuln=Math.max(p.invuln,1.5);
  if(this.comboSet.has('thunderFire'))for(let i=0;i<3;i++)this.zones.push({x:p.x+Math.cos(i*TAU/3)*130,y:p.y+Math.sin(i*TAU/3)*130,r:85,ttl:4,warn:0,kind:'fire',friendly:true,damage:35});
  this.onThunderCast?.();
  // oxlint-disable-next-line unicorn/no-useless-spread -- Freeze cast-time targets; hit callbacks can add or remove enemies.
  for(const e of [...this.enemies])if(e.hp>0){
   const evil=e.family==='阴魂'||e.family==='鬼修';let d=(120+12*Math.min(72,this.level))*(1+(s.thunderDamage||0))*(evil?1.5+(s.evilDamage||0):1);
   if(e.burn>0)d*=1+(s.burnThunder||0);if(e.mark)d*=1+Math.min(.6,e.mark*.06);
   this.hit(e,d*(this.thunderMultiplier?.(e)??1),'thunder',false);if(this.modeState!=='battle')break;e.stun=e.boss?.35:1.1;this.fx.push({kind:'bolt',x:e.x,y:e.y,ttl:.45,max:.45,color:'#ffeaae',seed:this.rng()});
  }
  this.fx.push({kind:'thunder',x:p.x,y:p.y,ttl:.8,max:.8});this.emit({type:'sound',name:'thunder'});this.emit({type:'shake',value:10});return true;
 }
 itemReadiness(index){return consumableState(this,index);}
 cue(key,text,color,duration){cue(this,key,text,color,duration);}
 pinCue(){const last=this.combatCues.find(c=>c.key==='pin'&&c.until>this.time);if(last){last.count=(last.count||1)+1;last.text='傀儡压制 · 本组定身 '+last.count+' 次';}else{this.cue('pin','傀儡压制 · 本组定身 1 次','#9ceaff');}}
 sigilReadiness(){const left=Math.max(0,sigilCooldown(this)-(this.time-this.lastSigil));const pending=this.zones.find(z=>z.twin&&!z.pair&&!z.fired);return {left,label:pending?(left>0?'次符 '+left.toFixed(1)+'s':'可放第二符'):left>0?'留符 '+left.toFixed(1)+'s':'起点留符已就绪'};}
 consume(index){
  if(this.modeState!=='battle')return false;const slot=this.consumables[index],p=this.player;if(!slot||slot.count<=0)return false;
  const state=this.itemReadiness(index),c=state.item;if(state.blocked){this.toast(state.reason);return false;}slot.count--;const aim=this.input.aim||p;
  switch(c.effect){
   case'heal':p.hp=Math.min(p.maxHp,p.hp+p.maxHp*c.value);break;
   case'mana':p.mana=Math.min(100,p.mana+c.value);break;
   case'shield':p.shield+=c.value;break;
   case'magnet':this.collectAll();break;
   case'invincible':p.invuln=Math.max(p.invuln,c.value);break;
   case'dash':p.dashCD=0;p.hp=Math.min(p.maxHp,p.hp+10);break;
   case'fire':this.explode(aim.x,aim.y,155,160,'fire');break;
   case'shock':this.explode(p.x,p.y,200,120,'fire');for(const e of this.near(p.x,p.y,200)){if(e.mission==='rune')continue;const d=dist(e,p)||1;e.x+=(e.x-p.x)/d*80;e.y+=(e.y-p.y)/d*80;}break;
   case'slow':for(const e of this.enemies){applySlow(e,'binding',.65,6);}break;
   case'seal':for(const e of this.enemies)if(e.family==='阴魂'){this.hit(e,200,'fire');if(this.modeState!=='battle')break;e.stun=e.boss?.4:3;}break;
   default:p.buffs[c.effect]=this.time+c.value;
  }
  this.emit({type:'sound',name:'item'});this.toast(c.name+(state.summon?' · '+state.summon.text:c.effect==='shield'?' · 获得 '+c.value+' 额外护盾':state.gain!==null?' · 恢复 '+Number(state.gain.toFixed(1))+(c.effect==='heal'?' 生命':' 灵力'):' · 已使用'));return true;
 }
 addConsumable(id){const same=this.consumables.find(x=>x.id===id);if(same)same.count++;else if(this.consumables.length<2)this.consumables.push({id,count:1});else{const empty=this.consumables.findIndex(x=>x.count<=0);if(empty>=0)this.consumables[empty]={id,count:1};else return false;}return true;}
 hitPlayer(amount,hazard=false,origin=null){
  const p=this.player,s=this.stats;if(this.finished||this.isExpedition&&this.modeState!=='battle')return;if(!phase3Balance(this)&&this.rulesVersion>=2&&this.path===5&&p.invuln>0&&this.time-p.lastDash<.24+(s.iframes||0)&&this.time-this.lastCounter<4&&this.lastCounter<p.lastDash&&this.guardNoticeDash!==p.lastDash){this.guardNoticeDash=p.lastDash;this.cue('counter-wait','已化解 · 反击还需 '+(4-this.time+this.lastCounter).toFixed(1)+' 秒','#b6c0ba',.8);}if(this.rulesVersion>=2&&this.path===5&&p.invuln>0&&this.time-p.lastDash<.24+(s.iframes||0)&&(phase3Balance(this)?this.lastCounter<p.lastDash:this.time-this.lastCounter>=4)){this.lastCounter=this.time;this.combatCues=this.combatCues.filter(c=>c.key!=='guard-window');delete this.cueTimers.counter;if(s.metaGuardCounter)p.buffs.metaGuardSwift=this.time+1.5;const gain=shieldReward(p,phase3Balance(this)?3:6,12);p.shield+=gain;this.explode(p.x,p.y,110,(32+this.level*.9)*guardCounterScale(this),'guard');this.cue('counter',(s.metaGuardCounter?'已化解 · 反击与疾行 +12%':'已化解 · 守元反击')+(gain>0?' · 回盾 +'+Number(gain.toFixed(1)):' · 额外护盾保留'),'#9bddfa',s.metaGuardCounter?1.5:1.2);}if(this.mode==='training'||p.invuln>0)return;
  const armor=(s.armor||0)+(p.buffs.armor>this.time?40:0);let d=amount*100/(100+armor*3);
  if(this.time-p.lastDash<2)d*=1-Math.min(.65,s.dashGuard||0);
  if(this.puppets.some(a=>dist(a,p)<110))d*=1-Math.min(.3,s.puppetGuard||0);
  if(hazard)d*=1-Math.min(.75,s.hazardGuard||0);
  const hpBefore=p.hp;const absorbed=Math.min(p.shield,d);p.shield-=absorbed;d-=absorbed;p.hp=Math.max(0,p.hp-d);p.invuln=.55;p.lastHit=this.time;this.hitCount++;
  const lost=hpBefore-p.hp,revived=p.hp<=0&&!!s.revive&&!p.revived;if(revived){p.revived=true;p.hp=p.maxHp*.25;p.invuln=3;}
  recordHit(this,{...(origin||this.attackOrigin||{name:hazard?'场地危险':'近身来袭'}),kind:origin?.kind||(hazard?'险地':'近身'),shield:absorbed,hp:lost,remaining:p.hp,outcome:revived?'revived':p.hp<=0?'defeated':'hurt',recovered:revived?p.hp:0});
  this.fx.push({kind:'number',x:p.x,y:p.y-36,text:'−'+Math.ceil(d+absorbed),color:'#ffac94',ttl:.8,max:.8});
  this.emit({type:'sound',name:'hurt'});this.emit({type:'shake',value:4});
  if(revived)this.toast('守心 · 化解致命伤，恢复 '+Number(p.hp.toFixed(1))+' 生命');else if(p.hp<=0){this.finish(false,'生命耗尽');return;}
  if(s.thorns)this.explode(p.x,p.y,95,25+this.level*1.4,'fire');
 }
 finish(won,reason='历练未完成'){if(this.finished)return;clearTouchLock(this,true);this.finished=true;this.modeState='result';this.scene='result';this.won=won;this.failureReason=won?null:reason;this.emit({type:'finish',won,summary:this.summary()});}
 summary(){return {studyVersion:this.options.studyVersion||0,won:!!this.won,failureReason:this.failureReason||null,chapter:this.chapter,level:this.level,kills:this.kills,time:this.time,thunders:this.thunders,gold:this.gold,path:this.path,seed:this.seed,mode:this.mode,damageSources:this.damageSources,fireBreakdown:this.fireBreakdown,sigilStats:this.sigilStats,recentHits:this.recentHits,traits:this.traits,combos:this.combos.map(c=>c.name),hitCount:this.hitCount,maxEnemies:this.maxEnemies,insight:this.options.studyVersion===1?0:Math.floor(this.kills/30)+this.chapter*8+(this.won?40:8)};}
 rebuildHash(){this.hash.clear();for(const e of this.enemies)if(e.hp>0&&!e.untargetable){const k=(e.x/96|0)+','+(e.y/96|0);if(!this.hash.has(k))this.hash.set(k,[]);this.hash.get(k).push(e);}}
 near(x,y,r){const result=[];for(let a=Math.floor((x-r)/96);a<=Math.floor((x+r)/96);a++)for(let b=Math.floor((y-r)/96);b<=Math.floor((y+r)/96);b++){const bucket=this.hash.get(a+','+b);if(bucket)for(const e of bucket)if(e.hp>0&&(e.x-x)**2+(e.y-y)**2<r*r)result.push(e);}return result;}
 nearest(x,y,r,exclude=[]){let best=null,score=Infinity;for(const e of this.near(x,y,r)){if(exclude.includes(e.id))continue;const d=(e.x-x)**2+(e.y-y)**2;if(d<score){score=d;best=e;}}return best;}
 spawn(type,opts={}){
  if(this.enemies.length>=250&&!opts.boss)return null;const data=ENEMIES[type]||ENEMIES[0],p=this.player;
  const a=this.rng()*TAU,r=380+this.rng()*140;let x=opts.x??clamp(p.x+Math.cos(a)*r,35,WORLD.w-35),y=opts.y??clamp(p.y+Math.sin(a)*r,35,WORLD.h-35);
  if(dist({x,y},p)<170&&!opts.boss&&opts.mission!=='rune'){x=p.x<WORLD.w/2?WORLD.w-40:40;y=50+this.rng()*(WORLD.h-100);}
  const m=this.time/60,scale=(1+.14*m+.028*m*m)*(1+Math.min(.6,m*.035)),elite=!!opts.elite;
  const e={...data,id:this.id++,x,y,hp:data.hp*scale*this.difficulty.hp*(elite?3:1),maxHp:0,speed:data.speed*Math.min(1.25,1+.0125*m),dmg:data.damage*Math.min(2.5,1+.065*m)*this.difficulty.damage,
    elite,boss:false,r:elite?23:data.ai==='tank'?23:14,a:0,timer:.5+this.rng()*2,age:0,stun:0,slow:0,slowTime:0,burn:0,burnTick:0,break:0,mark:0,phase:0,noDrop:false,flash:0,spawn:.7,attacks:0,...opts};
  e.maxHp=e.hp;this.enemies.push(e);this.maxEnemies=Math.max(this.maxEnemies,this.enemies.length);this.seen.add(data.id);return e;
 }
 spawnBoss(){
  this.enemies=this.enemies.filter(e=>e.hp>0&&!e.noDrop).slice(0,24);const ch=CHAPTERS[this.chapter];
  if(ch.bossType==='swarm'){this.boss={type:'swarm',name:ch.boss,hp:75,maxHp:75,timer:75};this.toast('虫潮来袭 · 坚持 75 秒');return;}
  const index={serpent:4,ghost:9,seal:23,puppet:3,xuangu:8}[ch.bossType];
  if(ch.bossType==='seal'){this.boss={type:'seal',name:ch.boss,hp:42,maxHp:42,timer:42};this.mechanism={x:430,y:400,r:95,progress:0,goal:42,step:0};this.enemies=[];this.toast('虫甲敛息 · 进入青色阵位累计 42 秒');return;}
  const hp=[9000,24000,0,0,100000,120000][this.chapter]*this.difficulty.hp;
  const e=this.spawn(index,{boss:true,elite:false,x:WORLD.w/2,y:160,hp,sprite:ch.bossSprite,name:ch.boss,r:40,speed:32+this.chapter*3,bossType:ch.bossType,timer:1.8});
  this.boss=e;this.toast(ch.boss+' · '+(ch.bossType==='seal'?'破除禁制':'强敌现身'));this.emit({type:'sound',name:'boss'});
 }
 pulse(x,y,color,r=25){if(this.fx.length<250)this.fx.push({kind:'ring',x,y,color,r,ttl:.4,max:.4});}
 explode(x,y,r,damage,source,fireKind='other'){const phase=this.modeState;this.pulse(x,y,source==='fire'?'#ecb373':'#e9d293',r);for(const e of (phase3Balance(this)&&source==='fire'&&['sigil','echo'].includes(fireKind)?sigilTargets(this,{x,y,r}):this.near(x,y,r))){this.hit(e,damage,source,false,fireKind);if(this.modeState!==phase||this.finished)break;}}
 hit(e,base,source='sword',canCrit=true,fireKind='other'){
  if(source==='fire'&&(!Object.hasOwn(FIRE_LABELS,fireKind)||fireKind==='history'))throw Error('符火来源无效');
  if(!DAMAGE_SOURCES.includes(source))throw Error('伤害来源无效，战斗已暂停保护');
  if(!e||e.hp<=0||e.untargetable||e.phaseShield>0)return;const s=this.stats,p=this.player,hpBefore=e.hp;
  let empowered=false,d=base;const crit=canCrit&&this.rng()<Math.min(.85,.05+(s.crit||0)+(e.burn>0&&this.comboSet.has('swordFire')?.2:0));
  if(crit)d*=1.7+(s.critPower||0);
  if(e.boss)d*=1+(s.bossDamage||0);if(e.family==='阴魂')d*=1+(s.ghostDamage||0);
  d*=1+Math.min(.5,e.break||0);
  if((e.ai==='armor'||e.ai==='bulwark'&&e.timer>1.6)&&source==='sword'&&Math.abs(Math.atan2(Math.sin(Math.atan2(p.y-e.y,p.x-e.x)-e.a),Math.cos(Math.atan2(p.y-e.y,p.x-e.x)-e.a)))<1)d*=.6;
  if(e.defended)d*=.75;
  if(e.gnawUntil>this.time)d*=1+(e.gnaw||0);
  if(source==='sword'){
   if(this.rulesVersion>=2&&this.path===0){e.focusHits=e.focusUntil>=this.time?(e.focusHits||0)+1:1;e.focusUntil=this.time+2+(s.metaFocusWindow||0);if(e.focusHits>=4){e.focusHits=0;d*=1.4;empowered=true;if(s.metaSwordMomentum)p.buffs.metaSwordTempo=this.time+3;this.fx.push({kind:'line',x:p.x,y:p.y,tx:e.x,ty:e.y,color:'#d8ffe9',ttl:.22,max:.22});}}
   if(s.burn){e.burn=3+(s.burnTime||0);e.burnDamage=6*s.burn*(1+(s.burnDamage||0));}
   if(s.slow){applySlow(e,'sword',s.slow,1.2);}
   if(s.armorBreak)e.break=Math.min(.24,(e.break||0)+s.armorBreak);
   if(crit&&(s.mark||s.insectMark))e.mark=Math.min(10,(e.mark||0)+1);
   if(crit&&this.comboSet.has('swordThunder')&&this.rng()<.25){d+=25+this.level;this.fx.push({kind:'bolt',x:e.x,y:e.y,ttl:.2,max:.2,color:'#eed396',seed:this.rng()});}
  }
  if(e.bossType==='xuangu'&&this.bossEnding>0)d=0;
  if(e.boss&&!this.bossEnding){const next=e.maxHp*(e.phase===0?.66:e.phase===1?.33:0);if(e.hp-d<=next&&e.phase<2){d=Math.max(0,e.hp-next);e.phase++;e.phaseShield=2.6;e.timer=.15;this.toast(e.name+' · 护势变化，准备避招');}}const effective=this.rulesVersion>=2?Math.min(Math.max(0,e.hp),Math.max(0,d)):d;e.hp-=d;e.flash=.1;this.damageSources[source]=(this.damageSources[source]||0)+effective;if(source==='fire')this.fireBreakdown[fireKind]+=effective;observeSigil(this,e,source,fireKind,Math.min(effective,hpBefore));
  if(effective>0&&source==='insect'&&s.metaInsectAssist)e.lastInsectHit=this.time;
  if(effective>0&&empowered)this.cue('focus',s.metaSwordMomentum?'聚锋触发 · 飞剑攻速 +12%':'四击聚锋','#d8ffe9');
  const key=empowered?'聚锋':source==='fire'&&['sigil','echo','line'].includes(fireKind)?FIRE_LABELS[fireKind]:source==='guard'?'反击':null;
  if(effective>0){const sound=empowered?'focus':source==='guard'?'counter':source==='fire'&&['sigil','echo','line'].includes(fireKind)?fireKind:crit?'critical':null;if(sound)this.feedbackSound(sound);}
  if(effective>0&&key&&this.fx.length<180&&this.time>=(this.numberTimers[key]??-1)){this.numberTimers[key]=this.time+.3;const offset=this.fx.filter(f=>f.key&&Math.abs(f.x-e.x)<28&&f.ttl>0).length%3;this.fx.push({kind:'number',key:true,x:e.x,y:e.y-34-offset*18,text:key+' '+Math.ceil(effective),color:source==='guard'?'#9edbff':fireKind==='echo'?'#dbb4ff':fireKind==='sigil'?'#ffad78':fireKind==='line'?'#f3a4ce':'#d8ffe9',ttl:.85,max:.85});}
  if(effective>0&&(crit||e.boss||this.options.settings?.numbers)){const group=crit&&this.fx.find(f=>f.critical&&f.targetId===e.id&&this.time-f.createdAt<.08&&f.ttl>0);if(group){group.total+=effective;group.count++;group.text='暴击合计 '+Math.ceil(group.total)+' · '+group.count+'次';}else if(this.fx.length<180){const offset=Math.min(5,this.fx.filter(f=>f.kind==='number'&&Math.abs(f.x-e.x)<30&&f.ttl>0).length);this.fx.push({kind:'number',critical:!!crit,targetId:e.id,createdAt:this.time,total:effective,count:1,x:e.x+(offset%2?12:-12),y:e.y-18-offset*16,text:Math.ceil(effective)+(crit?'!':''),color:crit?'#f8dfa3':'#c6eadc',ttl:.55,max:.55});}}
  if(e.hp<=0){e.lastDamageSource=source;if(e.bossType==='xuangu'){e.hp=1;this.bossEnding=13;this.toast('圣火将失控 · 躲避落焰，寻找脱身窗口');return;}this.kill(e);}
  return {empowered};
 }
 bossDefeat(e){this.emit({type:'boss-defeat',effect:{x:e.x,y:e.y,sprite:e.sprite,name:e.name,color:e.bossType==='xuangu'?'#e8d3d0':e.family==='阴魂'?'#c9adee':'#d6e6b4'}});}
 kill(e){
  if(e.dead)return;if(e.boss)this.bossDefeat(e);e.dead=true;e.hp=0;this.kills++;this.player.lastKill=this.time;this.feedbackSound('kill',.1);const s=this.stats;
  this.pulse(e.x,e.y,e.family==='阴魂'?'#a791d3':'#afc9a1',e.r);
  if(!e.noDrop&&e.mission!=='rune'&&(s.metaInsectRecovery&&e.lastDamageSource==='insect'||s.metaInsectAssist&&Number.isFinite(e.lastInsectHit)&&this.time-e.lastInsectHit<=3)){if(s.metaInsectAssist&&this.player.hp>=this.player.maxHp)this.player.metaInsectKills=0;else this.player.metaInsectKills=(this.player.metaInsectKills||0)+1;if(this.player.metaInsectKills>0&&this.player.metaInsectKills%8===0){const healed=Math.min(3,Math.max(0,this.player.maxHp-this.player.hp));this.player.hp+=healed;if(healed>0)this.cue('recovery','群息回养 · 生命 +'+Number(healed.toFixed(1)),'#bae5b4');if(healed>0)this.fx.push({kind:'number',x:this.player.x,y:this.player.y-38,text:'+'+Number(healed.toFixed(2)),color:'#b2ddae',ttl:.8,max:.8});}}
  if(!e.noDrop){const value=Math.max(1,e.cost)*(.9+.12*(this.time/60)+.015*(this.time/60)**2)*(e.elite?4:1)*(e.boss?3:1)*this.difficulty.xp*.48*(this.level===1?4:1)*(this.time>600?.76:1);
   this.drops.push({x:e.x,y:e.y,value,gold:e.elite?8:1,life:0});
   if(this.rng()<.012)this.drops.push({x:e.x+8,y:e.y,heal:8,value:0,gold:0,life:0});
  }
  if(e.ai==='revive'&&!e.revived)this.spawn(e.index,{x:e.x,y:e.y,hp:e.maxHp*.35,revived:true,noDrop:true});
  if(e.ai==='split')for(let i=0;i<2;i++)this.spawn(0,{x:e.x+(i?12:-12),y:e.y,hp:e.maxHp*.22,noDrop:true});
  if(e.ai==='poison')this.zones.push({x:e.x,y:e.y,r:45,ttl:4,warn:.4,kind:'poison',damage:e.dmg,origin:{name:e.name+'遗留毒雾',x:e.x,y:e.y}});
  if(e.burn>0&&s.deathFire)this.zones.push({x:e.x,y:e.y,r:45,ttl:2,warn:0,kind:'fire',friendly:true,damage:14*(1+(s.burnDamage||0))});
  if(s.killHeal&&this.kills%12===0)this.player.hp=Math.min(this.player.maxHp,this.player.hp+s.killHeal);
  if(s.killMana&&this.rng()<Math.min(.5,s.killMana))this.player.mana=Math.min(100,this.player.mana+1);
  if(s.killBlast&&this.kills%8===0){const target=this.nearest(this.player.x,this.player.y,400);if(target)this.zones.push({x:target.x,y:target.y,r:50,ttl:.5,warn:.1,kind:'fire',friendly:true,damage:40*s.killBlast});}
  if(e.boss){this.boss=null;this.endChapter();}
 }
 shoot(x,y,a,damage,speed=170,friendly=false,opts={}){if(this.shots.length>450)return;this.shots.push({x,y,px:x,py:y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,damage,ttl:5,r:5,friendly,hits:[],pierce:0,source:friendly?'puppet':'enemy',...(!friendly&&this.attackOrigin?{origin:{...this.attackOrigin}}:{}),...opts});}
 danger(x,y,r,damage,warn=.8,ttl=1,kind='blast'){this.zones.push({x,y,r,damage,warn,ttl:warn+ttl,kind,origin:this.attackOrigin?{...this.attackOrigin}:{name:'场地危险',x,y}});}
 updateEnemy(e,dt){
  if(e.hp<=0)return;e.age+=dt;e.spawn-=dt;e.flash-=dt;e.stun-=dt;tickSlow(e,dt);
  if(e.burn>0){e.burn-=dt;e.burnTick-=dt;if(e.burnTick<=0){e.burnTick=.45;this.hit(e,e.burnDamage*.45,'fire',false,'burn');}}
  if(e.bossType==='xuangu'&&e.boss&&this.bossEnding>0){this.updateBossEnding(e,dt);return;}
  if(e.hp<=0||e.spawn>0)return;if(e.stun>0)return;
  const p=e.focusObject||this.player;const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy)||1,a=Math.atan2(dy,dx);let speed=e.speed*(1-e.slow),vx=dx/d,vy=dy/d;
  if(e.ai==='bulwark'){const turn=Math.atan2(Math.sin(a-e.a),Math.cos(a-e.a));e.a+=clamp(turn,-dt*.9,dt*.9);}else e.a=a;e.timer-=dt;
  if(e.boss){this.updateBoss(e,dt,a,d);return;}
  switch(e.ai){
   case'fanbow':case'orbitfire':{
    if(d<180){vx=-vx*.65;vy=-vy*.65;}else if(d<290){vx=0;vy=0;}if(e.ai==='orbitfire'){const side=e.id%2?1:-1;vx+=Math.cos(a+side*Math.PI/2)*.75;vy+=Math.sin(a+side*Math.PI/2)*.75;}
    if(e.charge>0){speed=0;e.charge-=dt;if(e.charge<=0){const angles=e.ai==='fanbow'?[-.28,0,.28]:[0];for(const offset of angles)this.shoot(e.x,e.y,e.shotAngle+offset,e.dmg,e.ai==='fanbow'?160:115,false,{color:e.ai==='fanbow'?'#d7a7ef':'#9fe0cd'});e.timer=e.ai==='fanbow'?3.4:3;}}else if(e.timer<=0){e.shotAngle=a;e.charge=e.ai==='fanbow'?.8:.65;}break;
   }
   case'frostweb':if(d<150){vx=-vx*.4;vy=-vy*.4;}else if(d<230){vx=0;vy=0;}if(e.timer<=0){e.timer=4.2;this.danger(p.x,p.y,58,0,1.1,3,'frost');}break;
   case'bulwark':if(e.timer<=0)e.timer=4;speed*=e.timer>1.6?.65:1;break;
   case'flank':{const side=Math.sin(e.id)*.9;vx=Math.cos(a+side);vy=Math.sin(a+side);break;}
   case'snake':{const off=Math.sin(e.age*4+e.id)*.8;vx=Math.cos(a+off);vy=Math.sin(a+off);break;}
   case'caster':case'snipe':case'triple':case'link':case'summon':case'healer':case'warder':
    if(d<190){vx=-vx*.55;vy=-vy*.55;}else if(d<270){vx=0;vy=0;}
    if(e.timer<=0){
     e.timer=2.6+this.rng()*.9;
     if(e.ai==='snipe'){e.shotAngle=a;e.charge=.75;}
     else if(e.ai==='caster')this.shoot(e.x,e.y,a,e.dmg,145);
     else if(e.ai==='triple')for(let j=-1;j<=1;j++)this.shoot(e.x,e.y,a+j*.16,e.dmg,175);
     else if(e.ai==='link')this.danger(p.x,p.y,45,e.dmg,.9,2,'ghost');
     else if(e.ai==='summon'){if(e.attacks<4){e.attacks++;this.spawn(0,{x:e.x+20,y:e.y,noDrop:true});}}
     else if(e.ai==='healer'){for(const ally of this.near(e.x,e.y,130))if(!this.isExpedition||(!ally.mission&&!ally.boss))ally.hp=Math.min(ally.maxHp,ally.hp+ally.maxHp*.08);this.pulse(e.x,e.y,'#a9e5c6',90);}
    }
    if(e.ai==='warder')for(const ally of this.near(e.x,e.y,110))ally.defended=true;
    break;
   case'charge':case'dash':
    if(e.timer<=0){e.timer=e.ai==='dash'?2.5:3.8;e.charge=.65;e.chargeA=a;}
    if(e.charge>0){e.charge-=dt;speed=0;if(e.charge<=0)e.rush=.5;}
    if(e.rush>0){e.rush-=dt;vx=Math.cos(e.chargeA);vy=Math.sin(e.chargeA);speed=340;}
    break;
   case'web':if(e.timer<=0){e.timer=3.2;this.danger(p.x,p.y,50,e.dmg*.3,.9,4,'web');}break;
   case'pulse':if(e.timer<=0){e.timer=3.5;for(let j=0;j<8;j++)this.shoot(e.x,e.y,j*TAU/8+e.age*.3,e.dmg,120);}break;
   case'spin':if(d<100&&e.timer<=0){e.timer=3;this.danger(e.x,e.y,70,e.dmg,.7,.3);}break;
   case'suicide':if(d<75&&e.timer>0){e.timer=0;this.danger(e.x,e.y,75,e.dmg,1,.3);e.fuse=1.05;}if(e.fuse!==undefined){speed=0;e.fuse-=dt;if(e.fuse<=0){e.hp=0;e.dead=true;}}break;
   case'blink':if(e.timer<=0){e.timer=4;const nx=clamp(p.x+Math.cos(e.id)*100,35,WORLD.w-35),ny=clamp(p.y+Math.sin(e.id)*100,35,WORLD.h-35);this.danger(nx,ny,35,e.dmg,1,.25);e.teleport={x:nx,y:ny,t:1};}if(e.teleport){e.teleport.t-=dt;if(e.teleport.t<=0){e.x=e.teleport.x;e.y=e.teleport.y;e.teleport=null;}}break;
   case'trail':if(e.timer<=0){e.timer=.8;this.danger(e.x,e.y,20,e.dmg*.4,.4,1.7,'fire');}break;
  }
  if(e.ai==='snipe'&&e.charge>0){e.charge-=dt;if(e.charge<=0)this.shoot(e.x,e.y,e.shotAngle,e.dmg,430);}
  // Soft separation preserves readable crowds without quadratic global checks.
  for(const other of this.near(e.x,e.y,28)){if(other===e)continue;const ox=e.x-other.x,oy=e.y-other.y,od=Math.hypot(ox,oy)||1;if(od<22){vx+=ox/od*.6;vy+=oy/od*.6;}}
  e.x=clamp(e.x+vx*speed*dt,22,WORLD.w-22);e.y=clamp(e.y+vy*speed*dt,22,WORLD.h-22);
  if(d<e.r+12){if(e.focusObject)this.hitObjective?.(e.dmg);else this.hitPlayer(e.dmg);}
 }
 updateBossEnding(e,dt){
  const p=this.player;this.bossEnding=Math.max(0,this.bossEnding-dt);e.timer-=dt;
  if(e.timer<=0){e.timer=.6;this.danger(p.x,p.y,65,e.dmg*1.4,.85,.6,'sacred');}
  if(this.bossEnding<=0){this.bossDefeat(e);e.hp=0;e.dead=true;this.boss=null;this.pulse(e.x,e.y,'#f5e0c7',180);this.endChapter();}
 }
 updateBoss(e,dt,a,d){
  const p=this.player,phase=e.phase||0;e.phaseShield=Math.max(0,(e.phaseShield||0)-dt);
  if(e.timer<=0){
   e.timer=phase?1.6:2.3;e.attacks++;
   if(e.bossType==='serpent'){
    if(e.attacks%3===0){e.charge=.8;e.chargeA=a;}
    else if(e.attacks%3===1)for(let j=-2;j<=2;j++)this.shoot(e.x,e.y,a+j*.22,e.dmg,160,false);
    else for(let j=0;j<3;j++)this.danger(p.x+(j-1)*80,p.y,48,e.dmg,.8,2,'poison');
   }else if(e.bossType==='ghost'){
    if(e.attacks%3===0)for(let j=0;j<5;j++)this.spawn(0);
    else if(e.attacks%3===1)for(let j=0;j<12;j++)this.shoot(e.x,e.y,j*TAU/12+e.age*.2,e.dmg,130);
    else this.danger(p.x,p.y,90,e.dmg*1.3,1,.4,'ghost');
   }else if(e.bossType==='puppet'){
    if(e.attacks%3===0){e.charge=.75;e.chargeA=a;}
    else if(e.attacks%3===1)for(let j=-3;j<=3;j++)this.shoot(e.x,e.y,a+j*.18,e.dmg,220);
    else this.danger(e.x,e.y,170,e.dmg*1.2,1,.4);
   }else if(e.bossType==='seal'){
    for(let j=0;j<4;j++)this.danger(210+j*280,170+(e.attacks%3)*210,65,e.dmg,1.2,.4,'ghost');
    if(e.attacks%3===0)this.spawn(10);
   }else if(e.bossType==='xuangu'){
    if(e.attacks%3===0){for(let j=0;j<10;j++)this.shoot(e.x,e.y,j*TAU/10+e.age*.1,e.dmg,150,false,{color:'#b5d8fa'});}
    else if(e.attacks%3===1){for(let j=0;j<3+phase;j++)this.danger(clamp(p.x+(j-1)*100,60,1220),p.y,65,e.dmg*1.2,1,1,'sacred');}
    else{this.spawn(11);this.spawn(0);this.danger(p.x,p.y,100,e.dmg,1.2,.6,'ghost');}
   }
  }
  let move=e.bossType==='seal'?0:d>160?e.speed:0;
  if(e.charge>0){e.charge-=dt;move=0;if(e.charge<=0)e.rush=.8;}
  if(e.rush>0){e.rush-=dt;a=e.chargeA;move=370;}
  e.x=clamp(e.x+Math.cos(a)*move*dt,60,WORLD.w-60);e.y=clamp(e.y+Math.sin(a)*move*dt,70,WORLD.h-60);
  if(d<e.r+12)this.hitPlayer(e.dmg*1.2);
 }
 swordDamage(e){const s=this.stats,p=this.player;let m=1+(s.damage||0)+Math.floor(Math.min(72,this.level)/12)*(s.swordScale||0);
  if(p.hp/p.maxHp>.7)m+=s.healthyDamage||0;if(p.hp/p.maxHp<.35)m+=s.lowDamage||0;
  if(this.time-this.thunderTime<afterThunderWindow(this))m+=(s.afterThunder||0)+(this.rulesVersion>=2&&this.path===1?.25:0);if(p.mana>=100)m+=s.fullMana||0;
  if(e?.burn>0)m+=s.burnBonus||0;if(p.buffs.damage>this.time)m+=.35;
  if(this.comboSet.has('swordGuard')&&this.time-p.lastDash<3)m+=.3;return (12+this.level*.06)*m;
 }
 updateSwords(dt){
  const p=this.player,s=this.stats,n=this.swords.length,formation=this.formation||0,phase=this.modeState;
  for(let i=0;i<n;i++){
   const sw=this.swords[i];sw.px=sw.x;sw.py=sw.y;sw.cool-=dt;sw.life-=dt;
   const angle=this.time*(formation===1?1.5:.5)+i*TAU/n,ring=formation===1?(90+Math.floor(i/18)*24)*(this.orbitMultiplier?.()??1):48+Math.floor(i/16)*15;
   if(!sw.target||sw.target.hp<=0||sw.life<=0){
    sw.target=null;
    if(sw.cool<=0){
     let candidates=this.near(p.x,p.y,formation===1?Math.max(320*(1+(s.range||0)),ring+90*(this.orbitMultiplier?.()??1)):320*(1+(s.range||0)));
     if(formation===1)candidates=candidates.filter(e=>dist(p,e)<ring+90*(this.orbitMultiplier?.()??1));
     if(this.input.focus&&this.input.aim)candidates.sort((a,b)=>dist(a,this.input.aim)-dist(b,this.input.aim));
     else candidates.sort((a,b)=>(dist(a,p)+(a.assigned||0)*45)-(dist(b,p)+(b.assigned||0)*45));
     const e=candidates[Math.min(candidates.length-1,formation===2||directFocus(this)?0:i%Math.min(3,candidates.length))];
     if(e){this.onSwordLaunch?.(sw);practiceSwordLaunch(this,e);sw.target=e;e.assigned=(e.assigned||0)+1;sw.life=1.4;sw.hits=[];sw.pierce=Math.floor(s.pierce||0)+(formation===2?1:0)+(s.metaSwordPierce&&i%3===2?1:0);sw.cool=Math.max(.22,1.05/(1+(s.haste||0)+(p.buffs.metaSwordTempo>this.time?.12:0)+(this.time-p.lastKill<2?(s.killHaste||0):0)));}
    }
   }
   let tx=p.x+Math.cos(angle)*ring,ty=p.y+Math.sin(angle)*ring;
   const returning=!sw.target;if(sw.target){tx=sw.target.x;ty=sw.target.y;}
   const dx=tx-sw.x,dy=ty-sw.y,d=Math.hypot(dx,dy)||1,speed=(sw.target?620:400)*(1+(s.swordSpeed||0));
   sw.a=Math.atan2(dy,dx);const travel=Math.min(d,speed*dt);sw.x+=dx/d*travel;sw.y+=dy/d*travel;
   if(returning&&travel>0){this.onSwordReturn?.(sw,travel>=d);if(this.modeState!==phase||this.finished)return;}
   if(sw.target&&d<sw.target.r+travel+6){
    const e=sw.target;if(!sw.hits.includes(e.id)){const result=this.hit(e,this.swordDamage(e),'sword');if(this.modeState!==phase||this.finished)return;if(result?.empowered)sw.pierce++;sw.hits.push(e.id);if(!(this.practice?.step===2&&e.practiceAnchor)&&!e.boss&&e.mission!=='rune'&&!(this.practice?.step===5&&e.practiceTarget)){e.x=clamp(e.x+dx/d*5*(1+(s.knock||0)),20,1260);e.y=clamp(e.y+dy/d*5*(1+(s.knock||0)),20,780);}}
    if(sw.pierce>0){sw.pierce--;sw.target=this.nearest(sw.x,sw.y,130,sw.hits);}else sw.target=null;
   }
  }
 }
 sigilLiveTargets(z){return (phase3Balance(this)?sigilTargets(this,z):this.near(z.x,z.y,z.r)).filter(e=>!e.untargetable&&!e.phaseShield&&!(e.bossType==='xuangu'&&this.bossEnding>0));}
 allyTarget(x,y,r){if(this.rulesVersion>=2&&this.input.focus&&this.input.aim){let target=null,best=Infinity;for(const e of this.near(x,y,r)){const d=dist(e,this.input.aim);if(d<best){best=d;target=e;}}return target;}return this.nearest(x,y,r);}
 updateAllies(dt){
  const p=this.player,s=this.stats,phase=this.modeState;const wanted=Math.min(12,(s.puppets||0)+(p.buffs.puppet>this.time?1:0));
  while(this.puppets.length<wanted)this.puppets.push({x:p.x,y:p.y,cool:this.rng()});
  this.puppets.length=wanted;
  for(let i=0;i<wanted;i++){const a=this.puppets[i],ang=i*TAU/wanted+this.time*.15;a.x+=(p.x+Math.cos(ang)*90-a.x)*Math.min(1,dt*3*(1+(s.metaPuppetFollow||0)));a.y+=(p.y+Math.sin(ang)*70-a.y)*Math.min(1,dt*3*(1+(s.metaPuppetFollow||0)));a.cool-=dt;
   if(a.cool<=0){const e=this.allyTarget(a.x,a.y,420*(1+(s.puppetRange||0)),{kind:'puppet',index:i});if(e){let dmg=(20+this.level*.4)*allyBaseScale(this,'puppet')*(1+(s.puppetDamage||0)+(stationaryActive(this)?(s.stationary||0):0));if(this.comboSet.has('swordPuppet'))dmg*=1+swordPuppetInherit(this,s.damage);if(e.mark)dmg*=1+(s.puppetMark||0);a.metaShots=(a.metaShots||0)+1;dmg*=this.puppetDamageMultiplier?.()??1;this.shoot(a.x,a.y,Math.atan2(e.y-a.y,e.x-a.x),dmg,520,true,{pierce:Math.floor(s.puppetPierce||0),color:s.metaPuppetPin&&a.metaShots%6===0?'#e7d398':'#a8c5fa',metaPin:!!s.metaPuppetPin&&a.metaShots%6===0});this.onPuppetShot?.(a,e,dmg,i);a.cool=.7/(1+(s.puppetHaste||0)+(this.puppetHasteBonus?.()??(this.rulesVersion>=2&&this.path===2&&puppetReady(this)?.25:0))+(this.comboSet.has('thunderPuppet')&&this.time-this.thunderTime<6?.65:0));}}
  }
  const bugs=Math.min(30,(s.insects||0)+(s.breed?Math.min(6,Math.floor(this.kills/25)):0)+(p.buffs.insect>this.time?4:0));
  while(this.insects.length<bugs)this.insects.push({x:p.x,y:p.y,cool:this.rng()});this.insects.length=bugs;
  // Balance 4: a bug farther than the leash from Han Li drops its own 250 search and looks around him; while he is explicitly focusing, the search around him (nearest to the aim) is tried first and the local search only fills in when nothing is within 350 of him. K07/K08 keep their own rule inside allyTarget; nothing widens the 250/350 radii.
  const leash=insectLeash(this);this.insectPursuits=[];for(let i=0;i<bugs;i++){const b=this.insects[i];b.cool-=dt;const local=()=>this.allyTarget(b.x,b.y,250*(1+(s.metaInsectRange||0)),{kind:'insect',index:i}),around=()=>this.allyTarget(p.x,p.y,350*(1+(s.metaInsectRange||0)),{kind:'insect',index:i});let e;if(dist(b,p)>leash)e=around();else if(insectFocusFirst(this)&&this.input.focus&&this.input.aim)e=around()||local();else e=local()||around();let tx=p.x+Math.cos(i*2.4+this.time)*55,ty=p.y+Math.sin(i*2.4+this.time)*55;if(e){this.insectPursuits.push(e.id);tx=e.x+Math.cos(i*2.4)*12;ty=e.y+Math.sin(i*2.4)*10;}
   const d=Math.hypot(tx-b.x,ty-b.y)||1,v=Math.min(d,220*(1+(s.insectSpeed||0))*dt);b.x+=(tx-b.x)/d*v;b.y+=(ty-b.y)/d*v;
   if(e&&d<e.r+12&&b.cool<=0){let dmg=(8+this.level*.18)*allyBaseScale(this,'insect')*(1+(s.insectDamage||0));if(e.boss||e.elite)dmg*=1+(s.insectBoss||0);if(e.mark)dmg*=1+(s.insectMark||0);if(this.comboSet.has('swordInsect')&&this.rng()<.2)dmg*=1.8;const hp=e.hp;this.hit(e,dmg,'insect');if(this.modeState!==phase||this.finished)return;if(e.hp<hp){if(this.rulesVersion>=2&&this.path===3){e.gnaw=Math.min(.12,(e.gnawUntil>this.time?e.gnaw||0:0)+.02);e.gnawUntil=this.time+3+(s.metaGnawDuration||0);if(e.gnaw>=.12&&!(this.cueTimers['gnaw:'+e.id]>this.time)){this.cueTimers['gnaw:'+e.id]=this.time+30;this.cue('gnaw','噬甲已满 · 受伤 +12%','#dab4ff');}}e.break=Math.min(.5,e.break+(s.insectBreak||0));if(s.insectMana&&this.rng()<s.insectMana)p.mana=Math.min(100,p.mana+1);}b.cool=.65/(1+(s.insectHaste||0));}
  }
 }
 update(dt){
  if(this.modeState!=='battle'||this.finished)return;dt=Math.min(dt,.05);this.time+=dt;this.waveTime+=dt;const p=this.player,s=this.stats;
  const previousTime=this.time-dt;for(const [key,name] of [['insect','灵虫诱饵结束 · 临时增员退场'],['puppet','备用傀儡结束 · 临时增员退场']])if(p.buffs[key]>previousTime&&p.buffs[key]<=this.time)this.cue('expire-'+key,name,key==='insect'?'#e2c57b':'#a9ddec');
  p.invuln=Math.max(0,p.invuln-dt);p.dashCD=Math.max(0,p.dashCD-dt);p.dash-=dt;
  tickDashInput(this);
  let ix=this.input.x,iy=this.input.y;const len=Math.hypot(ix,iy);if(len>1){ix/=len;iy/=len;}p.moving=len>.05;this.stillTime=p.moving?0:(this.stillTime||0)+dt;if(phase3Balance(this)&&this.stillTime>=.6)this.setupUntil=this.time+.3;
  if(p.moving&&p.dash<=0){p.dx=ix/(len||1);p.dy=iy/(len||1);}
  let speed=175*(1+(s.speed||0)+(p.buffs.speed>this.time?.35:0)+(this.movementBonus?.()||0));
  if(p.dash>0){speed=700;ix=p.dx;iy=p.dy;this.fx.push({kind:'afterimage',x:p.x,y:p.y,ttl:.2,max:.2});}
  if(p.webSlow>0){speed*=.6;p.webSlow-=dt;}
  p.x=clamp(p.x+ix*speed*dt,30,WORLD.w-30);p.y=clamp(p.y+iy*speed*dt,40,WORLD.h-30);
  p.mana=Math.min(100,p.mana+dt*(100/30)*(1+(s.manaRegen||0)+(this.time-p.lastHit>6?(s.safeMana||0):0)));
  p.hp=Math.min(p.maxHp,p.hp+dt*((s.regen||0)+(p.buffs.regen>this.time?3:0))*(this.comboSet.has('fireGuard')?1.3:1));
  if(this.time-p.lastHit>(this.rulesVersion>=2&&this.path===5?4:5)&&p.shield<p.maxShield)p.shield=Math.min(p.maxShield,p.shield+dt*(s.shieldRegen||0));
  this.rebuildHash();
  if(this.updateDirector)this.updateDirector(dt);
  else if(this.wave<3||this.mode==='training'){
   const pulse=1+Math.sin(this.waveTime*.13)*.32;this.spawnBudget+=dt*(2.4+.368*this.time/60)*pulse*(this.risk?1.2:1);
   const ch=CHAPTERS[this.chapter];
   while(this.spawnBudget>=1&&this.enemies.length<250){const type=ch.enemies[Math.floor(this.rng()*ch.enemies.length)],cost=ENEMIES[type].cost;if(this.spawnBudget<cost)break;this.spawnBudget-=cost;const ranged=['snipe','caster','healer','summon','warder','triple','link'];const rangedCount=this.enemies.filter(e=>ranged.includes(e.ai)).length;if(ranged.includes(ENEMIES[type].ai)&&rangedCount>=Math.max(4,this.enemies.length*.3))this.spawn(ch.enemies[0]);else this.spawn(type);}
   if(this.waveTime>this.nextElite){this.spawn(ch.enemies[Math.floor(this.rng()*ch.enemies.length)],{elite:true});this.nextElite+=35;}
   if(this.waveTime>=55&&this.mode!=='training')this.endWave();
  }else if(this.boss?.type==='seal'){
   const q=this.mechanism;if(dist(p,q)<q.r){q.progress+=dt;this.boss.hp=q.goal-q.progress;if(Math.floor(q.progress/14)>q.step&&q.progress<q.goal){q.step++;q.x=[430,850,640][q.step];q.y=[400,430,260][q.step];this.toast('灵息已敛 · 转入下一阵位');}}
   if(this.waveTime%3<dt){const q=this.mechanism;this.danger(q.x+(this.rng()-.5)*120,q.y+(this.rng()-.5)*100,44,13*this.difficulty.damage,1.1,.6,'ghost');}
   if(q.progress>=q.goal){this.boss=null;this.mechanism=null;this.endChapter();}
  }else if(this.boss?.type==='swarm'){
   this.boss.timer-=dt;this.boss.hp=this.boss.timer;this.spawnBudget+=dt*8;
   while(this.spawnBudget>=1){this.spawnBudget--;this.spawn(this.rng()<.7?6:21);}
   if(this.boss.timer<=0){this.boss=null;this.endChapter();}
  }else if(this.boss&&this.waveTime%5<dt&&this.enemies.length<60){this.spawn(CHAPTERS[this.chapter].enemies[Math.floor(this.rng()*3)]);}
  if(this.modeState!=='battle')return;
  for(const e of this.enemies)e.defended=false;for(const e of this.enemies){e.assigned=0;this.attackOrigin={name:e.name,x:e.x,y:e.y};try{this.updateEnemy(e,dt);}finally{this.attackOrigin=null;}if(this.modeState!=='battle')return;}
  if(this.modeState!=='battle')return;
  this.rebuildHash();updateTouchLock(this);this.updateSwords(dt);if(this.isExpedition&&this.modeState!=='battle')return;this.updateAllies(dt);if(this.isExpedition&&this.modeState!=='battle')return;this.updateEnvironment(dt);
  if(s.chain&&this.time-this.lastChain>3){this.lastChain=this.time;const e=this.nearest(p.x,p.y,400);if(e){let from=p;for(const target of this.near(e.x,e.y,160).slice(0,2+s.chain)){this.hit(target,(20+this.level*.5)*s.chain,'thunder');if(this.modeState!=='battle')return;this.fx.push({kind:'line',x:from.x,y:from.y,tx:target.x,ty:target.y,color:'#eddb91',ttl:.2,max:.2});from=target;}}}
  if(s.ward&&this.time-this.lastWard>7){this.lastWard=this.time;this.zones.push({x:p.x,y:p.y,r:80*(this.comboSet.has('fireGuard')?1.4:1),ttl:5,warn:0,kind:'ward',friendly:true,damage:2});}
  for(const b of this.shots){b.ttl-=dt;b.px=b.x;b.py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
   if(b.friendly){for(const e of this.near(b.x,b.y,35)){if(!b.hits.includes(e.id)&&dist(e,b)<e.r+8){const hpBefore=e.hp;this.hit(e,b.damage,b.source);if(this.modeState!=='battle')return;if(b.metaPin&&!e.boss&&e.hp<hpBefore&&this.time>=(e.metaPinUntil||0)){e.stun=Math.max(e.stun,.5);e.metaPinUntil=this.time+2;this.pinCue();}b.hits.push(e.id);if(s.puppetSlow){applySlow(e,'puppet',s.puppetSlow,1.5);}if(s.puppetKnock&&!e.boss&&e.mission!=='rune'){e.x+=b.vx/520*12*s.puppetKnock;e.y+=b.vy/520*12*s.puppetKnock;}if(b.hits.length>b.pierce){b.ttl=0;break;}}}
   }else if(this.objective?.kind==='defend'&&dist(b,this.objective)<34){this.hitObjective?.(b.damage,{...(b.origin||{name:'旧弹幕'}),x:b.px,y:b.py,kind:'弹幕'});b.ttl=0;}else if(dist(b,p)<17){this.hitPlayer(b.damage,false,{...(b.origin||{name:'旧弹幕'}),x:b.px,y:b.py,kind:'弹幕'});b.ttl=0;}
   if(this.modeState!=='battle')return;
  }
  this.shots=this.shots.filter(b=>b.ttl>0&&b.x>-20&&b.y>-20&&b.x<WORLD.w+20&&b.y<WORLD.h+20);
  for(const z of this.zones){z.ttl-=dt;z.warn-=dt;if(z.arming!==undefined){const wasArming=z.arming>0;z.arming=Math.max(0,z.arming-dt);if(!z.twin&&!z.fired&&(wasArming||z.arming===0)){const live=this.sigilLiveTargets(z);if(wasArming&&z.armedTargets!==undefined)z.armedTargets=Math.max(z.armedTargets,live.length);if(z.arming===0){if(live.length)z.warn=0;else if(wasArming&&z.armedTargets>0&&this.kills>z.killsAtArming)z.cleared=true;}}}if(z.warn>0)continue;
   if(z.sigil){if(!z.fired){z.fired=true;this.fx.push({kind:'sigilBurst',x:z.x,y:z.y,r:z.r,color:z.metaEcho?'#d4afff':'#ffbd78',ttl:.65,max:.65});const record=beginSigil(this,z);this.sigilObservation=record;try{this.explode(z.x,z.y,z.r,z.damage,'fire',record.kind);}finally{this.sigilObservation=null;}this.emit({type:'sigil',record:{...record}});if(record.hits||record.blocked){this.cue(record.kind,(z.metaEcho?'复燃回响':'起点符阵')+' · '+(record.hits?'命中 '+record.hits+' · 击杀 '+record.kills:'被护势／不可伤阻挡 '+record.blocked),z.metaEcho?'#d4afff':'#ffbd78');}else if(!z.metaEcho){if(record.cleared)this.cue('sigil-cleared','引敌目标已被清场 · 不计纯落空','#c9c4ae');else if(emptySigilStreak(this.sigilStats)===3)this.cue('sigil-tip','把追兵引入符阵；靠近后向外闪避','#c9c4ae');}if(this.modeState!=='battle')return;this.onSigilDetonate?.(z);if(this.modeState!=='battle')return;z.ttl=.28;}continue;}
   if(z.friendly){for(const e of this.near(z.x,z.y,z.r)){if(z.kind==='ward'){applySlow(e,'ward',.5,.4);}else{this.hit(e,z.damage*dt,'fire',false,z.fireKind||'other');if(this.modeState!=='battle')return;if(z.slow){applySlow(e,'ember',z.slow,.4);}}}if(z.kind==='ward'&&dist(z,p)<z.r&&p.shield<p.maxShield)p.shield=Math.min(p.maxShield,p.shield+dt*(s.wardShield||0));}
   else if(dist(z,p)<z.r){if(z.kind==='web'||z.kind==='frost')p.webSlow=.4;else this.hitPlayer(z.damage,true,{...(z.origin||{name:'场地危险'}),x:z.x,y:z.y,kind:'险地'});}
  }
  if(this.modeState!=='battle')return;
  this.zones=this.zones.filter(z=>z.ttl>0);
  for(const drop of this.drops){drop.life+=dt;const d=dist(drop,p);if(d<85*(1+(s.magnet||0))||drop.pull){drop.pull=true;const v=Math.min(d,(230+drop.life*10)*dt);drop.x+=(p.x-drop.x)/(d||1)*v;drop.y+=(p.y-drop.y)/(d||1)*v;if(d<20){this.collectDrop(drop);}}}
  this.drops=this.drops.filter(x=>!x.done);if(this.drops.length>500){const extra=this.drops.splice(0,200);this.drops.push(this.mergeDrops(extra));}
  for(const fx of this.fx)fx.ttl-=dt;this.fx=this.fx.filter(f=>f.ttl>0);this.enemies=this.enemies.filter(e=>e.hp>0);
  if(this.rulesVersion>=2&&p.mana>=100&&!this.notices.has('mana')){this.notices.add('mana');const ready=this.thunderReadiness();this.toast(ready.ready?'灵力已满 · 辟邪神雷可以施放':'灵力已满 · 雷源不足，还缺 '+Number((ready.cost-p.reserve).toFixed(1))); }
  if(this.queuedChoices&&this.modeState==='battle')this.openChoices();
  this.uiTimer+=dt;if(this.uiTimer>.12){this.uiTimer=0;this.emit({type:'update'});}
 }
 updateEnvironment(dt){
  if(this.modeState!=='battle')return;
  const p=this.player,layout=layoutFor(this);
  if(this.wave<3&&this.waveTime>=this.nextHazard){
   this.nextHazard+=this.chapter===2?5.5:8;
   const kind=this.chapter===2?'fire':this.chapter===1?'ghost':this.chapter===0?'poison':'blast';
   for(const [x,y]of hazardPoints(layout.variant,this.hazardTick++))this.danger(x,y,this.chapter===2?64:51,(8+this.chapter*2)*this.difficulty.damage,1.3,1.8,kind);
  }
  const def=MID_ENCOUNTERS[this.chapter];
  if(def&&this.wave===1&&!this.midEncounter&&this.waveTime>8){this.midEncounter={...def,x:this.chapter===1?760:520,y:440,r:95,progress:0,goal:12,done:false};this.toast(def.name+' · 进入青色阵位，累计停留 12 秒');}
  const q=this.midEncounter;if(q&&!q.done&&dist(p,q)<q.r){q.progress+=dt;if(q.progress>=q.goal){q.done=true;this.gold+=this.chapter===1?60:80;this.queuedChoices++;this.player.shield+=15;this.toast(q.name+' · 已完成');}}
 }
 collectDrop(d){if(d.done)return;this.addXP(d.value);this.gold+=d.gold;if(d.heal)this.player.hp=Math.min(this.player.maxHp,this.player.hp+d.heal);d.done=true;}
 mergeDrops(extra){const d=extra[0];d.value=extra.reduce((a,b)=>a+b.value,0);d.gold=extra.reduce((a,b)=>a+b.gold,0);return d;}
 collectAll(){let xp=0,gold=0;for(const d of this.drops){xp+=d.value;gold+=d.gold;if(d.heal)this.player.hp=Math.min(this.player.maxHp,this.player.hp+d.heal);}this.drops=[];this.addXP(xp);this.gold+=gold;}
 endWave(){
  this.collectAll();this.enemies=[];this.shots=[];this.zones=[];this.wave++;this.waveTime=0;this.nextElite=35;this.nextHazard=12;this.midEncounter=null;
  if(this.wave===3){this.spawnBoss();return;}
  this.modeState='rest';this.scene=this.wave===1?'event':'shop';this.risk=false;
  this.shopRolls=0;this.purchased=[];this.makeShop();this.eventIndex=Math.floor(this.rng()*24);
  this.emit({type:'checkpoint',checkpoint:this.serialize()});this.emit({type:'scene',scene:this.scene});
 }
 endChapter(){
  if(this.modeState!=='battle')return;this.collectAll();this.enemies=[];this.shots=[];this.zones=[];this.mechanism=null;
  this.modeState='chapterEnd';this.scene='chapterEnd';this.gold+=80+this.chapter*25;
  this.emit({type:'chapter',chapter:this.chapter});this.emit({type:'scene',scene:'chapterEnd'});
 }
 nextChapter(){
  if(this.chapter>=5){if(this.mode==='endless'){this.chapter=0;this.endlessLoop=(this.endlessLoop||0)+1;this.difficulty={...this.difficulty,hp:this.difficulty.hp*1.4,damage:this.difficulty.damage*1.12};}else{this.finish(true);return;}}
  else this.chapter++;
  this.wave=0;this.waveTime=0;this.nextElite=40;this.nextHazard=12;this.midEncounter=null;this.bossEnding=0;this.player.revived=false;this.player.hp=Math.min(this.player.maxHp,this.player.hp+this.player.maxHp*.3);this.player.reserve=this.player.maxReserve;
  this.grantStoryItems();this.modeState='intro';this.scene='intro';this.emit({type:'checkpoint',checkpoint:this.serialize()});this.emit({type:'scene',scene:'intro'});
 }
 grantStoryItems(){
  const ids=this.chapter>=4?['lingxi','icepearl','five-rings','cape','weeping']:this.chapter>=3?['lingxi','icepearl','weeping']:this.chapter>=2?['lingxi','icepearl']:[];
  this.storyInventory=[...(this.storyInventory||[]),...ids].filter((v,i,a)=>a.indexOf(v)===i);
 }
 continueRest(){this.scene=null;this.modeState='battle';this.emit({type:'checkpoint',checkpoint:this.serialize()});this.emit({type:'scene',scene:null});this.toast('第 '+(this.wave+1)+' 波 · 灵息渐急');}
 makeShop(){
  const held=new Set([...this.relics,...this.locked.map(x=>x.id)]);const pool=RELICS.filter(r=>!held.has(r.id)&&(!r.story||(this.storyInventory||[]).includes(r.id)));
  const picks=[...this.locked];if(picks.length<2){const match=pool.findIndex(r=>r.path===this.path);if(match>=0){const r=pool.splice(match,1)[0];picks.push({...r,kind:'relic',price:55+this.chapter*14});}}while(picks.length<3&&pool.length){const r=pool.splice(Math.floor(this.rng()*pool.length),1)[0];picks.push({...r,kind:'relic',price:55+this.chapter*14+(r.story?25:0)});}
  const preferred=revisedBalance(this)?[null,'mana','puppet','insect','fire',expandedContent(this)?'shield':'guard'][this.path]:null,weights=CONSUMABLES.map(c=>c.id===preferred?3:1);let roll=this.rng()*weights.reduce((a,b)=>a+b,0),index=0;for(;index<weights.length-1;index++){roll-=weights[index];if(roll<0)break;}const c=CONSUMABLES[index];picks.push({...c,kind:'consumable',price:c.price+this.chapter*4});this.shop=picks;
 }
 buy(index,replace=-1){
  if(this.modeState!=='rest'||!Number.isInteger(index)||index<0||!Number.isInteger(replace)||replace< -1)return false;const r=this.shop?.[index];if(!r||this.gold<r.price||this.purchased.includes(r.id)||replace>=0&&replace>=(r.kind==='relic'?this.relics.length:this.consumables.length))return false;
  if(r.kind==='relic'){if(this.relics.includes(r.id))return false;if(this.relics.length>=6){if(replace<0)return 'replace';if(replace>=this.relics.length)return false;this.relics.splice(replace,1);}this.relics.push(r.id);this.recalc();}
  else if(!this.addConsumable(r.id)){if(replace<0)return 'slots';if(replace>=this.consumables.length)return false;this.consumables[replace]={id:r.id,count:1};}
  this.gold-=r.price;this.purchased.push(r.id);this.locked=this.locked.filter(x=>x.id!==r.id);this.emit({type:'sound',name:'choose'});this.emit({type:'update'});return true;
 }
 sell(index){if(this.modeState!=='rest'||!Number.isInteger(index)||index<0||index>=this.relics.length)return;this.relics.splice(index,1);this.gold+=25;this.recalc();this.emit({type:'update'});}
 shopReadiness(){const price=10+this.shopRolls*8;return {price,ready:this.gold>=price,missing:Math.max(0,price-this.gold)};}
 refreshShop(){const {price,missing}=this.shopReadiness();if(this.modeState!=='rest')return false;if(missing>0){this.toast('灵石不足 · 更换货架还缺 '+missing+' 灵石');return false;}this.gold-=price;this.shopRolls++;this.makeShop();this.purchased=[];this.emit({type:'update'});return true;}
 toggleLock(index){const r=this.shop[index];if(!r||r.kind!=='relic')return;if(this.locked.some(x=>x.id===r.id))this.locked=this.locked.filter(x=>x.id!==r.id);else if(this.locked.length<2)this.locked.push(r);this.emit({type:'update'});}
 chooseEvent(effect){
  if(this.modeState!=='rest'||!EVENTS[this.eventIndex]?.choices.some(c=>c.effect===effect))return;
  const p=this.player;
  const items={medicine:'heal',sparePuppet:'puppet',fireItem:'fire',insectItem:'insect',magnetItem:'magnet',buyGuard:'guard'};
  if(items[effect]){if(effect==='buyGuard'&&this.gold<25){this.toast('灵石不足');return;}if(!this.addConsumable(items[effect])){this.toast('药囊已满，请选择其他收获');return;}if(effect==='buyGuard')this.gold-=25;}
  if(effect==='mana')p.mana=Math.min(100,p.mana+50);if(effect==='reroll')this.rerolls++;if(effect==='smallGold')this.gold+=30;if(effect==='escape'){p.dashCD=0;p.shield+=15;}
  if(effect==='gold')this.gold+=45;if(effect==='heal')p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.2);if(effect==='xp')this.addXP(xpCostFor(this,this.level)*.7);if(effect==='shield')p.shield+=25;
  if(effect==='riskGold'){p.hp=Math.max(1,p.hp*.88);this.gold+=100;}
  if(effect==='buyHeal'){if(this.gold<35){this.toast('灵石不足');return;}this.gold-=35;p.hp=Math.min(p.maxHp,p.hp+p.maxHp*.45);}
  if(effect==='riskTrait'){this.risk=true;this.queuedChoices++;}
  if(effect==='riskRelic'){p.hp=Math.max(1,p.hp*.8);const candidates=RELICS.filter(r=>!r.story&&!this.relics.includes(r.id));if(this.relics.length<6&&candidates.length){this.relics.push(candidates[Math.floor(this.rng()*candidates.length)].id);this.recalc();}else this.gold+=70;}
  this.continueRest();
 }
 serialize(){return {notices:[...this.notices],lastSigil:this.lastSigil,lastCounter:this.lastCounter,risk:!!this.risk,layoutOffset:this.layoutOffset,formation:this.formation||0,locked:this.locked,version:1,options:this.options,seed:this.seed,rng:this.rng.state(),chapter:this.chapter,wave:this.wave,time:this.time,level:this.level,xp:this.xp,totalXP:this.totalXP,gold:this.gold,kills:this.kills,thunders:this.thunders,hitCount:this.hitCount,traits:{...this.traits},relics:[...this.relics],consumables:this.consumables.map(c=>({...c})),player:{...this.player,buffs:{...this.player.buffs}},rerolls:this.rerolls,queuedChoices:this.queuedChoices,scene:this.scene,modeState:this.modeState,damageSources:{...this.damageSources},fireBreakdown:{...this.fireBreakdown},sigilStats:structuredClone(this.sigilStats),recentHits:this.recentHits.map(h=>({...h})),storyInventory:[...(this.storyInventory||[])],endlessLoop:this.endlessLoop||0};}
 static restore(data,emit){
  validateCommonSnapshot(data);
  if(data?.version!==1||!Number.isFinite(data.level)||data.level<1||data.level>160||!Number.isInteger(data.chapter)||data.chapter<0||data.chapter>5)throw Error('存档格式不兼容');
  if(!data.options||!Number.isInteger(data.options.path??0)||(data.options.path??0)<0||(data.options.path??0)>5||!Number.isInteger(data.options.difficulty??0)||(data.options.difficulty??0)<0||(data.options.difficulty??0)>2)throw Error('存档配置无效');
  if(!Number.isInteger(data.wave)||data.wave<0||data.wave>3||!data.player||!data.traits||!Array.isArray(data.relics)||data.relics.length>6||!Array.isArray(data.consumables)||data.consumables.length>2)throw Error('存档配置无效');
  for(const key of ['time','xp','totalXP','gold','kills','thunders','hitCount','rerolls','queuedChoices'])if(!Number.isFinite(data[key])||data[key]<0)throw Error('存档数值无效');
  for(const key of ['hp','mana','reserve','shield'])if(!Number.isFinite(data.player[key])||data.player[key]<0)throw Error('存档资源无效');
  if(Object.entries(data.traits).some(([id,n])=>!TRAITS.some(t=>t.id===id)||!Number.isInteger(n)||n<1||n>3)||data.relics.some(id=>!RELICS.some(r=>r.id===id))||data.consumables.some(c=>!CONSUMABLES.some(x=>x.id===c.id)||!Number.isInteger(c.count)||c.count<0))throw Error('存档条目无效');
  if(data.options.metaRulesVersion!==undefined&&![1,2,3].includes(data.options.metaRulesVersion))throw Error('洞府规则版本不兼容');
  if(data.options.rulesVersion!==undefined&&![1,2].includes(data.options.rulesVersion))throw Error('起手规则版本不兼容');
  if(!Number.isFinite(data.player.dx)||!Number.isFinite(data.player.dy))throw Error('存档方向数据无效');
  if(data.damageSources!==undefined&&(!data.damageSources||typeof data.damageSources!=='object'||Array.isArray(data.damageSources)||Object.values(data.damageSources).some(n=>!Number.isFinite(n)||n<0)))throw Error('存档统计无效');
  if(data.storyInventory!==undefined&&(!Array.isArray(data.storyInventory)||data.storyInventory.some(id=>!RELICS.some(r=>r.id===id))))throw Error('剧情物品记录无效');
  if(data.locked!==undefined&&(!Array.isArray(data.locked)||data.locked.length>2||data.locked.some(r=>!r||!RELICS.some(x=>x.id===r.id)||!Number.isFinite(r.price)||r.price<0)))throw Error('整备锁定记录无效');
  const b=new Battle({...data.options,chapter:0,rulesVersion:data.options.rulesVersion??1},emit);restoreFeedback(b,data);for(const k of ['chapter','wave','time','level','xp','totalXP','gold','kills','thunders','hitCount','traits','relics','consumables','rerolls','queuedChoices','damageSources','storyInventory','endlessLoop','layoutOffset','formation','locked','risk','lastSigil','lastCounter'])if(data[k]!==undefined)b[k]=structuredClone(data[k]);
  if(b.endlessLoop)b.difficulty={...b.difficulty,hp:b.difficulty.hp*1.4**b.endlessLoop,damage:b.difficulty.damage*1.12**b.endlessLoop};b.stats={};b.recalc();b.player={...b.player,...data.player,x:WORLD.w/2,y:WORLD.h/2,invuln:1,dash:0,dashCD:0,buffs:{}};b.recalc();b.rng.set(data.rng);b.syncSwords();
  b.locked=(b.locked||[]).map(r=>({...RELICS.find(v=>v.id===r.id),kind:'relic',price:r.price}));b.notices=new Set(data.notices||[]);b.modeState='intro';b.scene='intro';b.resuming=true;return b;
 }
}
