#!/bin/sh

mkdir -p /backups/logs

# DBバックアップ + ログバックアップ（毎日3時）
# ローテーション後のログは app.YYYY-MM-DD.log 形式（前日分を対象）
CRON="0 3 * * * \
  pg_dump -h db -U aipo_postgres aipo | gzip > /backups/\$(date +\%Y\%m\%d_\%H\%M\%S).dump.gz && \
  find /backups -maxdepth 1 -name '*.dump.gz' -mtime +30 -delete && \
  PREV_DATE=\$(date -d 'yesterday' +\%Y-\%m-\%d) && \
  LOG_SRC=/var/log/app/app.\${PREV_DATE}.log && \
  if [ -f \"\$LOG_SRC\" ]; then \
    gzip -c \"\$LOG_SRC\" > /backups/logs/app_\$(date +\%Y\%m\%d_\%H\%M\%S).log.gz; \
  fi && \
  find /backups/logs -name '*.log.gz' -mtime +30 -delete && \
  echo \"Backup completed: \$(date)\""

echo "$CRON" | crontab -
crond -f
