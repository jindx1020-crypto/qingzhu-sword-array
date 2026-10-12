/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import {resultAlreadyClaimed} from './records.js';
import {SUPPLIES} from './expedition-data.js';
// UI observations only: no new save fields, receipts, reward calculations or history repair.
const attempts=new WeakMap();
const nonnegative=n=>Number.isFinite(n)&&n>=0?n:null;
const balances=save=>({insight:nonnegative(save?.insight),research:save?.garden===undefined?0:nonnegative(save.garden?.points),wins:nonnegative(save?.wins)});
const delta=(before,after)=>before===null||after===null?null:after-before;
const summaryFor=b=>b.summary?.()||{runId:b.runId,mode:b.mode,won:b.won,studyVersion:b.options?.studyVersion};
const excluded=s=>s.studyVersion===1||s.mode==='training';
export function rememberAttempt(b,before,next,summary){
 const prior=attempts.get(b);if(prior?.kind==='captured'&&prior.runId===summary.runId)return;
 const source={runId:summary.runId,mode:summary.mode,won:summary.won===true,studyVersion:summary.studyVersion};
 if(excluded(source)){attempts.set(b,{kind:'excluded',source});return;}
 if(resultAlreadyClaimed(before,summary)){attempts.set(b,{kind:'prior',source});return;}
 // An old result without a stable receipt cannot be matched to a later successful write.
 if(next===before||!resultAlreadyClaimed(next,summary)){attempts.set(b,{kind:'untracked',source});return;}
 const a=balances(before),z=balances(next);
 attempts.set(b,{kind:'captured',runId:summary.runId,source,before:a,after:z,insight:delta(a.insight,z.insight),research:delta(a.research,z.research),firstVictory:a.wins===0&&z.wins===1&&source.won&&['story','seed'].includes(source.mode),confirmed:false});
}
export function confirmSettlement(b,saved,{allowOutcome=true}={}){
 const attempt=attempts.get(b);if(!allowOutcome||attempt?.kind!=='captured'||attempt.confirmed||summaryFor(b).runId!==attempt.runId||!resultAlreadyClaimed(saved,attempt.source))return false;
 const current=balances(saved);if(current.insight===null||current.research===null||current.wins===null||attempt.after.wins!==null&&current.wins<attempt.after.wins)return false;
 attempt.confirmed=true;return true;
}
export function settlementDisplay(b,save){
 const recorded=attempts.get(b),live=summaryFor(b),attempt=recorded?.source.runId===live.runId?recorded:null,summary=attempt?.source||live,balance=balances(save);
 if(excluded(live)||excluded(summary))return {kind:'excluded',saved:false,firstVictory:false,balance};
 const captured=attempt?.kind==='captured',claimed=resultAlreadyClaimed(save,summary),saved=captured?attempt.confirmed:claimed||b.resultFeedback?.saved===true;
 const kind=captured?saved?'saved':'pending':claimed?'prior':saved?'untracked-saved':'unknown';
 const unlocked=Array.isArray(save?.garden?.unlocked)?save.garden.unlocked:['steady'],remaining=SUPPLIES.filter(s=>!unlocked.includes(s.id)).length;
 const researchCapacity=balance.research===null?null:Math.min(remaining,Math.floor(balance.research/3));
 return {kind,saved,firstVictory:!!(captured&&saved&&attempt.firstVictory&&balance.wins>0),endlessAvailable:balance.wins>0,insight:captured?attempt.insight:null,research:captured?attempt.research:null,balance,remainingSupplies:remaining,researchCapacity,researchApplies:['story','seed'].includes(summary.mode),label:kind==='saved'?'本次结算已保存':kind==='pending'?'本次所得待保存':kind==='prior'?'此前结算已记录，未重复发放':kind==='untracked-saved'?'本次结算已保存，到账对照未记录':'本次到账对照未记录',detail:captured?(saved?'本次增量来自这次实际结算；账户余额列出当前已保存数值。':'保存成功前不标为已到账，也不宣布首通开放；可使用结算页的重试或导出入口。'):'缺少可确认的本页到账对照，不倒推本次实得或首次开放；账户余额仍按当前记录显示，结算保存状态以上方提示为准。'};
}
