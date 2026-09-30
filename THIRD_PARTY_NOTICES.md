# 第三方代码与许可证

青竹剑阵 1.1 的原创程序代码使用 GPL-3.0-only。第三方组件保留原许可证与版权；此清单不将第三方作品改授为作者独有代码。

## 离线成品实际打包的依赖

以下列表由 Vite 输出模块追踪得到；打包器 Rolldown 写入成品的模块运行时辅助代码也一并列出。每份 HTML 同时内嵌实际依赖的完整许可原文，可从“开源许可与源码”阅读。

| 依赖 | 版本 | 原许可 | 声明原文 |
|---|---|---|---|
| react | 19.2.8 | MIT | [许可](docs/licenses/da6d3703ed11cbe4.txt) |
| scheduler | 0.27.0 | MIT | [许可](docs/licenses/da6d3703ed11cbe4.txt) |
| react-dom | 19.2.8 | MIT | [许可](docs/licenses/da6d3703ed11cbe4.txt) |
| @floating-ui/utils | 0.2.12 | MIT | [许可](docs/licenses/0e4c9a9b6c71019c.txt) |
| @base-ui/utils | 0.3.2 | MIT | [许可](docs/licenses/07fc1b39d69d14bc.txt) |
| @base-ui/react | 1.7.0 | MIT | [许可](docs/licenses/07fc1b39d69d14bc.txt) |
| clsx | 2.1.1 | MIT | [许可](docs/licenses/9a9edad7baae5262.txt) |
| class-variance-authority | 0.7.1 | Apache-2.0 | [许可](docs/licenses/0ccbf956cffc8dcf.txt) |
| tailwind-merge | 3.6.0 | MIT | [许可](docs/licenses/d4c70c7ce38cea87.txt) |
| use-sync-external-store | 1.6.0 | MIT | [许可](docs/licenses/da6d3703ed11cbe4.txt) |
| lucide-react | 1.31.0 | ISC | [许可](docs/licenses/b495047bd93a9b06.txt) |
| rolldown（运行时辅助代码） | 1.2.8 | MIT | [许可](docs/licenses/23ecfff35a5a2e80.txt) |

## 开发与构建依赖

完整锁定依赖的版本、来源、校验值与许可见 [依赖清单](docs/dependency-inventory.json)。仅当前平台安装的依赖附有本地许可证原文，其余平台可选依赖保留 registry 下载地址与 integrity。依赖二进制和 node_modules 不随源码 ZIP 交付。

实际离线程序依赖分别使用 MIT、Apache-2.0 或 ISC 许可。开发链另外使用 ISC、BSD、MPL-2.0、LGPL-3.0-or-later 等组件；它们是安装时获取的未修改工具或间接依赖，不随离线 HTML 分发。未对开发依赖作一概重新授权。

基础界面组件来自 shadcn/ui 生态，沿用其 MIT 许可；项目定制游戏代码由作者按 GPL-3.0-only 发布。第三方图标来自 Lucide，保留 ISC 许可。素材和小说 IP 另见 [素材说明](docs/assets.md)。

构建时如新增运行时依赖且缺少许可原文会失败。更新依赖后，维护者须重新核对本清单、运行时打包列表及许可原文，再发布对应源码。
