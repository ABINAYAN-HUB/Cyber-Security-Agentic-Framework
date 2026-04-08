---
name: dark-web-osint
description: Dark web OSINT — Tor network scanning, paste site monitoring, breach data analysis, and hidden service discovery
---

# Dark Web OSINT Skill

## Overview
Open source intelligence techniques for the dark web — discovering hidden services, monitoring paste sites, analyzing breach data, and tracking threat actors.

## Workflows

### 1. Hidden Service Discovery
```
1. Search for .onion domains: tavily_search for known directories (Ahmia, Dark.fail)
2. Cross-reference with public .onion lists
3. Verify accessibility via Tor: execute_command with torsocks/proxychains
4. Screenshot services: stealth_browser via Tor proxy
5. Fingerprint technologies: tech_detect, header_analysis
6. Store findings: memory_store category=darkweb
```

### 2. Breach Data Analysis
```
1. Search known breach databases: tavily_search, web_search
2. Check have-i-been-pwned for email exposure
3. Search paste sites (Pastebin, Ghostbin, Rentry) for leaked data
4. Analyze credential dumps for target relevance
5. Cross-reference with active target profiles
6. Store IOCs: memory_store
```

### 3. Threat Actor Tracking
```
1. Monitor threat forums via OSINT: tavily_search
2. Track cryptocurrency wallet addresses
3. Analyze communication patterns
4. Map aliases across platforms
5. Document TTPs and attribute to groups
6. Generate threat actor profile: save_artifact
```

### 4. Paste Site Monitor
```
1. Search paste sites for keywords: web_search with site:pastebin.com etc.
2. Check for leaked credentials, API keys, internal data
3. Download and analyze matches: read_url
4. Alert on new findings
5. Store in database: memory_store
```

## Required Tools
- Tor (`sudo apt install tor`)
- proxychains4 (`sudo apt install proxychains4`)
- torsocks (`sudo apt install torsocks`)

## OPSEC
- ALWAYS use Tor/proxychains for dark web access
- Never expose real IP
- Use stealth_browser with proxy enabled
