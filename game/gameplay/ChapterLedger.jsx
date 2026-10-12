/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React,{useState} from 'react';
import {chapterReview} from './chapter-telemetry';
import {chapterName} from './chapter-names';
import {COMBOS,CONSUMABLES,TRAITS} from './data';

const amount=n=>n>0&&n<.1?'不足0.1':Number(n.toFixed(1)).toLocaleString('zh-CN');
const count=n=>n.toLocaleString('zh-CN');
const sources=[['sword','飞剑'],['thunder','雷法'],['puppet','傀儡'],['insect','虫群'],['fire','符火（合计）'],['guard','反击／震退'],['return','回程斩'],['arc','余雷牵引雷击']];
const comboName=effect=>COMBOS.find(c=>c.effect===effect)?.name||'旧联动';
const chapterLabel=(row,endless)=>`${endless?'第 '+(row.loop+1)+' 圈 · ':''}${chapterName(row.chapter)}`;
const stateLabel=row=>row.closed?(row.battleCompleted?'本章战斗已完成 · 记录已封存':'本章未完成 · 记录已结束'):row.battleCompleted?'战斗已完成 · 章末整备中':'本章进行中';
function Metric({field,label,value,unit}){return <div className="chapter-metric" data-chapter-field={field}><dt>{label}</dt><dd><b>{value}</b>{unit&&<small>{unit}</small>}</dd></div>;}
function Resources({value,label,side}){return <section className="chapter-resource-side" data-resource-side={side}><h4>{label}</h4><dl className="chapter-metrics"><Metric field="gold" label="灵石" value={amount(value.gold)} unit="点"/><Metric field="reserve" label="雷源／上限" value={amount(value.reserve)+' / '+amount(value.maxReserve)}/><Metric field="rerolls" label="悟道重选" value={count(value.rerolls)} unit="次"/></dl><div className="chapter-bag-list"><h5>药囊物资</h5>{value.consumables.length?value.consumables.map((slot,i)=><p key={i} data-chapter-bag={i}>{CONSUMABLES.find(c=>c.id===slot.id)?.name||'旧物资'} <b>{count(slot.count)}</b> 份{slot.bonusHeal>0&&<> · 加赠回元药包 <b>{count(slot.bonusHeal)}</b> 份</>}</p>):<p>无物资槽</p>}</div></section>;}

