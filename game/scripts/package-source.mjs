/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync} from 'fflate';
import {root,releaseFiles} from './release-files.mjs';
import {releaseDir,artifactPath,SOURCE_ARCHIVE} from './delivery-paths.mjs';
const files=releaseFiles(),entries={};for(const file of files)entries[file]=[new Uint8Array(fs.readFileSync(path.join(root,file))),{mtime:new Date(2026,0,1)}];
const bytes=zipSync(entries,{level:7}),roundtrip=unzipSync(bytes);
for(const file of files)if(!Buffer.from(roundtrip[file]).equals(Buffer.from(entries[file][0])))throw Error('Source archive mismatch: '+file);
fs.mkdirSync(releaseDir,{recursive:true});
const target=artifactPath(SOURCE_ARCHIVE),pending=target+'.pending';fs.writeFileSync(pending,bytes);fs.renameSync(pending,target);
console.log(JSON.stringify({files:files.length,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}));
