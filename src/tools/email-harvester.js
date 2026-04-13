// Jarvis Cyber — Email Harvester
import { networkErrorMessage } from './network-utils.js';
export const definition = {
  type: 'function',
  function: {
    name: 'email_harvester',
    description: 'Harvest email addresses associated with a domain from search engines, web pages, and public sources. Useful for OSINT and social engineering reconnaissance.',
    parameters: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Target domain (e.g., "example.com")' },
        sources: { type: 'string', enum: ['all', 'web', 'search'], description: 'Sources to search (default: all)' }
      },
      required: ['domain']
    }
  }
};

export async function execute(args) {
  const { domain, sources = 'all' } = args;
  const emails = new Set();

  // ─── Search Engine Scraping ───
  if (sources === 'all' || sources === 'search') {
    const queries = [
      `"@${domain}" email`,
      `site:${domain} email contact`,
      `"${domain}" filetype:pdf`,
    ];

    for (const query of queries) {
      try {
        const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(10000)
        });
        if (response.ok) {
          const html = await response.text();
          _extractEmails(html, domain, emails);
        }
      } catch {}
    }
  }

  // ─── Direct Web Scraping ───
  if (sources === 'all' || sources === 'web') {
    const pages = [`https://${domain}`, `https://${domain}/contact`, `https://${domain}/about`, `https://${domain}/team`];
    for (const page of pages) {
      try {
        const response = await fetch(page, {
          headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' },
          redirect: 'follow',
          signal: AbortSignal.timeout(8000)
        });
        if (response.ok) {
          const html = await response.text();
          _extractEmails(html, domain, emails);
        }
      } catch {}
    }
  }

  // ─── Hunter.io API (only if key is configured) ───
  const hunterApiKey = process.env.HUNTER_API_KEY || '';
  if (hunterApiKey) {
  try {
    const response = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${encodeURIComponent(hunterApiKey)}&limit=10`, {
      signal: AbortSignal.timeout(10000)
    });
    if (response.ok) {
      const data = await response.json();
      if (data.data?.emails) {
        for (const e of data.data.emails) {
          emails.add(e.value);
        }
      }
    }
  } catch {}
  } // end if hunterApiKey

  const sorted = [...emails].sort();

  return {
    success: true,
    domain,
    total: sorted.length,
    emails: sorted,
    patterns: _detectPatterns(sorted),
    note: sorted.length === 0 ? 'No emails found. Try using stealth_browser for JavaScript-rendered pages.' : undefined
  };
}

function _extractEmails(text, domain, emailSet) {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  for (const email of matches) {
    if (email.toLowerCase().endsWith(`@${domain.toLowerCase()}`)) {
      emailSet.add(email.toLowerCase());
    }
  }
}

function _detectPatterns(emails) {
  if (emails.length < 2) return [];
  const patterns = new Set();
  for (const email of emails) {
    const local = email.split('@')[0];
    if (local.includes('.')) patterns.add('firstname.lastname');
    if (/^[a-z]{1}\.[a-z]+$/i.test(local)) patterns.add('f.lastname');
    if (/^[a-z]+[0-9]+$/i.test(local)) patterns.add('name+numbers');
    if (/^[a-z]+_[a-z]+$/i.test(local)) patterns.add('name_name');
  }
  return [...patterns];
}
