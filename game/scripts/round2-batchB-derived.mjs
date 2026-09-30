/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Round-2 batch B (B-0): derived-number capture for representative rule combinations. Pure helper that loads a game
// tree by GAME_ROOT, so the same capture runs on the batch-A accepted snapshot (fixture generation, old combinations)
// and on the current tree (tests/round2-batchB.test.mjs compares old combinations to the fixture and checks the new
// combinations against the balance-4 / growth-5 / encounter-8 / challenge-2 tables). Never imported by the shipped game.
// Generate the fixture from the batch-A tree (do not hand-edit):
//   GAME_ROOT=/path/to/afterA/game/ node scripts/round2-batchB-derived.mjs > scripts/fixtures/round2-batchB-derived-old-rules.json
import {fileURLToPath} from 'node:url';
export const OLD_COMBOS=[
 {label:'1/1/1/0',balanceVersion:1,growthVersion:1,encounterVersion:1,challengeVersion:0,mode:'seed'},
 {label:'2/2/3/0',balanceVersion:2,growthVersion:2,encounterVersion:3,challengeVersion:0,mode:'seed'},
 {label:'3/3/5/1',balanceVersion:3,growthVersion:3,encounterVersion:5,challengeVersion:1,mode:'endless'},
 {label:'3/4/7/1',balanceVersion:3,growthVersion:4,encounterVersion:7,challengeVersion:1,mode:'endless'},
 {label:'3/4/8/1',balanceVersion:3,growthVersion:4,encounterVersion:8,challengeVersion:1,mode:'endless'},
 {label:'3/4/8/0',balanceVersion:3,growthVersion:4,encounterVersion:8,challengeVersion:0,mode:'seed'},
 {label:'missing',balanceVersion:1,growthVersion:1,encounterVersion:1,challengeVersion:0,mode:'seed',missing:true},
];
export const NEW_COMBOS=[
 {label:'4/5/8/0',balanceVersion:4,growthVersion:5,encounterVersion:8,challengeVersion:0,mode:'seed'},
 {label:'4/5/8/2',balanceVersion:4,growthVersion:5,encounterVersion:8,challengeVersion:2,mode:'endless'},
];
export const TRAIT_SET={'thunder-1':1,'thunder-2':1,'puppet-9':1,'sword-0':1};
export const PUPPET_COMBO={'sword-1':1,'sword-2':1,'sword-3':1,'puppet-0':1,'puppet-1':1,'puppet-2':1};
export const GUARD_COMBO={'talisman-0':1,'talisman-1':1,'talisman-3':1,'guard-0':1,'guard-1':1,'guard-2':1};
export async function loadTree(G){
 const [expedition,data,balance,director,growth]=await Promise.all(['expedition.js','data.js','balance.js','director-rules.js','growth-rules.js'].map(f=>import(G+'gameplay/'+f)));
 return {expedition,data,balance,director,growth};
}
const round=v=>typeof v==='number'?Number(v.toFixed(9)):v;
const plain=x=>JSON.parse(JSON.stringify(x,(k,v)=>typeof v==='number'?round(v):v));
export function captureRow(mods,combo,path,difficulty){
 const {Expedition}=mods.expedition,{DIFFICULTIES,xpCost}=mods.data,{dashCooldown,sigilGrowth,reserveRestoration}=mods.balance,{mechanismProfile,mechanismLimit}=mods.director;
 const cost=mods.growth.xpCostFor?(b,l)=>mods.growth.xpCostFor(b,l):(b,l)=>xpCost(l);
 const opts=chapter=>({seed:'derive-'+path+'-'+difficulty,runId:'derive',path,chapter,difficulty,mode:combo.mode,recordVersion:0,segmentVersion:0,challengeVersion:combo.challengeVersion,balanceVersion:combo.balanceVersion,growthVersion:combo.growthVersion,encounterVersion:combo.encounterVersion,metaRulesVersion:3,meta:[]});
 const make=chapter=>{let b=new Expedition(opts(chapter),()=>{});if(combo.missing){const d=JSON.parse(JSON.stringify(b.serialize()));for(const k of ['balanceVersion','growthVersion','encounterVersion','challengeVersion','segmentVersion'])delete d.options[k];b=Expedition.restore(d,()=>{});}b.cinematicSeen=['bamboo','ghostFog','innerHall','treasure','cauldron'];return b;};
 const node=(chapter,wave,kind=null)=>{const b=make(chapter);b.wave=wave;const n=b.routes[chapter][wave],i=kind?n.choices.findIndex(c=>c.kind===kind):0;if(i<0)return null;n.selected=i;b.beginNode();b.clearField();return b;};
 const row={combo:combo.label,path,difficulty,options:null};
 const b=node(0,0);row.options={balanceVersion:b.options.balanceVersion,growthVersion:b.options.growthVersion,encounterVersion:b.options.encounterVersion,challengeVersion:b.options.challengeVersion,rulesVersion:b.rulesVersion};
 row.base={maxHp:b.player.maxHp,maxReserve:b.player.maxReserve,maxShield:b.player.maxShield,stats:{...b.stats},dashCooldown:dashCooldown(b),thunderCost:b.thunderReadiness().cost};
 b.player.reserve=0;row.reserveRest=reserveRestoration(b);
 row.sigilGrowth=[1,12,40,72,100].map(level=>sigilGrowth({...b,level}));
 b.thunderTime=100;b.time=104.5;row.swordDamageAfterThunder=[b.swordDamage(null)];b.time=106.5;row.swordDamageAfterThunder.push(b.swordDamage(null));b.time=0;b.thunderTime=-100;
 b.input={x:1,y:0,aim:null,focus:false};b.dash();const z=b.zones.find(z=>z.sigil);row.dash={dashCD:b.player.dashCD,sigil:z?{warn:z.warn,ttl:z.ttl,fuseDuration:z.fuseDuration??null,damage:z.damage,arming:z.arming??null}:null,sigilLeft:b.sigilReadiness().left};
 const t=node(0,0);t.traits={...TRAIT_SET};t.recalc();row.traits={stats:{...t.stats},maxHp:t.player.maxHp,maxReserve:t.player.maxReserve,thunderCost:t.thunderReadiness().cost};
 const l=node(0,0);l.level=80;l.recalc();row.level80={maxHp:l.player.maxHp};l.level=1;l.recalc();l.level=64;l.syncSwords();row.level64Sync={maxHp:l.player.maxHp,swords:l.swords.length};
 row.enemy={};for(const chapter of [0,2,4]){const c=node(chapter,0);const e=c.spawn(4,{});row.enemy[chapter]=e?{dmg:e.dmg,maxHp:e.maxHp,speed:e.speed}:null;}
 const probe=make(0);let found=null;probe.routes.forEach((ch,c)=>ch.forEach((n,w)=>{if(found)return;const i=n.choices.findIndex(x=>x.kind==='defend');if(i>=0)found={c,w};}));
 if(found){const d=node(found.c,found.w,'defend');for(let i=0;i<6;i++)d.spawn(4,{});row.defend={chapter:found.c,maxHp:d.objective.maxHp,hp:d.objective.hp,locked:d.enemies.map(e=>!!e.focusObject)};}else row.defend=null;
 row.boss={};for(const [chapter,kind] of [[0,'serpent'],[1,'ghost'],[4,'puppet'],[5,'xuangu']]){const c=node(chapter,3);row.boss[kind]=c.boss?.maxHp??null;}
 const m=node(3,0);row.mechanism={profile:plain(mechanismProfile(m)),limit:mechanismLimit(m),spawnBudget:m.spawnBudget,nextElite:m.nextElite,goal:m.mechanism?.goal??null};const il=node(3,1);row.illusion={next:il.objective?.next??null,spawnBudget:il.spawnBudget,nextElite:il.nextElite};const ice=node(5,2);row.ice={spawnBudget:ice.spawnBudget,nextElite:ice.nextElite};const ordinary=node(2,0);row.ordinary={spawnBudget:ordinary.spawnBudget,nextElite:ordinary.nextElite};
 row.xp={routes:b.routes.map(ch=>ch.map(n=>n.xp)),cost:[1,12,36,72,100].map(lv=>cost(b,lv))};
 if(combo.mode==='endless'){const e=make(5);e.chapter=5;e.wave=3;e.nextChapter();row.endless={loop:e.endlessLoop,hp:e.difficulty.hp/DIFFICULTIES[difficulty].hp,damage:e.difficulty.damage/DIFFICULTIES[difficulty].damage,challenge:e.challenges?.at(-1)?{loop:e.challenges.at(-1).loop,offer:e.challenges.at(-1).offer}:null};if(e.chooseChallenge)e.chooseChallenge('none');e.start();row.endless.cinematic=e.cinematic?.id??null;row.endless.modeState=e.modeState;}else row.endless=null;
 if(path===5){const g=node(0,0);g.stats.shieldRegen=0;g.player.shield=0;g.spawn(0,{x:g.player.x+50,y:g.player.y,hp:1e6,speed:0});g.rebuildHash();g.input={x:1,y:0,aim:null,focus:false};g.dash();g.hitPlayer(10);row.guardCounter={damage:g.damageSources.guard,shield:g.player.shield};const s=node(0,0);s.traits={...GUARD_COMBO};s.recalc();row.guardCombo={maxShield:s.player.maxShield,combos:[...s.comboSet]};}
 if(path===2||path===3){const a=node(0,0);if(path===2)a.traits={...PUPPET_COMBO};a.level=36;a.recalc();a.syncSwords();a.modeState='battle';a.time=5;a.stillTime=1;a.player.moving=false;a.player.x=640;a.player.y=420;a.enemies=[];const e=a.spawn(0,{x:700,y:420,hp:1e6,noDrop:true});e.spawn=0;a.puppets=Array.from({length:a.stats.puppets||0},()=>({x:640,y:420,cool:0}));a.insects=Array.from({length:a.stats.insects||0},()=>({x:700,y:420,cool:0}));const shots=[],hits=[];a.shoot=(x,y,ang,d)=>shots.push(d);a.hit=(en,d,src)=>{hits.push([src,d]);};a.rebuildHash();a.updateAllies(1/60);row.ally={puppetShot:shots[0]??null,insectHit:hits.find(h=>h[0]==='insect')?.[1]??null,combos:[...a.comboSet]};}
 return plain(row);
}
export function captureRows(mods,combos){const rows=[];for(const combo of combos)for(const path of [0,1,2,3,4,5])for(const difficulty of [0,1,2])rows.push(captureRow(mods,combo,path,difficulty));return rows;}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const G=process.env.GAME_ROOT;if(!G)throw Error('GAME_ROOT required (the batch-A accepted tree)');
 const mods=await loadTree(G);
 process.stdout.write(JSON.stringify({source:'batch-A accepted snapshot (baseline/source-after-stepA.tar.gz), GAME_ROOT=<afterA>/game/',generated:new Date().toISOString().slice(0,10),command:'GAME_ROOT=<afterA>/game/ node scripts/round2-batchB-derived.mjs > scripts/fixtures/round2-batchB-derived-old-rules.json',combos:OLD_COMBOS,rows:captureRows(mods,OLD_COMBOS)},null,1));
}
