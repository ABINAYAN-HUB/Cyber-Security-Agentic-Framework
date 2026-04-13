// Jarvis Cyber — WHOIS Lookup Tool
export const definition = {
  type: 'function',
  function: {
    name: 'whois_lookup',
    description: 'Perform WHOIS lookup on a domain or IP address. Returns registrar, creation date, expiry, nameservers, registrant info, and DNS records.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Domain name or IP address to look up (e.g., "example.com", "8.8.8.8")' }
      },
      required: ['target']
    }
  }
};

export async function execute(args) {
  const { target } = args;

  try {
    const whois = await import('whois-json');
    const result = await whois.default(target);
    
    return {
      success: true,
      target,
      data: result
    };
  } catch (err) {
    // Fallback to system whois
    try {
      const { execSync } = await import('child_process');
      const out = execSync(`whois "${target.replace(/"/g, '') }"`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 15000 });
      return { success: true, target, data: out, source: 'system_whois' };
    } catch (fallbackErr) {
      return { success: false, error: `WHOIS lookup failed (both library and system command): ${err.message || 'unknown error'} / ${fallbackErr.message || 'unknown error'}` };
    }
  }
}
