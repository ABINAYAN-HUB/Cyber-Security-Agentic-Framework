// OpenClaw Cyber — FOFA Cyberspace Search Engine Tool
import config from '../config.js';
import { memory } from '../memory.js';

export const definition = {
  type: 'function',
  function: {
    name: 'fofa_search',
    description: 'Search FOFA cyberspace search engine for internet-connected assets. Query devices, services, domains, certs, protocols. Supports FOFA query syntax (e.g., domain="example.com", port="443", server="nginx", title="login", cert="Let\'s Encrypt").',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'FOFA search query (e.g., domain="example.com", port="443" && country="US", title="admin login", server="Apache")' },
        fields: { type: 'string', description: 'Comma-separated fields to return (default: ip,port,protocol,domain,host,title,server,country,city). Available: ip,port,domain,host,protocol,title,banner,server,os,country,city,cert' },
        size: { type: 'integer', description: 'Number of results to return (default: 50, max: 1000)' },
        full: { type: 'boolean', description: 'If true, return full data fields (requires VIP membership)' }
      },
      required: ['query']
    }
  }
};

export async function execute(args) {
  const { query, fields = 'ip,port,protocol,domain,host,title,server,country,city', size = 50, full = false } = args;
  const email = config.fofaEmail;
  const apiKey = config.fofaApiKey;

  if (!email || !apiKey) {
    return { 
      success: false, 
      error: 'FOFA credentials not configured. Set FOFA_EMAIL and FOFA_API_KEY in .env. Get your key at https://en.fofa.info/' 
    };
  }

  try {
    // FOFA requires base64-encoded query
    const queryBase64 = Buffer.from(query).toString('base64');
    const url = `https://fofa.info/api/v1/search/all?email=${encodeURIComponent(email)}&key=${apiKey}&qbase64=${queryBase64}&fields=${fields}&size=${Math.min(size, 1000)}&full=${full}`;

    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    
    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `FOFA API error (${response.status}): ${errText}` };
    }

    const data = await response.json();
    
    if (data.error) {
      return { success: false, error: `FOFA error: ${data.errmsg || data.error}` };
    }

    const fieldList = fields.split(',').map(f => f.trim());
    const results = (data.results || []).map(row => {
      const obj = {};
      fieldList.forEach((field, i) => {
        obj[field] = row[i] || null;
      });
      return obj;
    });

    // Store results in database
    try {
      memory.init();
      for (const r of results.slice(0, 200)) {
        memory.storeFofaResult(query, {
          ip: r.ip, port: r.port ? parseInt(r.port) : null,
          protocol: r.protocol, domain: r.domain, host: r.host,
          title: r.title, banner: r.banner, server: r.server,
          os: r.os, country: r.country, city: r.city,
          cert_subject: r.cert, raw: r
        });
      }
    } catch {}

    return {
      success: true,
      query,
      total: data.size || results.length,
      mode: data.mode || 'normal',
      results: results.slice(0, 100),
      note: results.length > 100 ? `Showing 100 of ${results.length} results. ${data.size} total matches in FOFA.` : undefined
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
