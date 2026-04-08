import { spawn } from 'child_process';
import { platform } from 'os';
import * as ui from '../ui.js';

export const definition = {
  type: 'function',
  function: {
    name: 'execute_command',
    description: 'Execute a shell command and return its output. On Windows, uses PowerShell; on Unix, uses bash. Use for running scripts, tests, git commands, build tools, package managers, security tools, etc.',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute'
        },
        timeout_ms: {
          type: 'integer',
          description: 'Optional timeout in milliseconds (default: 30000)'
        },
        background: {
          type: 'boolean',
          description: 'If true, spawn the process detached in the background and return immediately. Use this ONLY for long-running processes (like starting a listener, or SENDING a reverse shell with nc -e or bash -i) so you do not block the agent. If you omit this when sending a reverse shell, the command will hang and timeout!'
        }
      },
      required: ['command']
    }
  }
};

export async function execute(args, cwd) {
  const { command, timeout_ms } = args;
  const timeout = timeout_ms || 300000; // 5 minutes default (critical for nmap, dirb, etc)
  const isWindows = platform() === 'win32';
  
  return new Promise((resolve) => {
    let shell = isWindows ? 'powershell.exe' : '/bin/bash';

    // Set up environment to discourage TTY assumptions for headless execution
    const env = { 
      ...process.env, 
      TERM: 'dumb',           // Prevents tools from trying to use advanced terminal features
      DEBIAN_FRONTEND: 'noninteractive', // Prevents apt/dpkg from prompting
      PAGER: 'cat'            // Prevents tools from halting output to page
    };
    
    // Use spawn with detached stdin to prevent ANY tools from requesting a TTY and crashing on ioctl errors
    let isBackground = !!args.background;

    // Auto-background reverse shell commands to prevent the LLM from accidentally hanging the socket loop
    if (!isBackground && (command.trim().endsWith('&') || command.includes('nc -e') || command.includes('bash -i') || command.includes('nc -lvp'))) {
      isBackground = true;
    }

    const proc = spawn(command, { 
      cwd, 
      shell, 
      env,
      detached: isBackground, // Only detach background processes to avoid orphans
      stdio: isBackground ? 'ignore' : ['ignore', 'pipe', 'pipe'] // 'ignore' severs the TTY input stream
    });

    if (isBackground) {
      proc.unref(); // Disconnect from parent event loop
      resolve({
        success: true,
        exit_code: 0,
        stdout: '(Process spawned detached in the background)',
        stderr: '',
        command,
      });
      return;
    }

    let outStr = '';
    let errStr = '';
    let isReaped = false;

    // Timeout safety
    const timer = setTimeout(() => {
      if (isReaped) return;
      isReaped = true;
      
      // Process group kill ensures all child processes spawned by the command die
      try {
        if (proc.pid) {
          if (isBackground) {
            process.kill(-proc.pid, 'SIGTERM');
            setTimeout(() => {
              try { process.kill(-proc.pid, 'SIGKILL'); } catch {}
            }, 1000);
          } else {
            proc.kill('SIGTERM');
            setTimeout(() => {
              try { proc.kill('SIGKILL'); } catch {}
            }, 1000);
          }
        }
      } catch (e) {
        try { proc.kill('SIGKILL'); } catch {}
      }

      resolve({
        success: false,
        exit_code: -1,
        stdout: outStr || '(no output)',
        stderr: errStr || 'Command timed out',
        error: 'Command timed out',
        command,
      });
    }, timeout);

    let outLastLine = true;
    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      ui.uiEvents.emit('stream_stdout', chunk);
      
      const maxAccumulation = 1000000; // 1MB limit for string memory safety
      if (outStr.length < maxAccumulation) {
        outStr += chunk;
      } else if (!outStr.endsWith('\n...[snip]...')) {
        outStr += '\n...[snip]...';
      }
      
      // We still output to terminal
      const formatted = chunk.replace(/\n(?=.)/g, '\n     │ ');
      if (outLastLine) {
        process.stdout.write(ui.colors.muted('     │ ') + ui.colors.muted(formatted));
      } else {
        process.stdout.write(ui.colors.muted(formatted));
      }
      outLastLine = chunk.endsWith('\n');
    });

    let errLastLine = true;
    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      ui.uiEvents.emit('stream_stderr', chunk);
      
      const maxAccumulation = 1000000;
      if (errStr.length < maxAccumulation) {
        errStr += chunk;
      } else if (!errStr.endsWith('\n...[snip]...')) {
        errStr += '\n...[snip]...';
      }
      
      const formatted = chunk.replace(/\n(?=.)/g, '\n     │ ');
      if (errLastLine) {
        process.stdout.write(ui.colors.danger('     │ ') + ui.colors.danger(formatted));
      } else {
        process.stdout.write(ui.colors.danger(formatted));
      }
      errLastLine = chunk.endsWith('\n');
    });

    proc.on('close', (code) => {
      if (isReaped) return;
      isReaped = true;
      clearTimeout(timer);
      
      if (!isBackground) {
        if (!outLastLine && !errLastLine) console.log();
        console.log(ui.colors.muted('     └───────────────'));
      }

      // Truncate very long output
      const maxLen = 10000;
      if (outStr.length > maxLen) {
        outStr = outStr.slice(0, maxLen) + `\n... (truncated, ${outStr.length} chars total)`;
      }
      if (errStr.length > maxLen) {
        errStr = errStr.slice(0, maxLen) + `\n... (truncated, ${errStr.length} chars total)`;
      }

      if (code !== 0) {
        resolve({
          success: false,
          exit_code: code,
          stdout: outStr || '(no output)',
          stderr: errStr || `Process exited with code ${code}`,
          error: `Process exited with code ${code}`,
          command,
        });
        return;
      }

      resolve({
        success: true,
        exit_code: 0,
        stdout: outStr || '(no output)',
        stderr: errStr,
        command,
      });
    });

    proc.on('error', (error) => {
      if (isReaped) return;
      isReaped = true;
      clearTimeout(timer);
      resolve({
        success: false,
        exit_code: -1,
        stdout: outStr || '(no output)',
        stderr: error.message,
        error: error.message,
        command,
      });
    });
  });
}
