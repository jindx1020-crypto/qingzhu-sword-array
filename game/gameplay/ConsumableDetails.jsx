/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React from 'react';
import {consumableDetails} from './consumable-display';
export default function ConsumableDetails({b}){
 const rows=(b.consumables||[]).map((_,i)=>consumableDetails(b,i)).filter(Boolean);
 return <section className="consumable-details"><p className="consumable-note">仅查看效果与当前状态；本面板不会用药。关闭后仍保持暂停，由你继续战斗并按原药囊按钮使用。</p>{rows.length?rows.map(row=><article className="consumable-detail" key={row.index}><h3>药囊 {row.index+1} · {row.name} <small>× {row.count}</small></h3><p>{row.description}</p><strong className={'consumable-availability '+(row.available?'available':'unavailable')}>{row.availability}</strong><p className="consumable-effect">{row.effect}</p>{row.notes.map(note=><p className="consumable-note" key={note}>{note}</p>)}</article>):<p>当前没有药囊物资。</p>}</section>;
}
