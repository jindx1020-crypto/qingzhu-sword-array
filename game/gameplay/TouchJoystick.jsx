/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import React from 'react';
export default function TouchJoystick({joystickRef,preview=false,onPointerDown,onPointerMove,onPointerUp,onPointerCancel,onLostPointerCapture}){
 const handlers=preview?{}:{onPointerDown,onPointerMove,onPointerUp,onPointerCancel,onLostPointerCapture};
 return <div ref={joystickRef} className="touch-joystick" inert={preview||undefined} aria-hidden={preview||undefined} {...handlers}><span/></div>;
}
