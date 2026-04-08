import { writeFileSync, mkdirSync } from 'fs';
import { resolve, relative, dirname } from 'path';

export const definition = {
  type: 'function',
  function: {
    name: 'write_file',
    description: 'Create a new file or overwrite an existing file with the given content. Parent directories are created automatically. Use this for creating new files or when you need to replace the entire file content.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path for the file to create/overwrite'
        },
        content: {
          type: 'string',
          description: 'The full content to write to the file'
        }
      },
      required: ['path', 'content']
    }
  }
};

export async function execute({ path, content }, cwd) {
  const fullPath = resolve(cwd, path);
  const relPath = relative(cwd, fullPath);

  try {
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
    const lines = content.split('\n').length;
    return {
      success: true,
      path: relPath,
      lines_written: lines,
      bytes: Buffer.byteLength(content, 'utf-8')
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
