import { readFileSync } from 'fs';
import { resolve, relative } from 'path';

export const definition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read the contents of a file. Use this to understand code, configs, docs, or any text file. You can optionally read a specific line range.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the file to read'
        },
        start_line: {
          type: 'integer',
          description: 'Optional: first line number to read (1-indexed)'
        },
        end_line: {
          type: 'integer',
          description: 'Optional: last line number to read (1-indexed, inclusive)'
        }
      },
      required: ['path']
    }
  }
};

export async function execute({ path, start_line, end_line }, cwd) {
  const fullPath = resolve(cwd, path);
  const relPath = relative(cwd, fullPath);
  
  try {
    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    if (start_line || end_line) {
      const start = Math.max(1, start_line || 1);
      const end = Math.min(lines.length, end_line || lines.length);
      const slice = lines.slice(start - 1, end);
      return {
        success: true,
        path: relPath,
        total_lines: lines.length,
        showing: `lines ${start}-${end}`,
        content: slice.map((l, i) => `${start + i}: ${l}`).join('\n')
      };
    }
    
    return {
      success: true,
      path: relPath,
      total_lines: lines.length,
      content: lines.length > 500 
        ? lines.slice(0, 500).join('\n') + `\n\n... (truncated, showing 500/${lines.length} lines)`
        : content
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
