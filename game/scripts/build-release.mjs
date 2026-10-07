/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {root,releaseFiles} from './release-files.mjs';
import {GAME_VERSION} from '../gameplay/version.js';
import {OFFLINE_ENTRY,OFFLINE_PNG_ENTRY} from '../gameplay/delivery-names.js';
import {releaseDir,artifactPath,releaseArtifacts} from './delivery-paths.mjs';
const game=path.join(root,'game');
function run(script,profile){const r=spawnSync(process.execPath,['scripts/'+script],{cwd:game,env:{...process.env,QINGZHU_ASSET_PROFILE:profile},stdio:'inherit'});if(r.status!==0)throw Error('Release build failed: '+script);}
// Listings and English upload copies from an earlier or interrupted build must never sit beside new artifacts.
for(const stale of ['SHA256SUMS.txt','release-manifest.json','github'])fs.rmSync(artifactPath(stale),{recursive:true,force:true});
// Default assets are restored after success or failure; a failed restore is reported without hiding the build error that came first.
let failure=null;try{for(const profile of ['optimized','png']){run('embed-assets.mjs',profile);run('build-offline.mjs',profile);}}catch(error){failure=error;}
try{run('embed-assets.mjs','optimized');}catch(error){if(!failure)throw error;console.error(error.message+' (while restoring default assets after an earlier failure)');}
if(failure)throw failure;
fs.mkdirSync(releaseDir,{recursive:true});
for(const name of [OFFLINE_ENTRY,OFFLINE_PNG_ENTRY])fs.copyFileSync(path.join(root,name),artifactPath(name));
run('package-source.mjs','optimized');
run('package-player.mjs','optimized');
const sha=(file,base=root)=>createHash('sha256').update(fs.readFileSync(path.join(base,file))).digest('hex');
const files=releaseArtifacts;
fs.writeFileSync(artifactPath('SHA256SUMS.txt'),files.map(f=>sha(f,releaseDir)+'  '+f).join('\n')+'\n');
fs.writeFileSync(artifactPath('release-manifest.json'),JSON.stringify({version:GAME_VERSION,license:'GPL-3.0-only',files:files.map(file=>({file,bytes:fs.statSync(artifactPath(file)).size,sha256:sha(file,releaseDir)})),source:Object.fromEntries(releaseFiles().map(f=>[f,sha(f)]))},null,2)+'\n');
console.log('Release ready for verification: '+GAME_VERSION);
