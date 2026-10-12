/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React from 'react';
import {defenseReview} from './defense-telemetry';
import {CORES} from './expedition-data';
const coreName=id=>CORES.find(core=>core.id===id)?.name||'对应核心';

const amount=n=>n>0&&n<.1?'不足0.1':Number(n.toFixed(1)).toLocaleString('zh-CN');
const count=n=>n.toLocaleString('zh-CN');
const seconds=n=>amount(n)+' 秒';
const percent=n=>n===null?'暂无占比':amount(n*100)+'%';

function Metric({name,value,unit,field}){return <div className="defense-metric" data-defense-field={field}><dt>{name}</dt><dd><b>{value}</b><small>{unit}</small></dd></div>;}

export default function DefenseReport({b}){
 const review=defenseReview(b);
 if(!review.available)return <section className="defense-report defense-unrecorded" tabIndex={-1}><h3>策略收益</h3><p className="defense-scope"><strong>未记录</strong></p><p>{review.message}</p><p>不按闪避输入次数、当前配置或总伤害补造此前收益。</p></section>;
 const s=review.stats,conditions=[
  {id:'setup',name:'起手架设 · 弩速 +25%',possible:s.setupPossible,active:s.setupActive,shots:s.setupShots,rate:review.setupRate,note:'仅统计起手架设可用期间；移动策应会替代这项加速。架设衔接按本局真实规则记录。'},
  {id:'stationary',name:'定点类驻定增伤',possible:s.stationaryPossible,active:s.stationaryActive,shots:s.stationaryShots,rate:review.stationaryRate,note:'按本局驻定增伤条件记录；可与移动策应配置共存。装配该核心时仅停驻满足增伤，未装配时保留本局衔接规则。'},
  {id:'mobile',name:'移动策应 · 弩速 +35%',possible:s.mobilePossible,active:s.mobileActive,shots:s.mobileShots,rate:review.mobileRate,note:'仅统计装配移动策应且有傀儡期间，按实际移动输入条件判断；不以位移距离代替。'}
 ];
 return <section className="defense-report" tabIndex={-1}>
  <h3>策略收益</h3>
  <p className="defense-scope"><strong>{review.complete?'自本局出发起记录':'接续片段记录'}</strong> · 已记录 {seconds(s.elapsed)}<small>{review.complete?'战斗时钟起点 ':'恢复后从战斗第 '}{amount(review.fromTime)} 秒{review.complete?'；按本局实际发生累计。':'起；此前未记录，不代表整局。'}</small></p>
  <dl className="defense-key-metrics">
   <Metric name="护身化解" value={count(s.deflections)} unit="次" field="deflections"/>
   <Metric name="反击实得回盾" value={amount(s.counterShield)} unit="点" field="counterShield"/>
   <Metric name="护盾实际吸收" value={amount(s.shieldAbsorbed)} unit="点" field="shieldAbsorbed"/>
   <Metric name="弩矢实际发射" value={count(s.puppetShots)} unit="发" field="puppetShots"/>
  </dl>
  <details className="defense-guard"><summary>防守明细 · 反击触发 {count(s.counters)} 次</summary><dl className="defense-detail-metrics">
   <Metric name="实际执行闪避" value={count(s.dashes)} unit="次" field="dashes"/>
   <Metric name="护身化解" value={count(s.deflections)} unit="次" field="deflections"/>
   <Metric name="反击触发" value={count(s.counters)} unit="次" field="counters"/>
   <Metric name="反击实得回盾" value={amount(s.counterShield)} unit="点" field="counterShield"/>
   <Metric name="闪避反击实际伤害" value={amount(s.counterDamage)} unit="点" field="counterDamage"/>
   <Metric name="护盾实际吸收" value={amount(s.shieldAbsorbed)} unit="点" field="shieldAbsorbed"/>
   <Metric name="脱离受击复盾" value={amount(s.regenShield)} unit="点" field="regenShield"/>
   <Metric name="盾破震退触发" value={count(s.breaks)} unit="次" field="breaks"/>
   <Metric name="盾破震退实际伤害" value={amount(s.breakDamage)} unit="点" field="breakDamage"/>
  </dl><p>护身起手的同一化解窗口实际挡到来袭才记一次；其他流派闪避、其他无敌不计本项。空闪不计；旧规则可能化解但仍在反击冷却。实际回盾受当时护盾上限限制，触发反击也可能没有伤害或回盾。两类反击伤害分别记录实际扣血。</p><p>护盾吸收是减伤后的真实吸收，不含{coreName('K12')}的闪避花盾。脱离受击复盾只记等待后的常驻回复，不含符圈、化解、药囊或神雷等其他来源；守心保命不算闪避化解。接续记录可能从一次闪避途中开始，不以化解次数除以闪避次数作为成功率。</p></details>
  <details className="defense-puppet"><summary>傀儡条件 · 在场记录 {seconds(s.puppetSeconds)}</summary><p className="defense-shot-summary">实际发射 <b>{count(s.puppetShots)}</b> 发，其中{coreName('K05')}追加 <b>{count(s.extraShots)}</b> 发；追加已包含在总数内，不代表命中。</p><div className="defense-conditions">{conditions.map(row=><section className="defense-condition" data-defense-condition={row.id} key={row.id}><h4>{row.name}</h4><p className="defense-condition-time"><strong>{seconds(row.active)}</strong> / {seconds(row.possible)}<small>生效时间 / 条件可用时间</small></p><p className="defense-condition-rate">覆盖 <b>{percent(row.rate)}</b>{row.rate===null&&' · 尚无可用时段'}</p><p>生效时发射 <b>{count(row.shots)}</b> 发</p><p className="defense-condition-note">{row.note}</p></section>)}</div><p>每项分母都是有傀儡且对应配置存在期间的战斗时间，分子是条件实际生效时间。条件可能重叠，不相加当作 100%，也不是额外伤害占比；不按结算时的配置改写此前记录。</p></details>
  <details className="defense-notes"><summary>记录范围与统计口径</summary><p>只在本记录期的战斗中累计，暂停、悟道、整备与过场不计入时长。已有记录随本局保存与恢复；旧局未采集的部分不追补，缺失或异常的旧摘要显示未记录。</p><p>次数按实际事件累计，发射按真实生成的弩矢计数。条件生效不保证有目标、命中或额外伤害；本面板不计算免伤量或闪避成功率。</p></details>
 </section>;
}
