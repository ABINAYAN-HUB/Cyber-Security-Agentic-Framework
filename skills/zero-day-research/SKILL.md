---
name: zero-day-research
description: Zero-day vulnerability research, 1-day exploit development, and novel attack vector discovery
---

# Zero-Day Research Skill

## Overview
Methodology for discovering and exploiting zero-day vulnerabilities, analyzing 1-day exploits, and developing novel attack vectors.

## Workflows

### 1. Target Application Analysis
```
1. Technology fingerprint: tech_detect, httpx_probe with tech_detect=true
2. Version enumeration: header_analysis, ssl_scan
3. Source code analysis: katana_crawl for JS files, wayback_machine for old versions
4. API endpoint discovery: katana_crawl with js_crawl=true
5. Parameter fuzzing: fuzz_engine for hidden params
6. Differential analysis: compare versions for newly introduced code
```

### 2. Vulnerability Discovery Pipeline
```
1. Run nuclei with all templates: nuclei_scan severity=all
2. Custom fuzzing: fuzz_engine with mutation wordlists
3. Input validation testing: encodeDecode for bypass payloads
4. Authentication bypass: test default creds, JWT manipulation
5. Injection testing: SQLi, XSS, SSTI, SSRF, LFI, RFI
6. Logic flaws: race conditions, IDOR, privilege escalation
7. Memory corruption: buffer overflow, format string, use-after-free
```

### 3. Exploit Development
```
1. Reproduce the vulnerability reliably
2. Write proof-of-concept: payload_generate
3. Develop reliable exploit: write_file for exploit code
4. Test in controlled environment: execute_command
5. Weaponize for Metasploit: metasploit_rpc
6. Document: save_artifact with full exploit details
```

### 4. Patch Analysis (1-day)
```
1. Monitor CVE feeds: check database threat_intel table
2. Find patch commits: github_search
3. Reverse-engineer the fix to understand the vulnerability
4. Develop exploit before widespread patching
5. Scan for unpatched targets: nuclei_scan, shodan_search
```
