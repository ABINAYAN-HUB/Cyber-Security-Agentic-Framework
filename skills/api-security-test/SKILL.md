---
name: api-security-test
description: Comprehensive REST/GraphQL API security testing — authentication bypass, IDOR, rate limiting, injection, and business logic flaws
---

# API Security Testing Skill

Perform a deep API security assessment against REST or GraphQL endpoints.

## Phase 1: API Discovery
1. Use `fuzz_engine` with wordlist "api" to discover API endpoints
2. Use `wayback_machine` mode "urls" to find historical API endpoints
3. Use `stealth_browser` action "full_page" on the target to look for API calls in JavaScript
4. Use `web_search` for API documentation: `site:target.com api OR swagger OR openapi`
5. Use `read_url` to fetch `/api/swagger.json`, `/api/docs`, `/openapi.json`, `/graphql`

## Phase 2: Authentication Testing
6. Test endpoints without authentication tokens (remove `Authorization` header)
7. Test with expired/invalid JWT tokens — decode with `encode_decode` format "jwt"
8. Test API key enumeration: `fuzz_engine` with custom path patterns
9. Check for IDOR by modifying user ID parameters (change `id=1` to `id=2`)
10. Test for mass assignment by sending extra fields in POST/PUT requests

## Phase 3: Injection Testing
11. Use `payload_generate` type "sqli" and inject into every parameter
12. Test GraphQL injection: introspection query, nested query DoS, field suggestion
13. Test NoSQL injection payloads: `{"$gt":""}`, `{"$regex":".*"}`
14. Use `payload_generate` type "ssti" for template injection in API responses
15. Test command injection in file upload/processing endpoints

## Phase 4: Business Logic
16. Test rate limiting: send 100 rapid requests via `execute_command` with curl
17. Test price manipulation in e-commerce APIs
18. Test privilege escalation by modifying role fields
19. Check for verbose error messages that leak internal info
20. Test for SSRF by providing internal URLs in webhook/callback parameters

## Phase 5: Reporting
21. Save API security report with `save_artifact` category "reports"
22. Store all discovered endpoints in `memory_store` for future reference
23. List all vulnerabilities with CVSS-style severity ratings
