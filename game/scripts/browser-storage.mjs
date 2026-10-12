/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import assert from 'node:assert/strict';

// Each caller owns a fresh isolated context. Setup is a one-time driver action;
// no page initialization script can replay these writes on reload or a new page.
export async function seedOfflineStorage(page,url,slots){
 await page.goto(url);await page.waitForFunction(()=>window.__FANREN__?.art);
 if(!slots)return;
 const actual=await page.evaluate(values=>{for(const [key,value]of Object.entries(values))localStorage.setItem(key,value);return Object.fromEntries(Object.keys(values).map(key=>[key,localStorage.getItem(key)]));},slots);
 assert.deepEqual(actual,slots,'isolated fixture bytes must be seeded exactly once');
 await page.reload();await page.waitForFunction(()=>window.__FANREN__?.art);
 // Loading a recovery fixture can legitimately repair a backup journal. Its
 // expected post-load storage belongs to that test, not to this setup helper.
}
export const seedBrowserSave=(page,url,save)=>seedOfflineStorage(page,url,{'fanren-qingzhu-v1':JSON.stringify(save)});
export const readBrowserSave=page=>page.evaluate(()=>{
 const F=window.__FANREN__;
 return {href:location.href,localStorage:Object.fromEntries(Object.keys(localStorage).sort().map(key=>[key,localStorage.getItem(key)])),sessionStorage:Object.fromEntries(Object.keys(sessionStorage).sort().map(key=>[key,sessionStorage.getItem(key)])),save:F?.save,battle:F?.battle?.serialize(),risk:document.querySelector('.risk-dialog')?.innerText||null,status:document.querySelector('.checkpoint-status')?.innerText||null,body:document.body.innerText};
});
