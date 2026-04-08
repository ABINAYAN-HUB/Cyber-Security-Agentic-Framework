---
name: threat-intelligence
description: Threat intelligence gathering, CVE research, IOC correlation, APT tracking, and automated threat feed analysis
---

# Threat Intelligence Skill

## Overview
Advanced threat intelligence gathering and correlation for identifying, tracking, and analyzing cyber threats in real-time.

## Workflows

### 1. CVE Research & Impact Analysis
```
1. Search NVD for the CVE: use cve_lookup with the CVE ID
2. Check exploit availability: use exploit_search
3. Cross-reference with Shodan for exposed instances: use shodan_search
4. Check FOFA for additional exposed systems: use fofa_search
5. Run nuclei scan with CVE-specific templates: use nuclei_scan with tags="cve"
6. Store all findings: use memory_store
7. Generate impact assessment report: use save_artifact
```

### 2. IOC Investigation
```
1. For IP IOCs: use ip_geolocation, shodan_search (host lookup), fofa_search
2. For domain IOCs: use dns_recon, whois_lookup, subdomain_enum, wayback_machine
3. For hash IOCs: search VirusTotal via tavily_search, search known malware databases
4. For URL IOCs: use stealth_browser for safe analysis, header_analysis
5. Cross-reference with threat feeds in database: use memory_store to search threat_intel
6. Map to MITRE ATT&CK TTPs
7. Store findings: use memory_store
```

### 3. Threat Feed Monitoring
```
1. Check database for latest threat intel: use memory_store category=threat_intel
2. Search for specific threats: query threat_intel table via memory_store
3. Correlate with active targets in database
4. Generate daily threat briefing: use save_artifact
```

### 4. Vulnerability Trend Analysis
```
1. Query NVD for recent CVEs by product/vendor
2. Cross-reference with exploit availability
3. Check for active exploitation in CISA KEV
4. Map exposure using Shodan/FOFA
5. Priority ranking by CVSS + exploitability + exposure
```

## Key Tools
- `cve_lookup` — CVE details from NVD
- `exploit_search` — Search for exploits
- `shodan_search` — Internet-wide exposure
- `fofa_search` — FOFA cyberspace search
- `nuclei_scan` — Automated vuln scanning
- `tavily_search` — Deep web research
- `memory_store` — Persistent threat intel storage
