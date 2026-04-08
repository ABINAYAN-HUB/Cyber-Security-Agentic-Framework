// OpenClaw Cyber — HTTP Security Header Analysis
export const definition = {
  type: 'function',
  function: {
    name: 'header_analysis',
    description: 'Analyze HTTP security headers of a target URL. Checks for CSP, HSTS, X-Frame-Options, CORS, cookie security, server info leakage, and rates overall security posture. Identifies misconfigurations exploitable for XSS, clickjacking, MIME sniffing attacks.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Target URL to analyze (e.g., "https://example.com")' }
      },
      required: ['url']
    }
  }
};

const SECURITY_HEADERS = {
  'strict-transport-security': { importance: 'HIGH', description: 'HSTS — Prevents SSL stripping' },
  'content-security-policy': { importance: 'HIGH', description: 'CSP — Prevents XSS and injection' },
  'x-frame-options': { importance: 'MEDIUM', description: 'Clickjacking protection' },
  'x-content-type-options': { importance: 'MEDIUM', description: 'MIME sniffing protection' },
  'x-xss-protection': { importance: 'LOW', description: 'Legacy XSS protection' },
  'referrer-policy': { importance: 'MEDIUM', description: 'Controls referrer information' },
  'permissions-policy': { importance: 'MEDIUM', description: 'Controls browser features (camera, mic, etc.)' },
  'cross-origin-opener-policy': { importance: 'MEDIUM', description: 'Cross-origin isolation' },
  'cross-origin-resource-policy': { importance: 'MEDIUM', description: 'Cross-origin resource sharing' },
  'cross-origin-embedder-policy': { importance: 'MEDIUM', description: 'Cross-origin embedding' },
  'x-permitted-cross-domain-policies': { importance: 'LOW', description: 'Flash/PDF cross-domain' },
  'expect-ct': { importance: 'LOW', description: 'Certificate Transparency' },
};

const INFO_LEAK_HEADERS = ['server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator'];

export async function execute(args) {
  const { url } = args;

  try {
    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    let dispatcher;
    try {
      const undici = await import('undici');
      dispatcher = new undici.Agent({ connect: { rejectUnauthorized: false } });
    } catch {}

    const fetchOpts = {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    };
    if (dispatcher) fetchOpts.dispatcher = dispatcher;
    const response = await fetch(targetUrl, fetchOpts);

    const headers = {};
    response.headers.forEach((value, key) => { headers[key.toLowerCase()] = value; });

    // Check security headers
    const present = [];
    const missing = [];
    const analysis = {};

    for (const [header, info] of Object.entries(SECURITY_HEADERS)) {
      if (headers[header]) {
        present.push({ header, value: headers[header], ...info });
        
        // Deep analysis
        if (header === 'content-security-policy') {
          analysis.csp = _analyzeCSP(headers[header]);
        }
        if (header === 'strict-transport-security') {
          analysis.hsts = _analyzeHSTS(headers[header]);
        }
      } else {
        missing.push({ header, ...info });
      }
    }

    // Check info leakage
    const leaks = [];
    for (const header of INFO_LEAK_HEADERS) {
      if (headers[header]) {
        leaks.push({ header, value: headers[header] });
      }
    }

    // Cookie analysis
    const cookies = [];
    const setCookie = headers['set-cookie'];
    if (setCookie) {
      const flags = {
        httpOnly: /httponly/i.test(setCookie),
        secure: /secure/i.test(setCookie),
        sameSite: /samesite/i.test(setCookie),
      };
      cookies.push({ raw: setCookie.slice(0, 200), flags });
    }

    // Score
    const score = Math.round((present.length / Object.keys(SECURITY_HEADERS).length) * 100);
    let grade;
    if (score >= 80) grade = 'A';
    else if (score >= 60) grade = 'B';
    else if (score >= 40) grade = 'C';
    else if (score >= 20) grade = 'D';
    else grade = 'F';

    return {
      success: true,
      url: targetUrl,
      status: response.status,
      grade,
      score: `${score}%`,
      headers_present: present,
      headers_missing: missing,
      information_leakage: leaks,
      cookies,
      analysis,
      all_headers: headers
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function _analyzeCSP(csp) {
  const issues = [];
  if (csp.includes("'unsafe-inline'")) issues.push("UNSAFE: 'unsafe-inline' allows inline scripts (XSS risk)");
  if (csp.includes("'unsafe-eval'")) issues.push("UNSAFE: 'unsafe-eval' allows eval() (code injection risk)");
  if (csp.includes('*')) issues.push("WEAK: Wildcard (*) source allows any origin");
  if (!csp.includes('default-src')) issues.push("MISSING: No default-src directive");
  if (!csp.includes('script-src')) issues.push("MISSING: No script-src directive");
  return { raw: csp.slice(0, 500), issues: issues.length > 0 ? issues : ['CSP looks properly configured'] };
}

function _analyzeHSTS(hsts) {
  const issues = [];
  const maxAgeMatch = hsts.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 0;
  if (maxAge < 31536000) issues.push(`WEAK: max-age=${maxAge} (should be >= 31536000 / 1 year)`);
  if (!hsts.includes('includeSubDomains')) issues.push('MISSING: includeSubDomains not set');
  if (!hsts.includes('preload')) issues.push('MISSING: preload not set');
  return { maxAge, includeSubDomains: hsts.includes('includeSubDomains'), preload: hsts.includes('preload'), issues };
}
