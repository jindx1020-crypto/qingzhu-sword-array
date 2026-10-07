/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const root=fileURLToPath(new URL('../../',import.meta.url));
const excluded=new Set(['.DS_Store','__pycache__','node_modules','.git','assets.generated.js','docs.generated.js']);
const topFiles=['README.md','AGENTS.md','LICENSE','THIRD_PARTY_NOTICES.md','CONTRIBUTING.md','.gitignore','.gitattributes','青竹剑阵_游玩说明.md','青竹剑阵_更新日志.md'];
const gameFiles=['package.json','package-lock.json','tsconfig.json','next.config.ts','next-env.d.ts','vite.config.ts','components.json','offline.html','README.md','.gitignore','.oxfmtrc.json','.oxlintrc.json','lint-baseline.json','.openai/hosting.json'];
// Mirrors the secret patterns in .gitignore so a stray local key never reaches the source package.
const secret=name=>name.startsWith('.env')||/\.(pem|key)$/i.test(name);
// In a Git checkout the walked folders may hold stray local files, so every listed file must also be tracked by Git.
function assertTracked(files){
 if(!fs.existsSync(path.join(root,'.git')))return;
 const r=spawnSync('git',['ls-files','-z','--full-name'],{cwd:root,encoding:'utf8',maxBuffer:256*1024*1024});
 if(r.status!==0)throw Error('Cannot verify the release whitelist against Git: '+(r.error?.message||r.stderr.trim()));
 const tracked=new Set(r.stdout.split('\0')),untracked=files.filter(f=>!tracked.has(f));
 if(untracked.length)throw Error('Release whitelist contains files not tracked by Git (add or remove them): '+untracked.join(', '));
}
export function releaseFiles(){
 const files=[];
 function add(file){if(!fs.statSync(path.join(root,file)).isFile())throw Error('Missing release file: '+file);files.push(file);}
 function walk(folder){for(const e of fs.readdirSync(path.join(root,folder),{withFileTypes:true})){if(excluded.has(e.name)||secret(e.name))continue;const rel=folder+'/'+e.name;if(e.isSymbolicLink())throw Error('Release symlink is not allowed: '+rel);if(e.isDirectory())walk(rel);else add(rel);}}
 for(const f of topFiles)add(f);for(const f of gameFiles)add('game/'+f);
 for(const f of ['game/app','game/components','game/gameplay','game/lib','game/hooks','game/public','game/scripts','game/tests','docs','.github'])walk(f);
 files.sort((a,b)=>a<b?-1:a>b?1:0);assertTracked(files);return files;
}
