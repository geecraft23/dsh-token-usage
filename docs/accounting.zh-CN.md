# 统计口径与配置

## 统计口径

记录 DSH 公共 `llm/stream` 扩展点上的每次调用，包含同进程聊天、工具循环之后的请求、压缩及标题生成。一次请求的多次 `usage` 上报是累计快照，只保留最新值；不同重试请求分别计数。响应内容原样返回，不读取提示词、回答或密钥用于保存。

DSH 的 `inputTokens` 是**未缓存输入**。本插件展示的输入＝未缓存输入＋缓存读取＋缓存写入；总量＝输入＋输出。思考 token 已属于输出，不额外相加。输入会重复计算每次请求发送的历史上下文，这是累计请求用量，不是独立文本字数或当前上下文长度。

未返回 `usage` 的请求记为“未返回用量”，不虚构 tokenizer 估算。界面中的 token 数值是已知部分；取消和失败请求如已上报用量，仍保留这部分数值。崩溃或强制退出前没有结算的记录显示为“未结束”。模型服务本身没有上报的消耗无法恢复，因此本插件不是计费账单、供应商审计记录或订阅剩余额度。

**从插件启用后开始记录，不自动导入旧会话。** 新版 DSH 的会话格式与旧版不同；未来历史回填需要单独支持格式验证、来源归属和去重，避免与现场采集重复计算。重放／模拟插件如果通过同一 LLM 扩展点输出用量，也属于观测请求；测试应使用隔离的 `DSH_HOME`，不要写入正式账本。

“线下”按使用者定义的部署方式分类：本机、局域网、自建远程服务或租用 GPU 都可标记为线下。不能仅凭模型名、是否开源或 URL 是否为公网判断，因此默认是“未分类”。分类不表示零成本。

日期按请求开始时间归属，结束日期包含整天。每日分组采用浏览器当前的固定 UTC 偏移（页面有标注）；不是跨夏令时规则的历史时区换算。

## 数据与配置

默认账本位于 `$DSH_HOME/token-usage/usage.sqlite`；未设置 `DSH_HOME` 时是 `~/.dsh/token-usage/usage.sqlite`。重启、删除 DSH 会话、插件重载不会重置累计值。WAL 模式允许多个本机 DSH 进程共用文件；不要放到网络文件系统。备份时停止写入，或使用 SQLite 的备份工具。

账本保存请求 ID、时间、服务和模型 ID、会话 ID、调用用途、结果状态及 token 数字。它不保存对话正文、接口地址、API key 或 Cookie。调用过程中的账本写入失败不打断模型响应；后续写入会重试尚未保存的记录，页面显示写入异常提示。关闭进程前仍未保存的记录可能丢失。

可以在 Profile 的 `cordis.patch.yml` 配置存储位置和来源规则：

```yaml
- id: token-usage
  config:
    databasePath: /absolute/path/to/usage.sqlite
    busyTimeoutMs: 1000
    rules:
      - provider: deepseek
        source: online
      - provider: your-self-hosted-provider
        source: offline
```

规则使用精确 provider ID，可增加 `model` 只匹配一个模型。精确模型规则优先于 provider 规则，设置页保存的分类优先于规则。未知配置和不支持的账本版本会拒绝加载。

## 开发

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
pnpm pack --dry-run
```

测试覆盖计数口径、流式快照去重、重试、失败和取消、跨写入者持久化、历史分类变更、日期边界、原始响应保持，以及新版真实 LlmRuntime 扩展点和设置页面。Profile 安装和 tarball 运行属于另外的集成验证。

MIT License.
