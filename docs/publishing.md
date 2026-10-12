# GitHub 发布步骤 · 1.3

公开仓库：[jindx1020-crypto/qingzhu-sword-array](https://github.com/jindx1020-crypto/qingzhu-sword-array)。1.3 标签为 `v1.3`，[Release 入口](https://github.com/jindx1020-crypto/qingzhu-sword-array/releases/tag/v1.3)，标题为 **1.3 修复更新**。1.2 的 `v1.2`、1.1 的 `v1.1` 与 1.0 的 `v1.0` 标签及 Release 保留不改。

本页保留构建、验证和上传步骤供后续维护。

## 发布前核对

- 阅读 [1.3 验收报告](release-1.3.md)，保留尚未验证的真机与原著细节说明。
- 核对 [素材来源](assets.md)：原始人物／飞剑参考图的再分发权利需要作者确认；GPL 代码许可不代替素材或小说 IP 授权。
- 从源码包在干净目录执行 [开发文档](development.md) 中的检查与构建。
- 发布对应源码与两份 HTML，保留 GPLv3、第三方声明和制作署名。

## 仓库与提交

当前项目使用公开仓库 `https://github.com/jindx1020-crypto/qingzhu-sword-array`，主分支 `main`。源码按 GPL-3.0-only 发布，图片及小说 IP 范围另行声明。

提交前检查 `git status`，只提交公开白名单中的源码、必要素材、测试和文档。`local-archive/`、`release/`、依赖缓存及个人存档不进入 Git。仓库维护已有 README、LICENSE 和忽略规则，不重复初始化。

## 创建 Release

检查 GitHub Actions 完成后，为同一提交创建 `v1.3` 标签与正式 Release。标题用 **1.3 修复更新**，正文可取更新日志首段。

在 game 目录先执行 `npm run build:intro` 与 `npm run test:intro`，同步介绍页与公开口播稿；再执行 `npm run build:release`、`npm run check:release`，最后执行 `npm run prepare:github`。每次 `build:release` 都会清除旧的 github/ 副本，须在其后重新执行 `prepare:github`。

GitHub 会规范化附件中的非英文字符，因此上传 `release/1.3/github/` 内的六个文件：

- qingzhu-1.3.html
- qingzhu-1.3-png.html
- qingzhu-1.3-source.zip
- qingzhu-1.3-player.zip
- SHA256SUMS.txt
- release-manifest.json

英文附件与本地中文成品逐字节相同；目录内的 SHA256SUMS.txt 按英文下载文件名生成。upload-plan.json 是上传工具清单，无须作为附件发布。免安装包内部仍使用「开始游戏.html」等中文名称，并内含对应源码。

源码附件必须与两份 HTML 对应，不用过期源码替代。建议先上传到 Draft Release，检查目标提交的 Actions 和全部附件 SHA-256，再公开发布。不要把工作目录的历史资料或个人存档上传。

可在下载目录执行 `shasum -a 256 -c SHA256SUMS.txt`；Windows PowerShell 使用 `Get-FileHash -Algorithm SHA256` 比较。HTML／ZIP 留作 Release 附件，不重复提交到 Git 历史。

## 后续维护

同版本补充发布时，先保存旧 Release 元数据、六份附件和标签提交，再核验新成品与对应源码。提交新源码到 `main`，等待该提交的 Actions 通过；对 `v1.3` 标签只采用带旧值校验的更新，避免覆盖他人刚发布的版本。沿用原发布页与六个附件名，更新期间置为草稿，全部新附件上传并核对后再恢复正式发布。新发布证据单独归档，不改写既有批次的历史结果。

上传后检查 Release 附件可下载、校验值一致，下载 HTML 可离线运行；确认源码安装构建成功。仓库地址与源码获取说明已经写入 README 和游戏内许可页；地址或文档变更后重建成品。需要在线托管时另行安排部署，本次流程只发布仓库与离线文件。
