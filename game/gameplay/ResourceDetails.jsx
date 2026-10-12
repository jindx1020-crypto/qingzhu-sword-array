/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React from 'react';
import {resourceOverview} from './resource-details';
import {AttributeLedger} from './RunStats';
import {reserveRestGuidance} from './player-guidance';
const number=n=>n>0&&n<.001?'不足0.001':Number(n.toFixed(3)).toLocaleString('zh-CN');
export default function ResourceDetails({b,section='resources'}){const r=resourceOverview(b),a=r.allies,shield=section==='shield',allies=section==='allies';return <section className="resource-details" aria-label="资源来源说明">
 {shield?<><h3>护盾与常驻上限</h3><p>当前生命 {number(b.player.hp)} / {number(b.player.maxHp)}；护盾 <b>{number(r.shield.current)}</b> / 常驻上限 <b>{number(r.shield.maximum)}</b>。</p><p>其中超出常驻上限的额外护盾 <b>{number(r.shield.extra)}</b>；常驻缺口 {number(r.shield.gap)}。额外护盾不会随时间衰减，仍会被伤害消耗。</p><AttributeLedger sources={r.sources} keys={['shield','shieldRegen']}/><p>加成层护盾 {number(r.sources.totals.shield)} × 核心倍率 {r.shield.core}，本局实际常驻上限 {number(r.shield.maximum)}。数量换算只计常驻傀儡，临时支援不提高此上限。</p><p className="muted">这里只对账当前值；没有逐次取得记录，不能由额外护盾差值反推各次机缘或物资贡献。</p></>:<>
 {!allies&&<section className="reserve-detail"><h3>雷源与施雷预算</h3><p>储量 <b>{number(r.reserve.current)} / {number(r.reserve.maximum)}</b> · 每次耗用 <b>{number(r.reserve.cost)}</b> · 雷源可支撑 <b>{r.reserve.budget} 次</b>。</p><p>灵力 {number(r.reserve.mana)} / 100。储量预算不等于此刻可施放；灵力、所在场景和本圈挑战仍须允许，回灵不补雷源。</p><AttributeLedger sources={r.sources} keys={['reserve']}/>{reserveRestGuidance(b)&&<p>{reserveRestGuidance(b)}</p>}</section>}
 <section className="ally-detail"><h3>协战数量与来源</h3><p>当前在场：傀儡 <b>{a.puppets} 具</b> · 噬金虫 <b>{a.insects} 只</b>。层数、易伤百分比和核心伤害倍率都不是单位数量。</p><p>按当前配置可部署：傀儡 {a.deployed.puppets} 具（常驻 {a.permanentPuppets}、临时 {a.temporaryPuppets}）；噬金虫 {a.deployed.insects} 只（常驻 {a.permanentInsects}、孵化增加 {a.brood}、临时 {a.temporaryInsects}）。部署上限分别为 12／30。</p><AttributeLedger sources={r.sources} keys={['puppets','insects']}/><p>表格为常驻加成层，孵化和临时支援在上方单列；尚未部署的配置不冒充在场数量。</p></section>
 </>}
 </section>;}
