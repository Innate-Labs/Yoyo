// 重试逻辑单元测试（离线、确定性）。用法：npx tsx scripts/smoke-retry.ts
import { retry, RetryableError, isRetryableStatus, withTimeout } from "../src/lib/ai/retry";

let pass = 0, fail = 0;
function check(label: string, ok: boolean, extra = "") {
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : "  " + extra}`);
}

(async () => {
  // 1. 可重试状态码判断
  check("429 可重试", isRetryableStatus(429));
  check("500 可重试", isRetryableStatus(500));
  check("503 可重试", isRetryableStatus(503));
  check("408 可重试", isRetryableStatus(408));
  check("400 不重试", !isRetryableStatus(400));
  check("401 不重试", !isRetryableStatus(401));
  check("404 不重试", !isRetryableStatus(404));

  // 2. RetryableError 会重试，最终成功
  {
    let calls = 0;
    const r = await retry(
      async () => {
        calls++;
        if (calls < 3) throw new RetryableError("暂时失败");
        return "ok";
      },
      { retries: 2, baseDelayMs: 5, timeoutMs: 1000 }
    );
    check("重试后成功（第3次）", r === "ok" && calls === 3, `calls=${calls}`);
  }

  // 3. 非可重试错误：立即抛出，不重试
  {
    let calls = 0;
    let threw = false;
    try {
      await retry(
        async () => {
          calls++;
          throw new Error("鉴权失败"); // 普通 Error，不可重试
        },
        { retries: 3, baseDelayMs: 5, timeoutMs: 1000 }
      );
    } catch {
      threw = true;
    }
    check("非可重试错误不重试", threw && calls === 1, `calls=${calls}`);
  }

  // 4. 超过重试上限：抛出最后的错误
  {
    let calls = 0;
    let threw = false;
    try {
      await retry(
        async () => {
          calls++;
          throw new RetryableError("一直失败");
        },
        { retries: 2, baseDelayMs: 5, timeoutMs: 1000 }
      );
    } catch (e) {
      threw = true;
      check("超上限抛 RetryableError", e instanceof RetryableError);
    }
    check("超上限共尝试 3 次（1+2）", threw && calls === 3, `calls=${calls}`);
  }

  // 5. 超时会被判定为可重试
  {
    let calls = 0;
    let threw = false;
    try {
      await retry(
        async (signal) => {
          calls++;
          // 永不 resolve，触发超时
          await new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("aborted"))));
        },
        { retries: 1, baseDelayMs: 5, timeoutMs: 30 }
      );
    } catch {
      threw = true;
    }
    check("超时触发重试（共2次）", threw && calls === 2, `calls=${calls}`);
  }

  // 6. 父级 abort（客户端断开）→ 不再重试
  {
    let calls = 0;
    const ctrl = new AbortController();
    let threw = false;
    try {
      await retry(
        async () => {
          calls++;
          ctrl.abort(); // 第一次就模拟客户端断开
          throw new RetryableError("失败但已断开");
        },
        { retries: 3, baseDelayMs: 5, timeoutMs: 1000 },
        ctrl.signal
      );
    } catch {
      threw = true;
    }
    check("客户端断开后不重试", threw && calls === 1, `calls=${calls}`);
  }

  // 7. withTimeout：正常返回不受影响
  {
    const v = await withTimeout(async () => "quick", 1000);
    check("withTimeout 正常返回", v === "quick");
  }

  console.log(`\n通过 ${pass}，失败 ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})();
