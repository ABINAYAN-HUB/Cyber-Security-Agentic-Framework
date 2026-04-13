// Jarvis Cyber — Shared network error utility for all tools
// Provides actionable diagnostic messages for common network failures

/**
 * Wraps a raw error message with actionable diagnostic hints.
 * Used by all network-dependent tools to turn generic "fetch failed"
 * errors into something the agent can act on.
 */
export function networkErrorMessage(err, context = '') {
  let msg = err?.message || String(err);
  if (err?.cause) {
    msg += ` (Cause: ${err.cause.code || err.cause.message || String(err.cause)})`;
  }
  const prefix = context ? `${context}: ` : '';

  if (msg.includes('ENOTFOUND')) {
    return `${prefix}DNS resolution failed — ${msg}. Check internet connection or DNS settings.`;
  }
  if (msg.includes('ECONNREFUSED')) {
    return `${prefix}Connection refused — ${msg}. Target server may be down or port is blocked.`;
  }
  if (msg.includes('ETIMEDOUT') || msg.includes('UND_ERR_CONNECT_TIMEOUT') || msg.includes('TimeoutError')) {
    return `${prefix}Connection timed out — ${msg}. Server unreachable or network too slow.`;
  }
  if (msg.includes('ECONNRESET')) {
    return `${prefix}Connection reset — ${msg}. Server dropped the connection.`;
  }
  if (msg.includes('CERT_HAS_EXPIRED') || msg.includes('UNABLE_TO_VERIFY')) {
    return `${prefix}SSL/TLS certificate error — ${msg}.`;
  }
  if (msg.includes('fetch failed')) {
    return `${prefix}Network request failed — ${msg}. (Hint: Likely a local network outage. Verify connectivity with ping 8.8.8.8)`;
  }
  if (msg.includes('AbortError') || msg.includes('abort')) {
    return `${prefix}Request timed out (aborted) — ${msg}.`;
  }
  return `${prefix}${msg}`;
}
