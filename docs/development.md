# 开发与构建 · 1.1

## 环境

使用 Node.js 22.13+、npm 和锁文件安装。默认开发流程不需要作者机器的路径、云账户或密钥。游戏本身完全在浏览器运行，进度使用 localStorage。

```sh
cd game
npm ci
npm run dev
```

React 与 Canvas 通过 Game 组件桥接；战斗引擎维护可变状态，React 显示菜单和事件结果。Web 工程保留 vinext／Vite 架构；`.openai/hosting.json` 仅有空的 d1／r2 配置，不绑定云存储。`npm run build` 验证 Web 构建，不执行部署。

## 目录职责

| 位置 | 内容 |
|---|---|
| game/gameplay | 游戏引擎、状态验证、存档、界面、规则与表现 |
| game/app、components、lib、hooks | Web 入口和通用界面组件 |
| game/public/assets | 原 PNG、交付编码、哈希清单和生成记录 |
| game/scripts | 构建、文档表格、验收、模拟与测试夹具 |
| game/tests | 当前与历史规则的回归测试 |
| docs | 当前开发、许可、验收、改编与发布说明 |
| release/1.1、release/video | 游戏发布附件、介绍视频成品；构建生成，不提交 Git |
| local-archive | 本地旧源码、测试原文、方案、参考素材和旧交付；不公开 |
| game/qa | 当前验证输出目录，按需创建；旧输出已归档 |

历史维护要求见 [兼容规则沿革](compatibility.md)，当前默认见 [AGENTS](../AGENTS.md)。不要从历史批次标题推断当前版本。

## 说明与生成文件

根游玩说明和更新日志是游戏内帮助的源文档。起手、难度、经验、核心、修持、联动及补给表使用 `scripts/guide-tables.mjs` 调用实际规则函数。

```sh
npm run docs:tables
```

依赖变化后，先 `npm ci` 与 `npm run build:offline`，再运行 `npm run docs:deps` 重新生成 `docs/dependency-inventory.json` 与 `docs/licenses/`：每个锁定条目一行，许可原文按 LF 规范化后以 SHA-256 前 16 位命名，未被引用的旧原文会删除。`npm run check:release` 仍逐项核对锁文件与清单。

这条命令显式更新文档表格。请复核正文后再构建。构建中的 `embed-docs` 只校验和生成 `docs.generated.js`；表格不同会失败，不会偷偷改说明。`assets.generated.js`、`docs.generated.js` 和构建目录不提交。

只有修改图片时才需重新编码：安装 Python 3 与 Pillow 后，在 game 中执行 `python3 scripts/round10-phase5-encode.py` 查看对照结果，确认后加 `--apply`。原 PNG 保留，副本和 manifest 必须一起更新。普通游戏构建及源码 ZIP 打包只需 Node。

## 检查

```sh
npm run check
npm run build
npm run build:release
npx playwright install chromium
npm run test:browser
npm run check:release
```

- `check`：lint、全部规则测试、TypeScript；JS 未全面启用 checkJs，不将此描述为全引擎类型认证。
- lint 基线只有 19 条原通用组件诊断，并锁定文件哈希；不允许扩大基线来掩盖新诊断。
- `test:browser`：项目内 Playwright 的 Chromium，两个离线变体分别运行五组检查；输出在 game/qa/release，可包含合成存档、截图和声音片段，不进源码包。
- Linux 可用 `npx playwright install --with-deps chromium` 安装系统依赖。需指定已安装 Chromium 时设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`；默认不使用个人浏览器资料。
- 单组调试可执行 `node scripts/release-browser.mjs`；`QINGZHU_ASSET_PROFILE=png` 选择 PNG，`QINGZHU_HTML` 可指定待测文件。
- 普通打开不暴露调试接口；只有 `?test=1` 暴露 `window.__FANREN__`。测试中的合成完成或改位仅用于检查界面与保存，不作通关速度证据。

## 固定策略模拟

`npm run test:balance` 使用真实引擎和合法自动策略，不免伤、不发额外经验。支持 BATTLE_DIFFICULTY=0/1/2、BATTLE_SEED_PREFIX、BATTLE_SHARED_SEED=1、BATTLE_PATHS、BATTLE_VALIDATE_SAVES=1。输出默认写入 game/qa。自动策略胜负不是真人胜率；所有失败样本都保留。

## 发布产物

产物位置统一定义在 `scripts/delivery-paths.mjs`。游戏发布附件进入 `release/<游戏版本>/`，当前为 `release/1.1/`；根目录两个同名 HTML 保留直接游玩入口，与发布副本逐字节相同。`npm run build:intro` 将视频介绍 HTML、口播稿副本和录制说明写入 `release/video/`。

`build:release` 校验原图／编码哈希、嵌入文档、构建两份离线 HTML，恢复默认 WebP 配置，生成白名单源码 ZIP、免安装玩家 ZIP、SHA256SUMS.txt 与 release-manifest.json。玩家包包含直接运行的 HTML、PNG 兼容入口、先读我和对应源码；构建脚本不放在玩家入口目录。源码包固定 ZIP 时间戳并解压回读比对，不靠 Python 或系统 zip。

`check:release` 验证源码 ZIP 与公开清单逐字节一致、产物哈希、版本、内嵌帮助、依赖许可、链接和隐私扫描。`npm run test:player` 从实际玩家 ZIP 解压，在断网浏览器中核对两种入口。公开清单是 `scripts/release-files.mjs`，新增交付文件须同步它。

WebP 与 PNG 的离线画面应在浏览器中核对；半透明预乘通道可能有取整差异，不宣称逐像素完全相同。CI 验证技术行为，不能代替手机真机体验。

## 跨平台兼容回归与 GitHub 附件

旧规则快照现在与 `scripts/fixtures/pre-balance4/` 中经哈希封存的独立旧引擎，在同一个 Node 运行时进行完整快照哈希对比。原 54 行归档与派生数值夹具保持；不靠跨 CPU／运行时的序列化哈希替代兼容性验证，不放宽数字容差或跳过用例。

发布 GitHub 前运行 `npm run prepare:github`，在 release/1.1/github/ 生成逐字节相同的英文附件及对应校验清单，避免平台把中文文件名改成下划线。
