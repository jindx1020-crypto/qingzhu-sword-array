/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import fs from 'node:fs';
import path from 'node:path';
import {root} from './release-files.mjs';
import {GAME_VERSION} from '../gameplay/version.js';
import {CHAPTER_NAMES} from '../gameplay/chapter-names.js';
import {CHAPTERS} from '../gameplay/data.js';
import {videoDir,introductionPath} from './delivery-paths.mjs';
const source=path.join(root,'docs/presentation');
// Narration and captions write `{version}` for the current release, so a version bump never leaves stale spoken text.
const content=JSON.parse(fs.readFileSync(path.join(source,'content.json'),'utf8'),(_key,value)=>typeof value==='string'?value.replaceAll('{version}',GAME_VERSION):value);
const data={...content,version:GAME_VERSION,chapters:CHAPTER_NAMES,chapterMaps:CHAPTERS.map(c=>c.map)};
const assets={};
for(const [key,file,mime]of [
 ['cover','game/public/assets/encoded/menu-backdrop.webp','image/webp'],
 ['maps','game/public/assets/encoded/battlefield-atlas.webp','image/webp'],
 ['battle','docs/presentation/assets/battle-72.jpg','image/jpeg'],
 ['choices','docs/presentation/assets/choices.jpg','image/jpeg']
])assets[key]='data:'+mime+';base64,'+fs.readFileSync(path.join(root,file)).toString('base64');
const literal=value=>JSON.stringify(value).replaceAll('<','\\u003c');
// One callback pass: `$&`-style sequences and placeholder names inside the inserted JSON stay literal.
const template=fs.readFileSync(path.join(source,'intro.template.html'),'utf8'),slots={__PRESENTATION_DATA__:data,__ASSET_DATA__:assets};
for(const slot of Object.keys(slots))if(template.split(slot).length!==2)throw Error('Introduction template needs exactly one '+slot);
const html=template.replace(/__PRESENTATION_DATA__|__ASSET_DATA__/g,slot=>literal(slots[slot]));
fs.mkdirSync(videoDir,{recursive:true});
const output=introductionPath;fs.writeFileSync(output,html);
const script='# 青竹剑阵 · 视频口播稿\n\n'+data.author+'\n\n适用游戏版本：'+GAME_VERSION+'。参考总时长：'+data.slides.reduce((n,s)=>n+s.duration,0)+' 秒，可按语速调整。\n\n'+data.slides.map((s,i)=>'## '+String(i+1).padStart(2,'0')+' '+s.label+'（约 '+s.duration+' 秒）\n\n'+s.speech+'\n\n画面字幕：'+s.cue+'\n').join('\n');
fs.writeFileSync(path.join(source,'口播稿.md'),script);
fs.writeFileSync(path.join(videoDir,'青竹剑阵_口播稿.md'),script);
fs.writeFileSync(path.join(videoDir,'录制说明.txt'),'用浏览器打开「青竹剑阵_视频介绍.html」。\n\nF：全屏；H：纯画面／返回控制；左右方向键：翻页；N：独立提词窗口；P：自动演示。\n共八段，口播参考约两分十四秒。录屏软件只采集主窗口，提词窗口可放在另一块屏幕。\n本文件夹内的 HTML 可单独带走，离线打开；口播稿附在同目录。\n');
console.log(JSON.stringify({file:path.basename(output),bytes:Buffer.byteLength(html),slides:data.slides.length,seconds:data.slides.reduce((n,s)=>n+s.duration,0)}));
