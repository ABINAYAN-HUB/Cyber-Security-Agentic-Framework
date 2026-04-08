// OpenClaw Cyber — Tavily Search Pro
// Matched to actual Tavily API response format
import config from '../config.js';

export const definition = {
  type: 'function',
  function: {
    name: 'tavily_search',
    description: 'Advanced web search using Tavily Search API. Returns AI-curated results with extracted content, relevance scores, favicons, follow-up questions, and images. Superior to basic web search for research-intensive queries about vulnerabilities, exploits, and technical documentation.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        search_depth: { type: 'string', enum: ['basic', 'advanced'], description: 'Search depth — advanced returns more comprehensive results (default: advanced)' },
        include_answer: { type: 'boolean', description: 'Include AI-generated answer summary (default: true)' },
        max_results: { type: 'integer', description: 'Max results to return (default: 5)' },
        include_raw_content: { type: 'boolean', description: 'Include full page content (default: false)' },
        include_images: { type: 'boolean', description: 'Include related images (default: false)' },
        include_domains: { type: 'string', description: 'Comma-separated domains to include (e.g., "github.com,exploit-db.com")' },
        exclude_domains: { type: 'string', description: 'Comma-separated domains to exclude' },
        topic: { type: 'string', enum: ['general', 'news'], description: 'Search topic category (default: general)' }
      },
      required: ['query']
    }
  }
};

export async function execute(args) {
  const {
    query,
    search_depth = 'advanced',
    include_answer = true,
    max_results = 5,
    include_raw_content = false,
    include_images = false,
    include_domains,
    exclude_domains,
    topic = 'general'
  } = args;

  if (!config.tavilyApiKey) {
    return { success: false, error: 'TAVILY_API_KEY not configured in .env. Get one at https://tavily.com/' };
  }

  try {
    const body = {
      api_key: config.tavilyApiKey,
      query,
      search_depth,
      include_answer,
      max_results,
      include_raw_content,
      include_images,
      topic,
      include_domains: include_domains ? include_domains.split(',').map(d => d.trim()) : [],
      exclude_domains: exclude_domains ? exclude_domains.split(',').map(d => d.trim()) : []
    };

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Tavily API error (${response.status}): ${errText}` };
    }

    const data = await response.json();

    // Return the full Tavily response structure
    return {
      success: true,
      query: data.query || query,
      answer: data.answer || null,
      follow_up_questions: data.follow_up_questions || null,
      images: data.images || [],
      results: (data.results || []).map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
        raw_content: r.raw_content || null,
        favicon: r.favicon || null
      })),
      response_time: data.response_time,
      request_id: data.request_id
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
