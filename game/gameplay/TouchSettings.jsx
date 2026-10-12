/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React from 'react';
import {Button} from '../components/ui/button';
import {touchSettings,supportsTouchLock} from './touch-controls';
import {layoutPreset} from './touch-layout';
export default function TouchSettings({settings,b,active,onChange,onLayoutChange}){
 const s=touchSettings(settings),live=active&&b&&supportsTouchLock(b),enabled=live?b.options.touchLockEnabled:s.touchLock;
 return <section className="touch-settings"><h3>触屏布局与瞄准</h3><p className="muted">设置期间暂停并清除输入。布局用于本设备；放大档在极小窗口适当收紧，避免盖住状态栏。</p>
 <div className="touch-layout-presets"><strong>一键布局</strong><div className="mode-row">{[['right','右手技能预设'],['left','反手预设 · 左手技能']].map(([side,label])=>{const preset=layoutPreset(side),selected=s.skillSide===preset.skillSide&&s.joystickSide===preset.joystickSide&&s.suppliesFollowSkills;return <Button className={'fr-btn '+(selected?'selected':'')} variant="outline" key={side} aria-pressed={selected} onClick={()=>onLayoutChange(preset)}>{label}</Button>;})}</div><small>同时摆放摇杆、技能、药囊与雷源；保留摇杆大小、键位和锁敌开关。也可逐项调整。</small></div>
 {[['joystickSide','摇杆位置',[['left','摇杆在左'],['right','摇杆在右']]],['joystickSize','摇杆大小',[['standard','标准摇杆'],['large','放大摇杆']]],['skillSide','技能位置',[['right','技能在右'],['left','技能在左']]]].map(([key,label,choices])=><div className="touch-setting-row" key={key}><strong>{label}</strong><div className="mode-row">{choices.map(([value,text])=><Button className={'fr-btn '+(s[key]===value?'selected':'')} variant="outline" key={value} aria-pressed={s[key]===value} onClick={()=>onLayoutChange({[key]:value})}>{text}</Button>)}</div></div>)}
 <div className="touch-setting-row"><strong>药囊与雷源位置</strong><div className="mode-row">{[[false,'保留原位置'],[true,'跟随技能侧']].map(([value,label])=><Button className={'fr-btn '+(s.suppliesFollowSkills===value?'selected':'')} variant="outline" key={label} aria-label={'药囊与雷源：'+label} aria-pressed={s.suppliesFollowSkills===value} onClick={()=>onLayoutChange({suppliesFollowSkills:value})}>{label}</Button>)}</div></div>
 <p className="muted">跟随后，药囊与雷源靠近技能；摇杆旁的解除仍跟随摇杆。横竖屏使用同一套偏好，按当前窗口重新排布；完整预览见下方固定操作区。</p>
 <div className="touch-setting-row"><strong>点按锁敌 · 实验选项</strong><Button className="fr-btn" variant="outline" aria-label={'触屏锁敌：'+(enabled?'开启':'关闭')} aria-pressed={enabled} onClick={()=>onChange('touchLock',!enabled)}>{enabled?'开启':'关闭'}</Button></div><p className="muted">默认定点瞄准。开启后点中飞剑射程内的可攻击目标可跟随锁定；拖动改为定点，死亡、失去可攻击状态或离开射程会解除锁定。右上角与摇杆旁均可取消瞄准。</p>{active&&!live&&<p className="key-warning">本局沿用旧集火规则，此开关只影响之后的新历练。</p>}<small>本局曾开启锁敌时，成绩单独分组。真机手感仍待验证。</small></section>;
}
