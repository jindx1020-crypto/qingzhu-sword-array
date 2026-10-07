/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React,{useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Button} from '../components/ui/button';
import {Input} from '../components/ui/input';
import {NativeSelect,NativeSelectOption} from '../components/ui/native-select';
import DOCS from './docs.generated';
import {parseHelp,findHelpBlocks} from './help-document';

// Reading state belongs to this page session; it never writes the player's save.
const readingMemory=new Map();
function highlighted(text,query){
 const needle=query.trim().toLocaleLowerCase();if(!needle)return text;
 const parts=[],lower=text.toLocaleLowerCase();let start=0,index=lower.indexOf(needle);
 while(index>=0){parts.push(text.slice(start,index),<mark key={index}>{text.slice(index,index+needle.length)}</mark>);start=index+needle.length;index=lower.indexOf(needle,start);}
 parts.push(text.slice(start));return parts;
}
function inline(text,query){return text.split(/(\*\*.*?\*\*|`[^`]+`)/g).map((s,i)=>s.startsWith('**')?<strong key={i}>{highlighted(s.slice(2,-2),query)}</strong>:s.startsWith('`')?<code key={i}>{highlighted(s.slice(1,-1),query)}</code>:<React.Fragment key={i}>{highlighted(s,query)}</React.Fragment>);}

export default function HelpReader({kind,open=true}){
 const reader=useRef(null),[query,setQuery]=useState(()=>readingMemory.get(kind)?.query||''),[selected,setSelected]=useState(''),[active,setActive]=useState(-1);
 // Small screens start with the quick reference collapsed so the body keeps its reading height.
 const [quickOpen,setQuickOpen]=useState(()=>typeof matchMedia!=='function'||matchMedia('(min-height:700px) and (min-width:480px)').matches);
 const document=useMemo(()=>{let text=DOCS[kind]||'';if(kind==='license'){const notices=globalThis.document?.getElementById('third-party-notices');if(notices)text+='\n\n## 本 HTML 内嵌的第三方许可\n\n'+JSON.parse(notices.textContent);}return parseHelp(text,kind);},[kind]);
 const matches=useMemo(()=>findHelpBlocks(document.blocks,query),[document,query]);
 useLayoutEffect(()=>{if(!open)return;const node=reader.current,top=readingMemory.get(kind)?.top||0;node.scrollTop=top;},[kind,open]);
 function rememberQuery(value){setQuery(value);setActive(-1);readingMemory.set(kind,{...readingMemory.get(kind),query:value});}
 // Small landscape screens scroll .help-layout instead of the article; scrollIntoView reaches whichever box actually scrolls.
 function jump(id){const node=reader.current,target=node.querySelector('[id="'+id+'"]');if(!target)return;if(node.scrollHeight>node.clientHeight+1)node.scrollTop+=target.getBoundingClientRect().top-node.getBoundingClientRect().top-12;else target.scrollIntoView({block:'start'});readingMemory.set(kind,{...readingMemory.get(kind),top:node.scrollTop});}
 function next(direction){if(!matches.length)return;const index=active<0?(direction>0?0:matches.length-1):(active+direction+matches.length)%matches.length;setActive(index);jump(matches[index]);}
 const quick=document.blocks.findIndex(v=>v.type==='heading'&&v.text==='操作速查');
 return <div className="help-layout">{kind==='guide'&&quick>=0&&<details className="help-quick" open={quickOpen} onToggle={e=>setQuickOpen(e.currentTarget.open)}><summary>{quickOpen?'操作速查 · 点此收起':'操作速查 · 点此展开'}</summary>{document.blocks.slice(quick+1).slice(0,4).filter(v=>v.type==='paragraph').map(v=><p key={v.id}>{inline(v.text,'')}</p>)}</details>}<div className="help-tools">
  <Input aria-label="搜索说明关键词" type="search" placeholder="搜索：神雷、药园…" value={query} maxLength={100} onChange={e=>rememberQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();next(e.shiftKey?-1:1);}}}/>
  <Button className="reader-button" aria-label="上一个匹配段落" disabled={!matches.length} onClick={()=>next(-1)}>上一个</Button><Button className="reader-button" aria-label="下一个匹配段落" disabled={!matches.length} onClick={()=>next(1)}>下一个</Button>
  <NativeSelect className="reader-directory" aria-label="说明章节目录" value={selected} onChange={e=>{const id=e.target.value;setSelected('');jump(id);}}><NativeSelectOption value="">章节目录 · 跳转</NativeSelectOption>{document.sections.map(section=><NativeSelectOption key={section.id} value={section.id}>{section.level===3?'　':''}{section.text}</NativeSelectOption>)}</NativeSelect>
  <output className="reader-match-count" aria-live="polite">{query.trim()?(matches.length?(active>=0?'第 '+(active+1)+' / ':'')+matches.length+' 个相关段落':'没有匹配段落'):'关闭后保留位置'}</output>
 </div><article ref={reader} className="help-reader" aria-label={kind==='license'?'开源许可正文':kind==='changes'?'更新日志正文':'游玩说明正文'} onScroll={e=>{if(open&&e.currentTarget.clientHeight>0)readingMemory.set(kind,{...readingMemory.get(kind),top:e.currentTarget.scrollTop});}}>
  {document.blocks.map(block=>{
   const props={id:block.id,className:matches[active]===block.id?'reader-current-match':undefined};
   if(block.type==='heading'){const Heading=block.level===2?'h3':'h4';return <Heading key={block.id} {...props}>{inline(block.text,query)}</Heading>;}
   if(block.type==='table')return <div key={block.id} {...props} className={'reader-table '+(props.className||'')}><table><thead><tr>{block.rows[0]?.map((value,i)=><th key={i}>{inline(value,query)}</th>)}</tr></thead><tbody>{block.rows.slice(1).map((row,i)=><tr key={i}>{row.map((value,j)=><td key={j}>{inline(value,query)}</td>)}</tr>)}</tbody></table></div>;
   if(block.type==='list')return <ul key={block.id} {...props}>{block.items.map((value,i)=><li key={i}>{inline(value,query)}</li>)}</ul>;
   return <p key={block.id} {...props}>{inline(block.text,query)}</p>;
  })}
 </article></div>;
}
