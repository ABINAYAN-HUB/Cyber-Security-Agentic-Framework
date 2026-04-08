---
name: network-attack
description: Network penetration testing — port scanning, service exploitation, lateral movement, and firewall bypass
---

# Network Attack Skill

Execute a systematic network penetration test against a target host or network.

## Phase 1: Network Reconnaissance
1. Use `port_scanner` with ports "top1000" and banner grabbing enabled
2. Use `dns_recon` for DNS enumeration and zone transfer attempts
3. Use `ip_geolocation` for target profiling
4. Use `shodan_search` type "host" for service/vulnerability intel
5. Use `firewall_analyzer` to map firewall rules

## Phase 2: Service Enumeration
6. For each open port, analyze the banner data
7. Use `web_search` or `cve_lookup` to find vulnerabilities for detected service versions
8. Use `ssl_scan` on any TLS services
9. Check for default credentials on discovered services (FTP, SSH, MySQL, etc.)

## Phase 3: Exploitation
10. Use `metasploit_rpc` action "search" with discovered service names
11. Use `exploit_search` for matching PoC exploits
12. Use `metasploit_rpc` action "generate_rc" to create Metasploit resource scripts
13. Use `payload_generate` type "reverse_shell" for custom shells
14. Use `start_listener` before triggering exploits

## Phase 4: Post-Exploitation
15. Use `metasploit_rpc` action "post_exploit" for post-exploitation commands
16. Enumerate internal network from compromised host
17. Use `memory_store` action "store_loot" for discovered credentials
18. Attempt privilege escalation

## Phase 5: Reporting
19. Save full engagement report with `save_artifact`
20. Document all findings, exploits used, and remediation recommendations
