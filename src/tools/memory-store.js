// Jarvis Cyber — Persistent Memory Store Tool
import { memory } from '../memory.js';

export const definition = {
  type: 'function',
  function: {
    name: 'memory_store',
    description: 'Store and retrieve information from persistent memory. Saves knowledge, target profiles, and loot that survives across sessions. Use this to remember important findings during reconnaissance.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['store', 'retrieve', 'search', 'store_target', 'get_target', 'store_loot', 'get_loot', 'stats'], description: 'Memory action' },
        key: { type: 'string', description: 'Key for store/retrieve operations' },
        value: { type: 'string', description: 'Value to store' },
        category: { type: 'string', description: 'Category for organizing data (default: general)' },
        query: { type: 'string', description: 'Search query for search action' },
        target: { type: 'string', description: 'Target identifier for target/loot operations' },
        type: { type: 'string', description: 'Type of data (e.g., "credential", "service", "vulnerability")' }
      },
      required: ['action']
    }
  }
};

export async function execute(args) {
  const { action, key, value, category = 'general', query, target, type = 'general' } = args;

  try {
    // Ensure memory is initialized
    try { memory.init(); } catch {}

    switch (action) {
      case 'store':
        if (!key || !value) return { success: false, error: 'key and value required' };
        memory.storeKnowledge(key, value, category);
        return { success: true, message: `Stored "${key}" in category "${category}"` };

      case 'retrieve':
        if (!key) return { success: false, error: 'key required' };
        const result = memory.getKnowledge(key);
        return { success: true, key, value: result, found: result !== null };

      case 'search':
        if (!query) return { success: false, error: 'query required' };
        const results = memory.searchKnowledge(query, category !== 'general' ? category : null);
        return { success: true, query, results, count: results.length };

      case 'store_target':
        if (!target || !value) return { success: false, error: 'target and value required' };
        memory.storeTarget(target, value, type);
        return { success: true, message: `Target data stored for "${target}"` };

      case 'get_target':
        if (!target) return { success: false, error: 'target required' };
        const targetData = memory.getTarget(target);
        return { success: true, target, data: targetData, count: targetData.length };

      case 'store_loot':
        if (!target || !value) return { success: false, error: 'target and value required' };
        memory.storeLoot(target, type, value, 'agent');
        return { success: true, message: `Loot stored for "${target}"` };

      case 'get_loot':
        const loot = memory.getLoot(target);
        return { success: true, loot, count: loot.length };

      case 'stats':
        const stats = memory.getStats();
        return { success: true, stats };

      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}
