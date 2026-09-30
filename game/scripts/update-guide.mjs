/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import fs from 'node:fs';
import {guideTables} from './guide-tables.mjs';
const url=new URL('../../青竹剑阵_游玩说明.md',import.meta.url);let guide=fs.readFileSync(url,'utf8');
for(const [key,table]of Object.entries(guideTables())){
 const pattern=new RegExp('<!-- table:'+key+':start -->[\\s\\S]*?<!-- table:'+key+':end -->');
 if(!pattern.test(guide))throw Error('Missing documentation table: '+key);
 guide=guide.replace(pattern,()=>'<!-- table:'+key+':start -->\n'+table+'\n<!-- table:'+key+':end -->');
}
fs.writeFileSync(url,guide);console.log('Updated rule tables; review the guide before building.');
