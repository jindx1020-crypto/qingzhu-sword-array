/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React from 'react';
// Page-local reading shortcuts. Opening a disclosure and moving focus never invokes a game action.
export default function ReviewNavigation({items}){
 function locate(event,selector){
  const root=event.currentTarget.closest('.game-dialog'),target=root?.querySelector(selector);if(!target)return;
  for(let node=target;node&&node!==root;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;
  const focus=target.querySelector('h3,summary,h4')||target;focus.tabIndex=-1;
  requestAnimationFrame(()=>{focus.focus({preventScroll:true});focus.scrollIntoView({block:'start',behavior:'instant'});});
 }
 return <nav className="review-navigation" aria-label="复盘快速定位">{items.map(([selector,label])=><button key={selector} onClick={event=>locate(event,selector)}>{label}</button>)}</nav>;
}
