#!/bin/sh

mkdir -p /backups

# DBバックアップ + 古いファイル削除（毎日3時）
CRON="0 3 * * * \
  pg_dump -h db -U aipo_postgres aipo --format=custom -f /backups/\$(date +\%Y\%m\%d_\%H\%M\%S).dump && \
  find /backups -maxdepth 1 -name '*.dump' -mtime +30 -delete && \
  find /var/log/app -name '*.log' -mtime +30 -delete && \
  echo \"Backup and cleanup completed: \$(date)\""

echo "$CRON" | crontab -
crond -f
