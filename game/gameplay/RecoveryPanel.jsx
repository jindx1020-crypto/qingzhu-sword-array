/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React from 'react';
import {Button} from '../components/ui/button';
export default function RecoveryPanel({issue,candidates,onAdopt,onExport,compact=false}){
 if(compact&&!issue)return null;
 if(!issue&&!candidates.some(c=>c.id.startsWith('protected')))return null;
 return <section className={'recovery-panel '+(compact?'recovery-alert':'')} aria-label="存档恢复资料"><h3>{issue||'受保护的旧记录'}</h3><p>{issue?'当前未自动采用待恢复记录；预览不会写入存档，确认后才保留前态并覆盖。':'异常处理前保留的记录可随时查看、导出或确认恢复。'}</p><div className="recovery-candidates">{candidates.filter(c=>!compact||!c.id.startsWith('protected')).map(c=><article key={c.id}><strong>{c.label} · {c.status||'完整可读'}</strong>{c.save?<><p>{compact?'检测到待恢复记录：':''}心得 {c.save.insight} · 斩敌 {c.save.kills.toLocaleString('zh-CN')} · 最高 {c.save.best} 剑</p><p>续玩 {c.save.checkpoint?'可保留':'无'} · 完成章节 {c.save.completed.length} · 修持 {c.save.meta.length} 项 · 成绩 {c.save.records.entries.length} 条</p>{c.discarded?.includes('checkpoint')&&<p>将隔离损坏续玩，确认后放弃该局续玩。</p>}{c.recordReport&&<p>成绩保留 {c.recordReport.kept} 条，隔离 {c.recordReport.isolated} 条及 {c.recordReport.isolatedReceipts} 项凭据。{c.recordReport.unknownSchema?'成绩格式未知，整份隔离，不猜测转换。':'不补造凭据。'}</p>}{c.historyDropped>0&&<p>历史丢弃 {c.historyDropped} 条无效结算条目；原文仍保留。</p>}<small>{c.save.savedAt?new Date(c.save.savedAt).toLocaleString('zh-CN',{hour12:false}):'保存时间未记录'}</small><Button className="fr-btn" variant="outline" onClick={()=>onAdopt(c)}>查看并恢复</Button></>:<p>{c.reason||'只能保留并导出原文，不能直接恢复。'}</p>}</article>)}</div><Button className="fr-btn" variant="outline" onClick={onExport}>导出完整恢复资料</Button>{issue&&<p className="muted">暂不处理可返回其他页面，原记录保持不变。</p>}</section>;
}
