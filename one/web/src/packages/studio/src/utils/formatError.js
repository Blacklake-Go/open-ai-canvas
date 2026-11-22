/**
 * Format API and studio error messages into clean, user-friendly strings.
 */

// 本站接口返回的错误体是 `{ error: '中文文案', code }`：`error` 是字符串而不是对象。
// 旧实现只认 detail / error.message / message，服务端为每种失败写好的可读文案因此
// 被整个丢弃，用户看到的是一句按状态码硬编码的英文。
function apiCopy(raw) {
  const start = raw.indexOf('{');
  if (start < 0) return null;
  const body = raw.slice(start);
  try {
    const data = JSON.parse(body);
    const candidates = [data.detail, data.error?.message, data.error, data.message];
    const copy = candidates.find((v) => typeof v === 'string' && v.trim());
    return copy ? copy.trim() : null;
  } catch {
    // 上游文案按字符截断时括号不全，仍然把 error/detail 的原文取出来
    const matched = body.match(/"(?:detail|error|message)"\s*:\s*"((?:[^"\\]|\\.)*)/);
    if (!matched) return null;
    try {
      return JSON.parse(`"${matched[1]}"`);
    } catch {
      return matched[1];
    }
  }
}

function clip(text) {
  return text.length > 150 ? text.slice(0, 147) + '...' : text;
}

export function formatErrorMessage(err, fallback = "Generation failed") {
  if (!err) return fallback;
  let message = typeof err === 'string' ? err : (err.message || fallback);

  const localized = apiCopy(message);
  if (localized) return clip(localized);

  // Handle common HTTP error codes
  if (message.includes('402') || message.includes('INSUFFICIENT_CREDITS') || message.toLowerCase().includes('insufficient credits')) {
    return "Insufficient credits. Please top up your wallet.";
  }
  if (message.includes('401') || message.includes('403')) {
    return "Authentication failed. Please check your account session or API key.";
  }
  if (message.includes('429')) {
    return "Too many requests. Please wait a moment and try again.";
  }

  // Strip technical prefix like "API Request Failed: 500 Internal Server Error -"
  message = message.replace(/^API Request Failed: \d+ [^-]+ - /, '');

  return message.length > 150 ? message.slice(0, 147) + '...' : message;
}
