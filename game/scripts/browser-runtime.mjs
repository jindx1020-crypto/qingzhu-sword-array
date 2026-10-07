/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
export {chromium};
export const projectRoot=fileURLToPath(new URL('../../',import.meta.url));
export const variant=process.env.QINGZHU_ASSET_PROFILE==='png'?'png':'webp';
export const htmlPath=path.resolve(process.env.QINGZHU_HTML||path.join(projectRoot,variant==='png'?'凡人修仙传_青竹剑阵_兼容PNG.html':'凡人修仙传_青竹剑阵.html'));
export const offlineURL=(png=false)=>pathToFileURL(png&&!process.env.QINGZHU_HTML?path.join(projectRoot,'凡人修仙传_青竹剑阵_兼容PNG.html'):htmlPath).href+'?test=1';
// A plain directory path: file-URL pathnames stay percent-encoded (spaces, CJK) and break screenshot, download and fs targets.
export function qaOutput(name){const dir=path.join(projectRoot,'game/qa/release',variant,name);fs.mkdirSync(dir,{recursive:true});return dir;}
export const launchBrowser=()=>chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
