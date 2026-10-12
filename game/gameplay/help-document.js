/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
export function parseHelp(text,prefix='guide') {
 const blocks=[],sections=[],lines=text.split('\n');let i=0;
 while(i<lines.length){
  const line=lines[i],id=prefix+'-line-'+i;
  if(!line.trim()||line.startsWith('# ')||line.startsWith('<!--')){i++;continue;}
  if(line.startsWith('|')){
   const rows=[];
   while(i<lines.length&&lines[i].startsWith('|')){if(!/^\|[\s:|-]+\|$/.test(lines[i]))rows.push(lines[i].split('|').slice(1,-1).map(cell=>cell.trim()));i++;}
   blocks.push({id,type:'table',rows,text:rows.flat().join(' ')});continue;
  }
  const heading=/^(#{2,3}) (.+)$/.exec(line);
  if(heading){const block={id,type:'heading',level:heading[1].length,text:heading[2]};blocks.push(block);sections.push(block);i++;continue;}
  if(line.startsWith('- ')){const items=[];while(i<lines.length&&lines[i].startsWith('- '))items.push(lines[i++].slice(2));blocks.push({id,type:'list',items,text:items.join(' ')});continue;}
  blocks.push({id,type:'paragraph',text:line});i++;
 }
 return {blocks,sections};
}

export function findHelpBlocks(blocks,query) {
 const needle=query.trim().toLocaleLowerCase();
 return needle?blocks.filter(block=>block.text.toLocaleLowerCase().includes(needle)).map(block=>block.id):[];
}

// Keep source block anchors for chapter links, but search the visible inline
// text and give each literal occurrence its own stable destination.
export function helpInlineParts(text) {
 return text.split(/(\*\*.*?\*\*|`[^`]+`)/g).filter(Boolean).map(value=>value.startsWith('**')?{type:'strong',text:value.slice(2,-2)}:value.startsWith('`')?{type:'code',text:value.slice(1,-1)}:{type:'text',text:value});
}
export function helpMatchRanges(text,query) {
 const needle=query.trim().toLocaleLowerCase(),lower=text.toLocaleLowerCase(),ranges=[];
 if(!needle)return ranges;
 for(let start=lower.indexOf(needle);start>=0;start=lower.indexOf(needle,start+needle.length))ranges.push({start,end:start+needle.length});
 return ranges;
}
export function findHelpMatches(blocks,query) {
 const matches=[];
 for(const block of blocks){
  const units=block.type==='table'?block.rows.flatMap((row,r)=>row.map((text,c)=>({targetId:`${block.id}-row-${r}-cell-${c}`,text}))):block.type==='list'?block.items.map((text,i)=>({targetId:`${block.id}-item-${i}`,text})):[{targetId:block.id,text:block.text}];
  for(const unit of units){const text=helpInlineParts(unit.text).map(part=>part.text).join('');for(const range of helpMatchRanges(text,query))matches.push({...range,id:`${unit.targetId}-match-${range.start}`,targetId:unit.targetId,blockId:block.id,type:block.type,text});}
 }
 return matches;
}
