// Jarvis Cyber — MITRE ATT&CK & Cyber Kill Chain Framework Integration
// Provides structured tactical knowledge for AI-driven dynamic strategy planning

// ═══════════════════════════════════════════════════════════
// MITRE ATT&CK Enterprise Matrix — Tactics & Key Techniques
// ═══════════════════════════════════════════════════════════
export const MITRE_ATTACK = {
  tactics: [
    {
      id: 'TA0043', name: 'Reconnaissance',
      description: 'Gather information to plan future operations',
      techniques: [
        { id: 'T1595', name: 'Active Scanning', sub: ['T1595.001 Scanning IP Blocks', 'T1595.002 Vulnerability Scanning', 'T1595.003 Wordlist Scanning'] },
        { id: 'T1592', name: 'Gather Victim Host Information', sub: ['T1592.001 Hardware', 'T1592.002 Software', 'T1592.003 Firmware', 'T1592.004 Client Configurations'] },
        { id: 'T1589', name: 'Gather Victim Identity Information', sub: ['T1589.001 Credentials', 'T1589.002 Email Addresses', 'T1589.003 Employee Names'] },
        { id: 'T1590', name: 'Gather Victim Network Information', sub: ['T1590.001 Domain Properties', 'T1590.002 DNS', 'T1590.003 Network Trust Dependencies', 'T1590.004 Network Topology', 'T1590.005 IP Addresses', 'T1590.006 Network Security Appliances'] },
        { id: 'T1591', name: 'Gather Victim Org Information', sub: ['T1591.001 Determine Physical Locations', 'T1591.002 Business Relationships', 'T1591.003 Identify Business Tempo', 'T1591.004 Identify Roles'] },
        { id: 'T1593', name: 'Search Open Websites/Domains', sub: ['T1593.001 Social Media', 'T1593.002 Search Engines', 'T1593.003 Code Repositories'] },
        { id: 'T1594', name: 'Search Victim-Owned Websites' },
        { id: 'T1596', name: 'Search Open Technical Databases', sub: ['T1596.001 DNS/Passive DNS', 'T1596.002 WHOIS', 'T1596.003 Digital Certificates', 'T1596.004 CDNs', 'T1596.005 Scan Databases'] },
        { id: 'T1597', name: 'Search Closed Sources', sub: ['T1597.001 Threat Intel Vendors', 'T1597.002 Purchase Technical Data'] },
        { id: 'T1598', name: 'Phishing for Information', sub: ['T1598.001 Spearphishing Service', 'T1598.002 Spearphishing Attachment', 'T1598.003 Spearphishing Link'] },
      ],
      tools: ['nmap', 'masscan', 'subfinder', 'amass', 'shodan', 'censys', 'fofa', 'theHarvester', 'recon-ng', 'maltego', 'spiderfoot', 'dmitri', 'dnsenum', 'fierce', 'dnsrecon', 'whois', 'whatweb', 'wafw00f']
    },
    {
      id: 'TA0042', name: 'Resource Development',
      description: 'Establish resources to support operations',
      techniques: [
        { id: 'T1583', name: 'Acquire Infrastructure', sub: ['T1583.001 Domains', 'T1583.003 Virtual Private Server', 'T1583.004 Server', 'T1583.006 Web Services'] },
        { id: 'T1584', name: 'Compromise Infrastructure' },
        { id: 'T1587', name: 'Develop Capabilities', sub: ['T1587.001 Malware', 'T1587.002 Code Signing Certificates', 'T1587.003 Digital Certificates', 'T1587.004 Exploits'] },
        { id: 'T1588', name: 'Obtain Capabilities', sub: ['T1588.001 Malware', 'T1588.002 Tool', 'T1588.003 Code Signing Certificates', 'T1588.005 Exploits', 'T1588.006 Vulnerabilities'] },
        { id: 'T1585', name: 'Establish Accounts', sub: ['T1585.001 Social Media Accounts', 'T1585.002 Email Accounts'] },
        { id: 'T1586', name: 'Compromise Accounts' },
        { id: 'T1608', name: 'Stage Capabilities', sub: ['T1608.001 Upload Malware', 'T1608.002 Upload Tool', 'T1608.003 Install Digital Certificate', 'T1608.004 Drive-by Target', 'T1608.005 Link Target'] },
      ],
      tools: ['msfvenom', 'msfconsole', 'empire', 'covenant', 'sliver', 'cobalt-strike', 'veil', 'shellter', 'donut']
    },
    {
      id: 'TA0001', name: 'Initial Access',
      description: 'Gain initial foothold in target environment',
      techniques: [
        { id: 'T1190', name: 'Exploit Public-Facing Application' },
        { id: 'T1133', name: 'External Remote Services' },
        { id: 'T1200', name: 'Hardware Additions' },
        { id: 'T1566', name: 'Phishing', sub: ['T1566.001 Spearphishing Attachment', 'T1566.002 Spearphishing Link', 'T1566.003 Spearphishing via Service'] },
        { id: 'T1091', name: 'Replication Through Removable Media' },
        { id: 'T1195', name: 'Supply Chain Compromise' },
        { id: 'T1199', name: 'Trusted Relationship' },
        { id: 'T1078', name: 'Valid Accounts', sub: ['T1078.001 Default Accounts', 'T1078.002 Domain Accounts', 'T1078.003 Local Accounts', 'T1078.004 Cloud Accounts'] },
        { id: 'T1189', name: 'Drive-by Compromise' },
      ],
      tools: ['sqlmap', 'nuclei', 'nikto', 'burpsuite', 'zap', 'wpscan', 'joomscan', 'hydra', 'medusa', 'metasploit', 'beef-xss', 'gophish', 'social-engineer-toolkit']
    },
    {
      id: 'TA0002', name: 'Execution',
      description: 'Run adversary-controlled code on target',
      techniques: [
        { id: 'T1059', name: 'Command and Scripting Interpreter', sub: ['T1059.001 PowerShell', 'T1059.002 AppleScript', 'T1059.003 Windows CMD', 'T1059.004 Unix Shell', 'T1059.005 Visual Basic', 'T1059.006 Python', 'T1059.007 JavaScript'] },
        { id: 'T1203', name: 'Exploitation for Client Execution' },
        { id: 'T1559', name: 'Inter-Process Communication' },
        { id: 'T1106', name: 'Native API' },
        { id: 'T1053', name: 'Scheduled Task/Job', sub: ['T1053.003 Cron', 'T1053.005 Scheduled Task'] },
        { id: 'T1129', name: 'Shared Modules' },
        { id: 'T1072', name: 'Software Deployment Tools' },
        { id: 'T1204', name: 'User Execution', sub: ['T1204.001 Malicious Link', 'T1204.002 Malicious File'] },
        { id: 'T1047', name: 'Windows Management Instrumentation' },
      ],
      tools: ['metasploit', 'powershell-empire', 'evil-winrm', 'psexec', 'wmiexec', 'smbexec', 'dcomexec', 'atexec', 'crackmapexec']
    },
    {
      id: 'TA0003', name: 'Persistence',
      description: 'Maintain foothold across restarts and credential changes',
      techniques: [
        { id: 'T1098', name: 'Account Manipulation' },
        { id: 'T1136', name: 'Create Account', sub: ['T1136.001 Local Account', 'T1136.002 Domain Account', 'T1136.003 Cloud Account'] },
        { id: 'T1543', name: 'Create or Modify System Process', sub: ['T1543.001 Launch Agent', 'T1543.002 Systemd Service', 'T1543.003 Windows Service'] },
        { id: 'T1546', name: 'Event Triggered Execution', sub: ['T1546.001 Change Default File Association', 'T1546.004 Unix Shell Config Modification', 'T1546.008 Accessibility Features'] },
        { id: 'T1133', name: 'External Remote Services' },
        { id: 'T1574', name: 'Hijack Execution Flow', sub: ['T1574.001 DLL Search Order Hijacking', 'T1574.002 DLL Side-Loading'] },
        { id: 'T1053', name: 'Scheduled Task/Job' },
        { id: 'T1505', name: 'Server Software Component', sub: ['T1505.003 Web Shell'] },
        { id: 'T1078', name: 'Valid Accounts' },
      ],
      tools: ['metasploit', 'empire', 'sliver', 'weevely', 'webshell', 'pspy', 'crontab']
    },
    {
      id: 'TA0004', name: 'Privilege Escalation',
      description: 'Gain higher-level permissions on target system',
      techniques: [
        { id: 'T1548', name: 'Abuse Elevation Control Mechanism', sub: ['T1548.001 Setuid and Setgid', 'T1548.002 Bypass UAC', 'T1548.003 Sudo and Sudo Caching'] },
        { id: 'T1134', name: 'Access Token Manipulation' },
        { id: 'T1068', name: 'Exploitation for Privilege Escalation' },
        { id: 'T1574', name: 'Hijack Execution Flow' },
        { id: 'T1055', name: 'Process Injection', sub: ['T1055.001 DLL Injection', 'T1055.003 Thread Execution Hijacking', 'T1055.008 Ptrace System Calls'] },
        { id: 'T1053', name: 'Scheduled Task/Job' },
        { id: 'T1078', name: 'Valid Accounts' },
      ],
      tools: ['linpeas', 'winpeas', 'linenum', 'linux-exploit-suggester', 'windows-exploit-suggester', 'pspy', 'gtfobins', 'lolbas', 'beroot', 'sherlock', 'watson', 'juicypotato', 'printspoofer', 'godpotato', 'sudo-killer']
    },
    {
      id: 'TA0005', name: 'Defense Evasion',
      description: 'Avoid detection throughout the operation',
      techniques: [
        { id: 'T1140', name: 'Deobfuscate/Decode Files or Information' },
        { id: 'T1070', name: 'Indicator Removal', sub: ['T1070.001 Clear Windows Event Logs', 'T1070.002 Clear Linux/Mac Logs', 'T1070.003 Clear Command History', 'T1070.004 File Deletion', 'T1070.006 Timestomp'] },
        { id: 'T1036', name: 'Masquerading', sub: ['T1036.003 Rename System Utilities', 'T1036.005 Match Legitimate Name or Location'] },
        { id: 'T1027', name: 'Obfuscated Files or Information', sub: ['T1027.001 Binary Padding', 'T1027.002 Software Packing', 'T1027.005 Indicator Removal from Tools'] },
        { id: 'T1055', name: 'Process Injection' },
        { id: 'T1218', name: 'System Binary Proxy Execution', sub: ['T1218.005 Mshta', 'T1218.010 Regsvr32', 'T1218.011 Rundll32'] },
        { id: 'T1497', name: 'Virtualization/Sandbox Evasion' },
      ],
      tools: ['veil', 'shellter', 'msfvenom', 'upx', 'themida', 'donut', 'scarecrow', 'nimcrypt2', 'inceptor', 'proxychains', 'tor', 'anonsurf']
    },
    {
      id: 'TA0006', name: 'Credential Access',
      description: 'Steal credentials for lateral movement',
      techniques: [
        { id: 'T1110', name: 'Brute Force', sub: ['T1110.001 Password Guessing', 'T1110.002 Password Cracking', 'T1110.003 Password Spraying', 'T1110.004 Credential Stuffing'] },
        { id: 'T1003', name: 'OS Credential Dumping', sub: ['T1003.001 LSASS Memory', 'T1003.002 Security Account Manager', 'T1003.003 NTDS', 'T1003.004 LSA Secrets', 'T1003.005 Cached Domain Credentials', 'T1003.006 DCSync', 'T1003.007 Proc Filesystem', 'T1003.008 /etc/passwd and /etc/shadow'] },
        { id: 'T1555', name: 'Credentials from Password Stores', sub: ['T1555.001 Keychain', 'T1555.003 Credentials from Web Browsers', 'T1555.004 Windows Credential Manager'] },
        { id: 'T1056', name: 'Input Capture', sub: ['T1056.001 Keylogging', 'T1056.002 GUI Input Capture'] },
        { id: 'T1557', name: 'Adversary-in-the-Middle', sub: ['T1557.001 LLMNR/NBT-NS Poisoning and SMB Relay'] },
        { id: 'T1558', name: 'Steal or Forge Kerberos Tickets', sub: ['T1558.001 Golden Ticket', 'T1558.002 Silver Ticket', 'T1558.003 Kerberoasting', 'T1558.004 AS-REP Roasting'] },
        { id: 'T1552', name: 'Unsecured Credentials', sub: ['T1552.001 Credentials In Files', 'T1552.002 Credentials in Registry', 'T1552.004 Private Keys', 'T1552.006 Group Policy Preferences'] },
      ],
      tools: ['hashcat', 'john', 'hydra', 'medusa', 'mimikatz', 'secretsdump', 'responder', 'crackmapexec', 'bloodhound', 'rubeus', 'kerbrute', 'lazagne', 'truffleHog', 'cewl', 'crunch']
    },
    {
      id: 'TA0007', name: 'Discovery',
      description: 'Explore the environment to understand the target',
      techniques: [
        { id: 'T1087', name: 'Account Discovery', sub: ['T1087.001 Local Account', 'T1087.002 Domain Account', 'T1087.003 Email Account', 'T1087.004 Cloud Account'] },
        { id: 'T1482', name: 'Domain Trust Discovery' },
        { id: 'T1083', name: 'File and Directory Discovery' },
        { id: 'T1046', name: 'Network Service Discovery' },
        { id: 'T1135', name: 'Network Share Discovery' },
        { id: 'T1201', name: 'Password Policy Discovery' },
        { id: 'T1069', name: 'Permission Groups Discovery' },
        { id: 'T1057', name: 'Process Discovery' },
        { id: 'T1018', name: 'Remote System Discovery' },
        { id: 'T1518', name: 'Software Discovery' },
        { id: 'T1082', name: 'System Information Discovery' },
        { id: 'T1016', name: 'System Network Configuration Discovery' },
        { id: 'T1049', name: 'System Network Connections Discovery' },
        { id: 'T1033', name: 'System Owner/User Discovery' },
      ],
      tools: ['nmap', 'enum4linux', 'smbclient', 'rpcclient', 'ldapsearch', 'bloodhound', 'adidnsdump', 'crackmapexec', 'powerview', 'sharphound', 'ping', 'arp-scan', 'netdiscover']
    },
    {
      id: 'TA0008', name: 'Lateral Movement',
      description: 'Move through the environment to reach target assets',
      techniques: [
        { id: 'T1210', name: 'Exploitation of Remote Services' },
        { id: 'T1534', name: 'Internal Spearphishing' },
        { id: 'T1570', name: 'Lateral Tool Transfer' },
        { id: 'T1021', name: 'Remote Services', sub: ['T1021.001 Remote Desktop Protocol', 'T1021.002 SMB/Windows Admin Shares', 'T1021.003 DCOM', 'T1021.004 SSH', 'T1021.005 VNC', 'T1021.006 Windows Remote Management'] },
        { id: 'T1080', name: 'Taint Shared Content' },
        { id: 'T1550', name: 'Use Alternate Authentication Material', sub: ['T1550.001 Application Access Token', 'T1550.002 Pass the Hash', 'T1550.003 Pass the Ticket', 'T1550.004 Web Session Cookie'] },
      ],
      tools: ['psexec', 'wmiexec', 'smbexec', 'evil-winrm', 'crackmapexec', 'chisel', 'ligolo-ng', 'sshuttle', 'proxychains', 'rpivot', 'xfreerdp', 'rdesktop', 'pth-winexe']
    },
    {
      id: 'TA0009', name: 'Collection',
      description: 'Gather target data of interest',
      techniques: [
        { id: 'T1560', name: 'Archive Collected Data', sub: ['T1560.001 Archive via Utility'] },
        { id: 'T1005', name: 'Data from Local System' },
        { id: 'T1039', name: 'Data from Network Shared Drive' },
        { id: 'T1025', name: 'Data from Removable Media' },
        { id: 'T1074', name: 'Data Staged', sub: ['T1074.001 Local Data Staging', 'T1074.002 Remote Data Staging'] },
        { id: 'T1114', name: 'Email Collection' },
        { id: 'T1056', name: 'Input Capture' },
        { id: 'T1113', name: 'Screen Capture' },
      ],
      tools: ['smbclient', 'impacket', 'sharphound', 'powershell', 'tar', 'zip', '7z']
    },
    {
      id: 'TA0011', name: 'Command and Control',
      description: 'Communicate with compromised systems',
      techniques: [
        { id: 'T1071', name: 'Application Layer Protocol', sub: ['T1071.001 Web Protocols', 'T1071.002 File Transfer Protocols', 'T1071.003 Mail Protocols', 'T1071.004 DNS'] },
        { id: 'T1132', name: 'Data Encoding' },
        { id: 'T1001', name: 'Data Obfuscation' },
        { id: 'T1568', name: 'Dynamic Resolution', sub: ['T1568.002 Domain Generation Algorithms'] },
        { id: 'T1573', name: 'Encrypted Channel', sub: ['T1573.001 Symmetric Cryptography', 'T1573.002 Asymmetric Cryptography'] },
        { id: 'T1008', name: 'Fallback Channels' },
        { id: 'T1105', name: 'Ingress Tool Transfer' },
        { id: 'T1104', name: 'Multi-Stage Channels' },
        { id: 'T1572', name: 'Protocol Tunneling' },
        { id: 'T1090', name: 'Proxy', sub: ['T1090.001 Internal Proxy', 'T1090.002 External Proxy', 'T1090.003 Multi-hop Proxy'] },
        { id: 'T1102', name: 'Web Service' },
      ],
      tools: ['metasploit', 'empire', 'sliver', 'covenant', 'havoc', 'chisel', 'ligolo-ng', 'socat', 'ncat', 'dnscat2', 'iodine', 'ptunnel', 'stunnel']
    },
    {
      id: 'TA0010', name: 'Exfiltration',
      description: 'Steal data from the target environment',
      techniques: [
        { id: 'T1041', name: 'Exfiltration Over C2 Channel' },
        { id: 'T1011', name: 'Exfiltration Over Other Network Medium' },
        { id: 'T1048', name: 'Exfiltration Over Alternative Protocol', sub: ['T1048.001 Exfiltration Over Symmetric Encrypted Non-C2', 'T1048.002 Exfiltration Over Asymmetric Encrypted Non-C2', 'T1048.003 Exfiltration Over Unencrypted Non-C2'] },
        { id: 'T1567', name: 'Exfiltration Over Web Service', sub: ['T1567.002 Exfiltration to Cloud Storage'] },
        { id: 'T1029', name: 'Scheduled Transfer' },
        { id: 'T1537', name: 'Transfer Data to Cloud Account' },
      ],
      tools: ['curl', 'wget', 'scp', 'rsync', 'rclone', 'dnscat2', 'dns2tcp', 'cloakify']
    },
    {
      id: 'TA0040', name: 'Impact',
      description: 'Manipulate, interrupt, or destroy systems and data',
      techniques: [
        { id: 'T1485', name: 'Data Destruction' },
        { id: 'T1486', name: 'Data Encrypted for Impact' },
        { id: 'T1565', name: 'Data Manipulation' },
        { id: 'T1491', name: 'Defacement', sub: ['T1491.001 Internal Defacement', 'T1491.002 External Defacement'] },
        { id: 'T1499', name: 'Endpoint Denial of Service' },
        { id: 'T1498', name: 'Network Denial of Service' },
        { id: 'T1496', name: 'Resource Hijacking' },
        { id: 'T1489', name: 'Service Stop' },
        { id: 'T1529', name: 'System Shutdown/Reboot' },
      ],
      tools: ['metasploit', 'hping3', 'slowloris', 'goldeneye']
    },
  ],
};

