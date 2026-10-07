/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import path from 'node:path';
import {root} from './release-files.mjs';
import {GAME_VERSION} from '../gameplay/version.js';
import {OFFLINE_ENTRY,OFFLINE_PNG_ENTRY} from '../gameplay/delivery-names.js';
export const releaseDir=path.join(root,'release',GAME_VERSION);
export const videoDir=path.join(root,'release','video');
export const artifactPath=name=>path.join(releaseDir,name);
export const introductionPath=path.join(videoDir,'青竹剑阵_视频介绍.html');
export const SOURCE_ARCHIVE='青竹剑阵_源码.zip',PLAYER_FOLDER='青竹剑阵_'+GAME_VERSION+'_免安装版',PLAYER_ARCHIVE=PLAYER_FOLDER+'.zip';
// The complete attachment set in manifest order: build-release lists exactly these and check-release requires each one.
export const releaseArtifacts=[OFFLINE_ENTRY,OFFLINE_PNG_ENTRY,SOURCE_ARCHIVE,PLAYER_ARCHIVE];
