/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React from 'react';
import {formatRecordTime,recordGroup} from './records';
import {recordDetails} from './record-rules';
import {sameDisplayedTime} from './record-display';
import {chapterName} from './chapter-names';
import {splitComparison} from './review-display';
import ChapterLedger from './ChapterLedger';
// Imported history is only shape-checked on load; rows that are not real split records are skipped here rather than crashing the page.
export function SplitRows({rows:raw,prior}){const {rows,missingAll}=splitComparison(raw,prior);return rows.length?<div className="chapter-splits">{missingAll&&<p className="split-comparison-empty">同组最佳分段未记录；以下保留本次各章真实用时。</p>}{rows.map(({row:r,delta})=><p key={r.index}>{Number.isFinite(r.loop)&&r.loop>0?'第 '+(r.loop+1)+' 圈 · ':''}{chapterName(r.chapter)}：<strong>{formatRecordTime(r.durationMs)}</strong>{!missingAll&&<small> {delta===null?'同组最佳分段未记录':sameDisplayedTime(delta)?'与同组最佳该章相同（差不足 0.1 秒）':(delta<0?'快 ':'慢 ')+formatRecordTime(Math.abs(delta))}</small>}</p>)}</div>:<p>章末分段未记录；旧总用时不会倒推成章节成绩。</p>;}
export default function ChapterReview({b,save,prior}){
 const d=recordDetails(b);if(!d)return <ChapterLedger b={b}/>;
 const match=prior!==undefined?prior:save?.records?.entries.find(r=>recordGroup(r)===recordGroup({mode:b.mode,path:b.path,difficulty:b.options.difficulty||0,rules:d.rules,touchLockUsed:d.touchLockUsed,segmentVersion:d.segmentVersion,challengeVersion:d.challengeVersion,challengeChoices:d.challengeChoices}));
 return <><details className="chapter-review"><summary>{b.chapterSplits?.length?'逐章复盘 · 已记录 '+b.chapterSplits.length+' 章用时':'逐章复盘 · 本局尚未完成整章'}</summary><SplitRows rows={b.chapterSplits} prior={match?.chapterSplits}/><small>仅计算净战斗时间；对比同组最佳整局内的该章用时。暂停、悟道、整备、过场不计。</small></details><ChapterLedger b={b}/></>;
}