// ═══════════════════════════════════════════════════════════
// Lockheed Martin Cyber Kill Chain
// ═══════════════════════════════════════════════════════════
export const CYBER_KILL_CHAIN = {
  phases: [
    {
      id: 1, name: 'Reconnaissance',
      description: 'Research, identify, and select targets. Harvest email addresses, social media, conference info, passive network analysis.',
      mitre_tactics: ['TA0043'],
      objectives: [
        'Identify target organization and personnel',
        'Map external-facing infrastructure (domains, IPs, subdomains)',
        'Discover technology stack and services',
        'Find email addresses and social media accounts',
        'Enumerate DNS records, WHOIS data, SSL certificates',
        'Search for data leaks and exposed credentials',
      ],
      tool_categories: ['information-gathering', 'osint', 'reconnaissance', 'subdomain-discovery', 'dns-toolkit'],
    },
    {
      id: 2, name: 'Weaponization',
      description: 'Create attack tools: couple exploit with backdoor into deliverable payload.',
      mitre_tactics: ['TA0042'],
      objectives: [
        'Select or develop exploits for discovered vulnerabilities',
        'Generate evasive payloads (encoded, obfuscated, polymorphic)',
        'Prepare C2 infrastructure and communication channels',
        'Build custom tools for specific target environment',
        'Create phishing campaigns and social engineering pretexts',
      ],
      tool_categories: ['exploitation', 'payload-generation', 'c2-frameworks', 'social-engineering'],
    },
    {
      id: 3, name: 'Delivery',
      description: 'Transmit weapon to target environment via email, web, USB, etc.',
      mitre_tactics: ['TA0001'],
      objectives: [
        'Deliver exploit via identified attack vector',
        'Exploit public-facing application vulnerabilities',
        'Execute social engineering attacks',
        'Leverage trusted relationships or supply chain',
        'Deploy drive-by or watering hole attacks',
      ],
      tool_categories: ['web-exploitation', 'phishing', 'exploit-frameworks'],
    },
    {
      id: 4, name: 'Exploitation',
      description: 'Trigger exploit code on victim system to gain execution.',
      mitre_tactics: ['TA0002'],
      objectives: [
        'Execute exploit against target vulnerability',
        'Achieve code execution on target system',
        'Bypass security controls (WAF, IPS, AV, EDR)',
        'Establish initial foothold',
      ],
      tool_categories: ['exploitation', 'web-exploitation', 'vulnerability-scanner'],
    },
    {
      id: 5, name: 'Installation',
      description: 'Install persistent backdoor/implant on victim system.',
      mitre_tactics: ['TA0003', 'TA0004'],
      objectives: [
        'Install persistent access mechanism',
        'Escalate privileges to root/SYSTEM',
        'Deploy web shells, reverse shells, or implants',
        'Establish persistence across reboots',
        'Evade detection by security tools',
      ],
      tool_categories: ['post-exploitation', 'privilege-escalation', 'persistence'],
    },
    {
      id: 6, name: 'Command and Control',
      description: 'Establish reliable C2 channel for remote control.',
      mitre_tactics: ['TA0011'],
      objectives: [
        'Establish encrypted C2 communication',
        'Set up tunneling and pivoting infrastructure',
        'Configure fallback C2 channels',
        'Maintain stealth communication',
      ],
      tool_categories: ['c2-frameworks', 'tunneling', 'proxy'],
    },
    {
      id: 7, name: 'Actions on Objectives',
      description: 'Execute final mission objectives: data exfil, destruction, or lateral movement.',
      mitre_tactics: ['TA0007', 'TA0008', 'TA0009', 'TA0010', 'TA0040'],
      objectives: [
        'Discover internal assets and network topology',
        'Move laterally to high-value targets',
        'Harvest credentials and sensitive data',
        'Access critical systems and databases',
        'Exfiltrate data through established channels',
        'Achieve final operational objectives',
      ],
      tool_categories: ['lateral-movement', 'credential-access', 'discovery', 'exfiltration'],
    },
  ],
};

