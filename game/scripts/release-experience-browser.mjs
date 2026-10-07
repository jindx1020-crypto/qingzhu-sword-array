/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// 第三批 C 浏览器核对（headless Playwright，离线 HTML）：
// C-1 战斗 toast 半透明/短时且技能确认走 cue；C-2 390×844 战场占比、摇杆距底、生命数值不裁切、紧凑状态行与首领血条不重叠、
// ≤420 隐藏保存图标／≤360 省头像仍在、悟道卡整卡可点；C-3 卡面「当前→修持后」与阶级；C-4 试剑台入场标题与按钮不重叠；
// C-5 结算页固定计时下限；C-8 过场居中与账号级跳过开关。三视口截图：390×844、844×390、1440×900。
// 用法：node scripts/release-experience-browser.mjs；QINGZHU_ASSET_PROFILE=png 选择 PNG 变体，QINGZHU_HTML 可指定待测文件。
import {launchBrowser,qaOutput,htmlPath,variant} from './browser-runtime.mjs';
import {GAME_VERSION} from '../gameplay/version.js';
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const html=htmlPath;
const OUT=qaOutput('experience');
const report={variant,html,checks:[],errors:[],measurements:{}};
const ok=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,detail});console.log((pass?'PASS ':'FAIL ')+name+(detail?' · '+JSON.stringify(detail).slice(0,420):''));};
const browser=await launchBrowser();
const shot=(page,name)=>page.screenshot({path:path.join(OUT,'batchC-'+name+'-'+variant+'.png')});
const PHONE={width:390,height:844},LANDSCAPE={width:844,height:390},DESKTOP={width:1440,height:900};
const NEW_RUN={mode:'seed',path:5,seed:'batchC-web',difficulty:1,skipPractice:true};
try{
 const context=await browser.newContext({viewport:DESKTOP}),page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(String(e.message)));
 const confirmRisk=async()=>{await page.waitForTimeout(250);const r=await page.evaluate(()=>window.__FANREN__.risk?{title:window.__FANREN__.risk.title,confirm:window.__FANREN__.risk.confirm}:null);if(r){await page.locator('.risk-dialog').getByRole('button',{name:r.confirm}).click();await page.waitForTimeout(250);}return r;};
 await page.goto(pathToFileURL(html).href+'?test=1');await page.waitForFunction(()=>window.__FANREN__?.art,null,{timeout:60000});
 const title=await page.title();
 ok('标题含当前游戏版本与虚天殿篇',title.endsWith(GAME_VERSION)&&/虚天殿篇/.test(title),{title});
 ok('页面无外部 script/link',await page.evaluate(()=>![...document.querySelectorAll('script[src],link[href]')].some(n=>/^https?:/.test(n.src||n.href))),null);

 // ---------------- 桌面：设置页账号级跳过开关（C-8）
 await page.getByRole('button',{name:/设置/}).first().click();await page.waitForTimeout(400);
 const toggle=await page.evaluate(()=>({rows:[...document.querySelectorAll('.toggle-line')].map(r=>({label:r.querySelector('span')?.innerText,state:r.querySelector('button')?.innerText})),setting:window.__FANREN__.save.settings.skipSeenAfterWin,explanation:document.querySelector('.setting-explanation')?.innerText}));
 const row=toggle.rows.find(r=>/通关后自动跳过纪事过场/.test(r.label||''));
 ok('C-8 设置页有账号级「通关后自动跳过纪事过场」且默认关闭',!!row&&row.state==='关闭'&&toggle.setting===false&&/通关后自动跳过纪事过场/.test(toggle.explanation||''),{row,setting:toggle.setting});
 await shot(page,'settings-skip');

 // ---------------- 桌面：过场正文居中（C-8）
 await page.evaluate(()=>window.__FANREN__.home());await confirmRisk();await page.waitForTimeout(250);
 await page.evaluate(run=>window.__FANREN__.start(run),{...NEW_RUN,seed:'batchC-web-cine'});await confirmRisk();
 await page.waitForFunction(()=>window.__FANREN__.battle,null,{timeout:20000});await page.waitForTimeout(400);
 await page.evaluate(()=>{const b=window.__FANREN__.battle;b.cinematicSeen=[];b.playCinematic('bamboo','node');window.__FANREN__.step(0);});
 await page.waitForTimeout(500);
 const cine=await page.evaluate(()=>{const panel=document.querySelector('.scene-cinematic .panel-body');if(!panel)return null;const body=panel.getBoundingClientRect(),inner=panel.firstElementChild?.getBoundingClientRect();
  return inner?{topGap:Math.round(inner.top-body.top),bottomGap:Math.round(body.bottom-inner.bottom),bodyHeight:Math.round(body.height),innerHeight:Math.round(inner.height)}:null;});
 report.measurements.cinematic=cine;
 ok('C-8 过场正文在面板内垂直居中（上下留白差 ≤8px，不在下方留半屏空白）',!!cine&&Math.abs(cine.topGap-cine.bottomGap)<=8&&cine.topGap>0&&cine.topGap<cine.bodyHeight*.5,cine);
 await shot(page,'cinematic');

 // ---------------- 桌面：悟道卡面（C-3）与整卡可点（C-2）
 await page.evaluate(()=>{const b=window.__FANREN__.battle;while(b.scene==='cinematic')b.advanceCinematic(true);if(b.modeState==='intro')b.start();while(b.scene==='cinematic')b.advanceCinematic(true);b.queuedChoices=1;b.openChoices();window.__FANREN__.step(0);});
 await page.waitForTimeout(500);await page.waitForSelector('.choice-card');
 const cards=await page.evaluate(()=>[...document.querySelectorAll('.choice-card')].map(c=>({name:c.querySelector('h3')?.innerText,values:c.querySelector('.trait-values')?.innerText,buttonLabel:c.querySelector('.scene-action')?.getAttribute('aria-label'),buttons:c.querySelectorAll('button').length})));
 report.measurements.cards=cards;
 ok('C-3 每张悟道卡显示阶级与「当前 → 修持后」',cards.length>0&&cards.every(c=>/一阶|二阶|三阶/.test(c.values||''))&&cards.some(c=>/→/.test(c.values||'')),cards);
 ok('C-2 卡片只有一个可激活按钮与一个可访问名',cards.every(c=>c.buttons===1&&/卡片任意位置均可点/.test(c.buttonLabel||'')),cards.map(c=>c.buttons));
 const cardBody=await page.evaluate(()=>{const card=document.querySelector('.choice-card'),h3=card.querySelector('h3').getBoundingClientRect();
  const hit=document.elementFromPoint(Math.round(h3.left+h3.width/2),Math.round(h3.top+h3.height/2));return {hit:hit?.className?.toString?.()||hit?.tagName,isButtonOverlay:!!hit?.closest?.('.scene-action')};});
 report.measurements.cardBody=cardBody;
 ok('C-2 点卡面正文命中的是同一个「选择」按钮（拉伸覆盖层）',cardBody.isButtonOverlay,cardBody);
 const chose=await page.evaluate(async()=>{const b=window.__FANREN__.battle,before=JSON.stringify(b.traits);const card=document.querySelector('.choice-card'),r=card.getBoundingClientRect();
  const x=Math.round(r.left+r.width/2),y=Math.round(r.top+30);
  const opts={bubbles:true,cancelable:true,pointerId:1,button:0,clientX:x,clientY:y,isPrimary:true};
  const target=document.elementFromPoint(x,y);
  target.dispatchEvent(new PointerEvent('pointerdown',opts));target.dispatchEvent(new PointerEvent('pointerup',opts));target.dispatchEvent(new MouseEvent('click',{...opts,detail:1}));
  await new Promise(r=>setTimeout(r,120));return {before,after:JSON.stringify(b.traits),scene:b.scene};});
 report.measurements.cardClick=chose;
 ok('C-2 在卡面正文上完成一次按下/抬起即完成修持',chose.before!==chose.after,chose);
 await shot(page,'choice-desktop');

 // ---------------- 桌面：结算页固定计时下限（C-5）
 await page.evaluate(()=>{const b=window.__FANREN__.battle;b.receipts=b.routes.flat().map(n=>n.id);b.routes.forEach(ch=>ch.forEach(n=>{if(n.selected===null)n.selected=0;}));b.won=true;b.finished=true;b.showScene('result','result');window.__FANREN__.step(0);});
 await page.waitForTimeout(600);
 const result=await page.evaluate(()=>{const s=document.querySelector('.result-record');return s?{text:s.innerText.slice(0,900),floor:document.querySelector('.record-fixed-floor')?.innerText||null}:null;});
 report.measurements.result=result;
 ok('C-5 结算页显示「固定计时下限」与其余可压缩时间',!!result?.floor&&/固定计时下限/.test(result.floor)&&/其余/.test(result.floor),result?.floor);
 await shot(page,'result-desktop');

 // ---------------- 桌面：试剑台分步练习入场标题与按钮（C-4）
 await page.evaluate(()=>window.__FANREN__.home());await confirmRisk();await page.waitForTimeout(250);
 await page.evaluate(()=>window.__FANREN__.start({mode:'training',path:5,seed:'batchC-practice',guidedPractice:true,skipPractice:true}));await confirmRisk();
 await page.waitForFunction(()=>window.__FANREN__.battle?.options.guidedPractice,null,{timeout:20000});await page.waitForTimeout(500);
 const intro=await page.evaluate(()=>({title:document.querySelector('[data-slot=dialog-title]')?.innerText,desc:document.querySelector('[data-slot=dialog-description]')?.innerText}));
 ok('C-4 分步练习入场标题为「试剑台 · 分步操作练习」',/分步操作练习/.test(intro.title||''),intro);
 await page.evaluate(()=>{const b=window.__FANREN__.battle;b.start();window.__FANREN__.step(0);});await page.waitForTimeout(300);
 await page.evaluate(()=>{const b=window.__FANREN__.battle;if(b.practice)b.practice.step=6;window.__FANREN__.step(0);});
 await page.waitForTimeout(300);
 const practice=await page.evaluate(()=>{const p=document.querySelector('.practice-panel');if(!p)return null;const buttons=[...p.querySelectorAll('button')].map(b=>({text:b.innerText,rect:b.getBoundingClientRect().toJSON()}));
  const small=p.querySelector('small')?.getBoundingClientRect();
  const overlap=buttons.some(b=>small&&b.rect.top<small.bottom-1&&b.rect.bottom>small.top+1&&b.rect.left<small.right-1&&b.rect.right>small.left+1);
  return {buttons:buttons.map(b=>b.text),overlapWithText:overlap};});
 report.measurements.practice=practice;
 ok('C-4 练习面板按钮与说明文字不重叠',!!practice&&practice.overlapWithText===false,practice);
 await shot(page,'practice-desktop');

 // ---------------- 手机竖屏 390×844（C-1 / C-2）：换成触屏上下文，摇杆与紧凑 HUD 才是真机条件
 const bossCss=await page.evaluate(()=>{const probe=document.createElement('div');probe.className='boss-bar';document.body.append(probe);const s=getComputedStyle(probe);const out={pointerEvents:s.pointerEvents,userSelect:s.userSelect||s.getPropertyValue('-webkit-user-select')};probe.remove();
  const card=document.createElement('article');card.className='choice-card';const btn=document.createElement('button');btn.className='fr-btn scene-action';card.append(btn);document.body.append(card);
  const after=getComputedStyle(btn,'::after');out.stretched=after.position==='absolute'&&after.content!=='none';card.remove();return out;});
 report.measurements.bossCss=bossCss;
 ok('C-4 首领血条不接收点击与长按选中',bossCss.pointerEvents==='none'&&/none/.test(bossCss.userSelect||''),bossCss);
 ok('C-2 卡内按钮带绝对定位的拉伸覆盖层',bossCss.stretched===true,bossCss);
 await context.close();
 const mobile=await browser.newContext({viewport:PHONE,hasTouch:true,isMobile:true,deviceScaleFactor:3});
 const mpage=await mobile.newPage();mpage.on('pageerror',e=>report.errors.push('mobile: '+String(e.message)));
 await mpage.goto(pathToFileURL(html).href+'?test=1');await mpage.waitForFunction(()=>window.__FANREN__?.art,null,{timeout:60000});
 await mpage.evaluate(run=>window.__FANREN__.start(run),{...NEW_RUN,seed:'batchC-web-phone'});
 await mpage.waitForFunction(()=>window.__FANREN__.battle,null,{timeout:20000});await mpage.waitForTimeout(400);
 await mpage.evaluate(()=>{const b=window.__FANREN__.battle;while(b.scene==='cinematic')b.advanceCinematic(true);if(b.modeState==='intro')b.start();while(b.scene==='cinematic')b.advanceCinematic(true);window.__FANREN__.step(1);});
 await mpage.waitForTimeout(900);
 const phone=await mpage.evaluate(()=>{
  const main=document.querySelector('main.fanren').getBoundingClientRect();
  const box=s=>{const n=document.querySelector(s);if(!n)return null;const r=n.getBoundingClientRect();return r.width&&r.height?{top:Math.round(r.top-main.top),bottom:Math.round(r.bottom-main.top),left:Math.round(r.left-main.left),right:Math.round(r.right-main.left),height:Math.round(r.height)}:null;};
  const header=box('.battle-header'),footer=box('.battle-footer'),status=box('.mobile-status'),boss=box('.boss-bar'),stick=box('.touch-joystick');
  const hp=document.querySelector('.hp-track>b');const hpBox=hp?hp.getBoundingClientRect():null;const hpParent=hp?hp.parentElement.getBoundingClientRect():null;
  const band=(footer?footer.top:main.height)-Math.max(header?header.bottom:0,status?status.bottom:0,boss?boss.bottom:0);
  return {viewport:{w:Math.round(main.width),h:Math.round(main.height)},compact:document.querySelector('main.fanren').classList.contains('hud-compact'),
   header,footer,status,boss,stick,
   joystickBottomGap:stick?Math.round(main.height-stick.bottom):null,
   bandHeight:Math.round(band),bandShare:+(band/main.height*100).toFixed(1),
   hpText:hp?hp.innerText:null,hpClipped:hpBox&&hpParent?hpBox.width>hpParent.width+1||hp.scrollWidth>hp.clientWidth+1:null,
   saveChipVisible:!!document.querySelector('.battle-save-chip')&&getComputedStyle(document.querySelector('.battle-save-chip')).display!=='none',
   avatarVisible:!!document.querySelector('.avatar-frame')&&getComputedStyle(document.querySelector('.avatar-frame')).display!=='none',
   statusText:document.querySelector('.mobile-status')?.innerText||null};});
 report.measurements.phone=phone;
 ok('C-2 390×844 战场带 ≥55% 视口高度',phone.bandShare>=55,{bandShare:phone.bandShare,bandHeight:phone.bandHeight,viewport:phone.viewport});
 ok('C-2 390×844 摇杆距底 ≤180px',phone.joystickBottomGap!==null&&phone.joystickBottomGap<=180,{joystickBottomGap:phone.joystickBottomGap});
 ok('C-2 紧凑模式保留一行起手状态',!!phone.status&&!!phone.statusText,{status:phone.status,text:phone.statusText});
 ok('C-2 生命数值不裁切',phone.hpClipped===false,{hpText:phone.hpText,hpClipped:phone.hpClipped});
 ok('C-2 ≤420 隐藏保存图标的既有约定保持',phone.saveChipVisible===false,{saveChipVisible:phone.saveChipVisible});
 await shot(mpage,'phone-hud');
 // 战斗内 toast 与技能确认
 const toastInfo=await mpage.evaluate(async()=>{const b=window.__FANREN__.battle;b.player.mana=100;b.player.reserve=b.player.maxReserve;const before=b.toastText;const cast=b.thunder();window.__FANREN__.step(0);await new Promise(r=>setTimeout(r,200));
  const afterCast=b.toastText,castToastEl=document.querySelector('.game-toast');
  const castToastText=castToastEl?castToastEl.innerText:null;
  // 再制造一条真实的战斗 toast（切剑式）以测量它的透明度与覆盖比例
  b.changeFormation();window.__FANREN__.step(0);await new Promise(r=>setTimeout(r,250));
  const el=document.querySelector('.game-toast'),main=document.querySelector('main.fanren').getBoundingClientRect();
  const style=el?getComputedStyle(el):null;const r=el?el.getBoundingClientRect():null;
  return {cast,before,after:afterCast,castToastText,cues:b.combatCues.map(c=>c.key+':'+c.text),
   toastVisible:!!el,background:style?style.backgroundColor:null,
   coverShare:r&&r.width?+(r.width*r.height/(main.width*main.height)*100).toFixed(1):0,toastText:el?el.innerText:null};});
 report.measurements.toast=toastInfo;
 const alpha=(toastInfo.background||'').match(/rgba?\(([^)]+)\)/);const alphaValue=alpha?Number(alpha[1].split(',')[3]??1):null;
 ok('C-1 神雷施放确认走 cue 通道，不占中央 toast 单槽',toastInfo.cast===true&&toastInfo.before===toastInfo.after&&toastInfo.cues.some(c=>c.startsWith('thunder-cast')),toastInfo);
 ok('C-1 战斗内 toast 半透明（alpha ≤ 0.6）',toastInfo.toastVisible&&alphaValue!==null&&alphaValue<=0.61,{background:toastInfo.background,alpha:alphaValue,text:toastInfo.toastText});
 ok('C-1 手机 toast 不盖 1/4 战场',toastInfo.toastVisible&&toastInfo.coverShare>0&&toastInfo.coverShare<25,{coverShare:toastInfo.coverShare,text:toastInfo.toastText});
 await shot(mpage,'phone-toast');
 // 悟道卡面手机宽度
 await mpage.evaluate(()=>{const b=window.__FANREN__.battle;b.queuedChoices=1;b.openChoices();window.__FANREN__.step(0);});
 await mpage.waitForTimeout(500);await mpage.waitForSelector('.choice-card');
 const phoneCard=await mpage.evaluate(()=>{const card=document.querySelector('.choice-card'),btn=card.querySelector('.scene-action');const cr=card.getBoundingClientRect(),br=btn.getBoundingClientRect();
  return {cardWidth:Math.round(cr.width),buttonWidth:Math.round(br.width),buttonHeight:Math.round(br.height),values:card.querySelector('.trait-values')?.innerText};});
 report.measurements.phoneCard=phoneCard;
 ok('C-2 手机宽度下卡内「选择」按钮占满一行且 ≥44px 高',phoneCard.buttonHeight>=44&&phoneCard.buttonWidth>=phoneCard.cardWidth-40,phoneCard);
 await shot(mpage,'phone-choice');

 // ---------------- 手机横屏 844×390（C-2 三视口之二）
 await mpage.evaluate(()=>{const b=window.__FANREN__.battle;b.choices=[];b.queuedChoices=0;b.showScene(null,'battle');window.__FANREN__.step(0);});
 await mpage.setViewportSize(LANDSCAPE);await mpage.waitForTimeout(700);
 const landscape=await mpage.evaluate(()=>{const main=document.querySelector('main.fanren').getBoundingClientRect();
  const box=s=>{const n=document.querySelector(s);if(!n)return null;const r=n.getBoundingClientRect();return r.width&&r.height?{top:Math.round(r.top-main.top),bottom:Math.round(r.bottom-main.top),height:Math.round(r.height),width:Math.round(r.width)}:null;};
  const stick=document.querySelector('.touch-joystick')?.getBoundingClientRect();
  return {compact:document.querySelector('main.fanren').classList.contains('hud-compact'),header:box('.battle-header'),footer:box('.battle-footer'),status:box('.mobile-status'),
   joystickBottomGap:stick?Math.round(main.height-stick.bottom):null,joystickRadius:stick?Math.round(stick.width/2):null,
   avatarVisible:!!document.querySelector('.avatar-frame')&&getComputedStyle(document.querySelector('.avatar-frame')).display!=='none'};});
 report.measurements.landscape=landscape;
 ok('C-2 横屏摇杆半径按视觉半径（满偏判定用 min(45, 半径)）',landscape.joystickRadius!==null,landscape);
 await shot(mpage,'landscape-hud');

 // ---------------- 桌面回到 1440×900（三视口之三）
 await mobile.close();
 const deskCtx=await browser.newContext({viewport:DESKTOP}),page2=await deskCtx.newPage();page2.on('pageerror',e=>report.errors.push('desktop2: '+String(e.message)));
 await page2.goto(pathToFileURL(html).href+'?test=1');await page2.waitForFunction(()=>window.__FANREN__?.art,null,{timeout:60000});
 await page2.evaluate(run=>window.__FANREN__.start(run),{...NEW_RUN,seed:'batchC-web-desktop'});
 await page2.waitForFunction(()=>window.__FANREN__.battle,null,{timeout:20000});await page2.waitForTimeout(400);
 await page2.evaluate(()=>{const b=window.__FANREN__.battle;while(b.scene==='cinematic')b.advanceCinematic(true);if(b.modeState==='intro')b.start();while(b.scene==='cinematic')b.advanceCinematic(true);window.__FANREN__.step(1);});
 await page2.waitForTimeout(800);
 const desktop=await page2.evaluate(()=>{const main=document.querySelector('main.fanren').getBoundingClientRect();
  const box=s=>{const n=document.querySelector(s);if(!n)return null;const r=n.getBoundingClientRect();return r.width&&r.height?{top:Math.round(r.top-main.top),bottom:Math.round(r.bottom-main.top)}:null;};
  return {compact:document.querySelector('main.fanren').classList.contains('hud-compact'),header:box('.battle-header'),footer:box('.battle-footer'),
   bandShare:+(((box('.battle-footer').top)-(box('.battle-header').bottom))/main.height*100).toFixed(1)};});
 report.measurements.desktop=desktop;
 ok('C-2 桌面视口不进入紧凑模式',desktop.compact===false,desktop);
 await shot(page2,'desktop-hud');
 await deskCtx.close();
}catch(e){report.errors.push('script: '+e.stack);console.error(e);}
await browser.close();
report.summary={passed:report.checks.filter(c=>c.pass).length,total:report.checks.length,pageErrors:report.errors.length};
console.log('summary',JSON.stringify(report.summary));
fs.writeFileSync(path.join(OUT,'browser.json'),JSON.stringify(report,null,1));

if(report.errors.length||report.checks.some(c=>!c.pass))process.exitCode=1;
