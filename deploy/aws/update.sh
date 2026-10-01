#!/usr/bin/env bash
# Run as ec2-user from SSH: bash /opt/cable-pulling-game/deploy/aws/update.sh
set -Eeuo pipefail
APP_DIR=/opt/cable-pulling-game
cd "$APP_DIR"
git pull --ff-only origin main
/usr/bin/npm-24 ci --include=dev
/usr/bin/npm-24 run build
sudo systemctl restart cable-pulling.service
curl --fail --silent --show-error http://127.0.0.1/health
