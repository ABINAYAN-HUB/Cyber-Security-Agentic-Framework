// start-listener.js — Tool to start a TCP listener for reverse shells
import { listenerManager } from '../listener-manager.js';

export const definition = {
  type: 'function',
  function: {
    name: 'start_listener',
    description: 'Start a persistent TCP listener on a specific port to capture reverse shell connections. Unlike nc, this remains active and manageable by the agent.',
    parameters: {
      type: 'object',
      properties: {
        port: {
          type: 'integer',
          description: 'Port to listen on (e.g., 4444)'
        },
        force: {
          type: 'boolean',
          description: 'If true, kill any existing listener on this port first (default: false)'
        }
      },
      required: ['port']
    }
  }
};

export async function execute(args) {
  const { port, force } = args;
  return await listenerManager.startListener(port, force);
}
