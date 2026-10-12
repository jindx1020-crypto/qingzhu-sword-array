/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React,{useState} from 'react';
import {copyReadonlyText} from './rest-result-guidance';
function CopyAction({text,label}){
 const [state,setState]=useState('idle');
 async function copy(){setState('pending');setState(await copyReadonlyText(text,globalThis.navigator?.clipboard)?'success':'fallback');}
 return <div className="readonly-copy"><button className="fr-btn" onClick={copy} disabled={state==='pending'}>{state==='pending'?'正在复制…':label}</button>{state==='success'&&<output>已复制到剪贴板</output>}{state==='fallback'&&<div className="readonly-copy-fallback"><output>未能写入剪贴板；请选中下方文本后手动复制。</output><textarea aria-label={label+'文本'} readOnly value={text} rows={text.includes('\n')?6:2} onFocus={e=>e.currentTarget.select()}/></div>}</div>;
}
export default function ReadonlyCopy(props){return <CopyAction key={props.text} {...props}/>;}
