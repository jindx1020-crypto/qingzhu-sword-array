/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Real browser inputs plus explicitly synthetic save fixtures; no personal profile is opened.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {launchBrowser,qaOutput,offlineURL,variant} from './browser-runtime.mjs';
import {GAME_VERSION} from '../gameplay/version.js';
import {initialSave} from '../gameplay/data.js';
import {SAVE_KEY,BACKUP_KEY,JOURNAL_KEY,RAW_BACKUP_KEY,appendRawRecord} from '../gameplay/save-store.js';
const out=qaOutput('release'),report={variant,checks:[],errors:[],external:[],method:'Isolated Chromium with real pointer/keyboard/file inputs and synthetic storage fixtures; no phone hardware.'};
const browser=await launchBrowser();
async function open(width=390,height=844,slots=null,debug=true){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))report.external.push(r.url());});
 if(slots)await page.addInitScript(slots=>{if(!sessionStorage.releaseFixture){for(const [k,v]of Object.entries(slots))localStorage.setItem(k,v);sessionStorage.releaseFixture='1';}},slots);
 await page.goto(debug?offlineURL():offlineURL().replace('?test=1',''));if(slots)await page.waitForFunction(()=>window.__FANREN__?.art);else await page.getByRole('button',{name:/开源许可与源码/}).waitFor();return {page,context};
}
const snapshot=page=>page.evaluate(()=>Object.fromEntries(['fanren-qingzhu-v1','fanren-qingzhu-v1-backup','fanren-qingzhu-v1-backup-journal','fanren-qingzhu-v1-unreadable'].map(k=>[k,localStorage.getItem(k)])));
const cancel=page=>page.locator('.risk-dialog').getByRole('button',{name:'取消 · 保留当前状态'}).click();
try{
 for(const [width,height]of [[1440,900],[360,640],[390,844],[420,900],[844,390]]){
  const {page,context}=await open(width,height,null,false);assert.equal(await page.evaluate(()=>typeof window.__FANREN__),'undefined');assert.ok((await page.title()).endsWith(GAME_VERSION));
  await page.getByText('制作人：bilibili@卡布奇诺ultra',{exact:true}).scrollIntoViewIfNeeded();assert.ok(await page.getByText('制作人：bilibili@卡布奇诺ultra',{exact:true}).isVisible());
  if(width===1440)await page.screenshot({path:new URL('home.png',out).pathname});
  const before=await snapshot(page);await page.getByRole('button',{name:/开源许可与源码/}).click();const body=page.getByLabel('开源许可正文');assert.match(await body.innerText(),/GPL-3.0-only/);assert.match(await body.innerText(),/GNU GENERAL PUBLIC LICENSE/);assert.match(await body.innerText(),/青竹剑阵_源码.zip/);
  await page.getByRole('button',{name:'关闭说明',exact:true}).click();assert.deepEqual(await snapshot(page),before);
  await page.getByRole('button',{name:/游玩说明/}).click();await page.getByLabel('搜索说明关键词').fill('隔离原文');assert.match(await page.getByLabel('游玩说明正文').innerText(),/满额时停止本次覆盖/);await page.getByRole('button',{name:'下一个匹配段落',exact:true}).click();await page.screenshot({path:new URL('help-'+width+'x'+height+'.png',out).pathname});
  await page.getByRole('button',{name:'关闭说明',exact:true}).click();await page.getByRole('button',{name:/更新日志/}).click();const changes=(await page.getByLabel('更新日志正文').innerText()).trim();assert.ok(changes.startsWith('1.1 修复更新')&&changes.endsWith('1.0正式发布'),changes);
  if(width===1440){
   await page.getByRole('button',{name:'关闭说明',exact:true}).click();await page.getByRole('button',{name:/藏经图鉴/}).click();
   const thunder=page.locator('.codex-card').filter({has:page.getByRole('heading',{name:'雷威',exact:true})});assert.match(await thunder.innerText(),/40%/);
   await page.getByRole('tab',{name:/器物与配置/}).click();const core=page.locator('.codex-card').filter({has:page.getByRole('heading',{name:'合符同燃',exact:true})});assert.match(await core.innerText(),/独立间隔 4.5 秒/);assert.match(await core.innerText(),/当前新局基础规则/);
  }
  report.checks.push({name:'production home/help/license/log and current catalog',width,height});await context.close();
 }
 {
  const {page,context}=await open(1440,900,null,true);await page.waitForFunction(()=>window.__FANREN__?.art);
  await page.evaluate(()=>{window.__FANREN__.start({mode:'training',path:1,skipPractice:true});const b=window.__FANREN__.battle;b.start();while(b.scene==='cinematic')b.advanceCinematic(true);b.traits={'thunder-1':1};b.recalc();b.pause();});
  await page.locator('.run-stats > summary').click();const stats=await page.locator('.run-stats').innerText();assert.match(stats,/雷威 ×1[：:][^\n]*40%/);report.checks.push({name:'live trait breakdown uses saved balance values'});await context.close();
 }
 const records=[];for(let i=0;i<12;i++)appendRawRecord(records,'protected raw '+i,i);
 const slots={[SAVE_KEY]:'broken primary',[BACKUP_KEY]:'broken backup',[JOURNAL_KEY]:'broken journal',[RAW_BACKUP_KEY]:JSON.stringify({records})};
 const {page,context}=await open(390,844,slots);await page.getByRole('button',{name:'查看恢复方案',exact:true}).click();
 const before=await snapshot(page),incoming=JSON.stringify({...initialSave(),insight:321}),file={name:'release-fixture.json',mimeType:'application/json',buffer:Buffer.from(incoming)};
 const importFile=async()=>{await page.locator('.import-label input').setInputFiles(file);await page.locator('.recovery-panel').filter({hasText:'导入资料 · 只读预览'}).getByRole('button',{name:'查看并恢复'}).click();};
 await importFile();assert.deepEqual(await snapshot(page),before);await page.locator('.risk-confirm').click();await page.getByText(/隔离原文已满 12 份/).waitFor();assert.deepEqual(await snapshot(page),before);
 await page.getByRole('button',{name:'清理隔离原文 · 12 份',exact:true}).click();await cancel(page);assert.deepEqual(await snapshot(page),before);
 await page.getByRole('button',{name:'清理隔离原文 · 12 份',exact:true}).click();const download=page.waitForEvent('download');await page.locator('.risk-dialog').getByRole('button',{name:'导出原文',exact:true}).click();const exported=await download,exportPath=new URL('recovery-export.json',out).pathname;await exported.saveAs(exportPath);const bundle=JSON.parse(fs.readFileSync(exportPath,'utf8'));assert.equal(bundle.records.length,12);assert.equal(bundle.primary,slots[SAVE_KEY]);assert.deepEqual(await snapshot(page),before);
 await page.screenshot({path:new URL('cleanup-confirm.png',out).pathname});
 // A foreign change after the dialog opens must invalidate confirmation.
 await page.evaluate(key=>localStorage.setItem(key,'foreign backup'),BACKUP_KEY);await page.locator('.risk-confirm').click();assert.equal((await snapshot(page))[RAW_BACKUP_KEY],before[RAW_BACKUP_KEY]);
 await page.getByRole('button',{name:'清理隔离原文 · 12 份',exact:true}).click();await page.locator('.risk-confirm').click();assert.equal((await snapshot(page))[RAW_BACKUP_KEY],null);assert.equal((await snapshot(page))[JOURNAL_KEY],before[JOURNAL_KEY]);
 await importFile();await page.locator('.risk-confirm').click();await page.waitForFunction(()=>window.__FANREN__.save.insight===321);const final=await snapshot(page);assert.equal(JSON.parse(final[SAVE_KEY]).insight,321);const preserved=JSON.parse(final[RAW_BACKUP_KEY]).records;assert.ok(preserved.some(r=>r.raw===incoming));assert.ok(preserved.some(r=>r.raw.includes('broken primary')&&r.raw.includes('foreign backup')&&r.raw.includes('broken journal')));
 report.checks.push({name:'capacity stop/export/cancel/stale-confirm/confirmed cleanup/reimport',protected:preserved.length});await context.close();
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);
}catch(error){report.failure=String(error.stack);throw error;}finally{fs.writeFileSync(new URL('browser.json',out),JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({checks:report.checks.length,errors:report.errors.length,external:report.external.length}));
