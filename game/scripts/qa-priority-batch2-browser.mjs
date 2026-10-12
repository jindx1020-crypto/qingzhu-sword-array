/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {seedBrowserSave} from './browser-storage.mjs';
// Isolated, declared UI fixtures. These checks are not additional natural-speed playtest runs.
import {launchBrowser,offlineURL,projectRoot,variant} from './browser-runtime.mjs';
import {initialSave,TRAITS} from '../gameplay/data.js';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const out=path.join(projectRoot,'game/qa/release',variant,'priority-batch2');fs.mkdirSync(out,{recursive:true});
const report={method:'Isolated Chromium; declared configuration fixtures and real keyboard/mouse activation. No human or physical phone testing.',checks:[],errors:[],external:[],pass:false};
const browser=await launchBrowser();let currentPage;
async function open(w,h){const context=await browser.newContext({viewport:{width:w,height:h},hasTouch:w<900}),page=await context.newPage();currentPage=page;
 page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))report.external.push(r.url());});
 await seedBrowserSave(page,offlineURL(),{...initialSave(),guidesSeen:['practice-v1',0,1,2,3,4,5],wins:1,unlocked:5});return {page,context};
}
async function battle(page,path=2){await page.evaluate(path=>window.__FANREN__.start({mode:'story',path,skipPractice:true}),path);await page.locator('.scene-intro .primary-start').click();const skip=page.getByRole('button',{name:'跳过过场',exact:true});if(await skip.count())await skip.click();await page.waitForFunction(()=>window.__FANREN__.battle.modeState==='battle');}
const shot=(page,name)=>page.screenshot({path:path.join(out,name+'.png')});
const state=page=>page.evaluate(()=>{const b=window.__FANREN__.battle;return JSON.stringify(b.serialize());});
try{
 {const {page,context}=await open(1024,768);await page.getByRole('button',{name:/踏入修仙路/}).click();let tabs=0;
  for(;tabs<14;tabs++){if(await page.locator('.focus-shortcut').evaluate(e=>e===document.activeElement))break;await page.keyboard.press('Tab');}
  assert.ok(tabs<14,'explicit keyboard entry is near the beginning of journey controls');
  await page.keyboard.down('Enter');await page.keyboard.down('Enter');await page.keyboard.up('Enter');
  assert.ok(await page.locator('.journey-launch .primary-start').evaluate(e=>e===document.activeElement));assert.equal(await page.locator('.scene-intro').count(),0,'jump/held key never launches');
  await page.keyboard.press('Enter');await page.waitForSelector('.scene-intro');report.checks.push({name:'journey shortcut only focuses; a fresh Enter launches',tabs});await context.close();}

 for(const [w,h] of [[320,568],[568,320]]){const {page,context}=await open(w,h);await battle(page);
  await page.evaluate(choices=>{const b=window.__FANREN__.battle;b.traits={'sword-0':1,'sword-1':1,'sword-2':1,'puppet-0':1,'puppet-1':1,'puppet-2':1,'guard-0':1,'guard-1':1};b.recalc();b.queuedChoices=1;b.openChoices();b.choices=choices;b.emit({type:'update'});},['guard-2','sword-0','puppet-3'].map(id=>TRAITS.find(t=>t.id===id)));
  await page.waitForSelector('.choice-card');await page.waitForFunction(()=>document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).every(a=>a.playState!=='running'));const before=await state(page),card=page.locator('.choice-card').first(),description=await card.innerText();
  assert.match(description,/本次形成进退有据/);assert.match(description,/本次形成护阵傀儡/);assert.match(description,/新增一种战术/);assert.match(await page.locator('.choice-card').nth(1).innerText(),/种类不变/);
  const a11y=await page.locator('.choice-card').evaluateAll(cards=>cards.map(c=>{const buttons=[...c.querySelectorAll('button')],b=buttons[0],ids=b.getAttribute('aria-describedby').split(/\s+/);return {buttons:buttons.length,description:ids.map(id=>document.getElementById(id)?.textContent||'').join(' '),allExist:ids.every(id=>document.getElementById(id))};}));
  assert.ok(a11y.every(c=>c.buttons===1&&c.allExist&&c.description.includes('本次为第')));assert.match(a11y[0].description,/护甲.*护阵傀儡/);
  const summary=page.locator('.combo-progress>summary');await summary.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('.combo-progress').getAttribute('open'),'');
  const select=page.getByLabel('查看联动');await select.selectOption('swordGuard');
  assert.equal(await select.inputValue(),'swordGuard');await page.keyboard.press('Tab');assert.match(await page.locator('.combo-progress-rows').innerText(),/进退有据.*护身还差 1 种/);assert.equal(await state(page),before,'reading/tracking cannot change a snapshot or consume RNG');
  await card.evaluate(e=>e.scrollIntoView({block:'start'}));await shot(page,'mixed-choice-'+w+'x'+h);
  await card.locator('button').focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>window.__FANREN__.battle.modeState==='battle');
  const combos=await page.evaluate(()=>window.__FANREN__.battle.combos.map(c=>c.name));assert.ok(combos.includes('进退有据')&&combos.includes('护阵傀儡'));report.checks.push({name:'mixed combo preview, target tracking and associated keyboard description',w,h,combos});await context.close();}

 {const {page,context}=await open(320,568);await battle(page,5);await page.evaluate(()=>{const b=window.__FANREN__.battle;b.damageSources.return=23439;b.damageSources.arc=720;b.damageSources.guard=16187;b.damageSources.fire=24370;b.fireBreakdown.other=24370;b.finish(false,'复盘界面回归');});
  await page.waitForSelector('.scene-result');await page.waitForFunction(()=>!document.querySelector('.toast-layer .game-toast'));
  await page.locator('.damage-source-notes>summary').click();const text=await page.locator('.damage-report').innerText();assert.match(text,/本次历练累计/);assert.match(text,/余雷牵引雷击/);assert.match(text,/曾用核心.*当前未携带/s);assert.match(text,/可含反震.*不能.*反推/s);assert.match(text,/23,439/);assert.match(text,/24,370/);
  const geometry=await page.locator('.damage-bars').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));assert.ok(geometry.scroll<=geometry.width+1);await shot(page,'damage-history');report.checks.push({name:'damage history keeps totals and explains former core and unclassified fire',geometry});await context.close();}
 assert.equal(report.checks.length,4);assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);report.pass=true;
}catch(error){report.failure=String(error);if(currentPage&&!currentPage.isClosed())await shot(currentPage,'failure').catch(()=>{});throw error;
}finally{fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));await browser.close();}
