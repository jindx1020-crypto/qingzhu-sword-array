/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React from 'react';
// The parent owns focus, rebinding cancellation and the list of actually rendered sections.
export default function SettingsNavigation({sections,onNavigate}){
 return <nav className="settings-navigation" aria-label="设置分区" data-settings-navigation="">{sections.map(({id,label})=><button type="button" key={id} data-settings-navigation={id} onClick={()=>onNavigate(id)}>{label}</button>)}</nav>;
}
