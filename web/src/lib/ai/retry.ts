// 指数退避重试工具（PRD 兜底策略：AI 服务超时/失败重试）。
// 仅用于「建立连接 + 拿到可用响应」阶段——一旦开始向客户端吐字，就不再重试（避免重复输出）。

export interface RetryOptions {
  retries?: number; // 额外重试次数（不含首次），默认 2 → 共 3 次尝试
  baseDelayMs?: number; // 初始退避，默认 500ms
  maxDelayMs?: number; // 退避上限，默认 8000ms
  timeoutMs?: number; // 单次尝试超时，默认 30000ms
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void;
}

/** 标记「可重试」的错误：超时、网络错误、HTTP 5xx / 429。 */
export class RetryableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "RetryableError";
  }
}

/** 判断 HTTP 状态码是否值得重试。 */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// 退避 + 等量抖动：delay = min(max, base * 2^attempt) * (0.5 ~ 1.0)
function backoff(attempt: number, base: number, max: number): number {
  const exp = Math.min(max, base * 2 ** attempt);
  const jitter = 0.5 + Math.random() * 0.5;
  return Math.round(exp * jitter);
}

/**
 * 带超时执行一次 fn（fn 收到 AbortSignal，应将其传给 fetch）。
 * 超时会 abort 并抛出 RetryableError。
 */
export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parentSignal?: AbortSignal
): Promise<T> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  parentSignal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => ctrl.abort(new Error("timeout")), timeoutMs);
  try {
    return await fn(ctrl.signal);
  } catch (e) {
    // 父级主动取消（客户端断开）→ 原样抛出，不当作可重试
    if (parentSignal?.aborted) throw e;
    // 自身超时 → 可重试
    if (ctrl.signal.aborted) throw new RetryableError("请求超时", e);
    throw e;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onAbort);
  }
}

/**
 * 指数退避重试。fn 抛 RetryableError 才会重试；其他错误立即抛出。
 * parentSignal 中止（客户端断开）时不再重试。
 */
export async function retry<T>(
  fn: (signal: AbortSignal, attempt: number) => Promise<T>,
  opts: RetryOptions = {},
  parentSignal?: AbortSignal
): Promise<T> {
  const {
    retries = 2,
    baseDelayMs = 500,
    maxDelayMs = 8000,
    timeoutMs = 30000,
    onRetry,
  } = opts;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (parentSignal?.aborted) throw new Error("已取消");
    try {
      return await withTimeout((signal) => fn(signal, attempt), timeoutMs, parentSignal);
    } catch (e) {
      lastErr = e;
      const retryable = e instanceof RetryableError;
      const hasMore = attempt < retries;
      if (!retryable || !hasMore || parentSignal?.aborted) break;
      const delay = backoff(attempt, baseDelayMs, maxDelayMs);
      onRetry?.(attempt + 1, e, delay);
      await sleep(delay);
    }
  }
  throw lastErr;
}
