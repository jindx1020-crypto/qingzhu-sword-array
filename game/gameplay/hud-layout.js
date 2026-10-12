/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Shared DOM measurement for the real HUD and its inert full-size layout preview.
export function compactForSpace({width,height,top,bottom},previous=false){
 const available=height-top-bottom-16,target=height<=420?height*.4:Math.max(220,height*.35);
 const portraitPhone=width<=430&&height>width,need=portraitPhone?Math.max(target+32,height*.55):target+32;
 return available<need||previous&&available<need+32;
}
export function measureHudCompression(main,previous=false){
 const rect=main.getBoundingClientRect(),probe=document.createElement('div');probe.className=main.className.replace('hud-compact','');probe.setAttribute('aria-hidden','true');probe.inert=true;
 Object.assign(probe.style,{position:'fixed',left:'-10000px',top:'0',right:'auto',bottom:'auto',width:rect.width+'px',height:rect.height+'px',visibility:'hidden'});
 for(const selector of ['.battle-header','.battle-footer','.mobile-status','.boss-bar','.objective-note']){const node=main.querySelector(selector);if(node)probe.append(node.cloneNode(true));}
 document.body.append(probe);
 try{probe.style.setProperty('--battle-header-base',(probe.querySelector('.battle-header')?.getBoundingClientRect().bottom||0)+'px');probe.style.setProperty('--battle-status-height',(probe.querySelector('.mobile-status')?.getBoundingClientRect().height||0)+'px');let top=0;for(const node of probe.querySelectorAll('.battle-header,.mobile-status,.boss-bar,.objective-note')){const r=node.getBoundingClientRect();if(r.height&&r.bottom<rect.height*.6)top=Math.max(top,r.bottom);}return compactForSpace({width:rect.width,height:rect.height,top,bottom:probe.querySelector('.battle-footer')?.getBoundingClientRect().height||0},previous);}finally{probe.remove();}
}
// Cloning a canvas does not copy its bitmap. Keep decorative portraits in the inert header snapshot.
export function cloneHudNode(node){const copy=node.cloneNode(true),originalCanvases=node.querySelectorAll('canvas'),copies=copy.querySelectorAll('canvas');for(let i=0;i<copies.length;i++)copies[i].getContext('2d')?.drawImage(originalCanvases[i],0,0);return copy;}
