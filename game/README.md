# 青竹剑阵开发工程

游戏版本 **1.1**，篇名 **虚天殿篇**；制作人：bilibili@卡布奇诺ultra。

项目介绍、下载与开源声明见 [根 README](../README.md)。

- [开发与构建](../docs/development.md)
- [游玩说明](../青竹剑阵_游玩说明.md)
- [兼容规则](../docs/compatibility.md)
- [1.1 验收](../docs/release-1.1.md) · [1.0 验收](../docs/release-1.0.md)
- [维护约定](../AGENTS.md)

在本目录使用 `npm ci`，之后 `npm run dev`。`npm run build:release` 在 `../release/1.1/` 生成两种离线 HTML、对应源码包、免安装玩家包、交付清单及校验值；上一级目录两个 HTML 保留为原路径游玩入口。`npm run build:intro` 输出到 `../release/video/`。构建不发布到外部服务。
