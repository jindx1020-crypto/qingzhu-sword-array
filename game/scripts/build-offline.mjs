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
const packages=new Map();
const provenance={name:'release-license-provenance',generateBundle(_options,bundle){for(const chunk of Object.values(bundle)){if(chunk.type!=='chunk')continue;for(const id of Object.keys(chunk.modules)){const parts=id.split('/node_modules/');if(parts.length<2)continue;const suffix=parts.pop(),name=suffix.startsWith('@')?suffix.split('/').slice(0,2).join('/'):suffix.split('/')[0],folder=parts.join('/node_modules/')+'/node_modules/'+name,manifest=path.join(folder,'package.json');if(fs.existsSync(manifest)){const p=JSON.parse(fs.readFileSync(manifest,'utf8'));packages.set(p.name+'@'+p.version,{name:p.name,version:p.version,license:p.license,folder});}}}}};
await build({root,configFile:false,base:'./',plugins:[react(),provenance],resolve:{alias:{'@':root}},css:{postcss:{plugins:[tailwindcss()]}},build:{outDir:'offline-build',emptyOutDir:true,cssCodeSplit:false,modulePreload:{polyfill:false},assetsInlineLimit:Infinity,rolldownOptions:{input:path.join(root,'offline.html'),output:{codeSplitting:false}}}});
const out=path.join(root,'offline-build');let html=fs.readFileSync(path.join(out,'offline.html'),'utf8');
// Replacement callbacks keep `$` sequences in inserted text literal.
html=html.replace(/<title>[\s\S]*?<\/title>/,()=>'<title>'+GAME_TITLE+' '+GAME_VERSION+'</title>');
html=html.replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g,(_,src)=>'<script type="module">'+fs.readFileSync(path.join(out,src),'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
html=html.replace(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g,(_,src)=>'<style>'+fs.readFileSync(path.join(out,src),'utf8').replace(/<\/style/gi,'<\\/style')+'</style>');
html=html.replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g,'');
// Rolldown writes its module runtime helpers into the bundle itself, so it is listed with the bundled packages.
const rolldown=path.dirname(createRequire(createRequire(path.join(root,'package.json')).resolve('vite/package.json')).resolve('rolldown/package.json')),rolldownPackage=JSON.parse(fs.readFileSync(path.join(rolldown,'package.json'),'utf8'));
packages.set(rolldownPackage.name+'@'+rolldownPackage.version,{name:rolldownPackage.name,version:rolldownPackage.version,license:rolldownPackage.license,folder:rolldown});
const notices=[];for(const p of [...packages.values()].sort((a,b)=>a.name.localeCompare(b.name))){const texts=fs.readdirSync(p.folder).sort().filter(f=>/^(licen[cs]e|copying|notice)([.-]|$)/i.test(f)&&fs.statSync(path.join(p.folder,f)).isFile()).map(f=>fs.readFileSync(path.join(p.folder,f),'utf8'));if(!texts.length)throw Error('Bundled package is missing license text: '+p.name);notices.push(p.name+'@'+p.version+' ('+p.license+')\n'+texts.join('\n'));}
html=html.replace('</body>',()=>'<script type="application/json" id="third-party-notices">'+JSON.stringify(notices.join('\n\n')).replace(/</g,'\\u003c')+'</script></body>');
fs.writeFileSync(path.join(out,'bundled-packages.json'),JSON.stringify([...packages.values()].map(({folder:_folder,...p})=>p),null,2)+'\n');
const compatibility=process.env.QINGZHU_ASSET_PROFILE==='png';
const dest=path.join(root,'..',compatibility?OFFLINE_PNG_ENTRY:OFFLINE_ENTRY);fs.writeFileSync(dest,html);
console.log('Offline HTML saved: '+dest+' ('+(Buffer.byteLength(html)/1024/1024).toFixed(2)+' MB)');

const digest=createHash('sha256').update(html).digest('hex');
fs.writeFileSync(path.join(out,'delivery.json'),JSON.stringify({version:GAME_VERSION,profile:compatibility?'png':'webp',file:path.basename(dest),bytes:Buffer.byteLength(html),sha256:digest},null,2)+'\n');
