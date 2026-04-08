import { readFileSync, writeFileSync } from 'fs';
import { resolve, relative } from 'path';
import { createPatch } from 'diff';

export const definition = {
  type: 'function',
  function: {
    name: 'edit_file',
    description: 'Make a surgical edit to a file by replacing specific text. This is preferred over write_file for making targeted changes. The old_text must match exactly (including whitespace/indentation).',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to the file to edit'
        },
        old_text: {
          type: 'string',
          description: 'The exact text to find and replace (must match exactly)'
        },
        new_text: {
          type: 'string',
          description: 'The replacement text'
        }
      },
      required: ['path', 'old_text', 'new_text']
    }
  }
};

export async function execute({ path, old_text, new_text }, cwd) {
  const fullPath = resolve(cwd, path);
  const relPath = relative(cwd, fullPath);

  try {
    const original = readFileSync(fullPath, 'utf-8');
    
    if (!original.includes(old_text)) {
      return {
        success: false,
        error: 'old_text not found in file. Make sure it matches exactly (including whitespace and indentation).',
        hint: 'Use read_file first to see the exact content.'
      };
    }

    const occurrences = original.split(old_text).length - 1;
    const modified = original.replace(old_text, new_text);
    writeFileSync(fullPath, modified, 'utf-8');

    const diff = createPatch(relPath, original, modified, 'original', 'modified');

    return {
      success: true,
      path: relPath,
      occurrences_found: occurrences,
      occurrences_replaced: 1,
      diff: diff
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
