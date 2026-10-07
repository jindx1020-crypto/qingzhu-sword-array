/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// 1.2 review fixes driven by real Playwright mouse, touchscreen and keyboard input (no synthetic DOM events), so :hover, stacking contexts,
// focus and gesture timing behave as for a player. ?test=1 hooks only jump to declared states. No phone hardware.
import {launchBrowser,offlineURL,projectRoot,variant} from './browser-runtime.mjs';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {initialSave} from '../gameplay/data.js';
const out=path.join(projectRoot,'game/qa/release',variant,'release-1.2');fs.mkdirSync(out,{recursive:true});
const report={method:'Isolated headless Chromium; real Playwright mouse, touchscreen and keyboard input on the offline HTML; ?test=1 hooks only reach declared states. No phone hardware.',checks:[],errors:[],external:[]};
const veteran={...initialSave(),guidesSeen:['practice-v1',0,1,2,3,4,5],wins:1,unlocked:5,insight:500,completed:[0,1,2,3,4,5]};
const browser=await launchBrowser();
async function open(w,h,{save=veteran,touch=w<900}={}){const context=await browser.newContext({viewport:{width:w,height:h},hasTouch:touch,isMobile:touch&&w<900});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))report.external.push(r.url());});await page.addInitScript(s=>{if(!sessionStorage.fixture){localStorage.setItem('fanren-qingzhu-v1',s);sessionStorage.fixture='1';}},JSON.stringify(save));await page.goto(offlineURL());await page.waitForFunction(()=>window.__FANREN__?.art);return {context,page,touch};}
const shot=(page,name)=>page.screenshot({path:path.join(out,name+'.png')});
const state=page=>page.evaluate(()=>{const b=window.__FANREN__.battle;return {mode:b?.modeState??null,scene:b?.scene??null,risk:document.querySelector('.risk-dialog [data-slot=alert-dialog-title]')?.textContent||null};});
async function tap(page,touch,x,y){if(touch)await page.touchscreen.tap(x,y);else{await page.mouse.move(x-60,y+40);await page.mouse.move(x,y,{steps:6});await page.mouse.down();await page.mouse.up();}}
async function enterBattle(page,opts={mode:'story',path:0}){await page.evaluate(o=>window.__FANREN__.start({skipPractice:true,...o}),opts);await page.waitForSelector('.scene-intro');await page.locator('.scene-intro .panel-action-dock .primary-start').click();if(await page.getByRole('button',{name:'跳过过场'}).count())await page.getByRole('button',{name:'跳过过场'}).click();await page.waitForFunction(()=>window.__FANREN__.battle?.modeState==='battle');}
// Dialogs open with a zoom-in animation; measure geometry only after it has finished.
const settled=page=>page.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'));
// Hit-test the element at a viewport point; pseudo-elements report their originating element.
const hit=(page,x,y,selector)=>page.evaluate(([x,y,selector])=>{const e=document.elementFromPoint(x,y);return !!e&&(selector?!!e.closest(selector):true);},[x,y,selector]);
try{
 // Choice cards: a click or tap on the card body (not its button) selects, with the real :hover/:active states applied.
 for(const [w,h] of [[1440,900],[1024,768],[390,844]]){const {page,context,touch}=await open(w,h);await enterBattle(page);let selected=0;
  for(let i=0;i<6;i++){await page.evaluate(()=>{const b=window.__FANREN__.battle;b.queuedChoices=1;b.openChoices();});const card=page.locator('.scene-choice .choice-card').nth(i%3);await card.waitFor();await card.evaluate(e=>e.scrollIntoView({block:'center'}));await page.waitForTimeout(250);
   const box=await card.boundingBox(),x=box.x+box.width*(.25+.1*(i%3)),y=box.y+Math.min(48,box.height*.3);assert.ok(await hit(page,x,y,'.choice-card'),'card body point is on the card');
   await tap(page,touch,x,y);await page.waitForFunction(()=>window.__FANREN__.battle.modeState==='battle',null,{timeout:2000}).then(()=>selected++,()=>{});}
  assert.equal(selected,6,'every card-body activation selects ('+w+'x'+h+')');report.checks.push({name:'choice card body selects with real '+(touch?'touch':'mouse'),w,h,selected});await context.close();}

 // Toasts raised while a dialog is open render above it in a live region that the modal does not aria-hide.
 {const {page,context}=await open(1440,900);await enterBattle(page);await page.evaluate(()=>window.__FANREN__.step(240));await page.keyboard.press('Escape');await page.waitForSelector('.scene-pause');
  await page.locator('.scene-pause').getByRole('button',{name:/返回山门/}).click();await page.waitForSelector('.risk-dialog');const download=page.waitForEvent('download');
  await page.locator('.risk-dialog').getByRole('button',{name:/导出/}).first().click();await download;const toast=page.locator('.toast-layer .game-toast');await toast.waitFor();
  // Toasts ignore pointer events, which hit testing honours; enable them only while testing the stacking order.
  const info=await toast.evaluate(t=>{const layer=t.closest('.toast-layer');layer.style.pointerEvents=t.style.pointerEvents='auto';const r=t.getBoundingClientRect(),e=document.elementFromPoint((r.left+r.right)/2,(r.top+r.bottom)/2);layer.style.pointerEvents=t.style.pointerEvents='';return {text:t.textContent,topmost:t===e||t.contains(e),hidden:!!t.closest('[aria-hidden=true]'),live:layer.getAttribute('aria-live')};});
  assert.ok(info.topmost,'toast is the topmost element at its centre');assert.equal(info.hidden,false);assert.equal(info.live,'polite');await shot(page,'toast-over-dialog');report.checks.push({name:'toast above dialog and reachable by assistive tech',...info});await context.close();}

 // Cramped screens: the pinned launch dock (启程 and difficulty) stays visible without scrolling, as the 1.0 acceptance requires, while the
 // scrollable journey body keeps real height (1.1 left 11–57px) and starters stay reachable and selectable inside it.
 const inView=(page,selector)=>page.locator(selector).first().evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.left>=0&&r.bottom<=innerHeight+1&&r.right<=innerWidth+1;});
 for(const [w,h] of [[320,568],[360,640],[568,320],[667,375],[744,430],[820,560]]){const {page,context,touch}=await open(w,h);await page.getByRole('button',{name:/踏入修仙路/}).click();await page.waitForSelector('.journey-launch');
  assert.ok(await inView(page,'.journey-launch .primary-start')&&await inView(page,'.launch-selection select'),'launch dock visible without scrolling at '+w+'x'+h);
  const body=await page.locator('.journey-frame>.panel-body-wrap').evaluate(e=>e.getBoundingClientRect().height);assert.ok(body>=Math.max(60,h*.22),'journey body '+body+'px at '+w+'x'+h);
  const card=page.locator('.path-card').nth(1);await card.evaluate(e=>e.scrollIntoView({block:'start'}));await page.waitForTimeout(150);const box=await card.boundingBox();assert.ok(await hit(page,box.x+box.width/2,box.y+20,'.path-card'),'starter card is unobstructed');
  await tap(page,touch,box.x+box.width/2,box.y+20);assert.equal(await card.getAttribute('aria-pressed'),'true');
  await shot(page,'journey-'+w+'x'+h);report.checks.push({name:'cramped journey: dock pinned, body usable, starters selectable',w,h,body:Math.round(body)});await context.close();}
 for(const [w,h] of [[320,568],[360,640],[568,320]]){const {page,context}=await open(w,h);await enterBattle(page);await page.evaluate(()=>window.__FANREN__.battle.completeNode());await page.waitForSelector('.rest-scroll');await settled(page);
  const body=await page.locator('.rest-scroll').evaluate(e=>e.getBoundingClientRect().height);assert.ok(body>=Math.max(60,h*.2),'rest body '+body+'px at '+w+'x'+h);assert.ok(await inView(page,'.rest-action-dock .primary-start'),'rest departure stays visible');
  await shot(page,'rest-'+w+'x'+h);report.checks.push({name:'cramped rest: departure pinned, body usable',w,h,body:Math.round(body)});await context.close();}

 // Practice step 3: target B is visible beside the docked instructions and a real tap or held click on it completes the step.
 for(const [w,h] of [[844,390],[1024,768]]){const {page,context,touch}=await open(w,h);await page.evaluate(()=>window.__FANREN__.start({mode:'training',guidedPractice:true,skipPractice:true}));await page.waitForSelector('.scene-intro');
  await page.locator('.scene-intro .panel-action-dock .primary-start').click();await page.waitForSelector('.practice-panel');
  for(let s=0;s<2;s++){await page.evaluate(()=>{const b=window.__FANREN__.battle;b.practice.ready=true;b.emit({type:'update'});});await page.locator('.practice-panel').getByRole('button',{name:/下一项/}).click();}
  await page.waitForFunction(()=>window.__FANREN__.battle.practice?.step===2);await page.waitForTimeout(300);
  const b=await page.evaluate(()=>{const F=window.__FANREN__,c=F.camera,e=F.battle.enemies.find(v=>v.name.startsWith('B ·'));return {x:c.x+e.x*c.scale,y:c.y+e.y*c.scale};});
  assert.ok(await hit(page,b.x,b.y,'canvas.world-canvas'),'target B is not covered at '+w+'x'+h);
  if(touch)await page.touchscreen.tap(b.x,b.y);else{await page.mouse.move(b.x,b.y);await page.mouse.down();}
  await page.waitForFunction(()=>window.__FANREN__.battle.practice?.ready===true,null,{timeout:6000});if(!touch)await page.mouse.up();
  await shot(page,'practice-b-'+w+'x'+h);report.checks.push({name:'practice step 3 target B visible and completable by '+(touch?'tap':'held click'),w,h});await context.close();}

 // A double activation of pause (one gesture, two presses) leaves the game paused instead of resuming at once.
 for(const [w,h] of [[1440,900],[390,844]]){const {page,context,touch}=await open(w,h);await enterBattle(page);const box=await page.getByRole('button',{name:'暂停',exact:true}).boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  if(touch){await page.touchscreen.tap(x,y);await page.waitForTimeout(150);await page.touchscreen.tap(x,y);}else{await page.mouse.click(x,y);await page.waitForTimeout(150);await page.mouse.click(x,y);}
  await page.waitForTimeout(400);assert.deepEqual(await state(page),{mode:'pause',scene:'pause',risk:null});report.checks.push({name:'double pause stays paused',w,h});await context.close();}

 // 「再历此境」 repeats the finished run, even after the run was resumed from the home page.
 {const {page,context}=await open(1440,900);await page.getByRole('button',{name:/踏入修仙路/}).click();await page.waitForSelector('.journey-launch');
  await page.locator('.path-card').nth(4).click();await page.locator('.difficulty-option').nth(2).click();await page.getByRole('button',{name:'定种历练'}).click();await page.getByPlaceholder('相同种子、相同选择，重现同一局').fill('replay-seed-12');
  await page.locator('.journey-launch .primary-start').click();await page.waitForSelector('.scene-intro');await page.reload();await page.waitForFunction(()=>window.__FANREN__?.art);
  await page.getByRole('button',{name:/继续历练/}).click();await page.waitForFunction(()=>!!window.__FANREN__.battle);await page.evaluate(()=>window.__FANREN__.battle.finish(false,'测试'));await page.waitForSelector('.scene-result');
  await page.getByRole('button',{name:/再历此境/}).click();await page.waitForSelector('.scene-intro');
  const cfg=await page.evaluate(()=>{const b=window.__FANREN__.battle;return {path:b.path,difficulty:b.options.difficulty,mode:b.mode,seed:b.seed};});
  assert.deepEqual(cfg,{path:4,difficulty:2,mode:'seed',seed:'replay-seed-12'});report.checks.push({name:'再历此境 repeats the finished seeded run',...cfg});await context.close();}

 // After cancelling a cross-window conflict, departing from the rest re-opens the conflict explanation instead of doing nothing.
 {const {page,context}=await open(1440,900);await enterBattle(page);await page.evaluate(()=>{const b=window.__FANREN__.battle;b.completeNode();const r=b.rest;if(r.event&&!b.restReadiness().event){const n=b.eventText().choices.length;for(let i=0;i<n;i++)if(!b.interactionReadiness(i).blocked){b.chooseInteraction(i);break;}}if(!r.coreDone)b.skipCore();if(!r.routeDone)b.chooseRoute(0);});
  const other=await context.newPage();await other.goto(offlineURL().replace('?test=1',''));await other.waitForTimeout(1500);
  await other.evaluate(()=>{const raw=JSON.parse(localStorage.getItem('fanren-qingzhu-v1'));raw.insight+=1;raw.revision+=5;raw.savedAt=Date.now();localStorage.setItem('fanren-qingzhu-v1',JSON.stringify(raw));});await other.close();
  await page.bringToFront();await page.waitForSelector('.risk-dialog');await page.locator('.risk-dialog').getByRole('button',{name:'取消 · 保留当前状态'}).click();await page.waitForSelector('.risk-dialog',{state:'detached'});
  await page.locator('.rest-action-dock .primary-start').click();await page.waitForSelector('.risk-dialog');assert.match((await state(page)).risk,/另一窗口更新了存档/);
  await shot(page,'conflict-reprompt');report.checks.push({name:'rest departure re-prompts a cancelled conflict'});await context.close();}

 // Small landscape help: search Enter and the chapter directory scroll the box that actually scrolls.
 {const {page,context}=await open(568,320);await page.getByRole('button',{name:/游玩说明/}).first().click();await page.waitForSelector('.help-reader');
  await page.getByLabel('搜索说明关键词').fill('药园');await page.keyboard.press('Enter');await page.waitForTimeout(300);
  const match=await page.locator('.reader-current-match').evaluate(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,vh:innerHeight};});
  assert.ok(match.top>=0&&match.top<match.vh,'the current match is scrolled into view');await shot(page,'help-search-568x320');report.checks.push({name:'small landscape help search jumps',match});await context.close();}

 // A defeat opens the result with its heading in view on short landscape screens.
 {const {page,context}=await open(844,390);await enterBattle(page);await page.evaluate(()=>{const b=window.__FANREN__.battle;b.kills=2345;b.time=1834.4;b.finish(false,'被追兵围困');});await page.waitForSelector('.scene-result');await page.waitForTimeout(600);
  const r=await page.evaluate(()=>{const d=document.querySelector('[data-slot=dialog-content]'),t=d.querySelector('[data-slot=dialog-title]').getBoundingClientRect(),dr=d.getBoundingClientRect();return {scrollTop:d.scrollTop,titleVisible:t.top>=dr.top-1&&t.bottom<=dr.bottom+1};});
  assert.ok(r.titleVisible&&r.scrollTop<40,'result opens at its heading');await shot(page,'result-844x390');report.checks.push({name:'result opens at its heading on short landscape',...r});await context.close();}

 // The last rest of an endless loop names the next loop instead of promising a settlement.
 {const {page,context}=await open(1440,900);await page.evaluate(()=>window.__FANREN__.start({mode:'endless',path:0,skipPractice:true}));await page.waitForSelector('.scene-intro');
  await page.evaluate(()=>{const F=window.__FANREN__;for(let guard=0;guard<600;guard++){const b=F.battle;if(b.chapter===5&&b.scene==='intermission'&&b.rest?.last)break;if(b.scene==='intro')b.start();else if(b.scene==='cinematic')b.advanceCinematic(true);else if(b.scene==='choice')b.chooseTrait(b.choices[0].id);else if(b.scene==='intermission'){const r=b.rest;if(r.event&&!b.restReadiness().event){const n=b.eventText().choices.length;for(let i=0;i<n;i++)if(!b.interactionReadiness(i).blocked){b.chooseInteraction(i);break;}}if(!r.coreDone)b.skipCore();if(!r.routeDone)b.chooseRoute(0);b.continueRest();}else if(b.modeState==='battle'){b.clearField();b.boss=null;b.completeNode();}}});
  await page.waitForSelector('.rest-action-dock');const dock=await page.locator('.rest-action-dock').innerText();assert.doesNotMatch(dock,/结算研究点|收拢所得/);
  await page.evaluate(()=>{const b=window.__FANREN__.battle,r=b.rest;if(r.event&&!b.restReadiness().event){const n=b.eventText().choices.length;for(let i=0;i<n;i++)if(!b.interactionReadiness(i).blocked){b.chooseInteraction(i);break;}}if(!r.coreDone)b.skipCore();for(let g=0;b.queuedChoices&&g<10;g++){b.continueRest();if(b.scene==='choice')b.chooseTrait(b.choices[0].id);}});await page.waitForSelector('.rest-action-dock');
  assert.match(await page.locator('.rest-action-dock .primary-start').innerText(),/进入第 2 圈/);report.checks.push({name:'endless last rest names the next loop'});await context.close();}

 // Esc answers the visible confirmation first, not the hidden battle summary beneath it.
 {const {page,context}=await open(390,844);await enterBattle(page);await page.locator('.hud-summary-button').click();await page.waitForSelector('.hud-summary-dialog');
  const other=await context.newPage();await other.goto(offlineURL().replace('?test=1',''));await other.waitForTimeout(1500);
  await other.evaluate(()=>{const raw=JSON.parse(localStorage.getItem('fanren-qingzhu-v1'));raw.insight+=1;raw.revision+=5;raw.savedAt=Date.now();localStorage.setItem('fanren-qingzhu-v1',JSON.stringify(raw));});await other.close();
  await page.bringToFront();await page.waitForSelector('.risk-dialog');await page.keyboard.press('Escape');await page.waitForSelector('.risk-dialog',{state:'detached'});
  report.checks.push({name:'Esc closes the visible confirmation first'});await context.close();}

 assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);
}finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));await browser.close();}
