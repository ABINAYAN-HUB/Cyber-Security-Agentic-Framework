import { manager } from '../subagent-manager.js';

export const spawnSubagent = {
  definition: {
    type: 'function',
    function: {
      name: 'spawn_subagent',
      description: 'Spawn a background subagent (child node) to handle a time-consuming or parallelizable task asynchronously. The background agent has all the same tools as you.',
      parameters: {
        type: 'object',
        properties: {
          task_description: {
            type: 'string',
            description: 'Highly detailed instructions on what the subagent should do, including what exactly it needs to figure out.'
          },
          agent_name_prefix: {
            type: 'string',
            description: 'A short word identifying the agent role (e.g. "recon", "bruteforce", "scraper")'
          }
        },
        required: ['task_description']
      }
    }
  },
  execute: async ({ task_description, agent_name_prefix }) => {
    const prefix = agent_name_prefix || 'worker';
    const id = manager.spawnSubagent(task_description, prefix);
    return { 
      success: true, 
      message: `Background subagent spawned successfully.`,
      subagent_id: id,
      instructions: `Use check_subagent_status with ID '${id}' periodically (e.g., after doing other tasks or waiting) to see if it has finished.`
    };
  }
};

export const checkSubagentStatus = {
  definition: {
    type: 'function',
    function: {
      name: 'check_subagent_status',
      description: 'Check the status and read the final output log of a specific background subagent.',
      parameters: {
        type: 'object',
        properties: {
          subagent_id: {
            type: 'string',
            description: 'The ID of the subagent to check'
          }
        },
        required: ['subagent_id']
      }
    }
  },
  execute: async ({ subagent_id }) => {
    return manager.getStatus(subagent_id);
  }
};

export const listSubagents = {
  definition: {
    type: 'function',
    function: {
      name: 'list_subagents',
      description: 'List all running, completed, or failed background subagents.',
      parameters: {
        type: 'object',
        properties: {},
      }
    }
  },
  execute: async () => {
    return { subagents: manager.getAllStatuses() };
  }
};
