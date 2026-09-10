# DSH Token Usage

[English](README.md) · 简体中文

**在 DSH 里看清每个模型用了多少 token，以及线下模型一共生成了多少。**

这是 DeepSeek Harness 的独立插件。在 **设置 → Token 用量** 中查看跨会话累计、每日趋势，以及按服务和模型划分的线上／线下用量。

![DSH Token 用量总览](https://raw.githubusercontent.com/geecraft23/dsh-token-usage/main/docs/images/overview.png)

> 截图使用隔离环境中的演示数据，展示产品功能，不代表真实模型推理结果。

## 安装

已验证 **DSH 0.1.5-rc.1 / Cordis 4.0.2**；Node.js `^22.19.0 || >=24.0.0`。其他 DSH 版本尚未验证。

```sh
dsh plugin --profile web add @geecraft23/dsh-token-usage@0.1.0
```

重启对应 DSH 进程，刷新页面，打开 **设置 → Token 用量**。不需要额外 API key 或数据库服务。等正在执行的任务结束后再重启。

使用 headless 或其他 Profile 时，替换 `web` 并分别安装。同一个 `DSH_HOME` 下默认共用账本。插件从启用后开始记录，不回填旧会话。

## 功能

- **按模型统计**：provider 与 model 联合分组，同名模型在不同服务下独立统计。
- **线上／线下分类**：在模型行手动选择，历史与后续记录一起更新；不能判断的服务保留为未分类。
- **线下生成累计**：单独显示线下输出 token，同时提供输入、缓存、思考和总用量。
- **趋势与导出**：近 7 天、30 天、全部、自选日期和来源筛选，支持 JSON 导出。
- **持久保存**：本地 SQLite；重启或删除会话不清空统计。可显示缺失上报、失败及未结束请求。

![仅查看线下模型](https://raw.githubusercontent.com/geecraft23/dsh-token-usage/main/docs/images/offline.png)

## 数字代表什么

输入 = 未缓存输入 + 缓存读取 + 缓存写入；总量 = 输入 + 输出。思考 token 已包含在输出中。重复发送的历史上下文按每次请求计数；流式累计上报不会重复相加。

没有返回 usage 的请求显示为缺失，不估算。页面显示已知用量，不是供应商账单或订阅剩余额度。线下可以表示本机、局域网、自建远程服务或租用 GPU，由用户定义；不根据模型名或 URL 猜测。

默认数据文件：`$DSH_HOME/token-usage/usage.sqlite`，未设置时使用 `~/.dsh/token-usage/usage.sqlite`。不保存提示词、回答、API key、Cookie 或接口地址。不同机器不自动同步。

详见 [统计口径、存储与配置](docs/accounting.zh-CN.md) 和 [验证说明](docs/validation.md)。

## 开发

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
pnpm run build
pnpm pack --dry-run
```

本地开发安装：`dsh plugin --profile web add link:/absolute/path/to/dsh-token-usage`。Host 或 Bundle 变更后重启 DSH。

卸载：`dsh plugin --profile web remove @geecraft23/dsh-token-usage`。账本会保留。

[MIT](LICENSE)
