// Jarvis Cyber — Hash Identification & Cracking Tool
import { createHash } from 'crypto';

export const definition = {
  type: 'function',
  function: {
    name: 'hash_crack',
    description: 'Identify hash types and attempt to crack hashes using online rainbow table APIs. Supports MD5, SHA1, SHA256, SHA512, NTLM, bcrypt identification. Queries multiple online databases for plaintext matches.',
    parameters: {
      type: 'object',
      properties: {
        hash: { type: 'string', description: 'The hash value to identify/crack' },
        mode: { type: 'string', enum: ['identify', 'crack', 'both'], description: 'Mode: identify type only, crack only, or both (default: both)' }
      },
      required: ['hash']
    }
  }
};

const HASH_PATTERNS = [
  { name: 'MD5', regex: /^[a-f0-9]{32}$/i, hashcat: 0 },
  { name: 'SHA1', regex: /^[a-f0-9]{40}$/i, hashcat: 100 },
  { name: 'SHA224', regex: /^[a-f0-9]{56}$/i, hashcat: 1300 },
  { name: 'SHA256', regex: /^[a-f0-9]{64}$/i, hashcat: 1400 },
  { name: 'SHA384', regex: /^[a-f0-9]{96}$/i, hashcat: 10800 },
  { name: 'SHA512', regex: /^[a-f0-9]{128}$/i, hashcat: 1700 },
  { name: 'NTLM', regex: /^[a-f0-9]{32}$/i, hashcat: 1000 },
  { name: 'MySQL 4.1+', regex: /^\*[a-f0-9]{40}$/i, hashcat: 300 },
  { name: 'bcrypt', regex: /^\$2[aby]?\$\d{2}\$.{53}$/i, hashcat: 3200 },
  { name: 'MD5crypt', regex: /^\$1\$.{8}\$.{22}$/i, hashcat: 500 },
  { name: 'SHA512crypt', regex: /^\$6\$.{8,16}\$.{86}$/i, hashcat: 1800 },
  { name: 'SHA256crypt', regex: /^\$5\$.{8,16}\$.{43}$/i, hashcat: 7400 },
  { name: 'LM Hash', regex: /^[a-f0-9]{32}$/i, hashcat: 3000 },
  { name: 'Base64', regex: /^[A-Za-z0-9+/]+=*$/, hashcat: null },
];

export async function execute(args) {
  const { hash, mode = 'both' } = args;
  const result = { success: true, hash };

  // ─── Identify ───
  if (mode === 'identify' || mode === 'both') {
    const matches = HASH_PATTERNS.filter(p => p.regex.test(hash.trim()));
    result.possible_types = matches.map(m => ({
      type: m.name,
      hashcat_mode: m.hashcat,
    }));
  }

  // ─── Crack ───
  if (mode === 'crack' || mode === 'both') {
    const plaintext = await _attemptCrack(hash.trim());
    result.cracked = plaintext !== null;
    result.plaintext = plaintext;
    if (!plaintext) {
      result.crack_note = 'Not found in online rainbow tables. Use hashcat or john for offline cracking.';
    }
  }

  return result;
}

async function _attemptCrack(hash) {
  const apis = [
    // MD5 Decrypt
    { url: `https://md5decrypt.net/Api/api.php?hash=${hash}&hash_type=md5&email=decracker@email.com&code=free`, parse: 'text' },
    // Hashes.org (public)
    { url: `https://hashes.org/api.php?key=test&query=${hash}`, parse: 'json' },
    // nitrxgen
    { url: `https://www.nitrxgen.net/md5db/${hash}`, parse: 'text' },
  ];

  for (const api of apis) {
    try {
      const response = await fetch(api.url, {
        headers: { 'User-Agent': 'Jarvis-Cyber' },
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) continue;

      if (api.parse === 'text') {
        const text = await response.text();
        if (text && text.trim().length > 0 && text.trim().length < 100 && !text.includes('error') && !text.includes('NOT_FOUND')) {
          return text.trim();
        }
      } else {
        const data = await response.json();
        if (data.result || data.plaintext) {
          return data.result || data.plaintext;
        }
      }
    } catch {}
  }

  return null;
}
