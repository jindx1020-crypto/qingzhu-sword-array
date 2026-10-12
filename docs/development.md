# 开发与构建 · 1.3

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
| release/1.3、release/video | 游戏发布附件、介绍视频成品；构建生成，不提交 Git |
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
npm run audit:gate
npm run build
npx playwright install chromium
npm run build:intro
npm run test:intro
npm run build:release
npm run test:browser
npm run test:player
npm run check:release
```

`build:intro` 会改写受版本控制的「口播稿.md」，须在 `build:release` 之前运行并一并提交，否则源码包与工作区不一致。

- `check`：lint、全部规则测试、TypeScript；JS 未全面启用 checkJs，不将此描述为全引擎类型认证。
- lint 基线只有 19 条原通用组件诊断，并锁定文件哈希；不允许扩大基线来掩盖新诊断。
- `test:browser`：项目内 Playwright 的 Chromium，两个离线变体分别运行十一组套件。`qa-release-1.2-browser.mjs` 保留历史名称并继续覆盖整卡点击、弹窗提示、小屏正文、练习靶位、连点和冲突重提示；五组 priority 回归继续覆盖后续显示、输入、设置与结算改进。运行对象为当前构建成品，结果不能由套件文件名推断版本。输出在 game/qa/release，可包含合成存档、截图和声音片段，不进源码包。
- Linux 可用 `npx playwright install --with-deps chromium` 安装系统依赖。需指定已安装 Chromium 时设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE`；默认不使用个人浏览器资料。
- 单组调试可执行 `node scripts/release-browser.mjs`；`QINGZHU_ASSET_PROFILE=png` 选择 PNG，`QINGZHU_HTML` 可指定待测文件。
- 普通打开不暴露调试接口；只有 `?test=1` 暴露 `window.__FANREN__`。测试中的合成完成或改位仅用于检查界面与保存，不作通关速度证据。

## 固定策略模拟

`npm run test:balance` 使用真实引擎和合法自动策略，不免伤、不发额外经验。支持 BATTLE_DIFFICULTY=0/1/2、BATTLE_SEED_PREFIX、BATTLE_SHARED_SEED=1、BATTLE_PATHS、BATTLE_VALIDATE_SAVES=1。输出默认写入 game/qa。自动策略胜负不是真人胜率；所有失败样本都保留。

## 发布产物

产物位置统一定义在 `scripts/delivery-paths.mjs`。游戏发布附件进入 `release/<游戏版本>/`，当前为 `release/1.3/`；根目录两个同名 HTML 保留直接游玩入口，与发布副本逐字节相同。`npm run build:intro` 将视频介绍 HTML、口播稿副本和录制说明写入 `release/video/`。

`build:release` 校验原图／编码哈希、嵌入文档、构建两份离线 HTML，恢复默认 WebP 配置，生成白名单源码 ZIP、免安装玩家 ZIP、SHA256SUMS.txt 与 release-manifest.json。玩家包包含直接运行的 HTML、PNG 兼容入口、先读我和对应源码；构建脚本不放在玩家入口目录。源码包固定 ZIP 时间戳并解压回读比对，不靠 Python 或系统 zip。开始时删除发布目录中旧的 SHA256SUMS.txt、release-manifest.json 与 github/，之后须重新执行 `prepare:github`。

`check:release` 要求两份 HTML、源码 ZIP、免安装玩家 ZIP 四个附件齐全，并与 manifest、SHA256SUMS 一致；根目录两份 HTML 与发布副本逐字节相同；源码 ZIP 与公开清单逐字节一致，存在 .git 时清单内文件必须已被 Git 跟踪；两份 HTML 内嵌的第三方许可须与 THIRD_PARTY_NOTICES.md 打包表及依赖清单 bundledInOffline 标记逐项一致；隐私扫描在通用规则之外，按本机仓库根、主目录、临时目录和用户名生成路径形态，覆盖源码、两份 HTML 与玩家包文本。`npm run test:player` 从实际玩家 ZIP 解压，在断网浏览器中核对两种入口。公开清单是 `scripts/release-files.mjs`，新增交付文件须同步它，新文件先 `git add`。

WebP 与 PNG 的离线画面应在浏览器中核对；半透明预乘通道可能有取整差异，不宣称逐像素完全相同。CI 验证技术行为，不能代替手机真机体验。GitHub Actions 在含空格和中文的检出目录 `qingzhu 青竹` 中运行完整流程（含 audit:gate、build:intro、test:intro），发布产物按 version.js 的版本命名上传。

依赖审计以 `npm run audit:gate` 为准：高危及以上一律失败，仅 `scripts/audit-gate.mjs` 中登记、上游尚未发布修复的公告放行；该包一旦发布不受影响的版本，门禁重新失败，须升级并移除登记。`offline-build/bundled-packages.json` 同时记录 Tailwind 编译进样式表的包与按来源包 shadcn 识别的组件源码副本，`docs:deps` 按锁文件路径标记 bundledInOffline。

## 跨平台兼容回归与 GitHub 附件

旧规则快照现在与 `scripts/fixtures/pre-balance4/` 中经哈希封存的独立旧引擎，在同一个 Node 运行时进行完整快照哈希对比。原 54 行归档与派生数值夹具保持；不靠跨 CPU／运行时的序列化哈希替代兼容性验证，不放宽数字容差或跳过用例。

发布 GitHub 前运行 `npm run prepare:github`，在 release/1.3/github/ 生成逐字节相同的英文附件及对应校验清单，避免平台把中文文件名改成下划线。当前状态见 [1.3 验收报告](release-1.3.md)；历史报告保留当时结果。
