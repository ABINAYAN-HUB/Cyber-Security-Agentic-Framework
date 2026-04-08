import { glob } from 'glob';
import { resolve, relative } from 'path';

export const definition = {
  type: 'function',
  function: {
    name: 'search_glob',
    description: 'Find files by name or glob pattern. Use this to locate files in the project (e.g. "**/*.py", "**/config*", "src/**/*.test.js").',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern to match files (e.g. "**/*.js", "**/Dockerfile")'
        },
        path: {
          type: 'string',
          description: 'Base directory to search from (default: current directory)'
        }
      },
      required: ['pattern']
    }
  }
};

export async function execute({ pattern, path }, cwd) {
  const searchPath = resolve(cwd, path || '.');
  
  try {
    const matches = await glob(pattern, {
      cwd: searchPath,
      nodir: false,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/__pycache__/**'],
      maxDepth: 10,
    });
    
    if (matches.length === 0) {
      return { success: true, pattern, results: [], message: 'No files match this pattern' };
    }
    
    const limited = matches.slice(0, 50);
    
    return {
      success: true,
      pattern,
      total_matches: matches.length,
      showing: limited.length,
      results: limited.join('\n')
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
