/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Presentation only: never infer missing casts, pair IDs, target identities or damage sources.
export const hasSigilReview=b=>!!b?.sigilStats&&(b.path===4||b.sigilStats.sigil.casts>0||b.sigilStats.echo.casts>0);
export function sigilReview(b){
 if(!hasSigilReview(b))return null;const s=b.sigilStats;
 const groups=['sigil','echo'].map(kind=>{const g=s[kind];return {kind,label:kind==='sigil'?'主符':'复燃',casts:g.casts,effective:g.casts-g.empty,hits:g.hits,kills:g.kills,empty:g.empty,blocked:g.blocked,damage:g.damage};});
 const recent=[...s.recent].reverse().map(r=>({...r,label:r.kind==='sigil'?'主符':'复燃',status:r.hits>0?'有效爆发':r.blocked>0?'无有效命中 · 有阻挡':r.cleared?'无有效命中 · 提前清场推断标记':'无有效命中 · 未记录具体原因'}));
 return {fromTime:s.fromTime,groups,recent,recorded:recent.length,total:groups.reduce((n,g)=>n+g.casts,0)};
}
// Only a real matching chapter split can produce a comparison. Missing all comparisons is one empty state.
export function splitComparison(raw,prior){
 const current=Array.isArray(raw)?raw.filter(r=>r&&Number.isFinite(r.durationMs)):[],previous=Array.isArray(prior)?prior.filter(r=>r&&Number.isFinite(r.durationMs)):[];
 const rows=current.map(row=>{const old=previous.find(p=>p.index===row.index);return {row,delta:old?row.durationMs-old.durationMs:null};});
 return {rows,missingAll:rows.length>0&&rows.every(r=>r.delta===null)};
}
