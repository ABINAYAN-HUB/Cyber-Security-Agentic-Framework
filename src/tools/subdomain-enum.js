// OpenClaw Cyber — Subdomain Enumeration Tool
export const definition = {
  type: 'function',
  function: {
    name: 'subdomain_enum',
    description: 'Enumerate subdomains of a target domain using certificate transparency logs (crt.sh), DNS brute force, and web APIs. Discovers hidden attack surfaces.',
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Target domain (e.g., "example.com")' },
        method: { type: 'string', enum: ['all', 'crtsh', 'bruteforce', 'api'], description: 'Enumeration method (default: all)' }
      },
      required: ['domain']
    }
  }
};

const COMMON_SUBDOMAINS = [
  'www','mail','ftp','localhost','webmail','smtp','pop','ns1','ns2','blog','portal',
  'admin','dev','staging','test','api','app','m','mobile','vpn','cloud','git',
  'jenkins','jira','confluence','wiki','docs','support','help','status','monitor',
  'grafana','kibana','elastic','prometheus','sentry','gitlab','bitbucket','ci','cd',
  'cdn','static','assets','img','images','media','upload','files','backup','db',
  'database','mysql','postgres','redis','mongo','cache','queue','mq','rabbit',
  'exchange','owa','remote','rdp','ssh','proxy','gateway','firewall','dmz',
  'internal','intranet','extranet','corp','office','crm','erp','sap','hr',
  'staff','employee','partner','customer','client','vendor','shop','store',
  'pay','payment','billing','invoice','order','checkout','cart','catalog',
  'search','analytics','track','log','audit','security','sso','auth','login',
  'oauth','id','identity','ldap','ad','dns','ntp','snmp','syslog','debug'
];

export async function execute(args) {
  const { domain, method = 'all' } = args;
  const subdomains = new Set();

  // ─── Certificate Transparency (crt.sh) ───
  if (method === 'all' || method === 'crtsh') {
    try {
      const response = await fetch(`https://crt.sh/?q=%25.${domain}&output=json`, {
        signal: AbortSignal.timeout(30000)
      });
      if (response.ok) {
        const data = await response.json();
        for (const entry of data) {
          const names = (entry.name_value || '').split('\n');
          for (const name of names) {
            const clean = name.trim().replace(/^\*\./, '');
            if (clean.endsWith(domain) && clean !== domain) {
              subdomains.add(clean);
            }
          }
        }
      }
    } catch {}
  }

  // ─── DNS Brute Force ───
  if (method === 'all' || method === 'bruteforce') {
    const { Resolver } = await import('dns');
    const { promisify } = await import('util');
    const resolver = new Resolver();
    resolver.setServers(['8.8.8.8', '1.1.1.1']);
    const resolve4 = promisify(resolver.resolve4.bind(resolver));

    const batch = 20;
    for (let i = 0; i < COMMON_SUBDOMAINS.length; i += batch) {
      const chunk = COMMON_SUBDOMAINS.slice(i, i + batch);
      const results = await Promise.allSettled(
        chunk.map(sub => resolve4(`${sub}.${domain}`).then(ips => ({ sub, ips })))
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          subdomains.add(`${r.value.sub}.${domain}`);
        }
      }
    }
  }

  // ─── Web APIs ───
  if (method === 'all' || method === 'api') {
    // HackerTarget
    try {
      const response = await fetch(`https://api.hackertarget.com/hostsearch/?q=${domain}`, {
        signal: AbortSignal.timeout(15000)
      });
      if (response.ok) {
        const text = await response.text();
        if (text.includes('error') || text.includes('API count exceeded')) {
          // Rate-limited — skip silently, subfinder_enum handles this better
        } else {
          for (const line of text.split('\n')) {
            const [subdomain] = line.split(',');
            if (subdomain && subdomain.endsWith(domain)) {
              subdomains.add(subdomain.trim());
            }
          }
        }
      }
    } catch {}

    // RapidDNS
    try {
      const response = await fetch(`https://rapiddns.io/subdomain/${domain}?full=1`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(15000)
      });
      if (response.ok) {
        const html = await response.text();
        const matches = html.matchAll(/([a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}/g);
        for (const m of matches) {
          const found = m[0];
          if (found.endsWith(domain) && found !== domain) {
            subdomains.add(found);
          }
        }
      }
    } catch {}
  }

  const sorted = [...subdomains].sort();

  return {
    success: true,
    domain,
    total: sorted.length,
    subdomains: sorted,
    note: 'Use port_scanner or header_analysis on discovered subdomains for further enumeration.'
  };
}
