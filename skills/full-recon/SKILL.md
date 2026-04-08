---
name: full-recon
description: Comprehensive target reconnaissance — automated OSINT, port scanning, subdomain enumeration, tech detection, and vulnerability analysis
---

# Full Reconnaissance Skill

Run a complete automated reconnaissance workflow against a target domain or IP.

## Steps

1. **DNS Reconnaissance**: Use `dns_recon` to enumerate all DNS records (A, AAAA, MX, NS, TXT, SOA)
2. **WHOIS Lookup**: Use `whois_lookup` to gather registration data
3. **Subdomain Enumeration**: Use `subdomain_enum` to discover all subdomains via crt.sh and DNS brute force
4. **Port Scanning**: Use `port_scanner` with `ports: "top100"` on the main domain and key subdomains
5. **Technology Detection**: Use `tech_detect` on discovered web services
6. **HTTP Header Analysis**: Use `header_analysis` on all HTTP/HTTPS services
7. **SSL/TLS Scan**: Use `ssl_scan` on all HTTPS services
8. **WAF Detection**: Use `waf_detector` on web services
9. **Email Harvesting**: Use `email_harvester` to find email addresses
10. **Wayback Machine**: Use `wayback_machine` with mode "urls" to find historical pages
11. **IP Geolocation**: Use `ip_geolocation` on all discovered IPs
12. **CVE Lookup**: Search for CVEs with `cve_lookup` using detected software versions
13. **Cloud Enumeration**: Use `cloud_enum` to check for exposed cloud resources

## Output

Save all findings with `save_artifact` to the `recon` category:
- `target_recon_report.md` — Full Markdown report
- Store key findings in `memory_store` for future reference

## Parallel Execution

Steps 1-4 can be run in parallel. Steps 5-9 depend on step 4 results. Steps 10-13 can run in parallel.
