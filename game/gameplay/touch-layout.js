/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
// Device presentation only. These keys never include touch-lock eligibility or battle input.
export const LAYOUT_KEYS=Object.freeze(['joystickSide','joystickSize','skillSide','suppliesFollowSkills']);
export function normalizeLayoutPreferences(settings={}){
 return {joystickSide:settings?.joystickSide==='right'?'right':'left',joystickSize:settings?.joystickSize==='large'?'large':'standard',skillSide:settings?.skillSide==='left'?'left':'right',suppliesFollowSkills:settings?.suppliesFollowSkills===true};
}
// side is the casting hand. Presets intentionally retain the separately configured stick size.
export function layoutPreset(side){
 if(side!=='left'&&side!=='right')return null;
 return {joystickSide:side==='left'?'right':'left',skillSide:side,suppliesFollowSkills:true};
}
export function applyLayoutPatch(settings={},patch={}){
 const source=settings&&typeof settings==='object'&&!Array.isArray(settings)?settings:{},changes=patch&&typeof patch==='object'&&!Array.isArray(patch)?patch:{};
 const accepted=Object.fromEntries(LAYOUT_KEYS.filter(key=>Object.hasOwn(changes,key)).map(key=>[key,changes[key]]));
 return {...source,...normalizeLayoutPreferences({...source,...accepted})};
}
