---
name: social-engineering
description: Social engineering and phishing — email template creation, pretexting, credential harvesting infrastructure, vishing scripts
---

# Social Engineering Skill

Design and execute social engineering campaigns for authorized red team engagements.

## Phase 1: Target Research
1. Use `email_harvester` to discover target email addresses
2. Use `stealth_browser` to research target organization structure
3. Use `web_search` for employee names, roles, and social profiles
4. Use `whois_lookup` for domain registration details
5. Use `tech_detect` to identify email infrastructure (Google Workspace, O365, etc.)

## Phase 2: Phishing Infrastructure
6. Use `execute_command` to set up GoPhish: `docker run -d -p 3333:3333 gophish/gophish`
7. Generate phishing email templates with `write_file`:
   - Password reset notifications
   - IT department alerts
   - Package delivery notifications
   - Invoice/payment requests
8. Use `payload_generate` type "web_shell" for credential harvesting pages
9. Clone target login page with `stealth_browser` action "full_page"

## Phase 3: Payload Delivery
10. Use `encode_decode` to encode payloads (Base64 for email transport)
11. Generate macro-enabled documents: `payload_generate` type "reverse_shell" language "powershell"
12. Create HTA payloads: `payload_generate` type "reverse_shell" language "hta"
13. Generate USB drop payloads for physical social engineering
14. Use `execute_command` to send test emails via SMTP

## Phase 4: Credential Harvesting
15. Monitor credential captures on GoPhish
16. Use `hash_crack` on any captured hashes
17. Validate credentials against target services
18. Use `memory_store` action "store_loot" for captured credentials

## Phase 5: Reporting
19. Document campaign results, click rates, credential captures
20. Save report with `save_artifact` category "reports"
