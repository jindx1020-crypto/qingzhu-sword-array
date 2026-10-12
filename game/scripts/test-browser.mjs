/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {spawnSync} from 'node:child_process';
for(const profile of ['optimized','png'])for(const script of ['qa-batch1-browser.mjs','qa-batch2-browser.mjs','qa-batch3-browser.mjs','release-experience-browser.mjs','release-browser.mjs','qa-release-1.2-browser.mjs','qa-priority-batch2-browser.mjs','qa-priority-batch3-browser.mjs','qa-priority-batch4-browser.mjs','qa-priority-batch5-browser.mjs','qa-priority-batch6-browser.mjs']){
 console.log('Browser suite: '+profile+' / '+script);
 const r=spawnSync(process.execPath,['scripts/'+script],{env:{...process.env,QINGZHU_ASSET_PROFILE:profile},stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);
}