// ═══════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════

/**
 * Get all MITRE ATT&CK techniques applicable to a given set of findings
 * @param {Object} findings - Reconnaissance findings (ports, services, tech stack)
 * @returns {Array} Applicable techniques with tool suggestions
 */
export function mapFindingsToTechniques(findings) {
  const applicable = [];
  const { ports = [], services = [], techStack = [], os = '', hasWebApp = false, hasAD = false, hasWifi = false, hasClouds = false } = findings;

  for (const tactic of MITRE_ATTACK.tactics) {
    const matchedTechniques = [];

    // Map based on discovered environment
    if (tactic.id === 'TA0001') { // Initial Access
      if (hasWebApp) matchedTechniques.push('T1190');
      if (services.some(s => /ssh|rdp|vnc|ftp|telnet/i.test(s))) matchedTechniques.push('T1133');
      if (services.some(s => /smtp|imap|pop3/i.test(s))) matchedTechniques.push('T1566');
    }
    if (tactic.id === 'TA0004') { // PrivEsc
      if (os.toLowerCase().includes('linux')) matchedTechniques.push('T1548'); // SUID
      if (os.toLowerCase().includes('windows')) matchedTechniques.push('T1134'); // Token manipulation
    }
    if (tactic.id === 'TA0006') { // Credential Access
      if (hasAD) matchedTechniques.push('T1558', 'T1003'); // Kerberos + credential dumping
      if (services.some(s => /smb|ldap/i.test(s))) matchedTechniques.push('T1557'); // MITM
    }
    if (tactic.id === 'TA0008') { // Lateral Movement
      if (services.some(s => /smb/i.test(s))) matchedTechniques.push('T1021');
      if (services.some(s => /ssh/i.test(s))) matchedTechniques.push('T1021');
      if (services.some(s => /rdp/i.test(s))) matchedTechniques.push('T1021');
    }

    if (matchedTechniques.length > 0 || tactic.id === 'TA0043') { // Always include recon
      applicable.push({
        tactic: tactic.name,
        tacticId: tactic.id,
        techniques: matchedTechniques,
        suggestedTools: tactic.tools,
      });
    }
  }

  return applicable;
}

