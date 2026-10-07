/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {launchBrowser} from './browser-runtime.mjs';
import {root} from './release-files.mjs';
import {introductionPath} from './delivery-paths.mjs';
import {GAME_VERSION} from '../gameplay/version.js';
const out=path.join(root,'game/qa/introduction');fs.mkdirSync(out,{recursive:true});
const versions=text=>[...new Set([...text.matchAll(/(?<![\d.])\d+\.\d+(?:\.\d+)*(?![\d.])/g)].map(m=>m[0]))];
const browser=await launchBrowser(),context=await browser.newContext({offline:true,viewport:{width:1366,height:900}}),page=await context.newPage();
const report={checks:[],errors:[],externalRequests:[],slides:[]};page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))report.externalRequests.push(r.url());});
try{
 await page.goto(pathToFileURL(introductionPath).href);await page.waitForFunction(()=>[...document.querySelectorAll('[data-asset]')].every(i=>i.complete&&i.naturalWidth));
 assert.equal(await page.locator('.slide').count(),8);assert.equal(await page.locator('#framePage').innerText(),'01');
 // Every version number on the page (labels in all slides, title, captions and narration data) is the current game version.
 const shown=await page.evaluate(()=>{const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:n=>n.parentElement?.closest('script,style')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT}),texts=[document.title];while(walker.nextNode())texts.push(walker.currentNode.nodeValue);return {text:texts.join('\n'),data:JSON.stringify(DATA),marked:[...document.querySelectorAll('[data-version]')].map(e=>e.textContent),outro:document.querySelector('.outro .eyebrow').textContent};});
 assert.ok(shown.marked.length>=3&&shown.marked.every(v=>v===GAME_VERSION),'Version labels: '+shown.marked.join(', '));assert.equal(shown.outro,'青竹剑阵 · '+GAME_VERSION);assert.deepEqual(versions(shown.text+'\n'+shown.data),[GAME_VERSION]);report.checks.push('every version label, caption and narration shows '+GAME_VERSION);
 await page.locator('#notesBtn').click();assert.ok(await page.locator('#liveNotes').isVisible());assert.match(await page.locator('#notesSpeech').innerText(),/大家好/);
 const downloading=page.waitForEvent('download');await page.locator('#exportBtn').click();const download=await downloading,scriptFile=path.join(out,'口播稿.txt');await download.saveAs(scriptFile);assert.match(fs.readFileSync(scriptFile,'utf8'),/08 开始游玩/);assert.deepEqual(versions(fs.readFileSync(scriptFile,'utf8')),[GAME_VERSION]);report.checks.push('inline narration and complete script download');
 const opening=page.waitForEvent('popup');await page.locator('#speakerBtn').click();const speaker=await opening;await speaker.waitForLoadState();speaker.on('pageerror',e=>report.errors.push(e.message));
 await page.locator('#nextBtn').click();await speaker.waitForFunction(()=>document.getElementById('speakerTitle').textContent==='核心玩法');
 await speaker.locator('[data-speaker-command=next]').click();await page.waitForFunction(()=>document.getElementById('framePage').textContent==='03');
 await speaker.screenshot({path:path.join(out,'speaker.png')});report.checks.push('independent prompter synchronizes both ways');await speaker.close();await page.bringToFront();
 await page.locator('#overviewBtn').click();await page.locator('#overviewGrid [data-goto="5"]').click();assert.equal(await page.locator('#framePage').innerText(),'06');
 await page.locator('#captionBtn').click();assert.equal(await page.locator('#subtitle').isVisible(),false);await page.locator('#captionBtn').click();
 await page.locator('#fullscreenBtn').click();await page.waitForFunction(()=>!!document.fullscreenElement);await page.locator('#fullscreenBtn').click();await page.waitForFunction(()=>!document.fullscreenElement);report.checks.push('overview, caption switch and fullscreen');
 await page.setViewportSize({width:1920,height:1080});await page.keyboard.press('h');await page.waitForTimeout(2600);assert.equal(await page.locator('.topbar').isVisible(),false);assert.equal(await page.locator('.controls').isVisible(),false);assert.equal(await page.locator('#liveNotes').isVisible(),false);
 for(let i=0;i<8;i++){
  await page.keyboard.press(String(i+1));await page.waitForTimeout(800);assert.equal(await page.locator('.slide.active').count(),1);
  const bounds=await page.locator('.stage').boundingBox();assert.ok(Math.abs(bounds.width/bounds.height-16/9)<.001&&bounds.x>=-1&&bounds.y>=-1);
  const clipped=await page.locator('.slide.active').evaluate(slide=>{const stage=document.getElementById('stage').getBoundingClientRect();return [...slide.querySelectorAll('h1,h2,h3,p,.credit,.cover-arc,.giant-number,.key-row,.open-hint')].filter(e=>{const r=e.getBoundingClientRect();return r.left<stage.left+20||r.top<stage.top+20||r.right>stage.right-20||r.bottom>stage.bottom-20;}).map(e=>e.textContent);});assert.deepEqual(clipped,[]);
  await page.screenshot({path:path.join(out,'slide-'+(i+1)+'.png')});report.slides.push({slide:i+1,bounds,textNotClipped:true});
 }
 report.checks.push('eight 1920×1080 recording frames, keyboard navigation, no clipped text');
 await page.keyboard.press('h');await page.locator('#chaptersNav [data-goto="0"]').click();await page.locator('#playBtn').click();await page.waitForFunction(()=>document.getElementById('framePage').textContent==='02',null,{timeout:20000});await page.locator('#playBtn').click();report.checks.push('automatic timing advances and pauses');
 for(const [width,height]of [[1024,768],[800,700],[390,844]]){await page.setViewportSize({width,height});await page.waitForTimeout(150);const overflow=await page.locator('.tools button').evaluateAll(buttons=>buttons.filter(b=>{const r=b.getBoundingClientRect();return r.left<0||r.right>innerWidth+1||r.top<0;}).map(b=>b.textContent));assert.deepEqual(overflow,[]);}
 report.checks.push('controls fit 1024, 800 and 390 pixel windows');assert.deepEqual(report.errors,[]);assert.deepEqual(report.externalRequests,[]);assert.equal(await page.evaluate(()=>localStorage.length),0);
}catch(error){report.failure=String(error.stack);throw error;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({checks:report.checks,slides:report.slides.length,errors:report.errors,externalRequests:report.externalRequests}));
