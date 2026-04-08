import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, relative, join } from 'path';

export const definition = {
  type: 'function',
  function: {
    name: 'search_files',
    description: 'Search for a text pattern across files in a directory (like grep). Returns matching lines with context. Useful for finding function definitions, usage patterns, error messages, etc.',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Text or regex pattern to search for'
        },
        path: {
          type: 'string',
          description: 'Directory to search in (default: current directory)'
        },
        include: {
          type: 'string',
          description: 'File extension filter, e.g. ".js" or ".py" (optional)'
        },
        max_results: {
          type: 'integer',
          description: 'Maximum number of results to return (default: 30)'
        }
      },
      required: ['pattern']
    }
  }
};

function searchDir(dirPath, regex, include, results, maxResults) {
  if (results.length >= maxResults) return;
  
  try {
    const items = readdirSync(dirPath);
    
    for (const item of items) {
      if (results.length >= maxResults) break;
      if (item.startsWith('.') || item === 'node_modules' || item === '__pycache__' || item === '.git' || item === 'dist' || item === 'build') continue;
      
      const fullPath = join(dirPath, item);
      
      try {
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          searchDir(fullPath, regex, include, results, maxResults);
        } else if (stat.isFile()) {
          // Check extension filter
          if (include && !item.endsWith(include)) continue;
          
          // Skip binary files (by extension)
          const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib', '.pdf'];
          if (binaryExts.some(ext => item.endsWith(ext))) continue;
          
          // Skip large files
          if (stat.size > 1024 * 1024) continue;
          
          try {
            const content = readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');
            
            lines.forEach((line, idx) => {
              if (results.length >= maxResults) return;
              if (regex.test(line)) {
                results.push({
                  file: fullPath,
                  line: idx + 1,
                  content: line.trim().slice(0, 200)
                });
              }
            });
          } catch {
            // Can't read file, skip
          }
        }
      } catch {
        // permission denied
      }
    }
  } catch {
    // can't read dir
  }
}

export async function execute({ pattern, path, include, max_results }, cwd) {
  const searchPath = resolve(cwd, path || '.');
  const maxResults = max_results || 30;
  
  let regex;
  try {
    regex = new RegExp(pattern, 'i');
  } catch {
    regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  
  const results = [];
  searchDir(searchPath, regex, include, results, maxResults);
  
  if (results.length === 0) {
    return { success: true, pattern, results: [], message: 'No matches found' };
  }
  
  const formatted = results.map(r => {
    const relFile = relative(cwd, r.file);
    return `${relFile}:${r.line}: ${r.content}`;
  });

  return {
    success: true,
    pattern,
    total_matches: results.length,
    truncated: results.length >= maxResults,
    results: formatted.join('\n')
  };
}
