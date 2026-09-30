/* SPDX-License-Identifier: GPL-3.0-only */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {root,releaseFiles} from './release-files.mjs';
import {validateGuide} from './guide-tables.mjs';
import {GAME_VERSION,GAME_TITLE} from '../gameplay/version.js';
import {artifactPath} from './delivery-paths.mjs';
const read=file=>fs.readFileSync(path.join(root,file)),readArtifact=file=>fs.readFileSync(artifactPath(file));
const files=releaseFiles(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const guide=read('青竹剑阵_游玩说明.md').toString();validateGuide(guide);
assert.equal(GAME_VERSION,'1.1');assert.equal(JSON.parse(read('game/package.json')).version,'1.1.0');assert.equal(JSON.parse(read('game/package-lock.json')).version,'1.1.0');assert.equal(JSON.parse(read('game/package.json')).license,'GPL-3.0-only');const changelog=read('青竹剑阵_更新日志.md').toString();assert.ok(changelog.startsWith(GAME_VERSION+' 修复更新\n')&&changelog.trimEnd().endsWith('1.0正式发布'),'Changelog must lead with the current release and keep 1.0');
const manifest=JSON.parse(readArtifact('release-manifest.json')),archive=unzipSync(readArtifact('青竹剑阵_源码.zip'));
const playerFolder='青竹剑阵_'+GAME_VERSION+'_免安装版',player=unzipSync(readArtifact(playerFolder+'.zip'));
assert.equal(Object.keys(player).length,5);
for(const [name,original]of Object.entries({'开始游戏.html':'凡人修仙传_青竹剑阵.html','兼容版/开始游戏_PNG.html':'凡人修仙传_青竹剑阵_兼容PNG.html','开源资料/青竹剑阵_源码.zip':'青竹剑阵_源码.zip','开源资料/LICENSE.txt':'LICENSE'}))assert.ok(Buffer.from(player[playerFolder+'/'+name]).equals(original==='LICENSE'?read(original):readArtifact(original)),'Player package differs: '+name);
assert.match(Buffer.from(player[playerFolder+'/先读我.txt']).toString(),/双击同一文件夹内的「开始游戏.html」/);
assert.deepEqual(Object.keys(archive).sort((a,b)=>a<b?-1:a>b?1:0),files);assert.deepEqual(Object.keys(manifest.source).sort((a,b)=>a<b?-1:a>b?1:0),files);
for(const file of files){const bytes=read(file);assert.ok(Buffer.from(archive[file]).equals(bytes),'ZIP differs: '+file);assert.equal(sha(bytes),manifest.source[file],'Manifest differs: '+file);assert.ok(bytes.length<50*1024*1024,'Oversized source: '+file);
 // Every non-binary file is scanned, including Python, text, SVG and HTML; paths also cover encoded tool folders and Windows profiles.
 if(!/\.(png|jpe?g|webp|gif|ico|zip)$/i.test(file)){
  const text=bytes.toString();assert.doesNotMatch(text,/\/(?:Users|home)\/[^\s/'"`]+\/|-Users-[A-Za-z0-9._]+-|\/private\/tmp\/|\/var\/folders\/|[A-Za-z]:\\{1,2}Users\\{1,2}/,'Personal path: '+file);
  assert.doesNotMatch(text,/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|sk-proj-[A-Za-z0-9_-]{30,})/,'Potential credential: '+file);
  if(file.endsWith('.md'))for(const m of text.matchAll(/\]\(([^)]+)\)/g)){const url=m[1].split('#')[0];if(!url||/^(?:https?:|mailto:)/.test(url))continue;const target=path.resolve(path.dirname(path.join(root,file)),decodeURIComponent(url));assert.ok(target.startsWith(root)&&fs.existsSync(target),'Broken local link: '+file+' -> '+url);}
 }
}
const assets=JSON.parse(read('game/public/assets/encoded/manifest.json'));
for(const item of manifest.files){const html=readArtifact(item.file);assert.equal(sha(html),item.sha256);assert.equal(html.length,item.bytes);if(item.file.endsWith('.html')){assert.ok(read(item.file).equals(html),'Root play entry differs: '+item.file);const text=html.toString(),png=item.file.includes('兼容PNG');assert.ok(text.includes('<title>'+GAME_TITLE+' '+GAME_VERSION+'</title>'));assert.ok(text.includes('third-party-notices'));assert.doesNotMatch(text,/<script\b[^>]*\bsrc=|<link\b[^>]*\bhref=["']https?:/i);for(const a of Object.values(assets.assets)){const bytes=read('game/public/assets/'+(png?a.source:a.file));assert.equal(sha(bytes),png?a.sourceSHA256:a.sha256);assert.ok(text.includes('data:'+(png?'image/png':a.mime)+';base64,'+bytes.toString('base64')),'Wrong embedded asset profile: '+item.file+' / '+a.source);}}}
const generated=read('game/gameplay/docs.generated.js').toString(),docs=JSON.parse(generated.replace(/^export default /,'').trim().replace(/;$/,''));assert.equal(docs.guide,guide);assert.equal(docs.changes,read('青竹剑阵_更新日志.md').toString());assert.ok(docs.license.includes('GNU GENERAL PUBLIC LICENSE'));
const inventory=JSON.parse(read('docs/dependency-inventory.json')),lock=JSON.parse(read('game/package-lock.json'));for(const [key,p]of Object.entries(lock.packages)){if(!key)continue;const name=key.split('node_modules/').at(-1);assert.ok(inventory.some(r=>r.package===name&&r.version===p.version&&r.license===p.license),'Dependency inventory outdated: '+name);}
const sums=manifest.files.map(f=>f.sha256+'  '+f.file).join('\n')+'\n';assert.equal(readArtifact('SHA256SUMS.txt').toString(),sums);
const result={version:GAME_VERSION,sourceFiles:files.length,sourceMatchesArchive:true,manifestMatches:true,guideMatches:true,linksAndPrivacy:true,files:manifest.files};fs.mkdirSync(path.join(root,'game/qa/release'),{recursive:true});fs.writeFileSync(path.join(root,'game/qa/release/packaging.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
