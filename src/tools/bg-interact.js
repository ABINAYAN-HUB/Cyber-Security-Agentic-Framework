import net from 'net';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { listenerManager } from '../listener-manager.js';

export const definition = {
  type: 'function',
  function: {
    name: 'bg_interact',
    description: `Send a command string to an already-established background process/socket and return the output.
Use this to interact with a reverse shell after the target has connected back to your listener.
Two modes:
1. TCP mode (default): connects to localhost:<port>, sends the command, reads output. 
   - If a 'start_listener' was used on this port, it interacts with that persistent connection.
   - Otherwise, it tries a fresh TCP connection (useful for bindshells).
2. File-append mode: writes to a file and reads a log.`,
    parameters: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Host to connect to (default: 127.0.0.1).',
        },
        port: {
          type: 'integer',
          description: 'Port number of the listening process or bindshell.',
        },
        command: {
          type: 'string',
          description: 'Shell command to send (e.g. "id\\n"). Always end with \\n.',
        },
        timeout_ms: {
          type: 'integer',
          description: 'How long to wait for a response (default: 8000).',
        },
        read_log_file: {
          type: 'string',
          description: 'Optional: read this log file path instead of TCP.',
        },
        write_stdin_file: {
          type: 'string',
          description: 'Optional: write the command to this file path.',
        },
      },
      required: [],
    },
  },
};

export async function execute(args) {
  const {
    host = '127.0.0.1',
    port,
    command = '',
    timeout_ms = 8000,
    read_log_file,
    write_stdin_file,
  } = args;

  // ── Mode 1: Check Listener Manager (NEW) ──────────────────────────────────
  if (port && host === '127.0.0.1') {
    const status = listenerManager.getStatus(port);
    if (!status.error) {
       // This port is being managed by our internal listener!
       return await listenerManager.interact(port, command, timeout_ms);
    }
  }

  // ── Mode 2: File-based interaction ──────────────────────────────────────────
  if (read_log_file || write_stdin_file) {
    try {
      let output = '';
      if (write_stdin_file && command) {
        const payload = command.endsWith('\n') ? command : command + '\n';
        writeFileSync(write_stdin_file, payload, { flag: 'a' });
        output += `[stdin] Wrote command to ${write_stdin_file}\n`;
      }
      if (read_log_file) {
        // Wait a bit for output to appear
        await new Promise(r => setTimeout(r, Math.min(timeout_ms, 2000)));
        if (existsSync(read_log_file)) {
          output += readFileSync(read_log_file, 'utf8');
        } else {
          output += `(file not found: ${read_log_file})`;
        }
      }
      return { success: true, output, mode: 'file' };
    } catch (e) {
      return { success: false, error: e.message, mode: 'file' };
    }
  }

  // ── Mode 3: TCP socket interaction (BIND SHELL / FRESH CONN) ────────────────
  if (!port) {
    return { success: false, error: 'You must provide a port number for TCP mode.' };
  }

  return new Promise((resolve) => {
    let output = '';
    let resolved = false;
    const finish = (success, extra = {}) => {
      if (resolved) return;
      resolved = true;
      client.destroy();
      resolve({ success, output: output.trim(), host, port, command, ...extra });
    };

    const client = new net.Socket();
    const timer = setTimeout(() => finish(true, { note: 'timeout — output collected so far' }), timeout_ms);

    client.connect(port, host, () => {
      const payload = command.endsWith('\n') ? command : command + '\n';
      client.write(payload);
      let silenceTimer = null;
      const resetSilence = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          clearTimeout(timer);
          finish(true);
        }, 1500);
      };
      resetSilence();
      client.on('data', (data) => {
        const chunk = data.toString();
        const maxAccumulation = 1000000;
        if (output.length < maxAccumulation) {
          output += chunk;
        } else if (!output.endsWith('\n...[snip]...')) {
          output += '\n...[snip]...';
        }
        resetSilence();
      });
    });

    client.on('error', (err) => {
      clearTimeout(timer);
      finish(false, { error: `TCP connect failed: ${err.message}.` });
    });

    client.on('close', () => finish(true, { note: 'connection closed by remote' }));
  });
}

