// Jarvis Cyber — read-url.js — Fetch a URL and convert to Markdown
import { networkErrorMessage } from './network-utils.js';
export const definition = {
  type: 'function',
  function: {
    name: 'read_url',
    description: 'Fetch the content of a URL and return it as readable Markdown. Useful for reading documentation, exploit articles, or code from GitHub.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to read'
        }
      },
      required: ['url']
    }
  }
};

export async function execute(args) {
  const { url } = args;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Basic HTML to Markdown conversion
    // 1. Remove script and style tags
    let clean = html.replace(/<(script|style|nav|footer|header|aside)[^>]*>[\s\S]*?<\/\1>/gi, '');
    
    // 2. Convert common tags
    clean = clean.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (m, c) => `\n\n# ${c.trim()}\n`);
    clean = clean.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (m, c) => `\n\n${c.trim()}\n`);
    clean = clean.replace(/<br[^>]*>/gi, '\n');
    clean = clean.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, c) => `\n- ${c.trim()}`);
    clean = clean.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (m, c) => ` \`${c.trim()}\` `);
    clean = clean.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (m, c) => ` **${c.trim()}** `);
    clean = clean.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (m, c) => ` *${c.trim()}* `);
    clean = clean.replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, h, c) => ` [${c.trim()}](${h}) `);

    // 3. Strip remaining tags
    clean = clean.replace(/<[^>]+>/g, '');
    
    // 4. Cleanup whitespace
    clean = clean.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

    // Limit length
    if (clean.length > 20000) {
      clean = clean.slice(0, 20000) + '\n\n... (content truncated)';
    }

    return { 
      success: true, 
      url, 
      content: clean || '(no readable content found)' 
    };
  } catch (error) {
    return { success: false, error: networkErrorMessage(error, `Failed to read ${url}`) };
  }
}
