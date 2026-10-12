/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React,{useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
import {NativeSelect,NativeSelectOption} from '../components/ui/native-select';
import DOCS from './docs.generated';
import {parseHelp,findHelpMatches,helpInlineParts,helpMatchRanges} from './help-document';

// Reading state belongs to this page session; it never writes the player's save.
const readingMemory=new Map();
function inline(text,query,targetId='',activeId=''){
 const parts=helpInlineParts(text),ranges=helpMatchRanges(parts.map(part=>part.text).join(''),query);let offset=0;
 return parts.map((part,i)=>{const start=offset,end=start+part.text.length;offset=end;let cursor=start;const nodes=[];
  for(const range of ranges){const from=Math.max(start,range.start),to=Math.min(end,range.end);if(from>=to)continue;nodes.push(part.text.slice(cursor-start,from-start));const id=`${targetId}-match-${range.start}`;nodes.push(<mark key={from} data-help-match={id} className={id===activeId&&from===range.start?'reader-current-match':undefined}>{part.text.slice(from-start,to-start)}</mark>);cursor=to;}
  nodes.push(part.text.slice(cursor-start));return part.type==='strong'?<strong key={i}>{nodes}</strong>:part.type==='code'?<code key={i}>{nodes}</code>:<React.Fragment key={i}>{nodes}</React.Fragment>;
 });
}

export default function HelpReader({kind,open=true}){
 const reader=useRef(null),[query,setQuery]=useState(()=>readingMemory.get(kind)?.query||''),[selected,setSelected]=useState(''),[active,setActive]=useState(()=>readingMemory.get(kind)?.active??-1);
 // Small screens start with the quick reference collapsed so the body keeps its reading height.
 const [quickOpen,setQuickOpen]=useState(()=>readingMemory.get(kind)?.quickOpen??(typeof matchMedia!=='function'||matchMedia('(min-height:700px) and (min-width:480px)').matches));
 const document=useMemo(()=>{let text=DOCS[kind]||'';if(kind==='license'){const notices=globalThis.document?.getElementById('third-party-notices');if(notices)text+='\n\n## 本 HTML 内嵌的第三方许可\n\n'+JSON.parse(notices.textContent);}return parseHelp(text,kind);},[kind]);
 const matches=useMemo(()=>findHelpMatches(document.blocks,query),[document,query]),activeId=matches[active]?.id;
 useLayoutEffect(()=>{if(!open)return;const node=reader.current,memory=readingMemory.get(kind);node.scrollTop=memory?.top||0;for(const table of node.querySelectorAll('.reader-table'))table.scrollLeft=memory?.tables?.[table.id]||0;},[kind,open]);
 function rememberPosition(){const node=reader.current;if(open&&node?.clientHeight>0)readingMemory.set(kind,{...readingMemory.get(kind),top:node.scrollTop,tables:Object.fromEntries([...node.querySelectorAll('.reader-table')].map(table=>[table.id,table.scrollLeft]))});}
 function rememberQuery(value){setQuery(value);setActive(-1);readingMemory.set(kind,{...readingMemory.get(kind),query:value,active:-1});}
 // Only the article and its horizontal table container scroll. The title,
 // search navigation and close control never move out of view after a jump.
 function jump(id,match=false){const node=reader.current,target=node.querySelector(match?'[data-help-match="'+id+'"]':'[id="'+id+'"]');if(!target)return;const table=target.closest('.reader-table');if(table){const r=target.getBoundingClientRect(),box=table.getBoundingClientRect();if(r.left<box.left+8||r.right>box.right-8)table.scrollLeft+=r.left-box.left-8;}node.scrollTop+=target.getBoundingClientRect().top-node.getBoundingClientRect().top-12;rememberPosition();}
 function next(direction){if(!matches.length)return;const index=active<0?(direction>0?0:matches.length-1):(active+direction+matches.length)%matches.length;setActive(index);readingMemory.set(kind,{...readingMemory.get(kind),active:index});jump(matches[index].id,true);}
 const quick=document.blocks.findIndex(v=>v.type==='heading'&&v.text==='操作速查');
 return <div className="help-layout"><div className="help-tools">
  <Input aria-label="搜索说明关键词" type="search" placeholder="搜索：神雷、药园…" value={query} maxLength={100} onChange={e=>rememberQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();next(e.shiftKey?-1:1);}}}/>
  <Button className="reader-button" aria-label="上一个匹配位置" disabled={!matches.length} onClick={()=>next(-1)}>上一项</Button><Button className="reader-button" aria-label="下一个匹配位置" disabled={!matches.length} onClick={()=>next(1)}>下一项</Button>
  <NativeSelect className="reader-directory" aria-label="说明章节目录" value={selected} onChange={e=>{const id=e.target.value;setSelected('');setActive(-1);readingMemory.set(kind,{...readingMemory.get(kind),active:-1});jump(id);}}><NativeSelectOption value="">章节目录</NativeSelectOption>{document.sections.map(section=><NativeSelectOption key={section.id} value={section.id}>{section.level===3?'　':''}{section.text}</NativeSelectOption>)}</NativeSelect>
  <output className="reader-match-count" aria-live="polite">{query.trim()?(matches.length?(active>=0?(active+1)+' / ':'共 ')+matches.length+' 处':'无匹配'):'保留位置'}</output>
  {kind==='guide'&&quick>=0&&<details className="help-quick" open={quickOpen} onToggle={e=>{setQuickOpen(e.currentTarget.open);readingMemory.set(kind,{...readingMemory.get(kind),quickOpen:e.currentTarget.open});}}><summary title={quickOpen?'收起操作速查':'展开操作速查'}>操作速查</summary>{document.blocks.slice(quick+1).slice(0,4).filter(v=>v.type==='paragraph').map(v=><p key={v.id}>{inline(v.text,'')}</p>)}</details>}
 </div><article ref={reader} className="help-reader" aria-label={kind==='license'?'开源许可正文':kind==='changes'?'更新日志正文':'游玩说明正文'} onScrollCapture={rememberPosition}>
  {document.blocks.map(block=>{
   if(block.type==='heading'){const Heading=block.level===2?'h3':'h4';return <Heading key={block.id} id={block.id}>{inline(block.text,query,block.id,activeId)}</Heading>;}
   if(block.type==='table')return <div key={block.id} id={block.id} className="reader-table"><table><thead><tr>{block.rows[0]?.map((value,i)=><th key={i} id={`${block.id}-row-0-cell-${i}`}>{inline(value,query,`${block.id}-row-0-cell-${i}`,activeId)}</th>)}</tr></thead><tbody>{block.rows.slice(1).map((row,i)=><tr key={i}>{row.map((value,j)=><td key={j} id={`${block.id}-row-${i+1}-cell-${j}`}>{inline(value,query,`${block.id}-row-${i+1}-cell-${j}`,activeId)}</td>)}</tr>)}</tbody></table></div>;
   if(block.type==='list')return <ul key={block.id} id={block.id}>{block.items.map((value,i)=><li key={i} id={`${block.id}-item-${i}`}>{inline(value,query,`${block.id}-item-${i}`,activeId)}</li>)}</ul>;
   return <p key={block.id} id={block.id}>{inline(block.text,query,block.id,activeId)}</p>;
  })}
 </article></div>;
}
