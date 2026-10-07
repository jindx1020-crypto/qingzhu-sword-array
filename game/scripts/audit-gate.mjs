/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Dependency gate for CI: any high or critical advisory fails, except the ones listed below that have no published fix upstream.
// A listed advisory fails the gate again as soon as its package publishes a version outside the vulnerable range,
// so the list can never hide a problem that an update would solve. New advisories are never listed automatically.
import {spawnSync} from 'node:child_process';
const UNFIXED={
 'GHSA-vfj7-8cjw-p6xm':'braces（最新 3.0.3 仍在受影响范围）：深层嵌套模式导致栈耗尽。仅经构建期工具（shadcn CLI、vinext 的 glob 插件、ts-morph）处理项目自身的固定模式，不进入离线成品。2026-10-08 列入。'
};
const npm=(args)=>{const r=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{encoding:'utf8',maxBuffer:64<<20,shell:process.platform==='win32'});return r.stdout;};
const report=JSON.parse(npm(['audit','--json']));
const advisories=new Map();
for(const [pkg,v] of Object.entries(report.vulnerabilities||{}))for(const via of v.via){
 if(typeof via!=='object'||!['high','critical'].includes(via.severity))continue;
 const id=via.url.split('/').pop(),entry=advisories.get(id)||{id,title:via.title,severity:via.severity,name:via.name,range:via.range,packages:new Set()};entry.packages.add(pkg);advisories.set(id,entry);
}
const parse=v=>String(v).split('.').map(Number);
const below=(a,b)=>{for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]<b[i];}return false;};
// Only simple upper-bound ranges are trusted; any other shape fails instead of being guessed.
function stillVulnerable(range,latest){const m=/^<(=?)\s*(\d+\.\d+\.\d+)$/.exec(range.trim());if(!m)return null;const l=parse(latest),bound=parse(m[2]);return below(l,bound)||(m[1]==='='&&l.join('.')===bound.join('.'));}
const failures=[],allowed=[];
for(const a of advisories.values()){
 if(!UNFIXED[a.id]){failures.push(a.severity+' '+a.id+' '+a.name+' '+a.range+'：'+a.title+'（经 '+[...a.packages].join('、')+'）');continue;}
 const latest=npm(['view',a.name,'version']).trim(),vulnerable=stillVulnerable(a.range,latest);
 if(vulnerable===true)allowed.push(a.id+' '+a.name+'@'+latest+' 仍无修复版：'+UNFIXED[a.id]);
 else failures.push(a.id+' '+a.name+' 最新 '+latest+(vulnerable===false?' 已不在受影响范围 '+a.range+'：请升级并从 UNFIXED 移除':' 的范围 '+a.range+' 无法判定，请人工核对'));
}
for(const line of allowed)console.log('允许（上游未修复）：'+line);
if(failures.length){console.error('依赖审计未通过：\n'+failures.map(f=>'- '+f).join('\n'));process.exit(1);}
console.log('依赖审计通过：高危及以上 '+advisories.size+' 项，其中上游未修复且已登记 '+allowed.length+' 项。');