/**
 * Get the current Cyber Kill Chain phase based on completed actions
 * @param {Array} completedActions - List of completed action types
 * @returns {Object} Current and next phase information
 */
export function getCurrentKillChainPhase(completedActions = []) {
  const actionPhaseMap = {
    'recon': 1, 'scan': 1, 'osint': 1, 'enumerate': 1,
    'payload': 2, 'weaponize': 2, 'generate': 2,
    'deliver': 3, 'phish': 3, 'exploit_attempt': 3,
    'exploit': 4, 'execute': 4, 'rce': 4,
    'persist': 5, 'install': 5, 'backdoor': 5, 'privesc': 5,
    'c2': 6, 'tunnel': 6, 'beacon': 6,
    'lateral': 7, 'exfil': 7, 'pivot': 7, 'dump': 7,
  };

  let maxPhase = 1;
  for (const action of completedActions) {
    const phase = actionPhaseMap[action.toLowerCase()] || 1;
    if (phase > maxPhase) maxPhase = phase;
  }

  const current = CYBER_KILL_CHAIN.phases.find(p => p.id === maxPhase);
  const next = CYBER_KILL_CHAIN.phases.find(p => p.id === maxPhase + 1);

  return { current, next, phaseNumber: maxPhase };
}

/**
 * Build a framework-aware context string for the system prompt
 * @returns {string} Formatted context for AI consumption
 */
