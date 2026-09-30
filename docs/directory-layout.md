# 目录说明

## 日常使用

```text
项目根目录/
├── 凡人修仙传_青竹剑阵.html          原路径直接游玩
├── 凡人修仙传_青竹剑阵_兼容PNG.html  原路径兼容入口
├── 青竹剑阵_游玩说明.md
├── 青竹剑阵_更新日志.md
├── README.md、AGENTS.md、LICENSE 等仓库入口
├── game/                            当前源码与开发环境
├── docs/                            精选公开文档
│   └── presentation/                视频介绍源模板、截图和口播稿
├── release/                         本地生成，不提交 Git
│   ├── 1.1/                         发给玩家／上传 Release 的附件
│   └── video/                       录视频用的 HTML、口播稿、录制说明
└── local-archive/                   完整历史资料，不提交 Git
```

### 发给玩家

进入 `release/1.1/`，按需要发送单个游戏 HTML 或免安装 ZIP。对应源码 ZIP、校验清单与交付 manifest 在同一目录。不要把整个工作目录发送给玩家。

### 录制视频

进入 `release/video/`，打开介绍 HTML，按 F 全屏、H 进入纯画面、N 打开提词窗口。口播稿和简短录制说明在同一目录。

### 开发和验证

继续在 `game/` 使用原有 npm 命令。`build:release` 自动把附件写入按版本划分的发布目录；`build:intro` 自动整理视频成品。根目录两个游戏入口继续更新，路径保持不变。

`game/node_modules` 和当前构建缓存保留，开发环境可继续使用。`game/qa/` 仅收新运行的验证输出；此前大量日志与夹具已归档。

## 历史资料归档

| 原位置 | 归档位置 |
|---|---|
| history/ | local-archive/history/ |
| qa-runs/ | local-archive/qa-runs/ |
| plans/ | local-archive/plans/ |
| qa/ | local-archive/qa/root/ |
| game/qa/ 的旧内容 | local-archive/qa/game/ |
| game/qa-runs/ | local-archive/qa/game-extra/ |
| release/player/ 的旧解压副本 | local-archive/deliveries/player-extracted-before-organization/ |
| 根目录两张原始参考图 | local-archive/assets/reference-images/ |

已有的 before-1.0、before-player-package、documents、scripts 与工作日志仍保留在 local-archive 中。历史文档和脚本原文未批量改写；其中旧相对路径或绝对路径只说明当时环境，需要重放历史实验时先按迁移表还原对应结构。

## 本次整理记录

2026-09-15 共迁移 14 项目录／文件，保留 216,983 个文件，按文件统计约 10.27 GB；迁移前后核对了目录身份、文件数与字节数。采用同卷移动，没有删减历史内容。完整机器可读映射在本地 `local-archive/directory-organization-2026-09-15/moves.json`，该目录还保存整理前的源码包和仓库入口文档。

目录调整没有改变游戏版本、玩法数值或存档格式。保留根目录两个游戏文件，是为了继续使用原先的直接游玩路径。若自行换入口、浏览器或移动整个项目，仍应先从游戏设置导出存档。

## 整理后验证

- 539 项规则与存档测试通过；lint 无新增诊断，TypeScript 检查通过。
- 重新执行视频介绍构建、双离线构建、源码／玩家包生成与发布校验；输出落在新目录。
- 发布目录两份 HTML 与根游玩入口逐字节相同；源码 ZIP、玩家包内嵌源码及 SHA 清单核验通过。
- 从新位置读取玩家 ZIP，在断网浏览器中验证两个入口的开局、闪避、暂停和刷新后续玩。
- 从 `release/video/` 验证介绍页八段画面、全屏、键盘操作、稿件导出、自动演示和提词窗口双向同步，无页面异常或外部请求。
