// OpenClaw Cyber — GitHub Search
export const definition = {
  type: 'function',
  function: {
    name: 'github_search',
    description: 'Search GitHub for repositories, code, commits, or users. Uses the public GitHub Search API. Supports setting limit to restrict response size. Will use GITHUB_TOKEN environment variable if available for higher rate limits.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['repositories', 'code', 'commits', 'users'],
          description: 'Type of search to perform. (e.g., repositories)'
        },
        query: {
          type: 'string',
          description: 'Search query string (e.g., "language:javascript CVE-2023")'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of items to return (default: 5, max: 10)'
        }
      },
      required: ['type', 'query']
    }
  }
};

export async function execute(args) {
  const { type, query, limit = 5 } = args;
  const safeLimit = Math.min(Math.max(limit, 1), 10);
  
  const headers = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'OpenClaw-Cyber-Agent/1.0'
  };

  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const url = `https://api.github.com/search/${type}?q=${encodeURIComponent(query)}&per_page=${safeLimit}`;

  try {
    const startTime = Date.now();
    const response = await fetch(url, { headers });
    const elapsed = Date.now() - startTime;

    if (!response.ok) {
      if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
         return {
            success: false,
            error: 'GitHub API Rate Limit exceeded. Consider setting GITHUB_TOKEN in your .env file.'
         };
      }
      return {
        success: false,
        error: `GitHub API Error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    return _formatResults(type, data, safeLimit, elapsed);
  } catch (err) {
    return {
      success: false,
      error: `Failed to search GitHub: ${err.message}`
    };
  }
}

function _formatResults(type, data, limit, elapsed) {
  const items = data.items || [];
  
  let formattedItems = [];
  if (type === 'repositories') {
    formattedItems = items.map(repo => ({
      name: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      stars: repo.stargazers_count,
      language: repo.language,
      updated_at: repo.updated_at
    }));
  } else if (type === 'code') {
    formattedItems = items.map(file => ({
      name: file.name,
      repository: file.repository.full_name,
      url: file.html_url,
      path: file.path
    }));
  } else if (type === 'commits') {
    formattedItems = items.map(commit => ({
      message: commit.commit.message.split('\n')[0], // Return top line of message
      author: commit.commit.author.name,
      repository: commit.repository.full_name,
      url: commit.html_url,
      date: commit.commit.author.date
    }));
  } else if (type === 'users') {
    formattedItems = items.map(user => ({
      login: user.login,
      url: user.html_url,
      type: user.type,
      score: user.score
    }));
  }

  return {
    success: true,
    total_count: data.total_count,
    items_returned: formattedItems.length,
    elapsed_ms: elapsed,
    results: formattedItems.slice(0, limit)
  };
}
