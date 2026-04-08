---
name: bug-bounty-hunter
description: Bug bounty methodology — target scoping, automated recon pipeline, vulnerability chaining, PoC generation, report writing
---

# Bug Bounty Hunter Skill

Systematic bug bounty hunting workflow for maximum impact findings.

## Phase 1: Scope & Asset Discovery
1. Use `subdomain_enum` for complete subdomain enumeration
2. Use `dns_recon` for DNS infrastructure mapping
3. Use `cloud_enum` to discover cloud assets in scope
4. Use `wayback_machine` mode "urls" to find old/hidden endpoints
5. Use `shodan_search` for internet-facing services
6. Use `port_scanner` ports "top1000" on all discovered assets
7. Use `web_search` for program scope and out-of-scope rules

## Phase 2: Content Discovery
8. Use `fuzz_engine` with wordlist "common" on all web targets
9. Use `fuzz_engine` with wordlist "api" for API endpoints
10. Use `fuzz_engine` with wordlist "backup" for sensitive files
11. Use `stealth_browser` to spider JavaScript for hidden endpoints
12. Use `tech_detect` to identify technology stack on each subdomain
13. Use `header_analysis` for security misconfigurations

## Phase 3: Vulnerability Testing
14. **XSS**: Use `payload_generate` type "xss" — test reflected, stored, DOM-based
15. **SQLi**: Use `payload_generate` type "sqli" — test all input points
16. **SSRF**: Test internal URL fetching via `payload_generate` type "ssrf_payloads"
17. **IDOR**: Manipulate IDs and UUIDs in API calls
18. **Open Redirect**: Test redirect parameters with external URLs
19. **CORS**: Use `header_analysis` to check Access-Control-Allow-Origin misconfig
20. **SSTI**: Use `payload_generate` type "ssti" on template-rendering inputs
21. **XXE**: Use `payload_generate` type "xxe" on XML-accepting endpoints
22. **RCE**: Chain findings for remote code execution

## Phase 4: Vulnerability Chaining
23. Chain SSRF + cloud metadata for AWS key extraction
24. Chain XSS + CSRF for account takeover
25. Chain IDOR + information disclosure for data exfiltration
26. Chain open redirect + OAuth for token theft

## Phase 5: PoC & Report
27. Use `write_file` to create detailed PoC scripts
28. Record exploitation steps with screenshots via `stealth_browser`
29. Write professional report with impact analysis
30. Calculate CVSS score and suggest remediation
31. Save report with `save_artifact` category "reports"
