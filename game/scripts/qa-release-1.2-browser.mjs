/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {seedBrowserSave} from './browser-storage.mjs';
// 1.2 review fixes driven by real Playwright mouse, touchscreen and keyboard input (no synthetic DOM events), so :hover, stacking contexts,
// focus and gesture timing behave as for a player. ?test=1 hooks only jump to declared states. No phone hardware.
import {launchBrowser,offlineURL,projectRoot,variant} from './browser-runtime.mjs';import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {initialSave,TRAITS} from '../gameplay/data.js';
const out=path.join(projectRoot,'game/qa/release',variant,'release-1.2');fs.mkdirSync(out,{recursive:true});
const report={method:'Isolated headless Chromium; real Playwright mouse, touchscreen and keyboard input on the offline HTML; ?test=1 hooks only reach declared states. No phone hardware.',checks:[],errors:[],external:[]};
const veteran={...initialSave(),guidesSeen:['practice-v1',0,1,2,3,4,5],wins:1,unlocked:5,insight:500,completed:[0,1,2,3,4,5]};
const browser=await launchBrowser();
async function open(w,h,{save=veteran,touch=w<900}={}){const context=await browser.newContext({viewport:{width:w,height:h},hasTouch:touch,isMobile:touch&&w<900});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))report.external.push(r.url());});await seedBrowserSave(page,offlineURL(),save);return {context,page,touch};}
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
 for(const [w,h] of [[1440,900],[390,844]]){const {page,context,touch}=await open(w,h);await enterBattle(page);
  // A closing intro/cinematic overlay otherwise eats the first press, testing only one real pause.
  await page.locator('[data-slot=dialog-overlay]').waitFor({state:'detached'});await page.getByRole('button',{name:'暂停',exact:true}).click({trial:true});
  const box=await page.getByRole('button',{name:'暂停',exact:true}).boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
  if(touch){await page.touchscreen.tap(x,y);await page.waitForTimeout(150);await page.touchscreen.tap(x,y);}else{await page.mouse.click(x,y);await page.waitForTimeout(150);await page.mouse.click(x,y);}
  await page.waitForTimeout(400);assert.deepEqual(await state(page),{mode:'pause',scene:'pause',risk:null});
  const close=page.locator('.scene-pause [data-slot=dialog-close]');if(touch)await close.tap();else await close.click();await page.waitForFunction(()=>window.__FANREN__.battle.modeState==='battle');assert.deepEqual(await state(page),{mode:'battle',scene:null,risk:null},'an explicit close after the repeat window still resumes');
  await page.locator('[data-slot=dialog-overlay]').waitFor({state:'detached'});await page.getByRole('button',{name:'暂停',exact:true}).click();await page.waitForSelector('.scene-pause');await page.locator('.scene-pause [data-slot=dialog-close]').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__FANREN__.battle.modeState==='battle');assert.deepEqual(await state(page),{mode:'battle',scene:null,risk:null},'keyboard close remains immediate');
  report.checks.push({name:'double pause stays paused',w,h,explicitClose:true,keyboardClose:true});await context.close();}

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
 {const {page,context}=await open(844,390);await enterBattle(page);await page.evaluate(()=>{const b=window.__FANREN__.battle;/* Layout-only clock jump has no observed chapter history. */delete b.chapterStats;b.kills=2345;b.time=1834.4;b.finish(false,'被追兵围困');});await page.waitForSelector('.scene-result');await page.waitForTimeout(600);
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

 // 2026-10-08 playtest G01: a 符阵 defeat at narrow widths keeps every result number and the sigil table inside the dialog (1.2 left
 // the 541px table widening the whole result, so 净战斗时间 and 心得 sat past the right edge at 320×568).
 for(const [w,h] of [[320,568],[360,640],[568,320]]){const {page,context}=await open(w,h);await enterBattle(page,{mode:'story',path:4});await page.evaluate(()=>window.__FANREN__.step(600));
  await page.evaluate(()=>{const b=window.__FANREN__.battle;b.sigilStats.sigil.casts=21;b.sigilStats.sigil.empty=20;b.finish(false,'生命耗尽');});await page.waitForSelector('.scene-result .sigil-report');await settled(page);
  const r=await page.evaluate(()=>{const d=document.querySelector('.scene-result'),dr=d.getBoundingClientRect(),t=d.querySelector('.sigil-report .reader-table');const inside=e=>{const r=e.getBoundingClientRect();return r.left>=dr.left-.5&&r.right<=dr.right+.5;};
   return {scroll:d.scrollWidth,client:d.clientWidth,numbers:[...d.querySelectorAll('.result-stats strong')].every(inside),cells:[...t.querySelectorAll('th,td')].every(inside),table:t.scrollWidth-t.clientWidth};});
  assert.ok(r.scroll<=r.client,'result dialog does not overflow at '+w+'x'+h+': '+r.scroll+'>'+r.client);assert.ok(r.numbers,'result numbers inside the dialog');assert.ok(r.cells&&r.table<=0,'sigil table fits without its own scroll');
  const back=page.getByRole('button',{name:'回到山门'});await back.scrollIntoViewIfNeeded();const box=await back.boundingBox();assert.ok(await hit(page,box.x+box.width/2,box.y+box.height/2,'button'),'return button reachable');
  await shot(page,'result-sigil-'+w+'x'+h);report.checks.push({name:'narrow 符阵 result fits its dialog',w,h,...r});await context.close();}

 // G02: in the compact 568×320 HUD the 雷法 rest hint no longer spills onto 闪避 and 神雷; a real tap on 战况 shows it in the summary.
 {const {page,context}=await open(568,320);await enterBattle(page,{mode:'story',path:1});await page.evaluate(()=>window.__FANREN__.step(60));await page.waitForTimeout(300);
  const r=await page.evaluate(()=>{const label=document.querySelector('.skill-controls .reserve-label'),buttons=['.dash-button','.thunder-button'].map(s=>document.querySelector(s).getBoundingClientRect());const boxes=[];
   for(const walker=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);walker.nextNode();){const n=walker.currentNode;if(!n.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(n);for(const b of range.getClientRects())if(b.width>0)boxes.push(b);}
   return {compact:document.querySelector('main.fanren').classList.contains('hud-compact'),hint:getComputedStyle(document.querySelector('.reserve-rest-hint')).display,reserve:label.textContent.match(/雷源 \d+ \/ \d+/)?.[0]||null,overlaps:boxes.filter(a=>buttons.some(r=>a.left<r.right&&a.right>r.left&&a.top<r.bottom&&a.bottom>r.top)).length,horizontal:label.scrollWidth-label.clientWidth};});
  assert.ok(r.compact,'568×320 uses the compact HUD');assert.equal(r.hint,'none');assert.ok(r.reserve,'reserve value stays in the row');assert.equal(r.overlaps,0,'no reserve text over the skill buttons');assert.ok(r.horizontal<=0);
  await shot(page,'reserve-568x320');const box=await page.locator('.hud-summary-button').boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);await page.waitForSelector('.hud-summary-dialog');
  const summary=await page.locator('.hud-summary-dialog').innerText();assert.match(summary,/合格休整：基础\d+（上限内）/);report.checks.push({name:'compact 568×320 reserve row clear of skills; rest hint in 战况 summary',...r});await context.close();}

 // G31: the codex labels 灵犀佩 as a game invention, matching its source line; no card pairs a 原著 chip with a 非原著 source.
 {const {page,context}=await open(1440,900);await page.getByRole('button',{name:/藏经图鉴/}).click();await page.getByRole('tab',{name:/器物与配置/}).click();await page.waitForSelector('.codex-card');
  const cards=await page.locator('.codex-card').evaluateAll(cs=>cs.map(c=>({chip:c.firstElementChild.textContent,name:c.querySelector('h3').textContent,source:c.querySelector('small')?.textContent||''})));
  assert.equal(cards.find(c=>c.name==='灵犀佩').chip,'游戏化器物');assert.deepEqual(cards.filter(c=>c.chip.includes('原著器物')&&/非原著/.test(c.source)),[]);
  report.checks.push({name:'codex relic labels agree with their source lines',lingxi:cards.find(c=>c.name==='灵犀佩')});await context.close();}

 // Declared configuration fixtures verify the text players use to choose, then a real card click applies it.
 for(const fixture of [
  {path:5,traits:{},relics:['K11'],id:'guard-1',text:'本局护盾上限 21.25 → 34.85',shield:34.85},
  {path:2,traits:{'puppet-10':1},relics:[],id:'puppet-0',text:'常驻傀儡 2 → 3 · 本局护盾上限 8 → 12',shield:12},
  {path:1,traits:{'thunder-2':1},relics:['K03'],id:'thunder-2',text:'本局每次神雷耗用 21 → 17',cost:17}
 ]){const {page,context}=await open(320,568);await enterBattle(page,{mode:'story',path:fixture.path});
  await page.evaluate(({fixture,candidate})=>{const b=window.__FANREN__.battle;b.traits=fixture.traits;b.relics=fixture.relics;b.recalc();b.player.reserve=110;b.queuedChoices=1;b.openChoices();b.choices=[candidate];b.emit({type:'update'});},{fixture,candidate:TRAITS.find(t=>t.id===fixture.id)});
  await page.waitForSelector('.trait-effective');await settled(page);assert.ok((await page.locator('.trait-effective').innerText()).includes(fixture.text));
  if(fixture.cost)assert.match(await page.locator('.trait-effective').innerText(),/雷源可支撑 5 → 6 次.*仅储量预算/);
  await shot(page,'priority-five-preview-'+fixture.id);await page.locator('.choice-card .fr-btn').click();await page.waitForFunction(()=>window.__FANREN__.battle.modeState==='battle');
  const actual=await page.evaluate(()=>{const b=window.__FANREN__.battle;return {shield:b.player.maxShield,cost:b.thunderReadiness().cost};});
  if(fixture.shield!==undefined)assert.equal(actual.shield,fixture.shield);if(fixture.cost!==undefined)assert.equal(actual.cost,fixture.cost);
  report.checks.push({name:'priority five: effective candidate preview agrees with selected result',candidate:fixture.id,text:fixture.text,actual});await context.close();}

 // Normal-speed playtest follow-up: declared failure fixtures, not extra natural-play sessions.
 // The actual hit/finish path supplies the fatal record; check its rendered distinction from recent melee losses.
 for(const [w,h] of [[320,568],[568,320],[1024,768]]){const {page,context}=await open(w,h);await enterBattle(page);
  await page.evaluate(()=>{const b=window.__FANREN__.battle;/* Historical fatal-hit fixture assigns times directly, not a chapter playthrough. */delete b.chapterStats;b.clearField();b.player.shield=0;b.player.hp=100;b.recentHits=[];for(let i=0;i<4;i++){b.time=60+i;b.player.invuln=0;b.hitPlayer(20,true,{name:'追兵',kind:'近身'});}b.time=64;b.waveTime=64;b.player.invuln=0;b.hitPlayer(1000,true,{name:'毒雾',kind:'险地'});});
  await page.waitForSelector('.defeat-review');await settled(page);await page.waitForFunction(()=>!document.querySelector('.toast-layer .game-toast'));const review=page.locator('.defeat-review');
  assert.match(await review.locator('.defeat-objective').innerText(),/64 \/ 65 秒.*还差 1 秒/);
  assert.match(await review.locator('.defeat-fatal').innerText(),/毒雾 · 险地 → 韩立/);
  assert.match(await review.locator('.defeat-dominant').innerText(),/主要类型：近身.*80.*不是整局统计/);
  const filter=page.getByLabel('查看对象');await filter.selectOption('阵盘');assert.equal(await page.locator('.recent-hits li').count(),0);assert.match(await page.locator('.recent-hits').innerText(),/这 5 次记录中没有阵盘受击/);await filter.selectOption('韩立');assert.equal(await page.locator('.recent-hits li').count(),5);
  for(const selector of ['.defeat-objective','.defeat-fatal','.defeat-dominant']){const row=review.locator(selector);await row.evaluate(e=>e.scrollIntoView({block:'center'}));const r=await row.evaluate(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,overflow:e.scrollWidth-e.clientWidth,vw:innerWidth};});assert.ok(r.left>=0&&r.right<=r.vw+1&&r.overflow<=1,'readable defeat review '+w+'x'+h+' '+selector);}
  await review.locator('.defeat-objective').evaluate(e=>e.scrollIntoView({block:'start'}));await shot(page,'priority-five-defeat-'+w+'x'+h);report.checks.push({name:'priority five: unfinished objective and fatal vs bounded main damage readable',w,h});await context.close();}

 assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);
}finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));await browser.close();}
