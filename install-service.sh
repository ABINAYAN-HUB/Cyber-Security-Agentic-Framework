#!/bin/bash
# OpenClaw Cyber — Systemd Service Installer
# Installs OpenClaw as a user service that auto-starts on boot

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/openclaw.service"
NODE_PATH=$(command -v node)

echo "🐉 OpenClaw Cyber — Service Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Node.js
if [ -z "$NODE_PATH" ]; then
    echo "❌ Node.js not found. Install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js: $NODE_PATH"
echo "📁 Project: $SCRIPT_DIR"

# Create systemd user directory
mkdir -p "$SERVICE_DIR"

# Create the service file
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=OpenClaw Cyber — Autonomous AI Cybersecurity Agent
Documentation=https://github.com/openclaw/openclaw-cyber
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$SCRIPT_DIR
ExecStart=$NODE_PATH $SCRIPT_DIR/cli.js --daemon
Restart=always
RestartSec=10
StandardOutput=append:$HOME/.openclaw/daemon.log
StandardError=append:$HOME/.openclaw/daemon-error.log
Environment=NODE_ENV=production
Environment=PDCP_API_KEY=\${PDCP_API_KEY:-}
Environment=PATH=$HOME/go/bin:$PATH

# Resource limits
LimitNOFILE=65536
MemoryMax=512M

[Install]
WantedBy=default.target
EOF

echo "✅ Service file created: $SERVICE_FILE"

# Create log directory
mkdir -p "$HOME/.openclaw"

# Reload systemd
systemctl --user daemon-reload
echo "✅ Systemd reloaded"

# Enable the service (auto-start on boot)
systemctl --user enable openclaw.service
echo "✅ Service enabled (will auto-start on boot)"

# Enable lingering (keeps services running even when not logged in)
loginctl enable-linger "$USER" 2>/dev/null || true
echo "✅ Lingering enabled (runs even when logged out)"

# Start the service now
systemctl --user start openclaw.service
echo "✅ Service started"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🐉 OpenClaw Cyber is now running as a background service!"
echo ""
echo "  Status:  systemctl --user status openclaw"
echo "  Logs:    journalctl --user -u openclaw -f"
echo "  Stop:    systemctl --user stop openclaw"
echo "  Restart: systemctl --user restart openclaw"
echo "  Disable: systemctl --user disable openclaw"
echo ""
echo "  Log file: $HOME/.openclaw/daemon.log"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
