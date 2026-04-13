// Jarvis Cyber — Shodan Search Tool
import config from '../config.js';
import { networkErrorMessage } from './network-utils.js';

export const definition = {
  type: 'function',
  function: {
    name: 'shodan_search',
    description: 'Search Shodan for internet-connected devices, open ports, vulnerabilities, and services. Query by IP, hostname, or Shodan dork. Returns exposed services, banners, CVEs, and geolocation.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Shodan search query (e.g., "apache 2.4.49", "port:22 country:US", "vuln:CVE-2021-41773")' },
        ip: { type: 'string', description: 'Specific IP address to look up (alternative to query)' },
        type: { type: 'string', enum: ['search', 'host', 'exploits', 'dns'], description: 'Query type: search (general), host (IP lookup), exploits (exploit search), dns (DNS resolve)' }
      },
      required: ['query']
    }
  }
};

export async function execute(args) {
  const { query, ip, type = 'search' } = args;
  const apiKey = config.shodanApiKey;

  if (!apiKey) {
    return { success: false, error: 'SHODAN_API_KEY not configured in .env. Get one at https://account.shodan.io/' };
  }

  try {
    let url;
    if (type === 'host' && (ip || query)) {
      url = `https://api.shodan.io/shodan/host/${ip || query}?key=${apiKey}`;
    } else if (type === 'exploits') {
      url = `https://exploits.shodan.io/api/search?query=${encodeURIComponent(query)}&key=${apiKey}`;
    } else if (type === 'dns') {
      url = `https://api.shodan.io/dns/resolve?hostnames=${encodeURIComponent(query)}&key=${apiKey}`;
    } else {
      url = `https://api.shodan.io/shodan/host/search?query=${encodeURIComponent(query)}&key=${apiKey}`;
    }

    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    
    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Shodan API error (${response.status}): ${errText}` };
    }

    const data = await response.json();

    if (type === 'host') {
      return {
        success: true,
        ip: data.ip_str,
        organization: data.org,
        os: data.os,
        ports: data.ports,
        vulns: data.vulns || [],
        location: { country: data.country_name, city: data.city },
        services: (data.data || []).slice(0, 10).map(s => ({
          port: s.port,
          transport: s.transport,
          product: s.product,
          version: s.version,
          banner: s.data?.slice(0, 200)
        }))
      };
    }

    if (type === 'exploits') {
      return {
        success: true,
        total: data.total,
        exploits: (data.matches || []).slice(0, 15).map(e => ({
          id: e._id,
          description: e.description?.slice(0, 200),
          source: e.source,
          type: e.type,
          platform: e.platform
        }))
      };
    }

    // General search
    return {
      success: true,
      total: data.total,
      results: (data.matches || []).slice(0, 10).map(m => ({
        ip: m.ip_str,
        port: m.port,
        org: m.org,
        product: m.product,
        version: m.version,
        os: m.os,
        location: `${m.location?.country_name || ''} ${m.location?.city || ''}`.trim(),
        vulns: m.vulns || [],
        banner: m.data?.slice(0, 150)
      }))
    };
  } catch (err) {
    return { success: false, error: networkErrorMessage(err, 'Shodan search failed') };
  }
}
