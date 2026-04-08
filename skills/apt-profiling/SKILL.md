---
name: apt-profiling
description: Advanced Persistent Threat (APT) group profiling — TTPs, IOCs, attribution, MITRE ATT&CK mapping
---

# APT Profiling Skill

## Overview
Profile and track Advanced Persistent Threat (APT) groups by mapping tactics, techniques, and procedures (TTPs) to the MITRE ATT&CK framework.

## Workflows

### 1. APT Group Research
```
1. Search for APT group info: tavily_search "APT<N> tactics techniques"
2. Research known campaigns: web_search "<group_name> cyber attack"
3. Map to MITRE ATT&CK: tavily_search "MITRE ATT&CK <group_name>"
4. Identify known malware families and tools
5. Document infrastructure (C2 domains, IP ranges)
6. Store profile: memory_store category=apt
7. Generate profile report: save_artifact
```

### 2. IOC-to-APT Attribution
```
1. Analyze IOCs from incident: ip_geolocation, whois_lookup, dns_recon
2. Search threat intel databases: memory_store search threat_intel
3. Cross-reference malware hashes with known APT tools
4. Check infrastructure overlap with known C2s
5. Analyze TTPs against MITRE ATT&CK
6. Assign confidence level to attribution
7. Generate attribution report: save_artifact
```

### 3. Active Hunt for APT Infrastructure
```
1. Search for known C2 patterns: shodan_search, fofa_search
2. Scan for specific server fingerprints: nuclei_scan
3. DNS analysis of suspicious domains: dnsx_resolve, dns_recon
4. SSL certificate analysis: ssl_scan for known cert patterns
5. Track domain registration patterns: whois_lookup
6. Monitor for new infrastructure: uncover_search
```

### 4. MITRE ATT&CK Mapping
```
Tactics covered:
- TA0001: Initial Access (phishing, supply chain, exploits)
- TA0002: Execution (scripting, WMI, PowerShell)
- TA0003: Persistence (registry, scheduled tasks, implants)
- TA0004: Privilege Escalation (token manipulation, UAC bypass)
- TA0005: Defense Evasion (obfuscation, process injection)
- TA0006: Credential Access (dumping, keylogging, Kerberoast)
- TA0007: Discovery (network, AD, cloud enumeration)
- TA0008: Lateral Movement (PsExec, WMI, RDP)
- TA0009: Collection (data staging, screen capture)
- TA0010: Exfiltration (C2 channel, cloud storage)
- TA0011: Command & Control (encrypted channels, tunneling)
```

## Known APT Groups Reference
Use the database's threat_intel and tool_knowledge tables to look up known APT groups,
their aliases, targeted sectors, and geographic attribution.
