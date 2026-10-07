/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {root,releaseFiles} from './release-files.mjs';
import {validateGuide} from './guide-tables.mjs';
import {GAME_VERSION,GAME_TITLE} from '../gameplay/version.js';
import {OFFLINE_ENTRY,OFFLINE_PNG_ENTRY,PLAYER_ENTRY,PLAYER_PNG_ENTRY} from '../gameplay/delivery-names.js';
import {artifactPath,releaseArtifacts,SOURCE_ARCHIVE,PLAYER_FOLDER,PLAYER_ARCHIVE} from './delivery-paths.mjs';
const read=file=>fs.readFileSync(path.join(root,file)),readArtifact=file=>fs.readFileSync(artifactPath(file)),byCode=(a,b)=>a<b?-1:a>b?1:0;
const files=releaseFiles(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const guide=read('青竹剑阵_游玩说明.md').toString();validateGuide(guide);
// Labels follow version.js (major.minor → package major.minor.0), so a version bump needs no edit here.
const packageVersion=/^\d+\.\d+$/.test(GAME_VERSION)?GAME_VERSION+'.0':GAME_VERSION;
assert.equal(JSON.parse(read('game/package.json')).version,packageVersion);assert.equal(JSON.parse(read('game/package-lock.json')).version,packageVersion);assert.equal(JSON.parse(read('game/package.json')).license,'GPL-3.0-only');const changelog=read('青竹剑阵_更新日志.md').toString();assert.ok(changelog.split('\n',1)[0].startsWith(GAME_VERSION+' ')&&changelog.trimEnd().endsWith('1.0正式发布'),'Changelog must lead with the current release and keep 1.0');
// The attachment set is fixed by delivery-paths, not taken from the manifest that build-release wrote.
for(const file of releaseArtifacts)assert.ok(fs.existsSync(artifactPath(file)),'Missing release artifact: '+file);
const artifacts=Object.fromEntries(releaseArtifacts.map(file=>[file,readArtifact(file)])),manifest=JSON.parse(readArtifact('release-manifest.json'));
assert.equal(manifest.version,GAME_VERSION);assert.deepEqual(manifest.files.map(f=>f.file),releaseArtifacts,'Manifest must list exactly the release artifacts');
for(const item of manifest.files){assert.equal(sha(artifacts[item.file]),item.sha256,'Manifest hash differs: '+item.file);assert.equal(artifacts[item.file].length,item.bytes,'Manifest size differs: '+item.file);}
assert.equal(readArtifact('SHA256SUMS.txt').toString(),releaseArtifacts.map(f=>sha(artifacts[f])+'  '+f).join('\n')+'\n','SHA256SUMS.txt differs from the artifacts');
for(const name of [OFFLINE_ENTRY,OFFLINE_PNG_ENTRY])assert.ok(read(name).equals(artifacts[name]),'Root play entry differs from its release copy: '+name);
const archive=unzipSync(artifacts[SOURCE_ARCHIVE]),player=unzipSync(artifacts[PLAYER_ARCHIVE]),playerFiles={[PLAYER_ENTRY]:artifacts[OFFLINE_ENTRY],[PLAYER_PNG_ENTRY]:artifacts[OFFLINE_PNG_ENTRY],'开源资料/青竹剑阵_源码.zip':artifacts[SOURCE_ARCHIVE],'开源资料/LICENSE.txt':read('LICENSE')};
assert.deepEqual(Object.keys(player).sort(byCode),[...Object.keys(playerFiles),'先读我.txt'].map(name=>PLAYER_FOLDER+'/'+name).sort(byCode),'Player package entries differ');
for(const [name,original]of Object.entries(playerFiles))assert.ok(Buffer.from(player[PLAYER_FOLDER+'/'+name]).equals(original),'Player package differs: '+name);
const readme=Buffer.from(player[PLAYER_FOLDER+'/先读我.txt']).toString();assert.match(readme,/双击同一文件夹内的「开始游戏.html」/);
assert.deepEqual(Object.keys(archive).sort(byCode),files);assert.deepEqual(Object.keys(manifest.source).sort(byCode),files);
// Generic personal-path shapes, plus this machine's repository, home, temp and account paths in raw, escaped, URL-encoded and dash-encoded (tool folder) forms.
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),dash=s=>s.replace(/[^A-Za-z0-9]/g,'-'),before='(?<![A-Za-z0-9._~-])',after='(?![A-Za-z0-9._-])';
const shared=new Set(['/users','/home','/volumes','/private','/private/tmp','/private/var','/private/var/folders','/private/var/tmp','/tmp','/var','/var/folders','/var/tmp','/mnt','/media','/opt','/srv','/root','/workspace','/workspaces']);
// The shallowest ancestor with two segments that is not a shared system folder: a named volume, a home folder or a folder on a drive.
function localPrefix(dir){const segments=dir.replaceAll('\\','/').replace(/\/+$/,'').split('/');for(let i=2;i<=segments.length;i++){const prefix=segments.slice(0,i).join('/');if(segments.slice(0,i).filter(Boolean).length>=2&&!shared.has(prefix.toLowerCase())&&!/^[a-z]:\/users$/i.test(prefix))return prefix;}return null;}
const personal=[/\/(?:Users|home)\/[^\s/'"`]+\//,/-Users-[A-Za-z0-9._]+-/,/\/private\/tmp\//,/\/var\/folders\//,/[A-Za-z]:\\{1,2}Users\\{1,2}/,/\/Volumes\/[^\s/'"`][^/'"`\n]{0,63}\//,/-Volumes-[A-Za-z0-9._]+-/,/\/tmp\/claude-\d+\//,/(?<![\w.~-])\/root\/[^\s'"`]/,/(?<![A-Za-z0-9])[A-Za-z]:\\\\[^\\\s'"`<>|:*?]+\\\\/];
// Single-backslash drive paths are only checked where a backslash is not a string escape (`a:\nb\n` in code or JSON is not a path).
const prosePersonal=[/(?<![A-Za-z0-9])[A-Za-z]:\\(?!\\)[^\\\s'"`<>|:*?]+\\/],code=/\.(?:[cm]?jsx?|tsx?|json|html?|css|py)$/i;
// Very short prefixes would match ordinary text, so they rely on the generic shapes above.
for(const dir of new Set([root,os.homedir(),os.tmpdir()].flatMap(d=>{try{return [d,fs.realpathSync(d)];}catch{return [d];}}))){const prefix=localPrefix(dir);if(!prefix||prefix.length<6)continue;personal.push(new RegExp(before+prefix.split('/').map(s=>escape(s).replaceAll(' ','(?: |\\\\ |%20)')).join('[\\\\/]{1,2}')+after,'i'));if(dash(prefix).length>=8)personal.push(new RegExp(escape(dash(prefix))+'(?![A-Za-z0-9])','i'));if(encodeURI(prefix)!==prefix)personal.push(new RegExp(before+escape(encodeURI(prefix))+after,'i'));}
let user='';try{user=os.userInfo().username;}catch{/* no account name in this environment */}
if(user)personal.push(new RegExp('[\\\\/](?:Users|home)[\\\\/]{1,2}'+escape(user)+after,'i'),new RegExp('-(?:Users|home)-'+escape(dash(user))+'(?![A-Za-z0-9])','i'));
const credential=/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|sk-proj-[A-Za-z0-9_-]{30,})/;
function scan(name,text){const hit=[...personal,...(code.test(name)?[]:prosePersonal)].find(re=>re.test(text));assert.ok(!hit,'Personal path '+hit+': '+name);assert.doesNotMatch(text,credential,'Potential credential: '+name);}
for(const file of files){const bytes=read(file);assert.ok(Buffer.from(archive[file]).equals(bytes),'ZIP differs: '+file);assert.equal(sha(bytes),manifest.source[file],'Manifest differs: '+file);assert.ok(bytes.length<50*1024*1024,'Oversized source: '+file);
 // Every non-binary file is scanned, including Python, text, SVG and HTML.
 if(!/\.(png|jpe?g|webp|gif|ico|zip)$/i.test(file)){
  const text=bytes.toString();scan(file,text);
  if(file.endsWith('.md'))for(const m of text.matchAll(/\]\(([^)]+)\)/g)){const url=m[1].split('#')[0];if(!url||/^(?:https?:|mailto:)/.test(url))continue;const target=path.resolve(path.dirname(path.join(root,file)),decodeURIComponent(url));assert.ok(target.startsWith(root)&&fs.existsSync(target),'Broken local link: '+file+' -> '+url);}
 }
}
// Player-package texts are generated at packaging time; HTML is scanned without its base64 artwork.
for(const [name,bytes]of Object.entries(player))if(/\.txt$/i.test(name))scan(PLAYER_ARCHIVE+'/'+name,Buffer.from(bytes).toString());
// The embedded notice must be exactly the reviewed bundled list in THIRD_PARTY_NOTICES.md, which docs:deps must mark as bundled too.
const inventory=JSON.parse(read('docs/dependency-inventory.json')),lock=JSON.parse(read('game/package-lock.json'));for(const [key,p]of Object.entries(lock.packages)){if(!key)continue;const name=key.split('node_modules/').at(-1);assert.ok(inventory.some(r=>r.package===name&&r.version===p.version&&r.license===p.license),'Dependency inventory outdated: '+name);}
const noticeSection=read('THIRD_PARTY_NOTICES.md').toString().split('\n## ').find(s=>s.startsWith('离线成品实际打包的依赖'));assert.ok(noticeSection,'THIRD_PARTY_NOTICES.md lacks the bundled dependency table');
const declared=[...noticeSection.matchAll(/^\| ([^|\n]+?) \| (\d[^|\s]*) \| ([^|\n]+?) \| ([^\n]+) \|$/gm)].map(m=>({name:m[1].replace(/（[^）]*）$/,''),version:m[2],license:m[3],texts:[...m[4].matchAll(/\]\(docs\/(licenses\/[0-9a-f]{16}\.txt)\)/g)].map(t=>t[1])})),bundled=inventory.filter(r=>r.bundledInOffline),id=(name,version)=>name+'@'+version;
assert.deepEqual(declared.map(d=>id(d.name,d.version)).sort(byCode),[...new Set(bundled.map(r=>id(r.package,r.version)))].sort(byCode),'THIRD_PARTY_NOTICES.md and docs/dependency-inventory.json list different bundled packages');
for(const d of declared){const row=bundled.find(r=>r.package===d.name&&r.version===d.version);assert.equal(d.license,row.license,'Notice license differs: '+d.name);assert.ok(d.texts.length,'Notice has no license text: '+d.name);assert.deepEqual(d.texts,row.licenseTexts,'Notice license texts differ from the inventory: '+d.name);}
const expectedNotices=[...declared].sort((a,b)=>a.name.localeCompare(b.name,'en')).map(d=>id(d.name,d.version)+' ('+d.license+')\n'+d.texts.map(t=>read('docs/'+t).toString()).join('\n')).join('\n\n');
const assets=JSON.parse(read('game/public/assets/encoded/manifest.json'));
for(const name of [OFFLINE_ENTRY,OFFLINE_PNG_ENTRY]){const text=artifacts[name].toString(),png=name===OFFLINE_PNG_ENTRY;assert.ok(text.includes('<title>'+GAME_TITLE+' '+GAME_VERSION+'</title>'),'Wrong title: '+name);assert.doesNotMatch(text,/<script\b[^>]*\bsrc=|<link\b[^>]*\bhref=["']https?:/i);
 for(const a of Object.values(assets.assets)){const bytes=read('game/public/assets/'+(png?a.source:a.file));assert.equal(sha(bytes),png?a.sourceSHA256:a.sha256);assert.ok(text.includes('data:'+(png?'image/png':a.mime)+';base64,'+bytes.toString('base64')),'Wrong embedded asset profile: '+name+' / '+a.source);}
 const notices=/<script type="application\/json" id="third-party-notices">([^<]*)<\/script>/.exec(text);assert.ok(notices,'Missing embedded third-party notices: '+name);assert.equal(JSON.parse(notices[1]),expectedNotices,'Embedded third-party notices differ from THIRD_PARTY_NOTICES.md: '+name);
 for(const [,pkg,version]of text.matchAll(/\/\*! (\S+) v(\S+) \|/g))assert.ok(declared.some(d=>d.name===pkg&&d.version===version),'License banner without a notice: '+id(pkg,version)+' in '+name);
 scan(name,text.replace(/data:[\w.+-]+\/[\w.+-]+;base64,[A-Za-z0-9+/=]+/g,'data:;base64,'));
}
const generated=read('game/gameplay/docs.generated.js').toString(),docs=JSON.parse(generated.replace(/^export default /,'').trim().replace(/;$/,''));assert.equal(docs.guide,guide);assert.equal(docs.changes,read('青竹剑阵_更新日志.md').toString());assert.ok(docs.license.includes('GNU GENERAL PUBLIC LICENSE'));
const result={version:GAME_VERSION,sourceFiles:files.length,sourceMatchesArchive:true,manifestMatches:true,guideMatches:true,linksAndPrivacy:true,bundledNotices:declared.map(d=>id(d.name,d.version)),files:manifest.files};fs.mkdirSync(path.join(root,'game/qa/release'),{recursive:true});fs.writeFileSync(path.join(root,'game/qa/release/packaging.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
