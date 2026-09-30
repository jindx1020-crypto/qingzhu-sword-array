/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {releaseDir,artifactPath} from './delivery-paths.mjs';
import {GAME_VERSION} from '../gameplay/version.js';
import {OFFLINE_ENTRY,OFFLINE_PNG_ENTRY,githubEntry} from '../gameplay/delivery-names.js';
// GitHub normalizes non-ASCII asset names. Keep local names and create byte-identical upload aliases.
const folder=path.join(releaseDir,'github'),manifest=JSON.parse(fs.readFileSync(artifactPath('release-manifest.json'),'utf8'));
fs.mkdirSync(folder,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const mapping=[
 [OFFLINE_ENTRY,githubEntry(GAME_VERSION),'单文件游戏 · 浏览器直接打开'],
 [OFFLINE_PNG_ENTRY,githubEntry(GAME_VERSION,true),'PNG 兼容版 · 浏览器直接打开'],
 ['青竹剑阵_源码.zip','qingzhu-'+GAME_VERSION+'-source.zip','完整源码与开发说明 · GPLv3'],
 ['青竹剑阵_'+GAME_VERSION+'_免安装版.zip','qingzhu-'+GAME_VERSION+'-player.zip','免安装完整包 · 含对应源码']
];
const files=mapping.map(([localFile,file,label])=>{const bytes=fs.readFileSync(artifactPath(localFile)),hash=sha(bytes),entry=manifest.files.find(f=>f.file===localFile);assert.ok(entry&&entry.sha256===hash&&entry.bytes===bytes.length,'Stale artifact: '+localFile);fs.writeFileSync(path.join(folder,file),bytes);return {file,localFile,label,bytes:bytes.length,sha256:hash};});
fs.writeFileSync(path.join(folder,'SHA256SUMS.txt'),files.map(f=>f.sha256+'  '+f.file).join('\n')+'\n');
fs.writeFileSync(path.join(folder,'release-manifest.json'),JSON.stringify({...manifest,distribution:'GitHub assets; localFile identifies the original local build artifact',files},null,2)+'\n');
const uploads=[...files,...['SHA256SUMS.txt','release-manifest.json'].map(file=>{const bytes=fs.readFileSync(path.join(folder,file));return {file,label:file,bytes:bytes.length,sha256:sha(bytes)};})];
fs.writeFileSync(path.join(folder,'upload-plan.json'),JSON.stringify({tag:'v'+GAME_VERSION,files:uploads},null,2)+'\n');
console.log(JSON.stringify({folder:path.relative(releaseDir,folder),files:uploads.map(f=>({file:f.file,bytes:f.bytes,sha256:f.sha256}))}));