// This view never fills gaps from final totals, current traits or formal chapter split times.
export default function ChapterLedger({b}){
 const review=chapterReview(b),[selection,setSelection]=useState(null);
 if(!review.available)return <section className="chapter-ledger chapter-ledger-unknown" tabIndex={-1}><h3>逐章资源与生存</h3><p className="chapter-ledger-scope"><strong>未记录</strong></p><p>{review.message}</p><p>不从整局总伤害、剩余资源或当前配置补造旧章；正式分段成绩另列。</p></section>;
 const row=review.rows.find(r=>r.index===selection)||review.rows.at(-1),endless=b.mode==='endless',nodeWord=b.isExpedition||b.rulesVersion===3||b.options?.rulesVersion===3?'节点':'波次',damage=row?sources.reduce((total,[key])=>total+row.damage[key],0):0;
 return <section className="chapter-ledger" tabIndex={-1}>
  <h3>逐章资源与生存</h3>
  <p className="chapter-ledger-scope"><strong>{review.partial?'接续片段记录':'自本局出发起记录'}</strong><small>{review.partial?'恢复后从战斗第 '+amount(review.fromTime)+' 秒起；此前未记录。':'战斗时钟起点 '+amount(review.fromTime)+' 秒。'}观察统计独立于正式分段成绩。</small></p>
  {review.omitted>0&&<p className="chapter-ledger-omitted">只保留最近 {review.rows.length} 章；更早 {count(review.omitted)} 章观察明细已超出保留范围，以下不会冒充整局总数。</p>}
  {row?<>
   <label className="chapter-ledger-picker">查看章节<select aria-label="选择复盘章节" value={row.index} onChange={event=>setSelection(Number(event.target.value))}>{review.rows.map(r=><option key={r.index} value={r.index}>{chapterLabel(r,endless)}{r.partial?' · 片段':''}{!r.battleCompleted?' · 未完成':''}</option>)}</select></label>
   <article className="chapter-ledger-row" data-chapter-index={row.index}>
    <h4 className="chapter-ledger-title">{chapterLabel(row,endless)}</h4><p className="chapter-ledger-state"><strong>{stateLabel(row)}</strong>{row.partial&&<small>本章只记录自战斗第 {amount(row.fromTime)} 秒起的片段。</small>}</p>
    <dl className="chapter-key-metrics chapter-metrics"><Metric field="elapsed" label="记录战斗时间" value={amount(row.elapsed)} unit="秒"/><Metric field="damage" label="本章记录伤害" value={amount(damage)} unit="点"/><Metric field="casts" label="神雷实际施放" value={count(row.thunder.casts)} unit="次"/><Metric field="minHp" label="战斗最低生命（保命前）" value={row.survival.minHp===null?'未记录':amount(row.survival.minHp)} unit={row.survival.minHp===null?'未记录战斗':'点'}/></dl>
    <details className="chapter-damage"><summary>本章伤害贡献 · 八类原口径</summary><dl className="chapter-metrics">{sources.map(([key,label])=><Metric key={key} field={'damage-'+key} label={label} value={amount(row.damage[key])} unit="点"/>)}</dl><p>只列本章记录区间；沿本局原伤害贡献口径，旧规则可能计入过量。符火沿用合计，联动已包含，不重复相加；不是额外增伤或整局总伤害。</p></details>
    <details className="chapter-resources"><summary>雷源收支与剩余物资</summary><dl className="chapter-metrics">
     <Metric field="casts" label="神雷实际施放" value={count(row.thunder.casts)} unit="次"/><Metric field="spent" label="实际花费雷源" value={amount(row.thunder.spent)} unit="点"/>
     <Metric field="restGained" label="休整实得雷源" value={amount(row.thunder.restGained)} unit="点"/><Metric field="restClipped" label="已知休整因满额未得" value={amount(row.thunder.restClipped)} unit="点"/>
     <Metric field="chapterGained" label="入章实得雷源" value={amount(row.thunder.chapterGained)} unit="点"/><Metric field="statsGained" label="配置变动实得雷源" value={amount(row.thunder.statsGained)} unit="点"/><Metric field="capLost" label="上限收缩扣减雷源" value={amount(row.thunder.capLost)} unit="点"/>
    </dl><p>费用按每次实际施放计，不用结算时单次费用乘次数。储量不代表立即可施放，仍需灵力蓄满及本{nodeWord}允许。章末休整、购买与已提交选择归本章；换章回复归新章。</p><div className="chapter-resource-balances"><Resources value={row.resourcesStart} label="记录期初 · 交接余额" side="start"/><Resources value={row.resourcesEnd} label={row.closed?'记录期末余额':'当前余额'} side="end"/></div><p>新章期初在入章回复之前；旧局片段从恢复时余额起记。灵石、重选与药囊只列期初和期末／当前余额，不代表总获取或总支出。物资是本次历练库存，不自动带入下一局；剩余多寡不代表使用是否合理。</p></details>
    <details className="chapter-survival"><summary>生存与用药 · 实际受击 {count(row.survival.hits)} 次</summary><dl className="chapter-metrics"><Metric field="minHpRatio" label="最低生命（保命前）／当时上限" value={row.survival.minHp===null?'未记录战斗':amount(row.survival.minHp)+' / '+amount(row.survival.minHpMax)}/><Metric field="hits" label="韩立实际受击" value={count(row.survival.hits)} unit="次"/><Metric field="hpLost" label="实际生命损失" value={amount(row.survival.hpLost)} unit="点"/><Metric field="shieldLost" label="实际护盾吸收" value={amount(row.survival.shieldLost)} unit="点"/><Metric field="revives" label="守心保命触发" value={count(row.survival.revives)} unit="次"/><Metric field="consumablesUsed" label="药囊物资实际使用" value={count(row.survival.consumablesUsed)} unit="次"/></dl><p>最低生命记录战斗中的生命，包含保命回复前的值；出现 0 不等于当时阵亡，请同时看守心触发。尚无战斗采样时显示“未记录战斗”，不是 0。</p><p>受击对象为韩立；护盾吸收可能不损失生命，闪避化解不算受击。实际使用包含药囊中的符与加赠药包；被阻止的操作不计次数，不从剩余份数倒推。</p></details>
    <details className="chapter-nodes"><summary>{nodeWord}观察用时 · {row.nodes.filter(n=>n.complete).length} / {row.nodes.length} 个已记录{nodeWord}完成</summary>{row.nodes.length?<ol>{row.nodes.map(node=><li key={node.wave} data-chapter-node={node.wave}><strong>{nodeWord} {node.wave+1} · {node.complete?'已完成':'未完成'}</strong><span><b>{amount(node.elapsed)}</b> 秒{node.partial?' · 接续片段':''}</span></li>)}</ol>:<p>尚未记录本章{nodeWord}战斗。</p>}<p>只累计实际记录的{nodeWord}战斗时间，暂停与整备不计。未完成{nodeWord}不冒充通关分段；这里不参与正式计时排名，也不按{nodeWord}计时器补推旧用时。</p></details>
   </article>
  </>:<p>尚未开始记录章节战斗。</p>}
  <details className="chapter-combo-milestones"><summary>首次联动形成 · 已记录 {review.firstCombos.length} 项</summary>{review.firstCombos.length?<ol>{review.firstCombos.map(milestone=><li key={milestone.effect}><strong>{comboName(milestone.effect)}</strong><span>{chapterLabel(milestone,endless)} · {nodeWord} {milestone.wave+1} · {milestone.level} 级 · 战斗时钟 {amount(milestone.time)} 秒</span><span>{milestone.traitId?'当次战术：'+(TRAITS.find(t=>t.id===milestone.traitId)?.name||'旧战术'):'形成时未记录对应战术选择'}</span></li>)}</ol>:<p>本记录期尚无首次形成记录。</p>}{review.baselineCombos.length>0&&<p className="chapter-combo-baseline">记录开始前已存在：{review.baselineCombos.map(comboName).join('、')}。首次形成时间未记录，不按最终构筑倒推。</p>}<p>每种联动只保留一次真实首次形成时刻；后续重复满足不重复列出。首次记录可来自已超出最近章节保留范围的章节。</p></details>
  <details className="chapter-ledger-notes"><summary>记录范围与归属</summary><p>章末整备仍归原章，离章后封存；换章回复算新章所得，新章以回复前余额作为期初。只有实际观察到的章节与{nodeWord}会出现，未完成章保留已发生的记录。</p><p>旧局从恢复时开始记录片段；旧或异常摘要不补造数据。最多保留最近 12 章明细，无尽按圈区分。正式章末分段与个人最佳另列，不受这里的观察明细影响。</p></details>
 </section>;
}
