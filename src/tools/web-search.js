// OpenClaw Cyber — Web Search (Pure JS — No Python Dependency)
// Uses duck-duck-scrape npm package (already installed)
import { search as ddgSearch } from 'duck-duck-scrape';

export const definition = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web for information, exploits, documentation, or code samples. Returns a list of titles, snippets, and URLs.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query (e.g., "vsftpd 2.3.4 exploit github", "nmap cheat sheet")'
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of results to return (default: 8)'
        }
      },
      required: ['query']
    }
  }
};

export async function execute(args) {
  const { query, max_results = 8 } = args;

  try {
    const searchResults = await ddgSearch(query, { safeSearch: 0 });

    if (!searchResults || !searchResults.results || searchResults.results.length === 0) {
      return { success: true, message: 'No results found.', results: [], query };
    }

    const results = searchResults.results.slice(0, max_results).map(r => ({
      title: r.title || '',
      url: r.url || r.href || '',
      snippet: r.description || r.body || '',
    }));

    return { 
      success: true, 
      query,
      results,
      note: 'Use read_url to view the full content of a specific result.'
    };
  } catch (err) {
    // Fallback: try DuckDuckGo HTML scraping via fetch
    try {
      const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return { success: false, error: `DuckDuckGo returned ${response.status}` };
      }

      const html = await response.text();
      const results = [];

      // Parse result blocks from DDG HTML
      const resultBlocks = html.split('class="result__body"');
      for (let i = 1; i < resultBlocks.length && results.length < max_results; i++) {
        const block = resultBlocks[i];
        
        // Extract URL
        const urlMatch = block.match(/href="([^"]+)"/);
        const url = urlMatch ? urlMatch[1] : '';
        
        // Extract title
        const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)</);
        const title = titleMatch ? titleMatch[1].trim() : '';
        
        // Extract snippet
        const snippetMatch = block.match(/class="result__snippet"[^>]*>([^<]+)</);
        const snippet = snippetMatch ? snippetMatch[1].trim() : '';
        
        if (url && title) {
          results.push({ title, url, snippet });
        }
      }

      return { 
        success: true, 
        query,
        results,
        source: 'html_fallback',
        note: 'Use read_url to view the full content of a specific result.'
      };
    } catch (fallbackErr) {
      return { success: false, error: `Search failed: ${err.message}. Fallback also failed: ${fallbackErr.message}` };
    }
  }
}
