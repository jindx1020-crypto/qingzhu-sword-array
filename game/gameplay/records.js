/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {experienceRecordFields,validateExperienceEntry} from './experience-rules.js';
import {RULE_KEYS} from './record-rules.js';
import {settleGarden} from './expedition-data.js';
const copy=structuredClone,MODES=['story','seed','endless'],SUPPLY=['steady','mana','heal','burst','recover','deep'];
export const emptyRecords=()=>({schema:1,entries:[],receipts:[]});
const integer=(n,min=0,max=1e12)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const text=(s,max=256)=>typeof s==='string'&&s.length>0&&s.length<=max&&Array.from(s).every(c=>c.charCodeAt(0)>=32);
export const recordReceipt=(runId,kind,loop=0)=>JSON.stringify([runId,kind,loop]);
// Seeds are free text; control characters (pasted tabs, line breaks) are dropped so a finished run can always be recorded.
export const printableText=value=>Array.from(String(value??'')).filter(c=>c.charCodeAt(0)>=32).join('');
export const printableSeed=seed=>printableText(seed).slice(0,256)||'（空）';
export const recordGroup=r=>JSON.stringify([r.mode,r.difficulty,r.path,...RULE_KEYS.map(k=>r.rules[k]),r.touchLockUsed,...(r.segmentVersion===1||[1,2].includes(r.challengeVersion)?[r.segmentVersion||0,r.challengeVersion||0,(r.challengeChoices||[]).flatMap((v,i)=>v==='none'?[]:[[i,v]])]:[])]);
export function normalizeRecords(value){if(value===undefined)return emptyRecords();const fail=()=>{throw Error('本地成绩记录无效，原记录未被修改');};
 if(!value||value.schema!==1||!Array.isArray(value.entries)||!Array.isArray(value.receipts))fail();
 const receipts=new Set();for(const raw of value.receipts){let t;try{t=JSON.parse(raw);}catch{fail();}if(!Array.isArray(t)||t.length!==3||!text(t[0],120)||!['finish','loop'].includes(t[1])||!integer(t[2],0,1001)||t[1]==='finish'&&t[2]!==0||t[1]==='loop'&&t[2]===0||raw!==recordReceipt(...t)||receipts.has(raw))fail();receipts.add(raw);}
 const groups=new Set();for(const r of value.entries){if(!r||!MODES.includes(r.mode)||!integer(r.path,0,5)||!integer(r.difficulty,0,2)||!text(r.seed)||!text(r.runId,120)||!text(r.gameVersion,40)||!integer(r.timeMs,0,1e11)||!integer(r.loops,0,1001)||!integer(r.metaCount,0,36)||!SUPPLY.includes(r.supply)||typeof r.touchLockUsed!=='boolean'||!r.rules||Object.keys(r.rules).length!==RULE_KEYS.length||RULE_KEYS.some(k=>!integer(r.rules[k],1,1000)))fail();
  validateExperienceEntry(r);if(r.mode==='endless'?r.loops===0:r.loops!==0)fail();const group=recordGroup(r),token=recordReceipt(r.runId,r.mode==='endless'?'loop':'finish',r.loops);if(groups.has(group)||!receipts.has(token))fail();groups.add(group);
}return copy(value);
}
// Explicit recovery only. Normal loads remain strict; no receipt is invented.
export function recoverRecords(value){
 const records=emptyRecords(),report={kept:0,isolated:0,isolatedReceipts:0,unknownSchema:false};
 if(value===undefined)return {records,report};
 if(!value||value.schema!==1||!Array.isArray(value.entries)||!Array.isArray(value.receipts))return {records,report:{...report,unknownSchema:true,isolated:Array.isArray(value?.entries)?value.entries.length:0}};
 for(const token of value.receipts){try{normalizeRecords({schema:1,entries:[],receipts:[token]});if(!records.receipts.includes(token))records.receipts.push(token);else report.isolatedReceipts++;}catch{report.isolatedReceipts++;}}
 const valid=[];
 for(const entry of value.entries){try{normalizeRecords({schema:1,entries:[entry],receipts:records.receipts});valid.push(entry);}catch{report.isolated++;}}
 const counts=new Map();for(const entry of valid){const group=recordGroup(entry);counts.set(group,(counts.get(group)||0)+1);}
 for(const entry of valid){if(counts.get(recordGroup(entry))===1)records.entries.push(copy(entry));else report.isolated++;}
 report.kept=records.entries.length;return {records:normalizeRecords(records),report};
}
function enter(book,summary,kind){const d=summary.recordDetails,loop=kind==='loop'?d?.completedLoops||0:0,id=summary.runId;
 if(!text(id,120))return book;const token=recordReceipt(id,kind,loop);if(book.receipts.includes(token))return book;
 const out=copy(book);out.receipts.push(token);
 const can=d?.version===1&&d.eligibleStart&&(kind==='loop'?summary.mode==='endless'&&loop>0:summary.won&&['story','seed'].includes(summary.mode)&&summary.nodes===22);
 if(!can)return out;
 const entry={...experienceRecordFields(d,loop),mode:summary.mode,path:summary.path,difficulty:summary.difficulty??0,seed:printableSeed(summary.seed),runId:id,gameVersion:d.gameVersion,timeMs:kind==='loop'?d.lastLoopMs:d.battleMs,loops:loop,rules:copy(d.rules),touchLockUsed:kind==='loop'?d.lastLoopLockUsed:d.touchLockUsed,metaCount:d.metaCount,supply:d.supply};
 const at=out.entries.findIndex(r=>recordGroup(r)===recordGroup(entry)),prior=out.entries[at];const better=!prior||(kind==='loop'?entry.loops>prior.loops||entry.loops===prior.loops&&entry.timeMs<prior.timeMs:entry.timeMs<prior.timeMs);
 if(better){if(at<0)out.entries.push(entry);else out.entries[at]=entry;}return out;
}
export function withProgressRecord(save,summary){if(summary.recordDetails?.version!==1||summary.mode!=='endless'||summary.recordDetails.completedLoops<=0)return save;const records=enter(save.records||emptyRecords(),summary,'loop');return records===save.records?save:{...save,records};}
export function resultAlreadyClaimed(save,summary){const id=summary.runId;if(!text(id,120))return false;return (save.records?.receipts||[]).includes(recordReceipt(id,'finish'))||(save.history||[]).some(h=>h.runId===id)||(['story','seed'].includes(summary.mode)&&(save.garden?.receipts||[]).includes(id));}
export function settleRunResult(save,summary){if(summary.studyVersion===1||summary.mode==='training'||resultAlreadyClaimed(save,summary))return save;const progress=withProgressRecord(save,summary),records=enter(progress.records||emptyRecords(),summary,'finish');return {...progress,records,checkpoint:null,garden:settleGarden(save.garden,summary),runs:save.runs+1,wins:save.wins+(summary.won&&['story','seed'].includes(summary.mode)?1:0),kills:save.kills+summary.kills,best:Math.max(save.best,Math.min(72,summary.level)),insight:save.insight+summary.insight,seen:[...new Set([...save.seen,...(summary.seen||[])])],history:[summary,...save.history].slice(0,30)};}
export function formatRecordTime(ms){if(!Number.isFinite(ms))return '未记录';const tenths=Math.floor(ms/100);return Math.floor(tenths/600).toString().padStart(2,'0')+':'+Math.floor(tenths%600/10).toString().padStart(2,'0')+'.'+tenths%10;}
// Read-only presentation. Capture before settlement; never infer a former best from a rewritten entry.
export function compareRunRecord(save,summary){
 const d=summary.recordDetails,base={eligible:false,prior:null,entry:null,deltaMs:null,kind:'unranked'};
 const reason=summary.mode==='training'?'试剑台不结算成绩':summary.mode==='replay'?'章回重温不参与个人最佳':d?.version!==1?'旧局未启用净战斗计时，不补造排名':!d.eligibleStart?'此局未从完整起点开始':summary.mode==='endless'&&d.completedLoops===0?'尚未完成一整圈，无尽最佳按完成圈数记录':['story','seed'].includes(summary.mode)&&!summary.won?'本次未通关，保留尝试记录':['story','seed'].includes(summary.mode)&&summary.nodes!==22?'未完成全部 22 节点，不计完整通关最佳':null;
 if(reason)return {...base,reason};
 const endless=summary.mode==='endless',entry={...experienceRecordFields(d,endless?d.completedLoops:0),mode:summary.mode,path:summary.path,difficulty:summary.difficulty??0,rules:d.rules,touchLockUsed:endless?d.lastLoopLockUsed:d.touchLockUsed,loops:endless?d.completedLoops:0,timeMs:endless?d.lastLoopMs:d.battleMs,runId:summary.runId};
 const prior=(save.records?.entries||[]).find(r=>recordGroup(r)===recordGroup(entry))||null;
 const sameRun=prior?.runId===summary.runId&&prior.loops===entry.loops;
 const kind=sameRun?'recorded':!prior?'first':entry.loops>prior.loops?'loops':entry.loops<prior.loops?'fewer':entry.timeMs<prior.timeMs?'faster':entry.timeMs===prior.timeMs?'tied':'slower';
 return {eligible:true,prior:prior?copy(prior):null,entry,deltaMs:prior&&!sameRun&&prior.loops===entry.loops?entry.timeMs-prior.timeMs:null,kind,reason:sameRun?'该成绩此前已记录；此前最佳对比未保存在旧快照中':null};
}
