// start-listener.js — Tool to start a TCP listener for reverse shells
import { listenerManager } from '../listener-manager.js';

export const definition = {
  type: 'function',
  function: {
    name: 'start_listener',
    description: `Start a persistent TCP listener INSIDE THE AGENT to capture reverse shell connections.
WARNING: This creates an AGENT-INTERNAL listener that only the agent can interact with via bg_interact. The user CANNOT see or type into this shell.
- If the user said they will listen with 'nc -lvp <PORT>' or similar, DO NOT use this tool on that port — just send the reverse shell payload to the target and it will connect directly to the user's terminal.
- Only use this when the user has NOT set up their own listener and wants the agent to manage the shell automatically.
- If the port is already in use (user's nc), this tool will detect it dynamically and return guidance.`,
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
