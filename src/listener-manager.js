// listener-manager.js — Persistent TCP listener manager for the CLI Agent
import net from 'net';

class ListenerManager {
  constructor() {
    this.listeners = new Map(); // port -> { server, socket, output, managedByAgent }
  }

  /**
   * Dynamically probe a port to check if something is already listening on it.
   * Returns true if the port is occupied (e.g. user's nc), false if it's free.
   */
  async _isPortOccupied(port) {
    return new Promise((resolve) => {
      const probe = new net.Socket();
      probe.setTimeout(1500);
      probe.once('connect', () => {
        probe.destroy();
        resolve(true);
      });
      probe.once('timeout', () => {
        probe.destroy();
        resolve(false);
      });
      probe.once('error', () => {
        probe.destroy();
        resolve(false);
      });
      probe.connect(port, '127.0.0.1');
    });
  }

  /**
   * Starts a TCP listener that captures a reverse shell connection.
   * Dynamically detects if the port is already occupied (e.g. user's nc listener)
   * and returns guidance instead of conflicting.
   */
  async startListener(port, force = false) {
    if (this.listeners.has(port)) {
      if (!force) {
        const existing = this.listeners.get(port);
        if (existing.server && existing.server.listening) {
          return { success: true, message: `Listener already active on port ${port}`, status: 'listening', managedByAgent: true };
        }
      }
      this.stopListener(port); // Cleanup
    }

    // ── DYNAMIC PORT CONFLICT DETECTION ──
    // Check if something else (like the user's nc -lvp) is already on this port
    const occupied = await this._isPortOccupied(port);
    if (occupied && !force) {
      return {
        success: false,
        already_in_use: true,
        port,
        error: `Port ${port} is ALREADY IN USE — likely the user's own listener (nc -lvp ${port}).`,
        guidance: `DO NOT start an internal listener. The user already has a listener running on port ${port}. `
          + `Just send the reverse shell payload to the target machine and it will connect DIRECTLY to the user's terminal. `
          + `Use execute_command to send the payload via the target's bindshell/exploit. `
          + `After sending, tell the user to check their nc terminal for the incoming connection.`
      };
    }

    return new Promise((resolve) => {
      const state = {
        server: null,
        socket: null,
        output: '',
        status: 'starting',
        managedByAgent: true
      };

      const server = net.createServer((socket) => {
        // If we already have a socket, we close the new one — we only support 1 connection at a time
        if (state.socket) {
          socket.write('Agent listener occupied. Connection closed.\n');
          socket.destroy();
          return;
        }

        state.socket = socket;
        state.status = 'connected';
        state.output += `[Listener] Connection received from ${socket.remoteAddress}\n`;

        const maxAccumulation = 1000000;
        socket.on('data', (data) => {
          if (state.output.length < maxAccumulation) {
            state.output += data.toString();
          } else if (!state.output.endsWith('\n...[snip]...')) {
            state.output += '\n...[snip]...';
          }
        });

        socket.on('error', (err) => {
          if (state.output.length < maxAccumulation) {
            state.output += `[Listener Error] ${err.message}\n`;
          }
        });

        socket.on('close', () => {
          state.output += `[Listener] Connection closed by remote.\n`;
          state.socket = null;
          state.status = 'listening';
        });
      });

      server.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      server.listen(port, '0.0.0.0', () => {
        state.server = server;
        state.status = 'listening';
        this.listeners.set(port, state);
        resolve({ success: true, message: `TCP Listener started on port ${port}. Waiting for connection...`, port });
      });
    });
  }

  /**
   * Sends a command to an active reverse shell connection
   */
  async interact(port, command, timeout_ms = 8000) {
    const state = this.listeners.get(port);
    if (!state) {
      return { success: false, error: `No active listener on port ${port}` };
    }

    if (!state.socket) {
      return { success: false, error: `Listener on port ${port} is active but has NO incoming connection yet.`, status: state.status, log: state.output };
    }

    return new Promise((resolve) => {
      const payload = command.endsWith('\n') ? command : command + '\n';
      const startLen = state.output.length;
      
      state.socket.write(payload);

      // Wait for output
      let silenceTimer = null;
      const timeoutTimer = setTimeout(() => {
        cleanup();
        resolve({ success: true, message: 'Timed out waiting for more output', output: state.output.slice(startLen).trim() });
      }, timeout_ms);

      const onData = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          cleanup();
          resolve({ success: true, output: state.output.slice(startLen).trim() });
        }, 1500);
      };

      const onDisconnect = () => {
        cleanup();
        resolve({ success: false, error: 'Reverse shell disconnected during interaction.', output: state.output.slice(startLen).trim() });
      };

      const cleanup = () => {
        clearTimeout(timeoutTimer);
        if (silenceTimer) clearTimeout(silenceTimer);
        if (state.socket) {
          state.socket.removeListener('data', onData);
          state.socket.removeListener('close', onDisconnect);
          state.socket.removeListener('error', onDisconnect);
        }
      };

      state.socket.on('data', onData);
      state.socket.on('close', onDisconnect);
      state.socket.on('error', onDisconnect);
    });
  }

  /**
   * Returns current status and latest output
   */
  getStatus(port) {
    const state = this.listeners.get(port);
    if (!state) return { error: `Not found` };
    return {
      status: state.status,
      connected: !!state.socket,
      managedByAgent: state.managedByAgent || false,
      output: state.output
    };
  }

  /**
   * Stops a listener
   */
  stopListener(port) {
    const state = this.listeners.get(port);
    if (!state) return false;

    if (state.socket) state.socket.destroy();
    if (state.server) state.server.close();

    this.listeners.delete(port);
    return true;
  }
}

export const listenerManager = new ListenerManager();
