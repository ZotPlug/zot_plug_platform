#!/bin/bash

BACKUP_FILE="/backups/backup_$(date +%Y%m%d_%H%M%S).sql"

docker exec -it pg_db pg_dump -U myuser mydb > "$BACKUP_FILE"

echo "Backup saved to $BACKUP_FILE"
