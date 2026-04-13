// Jarvis Cyber — Wayback Machine Tool
import { networkErrorMessage } from './network-utils.js';
export const definition = {
  type: 'function',
  function: {
    name: 'wayback_machine',
    description: 'Search the Wayback Machine (Internet Archive) for historical snapshots of a URL. Discover old pages, hidden endpoints, leaked credentials, or removed content that may reveal attack surfaces.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL or domain to search' },
        mode: { type: 'string', enum: ['snapshots', 'urls', 'latest'], description: 'Mode: snapshots (list captures), urls (find archived URLs for a domain), latest (get latest snapshot)' },
        limit: { type: 'integer', description: 'Max results (default: 20)' }
      },
      required: ['url']
    }
  }
};

export async function execute(args) {
  const { url, mode = 'urls', limit = 20 } = args;

  try {
    if (mode === 'latest') {
      const response = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();
      return { success: true, url, snapshot: data.archived_snapshots?.closest || null };
    }

    if (mode === 'snapshots') {
      const response = await fetch(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=${limit}&fl=timestamp,statuscode,mimetype,length`, {
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error(`CDX API error: ${response.status}`);
      const data = await response.json();
      const headers = data[0] || [];
      const snapshots = data.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = row[i]; });
        obj.view_url = `https://web.archive.org/web/${obj.timestamp}/${url}`;
        return obj;
      });
      return { success: true, url, total: snapshots.length, snapshots };
    }

    // URLs mode - find all archived URLs for a domain
    const domain = url.replace(/^https?:\/\//, '').split('/')[0];
    const response = await fetch(`https://web.archive.org/cdx/search/cdx?url=${domain}/*&output=json&limit=${limit}&fl=original,timestamp,statuscode&collapse=urlkey`, {
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`CDX API error: ${response.status}`);
    const data = await response.json();
    const headers = data[0] || [];
    const urls = data.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

    // Filter interesting URLs
    const interesting = urls.filter(u => {
      const orig = u.original || '';
      return /\.(php|asp|aspx|jsp|cgi|pl|py|rb|env|config|bak|sql|log|txt|xml|json|yml|yaml)/i.test(orig) ||
        /(admin|login|api|debug|test|staging|backup|secret|upload|internal|dashboard)/i.test(orig);
    });

    return {
      success: true,
      domain,
      total_urls: urls.length,
      interesting_urls: interesting.slice(0, limit),
      all_urls: urls.slice(0, limit),
      note: 'Interesting URLs are filtered for potentially sensitive paths. Use read_url on archive.org links to view historical content.'
    };
  } catch (err) {
    return { success: false, error: networkErrorMessage(err, 'Wayback Machine lookup failed') };
  }
}
