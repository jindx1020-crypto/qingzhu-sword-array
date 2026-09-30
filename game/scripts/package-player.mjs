/* SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 bilibili@卡布奇诺ultra
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {zipSync,unzipSync} from 'fflate';
import {root} from './release-files.mjs';
import {GAME_VERSION} from '../gameplay/version.js';
import {OFFLINE_ENTRY,OFFLINE_PNG_ENTRY,PLAYER_ENTRY,PLAYER_PNG_ENTRY} from '../gameplay/delivery-names.js';
import {releaseDir,artifactPath} from './delivery-paths.mjs';
const folder='青竹剑阵_'+GAME_VERSION+'_免安装版';
const readme=`青竹剑阵 · 虚天殿篇 ${GAME_VERSION}
制作人：bilibili@卡布奇诺ultra

【开始游戏】
1. 将整个压缩包解压到一个固定文件夹。
2. 双击同一文件夹内的「开始游戏.html」。
3. 如果打开成文字，右键选择“打开方式”，使用浏览器打开。

无需安装游戏、插件、Node.js 或其他开发环境；解压后的 HTML 可直接离线玩。
不要直接在压缩包、聊天软件文件预览或文本编辑器中运行。

【基本操作】
WASD／方向键：移动；空格：闪避；E：神雷；Q：切换剑式；1／2：物资；Esc：暂停。
飞剑自动攻击。鼠标按住战场集火，松开恢复分守。
触屏使用摇杆和技能按钮；点按战场瞄准，点「解除」恢复分守。
首次建议选择「初入仙途」，可先进行分步练习。完整玩法说明在游戏首页内。

【图片兼容】
如果推荐入口的图片显示异常，可打开「兼容版／开始游戏_PNG.html」。两份玩法相同。

【保存进度】
进度保存在当前浏览器本地，不会自动同步。
升级、更换浏览器、移动文件夹或改用兼容版前，请先从游戏设置「导出存档」；需要时在新入口导入。
不要依赖聊天软件临时预览、隐私模式或浏览器自动清理保留进度。

【附带的开源资料】
「开源资料」内提供 GPLv3 完整许可和对应的「青竹剑阵_源码.zip」。玩家不用打开或安装这些文件。
源码 ZIP 含本版可修改源码、构建脚本和独立素材说明；便于分享本包时同时提供对应源码。
原创代码采用 GPL-3.0-only；游戏不提供担保。第三方代码保留原许可。
本作是《凡人修仙传》的非官方同人改编；代码许可不授予小说、人物设定或图片的权利。
现有图片和原始参考图的来源／授权边界见源码包 docs/assets.md。
`;
const files={
 [PLAYER_ENTRY]:fs.readFileSync(path.join(root,OFFLINE_ENTRY)),
 '先读我.txt':Buffer.from(readme.replaceAll('\n','\r\n')),
 [PLAYER_PNG_ENTRY]:fs.readFileSync(path.join(root,OFFLINE_PNG_ENTRY)),
 '开源资料/LICENSE.txt':fs.readFileSync(path.join(root,'LICENSE')),
 '开源资料/青竹剑阵_源码.zip':fs.readFileSync(artifactPath('青竹剑阵_源码.zip'))
};
const entries={};for(const [name,bytes]of Object.entries(files))entries[folder+'/'+name]=[new Uint8Array(bytes),{mtime:new Date(2026,0,1)}];
const bytes=zipSync(entries,{level:7}),decoded=unzipSync(bytes);
for(const [name,original]of Object.entries(files))if(!Buffer.from(decoded[folder+'/'+name]).equals(original))throw Error('Player archive differs: '+name);
fs.mkdirSync(releaseDir,{recursive:true});
const target=artifactPath(folder+'.zip'),pending=target+'.pending';fs.writeFileSync(pending,bytes);fs.renameSync(pending,target);
console.log(JSON.stringify({playerPackage:path.basename(target),files:Object.keys(files),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}));
