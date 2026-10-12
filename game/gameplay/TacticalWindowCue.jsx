/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React,{useEffect,useReducer} from 'react';
import {tacticalWindow} from './tactical-windows';

// Nested in the existing control or placed beside the ally/resources control.
// No handlers, focus target, independent countdown, live announcement, or save.
// The local RAF samples real battle fields: the main HUD refreshes only every
// 0.12 seconds, too slowly for a 0.24-second deflection window.
export default function TacticalWindowCue({b,kind,enabled=true}){
 const [,redraw]=useReducer(n=>n+1,0);
 useEffect(()=>{if(!enabled)return;let handle,last='',alive=true;const sample=()=>{if(!alive)return;const next=JSON.stringify(tacticalWindow(b,kind));if(next!==last){last=next;redraw();}handle=requestAnimationFrame(sample);};handle=requestAnimationFrame(sample);return()=>{alive=false;cancelAnimationFrame(handle);};},[b,kind,enabled]);
 const window=enabled?tacticalWindow(b,kind):null;if(!window?.show)return null;
 return <span className={'tactical-window-cue tactical-window-'+kind+(window.active?' is-active':'')} data-window-kind={kind} data-window-state={window.state} title={window.title} aria-label={window.title}><span className="tactical-window-label">{window.label}</span>{window.fraction!==null&&<i className="tactical-window-meter" aria-hidden="true"><i style={{width:(window.fraction*100)+'%'}}/></i>}</span>;
}
