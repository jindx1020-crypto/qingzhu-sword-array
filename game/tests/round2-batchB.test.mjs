/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Round-2 ten-player test remediation · batch B (B-0…B-10). B-0 parity first, then one or more cases per package.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Expedition as FrozenExpedition} from '../scripts/fixtures/pre-balance4/expedition.js';
import {Expedition} from '../gameplay/expedition.js';
import {initialSave,TRAITS,DIFFICULTIES,ENEMIES,xpCost,PATHS} from '../gameplay/data.js';
import {BALANCE_VERSION,BALANCE4,STARTER_EXTRAS,dashCooldown,sigilCooldown,sigilGrowth,sigilWarn,starterExtras,reserveFor,traitMods,traitText,afterThunderWindow,enemyDamageScale,allyBaseScale,insectLeash,guardCounterScale,swordPuppetInherit,fireGuardShield,reserveRestoration,reserveRestBase,levelHpBonus} from '../gameplay/balance.js';
import {GROWTH_VERSION,GROWTH5,XP_V5,xpCostFor,growthChoices,traitReadiness,goalGrowth} from '../gameplay/growth-rules.js';
import {ENCOUNTER_VERSION,ENCOUNTER8,mechanismProfile,mechanismLimit,defendHP,defendLocked,bossHP,extendedEncounter} from '../gameplay/director-rules.js';
import {CHALLENGE_VERSION,CHALLENGE2,loopScale,endlessAutoSkip,challenged,currentChallenge,experienceDetails,validateExperienceEntry} from '../gameplay/experience-rules.js';
import {recordGroup,withProgressRecord,normalizeRecords} from '../gameplay/records.js';import {CURRENT_RECORD_RULES,currentRecordEntry} from '../gameplay/record-browser.js';
import {normalizeSave} from '../gameplay/save-store.js';
import {statSources} from '../gameplay/stat-sources.js';
import {starterDetails,starterStatus} from '../gameplay/starters.js';
import {traitDescription} from '../gameplay/descriptions.js';
import {comboDescription,traitComboBenefit,swordPuppetBonus} from '../gameplay/combo-description.js';
import {COMBOS} from '../gameplay/data.js';
import {fixtureRows,OLD_COMBOS} from '../scripts/round2-batchB-parity.mjs';
import {loadTree,captureRows,OLD_COMBOS as DERIVED_OLD,NEW_COMBOS as DERIVED_NEW} from '../scripts/round2-batchB-derived.mjs';
const ctx=(b,patch={})=>({rulesVersion:b.rulesVersion,options:b.options,path:b.path,mode:b.mode,stats:b.stats,level:b.level,chapter:b.chapter,wave:b.wave,difficulty:b.difficulty,encounter:b.encounter,routes:b.routes,comboSet:b.comboSet,player:b.player,time:b.time,thunderTime:b.thunderTime,lastSigil:b.lastSigil,lastCounter:b.lastCounter,formation:b.formation,enemies:b.enemies,stillTime:b.stillTime,setupUntil:b.setupUntil,...patch});
const copy=structuredClone,DT=1/60,close=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,a+' vs '+b);
function arena(options={}){const b=new Expedition({seed:'batchB',runId:'batchB',difficulty:1,segmentVersion:0,recordVersion:0,...options},()=>{});b.cinematicSeen=['bamboo','ghostFog','innerHall','treasure','cauldron'];return b;}
function battle(options={}){const b=arena(options);b.node.selected=0;b.beginNode();b.clearField();b.updateDirector=()=>{};b.updateEnvironment=()=>{};return b;}
function drive(b,{stop=()=>b.finished,choice='none',onStep=()=>{}}={}){for(let i=0;i<2500&&!stop();i++){if(b.scene==='cinematic')b.advanceCinematic(true);else if(b.modeState==='intro'){const p=currentChallenge(b);if(p&&!p.started)b.chooseChallenge(choice==='offered'?p.offer:choice);b.start();}else if(b.modeState==='battle'){b.time+=10;b.waveTime+=10;b.completeNode();}else if(b.modeState==='choice')b.chooseTrait(b.choices[0].id);else if(b.scene==='intermission'){if(!b.rest.eventDone)b.chooseInteraction(b.eventText().choices.length-1);if(!b.rest.coreDone)b.skipCore();if(!b.rest.routeDone)b.chooseRoute(0);b.continueRest();}else throw Error('unexpected '+b.scene);onStep(b);}assert.ok(stop());return b;}

