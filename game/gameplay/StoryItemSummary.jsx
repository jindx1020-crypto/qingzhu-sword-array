/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React from 'react';
import {storyItemDetailsList} from './item-details';
export default function StoryItemSummary({b}){
 const items=storyItemDetailsList(b),current=items.filter(item=>item.held===true||item.equipped===true);
 return <div className="story-item-summary"><strong>剧情行囊与战场配置</strong>{current.length>0&&<p className="story-item-current">{current.map(item=>item.name+'：'+item.state).join('；')}。</p>}
  <details className="story-item-details"><summary>器物用途与下次获取（含后续器物）</summary>
   <p className="story-item-notice">以下是只读说明目录，包含后续器物，不代表本局已经取得。持有看本局行囊，携行或协战看实际配置；暂选、通关与账号历史不会替代这些记录。</p>
   <div className="story-item-list">{items.map(item=><details className="story-item-entry" data-story-item={item.id} key={item.id}><summary><span>{item.name}</span><small>{item.configurable?item.state:item.id==='swords'?'基础御剑':'封存纪事 · 非携行配置'}</small></summary>
    <div className="story-item-content">{item.canonNote&&<p className="story-item-canon">{item.canonNote}</p>}<dl className="story-item-state"><dt>本局持有</dt><dd>{item.inventory}</dd><dt>本局配置</dt><dd>{item.configuration}</dd></dl>
     <p className="story-item-effect"><strong>{item.configurable?'配置基础效果':'本篇用途'}：</strong>{item.effect}</p>{item.effectNote&&<p className="story-item-effect-note">{item.effectNote}</p>}
     <p><strong>来源说明：</strong>{item.source}</p><p className="story-item-acquisition"><strong>取得路径：</strong>{item.acquisition}</p>{item.id!=='swords'&&<p className="story-item-configuration"><strong>配置路径：</strong>{item.configurationPath}</p>}<p className="story-item-boundary">{item.boundary}</p>
    </div>
   </details>)}</div>
  </details>
 </div>;
}
