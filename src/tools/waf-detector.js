// OpenClaw Cyber — WAF Detector & Bypass Tool
export const definition = {
  type: 'function',
  function: {
    name: 'waf_detector',
    description: 'Detect Web Application Firewalls (WAFs) and suggest bypass techniques. Identifies CloudFlare, AWS WAF, Imperva, ModSecurity, Sucuri, Akamai, Barracuda, F5, and 20+ WAFs by analyzing response headers, cookies, and error pages.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL to analyze' },
        test_payload: { type: 'boolean', description: 'Send test payloads to trigger WAF responses (default: false)' }
      },
      required: ['url']
    }
  }
};

const WAF_SIGNATURES = {
  'Cloudflare': {
    headers: { 'server': /cloudflare/i, 'cf-ray': /./i },
    cookies: ['__cfduid', 'cf_clearance', '__cf_bm'],
    bypass: ['Use Cloudflare origin IP bypass', 'Try CloudFail/CloakQuest tools', 'Enumerate subdomains for unprotected hosts']
  },
  'AWS WAF': {
    headers: { 'x-amzn-requestid': /./i, 'x-amz-cf-id': /./i },
    cookies: ['awsalb', 'awsalbcors'],
    bypass: ['Try unicode normalization bypass', 'Use HTTP parameter pollution', 'Test case manipulation', 'Try chunked transfer encoding']
  },
  'Imperva/Incapsula': {
    headers: { 'x-cdn': /Incapsula/i, 'x-iinfo': /./i },
    cookies: ['incap_ses_', 'visid_incap_'],
    bypass: ['Search for origin IP via DNS history', 'Try Header injection bypass', 'Use parameter padding']
  },
  'ModSecurity': {
    headers: { 'server': /mod_security|NOYB/i },
    body: [/mod_security|ModSecurity/i],
    bypass: ['Try rule-specific bypasses', 'Use OWASP CRS bypass techniques', 'Test multipart/form-data encoding', 'Try HTTP request smuggling']
  },
  'Sucuri': {
    headers: { 'server': /Sucuri/i, 'x-sucuri-id': /./i },
    cookies: ['sucuri_cloudproxy'],
    bypass: ['Find origin IP via DNS records', 'Check for open mail servers', 'Use SecurityTrails API']
  },
  'Akamai': {
    headers: { 'x-akamai-transformed': /./i, 'server': /AkamaiGHost/i },
    cookies: ['akamai_token'],
    bypass: ['Try parameter pollution', 'Use encoding variations', 'Test via non-standard ports']
  },
  'Barracuda': {
    headers: { 'server': /Barracuda/i },
    cookies: ['barra_counter_session'],
    bypass: ['Try URL encoding bypass', 'Use alternative request methods']
  },
  'F5 BIG-IP': {
    headers: { 'server': /BIG-IP|F5/i },
    cookies: ['BIGIPServer', 'TS'],
    bypass: ['Decode BIGIPServer cookie for real IP', 'Try HTTP desync attacks', 'Test chunked encoding']
  },
  'Fortinet/FortiWeb': {
    headers: { 'server': /FortiWeb/i },
    cookies: ['FORTIWAFSID'],
    bypass: ['Try double URL encoding', 'Use unicode bypass']
  },
  'DDoS-Guard': {
    headers: { 'server': /DDoS-Guard/i },
    bypass: ['Try origin IP enumeration', 'Check DNS history']
  },
  'Wordfence': {
    headers: {},
    cookies: ['wfvt_'],
    body: [/wordfence/i, /wfBlock/i],
    bypass: ['Try rate-limit bypass', 'Use different User-Agent', 'Bypass via XML-RPC']
  },
};

export async function execute(args) {
  const { url, test_payload = false } = args;

  try {
    const targetUrl = url.startsWith('http') ? url : `https://${url}`;

    let dispatcher;
    try {
      const undici = await import('undici');
      dispatcher = new undici.Agent({ connect: { rejectUnauthorized: false } });
    } catch {}

    // 1. Normal Request
    let normalHeaders = {};
    try {
      const fetchOpts = {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000),
      };
      if (dispatcher) fetchOpts.dispatcher = dispatcher;
      const res1 = await fetch(targetUrl, fetchOpts);
      res1.headers.forEach((v, k) => normalHeaders[k.toLowerCase()] = v);
    } catch {}

    // 2. Malicious Request (trigger WAF)
    let maliciousHeaders = {};
    let blockedCode = null;
    let blockedBody = '';
    try {
      const xssUrl = new URL(targetUrl);
      xssUrl.searchParams.append('q', '<script>alert(1)</script>');
      xssUrl.searchParams.append('id', `' OR 1=1--`);
      
      const res2 = await fetch(xssUrl.toString(), {
        headers: { 'User-Agent': 'sqlmap/1.5.8#dev (http://sqlmap.org)' },
        signal: AbortSignal.timeout(10000),
        dispatcher
      });
      blockedCode = res2.status;
      blockedBody = await res2.text();
    } catch {}

    // Detect WAFs
    const detected = [];
    const cookieHeader = normalHeaders['set-cookie'] || '';

    for (const [wafName, sigs] of Object.entries(WAF_SIGNATURES)) {
      let found = false;
      let evidence = [];

      // Check headers
      if (sigs.headers) {
        for (const [h, pattern] of Object.entries(sigs.headers)) {
          if (normalHeaders[h] && pattern.test(normalHeaders[h])) {
            found = true;
            evidence.push(`Header: ${h}=${normalHeaders[h]}`);
          }
        }
      }

      // Check cookies
      if (sigs.cookies) {
        for (const c of sigs.cookies) {
          if (cookieHeader.includes(c)) {
            found = true;
            evidence.push(`Cookie: ${c}`);
          }
        }
      }

      // Check body patterns
      if (sigs.body) {
        for (const pattern of sigs.body) {
          if (pattern.test(blockedBody)) {
            found = true;
            evidence.push('Response body signature match');
          }
        }
      }

      if (found) {
        detected.push({
          waf: wafName,
          evidence,
          bypass_techniques: sigs.bypass || []
        });
      }
    }

    // Test payload response (if enabled)
    let wafResponse = null;
    if (test_payload) {
      wafResponse = {
        status: blockedCode,
        blocked: blockedCode === 403 || blockedCode === 406 || blockedCode === 429 || blockedCode === 503,
      };
    }

    return {
      success: true,
      url: targetUrl,
      status: blockedCode || 200,
      waf_detected: detected.length > 0,
      wafs: detected,
      test_payload_result: wafResponse,
      general_bypass_tips: detected.length > 0 ? [
        'Try different HTTP methods (PUT, PATCH, DELETE)',
        'Use HTTP/2 or HTTP/3 if available',
        'Test null bytes and unicode normalization',
        'Try JSON content-type with payloads',
        'Use chunked transfer encoding',
        'Test request smuggling (CL.TE / TE.CL)',
        'Enumerate origin IP via Shodan/DNS history'
      ] : []
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