// ---------- B-0 gating infrastructure ----------
void test('B-0 new runs default to balance 4 / growth 5 / encounter 8 / endless challenge 2; other modes keep challenge 0; records browse by the new numbers',()=>{
 const b=new Expedition();assert.deepEqual([b.options.balanceVersion,b.options.growthVersion,b.options.encounterVersion,b.options.challengeVersion],[4,5,8,0]);
 assert.deepEqual([BALANCE_VERSION,GROWTH_VERSION,ENCOUNTER_VERSION,CHALLENGE_VERSION],[4,5,8,2]);
 assert.equal(new Expedition({mode:'endless'}).options.challengeVersion,2);assert.equal(new Expedition({mode:'story'}).options.challengeVersion,0);
 assert.equal(CURRENT_RECORD_RULES.balanceVersion,4);assert.equal(CURRENT_RECORD_RULES.growthVersion,5);
 const entry=(rules,challengeVersion=0,mode='story')=>({mode,difficulty:1,path:0,rules:{...CURRENT_RECORD_RULES,...rules},touchLockUsed:false,segmentVersion:1,challengeVersion,challengeChoices:[]});
 assert.equal(currentRecordEntry(entry({})),true);assert.equal(currentRecordEntry(entry({balanceVersion:3})),false);assert.equal(currentRecordEntry(entry({growthVersion:4})),false);
 assert.equal(currentRecordEntry(entry({},2,'endless')),true);assert.equal(currentRecordEntry(entry({},1,'endless')),false);
 assert.notEqual(recordGroup(entry({balanceVersion:3})),recordGroup(entry({})));assert.notEqual(recordGroup(entry({},1,'endless')),recordGroup(entry({},2,'endless')));
 assert.equal(initialSave().version,1);assert.equal(initialSave().settings.endlessSkipSeen,true);
});
void test('B-0 old rule combinations restore with derived numbers identical to the pre-batch literal formulas',()=>{
 for(const c of OLD_COMBOS)for(const path of [0,1,2,3,4,5])for(const difficulty of [0,1,2]){
  const b=battle({path,difficulty,balanceVersion:c.balanceVersion,growthVersion:c.growthVersion,encounterVersion:c.encounterVersion});
  const rules2=b.rulesVersion>=2;
  assert.deepEqual(starterExtras(b),rules2?STARTER_EXTRAS[path]:{});assert.equal(reserveFor(b),DIFFICULTIES[difficulty].reserve);
  assert.equal(b.player.maxReserve,DIFFICULTIES[difficulty].reserve+(STARTER_EXTRAS[path].reserve||0));assert.equal(b.player.maxHp,100+(PATHS[path].perk.hp||0)+(STARTER_EXTRAS[path].hp||0));
  for(const t of TRAITS)assert.equal(traitMods(b,t),t.mods);
  close(dashCooldown(b),Math.max(.9,(path===5&&c.balanceVersion>=2?2:3)));assert.equal(sigilCooldown(b),6);assert.equal(sigilWarn(b),2.4);
  close(sigilGrowth(ctx(b,{level:40})),c.balanceVersion===3?1+.08*28:1);assert.equal(afterThunderWindow(b),5);assert.equal(guardCounterScale(b),c.balanceVersion===3?.5:1);
  close(enemyDamageScale(ctx(b,{chapter:4})),1+4*.13);assert.equal(levelHpBonus(ctx(b,{level:80})),0);assert.equal(insectLeash(b),Infinity);
  close(allyBaseScale(ctx(b,{level:36}),'puppet'),path===2?.72*(1+3*.2):1);close(allyBaseScale(ctx(b,{level:36}),'insect'),path===3?.68*(1+3*.2):1);
  assert.equal(swordPuppetInherit(b,.17),.17);assert.equal(fireGuardShield(ctx(b,{comboSet:new Set(['fireGuard'])})),0);assert.equal(reserveRestBase(b),15);
  for(const chapter of [0,1,2,3,4,5]){assert.equal(defendHP(ctx(b,{chapter})),360+chapter*35);for(const kind of ['serpent','ghost','puppet','xuangu'])close(bossHP(ctx(b,{chapter}),kind),{serpent:9000,ghost:19000,puppet:80000,xuangu:100000}[kind]*DIFFICULTIES[difficulty].hp);}
  for(const id of [1,2,3,4,5,6])assert.equal(defendLocked(b,{id}),id%3!==0);
  for(const l of [1,12,36,72,100])assert.equal(xpCostFor(b,l),xpCost(l));
  assert.equal(extendedEncounter(b),false);const profile=mechanismProfile(ctx(b,{chapter:3,encounter:{kind:'treasure'}}));assert.deepEqual(profile,c.encounterVersion>=6?{rates:{treasure:6.8,illusion:6,ice:5.6},opening:10,firstElite:10,eliteInterval:20,eliteLimit:2,limits:[18,26,34]}:{rates:{treasure:3.4,illusion:3.4,ice:3.2},opening:6,firstElite:18,eliteInterval:35,eliteLimit:1,limits:[12,18,24]});
  assert.deepEqual(loopScale(b),{hp:1.4,dmg:1.12});assert.equal(endlessAutoSkip(b),false);
  const base={0:[80,90,100,90],1:[240,260,300,300],2:[400,450,500,550],3:[650,650],4:[680,760,1160,1500],5:[1200,700,1000,300]};
  const expectedXP=c.growthVersion===4?{...base,4:[1950,2050,1900,400],5:[400,200,250,150]}:c.growthVersion===3?{...base,4:[680,760,1160,1500],5:[1200,700,1000,300]}:base;
  if(c.growthVersion>=3)assert.deepEqual(b.routes.map(ch=>ch.map(n=>n.xp)),[0,1,2,3,4,5].map(ch=>expectedXP[ch]));
 }
 for(const mode of ['seed','endless']){const b=arena({mode,challengeVersion:0,recordVersion:0});assert.deepEqual(loopScale(b),{hp:1.4,dmg:1.12});assert.equal(challenged(b),false);const d=b.serialize();d.endlessLoop=2;delete d.chapterStats;/* Legacy synthetic loop snapshot has no chapter observations. */const r=Expedition.restore(d);close(r.difficulty.hp,DIFFICULTIES[1].hp*1.4**2);close(r.difficulty.damage,DIFFICULTIES[1].damage*1.12**2);}
 const one=new Expedition({mode:'endless',challengeVersion:1,seed:'batchB-one',runId:'batchB-one',difficulty:1},()=>{});assert.equal(challenged(one),true);drive(one,{stop:()=>one.endlessLoop===1});close(one.difficulty.hp,DIFFICULTIES[1].hp*1.4);close(one.difficulty.damage,DIFFICULTIES[1].damage*1.12);const r1=Expedition.restore(copy(one.serialize()));close(r1.difficulty.hp,DIFFICULTIES[1].hp*1.4);assert.equal(experienceDetails(r1).challengeVersion,1);
 const legacy=new Expedition({balanceVersion:1,growthVersion:1,encounterVersion:1,segmentVersion:0,challengeVersion:0}).serialize();for(const k of ['balanceVersion','growthVersion','encounterVersion','challengeVersion','segmentVersion'])delete legacy.options[k];const r=Expedition.restore(legacy);assert.deepEqual([r.options.balanceVersion,r.options.growthVersion,r.options.encounterVersion,r.options.challengeVersion],[1,1,1,0]);
 for(const [k,v] of [['balanceVersion',5],['growthVersion',6],['challengeVersion',3]]){const bad=new Expedition({segmentVersion:0}).serialize();bad.options[k]=v;assert.throws(()=>Expedition.restore(bad),/版本/);}
});
void test('B-0 snapshot parity: 54 old-rule combinations match the frozen batch-A engine byte for byte on the same runtime',t=>{
 const fixture=JSON.parse(fs.readFileSync(new URL('../scripts/fixtures/round2-batchB-old-rules.json',import.meta.url),'utf8'));
 const manifest=JSON.parse(fs.readFileSync(new URL('../scripts/fixtures/pre-balance4/manifest.json',import.meta.url),'utf8'));
 for(const [file,sha]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../scripts/fixtures/pre-balance4/'+file,import.meta.url))).digest('hex'),sha,'frozen oracle changed: '+file);
 const rows=fixtureRows(Expedition),reference=fixtureRows(FrozenExpedition);assert.equal(rows.length,fixture.rows.length);assert.equal(reference.length,fixture.rows.length);
 let platformDifferences=0;
 for(let i=0;i<rows.length;i++){
  const archived=fixture.rows[i],prior=reference[i],current=rows[i],label=JSON.stringify(archived.combo)+' path '+archived.path;
  assert.deepEqual(current.combo,archived.combo);assert.equal(current.derived,archived.derived,'derived '+label);assert.equal(prior.derived,archived.derived,'frozen derived '+label);
  // Keep exact serialization comparisons; the reference engine runs with the same CPU/Node math implementation.
  assert.deepEqual(current,prior,'same-runtime old-rule snapshot '+label);
  if(prior.first!==archived.first||prior.second!==archived.second)platformDifferences++;
 }
 if(platformDifferences)t.diagnostic(platformDifferences+' archived hash rows vary on '+process.platform+'/'+process.arch+' Node '+process.versions.node+'; all same-runtime frozen comparisons remain exact');
});
void test('B-0 derived numbers: representative old combinations (1/1/1/0, 2/2/3/0, 3/3/5/1, 3/4/7/1, 3/4/8/1, 3/4/8/0, missing markers) equal the batch-A fixture field by field; new 4/5/8/0 and endless 4/5/8/2 read the adopted tables',async()=>{
 const fixture=JSON.parse(fs.readFileSync(new URL('../scripts/fixtures/round2-batchB-derived-old-rules.json',import.meta.url),'utf8'));
 assert.match(fixture.source,/batch-A accepted snapshot/);assert.deepEqual(fixture.combos.map(c=>c.label),DERIVED_OLD.map(c=>c.label));
 const mods=await loadTree(new URL('../gameplay/',import.meta.url).href.replace('gameplay/','')),rows=captureRows(mods,DERIVED_OLD);
 assert.equal(rows.length,fixture.rows.length);assert.equal(rows.length,7*6*3);
 for(let i=0;i<rows.length;i++){const a=fixture.rows[i],b=rows[i];for(const key of Object.keys(a))assert.deepEqual(b[key],a[key],a.combo+' path '+a.path+' d'+a.difficulty+' · '+key);assert.deepEqual(Object.keys(b),Object.keys(a));}
 const missing=rows.filter(r=>r.combo==='missing'),legacy=rows.filter(r=>r.combo==='1/1/1/0');for(let i=0;i<missing.length;i++){assert.deepEqual(missing[i].options,{balanceVersion:1,growthVersion:1,encounterVersion:1,challengeVersion:0,rulesVersion:3});assert.deepEqual({...missing[i],combo:null},{...legacy[i],combo:null});}
 const fresh=captureRows(mods,DERIVED_NEW),oldByKey=new Map(rows.filter(r=>r.combo==='3/4/8/0').map(r=>[r.path+'/'+r.difficulty,r]));
 for(const r of fresh){const d=DIFFICULTIES[r.difficulty],old=oldByKey.get(r.path+'/'+r.difficulty),label=r.combo+' path '+r.path+' d'+r.difficulty;
  assert.deepEqual(r.options,{balanceVersion:4,growthVersion:5,encounterVersion:8,challengeVersion:r.combo==='4/5/8/2'?2:0,rulesVersion:3},label);
  assert.equal(r.base.maxReserve,d.reserve+(r.path===1?30:0),label);assert.equal(r.base.maxHp,old.base.maxHp,label);close(r.base.dashCooldown,r.path===4?2.4:r.path===5?2:3);assert.equal(r.reserveRest,r.path===1?20:0,label);
  assert.deepEqual(r.sigilGrowth,[1.07,1.84,3.8,6.04,6.04],label);assert.ok(r.swordDamageAfterThunder[0]<=r.swordDamageAfterThunder[1]+1e-9);if(r.path===1)assert.ok(r.swordDamageAfterThunder[1]>old.swordDamageAfterThunder[1],'7-second window '+label);
  if(r.path===4){assert.deepEqual({warn:r.dash.sigil.warn,ttl:r.dash.sigil.ttl,fuseDuration:r.dash.sigil.fuseDuration,arming:r.dash.sigil.arming},{warn:1.8,ttl:2.15,fuseDuration:1.8,arming:.35},label);assert.equal(r.dash.sigilLeft,4.5);close(r.dash.sigil.damage,old.dash.sigil.damage*1.07);}else assert.equal(r.dash.sigil,null);
  assert.deepEqual({thunderDamage:r.traits.stats.thunderDamage,thunderSave:r.traits.stats.thunderSave,puppetSlow:r.traits.stats.puppetSlow,puppetDamage:r.traits.stats.puppetDamage,puppetKnock:r.traits.stats.puppetKnock},{thunderDamage:.4,thunderSave:4,puppetSlow:.15,puppetDamage:.05,puppetKnock:undefined},label);assert.equal(r.traits.thunderCost,old.traits.thunderCost-1,label);
  assert.equal(r.level80.maxHp,r.base.maxHp+40,label);assert.deepEqual(r.level64Sync,{maxHp:r.base.maxHp+32,swords:64},label);
  for(const c of [0,2,4]){close(r.enemy[c].dmg,ENEMIES[4].damage*(1+c*.10)*d.damage);assert.equal(r.enemy[c].maxHp,old.enemy[c].maxHp,label);assert.equal(r.enemy[c].speed,old.enemy[c].speed,label);}
  assert.equal(r.defend.maxHp,450+60*r.defend.chapter,label);assert.equal(r.defend.hp,r.defend.maxHp);assert.equal(r.defend.locked.filter(Boolean).length,4,label);
  close(r.boss.serpent,9000*(r.difficulty===2?1.05:d.hp));for(const kind of ['ghost','puppet','xuangu'])close(r.boss[kind],{ghost:19000,puppet:80000,xuangu:100000}[kind]*d.hp);
  const scale=[.5,1,1][r.difficulty];assert.deepEqual(r.mechanism,{profile:{rates:{treasure:6.8*scale,illusion:6*scale,ice:5.6*scale},opening:[4,10,10][r.difficulty],firstElite:[15,10,10][r.difficulty],eliteInterval:20,eliteLimit:2,limits:[18,26,34],flatPressure:false},limit:[18,26,34][r.difficulty],spawnBudget:[4,10,10][r.difficulty],nextElite:[15,10,10][r.difficulty],goal:30},label);
  assert.deepEqual(r.illusion,{next:7,spawnBudget:[4,10,10][r.difficulty],nextElite:[15,10,10][r.difficulty]},label);assert.deepEqual(r.ice,r.illusion.next?{spawnBudget:[4,10,10][r.difficulty],nextElite:[15,10,10][r.difficulty]}:null,label);assert.deepEqual(r.ordinary,{spawnBudget:6,nextElite:22},label);
  assert.deepEqual(r.xp,{routes:[[80,90,100,90],[240,260,300,300],[600,650,700,750],[1000,1000],[1500,1550,1400,350],[400,200,250,150]],cost:[1,12,36,72,100].map(l=>Math.round(8+2.4*l+.030*l*l))},label);
  if(r.combo==='4/5/8/2'){assert.equal(r.endless.loop,1);close(r.endless.hp,1.25);close(r.endless.damage,1.18);assert.equal(r.endless.challenge.loop,1);}else assert.equal(r.endless,null);
  if(r.path===5){close(r.guardCounter.damage,(32+.9)*.8);assert.equal(r.guardCounter.shield,3);assert.equal(r.guardCombo.maxShield,old.guardCombo.maxShield+8,label);assert.ok(r.guardCombo.combos.includes('fireGuard'));}
  if(r.path===2){close(r.ally.puppetShot,old.ally.puppetShot*(.9/.72)*1.1,1e-6);assert.ok(r.ally.combos.includes('swordPuppet'));}if(r.path===3)close(r.ally.insectHit,old.ally.insectHit*(.85/.68),1e-6);
 }
});
void test('B-0 encounter 8 on balance 3 keeps batch-A numbers; only balance-4 runs read the extended encounter-8 table',()=>{
 const a=battle({chapter:3,balanceVersion:3,encounterVersion:8}),b=battle({chapter:3,balanceVersion:4,encounterVersion:8});
 assert.equal(extendedEncounter(a),false);assert.equal(extendedEncounter(b),true);assert.equal(defendHP(a),360+3*35);assert.equal(defendHP(b),ENCOUNTER8.defend.base+3*ENCOUNTER8.defend.perChapter);
 close(bossHP(a,'serpent'),9000);close(bossHP(b,'serpent'),ENCOUNTER8.bossHP.serpent);assert.equal(mechanismProfile(ctx(a,{encounter:{kind:'treasure'}})).flatPressure,undefined);
 const old=new Expedition({balanceVersion:3,encounterVersion:8,segmentVersion:0}).serialize();assert.equal(extendedEncounter(Expedition.restore(old)),false);
});

// ---------- B-1 defend plate ----------
void test('B-1 balance-4 new runs give the plate 450+60c on every difficulty; guard counter scales ×0.8; old runs keep 360+35c and ×0.5',()=>{
 for(const difficulty of [0,1,2])for(const chapter of [1,2,4]){const b=arena({chapter,difficulty});b.wave=chapter===4?2:1;const node=b.routes[chapter].find(n=>n.choices.some(c=>c.kind==='defend'));if(!node)continue;b.wave=b.routes[chapter].indexOf(node);node.selected=node.choices.findIndex(c=>c.kind==='defend');b.beginNode();assert.equal(b.objective.kind,'defend');assert.equal(b.objective.maxHp,450+chapter*60);assert.equal(b.objective.hp,b.objective.maxHp);
  const e=b.enemies.filter(e=>!e.boss);assert.ok(e.every(x=>(x.focusObject===b.objective)===(x.id%3!==0)));const r=Expedition.restore(copy(b.serialize()));assert.equal(r.objective.maxHp,450+chapter*60);}
 const old=arena({chapter:1,balanceVersion:3});const node=old.routes[1].find(n=>n.choices.some(c=>c.kind==='defend'));old.wave=old.routes[1].indexOf(node);node.selected=node.choices.findIndex(c=>c.kind==='defend');old.beginNode();assert.equal(old.objective.maxHp,395);
 for(const [version,scale] of [[4,.8],[3,.5],[2,1]]){const b=battle({path:5,balanceVersion:version});b.stats.shieldRegen=0;b.player.shield=0;b.spawn(0,{x:b.player.x+50,y:b.player.y,hp:1e6,speed:0});b.rebuildHash();b.dash();b.hitPlayer(10);close(b.damageSources.guard,(32+b.level*.9)*scale);}
 assert.match(starterDetails(5,{}).action,/25\.6＋等级×0\.72/);assert.match(starterDetails(5,{balanceVersion:3}).action,/16＋等级×0\.45/);
});

// ---------- B-2 talisman ----------
void test('B-2 balance-4 talisman: dash 2.4s, sigil cooldown 4.5s, fuse 1.8s, linear sigil growth; the slow starter (candidate C) is not adopted; snapshots validate per version; old runs keep 3/6/2.4',()=>{
 const b=battle({path:4});close(dashCooldown(b),2.4);assert.equal(sigilCooldown(b),4.5);assert.equal(sigilWarn(b),1.8);assert.deepEqual(starterExtras(b),{});assert.equal(b.stats.slow,undefined);
 close(sigilGrowth(ctx(b,{level:1})),1.07);close(sigilGrowth(ctx(b,{level:72})),6.04);close(sigilGrowth(ctx(b,{level:100})),6.04);
 b.input={x:1,y:0};b.dash();const z=b.zones.find(z=>z.sigil);assert.equal(z.fuseDuration,1.8);assert.equal(z.warn,1.8);close(z.ttl,2.15);close(b.player.dashCD,2.4);close(b.sigilReadiness().left,4.5);
 const snap=copy(b.serialize());assert.equal(Expedition.restore(snap).zones.find(z=>z.sigil).fuseDuration,1.8);const forged=copy(snap);forged.options.balanceVersion=3;assert.throws(()=>Expedition.restore(forged),/布符|平衡/);
 for(const other of [0,1,2,3])close(dashCooldown(battle({path:other})),3);close(dashCooldown(battle({path:5})),2);
 const old=battle({path:4,balanceVersion:3});close(dashCooldown(old),3);assert.equal(sigilCooldown(old),6);old.input={x:1,y:0};old.dash();assert.equal(old.zones.find(z=>z.sigil).fuseDuration,2.4);assert.deepEqual(starterExtras(old),{});
 assert.match(starterDetails(4,{}).action,/最多留存 1\.8 秒，独立冷却 4\.5 秒/);assert.doesNotMatch(starterDetails(4,{}).initial,/减速/);assert.match(starterDetails(4,{}).limit,/闪避基础冷却 2\.4 秒/);assert.match(starterDetails(4,{balanceVersion:3}).action,/最多留存 2\.4 秒，独立冷却 6 秒/);
 b.traits['talisman-10']=1;b.recalc();assert.match(traitDescription(TRAITS.find(t=>t.id==='talisman-10'),b),/最多留存 1\.8 秒；留符仍独立冷却 4\.5 秒/);
});

// ---------- B-3 thunder ----------
void test('B-3 balance-4 thunder: reserve +30, rest refill 20, 雷威 .40 / 节雷 4 via traitMods with matching card text, 7-second post-thunder window; old runs unchanged',()=>{
 const b=battle({path:1});assert.deepEqual(starterExtras(b),{reserve:30});assert.equal(b.player.maxReserve,DIFFICULTIES[1].reserve+30);assert.equal(reserveRestBase(b),20);assert.equal(afterThunderWindow(b),7);
 const thunderDamage=TRAITS.find(t=>t.id==='thunder-1'),save=TRAITS.find(t=>t.id==='thunder-2'),after=TRAITS.find(t=>t.id==='thunder-4');
 assert.deepEqual(traitMods(b,thunderDamage),{thunderDamage:.4});assert.deepEqual(traitMods(b,save),{thunderSave:4});assert.equal(traitText(b,thunderDamage),'神雷伤害 +40%');assert.equal(traitDescription(save,b),'神雷每次雷源消耗 −4');assert.equal(traitDescription(after,b),'神雷后飞剑强化 7 秒');
 b.traits['thunder-1']=1;b.traits['thunder-2']=1;b.recalc();close(b.stats.thunderDamage,.4);assert.equal(b.stats.thunderSave,4);assert.equal(b.thunderReadiness().cost,18);assert.equal(statSources(b).rows[3].mods.thunderDamage,.4);
 b.thunderTime=b.time;const at5=(()=>{b.time=b.thunderTime+6;return b.swordDamage(null);})(),at8=(()=>{b.time=b.thunderTime+7.5;return b.swordDamage(null);})();assert.ok(at5>at8);
 b.wave=0;b.player.reserve=0;assert.equal(reserveRestoration(b),20);
 const old=battle({path:1,balanceVersion:3});assert.deepEqual(starterExtras(old),{reserve:20});assert.equal(old.player.maxReserve,DIFFICULTIES[1].reserve+20);assert.equal(afterThunderWindow(old),5);assert.deepEqual(traitMods(old,thunderDamage),{thunderDamage:.25});assert.equal(traitDescription(save,old),'神雷每次雷源消耗 −3');old.player.reserve=0;assert.equal(reserveRestoration(old),15);
 assert.match(starterDetails(1,{}).initial,/雷源 \+30/);assert.match(starterDetails(1,{}).action,/神雷后 7 秒内.*最多补回 20 雷源/);assert.match(starterDetails(1,{balanceVersion:3}).initial,/雷源 \+20/);assert.match(starterStatus(ctx(b,{time:b.thunderTime+6})),/余雷 1\.0 秒/);
 assert.deepEqual(DIFFICULTIES.map(d=>d.reserve),[150,120,110]);
});

// ---------- B-4 chapter 1 / serpent ----------
void test('B-4 balance-4 new runs: the 险境 chapter-1 serpent uses ×1.05 instead of ×1.2 (9000→9450 rather than 10800); 初入/标准 unchanged; serpent 8000 and sword pierce +1 are not adopted; balance 3 keeps ×1.2',()=>{
 for(const difficulty of [0,1,2]){const b=arena({difficulty,path:0});b.wave=3;b.node.selected=0;b.beginNode();close(b.boss.maxHp,difficulty===2?9000*1.05:9000*DIFFICULTIES[difficulty].hp);assert.equal(b.stats.pierce,undefined);assert.deepEqual(starterExtras(b),{});
  const old=arena({difficulty,path:0,balanceVersion:3});old.wave=3;old.node.selected=0;old.beginNode();close(old.boss.maxHp,9000*DIFFICULTIES[difficulty].hp);assert.equal(old.stats.pierce,undefined);}
 const b=arena({chapter:1,difficulty:2});b.wave=3;b.node.selected=0;b.beginNode();close(b.boss.maxHp,19000*1.2,1e-6);assert.doesNotMatch(starterDetails(0,{}).initial,/穿透/);assert.equal(ENCOUNTER8.serpentHardScale,1.05);assert.equal(ENCOUNTER8.bossHP.serpent,9000);
});

// ---------- B-5 chapter 5 enemy damage ----------
void test('B-5 balance-4 enemy damage scales 1+0.10c (chapter 5 ×1.50) while chapter 1 and old runs keep 1+0.13c; max HP gains +4 per 8 levels (L80 +40) and heals the gained amount; old runs stay at 100',()=>{
 for(const chapter of [0,2,4,5]){const b=battle({chapter});const e=b.spawn(4,{});close(e.dmg,ENEMIES[4].damage*(1+chapter*.10)*DIFFICULTIES[1].damage);const old=battle({chapter,balanceVersion:3});const f=old.spawn(4,{});close(f.dmg,ENEMIES[4].damage*(1+chapter*.13)*DIFFICULTIES[1].damage);if(chapter===0)close(e.dmg,f.dmg);}
 const b=battle({});assert.equal(b.player.maxHp,100);b.player.hp=50;b.addXP(xpCostFor(b,1)*40);assert.ok(b.level>=8&&b.level<16);assert.equal(b.player.maxHp,104);assert.equal(b.player.hp,54);assert.equal(levelHpBonus(b),4);b.addXP(1e6);assert.equal(b.level,160);assert.equal(b.player.maxHp,180);assert.equal(statSources(b).totals.hp,180);const r=Expedition.restore(copy(b.serialize()));assert.equal(r.player.maxHp,180);
 const old=battle({balanceVersion:3});old.addXP(1e6);assert.equal(old.player.maxHp,100);assert.equal(levelHpBonus(old),0);assert.equal(levelHpBonus(ctx(b,{level:79})),36);assert.equal(levelHpBonus(ctx(b,{level:80})),40);
});

// ---------- B-6 growth curve and offers ----------
void test('B-6 growth 5 lays out 11960 base XP with 2700/2000/4800 in chapters 3–5, level cost .030, 72 swords by 4:1 with 25% performance; growth 4 unchanged',()=>{
 assert.deepEqual(XP_V5,{2:[600,650,700,750],3:[1000,1000],4:[1500,1550,1400,350],5:[400,200,250,150]});
 const b=arena();const xp=b.routes.map(ch=>ch.map(n=>n.xp));assert.deepEqual(xp,[[80,90,100,90],[240,260,300,300],[600,650,700,750],[1000,1000],[1500,1550,1400,350],[400,200,250,150]]);assert.equal(xp.flat().reduce((a,c)=>a+c,0),11960);
 assert.deepEqual(arena({growthVersion:4}).routes.map(ch=>ch.map(n=>n.xp)).flat().reduce((a,c)=>a+c,0),11960);assert.deepEqual(arena({growthVersion:4}).routes[4].map(n=>n.xp),[1950,2050,1900,400]);
 for(const l of [1,12,36,72])assert.equal(xpCostFor(b,l),Math.round(8+2.4*l+.030*l*l));assert.equal(xpCostFor(arena({growthVersion:4}),36),xpCost(36));
 const schedule=(xps,cost)=>{let lv=1,pool=0;const out=[];for(let c=0;c<6;c++)for(let i=0;i<xps[c].length;i++){pool+=xps[c][i];while(pool>=cost(lv)){pool-=cost(lv);lv++;}out.push({node:c+':'+i,level:lv});}return out;};
 const perf=xp.map(ch=>ch.map(v=>Math.round(v*1.25))),rows=schedule(perf,l=>xpCostFor(b,l));assert.equal(rows.find(r=>r.level>=72).node,'4:1');assert.deepEqual([3,7,11,13,17,21].map(i=>rows[i].level),[16,32,53,63,81,84]);
 const oldRows=schedule(arena({growthVersion:4}).routes.map(ch=>ch.map(n=>Math.round(n.xp*1.25))),xpCost);assert.equal(oldRows.find(r=>r.level>=72).node,'4:2');
 assert.equal(goalGrowth(b),true);assert.equal(goalGrowth(arena({growthVersion:4})),true);assert.equal(goalGrowth(arena({growthVersion:3})),false);
 for(const [k,v] of [['growthVersion',6]]){const bad=b.serialize();bad.options[k]=v;assert.throws(()=>Expedition.restore(bad),/版本/);}
 // Display parity (R1): the HUD xp-track/xp-label and the battle summary read xpCostFor, so growth 5 shows the .030 threshold while growth 4 shows xpCost.
 const g5=arena(),g4=arena({growthVersion:4});for(const l of [12,20,40,72]){assert.notEqual(xpCostFor(g5,l),xpCost(l));assert.equal(xpCostFor(g4,l),xpCost(l));}assert.equal([...Array(71).keys()].reduce((a,i)=>a+xpCostFor(g5,i+1),0),10355);assert.equal([...Array(71).keys()].reduce((a,i)=>a+xpCost(i+1),0),10971);
 const engine=battle({});engine.addXP(xpCostFor(engine,1));assert.equal(engine.level,2);const old=battle({growthVersion:4});old.addXP(xpCost(1));assert.equal(old.level,2);assert.notEqual(xpCostFor(engine,40),xpCost(40));
});
void test('B-6 growth 5 keeps the growth-4 first-offer guarantee only (the every-offer guarantee was tested and not adopted; GROWTH5.ownGuarantee switches it); knock is talisman-only; generated offers survive restore',()=>{
 assert.equal(GROWTH5.ownGuarantee,false);
 for(const path of [0,1,2,3,4,5]){const b=battle({path,seed:'own-'+path});b.growth.firstOfferUsed=false;const first=growthChoices(b);assert.ok(first.some(t=>t.path===path),'first offer keeps an own-path card');}
 const later=battle({path:0,seed:'own-later'});later.growth.firstOfferUsed=true;let zero=0;for(let i=0;i<200;i++)if(!growthChoices(later).some(t=>t.path===0))zero++;assert.ok(zero>0,'later offers may lack own-path cards like growth 4');
 GROWTH5.ownGuarantee=true;try{for(const path of [1,4,5]){const b=battle({path,seed:'own-'+path});let bad=0;for(let i=0;i<120;i++){b.growth.firstOfferUsed=i>0;const picked=growthChoices(b);const ownPool=TRAITS.filter(t=>t.path===path&&traitReadiness(t,b).eligible);if(ownPool.length&&!picked.some(t=>t.path===path))bad++;}assert.equal(bad,0,'switch on: path '+path);}}finally{GROWTH5.ownGuarantee=false;}
 const knock=TRAITS.find(t=>t.mods.knock);for(const path of [0,1,2,3,5]){assert.equal(traitReadiness(knock,battle({path})).eligible,false);assert.equal(traitReadiness(knock,battle({path,growthVersion:4})).eligible,true);}assert.equal(traitReadiness(knock,battle({path:4})).eligible,true);
 const b=battle({path:0,seed:'reload'});b.openChoices();const first=b.choices.map(t=>t.id);const r=Expedition.restore(copy(b.serialize()));assert.deepEqual(r.choices.map(t=>t.id),first);
});

// ---------- B-7 cards, ally baseline and combos ----------
void test('B-7 balance-4 puppet/insect base .90/.85, 百刃齐发 floor 10%, 镇阵守元 flat +8 shield, 精密机括 slow+damage with matching text; old runs keep .72/.68 and plain values',()=>{
 close(allyBaseScale(ctx(battle({path:2}),{level:36}),'puppet'),.9*1.6);close(allyBaseScale(ctx(battle({path:3}),{level:36}),'insect'),.85*1.6);close(allyBaseScale(ctx(battle({path:2,balanceVersion:3}),{level:36}),'puppet'),.72*1.6);close(allyBaseScale(ctx(battle({path:3,balanceVersion:3}),{level:36}),'insect'),.68*1.6);close(allyBaseScale(ctx(battle({path:0}),{level:36}),'puppet'),1);
 const b=battle({path:2});b.traits={'sword-1':1,'sword-2':1,'sword-3':1,'puppet-0':1,'puppet-1':1,'puppet-2':1};b.recalc();assert.ok(b.comboSet.has('swordPuppet'));assert.equal(b.stats.damage,undefined);assert.equal(swordPuppetInherit(b,b.stats.damage),.1);assert.equal(swordPuppetBonus(b),.1);assert.match(comboDescription(COMBOS.find(c=>c.effect==='swordPuppet'),b),/当前 \+10%.*最低按 \+10% 计/);
 b.traits['sword-0']=1;b.recalc();close(swordPuppetBonus(b),.15);const old=battle({path:2,balanceVersion:3});old.traits=copy(b.traits);delete old.traits['sword-0'];old.recalc();assert.equal(swordPuppetBonus(old),0);
 const g=battle({path:5});g.traits={'talisman-0':1,'talisman-1':1,'talisman-3':1,'guard-0':1,'guard-1':1,'guard-2':1};g.recalc();assert.ok(g.comboSet.has('fireGuard'));assert.equal(fireGuardShield(g),8);assert.equal(g.player.maxShield,25+16+8);assert.equal(statSources(g).totals.shield,g.player.maxShield);assert.match(comboDescription(COMBOS.find(c=>c.effect==='fireGuard'),g),/固定提高护盾上限 8/);
 const og=battle({path:5,balanceVersion:3});og.traits=copy(g.traits);og.recalc();assert.equal(og.player.maxShield,25+16);assert.equal(comboDescription(COMBOS.find(c=>c.effect==='fireGuard'),og),COMBOS.find(c=>c.effect==='fireGuard').desc);
 const precise=TRAITS.find(t=>t.id==='puppet-9');const p=battle({path:2});assert.deepEqual(traitMods(p,precise),{puppetSlow:.15,puppetDamage:.05});assert.equal(traitDescription(precise,p),'弩矢命中减速 15% 且伤害 +5%');p.traits['puppet-9']=1;p.recalc();close(p.stats.puppetSlow,.15);close(p.stats.puppetDamage,.05);assert.equal(p.stats.puppetKnock,undefined);
 const op=battle({path:2,balanceVersion:3});op.traits['puppet-9']=1;op.recalc();close(op.stats.puppetKnock,.6);assert.equal(traitDescription(precise,op),'弩矢击退 +60%');
 assert.match(traitComboBenefit(TRAITS.find(t=>t.id==='puppet-3'),(()=>{const c=battle({path:0});c.traits={'sword-1':1,'sword-2':1,'sword-3':1,'puppet-0':1,'puppet-1':1};c.recalc();return c;})()),/额外 \+10%/);
});

// ---------- B-8 insect leash ----------
void test('B-8 the leash (bugs farther than 400 search around Han Li; focus-first search) is implemented behind BALANCE4.insectLeash/insectFocusFirst but not adopted: shipped balance 4 keeps the 250/350 search exactly like balance 3',()=>{
 assert.equal(BALANCE4.insectLeash,null);assert.equal(BALANCE4.insectFocusFirst,false);assert.equal(insectLeash(battle({path:3})),Infinity);
 const run=(version,leashed)=>{const b=battle({path:3,balanceVersion:version});b.player.x=200;b.player.y=400;const near=b.spawn(4,{x:300,y:400,hp:1e6,speed:0}),far=b.spawn(4,{x:1100,y:400,hp:1e6,speed:0});near.spawn=far.spawn=0;b.rebuildHash();b.input={x:0,y:0,focus:false,aim:null};b.updateAllies(DT);assert.equal(b.insects.length,4);
  for(const bug of b.insects){bug.x=1000;bug.y=400;}b.input={x:0,y:0,focus:false,aim:null};b.updateAllies(DT);assert.equal(b.insectPursuits.every(id=>id===(leashed?near.id:far.id)),true,'version '+version);
  for(const bug of b.insects){bug.x=250;bug.y=400;}b.updateAllies(DT);assert.ok(b.insectPursuits.every(id=>id===near.id));
  const f=battle({path:3,balanceVersion:version});f.player.x=200;f.player.y=400;const a=f.spawn(4,{x:260,y:400,hp:1e6,speed:0}),focus=f.spawn(4,{x:520,y:400,hp:1e6,speed:0});a.spawn=focus.spawn=0;f.rebuildHash();f.input={x:0,y:0,focus:false,aim:null};f.updateAllies(DT);for(const bug of f.insects){bug.x=230;bug.y=400;}f.input={x:0,y:0,focus:true,aim:{x:520,y:400}};f.updateAllies(DT);assert.ok(f.insectPursuits.every(id=>id===(leashed?focus.id:a.id)),'focus version '+version);};
 run(4,false);run(3,false);
 BALANCE4.insectLeash=400;BALANCE4.insectFocusFirst=true;try{run(4,true);run(3,false);}finally{BALANCE4.insectLeash=null;BALANCE4.insectFocusFirst=false;}
});

// ---------- B-9 mechanism difficulty tiers ----------
void test('B-9 encounter 8 on balance 4 eases the three mechanisms only on 初入仙途 (rate ×0.5, opening 4, first elite 15s); 标准/险境 keep profile 6 with the 20/40-second rate pressure; limits and stop times unchanged; balance 3 keeps profile 6 everywhere',()=>{
 for(const difficulty of [0,1,2]){const b=arena({chapter:3,difficulty});b.wave=0;b.node.selected=0;b.beginNode();const p=mechanismProfile(b);close(p.rates.treasure,6.8*[.5,1,1][difficulty]);close(p.rates.illusion,6*[.5,1,1][difficulty]);close(p.rates.ice,5.6*[.5,1,1][difficulty]);assert.equal(p.opening,[4,10,10][difficulty]);assert.equal(p.firstElite,[15,10,10][difficulty]);assert.equal(p.eliteInterval,20);assert.equal(p.eliteLimit,2);assert.deepEqual(p.limits,[18,26,34]);assert.equal(p.flatPressure,false);assert.equal(mechanismLimit(b),[18,26,34][difficulty]);assert.equal(b.spawnBudget,[4,10,10][difficulty]);assert.equal(b.nextElite,[15,10,10][difficulty]);
  const old=arena({chapter:3,difficulty,balanceVersion:3});old.wave=0;old.node.selected=0;old.beginNode();assert.deepEqual(mechanismProfile(old),{rates:{treasure:6.8,illusion:6,ice:5.6},opening:10,firstElite:10,eliteInterval:20,eliteLimit:2,limits:[18,26,34]});assert.equal(old.spawnBudget,10);assert.equal(old.nextElite,10);}
 // Rate pressure at waveTime 45 stays ×1.3 on 标准 for both versions; on 初入 balance 4 accrues 6.8×0.5×1.3. The flat-pressure switch stays available in the table.
 const budget=(version,difficulty=1)=>{const b=arena({chapter:3,difficulty,balanceVersion:version});b.wave=0;b.node.selected=0;b.beginNode();b.clearField();b.spawn=()=>null;b.waveTime=45;b.spawnBudget=0;b.updateDirector(1);return b.spawnBudget;};close(budget(3),Math.min(10,6.8*1.3));close(budget(4),Math.min(10,6.8*1.3));close(budget(4,0),6.8*.5*1.3);close(budget(3,0),Math.min(10,6.8*1.3));
 ENCOUNTER8.mechanism.flatPressure=true;try{close(budget(4),6.8);}finally{ENCOUNTER8.mechanism.flatPressure=false;}
 const ordinary=arena({chapter:2});ordinary.wave=0;ordinary.node.selected=0;ordinary.beginNode();assert.equal(ordinary.spawnBudget,6);assert.equal(ordinary.nextElite,22);
});

// ---------- B-10 endless curve ----------
void test('B-10 challenge 2 endless runs scale ×1.25/×1.18 per loop, auto-skip seen cinematics from loop 2 unless the setting is off, restore with the same curve and rank in their own group; challenge 1/0 keep ×1.4/×1.12',()=>{
 const endless=options=>new Expedition({mode:'endless',seed:'batchB-endless',runId:'batchB-endless',difficulty:1,recordVersion:1,segmentVersion:1,...options},()=>{});
 const b=endless({settings:{endlessSkipSeen:true}});assert.equal(b.options.challengeVersion,2);assert.equal(challenged(b),true);assert.deepEqual(loopScale(b),{hp:CHALLENGE2.hp,dmg:CHALLENGE2.dmg});assert.equal(endlessAutoSkip(b),false);
 drive(b,{stop:()=>b.endlessLoop===1});close(b.difficulty.hp,DIFFICULTIES[1].hp*1.25);close(b.difficulty.damage,DIFFICULTIES[1].damage*1.18);assert.equal(endlessAutoSkip(b),true);
 assert.ok(b.cinematicHistory.includes('bamboo'));b.chooseChallenge('none');b.start();assert.equal(b.cinematic,null);assert.equal(b.modeState,'battle','seen opening cinematic auto-skipped on loop 2');
 const r=Expedition.restore(copy(b.serialize()));close(r.difficulty.hp,DIFFICULTIES[1].hp*1.25);close(r.difficulty.damage,DIFFICULTIES[1].damage*1.18);assert.equal(experienceDetails(r).challengeVersion,2);
 const off=endless({settings:{endlessSkipSeen:false}});drive(off,{stop:()=>off.endlessLoop===1});assert.equal(endlessAutoSkip(off),false);off.chooseChallenge('none');off.start();assert.equal(off.cinematic?.id,'bamboo');
 const one=endless({challengeVersion:1,settings:{endlessSkipSeen:true}});drive(one,{stop:()=>one.endlessLoop===1});close(one.difficulty.hp,DIFFICULTIES[1].hp*1.4);assert.equal(endlessAutoSkip(one),false);one.chooseChallenge('none');one.start();assert.equal(one.cinematic?.id,'bamboo');
 const save=normalizeSave(withProgressRecord(initialSave(),b.summary()));const entry=save.records.entries[0];assert.equal(entry.challengeVersion,2);assert.equal(entry.loops,1);assert.doesNotThrow(()=>validateExperienceEntry(entry));assert.equal(currentRecordEntry(entry),true);
 const legacyEntry={...entry,challengeVersion:1};assert.notEqual(recordGroup(entry),recordGroup(legacyEntry));assert.equal(currentRecordEntry(legacyEntry),false);const bad=copy(save.records);bad.entries[0].challengeVersion=3;assert.throws(()=>normalizeRecords(bad),/挑战版本/);
 const snap=b.serialize();snap.options.challengeVersion=3;assert.throws(()=>Expedition.restore(snap),/版本/);
 const s=normalizeSave({...initialSave(),settings:{...initialSave().settings,endlessSkipSeen:false}});assert.equal(s.settings.endlessSkipSeen,false);assert.equal(normalizeSave({...initialSave(),settings:{}}).settings.endlessSkipSeen,true);
});
