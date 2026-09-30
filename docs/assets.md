# 素材来源与授权范围 · 1.1

## 代码与素材分开

原创程序代码使用 GPL-3.0-only。小说、人物名称和设定属于其各自权利人；现有图片未统一授予 GPL 或 MIT。此项目为非官方同人，不宣称得到小说、动画或其他权利人的授权。

图片保留在源码和离线成品中，以便复现本项目；这不等于确认所有参考来源均可再授权或商用。作者在实际公开前需确认下述两张原始参考图的来源及分发条件，必要时替换相应衍生素材。仅声明“AI 生成”不能替代该核对。

## 图片清单

全部实际交付图片在 game/public/assets，源图保持原 PNG；优化副本与哈希在 encoded/manifest.json。

| 图片 | 用途 | 生成／参考记录 |
|---|---|---|
| hanli-sword-atlas.png | 韩立战斗小人、飞剑 | AI 生成，参考作者提供的人物与飞剑图 |
| enemy-atlas.png | 敌方图集 | AI 生成的战术敌人原型 |
| battlefield-atlas.png | 六种环境底图 | AI 生成 |
| golden-beetle.png | 友方金色噬金虫 | AI 参考敌方图集甲虫生成金色版本 |
| menu-backdrop.png | 首页背景 | AI 参考战场图集风格生成 |
| expedition-portraits-atlas.png | 剧情人物头像 | AI 生成的同人解释，不宣称官方立绘 |
| expedition-icons-atlas.png | 核心与目标图标 | AI 生成 |
| expedition-props-atlas.png | 阵眼、石门与道具 | AI 生成 |
| hanli-dialogue-portrait-v1.png | 韩立过场头像 | AI 生成，与战斗小人分离 |

角色及飞剑最初参考图为「改为卡通Q版像素风格小人。白色背景.png」和「改为卡通Q版像素风格道具。白色背景.png」。原始参考图归档于本地 `local-archive/assets/reference-images/`，不进入公开包；当前仓库没有其外部作者、来源或再授权证明，不把未知内容标成已获授权。

图集生成提示词、尺寸和透明度记录随 assets 下的 Markdown／JSON 保留，制作机器的绝对路径已移除。记录只说明生成过程，不构成外部权利证明。部分原 PNG 没有真实 alpha，运行时作背景提取，不把其原图冒称透明成品。

## 声音、图标与截图

音乐与音效由游戏的 WebAudio 代码合成，无外部音乐文件。界面图标来自 Lucide，许可见第三方声明。README 截图取自本次游戏构建的实际浏览器画面，未另外生成宣传图。

## 修改素材

原图修改后必须重新编码、更新 manifest 并核验；构建检测到原图或编码哈希不符会失败。不要只替换一张图而沿用旧副本。素材具体许可与小说 IP 说明不能对 GPL 覆盖的程序代码附加限制。
