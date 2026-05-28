#!/bin/bash
# Jarvis Cyber — Systemd Service Installer
# Installs Jarvis as a user service that auto-starts on boot

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "🐉 Jarvis Cyber — Service Installer"
echo "======================================"

# Check for node
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js not found. Please install Node.js >= 18.${NC}"
    exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Create systemd user directory
mkdir -p ~/.config/systemd/user

# Write service file
cat > ~/.config/systemd/user/jarvis-cyber.service << EOF
[Unit]
Description=Jarvis Cyber — Autonomous AI Cybersecurity Agent
Documentation=https://github.com/ABINAYAN-HUB/Jarvis-Cyber
After=network.target

[Service]
Type=simple
WorkingDirectory=${SCRIPT_DIR}
ExecStart=$(which node) ${SCRIPT_DIR}/cli.js --daemon
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
EOF

echo -e "${GREEN}✅ Service file created at ~/.config/systemd/user/jarvis-cyber.service${NC}"

# Reload systemd
systemctl --user daemon-reload

# Enable and start
systemctl --user enable jarvis-cyber.service
systemctl --user start jarvis-cyber.service

echo ""
echo -e "${GREEN}✅ Service started and enabled!${NC}"
echo ""
echo "Useful commands:"
echo "  systemctl --user status jarvis-cyber    # Check status"
echo "  systemctl --user stop jarvis-cyber      # Stop"
echo "  systemctl --user restart jarvis-cyber   # Restart"
echo "  journalctl --user -u jarvis-cyber -f    # View logs"
echo ""

# Enable lingering so service runs even when user is not logged in
if command -v loginctl &> /dev/null; then
    loginctl enable-linger $(whoami) 2>/dev/null || true
    echo -e "${GREEN}✅ Lingering enabled — service will persist across logouts${NC}"
fi

echo ""
echo "🐉 Jarvis Cyber is now running as a background service!"
echo "   Add tasks to ${SCRIPT_DIR}/HEARTBEAT.md and they'll be executed automatically."
