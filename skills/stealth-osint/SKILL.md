---
name: stealth-osint
description: Advanced OSINT and intelligence gathering — stealth browser reconnaissance, social engineering preparation, and deep web intelligence
---

# Stealth OSINT Skill

Perform deep open-source intelligence gathering with anti-detection measures.

## Information Gathering
1. Use `stealth_browser` with proxy "socks5://127.0.0.1:9050" (Tor) for anonymous browsing
2. Use `tavily_search` for AI-enhanced research on the target
3. Use `web_search` for broad intelligence gathering
4. Use `email_harvester` to find associated email addresses
5. Use `whois_lookup` for domain registration and ownership data
6. Use `wayback_machine` mode "urls" to find removed or hidden content

## Social Media OSINT
7. Use `stealth_browser` to scrape LinkedIn profiles (via Google cache if blocked)
8. Search for target on social platforms via `web_search`
9. Look for leaked credentials via `web_search` query "site:pastebin.com target"

## Technical OSINT
10. Use `shodan_search` to map internet-facing infrastructure
11. Use `subdomain_enum` for complete subdomain mapping
12. Use `cloud_enum` to find exposed cloud storage
13. Use `dns_recon` for DNS infrastructure analysis
14. Search GitHub for leaked secrets: `web_search` query "site:github.com target password OR secret OR api_key"

## Dark Web Intelligence
15. Use `stealth_browser` with Tor proxy to check known onion search engines
16. Cross-reference findings with threat intelligence feeds

## Output
17. Compile all findings into a structured intelligence report with `save_artifact`
18. Store target profile in `memory_store` for future operations
