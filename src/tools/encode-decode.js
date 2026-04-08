// OpenClaw Cyber — Encoder/Decoder Tool
export const definition = {
  type: 'function',
  function: {
    name: 'encode_decode',
    description: 'Encode or decode data in various formats: Base64, Hex, URL encoding, ROT13, HTML entities, Binary, ASCII, XOR, and JWT decoding. Essential for payload preparation and data analysis.',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'The text to encode/decode' },
        operation: { type: 'string', enum: ['encode', 'decode'], description: 'Encode or decode' },
        format: { type: 'string', enum: ['base64', 'hex', 'url', 'rot13', 'html', 'binary', 'ascii', 'xor', 'jwt', 'all'], description: 'Format (default: all for encode)' },
        xor_key: { type: 'string', description: 'XOR key (for xor format)' }
      },
      required: ['input']
    }
  }
};

export async function execute(args) {
  const { input, operation = 'encode', format = 'all', xor_key = 'key' } = args;
  const results = {};

  const formats = format === 'all' ? ['base64', 'hex', 'url', 'rot13', 'html', 'binary'] : [format];

  for (const fmt of formats) {
    try {
      if (operation === 'encode') {
        results[fmt] = _encode(input, fmt, xor_key);
      } else {
        results[fmt] = _decode(input, fmt, xor_key);
      }
    } catch (err) {
      results[fmt] = { error: err.message };
    }
  }

  // JWT decode (always decode mode)
  if (format === 'jwt' || format === 'all') {
    try {
      results.jwt = _decodeJWT(input);
    } catch (err) {
      if (format === 'jwt') results.jwt = { error: err.message };
    }
  }

  return { success: true, operation, input: input.length > 100 ? input.slice(0, 100) + '...' : input, results };
}

function _encode(input, format, xorKey) {
  switch (format) {
    case 'base64': return Buffer.from(input).toString('base64');
    case 'hex': return Buffer.from(input).toString('hex');
    case 'url': return encodeURIComponent(input);
    case 'rot13': return input.replace(/[a-zA-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13)));
    case 'html': return input.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    case 'binary': return [...input].map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    case 'ascii': return [...input].map(c => c.charCodeAt(0)).join(' ');
    case 'xor': return [...input].map((c, i) => (c.charCodeAt(0) ^ xorKey.charCodeAt(i % xorKey.length)).toString(16).padStart(2, '0')).join('');
    default: return input;
  }
}

function _decode(input, format, xorKey) {
  switch (format) {
    case 'base64': return Buffer.from(input, 'base64').toString('utf-8');
    case 'hex': return Buffer.from(input.replace(/\s/g, ''), 'hex').toString('utf-8');
    case 'url': return decodeURIComponent(input);
    case 'rot13': return input.replace(/[a-zA-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13)));
    case 'html': return input.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
    case 'binary': return input.split(' ').map(b => String.fromCharCode(parseInt(b, 2))).join('');
    case 'ascii': return input.split(' ').map(n => String.fromCharCode(parseInt(n))).join('');
    case 'xor': {
      const bytes = input.match(/.{2}/g) || [];
      return bytes.map((b, i) => String.fromCharCode(parseInt(b, 16) ^ xorKey.charCodeAt(i % xorKey.length))).join('');
    }
    default: return input;
  }
}

function _decodeJWT(token) {
  const parts = token.split('.');
  if (parts.length < 2) throw new Error('Not a valid JWT');
  
  const decode64 = (s) => {
    const padded = s + '='.repeat((4 - s.length % 4) % 4);
    return JSON.parse(Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  };

  return {
    header: decode64(parts[0]),
    payload: decode64(parts[1]),
    signature: parts[2] ? parts[2].slice(0, 20) + '...' : 'none'
  };
}
