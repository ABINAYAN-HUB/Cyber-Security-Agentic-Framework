// Jarvis Cyber — Auto-Learning Cyber Intelligence Engine (MAXED OUT)
// Fetches from 20+ sources with maximum limits
// Runs 24/7 — every 30 minutes when OS is on
import { memory } from './memory.js';
import config from './config.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Safe fetch with timeout and error handling
async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60000), ...opts });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function safeFetchText(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
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
    // Reset per-run counters
    this.stats.cves = 0;
    this.stats.exploits = 0;
    this.stats.threats = 0;
    this.stats.tools = 0;
    const start = Date.now();
    console.log(`\n🧠 [AutoLearner] Starting MAXIMUM cyber intelligence collection... (Run #${this.stats.total_runs})`);
    console.log('   Fetching from 20+ sources with maximum limits...\n');

    try {
      memory.init();

      // ═══ TIER 1: Core Vulnerability Intelligence ═══
      await this.fetchNVDCVEs();           // NVD — 2000 CVEs
      await sleep(1500);
      await this.fetchCISAKEV();           // CISA — ALL known exploited vulns
      await sleep(1500);
      await this.fetchGitHubAdvisories();  // GitHub — 100 advisories
      await sleep(1500);
      await this.fetchEPSSScores();        // FIRST.org — Exploit Prediction Scores
      await sleep(1500);

      // ═══ TIER 2: Exploit Intelligence ═══
      await this.fetchExploitDB();         // Exploit-DB — 200 exploits
      await sleep(1500);
      await this.fetchInTheWild();         // InTheWild.io — Exploits actively used
      await sleep(1500);
      await this.fetchPacketStorm();       // PacketStorm Security — Latest exploits
      await sleep(1500);
      await this.fetchVulners();           // Vulners.com — Vuln aggregator
      await sleep(1500);

      // ═══ TIER 3: Malware & IOC Intelligence ═══
      await this.fetchThreatFeeds();       // abuse.ch Malware+URLs+IOCs (maxed)
      await sleep(1500);
      await this.fetchFeodoTracker();      // abuse.ch — Botnet C2 servers
      await sleep(1500);
      await this.fetchSSLBlacklist();      // abuse.ch — Malicious SSL certs
      await sleep(1500);

      // ═══ TIER 4: Phishing & URL Intelligence ═══
      await this.fetchOpenPhish();         // OpenPhish — Phishing URLs
      await sleep(1500);
      await this.fetchPhishTank();         // PhishTank — Verified phishing sites
      await sleep(1500);
      await this.fetchURLScanIO();         // URLScan.io — Recent scans
      await sleep(1500);

      // ═══ TIER 5: Attack Patterns & Frameworks ═══
      await this.fetchMITRECAPEC();        // MITRE CAPEC — Attack patterns
      await sleep(1000);
      await this.learnCyberTools();        // 25+ tool knowledge entries
      await sleep(1000);
      await this.fetchNucleiTemplateInfo();// Nuclei template stats
      await sleep(1000);
      await this.fetchRecentNucleiTemplates(); // Recent CVE templates
      await sleep(1000);

      // ═══ TIER 6: News & Advisories ═══
      await this.fetchSecurityNews();      // HackerNews — 50 stories
      await sleep(1000);
      await this.fetchCISAAlerts();        // CISA Alerts & Advisories
      await sleep(1000);
      await this.fetchRansomwareTracker(); // Ransomware group tracking
      await sleep(1000);

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`\n✅ [AutoLearner] COMPLETE in ${elapsed}s — CVEs: ${this.stats.cves}, Exploits: ${this.stats.exploits}, Threats: ${this.stats.threats}, Tools: ${this.stats.tools}`);
    } catch (err) {
      console.error(`❌ [AutoLearner] Error: ${err.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  // ═══════════════════════════════════════════════
  // TIER 1: CORE VULNERABILITY INTELLIGENCE
  // ═══════════════════════════════════════════════

  // ═══ NVD CVEs — MAXED to 2000 per fetch ═══
  async fetchNVDCVEs() {
    console.log('  📡 [1/20] Fetching CVEs from NVD (max 2000)...');
    const batchId = `nvd-${new Date().toISOString().slice(0, 13)}`;
    if (memory.isLearned('nvd', batchId)) { console.log('    ⏩ Already fetched this hour'); return; }

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const pubStart = weekAgo.toISOString().replace(/\.\d{3}Z/, '');
    const pubEnd = now.toISOString().replace(/\.\d{3}Z/, '');

    // Fetch max 2000 CVEs (NVD API limit)
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${pubStart}&pubEndDate=${pubEnd}&resultsPerPage=2000`;
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
      const refs = cve.references?.map(r => r.url)?.slice(0, 10) || [];
      const affected = cve.configurations?.map(c => c.nodes?.map(n => n.cpeMatch?.map(m => m.criteria))?.flat())?.flat()?.filter(Boolean)?.slice(0, 20) || [];

      memory.storeThreatIntel('cve', cve.id, {
        title: cve.id,
        description: desc.slice(0, 2000),
        severity,
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

  // ═══ CISA KEV — ALL known exploited vulnerabilities ═══
  async fetchCISAKEV() {
    console.log('  📡 [2/20] Fetching ALL CISA Known Exploited Vulnerabilities...');
    const batchId = `cisa-kev-${new Date().toISOString().slice(0, 10)}`;
    if (memory.isLearned('cisa', batchId)) { console.log('    ⏩ Already fetched today'); return; }

    const data = await safeFetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
    if (!data?.vulnerabilities) { console.log('    ⚠️ CISA KEV unavailable'); return; }

    let count = 0;
    // NO LIMIT — fetch ALL entries
    for (const vuln of data.vulnerabilities) {
      memory.storeThreatIntel('kev', vuln.cveID, {
        title: `${vuln.cveID}: ${vuln.vulnerabilityName}`,
        description: `${vuln.shortDescription}. Vendor: ${vuln.vendorProject}. Product: ${vuln.product}. Required Action: ${vuln.requiredAction}. Due Date: ${vuln.dueDate}`,
        severity: 'CRITICAL',
        source: 'cisa-kev',
        published_at: vuln.dateAdded
      });
      count++;
    }
    this.stats.threats += count;
    memory.markLearned('cisa', batchId, 'kev_batch', count);
    console.log(`    ✅ Stored ${count} KEV entries (FULL catalog)`);
  }

  // ═══ GitHub Security Advisories — 100 per page ═══
  async fetchGitHubAdvisories() {
    console.log('  📡 [3/20] Fetching GitHub Security Advisories (100)...');
    const batchId = `ghsa-${new Date().toISOString().slice(0, 13)}`;
    if (memory.isLearned('github-advisories', batchId)) { console.log('    ⏩ Already fetched this hour'); return; }

    const data = await safeFetch('https://api.github.com/advisories?per_page=100&type=reviewed');
    if (!data || !Array.isArray(data)) { console.log('    ⚠️ GitHub Advisories API unavailable'); return; }

    let count = 0;
    for (const adv of data) {
      const cveId = adv.cve_id || adv.ghsa_id;
      memory.storeThreatIntel('advisory', cveId, {
        title: `${cveId}: ${adv.summary || ''}`.slice(0, 300),
        description: (adv.description || '').slice(0, 2000),
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

  // ═══ NEW: EPSS Scores — Exploit Prediction Scoring System ═══
  async fetchEPSSScores() {
    console.log('  📡 [4/20] Fetching EPSS exploit prediction scores (FIRST.org)...');
    const batchId = `epss-${new Date().toISOString().slice(0, 10)}`;
    if (memory.isLearned('epss', batchId)) { console.log('    ⏩ Already fetched today'); return; }

    // Fetch top 100 most likely to be exploited CVEs
    const data = await safeFetch('https://api.first.org/data/v1/epss?order=!epss&limit=200');
    if (!data?.data) { console.log('    ⚠️ EPSS API unavailable'); return; }

    let count = 0;
    for (const entry of data.data) {
      const epssScore = parseFloat(entry.epss) || 0;
      const percentile = parseFloat(entry.percentile) || 0;
      memory.storeThreatIntel('epss', entry.cve, {
        title: `${entry.cve} — EPSS: ${(epssScore * 100).toFixed(1)}% exploit probability`,
        description: `Exploit Prediction: ${(epssScore * 100).toFixed(2)}% chance of exploitation in next 30 days. Percentile: ${(percentile * 100).toFixed(1)}%. Date: ${entry.date}`,
        severity: epssScore >= 0.5 ? 'CRITICAL' : epssScore >= 0.1 ? 'HIGH' : epssScore >= 0.01 ? 'MEDIUM' : 'LOW',
        cvss_score: epssScore * 10,
        source: 'first-epss',
        published_at: entry.date
      });
      count++;
    }
    this.stats.cves += count;
    memory.markLearned('epss', batchId, 'epss_batch', count);
    console.log(`    ✅ Stored ${count} EPSS exploit predictions`);
  }

  // ═══════════════════════════════════════════════
  // TIER 2: EXPLOIT INTELLIGENCE
  // ═══════════════════════════════════════════════

  // ═══ Exploit-DB — Maxed to 200 ═══
  async fetchExploitDB() {
    console.log('  📡 [5/20] Fetching exploits from Exploit-DB (max 200)...');
    const batchId = `edb-${new Date().toISOString().slice(0, 13)}`;
    if (memory.isLearned('exploit-db', batchId)) { console.log('    ⏩ Already fetched this hour'); return; }

    // Try GitLab API first
    const data = await safeFetch('https://gitlab.com/api/v4/projects/exploit-database%2Fexploitdb/repository/tree?path=exploits&per_page=100&order_by=updated_at');
    if (!data || !Array.isArray(data)) {
      // Fallback: Exploit-DB RSS
      const rssText = await safeFetchText('https://www.exploit-db.com/rss.xml');
      if (!rssText) { console.log('    ⚠️ Exploit-DB unavailable'); return; }

      const items = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
      let count = 0;
      for (const item of items) {
        const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
        const desc = item.match(/<description>(.*?)<\/description>/)?.[1] || '';
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
        const edbId = link.match(/\/(\d+)/)?.[1] || `edb-${count}`;

        memory.storeExploit(`EDB-${edbId}`, {
          title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
          description: desc.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').slice(0, 1000),
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

  // ═══ NEW: InTheWild.io — Exploits actively being used ═══
  async fetchInTheWild() {
    console.log('  📡 [6/20] Fetching actively exploited vulns (InTheWild.io)...');
    const batchId = `inthewild-${new Date().toISOString().slice(0, 10)}`;
    if (memory.isLearned('inthewild', batchId)) { console.log('    ⏩ Already fetched today'); return; }

    const data = await safeFetch('https://raw.githubusercontent.com/gmatuz/inthewilddb/main/inthewild.json');
    if (!data || !Array.isArray(data)) { console.log('    ⚠️ InTheWild unavailable'); return; }

    let count = 0;
    for (const entry of data.slice(0, 500)) {
      const cveId = entry.id || entry.cve;
      if (!cveId) continue;
      memory.storeThreatIntel('exploit_wild', cveId, {
        title: `${cveId} — Exploited in the Wild`,
        description: `Confirmed exploitation in the wild. Source: ${entry.source || 'unknown'}. Date: ${entry.date || 'unknown'}. ${entry.description || ''}`.slice(0, 1000),
        severity: 'CRITICAL',
        source: 'inthewild',
        published_at: entry.date || null
      });
      count++;
    }
    this.stats.exploits += count;
    memory.markLearned('inthewild', batchId, 'wild_exploit_batch', count);
    console.log(`    ✅ Stored ${count} in-the-wild exploits`);
  }

  // ═══ NEW: PacketStorm Security — Latest exploits via RSS ═══
  async fetchPacketStorm() {
    console.log('  📡 [7/20] Fetching PacketStorm Security exploits...');
    const batchId = `packetstorm-${new Date().toISOString().slice(0, 13)}`;
    if (memory.isLearned('packetstorm', batchId)) { console.log('    ⏩ Already fetched this hour'); return; }

    const rssText = await safeFetchText('https://rss.packetstormsecurity.com/files/tags/exploit/');
    if (!rssText) { console.log('    ⚠️ PacketStorm RSS unavailable'); return; }

    const items = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
    let count = 0;
    for (const item of items) {
      const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const desc = item.match(/<description>(.*?)<\/description>/)?.[1] || '';
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      const id = link.match(/\/files\/(\d+)/)?.[1] || `ps-${count}`;

      memory.storeExploit(`PS-${id}`, {
        title: cleanTitle,
        description: desc.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').slice(0, 1000),
        source_url: link,
        source: 'packetstorm',
        published_at: pubDate
      });
      count++;
    }
    this.stats.exploits += count;
    memory.markLearned('packetstorm', batchId, 'packetstorm_batch', count);
    console.log(`    ✅ Stored ${count} PacketStorm exploits`);
  }

  // ═══ NEW: Vulners.com — Vulnerability aggregator ═══
  async fetchVulners() {
    console.log('  📡 [8/20] Fetching Vulners.com vulnerability feed...');
    const batchId = `vulners-${new Date().toISOString().slice(0, 13)}`;
    if (memory.isLearned('vulners', batchId)) { console.log('    ⏩ Already fetched this hour'); return; }

    // Vulners new bulletins RSS
    const rssText = await safeFetchText('https://vulners.com/rss.xml');
    if (!rssText) { console.log('    ⚠️ Vulners RSS unavailable'); return; }

    const items = rssText.match(/<item>[\s\S]*?<\/item>/g) || [];
    let count = 0;
    for (const item of items.slice(0, 200)) {
      const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const desc = item.match(/<description>(.*?)<\/description>/)?.[1] || '';
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').trim();

      const cves = cleanTitle.match(/CVE-\d{4}-\d{4,}/g) || [];
      const id = cves[0] || `VLN-${count}`;

      memory.storeThreatIntel('vuln_bulletin', id, {
        title: cleanTitle.slice(0, 300),
        description: desc.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').slice(0, 1000),
        severity: cleanTitle.toLowerCase().includes('critical') ? 'CRITICAL' : cleanTitle.toLowerCase().includes('high') ? 'HIGH' : 'MEDIUM',
        source: 'vulners',
        published_at: pubDate
      });
      count++;
    }
    this.stats.cves += count;
    memory.markLearned('vulners', batchId, 'vulners_batch', count);
    console.log(`    ✅ Stored ${count} Vulners bulletins`);
  }

  // ═══════════════════════════════════════════════
  // TIER 3: MALWARE & IOC INTELLIGENCE
  // ═══════════════════════════════════════════════

  // ═══ abuse.ch Threat Feeds — MAXED ═══
  async fetchThreatFeeds() {
    console.log('  📡 [9/20] Fetching abuse.ch threat feeds (MAXED)...');
    const batchId = `feeds-${new Date().toISOString().slice(0, 13)}`;
    if (memory.isLearned('threat-feeds', batchId)) { console.log('    ⏩ Already fetched this hour'); return; }

    let count = 0;

    // abuse.ch Malware Bazaar — 1000 recent samples
    const malwareData = await safeFetch('https://mb-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'query=get_recent&selector=1000'
    });

    if (malwareData?.data) {
      for (const sample of malwareData.data) {
        memory.storeThreatIntel('malware', sample.sha256_hash || sample.md5_hash, {
          title: sample.file_name || sample.sha256_hash,
          description: `Malware sample. Type: ${sample.file_type}. Signature: ${sample.signature}. Tags: ${(sample.tags || []).join(', ')}. Reporter: ${sample.reporter || 'unknown'}. Delivery: ${sample.delivery_method || 'unknown'}`,
          severity: 'HIGH',
          source: 'abuse.ch-malwarebazaar',
          published_at: sample.first_seen
        });
        count++;
      }
    }

    // abuse.ch URLhaus — 500 malicious URLs
    const urlData = await safeFetch('https://urlhaus-api.abuse.ch/v1/urls/recent/limit/500/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'limit=500'
    });

    if (urlData?.urls) {
      for (const url of urlData.urls) {
        memory.storeThreatIntel('malicious_url', url.url, {
          title: `Malicious URL: ${url.url.slice(0, 150)}`,
          description: `Threat: ${url.threat}. Status: ${url.url_status}. Tags: ${(url.tags || []).join(', ')}. Reporter: ${url.reporter || 'unknown'}`,
          severity: 'HIGH',
          source: 'abuse.ch-urlhaus',
          published_at: url.date_added
        });
        count++;
      }
    }

    // abuse.ch ThreatFox — 1000 IOCs
    const iocData = await safeFetch('https://threatfox-api.abuse.ch/api/v1/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'get_iocs', days: 7 })
    });

    if (iocData?.data) {
      for (const ioc of (Array.isArray(iocData.data) ? iocData.data : []).slice(0, 1000)) {
        memory.storeThreatIntel('ioc', ioc.ioc, {
          title: `IOC: ${ioc.ioc_type} - ${ioc.ioc?.slice(0, 100)}`,
          description: `Threat: ${ioc.threat_type}. Malware: ${ioc.malware_printable}. Confidence: ${ioc.confidence_level}%. Tags: ${(ioc.tags || []).join(', ')}`,
          severity: ioc.confidence_level > 80 ? 'HIGH' : 'MEDIUM',
          source: 'abuse.ch-threatfox',
          published_at: ioc.first_seen_utc
        });
        count++;
      }
    }

    this.stats.threats += count;
    memory.markLearned('threat-feeds', batchId, 'ioc_batch', count);
    console.log(`    ✅ Stored ${count} threat intel items (malware+urls+iocs)`);
  }

  // ═══ NEW: Feodo Tracker — Botnet C2 servers ═══
  async fetchFeodoTracker() {
    console.log('  📡 [10/20] Fetching Feodo Tracker botnet C2 servers...');
    const batchId = `feodo-${new Date().toISOString().slice(0, 10)}`;
    if (memory.isLearned('feodo', batchId)) { console.log('    ⏩ Already fetched today'); return; }

    const data = await safeFetch('https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json');
    if (!data || !Array.isArray(data)) {
      // Fallback: CSV
      const csv = await safeFetchText('https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.txt');
      if (!csv) { console.log('    ⚠️ Feodo Tracker unavailable'); return; }

      let count = 0;
      for (const line of csv.split('\n')) {
        if (line.startsWith('#') || !line.trim()) continue;
        const ip = line.trim();
        memory.storeThreatIntel('botnet_c2', ip, {
          title: `Botnet C2: ${ip}`,
          description: `Known botnet command & control server. Block this IP immediately.`,
          severity: 'CRITICAL',
          source: 'feodo-tracker',
        });
        count++;
      }
      this.stats.threats += count;
      memory.markLearned('feodo', batchId, 'botnet_batch', count);
      console.log(`    ✅ Stored ${count} botnet C2 IPs`);
      return;
    }

    let count = 0;
    for (const entry of data) {
      memory.storeThreatIntel('botnet_c2', entry.ip_address || entry.dst_ip, {
        title: `Botnet C2: ${entry.ip_address || entry.dst_ip} (${entry.malware || 'unknown'})`,
        description: `Port: ${entry.dst_port}. Malware: ${entry.malware}. Status: ${entry.status}. First seen: ${entry.first_seen}. Last online: ${entry.last_online}`,
        severity: 'CRITICAL',
        source: 'feodo-tracker',
        published_at: entry.first_seen
      });
      count++;
    }
    this.stats.threats += count;
    memory.markLearned('feodo', batchId, 'botnet_batch', count);
    console.log(`    ✅ Stored ${count} botnet C2 entries`);
  }

  // ═══ NEW: SSL Blacklist — Malicious SSL certificates ═══
  async fetchSSLBlacklist() {
    console.log('  📡 [11/20] Fetching abuse.ch SSL Blacklist...');
    const batchId = `sslbl-${new Date().toISOString().slice(0, 10)}`;
    if (memory.isLearned('sslbl', batchId)) { console.log('    ⏩ Already fetched today'); return; }

    const csv = await safeFetchText('https://sslbl.abuse.ch/blacklist/sslipblacklist.csv');
    if (!csv) { console.log('    ⚠️ SSL Blacklist unavailable'); return; }

    let count = 0;
    for (const line of csv.split('\n')) {
      if (line.startsWith('#') || !line.trim()) continue;
      const parts = line.split(',');
      if (parts.length < 3) continue;
      const [timestamp, ip, port] = parts;
      memory.storeThreatIntel('ssl_malicious', ip, {
        title: `Malicious SSL: ${ip}:${port}`,
        description: `Malicious SSL certificate detected. Port: ${port}. Reason: ${parts[3] || 'Malware C2'}. Listed: ${timestamp}`,
        severity: 'HIGH',
        source: 'abuse.ch-sslbl',
        published_at: timestamp
      });
      count++;
    }
    this.stats.threats += count;
    memory.markLearned('sslbl', batchId, 'ssl_batch', count);
    console.log(`    ✅ Stored ${count} malicious SSL entries`);
  }

  // ═══════════════════════════════════════════════
  // TIER 4: PHISHING & URL INTELLIGENCE
  // ═══════════════════════════════════════════════

  // ═══ NEW: OpenPhish — Phishing URLs ═══
  async fetchOpenPhish() {
    console.log('  📡 [12/20] Fetching OpenPhish phishing URLs...');
    const batchId = `openphish-${new Date().toISOString().slice(0, 10)}`;
    if (memory.isLearned('openphish', batchId)) { console.log('    ⏩ Already fetched today'); return; }

    const text = await safeFetchText('https://openphish.com/feed.txt');
    if (!text) { console.log('    ⚠️ OpenPhish unavailable'); return; }

    let count = 0;
    for (const line of text.split('\n')) {
      const url = line.trim();
      if (!url || !url.startsWith('http')) continue;
      memory.storeThreatIntel('phishing_url', url, {
        title: `Phishing: ${url.slice(0, 150)}`,
        description: `Active phishing URL targeting credentials. Detected by OpenPhish community feed.`,
        severity: 'HIGH',
        source: 'openphish',
      });
      count++;
    }
    this.stats.threats += count;
    memory.markLearned('openphish', batchId, 'phishing_batch', count);
    console.log(`    ✅ Stored ${count} phishing URLs`);
  }

  // ═══ NEW: PhishTank — Verified phishing sites ═══
  async fetchPhishTank() {
    console.log('  📡 [13/20] Fetching PhishTank verified phishing sites...');
    const batchId = `phishtank-${new Date().toISOString().slice(0, 10)}`;
    if (memory.isLearned('phishtank', batchId)) { console.log('    ⏩ Already fetched today'); return; }

    // PhishTank RSS feed
    const rssText = await safeFetchText('https://data.phishtank.com/data/online-valid.csv');
    if (!rssText) {
      // Fallback: try the RSS
      const rss = await safeFetchText('http://data.phishtank.com/data/online-valid.xml');
      if (!rss) { console.log('    ⚠️ PhishTank unavailable'); return; }
      console.log('    ⚠️ PhishTank CSV requires API key, skipping');
      memory.markLearned('phishtank', batchId, 'phish_batch', 0);
      return;
    }

    let count = 0;
    const lines = rssText.split('\n').slice(1); // Skip header
    for (const line of lines.slice(0, 500)) {
      const parts = line.split(',');
      if (parts.length < 3) continue;
      const phishId = parts[0];
      const url = parts[1]?.replace(/"/g, '');
      const target = parts[4]?.replace(/"/g, '') || 'unknown';

      if (!url) continue;
      memory.storeThreatIntel('phishing_verified', url, {
        title: `Verified Phishing: ${url.slice(0, 150)}`,
        description: `PhishTank ID: ${phishId}. Target brand: ${target}. Community verified phishing URL.`,
        severity: 'HIGH',
        source: 'phishtank',
      });
      count++;
    }
    this.stats.threats += count;
    memory.markLearned('phishtank', batchId, 'phish_batch', count);
    console.log(`    ✅ Stored ${count} verified phishing entries`);
  }

  // ═══ NEW: URLScan.io — Recent public scans ═══
  async fetchURLScanIO() {
    console.log('  📡 [14/20] Fetching URLScan.io recent scans...');
    const batchId = `urlscan-${new Date().toISOString().slice(0, 13)}`;
    if (memory.isLearned('urlscan', batchId)) { console.log('    ⏩ Already fetched this hour'); return; }

    const data = await safeFetch('https://urlscan.io/api/v1/search/?q=task.tags:phishing&size=100');
    if (!data?.results) { console.log('    ⚠️ URLScan.io unavailable'); return; }

    let count = 0;
    for (const result of data.results) {
      const url = result.task?.url || result.page?.url || '';
      if (!url) continue;
      memory.storeThreatIntel('urlscan', url, {
        title: `URLScan: ${url.slice(0, 150)}`,
        description: `Domain: ${result.page?.domain || 'unknown'}. IP: ${result.page?.ip || 'unknown'}. Country: ${result.page?.country || 'unknown'}. Server: ${result.page?.server || 'unknown'}. Tags: ${(result.task?.tags || []).join(', ')}`,
        severity: (result.verdicts?.overall?.malicious) ? 'HIGH' : 'MEDIUM',
        source: 'urlscan.io',
        published_at: result.task?.time
      });
      count++;
    }
    this.stats.threats += count;
    memory.markLearned('urlscan', batchId, 'urlscan_batch', count);
    console.log(`    ✅ Stored ${count} URLScan.io results`);
  }

  // ═══════════════════════════════════════════════
  // TIER 5: ATTACK PATTERNS & FRAMEWORKS
  // ═══════════════════════════════════════════════

  // ═══ NEW: MITRE CAPEC — Attack Patterns ═══
  async fetchMITRECAPEC() {
    console.log('  📡 [15/20] Fetching MITRE CAPEC attack patterns...');
    if (memory.isLearned('capec', 'capec-v1')) { console.log('    ⏩ Already learned'); return; }

    // Fetch CAPEC catalog (JSON from GitHub mirror)
    const data = await safeFetch('https://raw.githubusercontent.com/mitre/cti/master/capec/2.1/stix-capec.json');
    if (!data?.objects) { console.log('    ⚠️ MITRE CAPEC unavailable'); return; }

    let count = 0;
    for (const obj of data.objects) {
      if (obj.type !== 'attack-pattern') continue;
      const capecId = obj.external_references?.find(r => r.source_name === 'capec')?.external_id || '';
      if (!capecId) continue;

      memory.storeKnowledge(`capec:${capecId}`, JSON.stringify({
        id: capecId,
        name: obj.name,
        description: (obj.description || '').slice(0, 1500),
        severity: obj.x_capec_typical_severity || 'Medium',
        prerequisites: obj.x_capec_prerequisites || [],
        mitigations: (obj.x_capec_mitigations || []).slice(0, 5),
        source: 'mitre-capec'
      }), 'attack-patterns');
      count++;
    }
    this.stats.tools += count;
    memory.markLearned('capec', 'capec-v1', 'attack_patterns', count);
    console.log(`    ✅ Stored ${count} MITRE CAPEC attack patterns`);
  }

  // ═══ Learn Cybersecurity Tools (25+) ═══
  async learnCyberTools() {
    console.log('  📡 [16/20] Learning cybersecurity tools knowledge...');
    if (memory.isLearned('tools', 'cyber-tools-v2')) { console.log('    ⏩ Already learned'); return; }

    const tools = [
      { name: 'nmap', cat: 'reconnaissance', desc: 'Network exploration and security auditing tool. Port scanning, service detection, OS detection, scripting engine (NSE).', install: 'sudo apt install nmap', url: 'https://nmap.org', examples: ['nmap -sV -sC target', 'nmap -A -T4 target', 'nmap --script vuln target'] },
      { name: 'nuclei', cat: 'vulnerability-scanner', desc: 'Fast and customizable vulnerability scanner based on simple YAML templates. 8000+ community templates for CVEs, misconfigs, default creds.', install: 'go install github.com/projectdiscovery/nuclei/v3/cmd/nuclei@latest', url: 'https://github.com/projectdiscovery/nuclei', examples: ['nuclei -u target -severity critical,high', 'nuclei -u target -tags cve'] },
      { name: 'subfinder', cat: 'subdomain-discovery', desc: 'Passive subdomain enumeration tool using 30+ sources including Shodan, VirusTotal, SecurityTrails.', install: 'go install github.com/projectdiscovery/subfinder/v2/cmd/subfinder@latest', url: 'https://github.com/projectdiscovery/subfinder', examples: ['subfinder -d domain.com', 'subfinder -d domain.com -recursive'] },
      { name: 'httpx', cat: 'http-probing', desc: 'Multi-purpose HTTP toolkit for probing URLs, discovering tech stacks, status codes, titles.', install: 'go install github.com/projectdiscovery/httpx/cmd/httpx@latest', url: 'https://github.com/projectdiscovery/httpx', examples: ['echo domain.com | httpx -tech-detect', 'cat subs.txt | httpx -status-code -title'] },
      { name: 'naabu', cat: 'port-scanner', desc: 'Fast port scanner written in Go. SYN/CONNECT scan with service detection.', install: 'go install github.com/projectdiscovery/naabu/v2/cmd/naabu@latest', url: 'https://github.com/projectdiscovery/naabu', examples: ['naabu -host target -top-ports 1000'] },
      { name: 'katana', cat: 'web-crawler', desc: 'Next-gen web crawling and spidering framework. Discovers endpoints, params, JS files, API routes.', install: 'go install github.com/projectdiscovery/katana/cmd/katana@latest', url: 'https://github.com/projectdiscovery/katana', examples: ['katana -u https://target.com -d 5 -js-crawl'] },
      { name: 'dnsx', cat: 'dns-toolkit', desc: 'Fast DNS toolkit for mass DNS resolution, brute-forcing, wildcard filtering.', install: 'go install github.com/projectdiscovery/dnsx/cmd/dnsx@latest', url: 'https://github.com/projectdiscovery/dnsx', examples: ['echo domain.com | dnsx -a -resp'] },
      { name: 'uncover', cat: 'search-engine', desc: 'Aggregates results from Shodan, Censys, FOFA, Hunter, ZoomEye into unified format.', install: 'go install github.com/projectdiscovery/uncover/cmd/uncover@latest', url: 'https://github.com/projectdiscovery/uncover', examples: ['uncover -q "apache 2.4.49" -e shodan'] },
      { name: 'metasploit', cat: 'exploitation', desc: "World's most used penetration testing framework. Exploit development, payload generation, post-exploitation.", install: 'sudo apt install metasploit-framework', url: 'https://www.metasploit.com', examples: ['msfconsole -q -x "use exploit/multi/handler"'] },
      { name: 'sqlmap', cat: 'sql-injection', desc: 'Automatic SQL injection and database takeover tool. Supports MySQL, PostgreSQL, MSSQL, Oracle.', install: 'sudo apt install sqlmap', url: 'https://sqlmap.org', examples: ['sqlmap -u "url?id=1" --dbs', 'sqlmap -r request.txt --batch --level 5'] },
      { name: 'hydra', cat: 'password-cracking', desc: 'Fast network logon cracker. Supports 50+ protocols: SSH, FTP, HTTP, RDP, MySQL, etc.', install: 'sudo apt install hydra', url: 'https://github.com/vanhauser-thc/thc-hydra', examples: ['hydra -l admin -P wordlist.txt ssh://target'] },
      { name: 'hashcat', cat: 'password-cracking', desc: 'Advanced password recovery. GPU-accelerated hash cracking for 300+ hash types.', install: 'sudo apt install hashcat', url: 'https://hashcat.net', examples: ['hashcat -m 0 hash.txt wordlist.txt'] },
      { name: 'john', cat: 'password-cracking', desc: 'John the Ripper — password cracker supporting hundreds of hash/cipher types.', install: 'sudo apt install john', url: 'https://www.openwall.com/john/', examples: ['john --wordlist=rockyou.txt hash.txt'] },
      { name: 'aircrack-ng', cat: 'wireless', desc: 'WiFi security auditing suite. Monitor mode, packet injection, WPA/WPA2 cracking.', install: 'sudo apt install aircrack-ng', url: 'https://www.aircrack-ng.org', examples: ['airmon-ng start wlan0', 'aircrack-ng -w wordlist capture.cap'] },
      { name: 'gobuster', cat: 'directory-brute', desc: 'Directory/file brute-forcing tool. Fast Go implementation for web content discovery.', install: 'sudo apt install gobuster', url: 'https://github.com/OJ/gobuster', examples: ['gobuster dir -u target -w wordlist.txt'] },
      { name: 'ffuf', cat: 'web-fuzzer', desc: 'Fast web fuzzer written in Go. Content discovery, parameter fuzzing, vhost discovery.', install: 'go install github.com/ffuf/ffuf/v2@latest', url: 'https://github.com/ffuf/ffuf', examples: ['ffuf -u target/FUZZ -w wordlist.txt'] },
      { name: 'responder', cat: 'mitm', desc: 'LLMNR/NBT-NS/mDNS poisoner for credential harvesting on internal networks.', install: 'sudo apt install responder', url: 'https://github.com/lgandx/Responder', examples: ['sudo responder -I eth0 -dwPv'] },
      { name: 'impacket', cat: 'active-directory', desc: 'Collection of Python classes for working with network protocols. AD attacks, relay, secretsdump.', install: 'pip install impacket', url: 'https://github.com/fortra/impacket', examples: ['impacket-psexec domain/user:pass@target'] },
      { name: 'bloodhound', cat: 'active-directory', desc: 'AD relationship visualization. Maps attack paths from compromised users to domain admin.', install: 'sudo apt install bloodhound', url: 'https://github.com/BloodHoundAD/BloodHound', examples: ['bloodhound-python -c All -d domain.local -u user -p pass'] },
      { name: 'crackmapexec', cat: 'active-directory', desc: 'Swiss army knife for pentesting Windows/AD. SMB, LDAP, WinRM, MSSQL enumeration and exploitation.', install: 'pip install crackmapexec', url: 'https://github.com/byt3bl33d3r/CrackMapExec', examples: ['crackmapexec smb targets -u user -p pass --shares'] },
      { name: 'chisel', cat: 'tunneling', desc: 'Fast TCP/UDP tunnel over HTTP. Bypasses firewalls for port forwarding and pivoting.', install: 'go install github.com/jpillora/chisel@latest', url: 'https://github.com/jpillora/chisel', examples: ['chisel server -p 8080 --reverse'] },
      { name: 'feroxbuster', cat: 'directory-brute', desc: 'Recursive content discovery tool. Fast, concurrent, with automatic recursion.', install: 'sudo apt install feroxbuster', url: 'https://github.com/epi052/feroxbuster', examples: ['feroxbuster -u target -w wordlist.txt'] },
      { name: 'nikto', cat: 'web-scanner', desc: 'Web server scanner. Tests for 6700+ dangerous files, outdated server versions, and server config issues.', install: 'sudo apt install nikto', url: 'https://cirt.net/Nikto2', examples: ['nikto -h target', 'nikto -h target -ssl'] },
      { name: 'wpscan', cat: 'wordpress', desc: 'WordPress security scanner. Detects vulnerable plugins, themes, users, and config issues.', install: 'sudo apt install wpscan', url: 'https://wpscan.com', examples: ['wpscan --url target --enumerate p,t,u'] },
      { name: 'enum4linux', cat: 'smb-enum', desc: 'Tool for enumerating information from Windows and Samba systems (users, shares, policies).', install: 'sudo apt install enum4linux', url: 'https://github.com/CiscoCXSecurity/enum4linux', examples: ['enum4linux -a target'] },
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

  // ═══ Nuclei Template Stats ═══
  async fetchNucleiTemplateInfo() {
    console.log('  📡 [17/20] Fetching Nuclei template stats...');
    if (memory.isLearned('nuclei', 'template-stats-v1')) { console.log('    ⏩ Already learned'); return; }

    const data = await safeFetch('https://raw.githubusercontent.com/projectdiscovery/nuclei-templates/main/TEMPLATES-STATS.json');
    if (!data) {
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

  // ═══ Recent Nuclei CVE Templates — 100 commits ═══
  async fetchRecentNucleiTemplates() {
    console.log('  📡 [18/20] Fetching recent Nuclei template updates (100 commits)...');
    const batchId = `nuclei-recent-${new Date().toISOString().slice(0, 10)}`;
    if (memory.isLearned('nuclei-recent', batchId)) { console.log('    ⏩ Already fetched today'); return; }

    const commits = await safeFetch('https://api.github.com/repos/projectdiscovery/nuclei-templates/commits?per_page=100');
    if (!commits || !Array.isArray(commits)) { console.log('    ⚠️ GitHub API unavailable'); return; }

    let count = 0;
    for (const commit of commits) {
      const msg = commit.commit?.message || '';
      const sha = commit.sha?.slice(0, 8) || '';
      const date = commit.commit?.author?.date || '';
      const cves = msg.match(/CVE-\d{4}-\d{4,}/g) || [];
      for (const cve of cves) {
        memory.storeKnowledge(`nuclei-template:${cve}`, JSON.stringify({
          cve, commit: sha, date, message: msg.slice(0, 300),
          source: 'nuclei-templates'
        }), 'nuclei-templates');
        count++;
      }
    }
    memory.markLearned('nuclei-recent', batchId, 'template_updates', count);
    console.log(`    ✅ Tracked ${count} CVE templates from recent commits`);
  }

  // ═══════════════════════════════════════════════
  // TIER 6: NEWS & ADVISORIES
  // ═══════════════════════════════════════════════

  // ═══ Security News — 50 stories ═══
  async fetchSecurityNews() {
    console.log('  📡 [19/20] Fetching security news (50 stories)...');
    const batchId = `news-${new Date().toISOString().slice(0, 13)}`;
    if (memory.isLearned('security-news', batchId)) { console.log('    ⏩ Already fetched this hour'); return; }

    const hnData = await safeFetch('https://hn.algolia.com/api/v1/search?query=cybersecurity%20vulnerability%20exploit%20CVE%20hack&tags=story&hitsPerPage=50');
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

  // ═══ NEW: CISA Alerts & Advisories ═══
  async fetchCISAAlerts() {
    console.log('  📡 [20/20] Fetching CISA alerts and advisories...');
    const batchId = `cisa-alerts-${new Date().toISOString().slice(0, 10)}`;
    if (memory.isLearned('cisa-alerts', batchId)) { console.log('    ⏩ Already fetched today'); return; }

    const rssText = await safeFetchText('https://www.cisa.gov/cybersecurity-advisories/all.xml');
    if (!rssText) {
      // Fallback: try ICS advisories
      const icsRss = await safeFetchText('https://www.cisa.gov/cybersecurity-advisories/ics-advisories.xml');
      if (!icsRss) { console.log('    ⚠️ CISA alerts unavailable'); return; }
    }

    const items = (rssText || '').match(/<item>[\s\S]*?<\/item>/g) || [];
    let count = 0;
    for (const item of items.slice(0, 100)) {
      const title = item.match(/<title>(.*?)<\/title>/)?.[1] || '';
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || '';
      const desc = item.match(/<description>(.*?)<\/description>/)?.[1] || '';
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
      const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').trim();

      memory.storeThreatIntel('advisory', `CISA-${count}`, {
        title: cleanTitle.slice(0, 300),
        description: desc.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').slice(0, 1000),
        severity: cleanTitle.toLowerCase().includes('critical') ? 'CRITICAL' : 'HIGH',
        source: 'cisa-advisories',
        published_at: pubDate
      });
      count++;
    }
    this.stats.cves += count;
    memory.markLearned('cisa-alerts', batchId, 'alert_batch', count);
    console.log(`    ✅ Stored ${count} CISA alerts/advisories`);
  }

  // ═══ NEW: Ransomware Tracker — Ransomware group activity ═══
  async fetchRansomwareTracker() {
    console.log('  📡 [BONUS] Fetching ransomware group tracking data...');
    const batchId = `ransomware-${new Date().toISOString().slice(0, 10)}`;
    if (memory.isLearned('ransomware', batchId)) { console.log('    ⏩ Already fetched today'); return; }

    // RansomWatch - tracks ransomware group sites
    const data = await safeFetch('https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json');
    if (!data || !Array.isArray(data)) { console.log('    ⚠️ RansomWatch unavailable'); return; }

    let count = 0;
    for (const entry of data.slice(-500)) {
      const group = entry.group_name || 'unknown';
      const title = entry.post_title || '';
      const url = entry.post_url || '';
      const discovered = entry.discovered || '';

      memory.storeThreatIntel('ransomware', `${group}-${title.slice(0, 50)}`, {
        title: `[${group}] ${title}`.slice(0, 300),
        description: `Ransomware group: ${group}. Victim: ${title}. Discovery date: ${discovered}. Dark web post URL available.`,
        severity: 'CRITICAL',
        source: 'ransomwatch',
        published_at: discovered
      });
      count++;
    }
    this.stats.threats += count;
    memory.markLearned('ransomware', batchId, 'ransomware_batch', count);
    console.log(`    ✅ Stored ${count} ransomware group posts`);
  }

  getStats() {
    return { ...this.stats };
  }
}

export const autoLearner = new AutoLearner();
