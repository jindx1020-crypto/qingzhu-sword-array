/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React from 'react';
import {damageRows} from './combat-feedback';
const amount=n=>Number(n.toFixed(1)).toLocaleString('zh-CN');
export function RecentHits({b}){const hits=b.recentHits||[];return <section className="recent-hits"><h3>{b.scene==='result'&&!b.won?'止步前的来袭':'最近受击'} · 最多 5 次</h3><p>列出减伤后实际吸收的护盾与损失的生命。闪避化解不计受击。</p>{hits.length?<ol>{[...hits].reverse().map((h,i)=><li key={i}><strong>{Math.floor(h.time/60)}:{String(Math.floor(h.time%60)).padStart(2,'0')} · {h.name} · {h.kind}</strong><span>{h.target}：护盾吸收 {amount(h.shield)} · 生命 −{amount(h.hp)} · 剩余 {amount(h.remaining)}</span>{h.outcome==='revived'?<b>守心化解致命伤 · 恢复 {amount(h.recovered)} 生命</b>:h.outcome==='defeated'?<b>{h.target==='阵盘'?'阵盘被击破':'生命耗尽'}</b>:h.remaining===0?<b>当次生命降至 0 · 旧记录未注明保命结果</b>:null}</li>)}</ol>:<p>暂无受击记录。旧存档只从本次更新后的受击开始记录。</p>}</section>;}
export function DamageReport({b}){const rows=damageRows(b),max=Math.max(1,...rows.map(r=>r.value));return <><p className="muted">伤害贡献 · 符火按实际来源分别记录；旧记录的符火总量保留在“未分类”中。</p><div className="damage-bars">{rows.map(r=><div key={r.key}><span>{r.label}</span><div><i style={{width:r.value/max*100+'%'}}/></div><small>{Math.round(r.value).toLocaleString('zh-CN')}</small></div>)}</div></>;}

export function SigilReport({b}){const s=b.sigilStats;if(!s||b.path!==4&&!s.sigil.casts&&!s.echo.casts)return null;return <section className="sigil-report"><h3>符阵战果</h3><p>从战斗第 {amount(s.fromTime)} 秒开始记录。有效扣血才计命中，击杀也计入；此前旧记录不追溯。</p><div className="reader-table"><table><thead><tr><th>符种</th><th>爆发（枚）</th><th>命中（次）</th><th>击杀（次）</th><th>无有效命中（枚）</th><th>护势阻挡（次）</th></tr></thead><tbody>{['sigil','echo'].map(k=><tr key={k}><th>{k==='sigil'?'主符':'复燃'}</th>{['casts','hits','kills','empty','blocked'].map(v=><td key={v}>{s[k][v]}</td>)}</tr>)}</tbody></table></div><p>爆发与无有效命中按枚统计；命中、击杀与阻挡按目标次数统计。一枚符可命中多个目标，所以命中次数不等于爆发枚数减空爆枚数。无有效命中含纯落空和目标不可伤；同一目标被不同符命中分别计次。</p></section>;}
