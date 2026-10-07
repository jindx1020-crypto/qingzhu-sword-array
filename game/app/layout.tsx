/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import type { Metadata,Viewport } from 'next';
import './globals.css';
import {GAME_VERSION,GAME_ARC,GAME_TITLE} from '../gameplay/version';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export const metadata: Metadata = {title:GAME_TITLE+' '+GAME_VERSION,description:GAME_ARC+'像素御剑同人游戏'};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {return <html lang="zh-CN"><body className="dark">{children}</body></html>;}
