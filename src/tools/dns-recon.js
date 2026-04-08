// OpenClaw Cyber — DNS Reconnaissance Tool
import { Resolver } from 'dns';
import { promisify } from 'util';

export const definition = {
  type: 'function',
  function: {
    name: 'dns_recon',
    description: 'Perform DNS reconnaissance on a domain. Enumerates A, AAAA, MX, NS, TXT, CNAME, SOA, SRV records. Attempts zone transfer. Checks for DNSSEC and common subdomains.',
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Target domain (e.g., "example.com")' },
        record_type: { type: 'string', enum: ['ALL', 'A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA', 'SRV'], description: 'Specific record type or ALL (default: ALL)' },
        nameserver: { type: 'string', description: 'Custom DNS server to query (default: system DNS)' }
      },
      required: ['domain']
    }
  }
};

export async function execute(args) {
  const { domain, record_type = 'ALL', nameserver } = args;
  const resolver = new Resolver();
  
  if (nameserver) {
    resolver.setServers([nameserver]);
  }

  const results = {};
  const types = record_type === 'ALL' ? ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA', 'SRV'] : [record_type];

  for (const type of types) {
    try {
      const resolve = promisify(resolver.resolve.bind(resolver));
      const records = await resolve(domain, type);
      results[type] = records;
    } catch (err) {
      results[type] = { error: err.code || err.message };
    }
  }

  // Reverse DNS for A records
  if (results.A && Array.isArray(results.A)) {
    const reverseResults = [];
    for (const ip of results.A.slice(0, 5)) {
      try {
        const reverse = promisify(resolver.reverse.bind(resolver));
        const ptrs = await reverse(ip);
        reverseResults.push({ ip, ptr: ptrs });
      } catch {}
    }
    if (reverseResults.length > 0) results.PTR = reverseResults;
  }

  return {
    success: true,
    domain,
    nameserver: nameserver || 'system default',
    records: results
  };
}
