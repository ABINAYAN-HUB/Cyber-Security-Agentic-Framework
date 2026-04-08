// check-port.js — Native tool to check if a port is open or listening
import net from 'net';

export const definition = {
  type: 'function',
  function: {
    name: 'check_port',
    description: 'Check if a specific port is currently listening or open. Use this instead of nc -z or ss to reliably detect service status.',
    parameters: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Host to check (default: 127.0.0.1)'
        },
        port: {
          type: 'integer',
          description: 'Port number to check'
        },
        timeout_ms: {
          type: 'integer',
          description: 'Timeout in ms (default: 2000)'
        }
      },
      required: ['port']
    }
  }
};

export async function execute(args) {
  const { host = '127.0.0.1', port, timeout_ms = 2000 } = args;

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = 'closed';

    socket.setTimeout(timeout_ms);

    socket.connect(port, host, () => {
      status = 'open (listening)';
      socket.destroy();
      resolve({ success: true, host, port, status, open: true });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: true, host, port, status: 'timeout (likely filtered or no response)', open: false });
    });

    socket.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        status = 'closed (connection refused)';
      } else {
        status = `error: ${err.message}`;
      }
      resolve({ success: true, host, port, status, open: false });
    });
  });
}
