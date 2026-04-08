// OpenClaw Cyber — WHOIS Lookup Tool
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
    // Fallback to web API
    try {
      const response = await fetch(`https://whois.freeaitools.org/api/v1/whois?domain=${encodeURIComponent(target)}`, {
        signal: AbortSignal.timeout(15000)
      });
      if (response.ok) {
        const data = await response.json();
        return { success: true, target, data, source: 'freeaitools' };
      }
    } catch {}

    return { success: false, error: `WHOIS lookup failed: ${err.message}` };
  }
}
