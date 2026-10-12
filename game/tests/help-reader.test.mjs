/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHelp,findHelpMatches,helpInlineParts,helpMatchRanges} from '../gameplay/help-document.js';

void test('help search identifies lower table cells and repeated literal occurrences independently',()=>{
 const {blocks}=parseHelp('## 操作\n| 类型 | 说明 |\n|---|---|\n| 剑 | 自动攻击 |\n| 护身 | 环绕护身、护身恢复 |\n- 雷法一\n- 雷法二\n');
 const table=blocks.find(b=>b.type==='table'),matches=findHelpMatches(blocks,'护身');
 assert.equal(matches.length,3);
 assert.deepEqual(matches.map(m=>m.targetId),[`${table.id}-row-2-cell-0`,`${table.id}-row-2-cell-1`,`${table.id}-row-2-cell-1`]);
 assert.deepEqual(matches.map(m=>[m.start,m.end]),[[0,2],[2,4],[5,7]]);
 assert.equal(new Set(matches.map(m=>m.id)).size,3);
 assert.deepEqual(findHelpMatches(blocks,'雷法').map(m=>m.targetId),[`${blocks.at(-1).id}-item-0`,`${blocks.at(-1).id}-item-1`]);
});
void test('help search uses displayed inline text and literal case-insensitive offsets',()=>{
 const raw='**护**身 `MANA` [.*]，护身';
 const text=helpInlineParts(raw).map(p=>p.text).join('');
 assert.equal(text,'护身 MANA [.*]，护身');
 assert.deepEqual(helpMatchRanges(text,'mana'),[{start:3,end:7}]);
 assert.deepEqual(helpMatchRanges(text,'[.*]'),[{start:8,end:12}]);
 assert.equal(findHelpMatches(parseHelp(raw).blocks,'护身').length,2);
 assert.deepEqual(findHelpMatches(parseHelp(raw).blocks,'**'),[]);
 assert.deepEqual(helpMatchRanges(text,' '),[]);
});
