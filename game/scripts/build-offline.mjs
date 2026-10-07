/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import './embed-docs.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import {GAME_VERSION,GAME_TITLE} from '../gameplay/version.js';
import {OFFLINE_ENTRY,OFFLINE_PNG_ENTRY} from '../gameplay/delivery-names.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Upstream source copied into the repository (shadcn/ui components and helpers) keeps the license of the package that ships it.
const VENDORED=[['components/ui/','shadcn'],['lib/utils.ts','shadcn'],['hooks/use-mobile.ts','shadcn']];
const packages=new Map(),stylesheets=new Set(),posix=file=>file.split(path.sep).join('/');
const packageFolder=file=>{const parts=file.replaceAll('\\','/').split('/node_modules/');if(parts.length<2)return null;const suffix=parts.pop().split('/'),name=suffix[0].startsWith('@')?suffix.slice(0,2).join('/'):suffix[0];return path.resolve(parts.join('/node_modules/')+'/node_modules/'+name);};
function addPackage(folder,use,source){const manifest=path.join(folder,'package.json');if(!fs.existsSync(manifest))return false;const p=JSON.parse(fs.readFileSync(manifest,'utf8')),key=p.name+'@'+p.version,entry=packages.get(key)??{name:p.name,version:p.version,license:p.license,path:posix(path.relative(root,folder)),uses:[],sources:[],folder};packages.set(key,entry);if(!entry.uses.includes(use))entry.uses.push(use);if(source&&!entry.sources.includes(source))entry.sources.push(source);return true;}
// Rolldown's module graph covers the JS chunk; Tailwind compiles stylesheet imports outside it, so their files come from PostCSS dependency messages.
const stylesheetProvenance={postcssPlugin:'release-stylesheet-provenance',OnceExit(_root,{result}){for(const m of result.messages)if(m.type==='dependency'&&/\.css$/i.test(m.file)&&packageFolder(m.file))stylesheets.add(path.resolve(m.file));}};
const provenance={name:'release-license-provenance',generateBundle(_options,bundle){
 for(const chunk of Object.values(bundle)){if(chunk.type!=='chunk')continue;for(const id of Object.keys(chunk.modules)){if(id.startsWith('\0'))continue;const file=id.split('?')[0],folder=packageFolder(file);if(folder){addPackage(folder,'javascript');continue;}const rel=posix(path.relative(root,file)),vendor=VENDORED.find(([prefix])=>rel===prefix||prefix.endsWith('/')&&rel.startsWith(prefix));if(vendor&&!addPackage(path.join(root,'node_modules',vendor[1]),'vendored source',rel))throw Error('Vendored source has no installed license package: '+rel);}}
 for(const file of stylesheets)addPackage(packageFolder(file),'stylesheet',posix(path.relative(root,file)));
}};
await build({root,configFile:false,base:'./',plugins:[react(),provenance],resolve:{alias:{'@':root}},css:{postcss:{plugins:[tailwindcss(),stylesheetProvenance]}},build:{outDir:'offline-build',emptyOutDir:true,cssCodeSplit:false,modulePreload:{polyfill:false},assetsInlineLimit:Infinity,rolldownOptions:{input:path.join(root,'offline.html'),output:{codeSplitting:false}}}});
// Every package stylesheet imported by the entry CSS must have reached the provenance hook.
for(const [,spec] of fs.readFileSync(path.join(root,'app/globals.css'),'utf8').matchAll(/@import\s+['"]([^'"]+)['"]/g))if(!spec.startsWith('.')&&![...packages.values()].some(p=>p.uses.includes('stylesheet')&&(spec===p.name||spec.startsWith(p.name+'/'))))throw Error('Stylesheet import has no license provenance: '+spec);
const out=path.join(root,'offline-build');let html=fs.readFileSync(path.join(out,'offline.html'),'utf8');
// Replacement callbacks keep `$` sequences in inserted text literal.
html=html.replace(/<title>[\s\S]*?<\/title>/,()=>'<title>'+GAME_TITLE+' '+GAME_VERSION+'</title>');
html=html.replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,(_,src)=>'<script type="module">'+fs.readFileSync(path.join(out,src),'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
html=html.replace(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g,(_,src)=>'<style>'+fs.readFileSync(path.join(out,src),'utf8').replace(/<\/style/gi,'<\\/style')+'</style>');
html=html.replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g,'');
// Rolldown writes its module runtime helpers into the bundle itself, so it is listed with the bundled packages.
const rolldown=path.dirname(createRequire(createRequire(path.join(root,'package.json')).resolve('vite/package.json')).resolve('rolldown/package.json'));addPackage(rolldown,'runtime helpers');
// Texts are LF-normalized and de-duplicated like docs/licenses, so check-release can rebuild this notice from the reviewed list.
const notices=[];for(const p of [...packages.values()].sort((a,b)=>a.name.localeCompare(b.name,'en'))){const texts=[...new Set(fs.readdirSync(p.folder).sort().filter(f=>/^(licen[cs]e|copying|notice)([.-]|$)/i.test(f)&&fs.statSync(path.join(p.folder,f)).isFile()).map(f=>fs.readFileSync(path.join(p.folder,f),'utf8').replaceAll('\r\n','\n')))];if(!texts.length)throw Error('Bundled package is missing license text: '+p.name);notices.push(p.name+'@'+p.version+' ('+p.license+')\n'+texts.join('\n'));}
html=html.replace('</body>',()=>'<script type="application/json" id="third-party-notices">'+JSON.stringify(notices.join('\n\n')).replace(/</g,'\\u003c')+'</script></body>');
fs.writeFileSync(path.join(out,'bundled-packages.json'),JSON.stringify([...packages.values()].map(({folder:_folder,sources,...p})=>sources.length?{...p,sources}:p),null,2)+'\n');
const compatibility=process.env.QINGZHU_ASSET_PROFILE==='png';
const dest=path.join(root,'..',compatibility?OFFLINE_PNG_ENTRY:OFFLINE_ENTRY);fs.writeFileSync(dest,html);
console.log('Offline HTML saved: '+dest+' ('+(Buffer.byteLength(html)/1024/1024).toFixed(2)+' MB)');

const digest=createHash('sha256').update(html).digest('hex');
fs.writeFileSync(path.join(out,'delivery.json'),JSON.stringify({version:GAME_VERSION,profile:compatibility?'png':'webp',file:path.basename(dest),bytes:Buffer.byteLength(html),sha256:digest},null,2)+'\n');
