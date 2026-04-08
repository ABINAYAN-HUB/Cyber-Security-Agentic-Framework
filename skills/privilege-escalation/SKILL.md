---
name: privilege-escalation
description: Linux and Windows privilege escalation — kernel exploits, SUID abuse, cron jobs, service misconfigs, token manipulation
---

# Privilege Escalation Skill

Systematically escalate privileges on a compromised Linux or Windows system.

## Linux Privilege Escalation

### Phase 1: System Enumeration
1. Use `execute_command`: `id && whoami && hostname && uname -a`
2. Use `execute_command`: `cat /etc/os-release && cat /etc/issue`
3. Use `execute_command`: `sudo -l` (check sudo permissions)
4. Use `execute_command`: `find / -perm -4000 -type f 2>/dev/null` (SUID binaries)
5. Use `execute_command`: `find / -perm -2000 -type f 2>/dev/null` (SGID binaries)
6. Use `execute_command`: `cat /etc/crontab && ls -la /etc/cron.*`
7. Use `execute_command`: `ps aux | grep root` (processes running as root)
8. Use `execute_command`: `ls -la /tmp /var/tmp /dev/shm` (writable directories)

### Phase 2: Credential Hunting
9. Use `execute_command`: `find / -name "*.conf" -o -name "*.config" -o -name "*.env" 2>/dev/null | head -30`
10. Use `execute_command`: `cat /etc/shadow 2>/dev/null` (attempt to read)
11. Use `execute_command`: `find / -name "id_rsa" -o -name "*.pem" -o -name "*.key" 2>/dev/null`
12. Use `execute_command`: `cat ~/.bash_history ~/.mysql_history 2>/dev/null`
13. Use `execute_command`: `env | grep -i pass`

### Phase 3: Exploitation
14. SUID abuse: Check GTFOBins via `web_search` for discovered SUID binaries
15. Kernel exploits: Use `cve_lookup` keyword matching `uname -r` output
16. Writable cron: Inject reverse shell into writable cron scripts
17. Docker escape: `execute_command`: `ls -la /var/run/docker.sock` (if docker group)
18. Capabilities: `execute_command`: `getcap -r / 2>/dev/null`
19. PATH hijacking: Check for relative paths in SUID binaries or cron jobs

## Windows Privilege Escalation

### Phase 1: System Enumeration
20. Use `execute_command`: `systeminfo && whoami /all`
21. Use `execute_command`: `net user && net localgroup administrators`
22. Use `execute_command`: `wmic service list brief | findstr /i "auto"`
23. Use `execute_command`: `schtasks /query /fo LIST /v`
24. Use `execute_command`: `icacls "C:\Program Files" /T /C 2>nul | findstr /i "everyone users"`

### Phase 2: Token & Service Abuse
25. Use `payload_generate` type "reverse_shell" language "powershell"
26. Unquoted service paths: `execute_command`: `wmic service get name,displayname,pathname,startmode | findstr /I /V "C:\Windows"`
27. AlwaysInstallElevated: `execute_command`: `reg query HKLM\SOFTWARE\Policies\Microsoft\Windows\Installer /v AlwaysInstallElevated`
28. Token impersonation: Check SeImpersonatePrivilege for Potato attacks

### Phase 3: Reporting
29. Store all escalation paths and credentials with `memory_store`
30. Save escalation report with `save_artifact`
