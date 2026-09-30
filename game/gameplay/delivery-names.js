/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Offline entry names shared by the build, the player package, GitHub attachments and the in-game fallback.
export const OFFLINE_ENTRY='凡人修仙传_青竹剑阵.html',OFFLINE_PNG_ENTRY='凡人修仙传_青竹剑阵_兼容PNG.html';
export const PLAYER_ENTRY='开始游戏.html',PLAYER_PNG_ENTRY='兼容版/开始游戏_PNG.html';
export const githubEntry=(version,png=false)=>'qingzhu-'+version+(png?'-png':'')+'.html';
// Relative path from a default WebP entry to its PNG compatibility copy; null when unknown or already PNG.
export function compatibilityEntry(pathname){
 let name=String(pathname||'').split('/').pop();try{name=decodeURIComponent(name);}catch{return null;}
 if(name===PLAYER_ENTRY)return './'+PLAYER_PNG_ENTRY;
 if(name===OFFLINE_ENTRY)return './'+OFFLINE_PNG_ENTRY;
 const github=/^qingzhu-(.+)\.html$/.exec(name);
 return github&&!github[1].endsWith('-png')?'./'+githubEntry(github[1],true):null;
}
