/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Regenerates docs/dependency-inventory.json and docs/licenses/ from package-lock.json and the installed node_modules.
// Run after `npm ci` and `npm run build:offline` (bundled-packages.json marks every package whose code, stylesheet or vendored source is in the offline HTML).
// Only packages installed on this platform contribute local license texts; others keep registry URL and integrity.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {root} from './release-files.mjs';
const game=path.join(root,'game'),docs=path.join(root,'docs'),licenseDir=path.join(docs,'licenses');
const lock=JSON.parse(fs.readFileSync(path.join(game,'package-lock.json'),'utf8'));
const bundledFile=path.join(game,'offline-build','bundled-packages.json');
if(!fs.existsSync(bundledFile))throw Error('Run npm run build:offline first: '+path.relative(root,bundledFile)+' is missing');
// Bundled copies are matched by their installed lock path, and each must be a locked package of the same name and version.
const bundledList=JSON.parse(fs.readFileSync(bundledFile,'utf8')),bundled=new Set(bundledList.map(p=>p.path));
for(const p of bundledList){const entry=lock.packages[p.path];if(!p.path||!entry||p.path.split('node_modules/').at(-1)!==p.name||entry.version!==p.version)throw Error('Bundled package is not a locked dependency: '+p.name+'@'+p.version+' at '+p.path+'; rerun npm ci and npm run build:offline');}
const check=process.argv.includes('--check'),texts=new Map(),rows=[];
for(const [key,p]of Object.entries(lock.packages)){
 if(!key)continue;const name=key.split('node_modules/').at(-1),folder=path.join(game,key),licenseTexts=[];
 if(fs.existsSync(path.join(folder,'package.json')))for(const file of fs.readdirSync(folder).sort()){
  const full=path.join(folder,file);if(!/^(licen[cs]e|copying|notice)([.-]|$)/i.test(file)||!fs.statSync(full).isFile())continue;
  // Line endings are normalized so the stored text and its id do not depend on the package tarball or checkout platform.
  const text=Buffer.from(fs.readFileSync(full,'latin1').replaceAll('\r\n','\n'),'latin1'),id=createHash('sha256').update(text).digest('hex').slice(0,16);texts.set(id,text);licenseTexts.push('licenses/'+id+'.txt');
 }
 const row={package:name,version:p.version,license:p.license,resolved:p.resolved,integrity:p.integrity,bundledInOffline:bundled.has(key),licenseTexts:[...new Set(licenseTexts)]};
 rows.push({key,row});
}
// One row per lock entry (nested copies stay listed), ordered by lock path.
const inventory=rows.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0).map(r=>r.row);
const encoded=JSON.stringify(inventory,null,2)+'\n',target=path.join(docs,'dependency-inventory.json');
if(check){const same=fs.readFileSync(target,'utf8')===encoded&&[...texts.keys()].every(id=>fs.existsSync(path.join(licenseDir,id+'.txt')));console.log(JSON.stringify({packages:inventory.length,licenseTexts:texts.size,upToDate:same}));process.exitCode=same?0:1;}
else{
 fs.mkdirSync(licenseDir,{recursive:true});for(const [id,text]of texts)fs.writeFileSync(path.join(licenseDir,id+'.txt'),text);
 const used=new Set([...texts.keys()].map(id=>id+'.txt'));let removed=0;for(const file of fs.readdirSync(licenseDir))if(file.endsWith('.txt')&&!used.has(file)&&!fs.readFileSync(path.join(root,'THIRD_PARTY_NOTICES.md'),'utf8').includes('licenses/'+file)){fs.rmSync(path.join(licenseDir,file));removed++;}
 fs.writeFileSync(target,encoded);console.log(JSON.stringify({packages:inventory.length,licenseTexts:texts.size,removedLicenseTexts:removed}));
}
