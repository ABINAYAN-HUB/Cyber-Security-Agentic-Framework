---
name: firewall-bypass
description: Advanced firewall and WAF bypass techniques — evasion, fragmentation, encoding tricks, and alternative attack paths
---

# Firewall & WAF Bypass Skill

Systematically identify and bypass firewall/WAF protections.

## Phase 1: Detection
1. Use `waf_detector` with test_payload=true to identify the WAF vendor
2. Use `firewall_analyzer` to map port filtering behavior
3. Use `header_analysis` to check for CDN/proxy indicators
4. Use `tech_detect` to identify the full technology stack

## Phase 2: Origin Discovery
5. Use `dns_recon` to find direct IP addresses
6. Use `subdomain_enum` to find unprotected subdomains
7. Search `shodan_search` for services on alternative ports
8. Use `wayback_machine` to find historical DNS records
9. Check for mail servers that may expose origin IP (MX records → connect and check headers)

## Phase 3: WAF Bypass Techniques
10. Test HTTP method override: PUT, PATCH, DELETE
11. Use `payload_generate` type "sqli" with encode="url" for double encoding
12. Use `encode_decode` format "hex" and "url" for payload obfuscation
13. Test chunked transfer encoding via `execute_command` with curl
14. Test HTTP/2 via `stealth_browser` (most WAFs inspect HTTP/1.1 only)
15. Use `stealth_browser` with custom user_agent to evade UA-based blocks

## Phase 4: Alternative Vectors
16. Check for WebSocket endpoints (often bypass WAF inspection)
17. Test XML-based attacks with `payload_generate` type "xxe"
18. Test SSRF to access internal services that bypass external firewall
19. Check for API endpoints that may have different WAF rules
20. Use `fuzz_engine` on alternative ports (8080, 8443, 8000, 9090)

## Phase 5: Reporting
21. Document all identified WAFs, bypass methods, and successful techniques
22. Save findings with `save_artifact` category "reports"