export function buildFrameworkContext() {
  let ctx = '\n\n## STRATEGIC FRAMEWORKS\n\n';

  ctx += '### MITRE ATT&CK Enterprise Matrix\n';
  ctx += 'Map EVERY action to the appropriate ATT&CK tactic and technique. Reference technique IDs (e.g., T1190) in your strategy.\n\n';
  ctx += '| Tactic | Key Techniques | Tools |\n|--------|---------------|-------|\n';
  for (const tactic of MITRE_ATTACK.tactics) {
    const topTechniques = tactic.techniques.slice(0, 3).map(t => `${t.id} ${t.name}`).join(', ');
    const topTools = tactic.tools.slice(0, 5).join(', ');
    ctx += `| ${tactic.name} | ${topTechniques} | ${topTools} |\n`;
  }

  ctx += '\n### Cyber Kill Chain Methodology\n';
  ctx += 'Follow the Kill Chain phases sequentially. Never skip phases without justification.\n\n';
  for (const phase of CYBER_KILL_CHAIN.phases) {
    ctx += `**Phase ${phase.id}: ${phase.name}** — ${phase.description}\n`;
  }

  ctx += '\n### DYNAMIC STRATEGY PROTOCOL\n';
  ctx += '1. ALWAYS start with Reconnaissance (Kill Chain Phase 1, ATT&CK TA0043)\n';
  ctx += '2. Analyze findings and MAP to ATT&CK techniques before proceeding\n';
  ctx += '3. SELECT tools dynamically based on discovered environment — never use a static checklist\n';
  ctx += '4. ADAPT strategy based on live results — pivot when blocked\n';
  ctx += '5. If a tool is missing, use install_tool to acquire it automatically\n';
  ctx += '6. DOCUMENT every action with the ATT&CK technique ID it maps to\n';
  ctx += '7. After exploitation, follow post-exploitation Kill Chain phases systematically\n';

  return ctx;
}
