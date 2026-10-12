/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React from 'react';
import {settlementDisplay} from './settlement-display';
const number=n=>n===null?'未记录':Number(n.toFixed(1)).toLocaleString('zh-CN');
const gain=n=>n===null?'未记录':(n>=0?'+':'')+number(n);
export default function ResultOutcome({b,save,onGrowth,onConfigure}){
 const state=settlementDisplay(b,save);if(state.kind==='excluded')return null;
 return <section className="result-outcome" aria-label="本次所得与账户余额"><h3>本次所得与账户余额</h3>{state.firstVictory?<p className="first-victory-unlock"><strong>首次正式通关已保存 · 无尽新局已开放</strong></p>:state.endlessAvailable&&<p className="outcome-existing-unlock">当前账户已开放无尽新局</p>}<p className={state.saved?'outcome-saved':'outcome-pending'}><strong>{state.label}</strong></p><p className="outcome-gains">本次心得：<b>{gain(state.insight)}</b> · 本次药园研究：<b>{gain(state.research)}</b>{state.kind==='pending'?'（待保存）':''}。</p><p className="outcome-balances">当前已保存余额：心得 <b>{number(state.balance.insight)}</b> · 药园研究 <b>{number(state.balance.research)}</b> 点。</p>{!['saved','pending'].includes(state.kind)&&<p className="outcome-unrecorded">缺少现场到账对照，不推算本次增量或首次开放。</p>}<div className="outcome-actions">{onGrowth&&<button className="fr-btn" disabled={!state.saved} onClick={()=>{if(state.saved)onGrowth();}}>前往洞府与药园</button>}{onConfigure&&<button className="fr-btn" disabled={!state.saved} onClick={()=>{if(state.saved)onConfigure();}}>调整出发配置</button>}{onConfigure&&state.firstVictory&&<button className="fr-btn" onClick={()=>onConfigure('endless')}>查看无尽出发配置</button>}</div><details className="outcome-explanation"><summary>所得口径与成长去向</summary><p>{state.detail}</p>{!state.researchApplies&&<p>本模式不结算药园研究；心得仍以本次实际结算为准。</p>}{state.firstVictory&&<p>无尽新局开放来自主篇或完整定种胜局；不会自动开始新局。</p>}{state.saved&&<p className="outcome-research-guidance">{state.remainingSupplies===0?'替代补给均已研究。':state.researchCapacity!==null?'当前研究余额最多可研究 '+state.researchCapacity+' 套尚未研究的替代补给。':''}每套需 3 研究点；研究需要你选择，每次出发仍只选一套，不自动消费。</p>}</details></section>;
}
