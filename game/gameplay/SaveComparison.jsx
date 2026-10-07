/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React from 'react';
import {EXPEDITIONS} from './expedition-data';
const when=value=>value?new Date(value).toLocaleString('zh-CN',{hour12:false}):'未记录';
export default function SaveComparison({current,target,currentUnknown=false,targetUnknown=false}){
 const column=(title,value,unknown)=><section><h3>{title}</h3>{unknown||!value?<p>尚未载入有效记录 · 长期进度待恢复；原文保留。</p>:<><p>心得 {value.insight} · 斩敌 {value.kills} · 最高 {value.best} 剑</p><p>修持 {(value.meta||[]).length} 项 · 完成章节 {(value.completed||[]).length} · 成绩 {value.records?.entries?.length||0} 条</p><p>{value.checkpoint?EXPEDITIONS[value.checkpoint.chapter]?.name+' · 节点 '+(value.checkpoint.wave+1)+' · '+Math.floor(value.checkpoint.time||0)+' 秒':'无待续玩战斗'}</p><p>保存时间：{when(value.savedAt)}</p></>}</section>;
 return <div className="save-comparison">{column('当前记录',current,currentUnknown)}{column('将载入的记录',target,targetUnknown)}</div>;
}
