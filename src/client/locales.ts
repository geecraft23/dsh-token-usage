/** Settings copy, owned by the plugin rather than the DSH shell. */
export const en = {
  nav: 'Token usage', title: 'Know where your tokens go', subtitle: 'Cumulative model requests across sessions on this DSH host.',
  week: '7 days', month: '30 days', allTime: 'All time', custom: 'Custom', from: 'From', to: 'Through',
  all: 'All sources', online: 'Online', offline: 'Offline', unclassified: 'Unclassified',
  total: 'Total tokens', input: 'Input', output: 'Generated', cached: 'Cache read', cacheWrite: 'Cache write',
  offlineOutput: 'Offline generated', onlineTotal: 'Online total',
  requests: 'Requests', reported: 'with usage', missing: 'without usage', open: 'unfinished', failed: 'failed / cancelled',
  trend: 'Daily token usage', models: 'By model', provider: 'Provider', model: 'Model', source: 'Source',
  refresh: 'Refresh', export: 'Export JSON', loading: 'Loading usage…', empty: 'No model requests in this period.',
  error: 'Unable to load usage. Check the DSH connection and try again.',
  saveError: 'Classification could not be saved. Try again.', storageError: 'Some ledger writes failed. These totals may be incomplete.',
  coverage: 'Data coverage', since: 'Tracking since', classifyHint: 'Classify a model service once. The label applies to its past and future requests.',
  accounting: 'Input includes uncached input plus cache reads and writes. Total = input + generated. Reasoning is part of generated tokens and is not added again.',
  scope: 'Only requests made while this plugin is active are recorded. This is reported usage, not an invoice or your remaining subscription quota.',
  missingHint: 'Unreported usage is unknown, not zero. Unfinished requests may include active streams or a process interrupted before settlement.',
  auxiliary: 'Includes conversation, compaction and title generation through this DSH process. External subagent processes need their own plugin installation.',
  unit: 'tokens', saved: 'Saved', retry: 'Retry', invalid: 'invalid usage reports', timezone: 'Date grouping',
  reasoning: 'Reasoning (included in output)', details: 'Accounting details',
}
export const zh: Record<keyof typeof en, string> = {
  nav: 'Token 用量', title: '每一份 Token，都有数', subtitle: '跨会话累计这台 DSH 主机的模型请求用量。',
  week: '近 7 天', month: '近 30 天', allTime: '全部时间', custom: '自选日期', from: '开始', to: '截至',
  all: '全部来源', online: '线上', offline: '线下', unclassified: '未分类',
  total: '累计 Token', input: '输入', output: '生成', cached: '缓存读取', cacheWrite: '缓存写入',
  offlineOutput: '线下累计生成', onlineTotal: '线上累计用量',
  requests: '次请求', reported: '已返回用量', missing: '未返回用量', open: '未结束', failed: '失败／取消',
  trend: '每日用量', models: '按模型统计', provider: '服务', model: '模型', source: '来源',
  refresh: '刷新', export: '导出 JSON', loading: '正在读取用量…', empty: '这个时间范围内还没有模型请求。',
  error: '无法读取用量，请检查 DSH 连接后重试。', saveError: '分类保存失败，请重试。',
  storageError: '部分账本写入失败，当前统计可能不完整。',
  coverage: '数据覆盖', since: '开始记录于', classifyHint: '给模型服务标记一次，分类会应用于它的历史与后续请求。',
  accounting: '输入包含未缓存输入、缓存读取和写入。总量＝输入＋生成。思考 token 属于生成量，不再重复相加。',
  scope: '只记录插件启用期间的请求。这是模型报告的用量，不是账单或订阅剩余额度。',
  missingHint: '未返回用量表示未知，不按零用量理解。未结束请求可能仍在生成，也可能在结束前进程被中断。',
  auxiliary: '包含本 DSH 进程的聊天、上下文压缩和标题生成。外部子代理进程需要另外安装本插件。',
  unit: 'tokens', saved: '已保存', retry: '重试', invalid: '用量格式异常', timezone: '日期分组时区',
  reasoning: '思考（已包含在生成量内）', details: '统计口径',
}
export type Translate = (key: keyof typeof en) => string

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'token-usage': keyof typeof en }
}
