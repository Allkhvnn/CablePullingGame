#!/usr/bin/env bash
# Run as ec2-user from SSH: bash /opt/cable-pulling-game/deploy/aws/update.sh
set -Eeuo pipefail
APP_DIR=/opt/cable-pulling-game
cd "$APP_DIR"
git fetch origin main
# CI передаёт проверенный commit. Ручной запуск без аргумента берёт текущий main.
target=${1:-origin/main}
if [[ $# -gt 0 && ! "$target" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Expected a full Git commit SHA' >&2
  exit 1
fi
git merge-base --is-ancestor "$target" origin/main
git merge --ff-only "$target"
/usr/bin/npm-24 ci --include=dev
/usr/bin/npm-24 run build
sudo systemctl restart cable-pulling.service
curl --fail --silent --show-error http://127.0.0.1/health
printf '\nDeployed commit: %s\n' "$(git rev-parse HEAD)"
