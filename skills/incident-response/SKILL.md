---
name: incident-response
description: Digital forensics and incident response — log analysis, memory forensics, disk imaging, timeline reconstruction, IOC hunting
---

# Incident Response & Digital Forensics Skill

Systematic incident response and forensic analysis workflow.

## Phase 1: Initial Triage
1. Use `execute_command`: `date && uptime && last -20` (system timeline)
2. Use `execute_command`: `ps auxf` (process tree — look for suspicious processes)
3. Use `execute_command`: `netstat -tulnp 2>/dev/null || ss -tulnp` (active connections)
4. Use `execute_command`: `who -a` (logged-in users)
5. Use `execute_command`: `lastlog | grep -v "Never"` (recent logins)
6. Use `execute_command`: `cat /var/log/auth.log | tail -100` (auth events)

## Phase 2: Persistence Hunting
7. Use `execute_command`: `crontab -l && ls -la /etc/cron.*` (scheduled tasks)
8. Use `execute_command`: `systemctl list-unit-files --type=service | grep enabled`
9. Use `execute_command`: `cat /etc/rc.local 2>/dev/null` (startup scripts)
10. Use `execute_command`: `find / -name "*.sh" -newer /tmp -mtime -7 2>/dev/null` (recently modified scripts)
11. Use `execute_command`: `ls -la /root/.ssh/ /home/*/.ssh/ 2>/dev/null` (SSH keys)
12. Use `execute_command`: `cat /etc/passwd | grep -v nologin | grep -v false` (shell users)

## Phase 3: Log Analysis
13. Use `execute_command`: `cat /var/log/syslog | grep -i "error\|fail\|denied\|attack" | tail -50`
14. Use `execute_command`: `journalctl --since "1 day ago" | grep -i "failed\|error" | head -50`
15. Apache/Nginx access logs: `execute_command`: `cat /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -20`
16. Check for web shells: `execute_command`: `find /var/www -name "*.php" -newer /var/www/index.php -mtime -30 2>/dev/null`
17. Use `execute_command`: `grep -r "eval\|base64_decode\|system\|passthru\|exec" /var/www/ 2>/dev/null | head -20`

## Phase 4: Memory & Network Forensics
18. Memory dump: `execute_command`: `sudo dd if=/proc/kcore of=memory.raw bs=1M count=100`
19. Use `network_sniffer` mode "connections" to analyze current connections
20. Use `execute_command`: `find /tmp /var/tmp /dev/shm -type f -ls` (temp files)
21. Check for rootkits: `execute_command`: `chkrootkit 2>/dev/null || rkhunter --check 2>/dev/null`

## Phase 5: IOC Extraction & Reporting
22. Use `ip_geolocation` on suspicious IPs found in logs
23. Use `whois_lookup` on suspicious domains
24. Cross-reference IOCs with threat intel via `web_search`
25. Create timeline of events with `write_file`
26. Store all IOCs in `memory_store` and save report with `save_artifact`
