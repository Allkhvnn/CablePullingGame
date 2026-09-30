#!/usr/bin/env bash
# Runs in GitHub Actions after CI. SSM executes update.sh on the existing EC2.
set -Eeuo pipefail

: "${EC2_INSTANCE_ID:?Set the EC2_INSTANCE_ID repository variable}"
: "${GITHUB_SHA:?Expected the tested GitHub commit SHA}"
if [[ ! "$GITHUB_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'Invalid GitHub commit SHA' >&2
  exit 1
fi

parameters=$(printf '{"commands":["runuser -u ec2-user -- bash /opt/cable-pulling-game/deploy/aws/update.sh %s"]}' "$GITHUB_SHA")

command_id=$(aws ssm send-command \
  --instance-ids "$EC2_INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters "$parameters" \
  --timeout-seconds 600 \
  --comment "CablePullingGame GitHub Actions deploy" \
  --query 'Command.CommandId' --output text)

echo "SSM command: $command_id"
status=''
for attempt in {1..120}; do
  # The invocation can take a few seconds to appear after send-command.
  status=$(aws ssm get-command-invocation \
    --command-id "$command_id" --instance-id "$EC2_INSTANCE_ID" \
    --query 'Status' --output text 2>/dev/null) || status=''
  case "$status" in
    Success|Failed|Cancelled|TimedOut) break ;;
    Pending|InProgress|Delayed|'') sleep 5 ;;
    *) echo "Unexpected SSM status: $status"; exit 1 ;;
  esac
done

aws ssm get-command-invocation \
  --command-id "$command_id" --instance-id "$EC2_INSTANCE_ID" \
  --query '{Status:StatusDetails,ExitCode:ResponseCode,Output:StandardOutputContent,Error:StandardErrorContent}' \
  --output json

if [[ "$status" != Success ]]; then
  echo "Deployment did not succeed: ${status:-timeout waiting for SSM}"
  exit 1
fi
