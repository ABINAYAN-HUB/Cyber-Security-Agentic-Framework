// Jarvis Cyber — Hash Generator Tool
import { createHash, createHmac, randomBytes, scryptSync } from 'crypto';

export const definition = {
  type: 'function',
  function: {
    name: 'hash_generate',
    description: 'Generate cryptographic hashes. Supports MD5, SHA1, SHA256, SHA512, HMAC, and bcrypt-style hashes. Useful for creating password hashes, file checksums, or payload signatures.',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'The text to hash' },
        algorithm: { type: 'string', enum: ['md5', 'sha1', 'sha256', 'sha512', 'all'], description: 'Hash algorithm (default: all)' },
        hmac_key: { type: 'string', description: 'Optional HMAC key for keyed hashing' }
      },
      required: ['input']
    }
  }
};

export async function execute(args) {
  const { input, algorithm = 'all', hmac_key } = args;
  const result = { success: true, input: input.length > 50 ? input.slice(0, 50) + '...' : input };

  const algos = algorithm === 'all' ? ['md5', 'sha1', 'sha256', 'sha512'] : [algorithm];

  result.hashes = {};
  for (const algo of algos) {
    if (hmac_key) {
      result.hashes[`hmac_${algo}`] = createHmac(algo, hmac_key).update(input).digest('hex');
    } else {
      result.hashes[algo] = createHash(algo).update(input).digest('hex');
    }
  }

  // Also generate a scrypt hash (useful for password storage)
  if (algorithm === 'all') {
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(input, salt, 64).toString('hex');
    result.hashes.scrypt = `${salt}:${derived}`;
  }

  return result;
}
