// Jarvis Cyber — Save Artifact Tool
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import config from '../config.js';

export const definition = {
  type: 'function',
  function: {
    name: 'save_artifact',
    description: 'Save research output, exploit code, recon data, or reports to the organized output directory. Categorizes artifacts by type (recon, exploits, loot, reports, scripts).',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content to save' },
        filename: { type: 'string', description: 'Filename to save as' },
        category: { type: 'string', enum: ['recon', 'exploits', 'loot', 'reports', 'scripts', 'screenshots'], description: 'Category folder (default: reports)' }
      },
      required: ['content', 'filename']
    }
  }
};

export async function execute(args) {
  const { content, filename, category = 'reports' } = args;

  try {
    const outDir = join(config.outputDir, category);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    const filepath = join(outDir, filename);
    writeFileSync(filepath, content, 'utf-8');

    return {
      success: true,
      path: filepath,
      category,
      size: content.length,
      message: `Artifact saved to ${filepath}`
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
