import { readdirSync, statSync } from 'fs';
import { resolve, relative, join } from 'path';

export const definition = {
  type: 'function',
  function: {
    name: 'list_directory',
    description: 'List files and directories at a given path. Shows file sizes and types. Use recursive mode to explore project structure.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path to list (default: current directory)'
        },
        recursive: {
          type: 'boolean',
          description: 'If true, list recursively (default: false)'
        },
        max_depth: {
          type: 'integer',
          description: 'Max recursion depth (default: 3)'
        }
      },
      required: []
    }
  }
};

function listDir(dirPath, basePath, depth, maxDepth) {
  const entries = [];
  
  try {
    const items = readdirSync(dirPath);
    
    for (const item of items) {
      // Skip hidden/common ignore dirs
      if (item.startsWith('.') || item === 'node_modules' || item === '__pycache__' || item === '.git') continue;
      
      const fullPath = join(dirPath, item);
      const relPath = relative(basePath, fullPath);
      
      try {
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          entries.push({ type: 'dir', path: relPath + '/' });
          if (depth < maxDepth) {
            entries.push(...listDir(fullPath, basePath, depth + 1, maxDepth));
          }
        } else {
          const size = stat.size;
          const sizeStr = size < 1024 ? `${size}B` : 
                         size < 1024 * 1024 ? `${(size / 1024).toFixed(1)}KB` :
                         `${(size / (1024 * 1024)).toFixed(1)}MB`;
          entries.push({ type: 'file', path: relPath, size: sizeStr });
        }
      } catch {
        // permission denied, skip
      }
    }
  } catch (e) {
    return [{ type: 'error', error: e.message }];
  }
  
  return entries;
}

export async function execute({ path, recursive, max_depth }, cwd) {
  const dirPath = resolve(cwd, path || '.');
  const relPath = relative(cwd, dirPath) || '.';
  const maxDepth = recursive ? (max_depth || 3) : 0;
  
  const entries = listDir(dirPath, dirPath, 0, maxDepth);
  
  if (entries.length === 0) {
    return { success: true, path: relPath, entries: [], message: 'Directory is empty' };
  }
  
  // Format as text tree
  const lines = entries.map(e => {
    if (e.type === 'dir') return `📁 ${e.path}`;
    if (e.type === 'file') return `📄 ${e.path} (${e.size})`;
    return `❌ ${e.error}`;
  });

  return {
    success: true,
    path: relPath,
    total_entries: entries.length,
    listing: lines.join('\n')
  };
}
