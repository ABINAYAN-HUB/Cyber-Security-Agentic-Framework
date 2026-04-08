---
name: fofa-recon
description: FOFA-based internet asset discovery, infrastructure mapping, and attack surface reconnaissance
---

# FOFA Reconnaissance Skill

## Overview
Leverage FOFA cyberspace search engine for comprehensive internet asset discovery and attack surface mapping.

## Workflows

### 1. Organization Infrastructure Mapping
```
1. Search by organization domain: fofa_search query='domain="target.com"'
2. Search by SSL certificate: fofa_search query='cert="Organization Name"'
3. Discover IP ranges: fofa_search query='org="Company Name"'
4. Find web applications: fofa_search query='domain="target.com" && port="443"'
5. Map all services: fofa_search query='ip="x.x.x.0/24"'
6. Store results: memory_store
7. Cross-reference with Shodan: shodan_search
8. Probe discovered hosts: httpx_probe
```

### 2. Technology-Specific Discovery
```
1. Find specific servers: fofa_search query='server="Apache/2.4.49"'
2. Find vulnerable software: fofa_search query='banner="OpenSSH_7.2"'
3. Find login panels: fofa_search query='title="Admin Login" && country="US"'
4. Find IoT devices: fofa_search query='protocol="mqtt" || protocol="rtsp"'
5. Find databases: fofa_search query='port="27017" || port="6379" || port="9200"'
```

### 3. FOFA + Nuclei Pipeline
```
1. Discover targets: fofa_search query='domain="target.com"'
2. Extract all IPs/URLs from results
3. Probe with httpx: httpx_probe targets=<discovered_hosts>
4. Scan with nuclei: nuclei_scan on each live host
5. Correlate findings
6. Generate report: save_artifact
```

## FOFA Query Syntax
- `domain="example.com"` — by domain
- `ip="1.2.3.4"` or `ip="1.2.3.0/24"` — by IP/CIDR
- `port="443"` — by port
- `server="nginx"` — by server type
- `title="login"` — by page title
- `cert="organization"` — by SSL cert
- `country="US"` — by country
- `&&` (AND), `||` (OR) — logical operators
