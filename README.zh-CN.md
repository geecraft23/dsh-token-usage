# DSH Token Usage

[English](README.md) · 简体中文

**看清每个模型的输入与输出，分开统计本地和云端用量。**

这是 DeepSeek Harness 的独立插件。在 **设置 → Token 用量** 中查看跨会话累计、Token 活动，以及按模型和部署位置划分的用量。

![Token 活动及输入输出总览](https://raw.githubusercontent.com/geecraft23/dsh-token-usage/main/docs/images/overview.png)

> 截图使用隔离 DSH 环境中的演示数据，展示产品功能，不代表真实模型推理结果。

## 安装

已验证 **DSH 0.1.5-rc.1 / Cordis 4.0.2**；Node.js `^22.19.0 || >=24.0.0`。其他 DSH 版本尚未验证。

```sh
dsh plugin --profile web add @geecraft23/dsh-token-usage@0.2.0
```

重启对应 DSH 进程，刷新页面，打开 **设置 → Token 用量**。不需要额外 API key 或数据库服务。等正在执行的任务结束后再重启。

使用 headless 或其他 Profile 时，替换 `web` 并分别安装。同一个 `DSH_HOME` 下默认共用账本。插件从启用后开始记录，不回填旧会话。

## 0.2 升级

**部署位置和输入／输出是两个独立维度。** 先选「全部／本地／云端」，再用同一口径查看总量、输入和输出。新版加入活动热力图、每周和累计视图、单日峰值、活跃天数及最长连续活跃天数；支持筛选具体的服务＋模型组合并导出。

历史记录与已保存的分类继续保留，无需迁移账本。新配置和 JSON 导出使用 `local` / `cloud`，导出格式为 `formatVersion: 2`。旧配置的升级方式见[配置兼容](docs/accounting.zh-CN.md#配置兼容)。

## 功能

- **按模型统计**：provider 与 model 联合分组，同名模型在不同服务下独立统计。
- **云端／本地分类**：在模型行手动选择，历史与后续记录一起更新；不能判断的服务保留为未分类。
- **统一口径对比**：本地和云端均提供输入、输出和总量，部署位置与 Token 方向独立筛选。
- **活动图置顶**：默认近 90 天，可选近 30 天、全部时间和自选日期。每天一个柔和圆角色块；浅灰表示没有请求记录，四档蓝色按所选范围的用量峰值逐级加深。
- **数字更易读**：默认用 K，达到百万用 M、十亿用 B。悬停查看完整数字，JSON 导出保留精确整数。
- **趋势与导出**：每日、每周和累计视图；按部署位置和模型独立筛选，再导出当前结果。
- **持久保存**：本地 SQLite；重启或删除会话不清空统计。可显示缺失上报、失败及未结束请求。

![仅查看本地模型](https://raw.githubusercontent.com/geecraft23/dsh-token-usage/main/docs/images/local.png)

## 本地／云端与输入／输出

这两组分类互不替代：本地和云端都有输入、输出与总量。

| 部署位置 | 输入 | 输出 | 总量 |
| --- | --- | --- | --- |
| 本地 | 发送给自行管理模型的 Token | 这些模型返回的 Token | 输入＋输出 |
| 云端 | 发送给托管模型服务的 Token | 这些服务返回的 Token | 输入＋输出 |

活动图跟随时间、部署位置、模型和 Token 指标筛选。全部时间与自选日期的活动图最多展示 366 天，总量与趋势覆盖完整筛选范围。插件启用前的日期没有记录；已发生请求但未返回用量的日期仍显示为有活动，不估算未知 Token 数量。

## 数字代表什么

输入 = 未缓存输入 + 缓存读取 + 缓存写入；总量 = 输入 + 输出。思考 token 已包含在输出中。重复发送的历史上下文按每次请求计数；流式累计上报不会重复相加。

没有返回 usage 的请求显示为缺失，不估算。页面显示已知用量，不是供应商账单或订阅剩余额度。本地可以表示本机、局域网、自建远程服务或租用 GPU，由用户定义；不根据模型名或 URL 猜测。

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
