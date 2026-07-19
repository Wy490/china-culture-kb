import type {
  SeedanceProviderFailureCategory,
  SeedanceShotProductionStatus,
} from '@shared/types.js';

export function normalizeSeedanceShotCallbackStatus(
  status: string | undefined,
  hasVideoUrl: boolean,
  hasFailureReason: boolean,
): SeedanceShotProductionStatus {
  const normalized = (status ?? '').trim().toLowerCase();
  if (['ready', 'completed', 'complete', 'succeeded', 'succeed', 'successed', 'success', 'done', 'finished'].includes(normalized)) {
    return 'ready';
  }
  if (['failed', 'failure', 'error', 'errored', 'cancelled', 'canceled'].includes(normalized)) {
    return 'failed';
  }
  if (['processing', 'running', 'generating', 'in_progress', 'in-progress'].includes(normalized)) {
    return 'processing';
  }
  if (['submitted', 'queued', 'queueing', 'pending', 'waiting', 'accepted', 'created', 'started'].includes(normalized)) {
    return 'submitted';
  }
  if (['skipped', 'skip'].includes(normalized)) {
    return 'skipped';
  }
  if (hasFailureReason) return 'failed';
  if (hasVideoUrl) return 'ready';
  return 'processing';
}

export function normalizeProviderFailureCategory(value: unknown): SeedanceProviderFailureCategory | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  const categories: SeedanceProviderFailureCategory[] = [
    'asset_missing',
    'prompt_invalid',
    'content_policy',
    'provider_timeout',
    'provider_quota',
    'provider_auth',
    'provider_rate_limit',
    'provider_server_error',
    'network_error',
    'unknown',
  ];
  return categories.includes(normalized as SeedanceProviderFailureCategory)
    ? normalized as SeedanceProviderFailureCategory
    : undefined;
}

const PROVIDER_ERROR_CODE_CATEGORY_PATTERNS: Array<{
  pattern: RegExp;
  category: SeedanceProviderFailureCategory;
}> = [
  {
    pattern: /(?:ASSET|MATERIAL|REFERENCE|RESOURCE|FILE|UPLOAD).*(?:MISSING|NOT_FOUND|NOTFOUND|FAILED|EXPIRED|INVALID)/,
    category: 'asset_missing',
  },
  {
    pattern: /(?:PROMPT|PARAM|PARAMETER|ARGUMENT|REQUEST|INPUT).*(?:INVALID|TOO_LONG|TOOLONG|BAD|ERROR)|BAD_REQUEST|INVALID_ARGUMENT|PARAMS_ERROR|INVALID_REQUEST/,
    category: 'prompt_invalid',
  },
  {
    pattern: /(?:POLICY|SAFETY|MODERATION|CONTENT|COPYRIGHT|CENSOR|AUDIT|RISK|NSFW).*(?:BLOCKED|REJECTED|FAILED|VIOLATION|DENIED)|SENSITIVE_CONTENT|RISK_CONTROL/,
    category: 'content_policy',
  },
  {
    pattern: /(?:TASK|JOB|PROVIDER|GENERATION).*(?:TIMEOUT|TIMED_OUT)|DEADLINE_EXCEEDED/,
    category: 'provider_timeout',
  },
  {
    pattern: /(?:QUOTA|BALANCE|BILLING|PAYMENT|CREDIT).*(?:EXCEEDED|INSUFFICIENT|REQUIRED|LOW|EMPTY)|INSUFFICIENT_BALANCE|NO_CREDIT|ACCOUNT_ARREARS/,
    category: 'provider_quota',
  },
  {
    pattern: /(?:AUTH|TOKEN|SIGNATURE|PERMISSION|CREDENTIAL|ACCESS).*(?:FAILED|INVALID|EXPIRED|DENIED|MISSING)|UNAUTHORIZED|FORBIDDEN|ACCESS_DENIED|INVALID_SIGNATURE/,
    category: 'provider_auth',
  },
  {
    pattern: /(?:RATE_LIMIT|RATELIMIT|TOO_MANY_REQUESTS|THROTTLED|THROTTLE|QPS|TPS|CONCURRENCY|429)/,
    category: 'provider_rate_limit',
  },
  {
    pattern: /(?:INTERNAL|SERVER|SERVICE|GATEWAY|SYSTEM|MODEL).*(?:ERROR|UNAVAILABLE|TIMEOUT|FAILED|BUSY)|HTTP_5\d\d|(?:^|_)5\d\d(?:_|$)/,
    category: 'provider_server_error',
  },
  {
    pattern: /(?:NETWORK|SOCKET|DNS|CONNECTION|ECONN|ETIMEDOUT).*(?:ERROR|FAILED|RESET|REFUSED|TIMEOUT)?/,
    category: 'network_error',
  },
];

function classifySeedanceProviderErrorCode(value?: string): SeedanceProviderFailureCategory | undefined {
  const normalized = value?.trim().toUpperCase().replace(/[\s.-]+/g, '_');
  if (!normalized) return undefined;
  return PROVIDER_ERROR_CODE_CATEGORY_PATTERNS.find(item => item.pattern.test(normalized))?.category;
}

export function classifySeedanceProviderFailure(input: {
  explicitCategory?: unknown;
  providerErrorCode?: string;
  failureReason?: string;
  message?: string;
}): SeedanceProviderFailureCategory | undefined {
  const explicit = normalizeProviderFailureCategory(input.explicitCategory);
  if (explicit) return explicit;
  const codeCategory = classifySeedanceProviderErrorCode(input.providerErrorCode);
  if (codeCategory) return codeCategory;
  const text = [input.providerErrorCode, input.failureReason, input.message]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!text.trim()) return undefined;
  if (/(asset|material|file|upload|reference|missing|not_found|not found|素材|文件|上传|缺失|缺少)/.test(text)) {
    return 'asset_missing';
  }
  if (/(prompt|parameter|invalid|bad_request|400|提示词|参数|格式|无效|过长|超长)/.test(text)) {
    return 'prompt_invalid';
  }
  if (/(policy|safety|moderation|copyright|sensitive|violation|违规|审核|安全|敏感|版权)/.test(text)) {
    return 'content_policy';
  }
  if (/(timeout|timed out|deadline|超时|等待过久)/.test(text)) {
    return 'provider_timeout';
  }
  if (/(quota|insufficient|balance|billing|payment|余额|额度|配额|欠费)/.test(text)) {
    return 'provider_quota';
  }
  if (/(auth|unauthorized|forbidden|401|403|token|permission|鉴权|认证|权限|令牌)/.test(text)) {
    return 'provider_auth';
  }
  if (/(rate|too_many|429|throttle|限流|频率|过多请求)/.test(text)) {
    return 'provider_rate_limit';
  }
  if (/(5\d\d|server|internal|unavailable|gateway|平台异常|服务异常|服务器|不可用)/.test(text)) {
    return 'provider_server_error';
  }
  if (/(network|socket|dns|connection|econn|网络|连接)/.test(text)) {
    return 'network_error';
  }
  return 'unknown';
}

export function seedanceShotStatusText(status: SeedanceShotProductionStatus): string {
  const map: Record<SeedanceShotProductionStatus, string> = {
    not_started: '未开始',
    prompt_exported: '待提交',
    submitted: '已提交',
    processing: '处理中',
    ready: '已完成',
    failed: '失败',
    skipped: '跳过',
  };
  return map[status];
}
