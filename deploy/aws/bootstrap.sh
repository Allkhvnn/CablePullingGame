#!/usr/bin/env bash
# EC2 User data for Amazon Linux 2023 (x86_64). Runs once as root.
set -Eeuo pipefail
exec > >(tee -a /var/log/cable-pulling-bootstrap.log) 2>&1

APP_DIR=/opt/cable-pulling-game
REPO_URL=https://github.com/Allkhvnn/CablePullingGame.git

dnf install -y git nginx nodejs24 nodejs24-npm

# npm/Vite/TypeScript need more memory than a micro instance has during build.
if [[ ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
fi
swapon --noheadings --show=NAME | grep -Fxq /swapfile || swapon /swapfile

install -d -o ec2-user -g ec2-user "$APP_DIR"
runuser -u ec2-user -- git clone --depth 1 --branch main "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"
runuser -u ec2-user -- /usr/bin/npm-24 ci --include=dev
runuser -u ec2-user -- /usr/bin/npm-24 run build

install -m 0644 deploy/aws/cable-pulling.service /etc/systemd/system/cable-pulling.service
install -m 0644 deploy/aws/nginx.conf /etc/nginx/nginx.conf
nginx -t
systemctl daemon-reload
systemctl enable --now cable-pulling.service
systemctl enable --now nginx.service
curl --fail --silent --show-error --retry 12 --retry-delay 2 http://127.0.0.1/health
